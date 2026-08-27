#!/usr/bin/env python3
"""Build slim product-bundle.json for KEY 视界 (L1 + L3 summary + L4 cards).

Does NOT rewrite ui-shell/data/l2_*.jsonl (452/2680 lock).
Strips item_catalog and pending wall item dumps so the public client
can load L4 strategy cards without a 5MB JSON.
product-pack.json is a safe alias of the same slim artifact.
"""
from __future__ import annotations

import copy
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ui-shell" / "data"
MAIN = DATA / "l2_main_wall.jsonl"
PEND = DATA / "l2_pending_review.jsonl"
BUCKETS = ROOT / "L3" / "style-buckets-v1.json"
L1 = ROOT / "demo" / "e2e-green-tea-gift" / "L1-brief-intent.json"
L4_CARDS = [
    ROOT / "demo" / "e2e-green-tea-gift" / "L4-card-cm-01-v2.json",
    ROOT / "demo" / "e2e-green-tea-gift" / "L4-card-gm-02-v2.json",
    ROOT / "demo" / "e2e-green-tea-gift" / "L4-card-cc-03-v2.json",
]
LOCAL_REF = {
    "card-cm-01-v2": "assets/ref1.png",
    "card-gm-02-v2": "assets/ref2.jpg",
    "card-cc-03-v2": "assets/ref3.png",
}
MONTAGE_ALIASES = {
    # listing-level id is not on the 452 wall
    "behance:search-tea-ology": "behance:216540701-theory-of-tea",
}
OUT_NAMES = ("product-bundle.json", "product-pack.json")
OUT_DIRS = [
    DATA,
    ROOT / "ship" / "key-vision" / "data",
    ROOT / "ship" / "key-vision-vercel" / "data",
]


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def https_url(url: str) -> str:
    u = str(url or "").strip()
    if u.startswith("http://"):
        return "https://" + u[len("http://") :]
    return u


def wall_role(row: dict) -> str:
    if str(row.get("source_type") or "").lower() == "shelf":
        return "shelf"
    rel = (row.get("extra") or {}).get("brief_relevance_v1") or ""
    if row.get("analogy_from") or rel == "keep_analogy":
        return "analogy"
    return "primary"


def sanitize_l1(raw: dict) -> dict:
    l1 = copy.deepcopy(raw)
    inp = l1.setdefault("input", {})
    brand = str(inp.get("brand") or "")
    if "演示" in brand or "demo" in brand.lower():
        inp["brand"] = "新品牌·青绿茶"
    return l1


def channel_status(counts: Counter) -> list[dict]:
    def row(sid: str, label: str, *, listing: bool = False, thin_if_lt: int | None = None) -> dict:
        n = int(counts.get(sid, 0))
        if listing:
            if n:
                return {
                    "id": sid,
                    "label": label,
                    "status": "thin",
                    "statusText": f"listing 样 · {n}",
                    "count": n,
                    "note": "货架深采通道待开通；主墙仅有 listing 级样本",
                }
            return {
                "id": sid,
                "label": label,
                "status": "pending",
                "statusText": "货架通道待开通",
                "count": 0,
                "note": "Apify 额度外；不假装已连通",
            }
        if n == 0:
            return {
                "id": sid,
                "label": label,
                "status": "pending",
                "statusText": "待采集",
                "count": 0,
            }
        if thin_if_lt is not None and n < thin_if_lt:
            return {
                "id": sid,
                "label": label,
                "status": "thin",
                "statusText": f"薄页 · {n}",
                "count": n,
            }
        return {
            "id": sid,
            "label": label,
            "status": "ok",
            "statusText": f"已采集 · {n}",
            "count": n,
        }

    return [
        row("behance", "Behance"),
        row("packagingoftheworld", "Packaging of the World"),
        row("pinterest", "Pinterest"),
        row("huaban", "花瓣"),
        row("xiaohongshu", "小红书"),
        row("zcool", "站酷", thin_if_lt=8),
        row("taobao", "淘宝", listing=True),
        row("jd", "京东", listing=True),
    ]


def enrich_cards(cards: list[dict], catalog: dict[str, dict], id_to_zh: dict[str, str]) -> list[dict]:
    out = []
    for raw in cards:
        card = dict(raw)
        cid = card.get("card_id") or ""
        if cid in LOCAL_REF:
            card["local_ref_image"] = LOCAL_REF[cid]
        buckets = card.get("recommended_style_buckets") or []
        card["recommended_style_buckets_zh"] = [id_to_zh.get(b, b) for b in buckets]
        montage = []
        for m in card.get("reference_montage") or []:
            mm = dict(m)
            iid = mm.get("item_id") or ""
            if iid in MONTAGE_ALIASES:
                mm["item_id"] = MONTAGE_ALIASES[iid]
                iid = mm["item_id"]
            hit = catalog.get(iid)
            if hit:
                mm["image_url"] = https_url(
                    mm.get("image_url") or hit.get("image_url") or hit.get("thumbnail_url") or ""
                )
                mm["title"] = mm.get("title") or hit.get("title") or ""
                mm["page_url"] = https_url(mm.get("page_url") or hit.get("page_url") or "")
            else:
                mm["image_url"] = https_url(mm.get("image_url") or "")
                mm["page_url"] = https_url(mm.get("page_url") or "")
            montage.append(mm)
        card["reference_montage"] = montage
        cover = card.get("local_ref_image") or ""
        if not cover:
            cover = next((m.get("image_url") for m in montage if m.get("image_url")), "")
        card["cover_image"] = cover
        card["demo_disclaimer"] = "方向示意 · 非完稿"
        out.append(card)
    return out


