import sys
import re
from collections import defaultdict

import pandas as pd

# Street markers in PokerNow logs
FLOP_MARKERS = ("*** FLOP ***", "Flop:")
TURN_MARKERS = ("*** TURN ***", "Turn:")
RIVER_MARKERS = ("*** RIVER ***", "River:")


def load_df(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    if "order" in df.columns:
        df = df.sort_values("order")
    return df


def split_into_hands(df: pd.DataFrame):
    """
    Split the log into hands. Each 'hand' is a list of entry strings.
    We start a new hand whenever we see '-- starting hand #'.
    """
    hands = []
    current = []
    for _, row in df.iterrows():
        entry = row["entry"]
        if "-- starting hand #" in entry:
            if current:
                hands.append(current)
            current = []
        if current is not None:
            current.append(entry)
    if current:
        hands.append(current)
    return hands


def extract_player_name(entry: str):
    """
    PokerNow lines look like: '"loki @ 7Nv8hjyL1f" raises to 0.30'
    We just want 'loki'.
    """
    m = re.search(r'"([^"]+?) @ [^"]+"', entry)
    if not m:
        return None
    return m.group(1)


def detect_big_blind(df: pd.DataFrame) -> float:
    """
    Try to auto-detect the big blind size from 'posts a big blind' entries.
    Fallback to 1.0 if not found.
    """
    for entry in df["entry"]:
        if "posts a big blind of" in entry:
            m = re.search(r"big blind of ([0-9]+\.[0-9]+)", entry)
            if m:
                return float(m.group(1))
    return 1.0


def analyze_all_stats(
    hands: list[list[str]],
    big_blind: float = 0.2,
    collect_debug: bool = False,
):
    from collections import defaultdict
    import pandas as pd
    import re

    # === Global counters ===
    hands_played = defaultdict(int)

    # Preflop core
    vpip_hands = defaultdict(int)
    pfr_hands = defaultdict(int)
    open_raise_hands = defaultdict(int)

    threebet_hands = defaultdict(int)
    fourbet_hands = defaultdict(int)
    threebet_opp = defaultdict(int)
    fourbet_opp = defaultdict(int)
    fold_to_3bet_hands = defaultdict(int)
    fold_to_4bet_hands = defaultdict(int)

    # Streets seen
    saw_flop_hands = defaultdict(int)
    saw_turn_hands = defaultdict(int)
    saw_river_hands = defaultdict(int)

    # Showdown / win when saw flop
    wtsd_hands = defaultdict(int)
    wsd_hands = defaultdict(int)
    wwsf_hands = defaultdict(int)

    # C-bet / fold to C-bet
    preflop_agg_flop_opp = defaultdict(int)
    flop_cbet_hands = defaultdict(int)
    flop_cbet_faced_opp = defaultdict(int)
    flop_fold_to_cbet_hands = defaultdict(int)

    turn_cbet_opp = defaultdict(int)
    turn_cbet_hands = defaultdict(int)
    turn_cbet_faced_opp = defaultdict(int)
    turn_fold_to_cbet_hands = defaultdict(int)

    river_cbet_opp = defaultdict(int)
    river_cbet_hands = defaultdict(int)
    river_cbet_faced_opp = defaultdict(int)
    river_fold_to_cbet_hands = defaultdict(int)

    # Aggression
    af_aggr = defaultdict(int)
    af_calls = defaultdict(int)
    af_folds = defaultdict(int)

    # Check-raise
    cr_flop = defaultdict(int)
    cr_turn = defaultdict(int)
    cr_river = defaultdict(int)

    # Donk bets
    donk_flop = defaultdict(int)
    donk_turn = defaultdict(int)
    donk_river = defaultdict(int)

    # Extra preflop behaviours
    limp_hands = defaultdict(int)
    call_open_hands = defaultdict(int)
    squeeze_hands = defaultdict(int)

    # Profit splits
    net_profit = defaultdict(float)
    sd_profit = defaultdict(float)
    nonsd_profit = defaultdict(float)

    # Optional debug dump for preflop action
    preflop_debug = [] if collect_debug else None

    for hand_idx, hand in enumerate(hands, start=1):
        # Per-hand trackers
        from collections import defaultdict as dd

        total_contrib = dd(float)
        invested = dd(float)
        collected = dd(float)

        active = set()
        saw_preflop = dd(bool)
        vpip_this = dd(bool)
        pfr_this = dd(bool)

        open_raise_this = dd(bool)
        threebet_this = dd(bool)
        fourbet_this = dd(bool)

        threebet_opp_this = dd(bool)
        fourbet_opp_this = dd(bool)
        fold_to_3bet_this = dd(bool)
        fold_to_4bet_this = dd(bool)

        saw_flop_this = dd(bool)
        saw_turn_this = dd(bool)
        saw_river_this = dd(bool)

        wtsd_this = dd(bool)
        wsd_this = dd(bool)
        wwsf_this = dd(bool)

        flop_fold_to_cbet_this = dd(bool)
        turn_fold_to_cbet_this = dd(bool)
        river_fold_to_cbet_this = dd(bool)

        aggr_postflop = dd(int)
        calls_postflop = dd(int)
        folds_postflop = dd(int)

        street = "preflop"
        showdown = False

        preflop_raises_seq: list[str] = []
        open_raiser = None
        three_bettor = None
        four_bettor = None

        preflop_agg = None   # last preflop raiser
        flop_agg = None      # last flop aggressor
        turn_agg = None      # last turn aggressor

        flop_cbet_done = False
        flop_cbet_by = None
        turn_cbet_done = False
        turn_cbet_by = None
        river_cbet_done = False
        river_cbet_by = None

        # For check-raise detection
        checked_before_bet = {
            "flop": dd(bool),
            "turn": dd(bool),
            "river": dd(bool),
        }
        faced_bet = {
            "flop": dd(bool),
            "turn": dd(bool),
            "river": dd(bool),
        }

        # To recognise first bet on each street (for donk / cbet)
        flop_bet_seen = False
        turn_bet_seen = False
        river_bet_seen = False

        # To detect squeezes (open + cold caller + 3-bet)
        has_caller_after_open = False

        for entry in hand:
            # --- Street markers ---
            if any(m in entry for m in FLOP_MARKERS):
                street = "flop"
                if preflop_raises_seq:
                    preflop_agg = preflop_raises_seq[-1]
                for n in active:
                    saw_flop_this[n] = True
                continue

            if any(m in entry for m in TURN_MARKERS):
                street = "turn"
                for n in active:
                    saw_turn_this[n] = True
                continue

            if any(m in entry for m in RIVER_MARKERS):
                street = "river"
                for n in active:
                    saw_river_this[n] = True
                continue

            if "shows a " in entry:
                showdown = True

            # Uncalled bet returned
            if entry.startswith("Uncalled bet"):
                m2 = re.search(
                    r'Uncalled bet of ([0-9]+\.[0-9]+) returned to "([^"]+)"', entry
                )
                if m2:
                    amt = float(m2.group(1))
                    pname = m2.group(2)
                    invested[pname] -= amt
                    total_contrib[pname] -= amt
                continue

            name = extract_player_name(entry)
            if not name:
                continue

            # Preflop presence / 3b/4b opportunities
            if street == "preflop":
                saw_preflop[name] = True
                active.add(name)

                if open_raiser is not None and three_bettor is None and name != open_raiser:
                    threebet_opp_this[name] = True

                if (
                    open_raiser is not None
                    and three_bettor is not None
                    and four_bettor is None
                    and name == open_raiser
                ):
                    fourbet_opp_this[name] = True

            # Blinds
            if "posts a small blind" in entry or "posts a big blind" in entry:
                m = re.search(r"([0-9]+\.[0-9]+)", entry)
                if m:
                    amt = float(m.group(1))
                    invested[name] += amt
                    total_contrib[name] += amt
                continue

            # Folds
            if " folds" in entry:
                if street == "preflop":
                    if threebet_opp_this[name] and not threebet_this[name]:
                        fold_to_3bet_this[name] = True
                    if fourbet_opp_this[name] and not fourbet_this[name]:
                        fold_to_4bet_this[name] = True
                else:
                    folds_postflop[name] += 1
                    if street == "flop" and flop_cbet_done:
                        flop_fold_to_cbet_this[name] = True
                    if street == "turn" and turn_cbet_done:
                        turn_fold_to_cbet_this[name] = True
                    if street == "river" and river_cbet_done:
                        river_fold_to_cbet_this[name] = True

                active.discard(name)
                continue

            # Calls
            if " calls " in entry:
                m = re.search(r" calls ([0-9]+\.[0-9]+)", entry)
                if m:
                    amt = float(m.group(1))
                    invested[name] += amt
                    total_contrib[name] += amt

                    if street == "preflop":
                        vpip_this[name] = True

                        # Limp: no raise yet, just calling (besides blinds)
                        if open_raiser is None:
                            limp_hands[name] += 1

                        # Call open raise: open exists, no 3bet yet, and not opener
                        if (
                            open_raiser is not None
                            and three_bettor is None
                            and name != open_raiser
                        ):
                            call_open_hands[name] += 1
                            has_caller_after_open = True
                    else:
                        calls_postflop[name] += 1
                        faced_bet[street][name] = True
                continue

            # Checks
            if " checks" in entry:
                if street in ("flop", "turn", "river"):
                    checked_before_bet[street][name] = True
                continue

            # Helper: all postflop bets/raises go through here
            def handle_postflop_aggr(street_local: str, actor: str):
                nonlocal flop_agg, turn_agg, flop_bet_seen, turn_bet_seen, river_bet_seen
                nonlocal flop_cbet_done, flop_cbet_by
                nonlocal turn_cbet_done, turn_cbet_by
                nonlocal river_cbet_done, river_cbet_by

                aggr_postflop[actor] += 1

                # everybody else is now "facing a bet" on this street
                for p in list(active):
                    if p != actor:
                        faced_bet[street_local][p] = True

                if street_local == "flop":
                    prev_agg = preflop_agg
                    first_flag = not flop_bet_seen
                    flop_bet_seen = True

                    if first_flag and prev_agg is not None:
                        # first flop bet = either cbet or donk
                        if actor == prev_agg:
                            if not flop_cbet_done:
                                flop_cbet_done = True
                                flop_cbet_by = actor
                        else:
                            donk_flop[actor] += 1

                elif street_local == "turn":
                    prev_agg = flop_agg
                    first_flag = not turn_bet_seen
                    turn_bet_seen = True

                    if first_flag and prev_agg is not None:
                        if actor == prev_agg:
                            if not turn_cbet_done:
                                turn_cbet_done = True
                                turn_cbet_by = actor
                        else:
                            donk_turn[actor] += 1

                elif street_local == "river":
                    prev_agg = turn_agg
                    first_flag = not river_bet_seen
                    river_bet_seen = True

                    if first_flag and prev_agg is not None:
                        if actor == prev_agg:
                            if not river_cbet_done:
                                river_cbet_done = True
                                river_cbet_by = actor
                        else:
                            donk_river[actor] += 1

            # Bets
            if " bets " in entry:
                m = re.search(r" bets ([0-9]+\.[0-9]+)", entry)
                if m:
                    amt = float(m.group(1))
                    invested[name] += amt
                    total_contrib[name] += amt

                    if street == "preflop":
                        vpip_this[name] = True
                        pfr_this[name] = True

                        if open_raiser is None:
                            open_raiser = name
                            open_raise_this[name] = True
                        elif three_bettor is None:
                            three_bettor = name
                            threebet_this[name] = True
                            # Squeeze = 3bet after open + at least one caller
                            if (
                                has_caller_after_open
                                and open_raiser is not None
                                and name != open_raiser
                            ):
                                squeeze_hands[name] += 1
                        elif four_bettor is None and name == open_raiser:
                            four_bettor = name
                            fourbet_this[name] = True

                        preflop_raises_seq.append(name)
                    else:
                        handle_postflop_aggr(street, name)
                        if street == "flop":
                            flop_agg = name
                        elif street == "turn":
                            turn_agg = name
                continue

            # Raises
            if " raises to " in entry:
                m = re.search(r" raises to ([0-9]+\.[0-9]+)", entry)
                if m:
                    to_amt = float(m.group(1))
                    delta = max(0.0, to_amt - total_contrib[name])
                    invested[name] += delta
                    total_contrib[name] += delta

                    if street == "preflop":
                        vpip_this[name] = True
                        pfr_this[name] = True

                        if open_raiser is None:
                            open_raiser = name
                            open_raise_this[name] = True
                        elif three_bettor is None:
                            three_bettor = name
                            threebet_this[name] = True
                            if (
                                has_caller_after_open
                                and open_raiser is not None
                                and name != open_raiser
                            ):
                                squeeze_hands[name] += 1
                        elif four_bettor is None and name == open_raiser:
                            four_bettor = name
                            fourbet_this[name] = True

                        preflop_raises_seq.append(name)
                    else:
                        # Check-raise: they checked earlier on this street and now raise
                        if checked_before_bet[street][name] and faced_bet[street][name]:
                            if street == "flop":
                                cr_flop[name] += 1
                            elif street == "turn":
                                cr_turn[name] += 1
                            elif street == "river":
                                cr_river[name] += 1

                        handle_postflop_aggr(street, name)
                        if street == "flop":
                            flop_agg = name
                        elif street == "turn":
                            turn_agg = name
                continue

            # Collected from pot
            if " collected " in entry and "from pot" in entry:
                m = re.search(r" collected ([0-9]+\.[0-9]+) from pot", entry)
                if m:
                    amt = float(m.group(1))
                    collected[name] += amt
                continue

        # --- Per-hand post-processing ---

        any_flop = any(m in e for e in hand for m in FLOP_MARKERS)
        any_turn = any(m in e for e in hand for m in TURN_MARKERS)
        any_river = any(m in e for e in hand for m in RIVER_MARKERS)

        if collect_debug and preflop_debug is not None:
            preflop_debug.append(
                {
                    "hand_index": hand_idx,
                    "open_raiser": open_raiser,
                    "three_bettor": three_bettor,
                    "four_bettor": four_bettor,
                }
            )

        # Who actually showed cards
        shows_map: dict[str, bool] = {}
        if showdown:
            for entry in hand:
                if "shows a " in entry:
                    n = extract_player_name(entry)
                    if n:
                        shows_map[n] = True

        all_names = set(saw_preflop.keys()) | set(invested.keys()) | set(collected.keys())

        for n in all_names:
            if saw_preflop[n]:
                hands_played[n] += 1
            if saw_flop_this[n]:
                saw_flop_hands[n] += 1
            if saw_turn_this[n]:
                saw_turn_hands[n] += 1
            if saw_river_this[n]:
                saw_river_hands[n] += 1

            if showdown and shows_map.get(n, False):
                wtsd_this[n] = True

            if collected[n] > 0 and saw_flop_this[n]:
                wwsf_this[n] = True

            delta = collected[n] - invested[n]
            net_profit[n] += delta
            if showdown and shows_map.get(n, False):
                sd_profit[n] += delta
            else:
                nonsd_profit[n] += delta

            af_aggr[n] += aggr_postflop[n]
            af_calls[n] += calls_postflop[n]
            af_folds[n] += folds_postflop[n]

        # WTSD / W$SD / WWSF
        for n, went in wtsd_this.items():
            if went:
                wtsd_hands[n] += 1
                if collected[n] > 0:
                    wsd_this[n] = True
        for n, won in wsd_this.items():
            if won:
                wsd_hands[n] += 1
        for n, wonf in wwsf_this.items():
            if wonf:
                wwsf_hands[n] += 1

        # Preflop stat tallies
        for n, saw in saw_preflop.items():
            if not saw:
                continue
            if vpip_this[n]:
                vpip_hands[n] += 1
            if pfr_this[n]:
                pfr_hands[n] += 1
            if open_raise_this[n]:
                open_raise_hands[n] += 1
            if threebet_this[n]:
                threebet_hands[n] += 1
            if fourbet_this[n]:
                fourbet_hands[n] += 1
            if threebet_opp_this[n]:
                threebet_opp[n] += 1
            if fourbet_opp_this[n]:
                fourbet_opp[n] += 1
            if fold_to_3bet_this[n]:
                fold_to_3bet_hands[n] += 1
            if fold_to_4bet_this[n]:
                fold_to_4bet_hands[n] += 1

        # Flop / turn / river C-bet accounting
        if any_flop and preflop_agg is not None and saw_flop_this[preflop_agg]:
            preflop_agg_flop_opp[preflop_agg] += 1
            if flop_cbet_done and flop_cbet_by == preflop_agg:
                flop_cbet_hands[preflop_agg] += 1

        if flop_cbet_done:
            for n in saw_flop_this.keys():
                if n == flop_cbet_by:
                    continue
                if saw_flop_this[n]:
                    flop_cbet_faced_opp[n] += 1
                    if flop_fold_to_cbet_this[n]:
                        flop_fold_to_cbet_hands[n] += 1

        if any_turn and flop_agg is not None and saw_turn_this[flop_agg]:
            turn_cbet_opp[flop_agg] += 1
            if turn_cbet_done and turn_cbet_by == flop_agg:
                turn_cbet_hands[flop_agg] += 1

        if turn_cbet_done:
            for n in saw_turn_this.keys():
                if n == turn_cbet_by:
                    continue
                if saw_turn_this[n]:
                    turn_cbet_faced_opp[n] += 1
                    if turn_fold_to_cbet_this[n]:
                        turn_fold_to_cbet_hands[n] += 1

        if any_river and turn_agg is not None and saw_river_this[turn_agg]:
            river_cbet_opp[turn_agg] += 1
            if river_cbet_done and river_cbet_by == turn_agg:
                river_cbet_hands[turn_agg] += 1

        if river_cbet_done:
            for n in saw_river_this.keys():
                if n == river_cbet_by:
                    continue
                if saw_river_this[n]:
                    river_cbet_faced_opp[n] += 1
                    if river_fold_to_cbet_this[n]:
                        river_fold_to_cbet_hands[n] += 1

    # === Build output DataFrame ===
    rows = []
    for n in sorted(hands_played.keys()):
        h = hands_played[n]
        if h == 0:
            continue

        vpip = 100 * vpip_hands[n] / h
        pfr = 100 * pfr_hands[n] / h
        bb100 = (net_profit[n] / big_blind) / h * 100 if big_blind > 0 else 0.0

        sf = saw_flop_hands[n]
        st = saw_turn_hands[n]
        sr = saw_river_hands[n]

        wtsd_pct = 100 * wtsd_hands[n] / sf if sf > 0 else 0.0
        wsd_pct = (
            100 * wsd_hands[n] / wtsd_hands[n] if wtsd_hands[n] > 0 else 0.0
        )
        wwsf_pct = 100 * wwsf_hands[n] / sf if sf > 0 else 0.0

        three_opp = threebet_opp[n]
        four_opp = fourbet_opp[n]
        three_pct = 100 * threebet_hands[n] / three_opp if three_opp > 0 else 0.0
        four_pct = 100 * fourbet_hands[n] / four_opp if four_opp > 0 else 0.0
        ft3_pct = (
            100 * fold_to_3bet_hands[n] / three_opp if three_opp > 0 else 0.0
        )
        ft4_pct = (
            100 * fold_to_4bet_hands[n] / four_opp if four_opp > 0 else 0.0
        )

        flop_cbet_opp_val = preflop_agg_flop_opp[n]
        flop_cbet_pct = (
            100 * flop_cbet_hands[n] / flop_cbet_opp_val
            if flop_cbet_opp_val > 0
            else 0.0
        )
        flop_faced = flop_cbet_faced_opp[n]
        fold_flop_cbet_pct = (
            100 * flop_fold_to_cbet_hands[n] / flop_faced
            if flop_faced > 0
            else 0.0
        )

        turn_copp = turn_cbet_opp[n]
        turn_cbet_pct = (
            100 * turn_cbet_hands[n] / turn_copp if turn_copp > 0 else 0.0
        )
        turn_faced = turn_cbet_faced_opp[n]
        fold_turn_cbet_pct = (
            100 * turn_fold_to_cbet_hands[n] / turn_faced
            if turn_faced > 0
            else 0.0
        )

        river_copp = river_cbet_opp[n]
        river_cbet_pct = (
            100 * river_cbet_hands[n] / river_copp if river_copp > 0 else 0.0
        )
        river_faced = river_cbet_faced_opp[n]
        fold_river_cbet_pct = (
            100 * river_fold_to_cbet_hands[n] / river_faced
            if river_faced > 0
            else 0.0
        )

        aggr = af_aggr[n]
        calls = af_calls[n]
        folds = af_folds[n]
        af = aggr / calls if calls > 0 else 0.0
        total_pf_act = aggr + calls + folds
        afq = 100 * aggr / total_pf_act if total_pf_act > 0 else 0.0

        cr_flop_pct = 100 * cr_flop[n] / sf if sf > 0 else 0.0
        cr_turn_pct = 100 * cr_turn[n] / st if st > 0 else 0.0
        cr_river_pct = 100 * cr_river[n] / sr if sr > 0 else 0.0

        donk_flop_pct = 100 * donk_flop[n] / sf if sf > 0 else 0.0
        donk_turn_pct = 100 * donk_turn[n] / st if st > 0 else 0.0
        donk_river_pct = 100 * donk_river[n] / sr if sr > 0 else 0.0

        sd_bb100 = (
            (sd_profit[n] / big_blind) / h * 100 if big_blind > 0 else 0.0
        )
        nonsd_bb100 = (
            (nonsd_profit[n] / big_blind) / h * 100 if big_blind > 0 else 0.0
        )

        limp_pct = 100 * limp_hands[n] / h if h > 0 else 0.0
        callopen_pct = 100 * call_open_hands[n] / h if h > 0 else 0.0
        squeeze_pct = 100 * squeeze_hands[n] / h if h > 0 else 0.0

        rows.append(
            {
                "player": n,
                "hands": h,
                "BB/100": round(bb100, 1),
                "SD BB/100": round(sd_bb100, 1),
                "NonSD BB/100": round(nonsd_bb100, 1),
                "VPIP%": round(vpip, 1),
                "PFR%": round(pfr, 1),
                "Limp%": round(limp_pct, 1),
                "Call Open%": round(callopen_pct, 1),
                "Squeeze%": round(squeeze_pct, 1),
                "3BET%": round(three_pct, 1),
                "4BET%": round(four_pct, 1),
                "Fold to 3BET%": round(ft3_pct, 1),
                "Fold to 4BET%": round(ft4_pct, 1),
                "AF": round(af, 2),
                "AFq%": round(afq, 1),
                "SawFlop": sf,
                "WTSD%": round(wtsd_pct, 1),
                "W$SD%": round(wsd_pct, 1),
                "WWSF%": round(wwsf_pct, 1),
                "Flop Cbet%": round(flop_cbet_pct, 1),
                "Fold to Flop Cbet%": round(fold_flop_cbet_pct, 1),
                "Turn Cbet%": round(turn_cbet_pct, 1),
                "Fold to Turn Cbet%": round(fold_turn_cbet_pct, 1),
                "River Cbet%": round(river_cbet_pct, 1),
                "Fold to River Cbet%": round(fold_river_cbet_pct, 1),
                "CR Flop%": round(cr_flop_pct, 1),
                "CR Turn%": round(cr_turn_pct, 1),
                "CR River%": round(cr_river_pct, 1),
                "Donk Flop%": round(donk_flop_pct, 1),
                "Donk Turn%": round(donk_turn_pct, 1),
                "Donk River%": round(donk_river_pct, 1),
            }
        )

    df = pd.DataFrame(rows)
    if collect_debug:
        return df, preflop_debug
    return df, None


def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze.py [--debug-preflop] file1.csv [file2.csv ...]")
        sys.exit(1)

    # optional debug flag
    debug_mode = "--debug-preflop" in sys.argv

    # collect all non-flag args as CSV paths
    csv_paths = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    if not csv_paths:
        print("Please provide at least one CSV file path.")
        sys.exit(1)

    # load and concatenate all CSVs
    dfs = []
    for path in csv_paths:
        try:
            df_part = load_df(path)
        except FileNotFoundError:
            print(f"Error: file not found: {path}")
            sys.exit(1)
        dfs.append(df_part)

    import pandas as pd
    df = pd.concat(dfs, ignore_index=True)

    # split into hands
    hands = split_into_hands(df)

    # Skip any lobby junk before first real hand
    first_real = None
    for i, h in enumerate(hands):
        if any("-- starting hand #" in e for e in h):
            first_real = i
            break
    if first_real is None:
        print("No hands found in file(s).")
        sys.exit(1)

    hands_clean = hands[first_real:]

    # detect big blind (assumes same stakes across files)
    big_blind = detect_big_blind(df)

    # run full analysis
    stats_df, debug_info = analyze_all_stats(
        hands_clean,
        big_blind=big_blind,
        collect_debug=debug_mode,
    )

    # sort by volume of hands desc
    stats_df = stats_df.sort_values("hands", ascending=False)

    print("\n=== Full stats (preflop + flop + showdown + aggression) ===")
    print(stats_df.to_string(index=False))

    # export for website / later use
    stats_df.to_csv("player_stats_summary.csv", index=False)
    stats_df.to_json("player_stats_summary.json", orient="records")

    print("\nSaved:")
    print("  player_stats_summary.csv")
    print("  player_stats_summary.json")

    # optional preflop debug info
    if debug_mode and debug_info is not None:
        print("\n=== Preflop 3-bet / 4-bet debug ===")
        for d in debug_info:
            print(
                f"Hand {d['hand_index']:3d}: "
                f"open={d['open_raiser'] or '-':10s}  "
                f"3bet={d['three_bettor'] or '-':10s}  "
                f"4bet={d['four_bettor'] or '-':10s}"
            )


if __name__ == "__main__":
    main()
