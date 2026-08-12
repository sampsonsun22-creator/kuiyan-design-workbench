# 采数通道开通清单（可执行）

> 目标：通道打到「能稳定出数」。**不扩采**。  
> 审计时间：2026-08-12（Asia/Shanghai）  
> Owner：Data Crawler · 对接：奎燕 / Dot Dot

## 0. 总览（当下能不能出数）

| 通道 | 插件/MCP | 实测状态 | 稳定出数？ | 阻塞 |
|------|----------|----------|------------|------|
| Tavily | MCP `user-Tavily` connected | search/extract OK | **是（P0 主链）** | — |
| Firecrawl | 插件 789 已装（skills only，无 MCP） | CLI `v1.19.6`：**Not authenticated** | 否 | 缺 `FIRECRAWL_API_KEY` / login |
| Bright Data | MCP `user-Bright Data` 显示 connected | `search_engine` / `scrape_as_markdown` → **HTTP 401 Auth method is not supported** | 否 | 账号凭证类型不匹配，需重授/换 API token |
| Apify | MCP `user-Apify` connected | search-actors OK；电商 Actor 可用 | **可（货架主推荐）** | 跑 Actor 有计费；需小样验收 |
| Browser Use | MCP `user-Browser-use` connected | tools ready | **可（人工过墙备用）** | 需人工登录/滑块；不宜批量 |
| Playwright | MCP connected | ready | 可（公开页） | 国内电商反爬弱 |
| Crawl4AI / Scrapling | `/workspace/crawler-stack/.venv` | 已装 | 可（公开设计站深图） | POTW Sucuri 仍难 |
| 开源 curl_cffi | 同上 | 已装 | 部分站 | 勿当电商主链 |

**建议稳态主链（开通后）**

1. 灵感公开站：Tavily →（有 key）Firecrawl scrape → Crawl4AI/Browser Use  
2. 货架：Apify Actor（淘宝/京东）→ Bright Data Unlocker（修好 401 后）→ Browser Use 人工兜底  
3. 站酷深图：Firecrawl / Crawl4AI / Tavily extract（已验证部分 CDN）  
4. Pinterest：**最后开**（登录墙）；Bright Data 修好后或 Apify/Browser Use

---

## 1. Firecrawl

### 现状
- 插件 **已安装**（id `789`，10 个 skills：scrape/search/crawl/map/…）
- **没有**独立 MCP server（靠 CLI `npx firecrawl` / `firecrawl`）
- 本机实测：`npx -y firecrawl-cli@1.19.6 --status` → **Not authenticated**（无 env、无 `.firecrawl` 缓存）
- Node 当前 v20；CLI 包提示 prefer Node ≥22（可用但有 EBADENGINE 警告）

### 缺什么
| 项 | 字段名 / 动作 |
|----|----------------|
| API Key（推荐） | 环境变量 **`FIRECRAWL_API_KEY`**（firecrawl.dev 控制台复制） |
| 或浏览器登录 | `firecrawl login --browser` / `firecrawl login --api-key "<key>"` |
| CLI 初始化（可选） | `npx -y firecrawl-cli@1.19.6 init -y --browser` |

密钥**不要**写进 repo / JSONL；只放环境变量或 CLI login 本地凭据。

