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
- `data/demo-bundle.json` — 青绿茶 e2e 真样
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

## 研究数据落地（v1）

- 「新建研究」会创建独立工作区；Brief、当前阶段、留言、策略 Keep/Kill 与视觉短名单自动保存到浏览器本机。
- 刷新或重新打开页面会恢复上次活跃研究；左栏可切换历史研究。
- 顶部「导出数据」生成 `key-vision/research-workspace@1` JSON，便于交接或后续接入团队数据库。
- 本阶段是单设备持久化，不等同于多人云同步；云端账号与共享数据层留给下一阶段。

## 非目标（v1）

- 不为每个 Agent 开独立聊天室
- 不提供「一键出包装完稿」大按钮
- `/ui/` 工作台可暂不动；主交付为 ui-shell :8766
