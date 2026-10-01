from __future__ import annotations

import math

import chess

from .game import GameSession
from .stockfish import stockfish

INFINITY_CP = 10000

LOSS_EXCELLENT = 2.0
LOSS_GOOD = 5.0
LOSS_INACCURACY = 10.0
LOSS_MISTAKE = 20.0


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
        "best": 0,
        "excellent": 0,
        "good": 0,
        "inaccuracy": 0,
        "mistake": 0,
        "blunder": 0,
    }


def review_game(session: GameSession, depth: int = 12) -> dict:
    boards = _positions(session)
    analyses = [stockfish.analyse(board, multipv=1, depth=depth) for board in boards]

    evals = [_score_cp(a["lines"][0]["score"]) for a in analyses]
    best_moves = [a["best_move"] for a in analyses]

    moves: list[dict] = []
    summary = {"white": _empty_summary(), "black": _empty_summary()}

    for index, entry in enumerate(session._move_list()):
        mover_white = entry["color"] == "white"
        before_white = _win_prob_white(evals[index])
        after_white = _win_prob_white(evals[index + 1])

        before_mover = before_white if mover_white else 1.0 - before_white
        after_mover = after_white if mover_white else 1.0 - after_white

        win_drop = max(0.0, (before_mover - after_mover) * 100.0)
        is_best = best_moves[index] == entry["uci"]
        classification = _classify(win_drop, is_best)
        accuracy = round(_accuracy(win_drop), 1)

        side = "white" if mover_white else "black"
        summary[side][classification] += 1

        cp_before = evals[index] if mover_white else -evals[index]
        cp_after = evals[index + 1] if mover_white else -evals[index + 1]

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
                "cp_loss": max(0, cp_before - cp_after),
                "win_drop": round(win_drop, 2),
                "accuracy": accuracy,
                "eval_cp": evals[index + 1],
            }
        )

    for side in ("white", "black"):
        accuracies = [
            m["accuracy"] for m in moves if m["color"] == side
        ]
        if accuracies:
            summary[side]["accuracy"] = round(sum(accuracies) / len(accuracies), 1)
        else:
            summary[side]["accuracy"] = 0.0

    return {
        "game_id": session.id,
        "depth": depth,
        "summary": summary,
        "moves": moves,
        "eval": evals,
        "initial_fen": session.initial_fen,
    }
