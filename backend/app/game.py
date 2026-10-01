from __future__ import annotations

import io
import random
import time
import uuid
from dataclasses import dataclass, field

import chess
import chess.pgn

from .bots import BotPersona, get_bot
from .config import BOT_THINK_JITTER, BOT_THINK_SCALE
from .maia import pool as maia_pool

ONGOING = "ongoing"
CHECKMATE = "checkmate"
STALEMATE = "stalemate"
DRAW = "draw"
RESIGNED = "resigned"
TIMEOUT = "timeout"

DEFAULT_BASE_MS = 10 * 60 * 1000
DEFAULT_INCREMENT_MS = 0


@dataclass
class GameSession:
    id: str
    bot_id: str
    player_color: str
    base_ms: int = DEFAULT_BASE_MS
    increment_ms: int = DEFAULT_INCREMENT_MS
    initial_fen: str | None = None
    moves: list[str] = field(default_factory=list)
    status: str = ONGOING
    result: str | None = None
    result_reason: str | None = None
    white_ms: int = DEFAULT_BASE_MS
    black_ms: int = DEFAULT_BASE_MS
    turn_started_at: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    @property
    def bot(self) -> BotPersona:
        return get_bot(self.bot_id)

    @property
    def player_is_white(self) -> bool:
        return self.player_color == "white"

    @property
    def player_color_bool(self) -> chess.Color:
        return chess.WHITE if self.player_is_white else chess.BLACK

    def board(self) -> chess.Board:
        board = chess.Board(self.initial_fen) if self.initial_fen else chess.Board()
        for uci in self.moves:
            board.push(chess.Move.from_uci(uci))
        return board

    def is_bot_turn(self) -> bool:
        board = self.board()
        return board.turn != self.player_color_bool

    def _remaining(self, color: chess.Color) -> int:
        return self.white_ms if color == chess.WHITE else self.black_ms

    def _set_remaining(self, color: chess.Color, value: int) -> None:
        if color == chess.WHITE:
            self.white_ms = value
        else:
            self.black_ms = value

    def live_remaining(self, color: chess.Color) -> int:
        board = self.board()
        if self.status != ONGOING or board.turn != color:
            return max(0, self._remaining(color))
        elapsed = int((time.time() - self.turn_started_at) * 1000)
        return max(0, self._remaining(color) - elapsed)

    def _consume_clock(self, mover: chess.Color) -> bool:
        elapsed = int((time.time() - self.turn_started_at) * 1000)
        remaining = self._remaining(mover) - elapsed
        if remaining <= 0:
            self._set_remaining(mover, 0)
            return False
        self._set_remaining(mover, remaining + self.increment_ms)
        return True

    def _record_outcome(self) -> None:
        board = self.board()
        if not board.is_game_over():
            return
        outcome = board.outcome()
        if outcome is None:
            return
        self.result = outcome.result()
        if outcome.termination == chess.Termination.CHECKMATE:
            self.status = CHECKMATE
            self.result_reason = "checkmate"
        elif outcome.termination == chess.Termination.STALEMATE:
            self.status = STALEMATE
            self.result_reason = "stalemate"
        else:
            self.status = DRAW
            self.result_reason = outcome.termination.name.lower()

    def _finish_timeout(self, color: chess.Color) -> None:
        self.status = TIMEOUT
        self.result_reason = "timeout"
        self.result = "0-1" if color == chess.WHITE else "1-0"

    def push_move(self, move: chess.Move) -> None:
        board = self.board()
        mover = board.turn
        if not self._consume_clock(mover):
            self._finish_timeout(mover)
            self.updated_at = time.time()
            return
        board.push(move)
        self.moves.append(move.uci())
        self.turn_started_at = time.time()
        self.updated_at = time.time()
        self._record_outcome()

    def apply_player_move(self, uci: str) -> chess.Move:
        if self.status != ONGOING:
            raise ValueError("De partij is afgelopen")
        if self.is_bot_turn():
            raise ValueError("De bot is aan zet")
        board = self.board()
        try:
            move = chess.Move.from_uci(uci)
        except ValueError:
            raise ValueError("Ongeldige zet") from None
        if move not in board.legal_moves:
            raise ValueError("Illegale zet")
        self.push_move(move)
        return move

    def apply_bot_move(self) -> chess.Move | None:
        if self.status != ONGOING or not self.is_bot_turn():
            return None
        board = self.board()
        bot = self.bot
        target_ms = (
            bot.think_ms
            * BOT_THINK_SCALE
            * random.uniform(1 - BOT_THINK_JITTER, 1 + BOT_THINK_JITTER)
        )
        started = time.time()
        move = maia_pool.get(bot.model).move(
            board,
            self_elo=bot.elo,
            oppo_elo=bot.elo,
            temperature=bot.temperature,
            top_p=bot.top_p,
        )
        if move not in board.legal_moves:
            move = next(iter(board.legal_moves))
        remaining_ms = target_ms - (time.time() - started) * 1000
        if remaining_ms > 0:
            time.sleep(remaining_ms / 1000)
        self.push_move(move)
        return move

    def undo(self) -> bool:
        if not self.moves:
            return False
        if self.status != ONGOING:
            return False
        if self.is_bot_turn():
            self.moves.pop()
        else:
            self.moves.pop()
            if self.moves:
                self.moves.pop()
        self.turn_started_at = time.time()
        self.updated_at = time.time()
        return True

    def resign(self) -> None:
        if self.status != ONGOING:
            return
        self.status = RESIGNED
        self.result_reason = "resignation"
        self.result = "0-1" if self.player_is_white else "1-0"
        self.updated_at = time.time()

    def agree_draw(self) -> None:
        if self.status != ONGOING:
            return
        self.status = DRAW
        self.result_reason = "agreement"
        self.result = "1/2-1/2"
        self.updated_at = time.time()

    def _move_list(self) -> list[dict]:
        board = chess.Board(self.initial_fen) if self.initial_fen else chess.Board()
        out = []
        for i, uci in enumerate(self.moves):
            move = chess.Move.from_uci(uci)
            san = board.san(move)
            out.append(
                {
                    "uci": uci,
                    "san": san,
                    "color": "white" if board.turn == chess.WHITE else "black",
                    "number": board.fullmove_number,
                    "halfmove": i,
                }
            )
            board.push(move)
        return out

    def to_pgn(self) -> str:
        board = self.board()
        game = chess.pgn.Game.from_board(board)
        if self.initial_fen:
            game.headers["SetUp"] = "1"
            game.headers["FEN"] = self.initial_fen
        game.headers["Event"] = "HumanChess"
        game.headers["Site"] = "HumanChess"
        game.headers["Date"] = time.strftime("%Y.%m.%d", time.localtime(self.created_at))
        game.headers["White"] = "Speler" if self.player_is_white else self.bot.name
        game.headers["Black"] = self.bot.name if self.player_is_white else "Speler"
        game.headers["Result"] = self.result or "*"
        game.headers["BotElo"] = str(self.bot.elo)
        return str(game) + "\n"

    def snapshot(self) -> dict:
        board = self.board()
        player_turn = board.turn == self.player_color_bool
        live_status = self.status
        if live_status == ONGOING and self.live_remaining(board.turn) <= 0:
            self._finish_timeout(board.turn)
            live_status = self.status
        last_move = self.moves[-1] if self.moves else None
        return {
            "id": self.id,
            "initial_fen": self.initial_fen,
            "bot": {
                "id": self.bot.id,
                "name": self.bot.name,
                "elo": self.bot.elo,
                "description": self.bot.description,
                "color": self.bot.color,
            },
            "player_color": self.player_color,
            "fen": board.fen(),
            "turn": "white" if board.turn == chess.WHITE else "black",
            "moves": self._move_list(),
            "player_turn": player_turn and live_status == ONGOING,
            "legal_moves": [m.uci() for m in board.legal_moves]
            if player_turn and live_status == ONGOING
            else [],
            "last_move": last_move,
            "in_check": board.is_check(),
            "status": live_status,
            "result": self.result,
            "result_reason": self.result_reason,
            "can_undo": bool(self.moves) and live_status == ONGOING,
            "clock": {
                "base_ms": self.base_ms,
                "increment_ms": self.increment_ms,
                "white_ms": self.live_remaining(chess.WHITE),
                "black_ms": self.live_remaining(chess.BLACK),
                "running": live_status == ONGOING,
                "server_time": time.time(),
            },
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def to_record(self) -> dict:
        return {
            "id": self.id,
            "bot_id": self.bot_id,
            "player_color": self.player_color,
            "base_ms": self.base_ms,
            "increment_ms": self.increment_ms,
            "initial_fen": self.initial_fen,
            "moves": self.moves,
            "status": self.status,
            "result": self.result,
            "result_reason": self.result_reason,
            "white_ms": self.white_ms,
            "black_ms": self.black_ms,
            "turn_started_at": self.turn_started_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_record(cls, record: dict) -> GameSession:
        return cls(
            id=record["id"],
            bot_id=record["bot_id"],
            player_color=record["player_color"],
            base_ms=record.get("base_ms", DEFAULT_BASE_MS),
            increment_ms=record.get("increment_ms", DEFAULT_INCREMENT_MS),
            initial_fen=record.get("initial_fen"),
            moves=list(record.get("moves", [])),
            status=record.get("status", ONGOING),
            result=record.get("result"),
            result_reason=record.get("result_reason"),
            white_ms=record.get("white_ms", record.get("base_ms", DEFAULT_BASE_MS)),
            black_ms=record.get("black_ms", record.get("base_ms", DEFAULT_BASE_MS)),
            turn_started_at=record.get("turn_started_at", time.time()),
            created_at=record.get("created_at", time.time()),
            updated_at=record.get("updated_at", time.time()),
        )


def new_game(
    bot_id: str,
    player_color: str,
    base_minutes: float,
    increment_seconds: float,
) -> GameSession:
    return GameSession(
        id=uuid.uuid4().hex,
        bot_id=bot_id,
        player_color=player_color,
        base_ms=int(base_minutes * 60 * 1000),
        increment_ms=int(increment_seconds * 1000),
        white_ms=int(base_minutes * 60 * 1000),
        black_ms=int(base_minutes * 60 * 1000),
    )


def game_from_pgn(pgn_text: str, bot_id: str, player_color: str) -> GameSession:
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        raise ValueError("Kon geen geldige PGN lezen")
    board = game.board()
    initial_fen = None if board.fen() == chess.STARTING_FEN else board.fen()
    moves = [move.uci() for move in game.mainline_moves()]
    session = GameSession(
        id=uuid.uuid4().hex,
        bot_id=bot_id,
        player_color=player_color,
        base_ms=DEFAULT_BASE_MS,
        increment_ms=DEFAULT_INCREMENT_MS,
        initial_fen=initial_fen,
        moves=moves,
    )
    session._record_outcome()
    return session
