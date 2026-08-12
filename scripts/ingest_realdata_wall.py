#!/usr/bin/env python3
"""Ingest firecrawl + design-pipeline → cross-review → L3 + demo-bundle + ui-shell sync."""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

ROOT = Path("/workspace/kuiyan-design-workbench")
DEMO = ROOT / "demo" / "e2e-green-tea-gift"
sys.path.insert(0, str(ROOT / "L3"))
from adapt_design_pipeline import adapt  # noqa: E402

BUCKETS = json.loads((ROOT / "L3" / "style-buckets-v1.json").read_text())
ID_TO_ZH = {b["id"]: b["name_zh"] for b in BUCKETS["buckets"]}
IDS = set(BUCKETS["ids"])

PIPELINE = Path("/workspace/design-pipeline/data/normalized/all_sources_20260812T123359Z.jsonl")
if not PIPELINE.exists():
    PIPELINE = Path("/workspace/design-pipeline/data/normalized/all_sources.jsonl")

EXTRA_L2 = [
    ROOT / "L2-collector" / "samples" / "sample-run.jsonl",
    DEMO / "l2-extra.jsonl",
    DEMO / "l2-firecrawl.jsonl",
]

KNOWN_SOURCES = {
    "behance",
    "pinterest",
    "huaban",
    "xiaohongshu",
    "zcool",
    "packagingoftheworld",
    "jd",
    "taobao",
    "tmall",
    "tmall-taobao",
}

PACK_RE = re.compile(
    r"包装|packaging|package\s*design|礼盒|gift\s*box|tea\s*box|视觉|平面|品牌|branding|box\s*design|罐装|tin|sleeve",
    re.I,
)
SPAM_RE = re.compile(r"^(untitled|null|test|https?://)", re.I)

CANON_BY_PAGE = {
    "https://www.behance.net/gallery/172938413/_": "behance:172938413-qianshan-cui-green-tea-gift",
    "https://www.behance.net/gallery/171967461/TenRen-Gift-Box": "behance:171967461-tenren-gift-box",
    "https://www.behance.net/gallery/251095885/Taiwan-Tea-Packaging-Design": "behance:251095885-taiwan-tea-packaging",
    "https://www.behance.net/gallery/216540701/Theory-of-tea-Tea-Packaging-design": "behance:216540701-theory-of-tea",
    "https://www.behance.net/gallery/153491065/-Tea-Gift-Box": "behance:153491065-shangchalou-tea-gift-box",
    "https://packagingoftheworld.com/2023/12/you-ming-tang-tea-gift-box-packaging.html": "packagingoftheworld:you-ming-tang-tea-gift-box",
    "https://packagingoftheworld.com/2019/05/taitea-tea-box.html": "packagingoftheworld:taitea-tea-box",
}


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def norm_url(u: str) -> str:
    if not u:
        return ""
    p = urlparse(u.strip())
    return urlunparse((p.scheme, p.netloc.lower(), (p.path.rstrip("/") or "/"), "", p.query, ""))


def ensure_schema(item: dict) -> dict:
    item.setdefault("structure_tags", [])
    item.setdefault("info_hierarchy_tags", [])
    item.setdefault("color_roles", [])
    item.setdefault("raw_tags", item.get("raw_tags") or [])
    item.setdefault("suggested_style_buckets", item.get("suggested_style_buckets") or [])
    item.setdefault("is_on_market", item.get("is_on_market", "unknown"))
    item.setdefault("market_region", item.get("market_region") or ["global"])
    item.setdefault("query_used", item.get("query_used") or "")
    item.setdefault("title", item.get("title") or "")
    item["suggested_style_buckets"] = [b for b in item["suggested_style_buckets"] if b in IDS][:3]
    return item


def load_l2_jsonl(path: Path) -> list[dict]:
    out = []
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if not line.strip():
            continue
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        if o.get("id"):
            out.append(ensure_schema(o))
    return out


def adapt_pipeline(path: Path) -> list[dict]:
    items = []
    with path.open(encoding="utf-8", errors="ignore") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            items.append(ensure_schema(adapt(row)))
    return items


