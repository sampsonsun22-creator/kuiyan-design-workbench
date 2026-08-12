#!/usr/bin/env python3
"""Brief relevance reclassification v1 — 青绿茶礼盒 brief (accuracy > volume).

Scores each item from title / query_used / raw_tags / category_label into:
  pass_brief            — tea + (packaging|gift) OR explicit analogs with packaging
  pending_low_relevance — generic packaging only (no tea / allowed analogy)
  pending_offtopic      — visual hammer / VI / coffee / pet / etc. without tea

Proposal only: does NOT write locked ui-shell feeds.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

BRIEF_ID = "brief-green-tea-gift-20260812"
BRIEF_SUMMARY = (
    "新品牌青绿茶礼盒包装；礼赠+电商；中式现代；"
    "类比允许：茶礼、黄酒礼盒、滋补礼盒、国际简约茶包装"
)

# English tea uses word boundary to avoid false hits inside unrelated tokens.
TEA_RE = re.compile(
    r"(?:茶|绿茶|青茶|红茶|白茶|乌龙|普洱|龙井|碧螺春|铁观音|茉莉花茶|"
    r"matcha|green\s*tea|oolong|pu[-\s]?erh|camellia\s*sinensis|"
    r"\btea\b|chá|cha\s*pack)",
    re.I,
)
PACK_OR_GIFT_RE = re.compile(
    r"包装|礼盒|packag|gift\s*box|giftbox|tea\s*box|tea\s*tin|"
    r"盒装|罐装|\btin\b|carton|礼袋|开箱|package\s*design|"
    r"礼赠|tea\s*gift|pouch|sachet|袋泡",
    re.I,
)
ANALOG_RE = re.compile(
    r"黄酒|滋补礼|阿胶礼|阿胶|人参礼|保健礼盒|酒礼盒|sake\b|huangjiu|"
    r"tonic\s*gift|herbal\s*gift|wine\s*gift\s*box|"
    r"国际简约.*茶|简约.*茶.*包装|minimal\s*tea|"
    r"养生滋补.*包装|新中式养生滋补",
    re.I,
)
OFFTOPIC_RE = re.compile(
    r"咖啡|coffee|latte|espresso|宠物|狗粮|猫粮|母婴|尿不湿|"
    r"视觉锤|visual\s*hammer|语言钉|laura\s*ries|"
    r"\bVI\b|视觉识别系统|logo\s*设计教程|"
    r"美妆|口红|skincare|cosmetic|蛋白粉|维生素|"
    r"claw\s*hammer|sledge|hammer\s*vector|榔头",
    re.I,
)
SOFT_PACK_RE = re.compile(
    r"包装|packag|礼盒|gift\s*box|giftbox|branding|盒|瓶贴|label\s*design|"
    r"package\s*design|product\s*packaging",
    re.I,
)
VH_QUERY_RE = re.compile(r"视觉锤|visual\s*hammer|品牌视觉锤|laura\s*ries", re.I)


def _blob(item: dict) -> str:
    tags = item.get("raw_tags") or []
    if not isinstance(tags, list):
        tags = [str(tags)]
    return " ".join(
        [
            str(item.get("title") or ""),
            str(item.get("query_used") or ""),
            " ".join(str(t) for t in tags),
            str(item.get("category_label") or ""),
        ]
    )


def score_brief_relevance(item: dict) -> str:
    """Return pass_brief | pending_low_relevance | pending_offtopic."""
    blob = _blob(item)
    title = str(item.get("title") or "")
    query = str(item.get("query_used") or "")

    has_tea = bool(TEA_RE.search(blob))
    has_pack = bool(PACK_OR_GIFT_RE.search(blob))
    has_analog = bool(ANALOG_RE.search(blob))
    is_off = bool(OFFTOPIC_RE.search(blob))
    soft_pack = bool(SOFT_PACK_RE.search(blob))
    vh_query = bool(VH_QUERY_RE.search(query))

    # Explicit tea packaging in title can rescue a noisy query.
    title_tea_pack = bool(TEA_RE.search(title) and PACK_OR_GIFT_RE.search(title))

    if vh_query and not title_tea_pack and not (has_tea and has_pack):
        return "pending_offtopic"

    if is_off and not (has_tea and has_pack) and not (has_analog and has_pack):
        return "pending_offtopic"

    if has_tea and has_pack:
        return "pass_brief"

    if has_analog and has_pack:
        return "pass_brief"

    # Tea query + pack cue in query alone (title thin) still counts.
    if has_tea and re.search(r"礼盒|gift|包装|packag", query, re.I):
        return "pass_brief"

    if soft_pack or has_pack:
        return "pending_low_relevance"

    return "pending_offtopic"


# Alias used by cross_review.py --brief-relevance
def classify(item: dict) -> tuple[str, str | None]:
    bucket = score_brief_relevance(item)
    if bucket == "pass_brief":
        return bucket, None
    if bucket == "pending_low_relevance":
        return bucket, "brief_low_relevance"
    return bucket, "brief_offtopic"


def apply_gate(item: dict) -> dict:
    """Demote non-pass_brief items to pending_review; never invent new fields on lock files."""
    out = dict(item)
    bucket, reason = classify(out)
    extra = dict(out.get("extra") or {})
    extra["brief_relevance_v1"] = bucket
    extra["brief_id"] = BRIEF_ID
    out["extra"] = extra
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
        # Do not upgrade prior image-gate pending into main.
        if out.get("qc_status") == "pending_review" or out.get("wall_status") == "pending_review":
            pass
        else:
            out["qc_status"] = "pass_main"
            out["wall_status"] = "main_wall"
            extra["review_status"] = "passed"
    out["extra"] = extra
    return out


def _load_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def build_proposal(main_path: Path, pend_path: Path) -> dict[str, Any]:
    """pass_brief from current main only; do not promote pending (accuracy first)."""
    main_rows = _load_jsonl(main_path)
    pend_rows = _load_jsonl(pend_path)

    keep: list[dict] = []
    demoted: list[dict] = []
    bucket_main = Counter()
    bucket_pend = Counter()
    samples = {
        "pass_brief": [],
        "pending_low_relevance": [],
        "pending_offtopic": [],
    }

    for it in main_rows:
        gated = apply_gate(it)
        b = gated["extra"]["brief_relevance_v1"]
        bucket_main[b] += 1
        if len(samples[b]) < 6:
            samples[b].append(
                {
                    "id": gated.get("id"),
                    "title": (gated.get("title") or "")[:100],
                    "query_used": gated.get("query_used"),
                }
            )
        if b == "pass_brief" and gated.get("wall_status") == "main_wall":
            keep.append(gated)
        else:
            # force pending annotation for demoted
            gated["wall_status"] = "pending_review"
            gated["qc_status"] = "pending_review"
            demoted.append(gated)

    pending_out: list[dict] = []
    seen = set()
    # old pending first (annotated), then demoted from main
    for it in pend_rows:
        gated = apply_gate(it)
        # never promote pending → main
        gated["wall_status"] = "pending_review"
        gated["qc_status"] = "pending_review"
        b = gated["extra"]["brief_relevance_v1"]
        bucket_pend[b] += 1
        iid = gated.get("id")
        if iid and iid not in seen:
            seen.add(iid)
            pending_out.append(gated)
    for it in demoted:
        iid = it.get("id")
        if iid and iid not in seen:
            seen.add(iid)
            pending_out.append(it)
        elif not iid:
            pending_out.append(it)

    return {
        "kept": keep,
        "pending": pending_out,
        "bucket_main": dict(bucket_main),
        "bucket_pend": dict(bucket_pend),
        "samples": samples,
        "shell_before": {"main_wall": len(main_rows), "pending_review": len(pend_rows)},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--main",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "ui-shell"
        / "data"
        / "l2_main_wall.jsonl",
    )
    ap.add_argument(
        "--pending",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "ui-shell"
        / "data"
        / "l2_pending_review.jsonl",
    )
    ap.add_argument(
        "--out-main",
        type=Path,
        default=Path(__file__).resolve().parent
        / "feeds"
        / "l2_main_wall_proposed_brief_v1.jsonl",
    )
    ap.add_argument(
        "--out-pending",
        type=Path,
        default=Path(__file__).resolve().parent
        / "feeds"
        / "l2_pending_review_proposed_brief_v1.jsonl",
    )
    ap.add_argument(
        "--summary",
        type=Path,
        default=Path(__file__).resolve().parent / "feeds" / "BRIEF-RELEVANCE-PROPOSAL.json",
    )
    args = ap.parse_args()

    res = build_proposal(args.main, args.pending)
    _write_jsonl(args.out_main, res["kept"])
    _write_jsonl(args.out_pending, res["pending"])

    summary = {
        "brief_id": BRIEF_ID,
        "brief": BRIEF_SUMMARY,
        "gate": "brief_relevance_v1",
        "rules": {
            "pass_brief": "tea + (packaging|gift) OR explicit analogs (黄酒/滋补/阿胶礼盒等) with packaging",
            "pending_low_relevance": "generic packaging only (no tea / allowed analogy)",
            "pending_offtopic": "visual hammer / VI / coffee / pet / cosmetics / tool-hammer without tea",
            "promote_from_pending": False,
            "accuracy_over_volume": True,
        },
        "shell_before": res["shell_before"],
        "layer_on_current_main": res["bucket_main"],
        "layer_on_current_pending": res["bucket_pend"],
        "proposal_after": {
            "main_wall_pass_brief": len(res["kept"]),
            "pending_review": len(res["pending"]),
            "demoted_from_main": res["shell_before"]["main_wall"] - len(res["kept"]),
        },
        "counts": {
            "pass_brief": len(res["kept"]),
            "pending_proposed": len(res["pending"]),
            "pending_low_relevance_on_main": res["bucket_main"].get(
                "pending_low_relevance", 0
            ),
            "pending_offtopic_on_main": res["bucket_main"].get("pending_offtopic", 0),
        },
        "samples": res["samples"],
        "outputs": {
            "main": str(args.out_main),
            "pending": str(args.out_pending),
            "summary": str(args.summary),
        },
        "shell_write": False,
        "do_not_touch_until_unlock": True,
        "note": "Proposal only — locked ui-shell jsonl untouched; shell may client-filter via「只看贴 brief」",
    }
    args.summary.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
