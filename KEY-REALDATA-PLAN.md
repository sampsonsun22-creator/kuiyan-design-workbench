# KEY 视界 · 真实数据打通方案（今日最小闭环）

> Owner：奎燕数据分析专家（原 Data Crawler）  
> 状态：**UI 已接 452 主墙 + 3 张 L4 方向卡**（不改 jsonl 口径；Firecrawl 8 条未并进 452，避免破锁）  
> 日期：2026-08-12

## 目标

三位把关对齐后，让 `ui-shell` **视觉素材墙 + Inspector** 吃到真实 L2（含今日 Firecrawl 8 条），源状态条如实，货架在 Apify 额度外有可演示替代。不做大规模扩采。

---

## 1) `l2-firecrawl.jsonl`（8 条）如何并入素材墙 + Inspector

### 数据流（已存在）

```
L2 JSONL ──► L3-market-map.json（walls.primary.by_bucket / shelf / analogy）
         └──► item_catalog
                    │
                    ▼
         ui/build-demo-bundle.py
                    │
                    ▼
    ui/data/demo-bundle.json  ──copy──►  ui-shell/data/demo-bundle.json
                    │
                    ▼
         ui-shell/app.js · collectWallItems()
           · primary.by_bucket → 墙卡片
           · shelf.items / analogy.items
           · item_catalog 补 image_url / thumbnail / buckets
                    │
                    ▼
         openInspector(item) · 预览图 + 标题/来源 + Match/Learn/Risk
```

### 今日最小改法（确认后执行）

| 步骤 | 动作 |
|------|------|
| A | 把 `demo/e2e-green-tea-gift/l2-firecrawl.jsonl` 加入 `ui/build-demo-bundle.py` 的 `JSONL_SOURCES` |
| B | **去重**：同 `page_url` 优先保留 firecrawl 深采图；id 可 normalize 到既有 `behance:172938413-…` 以少碎裂 |
| C | 重算 / 增量写入 `L3-market-map.json` 的 `walls.primary.by_bucket`（style_buckets_v1 id → name_zh）与 `item_catalog`；`data_sources` 追加 `l2-firecrawl.jsonl` |
| D | `python3 ui/build-demo-bundle.py` → 同步到 `ui-shell/data/demo-bundle.json` |
| E | **Inspector 真实字段（小补丁）**：Match/Learn/Risk 下增加「采集字段」：`source` / `source_type` / `page_url` / 桶中文名 / `structure_tags` |

### 墙卡字段映射

| 墙 / Inspector | 来自 |
|----------------|------|
| thumb | `thumbnail_url` \|\| `image_url` |
| title | `title` |
| src 行 | `source` · `author_or_brand` |
| 桶分区 | bucket `name_zh` |
| Inspector 预览 | 同上图 |

奎燕并行灌墙若改同一 `demo-bundle`，以 **build 脚本重跑结果为准**。

---

## 2) Apify 额度超限时 · 货架替代路径

| 优先级 | 路径 | 今天能否出数 | 说明 |
|--------|------|--------------|------|
| **P0（推荐）** | **沿用已有 listing 级货架 4–6 条**（`l2-extra` 京东/淘宝 CDN） | **是** | 标 `shelf_level: listing`；演示够用 |
| P1 | **Browser Use 手工烟测 ≤3/平台** | 可（需人工过滑块） | 映射写 `shelf-smoke-manual-*.jsonl` |
| P2 | 手工 JSONL 样例 | 是 | 不爬 |
| — | Apify Actor | **否（月额度 hard limit）** | 恢复后按 `smoke/apify_smoke_plan.json` |
| — | Bright Data | 否（401） | 继续搁置 |

**建议今日默认：P0；不强制 Browser Use，除非点名要真深链。**

---

## 3) 源状态条「已接通 / 待开通」

`ui-shell/app.js` 的 `SOURCES` 建议改为：

| id | 标签 | 建议 status | 依据 |
|----|------|-------------|------|
| behance | Behance | **ok（已接通）** | Firecrawl + Tavily 已出数 |
| potw | POTW | **ok（已接通）** | Firecrawl 深采已出数 |
| zcool | 站酷 | **working（降级）** | Tavily 有图；Firecrawl 薄页 |
| taobao | 淘宝 | **pending（待开通）** | Apify 额度；仅 listing 样 |
| jd | 京东 | **pending（待开通）** | 同上 |
| pinterest | Pinterest | **pending** | 未打通 |
| huaban | 花瓣 | **pending** | 未打通 |
| xiaohongshu | 小红书 | **pending** | 未打通 |

能力栈 `CAPS.crawler`：名称改为 **奎燕数据分析专家**；`lastAction` → `Firecrawl 8 条已同步 · 货架待 Apify`。

---

## 4) 今天可交付 · 路径与命令（确认后执行）

### 将交付文件

| 路径 | 内容 |
|------|------|
| `demo/e2e-green-tea-gift/l2-firecrawl.jsonl` | **已有** 8 条 |
| `demo/e2e-green-tea-gift/L3-market-map.json` | 合并 firecrawl 后重算 |
| `ui/build-demo-bundle.py` | 加入 firecrawl + 去重 |
| `ui/data/demo-bundle.json` | 重建 |
| `ui-shell/data/demo-bundle.json` | 同步 |
| `ui-shell/app.js` | SOURCES 真实态；CAPS 更名；Inspector 采集字段 |
| `KEY-REALDATA-PLAN.md` | 本方案 |

### 命令

```bash
python3 /workspace/kuiyan-design-workbench/ui/build-demo-bundle.py
cp /workspace/kuiyan-design-workbench/ui/data/demo-bundle.json \
   /workspace/kuiyan-design-workbench/ui-shell/data/demo-bundle.json
cd /workspace/kuiyan-design-workbench/ui-shell && python3 -m http.server 8766
# http://127.0.0.1:8766/
```

### 验收

1. 墙「有图」可见 Firecrawl 高清 Behance/POTW  
2. Inspector 有真实 source / 桶  
3. 芯片：Behance/POTW=已接通；淘宝京东/Pinterest=待开通；站酷=降级  
4. 货架墙不空白（listing 样）

### 不在今日范围

大规模扩采 · Apify/Bright Data 修复 · 站酷深采攻坚 · Pinterest

---

## 请奎燕确认（勾选即开跑）

- [x] **A** 公网 `product-bundle.json` 写入 3 张 L4 卡（未把 firecrawl 8 条并进 452 主墙，避免破锁）
- [x] **B** 改源状态条：按主墙真实计数（Behance/Pinterest/花瓣/小红书已采集；淘宝/京东 listing 样）
- [x] **C** Inspector 增加采集字段块
- [x] **D** 货架仅保留 listing 样，不跑 Browser Use
- [ ] **E**（可选）Browser Use 京东/淘宝各 ≤3  

默认建议：**A+B+C+D**。
