#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d backend/.venv ]]; then
    echo "==> Eerste keer op deze machine: volledige setup"
    ./scripts/setup.sh
else
    echo "==> Backend dependencies bijwerken"
    (cd backend && uv pip install --python .venv -e . >/dev/null)
    ./scripts/download_engines.sh
fi

echo "==> Frontend bouwen"
(cd frontend && npm install --silent && npm run build)

echo "==> systemd service installeren en herstarten"
mkdir -p "$HOME/.config/systemd/user"
ln -sf "$ROOT/humanchess.service" "$HOME/.config/systemd/user/humanchess.service"
systemctl --user daemon-reload
systemctl --user enable --now humanchess
systemctl --user restart humanchess
sleep 2
systemctl --user --no-pager --lines=5 status humanchess || true

echo
echo "HumanChess draait op http://$(hostname -I | awk '{print $1}'):8100"
