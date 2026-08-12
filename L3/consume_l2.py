#!/usr/bin/env python3
"""L3 consumer: load L2 collection JSONL, normalize style bucket ids, group for market map."""
from __future__ import annotations
import json, sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = json.loads((ROOT / "L3/style-buckets-v1.json").read_text())
IDS = set(V1["ids"])
MIG = dict(V1.get("migration_from_v0") or {})
ID_TO_ZH = {b["id"]: b["name_zh"] for b in V1["buckets"]}

def normalize_bucket(b: str) -> str | None:
    if b in IDS:
        return b
    if b in MIG:
        return MIG[b]
    return None

def load_items(path: Path):
    items = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        o = json.loads(line)
        raw = o.get("suggested_style_buckets") or []
        norm = []
        for b in raw:
            nb = normalize_bucket(b)
            if nb and nb not in norm:
                norm.append(nb)
        o["suggested_style_buckets"] = norm
        o["suggested_style_buckets_zh"] = [ID_TO_ZH[i] for i in norm]
        items.append(o)
    return items

def group_by_bucket(items):
    g = defaultdict(list)
    for it in items:
        for b in it.get("suggested_style_buckets") or []:
            g[b].append(it["id"])
    return dict(g)

def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "L2-collector/samples/sample-run.jsonl")
    items = load_items(path)
    groups = group_by_bucket(items)
    print(json.dumps({
        "count": len(items),
        "with_image": sum(1 for i in items if i.get("image_url")),
        "bucket_groups": {ID_TO_ZH.get(k,k): len(v) for k,v in sorted(groups.items(), key=lambda x: -len(x[1]))},
        "bucket_groups_ids": {k: len(v) for k,v in sorted(groups.items(), key=lambda x: -len(x[1]))},
        "sample_ids": [i["id"] for i in items[:3]],
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
