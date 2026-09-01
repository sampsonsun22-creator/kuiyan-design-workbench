/**
 * POST /api/pack/collect
 * Body: { product } | { product_name } from brief.product. No official URLs.
 * Tavily search + extract (TAVILY_API_KEY). No bag/PDP URLs live in this file.
 * Tavily 429/432/no key → brand-site HTML search. Never Firecrawl / Apify / browser automation.
 * Does not write 452 / 093316 jsonl. PET_FOOD_DIRECTED stays empty.
 */
const PET_FOOD_DIRECTED = "";
const TAVILY_SEARCH = "https://api.tavily.com/search";
const TAVILY_EXTRACT = "https://api.tavily.com/extract";
const BANNED_JD = new Set(["100121540384", "35482167913", "709835"]);
const SHORT_PRODUCT = new Set(["宠物", "粮", "粮包"]);
const BRAND_SITES = [
  { re: /orijen|渴望/i, hosts: ["orijenpetfoods.com"] },
  { re: /acana|爱肯拿/i, hosts: ["acana.com"] },
  { re: /royal\s*canin|皇家/i, hosts: ["royalcanin.com.cn", "royalcanin.com"] },
];
const DROP_HOST =
  /zhihu|weibo|xiaohongshu|facebook|instagram|pinterest|tiktok|taobao|tmall|wikipedia|wikimedia|sitemap/i;
const DROP_PATH = /\/(faq|help|support|list|search|category|categories|collections|sitemap)(\/|$)/i;
const SKU_PATH =
  /\/products\/\d+|\/ds-[a-z0-9-]+|\/dog-food\/[^/?#]+|\/cat-food\/[^/?#]+/i;
const JD_RE = /item\.jd\.com\/(\d+)\.html/i;
const DROP_IMAGE =
  /logo|academy|menu|lifestyle|生活场|人宠|喂养|详情|长图|_1000px|成分|对比|favicon|sprite/i;
const BAG_HINT = /front|袋|pack|hero|master-catalog|sw=1200|\.png(?:$|\?)/i;

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

function tavilyKey() {
  return String(process.env.TAVILY_API_KEY || "").trim();
}

function isTooShort(product) {
  const name = String(product || "").trim();
  if (!name) return true;
  if (name.length < 4) return true;
  if (SHORT_PRODUCT.has(name)) return true;
  return false;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_) {
    return "";
  }
}

