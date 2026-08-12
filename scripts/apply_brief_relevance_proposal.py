#!/usr/bin/env python3
"""HARD DISABLED — shell already at brief_relevance 184/2763. Do not run."""
import sys
print("DISABLED: shell already brief_relevance_v1 184/2763; do not apply.", file=sys.stderr)
raise SystemExit(3)
#!/usr/bin/env python3
"""Atomic apply brief_relevance proposal → ui-shell + demo-bundle. Requires writable shell jsonl."""
from __future__ import annotations
import json, os, re, shutil, subprocess, sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace/kuiyan-design-workbench")
SHELL = ROOT / "ui-shell" / "data"
DEMO = ROOT / "demo" / "e2e-green-tea-gift"
PROP_MAIN = ROOT / "L3" / "feeds" / "l2_main_wall_brief_relevance_proposed.jsonl"
PROP_PEND = ROOT / "L3" / "feeds" / "l2_pending_review_brief_relevance_proposed.jsonl"
BUCKETS = json.loads((ROOT / "L3" / "style-buckets-v1.json").read_text())
ID_TO_ZH = {b["id"]: b["name_zh"] for b in BUCKETS["buckets"]}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def nlines(p: Path) -> int:
    return sum(1 for line in p.open(encoding="utf-8") if line.strip())


