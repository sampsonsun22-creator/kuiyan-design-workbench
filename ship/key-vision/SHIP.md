# KEY 视界 · 正式静态客户端

产品：{KEY} · KEY 视界 · 奎燕 AI 研究室

数据：主墙 / 待复核为 live jsonl（452/2680）；Brief 与策略卡来自 `data/product-runtime.json`（不再被空壳 `product-bundle` 挡住）。已保存研究可切换黄酒/滋补落地墙。

本地预览：

```bash
python3 -m http.server 8767 --bind 0.0.0.0
```

部署：将本目录同步到 GitHub 仓库 `key-vision` 根目录后，Vercel 会更新 https://key-vision.vercel.app/ 。本工作台仓库因权限无法直接 push 到 `key-vision`。
