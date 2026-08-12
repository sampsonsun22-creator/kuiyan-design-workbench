#!/usr/bin/env python3
"""Build slim ui-shell/data/product-runtime.json for KEY 视界.

Does NOT rewrite locked l2_main_wall.jsonl / l2_pending_review.jsonl (452/2680).
Strips item_catalog and L3 wall dumps so the client can load L1+L4 in <100KB.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHELL = ROOT / "ui-shell" / "data"
PACK = SHELL / "product-pack.json"
DEMO_L1 = ROOT / "demo" / "e2e-green-tea-gift" / "L1-brief-intent.json"
BUCKETS = ROOT / "L3" / "style-buckets-v1.json"
ONTOLOGY = ROOT / "category-ontology.json"
FIXTURES = ROOT / "L3" / "eval" / "brief_fixtures_v1.json"
OUT = SHELL / "product-runtime.json"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def slim_card(card: dict) -> dict:
    refs = []
    for r in card.get("reference_montage") or []:
        refs.append(
            {
                "item_id": r.get("item_id"),
                "why": r.get("why"),
                "wall": r.get("wall") or "primary",
                "title": r.get("title"),
                "image_url": r.get("image_url") or r.get("thumbnail_url"),
                "page_url": r.get("page_url"),
            }
        )
    return {
        "card_id": card.get("card_id"),
        "brief_id": card.get("brief_id"),
        "title": card.get("title"),
        "one_liner": card.get("one_liner"),
        "advantage": card.get("advantage"),
        "differentiation": card.get("differentiation"),
        "recommended_style_buckets": card.get("recommended_style_buckets") or [],
        "recommended_style_buckets_zh": card.get("recommended_style_buckets_zh") or [],
        "reference_montage": refs,
        "verbal_directions": card.get("verbal_directions") or [],
        "sketch_directions": card.get("sketch_directions") or [],
        "demo_prompt": card.get("demo_prompt") or "",
        "demo_disclaimer": card.get("demo_disclaimer")
        or "Demo only — 情绪板示意，不是完稿",
        "hou_decision": card.get("hou_decision") or "pending",
        "merge_into": card.get("merge_into"),
    }


def fixture_map() -> dict:
    data = load(FIXTURES)
    return {b["brief_id"]: b for b in data.get("briefs") or []}


def ontology_lite() -> list[dict]:
    raw = load(ONTOLOGY)
    out = []
    for d in raw.get("primary_domains") or []:
        out.append(
            {
                "id": d.get("id"),
                "name": d.get("name"),
                "examples": (d.get("examples") or [])[:8],
                "analogy_seeds": (d.get("analogy_seeds") or [])[:6],
                "kuiyan_fit": d.get("kuiyan_fit"),
            }
        )
    return out


def bucket_meta() -> tuple[dict, dict]:
    raw = load(BUCKETS)
    id_to_zh = {b["id"]: b["name_zh"] for b in raw.get("buckets") or []}
    speak = {b["id"]: b.get("hou_speak") or b.get("name_zh") for b in raw.get("buckets") or []}
    return id_to_zh, speak


def main() -> None:
    pack = load(PACK) if PACK.exists() else {}
    l1 = pack.get("l1") or (load(DEMO_L1) if DEMO_L1.exists() else {})
    l3 = pack.get("l3") or {}
    cards = [slim_card(c) for c in (pack.get("l4_cards") or [])]
    id_to_zh, speak = bucket_meta()
    fx = fixture_map()
    tea_fx = fx.get("green_tea_gift") or fx.get("brief-green-tea-gift") or {}
    baijiu_fx = fx.get("baijiu_gift") or {}
    tonic_fx = fx.get("ejiao_gift") or {}

    runtime = {
        "meta": {
            "product": "KEY 视界",
            "brief_id": (l1 or {}).get("brief_id") or "brief-green-tea-gift-20260812",
            "main_wall": 452,
            "pending_review": 2680,
            "qc_mode": "brief_relevance_v1",
            "shell_floor": 452,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "note": "slim runtime: L1 + L3 summary + L4 cards; visual wall still reads jsonl",
        },
        "l1": l1,
        "l3": {
            "l1_summary": l3.get("l1_summary")
            or {
                "domain": "茶与即饮/新茶饮相关包装",
                "channel": "礼赠 + 电商礼盒",
                "tone": "中式现代",
                "price_band": "中高端",
            },
            "ai_recommended_buckets": l3.get("ai_recommended_buckets")
            or [
                {"id": "chinese_ceremonial", "name_zh": "中式典雅/礼赠", "why": "礼赠仪式感"},
                {"id": "chinese_modern", "name_zh": "中式现代", "why": "Brief 中式现代"},
                {"id": "regional_culture", "name_zh": "地域文旅", "why": "茶产地叙事"},
                {"id": "global_minimal", "name_zh": "国际简约", "why": "拉开喜庆货架"},
                {"id": "natural_organic", "name_zh": "自然有机", "why": "综合 prior"},
            ],
            "counts": {
                "main_wall": 452,
                "pending_review": 2680,
                "primary": 452,
                "qc_mode": "brief_relevance_v1",
            },
            "channel_status": l3.get("channel_status")
            or [
                {"id": "behance", "label": "Behance", "status": "ok", "note": "已采集"},
                {
                    "id": "packagingoftheworld",
                    "label": "Packaging of the World",
                    "status": "ok",
                    "note": "已采集",
                },
                {"id": "zcool", "label": "站酷", "status": "thin", "note": "薄页/待深采"},
                {"id": "taobao", "label": "淘宝", "status": "pending", "note": "货架通道待开通"},
                {"id": "jd", "label": "京东", "status": "pending", "note": "货架通道待开通"},
            ],
        },
        "l4_cards": cards,
        "bucket_id_to_zh": id_to_zh or pack.get("bucket_id_to_zh") or {},
        "bucket_hou_speak": speak,
        "ontology_lite": ontology_lite(),
        "researches": [
            {
                "id": "r-green",
                "title": "青绿茶礼盒竞品调研",
                "date": "2026-08-12",
                "status": "running",
                "question": "新品牌青绿茶礼盒：中式现代气质下，礼赠+电商渠道如何做出开箱记忆点与差异化？",
                "use_default_feeds": True,
                "wall": "data/l2_main_wall.jsonl",
                "pending": "data/l2_pending_review.jsonl",
                "l4_from_pack": True,
                "brief_spec": {
                    "brief_id": "green_tea_gift",
                    "name": tea_fx.get("name") or "青绿茶礼盒",
                    "domain": "tea_beverage",
                    "core_terms": tea_fx.get("core_terms")
                    or ["茶", "绿茶", "青茶", "matcha", "green tea", "tea"],
                    "analogy_terms": tea_fx.get("analogy_terms")
                    or ["黄酒", "滋补礼", "阿胶", "酒礼盒", "国际简约"],
                    "noise_terms": tea_fx.get("noise_terms")
                    or ["咖啡", "宠物", "美妆", "视觉锤"],
                },
            },
            {
                "id": "r-huangjiu",
                "title": "黄酒礼盒气质对标",
                "date": "2026-08-05",
                "status": "done",
                "question": "黄酒/白酒礼盒：中式礼赠场里，怎样拉开金红仿古、做出可送人的现代气质？",
                "use_default_feeds": False,
                "wall": "data/briefs/baijiu_gift_main_wall.jsonl",
                "pending": None,
                "l4_from_pack": False,
                "l1": {
                    "brief_id": "baijiu_gift",
                    "raw_brief": baijiu_fx.get("summary")
                    or "白酒/黄酒礼盒包装；中式礼赠；类比茶礼与滋补礼盒",
                    "input": {
                        "brand": "（研究）黄酒礼盒",
                        "product": "黄酒/白酒礼盒",
                        "category_text": "黄酒 / 白酒礼盒",
                        "channel": "礼赠",
                        "audience": "商务馈赠、节日送礼",
                        "price_band": "中高端",
                        "culture_tone": "中式现代",
                        "must_have": ["礼赠体面", "开箱记忆点", "中式现代不仿古"],
                        "must_avoid": ["金红仿古堆砌", "廉价喜庆模板"],
                    },
                    "intent": {
                        "domain_id": "alcohol",
                        "domain_label_zh": "酒类",
                        "confidence": 0.86,
                        "style_prior": [
                            "chinese_ceremonial",
                            "chinese_modern",
                            "craft_material",
                            "luxury_gilt",
                        ],
                        "risk_notes": ["酒礼盒货架易金红仿古，需主动拉开"],
                    },
                },
                "brief_spec": {
                    "brief_id": "baijiu_gift",
                    "name": baijiu_fx.get("name") or "白酒礼盒",
                    "domain": "alcohol",
                    "core_terms": baijiu_fx.get("core_terms")
                    or ["白酒", "黄酒", "酒盒", "baijiu", "huangjiu", "sake"],
                    "analogy_terms": baijiu_fx.get("analogy_terms")
                    or ["茶礼", "滋补礼盒"],
                    "noise_terms": baijiu_fx.get("noise_terms")
                    or ["咖啡", "美妆", "宠物", "soda"],
                },
            },
            {
                "id": "r-tonic",
                "title": "滋补礼盒开箱记忆点",
                "date": "2026-07-28",
                "status": "done",
                "question": "阿胶/人参滋补礼盒：养生叙事如何做成开箱记忆，而不是药材堆砌？",
                "use_default_feeds": False,
                "wall": "data/briefs/tonic_gift_main_wall.jsonl",
                "pending": None,
                "l4_from_pack": False,
                "l1": {
                    "brief_id": "brief-tonic-gift",
                    "raw_brief": tonic_fx.get("summary")
                    or "阿胶/人参/燕窝等滋补礼盒包装",
                    "input": {
                        "brand": "（研究）滋补礼盒",
                        "product": "滋补礼盒",
                        "category_text": "阿胶 / 人参 / 燕窝礼盒",
                        "channel": "礼赠 + 养生电商",
                        "audience": "孝敬长辈、自我轻滋补",
                        "price_band": "中高端",
                        "culture_tone": "中式现代",
                        "must_have": ["开箱仪式感", "养生可信", "礼赠体面"],
                        "must_avoid": ["药材说明书堆砌", "仿古药房风"],
                    },
                    "intent": {
                        "domain_id": "health_tcm",
                        "domain_label_zh": "滋补保健与药企周边",
                        "confidence": 0.84,
                        "style_prior": [
                            "chinese_ceremonial",
                            "natural_organic",
                            "chinese_modern",
                            "craft_material",
                        ],
                        "risk_notes": ["滋补礼盒易做成仿古药房，需现代开箱结构"],
                    },
                },
                "brief_spec": {
                    "brief_id": "ejiao_gift",
                    "name": tonic_fx.get("name") or "阿胶滋补礼盒",
                    "domain": "health_tcm",
                    "core_terms": tonic_fx.get("core_terms")
                    or ["阿胶", "滋补", "人参", "燕窝", "tonic", "养生滋补"],
                    "analogy_terms": tonic_fx.get("analogy_terms")
                    or ["茶礼", "酒礼盒", "保健礼盒"],
                    "noise_terms": tonic_fx.get("noise_terms")
                    or ["咖啡", "宠物", "美妆口红"],
                },
            },
        ],
    }

    OUT.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "wrote": str(OUT.relative_to(ROOT)),
                "bytes": OUT.stat().st_size,
                "l4_cards": len(cards),
                "researches": len(runtime["researches"]),
                "ontology": len(runtime["ontology_lite"]),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
