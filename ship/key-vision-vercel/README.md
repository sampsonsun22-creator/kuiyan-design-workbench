# KEY 视界

设计竞品调研 · 方向遴选工作台（公网完整交付包）

- 主墙基线：452 / 待复核 2680（brief_relevance_v1）
- 策略卡：青绿新中轴 / 静奢留白 / 开箱仪式（方向示意 · 非完稿）
- 公网：https://key-vision.vercel.app

## 本地预览

```bash
python3 -m http.server 8767
# 打开 http://127.0.0.1:8767/
```

## 数据怎么读

1. `app.js` 先读 `data/l2_main_wall.jsonl` 铺视觉墙  
2. 再读 `data/product-bundle.json` 拿 L1 Brief 与 `l4_cards`  
3. 若 bundle 没有策略卡，才会回落到 `data/product-pack.json`
