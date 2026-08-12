import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.env.KEY_VISION_URL || "http://127.0.0.1:8767/";
const port = 9333;
const profile = await mkdtemp(path.join(tmpdir(), "key-vision-e2e-"));
const chrome = spawn(
  process.env.CHROME_BIN || "google-chrome",
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    targetUrl,
  ],
  { stdio: "ignore" }
);
const chromeExited = new Promise((resolve) => chrome.once("exit", resolve));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = targets.find((target) => target.type === "page" && target.url.startsWith(targetUrl));
      if (page) return page;
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome DevTools target did not start");
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const browserErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails?.text || "runtime exception");
  }
  if (
    message.method === "Log.entryAdded" &&
    message.params.entry.level === "error" &&
    message.params.entry.source === "javascript"
  ) {
    browserErrors.push(message.params.entry.text);
  }
});

function cdp(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        JSON.stringify(result.exceptionDetails)
    );
  }
  return result.result.value;
}

try {
  await cdp("Runtime.enable");
  await cdp("Log.enable");
  await delay(5000);

  const initial = await evaluate(`({
    cards: document.querySelectorAll(".wall-card").length,
    mainCount: document.querySelector("#wallCountBar")?.textContent,
    saved: document.querySelector("#saveStatus")?.textContent
  })`);
  assert.equal(initial.cards, 60);
  assert.match(initial.mainCount, /452/);
  assert.equal(initial.saved, "已保存到本机");

  await evaluate(`(() => {
    document.querySelector("#btnNewResearch").click();
    document.querySelector("#newResearchName").value = "咖啡新品研究";
    document.querySelector("#newResearchQuestion").value = "高端即饮咖啡如何建立货架识别？";
    document.querySelector("#newResearchForm").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    document.querySelector("#composerInput").value = "保留更克制的方向";
    document.querySelector("#composer").dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    document.querySelector('[data-stage="4"]').click();
    document.querySelector(".keep-btn").click();
    return true;
  })()`);
  await delay(300);

  const beforeReload = await evaluate(`(() => {
    const snapshot = JSON.parse(localStorage.getItem("key-vision.research-workspace.v1"));
    const active = snapshot.researches.find((item) => item.id === snapshot.activeResearchId);
    return {
      title: active.title,
      question: active.question,
      stage: active.stage,
      kept: Object.values(active.decisions).includes("keep"),
      message: active.messages[0]?.text
    };
  })()`);
  assert.deepEqual(beforeReload, {
    title: "咖啡新品研究",
    question: "高端即饮咖啡如何建立货架识别？",
    stage: 4,
    kept: true,
    message: "保留更克制的方向",
  });

  await cdp("Page.reload", { ignoreCache: true });
  await delay(5000);
  const restored = await evaluate(`({
    title: document.querySelector("#researchTitle")?.textContent,
    question: document.querySelector("#researchQuestion")?.value,
    stage: document.querySelector(".stage.active")?.dataset.stage,
    messageRestored: document.querySelector("#activityStream")?.textContent.includes("保留更克制的方向"),
    keepRestored: Boolean(document.querySelector(".keep-btn.active-keep"))
  })`);
  assert.deepEqual(restored, {
    title: "咖啡新品研究",
    question: "高端即饮咖啡如何建立货架识别？",
    stage: "4",
    messageRestored: true,
    keepRestored: true,
  });

  await evaluate(`document.querySelector("#btnExportResearch").click()`);
  assert.deepEqual(browserErrors, []);
  console.log("browser workspace e2e passed");
} finally {
  socket.close();
  chrome.kill("SIGTERM");
  await chromeExited;
  await rm(profile, { recursive: true, force: true });
}
