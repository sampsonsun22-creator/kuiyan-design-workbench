# 标签合同（L2 Data Crawler ↔ L3/L4 Dot Dot）

## 风格桶
- 字段：`suggested_style_buckets: string[]`
- 值：**v1 id**（`L3/style-buckets-v1.json`）
- 展示：id → name_zh
- 禁止自造桶名；未知丢弃

## L3 分类视图必吃字段
`id, image_url, page_url, source, source_type, title, category_domain_id, category_label, is_on_market, market_region, raw_tags, suggested_style_buckets, query_used, collected_at, analogy_from?`

## 可选粗维（已在 sample 出现则保留）
`structure_tags[], structure_notes, color_palette, color_roles[], info_hierarchy, info_hierarchy_tags[]`

## design-pipeline → L2 映射（Dot Dot 侧 adapter）
| design-pipeline | L2 collection |
|---|---|
| id | id |
| images[0].url | image_url |
| url | page_url |
| source | source |
| title | title |
| author.name | author_or_brand |
| query | query_used |
| theme / tags | raw_tags（+ 后续打桶） |
| collected_at | collected_at |
| — | source_type 默认 inspiration；货架源再标 shelf |
| — | suggested_style_buckets 由 L3 或采集粗标 |

样例已验证：`L2-collector/samples/sample-run.jsonl` + `L3/consume_l2.py`。

## Adapter
`L3/adapt_design_pipeline.py`：design-pipeline normalized JSONL → L2 collection item。

