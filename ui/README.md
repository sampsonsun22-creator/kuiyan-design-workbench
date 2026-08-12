> 产品名：**KEY 视界**｜设计竞品调研 · 方向遴选

# 奎燕设计工作台 · UI 原型

本地静态演示：Brief → 市场地图 → 策略卡 → 短名单。数据来自 `data/demo-bundle.json`（青绿茶礼盒 e2e）。

## 运行

```bash
cd /workspace/kuiyan-design-workbench/ui
python3 -m http.server 8765
```

浏览器打开：<http://127.0.0.1:8765/>

> 需通过 HTTP 访问（`fetch` 加载 JSON）；不要直接 `file://` 打开。

## 文件

| 文件 | 说明 |
|---|---|
| `index.html` | 壳：顶栏、步进、主区、工作篮 |
| `styles.css` | 样式 |
| `app.js` | 交互与数据绑定 |
| `data/demo-bundle.json` | L1 / L3 / L4 合并演示包 |
| `UI-SPEC.md` | 信息架构与话术规格 |

## 演示路径（约 5 分钟）

1. Brief：扫意图 → **看市场地图**
2. 钉「中式现代」等桶，主墙钉 1–2 张参考 → **去选方向（策略卡）**
3. 三张卡：保留 / 杀掉 / 再想想 → **生成短名单**
4. 短名单：**复制纪要**

状态（钉选桶、参考、卡决策）保存在 `localStorage`（键 `kuiyan-workbench-state-v1`）。

话术原则：先帮侯总看全、选对；AI 不代替出完稿。
