# 奎燕设计工作台 / KEY 视界

全品类设计竞品调研与方向遴选引擎（L1–L5，见 `AGENT-LAYERS.md`）。

- 工作台原型：`ui-shell/`（主墙 452 / 待复核 2680）
- 工作室壳：`ui-shell/` → `python3 scripts/ship_key_vision.py` → `ship/key-vision/`（本分支 452p22）。旧站 https://key-vision.vercel.app 仍是三页签旧壳，不要覆盖生产。
- 对话层转发：`python3 scripts/key_vision_server.py`（Key 只随请求走本地代理，不落盘）。
- Windows 安装包用法见 `desktop/README.md`，本轮不扩桌面范围。
- 网页版 Cloud Agent **打不开** `http://127.0.0.1:8767`（那是云端机地址）。请用 `ship/key-vision/README.md` 的预览说明，或 Cursor 桌面版插头转发 8767。
