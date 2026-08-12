#!/usr/bin/env python3
"""Guardrails for KEY 视界 UI ↔ data landing (does not rewrite locked feeds)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHELL = ROOT / "ui-shell"
DATA = SHELL / "data"
RUNTIME = DATA / "product-runtime.json"
APP = SHELL / "app.js"
HTML = SHELL / "index.html"
RTJS = SHELL / "runtime.js"
MAIN = DATA / "l2_main_wall.jsonl"
PEND = DATA / "l2_pending_review.jsonl"


def fail(msg: str) -> int:
    print("FAIL:", msg)
    return 1


def main() -> int:
    if not RUNTIME.exists():
        return fail("missing product-runtime.json")
    pack = json.loads(RUNTIME.read_text(encoding="utf-8"))
    cards = pack.get("l4_cards") or []
    if len(cards) < 3:
        return fail(f"l4_cards={len(cards)} expected >=3")
    for c in cards:
        refs = c.get("reference_montage") or []
        if not any(r.get("image_url") for r in refs):
            return fail(f"{c.get('card_id')} has no reference image_url")
    if not pack.get("l1"):
        return fail("runtime missing l1")
    if not pack.get("researches"):
        return fail("runtime missing researches")
    html = HTML.read_text(encoding="utf-8")
    if "runtime.js" not in html:
        return fail("index.html does not load runtime.js")
    if 'id="wallMode"' not in html:
        return fail("index.html missing wallMode")
    app = APP.read_text(encoding="utf-8")
    for needle in (
        "product-runtime.json",
        "applyRuntimePack",
        "switchResearch",
        "openCompare",
        "KuiyanRuntime",
    ):
        if needle not in app:
            return fail(f"app.js missing {needle}")
    # stub bundle must not win: boot skips bundle without cards
    if "Never let a stub bundle" not in app and "l4_cards" not in app:
        return fail("boot path does not protect against stub bundle")
    n_main = sum(1 for l in MAIN.open() if l.strip())
    n_pend = sum(1 for l in PEND.open() if l.strip())
    if abs(n_main - 452) > 15:
        return fail(f"locked main wall drifted: {n_main}")
    if abs(n_pend - 2680) > 15:
        return fail(f"locked pending drifted: {n_pend}")
    for path in (APP, RTJS):
        r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
        if r.returncode != 0:
            return fail(f"node --check {path.name}: {r.stderr}")
    print(
        json.dumps(
            {
                "ok": True,
                "runtime_bytes": RUNTIME.stat().st_size,
                "l4_cards": len(cards),
                "researches": len(pack["researches"]),
                "main": n_main,
                "pending": n_pend,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
