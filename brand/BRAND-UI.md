## 产品命名
- 工作台：**KEY 视界**
- 副标：设计竞品调研 · 方向遴选
- 智能体：奎燕设计智能体

# 奎燕 {KEY} · 产品 UI 品牌层

来源：Behance 公开字标 + 设计总监 **Fancy Fashion** 色板（深编辑黑 + Key Yellow）。

## 公开字标结构
- 主标：`{KEY}`（花括号 + slab/typewriter 感 KEY）
- 中文：奎燕品牌创新社
- 英文：KEY BRAND DESIGN
- 产品深底：纸白 KEY + **#FFE900** 黄括号；禁止整标贴金 / 铺大黄底

## 资产
- `key-logo-avatar.png` — Behance 黄底锁排（参考）
- `key-logo-team.jpg` — 白底黄括号版（参考）
- `key-banner.jpg` — 口号黄 banner
- `logo-key-mark.svg` — `{KEY}` mark（纸白 KEY + 黄括号）
- `logo-key-lockup-on-dark.svg` — 深底顶栏
- `logo-key-lockup-on-light.svg` — 浅底/纸面

## Fancy Fashion Token Table（锁定）
```css
:root {
  --ink: #0A0A0A;
  --surface: #141414;
  --surface-2: #1C1C1C;
  --line: #2E2E2E;
  --paper: #F7F4EC;
  --ink-on-paper: #1A1A1A;
  --text: #F5F5F0;
  --text-muted: #8A8A84;
  --key-yellow: #FFE900;
  --key-yellow-dim: #3D3900;
  --keep: #FFE900;
  --kill: #FF4D6A;
  --kill-dim: #3A1520;
  --working: #FFB020;
  --map-slot: #121212;
}
```

## 用法铁律
- 深编辑黑 UI；**已删除** Celadon `#6B8F7A` / 旧 `--accent` 绿
- `--accent` → `--key-yellow`
- `#FFE900` **仅**用于：`{KEY}` 括号、选中描边、Keep、编排器左 2px 注释线、主 CTA（同屏 ≤2）、Online 6px 黄点
- 黄面积 &lt;3%：无黄页底、无黄玻璃渐变
- 用户 brief = paper `#F7F4EC` + `#1A1A1A` 字
- 编排器气泡 = `surface-2` + 左 2px key-yellow
- Kill = `#FF4D6A`
- 顶栏：纸白 KEY + 黄括号；产品名「KEY 视界」纸白；副标「设计竞品调研」muted
- 地图选中：1.5px solid key-yellow；策略卡选中：仅黄描边；地图无彩 tag

## Behance 采样（2026-08-12）
- Brand Yellow（传播 / 产品点缀）: `#FFE900`
- Mark Black: `#1A1A1A`
- KEY 字形：高对比 Didone/衬线 + 花括号隐喻「钥匙」