def main() -> int:
    main_rows = load_jsonl(MAIN)
    pend_rows = load_jsonl(PEND)
    if len(main_rows) != 452 or len(pend_rows) != 2680:
        raise SystemExit(
            f"refuse: expected 452/2680, got {len(main_rows)}/{len(pend_rows)}"
        )

    buckets_doc = load_json(BUCKETS)
    id_to_zh = {b["id"]: b.get("name_zh") or b["id"] for b in buckets_doc.get("buckets") or [] if b.get("id")}
    zh_to_id = {v: k for k, v in id_to_zh.items()}

    l1 = sanitize_l1(load_json(L1))
    catalog = {r["id"]: r for r in main_rows if r.get("id")}
    cards = enrich_cards([load_json(p) for p in L4_CARDS], catalog, id_to_zh)

    src_main = Counter(str(r.get("source") or "") for r in main_rows)
    src_pend = Counter(str(r.get("source") or "") for r in pend_rows)
    roles = Counter(wall_role(r) for r in main_rows)
    primary_n = int(roles.get("primary", 0))
    shelf_n = int(roles.get("shelf", 0))
    analogy_n = int(roles.get("analogy", 0))

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    bundle = {
        "meta": {
            "product": "KEY 视界",
            "brief_id": l1.get("brief_id") or "brief-green-tea-gift-20260812",
            "main_wall": 452,
            "pending_review": 2680,
            "qc_mode": "brief_relevance_v1",
            "shell_floor": 452,
            "updated_at": now,
            "footer": "KEY 视界 · 主墙 452 · 待复核 2680 · 策略卡为方向示意非完稿",
            "generated_from": [
                "ui-shell/data/l2_main_wall.jsonl",
                "ui-shell/data/l2_pending_review.jsonl",
                "L4-card-cm-01-v2.json",
                "L4-card-gm-02-v2.json",
                "L4-card-cc-03-v2.json",
                "L3/style-buckets-v1.json",
            ],
            "note": "slim pack: L1+L3 summary+L4 cards; visual wall reads live jsonl",
        },
        "l1": l1,
        "l3": {
            "brief_id": l1.get("brief_id"),
            "generated_at": now,
            "counts": {
                "main_wall": 452,
                "pending_review": 2680,
                "primary": primary_n,
                "shelf": shelf_n,
                "analogy": analogy_n,
                "qc_mode": "brief_relevance_v1",
            },
            "source_distribution": {
                "main": {k: v for k, v in src_main.most_common() if k},
                "pending": {k: v for k, v in src_pend.most_common(12) if k},
            },
            "l1_summary": {
                "domain": (l1.get("intent") or {}).get("domain_label_zh") or "茶礼",
                "channel": (l1.get("input") or {}).get("channel") or "礼赠+电商",
                "tone": (l1.get("input") or {}).get("culture_tone") or "中式现代",
                "price_band": (l1.get("input") or {}).get("price_band") or "中高端",
            },
            "ai_recommended_buckets": [
                {"id": "chinese_modern", "name_zh": "中式现代", "why": "Brief 主气质"},
                {"id": "chinese_ceremonial", "name_zh": "中式典雅/礼赠", "why": "礼赠仪式感"},
                {"id": "global_minimal", "name_zh": "国际简约", "why": "拉开喜庆货架"},
                {"id": "regional_culture", "name_zh": "地域文旅", "why": "茶产地叙事"},
                {"id": "craft_material", "name_zh": "工艺材质感", "why": "开箱材质升级"},
            ],
            "channel_status": channel_status(src_main),
            "walls": {
                "primary": {"count": primary_n, "note": "主品类角色；主墙仍读 l2_main_wall.jsonl 452"},
                "analogy": {"count": analogy_n, "note": "类比样本偏薄；keep_analogy 仅 2"},
                "shelf": {"count": shelf_n, "note": "source_type=shelf listing 样，深采待开通"},
                "pending_review": {"count": 2680, "note": "默认不进首页主路径；点「含待复核」再加载"},
            },
            "feed_source": "ui-shell/data/l2_main_wall.jsonl",
            "truth_source": "brief_relevance_v1",
        },
        "l4_cards": cards,
        "bucket_id_to_zh": id_to_zh,
        "bucket_zh_to_id": zh_to_id,
        "style_buckets_ref": "style-buckets-v1.json",
    }

    text = json.dumps(bundle, ensure_ascii=False, indent=2) + "\n"
    for dest_dir in OUT_DIRS:
        dest_dir.mkdir(parents=True, exist_ok=True)
        for name in OUT_NAMES:
            dest = dest_dir / name
            dest.write_text(text, encoding="utf-8")
            print(f"wrote {dest} bytes={dest.stat().st_size} l4={len(cards)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
