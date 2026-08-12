# -*- coding: utf-8 -*-
"""Category-agnostic L2 query pack builder.

Loads /workspace/kuiyan-design-workbench/category-ontology.json and expands
primary / analogy / shelf queries + source_plan.
"""
from __future__ import annotations

import json
import re

# Accuracy > volume: do not expand bare "视觉锤" / visual-hammer theory queries
# (they flood offtopic VI/coffee/tool noise unrelated to tea gift packaging).
BLOCKED_QUERY_RE = re.compile(
    r"^(视觉锤|品牌视觉锤|visual\s*hammer|laura\s*ries)(\s|$)",
    re.I,
)


def _filter_queries(qs: list[str]) -> list[str]:
    out = []
    for q in qs:
        q = (q or "").strip()
        if not q:
            continue
        if BLOCKED_QUERY_RE.match(q):
            continue
        if re.fullmatch(r"视觉锤|品牌视觉锤|visual\s*hammer", q, re.I):
            continue
        out.append(q)
    return out

import sys
from pathlib import Path
from typing import Any

ONTOLOGY_PATH = Path("/workspace/kuiyan-design-workbench/category-ontology.json")

DEFAULT_SOURCE_PLAN = [
    {"source": "behance", "method": "Tavily / Official API", "query_group": "primary", "priority": "P0"},
    {"source": "packagingoftheworld", "method": "Tavily extract / Crawl4AI", "query_group": "primary", "priority": "P0"},
    {"source": "zcool", "method": "Firecrawl / Tavily / Crawl4AI", "query_group": "primary", "priority": "P0"},
    {"source": "key_behance_portfolio", "method": "Firecrawl / Official API", "query_group": "portfolio", "priority": "P0"},
    {"source": "dribbble", "method": "Firecrawl / Tavily", "query_group": "analogy", "priority": "P1"},
    {"source": "gtn9", "method": "Browser Use / Firecrawl", "query_group": "primary", "priority": "P1"},
    {"source": "pentawards_reddot_if", "method": "Tavily / official public pages", "query_group": "primary", "priority": "P1"},
    {"source": "taobao_tmall", "method": "Bright Data / Apify / Browser Use", "query_group": "shelf", "priority": "P1"},
    {"source": "jd", "method": "Bright Data / Apify / Browser Use", "query_group": "shelf", "priority": "P1"},
    {"source": "douyin_ecommerce", "method": "Browser Use / Apify", "query_group": "shelf", "priority": "P2"},
    {"source": "pinterest", "method": "Bright Data / Apify / Browser Use", "query_group": "analogy", "priority": "P2"},
]


def load_ontology(path: Path | None = None) -> dict[str, Any]:
    p = path or ONTOLOGY_PATH
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def _domains(ontology: dict[str, Any]) -> list[dict[str, Any]]:
    return list(ontology.get("primary_domains") or [])


def resolve_domain(
    ontology: dict[str, Any],
    domain_id: str | None = None,
    free_text_brief: str | None = None,
) -> dict[str, Any]:
    domains = _domains(ontology)
    by_id = {d["id"]: d for d in domains}
    if domain_id and domain_id in by_id:
        return by_id[domain_id]

    text = (free_text_brief or "").strip().lower()
    if not text and domain_id:
        # fuzzy: domain_id as text
        text = domain_id.lower().replace("_", " ")

    if not text:
        return by_id.get("other_fmcg") or domains[-1]

    # keyword scoring
    best = None
    best_score = 0
    for d in domains:
        score = 0
        hay = " ".join(
            [
                d.get("id", ""),
                d.get("name", ""),
                " ".join(d.get("examples") or []),
                " ".join(d.get("kuiyan_cases") or []),
                " ".join(d.get("analogy_seeds") or []),
            ]
        ).lower()
        tokens = [t for t in re.split(r"[\s,/|]+", text) if t]
        for t in tokens:
            if t and t in hay:
                score += 2
        # id token match
        for part in d["id"].split("_"):
            if part and part in text:
                score += 3
        # Chinese name substrings
        name = d.get("name") or ""
        for ch_len in (2, 3, 4):
            for i in range(max(0, len(name) - ch_len + 1)):
                frag = name[i : i + ch_len]
                if frag and frag in (free_text_brief or ""):
                    score += 4
        for ex in d.get("examples") or []:
            if ex and ex in (free_text_brief or ""):
                score += 5
        if score > best_score:
            best_score = score
            best = d

    if best and best_score > 0:
        return best
    return by_id.get("other_fmcg") or domains[-1]


