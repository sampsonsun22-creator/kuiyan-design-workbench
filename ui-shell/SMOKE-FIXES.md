# KEY 视界 ui-shell · SMOKE-FIXES

Date: 2026-08-12 (Asia/Shanghai)  
Scope: `ui-shell/` only (`app.js` / `index.html`). Caliber untouched: **strict 1868 / 1079**. No `*_wide.jsonl`, no structural feed sync.

## Audit

| Check | Result |
|---|---|
| `node --check app.js` | OK |
| HTML IDs vs `$("…")` | All present (no missing IDs) |
| Live feeds | `data/l2_main_wall.jsonl` 1868 · `data/l2_pending_review.jsonl` 1079 |
| Preview :8766 | HTTP 200 for `/`, `app.js`, feeds |
| Strategy cards | 3× `l4_cards` in `demo-bundle.json` (留下/先放下 wired) |
| Grep TODO/FIXME | None in shell code |

## Bugs found

### P0 — fixed

1. **选中卡片导致主墙滚回顶部（阻塞浏览）**  
   `openInspector` / `toggleSelect` / `clearSelection` / Inspector 关闭会整页 `renderCanvas()`，1868 墙每次点选重建 DOM → 滚动丢失。  
   **Fix:** 新增 `syncWallSelectionClasses()`，选中态只 patch `.selected`；Inspector 开闭不再整墙重绘。`renderCanvas({ preserveScroll })` 留作需要全量重绘时的保险。

2. **视觉短名单是死路径**  
   文案承诺「勾几张进短名单」，但 `state.shortlistVisual` 从未写入；底栏只有「对比一下 / 打开原页」。  
   **Fix:** 底栏增加「收进短名单」(`data-sel-action="shortlist"`)，去重写入 `shortlistVisual`，并追加活动流提示。

3. **短名单 Tab 错误显示视觉筛选**  
   `updateFilterRow` 先按 `strategyMode` 隐藏来源，再被 `isStrategy`-only 逻辑改回显示；短名单页会漏出来源/风格/年份。  
   **Fix:** 来源/风格/年份仅 `visual` 显示；方向/气质仅 `strategy`；市场在 visual/strategy 显示。并加 `el.filters` 空值防护。

### Not bugs / left as-is

| Item | Notes |
|---|---|
| Keep / Kill（留下 / 先放下） | 策略卡 `data-decide` + 活动流 `data-card-action` → `setDecision` 正常 |
| 含待复核 toggle | `#pendingToggle` 在 `categoryChips` 委托里切换 `includePending` |
| 加载更多 / 无限滚动 | `#wallLoadMore` + `#wallSentinel` + `IntersectionObserver` |
| Inspector | 开/关、Brief 关系块正常；宽度 CSS token 300（文案曾写 ~320） |
| 市场/年份/方向/气质下拉 | 装饰性（无真实过滤）——非 P0，未做 drive-by |
| 「对比一下」 | 仍为 toast 演示（HUMANIZE 已记录） |
| `mergeFirecrawlIntoWall` | 已定义但 boot 未调用；**刻意不接**，以免打乱 strict 1868 口径（HUMANIZE 旧述过时） |

## Residual risks

- **Hotlink 失效：** 花瓣（huaban，主墙约 48 条）CDN 现返回 HTTP 567，缩略图会裂；Behance / 小红书 / Pinterest / PoTW / 站酷 / 京东 / 淘宝样本 HEAD/Range 正常。auth_key 长期仍可能过期。
- **Apify 货架：** 淘宝/京东 chip 仍为「待开通（Apify 额度）」；货架样本极薄（counts.shelf≈4）。
- **站酷薄页：** 仅 3 条，状态 chip 标「薄页/待深采」。
- **小红书/花瓣登录深采：** 活动流已说明未登录深采；当前墙靠公开/已采 URL。
- **对比并排 / 附件上传：** 演示占位，非正式能力。
- **远端图依赖网络：** 无本地镜像时离线预览墙图会空。

## Demo readiness

**Shell code: ready for user demo** on http://127.0.0.1:8766/  
主路径可用：真数据主墙 1868、待复核开关、点选 + Inspector（不甩滚动）、策略卡留下/先放下 → 短名单、视觉「收进短名单」、加载更多。  
口径锁定 strict；未改 jsonl。
