/**
 * KEY 视界 desktop host.
 * Serves the local ui-shell (self-owned library) and proxies LLM calls.
 * Does not crawl third-party sites. Does not rewrite the 452/2680 lock.
 */
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const CACHE_V = "452p21";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

if (process.platform === "win32") {
  app.setAppUserModelId("com.kuiyan.keyvision");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function contentDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "key-vision");
  const shipped = path.join(__dirname, "..", "ship", "key-vision");
  const src = path.join(__dirname, "..", "ui-shell");
  return fs.existsSync(path.join(src, "index.html")) ? src : shipped;
}

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function proxyChat(payload) {
  return new Promise((resolve, reject) => {
    const provider = String(payload.provider || "openai");
    const apiKey = String(payload.api_key || payload.apiKey || "");
    const model = String(payload.model || "");
    const messages = payload.messages || [];
    if (!apiKey) return reject(new Error("missing api key"));
    const isAnthropic =
      provider === "anthropic" || String(payload.base_url || payload.baseUrl || "").includes("anthropic.com");
    const base = String(
      payload.base_url || payload.baseUrl || (isAnthropic ? "https://api.anthropic.com" : "https://api.openai.com/v1")
    );
    const trimmed = base.replace(/\/+$/, "");
    const href = isAnthropic
      ? /\/v1\/messages$/i.test(trimmed)
        ? trimmed
        : `${trimmed.replace(/\/v1$/i, "")}/v1/messages`
      : /\/chat\/completions$/i.test(trimmed)
        ? trimmed
        : `${trimmed}/chat/completions`;
    const target = new URL(href);
    const bodyObj = isAnthropic
      ? {
          model,
          max_tokens: 1200,
          system: messages
            .filter((m) => m.role === "system")
            .map((m) => m.content)
            .join("\n\n"),
          messages: messages.filter((m) => m.role === "user" || m.role === "assistant"),
        }
      : { model, messages, temperature: 0.2 };
    const data = Buffer.from(JSON.stringify(bodyObj), "utf8");
    const lib = target.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        method: "POST",
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: target.pathname + target.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
          ...(isAnthropic
            ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
            : { Authorization: `Bearer ${apiKey}` }),
        },
      },
      (resp) => {
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (resp.statusCode >= 400) return reject(new Error(raw.slice(0, 240) || `http ${resp.statusCode}`));
          try {
            const parsed = JSON.parse(raw);
            const text = isAnthropic
              ? (parsed.content || []).map((p) => p.text || "").join("") || ""
              : (((parsed.choices || [])[0] || {}).message || {}).content || "";
            resolve(text);
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(45000, () => {
      req.destroy(new Error("llm timeout"));
    });
    req.end(data);
  });
}

function startServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname === "/api/llm/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true, proxy: true, desktop: true, platform: process.platform });
        return;
      }
      if (url.pathname === "/api/llm/chat" && req.method === "POST") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
            proxyChat(payload)
              .then((text) => sendJson(res, 200, { ok: true, text, model: payload.model, agent: payload.agent }))
              .catch((err) => sendJson(res, 502, { ok: false, error: String(err.message || err) }));
          } catch (err) {
            sendJson(res, 400, { ok: false, error: "bad json" });
          }
        });
        return;
      }
      let rel = decodeURIComponent(url.pathname);
      if (rel === "/") rel = "/index.html";
      const file = path.normalize(path.join(root, rel.replace(/^\/+/, "")));
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404);
          res.end("not found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(buf);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

function installMenu() {
  const template = [
    {
      label: "KEY 视界",
      submenu: [
        { role: "reload", label: "刷新" },
        { role: "forceReload", label: "强制刷新" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "这轮怎么用",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.executeJavaScript("document.getElementById('userChip')?.click()");
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const root = contentDir();
  if (!fs.existsSync(path.join(root, "index.html"))) {
    dialog.showErrorBox("KEY 视界", `找不到本机库：${root}\n请重新安装 KEY-Vision-Setup。`);
    app.quit();
    return;
  }
  const server = await startServer(root);
  const { port } = server.address();
  const icon = path.join(__dirname, "build", process.platform === "win32" ? "icon.ico" : "icon.png");
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "KEY 视界",
    backgroundColor: "#f3f1ea",
    show: false,
    autoHideMenuBar: false,
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  await win.loadURL(`http://127.0.0.1:${port}/index.html?v=${CACHE_V}`);
  win.on("closed", () => server.close());
}

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.whenReady().then(() => {
  installMenu();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
