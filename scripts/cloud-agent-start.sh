#!/usr/bin/env bash
# Idempotent KEY 视界 preview for Cloud Agents. Must terminate after ready.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${KEY_VISION_PORT:-8767}"
DIR="$ROOT/ship/key-vision"
LOG="${KEY_VISION_LOG:-/tmp/key-vision-http.log}"
PIDFILE="${KEY_VISION_PID:-/tmp/key-vision-http.pid}"
TUNLOG="${KEY_VISION_TUNNEL_LOG:-/tmp/key-vision-tunnel.log}"
TUNPID="${KEY_VISION_TUNNEL_PID:-/tmp/key-vision-tunnel.pid}"
URLFILE="${KEY_VISION_PUBLIC_URL:-/tmp/key-vision-public-url.txt}"
CACHE_V="${KEY_VISION_CACHE:-452p13}"

if [[ ! -d "$DIR" ]]; then
  echo "missing $DIR" >&2
  exit 1
fi

# TigerVNC sometimes reports RandR brightness 0; that washes the remote desktop.
if [[ -n "${DISPLAY:-}" ]] && command -v xrandr >/dev/null 2>&1; then
  xrandr --output VNC-0 --brightness 1 >/dev/null 2>&1 || true
fi

listening() {
  curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/index.html"
}

extract_tunnel_url() {
  local src
  for src in "$TUNLOG" /tmp/cloudflared-tunnel.log; do
    [[ -f "$src" ]] || continue
    grep -oE 'https://[a-z0-9-]+\.trycloudflare.com' "$src" 2>/dev/null | tail -1
  done | awk 'NF{u=$0} END{print u}'
}

ensure_http() {
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/api/llm/health"; then
    echo "KEY 视界 already on :${PORT} with llm proxy"
    return 0
  fi
  if listening; then
    echo "replacing static server on :${PORT} with llm proxy"
    if [[ -f "$PIDFILE" ]]; then
      kill "$(cat "$PIDFILE")" >/dev/null 2>&1 || true
      sleep 0.3
    fi
    fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
    sleep 0.2
  fi
  KEY_VISION_PORT="$PORT" KEY_VISION_DIR="$DIR" python3 "$ROOT/scripts/key_vision_server.py" >"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  local i
  for i in $(seq 1 40); do
    if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/api/llm/health"; then
      echo "KEY 视界 listening on :${PORT} (llm proxy)"
      return 0
    fi
    sleep 0.15
  done
  echo "failed to start KEY 视界 on :${PORT}" >&2
  tail -20 "$LOG" >&2 || true
  return 1
}

ensure_tunnel() {
  # Web Cloud Agent has no localhost forward. Publish a trycloudflare URL so
  # the product can be opened in any browser (including Cursor Simple Browser).
  local url
  url="$(extract_tunnel_url || true)"
  if [[ -n "$url" ]] && curl -sf -o /dev/null --max-time 8 "$url/"; then
    echo "$url" >"$URLFILE"
    echo "KEY 视界 public ${url}/?v=${CACHE_V}"
    return 0
  fi
  if ! command -v npx >/dev/null 2>&1; then
    echo "npx missing; skip public tunnel" >&2
    return 0
  fi
  : >"$TUNLOG"
  nohup npx --yes cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate >"$TUNLOG" 2>&1 &
  echo $! >"$TUNPID"
  local i
  for i in $(seq 1 50); do
    url="$(extract_tunnel_url || true)"
    if [[ -n "$url" ]]; then
      echo "$url" >"$URLFILE"
      echo "KEY 视界 public ${url}/?v=${CACHE_V}"
      return 0
    fi
    sleep 0.3
  done
  echo "public tunnel not ready yet; see ${TUNLOG}" >&2
  return 0
}

ensure_http
ensure_tunnel || true
if [[ -f "$URLFILE" ]]; then
  echo "open $(cat "$URLFILE")/?v=${CACHE_V}"
else
  echo "open http://127.0.0.1:${PORT}/?v=${CACHE_V}  (only on this VM / Desktop port-forward)"
fi
exit 0
