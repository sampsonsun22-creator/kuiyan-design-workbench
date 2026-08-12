# 端到端演示｜青绿茶礼盒包装

**Brief ID**: `brief-green-tea-gift-20260812`  
**链路**: L1 意图 → L2 真样（tea_beverage 10 条）→ L3 市场地图 → L4 三张策略卡

## L1 意图识别（摘要）

- 品类：茶与即饮/新茶饮相关包装 (`tea_beverage`)
- 渠道 / 客群 / 价格带：礼赠 + 电商礼盒 · 28–45 新中产、商务馈赠 · 中高端
- 气质：中式现代
- 风格 prior：中式现代, 中式典雅/礼赠, 国际简约, 地域文旅, 工艺材质感, 极简白盒
- 类比计划：礼赠场→酒礼盒、滋补礼盒、糕点礼盒 ｜ 中式现代叙事→黄酒、国潮美妆、地方特产礼盒 ｜ 国际简约→精品咖啡、高端水、香氛

原始 brief：
> 新品牌青绿茶礼盒包装设计。渠道：一二线城市礼赠 + 电商礼盒；客群 28–45 新中产与商务馈赠；气质要求中式现代、不仿古堆砌；价格带中高端；需在详情页/礼盒开箱有清晰记忆点与差异化；工艺可接受材质升级或适度异形；类比可参考茶礼、黄酒礼盒、滋补礼盒与国际简约茶包装。

## L2 采集（本演示所用）

- 条目：10（有图 7）
- 来源：Behance / Packaging of the World / 站酷
- 文件：`../../L2-collector/samples/sample-run.jsonl`
- 缺口：货架墙（淘宝/抖音）待补；类比墙样本 `analogy_from` 偏少（已请 Data Crawler 定向补采）

## L3 市场地图

### AI 推荐桶（给侯总先看的 5 个）
- **地域文旅** (`regional_culture`) — 茶与产地/人文叙事天然亲近，可做记忆点。
- **中式典雅/礼赠** (`chinese_ceremonial`) — 礼赠渠道需要仪式感，但要控制喜庆模板风险。
- **中式现代** (`chinese_modern`) — Brief 明确中式现代、不仿古；样本中亦有命中。
- **极简白盒** (`minimal_white`) — 电商主图干净，信息层级清晰。
- **工艺材质感** (`craft_material`) — 中高价格带可用材质与工艺做开箱差异。

### 主品类墙（按桶，仅列有图卡）

