#!/usr/bin/env python3
"""Cross-review L2 items for KEY 视界 main wall (packaging / visual-hammer).

Product rules (v1):
  PASS → wall_status=main_wall
  FAIL → wall_status=pending_review (+ review_flags[])
  hard junk → wall_status=excluded (rare)

Checks:
  1) image_ok: image_url is http(s)
  2) source_ok: page_url is http(s)
  3) not_duplicate: first occurrence of id wins; also soft-dedupe by image_url
  4) relevance: packaging OR (visual-hammer AND design-ish); drop literal tool-hammer noise
"""
from __future__ import annotations
import argparse, json, re, sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

try:
    from brief_relevance_v1 import apply_gate as brief_relevance_gate
except ImportError:
    brief_relevance_gate = None  # type: ignore

PACK_RE = re.compile(
    r"packag|包装|礼盒|gift\s*box|branding|视觉|品牌|package|label|盒|袋|瓶贴|"
    r"skincare|cosmetic|茶叶|茶礼|food|wine|beverage|饮料|酒|化妆品|视觉锤|"
    r"visual\s*hammer|visual\s*identity|超级符号|语言钉",
    re.I,
)
# Literal tool / sports hammer noise under visual-hammer queries
TOOL_HAMMER_RE = re.compile(
    r"\b(claw\s*hammer|framing\s*hammer|sledge|mallet|hammer\s*and\s*(saw|nail)|"
    r"tool\s*hammer|hammer\s*vector|types?\s*of\s*hammers?)\b|"
    r"锤子(?!视觉)|榔头|锤头",
    re.I,
)
VH_QUERY_RE = re.compile(r"视觉锤|visual\s*hammer|laura\s*ries", re.I)


def _http(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    try:
        u = urlparse(url.strip())
        return u.scheme in ("http", "https") and bool(u.netloc)
    except Exception:
        return False


def relevance(item: dict) -> tuple[bool, str | None]:
    q = item.get("query_used") or ""
    title = item.get("title") or ""
    tags = " ".join(item.get("raw_tags") or [])
    blob = f"{q} {title} {tags}"
    is_vh = bool(VH_QUERY_RE.search(q) or VH_QUERY_RE.search(title))
    packish = bool(PACK_RE.search(blob))
    if is_vh and TOOL_HAMMER_RE.search(title) and not PACK_RE.search(title):
        return False, "tool_hammer_noise"
    if packish:
        return True, None
    if is_vh:
        # visual hammer query but title has no packaging/design cue → pending
        if re.search(r"设计|品牌|包装|brand|design|logo|符号|identity|锤", title, re.I):
            return True, None
        return False, "vh_low_design_signal"
    # non-packaging query leftovers
    return False, "off_category"


def review_item(item: dict, seen_ids: set, seen_images: set) -> dict:
    flags: list[str] = []
    iid = item.get("id") or ""
    img = (item.get("image_url") or "").strip()
    page = (item.get("page_url") or "").strip()

    if not _http(img):
        flags.append("bad_image_url")
    if not _http(page):
        flags.append("bad_page_url")

    if iid in seen_ids:
        flags.append("duplicate_id")
    else:
        seen_ids.add(iid)

    img_key = img.split("?")[0] if img else ""
    if img_key and img_key in seen_images:
        flags.append("duplicate_image")
    elif img_key:
        seen_images.add(img_key)

    ok_rel, rel_flag = relevance(item)
    if not ok_rel and rel_flag:
        flags.append(rel_flag)

    # empty title is soft — still pass if otherwise ok
    if not (item.get("title") or "").strip():
        flags.append("empty_title")  # soft; does not alone block if only this + soft

    hard = {"bad_image_url", "bad_page_url", "duplicate_id"}
    soft_only = {"empty_title"}
    blocking = [f for f in flags if f not in soft_only]

    if "bad_image_url" in flags and "bad_page_url" in flags:
        status = "excluded"
    elif blocking:
        status = "pending_review"
    else:
        status = "main_wall"

    item = dict(item)
    item["wall_status"] = status
    item["review_flags"] = flags
    item.setdefault("extra", {})
    if isinstance(item["extra"], dict):
        item["extra"]["cross_review"] = "packaging_vh_v1"
    return item


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("-o", "--output", type=Path, required=True, help="full reviewed jsonl")
    ap.add_argument("--main-wall", type=Path, help="only main_wall rows")
    ap.add_argument("--pending", type=Path, help="only pending_review rows")
    ap.add_argument("--summary", type=Path, help="json summary path")
    ap.add_argument("--brief-relevance", action="store_true", help="apply brief_relevance_v1 after packaging gate")
    args = ap.parse_args()

    seen_ids: set[str] = set()
    seen_images: set[str] = set()
    counts = Counter()
    flag_counts = Counter()
    rows = []
    with args.input.open() as fin:
        for line in fin:
            if not line.strip():
                continue
            item = review_item(json.loads(line), seen_ids, seen_images)
            if args.brief_relevance and brief_relevance_gate is not None:
                # only demote; never promote pending image fails
                prev = item.get("wall_status")
                item = brief_relevance_gate(item)
                if prev == "pending_review" and item.get("wall_status") == "main_wall":
                    item["wall_status"] = "pending_review"
                    item["qc_status"] = "pending_review"
            rows.append(item)
            counts[item["wall_status"]] += 1
            for f in item.get("review_flags") or []:
                flag_counts[f] += 1

    with args.output.open("w") as fout:
        for item in rows:
            fout.write(json.dumps(item, ensure_ascii=False) + "\n")

    if args.main_wall:
        with args.main_wall.open("w") as fout:
            for item in rows:
                if item["wall_status"] == "main_wall":
                    fout.write(json.dumps(item, ensure_ascii=False) + "\n")
    if args.pending:
        with args.pending.open("w") as fout:
            for item in rows:
                if item["wall_status"] == "pending_review":
                    fout.write(json.dumps(item, ensure_ascii=False) + "\n")

    # bucket coverage on main wall
    buck = Counter()
    for item in rows:
        if item["wall_status"] != "main_wall":
            continue
        bs = item.get("suggested_style_buckets") or []
        if not bs:
            buck["__untagged__"] += 1
        for b in bs:
            buck[b] += 1

    summary = {
        "rules": "packaging_vh_v1+brief_relevance_v1" if args.brief_relevance else "packaging_vh_v1",
        "total": len(rows),
        "wall_status": dict(counts),
        "flags": dict(flag_counts),
        "main_wall_bucket_counts": dict(buck.most_common()),
        "outputs": {
            "all": str(args.output),
            "main_wall": str(args.main_wall) if args.main_wall else None,
            "pending": str(args.pending) if args.pending else None,
        },
    }
    if args.summary:
        args.summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
