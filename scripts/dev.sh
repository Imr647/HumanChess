#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

if [[ ! -d "$BACKEND/.venv" ]]; then
    echo "Backend-venv ontbreekt. Draai eerst ./scripts/setup.sh" >&2
    exit 1
fi

BACK_PID=""
FRONT_PID=""

cleanup() {
    trap - EXIT INT TERM
    [[ -n "$FRONT_PID" ]] && kill "$FRONT_PID" 2>/dev/null || true
    [[ -n "$BACK_PID" ]] && kill "$BACK_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend op http://127.0.0.1:8000 (docs: /docs)"
(cd "$BACKEND" && exec .venv/bin/uvicorn app.main:app --reload --port 8000) &
BACK_PID=$!

echo "Frontend op http://localhost:5173"
(cd "$FRONTEND" && exec npm run dev) &
FRONT_PID=$!

wait -n "$BACK_PID" "$FRONT_PID"
echo "Een van de servers is gestopt; de andere wordt afgesloten." >&2