def score(item: dict) -> int:
    s = 0
    if item.get("image_url"):
        s += 10
    if (item.get("extra") or {}).get("collect_method") == "firecrawl_scrape":
        s += 6
    if (item.get("extra") or {}).get("adapted_from") == "design-pipeline":
        s += 2
    if item.get("suggested_style_buckets"):
        s += 2
    if item.get("author_or_brand"):
        s += 1
    return s


def dedupe(items: list[dict]) -> list[dict]:
    by_page: dict[str, list[dict]] = defaultdict(list)
    no_page = []
    for it in items:
        pu = norm_url(it.get("page_url") or "")
        if not pu:
            no_page.append(it)
            continue
        by_page[pu].append(it)
    merged = []
    for pu, group in by_page.items():
        group = sorted(group, key=score, reverse=True)
        best = dict(group[0])
        for k, v in CANON_BY_PAGE.items():
            if norm_url(k) == pu:
                best["id"] = v
                break
        buckets = []
        for g in group:
            for b in g.get("suggested_style_buckets") or []:
                if b in IDS and b not in buckets:
                    buckets.append(b)
        best["suggested_style_buckets"] = buckets[:3]
        for g in sorted(group, key=score, reverse=True):
            if g.get("image_url"):
                best["image_url"] = g["image_url"]
                best["thumbnail_url"] = g.get("thumbnail_url") or g["image_url"]
                break
        # prefer firecrawl image
        for g in group:
            if (g.get("extra") or {}).get("collect_method") == "firecrawl_scrape" and g.get("image_url"):
                best["image_url"] = g["image_url"]
                best["thumbnail_url"] = g.get("thumbnail_url") or g["image_url"]
                break
        merged.append(best)
    for it in no_page:
        merged.append(it)
    by_id = {}
    for it in merged:
        i = it["id"]
        if i not in by_id or score(it) > score(by_id[i]):
            by_id[i] = it
    return list(by_id.values())


def packaging_hit(item: dict) -> bool:
    blob = " ".join(
        [
            item.get("title") or "",
            item.get("query_used") or "",
            " ".join(item.get("raw_tags") or []),
            str((item.get("extra") or {}).get("theme") or ""),
            item.get("source") or "",
        ]
    )
    if PACK_RE.search(blob):
        return True
    # firecrawl / potw / known gift tea demos pass
    if (item.get("extra") or {}).get("collect_method") == "firecrawl_scrape":
        return True
    if item.get("source") in ("packagingoftheworld", "jd", "taobao", "tmall", "tmall-taobao"):
        return True
    if item.get("source_type") == "shelf":
        return True
    return False


def credible(item: dict) -> tuple[bool, str]:
    if not item.get("id"):
        return False, "missing_id"
    if not item.get("source"):
        return False, "missing_source"
    if item["source"] not in KNOWN_SOURCES and not str(item["source"]).isalnum():
        return False, "source_untrusted"
    if not item.get("page_url") or not str(item["page_url"]).startswith("http"):
        return False, "bad_page_url"
    if not item.get("image_url") or not str(item["image_url"]).startswith("http"):
        return False, "missing_image"
    title = (item.get("title") or "").strip()
    # title may be empty per platform contract, but spam-like bad
    if title and SPAM_RE.match(title):
        return False, "title_spam"
    if len(title) > 300:
        return False, "title_too_long"
    return True, "ok"


def probe_image(url: str, timeout: float = 2.5) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "kuiyan-realdata/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = getattr(resp, "status", 200) or 200
            if 200 <= int(code) < 400:
                return True
            if int(code) in (403, 405):
                return True  # exists but forbids HEAD
            return False
    except urllib.error.HTTPError as e:
        if e.code in (403, 405, 401):
            return True
        if e.code == 404:
            return False
        return e.code < 500
    except Exception:
        # fallback GET range
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "kuiyan-realdata/1.0", "Range": "bytes=0-64"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return True
        except Exception:
            return False


def probe_images(items: list[dict], max_workers: int = 24) -> dict[str, bool]:
    urls = sorted({it["image_url"] for it in items if it.get("image_url")})
    result = {}
    print(f"probe_images n={len(urls)}", flush=True)
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = {ex.submit(probe_image, u): u for u in urls}
        done = 0
        for fut in as_completed(futs):
            u = futs[fut]
            try:
                result[u] = bool(fut.result())
            except Exception:
                result[u] = False
            done += 1
            if done % 200 == 0:
                print(f"  probed {done}/{len(urls)}", flush=True)
    return result


