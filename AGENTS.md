# HumanChess — Werkwijze

Webapplicatie om te schaken tegen **menselijke** bots (Maia-3) met Stockfish-analyse.

## Architectuur

| Deel | Techniek | Draait |
|------|----------|--------|
| `backend/` | Python 3.12 (uv), FastAPI + Uvicorn | poort **8000** |
| `frontend/` | Vite + React + TypeScript | poort **5173**, proxyt `/api` naar 8000 |
| Bots | Maia-3 UCI (5M/23M/79M) via `maia3-uci` | subprocess |
| Analyse | Stockfish 19 (`bin/stockfish`) | subprocess |
| Data | SQLite `data/humanchess.db` (niet in git) | runtime |

## Veelgebruikte commando's

```bash
./scripts/setup.sh        # eenmalig: venv, deps, engines, model-cache
./scripts/dev.sh          # backend + frontend tegelijk
make dev                  # idem
make test                 # backend tests
```

## Conventies

- **Geen comments** in code tenzij echt nodig.
- Backend: FastAPI-routers in `app/main.py`, logica gescheiden in `game.py`,
  engine-wrappers in `maia.py` / `stockfish.py`, persona's in `bots.py`.
- Frontend: React function components + hooks, API-calls via `src/lib/api.ts`.
- Bots zijn datagedreven in `backend/app/bots.py` (naam, Elo, temperature, top-p,
  kleur, toon). Praatzinnen staan in `backend/app/chat.py`.
- De spelerrating staat in de `meta`-tabel (`data/humanchess.db`), bijgewerkt via
  `_settle()` in `backend/app/main.py` zodra een partij klaar is.

## Belangrijk

- Bots hebben een menselijke bedenktijd (`think_ms` in `bots.py`), te schalen met
  `HCHESS_BOT_THINK_SCALE` (0 = uit) en `HCHESS_BOT_THINK_JITTER` (variatie).
- Maia-3 draait op **CPU** (default) of **ROCm** (`scripts/setup_gpu.sh`, experimenteel).
- Engine-modelbestanden en stockfish-binary staan in `bin/` resp. HuggingFace-cache
  en worden **niet** gecommit.
