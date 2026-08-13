# KEY 视界 · 正式静态客户端

产品：{KEY} · KEY 视界 · 奎燕 AI 研究室

五层：Brief → 竞品版图 → 决策筛选 → 结论报告（合同见仓库根 `AGENT-LAYERS.md`）。

数据：
- 主墙 / 待复核：`data/l2_main_wall.jsonl`（452）+ `data/l2_pending_review.jsonl`（2680）
- Brief + 三张方向假设卡：`data/product-bundle.json`（精简包，含 `l4_cards`）
- 白酒 / 滋补样本墙：`data/briefs/*_main_wall.jsonl`（仅主墙，无策略卡）

诚实口径：同类 446 · 不同类 2 · 跨界 0 · 货架 4。花瓣 / 小红书 / 站酷图链常失效，卡片仍留在墙上。

本地预览：

```bash
python3 -m http.server 8767 --bind 0.0.0.0
# http://127.0.0.1:8767/?v=452live
```

部署：把本目录静态托管到 Vercel（见 `vercel.json`）。公网仓库 `key-vision` 应与本目录同步，且必须包含 `assets/` 与带 `l4_cards` 的 `product-bundle.json`。
