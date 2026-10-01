#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/.venv"

if [[ ! -d "$VENV" ]]; then
    echo "Geen venv gevonden. Draai eerst ./scripts/setup.sh" >&2
    exit 1
fi

echo "==> ROCm PyTorch installeren (gfx1201 / RX 9070 XT)"
uv pip install --python "$VENV" torch torchvision --index-url https://download.pytorch.org/whl/rocm6.4

echo "==> Verifieren"
"$VENV/bin/python" - <<'PY'
import torch
print("torch:", torch.__version__)
if torch.cuda.is_available():
    print("GPU beschikbaar:", torch.cuda.get_device_name(0))
    print("Architectuur:", torch.cuda.get_device_properties(0).gcnArchName)
else:
    print("GEEN GPU beschikbaar; de app valt automatisch terug op CPU.")
PY

echo
echo "Zet de app op GPU met: HCHESS_DEVICE=auto ./scripts/dev.sh"