function isBannedUrl(url) {
  const s = String(url || "");
  const m = s.match(JD_RE);
  if (m && BANNED_JD.has(m[1])) return true;
  if (/100121540384|35482167913|709835/.test(s)) return true;
  if (/wikipedia\.|wikimedia\.|upload\.wikimedia/i.test(s)) return true;
  return false;
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function productTokens(product) {
  return String(product || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((t) => t.length >= 3 && !/^(the|and|dog|cat|food|dry|pet|for)$/i.test(t));
}

function isSkuPage(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "/";
    if (DROP_HOST.test(u.hostname) || DROP_PATH.test(path)) return false;
    if (path === "/" || path === "") return false;
    if (/\/(puppy|adult|senior|grain-free|grain-inclusive|small-breed|large-breed|healthy-weight)\/?$/i.test(path) && !/\/ds-/.test(path)) {
      return false;
    }
    if (JD_RE.test(url) && !isBannedUrl(url)) return true;
    if (SKU_PATH.test(path)) return true;
    if (/\/dogs\/dog-food\/|\/cats\/cat-food\//i.test(path) && path.split("/").filter(Boolean).length >= 5) {
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function skuScore(url, product) {
  let s = 0;
  const host = hostOf(url);
  const path = decodeURIComponent(String((() => {
    try {
      return new URL(url).pathname;
    } catch (_) {
      return url;
    }
  })()) || "").toLowerCase();
  if (BRAND_SITES.some((b) => b.hosts.some((h) => host.endsWith(h)))) s += 6;
  if (SKU_PATH.test(url)) s += 4;
  if (/\/ds-[a-z0-9-]+/i.test(path)) s += 5;
  if (/\/dogs\/dog-food\/|\/cats\/cat-food\//i.test(url)) s += 3;
  if (JD_RE.test(url) && !isBannedUrl(url)) s += 2;
  const tokens = productTokens(product);
  tokens.forEach((t) => {
    if (path.includes(t)) s += 6;
  });
  if (/freeze-dried|treat|fdt|fdf|medallion/i.test(path) && !/freeze|treat|冻干|零食/.test(String(product || ""))) {
    s -= 4;
  }
  const last = (path.split("/").pop() || "").replace(/\.html$/, "");
  const extra = last.split(/[-_]/).filter((p) => p && !tokens.includes(p) && !/^(ds|ori|dog|cat|html)$/i.test(p));
  s -= extra.length;
  return s;
}

function pickSku(urls, product) {
  const rows = [...new Set((urls || []).filter((u) => u && !isBannedUrl(u) && isSkuPage(u)))];
  rows.sort((a, b) => skuScore(b, product) - skuScore(a, product));
  return rows[0] || "";
}

function collectUrls(value, out) {
  if (!value) return;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectUrls(v, out));
    return;
  }
  if (typeof value === "object") {
    collectUrls(value.url || value.src || value.image || value.href, out);
  }
}

function extractUrlsFromText(text) {
  const out = [];
  const blob = String(text || "");
  const re = /https?:\/\/[^\s"'<>\\)]+/gi;
  let m;
  while ((m = re.exec(blob))) out.push(m[0].replace(/[),.;]+$/, ""));
  return out;
}

function brandHostsFor(product) {
  const name = String(product || "");
  const hosts = [];
  BRAND_SITES.forEach((b) => {
    if (b.re.test(name)) hosts.push(...b.hosts);
  });
  return [...new Set(hosts)];
}

function brandSearchUrls(host, query) {
  const q = encodeURIComponent(query);
  return [
    `https://www.${host}/search?q=${q}`,
    `https://www.${host}/en-US/search?q=${q}`,
    `https://${host}/search?q=${q}`,
  ];
}

function fetchTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 12000);
  return fetch(url, { ...opts, signal: ctrl.signal, redirect: "follow" }).finally(() => clearTimeout(timer));
}

async function tavilyPost(path, body) {
  const key = tavilyKey();
  const res = await fetchTimeout(
    path,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, api_key: key }),
    },
    20000
  );
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { message: text.slice(0, 240) };
  }
  if (!res.ok) {
    const err = new Error(data.message || data.error || `tavily ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function isTavilyBackoff(err) {
  const status = Number(err && err.status);
  return status === 429 || status === 432;
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
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X" && buf.length >= 30) {
      const width = 1 + buf.readUIntLE(24, 3);
      const height = 1 + buf.readUIntLE(27, 3);
      if (width > 0 && height > 0) return { width, height, ratio: height / width };
    }
    if (chunk === "VP8 " && buf.length >= 30) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      if (width > 0 && height > 0) return { width, height, ratio: height / width };
    }
    if (chunk === "VP8L" && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      if (width > 0 && height > 0) return { width, height, ratio: height / width };
    }
  }
  return null;
}

function nameScore(url) {
  const s = String(url || "");
  let n = 0;
  if (BAG_HINT.test(s)) n += 3;
  if (/master-catalog|Front/i.test(s)) n += 3;
  if (/[?&]sw=1200\b/i.test(s)) n += 2;
  if (DROP_IMAGE.test(s)) n -= 6;
  return n;
}

function keepBag(meta, minSide) {
  if (!meta || !meta.ratio) return false;
  if (meta.ratio >= 3) return false;
  if (meta.ratio < 0.8 || meta.ratio > 2.2) return false;
  const side = Math.min(meta.width || 0, meta.height || 0);
  if (side < minSide) return false;
  return true;
}

async function probeImage(url) {
  const res = await fetchTimeout(
    url,
    {
      method: "GET",
      headers: {
        Range: "bytes=0-65535",
        Accept: "image/*,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; KeyVisionPack/1.0)",
      },
    },
    10000
  );
  if (!res.ok && res.status !== 206) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = parseAspect(buf);
  if (!meta) return null;
  const len = Number(res.headers.get("content-length") || 0);
  return { url, ...meta, bytes: len || buf.length };
}

async function chooseBag(urls) {
  const ranked = [
    ...new Set(
      (urls || [])
        .map((u) => decodeHtml(u))
        .filter((u) => /^https:\/\//i.test(u) && !isBannedUrl(u) && !DROP_IMAGE.test(u))
    ),
  ].sort((a, b) => nameScore(b) - nameScore(a));
  const measured = [];
  for (const url of ranked.slice(0, 10)) {
    try {
      const meta = await probeImage(url);
      if (!meta) continue;
      measured.push(meta);
    } catch (_) {}
  }
  const longN = measured.filter((m) => m.ratio >= 3).length;
  if (longN >= 3) return { item: null, longN, measured };
  const pick = (minSide) =>
    measured.find((m) => keepBag(m, minSide) && nameScore(m.url) >= 0) || measured.find((m) => keepBag(m, minSide));
  return { item: pick(400) || pick(200) || null, longN, measured };
}

function htmlHrefs(html, base) {
  const out = [];
  const re = /(?:href|src)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    try {
      out.push(new URL(decodeHtml(m[1]), base).href);
    } catch (_) {}
  }
  const srcset = /srcset=["']([^"']+)["']/gi;
  while ((m = srcset.exec(String(html || "")))) {
    String(m[1])
      .split(",")
      .forEach((part) => {
        const u = decodeHtml(part.trim().split(/\s+/)[0]);
        if (!u) return;
        try {
          out.push(new URL(u, base).href);
        } catch (_) {}
      });
  }
  return out;
}

async function fetchHtml(url) {
  const res = await fetchTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*",
        "User-Agent": "Mozilla/5.0 (compatible; KeyVisionPack/1.0)",
      },
    },
    12000
  );
  if (!res.ok) return "";
  const ctype = String(res.headers.get("content-type") || "");
  if (ctype && !/html|xml|text/i.test(ctype)) return "";
  return await res.text();
}

function titleFromHtml(html, fallback) {
  const blob = String(html || "");
  const og = blob.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i) || blob.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (og && og[1] && !/meta data/i.test(og[1])) return decodeHtml(og[1]).replace(/\s+/g, " ").trim().slice(0, 80);
  const h1 = blob.match(/<h1[^>]*>([^<]+)/i);
  if (h1 && h1[1]) return decodeHtml(h1[1]).replace(/\s+/g, " ").trim().slice(0, 80);
  const m = blob.match(/<title[^>]*>([^<]+)/i);
  if (m && m[1] && !/meta data/i.test(m[1])) return decodeHtml(m[1]).replace(/\s+/g, " ").trim().slice(0, 80);
  return fallback;
}

async function collectViaTavily(product) {
  const query = `${product} pack bag front`;
  const search = await tavilyPost(TAVILY_SEARCH, {
    query,
    include_images: true,
    search_depth: "basic",
    max_results: 10,
  });
  const pageUrls = [];
  const imageUrls = [];
  (search.results || []).forEach((r) => {
    collectUrls(r && r.url, pageUrls);
    collectUrls(r && r.images, imageUrls);
    extractUrlsFromText(r && r.content).forEach((u) => {
      if (/\.(png|jpe?g|webp)(\?|$)/i.test(u)) imageUrls.push(u);
      else pageUrls.push(u);
    });
  });
  collectUrls(search.images, imageUrls);

  let sku = pickSku(pageUrls, product);
  let pageTitle = product;
  if (sku) {
    const extracted = await tavilyPost(TAVILY_EXTRACT, {
      urls: [sku],
      include_images: true,
      extract_depth: "basic",
    });
    const rows = extracted.results || extracted.data || [];
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row) {
      collectUrls(row.images, imageUrls);
      extractUrlsFromText(row.raw_content || row.content).forEach((u) => {
        if (/\.(png|jpe?g|webp)(\?|$)/i.test(u)) imageUrls.push(u);
      });
      if (row.url && isSkuPage(row.url)) sku = row.url;
    }
  }
  if (!sku) sku = pickSku(pageUrls.concat(imageUrls), product);
  const picked = await chooseBag(imageUrls);
  if (!picked.item || !sku) {
    return {
      ok: false,
      channel: "tavily",
      error: picked.longN >= 3 ? "同一页长图过多，整项丢" : "no_sku",
      no_sku: !sku,
    };
  }
  return {
    ok: true,
    channel: "tavily",
    item: {
      name: pageTitle,
      pack_url: decodeHtml(picked.item.url),
      deep_link: sku,
      width: picked.item.width,
      height: picked.item.height,
      ratio: Number(picked.item.ratio.toFixed(3)),
      bytes: picked.item.bytes || 0,
    },
    items: [picked.item].map((im) => ({
      name: pageTitle,
      pack_url: decodeHtml(im.url),
      deep_link: sku,
      width: im.width,
      height: im.height,
      ratio: Number(im.ratio.toFixed(3)),
      bytes: im.bytes || 0,
    })),
  };
}

async function collectViaBrandSite(product) {
  const hosts = brandHostsFor(product);
  if (!hosts.length) {
    return { ok: false, channel: "brand_site", error: "no_sku", no_sku: true };
  }
  const rest = String(product)
    .replace(/orijen|渴望|acana|爱肯拿|royal\s*canin|皇家/gi, " ")
    .trim() || product;
  const pageUrls = [];
  const imageUrls = [];
  let pageHtml = "";
  let sku = "";
  for (const host of hosts) {
    for (const searchUrl of brandSearchUrls(host, rest)) {
      try {
        const html = await fetchHtml(searchUrl);
        if (!html) continue;
        htmlHrefs(html, searchUrl).forEach((u) => pageUrls.push(u));
      } catch (_) {}
    }
    sku = pickSku(pageUrls, product);
    if (sku) break;
  }
  if (!sku) {
    return { ok: false, channel: "brand_site", error: "no_sku", no_sku: true };
  }
  try {
    pageHtml = await fetchHtml(sku);
    htmlHrefs(pageHtml, sku).forEach((u) => {
      if (/\.(png|jpe?g|webp)(\?|$)/i.test(u) || /image|media|cdn|catalog/i.test(u)) imageUrls.push(u);
    });
  } catch (_) {}
  const picked = await chooseBag(imageUrls);
  if (!picked.item) {
    return {
      ok: false,
      channel: "brand_site",
      error: picked.longN >= 3 ? "同一页长图过多，整项丢" : "空袋面",
      no_sku: false,
    };
  }
  const name = titleFromHtml(pageHtml, product);
  return {
    ok: true,
    channel: "brand_site",
    item: {
      name,
      pack_url: decodeHtml(picked.item.url),
      deep_link: sku,
      width: picked.item.width,
      height: picked.item.height,
      ratio: Number(picked.item.ratio.toFixed(3)),
      bytes: picked.item.bytes || 0,
    },
    items: [
      {
        name,
        pack_url: decodeHtml(picked.item.url),
        deep_link: sku,
        width: picked.item.width,
        height: picked.item.height,
        ratio: Number(picked.item.ratio.toFixed(3)),
        bytes: picked.item.bytes || 0,
      },
    ],
  };
}

async function collectPack(product) {
  const name = String(product || "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "missing product" };
  if (isTooShort(name)) {
    return { ok: false, error: "no_truncate", no_truncate: true, no_sku: true };
  }
  void PET_FOOD_DIRECTED;

  const key = tavilyKey();
  if (key) {
    try {
      const viaTavily = await collectViaTavily(name);
      if (viaTavily.ok) return viaTavily;
      if (viaTavily.error && viaTavily.error !== "no_sku") return viaTavily;
    } catch (err) {
      if (!isTavilyBackoff(err)) {
        try {
          return await collectViaBrandSite(name);
        } catch (_) {
          return { ok: false, channel: "tavily", error: String(err.message || err).slice(0, 240) };
        }
      }
    }
  }
  const fallback = await collectViaBrandSite(name);
  if (fallback.ok) return fallback;
  if (!key) {
    return {
      ok: false,
      channel: "brand_site",
      missing_key: true,
      error: fallback.error || "TAVILY_API_KEY 未配置，官网降级未收到袋面",
      no_sku: Boolean(fallback.no_sku),
    };
  }
  return fallback;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }
  if (req.method === "GET") {
    json(res, 200, {
      ok: true,
      ready: Boolean(tavilyKey()),
      missing_key: !tavilyKey(),
      channel: "tavily",
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
    const code = out.ok ? 200 : out.missing_key ? 503 : 422;
    json(res, code, out);
  } catch (err) {
    json(res, err.status && err.status < 600 ? err.status : 502, {
      ok: false,
      error: String(err.message || err).slice(0, 240),
    });
  }
}

handler.collectPack = collectPack;
module.exports = handler;
module.exports.collectPack = collectPack;
module.exports.isTooShort = isTooShort;
module.exports.isSkuPage = isSkuPage;
module.exports.isBannedUrl = isBannedUrl;
module.exports.pickSku = pickSku;
module.exports.parseAspect = parseAspect;
module.exports.keepBag = keepBag;
module.exports.PET_FOOD_DIRECTED = PET_FOOD_DIRECTED;
module.exports.config = { maxDuration: 60 };
