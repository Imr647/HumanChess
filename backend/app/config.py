from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN_DIR = ROOT / "bin"
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

STOCKFISH_PATH = Path(os.environ.get("HCHESS_STOCKFISH", BIN_DIR / "stockfish"))
DB_PATH = Path(os.environ.get("HCHESS_DB", DATA_DIR / "humanchess.db"))

MAIA_DEVICE = os.environ.get("HCHESS_DEVICE", "cpu")
MAIA_HISTORY = os.environ.get("HCHESS_MAIA_HISTORY", "1") == "1"

DEFAULT_MODEL = os.environ.get("HCHESS_MAIA_MODEL", "maia3-5m")

BOT_THINK_SCALE = float(os.environ.get("HCHESS_BOT_THINK_SCALE", "1.0"))
BOT_THINK_JITTER = float(os.environ.get("HCHESS_BOT_THINK_JITTER", "0.4"))

STOCKFISH_DEPTH = int(os.environ.get("HCHESS_SF_DEPTH", "14"))
REVIEW_DEPTH = int(os.environ.get("HCHESS_REVIEW_DEPTH", "12"))
STOCKFISH_THREADS = int(os.environ.get("HCHESS_SF_THREADS", "4"))
STOCKFISH_HASH_MB = int(os.environ.get("HCHESS_SF_HASH", "256"))
