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

echo "==> Caddy ophalen (reverse proxy op poort 80)"
./scripts/download_caddy.sh

echo "==> systemd services installeren en herstarten"
mkdir -p "$HOME/.config/systemd/user"
for unit in humanchess caddy; do
    ln -sf "$ROOT/$unit.service" "$HOME/.config/systemd/user/$unit.service"
done
systemctl --user daemon-reload
systemctl --user enable --now humanchess caddy
systemctl --user restart humanchess
sleep 1
systemctl --user restart caddy
sleep 2
for unit in humanchess caddy; do
    systemctl --user --no-pager --lines=3 status "$unit" || true
done
if ! systemctl --user is-active --quiet caddy; then
    echo "LET OP: caddy kan niet op poort 80 binden. Draai eenmalig (met sudo):"
    echo "  sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80"
    echo "  sudo ufw allow 80/tcp"
fi

IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')"
echo
echo "HumanChess:      http://${IP:-localhost}:8100"
echo "Via proxy :80:   http://${IP:-localhost}"
echo "Vriendelijke naam: http://chess.local"
