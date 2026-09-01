# KEY 视界

设计竞品调研 · 方向遴选工作台（五层静态客户端）

- 主墙基线：452 / 待复核 2680（brief_relevance_v1）
- 方向卡：青绿新中轴 / 静奢留白 / 开箱仪式
- **现在就能打开（点一次 Open the page）：** https://raw.githack.com/sampsonsun22-creator/kuiyan-design-workbench/cursor/kuiyan-ui-data-landing-65bd/ship/key-vision/index.html
- `http://127.0.0.1:8767` 只存在于云端虚拟机内部。网页版 Cloud Agent 的浏览器连的是你自己的电脑，所以会 `refused to connect`。
- 前端锁：p45 壳 + `?v=452p47`（YES）。p43/p44 不算。p48/p49/p50 作废。参考预览 `https://kv-p21-preview-n3bgtx9ph-grok6.vercel.app/?v=452p47`
- Cursor 桌面版：先点编辑器右上角插头图标，把 8767 转到本机，再开 `http://127.0.0.1:8767/?v=452p47`
- 旧站 https://key-vision.vercel.app 仍是三页签旧壳，不要覆盖生产（p36 / alias / `--prod` 不动）。本分支只做预览。
- 对话层要用模型时，不要用上面的静态 `http.server`，改用：`python3 scripts/key_vision_server.py`（本地转发，Key 不落盘）
- Windows 安装包用法见 `desktop/README.md`。本轮不扩桌面范围。

## 袋面现拉（预览）

钉 Brief 产品词后，`collectPackOnPin` 只 `POST /api/pack/collect`（相对路径，body 只带 `product_name`）。

Vercel Preview 环境变量（Production / p36 不要改）：

| 变量 | 作用 |
|------|------|
| `TAVILY_API_KEY` | serverless 调 Tavily `search` + `extract`。钥只放 Vercel env，不进浏览器、不进仓。 |

无钥或 Tavily 429/432 时，函数降级 brand-site（用品名拆品牌打官网 search），不能空跑。`channel` 只会是 `tavily` 或 `brand_site`。

预览验证：新建研究 → 钉「Orijen Original」或完整品名 → 墙出袋面（`pending_review`）+ 可点 SKU 深链。短名单只认 `extra.collect_method==="api_pack_collect"`。结论 / 方向卡不要出现「假设·非完稿」。产品词过短（宠物 / 粮 / 粮包 或 length&lt;4）应回 `no_truncate`。

## 在自己电脑上预览

```bash
# 只看墙 / 静态壳
cd ship/key-vision
python3 -m http.server 8767 --bind 127.0.0.1
# http://127.0.0.1:8767/?v=452p47

# 对话 + DeepSeek 兼容转发（推荐）
python3 scripts/key_vision_server.py
# http://127.0.0.1:8767/?v=452p47
```

## 数据怎么读

1. `app.js` 先读 `data/l2_main_wall.jsonl` 铺视觉墙
2. 再读 `data/product-bundle.json` 拿 L1 Brief 与 `l4_cards`
3. 若 bundle 没有策略卡，才会回落到同内容的 `data/product-pack.json`（slim，无 item_catalog）
