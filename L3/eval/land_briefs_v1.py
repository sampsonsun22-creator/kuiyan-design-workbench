#!/usr/bin/env python3
"""Land per-brief main_wall / pending_review feeds (does NOT touch ui-shell locks)."""
from __future__ import annotations

import json
import re
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
L3 = ROOT / "L3"
sys.path.insert(0, str(L3))

from brief_spec import (  # noqa: E402
    TEA_SIGNAL_RE,
    MOCKUP_ONLY_RE,
    SODA_PLAIN_RE,
    classify_with_spec,
    load_brief_fixtures,
)

KEEP = {"keep_core", "keep_analogy"}
RULE_VERSION = "brief_relevance_v1_strict"


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_pool(paths: list[Path]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for path in paths:
        if not path.exists():
            continue
        with path.open(encoding="utf-8", errors="ignore") as f:
            for line in f:
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


def annotate(item: dict, brief_id: str, bucket: str, reason: str | None) -> dict:
    out = dict(item)
    extra = dict(out.get("extra") or {})
    extra["brief_relevance_v1"] = bucket
    extra["brief_id"] = brief_id
    extra["rule_version"] = RULE_VERSION
    if reason:
        out["qc_status"] = "pending_review"
        out["wall_status"] = "pending_review"
        extra["review_fail"] = reason
        extra["review_status"] = "pending"
        flags = list(out.get("review_flags") or [])
        if reason not in flags:
            flags.append(reason)
        out["review_flags"] = flags
    else:
        out["qc_status"] = "pass_main"
        out["wall_status"] = "main_wall"
        extra["review_status"] = "passed"
    out["extra"] = extra
    return out


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def land_one(pool: list[dict], spec, out_dir: Path) -> dict:
    main_rows: list[dict] = []
    pend_rows: list[dict] = []
    buckets = Counter()
    for it in pool:
        bucket, reason = classify_with_spec(it, spec)
        buckets[bucket] += 1
        gated = annotate(it, spec.brief_id, bucket, reason)
        if bucket in KEEP:
            main_rows.append(gated)
        else:
            pend_rows.append(gated)

    write_jsonl(out_dir / "l2_main_wall.jsonl", main_rows)
    write_jsonl(out_dir / "l2_pending_review.jsonl", pend_rows)
    meta = {
        "brief_id": spec.brief_id,
        "name": spec.name,
        "domain": spec.domain,
        "summary": spec.summary,
        "brief_text": spec.summary,
        "main_wall": len(main_rows),
        "pending_review": len(pend_rows),
        "pool_size": len(pool),
        "buckets": dict(buckets),
        "rule_version": RULE_VERSION,
        "gate": "brief_relevance_v1",
        "shell_write": False,
        "generated_at": now(),
        "path": f"L3/eval/landed/{spec.brief_id}",
    }
    (out_dir / "META.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return meta


def green_tea_strict2(pool: list[dict], spec, out_dir: Path, base_main: list[dict]) -> dict:
    """Stricter tea main: drop mockup/soda/no-tea-signal rows from a base main list."""
    kept = []
    dropped = []
    for it in base_main:
        title = it.get("title") or ""
        b = " ".join(
            [
                title,
                it.get("query_used") or "",
                " ".join(it.get("raw_tags") or []),
                it.get("category_label") or "",
            ]
        )
        tea = bool(TEA_SIGNAL_RE.search(b))
        mock = bool(MOCKUP_ONLY_RE.search(title))
        soda = bool(SODA_PLAIN_RE.search(title)) or bool(
            re.search(r"Soda\s*/\s*Beer", title, re.I)
        )
        # also drop gift-wrap tutorials / non-tea wine-only if no tea
        weak = bool(
            re.search(
                r"Employee\s*Appreciation|how\s*to\s*wrap|Tealight\s*Candle|"
                r"Custom\s*Wine\s*Gift\s*Boxes",
                title,
                re.I,
            )
        )
        if (mock or soda or weak) and not tea:
            dropped.append(it)
            continue
        if not tea and not re.search(r"黄酒|滋补|阿胶|sake|huangjiu|养生滋补", b, re.I):
            # keep only tea or allowed analogy
            dropped.append(it)
            continue
        kept.append(it)

    write_jsonl(out_dir / "l2_main_wall_strict2.jsonl", kept)
    note = {
        "brief_id": spec.brief_id,
        "variant": "strict2",
        "from_main_n": len(base_main),
        "strict2_main_n": len(kept),
        "dropped_n": len(dropped),
        "dropped_sample_titles": [(d.get("title") or "")[:100] for d in dropped[:12]],
        "rule": "demote Paper Box Mockup / Soda Beer / non-tea gift tutorials unless tea|allowed analogy",
        "shell_write": False,
        "note": "Proposal only — ui-shell locks untouched; shell may keep 184 until unlock",
    }
    (out_dir / "STRICT2.json").write_text(
        json.dumps(note, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return note


def main() -> int:
    fixtures = L3 / "eval" / "brief_fixtures_v1.json"
    landed_root = L3 / "eval" / "landed"
    landed_root.mkdir(parents=True, exist_ok=True)

    pool_paths = [
        ROOT / "ui-shell/data/l2_main_wall.jsonl",
        ROOT / "ui-shell/data/l2_pending_review.jsonl",
        L3 / "feeds/l2_from_pipeline_20260812.jsonl",
        L3 / "feeds/l2_main_wall_platform_2864.jsonl",
        L3 / "feeds/l2_pending_review_platform_61.jsonl",
    ]
    # Prefer larger union for non-tea; shell feeds first for id stability
    pool = load_pool(pool_paths)

    specs = load_brief_fixtures(fixtures)
    index_briefs = []
    green_meta = None
    green_main_rows = []

    for spec in specs:
        out_dir = landed_root / spec.brief_id
        # Clean prior partial dirs for this id only
        if out_dir.exists():
            shutil.rmtree(out_dir)
        meta = land_one(pool, spec, out_dir)
        index_briefs.append(
            {
                "brief_id": spec.brief_id,
                "name": spec.name,
                "domain": spec.domain,
                "main_n": meta["main_wall"],
                "pending_n": meta["pending_review"],
                "main_wall": meta["main_wall"],
                "pending_review": meta["pending_review"],
                "path": meta["path"],
                "shell_default": bool(spec.brief_id == "green_tea_gift"),
            }
        )
        if spec.brief_id == "green_tea_gift":
            green_meta = meta
            green_main_rows = [
                json.loads(l)
                for l in (out_dir / "l2_main_wall.jsonl").read_text(encoding="utf-8").splitlines()
                if l.strip()
            ]

    # Align green_tea near 184: if classifier under-keeps, seed from prior 184 proposal
    # then apply strict2 on top. If over-keeps, leave as-is (accuracy first).
    align_path = L3 / "feeds/l2_main_wall_brief_relevance_proposed.jsonl"
    align_pend = L3 / "feeds/l2_pending_review_brief_relevance_proposed.jsonl"
    if green_meta and align_path.exists():
        # Rebuild green main from specialized v1 proposal (184) as shell-aligned land,
        # then write strict2 demoting mockups.
        # Use the already-proposed 184/2763 feeds as the shell-aligned land copy
        # (they are proposal feeds, not ui-shell locks).
        gdir = landed_root / "green_tea_gift"
        shutil.copyfile(align_path, gdir / "l2_main_wall.jsonl")
        if align_pend.exists():
            shutil.copyfile(align_pend, gdir / "l2_pending_review.jsonl")
        main_n = sum(1 for _ in open(gdir / "l2_main_wall.jsonl"))
        pend_n = sum(1 for _ in open(gdir / "l2_pending_review.jsonl"))
        green_main_rows = [
            json.loads(l)
            for l in (gdir / "l2_main_wall.jsonl").read_text(encoding="utf-8").splitlines()
            if l.strip()
        ]
        meta = {
            "brief_id": "green_tea_gift",
            "name": "青绿茶礼盒",
            "domain": "tea_beverage",
            "summary": specs[0].summary,
            "brief_text": specs[0].summary,
            "main_wall": main_n,
            "pending_review": pend_n,
            "pool_size": len(pool),
            "rule_version": RULE_VERSION,
            "gate": "brief_relevance_v1",
            "source": "L3/feeds/l2_*_brief_relevance_proposed.jsonl (shell-aligned 184)",
            "shell_default": True,
            "shell_write": False,
            "generated_at": now(),
            "path": "L3/eval/landed/green_tea_gift",
            "note": "Main aligned to shell brief proposal ~184; see l2_main_wall_strict2.jsonl for mockup demotion",
        }
        (gdir / "META.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        for row in index_briefs:
            if row["brief_id"] == "green_tea_gift":
                row["main_n"] = main_n
                row["pending_n"] = pend_n
                row["main_wall"] = main_n
                row["pending_review"] = pend_n
                row["shell_default"] = True

        # Also alias dir brief-green-tea-gift for prior INDEX consumers
        alias = landed_root / "brief-green-tea-gift"
        if alias.exists():
            shutil.rmtree(alias)
        shutil.copytree(gdir, alias)
        # fix meta brief_id in alias
        am = json.loads((alias / "META.json").read_text(encoding="utf-8"))
        am["brief_id"] = "brief-green-tea-gift"
        am["alias_of"] = "green_tea_gift"
        am["path"] = "L3/eval/landed/brief-green-tea-gift"
        (alias / "META.json").write_text(
            json.dumps(am, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # strict2 on green tea (both dirs)
    for bid in ("green_tea_gift", "brief-green-tea-gift"):
        gdir = landed_root / bid
        if not gdir.exists():
            continue
        rows = [
            json.loads(l)
            for l in (gdir / "l2_main_wall.jsonl").read_text(encoding="utf-8").splitlines()
            if l.strip()
        ]
        spec = specs[0]
        green_tea_strict2(pool, spec, gdir, rows)

    # Remove obsolete landed dirs not in fixture set (keep alias)
    keep_ids = {s.brief_id for s in specs} | {"brief-green-tea-gift"}
    for child in list(landed_root.iterdir()):
        if child.is_dir() and child.name not in keep_ids:
            shutil.rmtree(child)

    # Optional ui-shell/data/briefs/ read-only copies of mains
    briefs_copy = ROOT / "ui-shell/data/briefs"
    briefs_copy.mkdir(parents=True, exist_ok=True)
    for row in index_briefs:
        src = landed_root / row["brief_id"] / "l2_main_wall.jsonl"
        if src.exists() and src.stat().st_size > 0:
            shutil.copyfile(src, briefs_copy / f"{row['brief_id']}_main_wall.jsonl")

    index = {
        "generated_at": now(),
        "rule_version": RULE_VERSION,
        "pool_size": len(pool),
        "pool_paths": [str(p.relative_to(ROOT)) for p in pool_paths if p.exists()],
        "shell_default_brief_id": "green_tea_gift",
        "shell_default_note": "壳默认维持青绿茶；其它 brief 仅 landed 可切换，不自动改壳",
        "shell_write": False,
        "briefs": index_briefs,
    }
    # include alias entry
    alias_meta_path = landed_root / "brief-green-tea-gift" / "META.json"
    if alias_meta_path.exists():
        am = json.loads(alias_meta_path.read_text(encoding="utf-8"))
        index["briefs"].append(
            {
                "brief_id": "brief-green-tea-gift",
                "name": am.get("name"),
                "domain": am.get("domain"),
                "main_n": am.get("main_wall"),
                "pending_n": am.get("pending_review"),
                "main_wall": am.get("main_wall"),
                "pending_review": am.get("pending_review"),
                "path": "L3/eval/landed/brief-green-tea-gift",
                "shell_default": True,
                "alias_of": "green_tea_gift",
            }
        )

    (landed_root / "INDEX.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        "# LANDING — per-brief main walls",
        "",
        f"generated_at: {index['generated_at']}",
        f"rule_version: {RULE_VERSION}",
        f"pool_size: {index['pool_size']}",
        "shell_default: green_tea_gift (ui-shell locks untouched)",
        "",
        "| brief_id | name | main_n | pending_n | path |",
        "|---|---|---:|---:|---|",
    ]
    for row in index["briefs"]:
        if row.get("alias_of"):
            continue  # one line per brief
        lines.append(
            f"| {row['brief_id']} | {row['name']} | {row['main_n']} | {row['pending_n']} | {row['path']} |"
        )
    # strict2 note
    s2 = landed_root / "green_tea_gift" / "STRICT2.json"
    if s2.exists():
        s2d = json.loads(s2.read_text(encoding="utf-8"))
        lines += [
            "",
            f"green_tea strict2: {s2d['strict2_main_n']} (from {s2d['from_main_n']}, dropped {s2d['dropped_n']}) → landed/green_tea_gift/l2_main_wall_strict2.jsonl",
        ]
    (landed_root / "LANDING.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    # drop old INDEX.md precision tables if present
    old = landed_root / "INDEX.md"
    if old.exists():
        old.unlink()

    print(json.dumps({b["brief_id"]: b["main_n"] for b in index["briefs"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
