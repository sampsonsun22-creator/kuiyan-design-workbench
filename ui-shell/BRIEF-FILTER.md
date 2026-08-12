# Brief 相关性筛选（客户端）

**Brief**：新品牌青绿茶礼盒 · 礼赠+电商 · 中式现代  
**脚本同源规则**：`L3/brief_relevance_v1.py`  
**壳内开关**：类别条「只看贴 brief」（默认 **开**）

## 行为
- **开**：视觉墙只渲染 `pass_brief`（茶 + 包装/礼盒，或黄酒/滋补/阿胶等类比 + 包装）。计数条文案：`先看和 brief 更贴的 · 约 N 张`。
- **关**：重新露出泛包装；仍把贴 brief 的卡片排在前，低相关 / 跑题沉底。
- **低相关**：虚线弱样式，不可走主路径黄选（与待复核同类克制）。
- **含待复核**：待复核仍置顶；组内同样套 brief 筛选/排序。

## 与锁定 feed 的关系
- **不**改写 `ui-shell/data/l2_main_wall.jsonl` / `l2_pending_review.jsonl`（保持 image_gate 1820/1127）。
- 结构性提案见 `L3/feeds/l2_*_proposed_brief_v1.jsonl` 与 `BRIEF-RELEVANCE-PROPOSAL.json`；解锁后才可替换壳内 feed。
- 壳可选在解锁后改为默认读 brief-pass 排序的 feed；在此之前靠本客户端筛选即可用。
