# RESTYLE · Fancy Fashion Checklist

Date: 2026-08-12 · Palette: Design Director Fancy Fashion

## Tokens
- [x] `:root` fancy table in `ui-shell/styles.css`
- [x] `:root` fancy table in `ui/styles.css`
- [x] `--accent` mapped to `--key-yellow`
- [x] Celadon `#6B8F7A` / `#3dbe8c` / `rgba(107,143,122,*)` eliminated from both UIs
- [x] `--keep` = `#FFE900`; `--kill` = `#FF4D6A`; `--working` = `#FFB020`

## Yellow budget (&lt;3%)
- [x] No yellow page backgrounds / glass gradients
- [x] `#FFE900` only: KEY braces, selected rings, Keep, 2px annotation, primary CTA (≤2), Online 6px dots
- [x] Soft green washes replaced (active cards → surface-2; tags → neutral outline)

## Components
- [x] Topbar: paper KEY + yellow braces (SVG `#FFE900`); product paper white; subtag muted
- [x] Online status = **6px** `key-yellow` dots
- [x] User brief bubble = `--paper` / `--ink-on-paper`
- [x] Orchestrator bubble = `--surface-2` + left **2px** `key-yellow`
- [x] Primary CTA = yellow bg + `#1A1A1A` text
- [x] Strategy card selected / kept = yellow border only
- [x] Map selected (wall highlight / pinned item) = **1.5px** solid key-yellow
- [x] Map / strategy tags = no rainbow fills
- [x] Kill controls use `#FF4D6A`

## Brand docs / assets
- [x] `brand/BRAND-UI.md` updated with fancy token table
- [x] Dark mark SVGs: `#F7F4EC` KEY + `#FFE900` braces
- [x] `concept.html` greens remapped

## Servers
- [x] curl 8765 / 8766 → 200 (verify after restart if needed)
