#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/bin"
SF_RELEASE="sf_19"
SF_ASSET="stockfish-linux-x86-64-universal.tar.gz"
SF_URL="https://github.com/official-stockfish/Stockfish/releases/download/${SF_RELEASE}/${SF_ASSET}"

mkdir -p "$BIN"

if [[ -x "$BIN/stockfish" ]]; then
    echo "Stockfish is al aanwezig: $BIN/stockfish"
    exit 0
fi

echo "Stockfish downloaden..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fL --progress-bar -o "$TMP/$SF_ASSET" "$SF_URL"
tar -xzf "$TMP/$SF_ASSET" -C "$TMP"
install -m 0755 "$TMP/stockfish/stockfish-linux-x86-64-universal" "$BIN/stockfish"

printf 'uci\nquit\n' | "$BIN/stockfish" 2>/dev/null | head -1 || true
echo "Stockfish geinstalleerd op $BIN/stockfish"
