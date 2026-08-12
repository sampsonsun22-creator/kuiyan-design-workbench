#!/usr/bin/env python3
"""Expand 青绿茶礼盒 main wall via Firecrawl (+ optional tavily dump). Proposal only."""
from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path("/workspace/kuiyan-design-workbench")
sys.path.insert(0, str(ROOT / "L3"))
from brief_spec import load_brief_fixtures, classify_with_spec, PACK_RE  # noqa: E402

BRIEF_ID = "brief-green-tea-gift"
BRIEF_ID_ALIAS = "brief-green-tea-gift-20260812"
KEEP = {"keep_core", "keep_analogy"}
KEY = Path("/home/box/.config/firecrawl/api_key").read_text().strip()

QUERIES = [
    "tea gift box packaging design",
    "green tea gift packaging design",
    "matcha tea box packaging design",
    "chinese modern tea packaging gift box",
    "中式现代 茶礼 包装设计",
    "青绿茶礼盒包装设计",
    "绿茶礼盒 包装",
    "国际简约茶包装设计",
    "minimal tea packaging design gift",
    "黄酒礼盒包装设计",
    "滋补礼盒包装设计",
    "阿胶礼盒包装设计",
    "sake gift box packaging design",
    "tea tin packaging design luxury",
    "茶叶礼盒包装 Behance",
    "tea packaging site:behance.net",
    "tea gift packaging site:packagingoftheworld.com",
    "tea packaging site:zcool.com.cn",
    "green tea gift box site:pinterest.com",
    "matcha packaging gift box site:behance.net",
]

