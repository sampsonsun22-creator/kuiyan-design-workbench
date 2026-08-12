#!/usr/bin/env python3
"""Accuracy-first directed expand → proposal + landed. NEVER writes ui-shell locks."""
from __future__ import annotations
import hashlib, json, os, re, sys, time, urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("/workspace/kuiyan-design-workbench")
sys.path.insert(0, str(ROOT / "L3"))
from brief_spec import BriefSpec, classify_with_spec, load_brief_fixtures, PACK_RE
from brief_relevance_v1 import classify as tea_classify

KEY = Path("/home/box/.config/firecrawl/api_key").read_text().strip()
OUT = ROOT / "L2-collector" / "directed"
RAW = OUT / "raw"
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)
KEEP = {"keep_core", "keep_analogy"}
BLOCKED_Q = re.compile(r"^(视觉锤|品牌视觉锤|visual\s*hammer)", re.I)

QUERIES = {
    "brief-green-tea-gift": [
        "青绿茶礼盒包装设计",
        "绿茶 礼盒 包装",
        "tea gift box packaging design",
        "green tea gift packaging",
        "中式现代 茶礼 包装",
        "chinese modern tea packaging",
        "国际简约 茶包装",
        "minimal tea packaging design",
        "黄酒礼盒包装设计",
        "滋补礼盒包装设计",
        "阿胶礼盒包装设计",
        "tea tin packaging design",
        "茶叶礼盒 包装 设计 Behance",
        "matcha gift box packaging",
    ],
    "brief-tissue-home": [
        "抽纸包装设计",
        "湿巾包装设计",
        "tissue box packaging design",
        "wet wipe packaging design",
        "纸品包装设计礼盒",
    ],
    "brief-dairy-gift": [
        "酸奶礼盒包装设计",
        "牛奶礼盒包装",
        "dairy gift box packaging design",
        "yogurt gift packaging design",
        "奶粉礼盒包装设计",
    ],
    "brief-tonic-gift": [
        "阿胶礼盒包装设计",
        "人参礼盒包装",
        "滋补礼盒包装设计",
        "燕窝礼盒包装设计",
        "herbal tonic gift box packaging",
    ],
}

SOURCE_MAP = {
    "behance.net": "behance",
    "pinterest.com": "pinterest",
    "xiaohongshu.com": "xiaohongshu",
    "zcool.com.cn": "zcool",
    "huaban.com": "huaban",
    "packagingoftheworld.com": "packagingoftheworld",
    "dribbble.com": "dribbble",
}


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def api(path: str, body: dict, timeout=90):
    req = urllib.request.Request(
        f"https://api.firecrawl.dev{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def search(q: str, limit=8):
    if BLOCKED_Q.match(q.strip()):
        return []
    data = api("/v1/search", {"query": q, "limit": limit})
    return list(data.get("data") or [])


def scrape_image(url: str):
    try:
        data = api("/v1/scrape", {"url": url, "formats": ["markdown"], "onlyMainContent": True})
        meta = (data.get("data") or {}).get("metadata") or {}
        for k in ("ogImage", "og:image", "image", "twitter:image"):
            v = meta.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
            if isinstance(v, list) and v and str(v[0]).startswith("http"):
                return str(v[0])
    except Exception:
        return None
    return None


def source_of(url: str) -> str:
    host = urlparse(url).netloc.lower().replace("www.", "")
    for k, v in SOURCE_MAP.items():
        if k in host:
            return v
    return (host.split(".")[0] if host else "web")


def to_l2(hit, query, brief_id, img):
    page = (hit.get("url") or "").strip()
    title = (hit.get("title") or "").strip()
    desc = (hit.get("description") or "").strip()
    if not page.startswith("http"):
        return None
    blob = f"{title} {desc} {query}"
    if not (PACK_RE.search(blob) or re.search(r"包装|礼盒|packag|box design", blob, re.I)):
        return None
    if not img or not str(img).startswith("http"):
        return None
    # reject gd-hbimg-edge
    if "gd-hbimg-edge.huaban.com" in str(img):
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
        "extra": {
            "collect_method": "firecrawl_search_directed",
            "brief_id": brief_id,
            "description": desc[:300],
        },
    }


