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
const BASE = `http://127.0.0.1:${PORT}/?v=452p18`;

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

    note(await page.locator("body.studio").count().then((n) => n === 1), "studio body class");
    note(await page.locator(".rail").count().then((n) => n === 1), "task sidebar rail");
    note(await page.locator("#userDock").count().then((n) => n === 1), "user permission dock");
    note(await page.locator("#libraryLanes").count().then((n) => n === 1), "library lane chips");
    note(await page.locator("#composerInput").count().then((n) => n === 1), "LLM composer present");
    note(await page.locator("#composerModel").count().then((n) => n === 1), "composer model chip");
    note(await page.locator("#railSearch").count().then((n) => n === 1), "rail task search");
    note((await page.locator("#btnNewResearch").innerText()).includes("新建分析"), "new analysis button");
    note(await page.locator("#btnNavResult").innerText().then((t) => t.includes("素材库")), "rail 素材库");
    note(await page.locator("#btnNavSearch").innerText().then((t) => t.includes("搜索")), "rail 搜索");
    note(await page.locator(".rail-h").innerText().then((t) => t.includes("研究任务")), "rail 研究任务");
    note(await page.locator("#btnDockGear").count().then((n) => n === 1), "user dock gear");
    note(await page.locator("#cmdOverlay").count().then((n) => n === 1), "command palette overlay");
    note(await page.locator("#slashMenu").count().then((n) => n === 1), "slash command menu");
    note(await page.locator("#btnCommandPalette").count().then((n) => n === 1), "command palette button");
    note(await page.locator(".rail #btnRailCollapse").count().then((n) => n === 1), "rail collapse lives on the rail");
    note(await page.locator("#scopeChips").count().then((n) => n === 1), "click-to-scope chip row");
    note(await page.locator("#activityStream .run[data-jump]").count().then((n) => n >= 2), "run stamps can jump to artifacts");
    note(await page.locator("#app.rail-collapsed").count().then((n) => n === 0), "task rail expanded by default");
    await page.keyboard.press("Control+k");
    note(await page.locator("#cmdOverlay").isVisible(), "Ctrl+K opens command palette");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.getElementById("cmdOverlay")?.hidden);
    await page.keyboard.press("Control+b");
    note(await page.locator("#app.rail-collapsed").count().then((n) => n === 1), "Ctrl+B collapses task rail");
    await page.keyboard.press("Control+b");
    note(await page.locator("#app.rail-collapsed").count().then((n) => n === 0), "Ctrl+B expands task rail");
    await page.locator("#composerInput").fill("/");
    note(await page.locator("#slashMenu").isVisible(), "typing / opens slash menu");
    await page.locator("#composerInput").fill("");
    await page.keyboard.press("Escape");
    await page.locator("#btnToggleArtifact").click();
    const threadBox = await page.locator(".thread").boundingBox();
    const workBox = await page.locator(".workspace").boundingBox();
    note(
      Boolean(threadBox && workBox && threadBox.width <= 780 && Math.abs(threadBox.x + threadBox.width / 2 - (workBox.x + workBox.width / 2)) < 40),
      "chat column centers when result pane is closed"
    );
    await page.locator("#btnToggleArtifact").click();
    await page.waitForFunction(() => document.getElementById("app")?.classList.contains("artifact-open"));
    note(await page.locator("#activityStream .brief-table").count().then((n) => n === 1), "Brief table in stream");
    const bootStream = (await page.locator("#activityStream").innerText()).trim();
    note(/检索自有库/.test(bootStream) && /452/.test(bootStream), `boot stream retrieve log: ${bootStream.slice(0, 60)}`);
    note(await page.locator("#activityStream .run").count().then((n) => n >= 3), "Codex-style run stamps on boot");
    note(
      await page.locator("#runStep").evaluate((n) => /3\/5/.test(n.textContent || "")),
      "step footer 3/5"
    );
    note((await page.locator('.tab[data-tab="intent"]').innerText()).trim() === "Brief", "tab Brief");
    note((await page.locator('.tab[data-tab="visual"]').innerText()).trim() === "参考", "tab 参考");
    note((await page.locator('.tab[data-tab="shortlist"]').innerText()).trim() === "短名单", "tab 短名单");
    note((await page.locator('.tab[data-tab="report"]').innerText()).trim() === "结论", "tab 结论");
    note(await page.locator(".gutter-rail").count().then((n) => n === 1), "resizable task gutter");
    note(await page.locator(".gutter-result").count().then((n) => n === 1), "resizable result gutter");
    note(await page.locator("#app.artifact-open").count().then((n) => n === 1), "result pane open by default");
    note(await page.locator("#artifactPane").isVisible(), "result pane visible");
    const railBox = await page.locator(".rail").boundingBox();
    const chatBox = await page.locator(".workspace").boundingBox();
    const resultBox = await page.locator("#artifactPane").boundingBox();
    note(Boolean(railBox && chatBox && resultBox && railBox.x < chatBox.x && chatBox.x < resultBox.x), "Codex 3-pane left-chat-result order");
    await page.locator("#btnToggleArtifact").click();
    note(await page.locator("#app.artifact-open").count().then((n) => n === 0), "result pane can pop away");
    await page.locator("#btnToggleArtifact").click();
    await page.waitForFunction(() => document.getElementById("app")?.classList.contains("artifact-open"));

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
    note(await page.locator("#wallFilters").count().then((n) => n === 1), "unified 出处+分类 filter panel");
    note(
      await page.locator('#sourceChips [data-source="__other__"]').count().then((n) => n === 1),
      "long-tail sources collapsed into 其他"
    );
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
    await page.waitForSelector("#inspectorBody a.insp-open, #inspectorBody .insp-url-box");
    note(await page.locator("#scopeChips").isVisible(), "tile click scopes the composer");
    note(
      await page.locator("#scopeChips").innerText().then((t) => t.includes("这张图")),
      "scope chip labeled 这张图"
    );
    const inspHref =
      (await page.locator("#inspectorBody a.insp-open").getAttribute("href").catch(() => null)) ||
      (await page.locator("#inspectorBody [data-copy-url]").getAttribute("data-copy-url").catch(() => null));
    note(await page.locator("#inspectorBody .why-quad").count().then((n) => n === 1), "inspector why-quad");
    const whyTxt = await page.locator("#inspectorBody .why-quad").innerText();
    note(/贴合/.test(whyTxt) && /路线/.test(whyTxt) && /可落地/.test(whyTxt) && /证据/.test(whyTxt), `why-quad cells ${whyTxt.slice(0, 80)}`);
    note(!/荐 92/.test(whyTxt), "why-quad does not invent 荐 92");
    note(/^https?:\/\//.test(inspHref || ""), `inspector origin ${inspHref}`);
    note(await page.locator("#inspectorBody [data-copy-url]").count().then((n) => n === 1), "inspector has 复制链接");
    const inspUrlTxt = await page.locator("#inspectorBody .insp-url").innerText().catch(() => "");
    note(/^https?:\/\//.test(inspUrlTxt), `inspector shows full URL as text ${inspUrlTxt.slice(0, 60)}`);
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
    await page.waitForSelector("#canvasBody .empty, #canvasBody .wall-card");
    const crossEmpty = await page.locator("#canvasBody .empty").innerText().catch(() => "");
    note(/本轮跨界样本 0，不编造/.test(crossEmpty), `cross empty: ${crossEmpty.slice(0, 80)}`);

    await page.locator('.cat-chip[data-cat="all"]').click();
    await page.locator('.lib-chip[data-lib="head"]').click();
    await page.waitForSelector("#canvasBody .empty, #canvasBody .wall-card");
    const headEmpty = await page.locator("#canvasBody .empty").innerText().catch(() => "");
    note(/本轮库未标/.test(headEmpty) && /头部/.test(headEmpty), `head volume empty: ${headEmpty.slice(0, 80)}`);
    await page.locator('.lib-chip[data-lib=""]').click();
    await page.waitForFunction(() => /452/.test(document.getElementById("wallCountBar")?.textContent || ""));

    await page.locator('.tab[data-tab="shortlist"]').click();
    await page.waitForSelector(".l4-panel");
    note(
      await page.locator("#resultChromeTitle").innerText().then((t) => /候选方向/.test(t)),
      "shortlist chrome 候选方向"
    );
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
    await page.waitForFunction(() => /未命名/.test(document.getElementById("researchTitle")?.textContent || ""));
    note(
      await page.locator("#app.artifact-open").count().then((n) => n === 0),
      "new task does not pop the result pane"
    );
    note(
      await page.locator(".intent-panel").count().then((n) => n === 0),
      "new task has no canned L1 form"
    );
    const newStream = (await page.locator("#activityStream").innerText()).trim();
    note(
      !/新任务已建|这是新建的一轮|L1 意图识别|已打开「未命名/.test(newStream),
      `new task stream stays blank: ${newStream.slice(0, 40)}`
    );
    await page.locator("#composerInput").fill("/");
    await page.locator('#slashMenu [data-slash="lib"]').click();
    note(
      await page.locator("#app.artifact-open").count().then((n) => n === 0),
      "slash 看库 on draft keeps artifact closed"
    );
    note(
      !(await page.locator("#researchTitle").innerText()).includes("看库"),
      "slash 看库 is not absorbed as product"
    );
    await page.locator("#btnNavResult").click();
    note(
      await page.locator("#app.artifact-open").count().then((n) => n === 0),
      "素材库 on draft does not pop"
    );
    await page.fill("#composerInput", "青绿茶礼盒");
    await page.locator("#sendBtn").click();
    await page.waitForFunction(() => /记下|卖给谁|人群/.test(document.getElementById("activityStream")?.textContent || ""));
    note(
      await page.locator("#app.artifact-open").count().then((n) => n === 0),
      "first chat turn still keeps results closed"
    );
    note(
      await page.locator("#activityStream .run[data-jump]").count().then((n) => n === 0),
      "draft run rows do not jump the held pane"
    );
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
    note(/下载报告/.test(report), "L5 has download-report control");
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
