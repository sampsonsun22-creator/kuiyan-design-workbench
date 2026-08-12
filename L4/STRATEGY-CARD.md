# 方向假设卡（现口径：挂在 L5 结论报告）

给侯总看的「差异化方向假设」，不是完稿，也**不是** L4 决策筛选本身。  
L4 筛的是 8–12 款竞品参考；本卡只在短名单之后，作为报告第 5 段的方向假设。

## 卡片结构
1. **一句话概念** `one_liner`
2. **优势** `advantage` — 为什么值得做
3. **区隔** `differentiation` — 相对货架墙/竞品
4. **参考编排** `reference_montage` — L2 `item_id` + 为什么抽它（可来自主墙/类比墙/货架墙）
5. **文案/草图方向** `verbal_directions` / `sketch_directions`
6. **Demo prompt** `demo_prompt` — 仅情绪板/概念示意，文案必须带「非完稿」
7. **推荐风格桶** — id + 展示时转中文
8. **侯总决策** `hou_decision`: pending | keep | kill | merge

## 示例骨架（茶礼）
- one_liner: 「把青绿茶的鲜，收进可送人的现代中式礼盒」
- advantage: 礼赠场清晰，又能保留茶的鲜感
- differentiation: 避开红金仿古堆砌，走中式现代+自然有机
- reference_montage: 链到 sample-run 里 chinese_ceremonial / natural_organic 条目
- demo_prompt: 标明 demo only

机器可读：`strategy-card.schema.json`。
