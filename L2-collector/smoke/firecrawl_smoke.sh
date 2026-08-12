#!/usr/bin/env bash
# Firecrawl minimal smoke — run AFTER FIRECRAWL_API_KEY is set / firecrawl login.
# No bulk crawl.
set -euo pipefail
OUT_DIR="${1:-/workspace/kuiyan-design-workbench/L2-collector/smoke/out}"
mkdir -p "$OUT_DIR"
CLI=(npx -y firecrawl-cli@1.19.6)

echo "== status =="
"${CLI[@]}" --status || true

echo "== scrape Behance (green tea gift) =="
"${CLI[@]}" scrape "https://www.behance.net/gallery/172938413/_" \
  --format markdown -o "$OUT_DIR/fc-behance-qianshan.md"

echo "== scrape Zcool (庐山云雾) =="
"${CLI[@]}" scrape "https://www.zcool.com.cn/work/ZNzAzNDQzOTI=.html" \
  --format markdown -o "$OUT_DIR/fc-zcool-lushan.md"

echo "== sizes =="
wc -c "$OUT_DIR"/fc-*.md
test -s "$OUT_DIR/fc-behance-qianshan.md"
test -s "$OUT_DIR/fc-zcool-lushan.md"
echo "OK firecrawl smoke"
