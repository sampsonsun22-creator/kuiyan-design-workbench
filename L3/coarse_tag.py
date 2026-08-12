#!/usr/bin/env python3
"""Heuristic L3 coarse style-bucket tagging for L2 items (max 3 v1 ids).

Conservative: only tag when query/title/tags hit clear keywords.
Empty buckets OK when unsure (contract). Does not invent from thin air.
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = json.loads((ROOT / "L3/style-buckets-v1.json").read_text())
IDS = set(V1["ids"])

# (bucket_id, patterns) — matched against lower(title+query+tags)
RULES: list[tuple[str, list[str]]] = [
    ("chinese_ceremonial", [r"礼盒", r"礼赠", r"中式典雅", r"典雅", r"tea gift", r"gift box", r"ceremon", r"国潮礼", r"茶叶包装", r"tea packaging"]),
    ("chinese_modern", [r"中式现代", r"新中式", r"chinese modern", r"国潮(?!礼)", r"品牌包装", r"brand packaging", r"包装设计", r"packaging design", r"package design", r"product packaging"]),
    ("global_minimal", [r"国际简约", r"极简(?!白)", r"minimal(?! white)", r"swiss", r"瑞士", r"global minimal", r"clean packaging"]),
    ("swiss_international", [r"瑞士国际", r"helvetica", r"grid system", r"国际主义"]),
    ("natural_organic", [r"自然有机", r"organic", r"草本", r"herbal", r"natural", r"绿叶", r"植物"]),
    ("luxury_gilt", [r"奢华", r"金箔", r"烫金", r"gilt", r"luxury", r"premium", r"black gold"]),
    ("minimal_white", [r"极简白", r"白盒", r"minimal white", r"white box", r"空白"]),
    ("color_youth", [r"年轻潮", r"色彩冲击", r"荧光", r"y2k", r"潮玩色", r"colorful youth"]),
    ("cartoon_ip", [r"卡通", r"ip联名", r"萌系", r"cartoon", r"mascot", r"可爱包装"]),
    ("retro_nostalgia", [r"复古", r"怀旧", r"retro", r"vintage", r"nostalg"]),
    ("craft_material", [r"材质", r"工艺", r"特种纸", r"craft", r"emboss", r"纹理", r"纸感"]),
    ("appetite_photo", [r"食欲", r"摄影", r"food photo", r"食欲风", r"实拍食品", r"appetite"]),
    ("illustration_story", [r"插画", r"illustration", r"手绘", r"叙事插画", r"story illustr"]),
    ("efficacy_hammer", [r"功效", r"成分", r"科学", r"clinical", r"efficacy", r"视觉锤", r"visual hammer", r"语言钉", r"超级符号"]),
    ("regional_culture", [r"地域", r"文旅", r"地方特产", r"regional", r"非遗", r"产地"]),
    ("pet_cute", [r"宠物", r"pet ", r"猫粮", r"狗粮"]),
    ("maternal_safe", [r"母婴", r"baby", r"婴幼儿", r"maternal"]),
    ("nightlife_trend", [r"夜场", r"nightlife", r"电音", r"酒吧包装"]),
    ("sustainable_plain", [r"可持续", r"环保", r"再生纸", r"sustainable", r"eco[- ]?friendly", r"无塑"]),
    ("art_collab", [r"跨界", r"艺术限量", r"联名艺术", r"art collab", r"artist edition"]),
]

# Query → default bucket priors (applied if no keyword hit, still packaging-ish)
QUERY_PRIOR = {
    "视觉锤": ["efficacy_hammer", "chinese_modern"],
    "品牌视觉锤": ["efficacy_hammer", "chinese_modern"],
    "visual hammer": ["efficacy_hammer", "global_minimal"],
    "Laura Ries visual hammer": ["efficacy_hammer"],
    "visual hammer branding": ["efficacy_hammer", "global_minimal"],
    "品牌包装设计": ["chinese_modern", "chinese_ceremonial"],
    "品牌包装": ["chinese_modern"],
    "食品包装设计": ["appetite_photo", "chinese_modern"],
    "food packaging": ["appetite_photo", "global_minimal"],
    "茶叶包装": ["chinese_ceremonial", "natural_organic"],
    "tea packaging": ["chinese_ceremonial", "natural_organic"],
    "化妆品包装": ["minimal_white", "luxury_gilt"],
    "cosmetic packaging": ["minimal_white", "luxury_gilt"],
    "skincare packaging": ["minimal_white", "natural_organic"],
    "酒包装设计": ["luxury_gilt", "craft_material"],
    "wine packaging": ["luxury_gilt", "craft_material"],
    "饮料包装": ["color_youth", "appetite_photo"],
    "beverage packaging design": ["color_youth", "global_minimal"],
    "礼盒包装": ["chinese_ceremonial", "luxury_gilt"],
    "gift box packaging design": ["chinese_ceremonial", "luxury_gilt"],
    "luxury packaging": ["luxury_gilt", "minimal_white"],
    "packaging design": ["chinese_modern", "global_minimal"],
    "package design": ["global_minimal", "chinese_modern"],
    "product packaging": ["global_minimal", "chinese_modern"],
    "brand packaging": ["chinese_modern", "global_minimal"],
    "包装设计": ["chinese_modern", "chinese_ceremonial"],
    "visual identity packaging": ["global_minimal", "efficacy_hammer"],
    "brand visual identity packaging": ["global_minimal", "efficacy_hammer"],
}


def _text(item: dict) -> str:
    parts = [
        item.get("title") or "",
        item.get("query_used") or "",
        " ".join(item.get("raw_tags") or []),
        " ".join((item.get("extra") or {}).get("theme") or []) if isinstance((item.get("extra") or {}).get("theme"), list) else str((item.get("extra") or {}).get("theme") or ""),
    ]
    return " ".join(parts).lower()


def tag_item(item: dict) -> list[str]:
    existing = [b for b in (item.get("suggested_style_buckets") or []) if b in IDS]
    if existing:
        return existing[:3]
    text = _text(item)
    hits: list[str] = []
    for bid, pats in RULES:
        for p in pats:
            if re.search(p, text, re.I):
                if bid not in hits:
                    hits.append(bid)
                break
        if len(hits) >= 3:
            return hits[:3]
    if hits:
        return hits[:3]
    q = (item.get("query_used") or "").strip()
    prior = QUERY_PRIOR.get(q) or []
    return [b for b in prior if b in IDS][:3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--overwrite-existing", action="store_true", help="retag even if buckets present")
    args = ap.parse_args()
    n = tagged = empty = 0
    with args.input.open() as fin, args.output.open("w") as fout:
        for line in fin:
            if not line.strip():
                continue
            item = json.loads(line)
            n += 1
            if args.overwrite_existing:
                item["suggested_style_buckets"] = []
            buckets = tag_item(item)
            item["suggested_style_buckets"] = buckets
            item.setdefault("extra", {})
            if isinstance(item["extra"], dict):
                item["extra"]["coarse_tag"] = "l3_heuristic_v1"
            if buckets:
                tagged += 1
            else:
                empty += 1
            fout.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(json.dumps({"wrote": n, "tagged": tagged, "empty_buckets": empty, "out": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
