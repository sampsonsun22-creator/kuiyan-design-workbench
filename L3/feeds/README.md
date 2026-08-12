# L3 feeds（KEY 视界 · dual caliber）

## 壳默认 = strict（1868）
| 口径 | 路径 | 条数 |
|---|---|---|
| **strict（壳默认）** | `ui-shell/data/l2_main_wall.jsonl` · `demo/e2e-green-tea-gift/l2-main-wall.jsonl` | **1868** |
| strict 待复核 | `ui-shell/data/l2_pending_review.jsonl` · demo 同名 | **1079** |
| wide（仅对照） | `L3/feeds/l2_main_wall_platform_2864.jsonl` | **2864** |

`L3/feeds/l2_main_wall.jsonl` 当前应与 **strict** 对齐，不再指向 wide。

锁文件：`ui-shell/data/SHELL-DEFAULT.lock.md`  
状态：`FEED-STATUS.json`（本目录 + ui-shell/data）· 总览 `DATA-LIVE.md`

## 禁止
- 用 wide 2864 覆盖 ui-shell / demo 主墙
- build-demo-bundle 把 platform_2864 或未过图门的 merged 优先进壳

## 平台宽口径流水线（对照用）
```bash
python3 L3/adapt_design_pipeline.py \
  /workspace/design-pipeline/data/normalized/all_sources_20260812T123359Z.jsonl \
  L3/feeds/l2_from_pipeline_20260812.jsonl
python3 L3/coarse_tag.py L3/feeds/l2_from_pipeline_20260812.jsonl -o L3/feeds/l2_tagged_20260812.jsonl
python3 L3/cross_review.py L3/feeds/l2_tagged_20260812.jsonl \
  -o L3/feeds/l2_reviewed_20260812.jsonl \
  --main-wall L3/feeds/l2_main_wall_platform_2864.jsonl \
  --pending L3/feeds/l2_pending_review_platform.jsonl \
  --summary L3/feeds/FEED-STATUS-wide.json
```
规则：`L3/CROSS-REVIEW.md`
