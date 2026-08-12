#!/usr/bin/env python3
"""Validate KEY 视界 delivery shell baseline (brief_relevance live jsonl).

Hard gates: line counts, main unique ids, main required fields, assert_shell_strict.
Soft (reported, not failing): image http/non-edge rate, pending missing fields.
Does NOT write ui-shell/data/l2_*.jsonl.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = (ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl").resolve()
PEND = (ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl").resolve()
ASSERT = ROOT / "scripts" / "assert_shell_strict.py"
STATUS = ROOT / "ui-shell" / "data" / "FEED-STATUS.json"
REQUIRED = ("id", "image_url", "page_url", "source")
EDGE = "gd-hbimg-edge"


def expect_counts() -> tuple[int, int]:
    expect_main = int(os.environ.get("EXPECT_MAIN", "452"))
    expect_pend = int(os.environ.get("EXPECT_PEND", "2680"))
    argv = [a for a in sys.argv[1:] if not a.startswith("-")]
    # support: validate_delivery_shell.py [EXPECT_MAIN [EXPECT_PEND]]
    # also: --expect-main N --expect-pend N
    i = 1
    while i < len(sys.argv):
        a = sys.argv[i]
        if a in ("--expect-main", "--expect_main") and i + 1 < len(sys.argv):
            expect_main = int(sys.argv[i + 1])
            i += 2
            continue
        if a in ("--expect-pend", "--expect_pend") and i + 1 < len(sys.argv):
            expect_pend = int(sys.argv[i + 1])
            i += 2
            continue
        i += 1
    if len(argv) >= 1:
        expect_main = int(argv[0])
    if len(argv) >= 2:
        expect_pend = int(argv[1])
    return expect_main, expect_pend


def load_rows(path: Path) -> list[dict]:
    rows: list[dict] = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            rows.append(json.loads(line))
    return rows


def missing_req(rows: list[dict]) -> int:
    n = 0
    for r in rows:
        for k in REQUIRED:
            v = r.get(k)
            if v is None or (isinstance(v, str) and not v.strip()):
                n += 1
                break
    return n


def qc_mode_hint(first: dict | None) -> str | None:
    if STATUS.exists():
        try:
            st = json.loads(STATUS.read_text(encoding="utf-8"))
            if st.get("qc_mode"):
                return str(st["qc_mode"])
        except Exception:
            pass
    if not first:
        return None
    if first.get("qc_mode"):
        return str(first["qc_mode"])
    extra = first.get("extra")
    if isinstance(extra, dict):
        if extra.get("qc_mode"):
            return str(extra["qc_mode"])
        if extra.get("rule_version"):
            return str(extra["rule_version"])
        if "brief_relevance_v1" in extra:
            return "brief_relevance_v1"
    return None


def run_assert() -> dict:
    if not ASSERT.exists():
        return {"ok": False, "error": f"missing {ASSERT}"}
    cp = subprocess.run(
        [sys.executable, str(ASSERT)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=60,
    )
    return {
        "ok": cp.returncode == 0,
        "returncode": cp.returncode,
        "stdout": (cp.stdout or "").strip(),
        "stderr": (cp.stderr or "").strip(),
    }


def main() -> int:
    expect_main, expect_pend = expect_counts()
    main_rows = load_rows(MAIN)
    pend_rows = load_rows(PEND)

    ids = [r.get("id") for r in main_rows]
    uniq = len({i for i in ids if i is not None and i != ""})
    dupes = sorted({str(i) for i in ids if ids.count(i) > 1 and i is not None and i != ""})

    http_ok = sum(
        1
        for r in main_rows
        if str(r.get("image_url") or "").startswith("http")
        and EDGE not in str(r.get("image_url") or "")
    )
    edge = sum(1 for r in main_rows if EDGE in str(r.get("image_url") or ""))
    rate = round(http_ok / len(main_rows), 6) if main_rows else 0.0

    assert_out = run_assert()
    miss_main = missing_req(main_rows)
    miss_pend = missing_req(pend_rows)

    counts_ok = len(main_rows) == expect_main and len(pend_rows) == expect_pend
    unique_ok = len(dupes) == 0 and len(main_rows) > 0 and uniq == len(main_rows)
    required_main_ok = miss_main == 0
    hard_ok = counts_ok and unique_ok and required_main_ok and bool(assert_out.get("ok"))

    out = {
        "ok": hard_ok,
        "paths": {"main": str(MAIN), "pending": str(PEND)},
        "counts": {
            "main": len(main_rows),
            "pending": len(pend_rows),
            "expect_main": expect_main,
            "expect_pend": expect_pend,
        },
        "unique_ids_main": uniq,
        "duplicate_ids": dupes,
        "missing_required": {"main": miss_main, "pending": miss_pend},
        "image_http_ok_main": http_ok,
        "image_edge_main": edge,
        "image_http_rate_main": rate,
        "qc_mode_hint": qc_mode_hint(main_rows[0] if main_rows else None),
        "assert_shell_strict": {
            "ok": assert_out.get("ok"),
            "returncode": assert_out.get("returncode"),
            "stdout": assert_out.get("stdout"),
        },
        "checks": {
            "counts_ok": counts_ok,
            "unique_ids_main_ok": unique_ok,
            "required_fields_main_ok": required_main_ok,
            "assert_shell_strict_ok": bool(assert_out.get("ok")),
            "image_rate_is_soft": True,
        },
        "notes": [
            "Delivery baseline = LIVE shell 452/2680.",
            "image_http_rate / pending missing_required reported; soft (do not fail hard gate).",
            "Do not write ui-shell/data/l2_*.jsonl from this script.",
        ],
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if hard_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
