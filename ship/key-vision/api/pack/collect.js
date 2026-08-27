/**
 * POST /api/pack/collect
 * Body: { product } | { product_name } from brief.product. No official URLs.
 * Server-only CONTEXT_DEV_API_KEY → Context.dev web-search / extract / scrape-images.
 * Lands bag-front + clickable deep link. Does not write 452/2680 jsonl.
 *
 * Context.dev MCP schema (verified, not hardcoded SKUs):
 * - web-search: query, numResults ≥10 (32602 if lower), country cn|us
 * - web-extract: url, schema, instructions, factCheck, maxPages, maxDepth
 * - web-scrape-images: url, enrichment{classification,hostedUrl,resolution}, dedupe, maxAgeMs
 */
const CONTEXT_API = "https://api.context.dev/v1";
const BANNED_JD = new Set(["100121540384", "35482167913", "709835"]);
const PREFER_HOSTS = ["orijenpetfoods.com", "royalcanin.com.cn", "royalcanin.com"];
const DROP_HOST = /zhihu|weibo|xiaohongshu|facebook|instagram|pinterest|tiktok|sitemap/i;
const DROP_PATH = /\/(faq|help|support|list|search|category|categories|collections|sitemap)(\/|$)/i;
const SKU_PATH = /\/products\/\d+|\/(dog-food|cat-food)\/[^/?#]+|\/(cats|dogs)\/products\/\d+/i;
const JD_RE = /item\.jd\.com\/(\d+)\.html/i;
const LONG_NAME = /详情|长图|_1000px|lifestyle|喂养|成分|对比|人宠/i;
const BAG_NAME = /front|袋|pack|31lb|hero/i;

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > 200000) {
        reject(new Error("payload too large"));
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8") || "{}";
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}

function hasHan(s) {
  return /[\u4e00-\u9fff]/.test(String(s || ""));
}

function searchQuery(product) {
  const name = String(product || "").trim();
  if (hasHan(name)) return name;
  return `${name} dry food`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_) {
    return "";
  }
}

function isBannedUrl(url) {
  const m = String(url || "").match(JD_RE);
  if (m && BANNED_JD.has(m[1])) return true;
  if (/100121540384|35482167913|709835/.test(String(url || ""))) return true;
  return false;
}

