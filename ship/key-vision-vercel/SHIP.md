# KEY 视界 · 正式静态客户端

产品：{KEY} · KEY 视界 · 奎燕 AI 研究室

工作室壳：左任务栏 + 中对话 + 右结果弹出，栏宽可拖。底层仍是 Brief → 检索自有库 → 打标 → 老板选 → 报告（合同见仓库根 `AGENT-LAYERS.md`）。不对外网站点新爬。桌面端见仓库根 `desktop/`。

数据：
- 主墙 / 待复核：`data/l2_main_wall.jsonl`（452）+ `data/l2_pending_review.jsonl`（2680）
- Brief + 三张方向假设卡：`data/product-bundle.json`（精简包，含 `l4_cards`）
- 白酒 / 滋补样本墙：`data/briefs/*_main_wall.jsonl`（仅主墙，无策略卡）

诚实口径：同类 446 · 不同类 2 · 跨界 0 · 货架 4。主墙 452 里花瓣 79 张图链已过期（`gd-hbimg` auth_key），卡片仍留在墙上，标「图链失效」。

本地预览（在你自己电脑的目录里跑；网页版 Cloud Agent 打开 127.0.0.1 会连接失败）：

```bash
python3 -m http.server 8767 --bind 127.0.0.1
# http://127.0.0.1:8767/?v=452p13
```

部署：把本目录静态托管到 Vercel（见 `vercel.json`）。公网仓库 `key-vision` 应与本目录同步，且必须包含带 `l4_cards` 的 `product-bundle.json`。方向卡封面优先用墙上 https 参考图，本地 `assets/ref*` 只是离线备援。