def collect(brief_id, queries, max_items=40, scrape_budget=25):
    items, seen = [], set()
    scrapes = 0
    raw = []
    for q in queries:
        try:
            hits = search(q, limit=8)
        except Exception as e:
            print("search_fail", brief_id, q, e, flush=True)
            continue
        print(f"search {brief_id} | {q} -> {len(hits)}", flush=True)
        for h in hits:
            raw.append({"query": q, **{k: h.get(k) for k in ("url", "title", "description", "image", "imageUrl")}})
            page = (h.get("url") or "").rstrip("/")
            if not page or page in seen:
                continue
            seen.add(page)
            img = h.get("image") or h.get("imageUrl")
            if isinstance(img, list):
                img = img[0] if img else None
            if (not img or not str(img).startswith("http")) and scrapes < scrape_budget:
                if re.search(r"packag|包装|礼盒|behance|zcool|pinterest|potw", page + " " + (h.get("title") or ""), re.I):
                    img = scrape_image(page)
                    scrapes += 1
                    time.sleep(0.25)
            row = to_l2(h, q, brief_id, img if isinstance(img, str) else None)
            if row:
                items.append(row)
            if len(items) >= max_items:
                break
        if len(items) >= max_items:
            break
        time.sleep(0.15)
    (RAW / f"{brief_id}.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    path = OUT / f"l2-{brief_id}.jsonl"
    with path.open("w", encoding="utf-8") as f:
        for it in items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    print(f"collected {brief_id}: {len(items)} (scrapes={scrapes})", flush=True)
    return items


def load_jsonl(path: Path):
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def gate_tea(item):
    bucket, reason = tea_classify(item)
    out = dict(item)
    extra = dict(out.get("extra") or {})
    extra["brief_relevance_v1"] = bucket
    extra["brief_id"] = "brief-green-tea-gift"
    keep = bucket in KEEP and bool(out.get("image_url"))
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


def gate_spec(item, spec: BriefSpec):
    bucket, reason = classify_with_spec(item, spec)
    # pet plastic guard
    if spec.brief_id == "brief-pet-food":
        blob = f"{item.get('title')} {item.get('query_used')}"
        animal = re.search(r"宠物|猫|狗|cat\s*food|dog\s*food|pet\s*food|猫粮|狗粮", blob or "", re.I)
        if bucket in KEEP and not animal:
            bucket, reason = "kill_noise", "brief_offtopic"
        if re.search(r"\bPET\b|聚酯|瓶坯", blob or "") and not animal:
            bucket, reason = "kill_noise", "brief_offtopic"
    out = dict(item)
    extra = dict(out.get("extra") or {})
    extra["brief_relevance_v1"] = bucket
    extra["brief_id"] = spec.brief_id
    keep = bucket in KEEP and bool(out.get("image_url"))
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


def main():
    # 1) never touch shell — explicit
    print("NOTE: will NOT write ui-shell/data locks", flush=True)

    # update fixtures domains lightly
    fx_path = ROOT / "L3" / "fixtures" / "brief_matrix_v1.json"
    fx = json.loads(fx_path.read_text())
    for b in fx["briefs"]:
        if b["brief_id"] == "brief-tissue-home":
            b["domain"] = "paper_homecare"
        if b["brief_id"] == "brief-dairy-gift":
            b["domain"] = "dairy_drinks"
        if b["brief_id"] == "brief-tonic-gift":
            b["domain"] = "health_tcm"
        if b["brief_id"] == "brief-pet-food":
            b["core_terms"] = ["宠物", "猫粮", "狗粮", "猫砂", "宠物零食", "pet food", "cat food", "dog food", "pet treat", "猫狗"]
            b["noise_terms"] = ["茶", "酒", "美妆", "母婴", "PET瓶", "PET塑料", "PET膜", "polyethylene terephthalate", "塑料瓶坯"]
    fx_path.write_text(json.dumps(fx, ensure_ascii=False, indent=2), encoding="utf-8")
    specs = {s.brief_id: s for s in load_brief_fixtures(fx_path)}

    collected = {}
    for bid, qs in QUERIES.items():
        # tea gets larger budget
        max_items = 55 if bid == "brief-green-tea-gift" else 22
        scrape_budget = 30 if bid == "brief-green-tea-gift" else 12
        collected[bid] = collect(bid, qs, max_items=max_items, scrape_budget=scrape_budget)

    # merge all new
    all_new = [it for rows in collected.values() for it in rows]
    with (OUT / "l2-directed-merged.jsonl").open("w", encoding="utf-8") as f:
        for it in all_new:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    # --- tea proposal expand ---
    prop_main_path = ROOT / "L3" / "feeds" / "l2_main_wall_brief_relevance_proposed.jsonl"
    prop_pend_path = ROOT / "L3" / "feeds" / "l2_pending_review_brief_relevance_proposed.jsonl"
    base_main = load_jsonl(prop_main_path)
    base_pend = load_jsonl(prop_pend_path)
    by_id = {it["id"]: it for it in base_main + base_pend}
    # also pull shell+pipeline as pending candidates only for tea gate (accuracy)
    for path in [
        ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl",
        ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl",
        ROOT / "demo" / "e2e-green-tea-gift" / "l2-from-pipeline-all.jsonl",
    ]:
        for it in load_jsonl(path):
            if it.get("id") and it["id"] not in by_id:
                by_id[it["id"]] = it
    for it in collected.get("brief-green-tea-gift", []):
        by_id[it["id"]] = it

    tea_main, tea_pend = [], []
    for it in by_id.values():
        gated, keep = gate_tea(it)
        (tea_main if keep else tea_pend).append(gated)

    with prop_main_path.open("w", encoding="utf-8") as f:
        for it in tea_main:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    with prop_pend_path.open("w", encoding="utf-8") as f:
        for it in tea_pend:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    print(f"TEA PROPOSAL main={len(tea_main)} pending={len(tea_pend)}", flush=True)

    # --- rebuild landed for all matrix briefs ---
    pool = {}
    for it in list(by_id.values()) + all_new:
        if it.get("id"):
            pool[it["id"]] = it
    # include directed for thin briefs
    for bid, rows in collected.items():
        for it in rows:
            pool[it["id"]] = it

    landed = ROOT / "L3" / "eval" / "landed"
    landed.mkdir(parents=True, exist_ok=True)
    index = []
    for bid, spec in specs.items():
        d = landed / bid
        d.mkdir(parents=True, exist_ok=True)
        if bid.startswith("brief-green-tea"):
            # use expanded tea proposal
            import shutil

            shutil.copyfile(prop_main_path, d / "l2_main_wall.jsonl")
            shutil.copyfile(prop_pend_path, d / "l2_pending_review.jsonl")
            n_main, n_pend = len(tea_main), len(tea_pend)
            buckets = {"from": "expanded tea proposal"}
        else:
            main, pend = [], []
            buckets = Counter()
            for it in pool.values():
                gated, keep = gate_spec(it, spec)
                buckets[gated["extra"]["brief_relevance_v1"]] += 1
                (main if keep else pend).append(gated)
            with (d / "l2_main_wall.jsonl").open("w", encoding="utf-8") as f:
                for it in main:
                    f.write(json.dumps(it, ensure_ascii=False) + "\n")
            with (d / "l2_pending_review.jsonl").open("w", encoding="utf-8") as f:
                for it in pend:
                    f.write(json.dumps(it, ensure_ascii=False) + "\n")
            n_main, n_pend = len(main), len(pend)
            buckets = dict(buckets)
        meta = {
            "brief_id": bid,
            "name": spec.name,
            "domain": spec.domain,
            "main_wall": n_main,
            "pending_review": n_pend,
            "buckets": buckets,
            "shell_default": bid.startswith("brief-green-tea"),
            "updated_at": now(),
            "directed_new": len(collected.get(bid, [])),
        }
        (d / "META.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        index.append(
            {
                "brief_id": bid,
                "name": spec.name,
                "domain": spec.domain,
                "main_wall": n_main,
                "pending_review": n_pend,
                "path": f"L3/eval/landed/{bid}",
                "shell_default": meta["shell_default"],
                "directed_new": meta["directed_new"],
            }
        )
        print(f"LAND {bid}: {n_main}/{n_pend}", flush=True)

    # alias
    import shutil

    alias = landed / "brief-green-tea-gift-20260812"
    alias.mkdir(exist_ok=True)
    for name in ("l2_main_wall.jsonl", "l2_pending_review.jsonl", "META.json"):
        shutil.copyfile(landed / "brief-green-tea-gift" / name, alias / name)

    summary = {
        "generated_at": now(),
        "shell_write": False,
        "tea_proposal_main": len(tea_main),
        "tea_proposal_pending": len(tea_pend),
        "directed_new_total": len(all_new),
        "directed_by_brief": {k: len(v) for k, v in collected.items()},
        "landed": index,
        "proposal_paths": {
            "main": str(prop_main_path),
            "pending": str(prop_pend_path),
        },
        "note": "Hand tea proposal to platform for unlock replace; shell locks untouched",
    }
    (ROOT / "L3" / "feeds" / "DIRECTED-EXPAND-SUMMARY.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (landed / "INDEX.json").write_text(
        json.dumps(
            {
                "generated_at": now(),
                "shell_default_brief_id": "brief-green-tea-gift",
                "shell_default_note": "壳默认青绿茶提案口径；未自动改壳",
                "briefs": index,
                "tea_proposal_main": len(tea_main),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
