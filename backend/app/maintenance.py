from __future__ import annotations

import argparse
import sqlite3
import time
from pathlib import Path

from .config import ABORT_HOURS, DB_PATH, ROOT

BACKUP_DIR = ROOT / "backups"
KEEP = 14
ABORTED = "aborted"


def backup(keep: int = KEEP) -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    doel = BACKUP_DIR / f"humanchess-{time.strftime('%Y%m%d-%H%M%S')}.db"
    bron = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    uit = sqlite3.connect(doel)
    with uit:
        bron.backup(uit)
    uit.close()
    bron.close()
    for oud in sorted(BACKUP_DIR.glob("humanchess-*.db"))[:-keep]:
        oud.unlink()
    return doel


def abort_stale(hours: float = ABORT_HOURS, now: float | None = None) -> list[str]:
    from .db import store
    from .game import GameSession

    grens = (now or time.time()) - hours * 3600
    afgebroken: list[str] = []
    for record in store.list(limit=200):
        if record.get("status") != "ongoing":
            continue
        if record.get("updated_at", 0) > grens:
            continue
        session = GameSession.from_record(record)
        session.status = ABORTED
        session.result_reason = "abandoned"
        session.rated = True
        session.updated_at = time.time()
        store.save(session.to_record())
        afgebroken.append(session.id)
    return afgebroken


def main() -> None:
    parser = argparse.ArgumentParser(description="Onderhoud van de HumanChess-database")
    sub = parser.add_subparsers(dest="commando", required=True)
    back = sub.add_parser("backup", help="maak een back-up van de database")
    back.add_argument("--keep", type=int, default=KEEP)
    abort = sub.add_parser("abort-stale", help="breek verlaten partijen af")
    abort.add_argument("--hours", type=float, default=ABORT_HOURS)
    args = parser.parse_args()

    if args.commando == "backup":
        print(f"back-up gemaakt: {backup(args.keep)}")
        return
    for game_id in abort_stale(args.hours):
        print(f"afgebroken (verlaten): {game_id}")


if __name__ == "__main__":
    main()
