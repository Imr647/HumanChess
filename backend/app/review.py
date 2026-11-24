from __future__ import annotations

import math
from collections.abc import Callable

import chess
import chess.polyglot

from .config import REVIEW_DEPTH
from .game import GameSession
from .openings import BOOK_HASHES, BOOK_MAX_PLY, detect_opening
from .stockfish import stockfish

INFINITY_CP = 10000

LOSS_EXCELLENT = 2.0
LOSS_GOOD = 5.0
LOSS_INACCURACY = 10.0
LOSS_MISTAKE = 20.0
GREAT_MARGIN = 20.0
MISS_MIN_ADVANTAGE = 0.55
# Briljant en geweldig krijgen alleen betekenis in een stelling die nog niet
# beslist is. In een partij die je al met 8 punten voorstaat is iets weggeven
# geen kunst en is "de enige goede zet" niet bijzonder.
NOT_ALREADY_WON = 0.85
# Het offer moet de stelling gezond houden.
SACRIFICE_OK = 0.50

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}


def _terminal_score(board: chess.Board) -> int | None:
    """De score van een afgelopen stelling, of None als er nog gespeeld wordt.

    Een schaakmat krijgt hier bewust +oneindig (of -oneindig) en niet de 0 die de
    engine teruggeeft. Anders lijkt het of de mat die net gezet is weer verdwenen
    is, en dan meldt de analyse bij een schaakmat dat je een mat hebt laten liggen.
    """
    if board.is_checkmate():
        return -INFINITY_CP if board.turn == chess.WHITE else INFINITY_CP
    if board.is_game_over(claim_draw=True):
        return 0
    return None


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


def _cheapest_attacker(board: chess.Board, square: int) -> int | None:
    """De waarde van het goedkoopste stuk dat op dit veld kan slaan, of None."""
    waarden = [
        PIECE_VALUES[board.piece_at(m.from_square).piece_type]
        for m in board.legal_moves
        if m.to_square == square and board.is_capture(m)
    ]
    return min(waarden) if waarden else None


def _only_move_to_keep(is_best: bool, gap: float, before_mover: float, is_recapture: bool) -> bool:
    """Geweldig: de beste zet, met een duidelijk verval bij elk alternatief.

    Een terugslaan op het veld waar de tegenstander net sloeg is nooit geweldig:
    dat is niet de enige goede zet, dat is de enige zet.
    """
    return (
        is_best
        and gap >= GREAT_MARGIN
        and before_mover <= NOT_ALREADY_WON
        and not is_recapture
    )


def _brilliant(
    is_best: bool,
    offered: int | None,
    cheapest_attacker: int | None,
    before_mover: float,
    after_mover: float,
) -> bool:
    """Een offer is pas briljant als er echt materiaal wordt weggegeven.

    `offered` is de waarde van het stuk dat wordt neergezet, `cheapest_attacker`
    wat de tegenstander ertegenover kan zetten. Alleen als dat goedkoper is dan
    wat er staat, verliest de zetter materiaal bij slaan en is er van een offer
    sprake. Verder telt het alleen in een stelling die nog niet gewonnen is
    (anders is iets weggeven geen kunst) en moet het offer de stelling gezond
    houden.
    """
    if not is_best or offered is None or cheapest_attacker is None:
        return False
    if offered < PIECE_VALUES[chess.KNIGHT]:
        return False
    if cheapest_attacker >= offered:
        return False
    return before_mover <= NOT_ALREADY_WON and after_mover >= SACRIFICE_OK


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
    is_best: bool = False,
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
        if not is_best and cp_before >= INFINITY_CP and cp_after < INFINITY_CP:
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


def review_game(
    session: GameSession,
    depth: int = 12,
    on_progress: Callable[[int, int], None] | None = None,
) -> dict:
    boards = _positions(session)
    total = len(boards)
    analyses: list[dict] = []
    for i, board in enumerate(boards, start=1):
        analyses.append(stockfish.analyse(board, multipv=2, depth=depth))
        if on_progress is not None:
            on_progress(i, total)

    evals = [_score_cp(a["lines"][0]["score"]) for a in analyses]
    best_moves = [a["best_move"] for a in analyses]

    # Eindstanden overschrijven: een schaakmat is winst, geen 0.
    for index, board in enumerate(boards):
        einde = _terminal_score(board)
        if einde is not None:
            evals[index] = einde

    def second_cp(index: int) -> int | None:
        lines = analyses[index]["lines"]
        return _score_cp(lines[1]["score"]) if len(lines) > 1 else None

    moves: list[dict] = []
    summary = {"white": _empty_summary(), "black": _empty_summary()}
    previous_classification: str | None = None
    vorige_doel: int | None = None

    for index, entry in enumerate(session._move_list()):
        mover_white = entry["color"] == "white"
        before_white = _win_prob_white(evals[index])
        after_white = _win_prob_white(evals[index + 1])

        before_mover = before_white if mover_white else 1.0 - before_white
        after_mover = after_white if mover_white else 1.0 - after_white

        win_drop = max(0.0, (before_mover - after_mover) * 100.0)
        is_best = best_moves[index] == entry["uci"]

        move = chess.Move.from_uci(entry["uci"])
        # slaat deze zet terug op het veld waar de tegenstander net sloeg?
        recapture = vorige_doel is not None and move.to_square == vorige_doel
        vorige_doel = move.to_square

        gap = 0.0
        if is_best:
            alternative = second_cp(index)
            if alternative is not None:
                gap = abs(_win_prob_white(evals[index]) - _win_prob_white(alternative)) * 100.0
        only_good = _only_move_to_keep(is_best, gap, before_mover, recapture)
        in_book = (
            index < BOOK_MAX_PLY
            and chess.polyglot.zobrist_hash(boards[index + 1]) in BOOK_HASHES
        )
        neergezet = boards[index].piece_at(move.from_square)
        sacrifice = (not recapture) and _brilliant(
            is_best,
            PIECE_VALUES[neergezet.piece_type] if neergezet is not None else None,
            _cheapest_attacker(boards[index + 1], move.to_square),
            before_mover,
            after_mover,
        )

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
                    is_best=is_best,
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
        "opening": detect_opening(session.moves, session.initial_fen),
    }
