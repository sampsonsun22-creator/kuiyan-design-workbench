# KEY 视界 · 正式静态客户端

产品：{KEY} · KEY 视界 · 奎燕 AI 研究室

数据：主墙 / 待复核为 live feed；策略卡与 Brief 来自 `data/product-pack.json`。

研究工作区：新建研究、Brief、阶段、留言、Keep/Kill 和短名单保存在浏览器本机；可导出 `key-vision/research-workspace@1` JSON。当前不包含账号级云同步。

本地预览：

```bash
python3 -m http.server 8767 --bind 0.0.0.0
```

部署：整目录静态托管（见 `vercel.json`）。
