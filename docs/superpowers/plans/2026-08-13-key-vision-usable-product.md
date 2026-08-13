# KEY 视界 usable product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make KEY 视界 a clickable, five-layer product that boots the locked 452/2680 live wall (not a demo stub) and can be opened outside this VM.

**Architecture:** Static client in `ui-shell/` ships to `ship/key-vision/`. Visual wall reads `l2_main_wall.jsonl`; L1/L5 cards read slim `product-bundle.json`. Do not rewrite jsonl. Public product URL historically is `https://key-vision.vercel.app` via repo `key-vision`; this workbench branch already has the five-layer shell that production does not.

**Tech Stack:** Vanilla JS static shell, Python validators, Playwright smoke, GitHub static hosting.

## Global Constraints

- Do not rewrite `ui-shell/data/l2_main_wall.jsonl` or `l2_pending_review.jsonl`
- Main 452 MD5 `6d85197702ecce5e799a6d956b6c7ead` / pending 2680 MD5 `b2691bc0783c64ddb0bcce0c160bf977`
- Do not invent 跨界 / 用户评论 / 开箱 / 成本 data
- Do not load `data/briefs/green_tea_gift_main_wall.jsonl` as default green wall
- Forbidden calibers: 410, 401, 304, 274, 184, 1820 / `image_gate`
- Do not use Vercel CLI to promote production unless that is the only way to publish the already-built `ship/key-vision` client; prefer syncing the public static tree / a preview URL
- AGENT-LAYERS.md is product truth: L4 = shortlist, L5 = report + 方向假设
- Counts on screen must come from the 452 wall: 同类 446 / 不同类 2 / 跨界 0 / 货架 4

---

## Task 1: Honest wall when remote thumbs die

**Files:** `ui-shell/app.js`, `ui-shell/styles.css`, `ui-shell/index.html` (cache bust), then `python3 scripts/ship_key_vision.py`

- [ ] Expand `isFragileImageHost` to hosts already observed failing from this shell: `gd-hbimg` / huaban, `xhscdn` / xiaohongshu, `img.zcool.cn`
- [ ] Stop hiding broken cards (`hidden=true` / `display:none` on `.img-broken-card`). Show a visible placeholder: title + source + 「图链失效」. Card stays clickable for inspector fields.
- [ ] Count bar must still report 主墙 452; do not drop broken thumbs from `wallItems`
- [ ] Cache-bust `?v=452live`
- [ ] Run `python3 scripts/assert_shell_strict.py`, `validate_ui_data_landing.py`, `ship_check.py`, `node --check ui-shell/app.js`
- [ ] Commit

## Task 2: Playwright smoke against live 452

**Files:** `scripts/e2e_key_vision_smoke.mjs` (or `.spec.js`)

- [ ] Serve `ship/key-vision` on localhost
- [ ] Assert boot: wall cards render, count bar mentions 452 or brief-filtered count from that wall
- [ ] Role chips: 同类 446 · 不同类 2 · 跨界 0 · 货架 4
- [ ] Brief tab shows 青绿茶礼盒 from live bundle
- [ ] 决策筛选 has 8–12 cards with 路线/贴 brief/风格桶/来源/检索词
- [ ] 结论报告 has sections 1–6 and does not contain invented 「满版热闹」
- [ ] Cross chip empty state 「本轮跨界样本 0，不编造」
- [ ] Commit

## Task 3: Public clickable URL

- [ ] After push, try a public preview of `ship/key-vision` (jsDelivr HTML is text/plain — do not rely on it)
- [ ] If GitHub allows, sync `ship/key-vision` to `sampsonsun22-creator/key-vision` (this is the documented public client). That is product publish, not a new crawl.
- [ ] If key-vision push is denied, add a GitHub Pages workflow from `ship/key-vision` and report the blocker
- [ ] Do not invent that production is updated if the push failed
- [ ] Update PR; report the URL the user can actually open
