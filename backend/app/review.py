from __future__ import annotations

import math

import chess
import chess.polyglot

from .config import REVIEW_DEPTH
from .game import GameSession
from .stockfish import stockfish

INFINITY_CP = 10000

LOSS_EXCELLENT = 2.0
LOSS_GOOD = 5.0
LOSS_INACCURACY = 10.0
LOSS_MISTAKE = 20.0
GREAT_MARGIN = 10.0
MISS_MIN_ADVANTAGE = 0.55
BOOK_MAX_PLY = 20

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}

OPENING_LINES = [
    "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O",
    "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+",
    "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6",
    "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5",
    "e4 e5 Nf3 Nf6 Nc3 Nc6 Bb5",
    "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4",
    "e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5",
    "e4 e5 Bc4 Nf6 d3 c6 Nf3 d5",
    "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
    "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5",
    "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6",
    "e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6",
    "e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6",
    "e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 O-O Nc6",
    "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5",
    "e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3",
    "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5",
    "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6",
    "e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2",
    "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6",
    "e4 Nf6 e5 Nd5 d4 d6 Nf3 dxe5 Nxe5",
    "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O",
    "e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O",
    "d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7 Bg5 O-O e3",
    "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7",
    "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6",
    "d4 d5 c4 c6 Nc3 Nf6 e3 e6 Nf3 Nbd7 Bd3 dxc4",
    "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6",
    "d4 d5 Nf3 Nf6 c4 c6 Nc3 e6 Bg5 h6",
    "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5",
    "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O",
    "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5",
    "d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3",
    "d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6",
    "d4 Nf6 Nf3 e6 c4 b6 g3 Ba6 b3 Bb4+",
    "d4 e6 c4 Nf6 Nc3 Bb4 e3 O-O Bd3 d5",
    "d4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O",
    "Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O",
    "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5",
    "c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O",
]


def _build_book() -> set[int]:
    hashes: set[int] = set()
    for line in OPENING_LINES:
        board = chess.Board()
        for token in line.split():
            try:
                board.push_san(token)
            except ValueError:
                break
            hashes.add(chess.polyglot.zobrist_hash(board))
    return hashes


BOOK_HASHES = _build_book()


def _score_cp(score: dict) -> int:
    if score["type"] == "mate":
        value = score["value"] or 0
        return int(math.copysign(INFINITY_CP, value)) if value else 0
    return int(score["value"] or 0)


def _win_prob_white(cp: int) -> float:
    if cp >= INFINITY_CP:
        return 1.0
    if cp <= -INFINITY_CP:
        return 0.0
    return 1.0 / (1.0 + 10 ** (-cp / 400.0))


def _accuracy(win_drop: float) -> float:
    value = 103.1668 * math.exp(-0.04354 * win_drop) - 3.1669
    return max(0.0, min(100.0, value))


def _classify(win_drop: float, is_best: bool) -> str:
    if is_best:
        return "best"
    if win_drop <= LOSS_EXCELLENT:
        return "excellent"
    if win_drop <= LOSS_GOOD:
        return "good"
    if win_drop <= LOSS_INACCURACY:
        return "inaccuracy"
    if win_drop <= LOSS_MISTAKE:
        return "mistake"
    return "blunder"


def _is_sacrifice(board_before: chess.Board, move: chess.Move, board_after: chess.Board) -> bool:
    moved = board_before.piece_at(move.from_square)
    if moved is None or moved.piece_type == chess.KING:
        return False
    moved_value = PIECE_VALUES[moved.piece_type]
    if moved_value < PIECE_VALUES[chess.KNIGHT]:
        return False
    captured = board_before.piece_at(move.to_square)
    captured_value = PIECE_VALUES[captured.piece_type] if captured else 0
    can_recapture = any(
        m.to_square == move.to_square and board_after.is_capture(m)
        for m in board_after.legal_moves
    )
    return can_recapture and captured_value < moved_value


_BEST_HINT = {
    "excellent": "Uitstekend — vrijwel gelijk aan de beste zet ({best}).",
    "good": "Goede zet. {best} was iets nauwkeuriger.",
    "inaccuracy": "Onnauwkeurig. {best} hield het voordeel beter vast.",
    "mistake": "Fout. {best} was duidelijk sterker.",
    "blunder": "Blunder! {best} was veel sterker.",
}


