#!/usr/bin/env python3
"""Map design-pipeline normalized JSONL → L2 collection items (schema v1)."""
from __future__ import annotations
import json, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = json.loads((ROOT / "L3/style-buckets-v1.json").read_text())
MIG = dict(V1.get("migration_from_v0") or {})
IDS = set(V1["ids"])

SOURCE_TYPE = {
    "behance": "inspiration",
    "pinterest": "inspiration",
    "huaban": "inspiration",
    "xiaohongshu": "inspiration",
    "zcool": "inspiration",
    "packagingoftheworld": "inspiration",
}

def buckets_from_row(row):
    out = []
    for b in row.get("suggested_style_buckets") or []:
        if b in IDS:
            out.append(b)
        elif b in MIG:
            out.append(MIG[b])
    # leave empty for L3 if none — do not invent
    return out[:3]

def adapt(row: dict) -> dict:
    images = row.get("images") or []
    cover = None
    if images and isinstance(images[0], dict):
        cover = images[0].get("url")
    elif isinstance(images, list) and images:
        cover = images[0]
    author = row.get("author") or {}
    src = row.get("source") or "unknown"
    return {
        "id": row.get("id") or f"{src}:unknown",
        "image_url": cover or "",
        "page_url": row.get("url") or "",
        "thumbnail_url": None,
        "source": src,
        "source_type": SOURCE_TYPE.get(src, "inspiration"),
        "title": row.get("title") or "",
        "author_or_brand": author.get("name") if isinstance(author, dict) else row.get("author_or_brand"),
        "category_domain_id": row.get("category_domain_id"),
        "category_label": row.get("category_label"),
        "is_on_market": row.get("is_on_market", "unknown"),
        "market_region": row.get("market_region") or ["global"],
        "raw_tags": list(row.get("tags") or row.get("raw_tags") or row.get("theme") or []),
        "suggested_style_buckets": buckets_from_row(row),
        "structure_tags": list(row.get("structure_tags") or []),
        "info_hierarchy_tags": list(row.get("info_hierarchy_tags") or []),
        "color_roles": list(row.get("color_roles") or []),
        "analogy_from": row.get("analogy_from"),
        "query_used": row.get("query") or row.get("query_used") or "",
        "collected_at": row.get("collected_at") or datetime.now(timezone.utc).isoformat(),
        "license_or_rights_note": row.get("license_or_rights_note"),
        "extra": {"adapted_from": "design-pipeline", "theme": row.get("theme"), "is_promoted": row.get("is_promoted")},
    }

def main():
    inp = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else inp.with_suffix(".l2.jsonl")
    n = 0
    with inp.open() as fin, out.open("w") as fout:
        for line in fin:
            if not line.strip():
                continue
            fout.write(json.dumps(adapt(json.loads(line)), ensure_ascii=False) + "\n")
            n += 1
    print(json.dumps({"wrote": n, "out": str(out)}))

if __name__ == "__main__":
    main()
