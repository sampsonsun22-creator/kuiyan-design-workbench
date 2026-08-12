#!/usr/bin/env python3
"""Category-agnostic BriefSpec + classify for brief_relevance_v1 eval/gate."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable


PACK_RE = re.compile(
    r"包装|礼盒|packag|gift\s*box|盒装|罐装|tin|sleeve|carton|"
    r"branding\s*pack|礼袋|开箱|瓶贴|label\s*design|盒",
    re.I,
)
SOFT_PACK_RE = re.compile(
    r"包装|packag|礼盒|gift\s*box|branding|盒|瓶贴|label\s*design",
    re.I,
)
GENERIC_NOISE_RE = re.compile(
    r"视觉锤|visual\s*hammer|语言钉|laura\s*ries|"
    r"品牌科普|什么是视觉|流量视觉锤|封面都长一样|"
    r"\bVI\b|视觉识别系统|logo\s*设计教程|"
    r"hammer\s*(tool|vector)|claw\s*hammer|sledge",
    re.I,
)
UNRELATED_HARD_RE = re.compile(
    r"建筑|地产|汽车|手机|数码|游戏|动漫|穿搭|旅行",
    re.I,
)

# Global mockup / soda noise — demote unless domain core matches.
MOCKUP_ONLY_RE = re.compile(
    r"Paper\s*Box\s*Mockup|Soda\s*/\s*Beer\s*Packaging\s*Mockup|"
    r"Soda\s*/\s*Beer|soda\s*beer\s*packaging\s*mockup|"
    r"Employee\s*Appreciation\s*Day\s*Gift|"
    r"Teach\s*you\s*how\s*to\s*wrap\s*beautiful\s*gift",
    re.I,
)
SODA_PLAIN_RE = re.compile(
    r"\bsoda\b|碳酸饮料|苏打水|软饮|soft\s*drink|cola\b|lemonade",
    re.I,
)
ALCOHOL_CLEAR_RE = re.compile(
    r"酒|白酒|黄酒|葡萄酒|红酒|米酒|果酒|啤酒|洋酒|"
    r"\bwine\b|baijiu|sake|huangjiu|mezcal|whisky|whiskey|vodka|"
    r"champagne|cocktail|liqueur|beer\b|酒精|礼盒酒|酒礼|酒盒",
    re.I,
)
# Real pet animal signals — NEVER bare "PET" (plastic/bottle).
PET_ANIMAL_RE = re.compile(
    r"猫粮|狗粮|宠物零食|宠物食品|宠物|"
    r"猫砂|猫罐头|狗罐头|猫零食|狗零食|"
    r"cat\s*food|dog\s*food|pet\s*food|pet\s*care|pet\s*treat|"
    r"\bdog\b|\bcat\b|\bpuppy\b|\bkitten\b|"
    r"\bwoof\b|\bmeow\b|meowly|"
    r"petbarn|pawmate|waggo",
    re.I,
)
PET_PLASTIC_RE = re.compile(
    r"\bPET\b(?:\s*(?:can|bottle|garrafa|pack|packaging|plastic|preform))|"
    r"garrafas?\s*PET|Clear\s*Beverage\s*PET|PETALIA|"
    r"PET\s*c/\s*Tampa|bottle(?:s)?\s*PET|PET\s*bottle",
    re.I,
)
TEA_SIGNAL_RE = re.compile(
    r"(?:茶|绿茶|青茶|红茶|白茶|乌龙|普洱|龙井|碧螺春|铁观音|茉莉花茶|"
    r"matcha|green\s*tea|oolong|pu[-\s]?erh|camellia\s*sinensis|"
    r"\btea\b|chá|arktea)",
    re.I,
)


def _compile_terms(terms: Iterable[str]) -> re.Pattern[str]:
    parts = []
    for t in terms:
        t = (t or "").strip()
        if not t:
            continue
        # word-boundary for short latin tokens to reduce substring noise
        if re.fullmatch(r"[A-Za-z]{1,4}", t):
            parts.append(rf"\b{re.escape(t)}\b")
        else:
            parts.append(re.escape(t))
    if not parts:
        return re.compile(r"(?!x)x")  # never matches
    return re.compile("|".join(parts), re.I)


@dataclass
class BriefSpec:
    brief_id: str
    name: str
    domain: str
    core_terms: list[str]
    analogy_terms: list[str] = field(default_factory=list)
    noise_terms: list[str] = field(default_factory=list)
    summary: str = ""

    def __post_init__(self) -> None:
        self.core_re = _compile_terms(self.core_terms)
        self.analogy_re = _compile_terms(self.analogy_terms)
        self.noise_re = _compile_terms(self.noise_terms)


def blob(item: dict) -> str:
    parts = [
        item.get("title") or "",
        item.get("query_used") or "",
        " ".join(item.get("raw_tags") or []),
        " ".join(item.get("suggested_style_buckets") or []),
        str((item.get("extra") or {}).get("theme") or ""),
        item.get("category_label") or "",
        item.get("author_or_brand") or "",
    ]
    return " ".join(parts)


def classify_with_spec(item: dict, spec: BriefSpec) -> tuple[str, str | None]:
    """Return (bucket, pending_reason|None)."""
    b = blob(item)
    title = item.get("title") or ""
    query = item.get("query_used") or ""

    has_core = bool(spec.core_re.search(b))
    has_pack = bool(PACK_RE.search(b))
    has_analogy = bool(spec.analogy_re.search(b)) if spec.analogy_terms else False
    soft_pack = bool(SOFT_PACK_RE.search(b))
    generic_noise = bool(GENERIC_NOISE_RE.search(b))
    domain_noise = bool(spec.noise_re.search(b)) if spec.noise_terms else False
    unrelated = bool(UNRELATED_HARD_RE.search(b))

    # --- domain-specific hard gates (accuracy > volume) ---
    if spec.domain in {"pet", "pet_food"}:
        animal = bool(PET_ANIMAL_RE.search(b))
        plastic = bool(PET_PLASTIC_RE.search(b)) or (
            bool(re.search(r"\bPET\b", title)) and not animal
        )
        if plastic and not animal:
            return "kill_noise", "brief_offtopic"
        # Accuracy: never keep pet brief without explicit animal/pet-food cue.
        # Analogy "零食包装" alone is not enough (human snacks ≠ pet food).
        if not animal:
            return "kill_noise", "brief_offtopic"
        has_core = True
        has_analogy = False  # analogies disabled for pet; animal+pack only

    if spec.domain in {"alcohol", "baijiu", "low_alcohol"}:
        clear_alc = bool(ALCOHOL_CLEAR_RE.search(b))
        soda_plain = bool(SODA_PLAIN_RE.search(title) or SODA_PLAIN_RE.search(b))
        mock = bool(MOCKUP_ONLY_RE.search(title))
        if (soda_plain or mock) and not clear_alc:
            return "kill_noise", "brief_offtopic"
        # prefer clear alcohol; demote vague "beer" mockup-only already handled
        if has_core and not clear_alc and soda_plain:
            has_core = False

    if spec.domain in {"tea_beverage", "tea", "green_tea"}:
        tea = bool(TEA_SIGNAL_RE.search(b))
        mock = bool(MOCKUP_ONLY_RE.search(title))
        soda = bool(SODA_PLAIN_RE.search(title)) or bool(
            re.search(r"Soda\s*/\s*Beer", title, re.I)
        )
        if (mock or soda) and not tea:
            return "kill_noise", "brief_offtopic"
        # paper/soda mockups never keep via analogy alone
        if not tea and has_analogy and MOCKUP_ONLY_RE.search(title):
            return "kill_noise", "brief_offtopic"

    # Generic mockup-only rows: never keep unless core domain hits in title/blob
    if MOCKUP_ONLY_RE.search(title) and not has_core:
        if not (spec.domain.startswith("tea") and TEA_SIGNAL_RE.search(b)):
            return "kill_noise", "brief_offtopic"

    vh_query = bool(re.search(r"视觉锤|visual\s*hammer|品牌视觉锤", query, re.I))
    if vh_query and not (has_core and has_pack):
        if not (spec.core_re.search(title) and PACK_RE.search(title)):
            return "kill_noise", "brief_offtopic"

    if unrelated and not has_core:
        return "kill_unrelated", "brief_unrelated"

    if (generic_noise or domain_noise) and not (has_core and has_pack):
        if has_analogy and has_pack and not generic_noise:
            return "keep_analogy", None
        return "kill_noise", "brief_offtopic"

    if has_core and has_pack:
        return "keep_core", None
    if has_core and re.search(r"礼盒|gift|包装|packag", query, re.I):
        return "keep_core", None
    if has_analogy and has_pack:
        return "keep_analogy", None
    if soft_pack or has_pack:
        return "soft_pack_only", "brief_low_relevance"
    if has_core and not has_pack:
        return "soft_pack_only", "brief_low_relevance"
    return "kill_unrelated", "brief_unrelated"


def silver_positive(item: dict, spec: BriefSpec) -> bool:
    """Weak gold: core|analogy term + packaging cue in text blob."""
    b = blob(item)
    if spec.domain in {"pet", "pet_food"}:
        has_core = bool(PET_ANIMAL_RE.search(b))
    elif spec.domain in {"tea_beverage", "tea", "green_tea"}:
        has_core = bool(TEA_SIGNAL_RE.search(b))
    else:
        has_core = bool(spec.core_re.search(b))
    has_analogy = bool(spec.analogy_re.search(b)) if spec.analogy_terms else False
    has_pack = bool(PACK_RE.search(b))
    if MOCKUP_ONLY_RE.search(item.get("title") or "") and not has_core:
        return False
    return has_pack and (has_core or has_analogy)


def load_brief_fixtures(path: Path) -> list[BriefSpec]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    briefs = doc.get("briefs") or doc
    out = []
    for row in briefs:
        out.append(
            BriefSpec(
                brief_id=row["brief_id"],
                name=row.get("name") or row["brief_id"],
                domain=row.get("domain") or "",
                core_terms=list(row.get("core_terms") or []),
                analogy_terms=list(row.get("analogy_terms") or []),
                noise_terms=list(row.get("noise_terms") or []),
                summary=row.get("summary") or "",
            )
        )
    return out
