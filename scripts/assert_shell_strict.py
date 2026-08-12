#!/usr/bin/env python3
"""ONLY brief_relevance_v1 unlock452 (~452/~2680). NEVER accept 410 rollback."""
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ui-shell" / "data"
MAIN = DATA / "l2_main_wall.jsonl"
PEND = DATA / "l2_pending_review.jsonl"
STATUS = DATA / "FEED-STATUS.json"
LOCK = DATA / "SHELL-DEFAULT.lock.md"
DATED = DATA / "l2_main_wall_20260812.jsonl"
EXPECTED_MAIN, EXPECTED_PEND, TOL = 452, 2680, 15
FORBIDDEN_MAIN = {0, 173, 184, 246, 274, 288, 304, 401, 410, 1820, 1868, 2864, 2935}


def nlines(p: Path) -> int:
    return -1 if not p.exists() else sum(1 for l in p.open() if l.strip())


def main() -> int:
    n, p = nlines(MAIN), nlines(PEND)
    st = json.loads(STATUS.read_text()) if STATUS.exists() else {}
    err = []
    if n in FORBIDDEN_MAIN or st.get("main_wall") in FORBIDDEN_MAIN:
        err.append(f"REFUSE forbidden caliber n={n} status_main={st.get('main_wall')}")
    if n < 440:
        err.append(f"main_wall={n} below unlock452 floor (≥440)")
    if abs(n - EXPECTED_MAIN) > TOL:
        err.append(f"main_wall={n} expected ~{EXPECTED_MAIN}")
    if abs(p - EXPECTED_PEND) > TOL:
        err.append(f"pending={p} expected ~{EXPECTED_PEND}")
    if st.get("shell_default") != "strict":
        err.append(f"shell_default={st.get('shell_default')!r}")
    if "brief_relevance" not in str(st.get("qc_mode") or ""):
        err.append(f"qc_mode={st.get('qc_mode')!r}")
    lock_txt = LOCK.read_text() if LOCK.exists() else ""
    if "452" not in lock_txt or "brief_relevance" not in lock_txt:
        err.append("lock missing brief_relevance/452")
    if "410" in lock_txt and "FORBIDDEN" not in lock_txt:
        err.append("lock mentions 410 without FORBIDDEN")
    dn = nlines(DATED)
    if dn not in (-1, n) and dn in FORBIDDEN_MAIN:
        err.append(f"dated mirror stale/forbidden dn={dn} (must match shell {n})")
    if dn != -1 and abs(dn - n) > 0:
        err.append(f"dated mirror drift dn={dn} shell={n}")
    if list(DATA.glob("*wide*")):
        err.append("wide files present")
    # writable feeds are a risk after rollback incidents
    if MAIN.exists() and (MAIN.stat().st_mode & 0o222):
        err.append("main feed is writable; expect a-w")
    if err:
        print("ASSERT_SHELL_STRICT FAIL:")
        [print(" -", e) for e in err]
        return 1
    print(json.dumps({"ok": True, "shell_main_wall": n, "pending": p, "qc_mode": st.get("qc_mode"), "dated": dn}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