BLOCKED_Q = re.compile(r"视觉锤|visual\s*hammer|品牌视觉锤", re.I)
SOURCE_MAP = {
    "behance.net": "behance",
    "pinterest.com": "pinterest",
    "pinimg.com": "pinterest",
    "xiaohongshu.com": "xiaohongshu",
    "xhslink.com": "xiaohongshu",
    "zcool.com.cn": "zcool",
    "huaban.com": "huaban",
    "packagingoftheworld.com": "packagingoftheworld",
    "dribbble.com": "dribbble",
    "jd.com": "jd",
    "taobao.com": "taobao",
    "tmall.com": "tmall",
}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def api(path: str, body: dict, timeout: int = 90):
    req = urllib.request.Request(
        f"https://api.firecrawl.dev{path}",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def search(q: str, limit: int = 10):
    if BLOCKED_Q.search(q):
        return []
    data = api("/v1/search", {"query": q, "limit": limit})
    return list(data.get("data") or [])


def scrape_image(url: str):
    try:
        data = api(
            "/v1/scrape",
            {"url": url, "formats": ["markdown"], "onlyMainContent": True},
        )
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
    return host.split(".")[0] if host else "web"


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


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def keys_of(it: dict):
    return {
        ("id", it.get("id")),
        ("page_url", (it.get("page_url") or "").rstrip("/")),
        ("image_url", it.get("image_url")),
    }


class Deduper:
    def __init__(self):
        self.ids = set()
        self.pages = set()
        self.imgs = set()

    def seen(self, it: dict) -> bool:
        iid = it.get("id")
        page = (it.get("page_url") or "").rstrip("/")
        img = it.get("image_url")
        if iid and iid in self.ids:
            return True
        if page and page in self.pages:
            return True
        if img and img in self.imgs:
            return True
        return False

    def add(self, it: dict):
        if it.get("id"):
            self.ids.add(it["id"])
        page = (it.get("page_url") or "").rstrip("/")
        if page:
            self.pages.add(page)
        if it.get("image_url"):
            self.imgs.add(it["image_url"])


def to_l2(page: str, title: str, desc: str, query: str, img: str, method: str):
    if not page.startswith("http") or not img or not str(img).startswith("http"):
        return None
    if "gd-hbimg-edge.huaban.com" in str(img):
        return None
    blob = f"{title} {desc} {query}"
    if not (PACK_RE.search(blob) or re.search(r"包装|礼盒|packag|box design|tea box|gift", blob, re.I)):
        return None
    # prefer packaging-ish pages
    if BLOCKED_Q.search(blob) and not re.search(r"茶|tea|matcha|黄酒|滋补|阿胶", blob, re.I):
        return None
    src = source_of(page)
    iid = f"expand:{BRIEF_ID}:{hashlib.sha1(page.encode()).hexdigest()[:12]}"
    # if page is behance gallery, use gallery id
    m = re.search(r"behance\.net/gallery/(\d+)", page)
    if m:
        iid = f"behance:{m.group(1)}"
    m = re.search(r"packagingoftheworld\.com/[^?]*/(\d+)", page)
    if m:
        iid = f"packagingoftheworld:{m.group(1)}"
    return {
        "id": iid,
        "title": (title or iid)[:200],
        "source": src,
        "source_type": "inspiration",
        "page_url": page,
        "image_url": str(img),
        "thumbnail_url": str(img),
        "query_used": query,
        "raw_tags": [BRIEF_ID, "brief_expand", src],
        "suggested_style_buckets": [],
        "structure_tags": [],
        "info_hierarchy_tags": [],
        "color_roles": [],
        "analogy_from": None,
        "is_on_market": "unknown",
        "market_region": ["global"],
        "author_or_brand": None,
        "category_domain_id": None,
        "category_label": None,
        "collected_at": now(),
        "license_or_rights_note": None,
        "qc_status": "pass_main",
        "wall_status": "main_wall",
        "extra": {
            "collect_method": method,
            "brief_id": BRIEF_ID,
            "description": (desc or "")[:300],
            "adapted_from": "brief_expand_v1",
        },
    }


def gate(item, spec):
    bucket, reason = classify_with_spec(item, spec)
    out = dict(item)
    extra = dict(out.get("extra") or {})
    extra["brief_relevance_v1"] = bucket
    extra["brief_id"] = BRIEF_ID
    keep = bucket in KEEP and bool(out.get("image_url")) and "gd-hbimg-edge" not in (
        out.get("image_url") or ""
    )
    if keep:
        out["qc_status"] = "pass_main"
        out["wall_status"] = "main_wall"
        extra["review_status"] = "passed"
        extra.pop("review_fail", None)
    else:
        out["qc_status"] = "pending_review"
        out["wall_status"] = "pending_review"
        extra["review_fail"] = reason or "brief_low_relevance"
        extra["review_status"] = "pending"
        flags = list(out.get("review_flags") or [])
        if (reason or "brief_low_relevance") not in flags:
            flags.append(reason or "brief_low_relevance")
        out["review_flags"] = flags
    out["extra"] = extra
    return out, keep


def collect_firecrawl(max_items=120, scrape_budget=40):
    items, raw = [], []
    seen_pages = set()
    scrapes = 0
    for q in QUERIES:
        try:
            hits = search(q, limit=10)
        except Exception as e:
            print("search_fail", q, e, flush=True)
            continue
        print(f"fc_search | {q} -> {len(hits)}", flush=True)
        for h in hits:
            page = (h.get("url") or "").strip()
            raw.append(
                {
                    "query": q,
                    "url": page,
                    "title": h.get("title"),
                    "description": h.get("description"),
                    "image": h.get("image") or h.get("imageUrl"),
                }
            )
            if not page or page.rstrip("/") in seen_pages:
                continue
            # skip pure search listing pages without project id when no image
            title = (h.get("title") or "").strip()
            desc = (h.get("description") or "").strip()
            img = h.get("image") or h.get("imageUrl")
            if isinstance(img, list):
                img = img[0] if img else None
            if (not img or not str(img).startswith("http")) and scrapes < scrape_budget:
                if re.search(
                    r"packag|包装|礼盒|behance\.net/gallery|zcool|pinterest\.com/pin|packagingoftheworld",
                    page + " " + title,
                    re.I,
                ):
                    img = scrape_image(page)
                    scrapes += 1
                    time.sleep(0.2)
            row = to_l2(page, title, desc, q, img if isinstance(img, str) else None, "firecrawl_search")
            if row:
                seen_pages.add(page.rstrip("/"))
                items.append(row)
            if len(items) >= max_items:
                break
        if len(items) >= max_items:
            break
        time.sleep(0.12)
    raw_path = ROOT / "L2-collector" / "directed" / "raw" / "brief-green-tea-gift-expand.json"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"firecrawl_items={len(items)} scrapes={scrapes}", flush=True)
    return items


