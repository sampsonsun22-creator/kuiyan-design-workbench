# KEY 视界 · 桌面客户端

把 `ui-shell` 打成可安装的 Windows 应用。只检索本机自有库，不对外网站点新爬。模型 Key 只存在这台电脑，不会打进安装包。

方向卡仍是假设 · 非完稿，不会在客户端里出包装图。

## Windows 安装（给自己电脑）

1. 下载 `KEY-Vision-Setup-0.6.0.exe`，双击安装。
2. 若 SmartScreen 提示「Windows 已保护你的电脑」，点 **更多信息 → 仍要运行**（本包未做代码签名）。
3. 安装完成后，桌面 / 开始菜单打开「KEY 视界」。
4. 默认打开青绿茶 452 墙。点右上角齿轮可填模型 Key；不填也能看墙和报告。

备选：

- `KEY-Vision-0.6.0-Windows.exe` — 免安装，U 盘拷走就能开
- `KEY-Vision-0.6.0-win-x64.zip` — 解压后运行 `KEY 视界.exe`

## 开发打开

```bash
cd desktop
npm install
python3 scripts/make_icon.py
npm start
```

## 打 Windows 包

```bash
cd desktop
npm install
npm run dist:win
```

产物在 `desktop/dist/`：

- `KEY-Vision-Setup-*.exe` — 安装包（桌面快捷方式 + 开始菜单）
- `KEY-Vision-*-Windows.exe` — 免安装
- `KEY-Vision-*-win-x64.zip` — 解压即用
