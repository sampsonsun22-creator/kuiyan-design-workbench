# Sample run notes — tea_beverage（青绿茶礼盒）

**collected_at (batch):** 2026-08-12T11:51:43Z
**domain:** `tea_beverage`
**queries:** 
- EN: `green tea packaging design gift box site:packagingoftheworld.com`
- EN: `tea packaging design gift box` (Behance domain filter)
- ZH: `青绿茶 礼盒 包装设计` (ZCOOL / gtn9 / POTW)

## What worked

1. **Tavily MCP `tavily_search`** — 成功返回 Packaging of the World、Behance 结果与图链；站酷返回作品页 URL + 文案摘要（图 CDN 未直接给出）。
2. **Tavily MCP `tavily_extract`** — 成功抽取:
   - `packagingoftheworld.com/.../panun-kehwa` 全文 + 多图 CDN
   - `behance.net/gallery/214846361/...` 多张 project module 图
3. **query_builder.py** — `tea_beverage` / brief「青绿茶礼盒包装」均可映射并输出 JSON query pack。

## What failed / friction

| attempt | result |
|---------|--------|
| Firecrawl CLI | `FIRECRAWL_API_KEY` 未配置；插件 skills 在 cache，无可用 key |
| curl_cffi 直连 POTW | Sucuri JS challenge → HTTP 307 小页面，无法拿正文 |
| WebFetch POTW | 同样命中 Sucuri redirect script |
| ZCOOL 图链 | Tavily search 摘要有文案无稳定 image CDN；Phase B 需 Firecrawl/Crawl4AI 深抽 |

## Item counts

- `sample-run.jsonl`: **10** lines
- with non-empty `image_url`: **7**
- with `page_url` only (ZCOOL): 3

## Pipeline implication for Phase B

- 公开设计站优先：**Tavily → Firecrawl（有 key）→ Crawl4AI 浏览器** 降级链。
- POTW 不要裸 curl；要浏览器或 Tavily/Firecrawl。
- 站酷深图、淘宝货架仍需专用通道（见 `SOURCE-FEASIBILITY.md`）。

## Crawl4AI spot-check

Command: `crwl crawl <Behance Bama Tea URL> -o markdown -O samples/raw_behance_bama.md -bc`

- Exit 0, ~10KB markdown written.
- Content was mostly Behance chrome/nav/footer — **project gallery not hydrated** (JS/login wall).
- Conclusion: for Behance deep pages prefer Tavily extract / Firecrawl / Official API over headless-without-auth.

Raw artifact kept: `samples/raw_behance_bama.md`
