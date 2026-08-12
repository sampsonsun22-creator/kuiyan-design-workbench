> 产品名：**KEY 视界**｜设计竞品调研 · 奎燕 AI 研究室

# KEY 视界 · 产品壳原型（ui-shell）

浅色「研究实验室」三栏壳。v1 默认已放弃深色 Fancy 主题，对齐用户参考图 + Design Director 浅色 token。

## 布局

| 栏 | 宽度 | 职责 |
|---|---|---|
| 左 | ~240px | 黄底 `{KEY}` 品牌砖、「+ 新建研究」、**能力栈**（编排器 / Data Crawler / Dot Dot 状态点 + 一行最近动作）、已保存研究列表 |
| 中 | flex | **协作室**：研究问题栏、五阶段步进、活动时间线（非胖聊天气泡）、底栏附件 + 黄发送 |
| 右 | ~1.35fr | **画布**：视觉素材（市场地图墙）/ 策略卡 / 短名单；源状态芯片；筛选；选中黄框；可折叠 Inspector「与 Brief 的关系」 |

## 阶段

1 理解 Brief → 2 拆解采集 → 3 深度探索 → 4 策略批判 → 5 结构化输出

ACTIVE = 黄底黑字（`--stage-active-bg: #FFE900`）。

## 文件

- `index.html` / `styles.css` / `app.js` — 可点原型（静态，无构建）
- `data/product-bundle.json` / `data/product-pack.json` — 生产 slim 包（L1 + L3 摘要 + 3 张 L4 卡；无 item_catalog）
- `data/l2_main_wall.jsonl` / `data/l2_pending_review.jsonl` — 交付锁 452 / 2680
- `assets/ref*.png|jpg` — 策略卡本地参考图
- `RESTYLE-LAB.md` — 本次浅色实验室重做说明
- `concept.html` — 旧概念页（非主路径）

## 本地预览

```bash
cd /workspace/kuiyan-design-workbench/ui-shell
python3 -m http.server 8766
```

- 交互壳：http://127.0.0.1:8766/
- 概念图：http://127.0.0.1:8766/concept.html

## 演示交互

- 点阶段 / 源芯片 → 刷新右栏 + 活动流追加事件
- 点视觉墙卡片 → 黄框选中 + 打开 Inspector（match / learn / risk）
- 策略卡 Keep/Kill → 同步短名单与时间线
- 发送「看市场地图 / 生成三张策略卡 / 同步 Data Crawler」

## 非目标（v1）

- 不为每个 Agent 开独立聊天室
- 不提供「一键出包装完稿」大按钮
- `/ui/` 工作台可暂不动；主交付为 ui-shell :8766
