from __future__ import annotations

import threading

import chess
import chess.engine

from .config import (
    STOCKFISH_DEPTH,
    STOCKFISH_HASH_MB,
    STOCKFISH_PATH,
    STOCKFISH_THREADS,
)


class Stockfish:
    def __init__(self) -> None:
        self._engine: chess.engine.SimpleEngine | None = None
        self._lock = threading.Lock()

    def available(self) -> bool:
        return STOCKFISH_PATH.exists()

    def _ensure(self) -> chess.engine.SimpleEngine:
        if not self.available():
            raise FileNotFoundError(f"Stockfish niet gevonden op {STOCKFISH_PATH}")
        if self._engine is None:
            self._engine = chess.engine.SimpleEngine.popen_uci(
                str(STOCKFISH_PATH), timeout=30
            )
            self._engine.configure(
                {"Threads": STOCKFISH_THREADS, "Hash": STOCKFISH_HASH_MB}
            )
        return self._engine

    def analyse(
        self,
        board: chess.Board,
        multipv: int = 1,
        depth: int | None = None,
        time_limit: float | None = None,
    ) -> dict:
        depth = depth or STOCKFISH_DEPTH
        with self._lock:
            engine = self._ensure()
            infos = engine.analyse(
                board,
                chess.engine.Limit(depth=depth, time=time_limit),
                multipv=multipv,
            )
        if isinstance(infos, dict):
            infos = [infos]

        lines = []
        for i, info in enumerate(infos, start=1):
            pv = info.get("pv") or []
            score_white = info["score"].white()
            lines.append(
                {
                    "multipv": i,
                    "score": {
                        "type": "mate" if score_white.is_mate() else "cp",
                        "value": score_white.mate()
                        if score_white.is_mate()
                        else score_white.score(),
                    },
                    "move": pv[0].uci() if pv else None,
                    "san": board.san(pv[0]) if pv else None,
                    "pv": [board.variation_san(pv)] if pv else [],
                }
            )

        best = lines[0] if lines else None
        return {
            "fen": board.fen(),
            "turn": "white" if board.turn == chess.WHITE else "black",
            "depth": depth,
            "lines": lines,
            "best_move": best["move"] if best else None,
            "best_san": best["san"] if best else None,
        }

    def close(self) -> None:
        with self._lock:
            if self._engine is not None:
                try:
                    self._engine.quit()
                except Exception:
                    pass
                self._engine = None


stockfish = Stockfish()
