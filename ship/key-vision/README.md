# KEY 视界

设计竞品调研 · 方向遴选工作台（五层静态客户端）

- 主墙基线：452 / 待复核 2680（brief_relevance_v1）
- 方向假设（非完稿）：青绿新中轴 / 静奢留白 / 开箱仪式
- **现在就能打开（点一次 Open the page）：** https://raw.githack.com/sampsonsun22-creator/kuiyan-design-workbench/cursor/kuiyan-ui-data-landing-65bd/ship/key-vision/index.html
- `http://127.0.0.1:8767` 只存在于云端虚拟机内部。网页版 Cloud Agent 的浏览器连的是你自己的电脑，所以会 `refused to connect`。
- Cursor 桌面版：先点编辑器右上角插头图标，把 8767 转到本机，再开 `http://127.0.0.1:8767/?v=452p22`
- 旧站 https://key-vision.vercel.app 仍是三页签旧壳，不要覆盖生产。本分支只做预览。
- 对话层要用模型时，不要用上面的静态 `http.server`，改用：`python3 scripts/key_vision_server.py`（本地转发，Key 不落盘）
- Windows 安装包用法见 `desktop/README.md`。本轮不扩桌面范围。

## 在自己电脑上预览

```bash
# 只看墙 / 静态壳
cd ship/key-vision
python3 -m http.server 8767 --bind 127.0.0.1
# http://127.0.0.1:8767/?v=452p22

# 对话 + DeepSeek 兼容转发（推荐）
python3 scripts/key_vision_server.py
# http://127.0.0.1:8767/?v=452p22
```

## 数据怎么读

1. `app.js` 先读 `data/l2_main_wall.jsonl` 铺视觉墙
2. 再读 `data/product-bundle.json` 拿 L1 Brief 与 `l4_cards`
3. 若 bundle 没有策略卡，才会回落到同内容的 `data/product-pack.json`（slim，无 item_catalog）
