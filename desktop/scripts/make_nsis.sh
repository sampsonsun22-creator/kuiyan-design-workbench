#!/usr/bin/env bash
# Build KEY-Vision-Setup-*.exe from dist/win-unpacked using system makensis.
# Used on Linux Cloud Agents where electron-builder's Wine NSIS cannot run.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNPACKED="$ROOT/dist/win-unpacked"
OUT="$ROOT/dist/KEY-Vision-Setup-0.6.0.exe"
if [[ ! -f "$UNPACKED/KEY 视界.exe" ]]; then
  echo "missing $UNPACKED — run electron-builder --win dir first" >&2
  exit 1
fi
if ! command -v makensis >/dev/null 2>&1; then
  echo "makensis not found; apt-get install nsis" >&2
  exit 1
fi
makensis -V2 \
  -DSRC_DIR="$UNPACKED" \
  -DOUT_FILE="$OUT" \
  "$ROOT/build/installer.nsi"
ls -lh "$OUT"
