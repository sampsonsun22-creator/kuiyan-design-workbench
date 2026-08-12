# Dot Dot 交付索引（L3/L4 + 合同）

更新：2026-08-12

## 路径清单
| 交付 | 路径 |
|---|---|
| 20 风格桶（canonical ids） | `L3/style-buckets-v1.json` |
| 风格桶人读说明 | `L3/STYLE-BUCKETS.md` |
| L2→L3 消费脚本 | `L3/consume_l2.py` |
| 侯总市场地图 IA | `MARKET-MAP-IA.md` |
| L1 brief/意图 schema | `L1/brief-intent.schema.json` |
| L1 说明 | `L1/BRIEF-INTENT.md` |
| L4 策略卡 schema | `L4/strategy-card.schema.json` |
| L4 说明 | `L4/STRATEGY-CARD.md` |
| 标签合同 | `TAG-CONTRACT.md` + `tag-contract.json` |
| 本体（含 v1 桶） | `category-ontology.json` (v0.2) |

## 与 Data Crawler
- 已吃通：`L2-collector/samples/sample-run.jsonl`（桶 id 闭合）
- Schema enum 与 v1 ids 一致

## 角色
- 奎燕设计智能体：编排工作台叙事与客户侧话术
- Data Crawler：L2 采集按合同出数
- Dot Dot：L3 分类视图 + L4 策略卡模板与桶体系