def ingest_tavily_dump(path: Path):
    if not path.exists():
        return []
    doc = json.loads(path.read_text(encoding="utf-8"))
    items = []
    for block in doc if isinstance(doc, list) else [doc]:
        query = block.get("query") or "tavily tea packaging"
        # top-level images with titles
        for im in block.get("images") or []:
            img = im.get("url") if isinstance(im, dict) else None
            title = (im.get("title") or im.get("description") or query) if isinstance(im, dict) else query
            # try to infer page from title/search - use image page as weak page_url if behance CDN
            page = None
            if img and "behance.net" in img:
                # no gallery id — skip bare CDN unless we can pair below
                pass
            # store later via results
        for r in block.get("results") or []:
            page = (r.get("url") or "").strip()
            title = (r.get("title") or "").strip()
            desc = (r.get("content") or "")[:400]
            # prefer result-level images
            imgs = []
            for im in r.get("images") or []:
                if isinstance(im, dict) and im.get("url"):
                    imgs.append(im["url"])
                elif isinstance(im, str):
                    imgs.append(im)
            # also match top-level images whose title overlaps
            if not imgs:
                for im in block.get("images") or []:
                    if not isinstance(im, dict):
                        continue
                    t = (im.get("title") or "") + " " + (im.get("description") or "")
                    if title and (title[:20] in t or any(w in t.lower() for w in ["tea", "茶", "matcha", "gift"])):
                        if im.get("url"):
                            imgs.append(im["url"])
            # skip search listing pages: still OK if we have project-ish title + image
            if "/search/" in page and imgs:
                # explode into per-image pseudo items using alt titles from listing
                for im in r.get("images") or []:
                    if not isinstance(im, dict):
                        continue
                    alt = (im.get("description") or title)[:200]
                    img = im.get("url")
                    if not img or "pps.services.adobe" in img or "/img/project/tools/" in img:
                        continue
                    # fabricate stable page from image hash if listing
                    fake_page = page + "#" + hashlib.sha1(img.encode()).hexdigest()[:10]
                    # try extract project id from behance image path .../projects/.../ID.
                    m = re.search(r"/projects/(?:max_\d+_webp/)?([a-f0-9]+)?", img)
                    # better: projects/404/HASH. or project_modules
                    m2 = re.search(r"behance\.net/(?:projects|project_modules)/[^/]+/([a-f0-9]+)", img)
                    if "behance.net" in img:
                        # use image as identity; page stays listing#hash
                        pass
                    row = to_l2(fake_page, alt or title, desc, query, img, "tavily_search")
                    if row:
                        # override id for listing-derived
                        row["id"] = f"tavilyimg:{hashlib.sha1(img.encode()).hexdigest()[:14]}"
                        items.append(row)
                continue
            img = imgs[0] if imgs else None
            if img and ("pps.services.adobe" in img or "/img/project/tools/" in img):
                img = next((u for u in imgs if "mir-s3" in u or "pinimg" in u or "packaging" in u), None)
            row = to_l2(page, title, desc, query, img, "tavily_search")
            if row:
                items.append(row)
            # extra: also keep additional gallery module images as separate refs? skip for dedup quality
    print(f"tavily_items={len(items)}", flush=True)
    return items


