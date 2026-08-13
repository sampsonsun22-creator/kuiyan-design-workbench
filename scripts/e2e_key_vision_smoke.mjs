#!/usr/bin/env node
/**
 * Live smoke: serve ship/key-vision and assert the five-layer shell
 * boots the locked 452 wall. Does not rewrite jsonl.
 */
import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pwRoots = [
  process.env.PLAYWRIGHT_ROOT,
  "/tmp/pw-e2e",
  ROOT,
].filter(Boolean);
const pwRoot = pwRoots.find((d) => existsSync(path.join(d, "node_modules/playwright/package.json")));
if (!pwRoot) {
  console.error("playwright not found; npm i playwright in /tmp/pw-e2e or repo root");
  process.exit(2);
}
const { chromium } = createRequire(path.join(pwRoot, "package.json"))("playwright");
const SHIP = path.join(ROOT, "ship", "key-vision");
const PORT = Number(process.env.E2E_PORT || 8767);
const BASE = `http://127.0.0.1:${PORT}/?v=452live`;

function waitHttp(url, tries = 40) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else if (n <= 0) reject(new Error(`bad status ${res.statusCode}`));
        else setTimeout(() => tick(n - 1), 150);
      });
      req.on("error", () => {
        if (n <= 0) reject(new Error("server not up"));
        else setTimeout(() => tick(n - 1), 150);
      });
    };
    tick(tries);
  });
}

async function main() {
  const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: SHIP,
    stdio: "ignore",
  });
  const fail = [];
  const ok = [];
  const note = (pass, msg) => (pass ? ok : fail).push(msg);

  try {
    await waitHttp(`http://127.0.0.1:${PORT}/index.html`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(25000);
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const bar = document.getElementById("wallCountBar");
      const cards = document.querySelectorAll(".wall-card");
      return bar && /452|张/.test(bar.textContent || "") && cards.length > 0;
    });

    const bar = (await page.locator("#wallCountBar").innerText()).trim();
    note(/452/.test(bar) || /张/.test(bar), `count bar: ${bar}`);

    const chips = {};
    for (const cat of ["primary", "analogy", "cross", "shelf"]) {
      chips[cat] = (await page.locator(`.cat-chip[data-cat="${cat}"]`).innerText()).trim();
    }
    note(/同类 · 446/.test(chips.primary), `同类 chip ${chips.primary}`);
    note(/不同类 · 2/.test(chips.analogy), `不同类 chip ${chips.analogy}`);
    note(/跨界 · 0/.test(chips.cross), `跨界 chip ${chips.cross}`);
    note(/货架 · 4/.test(chips.shelf), `货架 chip ${chips.shelf}`);

    const visibleCards = await page.locator(".wall-card").count();
    note(visibleCards >= 8, `visible wall cards ${visibleCards}`);

    await page.locator('.tab[data-tab="intent"]').click();
    await page.waitForSelector(".intent-panel");
    const brief = await page.locator(".intent-panel").innerText();
    note(/青绿茶礼盒/.test(brief), "L1 shows 青绿茶礼盒");
    note(/跨界 0/.test(brief) || /本轮跨界 0/.test(brief), "L1 states 跨界 0");

    // Category chips are only visible on the visual tab.
    await page.locator('.tab[data-tab="visual"]').click();
    await page.locator('.cat-chip[data-cat="cross"]').waitFor({ state: "visible" });
    await page.locator('.cat-chip[data-cat="cross"]').click();
    await page.waitForSelector(".empty, .wall-card");
    const crossEmpty = await page.locator(".empty").innerText().catch(() => "");
    note(/本轮跨界样本 0，不编造/.test(crossEmpty), `cross empty: ${crossEmpty.slice(0, 80)}`);

    await page.locator('.cat-chip[data-cat="all"]').click();
    await page.locator('.tab[data-tab="shortlist"]').click();
    await page.waitForSelector(".l4-panel");
    const sl = await page.locator(".l4-panel").innerText();
    const slCount = await page.locator(".l4-panel .sl-item").count();
    note(slCount >= 8 && slCount <= 12, `L4 shortlist cards ${slCount}`);
    note(/路线：/.test(sl) && /贴 brief：/.test(sl), "L4 reasons include 路线/贴 brief");
    note(/检索词：/.test(sl), "L4 reasons include 检索词");
    note(!/色块与留白节奏可借鉴/.test(sl), "L4 has no invented craft prose");

    await page.locator('.tab[data-tab="report"]').click();
    await page.waitForSelector(".rp-sec");
    const report = await page.locator("#canvasBody").innerText();
    const secHeads = await page.locator(".rp-sec h4").allInnerTexts();
    note(secHeads.length >= 6, `L5 section heads ${secHeads.join(" | ")}`);
    note(
      secHeads.some((h) => h.includes("分析对象")) &&
        secHeads.some((h) => h.includes("入选参考")) &&
        secHeads.some((h) => h.includes("差异化机会")),
      "L5 has 分析对象 / 入选参考 / 差异化机会"
    );
    note(!/满版热闹/.test(report), "L5 has no invented differentiation prose");
    note(/方向假设/.test(report) || /青绿新中轴/.test(report), "L5 hangs direction cards as 假设");

    await browser.close();
  } catch (err) {
    fail.push(String(err && err.message ? err.message : err));
  } finally {
    server.kill("SIGTERM");
  }

  const out = { ok: fail.length === 0, pass: ok, fail };
  console.log(JSON.stringify(out, null, 2));
  if (fail.length) process.exit(1);
}

main();
