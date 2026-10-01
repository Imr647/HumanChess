from __future__ import annotations

import json
import sqlite3
import threading
import time

from .config import DB_PATH

_SCHEMA = """
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

DEFAULT_PROFILE = {
    "rating": 1200,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "games": 0,
}


class GameStore:
    def __init__(self, path=DB_PATH) -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    def save(self, record: dict) -> None:
        now = time.time()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO games (id, data, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
                """,
                (record["id"], json.dumps(record), record.get("created_at", now), now),
            )
            self._conn.commit()

    def get(self, game_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT data FROM games WHERE id = ?", (game_id,)
            ).fetchone()
        return json.loads(row["data"]) if row else None

    def list(self, limit: int = 50) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT data FROM games ORDER BY updated_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [json.loads(r["data"]) for r in rows]

    def delete(self, game_id: str) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
            self._conn.commit()

    def get_profile(self) -> dict:
        with self._lock:
            row = self._conn.execute(
                "SELECT value FROM meta WHERE key = 'profile'"
            ).fetchone()
        profile = dict(DEFAULT_PROFILE)
        if row:
            profile.update(json.loads(row["value"]))
        return profile

    def set_profile(self, profile: dict) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO meta (key, value) VALUES ('profile', ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (json.dumps(profile),),
            )
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()


store = GameStore()
