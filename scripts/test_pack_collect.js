#!/usr/bin/env node
/**
 * Unit tests for /api/pack/collect — no live bag/PDP URLs hardcoded in collect.js.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const collectPath = path.join(__dirname, "../ship/key-vision-live/api/pack/collect.js");
const src = fs.readFileSync(collectPath, "utf8");
const {
  collectPack,
  isTooShort,
  isSkuPage,
  isBannedUrl,
  pickSku,
  parseAspect,
  keepBag,
  PET_FOOD_DIRECTED,
} = require(collectPath);

function png(width, height) {
  const buf = Buffer.alloc(24);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

async function main() {
  assert.strictEqual(PET_FOOD_DIRECTED, "");
  assert.strictEqual(isTooShort("宠物"), true);
  assert.strictEqual(isTooShort("粮"), true);
  assert.strictEqual(isTooShort("粮包"), true);
  assert.strictEqual(isTooShort("abc"), true);
  assert.strictEqual(isTooShort("Orijen Original"), false);
  assert.strictEqual(isSkuPage("https://www.orijenpetfoods.com/"), false);
  assert.strictEqual(isSkuPage("https://www.orijenpetfoods.com/en-US/dog-food/sample-sku.html"), true);
  assert.strictEqual(isSkuPage("https://www.orijenpetfoods.com/en-US/dogs/dog-food/puppy"), false);
  assert.strictEqual(isSkuPage("https://www.orijenpetfoods.com/en-US/dogs/dog-food/original/ds-ori-sample.html"), true);
  assert.strictEqual(isSkuPage("https://www.acana.com/products/12"), true);
  assert.strictEqual(isSkuPage("https://item.jd.com/100121540384.html"), false);
  assert.strictEqual(isBannedUrl("https://upload.wikimedia.org/wikipedia/commons/a.png"), true);
  assert.ok(pickSku(["https://www.orijenpetfoods.com/en-US/dog-food/sample-sku.html"]));

  const bag = parseAspect(png(800, 1000));
  assert.ok(bag && keepBag(bag, 400));
  const tall = parseAspect(png(400, 1400));
  assert.ok(tall && !keepBag(tall, 400));

  for (const banned of [
    "STAPLES",
    "gG2W7r",
    "pxmshare",
    "ds-ori-original",
    "PNG_2000",
    "localhost",
    "vercel.app",
    "playwright",
    "Indoor 27",
  ]) {
    assert.ok(!src.includes(banned), `collect.js must not contain ${banned}`);
  }
  assert.ok(!/https:\/\/[^"' `\n]*\.(png|jpe?g|webp)/i.test(src), "collect.js must not hardcode image URLs");

  const short = await collectPack("粮");
  assert.strictEqual(short.ok, false);
  assert.strictEqual(short.no_truncate, true);
  assert.strictEqual(short.no_sku, true);

  const calls = [];
  const prevFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const href = String(url);
    calls.push({ href, body: opts && opts.body });
    if (href.includes("api.tavily.com/search")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            results: [
              {
                title: "Orijen Original Dog",
                url: "https://www.orijenpetfoods.com/en-US/dog-food/sample-sku.html",
              },
            ],
            images: ["https://cdn.example.test/master-catalog/Front.png?sw=1200"],
          }),
      };
    }
    if (href.includes("api.tavily.com/extract")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            results: [
              {
                url: "https://www.orijenpetfoods.com/en-US/dog-food/sample-sku.html",
                images: ["https://cdn.example.test/master-catalog/Front.png?sw=1200"],
              },
            ],
          }),
      };
    }
    if (href.includes("cdn.example.test")) {
      return {
        ok: true,
        status: 206,
        headers: { get: (k) => (String(k).toLowerCase() === "content-length" ? "4096" : "") },
        arrayBuffer: async () => png(800, 1000),
      };
    }
    return { ok: false, status: 404, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => "" } };
  };
  process.env.TAVILY_API_KEY = "test-key-not-real";
  try {
    const got = await collectPack("Orijen Original");
    assert.strictEqual(got.ok, true, JSON.stringify(got));
    assert.strictEqual(got.channel, "tavily");
    assert.ok(got.item.pack_url.includes("Front.png"));
    assert.ok(got.item.deep_link.includes("/dog-food/"));
    assert.ok(got.item.width >= 400);
    assert.ok(!calls.some((c) => /playwright/i.test(c.href)));
  } finally {
    delete process.env.TAVILY_API_KEY;
    global.fetch = prevFetch;
  }

  const prev2 = global.fetch;
  process.env.TAVILY_API_KEY = "test-key-not-real";
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes("api.tavily.com")) {
      return { ok: false, status: 429, text: async () => JSON.stringify({ message: "rate" }) };
    }
    if (/orijenpetfoods\.com\/.*search/.test(href)) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () =>
          `<html><a href="/en-US/dog-food/sample-sku.html">sku</a></html>`,
      };
    }
    if (href.includes("/dog-food/sample-sku.html")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () =>
          `<html><title>Orijen Original</title><img src="https://cdn.example.test/master-catalog/Front.png?sw=1200"></html>`,
      };
    }
    if (href.includes("cdn.example.test")) {
      return {
        ok: true,
        status: 206,
        headers: { get: (k) => (String(k).toLowerCase() === "content-length" ? "4096" : "") },
        arrayBuffer: async () => png(800, 1000),
      };
    }
    return { ok: false, status: 404, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => "" } };
  };
  try {
    const fallback = await collectPack("Orijen Original");
    assert.strictEqual(fallback.ok, true, JSON.stringify(fallback));
    assert.strictEqual(fallback.channel, "brand_site");
    assert.ok(fallback.item.pack_url);
    assert.ok(fallback.item.deep_link);
  } finally {
    delete process.env.TAVILY_API_KEY;
    global.fetch = prev2;
  }

  console.log(JSON.stringify({ ok: true, tests: "pack-collect" }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
