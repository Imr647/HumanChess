from __future__ import annotations

import threading
from pathlib import Path

import chess
import chess.engine

from .config import MAIA_DEVICE, MAIA_HISTORY

_VENV_BIN = Path(__file__).resolve().parents[1] / ".venv" / "bin" / "maia3-uci"


def _engine_args(model: str) -> list[str]:
    exe = str(_VENV_BIN) if _VENV_BIN.exists() else "maia3-uci"
    args = [exe, "--model", model]
    if MAIA_HISTORY:
        args.append("--use-uci-history")
    if MAIA_DEVICE == "cpu":
        args += ["--device", "cpu", "--no-use-amp"]
    elif MAIA_DEVICE != "auto":
        args += ["--device", MAIA_DEVICE]
    return args


class MaiaEngine:
    def __init__(self, model: str) -> None:
        self.model = model
        self._engine: chess.engine.SimpleEngine | None = None
        self._lock = threading.Lock()

    def _ensure(self) -> chess.engine.SimpleEngine:
        if self._engine is None:
            self._engine = chess.engine.SimpleEngine.popen_uci(
                _engine_args(self.model), timeout=120
            )
        return self._engine

    def move(
        self,
        board: chess.Board,
        self_elo: int,
        oppo_elo: int,
        temperature: float,
        top_p: float,
    ) -> chess.Move:
        with self._lock:
            engine = self._ensure()
            engine.configure(
                {
                    "SelfElo": self_elo,
                    "OppoElo": oppo_elo,
                    "Temperature": temperature,
                    "TopP": top_p,
                }
            )
            result = engine.play(board, chess.engine.Limit(nodes=1))
        if result.move is None:
            raise RuntimeError("Maia-3 gaf geen zet terug")
        return result.move

    def close(self) -> None:
        with self._lock:
            if self._engine is not None:
                try:
                    self._engine.quit()
                except Exception:
                    pass
                self._engine = None


class MaiaPool:
    def __init__(self) -> None:
        self._engines: dict[str, MaiaEngine] = {}
        self._lock = threading.Lock()

    def get(self, model: str) -> MaiaEngine:
        with self._lock:
            if model not in self._engines:
                self._engines[model] = MaiaEngine(model)
            return self._engines[model]

    def close(self) -> None:
        with self._lock:
            for engine in self._engines.values():
                engine.close()
            self._engines.clear()


pool = MaiaPool()
