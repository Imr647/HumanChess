from __future__ import annotations

import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from . import maia, stockfish
from .bots import get_bot, list_bots
from .config import MAIA_DEVICE, REVIEW_DEPTH
from .db import store
from .game import GameSession, game_from_pgn, new_game
from .review import review_game
from .schemas import ImportRequest, MoveRequest, NewGameRequest


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    maia.pool.close()
    stockfish.stockfish.close()


app = FastAPI(title="HumanChess", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_sessions: dict[str, GameSession] = {}
_reviews: dict[tuple[str, int, int], dict] = {}
_lock = threading.Lock()


def _get_session(game_id: str) -> GameSession:
    with _lock:
        if game_id in _sessions:
            return _sessions[game_id]
    record = store.get(game_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Partij niet gevonden")
    session = GameSession.from_record(record)
    with _lock:
        _sessions[game_id] = session
    return session


ELO_K = 24


def _settle(session: GameSession) -> None:
    if session.status == "ongoing" or session.rated:
        return
    profile = store.get_profile()
    result = session.result
    if result == "1-0":
        score = 1.0 if session.player_is_white else 0.0
    elif result == "0-1":
        score = 0.0 if session.player_is_white else 1.0
    else:
        score = 0.5
    expected = 1.0 / (1.0 + 10 ** ((session.bot.elo - profile["rating"]) / 400.0))
    profile["rating"] = int(round(profile["rating"] + ELO_K * (score - expected)))
    profile["games"] += 1
    if score == 1.0:
        profile["wins"] += 1
    elif score == 0.0:
        profile["losses"] += 1
    else:
        profile["draws"] += 1
    store.set_profile(profile)
    session.rated = True


def _save(session: GameSession) -> None:
    _settle(session)
    with _lock:
        _sessions[session.id] = session
    store.save(session.to_record())


def _summary(record: dict) -> dict:
    session = GameSession.from_record(record)
    return {
        "id": session.id,
        "bot_id": session.bot_id,
        "bot_name": session.bot.name,
        "bot_elo": session.bot.elo,
        "player_color": session.player_color,
        "status": session.status,
        "result": session.result,
        "result_reason": session.result_reason,
        "move_count": len(session.moves),
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "maia_device": MAIA_DEVICE,
        "stockfish_available": stockfish.stockfish.available(),
    }


@app.get("/api/bots")
def bots() -> list[dict]:
    return list_bots()


@app.get("/api/games")
def list_games() -> list[dict]:
    return [_summary(r) for r in store.list()]


@app.post("/api/games")
def create_game(req: NewGameRequest) -> dict:
    try:
        get_bot(req.bot_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    session = new_game(
        bot_id=req.bot_id,
        player_color=req.player_color,
        base_minutes=req.base_minutes,
        increment_seconds=req.increment_seconds,
    )
    with _lock:
        if session.is_bot_turn():
            session.apply_bot_move()
    _save(session)
    return session.snapshot()


@app.get("/api/profile")
def profile() -> dict:
    return store.get_profile()


@app.get("/api/games/{game_id}")
def get_game(game_id: str) -> dict:
    session = _get_session(game_id)
    snapshot = session.snapshot()
    was_rated = session.rated
    _settle(session)
    if session.rated and not was_rated:
        store.save(session.to_record())
    return snapshot


@app.post("/api/games/{game_id}/move")
def make_move(game_id: str, req: MoveRequest) -> dict:
    session = _get_session(game_id)
    with _lock:
        try:
            session.apply_player_move(req.uci)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
    _save(session)
    return session.snapshot()


@app.post("/api/games/{game_id}/bot-move")
def bot_move(game_id: str) -> dict:
    session = _get_session(game_id)
    with _lock:
        if session.status != "ongoing" or not session.is_bot_turn():
            raise HTTPException(status_code=400, detail="De bot is niet aan zet")
        session.apply_bot_move()
    _save(session)
    return session.snapshot()


@app.post("/api/games/{game_id}/undo")
def undo(game_id: str) -> dict:
    session = _get_session(game_id)
    with _lock:
        if not session.undo():
            raise HTTPException(status_code=400, detail="Niets om terug te draaien")
    _save(session)
    return session.snapshot()


@app.post("/api/games/{game_id}/resign")
def resign(game_id: str) -> dict:
    session = _get_session(game_id)
    with _lock:
        session.resign()
    _save(session)
    return session.snapshot()


@app.post("/api/games/{game_id}/draw")
def draw(game_id: str) -> dict:
    session = _get_session(game_id)
    accepted = True
    with _lock:
        if session.status == "ongoing" and stockfish.stockfish.available():
            analysis = stockfish.stockfish.analyse(session.board(), multipv=1)
            score = analysis["lines"][0]["score"]
            if score["type"] == "mate":
                cp = 10000 if (score["value"] or 0) > 0 else -10000
            else:
                cp = score["value"] or 0
            white_prob = 1.0 / (1.0 + 10 ** (-cp / 400.0))
            bot_prob = white_prob if not session.player_is_white else 1.0 - white_prob
            accepted = bot_prob <= 0.55
        if accepted:
            session.agree_draw()
    _save(session)
    return {"accepted": accepted, "game": session.snapshot()}


@app.post("/api/games/{game_id}/hint")
def hint(game_id: str) -> dict:
    session = _get_session(game_id)
    if session.status != "ongoing":
        raise HTTPException(status_code=400, detail="De partij is afgelopen")
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    analysis = stockfish.stockfish.analyse(session.board(), multipv=1)
    return {"best_move": analysis["best_move"], "best_san": analysis["best_san"]}


@app.get("/api/games/{game_id}/eval")
def evaluate(game_id: str, multipv: int = 3) -> dict:
    session = _get_session(game_id)
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    return stockfish.stockfish.analyse(session.board(), multipv=multipv)


@app.get("/api/games/{game_id}/review")
def review(game_id: str, depth: int = 0) -> dict:
    session = _get_session(game_id)
    if not session.moves:
        raise HTTPException(status_code=400, detail="Geen zetten om te beoordelen")
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    use_depth = depth or REVIEW_DEPTH
    key = (game_id, len(session.moves), use_depth)
    with _lock:
        cached = _reviews.get(key)
    if cached is not None:
        return cached
    result = review_game(session, depth=use_depth)
    with _lock:
        _reviews[key] = result
    return result


@app.get("/api/games/{game_id}/pgn", response_class=PlainTextResponse)
def pgn(game_id: str) -> str:
    return _get_session(game_id).to_pgn()


@app.post("/api/games/import")
def import_game(req: ImportRequest) -> dict:
    try:
        get_bot(req.bot_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    try:
        session = game_from_pgn(req.pgn, req.bot_id, req.player_color)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    _save(session)
    return session.snapshot()


@app.delete("/api/games/{game_id}")
def delete_game(game_id: str) -> dict:
    with _lock:
        _sessions.pop(game_id, None)
        for key in [k for k in _reviews if k[0] == game_id]:
            _reviews.pop(key, None)
    store.delete(game_id)
    return {"ok": True}
