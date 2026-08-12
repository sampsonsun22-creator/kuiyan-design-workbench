# L2 Universal Collector（奎燕 Design Workbench）

品类无关的灵感 / 货架采集层。Brief → ontology 映射 → query pack → 多源采集 → 归一化为 collection item → 交给 Dot Dot / L3。

## 路径

| path | 作用 |
|------|------|
| `SOURCE-FEASIBILITY.md` | 设计源 + 货架源可行性与 Phase B 优先级 |
| `query-api.md` / `query-api.schema.json` | 查询生成接口文档与 schema |
| `query_builder.py` | 可运行的 query pack 构建器 |
| `collection-schema.json` / `SCHEMA.md` | 采集条目 schema |
| `samples/sample-run.jsonl` | 真实小样（tea_beverage） |
| `samples/SAMPLE-NOTES.md` | 本次样例：何物可用 / 何物被墙 |
| `../category-ontology.json` | 品类本体（domain / analogy / style buckets） |
| `../CATEGORY-MAP.md` | 人读品类表 + 风格桶 |

## 快速跑 query pack

```bash
python /workspace/kuiyan-design-workbench/L2-collector/query_builder.py tea_beverage
python /workspace/kuiyan-design-workbench/L2-collector/query_builder.py "青绿茶礼盒包装"
```

依赖：仅标准库 + 本体 JSON。

## Dot Dot / L3 如何消费 `suggested_style_buckets`

1. **枚举闭合（v1）**：机器字段只接受 `L3/style-buckets-v1.json` 的 **id**（snake_case）。`collection-schema.json` enum 已锁 id。若遇到 v0 中文桶名，用 `migration_from_v0` 映射；未知桶丢弃，不要新建。
2. **侯总/UI 展示**：用 id→`name_zh`（中式现代、瑞士国际主义…）；L4 策略卡对外写中文名，对内存 id。
3. **多标签**：一条 1–3 个桶；L3 按共现计权，品类只调默认权重（见 ontology `engine_invariant.L3`）。
4. **类比追溯**：若 item 来自 analogy 检索，读 `analogy_from`；主品类穷尽结果该字段为空。
5. **货架 vs 灵感**：`source_type=shelf` 且 `is_on_market=true` 优先用于货架墙；inspiration/award 用于造型与叙事。
6. **消费脚本**：`python /workspace/kuiyan-design-workbench/L3/consume_l2.py samples/sample-run.jsonl`

推荐读取流水线：

```
sample-run.jsonl (或 Phase B 全量)
  → filter by category_domain_id / query_used
  → groupby suggested_style_buckets
  → Dot Dot moodboard / L3 tagger
```

## 采集方法现状（本机）

- Tavily MCP：可用（样例已用 search + extract）
- Firecrawl：插件在 cache，**缺 API key**
- crawler-stack venv：crawl4ai / scrapling / curl_cffi 已装；POTW 有 Sucuri，裸 HTTP 不够
- CN 电商与 Pinterest：见 SOURCE-FEASIBILITY — 需 Bright Data / Apify / Browser Use

## 无 secrets

本目录文档与样例不含 API key / Cookie。密钥只走环境变量（如 `FIRECRAWL_API_KEY`、`BEHANCE_API_KEY`）。
