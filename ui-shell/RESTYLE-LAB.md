# RESTYLE · Light Research Lab（2026-08-12）

## 决策
- **v1 默认**改为浅色「KEY 视界」研究实验室，对齐 `brand/user-style-reference.png` + `brand/STYLE-REFERENCE-NOTES.md`。
- 深色 Fancy Fashion 主题（`RESTYLE-FANCY.md`）**不再作为默认壳**；资产可保留，但不驱动 `index.html`。

## 产品名（锁定）
- 主名：**KEY 视界**
- 副标小字：奎燕 AI 研究室（左栏）/ 设计竞品调研（文档）

## Token（已写入 `styles.css` :root）
```css
--bg: #F3F2EE;
--surface: #FFFFFF;
--surface-2: #FAFAF7;
--line: #E6E4DC;
--ink: #1A1A1A;
--text-muted: #6F6F68;
--key-yellow: #FFE900;
--key-yellow-press: #F0DC00;
--brand-brick: #FFE900;
--keep: #FFE900;
--kill: #E5484D;
--kill-soft: #FCEBEB;
--ok: #1F9D55;
--working: #F5A524;
--stage-active-bg: #FFE900;
--stage-active-fg: #1A1A1A;
--stage-idle-bg: #ECEAE3;
--stage-idle-fg: #6F6F68;
--shadow: 0 1px 0 rgb(26 26 26 / 0.04), 0 8px 24px rgb(26 26 26 / 0.06);
```

## IA 变更（相对旧壳）
| 旧 | 新 |
|---|---|
| 顶栏 + 左能力轨 + 中聊天气泡 + 右画布 | 左品牌/能力/研究列表 + 中协作室时间线 + 右画布+Inspector |
| 阶段：Brief→地图→策略→短名单 | 五阶段：理解 Brief→拆解采集→深度探索→策略批判→结构化输出 |
| 能力轨偏「管道 L1–L4」 | 能力栈：状态点 + 一行 last action（非多聊天室） |
| 地图选中弱 | 视觉墙选中 **3px 黄边 + 角标勾** |
| 无 Brief 关系侧栏 | 可折叠 Inspector：match / learn / risk |

## 数据
仍读 `data/demo-bundle.json`（青绿茶 e2e）：L1 brief → L3 walls → L4 策略卡；本地 `assets/ref1–3`。

## 服务
`python3 -m http.server 8766`（目录：`ui-shell/`）

## 与 `/ui/` 关系
主交付为 **ui-shell**。`/ui/` 可暂留旧工作台；如需同步浅色 token，另开任务。

## P0 复审补丁（2026-08-12）

Design Director 驳回后补齐，并对齐「更有人情味」文案：

1. **Inspector**：选中墙卡后右侧展开约 320px「素材与 Brief 的关系」——缩略图 + 匹配 Brief / 为何重要 / 视觉元素 / 可借鉴 / 差异化风险；无选中时隐藏。墙网格在 Inspector 打开时收为 2 列。
2. **选中底栏**：≥1 选中出现「已选 N 项」+ 对比 / 核实来源 / 加入短名单（UI 演示）。
3. **阶段条**：active = 整段黄 pill + 黑字；done = 绿底 + ✓；idle = 灰 pill。
4. **研究问题**：中上白卡片，可编辑多行，预填青绿茶 one-liner，字数角标。
5. **品牌砖三行**：`{KEY}` 大号 → **KEY 视界** 粗体 → 奎燕 AI 研究室小字（不再挤一行）。
6. **活动流**：更密时间线 + 产出 chips；少厚气泡；文案改人话（「正在帮侯总…」）。
7. **源状态**：平台名 + 状态句/点的迷你卡；类别 chips（包装实物 / 设计案例）在筛选上方。
8. **策略页签**：去掉 Behance/Pinterest 源筛，改方向/气质筛；大图 + claim + tags + Keep/Kill（Keep 进短名单）。
9. **能力栈**：更高行；彩色点 + 陪伴感状态句。
10. **宽度**：左 ~240；Inspector 开时墙 + 320。
