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
CREATE TABLE IF NOT EXISTS reviews (
    game_id TEXT NOT NULL,
    move_count INTEGER NOT NULL,
    depth INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (game_id, move_count, depth)
);
"""

DEFAULT_PROFILE = {
    "rating": 1200,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "games": 0,
    "history": [],
    "bot_stats": {},
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
            self._conn.execute("DELETE FROM reviews WHERE game_id = ?", (game_id,))
            self._conn.commit()

    def get_review(self, game_id: str, move_count: int, depth: int) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT data FROM reviews WHERE game_id = ? AND move_count = ? AND depth = ?",
                (game_id, move_count, depth),
            ).fetchone()
        return json.loads(row["data"]) if row else None

    def save_review(self, game_id: str, move_count: int, depth: int, data: dict) -> None:
        now = time.time()
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO reviews (game_id, move_count, depth, data, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(game_id, move_count, depth)
                DO UPDATE SET data = excluded.data, created_at = excluded.created_at
                """,
                (game_id, move_count, depth, json.dumps(data), now),
            )
            self._conn.commit()

    def _backfill_bot_stats_locked(self) -> dict[str, dict[str, int]]:
        rows = self._conn.execute("SELECT data FROM games").fetchall()
        stats: dict[str, dict[str, int]] = {}
        for row in rows:
            rec = json.loads(row["data"])
            if rec.get("status", "ongoing") in ("ongoing", "aborted"):
                continue
            if rec.get("assisted", False):
                continue
            bot_id = rec.get("bot_id")
            result = rec.get("result")
            if not bot_id or not result:
                continue
            entry = stats.setdefault(bot_id, {"wins": 0, "losses": 0, "draws": 0})
            player_is_white = rec.get("player_color", "white") == "white"
            if result == "1/2-1/2":
                entry["draws"] += 1
            elif (result == "1-0") == player_is_white:
                entry["wins"] += 1
            else:
                entry["losses"] += 1
        return stats

    def get_profile(self) -> dict:
        with self._lock:
            row = self._conn.execute(
                "SELECT value FROM meta WHERE key = 'profile'"
            ).fetchone()
            stored = json.loads(row["value"]) if row else {}
            profile = {
                "rating": stored.get("rating", DEFAULT_PROFILE["rating"]),
                "wins": stored.get("wins", 0),
                "losses": stored.get("losses", 0),
                "draws": stored.get("draws", 0),
                "games": stored.get("games", 0),
                "history": list(stored.get("history", [])),
                "bot_stats": dict(stored.get("bot_stats", {})),
            }
            if "bot_stats" not in stored:
                profile["bot_stats"] = self._backfill_bot_stats_locked()
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
