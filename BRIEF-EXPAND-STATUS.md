# BRIEF-EXPAND-STATUS

> Generated: 2026-08-12 22:50:46 CST
> Workbench: `/workspace/kuiyan-design-workbench`
> Tonight delivery KEY视界 — Yang Sun + 奎燕设计智能体

## Hard contract compliance

| Rule | Status | Evidence |
|---|---|---|
| NEVER write ui-shell | OK (this run) | only wrote L3/feeds versioned; shell mtime `2026-08-12 22:50:25 CST` |
| NEVER overwrite clean274 | OK | clean274 still 274 lines, mode r--r--r-- |
| NEVER image_gate/wide/structural → shell | OK | not touched |
| ONLY versioned expanded_vN (+ pending) | OK | paths below |
| NO --publish | OK | `--skip-collect` only |
| Do NOT unlock shell | OK (this run) | did not unlock; shell grew to 410 via other agents |
| No fake padding | OK | Tavily/directed real page+image URLs |

## New expanded_vN (latest delivery)

- **main**: `/workspace/kuiyan-design-workbench/L3/feeds/l2_main_wall_brief_relevance_expanded_v20260812T145030.jsonl`
- **pending**: `/workspace/kuiyan-design-workbench/L3/feeds/l2_pending_review_brief_relevance_expanded_v20260812T145030.jsonl`
- **main wc -l**: **425** (>274 ✓)
- **pending wc -l**: 2680
- **shell**: 410
- **shell coverage**: 410/410 missing=0
- **clean274 ⊆ main**: True
- **new beyond shell**: 15

Tonight timeline: T144033=298 → T144329=304 → T144721=390 → T144902=410 → **T145030=425**.

## Script changes

### `scripts/expand_brief_relevance.py`
1. 429 backoff up to 90s (7 attempts)
2. 402 credits exhausted → abort retries
3. Prefer /v1/search hit images over /v1/scrape
4. Lower scrape_budget (default 6; tea=8; thin=5)
5. Longer scrape sleep 3.0s / search sleep 2.0s
6. More TEA_Q/THIN site: queries (behance/potw/zcool/pinterest + matcha/茶叶礼盒; tonic+燕窝)
7. Contract asserts kept

### Companion `scripts/tavily_hits_to_directed.py`
Tavily dump JSON → `L2-collector/directed/l2-*-tavily.jsonl` (no scrape).

## Collect

Firecrawl `/v1/search` = HTTP 402 Insufficient credits. Used Tavily MCP `include_images=true` → dumps + directed jsonl:

| file | lines |
|---|---:|
| `l2-brief-dairy-gift-tavily.jsonl` | 15 |
| `l2-brief-dairy-gift.jsonl` | 0 |
| `l2-brief-green-tea-gift-tavily-behance.jsonl` | 29 |
| `l2-brief-green-tea-gift-tavily-greentea-gift20260812T1449.jsonl` | 17 |
| `l2-brief-green-tea-gift-tavily-longjing.jsonl` | 11 |
| `l2-brief-green-tea-gift-tavily-matcha.jsonl` | 11 |
| `l2-brief-green-tea-gift-tavily-potw.jsonl` | 6 |
| `l2-brief-green-tea-gift-tavily-wuyutai.jsonl` | 9 |
| `l2-brief-green-tea-gift-tavily.jsonl` | 46 |
| `l2-brief-green-tea-gift.jsonl` | 112 |
| `l2-brief-tissue-home-tavily.jsonl` | 23 |
| `l2-brief-tissue-home.jsonl` | 18 |
| `l2-brief-tonic-gift-tavily.jsonl` | 9 |
| `l2-brief-tonic-gift.jsonl` | 0 |
| `l2-directed-merged.jsonl` | 6 |

```bash
python3 scripts/expand_brief_relevance.py --skip-collect
# /tmp/expand_merge_tavily_v4.log
```

## Thin landed before → after

| brief_id | before (tonight start / expand_br4) | after | path |
|---|---:|---:|---|
| brief-tissue-home | 20 | 32 | `L3/eval/landed/brief-tissue-home/` |
| brief-dairy-gift | 33 | 37 | `L3/eval/landed/brief-dairy-gift/` |
| brief-tonic-gift | 56 | 79 | `L3/eval/landed/brief-tonic-gift/` |

`brief-green-tea-gift` landed not written by expand LAND (FORBIDDEN_LAND).

## Risks / gap to 400–800

1. Firecrawl 402 blocks search/scrape until credits restored.
2. Parallel agents unlocking shell (now 410) and racing directed empties — re-merge required when shell grows.
3. At **425**, past 400 floor; gap to 800 ≈ 375.
4. Classifier permissive; light DEMOTE_RE only — some stock/landing images remain.
5. Next: more Tavily gallery queries; Firecrawl search-only (`scrape_budget=0`) after credit top-up.

