from __future__ import annotations

import json
import queue
import threading
import time
from collections import OrderedDict
from contextlib import asynccontextmanager

import chess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import maia, stockfish
from .bots import get_bot, list_bots
from .config import MAIA_DEVICE, ROOT, STOCKFISH_DEPTH
from .db import store
from .game import GameSession, game_from_pgn, new_game
from .review import review_depth, review_game
from .schemas import AnalyseRequest, ImportRequest, MoveRequest, NewGameRequest


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

MAX_CACHED_SESSIONS = 100
MAX_RATING_HISTORY = 200

_sessions: OrderedDict[str, GameSession] = OrderedDict()
_game_locks: dict[str, threading.Lock] = {}
_registry_lock = threading.Lock()
_profile_lock = threading.Lock()


def _get_game_lock(game_id: str) -> threading.Lock:
    with _registry_lock:
        lock = _game_locks.get(game_id)
        if lock is None:
            lock = threading.Lock()
            _game_locks[game_id] = lock
        return lock


def _cache_session(session: GameSession) -> None:
    with _registry_lock:
        _sessions[session.id] = session
        _sessions.move_to_end(session.id)
        while len(_sessions) > MAX_CACHED_SESSIONS:
            evicted_id, _ = _sessions.popitem(last=False)
            evicted_lock = _game_locks.get(evicted_id)
            if evicted_lock is not None and not evicted_lock.locked():
                _game_locks.pop(evicted_id, None)