def cross_review(items: list[dict], image_ok: dict[str, bool] | None = None) -> tuple[list[dict], list[dict]]:
    """Structural QC → qc_status pass_main | pending_review.

    pass_main: usable image URL + page_url + source + not duplicate page_url (post-dedupe).
    pending_review: missing image/link/source OR suspicious OR optional image probe fail.
    Content/visual packaging judgment is NOT invented here — mark pending_human when unclear.
    """
    image_ok = image_ok or {}
    main, pending = [], []
    seen_pages: set[str] = set()
    for it in items:
        it = dict(it)
        it["extra"] = dict(it.get("extra") or {})
        ok, reason = credible(it)
        pu = norm_url(it.get("page_url") or "")
        dup = bool(pu and pu in seen_pages)
        if pu:
            seen_pages.add(pu)
        if not ok:
            it["qc_status"] = "pending_review"
            it["extra"]["review_status"] = "pending"
            it["extra"]["review_fail"] = reason
            pending.append(it)
            continue
        if dup:
            it["qc_status"] = "pending_review"
            it["extra"]["review_status"] = "pending"
            it["extra"]["review_fail"] = "duplicate_page_url"
            pending.append(it)
            continue
        # optional probe: only fail if we probed and got False
        if it.get("image_url") in image_ok and image_ok[it["image_url"]] is False:
            it["qc_status"] = "pending_review"
            it["extra"]["review_status"] = "pending"
            it["extra"]["review_fail"] = "image_unreachable"
            pending.append(it)
            continue
        # structural pass — do not invent packaging insights
        it["qc_status"] = "pass_main"
        it["extra"]["review_status"] = "passed"
        if not packaging_hit(it):
            it["extra"]["pending_human"] = "visual_packaging_content_review"
        main.append(it)
    return main, pending


def build_walls(main: list[dict]):
    shelf_items = [
        it
        for it in main
        if it.get("source_type") == "shelf" or it.get("source") in ("jd", "taobao", "tmall", "tmall-taobao")
    ]
    primary_items = [it for it in main if it not in shelf_items]
    by_bucket: dict[str, list] = {}
    for it in primary_items:
        bucks = it.get("suggested_style_buckets") or []
        # if empty buckets, put in 未分桶 so volume still shows on wall
        zhs = [ID_TO_ZH.get(b, b) for b in bucks] if bucks else ["待标注"]
        wall = {
            "id": it["id"],
            "title": it.get("title") or "",
            "source": it.get("source"),
            "image_url": it.get("image_url") or "",
            "thumbnail_url": it.get("thumbnail_url") or it.get("image_url") or "",
            "page_url": it.get("page_url") or "",
            "author_or_brand": it.get("author_or_brand"),
            "source_type": it.get("source_type") or "inspiration",
            "suggested_style_buckets": bucks,
            "style_tags": [ID_TO_ZH.get(b, b) for b in bucks] if bucks else ["待标注"],
            "market_region": it.get("market_region") or [],
            "query_used": it.get("query_used") or "",
            "is_on_market": it.get("is_on_market", "unknown"),
            "qc_status": it.get("qc_status") or "pass_main",
        }
        for zh in zhs:
            by_bucket.setdefault(zh, []).append(wall)
    for zh, lst in list(by_bucket.items()):
        seen = set()
        out = []
        for x in lst:
            if x["id"] in seen:
                continue
            seen.add(x["id"])
            out.append(x)
        by_bucket[zh] = out
    shelf_wall = []
    for it in shelf_items:
        bucks = it.get("suggested_style_buckets") or []
        shelf_wall.append(
            {
                "id": it["id"],
                "title": it.get("title") or "",
                "source": it.get("source"),
                "image_url": it.get("image_url") or "",
                "thumbnail_url": it.get("thumbnail_url") or it.get("image_url") or "",
                "page_url": it.get("page_url") or "",
                "author_or_brand": it.get("author_or_brand"),
                "buckets": [ID_TO_ZH.get(b, b) for b in bucks],
                "suggested_style_buckets": bucks,
                "style_tags": [ID_TO_ZH.get(b, b) for b in bucks] or ["货架"],
                "market_region": it.get("market_region") or ["CN"],
                "query_used": it.get("query_used") or "",
                "is_on_market": True,
                "shelf_level": "listing",
            }
        )
    analogy = []
    for it in primary_items:
        if it.get("analogy_from"):
            analogy.append(
                {
                    "id": it["id"],
                    "title": it.get("title") or "",
                    "analogy_from": it.get("analogy_from"),
                    "image_url": it.get("image_url"),
                    "page_url": it.get("page_url"),
                    "source": it.get("source"),
                    "thumbnail_url": it.get("thumbnail_url") or it.get("image_url"),
                    "style_tags": [ID_TO_ZH.get(b, b) for b in (it.get("suggested_style_buckets") or [])],
                    "query_used": it.get("query_used") or "",
                }
            )
    return by_bucket, shelf_wall, analogy[:20], primary_items, shelf_items


