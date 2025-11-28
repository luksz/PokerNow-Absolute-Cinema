# PokerNow Hand History Analyzer

This is a Python tool that parses **PokerNow** hand history CSV exports and produces per-player statistics such as VPIP, PFR, 3-bet, C-bet frequencies, aggression factors, and winrates (BB/100). It also performs basic sanity checks on money flow per hand.

---

## 1. Requirements

- **Python**: 3.9+ (recommended 3.10 or newer)
- **pip** (Python package manager)

Python dependencies:

- `pandas`

---

## 2. Setup

### 2.1. Create project folder

mkdir poker-analyzer
cd poker-analyzer

Place analyze.py and your CSV files inside this folder.

### 2.2. Create and activate virtual environment

python -m venv venv

- macOS / Linux:
source venv/bin/activate

- Windows (PowerShell):
.\venv\Scripts\Activate.ps1

### 2.3. Install dependencies

pip install --upgrade pip
pip install pandas

---

## 3. Getting PokerNow CSV Logs

1. Go to your PokerNow room.
2. Use the Export / Download hand history feature.
3. Save the CSV file(s) inside this folder (e.g., sample.csv).
4. You can analyze one or many CSV files.

---

## 4. Usage

Analyze a single file:
python analyze.py sample.csv

Analyze multiple sessions:
python analyze.py session1.csv session2.csv session3.csv

Enable preflop debug (prints open/3bet/4bet info):
python analyze.py --debug-preflop sample.csv

If no files are provided, it prints:
Usage: python analyze.py [--debug-preflop] file1.csv [file2.csv ...]

---

## 5. What the Script Does

### 5.1 Hand splitting
- Reads CSV(s) containing an entry column.
- Splits into hands using lines like -- starting hand #123....

### 5.2 Street detection
Recognizes:
- Preflop
- Flop (*** FLOP ***, Flop:)
- Turn (*** TURN ***, Turn:)
- River (*** RIVER ***, River:)

### 5.3 Player name extraction
PokerNow logs contain names like:
"loki @ 7Nv8hjyL1f" raises to 0.30

The analyzer extracts just the base name, e.g. loki, so all session IDs map to the same person.

### 5.4 Money tracking
Tracks per-player:
invested (blinds, calls, bets, raises)
collected (winning pot)
uncalled bets (returned amounts)
handles multi-street contribution deltas

Per-hand sanity check printed as:
[WARN] Hand 10: non-zero net total = ...

Global total shown:
DEBUG total net profit across all players: ...

---

## 6. Output Statistics

After running, you get a full stats table like:

player  hands  BB/100  VPIP%  PFR%  3BET%  AF  AFq%  WTSD%  W$SD%  WWSF%  Flop Cbet%  Fold to Flop Cbet% ...

The script outputs everything, including:

Winrates
BB/100
Showdown BB/100
Non-SD BB/100

Preflop Metrics
VPIP%
PFR%
Limp%
Call Open%
Squeeze%
3BET% / 4BET%
Fold to 3BET% / Fold to 4BET%

Postflop Metrics
AF (Aggression Factor)
AFq%
WTSD% (Went to Showdown)
W$SD% (Won $ at Showdown)
WWSF% (Won When Saw Flop)

C-Bet Stats
Flop Cbet%
Turn Cbet%
River Cbet%
Fold vs Cbet for every street

Check-Raise frequencies
CR Flop%
CR Turn%
CR River%

Donk Bet frequencies
Donk Flop%
Donk Turn%
Donk River%

Hand volume
hands
SawFlop

Saved files
On every run, two files are exported:
player_stats_summary.csv
player_stats_summary.json

You can load them in Excel, Notion, a database, or your frontend.

---

## 7. Debugging & Improving Accuracy

If you see many warnings, it usually means:
PokerNow changed a log format line, OR
The file contains side-pots/split-pots that were parsed differently

To debug:
Take a tiny hand sample (1–2 hands)
Run:
python analyze.py --debug-preflop sample.csv

Inspect deltas and adjust regex patterns inside:
“Uncalled bet”
“collected … from pot”
multi-pot variations

---

## 8. Deactivate the Environment

When done:
deactivate

To resume later:
source venv/bin/activate

---

## 9. Notes

This tool is intended for home games only.
Make sure players are OK with sharing logs.
You are free to modify and extend the analyzer.