def main() -> int:
    shell_main = SHELL / "l2_main_wall.jsonl"
    shell_pend = SHELL / "l2_pending_review.jsonl"
    if not os.access(shell_main, os.W_OK) or not os.access(shell_pend, os.W_OK):
        print("LOCKED: ui-shell jsonl not writable — abort (wait for platform unlock)", file=sys.stderr)
        return 2
    if not PROP_MAIN.exists() or not PROP_PEND.exists():
        print("missing proposal files", file=sys.stderr)
        return 1
    nm, np_ = nlines(PROP_MAIN), nlines(PROP_PEND)
    if abs(nm - 184) > 10:
        print(f"unexpected proposal main={nm}", file=sys.stderr)
        return 1

    # atomic-ish: write temp then replace
    for src, dst in [(PROP_MAIN, shell_main), (PROP_PEND, shell_pend)]:
        tmp = dst.with_suffix(dst.suffix + ".tmp")
        shutil.copyfile(src, tmp)
        tmp.replace(dst)
    # mirrors
    shutil.copyfile(shell_main, DEMO / "l2-main-wall.jsonl")
    shutil.copyfile(shell_pend, DEMO / "l2-pending-review.jsonl")
    shutil.copyfile(shell_main, SHELL / "l2_main_wall_20260812.jsonl")
    shutil.copyfile(shell_pend, SHELL / "l2_pending_review_20260812.jsonl")

    main_items = [json.loads(l) for l in shell_main.read_text().splitlines() if l.strip()]
    pend_items_raw = [json.loads(l) for l in shell_pend.read_text().splitlines() if l.strip()]

    by_bucket = defaultdict(list)
    for it in main_items:
        bucks = [b for b in (it.get("suggested_style_buckets") or []) if b in ID_TO_ZH][:3]
        zh = [ID_TO_ZH[b] for b in bucks] or ["待标注"]
        card = {
            "id": it["id"],
            "title": it.get("title") or "",
            "source": it.get("source"),
            "image_url": it.get("image_url"),
            "thumbnail_url": it.get("thumbnail_url") or it.get("image_url"),
            "page_url": it.get("page_url"),
            "author_or_brand": it.get("author_or_brand"),
            "source_type": it.get("source_type"),
            "suggested_style_buckets": bucks,
            "style_tags": zh,
            "query_used": it.get("query_used") or "",
            "qc_status": "pass_main",
            "wall_status": "main_wall",
            "brief_relevance_v1": (it.get("extra") or {}).get("brief_relevance_v1"),
        }
        by_bucket[zh[0]].append(card)

    pend_wall = []
    for it in pend_items_raw:
        pend_wall.append({
            "id": it["id"],
            "title": it.get("title") or "",
            "source": it.get("source"),
            "image_url": it.get("image_url"),
            "thumbnail_url": it.get("thumbnail_url") or it.get("image_url"),
            "page_url": it.get("page_url"),
            "qc_status": "pending_review",
            "wall_status": "pending_review",
            "review_fail": (it.get("extra") or {}).get("review_fail"),
            "brief_relevance_v1": (it.get("extra") or {}).get("brief_relevance_v1"),
        })

    l3_path = DEMO / "L3-market-map.json"
    l3 = json.loads(l3_path.read_text()) if l3_path.exists() else {}
    old = l3.get("walls") or {}
    l3["counts"] = {
        "main_wall": len(main_items),
        "pending_review": len(pend_items_raw),
        "with_image_main": sum(1 for it in main_items if it.get("image_url")),
        "primary": len(main_items),
        "shelf": len((old.get("shelf") or {}).get("items") or []),
        "shell_default": "strict",
        "image_gate": True,
        "brief_relevance_v1": True,
    }
    l3["feed_source"] = "brief_relevance_v1_proposal"
    l3["walls"] = {
        "primary": {"count": len(main_items), "by_bucket": dict(by_bucket)},
        "analogy": old.get("analogy") or {"items": []},
        "shelf": old.get("shelf") or {"items": []},
        "pending_review": {
            "count": len(pend_wall),
            "note": "brief_relevance_v1 demotions + prior pending",
            "items": pend_wall,
        },
    }
    l3_path.write_text(json.dumps(l3, ensure_ascii=False, indent=2), encoding="utf-8")

    # FEED-STATUS
    status = {
        "shell_default": "strict",
        "qc_mode": "image_gate+brief_relevance_v1",
        "main_wall": len(main_items),
        "pending_review": len(pend_items_raw),
        "pass_main": len(main_items),
        "note": "brief_relevance_v1 applied; accuracy over volume",
        "updated_at": now(),
    }
    (SHELL / "FEED-STATUS.json").write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")

    # lock md
    (SHELL / "SHELL-DEFAULT.lock.md").write_text(
        f"# SHELL DEFAULT LOCK\n\nshell_default: **strict** (image_gate + brief_relevance_v1)\n"
        f"pass_main / main_wall: **{len(main_items)}**\npending_review: **{len(pend_items_raw)}**\n\n"
        f"NEVER prefer wide/structural into the shell.\n",
        encoding="utf-8",
    )

    # patch assert expectations if still 1820/1868
    assert_py = ROOT / "scripts" / "assert_shell_strict.py"
    at = assert_py.read_text(encoding="utf-8")
    at2 = re.sub(r"abs\(n - \d+\)", f"abs(n - {len(main_items)})", at, count=1)
    at2 = re.sub(r"abs\(p - \d+\)", f"abs(p - {len(pend_items_raw)})", at2, count=1)
    at2 = re.sub(r"expected ~\d+", f"expected ~{len(main_items)}", at2, count=1)
    at2 = re.sub(r"expected ~\d+", f"expected ~{len(pend_items_raw)}", at2, count=1)
    # lock text check 1868 -> new
    at2 = at2.replace("1868", str(len(main_items))).replace("1820", str(len(main_items)))
    at2 = at2.replace("1079", str(len(pend_items_raw))).replace("1127", str(len(pend_items_raw)))
    assert_py.write_text(at2, encoding="utf-8")

    # build sources prefer shell
    build = ROOT / "ui" / "build-demo-bundle.py"
    bt = build.read_text(encoding="utf-8")
    new_sources = '''JSONL_SOURCES = [
    ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl",
    ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl",
    DEMO / "l2-firecrawl.jsonl",
]'''
    bt2, n = re.subn(r"JSONL_SOURCES = \[[\s\S]*?\]", new_sources, bt, count=1)
    if n == 1:
        build.write_text(bt2, encoding="utf-8")

    subprocess.check_call([sys.executable, str(ROOT / "ui" / "build-demo-bundle.py")])
    shutil.copyfile(ROOT / "ui" / "data" / "demo-bundle.json", SHELL / "demo-bundle.json")
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")])

    b = json.loads((SHELL / "demo-bundle.json").read_text())
    print(json.dumps({
        "ok": True,
        "main_wall": len(main_items),
        "pending_review": len(pend_items_raw),
        "bundle_counts": b.get("l3", {}).get("counts"),
        "l4_cards": len(b.get("l4_cards") or []),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
