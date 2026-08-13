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
const BASE = `http://127.0.0.1:${PORT}/?v=452p5`;

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
    note(/花瓣/.test(bar) && /过期/.test(bar), `count bar states expired 花瓣 links: ${bar}`);

    const chips = {};
    for (const cat of ["primary", "analogy", "cross", "shelf"]) {
      chips[cat] = (await page.locator(`.cat-chip[data-cat="${cat}"]`).innerText()).trim();
    }
    const nOf = (t) => Number((String(t).match(/(\d+)\s*$/) || [])[1] || NaN);
    const nSame = nOf(chips.primary);
    const nAdj = nOf(chips.analogy);
    const nCross = nOf(chips.cross);
    const nShelf = nOf(chips.shelf);
    note(/同类/.test(chips.primary) && nSame >= 400, `同类 chip ${chips.primary}`);
    note(/不同类/.test(chips.analogy) && nAdj >= 2, `不同类 chip ${chips.analogy}`);
    note(/跨界/.test(chips.cross) && nCross === 0, `跨界 chip ${chips.cross}`);
    note(/货架/.test(chips.shelf) && nShelf === 4, `货架 chip ${chips.shelf}`);
    note(nSame + nAdj + nCross + nShelf === 452, `lane sum ${nSame}+${nAdj}+${nCross}+${nShelf}`);

    const visibleCards = await page.locator(".wall-card").count();
    note(visibleCards >= 8, `visible wall cards ${visibleCards}`);

    const srcPills = await page.locator("#sourceChips .source-card").count();
    note(srcPills >= 6 && srcPills <= 20, `source pills ${srcPills}`);
    note(
      (await page.locator("#sourceChips .source-kicker").innerText()) === "出处",
      "source bar labeled 出处"
    );
    note(await page.locator('#sourceChips [data-source="all"]').count().then((n) => n === 1), "source bar has 全部");
    const pillH = await page.locator("#sourceChips .source-card").first().evaluate((el) =>
      el.getBoundingClientRect().height
    );
    note(pillH <= 36, `source pill height ${pillH}`);

    const originLinks = page.locator(".wall-card a.src-link");
    const originN = await originLinks.count();
    note(originN >= 8, `wall origin links ${originN}`);
    const hrefs = await originLinks.evaluateAll((as) => as.map((a) => a.getAttribute("href") || ""));
    note(
      hrefs.length > 0 && hrefs.every((h) => /^https?:\/\//.test(h)),
      "wall origin hrefs are collected http(s) page_url"
    );
    note(
      hrefs.some((h) => /behance\.net|packagingoftheworld|xiaohongshu|zcool|pinterest/.test(h)),
      "wall origin links hit known source hosts"
    );

    await page.locator('#sourceChips [data-source="behance"]').click();
    await page.waitForFunction(() => /这屏/.test(document.getElementById("wallCountBar")?.textContent || ""));
    const filteredBar = (await page.locator("#wallCountBar").innerText()).trim();
    note(/这屏/.test(filteredBar), `source filter count bar: ${filteredBar}`);
    await page.locator('#sourceChips [data-source="behance"]').click();
    await page.waitForFunction(() => /452/.test(document.getElementById("wallCountBar")?.textContent || ""));

    await page.locator(".wall-card .thumb").first().click();
    await page.waitForSelector("#inspectorBody a.insp-link");
    const inspHref = await page.locator("#inspectorBody a.insp-url").getAttribute("href");
    note(/^https?:\/\//.test(inspHref || ""), `inspector origin ${inspHref}`);
    note(await page.locator("#inspectorBody [data-copy-url]").count().then((n) => n === 1), "inspector has 复制链接");
    const inspTxt = await page.locator("#inspectorBody .inspector-origin").innerText();
    note(/behance|packaging|小红书|花瓣|pinterest|站酷|京东|淘宝/i.test(inspTxt), `inspector provenance ${inspTxt.slice(0, 80)}`);
    await page.locator("#inspectorToggle").click();

    await page.locator('.tab[data-tab="intent"]').click();
    await page.waitForSelector(".intent-panel");
    const brief = await page.locator(".intent-panel").innerText();
    note(/青绿茶礼盒/.test(brief), "L1 shows 青绿茶礼盒");
    note(/跨界 0/.test(brief) || /本轮跨界 0/.test(brief), "L1 states 跨界 0");
    const audienceAt = brief.indexOf("卖给谁");
    const objectAt = brief.indexOf("分析对象");
    note(audienceAt >= 0 && objectAt > audienceAt, "L1 lists 卖给谁 before 分析对象");

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
    const l4Links = await page.locator(".l4-panel a.sl-open").count();
    note(l4Links >= 8, `L4 origin links ${l4Links}`);
    note(/路线：/.test(sl) && /贴 brief：/.test(sl), "L4 reasons include 路线/贴 brief");
    note(/检索词：/.test(sl), "L4 reasons include 检索词");
    note(/奎燕先验/.test(sl), "L4 reasons include 奎燕先验");
    note(!/色块与留白节奏可借鉴/.test(sl), "L4 has no invented craft prose");

    await page.fill("#houCommentBox", "不要金红，多留白");
    await page.locator('[data-shortlist-action="rescreen"]').click();
    await page.waitForTimeout(400);
    const slAfter = await page.locator(".l4-panel").innerText();
    const toastTxt = await page.locator("#toast").innerText().catch(() => "");
    note(
      /重筛|重排|留白|金红/.test(slAfter + toastTxt),
      `L4 comment rescreen reacts: ${(slAfter + toastTxt).slice(0, 80)}`
    );

    note(await page.locator("#btnNewResearch").isEnabled(), "新建研究 enabled");
    note(await page.locator("#btnLlmSettings").count().then((n) => n === 1), "gear settings button present");
    await page.locator("#btnLlmSettings").click();
    await page.waitForSelector("#llmOverlay:not([hidden])");
    const llmTxt = await page.locator("#llmDialog").innerText();
    note(/奎燕设计智能体/.test(llmTxt) && /采集/.test(llmTxt) && /点点/.test(llmTxt), "settings lists three agents");
    await page.locator("#llmClose").click();

    await page.locator("#btnNewResearch").click();
    await page.waitForSelector(".intent-panel");
    const newBrief = await page.locator(".intent-panel").innerText();
    note(/这是新建的一轮|墙是空的/.test(newBrief), `new research brief: ${newBrief.slice(0, 60)}`);
    await page.locator('.research-card[data-id="r-green"]').click();
    await page.locator('.tab[data-tab="visual"]').click();
    await page.waitForFunction(() => /452/.test(document.getElementById("wallCountBar")?.textContent || ""));

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
    note(/淘宝色板/.test(report) && /字体/.test(report), "L5 states color-board and type coverage gaps");
    note(/复制本页要点/.test(report), "L5 has copy-report control");
    const l5Links = await page.locator(".rp-shortlist a.rp-link").count();
    note(l5Links >= 8, `L5 origin links ${l5Links}`);
    const l5Href = await page.locator(".rp-shortlist a.rp-link").first().getAttribute("href");
    note(/^https?:\/\//.test(l5Href || ""), `L5 first origin ${l5Href}`);

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
