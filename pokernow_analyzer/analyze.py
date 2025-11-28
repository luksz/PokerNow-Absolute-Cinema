import sys
import re
from collections import defaultdict

import pandas as pd

START_HAND_RE = re.compile(r"-- starting hand #(\d+)")
FLOP_MARKERS = ("*** FLOP ***", "Flop:")


def load_df(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    # Make sure rows are in chronological order
    if "order" in df.columns:
        df = df.sort_values("order")
    return df


def split_into_hands(df: pd.DataFrame):
    """
    Returns a list of hands; each hand is a list of 'entry' strings.
    We start a new hand whenever we see '-- starting hand #'.
    """
    hands = []
    current = None

    for _, row in df.iterrows():
        entry = row["entry"]

        # detect start of new hand
        if "-- starting hand #" in entry:
            # close previous hand if any
            if current is not None and current:
                hands.append(current)
            current = []

        if current is not None:
            current.append(entry)

    # last hand
    if current:
        hands.append(current)

    return hands


def extract_player_name(entry: str) -> str | None:
    """
    PokerNow lines look like: '"loki @ 7Nv8hjyL1f" raises to 0.30'
    We just want the display name before the @.
    """
    m = re.search(r'"([^"]+?) @ [^"]+"', entry)
    if not m:
        return None
    return m.group(1)


def analyze_preflop_stats(hands: list[list[str]]):
    """
    For each player, compute:
      - hands_played_preflop
      - vpip_count
      - pfr_count
    """
    hands_played = defaultdict(int)
    vpip_count = defaultdict(int)
    pfr_count = defaultdict(int)

    for hand in hands:
        # per-hand temporary flags
        saw_preflop = defaultdict(bool)
        vpip_this_hand = defaultdict(bool)
        pfr_this_hand = defaultdict(bool)

        preflop_done = False

        for entry in hand:
            # stop at flop – everything after is postflop
            if any(marker in entry for marker in FLOP_MARKERS):
                preflop_done = True
                break

            name = extract_player_name(entry)
            if not name:
                continue

            # mark that this player was dealt into this hand preflop
            saw_preflop[name] = True

            # ignore forced blinds (not VPIP)
            if "posts a small blind" in entry or "posts a big blind" in entry:
                continue

            # voluntary money into pot preflop
            is_call = " calls " in entry
            is_bet = " bets " in entry
            is_raise = " raises to " in entry or " raises " in entry

            if is_call or is_bet or is_raise:
                vpip_this_hand[name] = True

            # any bet/raise preflop counts as PFR for that hand
            if is_bet or is_raise:
                pfr_this_hand[name] = True

        # after scanning this hand, update global counters
        for name, saw in saw_preflop.items():
            if not saw:
                continue
            hands_played[name] += 1
            if vpip_this_hand[name]:
                vpip_count[name] += 1
            if pfr_this_hand[name]:
                pfr_count[name] += 1

    # build result table
    rows = []
    for name in sorted(hands_played.keys()):
        h = hands_played[name]
        vpip = 100 * vpip_count[name] / h if h > 0 else 0.0
        pfr = 100 * pfr_count[name] / h if h > 0 else 0.0
        rows.append(
            {
                "player": name,
                "hands": h,
                "VPIP%": round(vpip, 1),
                "PFR%": round(pfr, 1),
            }
        )

    return pd.DataFrame(rows)


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze.py path/to/pokernow.csv")
        sys.exit(1)

    csv_path = sys.argv[1]
    df = load_df(csv_path)
    hands = split_into_hands(df)
    stats_df = analyze_preflop_stats(hands)

    # Sort by hands played descending
    stats_df = stats_df.sort_values("hands", ascending=False)

    print("\n=== Preflop stats (basic) ===")
    print(stats_df.to_string(index=False))


if __name__ == "__main__":
    main()