def _uniq(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        x = (x or "").strip()
        if not x or x in seen:
            continue
        seen.add(x)
        out.append(x)
    return out


def _load_style_buckets_v1() -> dict[str, Any]:
    p = ONTOLOGY_PATH.parent / "L3" / "style-buckets-v1.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def _tone_buckets(cultural_tone: str | None, ontology: dict[str, Any]) -> list[str]:
    """Return 0–3 style_buckets_v1 ids (never Chinese display names)."""
    v1 = _load_style_buckets_v1()
    buckets = v1.get("buckets") or []
    id_by_zh = {}
    ids = []
    for b in buckets:
        if isinstance(b, dict) and b.get("id"):
            ids.append(b["id"])
            zh = b.get("name_zh") or ""
            if zh:
                id_by_zh[zh] = b["id"]
            for a in b.get("name_aliases") or []:
                id_by_zh[a] = b["id"]
    # fallback migration table
    mig = v1.get("migration_from_v0") or {}
    id_by_zh.update(mig)
    if not cultural_tone:
        return []
    tone = cultural_tone.strip()
    if tone in ids:
        return [tone]
    if tone in id_by_zh:
        return [id_by_zh[tone]]
    # soft match on zh / aliases
    hits = []
    for zh, bid in id_by_zh.items():
        if tone in zh or zh in tone:
            hits.append(bid)
    # dedupe preserve order
    out = []
    seen = set()
    for h in hits:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out[:3]


def build_primary_queries(
    domain: dict[str, Any],
    brief: str | None,
    language: list[str],
    channel: list[str],
    price_band: str | None,
    cultural_tone: str | None,
) -> list[str]:
    name = domain.get("name") or domain["id"]
    examples = domain.get("examples") or []
    head = examples[:3] if examples else [name]
    qs: list[str] = []
    giftish = any(c in ("gift", "礼盒", "gifting") for c in channel) or (
        brief and ("礼盒" in brief or "gift" in brief.lower())
    )
    if "en" in language:
        for ex in head:
            qs.append(f"{ex} packaging design")
            if giftish:
                qs.append(f"{ex} gift box packaging")
        qs.append(f"{domain['id'].replace('_', ' ')} packaging design")
        if price_band == "premium":
            qs.append(f"premium {head[0]} packaging design")
        if cultural_tone:
            qs.append(f"{cultural_tone} {head[0]} packaging")
    if "zh" in language:
        for ex in head:
            qs.append(f"{ex}包装设计")
            if giftish:
                qs.append(f"{ex}礼盒包装")
        qs.append(f"{name}包装设计")
        if brief:
            qs.append(brief.strip())
        if cultural_tone:
            qs.append(f"{cultural_tone} {head[0]}包装")
    if brief and brief.strip() not in qs:
        qs.insert(0, brief.strip())
    return _uniq(qs)


def build_analogy_queries(
    ontology: dict[str, Any],
    domain: dict[str, Any],
    language: list[str],
) -> tuple[list[str], list[str]]:
    seeds = list(domain.get("analogy_seeds") or [])
    # soft pull from cross rules mentioning domain name fragments
    name = domain.get("name") or ""
    for rule in ontology.get("cross_analogy_rules") or []:
        pull = " ".join(rule.get("pull") or [])
        when = rule.get("when") or ""
        # if rule mentions tea/茶 etc loosely via seeds already enough
        for seed in list(seeds):
            if seed in pull or seed in when:
                # extract other tokens from pull
                for part in re.split(r"[↔,\s]+", pull):
                    part = part.strip()
                    if part and part not in seeds and part != seed:
                        seeds.append(part)
    seeds = _uniq(seeds)[:8]
    qs: list[str] = []
    for s in seeds:
        if "en" in language:
            qs.append(f"{s} packaging design")
            qs.append(f"{s} gift box packaging")
        if "zh" in language:
            qs.append(f"{s}包装设计")
            qs.append(f"{s}礼盒包装")
    return _uniq(qs), seeds


def build_shelf_queries(
    domain: dict[str, Any],
    brief: str | None,
    market: list[str],
    price_band: str | None,
) -> list[str]:
    if market and not any(m.upper() in ("CN", "CHINA", "ZH") for m in market):
        # still emit CN shelf as default for Kuiyan; mark lightly
        pass
    examples = domain.get("examples") or [domain.get("name") or domain["id"]]
    qs: list[str] = []
    for ex in examples[:4]:
        qs.append(f"{ex} 礼盒")
        qs.append(f"{ex} 包装")
        qs.append(f"{ex} 罐装")
    if brief:
        qs.append(brief.strip())
        if "礼盒" not in brief:
            qs.append(brief.strip() + " 礼盒")
    if price_band == "premium":
        qs.append(f"{examples[0]} 高端礼盒")
    elif price_band == "mass":
        qs.append(f"{examples[0]} 整箱 实惠")
    # ecommerce modifiers
    qs.append(f"{examples[0]} 旗舰店")
    return _uniq(qs)


def build_query_pack(
    domain_id: str | None = None,
    free_text_brief: str | None = None,
    language: list[str] | None = None,
    market: list[str] | None = None,
    channel: list[str] | None = None,
    price_band: str | None = None,
    cultural_tone: str | None = None,
    ontology_path: Path | None = None,
) -> dict[str, Any]:
    language = language or ["zh", "en"]
    market = market or ["CN"]
    channel = channel or ["gift", "ecommerce"]
    ontology = load_ontology(ontology_path)
    domain = resolve_domain(ontology, domain_id=domain_id, free_text_brief=free_text_brief)
    primary = build_primary_queries(
        domain, free_text_brief, language, channel, price_band, cultural_tone
    )
    analogy_q, seeds = build_analogy_queries(ontology, domain, language)
    shelf = build_shelf_queries(domain, free_text_brief, market, price_band)
    style_hints = _tone_buckets(cultural_tone, ontology)
    brief = free_text_brief or ""
    if "礼" in brief or "gift" in brief.lower():
        for bid in ("chinese_ceremonial", "chinese_modern"):
            if bid not in style_hints:
                style_hints.append(bid)
        style_hints = style_hints[:3]
    elif not style_hints:
        style_hints = []

    primary = _filter_queries(primary)
    analogy_q = _filter_queries(analogy_q)
    shelf = _filter_queries(shelf)
    # tea-brief: prefer packaging-bound queries only
    return {
        "input": {
            "domain_id": domain_id,
            "free_text_brief": free_text_brief,
            "language": language,
            "market": market,
            "channel": channel,
            "price_band": price_band,
            "cultural_tone": cultural_tone,
        },
        "domain_id": domain["id"],
        "category_label": domain.get("name"),
        "primary_queries": primary,
        "analogy_queries": analogy_q,
        "shelf_queries": shelf,
        "source_plan": DEFAULT_SOURCE_PLAN,
        "style_bucket_hints": style_hints,
        "analogy_seeds": seeds,
    }


def main(argv: list[str] | None = None) -> int:
    argv = list(argv or sys.argv[1:])
    domain_id = None
    brief = None
    if argv:
        if "=" in argv[0] or argv[0].startswith("--"):
            pass
        elif re.match(r"^[a-z][a-z0-9_]+$", argv[0]):
            domain_id = argv[0]
            brief = " ".join(argv[1:]) or None
        else:
            brief = " ".join(argv)
    if not domain_id and not brief:
        domain_id = "tea_beverage"
        brief = "青绿茶礼盒包装"

    pack = build_query_pack(
        domain_id=domain_id,
        free_text_brief=brief,
        language=["zh", "en"],
        market=["CN"],
        channel=["gift", "ecommerce"],
        price_band="premium",
        cultural_tone="中式现代",
    )
    print(json.dumps(pack, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
