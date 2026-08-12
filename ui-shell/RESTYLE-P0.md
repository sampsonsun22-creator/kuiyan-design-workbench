# RESTYLE P0 · 「深夜茶室里的策展台」

对照 Design Director P0 清单的落地说明（2026-08-12）。

## Global

| Checklist | Done | Notes |
|-----------|------|-------|
| Paper/Ink `#0E1012` / `#161A1E` / `#2A3036` | ✓ | Both `ui-shell` + `ui` CSS vars |
| Accent muted celadon (not neon cyan) | ✓ | `#6B8F7A` + soft tint; focus/links/annotation only |
| Warm stone paper blocks | ✓ | User brief / `.brief-box` → `#1F1C18` |
| Kill = rust red only | ✓ | `#A45A48` |
| Working = low-sat amber | ✓ | `#B8955A` status dots |
| Tags 3 tiers only (accent / neutral / rust) | ✓ | Rainbow blue/pink/purple chips removed; map badges neutralized |
| Typography Noto Serif/Sans CJK + scale 12–28 | ✓ | Installed CJK fonts on box; Inter-as-default avoided |
| Radius 6–8 / chips 999 / canvas ≤12 | ✓ | |
| No heavy shadows; 1px borders + tonal layers | ✓ | Light elevation only on decision/strategy cards |
| 8pt grid; left rail ~200–220; pad 12/16 | ✓ | Rail `212px` |

## Signature

| Checklist | Done | Notes |
|-----------|------|-------|
| Bot bubble left 2px tea-green annotation bar | ✓ | `.msg.bot .bubble { border-left: 2px solid var(--accent) }` |
| Right canvas lightbox/pinboard | ✓ | Section titles + hairlines; larger thumbs; less copy |

## ui-shell specific

| Checklist | Done | Notes |
|-----------|------|-------|
| Topbar: project · single-line stage · demo | ✓ | Stage = Brief→地图→策略→短名单; crawl folded into 地图 |
| Collapse duplicate L1–L4 progress | ✓ | Left pipeline → tiny dots (not fat L1–L4 badges) |
| Left Agent rail compact rows | ✓ | Dot + name + one-line last action; status pills hidden |
| User brief = warm paper; AI = ink + annotation | ✓ | |
| L1/L3 success as small meta (not green pills) | ✓ | `.sys-tag` → mono meta text |
| Bottom chips ≤2 primary + 1 secondary | ✓ | HTML classes `primary` / `secondary` |
| Map: section headers + hairlines; no rainbow filters | ✓ | `bucket-chips` removed from render; badges off thumbs |
| Cards: big image, little text, source tiny | ✓ | 1:1 thumbs; 1-line title; source at bottom |
| concept.html: real demo images / proper empty | ✓ | `assets/ref1–3` + dashed empty-state sentence |

## ui/ workbench specific

| Checklist | Done | Notes |
|-----------|------|-------|
| Same palette + type scale | ✓ | Shared token set |
| Brief 意图识别 = definition list / two-col fields | ✓ | `<dl class="intent-dl">`; not candy-tag wall |
| Must-have / avoid = accent / rust tiers only | ✓ | |
| 侯总工作篮 Keep/Kill/Merge segmented or list | ✓ | Card decision = 3-seg control; 再想想 demoted to text link; basket stats = list rows (no floating「再想想 3」chip) |

## Servers

- `http://127.0.0.1:8766/` → ui-shell (200)
- `http://127.0.0.1:8765/` → ui workbench (200)

## Files touched

- `/workspace/kuiyan-design-workbench/ui-shell/styles.css`
- `/workspace/kuiyan-design-workbench/ui-shell/index.html`
- `/workspace/kuiyan-design-workbench/ui-shell/app.js`
- `/workspace/kuiyan-design-workbench/ui-shell/concept.html`
- `/workspace/kuiyan-design-workbench/ui-shell/RESTYLE-P0.md` (this file)
- `/workspace/kuiyan-design-workbench/ui/styles.css`
- `/workspace/kuiyan-design-workbench/ui/app.js`
