#!/usr/bin/env python3
"""Assemble the public KEY 视界 client under ship/key-vision/.

Does not rewrite the 452/2680 jsonl lock. Copies UI + slim bundle + assets + extra briefs.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "ui-shell"
DESTS = [
    ROOT / "ship" / "key-vision",
    ROOT / "ship" / "key-vision-vercel",
]


def copy_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and not dest.stat().st_mode & 0o222:
        dest.chmod(dest.stat().st_mode | 0o200)
    shutil.copy2(src, dest)


def main() -> int:
    files = [
        "index.html",
        "app.js",
        "styles.css",
        "data/product-bundle.json",
        "data/product-pack.json",
        "data/researches.json",
        "data/DO-NOT-RESTORE-1820.md",
        "data/FEED-STATUS.json",
        "data/style-buckets-v1.json",
        "data/market-styles-v1.json",
        "data/classify-dimensions-v1.json",
        "data/l2_main_wall.jsonl",
        "data/l2_pending_review.jsonl",
        "data/l2-main-wall.jsonl",
        "data/l2-pending-review.jsonl",
        "data/briefs/baijiu_gift_main_wall.jsonl",
        "data/briefs/tonic_gift_main_wall.jsonl",
        "data/briefs/l2-brief-pet-food-pack-20260827T061423Z.jsonl",
        "assets/ref1.png",
        "assets/ref2.jpg",
        "assets/ref3.png",
        "assets/brand/key-wordmark-transparent.png",
        "assets/brand/logo-key-lockup-on-dark.svg",
        "assets/brand/logo-key-lockup-on-light.svg",
        "assets/brand/logo-key-mark-on-dark.svg",
        "assets/brand/logo-key-mark.svg",
    ]
    for dest in DESTS:
        for rel in files:
            src = SRC / rel
            if not src.exists():
                print("skip missing", src)
                continue
            copy_file(src, dest / rel)
        # public trap: empty demo-bundle must not shadow L4
        slim = dest / "data" / "product-bundle.json"
        demo = dest / "data" / "demo-bundle.json"
        if slim.exists():
            shutil.copy2(slim, demo)
        print("shipped", dest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
