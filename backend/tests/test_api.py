from fastapi.testclient import TestClient

from app.main import app


def test_health():
    with TestClient(app) as client:
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


def test_bots():
    with TestClient(app) as client:
        resp = client.get("/api/bots")
        assert resp.status_code == 200
        bots = resp.json()
        assert len(bots) >= 5
        assert {"id", "name", "elo"} <= set(bots[0])


def test_play_and_undo():
    with TestClient(app) as client:
        resp = client.post(
            "/api/games",
            json={"bot_id": "pip", "player_color": "white", "base_minutes": 5},
        )
        assert resp.status_code == 200
        game = resp.json()
        assert game["turn"] == "white"
        assert game["player_turn"] is True

        resp = client.post(f"/api/games/{game['id']}/move", json={"uci": "e2e4"})
        assert resp.status_code == 200
        after = resp.json()
        assert len(after["moves"]) == 2
        assert after["moves"][0]["san"] == "e4"
        assert after["player_turn"] is True

        resp = client.post(f"/api/games/{game['id']}/undo")
        assert resp.status_code == 200
        assert len(resp.json()["moves"]) == 0


def test_bot_moves_first_as_black():
    with TestClient(app) as client:
        resp = client.post(
            "/api/games",
            json={"bot_id": "pip", "player_color": "black", "base_minutes": 5},
        )
        assert resp.status_code == 200
        game = resp.json()
        assert len(game["moves"]) == 1
        assert game["player_turn"] is True


def test_illegal_move_rejected():
    with TestClient(app) as client:
        game = client.post(
            "/api/games",
            json={"bot_id": "pip", "player_color": "white"},
        ).json()
        resp = client.post(f"/api/games/{game['id']}/move", json={"uci": "e2e5"})
        assert resp.status_code == 400


def test_pgn_export():
    with TestClient(app) as client:
        game = client.post(
            "/api/games",
            json={"bot_id": "pip", "player_color": "white"},
        ).json()
        client.post(f"/api/games/{game['id']}/move", json={"uci": "d2d4"})
        resp = client.get(f"/api/games/{game['id']}/pgn")
        assert resp.status_code == 200
        assert "1. d4" in resp.text


def test_hint():
    with TestClient(app) as client:
        game = client.post(
            "/api/games",
            json={"bot_id": "pip", "player_color": "white"},
        ).json()
        resp = client.post(f"/api/games/{game['id']}/hint")
        assert resp.status_code == 200
        assert resp.json()["best_move"]
