#!/usr/bin/env bash
# deploy.sh — Deploy HumanChess naar de mini PC (live omgeving)
#
# Gebruik:
#   ./deploy.sh                # push huidige branch + pull op mini + bouwen + herstarten
#   ./deploy.sh --auto-commit  # commit eerst alle wijzigingen en push daarna
#   ./deploy.sh --skip-git     # alleen pullen/bouwen/herstarten, geen git push
#
# Vereisten:
#   - SSH-toegang tot i647@192.168.1.126 met je standaard sleutel
#   - uv en node op de mini PC (staan er al)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MINI="i647@192.168.1.126"
REMOTE_DIR="/home/i647/humanchess"
REPO_URL="https://github.com/Imr647/HumanChess.git"
PORT=8100
SSH="ssh -o StrictHostKeyChecking=no $MINI"

echo "=== HumanChess deployen naar de mini PC ==="

if [[ "${1:-}" == "--skip-git" ]]; then
    echo "==> Git push overgeslagen (--skip-git)"
elif [[ "${1:-}" == "--auto-commit" ]]; then
    echo "==> Git auto-commit & push"
    cd "$ROOT"
    git add -A
    git diff --cached --quiet || git commit -m "Auto-deploy: $(date '+%Y-%m-%d %H:%M')"
    git push
else
    cd "$ROOT"
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "FOUT: Er zijn nog niet-gecommitte wijzigingen."
        echo "Commit ze eerst zelf, of gebruik './deploy.sh --auto-commit' of '--skip-git'."
        exit 1
    fi
    echo "==> Git push"
    git push
fi

echo "==> Repo klaarzetten op de mini PC"
$SSH "test -d $REMOTE_DIR/.git || git clone $REPO_URL $REMOTE_DIR"
$SSH "cd $REMOTE_DIR && git fetch origin && git reset --hard origin/master"

echo "==> Bouwen en service herstarten"
$SSH "cd $REMOTE_DIR && bash scripts/remote_deploy.sh"

echo
echo "=== Deploy voltooid — http://192.168.1.126:$PORT ==="
echo "Logs: ssh $MINI journalctl --user -u humanchess -f"
