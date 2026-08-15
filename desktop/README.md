# KEY 视界 · 桌面客户端

把 `ui-shell` 打成可安装的 Windows / macOS 应用。只检索本机自有库，不对外网站点新爬。

## 开发打开

```bash
cd desktop
npm install
npm start
```

## 打安装包

```bash
cd desktop
npm install
npm run dist
```

产物在 `desktop/dist/`：

- macOS：`KEY 视界-*.dmg`
- Windows：`KEY 视界 Setup *.exe`（NSIS）

本机没有签名证书时，macOS 首次打开需在「隐私与安全性」里允许。LLM Key 只存在用户本机，不会打进安装包。
