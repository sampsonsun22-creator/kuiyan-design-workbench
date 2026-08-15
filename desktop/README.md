# KEY 视界 · 桌面客户端

把 `ui-shell` 打成可双击的 Windows / macOS 应用。只检索本机自有库，不对外网站点新爬。模型 Key 只存在这台电脑，不会打进安装包。

这是初稿客户端，和网页版同一套壳，后续会按实战反馈继续迭代。方向卡仍是假设 · 非完稿，不会在客户端里出包装图。

## Windows 实战（给侯总 / 自己电脑）

1. 拿到 `KEY-Vision-0.5.0-Windows.exe`（绿色免安装）或解压 `KEY-Vision-0.5.0-win-x64.zip`。
2. 双击打开。若 SmartScreen 提示「Windows 已保护你的电脑」，点 **更多信息 → 仍要运行**（本包未做代码签名）。
3. 默认打开青绿茶 452 墙。点右上角齿轮，填 DeepSeek / OpenAI Key，中间栏才能真对话。
4. 新任务从空白开始：先说这包卖给谁，问清之前右边不弹出。

免安装包是单文件，拷到 U 盘就能用。zip 解压后运行 `KEY 视界.exe`。

## 开发打开

```bash
cd desktop
npm install
python3 scripts/make_icon.py
npm start
```

## 打 Windows 包（在仓库里）

```bash
cd desktop
npm install
npm run dist:win
```

产物在 `desktop/dist/`：

- `KEY-Vision-*-Windows.exe` — 免安装，双击即开
- `KEY-Vision-*-win-x64.zip` — 解压即用

本机没有签名证书。Windows 首次打开需在 SmartScreen 里允许。
