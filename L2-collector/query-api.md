# Query API — 品类无关检索词生成

## 目的

把任意 brief / domain 映射成可执行的 **primary / analogy / shelf** 查询包 + **source_plan**，供 L2 采集器消费。

## 输入

```json
{
  "domain_id": "tea_beverage",
  "free_text_brief": "青绿茶礼盒包装",
  "language": ["zh", "en"],
  "market": ["CN"],
  "channel": ["gift", "ecommerce"],
  "price_band": "premium",
  "cultural_tone": "中式现代"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| domain_id | 否* | ontology `primary_domains[].id`；与 brief 二选一或同时给 |
| free_text_brief | 否* | 自由文本；用于推断 domain |
| language | 否 | 默认 `["zh","en"]` |
| market | 否 | 如 `CN` `JP` `global` |
| channel | 否 | `gift` `ecommerce` `retail` `duty_free` … |
| price_band | 否 | `mass` `premium` `luxury` |
| cultural_tone | 否 | 对齐 style_buckets，如 `中式现代` |

\* 至少提供 `domain_id` 或 `free_text_brief` 之一。

## 处理步骤

1. **Map domain**：`domain_id` 直接命中；否则对 brief 做关键词匹配（examples / name / kuiyan_cases / id 子串）。
2. **Primary queries**：EN+ZH 包装设计检索式（含 packaging / 礼盒 / 包装设计）。
3. **Analogy expansion**：取 ontology `analogy_seeds` + 适用 `cross_analogy_rules`，生成 analogy_queries。
4. **Shelf queries**：面向淘宝/京东/抖音的中文货架词（礼盒、罐装、即饮等）。
5. **source_plan**：按 SOURCE-FEASIBILITY 优先级列出源 + method + 用哪类 query。

## 输出

```json
{
  "domain_id": "tea_beverage",
  "category_label": "茶与即饮/新茶饮相关包装",
  "primary_queries": ["..."],
  "analogy_queries": ["..."],
  "shelf_queries": ["..."],
  "source_plan": [
    {"source": "behance", "method": "Tavily / Official API", "query_group": "primary", "priority": "P0"}
  ],
  "style_bucket_hints": ["中式现代", "自然有机"],
  "analogy_seeds": ["咖啡", "酒"]
}
```

## 契约

见同目录 `query_builder.py`：

```python
from query_builder import build_query_pack

pack = build_query_pack(
    domain_id="tea_beverage",
    free_text_brief=None,
    language=["zh", "en"],
    market=["CN"],
    channel=["gift"],
)
# -> dict 可 json.dumps
```

Schema：`query-api.schema.json`。
Ontology：`/workspace/kuiyan-design-workbench/category-ontology.json`。
