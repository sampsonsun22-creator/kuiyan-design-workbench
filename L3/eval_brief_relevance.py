#!/usr/bin/env python3
"""Evaluate brief_relevance across multiple briefs on one image pool (read-only).

Metrics (silver-label heuristic until human gold arrives):
  - precision@main: among gated main_wall, share that are silver_positive
  - recall_silver: among silver_positive, share kept on main
  - false_kill_rate: 1 - recall_silver (mis-kill of silver positives)
  - main_wall_size / pending_size

Usage:
  python3 L3/eval_brief_relevance.py \
    --pool ui-shell/data/l2_main_wall.jsonl ui-shell/data/l2_pending_review.jsonl \
    --briefs L3/fixtures/brief_matrix_v1.json \
    --out L3/feeds/BRIEF-RELEVANCE-EVAL.json
"""
from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from brief_spec import BriefSpec, classify_with_spec, load_brief_fixtures, silver_positive


KEEP = {"keep_core", "keep_analogy"}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_pool(paths: list[Path]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for path in paths:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if not line.strip():
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            iid = o.get("id")
            if iid and iid not in by_id:
                by_id[iid] = o
    return list(by_id.values())


def eval_brief(pool: list[dict], spec: BriefSpec, sample_n: int = 40) -> dict[str, Any]:
    buckets = Counter()
    reasons = Counter()
    main_ids = []
    pending_ids = []
    silver_ids = []
    silver_kept = 0
    main_silver = 0

    for it in pool:
        bucket, reason = classify_with_spec(it, spec)
        buckets[bucket] += 1
        if reason:
            reasons[reason] += 1
        is_main = bucket in KEEP
        sil = silver_positive(it, spec)
        if sil:
            silver_ids.append(it["id"])
            if is_main:
                silver_kept += 1
        if is_main:
            main_ids.append(it["id"])
            if sil:
                main_silver += 1
        else:
            pending_ids.append(it["id"])

    main_n = len(main_ids)
    silver_n = len(silver_ids)
    precision = (main_silver / main_n) if main_n else 0.0
    recall = (silver_kept / silver_n) if silver_n else 0.0
    false_kill = 1.0 - recall if silver_n else 0.0

    rng = random.Random(hash(spec.brief_id) & 0xFFFFFFFF)
    sample_main = rng.sample(main_ids, min(sample_n, main_n)) if main_n else []
    # killed silver examples
    killed_silver = [i for i in silver_ids if i not in set(main_ids)]
    sample_kill = rng.sample(killed_silver, min(10, len(killed_silver))) if killed_silver else []

    return {
        "brief_id": spec.brief_id,
        "name": spec.name,
        "domain": spec.domain,
        "summary": spec.summary,
        "pool_size": len(pool),
        "main_wall": main_n,
        "pending_review": len(pending_ids),
        "buckets": dict(buckets),
        "reasons": dict(reasons),
        "silver_positive": silver_n,
        "precision_at_main": round(precision, 4),
        "recall_silver": round(recall, 4),
        "false_kill_rate": round(false_kill, 4),
        "sample_main_ids": sample_main[:20],
        "sample_false_kill_ids": sample_kill,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", type=Path, nargs="+", required=True)
    ap.add_argument("--briefs", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--sample-n", type=int, default=40)
    args = ap.parse_args()

    pool = load_pool(args.pool)
    specs = load_brief_fixtures(args.briefs)
    rows = [eval_brief(pool, s, sample_n=args.sample_n) for s in specs]

    # markdown table for quick read
    lines = [
        "| brief | domain | main | pending | precision@main | false_kill | silver |",
        "|---|---|---:|---:|---:|---:|---:|",
    ]
    for r in rows:
        lines.append(
            f"| {r['name']} | {r['domain']} | {r['main_wall']} | {r['pending_review']} | "
            f"{r['precision_at_main']:.2%} | {r['false_kill_rate']:.2%} | {r['silver_positive']} |"
        )

    report = {
        "generated_at": now(),
        "gate": "brief_relevance_v1_generic",
        "labeling": "silver=core|analogy terms + packaging cue (heuristic until human gold)",
        "pool_paths": [str(p) for p in args.pool],
        "pool_size": len(pool),
        "briefs_path": str(args.briefs),
        "shell_write": False,
        "results": rows,
        "table_md": "\n".join(lines),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path = args.out.with_suffix(".md")
    md_path.write_text(
        f"# Brief relevance eval\n\n{report['generated_at']}\n\npool={len(pool)}\n\n"
        + report["table_md"]
        + "\n",
        encoding="utf-8",
    )
    print(report["table_md"])
    print(f"\nWrote {args.out}")
    print(f"Wrote {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
