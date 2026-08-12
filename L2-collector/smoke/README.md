# L2 smoke tests（勿大规模扩采）

| 脚本 | 用途 | 触发 |
|------|------|------|
| `firecrawl_smoke.sh` | Firecrawl 最小双页 scrape | 奎燕写入 `FIRECRAWL_API_KEY` 后下令 |
| `apify_smoke_plan.json` | 淘宝/京东 Actor 输入 + MCP runbook | 奎燕下令货架烟测 |
| `map_apify_shelf.py` | Apify dataset → collection-schema JSONL | Actor 跑完后映射 |

## Firecrawl
```bash
export FIRECRAWL_API_KEY='…'   # or firecrawl login
bash /workspace/kuiyan-design-workbench/L2-collector/smoke/firecrawl_smoke.sh
```

## Apify shelf（由 Data Crawler 经 MCP 执行，各 ≤3）
见 `apify_smoke_plan.json`。映射：
```bash
python map_apify_shelf.py --platform jd --query 绿茶礼盒 \
  --in out/apify-jd-raw.json \
  --out ../samples/shelf-smoke-jd.jsonl --limit 3
```
