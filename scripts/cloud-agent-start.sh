#!/usr/bin/env bash
# Idempotent KEY 视界 preview for Cloud Agents. Must terminate after ready.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${KEY_VISION_PORT:-8767}"
DIR="$ROOT/ship/key-vision"
LOG="${KEY_VISION_LOG:-/tmp/key-vision-http.log}"
PIDFILE="${KEY_VISION_PID:-/tmp/key-vision-http.pid}"

if [[ ! -d "$DIR" ]]; then
  echo "missing $DIR" >&2
  exit 1
fi

# TigerVNC sometimes reports RandR brightness 0; that washes the remote desktop.
# Computer-use chat screenshots are still greyscale (Cursor capture), but the
# 24-bit VNC framebuffer and "take control" desktop stay in color.
if [[ -n "${DISPLAY:-}" ]] && command -v xrandr >/dev/null 2>&1; then
  xrandr --output VNC-0 --brightness 1 >/dev/null 2>&1 || true
fi

if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/index.html"; then
  echo "KEY 视界 already on :${PORT}"
  exit 0
fi

python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIR" >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

for _ in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/index.html"; then
    echo "KEY 视界 listening on :${PORT}"
    exit 0
  fi
  sleep 0.15
done

echo "failed to start KEY 视界 on :${PORT}" >&2
tail -20 "$LOG" >&2 || true
exit 1
