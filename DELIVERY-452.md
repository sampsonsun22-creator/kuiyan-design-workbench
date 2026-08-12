# DELIVERY-452 · 对外真产品数据会签

> 2026-08-12 22:56 CST · **交付基线 = 现壳 brief_relevance_v1 · 452 / 2680**  
> 来源：v145456 去重图后进壳（设计裁定）。原 DELIVERY-410 **过时**。

## 会签结论

- **同意**：公网可交付客户端主墙/待复核 = 现壳真 jsonl **452/2680**
- **地板 = 452**；`vN == 452` 不是增量、不要解锁；下一版必须 **vN > 452**
- 可选未进壳增量：`..._v20260812T145456.jsonl` / `..._v20260812T145428.jsonl` = **602**（>452，另议）

## 发布用绝对路径

| 用途 | 路径 |
|------|------|
| **主墙（交付）** | `/workspace/kuiyan-design-workbench/ui-shell/data/l2_main_wall.jsonl` |
| **待复核（交付）** | `/workspace/kuiyan-design-workbench/ui-shell/data/l2_pending_review.jsonl` |
| tea landed | `/workspace/kuiyan-design-workbench/L3/eval/landed/brief-green-tea-gift/`（=452） |
| 通道状态 | `/workspace/kuiyan-design-workbench/DATA-LIVE.md` |
| 策略卡 bundle（L4 示意/非完稿） | `/workspace/kuiyan-design-workbench/ui-shell/data/demo-bundle.json` |
| 校验 | `/workspace/kuiyan-design-workbench/scripts/assert_shell_strict.py` |
| 交付验收 | `/workspace/kuiyan-design-workbench/scripts/validate_delivery_shell.py`（默认 expect 452） |

md5 main=`6d85197702ecce5e799a6d956b6c7ead` · pending=`b2691bc0783c64ddb0bcce0c160bf977`

## 数据验收命令

```bash
wc -l /workspace/kuiyan-design-workbench/ui-shell/data/l2_main_wall.jsonl \
      /workspace/kuiyan-design-workbench/ui-shell/data/l2_pending_review.jsonl
# 期望: 452 / 2680

python3 /workspace/kuiyan-design-workbench/scripts/assert_shell_strict.py
python3 /workspace/kuiyan-design-workbench/scripts/validate_delivery_shell.py
```

## 验收结果（诚实）

- `ok=True` · main **452** / pending **2680**
- 主墙 unique ids · 硬字段齐全
- **主墙有图率（http 且非 gd-hbimg-edge）: 0.825221**（373/452）
- 不造假填图；后续可继续抬可达率

## 叙事

- 主墙/待复核：live 真数据（非 demo 样本墙）
- 策略卡：L4 方向示意/非完稿
- image_gate 1820 仅归档

## 通道

| 源 | 状态 |
|----|------|
| Tavily | ✅ |
| Firecrawl | ⚠️ 402/429 |
| Apify | ⚠️ 额度 |
| Bright Data | ❌ |

