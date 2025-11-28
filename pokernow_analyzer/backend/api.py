# api.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List
import pandas as pd

from analyze import split_into_hands, detect_big_blind, analyze_all_stats

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PokerNow Analyzer API",
    description="Upload PokerNow CSV logs and get per-player stats.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],  # adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_df_from_upload(upload: UploadFile) -> pd.DataFrame:
    """
    Read a single uploaded CSV into a DataFrame.
    Mirrors your load_df() logic: sort by 'order' if present.
    """
    try:
        df = pd.read_csv(upload.file)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read CSV '{upload.filename}': {e}",
        )
    finally:
        # reset file pointer just in case
        upload.file.seek(0)

    if "entry" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"CSV '{upload.filename}' is missing required 'entry' column.",
        )

    if "order" in df.columns:
        df = df.sort_values("order")

    return df


@app.post("/analyze")
async def analyze_pokernow(
    files: List[UploadFile] = File(..., description="One or more PokerNow CSV log files"),
):
    """
    Accept 1..N PokerNow CSV logs, merge them, and return per-player stats.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    dfs: List[pd.DataFrame] = []

    for f in files:
        if not f.filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not a CSV.",
            )
        df = load_df_from_upload(f)
        dfs.append(df)

    # merge all logs
    df_all = pd.concat(dfs, ignore_index=True)

    # split into hands using your existing logic
    hands = split_into_hands(df_all)

    # skip any lobby junk before first real hand
    first_real = None
    for i, h in enumerate(hands):
        if any("-- starting hand #" in e for e in h):
            first_real = i
            break

    if first_real is None:
        raise HTTPException(status_code=400, detail="No valid hands found in uploaded file(s).")

    hands_clean = hands[first_real:]

    # detect big blind (assumes same stakes across uploaded files)
    big_blind = detect_big_blind(df_all)

    # run your core analyzer
    stats_df, _ = analyze_all_stats(
        hands_clean,
        big_blind=big_blind,
        collect_debug=False,
    )

    # sort by volume of hands
    stats_df = stats_df.sort_values("hands", ascending=False)

    # build response
    return {
        "num_files": len(files),
        "num_log_lines": len(df_all),
        "num_hands": len(hands_clean),
        "big_blind": big_blind,
        "stats": stats_df.to_dict(orient="records"),
    }
