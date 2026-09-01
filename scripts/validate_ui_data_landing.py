#!/usr/bin/env python3
"""Validate UI ↔ data landing without rewriting the 452/2680 jsonl lock."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "ui-shell" / "data" / "l2_main_wall.jsonl"
PEND = ROOT / "ui-shell" / "data" / "l2_pending_review.jsonl"
BUNDLE = ROOT / "ui-shell" / "data" / "product-bundle.json"
APP = ROOT / "ui-shell" / "app.js"
HTML = ROOT / "ui-shell" / "index.html"
SHIP_BUNDLE = ROOT / "ship" / "key-vision" / "data" / "product-bundle.json"
FORBIDDEN_GREEN = "briefs/green_tea_gift_main_wall.jsonl"


def nlines(p: Path) -> int:
    return sum(1 for line in p.open(encoding="utf-8") if line.strip())


def main() -> int:
    err: list[str] = []
    n, p = nlines(MAIN), nlines(PEND)
    if n != 452:
        err.append(f"main_wall={n} expected 452 (lock broken)")
    if p != 2680:
        err.append(f"pending={p} expected 2680 (lock broken)")

    bundle = json.loads(BUNDLE.read_text(encoding="utf-8"))
    cards = bundle.get("l4_cards") or []
    if len(cards) != 3:
        err.append(f"product-bundle l4_cards={len(cards)} expected 3")
    titles = [c.get("title") for c in cards]
    for t in ("青绿新中轴", "静奢留白", "开箱仪式"):
        if t not in titles:
            err.append(f"missing L4 card {t}")
    if not bundle.get("l1"):
        err.append("product-bundle missing l1")
    if bundle.get("meta", {}).get("main_wall") != 452:
        err.append("bundle meta.main_wall != 452")
    if "item_catalog" in bundle:
        err.append("slim bundle must not embed item_catalog")

    ship = json.loads(SHIP_BUNDLE.read_text(encoding="utf-8"))
    if len(ship.get("l4_cards") or []) != 3:
        err.append("ship product-bundle missing l4_cards")

    app = APP.read_text(encoding="utf-8")
    html = HTML.read_text(encoding="utf-8")
    if "const SAVED" in app:
        err.append("app.js still uses cosmetic SAVED list")
    if "data/briefs/green_tea_gift_main_wall.jsonl" in app:
        err.append("app.js must not load stale 184 green tea brief file")
    if "l4_cards.filter" in app and "(state.bundle.l4_cards || [])" not in app:
        # keptCards must guard
        if "state.bundle.l4_cards.filter" in app:
            err.append("keptCards is unguarded (will throw when l4_cards missing)")
    if 'data-cat="primary"' not in html:
        err.append("index.html missing 主品类 chip")
    if 'data-cat="analogy"' not in html:
        err.append("index.html missing 类比 chip")
    if 'data-cat="shelf"' not in html:
        err.append("index.html missing 货架 chip")
    if "loadProductBundle" not in app:
        err.append("app.js missing loadProductBundle")
    if "采集字段" not in app:
        err.append("inspector missing 采集字段")
    if "未标注" not in app:
        err.append("inspector missing 未标注 fallback")

    # 五层壳：四个页签 + L1/L4/L5 渲染 + 诚实口径
    for tab in ("intent", "visual", "shortlist", "report"):
        if f'data-tab="{tab}"' not in html:
            err.append(f"index.html missing tab {tab}")
    if 'data-cat="cross"' not in html:
        err.append("index.html missing 跨界 chip")
    for fn in ("function renderIntent", "function renderReport", "function renderShortlist"):
        if fn not in app:
            err.append(f"app.js missing {fn}")
    if "ensureShortlist" not in app or "rescreenByComment" not in app:
        err.append("app.js missing L4 shortlist / 重筛 engine")
    if "按批注重筛" not in app:
        err.append("app.js missing 按批注重筛 control")
    if "不发起新采集" not in app:
        err.append("重筛 must state it is not a new crawl")
    if "本轮跨界样本 0，不编造" not in app:
        err.append("cross chip missing honest empty state")
    if "c.hidden=true" in app:
        err.append("broken thumbs must stay on the wall (do not hide the card)")
    if "图链失效" not in app:
        err.append("broken thumbs need a visible 图链失效 placeholder")
    if "expiredHuabanCount" not in app or "花瓣" not in app:
        err.append("count bar must state expired 花瓣 image links")
    if "本轮未采集" not in app:
        err.append("app.js missing 本轮未采集 wording for uncollected dimensions")
    for faked in ("色块与留白节奏可借鉴", "开箱清单"):
        if faked in app:
            err.append(f"app.js still ships invented prose {faked!r}")
    dims = ROOT / "ui-shell" / "data" / "classify-dimensions-v1.json"
    if not dims.exists():
        err.append("missing ui-shell/data/classify-dimensions-v1.json (L3 dimension contract)")
    else:
        dims_doc = json.loads(dims.read_text(encoding="utf-8"))
        group_ids = {g.get("id") for g in dims_doc.get("groups") or []}
        if not {"visual_style", "experience", "commerce"} <= group_ids:
            err.append("classify-dimensions-v1.json missing 视觉/体验/商业 groups")
        if not (ROOT / "ship" / "key-vision" / "data" / "classify-dimensions-v1.json").exists():
            err.append("ship missing classify-dimensions-v1.json")
    if "function wallRole" not in app:
        err.append("app.js missing wallRole")
    if "isUnsafePack" not in app:
        err.append("app.js missing isUnsafePack")
    if "loadPendingFeed" not in app:
        err.append("app.js missing lazy pending loader")
    if 'wallRole(it) === "primary"' not in app:
        err.append("primary chip must filter wallRole===primary")
    if "data/l2_main_wall_a.jsonl" in app:
        full = app.find("data/l2_main_wall.jsonl")
        split = app.find("data/l2_main_wall_a.jsonl")
        if full < 0 or split < full:
            err.append("app.js must prefer full wall before split files")
    if 'data-filter="market" hidden' not in html:
        err.append("market filter must stay hidden")
    if 'data-filter="year" hidden' not in html:
        err.append("year filter must stay hidden")
    if "btnNewResearch" in html:
        chunk = html.split("btnNewResearch", 1)[1][:180]
        if "disabled" in chunk:
            err.append("新建研究 must be enabled")
        if "新建研究" not in html:
            err.append("index.html missing 新建研究 label")
    if 'id="btnLlmSettings"' not in html or 'id="llmOverlay"' not in html:
        err.append("missing LLM settings UI")
    if 'id="briefOverlay"' not in html:
        err.append("index.html missing brief slot dialog")
    if "function openBriefDialog" not in app or "function commitBriefDialog" not in app:
        err.append("app.js missing brief slot dialog")
    if "还缺「" in app and 'title: "追问"' in app:
        err.append("center column must not trap users with 追问 bubbles")
    if "function createNewResearch" not in app:
        err.append("app.js missing createNewResearch")
    if "function openLlmSettings" not in app or "AGENT_LLM_META" not in app:
        err.append("app.js missing LLM config")
    if "async function rescreenByComment" not in app:
        err.append("app.js missing async 按批注重筛")
    if "briefLaneLex" not in app:
        err.append("app.js missing Brief-aware lane reclassify")
    if "function pageUrlOf" not in app or "data-wall-link" not in app:
        err.append("app.js missing per-card origin linkage (pageUrlOf / data-wall-link)")
    if "原页未标注" not in app:
        err.append("missing honest 原页未标注 fallback (do not invent URLs)")
    if "source-kicker" not in app:
        err.append("source bar must render compact 出处 kicker")

    pack = ROOT / "ui-shell" / "data" / "product-pack.json"
    if pack.exists():
        pack_doc = json.loads(pack.read_text(encoding="utf-8"))
        if "item_catalog" in pack_doc:
            err.append("product-pack.json must be slim (no item_catalog)")
        if pack.stat().st_size > 200_000:
            err.append(f"product-pack.json too large ({pack.stat().st_size})")
        if len(pack_doc.get("l4_cards") or []) != 3:
            err.append("product-pack.json missing l4_cards")
        counts = ((pack_doc.get("l3") or {}).get("counts") or {})
        if counts.get("image_gate"):
            err.append("product-pack.json still has image_gate")
    else:
        err.append("missing product-pack.json slim alias")

    if BUNDLE.stat().st_size > 200_000:
        err.append(f"product-bundle.json too large ({BUNDLE.stat().st_size})")
    counts = ((bundle.get("l3") or {}).get("counts") or {})
    if counts.get("primary") != 446 or counts.get("analogy") != 2 or counts.get("shelf") != 4:
        err.append(f"bundle role counts {counts.get('primary')}/{counts.get('analogy')}/{counts.get('shelf')} expected 446/2/4")
    wall_ids = {json.loads(line)["id"] for line in MAIN.open(encoding="utf-8") if line.strip()}
    for card in cards:
        cover = card.get("cover_image") or card.get("local_ref_image") or ""
        if cover.startswith("http://"):
            err.append(f"card {card.get('card_id')} http cover")
        for m in card.get("reference_montage") or []:
            iid = m.get("item_id") or ""
            if iid and iid not in wall_ids:
                err.append(f"montage {iid} not on 452 wall")
            if str(m.get("image_url") or "").startswith("http://"):
                err.append(f"montage {iid} uses http")
    for rel in ("assets/ref1.png", "assets/ref2.jpg", "assets/ref3.png"):
        if not (ROOT / "ui-shell" / rel).exists():
            err.append(f"missing {rel}")

    if "PET_FOOD_PACK_FEED" in app or "loadPetFoodDirectedWall" in app or "PET_FOOD_PACK_LOCK" in app:
        err.append("app.js must not reopen directed 061423/093316 pack bind")
    if "l2-brief-pet-food-pack-20260827T061423Z.jsonl" in app:
        err.append("app.js must not bind directed 061423 jsonl")
    if "benyan:orijen-original-bagfront" in app or "orijenpetfoods.com" in app:
        err.append("app.js must not hardcode Orijen directed SKU")
    if "royalcanin.com.cn/cats/products/1639" in app:
        err.append("app.js must not hardcode 皇家 I27 directed SKU")
    if "皇家犬" in app:
        err.append("app.js must not hardcode extra SKU 皇家犬")
    if "isBenyanResearch" not in app or "loadBenyanResearchWall" not in app:
        err.append("app.js missing 本研调研 wall after Brief product pin")
    if "passesBagFrontQc" not in app:
        err.append("app.js missing bag-front QC")
    if "isPendingReview" not in app or "benyanBriefSpecies" not in app or "benyanShortlistFormed" not in app:
        err.append("app.js missing 本研 pending / 猫犬 / 短名单未成立 gates")
    if "短名单未成立" not in app:
        err.append("app.js must report 短名单未成立")
    if "短名单据此成立" in app or "按袋面成立" in app or "短名单按本研袋面成立" in app:
        err.append("app.js must not claim 短名单成立 for 本研")
    if "假设 · 非完稿" in app or "假设·非完稿" in app:
        err.append("L5/direction cards must not stamp 假设·非完稿")
    if "示意 · 非完稿" in app or "示意·非完稿" in app:
        err.append("L5/direction cards must not stamp 示意·非完稿")
    if "方向假设 · 非完稿" in app:
        err.append("L5/direction cards must not stamp 方向假设 · 非完稿")
    if 'collect_method === "api_pack_collect"' not in app:
        err.append("app.js shortlist must require extra.collect_method===api_pack_collect")
    if 'PET_FOOD_DIRECTED = ""' not in app and "PET_FOOD_DIRECTED=\"\"" not in app:
        err.append("app.js must keep PET_FOOD_DIRECTED empty")
    if "briefs/pet_food_main_wall.jsonl" in app:
        err.append("app.js must not bind pet_food concept wall")
    if "452p47" not in html:
        err.append("index.html cache bust must be ?v=452p47")
    if "/api/pack/collect" not in app or "collectPackOnPin" not in app:
        err.append("app.js missing collectPackOnPin /api/pack/collect hook")
    if "JSON.stringify({ product_name })" not in app and "JSON.stringify({ product_name: name })" not in app:
        err.append("app.js must POST product_name only")
    if "ensurePetFoodDirectedWall" in app:
        err.append("app.js must not call ensurePetFoodDirectedWall")
    if "saveBriefFillDialog" not in app or "saveCustomBriefFromDom" not in app:
        err.append("app.js missing Brief pin sites")
    if "saveBriefFillDialog" not in app:
        err.append("app.js missing saveBriefFillDialog alias")
    if "benyanSessionPending" not in app:
        err.append("app.js missing session pending ingest")
    if "自动采" in app:
        err.append("app.js must not say 自动采")
    if "CONTEXT_DEV_API_KEY=" in app or "ctxt_secret_" in app:
        err.append("app.js must not embed Context.dev secret")
    if "TAVILY_API_KEY=" in app or "tvly-" in app:
        err.append("app.js must not embed Tavily secret")
    collect_js = ROOT / "ship" / "key-vision-live" / "api" / "pack" / "collect.js"
    if not collect_js.exists():
        err.append("missing ship/key-vision-live/api/pack/collect.js")
    else:
        collect = collect_js.read_text(encoding="utf-8")
        if "payload.product" not in collect:
            err.append("collect.js must read brief.product")
        if "api.tavily.com/search" not in collect or "api.tavily.com/extract" not in collect:
            err.append("collect.js must call Tavily search/extract")
        if "TAVILY_API_KEY" not in collect:
            err.append("collect.js must read TAVILY_API_KEY")
        if 'PET_FOOD_DIRECTED = ""' not in collect:
            err.append("collect.js must keep PET_FOOD_DIRECTED empty")
        if 'channel: "playwright"' in collect or "playwright_official" in collect:
            err.append("collect.js must not impersonate playwright")
        if "STAPLES" in collect or "gG2W7r" in collect or "pxmshare" in collect:
            err.append("collect.js must not hardcode STAPLES / pxmshare bag URLs")
        if "ds-ori-original" in collect or "PNG_2000" in collect:
            err.append("collect.js must not hardcode Orijen/Hills bag URLs")
        if "localhost" in collect or "vercel.app" in collect:
            err.append("collect.js must not hardcode preview hosts")
        if "ctxt_secret_" in collect or "CONTEXT_DEV_API_KEY=" in collect:
            err.append("collect.js must not embed Context.dev secret")
        if "tvly-" in collect:
            err.append("collect.js must not embed Tavily secret")
        if "100121540384" in collect or "35482167913" in collect or "709835" in collect:
            if "BANNED_JD" not in collect:
                err.append("collect.js must not hardcode 093316 SKUs")
        if "自动采" in collect:
            err.append("collect.js must not say 自动采")
        if "no_truncate" not in collect:
            err.append("collect.js must reject short product names with no_truncate")
    if "100121540384" in app or "35482167913" in app or "709835" in app:
        err.append("app.js must not hardcode 093316 SKUs")
    server_py = (ROOT / "scripts" / "key_vision_server.py").read_text(encoding="utf-8")
    if "/api/pack/collect" not in server_py or "_handle_pack_collect" not in server_py:
        err.append("key_vision_server.py missing /api/pack/collect")
    if "自动采" in server_py:
        err.append("key_vision_server.py must not say 自动采")
    ship_py = (ROOT / "scripts" / "ship_key_vision.py").read_text(encoding="utf-8")
    if "api" not in ship_py or "collect.js" not in ship_py:
        err.append("ship_key_vision.py must copy api/pack/collect.js")
    shipped_collect = ROOT / "ship" / "key-vision-vercel" / "api" / "pack" / "collect.js"
    if not shipped_collect.exists():
        err.append("ship/key-vision-vercel missing api/pack/collect.js")

    tonic = ROOT / "ui-shell" / "data" / "briefs" / "tonic_gift_main_wall.jsonl"
    baijiu = ROOT / "ui-shell" / "data" / "briefs" / "baijiu_gift_main_wall.jsonl"
    if not tonic.exists() or nlines(tonic) < 50:
        err.append("missing tonic brief wall")
    if not baijiu.exists() or nlines(baijiu) < 50:
        err.append("missing baijiu brief wall")

    cp = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "assert_shell_strict.py")],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if cp.returncode != 0:
        err.append("assert_shell_strict failed: " + (cp.stdout or cp.stderr)[:400])

    out = {"ok": not err, "main": n, "pending": p, "l4_cards": len(cards), "errors": err}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if not err else 1


if __name__ == "__main__":
    raise SystemExit(main())
