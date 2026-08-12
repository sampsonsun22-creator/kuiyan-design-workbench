# Collection Item Schema

机器可读定义：`collection-schema.json`。  
风格桶机器字段只写 **style_buckets_v1 id**（见 `../L3/style-buckets-v1.json`）。

## 字段

| field | type | notes |
|-------|------|-------|
| id | string | 稳定 id，建议 `{source}:{native_or_slug}` |
| image_url | string | 主图（可为空字符串仅当 page_url 可用；Phase B 进主墙前需补图） |
| page_url | string | 作品/商品页 |
| thumbnail_url | string? | 缩略图 |
| source | string | behance / packagingoftheworld / zcool / taobao / … |
| source_type | enum | inspiration / award / shelf / portfolio |
| title | string | |
| author_or_brand | string? | 设计师或品牌 |
| category_domain_id | string? | ontology id，如 tea_beverage |
| category_label | string? | 中文品类名 |
| is_on_market | bool \| "unknown" | 货架真品=true；概念稿常 unknown/false |
| market_region | string[] | CN / JP / global … |
| raw_tags | string[] | 源站标签或抽取词 |
| suggested_style_buckets | string[] | **仅 style_buckets_v1 英文 id，0–3 个** |
| structure_tags | string[] | 短码，如 box_type:gift_box；无信号可 [] |
| info_hierarchy_tags | string[] | brand_first / product_first / claim_first / ritual_gift |
| color_roles | object[] | {role, value}；无信号可 [] |
| structure_notes | string? | legacy 自由文本 |
| color_palette | string[]? | legacy；优先 color_roles |
| info_hierarchy | string? | legacy；优先 info_hierarchy_tags |
| analogy_from | string? | 若来自类比检索，记录种子 |
| query_used | string | 命中本条的查询 |
| collected_at | datetime | ISO-8601 UTC |
| license_or_rights_note | string? | 使用权提示 |
| extra | object | 源站特有字段 |

## suggested_style_buckets（style_buckets_v1，locked）

机器只写 id；UI/侯总话术用 name_zh。

| id | name_zh |
|---|---|
| chinese_modern | 中式现代 |
| chinese_ceremonial | 中式典雅/礼赠 |
| global_minimal | 国际简约 |
| swiss_international | 瑞士国际主义 |
| natural_organic | 自然有机 |
| luxury_gilt | 奢华金饰 |
| minimal_white | 极简白盒 |
| color_youth | 色彩冲击/年轻潮 |
| cartoon_ip | 卡通IP趣味 |
| retro_nostalgia | 复古怀旧 |
| craft_material | 工艺材质感 |
| appetite_photo | 摄影食欲风 |
| illustration_story | 插画叙事 |
| efficacy_hammer | 成分科学/功效锤 |
| regional_culture | 地域文旅 |
| pet_cute | 宠物萌感 |
| maternal_safe | 母婴安全感 |
| nightlife_trend | 夜场潮流 |
| sustainable_plain | 可持续质朴 |
| art_collab | 跨界艺术限量 |

**禁止**使用已作废示意 id（如 `chinese_ritual_gift`）。v0 中文名仅经 `migration_from_v0` 迁移，新采集直接写 id。无把握时填 `[]`，由 L3 精细打标。
