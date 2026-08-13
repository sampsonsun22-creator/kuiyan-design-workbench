#!/usr/bin/env bash
# Foreground KEY 视界 static server for Cloud Agent `terminals`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${KEY_VISION_PORT:-8767}"
DIR="$ROOT/ship/key-vision"
LOG="${KEY_VISION_LOG:-/tmp/key-vision-http.log}"

if [[ ! -d "$DIR" ]]; then
  echo "missing $DIR" >&2
  exit 1
fi

if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/index.html"; then
  echo "KEY 视界 already on :${PORT} — following log"
  touch "$LOG"
  exec tail -F "$LOG"
fi

echo "KEY 视界 serving ${DIR} on :${PORT}"
exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$DIR"
