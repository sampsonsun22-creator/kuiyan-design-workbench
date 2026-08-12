#!/usr/bin/env python3
"""Build ui/data/demo-bundle.json from green-tea e2e demo paths."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo" / "e2e-green-tea-gift"
OUT = Path(__file__).resolve().parent / "data" / "demo-bundle.json"

L1 = DEMO / "L1-brief-intent.json"
L3 = DEMO / "L3-market-map.json"
L4_CARDS = [
    DEMO / "L4-card-cm-01-v2.json",
    DEMO / "L4-card-gm-02-v2.json",
    DEMO / "L4-card-cc-03-v2.json",
]
BUCKETS = ROOT / "L3" / "style-buckets-v1.json"
# KEY 视界壳默认 strict：主墙/待复核优先 ui-shell 严口径；禁止 platform wide 2864 覆盖。
JSONL_SOURCES = [
    ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl",
    ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl",
    DEMO / "l2-firecrawl.jsonl",
]


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_jsonl_index(paths):
    index = {}
    for path in paths:
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                item_id = obj.get("id")
                if not item_id:
                    continue
                index[item_id] = {
                    "id": item_id,
                    "title": obj.get("title"),
                    "source": obj.get("source"),
                    "image_url": obj.get("image_url") or obj.get("thumbnail_url"),
                    "thumbnail_url": obj.get("thumbnail_url"),
                    "page_url": obj.get("page_url"),
                    "author_or_brand": obj.get("author_or_brand"),
                    "suggested_style_buckets": obj.get("suggested_style_buckets") or [],
                    "analogy_from": obj.get("analogy_from"),
                    "source_type": obj.get("source_type"),
                    "market_region": obj.get("market_region") or [],
                    "structure_tags": obj.get("structure_tags") or [],
                    "qc_status": (
                        obj.get("qc_status")
                        or (obj.get("extra") or {}).get("qc_status")
                        or ("pending_review" if "pending" in path.name else "pass_main")
                    ),
                    "query_used": obj.get("query_used") or "",
                    "is_on_market": obj.get("is_on_market", "unknown"),
                    "extra": obj.get("extra") or {},
                }
    return index


def enrich_item(item: dict, catalog: dict) -> dict:
    out = dict(item)
    extra = catalog.get(out.get("id") or "", {})
    if not out.get("image_url") and extra.get("image_url"):
        out["image_url"] = extra["image_url"]
    if not out.get("thumbnail_url") and extra.get("thumbnail_url"):
        out["thumbnail_url"] = extra["thumbnail_url"]
    if not out.get("page_url") and extra.get("page_url"):
        out["page_url"] = extra["page_url"]
    if not out.get("title") and extra.get("title"):
        out["title"] = extra["title"]
    if not out.get("source") and extra.get("source"):
        out["source"] = extra["source"]
    if not out.get("author_or_brand") and extra.get("author_or_brand"):
        out["author_or_brand"] = extra["author_or_brand"]
    out["qc_status"] = out.get("qc_status") or extra.get("qc_status") or "pass_main"
    return out


def enrich_walls(walls: dict, catalog: dict) -> dict:
    walls = json.loads(json.dumps(walls))  # deep copy
    primary = walls.get("primary") or {}
    by_bucket = primary.get("by_bucket") or {}
    for bucket_name, items in by_bucket.items():
        by_bucket[bucket_name] = [enrich_item(it, catalog) for it in items]

    analogy = walls.get("analogy") or {}
    items = analogy.get("items") or []
    analogy["items"] = [enrich_item(it, catalog) for it in items]

    shelf = walls.get("shelf") or {}
    shelf_items = shelf.get("items") or []
    shelf["items"] = [enrich_item(it, catalog) for it in shelf_items]

    pending = walls.get("pending_review") or {}
    pend_items = pending.get("items") or []
    if pend_items:
        pending["items"] = [enrich_item(it, catalog) for it in pend_items]
        for it in pending["items"]:
            it["qc_status"] = "pending_review"
        walls["pending_review"] = pending

    walls["primary"] = primary
    walls["analogy"] = analogy
    walls["shelf"] = shelf
    return walls


def main():
    l1 = load_json(L1)
    l3 = load_json(L3)
    buckets_doc = load_json(BUCKETS)
    cards = [load_json(p) for p in L4_CARDS]
    catalog = load_jsonl_index(JSONL_SOURCES)

    bucket_list = [
        {
            "id": b["id"],
            "name_zh": b["name_zh"],
            "hou_speak": b.get("hou_speak"),
            "name_aliases": b.get("name_aliases") or [],
        }
        for b in buckets_doc.get("buckets") or []
    ]
    id_to_zh = {b["id"]: b["name_zh"] for b in bucket_list}
    zh_to_id = {b["name_zh"]: b["id"] for b in bucket_list}
    for b in bucket_list:
        for alias in b.get("name_aliases") or []:
            zh_to_id.setdefault(alias, b["id"])

    l3_enriched = dict(l3)
    l3_enriched["walls"] = enrich_walls(l3.get("walls") or {}, catalog)

    # Local demo refs for strategy cards (optional thumbnails)
    local_refs = {
        "card-cm-01-v2": "assets/ref1.png",
        "card-gm-02-v2": "assets/ref2.jpg",
        "card-cc-03-v2": "assets/ref3.png",
    }
    for card in cards:
        # enrich reference montage with image urls from catalog
        montage = []
        for ref in card.get("reference_montage") or []:
            r = dict(ref)
            cat = catalog.get(r.get("item_id") or "", {})
            r["title"] = cat.get("title")
            r["image_url"] = cat.get("image_url")
            r["page_url"] = cat.get("page_url")
            montage.append(r)
        card["reference_montage"] = montage
        card["local_ref_image"] = local_refs.get(card.get("card_id"))
        # resolve bucket names
        card["recommended_style_buckets_zh"] = [
            id_to_zh.get(bid, bid) for bid in (card.get("recommended_style_buckets") or [])
        ]

    bundle = {
        "meta": {
            "product": "奎燕设计智能体 · 工作台原型",
            "demo": "青绿茶礼盒 e2e",
            "brief_id": l1.get("brief_id"),
            "generated_from": [
                str(L1.relative_to(ROOT)),
                str(L3.relative_to(ROOT)),
                *[str(p.relative_to(ROOT)) for p in L4_CARDS],
                str(BUCKETS.relative_to(ROOT)),
            ],
            "footer": "Demo · 非完稿 · 数据来自青绿茶 e2e 真样",
            "item_catalog_size": len(catalog),
        },
        "l1": l1,
        "l3": l3_enriched,
        "l4_cards": cards,
        "buckets": bucket_list,
        "bucket_id_to_zh": id_to_zh,
        "bucket_zh_to_id": zh_to_id,
        "item_catalog": catalog,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"  L1 brief: {l1.get('brief_id')}")
    print(f"  L4 cards: {len(cards)}")
    print(f"  buckets: {len(bucket_list)}")
    print(f"  catalog items: {len(catalog)}")


if __name__ == "__main__":
    main()
    import subprocess, sys
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")])