function isSkuPage(url) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const path = u.pathname || "/";
    if (DROP_HOST.test(host) || DROP_PATH.test(path)) return false;
    if (path === "/" || path === "") return false;
    if (JD_RE.test(url) && !isBannedUrl(url)) return true;
    if (SKU_PATH.test(path)) return true;
    if (/\/dogs\/dog-food\/|\/cats\/cat-food\//i.test(path) && path.split("/").filter(Boolean).length >= 3) {
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function skuScore(url) {
  const host = hostOf(url);
  let s = 0;
  if (PREFER_HOSTS.some((h) => host.endsWith(h))) s += 6;
  if (SKU_PATH.test(url)) s += 4;
  if (/\/dogs\/dog-food\/|\/cats\/cat-food\//i.test(url)) s += 3;
  if (JD_RE.test(url) && !isBannedUrl(url)) s += 2;
  return s;
}

function pickSku(results) {
  const rows = (results || [])
    .map((r) => r && r.url)
    .filter((u) => u && !isBannedUrl(u) && isSkuPage(u));
  rows.sort((a, b) => skuScore(b) - skuScore(a));
  return rows[0] || "";
}

function pickJd(results, extraUrls) {
  const pool = []
    .concat((results || []).map((r) => r && r.url))
    .concat(extraUrls || []);
  for (const u of pool) {
    const m = String(u || "").match(JD_RE);
    if (m && !BANNED_JD.has(m[1])) return `https://item.jd.com/${m[1]}.html`;
  }
  return "";
}

async function contextFetch(path, { method, body, query } = {}) {
  const key = process.env.CONTEXT_DEV_API_KEY || "";
  const url = new URL(CONTEXT_API + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v == null || v === "") return;
      if (typeof v === "object") {
        Object.entries(v).forEach(([ck, cv]) => url.searchParams.set(`${k}[${ck}]`, String(cv)));
      } else {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url, {
    method: method || "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { message: text.slice(0, 240) };
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `context ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function parseAspect(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height, ratio: height / width };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        if (width > 0 && height > 0) return { width, height, ratio: height / width };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function probeImage(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-65535" },
    redirect: "follow",
  });
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return parseAspect(buf);
}

function nameScore(url) {
  const s = String(url || "");
  let n = 0;
  if (BAG_NAME.test(s)) n += 2;
  if (LONG_NAME.test(s)) n -= 4;
  return n;
}

function keepBag(meta) {
  if (!meta || !meta.ratio) return false;
  if (meta.ratio >= 3) return false;
  if (meta.ratio < 0.8 || meta.ratio > 2.2) return false;
  return true;
}

async function chooseBag(urls) {
  const ranked = [...new Set((urls || []).filter((u) => /^https:\/\//i.test(u) && !isBannedUrl(u)))].sort(
    (a, b) => nameScore(b) - nameScore(a)
  );
  const measured = [];
  for (const url of ranked.slice(0, 8)) {
    try {
      const meta = await probeImage(url);
      if (!meta) continue;
      measured.push({ url, ...meta });
    } catch (_) {}
  }
  const longN = measured.filter((m) => m.ratio > 2.2).length;
  if (longN >= 3) return { item: null, longN, measured };
  const bag = measured.find((m) => keepBag(m) && nameScore(m.url) >= 0) || measured.find(keepBag);
  return { item: bag || null, longN, measured };
}

async function collectPack(product) {
  const name = String(product || "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "missing product" };
  if (!process.env.CONTEXT_DEV_API_KEY) {
    return { ok: false, missing_key: true, error: "CONTEXT_DEV_API_KEY 未配置" };
  }

  const query = searchQuery(name);
  const country = hasHan(name) ? "cn" : "us";
  const search = await contextFetch("/web/search", {
    method: "POST",
    body: { query, numResults: 10, country, timeoutMS: 30000 },
  });
  const sku = pickSku(search.results || []);
  if (!sku) {
    return { ok: false, error: "没有官网商品页", query };
  }

  const extracted = await contextFetch("/web/extract", {
    method: "POST",
    body: {
      url: sku,
      maxPages: 1,
      maxDepth: 0,
      factCheck: true,
      instructions:
        "Extract the official product pack/bag front image. Prefer the hero pack shot of the bag, not lifestyle photos.",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          product_name: { type: "string" },
          product_url: { type: "string" },
          pack_image_urls: { type: "array", items: { type: "string" } },
          hero_image_url: { type: "string" },
        },
      },
    },
  });
  const data = extracted.data || extracted.result || {};
  let urls = []
    .concat(data.hero_image_url || [])
    .concat(data.pack_image_urls || [])
    .filter(Boolean);

  if (urls.length < 2) {
    const qs = new URLSearchParams({
      url: sku,
      dedupe: "true",
      maxAgeMs: "0",
      "enrichment[classification]": "true",
      "enrichment[hostedUrl]": "true",
      "enrichment[resolution]": "true",
    });
    const imgs = await contextFetch(`/web/scrape/images?${qs.toString()}`, { method: "GET" });
    (imgs.images || []).forEach((im) => {
      const en = im && im.enrichment ? im.enrichment : {};
      const src = (en && (en.hostedUrl || en.url)) || (im && (im.src || im.url));
      if (src) urls.push(src);
    });
  }

  const picked = await chooseBag(urls);
  if (!picked.item) {
    return {
      ok: false,
      error: picked.longN >= 3 ? "同一页长图过多，整项丢" : "空袋面",
      sku,
    };
  }

  let deep = pickJd(search.results || [], [data.product_url, sku]);
  if (!deep) {
    const jdSearch = await contextFetch("/web/search", {
      method: "POST",
      body: { query: `${name} site:item.jd.com`, numResults: 10, country, timeoutMS: 20000 },
    });
    deep = pickJd(jdSearch.results || [], []);
  }
  if (deep && isBannedUrl(deep)) deep = "";
  const deepLink = deep || sku;

  return {
    ok: true,
    item: {
      name: data.product_name || name,
      pack_url: picked.item.url,
      deep_link: deepLink,
      product_url: data.product_url || sku,
      width: picked.item.width,
      height: picked.item.height,
      ratio: Number(picked.item.ratio.toFixed(3)),
    },
  };
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.method === "GET") {
    json(res, 200, {
      ok: true,
      ready: Boolean(process.env.CONTEXT_DEV_API_KEY),
      missing_key: !process.env.CONTEXT_DEV_API_KEY,
    });
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  let payload = {};
  try {
    payload = await readBody(req);
  } catch (err) {
    json(res, 400, { ok: false, error: err.message || "invalid json" });
    return;
  }
  if (payload.url || payload.product_url || payload.sku || payload.sku_url || payload.page_url) {
    json(res, 400, { ok: false, error: "only brief.product; do not send official URL" });
    return;
  }
  const product = String(payload.product || payload.product_name || "").trim();
  if (!product) {
    json(res, 400, { ok: false, error: "missing product" });
    return;
  }
  try {
    const out = await collectPack(product);
    json(res, out.ok ? 200 : out.missing_key ? 503 : 422, out);
  } catch (err) {
    json(res, err.status || 502, {
      ok: false,
      error: String(err.message || err).slice(0, 240),
    });
  }
}

handler.collectPack = collectPack;
module.exports = handler;
module.exports.collectPack = collectPack;
module.exports.config = { maxDuration: 60 };
