# 交叉复核规则（KEY 视界主墙 · packaging / 视觉锤）

**版本**：packaging_vh_v1  
**脚本**：`L3/cross_review.py`  
**目标**：真实数据量最大化，但未过复核的不进主墙。

## wall_status
| 值 | 含义 |
|---|---|
| `main_wall` | 可进右栏主墙 / 风格塔 |
| `pending_review` | 入库可见于「待复核」，不进主墙 |
| `excluded` | 图链双坏等硬垃圾，默认隐藏 |

## 必过（缺一 → pending 或 excluded）
1. **图有效**：`image_url` 为 http(s)
2. **源可点**：`page_url` 为 http(s)
3. **非重复**：`id` 首次出现；同 `image_url`（去 query）第二次 → `duplicate_image` → pending
4. **品类相关**：包装/礼盒/品牌视觉 **或** 视觉锤且含设计信号；纯工具锤噪声 → pending

## 软标记（单独不拦主墙）
- `empty_title`：标题空，UI 用 id

## 与 Brief 关系
复核阶段不写长文 why；主墙卡可先挂 `query_used`。正式 `why_for_brief` 仍由后续 L3 回写。



## brief_relevance_v1（准确性优先）

在 packaging / image_gate 之后追加 Brief 相关性闸门（`L3/brief_relevance_v1.py`）。

| 桶 | 含义 |
|---|---|
| `pass_brief` | 茶 +（包装\|礼盒）或明确类比（黄酒/滋补/阿胶礼盒等）且带包装 → 可留主墙提案 |
| `pending_low_relevance` | 仅有泛包装 |
| `pending_offtopic` | 视觉锤 / VI / 咖啡 / 宠物等且无茶 |

- 默认 **不** 从 pending 提升进主墙提案（准确性优先）
- 提案输出：`L3/feeds/l2_main_wall_proposed_brief_v1.jsonl`、`l2_pending_review_proposed_brief_v1.jsonl`、`BRIEF-RELEVANCE-PROPOSAL.json`
- 未解锁不写壳；UI 用「只看贴 brief」客户端筛选（见 `ui-shell/BRIEF-FILTER.md`）
