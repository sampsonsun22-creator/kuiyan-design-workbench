# L2 通用采集源可行性评估（Phase A）

品类无关：源站固定；检索词随 ontology 映射后的 domain / analogy / shelf 变化。
评估时点：2026-08。诚实标注硬墙（登录墙 / 反爬）。

## 设计灵感 / 奖项 / 作品集

| source | type | scrape feasibility | recommended method | login needed? | rate-limit / legal notes | category-agnostic query tips | priority Phase B |
|--------|------|--------------------|--------------------|---------------|--------------------------|------------------------------|------------------|
| Behance | inspiration / portfolio | medium | Official API（有 key）> Firecrawl / Tavily search+extract > Crawl4AI | 否（部分项目需登录看全） | Adobe ToS；API 有配额；勿批量下载原图商用 | `"{product} packaging design"` / `茶包装 礼盒`；field=packaging | **P0** |
| KEY Behance portfolio（甲方/奎燕/标杆品牌一作） | portfolio | easy–medium | 同上；按作者 URL 定点抓 gallery | 否 | 优先白名单作者；保留 license_or_rights_note | 用作者 slug / project id，非宽搜 | **P0**（一作参考） |
| Packaging of the World | inspiration | medium | Tavily extract / Firecrawl；直连 curl_cffi 常遇 Sucuri JS 墙 → Browser Use / Crawl4AI | 否（投稿需登录） | 公开画廊；注明出处；Sucuri 挑战 | `/category/beverages/tea` + 关键词 `gift box` / 品类 EN | **P0** |
| Dribbble | inspiration | medium | Firecrawl / Tavily；官方 API 有限 | 否（高清有时需登录） | ToS 限制爬虫；控制频次 | `packaging` + product EN；shot tags | P1 |
| Pinterest | inspiration | **hard / blocked** | Bright Data / Apify Actor / Browser Use（登录态） | **是**（强登录墙） | 反爬极严；Cookie 易失效；版权灰区 | board / keyword EN+ZH；不宜作为主链路 | P2（有代理再开） |
| 站酷 ZCOOL | inspiration / portfolio | medium | Firecrawl / Crawl4AI / Tavily；Scrapling 备用 | 否（部分需登录） | 国内 CDN；注意版权声明 | `茶叶礼盒包装` / `{品类}包装设计` | **P0**（CN） |
| 古田路9号 gtn9 | inspiration / award | medium–hard | Browser Use / Firecrawl；列表 JS 重 | 偶发 | 广告/登录弹层；频次保守 | `包装设计` + 品类中文 | P1 |
| Pentawards（公开页） | award | medium | Tavily / Firecrawl 公开 winners | 否 | 仅公开获奖页；勿绕过会员墙 | year + category packaging | P1 |
| Red Dot Award（公开） | award | medium | 官方公开 winner 页 + Tavily | 否 | 同上 | product design / packaging winners | P1 |
| iF Design Award（公开） | award | medium | 官方公开库 + Tavily | 否 | 同上 | packaging / food & beverage | P1 |
| Brand sites（标杆品牌官网） | portfolio | easy–hard（站异） | Firecrawl / curl_cffi / Crawl4AI | 否 | robots.txt；仅抓产品/包装页 | 品牌名 + product line；ontology cases | P1 |

## 货架（CN ecommerce）

| source | type | scrape feasibility | recommended method | login needed? | rate-limit / legal notes | category-agnostic query tips | priority Phase B |
|--------|------|--------------------|--------------------|---------------|--------------------------|------------------------------|------------------|
| Taobao / Tmall | shelf | **hard / blocked** | **Bright Data / Apify Actor / Browser Use**（登录+滑块） | 常需要 | 强反爬；验证码；法律/ToS 风险高；仅采主图/标题/价格带元数据 | `{品类} 礼盒` / `{SKU关键词}`；按价格带过滤 | P1（有代理） |
| JD 京东 | shelf | hard | Bright Data / Apify / Browser Use | 偶发 | 反爬次于淘宝仍强；控制并发 | 同上 + 京东类目词 | P1 |
| Douyin ecommerce 抖音电商 | shelf | **hard** | Browser Use / Apify；官方开放平台优先 | 常需要 | 强风控；短视频页结构易变 | 直播/商城关键词；品类+礼盒 | P2 |

## 方法选型速查

| 场景 | 首选 | 备选 |
|------|------|------|
| 公开设计站（Behance/POTW/ZCOOL） | Tavily search+extract / Firecrawl | Crawl4AI、Scrapling、curl_cffi |
| Sucuri / Cloudflare JS 墙 | Browser Use / Crawl4AI（真浏览器） | Bright Data unlocker |
| 登录墙（Pinterest） | Bright Data / Apify + 持久会话 | Browser Use |
| CN 电商货架 | Bright Data / Apify Actor | Browser Use（人工过滑块） |
| 官方有 API | Official API | — |

## Phase B 建议顺序

1. Behance（API 或 Tavily）+ Packaging of the World + 站酷 — 覆盖全球灵感与国潮。
2. KEY Behance portfolio 白名单 — 一作/标杆沉淀。
3. 奖项公开页（Pentawards / Red Dot / iF）。
4. 货架：有 Bright Data/Apify 后再开 Taobao/JD；否则货架仅人工/截图入库。
5. Pinterest / 抖音 — 最后，需稳定登录态。

> 本机实测（2026-08-12）：`FIRECRAWL_API_KEY` 未配置；Tavily MCP 可用；curl_cffi 直连 POTW 遇 Sucuri 307；Tavily extract 可拿 POTW/Behance 正文与图链。
