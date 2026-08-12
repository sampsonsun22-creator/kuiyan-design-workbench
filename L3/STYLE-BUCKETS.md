# 风格桶 v1（L3）

面向侯志奎的「看全、选对」分类语言。机器存 **id**，界面与策略卡显示 **name_zh**。

## 规则
- 约 20 桶，全局共用；品类只调默认权重，不另起一套桶。
- 多标签：每条参考 1–3 个桶。
- 枚举闭合：只接受 `style-buckets-v1.json` 的 id；L2 若仍给 v0 中文名，用 `migration_from_v0` 映射。
- 与 Data Crawler：`suggested_style_buckets[]` 写 id（见 `../tag-contract.json` 与 `../L2-collector/collection-schema.json`）。

## 奎燕案例锚点（帮助对齐话术）
| 案例 | 优先桶 |
|---|---|
| 味知香「炖5’/炒3’」 | efficacy_hammer + appetite_photo |
| 厚雪夜场低度酒 | nightlife_trend + color_youth |
| 尊乐笑脸肠超级符号 | efficacy_hammer + cartoon_ip（符号向） |
| 吾茶白抹茶 | chinese_modern / global_minimal（依具体稿） |
| 茶礼/黄酒礼盒 | chinese_ceremonial + chinese_modern |

## 消费
```bash
python /workspace/kuiyan-design-workbench/L3/consume_l2.py \
  /workspace/kuiyan-design-workbench/L2-collector/samples/sample-run.jsonl
```
按桶聚合 → 填市场地图「主品类墙」。