#### 中式典雅/礼赠
- You Ming Tang Tea Gift Box · packagingoftheworld · [页](https://packagingoftheworld.com/2023/12/you-ming-tang-tea-gift-box-packaging.html) · [图](https://packagingoftheworld.com/wp-content/uploads/2023/12/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20231229095315.png)
- Genmai soup gift box · packagingoftheworld · [页](https://packagingoftheworld.com/2020/10/genmai-soup-gift-box.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2023/07/2-27-1365x2048.jpg)
- "Bama Tea" gift box packaging design · behance · [页](https://www.behance.net/gallery/214846361/Bama-Tea-gift-box-packaging-design) · [图](https://mir-s3-cdn-cf.behance.net/project_modules/1400_webp/f78b37214846361.675ff74fad793.jpg)
- Jincheng Tea Mid-Autumn Gift Box (from Behance search listing) · behance · [页](https://www.behance.net/search/projects/tea%20box%20design) · [图](https://mir-s3-cdn-cf.behance.net/projects/404/87df36147648851.Y3JvcCwxODQxLDE0NDAsMTE4LDA.jpg)

#### 地域文旅
- Barg – Tea Packaging Design for a Brand in Uzbekistan · packagingoftheworld · [页](https://packagingoftheworld.com/2026/07/barg-tea-packaging-design-for-a-brand-in-uzbekistan.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2024/10/6-20-1024x709.jpg)
- Kashmiri Tea Branding & Packaging Design – Panun Kehwa · packagingoftheworld · [页](https://packagingoftheworld.com/2026/03/kashmiri-tea-branding-packaging-design-panun-kehwa.html) · [图](https://i0.wp.com/packagingoftheworld.com/wp-content/uploads/2026/02/1-27.png?fit=1920%2C960&ssl=1)
- Jincheng Tea Mid-Autumn Gift Box (from Behance search listing) · behance · [页](https://www.behance.net/search/projects/tea%20box%20design) · [图](https://mir-s3-cdn-cf.behance.net/projects/404/87df36147648851.Y3JvcCwxODQxLDE0NDAsMTE4LDA.jpg)

#### 中式现代
- You Ming Tang Tea Gift Box · packagingoftheworld · [页](https://packagingoftheworld.com/2023/12/you-ming-tang-tea-gift-box-packaging.html) · [图](https://packagingoftheworld.com/wp-content/uploads/2023/12/%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20231229095315.png)

#### 插画叙事
- Kashmiri Tea Branding & Packaging Design – Panun Kehwa · packagingoftheworld · [页](https://packagingoftheworld.com/2026/03/kashmiri-tea-branding-packaging-design-panun-kehwa.html) · [图](https://i0.wp.com/packagingoftheworld.com/wp-content/uploads/2026/02/1-27.png?fit=1920%2C960&ssl=1)

#### 自然有机
- Barg – Tea Packaging Design for a Brand in Uzbekistan · packagingoftheworld · [页](https://packagingoftheworld.com/2026/07/barg-tea-packaging-design-for-a-brand-in-uzbekistan.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2024/10/6-20-1024x709.jpg)

#### 色彩冲击/年轻潮
- Barg – Tea Packaging Design for a Brand in Uzbekistan · packagingoftheworld · [页](https://packagingoftheworld.com/2026/07/barg-tea-packaging-design-for-a-brand-in-uzbekistan.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2024/10/6-20-1024x709.jpg)

#### 奢华金饰
- Kashmiri Tea Branding & Packaging Design – Panun Kehwa · packagingoftheworld · [页](https://packagingoftheworld.com/2026/03/kashmiri-tea-branding-packaging-design-panun-kehwa.html) · [图](https://i0.wp.com/packagingoftheworld.com/wp-content/uploads/2026/02/1-27.png?fit=1920%2C960&ssl=1)
- "Bama Tea" gift box packaging design · behance · [页](https://www.behance.net/gallery/214846361/Bama-Tea-gift-box-packaging-design) · [图](https://mir-s3-cdn-cf.behance.net/project_modules/1400_webp/f78b37214846361.675ff74fad793.jpg)

#### 极简白盒
- Genmai soup gift box · packagingoftheworld · [页](https://packagingoftheworld.com/2020/10/genmai-soup-gift-box.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2023/07/2-27-1365x2048.jpg)
- TEA O'LOGY · behance · [页](https://www.behance.net/search/projects/tea%20box%20design) · [图](https://mir-s3-cdn-cf.behance.net/projects/404/652f8c187724779.Y3JvcCwxMTkyLDkzMywxMDMsMA.jpg)

#### 工艺材质感
- Genmai soup gift box · packagingoftheworld · [页](https://packagingoftheworld.com/2020/10/genmai-soup-gift-box.html) · [图](http://packagingoftheworld.com/wp-content/uploads/2023/07/2-27-1365x2048.jpg)
- "Bama Tea" gift box packaging design · behance · [页](https://www.behance.net/gallery/214846361/Bama-Tea-gift-box-packaging-design) · [图](https://mir-s3-cdn-cf.behance.net/project_modules/1400_webp/f78b37214846361.675ff74fad793.jpg)

#### 国际简约
- TEA O'LOGY · behance · [页](https://www.behance.net/search/projects/tea%20box%20design) · [图](https://mir-s3-cdn-cf.behance.net/projects/404/652f8c187724779.Y3JvcCwxMTkyLDkzMywxMDMsMA.jpg)

### 类比墙
当前小样未打 analogy_from；演示中类比墙先用「可借入桶」逻辑，待 Crawler 补类比采。

计划类比边：
- 礼赠场: 酒礼盒, 滋补礼盒, 糕点礼盒, 文创礼盒
- 中式现代叙事: 黄酒, 国潮美妆, 地方特产礼盒
- 国际简约: 精品咖啡, 高端水, 香氛

### 货架墙
缺口：当前样例几乎无 source_type=shelf；待电商通道/ Crawler 补货架墙。

## L4 策略卡（侯总遴选）

### 青绿新中轴 (`card-cm-01`)
- **一句话**：以「青绿」做现代色锤，中式结构去仿古，一眼茶、二眼礼。
- **优势**：礼赠体面但不土；电商主图有色识别。
- **区隔**：对比金红仿古茶礼与过度极简白盒，走出可记忆的中式现代。
- **风格桶**：中式现代, 工艺材质感
- **参考**：packagingoftheworld:you-ming-tang-tea-gift-box, packagingoftheworld:genmai-soup-gift-box
- **Demo prompt**：Premium Chinese green tea gift box packaging, direction "青绿新中轴", style 中式现代, 工艺材质感, modern not antique, elegant unboxing, studio product photography, high-end FMCG packaging mockup, not a final artwork
- **侯总决策位**：`pending`（pending）

### 静奢留白 (`card-gm-02`)
- **一句话**：国际简约骨架 + 一点点东方材质，把礼盒做成「安静的贵」。
- **优势**：新中产审美友好，跨礼赠/自用。
- **区隔**：拉开国内喜庆模板；用留白和材质对抗信息噪音。
- **风格桶**：国际简约, 极简白盒
- **参考**：packagingoftheworld:genmai-soup-gift-box, behance:search-tea-ology
- **Demo prompt**：Premium Chinese green tea gift box packaging, direction "静奢留白", style 国际简约, 极简白盒, modern not antique, elegant unboxing, studio product photography, high-end FMCG packaging mockup, not a final artwork
- **侯总决策位**：`pending`（pending）

### 开箱仪式 (`card-cc-03`)
- **一句话**：礼赠仪式感做在结构开箱，而不是贴金箔龙凤。
- **优势**：开箱视频/详情页天然内容点。
- **区隔**：仪式感来自层次与触感，而非符号堆砌。
- **风格桶**：中式典雅/礼赠, 地域文旅
- **参考**：packagingoftheworld:you-ming-tang-tea-gift-box, packagingoftheworld:barg-tea-uzbekistan
- **Demo prompt**：Premium Chinese green tea gift box packaging, direction "开箱仪式", style 中式典雅/礼赠, 地域文旅, modern not antique, elegant unboxing, studio product photography, high-end FMCG packaging mockup, not a final artwork
- **侯总决策位**：`pending`（pending）

## 这演示证明了什么
1. 任意 brief 可落到 domain + 类比 + 风格 prior（全品类引擎，不只是茶）。
2. L2 真样能被 L3 按桶聚成「市场地图」，而不是 3 张碎片参考。
3. L4 给出可拍板的方向卡；AI 不代替侯总做最终创意。

## 文件索引
- `L1-brief-intent.json`
- `L3-market-map.json`
- `L3-MARKET-MAP.md`（侯总可读 · Dot Dot 增量）
- `L4-strategy-cards.json` / `L4-card-*.json`
- `DEMO.md`（本文件）

---

## Dot Dot 增量精修（2026-08-12）

面向侯总的可读市场地图与策略卡参考 why 补强（**不覆盖**原 L4 三张卡与 DEMO 正文）。

### 新增 / 精修文件
- `L3-MARKET-MAP.md` — 侯总可读四墙视图（结论 → 推荐桶 → 主墙 → 类比占位 → 货架缺口 → L4 短名单）
- `L4-card-cm-01-v2.json` / `L4-card-gm-02-v2.json` / `L4-card-cc-03-v2.json` — 原三张保留；v2 仅收紧 `reference_montage.why`

### 文件索引（追加）
- `L3-MARKET-MAP.md`
- `L4-card-*-v2.json`


---

## Data Crawler 补采合并（2026-08-12）

- 新增 `l2-extra.jsonl`：15 条（灵感+货架）
- 已重算 `L3-market-map.json` 与刷新 `L3-MARKET-MAP.md`（货架墙不再为空）
- 说明：`L2-EXTRA-NOTES.md`


## Dot Dot 二次增量（吃进 l2-extra）

- 更新 `L3-MARKET-MAP.md`：合并 sample-run + `l2-extra.jsonl`（货架墙 4 条 listing 级已标）
- 新增 `L4-card-cm-01-v2.md` / `L4-card-gm-02-v2.md` / `L4-card-cc-03-v2.md`（奎燕话术可读版；JSON v2 仍保留）
- 原 L1 / L3-market-map.json / 原三张 L4 JSON / images **未覆盖**
