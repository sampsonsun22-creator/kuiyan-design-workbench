# L1 Brief → 意图识别

## 目标
把任意品类 brief 变成引擎可执行的：`domain_id` + 类比计划 + 查询计划 + 风格先验。

## 输入字段（`input`）
品牌、产品、品类自由文本、渠道、人群、价格带、文化气质、竞品、必须有/必须避免、场景、约束。

## 输出（`intent`）
| 字段 | 说明 |
|---|---|
| domain_id | 映射到 `category-ontology.json` primary_domains；未知 → `other_fmcg` |
| confidence | 映射把握 |
| analogy_plan | 启用哪些跨品类边 |
| query_plan | inspiration / shelf / analogy 查询串（交给 L2 query_builder） |
| style_prior | 风格桶 **id** 列表（L3 推荐桶的先验） |
| risk_notes | 如「易做成仿古」「渠道是夜场勿礼盒红金」 |

## 示例（青绿茶礼盒）
见 schema；典型：`domain_id=tea_beverage`，style_prior 含 `chinese_ceremonial`, `chinese_modern`, `natural_organic`。

机器可读：`brief-intent.schema.json`。