def _comment(
    classification: str,
    best_san: str | None,
    cp_before: int,
    cp_after: int,
    cp_loss: int,
) -> str:
    best = best_san or "een andere zet"
    if classification == "book":
        text = "Deze zet hoort bij de openingstheorie."
    elif classification == "brilliant":
        text = "Briljant! Een offer dat Stockfish als beste zet ziet."
    elif classification == "great":
        text = "Geweldig! Dit was de enige goede zet in deze stelling."
    elif classification == "miss":
        text = f"Gemiste kans! {best} was nodig om het voordeel te verzilveren."
    elif classification == "best":
        text = "Beste zet volgens Stockfish."
    else:
        text = _BEST_HINT[classification].format(best=best)

    extras: list[str] = []
    if classification not in ("book", "brilliant", "great", "miss"):
        if cp_before >= INFINITY_CP and cp_after < INFINITY_CP:
            extras.append("Je liet een geforceerde mat liggen.")
        elif cp_after <= -INFINITY_CP and cp_before > -INFINITY_CP:
            extras.append("Dit geeft de tegenstander een geforceerde mat.")
        elif classification in ("mistake", "blunder") and 0 < cp_loss < INFINITY_CP:
            extras.append(f"Kostte ongeveer {cp_loss / 100:.1f} pion aan voordeel.")

    return " ".join([text, *extras])


def _positions(session: GameSession) -> list[chess.Board]:
    board = chess.Board(session.initial_fen) if session.initial_fen else chess.Board()
    boards = [board.copy()]
    for uci in session.moves:
        board.push(chess.Move.from_uci(uci))
        boards.append(board.copy())
    return boards


def _empty_summary() -> dict:
    return {
        "accuracy": 0.0,
        "brilliant": 0,
        "great": 0,
        "best": 0,
        "excellent": 0,
        "good": 0,
        "book": 0,
        "inaccuracy": 0,
        "mistake": 0,
        "miss": 0,
        "blunder": 0,
    }


def review_depth(plies: int, base: int | None = None) -> int:
    depth = base or REVIEW_DEPTH
    if plies <= 80:
        return depth
    if plies <= 140:
        return max(10, depth - 2)
    return max(8, depth - 4)


def review_game(session: GameSession, depth: int = 12) -> dict:
    boards = _positions(session)
    analyses = [stockfish.analyse(board, multipv=2, depth=depth) for board in boards]

    evals = [_score_cp(a["lines"][0]["score"]) for a in analyses]
    best_moves = [a["best_move"] for a in analyses]

    def second_cp(index: int) -> int | None:
        lines = analyses[index]["lines"]
        return _score_cp(lines[1]["score"]) if len(lines) > 1 else None

    moves: list[dict] = []
    summary = {"white": _empty_summary(), "black": _empty_summary()}
    previous_classification: str | None = None

    for index, entry in enumerate(session._move_list()):
        mover_white = entry["color"] == "white"
        before_white = _win_prob_white(evals[index])
        after_white = _win_prob_white(evals[index + 1])

        before_mover = before_white if mover_white else 1.0 - before_white
        after_mover = after_white if mover_white else 1.0 - after_white

        win_drop = max(0.0, (before_mover - after_mover) * 100.0)
        is_best = best_moves[index] == entry["uci"]

        only_good = False
        if is_best:
            alternative = second_cp(index)
            if alternative is not None:
                gap = abs(_win_prob_white(evals[index]) - _win_prob_white(alternative)) * 100.0
                only_good = gap >= GREAT_MARGIN

        move = chess.Move.from_uci(entry["uci"])
        in_book = (
            index < BOOK_MAX_PLY
            and chess.polyglot.zobrist_hash(boards[index + 1]) in BOOK_HASHES
        )
        sacrifice = is_best and _is_sacrifice(boards[index], move, boards[index + 1])

        if in_book:
            classification = "book"
        elif sacrifice:
            classification = "brilliant"
        elif only_good:
            classification = "great"
        else:
            classification = _classify(win_drop, is_best)

        if (
            classification in ("mistake", "blunder")
            and previous_classification in ("mistake", "blunder")
            and before_mover >= MISS_MIN_ADVANTAGE
            and win_drop >= LOSS_INACCURACY
        ):
            classification = "miss"
        previous_classification = classification

        accuracy = round(_accuracy(win_drop), 1)

        side = "white" if mover_white else "black"
        summary[side][classification] += 1

        cp_before = evals[index] if mover_white else -evals[index]
        cp_after = evals[index + 1] if mover_white else -evals[index + 1]
        cp_loss = max(0, cp_before - cp_after)

        moves.append(
            {
                "ply": index,
                "number": entry["number"],
                "color": entry["color"],
                "san": entry["san"],
                "uci": entry["uci"],
                "best_uci": best_moves[index],
                "best_san": analyses[index]["best_san"],
                "classification": classification,
                "cp_loss": cp_loss,
                "win_drop": round(win_drop, 2),
                "accuracy": accuracy,
                "eval_cp": evals[index + 1],
                "comment": _comment(
                    classification,
                    analyses[index]["best_san"],
                    cp_before,
                    cp_after,
                    cp_loss,
                ),
            }
        )

    for side in ("white", "black"):
        accuracies = [m["accuracy"] for m in moves if m["color"] == side]
        summary[side]["accuracy"] = (
            round(sum(accuracies) / len(accuracies), 1) if accuracies else 0.0
        )

    return {
        "game_id": session.id,
        "depth": depth,
        "summary": summary,
        "moves": moves,
        "eval": evals,
        "initial_fen": session.initial_fen,
    }
