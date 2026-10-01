#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
TORCH_CPU_INDEX="https://download.pytorch.org/whl/cpu"

echo "==> Stockfish downloaden"
"$ROOT/scripts/download_engines.sh"

echo "==> Python 3.12 venv maken (uv)"
cd "$BACKEND"
uv venv --python 3.12 .venv

echo "==> CPU-torch installeren"
uv pip install --python .venv "torch" --index-url "$TORCH_CPU_INDEX"

echo "==> Backend dependencies installeren"
uv pip install --python .venv -e ".[dev]"

echo "==> Maia-3 modellen cachen (5M verplicht, 23M optioneel)"
.venv/bin/maia3-cache --model maia3-5m || true
.venv/bin/maia3-cache --model maia3-23m || true

echo "==> Frontend dependencies installeren en bouwen"
cd "$FRONTEND"
npm install
npm run build

echo
echo "Klaar. Start met: ./scripts/dev.sh"
echo "Productie (mini PC): ./deploy.sh"
echo "GPU proberen? Draai daarna: ./scripts/setup_gpu.sh"
