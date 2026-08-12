#!/usr/bin/env python3
"""Convert Tavily (or Firecrawl-search-shaped) dump JSON → L2-collector/directed/*.jsonl.
No scrape. Prefer hit/result images. NEVER writes ui-shell or clean274.
"""
from __future__ import annotations
import hashlib, json, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("/workspace/kuiyan-design-workbench")
DIR = ROOT / "L2-collector" / "directed"
RAW = DIR / "raw" / "tavily_dumps"
DIR.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)

BAD_IMG = re.compile(
    r"(logo|avatar|gravatar|favicon|buysellads|og-image\.png|1rx\.io|360yield|openx|/Logo\.|zero-pixeal|icon-shot|announcements/tag)",
    re.I,
)
PACK_RE = re.compile(r"包装|礼盒|packag|gift\s*box|tin|罐|湿巾|抽纸|tissue|wipe|yogurt|dairy|阿胶|燕窝|人参|滋补|matcha|tea", re.I)


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def source_of(url: str) -> str:
    host = urlparse(url).netloc.lower().replace("www.", "")
    for k, v in {
        "behance.net": "behance",
        "pinterest.com": "pinterest",
        "xiaohongshu.com": "xiaohongshu",
        "zcool.com.cn": "zcool",
        "huaban.com": "huaban",
        "packagingoftheworld.com": "packagingoftheworld",
        "dribbble.com": "dribbble",
        "99designs.com": "99designs",
    }.items():
        if k in host:
            return v
    return host.split(".")[0] or "web"


def pick_img(candidates):
    for u in candidates:
        if not u or not isinstance(u, str):
            continue
        u = u.strip()
        if not u.startswith("http"):
            continue
        if "gd-hbimg-edge" in u:
            continue
        if BAD_IMG.search(u):
            continue
        # prefer real asset hosts
        if any(x in u for x in ("mir-s3-cdn-cf.behance", "wp-content/uploads", "pinimg.com", "cdn.dribbble", "99static", "project_modules", "shopify", "lovelypackage", "img.redocn", "ntimg", "alicdn", "etsystatic", "wixstatic", "magnific.com", "shutterstock", "ftcdn", "designerpeople", "sywipe", "mondigroup", "stoltzfus", "brandcreatiers", "chinagoods", "dancf.com")):
            return u
    for u in candidates:
        if isinstance(u, str) and u.startswith("http") and "gd-hbimg-edge" not in u and not BAD_IMG.search(u):
            return u
    return None


def to_l2(page, title, desc, query, brief_id, img, method="tavily_search_images"):
    if not page.startswith("http"):
        return None
    blob = f"{title} {desc} {query}"
    if not PACK_RE.search(blob):
        return None
    if not img or not str(img).startswith("http") or "gd-hbimg-edge" in str(img):
        return None
    # unique id by page+img so multi-image pages can contribute distinct samples (still real URLs)
    iid = f"directed:{brief_id}:{hashlib.sha1((page+'|'+img).encode()).hexdigest()[:12]}"
    return {
        "id": iid,
        "title": title or iid,
        "source": source_of(page),
        "source_type": "inspiration",
        "page_url": page,
        "image_url": str(img),
        "thumbnail_url": str(img),
        "query_used": query,
        "raw_tags": [brief_id, "directed_collect", "tavily"],
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
        "extra": {"collect_method": method, "brief_id": brief_id, "description": (desc or "")[:300]},
    }


def expand_dump(dump: dict, brief_id: str):
    """dump: {query, results:[{url,title,content/description,images:[]}], images:[str|dict]}"""
    q = dump.get("query") or ""
    top_imgs = []
    for im in dump.get("images") or []:
        if isinstance(im, str):
            top_imgs.append(im)
        elif isinstance(im, dict):
            top_imgs.append(im.get("url") or "")
    rows = []
    results = dump.get("results") or dump.get("data") or []
    # pair each result with best image; also emit top-level image rows tied to best matching result
    for r in results:
        page = (r.get("url") or "").strip()
        title = (r.get("title") or "").strip()
        desc = (r.get("content") or r.get("description") or "").strip()
        cands = []
        for im in r.get("images") or []:
            if isinstance(im, str):
                cands.append(im)
            elif isinstance(im, dict):
                cands.append(im.get("url") or "")
        cands.extend(top_imgs)
        img = pick_img(cands)
        row = to_l2(page, title, desc, q, brief_id, img)
        if row:
            rows.append(row)
    # also create rows from top images with first packaging-ish result as page anchor
    anchors = [r for r in results if PACK_RE.search(f"{r.get('title','')} {r.get('url','')}")]
    if anchors:
        for i, im in enumerate(top_imgs):
            img = pick_img([im])
            if not img:
                continue
            a = anchors[i % len(anchors)]
            page = (a.get("url") or "").strip()
            title = (a.get("title") or "").strip() + f" · img{i+1}"
            row = to_l2(page, title, a.get("content") or "", q, brief_id, img)
            if row:
                rows.append(row)
    return rows


def write_jsonl(path: Path, rows):
    # dedupe by id
    seen, out = set(), []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        out.append(r)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    return len(out)


def main():
    # curated dumps written beside this run
    dumps = sorted(RAW.glob("*.json"))
    if not dumps:
        print("no dumps in", RAW)
        return 1
    by_brief = {}
    for p in dumps:
        data = json.loads(p.read_text(encoding="utf-8"))
        brief = data.get("brief_id") or p.stem.split("__")[0]
        rows = expand_dump(data, brief)
        by_brief.setdefault(brief, []).extend(rows)
        print(f"dump {p.name} -> {len(rows)} rows for {brief}")
    for brief, rows in by_brief.items():
        out = DIR / f"l2-{brief}-tavily.jsonl"
        n = write_jsonl(out, rows)
        print(f"WROTE {out.name} n={n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
