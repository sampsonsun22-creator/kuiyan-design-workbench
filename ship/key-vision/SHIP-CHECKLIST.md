# KEY 视界 · SHIP-CHECKLIST（P0）

Date: 2026-08-12（Asia/Shanghai）  
Ship root: `ship/key-vision/`  
Feeds: **main=452** · **pending=2680**  
FEED-STATUS: main_wall=452 · pending_review=2680 · feed=brief_relevance · shell_floor=452

## P0 must-pass

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Ban engineering / sample-mode chrome strings; strategy cards must NOT expose pack filenames | **PASS** | verify rg (excl. data) → 0 hits. Strategy UI: title / one_liner / advantage / buckets only. |
| 2 | Tone 你 / 这位同事；leadership honorific absent from empty ads | **PASS** | Caps/toasts/empty.hint use 你. |
| 3 | Wall top count N = real live feeds | **PASS** | `updateWallCountBar` → `主墙 ${main} · 待复核 ${pending}`；N=452/2680. |
| 4 | Collecting copy「墙还在长」 | **PASS** | boot + renderVisual empty slogan. |
| 5 | Default 只看贴 brief ON；pending not homepage main path | **PASS** | `onlyBriefRelevant: true`；`#briefToggle.active`；`includePending: false`. |
| 6 | Broken images hide or demote | **PASS** | onerror → `.img-broken-card` hidden via CSS. |
| 7 | Branding only {KEY} + KEY 视界 + 奎燕 AI 研究室 | **PASS** | index brand brick. |
| 8 | Empty states human + primary button；ban stock empty-data phrase | **PASS** | `.empty-cta` present；stock phrase grep clean. |

## Load path

| Step | Status | Evidence |
|------|--------|----------|
| Prefer live feeds first | **PASS** | `loadLiveFeeds()` before pack |
| Product pack naming | **PASS** | boot: L2 jsonl → `product-bundle.json` → `product-pack.json`；`l3.counts` main=452 pending=2680 |
| Failure states product tone | **PASS** | 「这会儿还没挂上参考」+「重新加载」 |

## Ship pack contents

- [x] index.html / app.js / styles.css / assets/
- [x] data/product-pack.json
- [x] data/l2_main_wall.jsonl (452) + hyphen alias
- [x] data/l2_pending_review.jsonl (2680) + hyphen alias
- [x] data/FEED-STATUS.json + style-buckets-v1.json
- [x] vercel.json
- [x] CHANNEL-DEBT.md
- [x] SHIP-CHECKLIST.md

## Gaps / notes

- Platform live lock is **452 / 2680**（this task did not rewrite L3 clean feeds）.
- ui-shell may keep a legacy pack filename for builders；ship does not reference it.
- concept.html cleaned in ui-shell but not shipped.
- Pack JSON may still carry internal fields；UI does not render them.
- Boot load: `product-bundle.json` → `product-pack.json`（已去掉 `demo-bundle` 回落）。
