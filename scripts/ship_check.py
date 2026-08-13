#!/usr/bin/env python3
"""Ship gate for KEY 视界 static client: counts 452/2680 + ship tree + shell strict."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHIP = ROOT / "ship" / "key-vision"
SHELL_MAIN = ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl"
SHIP_MAIN = SHIP / "data" / "l2_main_wall.jsonl"
SHIP_PEND = SHIP / "data" / "l2_pending_review.jsonl"
EXPECTED_MAIN, EXPECTED_PEND = 452, 2680
REQUIRED = [
    SHIP / "index.html",
    SHIP / "app.js",
    SHIP / "styles.css",
    SHIP / "SHIP.md",
    SHIP / "data" / "product-bundle.json",
    SHIP / "data" / "FEED-STATUS.json",
    SHIP / "data" / "style-buckets-v1.json",
    SHIP_MAIN,
    SHIP_PEND,
]


def nlines(p: Path) -> int:
    return -1 if not p.exists() else sum(1 for l in p.open() if l.strip())


def main_has_images(p: Path) -> tuple[int, int]:
    ok = miss = 0
    for line in p.open():
        if not line.strip():
            continue
        o = json.loads(line)
        url = o.get("image_url") or o.get("thumbnail_url") or ""
        if isinstance(url, str) and url.strip():
            ok += 1
        else:
            miss += 1
    return ok, miss


def main() -> int:
    err: list[str] = []
    for p in REQUIRED:
        if not p.exists():
            err.append(f"missing {p.relative_to(ROOT)}")

    main_n, pend_n = nlines(SHIP_MAIN), nlines(SHIP_PEND)
    if main_n != EXPECTED_MAIN:
        err.append(f"ship main={main_n} expected {EXPECTED_MAIN}")
    if pend_n != EXPECTED_PEND:
        err.append(f"ship pending={pend_n} expected {EXPECTED_PEND}")

    shell_n = nlines(SHELL_MAIN)
    if shell_n != EXPECTED_MAIN:
        err.append(f"ui-shell main={shell_n} expected {EXPECTED_MAIN}")

    if SHIP_MAIN.exists():
        ok, miss = main_has_images(SHIP_MAIN)
        if miss:
            err.append(f"ship main missing image urls: {miss}/{ok+miss}")
        if ok != EXPECTED_MAIN:
            err.append(f"ship main with images={ok} expected {EXPECTED_MAIN}")

    def check_slim(path: Path, label: str) -> dict:
        if not path.exists():
            err.append(f"missing {label}")
            return {}
        if path.stat().st_size > 200_000:
            err.append(f"{label} too large ({path.stat().st_size} bytes); expected slim pack")
        doc = json.loads(path.read_text(encoding="utf-8"))
        if "item_catalog" in doc:
            err.append(f"{label} still embeds item_catalog")
        blob = json.dumps(doc.get("meta") or {}, ensure_ascii=False)
        if "demo" in blob.lower() or "演示" in blob:
            err.append(f"{label} meta still has demo wording")
        meta = doc.get("meta") or {}
        if meta.get("main_wall") != EXPECTED_MAIN or meta.get("pending_review") != EXPECTED_PEND:
            err.append(f"{label} meta counts {meta.get('main_wall')}/{meta.get('pending_review')}")
        cards = doc.get("l4_cards") or []
        if len(cards) != 3:
            err.append(f"{label} l4_cards={len(cards)} expected 3")
        counts = ((doc.get("l3") or {}).get("counts") or {})
        if counts.get("image_gate"):
            err.append(f"{label} still has image_gate residue")
        if counts.get("primary") != 446 or counts.get("analogy") != 2 or counts.get("shelf") != 4:
            err.append(
                f"{label} role counts {counts.get('primary')}/{counts.get('analogy')}/{counts.get('shelf')} expected 446/2/4"
            )
        for c in cards:
            cover = c.get("cover_image") or c.get("local_ref_image") or ""
            if cover.startswith("http://"):
                err.append(f"{label} card {c.get('card_id')} uses http cover")
            for m in c.get("reference_montage") or []:
                url = m.get("image_url") or ""
                if url.startswith("http://"):
                    err.append(f"{label} montage {m.get('item_id')} uses http")
        return doc

    check_slim(SHIP / "data" / "product-bundle.json", "product-bundle.json")
    check_slim(SHIP / "data" / "product-pack.json", "product-pack.json")

    for rel in ("assets/ref1.png", "assets/ref2.jpg", "assets/ref3.png"):
        if not (SHIP / rel).exists():
            err.append(f"missing {rel}")

    app = (SHIP / "app.js").read_text() if (SHIP / "app.js").exists() else ""
    if "product-bundle.json" not in app:
        err.append("app.js does not prefer product-bundle.json")
    if "isUnsafePack" not in app:
        err.append("app.js missing isUnsafePack")
    if "function wallRole" not in app:
        err.append("app.js missing wallRole")
    main_idx = app.find("data/l2_main_wall.jsonl")
    split_idx = app.find("data/l2_main_wall_a.jsonl")
    if main_idx < 0 or (split_idx >= 0 and split_idx < main_idx):
        err.append("app.js must prefer full wall before split _a/_b")
    for bad in ("演示数据", "Data Crawler", "开锁台", "暂无数据"):
        if bad in app:
            err.append(f"app.js still contains {bad!r}")
    if "c.hidden=true" in app:
        err.append("ship app.js still hides broken wall cards")
    if "图链失效" not in app:
        err.append("ship app.js missing 图链失效 placeholder")
    if "expiredHuabanCount" not in app:
        err.append("ship app.js missing expiredHuabanCount")

    strict = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if strict.returncode != 0:
        err.append("assert_shell_strict failed: " + (strict.stdout + strict.stderr).strip())

    if err:
        print("SHIP_CHECK FAIL:")
        for e in err:
            print(" -", e)
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "ship": str(SHIP),
                "main": main_n,
                "pending": pend_n,
                "assert_shell_strict": json.loads(strict.stdout.strip() or "{}"),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