### Yang 开通步骤（最短）
1. 打开 [https://www.firecrawl.dev](https://www.firecrawl.dev) 注册/登录，复制 API Key  
2. 在 Data Crawler 对话里提供 key（走安全输入），或在 box 上执行：  
   `export FIRECRAWL_API_KEY='…'`  
   持久化可写入 `~/.bashrc` 或 `firecrawl login --api-key '…'`  
3. 跑下方验证命令；绿了即算开通

### 最小验证命令
```bash
# 1) 状态
npx -y firecrawl-cli@1.19.6 --status
# 期望：Authenticated via FIRECRAWL_API_KEY（或 login）

# 2) 单页 scrape（设计站公开页）
npx -y firecrawl-cli@1.19.6 scrape "https://www.behance.net/gallery/172938413/_" \
  --format markdown -o /tmp/fc-behance.md

# 3) 成功判据
test -s /tmp/fc-behance.md && head -c 200 /tmp/fc-behance.md
```
无 key 时有极低额度 keyless 档，**不可当稳定生产**。

### 开通后用途（对 L2）
- Behance / 站酷 / POTW 深页：补齐 `image_url`、正文标签  
- 替换「仅有 page_url、无图」的薄样本

---

## 2. 电商货架（淘宝 / 京东 / 抖音）

### 推荐路径（优先级）

| 优先级 | 路径 | 适合 | 现状 |
|--------|------|------|------|
| **P0** | **Apify Actor** | 淘宝/天猫搜索+详情、京东搜索；抖音偏视频/带货内容 | MCP **已连通**；Actor 库已检索到 |
| P1 | Bright Data Web Unlocker / scrape | 任意商品 URL 解锁正文+图 | MCP 显示 connected，**调用 401** |
| P2 | Browser Use + 人工登录 | 滑块/验证码、小样 3–10 条 | MCP ready；成本=人工时间 |
| — | 裸 Playwright / curl | 不推荐主链 | 易被拦；e2e 仅拿到 listing CDN 图 |

### 2.1 Apify（推荐立刻验收）

**现状**：`user-Apify` connected，`search-actors` 可用。

**推荐 Actor（小样用）**

| 平台 | Actor | 用途 |
|------|-------|------|
| 淘宝/天猫 | `zen-studio/taobao-search-scraper` 或 `sian.agency/taobao-tmall-product-scraper` | keyword → 标题/价/主图/URL |
| 京东 | `zen-studio/jd-com-search-scraper` 或 `sian.agency/jd-com-product-scraper` | 同上 |
| 抖音 | `zen-studio/douyin-search-scraper` 等 | **视频/带货内容**，非标准货架 SKU；包装静帧需从封面/商品卡二次抽 |

**开通/验收步骤**
1. 确认 Apify 账户有余额 / Free tier（Yang 已授权 MCP 即可先跑小样）  
2. Data Crawler 跑 **maxItems=3** 烟测（不扩采）：
   - 京东：`keyword=绿茶礼盒`，`maxItems=3`，`enrichWithDetails=false`  
   - 淘宝：`keyword=绿茶礼盒`，`maxItems=3`  
3. 映射进 `collection-schema`：`source=jd|taobao`，`source_type=shelf`，`is_on_market=true`，主图→`image_url`  
4. 落盘建议：`L2-collector/samples/shelf-smoke-{jd,taobao}.jsonl`（仅烟测时写）

**最小验证（由 Data Crawler 执行，勿大规模）**
```text
Apify MCP → call-actor
  actor: zen-studio/jd-com-search-scraper
  input: { "keyword": "绿茶礼盒", "maxItems": 3 }
→ get-dataset-items → 确认每条有 title + image + product url
```

### 2.2 Bright Data（此前 / 当前 401）

**复现（2026-08-12）**
```text
CallMcpTool user-Bright Data / search_engine  → HTTP 401: Auth method is not supported
CallMcpTool user-Bright Data / scrape_as_markdown(example.com) → 同上
```
MCP 状态条显示 `connected`，但 API **拒绝当前鉴权方式**（常见：OAuth/错误 token 类型、未开通 Web Unlocker/SERP zone、或需 API token 而非浏览器会话）。

**开通步骤（Yang）**
1. 登录 Bright Data 控制台，确认：
   - 有可用 **API token**（或 MCP 要求的 auth 类型）  
   - Web Unlocker / Scraping Browser / SERP 等 zone 已启用且有额度  
2. 在 Cursor 对 **Bright Data** 连接卡执行 **重新授权**（force reauth / 换正确凭证）  
3. Data Crawler 复测：
   - `search_engine` query=`绿茶礼盒包装`  
   - `scrape_as_markdown` url=任一京东商品详情公开页  
4. 两者皆非 401 即算恢复

**修好后用途**：商品深链 HTML→主图/卖点；Pinterest/POTW 解锁备用。

### 2.3 Browser Use（兜底）

**现状**：connected；工具 `browser_exec` / `browser_screenshot`。

**开通步骤**
1. 无需额外 key（已连）  
2. 烟测：打开京东搜索页 → 截主图区 → 人工确认未进登录死循环  
3. 若遇滑块：`request_box_help` 让 Yang 在 box 桌面过验证，会话可复用  

**约束**：只做 **≤5 条** 深链补图；不做翻页批量。

### 2.4 抖音说明
- Apify 侧多为 **短视频/达人** Actor，不是天猫式货架 schema  
- 包装灵感：用搜索封面 / 商品卡图 → 映射 `source=douyin`，`source_type=shelf|inspiration`  
- 真货架 SKU 优先淘宝/京东 Actor

---

## 3. Pinterest / 站酷深图

### 优先级

| 源 | 优先级 | 推荐通道 | 现状 | 下一步 |
|----|--------|----------|------|--------|
| **站酷 ZCOOL** | **P0** | Tavily extract（已用）→ Firecrawl scrape（有 key）→ Crawl4AI | e2e 已拿到 CDN 图 | Firecrawl 开通后做「作品页→全尺寸图」烟测 |
| Behance | P0 | Tavily extract / Firecrawl | 可用；偶发无图 | 同左 |
| POTW | P0 | Tavily / Firecrawl / Browser Use | Sucuri 挡裸 HTTP | 勿 curl；用浏览器或已验证抽取 |
| **Pinterest** | **P2（最后）** | Bright Data（401 修好后）→ Apify Pinterest Actor → Browser Use 登录态 | 未开；强登录墙 | BD 修好后再开 3 条烟测 |

### 站酷深图最小验证（Firecrawl 开通后）
```bash
npx -y firecrawl-cli@1.19.6 scrape \
  "https://www.zcool.com.cn/work/ZNzAzNDQzOTI=.html" \
  --format markdown -o /tmp/fc-zcool.md
# 期望：markdown 内含 img.zcool.cn 大图 URL，可回填 image_url
```

### Pinterest 开通条件（全满足再动）
1. Bright Data 401 已消 **或** 选定 Apify Pinterest Actor 有额度  
2. Yang 明确允许（版权灰区）  
3. 烟测 **≤5 pins**，只采公开图 URL + page_url，写入 schema 后停

---

## 4. Phase B 自动打标 → L2 collection-schema 接口草图

> 精细桶仍归 Dot Dot；Phase B 是 L2 **粗标自动填**，输出仍遵守 `collection-schema.json` + `style_buckets_v1`（maxItems=3）。

### 4.1 位置与契约
- 输入：已归一化的 L2 item（可缺 `suggested_style_buckets` / 结构色维）  
- 输出：**同一 schema** 的 item（只填/改粗标字段，不发明新顶层键）  
- 枚举：仅 `L3/style-buckets-v1.json` 的 id  
- 消费：现有 `L3/consume_l2.py` / `adapt_design_pipeline.py` **无需改协议**

### 4.2 建议模块
```
/workspace/kuiyan-design-workbench/L2-collector/
  auto_tag.py          # Phase B 入口
  collection-schema.json
```

### 4.3 函数草图（Python）

```python
# auto_tag.py — sketch only
from typing import Any

STYLE_IDS = {...}  # load from ../L3/style-buckets-v1.json

def auto_tag_item(item: dict[str, Any], *, mode: str = "coarse") -> dict[str, Any]:
    """Fill coarse tags in-place-copy. Never invent non-enum bucket ids.
    mode=coarse: ≤3 style buckets + optional structure/info/color when signal exists.
    Empty arrays OK — L3 may overwrite with fine tags.
    """
    out = dict(item)
    text = " ".join([
        out.get("title") or "",
        out.get("author_or_brand") or "",
        " ".join(out.get("raw_tags") or []),
        out.get("query_used") or "",
        (out.get("extra") or {}).get("ocr_or_caption") or "",
    ]).lower()

    buckets = list(out.get("suggested_style_buckets") or [])
    if not buckets:
        buckets = infer_style_buckets(text, out)  # rules + optional VLM
    out["suggested_style_buckets"] = [b for b in buckets if b in STYLE_IDS][:3]

    if not out.get("structure_tags"):
        out["structure_tags"] = infer_structure_tags(text, out)  # e.g. box_type:gift_box
    if not out.get("info_hierarchy_tags"):
        out["info_hierarchy_tags"] = infer_info_tags(text, out)  # subset of enum
    if not out.get("color_roles"):
        out["color_roles"] = infer_color_roles(out)  # [] if no signal

    out.setdefault("extra", {})
    out["extra"]["phase_b"] = {"mode": mode, "tagger": "l2_auto_tag_v0"}
    return out

def auto_tag_jsonl(in_path: str, out_path: str) -> None:
    """Read JSONL → write JSONL; one item per line; schema-valid."""
    ...
```

### 4.4 CLI / I/O
```bash
python L2-collector/auto_tag.py \
  --in  demo/e2e-green-tea-gift/l2-extra.jsonl \
  --out demo/e2e-green-tea-gift/l2-extra.tagged.jsonl \
  --mode coarse
```

### 4.5 推理层级（实现顺序）
1. **规则**（可立刻做）：礼赠/礼盒→`chinese_ceremonial`；新中式→`chinese_modern`；极简白→`minimal_white`；插画→`illustration_story`；有机/自然→`natural_organic`  
2. **可选 VLM**（图 URL）：只在 `image_url` 非空时调用；结果仍映射到 v1 id，**不得**输出中文桶名  
3. Dot Dot 精细标：增量文件覆盖同 `id`；L2 粗标保留作先验

### 4.6 与 Dot Dot 边界
| 字段 | L2 Phase B | L3 Dot Dot |
|------|------------|------------|
| suggested_style_buckets | 0–3 粗标 | 可重打，出增量 |
| structure_tags / info_hierarchy_tags / color_roles | 有信号才填 | 精细补全 |
| 新维度 | 不擅自加顶层字段 | 可经 TAG-CONTRACT 扩 |

---

## 5. Yang 待办（开通清单勾选）

- [ ] **Firecrawl**：提供 `FIRECRAWL_API_KEY` 或完成 `firecrawl login` → 跑 §1 验证  
- [ ] **Bright Data**：控制台核 token/zone → Cursor 重授 MCP → 确认不再 401  
- [ ] **Apify 货架烟测**：授权 Data Crawler 跑京东/淘宝各 ≤3 条（计费确认）  
- [ ] **Pinterest**：暂缓，等 Bright Data 修复后再议  
- [ ] **Phase B**：确认后由 Data Crawler 落地 `auto_tag.py` v0（规则版，不扩采）

## 6. Data Crawler 等待指令

当前：**暂停扩采**。收到下列之一再动：
- A. Yang 填好 Firecrawl key → 我做设计站深图烟测  
- B. Bright Data 重授完成 → 我复测 Unlocker  
- C. 批准 Apify 货架烟测（各 ≤3）→ 出 `shelf-smoke-*.jsonl`  
- D. 启动 Phase B `auto_tag.py` 规则版  

联系：完成后路径回写本文件顶部「审计时间」并通知奎燕。