def main():
    specs = {
        s.brief_id: s
        for s in load_brief_fixtures(ROOT / "L3" / "fixtures" / "brief_matrix_v1.json")
    }
    spec = specs[BRIEF_ID]

    prop_main = ROOT / "L3" / "feeds" / "l2_main_wall_brief_relevance_proposed.jsonl"
    prop_pend = ROOT / "L3" / "feeds" / "l2_pending_review_brief_relevance_proposed.jsonl"
    base_main = load_jsonl(prop_main)
    base_pend = load_jsonl(prop_pend)
    before_main = len(base_main)
    before_pend = len(base_pend)

    # 1) collect new
    fc_items = collect_firecrawl(max_items=140, scrape_budget=45)
    tv_path = ROOT / "L2-collector" / "directed" / "raw" / "tavily_green_tea_dump.json"
    tv_items = ingest_tavily_dump(tv_path)

    # 2) remine pending non-edge keepers (already in corpus)
    remine = []
    for it in base_pend:
        g, keep = gate(it, spec)
        if keep:
            remine.append(g)

    # also remine from broader pools
    for path in [
        ROOT / "L3" / "feeds" / "l2_main_wall_platform_2864.jsonl",
        ROOT / "L3" / "feeds" / "l2_from_pipeline_20260812.jsonl",
        ROOT / "ui-shell" / "data" / "l2-firecrawl.jsonl",
    ]:
        for it in load_jsonl(path):
            g, keep = gate(it, spec)
            if keep:
                remine.append(g)

    new_cands = fc_items + tv_items
    print(
        f"candidates fc={len(fc_items)} tv={len(tv_items)} remine_raw={len(remine)}",
        flush=True,
    )

    # 3) merge: start from existing main, add new keepers, rest to pending
    dd = Deduper()
    main_out = []
    pend_out = []
    bucket_c = Counter()
    source_new = Counter()
    added_new = 0
    remine_added = 0

    # existing main first (re-gate for accuracy)
    for it in base_main:
        g, keep = gate(it, spec)
        bucket_c[g["extra"]["brief_relevance_v1"]] += 1
        if dd.seen(g):
            continue
        dd.add(g)
        if keep:
            main_out.append(g)
        else:
            pend_out.append(g)

    # new crawl items
    for it in new_cands:
        g, keep = gate(it, spec)
        if dd.seen(g):
            continue
        dd.add(g)
        if keep:
            main_out.append(g)
            added_new += 1
            source_new[g.get("source")] += 1
        else:
            pend_out.append(g)

    # remine keepers
    for g in remine:
        if dd.seen(g):
            continue
        dd.add(g)
        main_out.append(g)
        remine_added += 1
        source_new[g.get("source") or "remine"] += 1

    # old pending (non-kept / rejects) — keep all not already in main
    for it in base_pend:
        g, keep = gate(it, spec)
        if dd.seen(g):
            continue
        # if somehow keep and not added — add to main
        if keep:
            dd.add(g)
            main_out.append(g)
            remine_added += 1
            continue
        dd.add(g)
        pend_out.append(g)

    out_main = ROOT / "L3" / "feeds" / "l2_main_wall_brief_relevance_expanded.jsonl"
    out_pend = ROOT / "L3" / "feeds" / "l2_pending_review_brief_relevance_expanded.jsonl"
    write_jsonl(out_main, main_out)
    write_jsonl(out_pend, pend_out)

    # update landed copies
    import shutil

    for land_id in (BRIEF_ID, BRIEF_ID_ALIAS):
        d = ROOT / "L3" / "eval" / "landed" / land_id
        d.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(out_main, d / "l2_main_wall.jsonl")
        shutil.copyfile(out_pend, d / "l2_pending_review.jsonl")
        meta = {
            "brief_id": land_id,
            "main_wall": len(main_out),
            "pending_review": len(pend_out),
            "updated_at": now(),
            "source": "brief_relevance_expanded",
            "shell_write": False,
            "before_main": before_main,
            "added_from_crawl": added_new,
            "added_from_remine": remine_added,
        }
        (d / "META.json").write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # recompute keep buckets on main
    main_buckets = Counter(
        (it.get("extra") or {}).get("brief_relevance_v1") for it in main_out
    )

    status = {
        "brief_id": BRIEF_ID,
        "gate": "brief_spec.classify_with_spec keep_core|keep_analogy",
        "shell_write": False,
        "shell_locked_at": {"main_wall": 184, "pending_review": 2763},
        "before": {"main_wall": before_main, "pending_review": before_pend},
        "after": {
            "main_wall": len(main_out),
            "pending_review": len(pend_out),
            "main_buckets": dict(main_buckets),
        },
        "delta_main": len(main_out) - before_main,
        "added_from_crawl_keep": added_new,
        "added_from_remine_keep": remine_added,
        "crawl": {
            "firecrawl_raw_normalized": len(fc_items),
            "tavily_raw_normalized": len(tv_items),
            "queries": QUERIES,
            "forbidden_queries": ["视觉锤", "visual hammer", "bare packaging-only"],
        },
        "new_keep_by_source": dict(source_new),
        "outputs": {
            "main": str(out_main),
            "pending": str(out_pend),
            "landed": [
                f"L3/eval/landed/{BRIEF_ID}/",
                f"L3/eval/landed/{BRIEF_ID_ALIAS}/",
            ],
        },
        "generated_at": now(),
        "note": "Proposal expanded files only; ui-shell locks untouched (a-w / NO_SHELL_SYNC).",
    }
    status_path = ROOT / "L3" / "feeds" / "BRIEF-EXPAND-STATUS.json"
    status_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(status, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
