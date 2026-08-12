#!/usr/bin/env python3
"""Validate UI ↔ data landing without rewriting the 452/2680 jsonl lock."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl"
PEND = ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl"
BUNDLE = ROOT / "ui-shell" / "data" / "product-bundle.json"
APP = ROOT / "ui-shell" / "app.js"
HTML = ROOT / "ui-shell" / "index.html"
SHIP_BUNDLE = ROOT / "ship" / "key-vision" / "data" / "product-bundle.json"
FORBIDDEN_GREEN = "briefs/green_tea_gift_main_wall.jsonl"


def nlines(p: Path) -> int:
    return sum(1 for line in p.open(encoding="utf-8") if line.strip())


def main() -> int:
    err: list[str] = []
    n, p = nlines(MAIN), nlines(PEND)
    if n != 452:
        err.append(f"main_wall={n} expected 452 (lock broken)")
    if p != 2680:
        err.append(f"pending={p} expected 2680 (lock broken)")

    bundle = json.loads(BUNDLE.read_text(encoding="utf-8"))
    cards = bundle.get("l4_cards") or []
    if len(cards) != 3:
        err.append(f"product-bundle l4_cards={len(cards)} expected 3")
    titles = [c.get("title") for c in cards]
    for t in ("青绿新中轴", "静奢留白", "开箱仪式"):
        if t not in titles:
            err.append(f"missing L4 card {t}")
    if not bundle.get("l1"):
        err.append("product-bundle missing l1")
    if bundle.get("meta", {}).get("main_wall") != 452:
        err.append("bundle meta.main_wall != 452")
    if "item_catalog" in bundle:
        err.append("slim bundle must not embed item_catalog")

    ship = json.loads(SHIP_BUNDLE.read_text(encoding="utf-8"))
    if len(ship.get("l4_cards") or []) != 3:
        err.append("ship product-bundle missing l4_cards")

    app = APP.read_text(encoding="utf-8")
    html = HTML.read_text(encoding="utf-8")
    if "const SAVED" in app:
        err.append("app.js still uses cosmetic SAVED list")
    if "data/briefs/green_tea_gift_main_wall.jsonl" in app:
        err.append("app.js must not load stale 184 green tea brief file")
    if "l4_cards.filter" in app and "(state.bundle.l4_cards || [])" not in app:
        # keptCards must guard
        if "state.bundle.l4_cards.filter" in app:
            err.append("keptCards is unguarded (will throw when l4_cards missing)")
    if 'data-cat="primary"' not in html:
        err.append("index.html missing 主品类 chip")
    if 'data-cat="analogy"' not in html:
        err.append("index.html missing 类比 chip")
    if 'data-cat="shelf"' not in html:
        err.append("index.html missing 货架 chip")
    if "loadProductBundle" not in app:
        err.append("app.js missing loadProductBundle")
    if "采集字段" not in app:
        err.append("inspector missing 采集字段")

    tonic = ROOT / "ui-shell" / "data" / "briefs" / "tonic_gift_main_wall.jsonl"
    baijiu = ROOT / "ui-shell" / "data" / "briefs" / "baijiu_gift_main_wall.jsonl"
    if not tonic.exists() or nlines(tonic) < 50:
        err.append("missing tonic brief wall")
    if not baijiu.exists() or nlines(baijiu) < 50:
        err.append("missing baijiu brief wall")

    cp = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        err.append("assert_shell_strict failed: " + (cp.stdout or cp.stderr)[:400])

    out = {"ok": not err, "main": n, "pending": p, "l4_cards": len(cards), "errors": err}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if not err else 1


if __name__ == "__main__":
    raise SystemExit(main())
