#!/usr/bin/env python3
"""Expand accurate tea main wall → L3/feeds/*brief_relevance_expanded*; thin briefs → landed.
NEVER writes ui-shell. NEVER overwrites brief-green-tea-gift with empty files.
Contract: main = shell 184 ∪ new keep; n>=184; never write 0-line main.
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("/workspace/kuiyan-design-workbench")
sys.path.insert(0, str(ROOT / "L3"))
from brief_spec import BriefSpec, classify_with_spec, load_brief_fixtures, PACK_RE
from brief_relevance_v1 import classify as tea_classify

def _firecrawl_key():
    return Path("/home/box/.config/firecrawl/api_key").read_text().strip()
KEY = None  # lazy; only load when collecting
# tea classifier returns pass_brief; brief_spec returns keep_*
KEEP = {"pass_brief", "keep_core", "keep_analogy"}
FEEDS = ROOT / "L3" / "feeds"
DIR = ROOT / "L2-collector" / "directed"
DIR.mkdir(parents=True, exist_ok=True)

TEA_Q = [
    "青绿茶礼盒包装设计",
    "tea gift box packaging design",
    "green tea gift packaging design",
    "中式现代茶礼包装",
    "chinese modern tea gift packaging",
    "国际简约茶包装设计",
    "minimal tea packaging design gift",
    "黄酒礼盒包装设计",
    "滋补礼盒包装设计",
    "茶叶铁罐包装设计",
    "matcha packaging design gift box",
    "tea packaging design site:behance.net",
    "tea gift box packaging site:packagingoftheworld.com",
    "绿茶礼盒包装设计 Behance",
    "tea tin gift packaging design",
    "龙井礼盒包装设计",
    "white tea gift box packaging",
    "tea packaging design site:zcool.com.cn",
    "tea gift packaging site:pinterest.com",
    "green tea packaging site:packagingoftheworld.com",
    "matcha packaging site:behance.net",
    "茶叶礼盒包装 site:zcool.com.cn",
    "tea tin packaging site:pinterest.com",
    "新中式茶叶包装礼盒",
]
THIN = {
    "brief-tissue-home": ["抽纸包装设计", "湿巾包装设计", "抽纸礼盒包装", "tissue packaging design", "wet wipe packaging design", "facial tissue packaging design"],
    "brief-dairy-gift": ["酸奶礼盒包装设计", "牛奶礼盒包装", "乳品礼盒包装设计", "dairy gift box packaging design", "yogurt packaging gift", "milk gift box packaging"],
    "brief-tonic-gift": ["阿胶礼盒包装设计", "人参礼盒包装", "滋补礼盒包装设计", "燕窝礼盒包装设计", "枸杞礼盒包装设计", "tonic gift box packaging design", "herbal tonic packaging gift"],
}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def api(path, body, timeout=90):
    delay = 2.0
    last = None
    for attempt in range(7):
        req = urllib.request.Request(
            f"https://api.firecrawl.dev{path}",
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {_firecrawl_key()}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            last = e
            # 402 = out of credits — do not retry; caller should lean on search-hit images / caches
            if e.code == 402:
                print(f"402 credits exhausted {path}; abort retries", flush=True)
                raise
            if e.code == 429 and attempt < 6:
                print(f"429 backoff {delay}s {path}", flush=True)
                time.sleep(delay)
                delay = min(delay * 2, 90)
                continue
            raise
        except Exception as e:
            last = e
            if attempt < 4:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
    raise last


def search(q, limit=10):
    return list(api("/v1/search", {"query": q, "limit": limit}).get("data") or [])


def scrape_image(url):
    try:
        data = api("/v1/scrape", {"url": url, "formats": ["markdown"], "onlyMainContent": True})
        meta = (data.get("data") or {}).get("metadata") or {}
        for k in ("ogImage", "og:image", "image", "twitter:image"):
            v = meta.get(k)
            if isinstance(v, str) and v.startswith("http") and "gd-hbimg-edge" not in v:
                return v
            if isinstance(v, list) and v and str(v[0]).startswith("http"):
                return str(v[0])
        md = (data.get("data") or {}).get("markdown") or ""
        m = re.search(r"!\[[^\]]*\]\((https?://[^)\s]+)\)", md)
        if m and "gd-hbimg-edge" not in m.group(1):
            return m.group(1)
    except Exception:
        return None
    return None


def source_of(url):
    host = urlparse(url).netloc.lower().replace("www.", "")
    for k, v in {
        "behance.net": "behance",
        "pinterest.com": "pinterest",
        "xiaohongshu.com": "xiaohongshu",
        "zcool.com.cn": "zcool",
        "huaban.com": "huaban",
        "packagingoftheworld.com": "packagingoftheworld",
    }.items():
        if k in host:
            return v
    return host.split(".")[0] or "web"


def to_l2(hit, query, brief_id, img):
    page = (hit.get("url") or "").strip()
    title = (hit.get("title") or "").strip()
    desc = (hit.get("description") or "").strip()
    if not page.startswith("http"):
        return None
    blob = f"{title} {desc} {query}"
    if not (PACK_RE.search(blob) or re.search(r"包装|礼盒|packag", blob, re.I)):
        return None
    if not img or not str(img).startswith("http") or "gd-hbimg-edge" in str(img):
        return None
    iid = f"directed:{brief_id}:{hashlib.sha1(page.encode()).hexdigest()[:12]}"
    return {
        "id": iid,
        "title": title or iid,
        "source": source_of(page),
        "source_type": "inspiration",
        "page_url": page,
        "image_url": str(img),
        "thumbnail_url": str(img),
        "query_used": query,
        "raw_tags": [brief_id, "directed_collect"],
        "suggested_style_buckets": [],
        "structure_tags": [],
        "info_hierarchy_tags": [],
        "color_roles": [],
        "is_on_market": "unknown",
        "market_region": ["global"],
        "author_or_brand": None,
        "collected_at": now(),
        "qc_status": "pass_main",
        "wall_status": "main_wall",
        "extra": {"collect_method": "firecrawl_search_directed", "brief_id": brief_id, "description": desc[:300]},
    }


def collect(brief_id, queries, max_items=40, scrape_budget=6):
    items, seen, scrapes = [], set(), 0
    for q in queries:
        try:
            hits = search(q, 10)
        except Exception as e:
            print("fail", q, e, flush=True)
            time.sleep(2)
            continue
        print(f"search {brief_id} | {q} -> {len(hits)}", flush=True)
        for h in hits:
            page = (h.get("url") or "").rstrip("/")
            if not page or page in seen:
                continue
            seen.add(page)
            # Prefer Firecrawl /v1/search hit images over /v1/scrape (scrape burns credits + 429s)
            img = h.get("image") or h.get("imageUrl") or h.get("ogImage") or h.get("og:image")
            if isinstance(img, list):
                img = img[0] if img else None
            if isinstance(img, dict):
                img = img.get("url") or img.get("src")
            meta = h.get("metadata") or {}
            if (not img or not str(img).startswith("http")):
                for k in ("ogImage", "og:image", "image", "twitter:image"):
                    v = meta.get(k)
                    if isinstance(v, str) and v.startswith("http"):
                        img = v
                        break
                    if isinstance(v, list) and v and str(v[0]).startswith("http"):
                        img = str(v[0])
                        break
            if (not img or not str(img).startswith("http")) and scrapes < scrape_budget:
                if re.search(r"packag|包装|礼盒|behance|zcool|pinterest|potw|huaban", page + (h.get("title") or ""), re.I):
                    img = scrape_image(page)
                    scrapes += 1
                    time.sleep(3.0)  # longer sleep between scrapes to ease 429
            row = to_l2(h, q, brief_id, img if isinstance(img, str) else None)
            if row:
                items.append(row)
            if len(items) >= max_items:
                break
        if len(items) >= max_items:
            break
        time.sleep(2.0)
    path = DIR / f"l2-{brief_id}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    print(f"collected {brief_id}={len(items)} scrapes={scrapes}", flush=True)
    return items


def load_jsonl(p: Path):
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def gate_tea(it):
    b, reason = tea_classify(it)
    out = dict(it)
    extra = dict(out.get("extra") or {})
    keep = b in KEEP and str(out.get("image_url") or "").startswith("http")
    # shell-compat label
    extra["brief_relevance_v1"] = ("keep_core" if b == "pass_brief" else b) if keep else b
    extra["brief_id"] = "brief-green-tea-gift"
    if keep:
        out["qc_status"] = "pass_main"
        out["wall_status"] = "main_wall"
        extra["review_status"] = "passed"
    else:
        out["qc_status"] = "pending_review"
        out["wall_status"] = "pending_review"
        extra["review_fail"] = reason or "brief_low_relevance"
        extra["review_status"] = "pending"
    out["extra"] = extra
    return out, keep


def gate_spec(it, spec: BriefSpec):
    b, reason = classify_with_spec(it, spec)
    if spec.brief_id == "brief-pet-food":
        blob = f"{it.get('title')} {it.get('query_used')}"
        animal = re.search(r"宠物|猫|狗|cat\s*food|dog\s*food|pet\s*food|猫粮|狗粮", blob or "", re.I)
        if b in KEEP and not animal:
            b, reason = "kill_noise", "brief_offtopic"
        if re.search(r"\bPET\b|聚酯|瓶坯", blob or "") and not animal:
            b, reason = "kill_noise", "brief_offtopic"
    out = dict(it)
    extra = dict(out.get("extra") or {})
    keep = b in KEEP and str(out.get("image_url") or "").startswith("http")
    extra["brief_relevance_v1"] = b
    extra["brief_id"] = spec.brief_id
    if keep:
        out["qc_status"] = "pass_main"
        out["wall_status"] = "main_wall"
        extra["review_status"] = "passed"
    else:
        out["qc_status"] = "pending_review"
        out["wall_status"] = "pending_review"
        extra["review_fail"] = reason or "brief_low_relevance"
        extra["review_status"] = "pending"
    out["extra"] = extra
    return out, keep


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for it in rows:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-collect", action="store_true", help="merge only; no Firecrawl")
    ap.add_argument("--publish", action="store_true", help="also write live *expanded.jsonl (never clean274)")
    args = ap.parse_args()

    print("expand start; will NOT write ui-shell", flush=True)
    if args.skip_collect:
        print("skip-collect: no Firecrawl", flush=True)
        tea_new = []
        thin_new = {k: [] for k in THIN}
    else:
        tea_new = collect("brief-green-tea-gift", TEA_Q, max_items=80, scrape_budget=8)
        thin_new = {}
        for bid, qs in THIN.items():
            thin_new[bid] = collect(bid, qs, max_items=35, scrape_budget=5)

    shell_main = load_jsonl(ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl")
    shell_pend = load_jsonl(ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl")
    assert len(shell_main) >= 184, len(shell_main)
    shell_ids = {it["id"] for it in shell_main}

    # AUTHORITY BASE: clean274 (design-washed). Never rebuild from raw pipeline→288.
    # Prefer current shell as floor; optionally seed from latest unlock/qc if larger
    clean_main_p = FEEDS / "l2_main_wall_brief_relevance_expanded_clean274.jsonl"
    unlock_main_p = FEEDS / "l2_main_wall_brief_relevance_expanded_unlock.jsonl"
    unlock_pend_p = FEEDS / "l2_pending_review_brief_relevance_expanded_unlock.jsonl"
    base_main = list(shell_main)
    base_pend = list(shell_pend)
    base_label = "shell"
    for cand_m, cand_p, label in [
        (unlock_main_p, unlock_pend_p, "unlock"),
        (FEEDS / "l2_main_wall_brief_relevance_expanded_v20260812T144351_qc.jsonl",
         FEEDS / "l2_pending_review_brief_relevance_expanded_v20260812T144351_qc.jsonl", "qc304"),
        (clean_main_p, FEEDS / "l2_pending_review_brief_relevance_expanded_clean274.jsonl", "clean274"),
    ]:
        if cand_m.exists():
            rows = load_jsonl(cand_m)
            if len(rows) >= len(base_main):
                base_main = rows
                if cand_p.exists():
                    base_pend = load_jsonl(cand_p)
                base_label = label
                break
    print(f"base={base_label} main={len(base_main)} pend={len(base_pend)} shell={len(shell_main)}", flush=True)

    # force-union current shell (authoritative floor)
    by_base = {it["id"]: dict(it) for it in base_main if it.get("id")}
    for it in shell_main:
        if it.get("id"):
            by_base[it["id"]] = dict(it)  # shell wins on conflict
    base_main = list(by_base.values())
    base_ids = {it["id"] for it in base_main if it.get("id")}
    main = [dict(it) for it in base_main]

    # Only NEW directed tea items (this run + directed files not already in base)
    candidates = {}
    for it in tea_new:
        if it.get("id") and it["id"] not in base_ids:
            candidates[it["id"]] = it
    for path in DIR.glob("l2-brief-green-tea-gift*.jsonl"):
        for it in load_jsonl(path):
            if it.get("id") and it["id"] not in base_ids:
                candidates[it["id"]] = it
    # Do NOT re-ingest l2-from-pipeline-all (that reintroduced dirty 288)

    # Light demote patterns (design wash)
    DEMOTE_RE = __import__("re").compile(
        r"kombucha|康普茶|阿胶|ejiao|即梦|jimeng|soda\s*/\s*beer|mockup\s*set|paper\s*box\s*mockup",
        __import__("re").I,
    )

    pend = [dict(it) for it in base_pend]
    pend_ids = {it.get("id") for it in pend}

    for it in candidates.values():
        g, keep = gate_tea(it)
        title = str(g.get("title") or "")
        if keep and DEMOTE_RE.search(title + " " + str(g.get("query_used") or "")):
            keep = False
            g["qc_status"] = "pending_review"
            g["wall_status"] = "pending_review"
            extra = dict(g.get("extra") or {})
            extra["review_fail"] = "light_clean_demote"
            g["extra"] = extra
        if keep:
            main.append(g)
            base_ids.add(g["id"])
        else:
            if g.get("id") not in pend_ids:
                pend.append(g)
                pend_ids.add(g.get("id"))

    shell_n = len(shell_main)
    if len(main) < shell_n:
        print(f"CONTRACT FAIL main={len(main)} < shell {shell_n}; refusing write (no overwrite)", flush=True)
        sys.exit(2)
    # ensure every shell id remains in main
    main_ids = {it.get("id") for it in main}
    missing = [i for i in shell_ids if i not in main_ids]
    if missing:
        print(f"CONTRACT FAIL missing {len(missing)} shell ids; refusing write", flush=True)
        sys.exit(2)

    # Versioned outputs — never clobber clean274; optional sync to expanded only with --publish
    ver = now().replace(":", "").replace("-", "")[:15]
    exp_main = FEEDS / f"l2_main_wall_brief_relevance_expanded_v{ver}.jsonl"
    exp_pend = FEEDS / f"l2_pending_review_brief_relevance_expanded_v{ver}.jsonl"
    write_jsonl(exp_main, main)
    write_jsonl(exp_pend, pend)
    print(f"EXPANDED tea main={len(main)} pending={len(pend)} -> {exp_main.name}", flush=True)
    if args.publish:
        live_m = FEEDS / "l2_main_wall_brief_relevance_expanded.jsonl"
        live_p = FEEDS / "l2_pending_review_brief_relevance_expanded.jsonl"
        if len(main) < shell_n:
            print("publish refused: main < shell", flush=True)
        elif live_m.exists() and not os.access(live_m, os.W_OK):
            print("live expanded not writable; left versioned only", flush=True)
        else:
            write_jsonl(live_m, main)
            write_jsonl(live_p, pend)
            print("published to *brief_relevance_expanded.jsonl", flush=True)

    specs = {s.brief_id: s for s in load_brief_fixtures(ROOT / "L3" / "fixtures" / "brief_matrix_v1.json")}
    pool = {it["id"]: it for it in shell_main + shell_pend if it.get("id")}
    for it in tea_new:
        if it.get("id"):
            pool[it["id"]] = it
    for rows in thin_new.values():
        for it in rows:
            if it.get("id"):
                pool[it["id"]] = it
    for p in DIR.glob("l2-*.jsonl"):
        for it in load_jsonl(p):
            if it.get("id"):
                pool[it["id"]] = it

    landed = ROOT / "L3" / "eval" / "landed"
    FORBIDDEN_LAND = {"brief-green-tea-gift", "green_tea_gift", "brief-green-tea-gift-20260812"}
    for bid in ["brief-tissue-home", "brief-dairy-gift", "brief-tonic-gift", "brief-pet-food"]:
        if bid in FORBIDDEN_LAND:
            continue

        spec = specs.get(bid)
        if not spec:
            print(f"SKIP land {bid}: no fixture", flush=True)
            continue
        m, p = [], []
        for it in pool.values():
            g, keep = gate_spec(it, spec)
            (m if keep else p).append(g)
        d = landed / bid
        d.mkdir(parents=True, exist_ok=True)
        if len(m) == 0:
            print(f"SKIP land {bid}: empty main, keep previous", flush=True)
            continue
        write_jsonl(d / "l2_main_wall.jsonl", m)
        write_jsonl(d / "l2_pending_review.jsonl", p)
        (d / "META.json").write_text(
            json.dumps(
                {
                    "brief_id": bid,
                    "main_wall": len(m),
                    "pending_review": len(p),
                    "directed_new": len(thin_new.get(bid, [])),
                    "updated_at": now(),
                    "shell_default": False,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"LAND {bid}: {len(m)}/{len(p)}", flush=True)

    # never touch brief-green-tea-gift / green_tea_gift landed here
    briefs = []
    for d in sorted(landed.iterdir()):
        if not d.is_dir():
            continue
        mp, pp = d / "l2_main_wall.jsonl", d / "l2_pending_review.jsonl"
        if not mp.exists():
            continue
        nm = sum(1 for l in mp.read_text().splitlines() if l.strip())
        np_ = sum(1 for l in pp.read_text().splitlines() if l.strip()) if pp.exists() else 0
        briefs.append(
            {
                "brief_id": d.name,
                "main_wall": nm,
                "pending_review": np_,
                "path": f"L3/eval/landed/{d.name}",
                "shell_default": d.name in ("brief-green-tea-gift", "green_tea_gift", "brief-green-tea-gift-20260812"),
            }
        )
    (landed / "INDEX.json").write_text(
        json.dumps({"generated_at": now(), "shell_default": "brief-green-tea-gift@184", "briefs": briefs}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    lines = ["# Landed INDEX (line-scanned)", "", f"> {now()}", "", "| brief_id | main | pending |", "|---|---:|---:|"]
    for b in briefs:
        lines.append(f"| {b['brief_id']} | {b['main_wall']} | {b['pending_review']} |")
    (landed / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    summary = {
        "generated_at": now(),
        "shell_untouched": True,
        "shell_main": shell_n,
        "expanded_main": len(main),
        "expanded_pending": len(pend),
        "contract_ok": len(main) >= 184,
        "tea_directed_new": len(tea_new),
        "thin_directed_new": {k: len(v) for k, v in thin_new.items()},
        "skip_collect": bool(args.skip_collect),
        "publish": bool(args.publish),
        "base": base_label,
        "expanded_paths": {"main": str(exp_main), "pending": str(exp_pend)},
    }
    (FEEDS / "BRIEF-RELEVANCE-EXPANDED-SUMMARY.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