def _get_session(game_id: str) -> GameSession:
    """Geef de partij uit het geheugen, tenzij de opgeslagen versie nieuwer is.

    Het onderhoud (verlaten partijen afbreken, terugzetten uit een back-up) schrijft
    rechtstreeks in de database; zonder deze vergelijking blijft de service de oude
    versie uit het geheugen serveren.
    """
    with _registry_lock:
        cached = _sessions.get(game_id)
    record = store.get(game_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Partij niet gevonden")
    if cached is not None and cached.updated_at >= record.get("updated_at", 0):
        with _registry_lock:
            _sessions.move_to_end(game_id)
        return cached
    session = GameSession.from_record(record)
    _cache_session(session)
    return session


ELO_K = 24


def _player_oppo_elo() -> int:
    rating = store.get_profile().get("rating", 1200)
    return max(600, min(2600, int(rating)))


def _settle(session: GameSession) -> None:
    if session.status == "ongoing" or session.rated:
        return
    if session.assisted:
        session.rated = True
        return
    with _profile_lock:
        if session.rated:
            return
        profile = store.get_profile()
        result = session.result
        if result == "1-0":
            score = 1.0 if session.player_is_white else 0.0
        elif result == "0-1":
            score = 0.0 if session.player_is_white else 1.0
        else:
            score = 0.5
        old_rating = profile["rating"]
        expected = 1.0 / (1.0 + 10 ** ((session.bot.elo - old_rating) / 400.0))
        new_rating = int(round(old_rating + ELO_K * (score - expected)))
        profile["rating"] = new_rating
        profile["games"] += 1

        bot_stats = profile.setdefault("bot_stats", {})
        bstat = bot_stats.setdefault(session.bot_id, {"wins": 0, "losses": 0, "draws": 0})
        if score == 1.0:
            profile["wins"] += 1
            bstat["wins"] += 1
        elif score == 0.0:
            profile["losses"] += 1
            bstat["losses"] += 1
        else:
            profile["draws"] += 1
            bstat["draws"] += 1

        history = list(profile.get("history", []))
        history.append(
            {
                "rating": new_rating,
                "delta": new_rating - old_rating,
                "bot_id": session.bot_id,
                "bot_name": session.bot.name,
                "result": result or "",
                "score": score,
                "at": time.time(),
            }
        )
        profile["history"] = history[-MAX_RATING_HISTORY:]
        store.set_profile(profile)
        session.rated = True


def _save(session: GameSession) -> None:
    _settle(session)
    _cache_session(session)
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
        "rated": session.rated,
        "assisted": session.assisted,
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
    with _get_game_lock(session.id):
        if session.is_bot_turn():
            session.apply_bot_move(oppo_elo=_player_oppo_elo())
        _save(session)
        return session.snapshot()


@app.get("/api/profile")
def profile() -> dict:
    return store.get_profile()


@app.get("/api/games/{game_id}")
def get_game(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        snapshot = session.snapshot()
        was_rated = session.rated
        _settle(session)
        if session.rated and not was_rated:
            store.save(session.to_record())
        return snapshot


@app.post("/api/games/{game_id}/move")
def make_move(game_id: str, req: MoveRequest) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        try:
            session.apply_player_move(req.uci)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        _save(session)
        return session.snapshot()


@app.post("/api/games/{game_id}/bot-move")
def bot_move(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if session.status != "ongoing" or not session.is_bot_turn():
            raise HTTPException(status_code=400, detail="De bot is niet aan zet")
        session.apply_bot_move(oppo_elo=_player_oppo_elo())
        _save(session)
        return session.snapshot()


@app.post("/api/games/{game_id}/undo")
def undo(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if not session.undo():
            raise HTTPException(status_code=400, detail="Niets om terug te draaien")
        _save(session)
        return session.snapshot()


@app.post("/api/games/{game_id}/resign")
def resign(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        session.resign()
        _save(session)
        return session.snapshot()


@app.post("/api/games/{game_id}/draw")
def draw(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if session.status != "ongoing":
            return {"accepted": False, "game": session.snapshot()}
        board = session.board()
        player_is_white = session.player_is_white

    accepted = True
    if stockfish.stockfish.available():
        analysis = stockfish.stockfish.analyse(board, multipv=1)
        score = analysis["lines"][0]["score"]
        if score["type"] == "mate":
            cp = 10000 if (score["value"] or 0) > 0 else -10000
        else:
            cp = score["value"] or 0
        white_prob = 1.0 / (1.0 + 10 ** (-cp / 400.0))
        bot_prob = white_prob if not player_is_white else 1.0 - white_prob
        accepted = bot_prob <= 0.55

    with _get_game_lock(game_id):
        if session.status == "ongoing":
            if accepted:
                session.agree_draw()
            else:
                session.decline_draw()
            _save(session)
        return {"accepted": accepted, "game": session.snapshot()}


@app.post("/api/games/{game_id}/hint")
def hint(game_id: str) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if session.status != "ongoing":
            raise HTTPException(status_code=400, detail="De partij is afgelopen")
        board = session.board()
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    analysis = stockfish.stockfish.analyse(board, multipv=1)
    with _get_game_lock(game_id):
        session.assisted = True
        _save(session)
    return {"best_move": analysis["best_move"], "best_san": analysis["best_san"]}


@app.get("/api/games/{game_id}/eval")
def evaluate(game_id: str, multipv: int = 3) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        board = session.board()
        session.assisted = True
        _save(session)
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    return stockfish.stockfish.analyse(board, multipv=multipv)


@app.post("/api/analyse")
def analyse_position(req: AnalyseRequest) -> dict:
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    try:
        board = chess.Board(req.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ongeldige stelling") from None
    return stockfish.stockfish.analyse(
        board, multipv=req.multipv, depth=req.depth or STOCKFISH_DEPTH
    )


@app.get("/api/games/{game_id}/review")
def review(game_id: str, depth: int = 0) -> dict:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if not session.moves:
            raise HTTPException(status_code=400, detail="Geen zetten om te beoordelen")
        move_count = len(session.moves)
        session_copy = GameSession.from_record(session.to_record())
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    use_depth = max(1, min(depth or review_depth(move_count), 22))
    cached = store.get_review(game_id, move_count, use_depth)
    if cached is not None:
        return cached
    result = review_game(session_copy, depth=use_depth)
    store.save_review(game_id, move_count, use_depth, result)
    return result


@app.get("/api/games/{game_id}/review/stream")
def review_stream(game_id: str, depth: int = 0) -> StreamingResponse:
    session = _get_session(game_id)
    with _get_game_lock(game_id):
        if not session.moves:
            raise HTTPException(status_code=400, detail="Geen zetten om te beoordelen")
        move_count = len(session.moves)
        session_copy = GameSession.from_record(session.to_record())
    if not stockfish.stockfish.available():
        raise HTTPException(status_code=503, detail="Stockfish niet beschikbaar")
    use_depth = max(1, min(depth or review_depth(move_count), 22))

    def event_gen():
        cached = store.get_review(game_id, move_count, use_depth)
        if cached is not None:
            total = move_count + 1
            yield f"event: progress\ndata: {json.dumps({'done': total, 'total': total})}\n\n"
            yield f"event: result\ndata: {json.dumps(cached)}\n\n"
            return

        q: queue.Queue[tuple[str, object]] = queue.Queue()

        def worker() -> None:
            try:
                def report(done: int, total: int) -> None:
                    q.put(("progress", {"done": done, "total": total}))

                result = review_game(session_copy, depth=use_depth, on_progress=report)
                store.save_review(game_id, move_count, use_depth, result)
                q.put(("result", result))
            except Exception as exc:
                q.put(("error", {"detail": str(exc)}))

        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while True:
            kind, payload = q.get()
            yield f"event: {kind}\ndata: {json.dumps(payload)}\n\n"
            if kind in ("result", "error"):
                break

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
    with _registry_lock:
        _sessions.pop(game_id, None)
        _game_locks.pop(game_id, None)
    store.delete(game_id)
    return {"ok": True}


_DIST_DIR = ROOT / "frontend" / "dist"
if _DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST_DIR), html=True), name="frontend")