def main():
    t0 = time.time()
    print("1) adapt pipeline", PIPELINE, flush=True)
    pipe = adapt_pipeline(PIPELINE)
    print("   adapted", len(pipe), flush=True)

    print("2) load local L2", flush=True)
    local = []
    for p in EXTRA_L2:
        local.extend(load_l2_jsonl(p))
        print("  ", p.name, "loaded", flush=True)

    all_items = dedupe(pipe + local)
    print("3) deduped", len(all_items), flush=True)

    # write full L2 adapted
    l2_all = DEMO / "l2-from-pipeline-all.jsonl"
    with l2_all.open("w", encoding="utf-8") as f:
        for it in pipe:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    import os
    image_ok = {}
    ok_n = 0
    if os.environ.get("ENABLE_IMAGE_PROBE") == "1":
        print("4) probe images", flush=True)
        image_ok = probe_images(all_items)
        ok_n = sum(1 for v in image_ok.values() if v)
        print(f"   image_ok {ok_n}/{len(image_ok)}", flush=True)
    else:
        print("4) skip image probe (structural QC; ENABLE_IMAGE_PROBE=1 to enable)", flush=True)

    print("5) cross review", flush=True)
    main_items, pending_items = cross_review(all_items, image_ok)
    print("   main", len(main_items), "pending", len(pending_items), flush=True)

    # Dual-caliber paths:
    # - image_gate (ENABLE_IMAGE_PROBE=1): may refresh demo strict walls
    # - structural/maximize (default): ONLY write *_structural* / L3/feeds/*_platform_* — NEVER shell defaults
    image_gate = os.environ.get("ENABLE_IMAGE_PROBE") == "1"
    if image_gate:
        main_path = DEMO / "l2-main-wall.jsonl"
        pend_path = DEMO / "l2-pending-review.jsonl"
    else:
        main_path = DEMO / "l2-main-wall-structural.jsonl"
        pend_path = DEMO / "l2-pending-review-structural.jsonl"
        # also park under platform-style names (contrast only)
        feeds = ROOT / "L3" / "feeds"
        feeds.mkdir(parents=True, exist_ok=True)
        with (feeds / "l2_main_wall_platform_structural.jsonl").open("w", encoding="utf-8") as f:
            for it in main_items:
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        with (feeds / "l2_pending_review_platform_structural.jsonl").open("w", encoding="utf-8") as f:
            for it in pending_items:
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        print("   structural outputs → demo/*-structural.jsonl + L3/feeds/*_platform_structural.jsonl", flush=True)
        print("   NOT touching demo/l2-main-wall.jsonl or ui-shell defaults", flush=True)

    with main_path.open("w", encoding="utf-8") as f:
        for it in main_items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    with pend_path.open("w", encoding="utf-8") as f:
        for it in pending_items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    by_bucket, shelf_wall, analogy, primary_items, shelf_items = build_walls(main_items)
    primary_unique = len({x["id"] for lst in by_bucket.values() for x in lst})
    src_main = Counter(it.get("source") for it in main_items)
    src_pend = Counter(it.get("source") for it in pending_items)
    fail_reasons = Counter((it.get("extra") or {}).get("review_fail") for it in pending_items)

    fc_pages = {
        json.loads(l).get("page_url", "").rstrip("/")
        for l in (DEMO / "l2-firecrawl.jsonl").read_text().splitlines()
        if l.strip()
    }
    fc_on_wall = sum(1 for it in main_items if (it.get("page_url") or "").rstrip("/") in fc_pages)

    l3 = {
        "brief_id": "brief-green-tea-gift-20260812",
        "generated_at": now(),
        "data_sources": [
            "sample-run.jsonl",
            "l2-extra.jsonl",
            "l2-firecrawl.jsonl",
            "l2-from-pipeline-all.jsonl",
            "l2-main-wall.jsonl",
        ],
        "counts": {
            "total_ingested": len(all_items),
            "main_wall": len(main_items),
            "pending_review": len(pending_items),
            "with_image_main": sum(1 for it in main_items if it.get("image_url")),
            "shelf": len(shelf_wall),
            "primary": primary_unique,
            "firecrawl_jsonl": len(fc_pages),
            "firecrawl_on_wall": fc_on_wall,
            "pipeline_adapted": len(pipe),
        },
        "source_distribution": {
            "main": dict(src_main),
            "pending": dict(src_pend),
        },
        "review_fail_reasons": dict(fail_reasons),
        "l1_summary": {
            "domain": "茶与即饮/新茶饮相关包装",
            "channel": "礼赠 + 电商礼盒",
            "tone": "中式现代",
            "price_band": "中高端",
        },
        "ai_recommended_buckets": [
            {"id": "chinese_ceremonial", "name_zh": "中式典雅/礼赠", "why": "礼赠仪式感"},
            {"id": "chinese_modern", "name_zh": "中式现代", "why": "Brief 中式现代"},
            {"id": "regional_culture", "name_zh": "地域文旅", "why": "茶产地叙事"},
            {"id": "global_minimal", "name_zh": "国际简约", "why": "拉开喜庆货架"},
            {"id": "natural_organic", "name_zh": "自然有机", "why": "综合 prior"},
        ],
        "walls": {
            "primary": {"count": primary_unique, "by_bucket": by_bucket},
            "analogy": {"items": analogy},
            "shelf": {"items": shelf_wall},
            "pending_review": {
                "count": len(pending_items),
                "note": "结构复核未过 / 可疑；不进 primary；卡片 60%+虚线+待复核徽标",
                "items": [
                    {
                        "id": it["id"],
                        "title": it.get("title") or "",
                        "source": it.get("source"),
                        "image_url": it.get("image_url") or "",
                        "thumbnail_url": it.get("thumbnail_url") or it.get("image_url") or "",
                        "page_url": it.get("page_url") or "",
                        "author_or_brand": it.get("author_or_brand"),
                        "source_type": it.get("source_type") or "inspiration",
                        "suggested_style_buckets": it.get("suggested_style_buckets") or [],
                        "style_tags": [ID_TO_ZH.get(b, b) for b in (it.get("suggested_style_buckets") or [])] or ["待复核"],
                        "market_region": it.get("market_region") or [],
                        "qc_status": "pending_review",
                        "review_fail": (it.get("extra") or {}).get("review_fail"),
                    }
                    for it in pending_items
                    if it.get("image_url")  # only showable cards
                ][:240],
            },
        },
        "channel_status": [
            {"id": "behance", "label": "Behance", "status": "ok", "note": "已接通 · pipeline+Firecrawl"},
            {"id": "potw", "label": "POTW", "status": "ok", "note": "已接通 · Firecrawl"},
            {"id": "huaban", "label": "花瓣", "status": "ok" if src_main.get("huaban") else "pending", "note": "pipeline 已入库，主墙经复核"},
            {"id": "xiaohongshu", "label": "小红书", "status": "ok" if src_main.get("xiaohongshu") else "pending", "note": "pipeline 已入库，主墙经复核"},
            {"id": "pinterest", "label": "Pinterest", "status": "ok" if src_main.get("pinterest") else "pending", "note": "pipeline 已入库，主墙经复核"},
            {"id": "zcool", "label": "站酷", "status": "pending", "note": "待开通 · Firecrawl 薄页"},
            {"id": "taobao", "label": "淘宝", "status": "pending", "note": "待开通 · Apify 额度；listing 样在货架"},
            {"id": "jd", "label": "京东", "status": "pending", "note": "待开通 · Apify 额度；listing 样在货架"},
        ],
    }
    (DEMO / "L3-market-map.json").write_text(json.dumps(l3, ensure_ascii=False, indent=2), encoding="utf-8")

    # merged for catalog
    merged_path = DEMO / "l2-merged-for-wall.jsonl"
    with merged_path.open("w", encoding="utf-8") as f:
        for it in main_items + pending_items:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")

    # patch build sources
    build_py = ROOT / "ui" / "build-demo-bundle.py"
    text = build_py.read_text(encoding="utf-8")
    new_sources = '''JSONL_SOURCES = [
    ROOT / "L2-collector" / "samples" / "sample-run.jsonl",
    DEMO / "l2-extra.jsonl",
    DEMO / "l2-firecrawl.jsonl",
    DEMO / "l2-from-pipeline-all.jsonl",
    DEMO / "l2-pending-review.jsonl",
    DEMO / "l2-main-wall.jsonl",
    DEMO / "l2-merged-for-wall.jsonl",
]'''
    text2 = re.sub(r"JSONL_SOURCES = \[[\s\S]*?\]", new_sources, text, count=1)
    build_py.write_text(text2, encoding="utf-8")

    print("6) build demo-bundle", flush=True)
    import subprocess

    # NEVER copy wide / structural / platform_* into ui-shell defaults.
    # Shell sync is opt-in + count-gated + requires writable lock.
    shell_main = ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl"
    shell_pend = ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl"

    def _can_write(path: Path) -> bool:
        if not path.exists():
            return os.access(path.parent, os.W_OK)
        return os.access(path, os.W_OK)

    def _nlines(path: Path) -> int:
        if not path.exists():
            return -1
        return sum(1 for line in path.open(encoding="utf-8") if line.strip())

    allow_shell = os.environ.get("ALLOW_SHELL_SYNC") == "1"
    # BRIEF_RELEVANCE_SHELL_GUARD: never overwrite brief_relevance shell with image_gate
    _st = Path(__file__).resolve().parents[1] / "ui-shell" / "data" / "FEED-STATUS.json"
    if _st.exists():
        try:
            import json as _json
            _qc = _json.loads(_st.read_text()).get("qc_mode")
        except Exception:
            _qc = None
        if _qc in ("brief_relevance_v1", "brief_relevance") and os.environ.get("FORCE_IMAGE_GATE_SHELL") != "1":
            allow_shell = False
            print("   HARD BLOCK: shell is brief_relevance_v1; refuse image_gate sync (set FORCE_IMAGE_GATE_SHELL=1 to override)", flush=True)

    demo_main = DEMO / "l2-main-wall.jsonl"
    demo_pend = DEMO / "l2-pending-review.jsonl"
    n_main, n_pend = _nlines(demo_main), _nlines(demo_pend)
    # Never treat bare image_gate (~1820/1127 or legacy 1868/1079) as shell-ok under brief_relevance era
    counts_ok = False  # shell feeds only via apply_brief_relevance_proposal / platform unlock

    if not allow_shell:
        print("   SKIP ui-shell jsonl sync (ALLOW_SHELL_SYNC!=1). Shell stays on locked strict.", flush=True)
    elif not image_gate:
        print("   SKIP ui-shell jsonl sync (structural/maximize run — never write shell defaults).", flush=True)
    elif not (_can_write(shell_main) and _can_write(shell_pend)):
        print("   SKIP ui-shell jsonl sync (read-only lock). Coordinate unlock first.", flush=True)
    elif not counts_ok:
        print(f"   SKIP ui-shell jsonl sync (demo counts {n_main}/{n_pend} != strict ~1868/1079).", flush=True)
    else:
        # refuse if source path looks wide
        for bad in ("wide", "platform_2864", "structural"):
            if bad in demo_main.name or bad in str(demo_main):
                raise SystemExit(f"refusing shell sync from {demo_main}")
        shutil.copyfile(demo_main, shell_main)
        shutil.copyfile(demo_pend, shell_pend)
        print("   synced STRICT demo → ui-shell jsonl", flush=True)

    # Build bundle from shell sources when possible; do not require shell overwrite
    subprocess.check_call([sys.executable, str(ROOT / "ui" / "build-demo-bundle.py")])
    bundle_dst = ROOT / "ui-shell" / "data" / "demo-bundle.json"
    if os.environ.get("ALLOW_SHELL_SYNC") == "1" and _can_write(bundle_dst) and counts_ok and image_gate:
        shutil.copyfile(ROOT / "ui" / "data" / "demo-bundle.json", bundle_dst)
        print("   synced demo-bundle → ui-shell", flush=True)
    else:
        print("   SKIP demo-bundle → ui-shell (needs ALLOW_SHELL_SYNC=1 + image_gate + writable + strict counts)", flush=True)
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")])

    # DATA-LIVE
    live = f"""# KEY 视界 · DATA-LIVE

> {now()} · Asia/Shanghai · 优先级：真实数据最大化 + 结构 QC（qc_status）

## 条数

| 指标 | 值 |
|------|---:|
| pipeline adapt（total adapted） | **{len(pipe)}** |
| 去重后入库 | **{len(all_items)}** |
| **pass_main（主墙）** | **{len(main_items)}** |
| **pending_review** | **{len(pending_items)}** |
| pass_main 有图 | **{sum(1 for it in main_items if it.get('image_url'))}** |
| 货架 | **{len(shelf_wall)}** |
| firecrawl.jsonl | **{len(fc_pages)}**（上墙 {fc_on_wall}） |
| 图片探测 OK | **{ok_n}/{len(image_ok) if image_ok else 0}**（默认跳过探测） |

## 主墙源分布

{json.dumps(dict(src_main), ensure_ascii=False, indent=2)}

## 待复核源分布

{json.dumps(dict(src_pend), ensure_ascii=False, indent=2)}

## 待复核原因

{json.dumps(dict(fail_reasons), ensure_ascii=False, indent=2)}

## 路径

- `demo/e2e-green-tea-gift/l2-from-pipeline-all.jsonl`
- `demo/e2e-green-tea-gift/l2-main-wall.jsonl`
- `demo/e2e-green-tea-gift/l2-pending-review.jsonl`
- `demo/e2e-green-tea-gift/L3-market-map.json`
- `ui-shell/data/demo-bundle.json`
- `ui/data/demo-bundle.json`

## 复核门槛（qc_status）

- **pass_main**：可用 `image_url`（或 images[0].url）+ `page_url` + `source` + 非重复 page_url
- **pending_review**：缺图/缺链/缺源 / 重复 page_url / 标题可疑 /（可选）图不可达
- 不编造包装洞察；内容视觉锤仍标 `extra.pending_human=visual_packaging_content_review`
- 主墙 primary 仅 `pass_main`；`pending_review` 进独立区，UI 60% 透明+虚线+#C4BBA8「待复核」

### 待复核视觉（设计总监）
- 主栅格 pass_main：正常彩图+实线边
- pending_review：整体 60% 透明 + 顶 1px 虚线边 #C4BBA8 + 左上徽标「待复核」（暖灰底非黄）
- 不进黄选中环；点选 toast「还没复核完，先慎用」

elapsed_s: {time.time() - t0:.1f}
"""
    (ROOT / "DATA-LIVE.md").write_text(live, encoding="utf-8")
    summary = {
        "pass_main": len(main_items),
        "main_wall": len(main_items),
        "pending_review": len(pending_items),
        "total_adapted": len(pipe),
        "source_distribution_main": dict(src_main),
        "source_distribution_pending": dict(src_pend),
        "fail_reasons": dict(fail_reasons),
        "firecrawl": len(fc_pages),
        "firecrawl_on_wall": fc_on_wall,
        "pipeline_adapted": len(pipe),
        "bundle": str(ROOT / "ui-shell/data/demo-bundle.json"),
        "data_live": str(ROOT / "DATA-LIVE.md"),
        "elapsed_s": round(time.time() - t0, 1),
    }
    (DEMO / "INGEST-SUMMARY.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
