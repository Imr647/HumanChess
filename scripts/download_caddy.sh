#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$ROOT/bin"
VERSION="2.11.4"
ASSET="caddy_${VERSION}_linux_amd64.tar.gz"
URL="https://github.com/caddyserver/caddy/releases/download/v${VERSION}/${ASSET}"

mkdir -p "$BIN"

if [[ -x "$BIN/caddy" ]]; then
    echo "Caddy is al aanwezig: $BIN/caddy"
    "$BIN/caddy" version || true
    exit 0
fi

echo "Caddy ${VERSION} downloaden..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fL --progress-bar -o "$TMP/$ASSET" "$URL"
tar -xzf "$TMP/$ASSET" -C "$TMP" caddy
install -m 0755 "$TMP/caddy" "$BIN/caddy"
"$BIN/caddy" version
echo "Caddy geinstalleerd op $BIN/caddy"
