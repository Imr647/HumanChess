import time

from fastapi.testclient import TestClient

from app.main import app
from app.maintenance import abort_stale
from app.review import review_depth

client = TestClient(app)

START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


def test_beoordelingsdiepte_zakt_bij_langere_partijen():
    assert review_depth(20) > review_depth(120) > review_depth(200)


def test_losse_stelling_analyseren():
    res = client.post("/api/analyse", json={"fen": START, "multipv": 2})
    assert res.status_code == 200
    body = res.json()
    assert body["best_move"]
    assert len(body["lines"]) == 2


def test_onzinvolle_stelling_geeft_400():
    assert client.post("/api/analyse", json={"fen": "geen stelling"}).status_code == 400


def test_oefenpartij_raakt_de_rating_niet():
    start = client.get("/api/profile").json()["rating"]
    game = client.post(
        "/api/games",
        json={"bot_id": "timo", "player_color": "white", "base_minutes": 5, "increment_seconds": 0},
    ).json()
    gid = game["id"]
    client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    client.post(f"/api/games/{gid}/bot-move")
    assert client.post(f"/api/games/{gid}/undo").status_code == 200
    client.post(f"/api/games/{gid}/resign")
    snap = client.get(f"/api/games/{gid}").json()
    assert snap["assisted"] is True
    assert client.get("/api/profile").json()["rating"] == start


def test_analysevraag_maakt_er_een_oefenpartij_van():
    game = client.post(
        "/api/games",
        json={"bot_id": "timo", "player_color": "white", "base_minutes": 5, "increment_seconds": 0},
    ).json()
    gid = game["id"]
    client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    assert client.get(f"/api/games/{gid}/eval?multipv=1").status_code == 200
    assert client.get(f"/api/games/{gid}").json()["assisted"] is True
    client.delete(f"/api/games/{gid}")


def test_gewaardeerde_partij_telt_wel_mee():
    start = client.get("/api/profile").json()["rating"]
    game = client.post(
        "/api/games",
        json={"bot_id": "timo", "player_color": "white", "base_minutes": 5, "increment_seconds": 0},
    ).json()
    gid = game["id"]
    client.post(f"/api/games/{gid}/move", json={"uci": "e2e4"})
    client.post(f"/api/games/{gid}/resign")
    assert client.get("/api/profile").json()["rating"] != start


def test_verlaten_partij_wordt_afgebroken():
    game = client.post(
        "/api/games",
        json={"bot_id": "timo", "player_color": "white", "base_minutes": 5, "increment_seconds": 0},
    ).json()
    gid = game["id"]
    afgebroken = abort_stale(hours=0, now=time.time() + 60)
    assert gid in afgebroken
    assert client.get(f"/api/games/{gid}").json()["status"] == "aborted"
