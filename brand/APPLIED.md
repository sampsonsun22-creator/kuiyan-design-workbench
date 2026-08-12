# Brand layer — applied wiring

Date: 2026-08-12 (Asia/Shanghai)

Source: `brand/BRAND-UI.md` + task-locked dual-layer tokens.

## Tokens (both `ui-shell` + `ui` `styles.css`)

| Token | Value | Role |
|-------|-------|------|
| `--brand-ink` / `--bg` | `#0E1012` | Deep background |
| `--brand-surface` / `--bg-elev` | `#161A1E` | Elevated surface |
| `--brand-line` / `--line` | `#2A3036` | Hairline |
| `--brand-paper` / `--text` | `#F4F1EA` | Paper text on dark |
| `--key-metal` | `#C8B9A1` | Mark braces on dark product chrome |
| `--celadon` / `--accent` | `#6B8F7A` | Online / main CTA / annotation line only |

Celadon is **not** wordmark fill. No full-screen yellow splash; Behance `#FFE900` is not primary dark-shell chrome.

## Assets

In `ui-shell/assets/brand/` and `ui/assets/brand/` (canonical under `brand/`):

- `logo-key-mark.svg` / `logo-key-mark-on-dark.svg` — Paper KEY + Key Metal braces
- `logo-key-lockup-on-dark.svg` — Paper + Key Metal (available)
- `logo-key-lockup-on-light.svg` — light/marketing

## Topbar wiring

| Surface | File | Pattern |
|---------|------|---------|
| Product shell | `ui-shell/index.html` | mark `@22px` + «奎燕设计智能体» 13 medium Paper |
| Workbench | `ui/index.html` | mark `@22px` + «KEY 视界» 13 medium Paper (+ optional Key Metal subtag) |

CSS: `.brand` / `.brand-mark` / `.brand-product` (+ `.brand-subtag`) in both `styles.css`.

## Empty states

`brandEmpty(hint)` in both `app.js`: centered mark + slogan「每个市场，都有一把独特的钥匙」+ functional hint.

## Rainbow tags

Not reintroduced. Shell hides `.bucket-chips`; 3-tier tags only.

## URLs

- Workbench http://127.0.0.1:8765/
- Shell http://127.0.0.1:8766/
- `/assets/brand/logo-key-mark.svg` and `logo-key-lockup-on-dark.svg` → 200
