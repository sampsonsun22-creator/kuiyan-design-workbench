#!/usr/bin/env python3
"""Map Apify Taobao/JD dataset items → L2 collection-schema JSONL (shelf smoke).

Usage:
  python map_apify_shelf.py --platform jd --query 绿茶礼盒 --in dataset.json --out shelf-smoke-jd.jsonl
  python map_apify_shelf.py --platform taobao --query 绿茶礼盒 --in dataset.json --out shelf-smoke-taobao.jsonl

Does NOT call Apify. Feed it exported dataset JSON (list or {items:[...]}).
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _first_str(*vals: Any) -> str:
    for v in vals:
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list):
            for x in v:
                if isinstance(x, str) and x.strip():
                    return x.strip()
                if isinstance(x, dict):
                    u = x.get("url") or x.get("image") or x.get("src")
                    if isinstance(u, str) and u.strip():
                        return u.strip()
    return ""


def _pick_image(row: dict[str, Any]) -> str:
    return _first_str(
        row.get("image"),
        row.get("imageUrl"),
        row.get("image_url"),
        row.get("mainImage"),
        row.get("mainPic"),
        row.get("picUrl"),
        row.get("thumbnail"),
        row.get("images"),
        row.get("gallery"),
        (row.get("media") or {}).get("mainImage") if isinstance(row.get("media"), dict) else None,
    )


def _pick_url(row: dict[str, Any], platform: str) -> str:
    u = _first_str(
        row.get("url"),
        row.get("productUrl"),
        row.get("detailUrl"),
        row.get("itemUrl"),
        row.get("link"),
        row.get("page_url"),
    )
    if u:
        return u
    item_id = _first_str(row.get("itemId"), row.get("skuId"), row.get("productId"), row.get("id"))
    if not item_id:
        return ""
    if platform == "jd":
        return f"https://item.jd.com/{item_id}.html"
    if platform == "taobao":
        return f"https://item.taobao.com/item.htm?id={item_id}"
    return ""


def _pick_title(row: dict[str, Any]) -> str:
    return _first_str(row.get("title"), row.get("name"), row.get("productName"), row.get("skuName")) or "untitled"


def _pick_brand(row: dict[str, Any]) -> str | None:
    b = _first_str(
        row.get("brand"),
        row.get("shopName"),
        row.get("shop"),
        row.get("seller"),
        (row.get("shop") or {}).get("name") if isinstance(row.get("shop"), dict) else None,
    )
    return b or None


def _stable_id(platform: str, row: dict[str, Any], idx: int) -> str:
    native = _first_str(row.get("itemId"), row.get("skuId"), row.get("productId"), row.get("id"))
    if native:
        slug = re.sub(r"[^\w\-]+", "_", native)[:80]
        return f"{platform}:{slug}"
    return f"{platform}:smoke-{idx:02d}"


def map_row(row: dict[str, Any], *, platform: str, query: str, idx: int) -> dict[str, Any]:
    image = _pick_image(row)
    page = _pick_url(row, platform)
    title = _pick_title(row)
    buckets: list[str] = []
    t = title.lower()
    if any(k in title for k in ("礼盒", "礼赠", "送礼", "gift")):
        buckets.append("chinese_ceremonial")
    if any(k in title for k in ("新中式", "国潮", "中式")):
        buckets.append("chinese_modern")
    if any(k in title for k in ("白茶", "极简", "简约")):
        buckets.append("minimal_white")
    if any(k in title for k in ("有机", "原叶", "自然")):
        buckets.append("natural_organic")
    # unique keep order, max 3
    seen: list[str] = []
    for b in buckets:
        if b not in seen:
            seen.append(b)
    seen = seen[:3]

    struct: list[str] = ["format:retail_filled"]
    if "礼盒" in title or "gift" in t:
        struct.append("box_type:gift_box")
    info = ["ritual_gift"] if "礼盒" in title else ["product_first"]

    return {
        "id": _stable_id(platform, row, idx),
        "image_url": image,
        "page_url": page,
        "thumbnail_url": image or None,
        "source": platform,
        "source_type": "shelf",
        "title": title,
        "author_or_brand": _pick_brand(row),
        "category_domain_id": "tea_beverage",
        "category_label": "茶与即饮/新茶饮相关包装",
        "is_on_market": True,
        "market_region": ["CN"],
        "raw_tags": [x for x in [query, platform, "smoke"] if x],
        "suggested_style_buckets": seen,
        "structure_tags": struct,
        "info_hierarchy_tags": info,
        "color_roles": [],
        "structure_notes": None,
        "color_palette": None,
        "info_hierarchy": None,
        "analogy_from": None,
        "query_used": query,
        "collected_at": _now(),
        "license_or_rights_note": "Marketplace listing metadata; check platform ToS before reuse",
        "extra": {
            "collect_method": "apify_actor_smoke",
            "platform": platform,
            "smoke": True,
            "raw_price": row.get("price") or row.get("priceText") or row.get("originalPrice"),
            "apify_keys": sorted(row.keys())[:40],
        },
    }


def load_rows(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [r for r in raw if isinstance(r, dict)]
    if isinstance(raw, dict):
        for k in ("items", "data", "results"):
            if isinstance(raw.get(k), list):
                return [r for r in raw[k] if isinstance(r, dict)]
    raise SystemExit(f"Unrecognized dataset shape in {path}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--platform", choices=["jd", "taobao"], required=True)
    p.add_argument("--query", required=True)
    p.add_argument("--in", dest="in_path", required=True)
    p.add_argument("--out", dest="out_path", required=True)
    p.add_argument("--limit", type=int, default=3)
    args = p.parse_args()

    rows = load_rows(Path(args.in_path))[: max(0, args.limit)]
    out = Path(args.out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    items = [map_row(r, platform=args.platform, query=args.query, idx=i) for i, r in enumerate(rows)]
    with out.open("w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    print(json.dumps({"wrote": str(out), "count": len(items), "with_image": sum(1 for i in items if i["image_url"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
