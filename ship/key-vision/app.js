/* KEY 视界 · Light Research Lab shell
 * P0: Inspector 320 / 选中底栏 / 黄 pill / 品牌三行 / 人情味文案
 */
(() => {
  const STAGES = [
    { id: 1, key: "brief", label: "先听清你要什么", tab: "visual" },
    { id: 2, key: "crawl", label: "去市场上找参考", tab: "visual" },
    { id: 3, key: "explore", label: "一起看版图", tab: "visual" },
    { id: 4, key: "critique", label: "商量方向", tab: "strategy" },
    { id: 5, key: "output", label: "收成短名单", tab: "shortlist" },
  ];

  const SOURCE_META = {
    behance: { label: "Behance" },
    pinterest: { label: "Pinterest" },
    huaban: { label: "花瓣" },
    xiaohongshu: { label: "小红书" },
    zcool: { label: "站酷" },
    packagingoftheworld: { label: "Packaging of the World" },
    jd: { label: "京东" },
    taobao: { label: "淘宝" },
  };

  const PINNED_SOURCES = [
    "behance",
    "packagingoftheworld",
    "pinterest",
    "huaban",
    "xiaohongshu",
    "zcool",
    "taobao",
    "jd",
  ];

  const WALL_BATCH_INITIAL = 60;
  const WALL_BATCH_STEP = 60;

  const CAPS = [
    {
      id: "orchestrator",
      name: "奎燕设计智能体",
      status: "online",
      lastAction: "正在帮你对齐青绿茶礼盒 Brief",
    },
    {
      id: "crawler",
      name: "采集",
      status: "idle",
      lastAction: "设计站参考已挂上 · 货架还在开通",
    },
    {
      id: "dotdot",
      name: "点点",
      status: "working",
      lastAction: "正在帮你铺视觉主墙、准备策略批判",
    },
  ];

  // 青绿茶必须走壳权威 452/2680，禁止回落到 184 口径的过时绿茶 brief 文件
  const RESEARCHES = [
    {
      id: "r-green",
      title: "青绿茶礼盒竞品调研",
      date: "2026-08-12",
      status: "running",
      active: true,
      question:
        "新品牌青绿茶礼盒：中式现代气质下，礼赠+电商渠道如何做出开箱记忆点与差异化？",
      feeds: {
        main: ["data/l2_main_wall.jsonl", "data/l2-main-wall.jsonl"],
        pending: ["data/l2_pending_review.jsonl", "data/l2-pending-review.jsonl"],
      },
      bundle: "data/product-bundle.json",
      onlyBriefDefault: true,
    },
    {
      id: "r-baijiu",
      title: "白酒礼盒竞品调研",
      date: "2026-08-12",
      status: "done",
      question: "白酒礼盒：礼赠场如何做出体面开箱与货架识别，又避开金红模板？",
      feeds: { main: ["data/briefs/baijiu_gift_main_wall.jsonl"] },
      onlyBriefDefault: false,
    },
    {
      id: "r-tonic",
      title: "滋补礼盒开箱记忆点",
      date: "2026-08-12",
      status: "done",
      question: "滋补礼盒：中式现代气质下，如何做出开箱记忆点与差异化？",
      feeds: { main: ["data/briefs/tonic_gift_main_wall.jsonl"] },
      onlyBriefDefault: false,
    },
  ];

  const state = {
    bundle: null,
    stage: 3,
    tab: "visual",
    caps: CAPS.map((c) => ({ ...c })),
    decisions: {},
    selectedIds: new Set(),
    focusId: null,
    inspectorOpen: false,
    activeSource: null,
    activeCat: "all",
    includePending: false,
    onlyBriefRelevant: true,
    wallItems: [],
    pendingItems: [],
    shortlistVisual: [],
    sources: [],
    bucketIdToZh: {},
    preferredBuckets: [],
    wallVisibleLimit: WALL_BATCH_INITIAL,
    feedCounts: { main: 0, pending: 0 },
    activeStyleFilter: "",
    activeResearchId: "r-green",
    _wallObserver: null,
    _greenBundle: null,
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    capList: $("capList"),
    researchList: $("researchList"),
    stages: $("stages"),
    stream: $("activityStream"),
    composer: $("composer"),
    composerInput: $("composerInput"),
    canvasBody: $("canvasBody"),
    sourceChips: $("sourceChips"),
    categoryChips: $("categoryChips"),
    filters: $("filters"),
    inspector: $("inspector"),
    inspectorBody: $("inspectorBody"),
    inspectorToggle: $("inspectorToggle"),
    selectionBar: $("selectionBar"),
    selCount: $("selCount"),
    toast: $("toast"),
    researchQuestion: $("researchQuestion"),
    qCount: $("qCount"),
    researchTitle: $("researchTitle"),
    btnNew: $("btnNewResearch"),
    right: document.querySelector(".right"),
    wallCountBar: $("wallCountBar"),
    pendingToggle: $("pendingToggle"),
    briefToggle: $("briefToggle"),
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("show"), 2200);
  }

  
  function humanTitle(raw) {
    const s0 = String(raw || "").trim();
    if (!s0) return "精选包装参考";
    let s = s0;
    if (/^pin:\d+/i.test(s) || /^q:/i.test(s)) return "精选包装参考";
    s = s.replace(/^(pin:|q:)\s*/i, "").trim();
    if (/^\d{6,}$/.test(s)) return "精选包装参考";
    if (s.length < 2) return "精选包装参考";
    return s.length > 48 ? s.slice(0, 48) + "…" : s;
  }

  function humanSource(s) {
    const raw0 = String(s || "").trim();
    if (!raw0) return "来源待核实";
    const raw = raw0.replace(/^(pin:|q:)\s*/i, "").trim() || raw0;
    if (/^pin:/i.test(raw0) || /^q:/i.test(raw0)) return "精选参考";
    const key = raw.toLowerCase();
    if (/pinterest|pinimg/.test(key)) return "Pinterest";
    if (/behance/.test(key)) return "Behance";
    if (/huaban|花瓣/.test(key)) return "花瓣";
    if (/zcool|站酷/.test(key)) return "站酷";
    if (/xiaohongshu|小红书/.test(key)) return "小红书";
    if (/packagingoftheworld|potw/.test(key)) return "Packaging of the World";
    if (/\bjd\b|京东/.test(key)) return "京东";
    if (/taobao|淘宝/.test(key)) return "淘宝";
    if (/dribbble/.test(key)) return "Dribbble";
    if (SOURCE_META[key]?.label) return SOURCE_META[key].label;
    if (/^[a-z0-9_-]+$/i.test(raw)) {
      return raw.replace(/[-_]/g, " ").replace(/\b([a-z])/g, (m, ch) => ch.toUpperCase());
    }
    return raw.length > 24 ? raw.slice(0, 24) + "…" : raw;
  }
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }


  function imgFor(item) {
    return item.thumbnail_url || item.image_url || item.local_ref_image || "";
  }

  /** Hosts that currently hotlink-fail from this shell; demote so first paint stays usable. */
  function isFragileImageHost(url) {
    if (!url) return true;
    return /huaban\.com|gd-hbimg|hbimg\.huaban/i.test(url);
  }

  function demoteFragileWallOrder(items) {
    const good = [];
    const fragile = [];
    items.forEach((it) => {
      if (isFragileImageHost(imgFor(it))) fragile.push(it);
      else good.push(it);
    });
    return good.concat(fragile);
  }

  function setCap(id, status, lastAction) {
    const c = state.caps.find((x) => x.id === id);
    if (!c) return;
    c.status = status;
    if (lastAction) c.lastAction = lastAction;
    renderCaps();
  }

  function renderCaps() {
    el.capList.innerHTML = state.caps
      .map(
        (c) => `
      <li class="cap-card ${c.id === "orchestrator" ? "active" : ""}" data-id="${c.id}">
        <span class="dot ${c.status}"></span>
        <div>
          <div class="cap-name">${escapeHtml(c.name)}</div>
          <div class="cap-action">${escapeHtml(c.lastAction)}</div>
        </div>
      </li>`
      )
      .join("");
  }

  function renderResearch() {
    el.researchList.innerHTML = RESEARCHES.map(
      (r) => `
      <li class="research-card ${r.active ? "active" : ""}" data-id="${r.id}">
        <div class="rtitle">${escapeHtml(r.title)}</div>
        <div class="rmeta">
          <span>${escapeHtml(r.date)}</span>
          <span class="badge ${r.status}">${r.status === "running" ? "进行中" : "已完成"}</span>
        </div>
      </li>`
    ).join("");
  }

  function renderSources() {
    const list = state.sources.length
      ? state.sources
      : Object.entries(SOURCE_META).map(([id, m]) => ({
          id,
          label: m.label,
          status: "pending",
          statusText: "待加载",
          count: 0,
        }));
    el.sourceChips.innerHTML = list
      .map(
        (s) => `
      <button type="button" class="source-card ${state.activeSource === s.id ? "active" : ""}" data-source="${s.id}">
        <span class="sc-name">${escapeHtml(s.label)}${s.count != null ? ` · ${s.count}` : ""}</span>
        <span class="sc-status"><span class="sdot ${s.status}"></span>${escapeHtml(s.statusText)}</span>
      </button>`
      )
      .join("");
  }


  // Hard product lock: pending OFF until user explicitly toggles after boot settle
  let userArmedPending = false;
  let bootSettled = false;
  function forceProductWallDefaults(reason) {
    state.includePending = false;
    const r = RESEARCHES.find((x) => x.id === state.activeResearchId) || RESEARCHES[0];
    state.onlyBriefRelevant = r.onlyBriefDefault !== false;
    const pt = el.pendingToggle || document.getElementById("pendingToggle");
    const bt = el.briefToggle || document.getElementById("briefToggle");
    if (pt) {
      pt.classList.remove("active");
      pt.setAttribute("aria-pressed", "false");
      pt.dataset.pending = "0";
    }
    if (bt) {
      bt.classList.toggle("active", state.onlyBriefRelevant);
      bt.setAttribute("aria-pressed", state.onlyBriefRelevant ? "true" : "false");
      bt.dataset.brief = state.onlyBriefRelevant ? "1" : "0";
    }
    updateWallCountBar();
  }

  function updateWallCountBar() {
    if (!el.wallCountBar) return;
    const main = state.feedCounts.main || 0;
    const pending = state.feedCounts.pending || 0;
    if (!main && !pending && !state.wallItems.length) {
      el.wallCountBar.textContent = "墙还在长";
      return;
    }
    const shown = getFilteredWallItems().length;
    if (state.onlyBriefRelevant && !state.includePending) {
      // Default product view: N tracks on-brief main wall, never "当前 > 主墙"
      const n = main || shown;
      el.wallCountBar.innerHTML = `先看和 brief 更贴的 · 约 ${n} 张`;
      return;
    }
    if (state.includePending) {
      el.wallCountBar.innerHTML = `主墙 ${main} · 含待复核 · 这屏 ${shown}`;
      return;
    }
    el.wallCountBar.innerHTML = `主墙 ${main} · 这屏 ${shown}`;
  }

  function parseJsonl(textIn) {
    const items = [];
    for (const line of String(textIn || "").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        items.push(JSON.parse(t));
      } catch (_) {}
    }
    return items;
  }

  function bucketName(item) {
    const ids = item.suggested_style_buckets || item.buckets || [];
    const id = Array.isArray(ids) && ids.length ? ids[0] : null;
    if (id && state.bucketIdToZh[id]) return state.bucketIdToZh[id];
    if (item.bucket && typeof item.bucket === "string" && !/^[a-z_]+$/.test(item.bucket)) {
      return item.bucket;
    }
    if (id) return state.bucketIdToZh[id] || id;
    if (item.category_label) return item.category_label;
    return "其他";
  }

  function normalizeFeedItem(raw, wallStatus) {
    const status = wallStatus || raw.wall_status || "main_wall";
    const pending = status === "pending_review";
    const item = {
      ...raw,
      wall_status: status,
      qc_status: pending ? "pending_review" : "pass_main",
      pending,
      image_url: raw.image_url || raw.thumbnail_url || "",
      thumbnail_url: raw.thumbnail_url || raw.image_url || "",
      title: humanTitle(raw.title || raw.name || ""),
      _raw_id: raw.id || "",
      source: raw.source || "",
      page_url: raw.page_url || "",
      query_used: raw.query_used || "",
      suggested_style_buckets: raw.suggested_style_buckets || [],
    };
    item.bucket = bucketName(item);
    return item;
  }

  function sourceChipStatus(id, n) {
    const listing = id === "taobao" || id === "jd";
    if (listing) {
      return n
        ? { status: "thin", statusText: `listing 样 · ${n}` }
        : { status: "pending", statusText: "货架通道待开通" };
    }
    if (id === "zcool") {
      if (!n) return { status: "thin", statusText: "薄页/待深采" };
      return n < 8
        ? { status: "thin", statusText: `薄页 · ${n}` }
        : { status: "ok", statusText: `已采集 · ${n}` };
    }
    if (id === "huaban") {
      return n
        ? { status: "thin", statusText: `已采集 · ${n}（部分裂图）` }
        : { status: "pending", statusText: "待采集" };
    }
    if (n) return { status: "ok", statusText: `已采集 · ${n}` };
    return { status: "pending", statusText: "待采集" };
  }

  function rebuildSourcesFromWall() {
    const counts = {};
    for (const it of state.wallItems) {
      const s = String(it.source || "").toLowerCase();
      if (!s) continue;
      counts[s] = (counts[s] || 0) + 1;
    }
    const pinnedIds = new Set(PINNED_SOURCES);
    const pinned = PINNED_SOURCES.map((id) => {
      const n = counts[id] || 0;
      return {
        id,
        label: (SOURCE_META[id] && SOURCE_META[id].label) || id,
        count: n,
        ...sourceChipStatus(id, n),
      };
    });
    const extras = Object.entries(counts)
      .filter(([id]) => !pinnedIds.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({
        id,
        label: (SOURCE_META[id] && SOURCE_META[id].label) || id,
        status: "ok",
        statusText: `已上墙 ${count}`,
        count,
      }));
    state.sources = [...pinned, ...extras];
    renderSources();
    const styleSel = el.filters && el.filters.querySelector('[data-filter="style"]');
    if (styleSel) {
      const names = [...new Set(state.wallItems.map((it) => it.bucket).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "zh")
      );
      const cur = state.activeStyleFilter || "";
      styleSel.innerHTML =
        `<option value="">风格 · 全部</option>` +
        names
          .map(
            (n) =>
              `<option value="${escapeAttr(n)}"${n === cur ? " selected" : ""}>${escapeHtml(n)}</option>`
          )
          .join("");
    }
    const sourceSel = el.filters && el.filters.querySelector(".filter-source");
    if (sourceSel) {
      sourceSel.innerHTML =
        `<option value="">来源 · 全部</option>` +
        state.sources
          .map(
            (s) =>
              `<option value="${escapeAttr(s.id)}">${escapeHtml(s.label)} (${s.count})</option>`
          )
          .join("");
    }
  }

  function findWallItem(id) {
    return (
      state.wallItems.find((x) => x.id === id) ||
      state.pendingItems.find((x) => x.id === id) ||
      null
    );
  }

  function updateFilterRow() {
    const strategyMode = state.tab === "strategy" || state.tab === "shortlist";
    if (el.filters) el.filters.classList.toggle("strategy-mode", strategyMode);
    if (el.categoryChips) el.categoryChips.classList.toggle("strategy-mode", strategyMode);
    const srcFilter = document.querySelector(".filter-source");
    if (srcFilter) srcFilter.hidden = strategyMode;
    const sourceSel = el.filters && el.filters.querySelector(".filter-source");
    const dirSel = el.filters && el.filters.querySelector(".filter-direction");
    const toneSel = el.filters && el.filters.querySelector(".filter-tone");
    const marketSel = el.filters && el.filters.querySelector('[data-filter="market"]');
    const yearSel = el.filters && el.filters.querySelector('[data-filter="year"]');
    const styleSel = el.filters && el.filters.querySelector('[data-filter="style"]');
    const isVisual = state.tab === "visual";
    const isStrategy = state.tab === "strategy";
    // Visual-only filters must stay hidden on shortlist (strategyMode alone was overwritten before)
    if (sourceSel) sourceSel.hidden = !isVisual;
    if (styleSel) styleSel.hidden = !isVisual;
    if (yearSel) yearSel.hidden = !isVisual;
    if (dirSel) dirSel.hidden = !isStrategy;
    if (toneSel) toneSel.hidden = !isStrategy;
    if (marketSel) marketSel.hidden = !(isVisual || isStrategy);
    if (el.categoryChips) {
      el.categoryChips.style.display = state.tab === "visual" ? "" : "none";
    }
    if (el.sourceChips) {
      el.sourceChips.style.display = state.tab === "visual" ? "" : "none";
    }
    if (el.wallCountBar) {
      el.wallCountBar.style.display = state.tab === "visual" ? "" : "none";
    }
  }

  function syncStageButtons(n) {
    el.stages.querySelectorAll(".stage").forEach((btn) => {
      const id = Number(btn.dataset.stage);
      const isActive = id === n;
      const isDone = id < n;
      btn.classList.toggle("active", isActive);
      btn.classList.toggle("done", isDone);
      const mark = btn.querySelector(".n");
      if (mark) mark.textContent = isDone ? "✓" : String(id);
    });
  }

  function setStage(n, { syncTab = true, appendEvent = true } = {}) {
    state.stage = n;
    syncStageButtons(n);
    const meta = STAGES.find((s) => s.id === n);
    if (syncTab && meta) switchTab(meta.tab, { fromStage: true });
    if (appendEvent) pushStageEvent(n);
  }

  function switchTab(tab, { fromStage = false } = {}) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateFilterRow();
    renderCanvas();
    if (!fromStage) {
      const map = { visual: 3, strategy: 4, shortlist: 5 };
      if (map[tab] && map[tab] !== state.stage) {
        state.stage = map[tab];
        syncStageButtons(state.stage);
      }
    }
  }

  function collectWallItems() {
    return collectWallItemsFromBundleFallback();
  }

  function collectWallItemsFromBundleFallback() {
    const b = state.bundle;
    if (!b) return [];
    const seen = new Set();
    const items = [];
    const primary = b.l3?.walls?.primary?.by_bucket || {};
    Object.entries(primary).forEach(([bucket, list]) => {
      (list || []).forEach((it) => {
        if (seen.has(it.id)) return;
        seen.add(it.id);
        items.push(
          normalizeFeedItem(
            { ...it, bucket: it.bucket || bucket },
            "main_wall"
          )
        );
      });
    });
    (b.l3?.walls?.shelf?.items || []).forEach((it) => {
      if (seen.has(it.id)) return;
      seen.add(it.id);
      items.push(
        normalizeFeedItem(
          { ...it, bucket: (it.buckets && it.buckets[0]) || "货架" },
          "main_wall"
        )
      );
    });
    items.forEach((it) => {
      const cat = b.item_catalog?.[it.id];
      if (cat) {
        it.thumbnail_url = it.thumbnail_url || cat.thumbnail_url;
        it.image_url = it.image_url || cat.image_url;
        it.suggested_style_buckets = it.suggested_style_buckets || cat.suggested_style_buckets;
        it.source_type = cat.source_type;
      }
      it.bucket = bucketName(it);
    });
    return items.filter((it) => imgFor(it));
  }

  async function fetchFirstOk(paths) {
    let res = null;
    for (const p of paths) {
      res = await fetch(p);
      if (res.ok) return res;
    }
    return res;
  }

  async function loadMainWallText(paths) {
    const list = paths && paths.length
      ? paths
      : [
          "data/l2_main_wall.jsonl",
          "data/l2-main-wall.jsonl",
          "data/l2_main_wall_20260812.jsonl",
        ];
    for (const p of list) {
      const res = await fetch(p);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim()) return text;
      }
    }
    const a = await fetch("data/l2_main_wall_a.jsonl");
    const b = await fetch("data/l2_main_wall_b.jsonl");
    let text = "";
    if (a.ok) text += await a.text();
    if (b.ok) text += (text && !text.endsWith("\n") ? "\n" : "") + (await b.text());
    if (text.trim()) return text;
    throw new Error("main wall missing");
  }

  function normalizeBundle(j) {
    if (!j || typeof j !== "object") return { l4_cards: [] };
    if (!Array.isArray(j.l4_cards)) {
      if (Array.isArray(j.l4)) j.l4_cards = j.l4;
      else if (j.l4 && Array.isArray(j.l4.cards)) j.l4_cards = j.l4.cards;
      else j.l4_cards = [];
    }
    return j;
  }

  async function loadProductBundle() {
    const paths = ["data/product-bundle.json", "data/product-pack.json"];
    let fallback = null;
    for (const p of paths) {
      const res = await fetch(p);
      if (!res.ok) continue;
      const j = normalizeBundle(await res.json());
      if (j.l4_cards && j.l4_cards.length) return j;
      if (!fallback) fallback = j;
    }
    if (fallback) return fallback;
    throw new Error("product pack missing");
  }

  async function loadLiveFeeds(research) {
    const r = research || RESEARCHES.find((x) => x.id === state.activeResearchId) || RESEARCHES[0];
    const pendingPaths = (r.feeds && r.feeds.pending) || [
      "data/l2_pending_review.jsonl",
      "data/l2-pending-review.jsonl",
      "data/l2_pending_review_20260812.jsonl",
    ];
    const [mainText, pendingRes, bucketsRes] = await Promise.all([
      loadMainWallText(r.feeds && r.feeds.main),
      r.feeds && r.feeds.pending === undefined && r.id !== "r-green"
        ? Promise.resolve({ ok: false })
        : fetchFirstOk(pendingPaths),
      fetch("data/style-buckets-v1.json"),
    ]);
    if (bucketsRes.ok) {
      const bj = await bucketsRes.json();
      const map = {};
      (bj.buckets || []).forEach((b) => {
        if (b.id) map[b.id] = b.name_zh || b.id;
      });
      state.bucketIdToZh = { ...map, ...(state.bundle?.bucket_id_to_zh || {}) };
      if (state.bundle) {
        state.bundle.bucket_id_to_zh = { ...(state.bundle.bucket_id_to_zh || {}), ...map };
      }
    } else if (state.bundle?.bucket_id_to_zh) {
      state.bucketIdToZh = { ...state.bundle.bucket_id_to_zh };
    }
    const mainRaw = parseJsonl(mainText);
    const pendingRaw = pendingRes && pendingRes.ok ? parseJsonl(await pendingRes.text()) : [];
    state.wallItems = mainRaw
      .map((row) => normalizeFeedItem(row, "main_wall"))
      .filter((it) => imgFor(it) || it.page_url || it.id);
    if (!state.wallItems.length && mainRaw.length) {
      state.wallItems = mainRaw.map((row) => normalizeFeedItem(row, "main_wall"));
    }
    state.wallItems = demoteFragileWallOrder(state.wallItems);
    state.pendingItems = pendingRaw.map((row) => normalizeFeedItem(row, "pending_review"));
    state.feedCounts = {
      main: mainRaw.length,
      pending: pendingRaw.length,
    };
    state.wallVisibleLimit = WALL_BATCH_INITIAL;
    const freq = {};
    state.wallItems.forEach((it) => {
      freq[it.bucket] = (freq[it.bucket] || 0) + 1;
    });
    state.preferredBuckets = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    if (state.bundle?.l3) {
      state.bundle.l3.counts = {
        ...(state.bundle.l3.counts || {}),
        total: state.feedCounts.main + state.feedCounts.pending,
        with_image: state.feedCounts.main,
        main_wall: state.feedCounts.main,
        pending_review: state.feedCounts.pending,
      };
    }
    rebuildSourcesFromWall();
    updateWallCountBar();
    setCap(
      "crawler",
      "idle",
      `主墙 ${state.feedCounts.main} · 待复核 ${state.feedCounts.pending}`
    );
    setCap("dotdot", "idle", `主墙已经铺好，等你点选`);
    if (!userArmedPending) forceProductWallDefaults("after-feeds");
  }


  /** Mirror L3/brief_relevance_v1.py → 'match' | 'low' | 'off' (pass_brief / low / offtopic). */
  function scoreBriefRelevance(item) {
    if (!item) return "off";
    const pre = item.extra && item.extra.brief_relevance_v1;
    if (pre === "pass_brief" || pre === "keep_core" || pre === "keep_analogy") return "match";
    if (pre === "pending_low_relevance" || pre === "soft_pack_only") return "low";
    if (
      pre === "pending_offtopic" ||
      pre === "kill_noise" ||
      pre === "kill_unrelated"
    ) {
      return "off";
    }

    const tags = Array.isArray(item.raw_tags) ? item.raw_tags.join(" ") : "";
    const title = String(item.title || "");
    const query = String(item.query_used || "");
    const blob = [title, query, tags, String(item.category_label || "")].join(" ");

    const TEA_RE =
      /(?:茶|绿茶|青茶|红茶|白茶|乌龙|普洱|龙井|碧螺春|铁观音|茉莉花茶|matcha|green\s*tea|oolong|pu[-\s]?erh|camellia\s*sinensis|\btea\b|chá|cha\s*pack)/i;
    const PACK_RE =
      /包装|礼盒|packag|gift\s*box|giftbox|tea\s*box|tea\s*tin|盒装|罐装|\btin\b|carton|礼袋|开箱|package\s*design|礼赠|tea\s*gift|pouch|sachet|袋泡/i;
    const ANALOGY_RE =
      /黄酒|滋补礼|阿胶礼|阿胶|人参礼|保健礼盒|酒礼盒|sake\b|huangjiu|tonic\s*gift|herbal\s*gift|wine\s*gift\s*box|国际简约.*茶|简约.*茶.*包装|minimal\s*tea|养生滋补.*包装|新中式养生滋补/i;
    const NOISE_RE =
      /咖啡|coffee|latte|espresso|宠物|狗粮|猫粮|母婴|尿不湿|视觉锤|visual\s*hammer|语言钉|laura\s*ries|\bVI\b|视觉识别系统|logo\s*设计教程|美妆|口红|skincare|cosmetic|蛋白粉|维生素|claw\s*hammer|sledge|hammer\s*vector|榔头/i;
    const SOFT_PACK_HINT =
      /包装|packag|礼盒|gift\s*box|giftbox|branding|盒|瓶贴|label\s*design|package\s*design|product\s*packaging/i;

    const hasTea = TEA_RE.test(blob);
    const hasPack = PACK_RE.test(blob);
    const hasAnalogy = ANALOGY_RE.test(blob);
    const isNoise = NOISE_RE.test(blob);
    const softPack = SOFT_PACK_HINT.test(blob);
    const titleTeaPack = TEA_RE.test(title) && PACK_RE.test(title);
    const vhQuery = /视觉锤|visual\s*hammer|品牌视觉锤|laura\s*ries/i.test(query);

    if (vhQuery && !titleTeaPack && !(hasTea && hasPack)) return "off";
    if (isNoise && !(hasTea && hasPack) && !(hasAnalogy && hasPack)) return "off";
    if (hasTea && hasPack) return "match";
    if (hasAnalogy && hasPack) return "match";
    if (hasTea && /礼盒|gift|包装|packag/i.test(query)) return "match";
    if (softPack || hasPack) return "low";
    return "off";
  }

  function isBriefWeak(item) {
    return scoreBriefRelevance(item) !== "match";
  }

  function rankBriefRelevance(item) {
    const s = scoreBriefRelevance(item);
    if (s === "match") return 0;
    if (s === "low") return 1;
    return 2;
  }

  function isShelfItem(it) {
    if (!it) return false;
    const s = String(it.source || "").toLowerCase();
    const st = String(it.source_type || "").toLowerCase();
    const m = String(it.is_on_market || "").toLowerCase();
    return st === "shelf" || m === "true" || /^(jd|taobao|1688|tmall)$/.test(s);
  }

  function isAnalogyItem(it) {
    if (!it) return false;
    if (it.analogy_from) return true;
    const rel = (it.extra && it.extra.brief_relevance_v1) || "";
    if (rel === "keep_analogy") return true;
    const blob = [
      it.title,
      it.query_used,
      it.category_label,
      Array.isArray(it.raw_tags) ? it.raw_tags.join(" ") : "",
    ].join(" ");
    return /黄酒|滋补|阿胶|人参礼|sake\b|huangjiu|tonic\s*gift|herbal\s*gift|wine\s*gift|香氛|高端水|国潮美妆/.test(
      blob
    );
  }

  function briefRelLabel(item) {
    const pre = item?.extra?.brief_relevance_v1;
    const s = scoreBriefRelevance(item);
    if (pre === "keep_analogy" || (s === "match" && pre === "keep_analogy")) return "贴合（类比）";
    if (s === "match") return "贴合";
    if (s === "low") return "弱相关";
    return "跑题/低相关";
  }

  function getFilteredWallItems() {
    let items = state.wallItems.slice();
    if (state.includePending && state.pendingItems.length) {
      // Pending FIRST so progressive batches actually surface 待复核 cards
      // (appending after ~1820 pass_main made them unreachable until full load).
      const seen = new Set();
      const pendingFirst = [];
      state.pendingItems.forEach((it) => {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          pendingFirst.push(it);
        }
      });
      const mains = [];
      items.forEach((it) => {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          mains.push(it);
        }
      });
      items = pendingFirst.concat(mains);
    }
    if (state.activeCat === "primary") {
      items = items.filter((it) => !isShelfItem(it));
    } else if (state.activeCat === "analogy") {
      items = items.filter(isAnalogyItem);
    } else if (state.activeCat === "shelf" || state.activeCat === "pack") {
      items = items.filter(isShelfItem);
    } else if (state.activeCat === "case") {
      items = items.filter((it) => !isShelfItem(it));
    }
    if (state.activeSource) {
      items = items.filter(
        (it) =>
          String(it.source || "").toLowerCase() ===
          String(state.activeSource).toLowerCase()
      );
    }
    if (state.activeStyleFilter) {
      items = items.filter((it) => it.bucket === state.activeStyleFilter);
    }
    // Brief gate: ON → only match; OFF → prefer match, demote low/off.
    // 含待复核: pending stay first; apply brief rules within each group.
    function applyBriefOrder(list) {
      if (state.onlyBriefRelevant) {
        return list.filter((it) => scoreBriefRelevance(it) === "match");
      }
      return list.slice().sort((a, b) => rankBriefRelevance(a) - rankBriefRelevance(b));
    }
    if (state.includePending && state.pendingItems.length) {
      const pend = [];
      const mains = [];
      items.forEach((it) => {
        if (it.pending || it.qc_status === "pending_review") pend.push(it);
        else mains.push(it);
      });
      items = applyBriefOrder(pend).concat(applyBriefOrder(mains));
    } else {
      items = applyBriefOrder(items);
    }
    return items;
  }

  function wallCardHtml(it) {
    const pending = it.pending || it.qc_status === "pending_review";
    const weakBrief = isBriefWeak(it);
    const weak = pending || weakBrief;
    const sel = !weak && state.selectedIds.has(it.id);
    const srcLine = humanSource(it.source);
    const img = imgFor(it);
    const briefScore = scoreBriefRelevance(it);
    return `
          <article class="wall-card ${sel ? "selected" : ""} ${
            weak
              ? "qc-pending pending-review pending brief-weak"
              : "qc-pass"
          }" data-id="${escapeAttr(it.id)}" data-qc="${escapeAttr(
      it.qc_status || "pass_main"
    )}" data-brief="${escapeAttr(briefScore)}" title="${escapeAttr(it.page_url || "")}">
            ${weak ? "" : '<span class="check">✓</span>'}
            ${
              pending
                ? '<span class="qc-badge pending-badge">待复核</span>'
                : weakBrief
                  ? '<span class="qc-badge pending-badge">弱相关</span>'
                  : ""
            }
            <div class="thumb"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${escapeAttr(
              img
            )}" alt="${escapeAttr(it.title || "")}" onerror="this.onerror=null;this.classList.add('img-broken');const c=this.closest('.wall-card');if(c){c.classList.add('img-broken-card','qc-pending','pending-review');c.classList.remove('qc-pass','selected');c.hidden=true;}" /></div>
            <div class="meta">
              <div class="title">${escapeHtml(humanTitle(it.title || it.id))}</div>
              <div class="src">${escapeHtml(srcLine)}</div>
            </div>
          </article>`;
  }

  function updateSelectionBar() {
    const n = state.selectedIds.size;
    if (n > 0) {
      el.selectionBar.classList.remove("hidden");
      el.selCount.textContent = `先看这 ${n} 张`;
    } else {
      el.selectionBar.classList.add("hidden");
    }
  }

  /** Patch .selected on existing wall cards — avoid full re-render (scroll jump). */
  function syncWallSelectionClasses() {
    if (!el.canvasBody) return;
    el.canvasBody.querySelectorAll(".wall-card").forEach((card) => {
      const pending =
        card.classList.contains("pending-review") ||
        card.classList.contains("qc-pending") ||
        card.classList.contains("pending") ||
        card.classList.contains("brief-weak");
      const on = !pending && state.selectedIds.has(card.dataset.id);
      card.classList.toggle("selected", on);
    });
  }

  function briefRelation(item) {
    const input = state.bundle?.l1?.input || {};
    const tone = input.culture_tone || "中式现代";
    const buckets = item.suggested_style_buckets || [];
    const zh = (buckets || [])
      .map((id) => state.bucketIdToZh?.[id] || state.bundle?.bucket_id_to_zh?.[id] || id)
      .filter(Boolean);
    return {
      match: [
        `气质靠近 Brief 里说的「${tone}」`,
        item.bucket ? `正好落在「${item.bucket}」这一桶` : "能当礼赠视觉参照",
        input.must_have?.[0]
          ? `能撑住「必须有」：${input.must_have[0]}`
          : "开箱或主图有机会做出记忆点",
      ],
      why: [
        "你这轮要的是差异化，不是再堆一套金红喜庆",
        "这张图能帮团队快速对齐「克制外表 + 惊喜开箱」的感觉",
        "适合拿来当面讨论：留什么、砍什么",
      ],
      visual: [
        zh.length ? `风格线索：${zh.slice(0, 2).join(" / ")}` : "结构层次清楚、材质克制",
        "色块与留白节奏可借鉴",
        item.source ? `渠道味道来自 ${humanSource(item.source)}` : "国际简约与中式现代之间的空隙",
      ],
      learn: [
        "外侧克制、内侧做开箱惊喜的分层逻辑",
        "标题区与主视觉的主次关系",
        "礼赠感靠材质与结构，而不是堆装饰",
      ],
      risk: [
        (input.must_avoid && input.must_avoid[0]) || "容易滑向金红喜庆 / 仿古堆砌",
        "直接复刻结构会削弱差异化",
        "货架墙样本还偏弱，电商深采后再拍板更稳",
      ],
    };
  }

  function mergeFirecrawlIntoWall(rows) {
    if (!Array.isArray(rows) || !rows.length) return 0;
    const seen = new Set(state.wallItems.map((x) => x.id));
    let added = 0;
    rows.forEach((raw) => {
      if (!raw || !raw.id || seen.has(raw.id)) return;
      const it = normalizeFeedItem(raw, "main_wall");
      if (!imgFor(it)) return;
      if (!it.bucket || it.bucket === "其他") {
        const buckets = it.suggested_style_buckets || [];
        const bid = buckets[0];
        it.bucket =
          (bid && (state.bucketIdToZh[bid] || state.bundle?.bucket_id_to_zh?.[bid])) ||
          "深采补图";
      }
      it.collect_method = "firecrawl_scrape";
      seen.add(it.id);
      state.wallItems.push(it);
      added += 1;
    });
    if (added) {
      state.feedCounts.main = state.wallItems.length;
      if (state.bundle?.l3?.counts) {
        state.bundle.l3.counts.firecrawl_live = rows.length;
        state.bundle.l3.counts.main_wall = state.feedCounts.main;
        state.bundle.l3.counts.with_image = state.feedCounts.main;
      }
      rebuildSourcesFromWall();
      updateWallCountBar();
    }
    return added;
  }

  function openInspector(item) {
    state.focusId = item.id;
    const isPending = item.pending || item.qc_status === "pending_review";
    const weakBrief = isBriefWeak(item);
    if (!isPending && !weakBrief) state.selectedIds.add(item.id);
    state.inspectorOpen = true;
    el.inspector.classList.remove("hidden");
    el.right.classList.add("inspector-open");
    const rel = briefRelation(item);
    const bucketZh = (item.suggested_style_buckets || [])
      .map((id) => state.bucketIdToZh?.[id] || state.bundle?.bucket_id_to_zh?.[id] || id)
      .filter(Boolean);
    const struct = (item.structure_tags || []).filter(Boolean);
    const page = item.page_url || "";
    el.inspectorBody.innerHTML = `
      <div class="inspector-preview"><img referrerpolicy="no-referrer" src="${escapeAttr(imgFor(item))}" alt="" /></div>
      <div class="inspector-title">${escapeHtml(humanTitle(item.title || item.id))}</div>
      <div class="inspector-src">${escapeHtml(humanSource(item.source) || "来源待核实")}${
        item.author_or_brand ? " · " + escapeHtml(item.author_or_brand) : ""
      }</div>
      <p class="insp-summary">${escapeHtml(
        `这张偏「${item.bucket || "这路气质"}」，和 Brief 要的能对上一点；适合拿来商量开箱记忆，但别整段照搬。`
      )}</p>
      <div class="insp-block match">
        <h4><span class="ico">✓</span>匹配 Brief</h4>
        <ul>${rel.match.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="insp-block why">
        <h4><span class="ico">?</span>为何重要</h4>
        <ul>${rel.why.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="insp-block visual">
        <h4><span class="ico">◎</span>视觉元素</h4>
        <ul>${rel.visual.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="insp-block learn">
        <h4><span class="ico">→</span>可借鉴</h4>
        <ul>${rel.learn.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="insp-block risk">
        <h4><span class="ico">!</span>差异化风险</h4>
        <ul>${rel.risk.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      </div>
      <div class="insp-block collect">
        <h4><span class="ico">#</span>采集字段</h4>
        <ul>
          <li>来源：${escapeHtml(humanSource(item.source))} · ${escapeHtml(item.source_type || "未标类型")}</li>
          <li>贴 brief：${escapeHtml(briefRelLabel(item))}${
            item.extra && item.extra.brief_relevance_v1
              ? `（${escapeHtml(item.extra.brief_relevance_v1)}）`
              : ""
          }</li>
          <li>风格桶：${escapeHtml(bucketZh.join(" / ") || item.bucket || "待标注")}</li>
          ${
            struct.length
              ? `<li>结构：${escapeHtml(struct.slice(0, 4).join(" / "))}</li>`
              : ""
          }
          ${
            item.query_used
              ? `<li>检索：${escapeHtml(String(item.query_used).slice(0, 80))}</li>`
              : ""
          }
          ${
            page
              ? `<li><a class="insp-link" href="${escapeAttr(page)}" target="_blank" rel="noopener noreferrer">打开原页</a></li>`
              : "<li>原页链接待补</li>"
          }
        </ul>
      </div>
      <div class="insp-block">
        <h4><span class="ico">📎</span>支持证据</h4>
        <div class="evidence-tags">
          <span>Brief 笔记</span><span>开箱清单</span><span>${escapeHtml(item.bucket || "主墙")}</span>
        </div>
      </div>`;
    updateSelectionBar();
    syncWallSelectionClasses();
  }

  function closeInspector() {
    state.inspectorOpen = false;
    state.focusId = null;
    el.inspector.classList.add("hidden");
    el.right.classList.remove("inspector-open");
  }

  function clearSelection() {
    state.selectedIds.clear();
    state.focusId = null;
    closeInspector();
    updateSelectionBar();
    syncWallSelectionClasses();
  }

  function toggleSelect(item, { additive = false } = {}) {
    if (item.pending || item.qc_status === "pending_review") {
      toast("还没复核完，先慎用");
      state.focusId = item.id;
      openInspector(item);
      return;
    }
    if (isBriefWeak(item)) {
      toast("和 brief 不太贴，先不勾选");
      state.focusId = item.id;
      openInspector(item);
      return;
    }
    if (!additive) {
      // single-click: focus + ensure selected; shift/meta for multi later via additive
      if (state.selectedIds.has(item.id) && state.focusId === item.id && state.selectedIds.size === 1) {
        // second click on same sole selection → deselect
        clearSelection();
        return;
      }
      if (!state.selectedIds.has(item.id)) {
        state.selectedIds.clear();
        state.selectedIds.add(item.id);
      } else {
        // keep multi if already selected, just focus
      }
      openInspector(item);
      return;
    }
    if (state.selectedIds.has(item.id)) {
      state.selectedIds.delete(item.id);
      if (state.focusId === item.id) {
        const next = [...state.selectedIds][0];
        if (next) {
          const it = state.wallItems.find((x) => x.id === next);
          if (it) openInspector(it);
          else closeInspector();
        } else {
          closeInspector();
        }
      }
      updateSelectionBar();
      syncWallSelectionClasses();
    } else {
      state.selectedIds.add(item.id);
      openInspector(item);
    }
  }

  function renderVisual() {
    if (!state.bundle && !state.wallItems.length) {
      return `<div class="empty"><div class="slogan">墙还在长</div><p class="hint">正在把和 brief 更贴的参考搬上来…</p><button type="button" class="empty-cta" data-empty-action="open-strategy">先去看策略卡</button></div>`;
    }
    const filtered = getFilteredWallItems();
    updateWallCountBar();
    const byBucket = {};
    filtered.forEach((it) => {
      const k = it.bucket || "其他";
      (byBucket[k] = byBucket[k] || []).push(it);
    });
    const preferred =
      state.preferredBuckets.length
        ? state.preferredBuckets
        : (state.bundle?.l3?.ai_recommended_buckets || []).map((x) => x.name_zh);
    const order = [
      ...preferred.filter((n) => byBucket[n]),
      ...Object.keys(byBucket).filter((n) => !preferred.includes(n)),
    ];
    if (!order.length) {
      return `<div class="empty"><div class="slogan">这会儿墙上还空着</div><p class="hint">换个类别或来源再看看，或者打开「含待复核」。</p>
      <button type="button" class="empty-cta" data-empty-action="show-all">看看全部参考</button></div>`;
    }

    // Progressive render: flatten in bucket order, show first wallVisibleLimit
    const flat = [];
    order.forEach((name) => {
      (byBucket[name] || []).forEach((it) => flat.push(it));
    });
    const limit = state.wallVisibleLimit || WALL_BATCH_INITIAL;
    const visible = flat.slice(0, limit);
    const visByBucket = {};
    visible.forEach((it) => {
      const k = it.bucket || "其他";
      (visByBucket[k] = visByBucket[k] || []).push(it);
    });
    const visOrder = order.filter((n) => visByBucket[n] && visByBucket[n].length);

    const mainN = state.feedCounts.main || 0;
    const pendN = state.feedCounts.pending || 0;
    const tone = state.bundle?.l3?.l1_summary?.tone || "中式现代";
    const channel = state.bundle?.l3?.l1_summary?.channel || "礼赠+电商";
    const pendingShown = visible.filter(
      (it) => it.pending || it.qc_status === "pending_review"
    ).length;
    const briefSummary = state.onlyBriefRelevant
      ? `先看和 brief 更贴的 · 约 ${mainN || filtered.length} 张`
      : `先看看这些参考 · 主墙 ${mainN} · 待复核 ${pendN}${
          state.includePending ? ` · 这屏待复核 ${pendingShown}` : ""
        } · 先看着 ${visible.length} 张`;
    let html = `<div class="wall-summary">
      <span>${escapeHtml(tone)} · ${escapeHtml(channel)}</span>
      <span>${briefSummary}</span>
    </div>`;
    const rec = state.bundle?.l3?.ai_recommended_buckets || [];
    if (rec.length) {
      html += `<div class="rec-bar" aria-label="AI 推荐桶">
        <span class="rec-label">先盯这几桶</span>
        ${rec
          .map((b) => {
            const name = b.name_zh || b.id;
            const on = state.activeStyleFilter === name;
            return `<button type="button" class="rec-chip${on ? " active" : ""}" data-rec-bucket="${escapeAttr(
              name
            )}" title="${escapeAttr(b.why || "")}">${escapeHtml(name)}</button>`;
          })
          .join("")}
      </div>`;
    }

    visOrder.forEach((name) => {
      const totalInBucket = (byBucket[name] || []).length;
      const list = visByBucket[name] || [];
      html += `<div class="bucket-label">${escapeHtml(name)} · ${totalInBucket}</div>
        <div class="wall-grid">
        ${list.map((it) => wallCardHtml(it)).join("")}
        </div>`;
    });

    if (visible.length < flat.length) {
      const remain = flat.length - visible.length;
      html += `<div class="wall-load-more">
        <button type="button" id="wallLoadMore">加载更多 · 还有 ${remain}</button>
      </div>
      <div class="wall-sentinel" id="wallSentinel" aria-hidden="true"></div>`;
    }
    return html;
  }

  function attachWallLoader() {
    if (state._wallObserver) {
      try {
        state._wallObserver.disconnect();
      } catch (_) {}
      state._wallObserver = null;
    }
    const btn = document.getElementById("wallLoadMore");
    const bump = () => {
      state.wallVisibleLimit += WALL_BATCH_STEP;
      renderCanvas();
    };
    if (btn) btn.addEventListener("click", bump);
    const sentinel = document.getElementById("wallSentinel");
    if (sentinel && "IntersectionObserver" in window) {
      state._wallObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) bump();
        },
        { root: el.canvasBody, rootMargin: "240px", threshold: 0 }
      );
      state._wallObserver.observe(sentinel);
    }
  }

  function resolveCardImage(c) {
    for (const m of c.reference_montage || []) {
      if (m.image_url && /^https?:/i.test(m.image_url)) return m.image_url;
      const it = findWallItem(m.item_id);
      const u = it && imgFor(it);
      if (u && /^https?:/i.test(u)) return u;
    }
    return c.cover_image || c.local_ref_image || "";
  }

  function renderStrategy() {
    const cards = state.bundle?.l4_cards || [];
    if (!cards.length) {
      return `<div class="empty"><div class="slogan">还没有方向卡</div><p class="hint">这轮研究还没写出可批判的方向。青绿茶礼盒那轮有三张示意卡。</p>
      <button type="button" class="empty-cta" data-empty-action="ask-strategy">去聊聊方向</button></div>`;
    }
    return `<div class="strategy-list">${cards
      .map((c) => {
        const d = state.decisions[c.card_id] || c.hou_decision || "pending";
        const img = resolveCardImage(c);
        const tags = c.recommended_style_buckets_zh || [];
        const montage = (c.reference_montage || []).slice(0, 3);
        return `
        <article class="strategy-card ${d === "keep" ? "keep" : d === "kill" ? "kill" : ""}" data-card-id="${c.card_id}">
          <div class="sc-img-big" style="background-image:url('${escapeAttr(img)}')"></div>
          <div class="sc-body">
            <h4>${escapeHtml(c.title)}</h4>
            <p class="one-liner">${escapeHtml(c.one_liner || "")}</p>
            <p class="adv">${escapeHtml(c.advantage || "")}</p>
            ${
              c.differentiation
                ? `<p class="diff">${escapeHtml(c.differentiation)}</p>`
                : ""
            }
            <div class="sc-tags">
              ${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}
            </div>
            ${
              montage.length
                ? `<ul class="sc-montage">${montage
                    .map(
                      (m) =>
                        `<li>${escapeHtml(m.why || m.title || m.item_id || "参考")}</li>`
                    )
                    .join("")}</ul>`
                : ""
            }
            <p class="sc-disclaimer">${escapeHtml(
              c.demo_disclaimer || "方向示意 · 非完稿"
            )}</p>
          </div>
          <div class="sc-actions">
            <button type="button" class="keep-btn ${d === "keep" ? "active-keep" : ""}" data-decide="keep" data-card-id="${c.card_id}">留下</button>
            <button type="button" class="kill-btn ${d === "kill" ? "active-kill" : ""}" data-decide="kill" data-card-id="${c.card_id}">先放下</button>
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }

  function keptCards() {
    if (!state.bundle) return [];
    return (state.bundle.l4_cards || []).filter((c) => state.decisions[c.card_id] === "keep");
  }

  function renderShortlist() {
    const kept = keptCards();
    const visual = state.shortlistVisual;
    if (!kept.length && !visual.length) {
      return `<div class="empty"><div class="slogan">短名单还是空的</div>
        <p class="hint">在策略卡里点「留下」，或在视觉墙勾几张——我们帮你收着。</p>
        <button type="button" class="empty-cta" data-empty-action="open-strategy">去策略卡看看</button></div>`;
    }
    let html = "";
    if (kept.length) {
      html += kept
        .map(
          (c) => `
      <div class="shortlist-item">
        <span class="dot"></span>
        <div>
          <div class="t">${escapeHtml(c.title)}</div>
          <div class="s">${escapeHtml(c.one_liner || "")}</div>
        </div>
      </div>`
        )
        .join("");
    }
    if (visual.length) {
      html += `<div class="bucket-label">视觉短名单 · ${visual.length}</div>`;
      html += visual
        .map(
          (it) => `
        <div class="shortlist-item">
          <span class="dot"></span>
          <div>
            <div class="t">${escapeHtml(humanTitle(it.title || it.id))}</div>
            <div class="s">${escapeHtml(humanSource(it.source) || "精选参考")} · 从视觉墙收进来</div>
          </div>
        </div>`
        )
        .join("");
    }
    return html;
  }

  function renderCanvas({ preserveScroll = false } = {}) {
    const prev =
      preserveScroll && el.canvasBody ? el.canvasBody.scrollTop : 0;
    if (state.tab === "visual") {
      el.canvasBody.innerHTML = renderVisual();
      attachWallLoader();
    } else if (state.tab === "strategy") el.canvasBody.innerHTML = renderStrategy();
    else el.canvasBody.innerHTML = renderShortlist();
    if (preserveScroll && el.canvasBody) el.canvasBody.scrollTop = prev;
  }

  function appendEvent({ agent, time, tag, tagClass, dot, html }) {
    const node = document.createElement("article");
    node.className = "event";
    node.innerHTML = `
      <div class="event-dot ${dot || ""}"></div>
      <div class="event-card">
        <div class="event-meta">
          <span class="event-agent">${escapeHtml(agent)}</span>
          ${tag ? `<span class="event-tag ${tagClass || ""}">${escapeHtml(tag)}</span>` : ""}
          <span>${escapeHtml(time || "")}</span>
        </div>
        ${html}
      </div>`;
    el.stream.appendChild(node);
    el.stream.scrollTop = el.stream.scrollHeight;
    return node;
  }

  function seedStream() {
    el.stream.innerHTML = "";
    const input = state.bundle?.l1?.input || {};
    const counts = state.bundle?.l3?.counts || {};
    const cards = state.bundle?.l4_cards || [];

    const mainN = state.feedCounts.main || counts.main_wall || 0;
    const pendN = state.feedCounts.pending || counts.pending_review || 0;
    const shelfN = counts.shelf || 0;
    const analogyN = counts.analogy || 0;
    const product = input.product || "青绿茶礼盒";
    const tone = input.culture_tone || "中式现代";

    appendEvent({
      agent: "奎燕设计智能体",
      time: "11:58",
      tag: "读 Brief",
      tagClass: "stage",
      dot: "ok",
      html: `<p>先帮你把 Brief 读明白了——${escapeHtml(product)}，走${escapeHtml(tone)}，礼赠+电商都要站得住。</p>
        <div class="event-note">必须有：${escapeHtml((input.must_have || []).slice(0, 3).join("、") || "开箱记忆点")}
        <br>必须避开：${escapeHtml((input.must_avoid || []).slice(0, 2).join("、") || "金红喜庆堆砌")}</div>
        <div class="chips-row">
          <button type="button" class="artifact-link" data-artifact="brief">Brief 笔记</button>
          <button type="button" class="artifact-link" data-artifact="brief">研究问题清单</button>
        </div>`,
    });

    appendEvent({
      agent: "采集",
      time: "12:00",
      tag: "摸样本",
      tagClass: "",
      dot: "yellow",
      html: `<p>主墙已挂上 <strong>${mainN}</strong> 张可用参考 · 待复核 <strong>${pendN}</strong> · 货架 listing ${shelfN} · 类比 ${analogyN}。</p>
        <div class="chips-row">
          <button type="button" class="artifact-link" data-artifact="map">采集清单</button>
          <button type="button" class="artifact-link" data-artifact="map">市场地图草稿</button>
        </div>`,
    });

    appendEvent({
      agent: "点点",
      time: "12:01",
      tag: "补证据",
      tagClass: "consensus",
      dot: "ok",
      html: `<p>花瓣有图但 CDN 容易裂，已往后排；小红书/Pinterest 已在主墙。淘宝/京东仍是 listing 样，货架深采还没开通。</p>
        <div class="chips-row">
          <button type="button" class="artifact-link" data-artifact="map">待补源备注</button>
        </div>`,
    });

    appendEvent({
      agent: "点点",
      time: "12:02",
      tag: "达成共识",
      tagClass: "consensus",
      dot: "ok",
      html: `<p>先盯这几桶：<strong>中式典雅/礼赠 · 中式现代 · 地域文旅 · 国际简约</strong>。右侧点一张，我们一起看它和 Brief 合不合。</p>
        <div class="chips-row">
          <button type="button" class="artifact-link" data-artifact="map">打开视觉墙</button>
          <button type="button" class="artifact-link" data-artifact="map">风格桶说明</button>
        </div>`,
    });

    const cardLines = cards
      .slice(0, 3)
      .map(
        (c) =>
          `<li><strong>${escapeHtml(c.title)}</strong> — ${escapeHtml(c.one_liner || "")}</li>`
      )
      .join("");

    appendEvent({
      agent: "奎燕设计智能体",
      time: "12:03",
      tag: "提出质疑",
      tagClass: "challenge",
      dot: "warn",
      html: `<p>礼赠茶很容易掉进金红仿古——我写了三张方向卡，请你「留下 / 先放下」，咱们再往下收。</p>
        <ul>${cardLines}</ul>
        <div class="inline-actions">
          ${cards
            .slice(0, 2)
            .map(
              (c) =>
                `<button type="button" class="keep" data-card-action="keep" data-card-id="${c.card_id}">留下 ${escapeHtml(c.title.slice(0, 6))}</button>`
            )
            .join("")}
        </div>
        <div class="chips-row">
          <button type="button" class="artifact-link" data-artifact="strategy">三张策略卡</button>
          <button type="button" class="artifact-link" data-artifact="strategy">批判笔记</button>
        </div>`,
    });

    appendEvent({
      agent: "奎燕设计智能体",
      time: "12:04",
      tag: "协作提示",
      tagClass: "",
      dot: "yellow",
      html: `<p>接下来你可以：勾几张视觉进短名单，或直接对策略卡拍板。我在旁边记着。</p>`,
    });
  }

  function pushStageEvent(n) {
    const map = {
      1: () =>
        appendEvent({
          agent: "奎燕设计智能体",
          time: "现在",
          tag: "回到 Brief",
          tagClass: "stage",
          dot: "yellow",
          html: `<p>咱们再对一遍 Brief。上面研究问题可以改，must-have / must-avoid 也欢迎补充。</p>
            <div class="chips-row"><button type="button" class="artifact-link" data-artifact="brief">Brief 笔记</button></div>`,
        }),
      2: () => {
        setCap("crawler", "working", "正在帮你拆采集任务…");
        appendEvent({
          agent: "采集",
          time: "现在",
          tag: "拆采集",
          tagClass: "",
          dot: "yellow",
          html: `<p>按计划分灵感 / 货架 / 类比三路去摸。摸完会把有图的先挂上墙。</p>
            <div class="chips-row"><button type="button" class="artifact-link" data-artifact="map">采集清单</button></div>`,
        });
        setTimeout(
          () => setCap("crawler", "idle", `帮你同步好了 ${state.bundle?.l3?.counts?.total || 23} 条`),
          900
        );
      },
      3: () => {
        setCap("dotdot", "working", "正在帮你整理视觉主墙");
        appendEvent({
          agent: "点点",
          time: "现在",
          tag: "深度探索",
          tagClass: "consensus",
          dot: "ok",
          html: `<p>视觉墙按风格桶铺开了。点一张，右侧会告诉你它和 Brief 亲不亲。</p>
            <div class="chips-row"><button type="button" class="artifact-link" data-artifact="map">打开视觉墙</button></div>`,
        });
        setTimeout(() => setCap("dotdot", "idle", "桶标签已就绪，等你点选"), 700);
      },
      4: () => {
        setCap("dotdot", "working", "正在帮你准备策略批判");
        appendEvent({
          agent: "奎燕设计智能体",
          time: "现在",
          tag: "策略批判",
          tagClass: "challenge",
          dot: "warn",
          html: `<p>三张方向卡在右边。「留下」进短名单，「先放下」我会记下原因，方便回头复盘。</p>
            <div class="chips-row"><button type="button" class="artifact-link" data-artifact="strategy">打开策略卡</button></div>`,
        });
        setTimeout(() => setCap("dotdot", "idle", "等你留下 / 先放下"), 600);
      },
      5: () => {
        const kept = keptCards();
        appendEvent({
          agent: "奎燕设计智能体",
          time: "现在",
          tag: "收短名单",
          tagClass: "consensus",
          dot: "ok",
          html: kept.length
            ? `<p>短名单里已有：${kept.map((c) => escapeHtml(c.title)).join("、")}。需要的话我可以帮你整理成交付草稿。</p>
               <div class="chips-row"><button type="button" class="artifact-link" data-artifact="shortlist">短名单草稿</button></div>`
            : `<p>短名单还空着。先去策略卡留下一两张，或者从视觉墙勾几张进来。</p>
               <div class="chips-row"><button type="button" class="artifact-link" data-artifact="strategy">回到策略卡</button></div>`,
        });
      },
    };
    (map[n] || (() => {}))();
  }

  function setDecision(cardId, decision) {
    state.decisions[cardId] = decision;
    renderCanvas();
    document.querySelectorAll(`[data-card-action][data-card-id="${cardId}"]`).forEach((btn) => {
      const act = btn.dataset.cardAction;
      btn.classList.toggle("active", act === decision);
    });
    const card = state.bundle?.l4_cards?.find((c) => c.card_id === cardId);
    const title = card?.title || cardId;
    toast(decision === "keep" ? `留下了「${title}」· 已放进短名单` : `先放下「${title}」· 以后还能翻回来`);
    if (decision === "keep") {
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "达成共识",
        tagClass: "consensus",
        dot: "ok",
        html: `<p>留下了「${escapeHtml(title)}」。短名单页随时可以再调。</p>
          <div class="chips-row"><button type="button" class="artifact-link" data-artifact="shortlist">看看短名单</button></div>`,
      });
    } else {
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "提出质疑",
        tagClass: "challenge",
        dot: "kill",
        html: `<p>先放下「${escapeHtml(title)}」——差异化风险偏高，或和 Brief 拧着。</p>`,
      });
    }
  }

  function handleArtifact(kind) {
    if (kind === "brief") setStage(1, { appendEvent: false });
    else if (kind === "map") {
      setStage(3, { appendEvent: false });
      switchTab("visual", { fromStage: true });
    } else if (kind === "strategy") {
      setStage(4, { appendEvent: false });
      switchTab("strategy", { fromStage: true });
    } else if (kind === "shortlist") {
      setStage(5, { appendEvent: false });
      switchTab("shortlist", { fromStage: true });
    }
  }

  function handleSend(text) {
    const t = text.trim();
    if (!t) return;
    appendEvent({
      agent: "你",
      time: "现在",
      tag: "留言",
      tagClass: "",
      dot: "yellow",
      html: `<div class="event-note">${escapeHtml(t)}</div>`,
    });

    const lower = t.toLowerCase();
    const mainN = state.feedCounts.main || 0;
    const pendN = state.feedCounts.pending || 0;
    const cards = state.bundle?.l4_cards || [];
    const rec = (state.bundle?.l3?.ai_recommended_buckets || [])
      .map((b) => b.name_zh || b.id)
      .filter(Boolean)
      .slice(0, 5)
      .join(" / ");
    const cardNames = cards.map((c) => c.title).filter(Boolean).join(" / ");

    if (/市场地图|视觉|探索|看墙|地图/.test(t)) {
      setCap("orchestrator", "working", "正在帮你汇总视觉墙");
      setCap("dotdot", "working", "按风格桶重新摆墙");
      setTimeout(() => {
        setCap("orchestrator", "online", "视觉墙刷新好了，等你点选");
        setCap("dotdot", "idle", "桶标签已就绪");
        setStage(3);
        appendEvent({
          agent: "奎燕设计智能体",
          time: "现在",
          tag: "市场地图",
          tagClass: "consensus",
          dot: "ok",
          html: `<p>主墙 <strong>${mainN}</strong> · 待复核 ${pendN}。右侧可切「主品类 / 类比 / 货架」。${
            rec ? `先盯：${escapeHtml(rec)}。` : ""
          }</p>
          <div class="chips-row"><button type="button" class="artifact-link" data-artifact="map">打开视觉墙</button></div>`,
        });
      }, 400);
      return;
    }
    if (/策略|三张|生成.*卡|批判/.test(t)) {
      setCap("dotdot", "working", "正在帮你写 / 刷新策略卡");
      setTimeout(() => {
        setCap("dotdot", "idle", cards.length ? "等你留下 / 先放下" : "这轮还没有方向卡");
        setStage(4);
        appendEvent({
          agent: "奎燕设计智能体",
          time: "现在",
          tag: "策略卡",
          tagClass: cards.length ? "challenge" : "",
          dot: cards.length ? "warn" : "ok",
          html: cards.length
            ? `<p>三张方向卡（示意·非完稿）：<strong>${escapeHtml(cardNames)}</strong>。留下或先放下即可进短名单。</p>`
            : `<p>这轮研究还没写出方向卡。切回青绿茶礼盒可以看到三张示意卡。</p>`,
        });
      }, 450);
      return;
    }
    if (/crawler|采集|同步/.test(lower) || /同步|采集/.test(t)) {
      setCap("crawler", "working", "正在帮你核对包装参考…");
      setTimeout(() => {
        setCap(
          "crawler",
          "idle",
          `主墙 ${mainN} · 待复核 ${pendN}`
        );
        setStage(2);
        switchTab("visual", { fromStage: true });
        appendEvent({
          agent: "采集",
          time: "现在",
          tag: "同步",
          tagClass: "consensus",
          dot: "ok",
          html: `<p>已核对本地真数据：主墙 ${mainN} · 待复核 ${pendN}。货架深采仍待开通，不假装连上了。</p>`,
        });
      }, 600);
      return;
    }
    if (/短名单|交付|输出/.test(t)) {
      setStage(5);
      return;
    }
    appendEvent({
      agent: "奎燕设计智能体",
      time: "现在",
      tag: "回复",
      tagClass: "consensus",
      dot: "ok",
      html: `<p>收到。可以说「看市场地图」「生成三张策略卡」「同步采集」或「输出短名单」——我按墙上的 ${mainN} 张参考跟你走。</p>`,
    });
  }

  async function applyResearch(id) {
    const r = RESEARCHES.find((x) => x.id === id);
    if (!r) return;
    RESEARCHES.forEach((x) => (x.active = x.id === id));
    state.activeResearchId = id;
    state.selectedIds.clear();
    state.shortlistVisual = [];
    state.decisions = {};
    state.activeCat = "all";
    state.activeSource = null;
    state.activeStyleFilter = "";
    closeInspector();
    renderResearch();
    if (el.researchTitle) el.researchTitle.textContent = r.title;
    if (el.researchQuestion) {
      el.researchQuestion.value = r.question.slice(0, 200);
      updateQCount();
    }
    if (el.categoryChips) {
      el.categoryChips.querySelectorAll(".cat-chip:not(.pending-toggle):not(.brief-toggle)").forEach((c) => {
        c.classList.toggle("active", c.dataset.cat === "all");
      });
    }
    userArmedPending = false;
    if (r.onlyBriefDefault) {
      state.onlyBriefRelevant = true;
      if (el.briefToggle) {
        el.briefToggle.classList.add("active");
        el.briefToggle.setAttribute("aria-pressed", "true");
        el.briefToggle.dataset.brief = "1";
      }
    } else {
      state.onlyBriefRelevant = false;
      if (el.briefToggle) {
        el.briefToggle.classList.remove("active");
        el.briefToggle.setAttribute("aria-pressed", "false");
        el.briefToggle.dataset.brief = "0";
      }
    }
    toast(`正在打开「${r.title}」…`);
    try {
      if (r.id === "r-green") {
        if (state._greenBundle) state.bundle = state._greenBundle;
        else state.bundle = await loadProductBundle();
        (state.bundle.l4_cards || []).forEach((c) => {
          state.decisions[c.card_id] = c.hou_decision || "pending";
        });
      } else {
        if (!state._greenBundle && state.bundle?.l4_cards?.length) {
          state._greenBundle = state.bundle;
        }
        state.bundle = {
          bucket_id_to_zh: (state.bundle && state.bundle.bucket_id_to_zh) || {},
          l1: {
            brief_id: r.id,
            raw_brief: r.question,
            input: { product: r.title, culture_tone: "中式现代", channel: "礼赠 + 电商" },
          },
          l3: { counts: {}, ai_recommended_buckets: [], l1_summary: { tone: "中式现代", channel: "礼赠+电商" } },
          l4_cards: [],
        };
      }
      await loadLiveFeeds(r);
      setCap("orchestrator", "online", `正在看「${r.title}」`);
      seedStream();
      state.stage = 3;
      syncStageButtons(3);
      switchTab("visual", { fromStage: true });
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "切换研究",
        tagClass: "stage",
        dot: "ok",
        html: r.onlyBriefDefault
          ? `<p>已切回青绿茶礼盒。主墙 <strong>${state.feedCounts.main}</strong> · 待复核 <strong>${state.feedCounts.pending}</strong>。</p>`
          : `<p>已打开「${escapeHtml(r.title)}」落地主墙 <strong>${state.feedCounts.main}</strong> 张。这轮还没有策略卡；贴 brief 筛选已关掉，避免用茶礼规则误杀。</p>`,
      });
    } catch (err) {
      console.warn(err);
      toast("这轮研究的墙还没挂上");
    }
  }

  function updateQCount() {
    if (!el.researchQuestion || !el.qCount) return;
    const n = el.researchQuestion.value.length;
    el.qCount.textContent = `${n}/200`;
  }

  function bindEvents() {
    el.stages.addEventListener("click", (e) => {
      const btn = e.target.closest(".stage");
      if (!btn) return;
      setStage(Number(btn.dataset.stage));
    });

    document.querySelector(".tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (!tab) return;
      switchTab(tab.dataset.tab);
    });

    el.sourceChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".source-card");
      if (!chip) return;
      const id = chip.dataset.source;
      state.activeSource = state.activeSource === id ? null : id;
      renderSources();
      const src =
        state.sources.find((s) => s.id === id) ||
        (SOURCE_META[id] ? { id, label: SOURCE_META[id].label, status: "ok", statusText: "" } : null);
      state.wallVisibleLimit = WALL_BATCH_INITIAL;
      appendEvent({
        agent: "采集",
        time: "现在",
        tag: "看源",
        tagClass: "",
        dot: src?.status === "working" ? "warn" : "ok",
        html: `<p>${escapeHtml(src?.label || id)}：${escapeHtml(src?.statusText || "按来源过滤主墙")}。</p>`,
      });
      if (state.tab !== "visual") switchTab("visual", { fromStage: true });
      else renderCanvas();
    });

    el.categoryChips.addEventListener("click", (e) => {
      const chip = e.target.closest(".cat-chip");
      if (!chip) return;
      if (chip.id === "pendingToggle" || chip.classList.contains("pending-toggle")) {
        if (!bootSettled) { forceProductWallDefaults("ignore-early-click"); renderCanvas(); return; }
        userArmedPending = true;
        state.includePending = !state.includePending;
        chip.setAttribute("aria-pressed", state.includePending ? "true" : "false");
        chip.dataset.pending = state.includePending ? "1" : "0";
        chip.classList.toggle("active", state.includePending);
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        toast(state.includePending ? "已显示待复核（虚线+半透明）" : "已隐藏待复核");
        updateWallCountBar();
        renderCanvas();
        return;
      }
      if (chip.id === "briefToggle" || chip.classList.contains("brief-toggle")) {
        state.onlyBriefRelevant = !state.onlyBriefRelevant;
        chip.setAttribute("aria-pressed", state.onlyBriefRelevant ? "true" : "false");
        chip.dataset.brief = state.onlyBriefRelevant ? "1" : "0";
        chip.classList.toggle("active", state.onlyBriefRelevant);
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        toast(state.onlyBriefRelevant ? "只看贴 brief 的参考" : "已显示全部参考");
        updateWallCountBar();
        renderCanvas();
        return;
      }
      state.activeCat = chip.dataset.cat;
      el.categoryChips
        .querySelectorAll(".cat-chip:not(.pending-toggle):not(.brief-toggle)")
        .forEach((c) => {
          c.classList.toggle("active", c.dataset.cat === state.activeCat);
        });
      state.wallVisibleLimit = WALL_BATCH_INITIAL;
      renderCanvas();
    });

    if (el.filters) {
      el.filters.addEventListener("change", (e) => {
        const sel = e.target.closest("select");
        if (!sel) return;
        if (sel.dataset.filter === "style") {
          state.activeStyleFilter = sel.value || "";
          state.wallVisibleLimit = WALL_BATCH_INITIAL;
          renderCanvas();
        } else if (sel.dataset.filter === "source" || sel.classList.contains("filter-source")) {
          state.activeSource = sel.value || null;
          state.wallVisibleLimit = WALL_BATCH_INITIAL;
          renderSources();
          renderCanvas();
        }
      });
    }

    el.canvasBody.addEventListener("click", (e) => {
      const rec = e.target.closest("[data-rec-bucket]");
      if (rec) {
        const name = rec.dataset.recBucket;
        state.activeStyleFilter = state.activeStyleFilter === name ? "" : name;
        const styleSel = el.filters && el.filters.querySelector('[data-filter="style"]');
        if (styleSel) styleSel.value = state.activeStyleFilter;
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        renderCanvas();
        return;
      }
      const decide = e.target.closest("[data-decide]");
      if (decide) {
        setDecision(decide.dataset.cardId, decide.dataset.decide);
        return;
      }
      const card = e.target.closest(".wall-card");
      if (card) {
        const item = findWallItem(card.dataset.id);
        if (!item) return;
        const additive = e.metaKey || e.ctrlKey || e.shiftKey;
        if (item.qc_status === "pending_review" || item.pending) {
          toggleSelect(item);
          return;
        }
        if (additive) {
          if (state.selectedIds.has(item.id)) {
            state.selectedIds.delete(item.id);
            if (state.focusId === item.id) {
              const next = [...state.selectedIds][0];
              const it = next && findWallItem(next);
              if (it) openInspector(it);
              else {
                closeInspector();
                updateSelectionBar();
                syncWallSelectionClasses();
              }
            } else {
              updateSelectionBar();
              syncWallSelectionClasses();
            }
          } else {
            state.selectedIds.add(item.id);
            openInspector(item);
          }
        } else {
          toggleSelect(item);
        }
      }
    });

    el.selectionBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sel-action]");
      if (!btn) return;
      const act = btn.dataset.selAction;
      const ids = [...state.selectedIds];
      const n = ids.length;
      if (act === "compare") {
        toast(n < 2 ? "再勾一张，才能对比一下" : `先并排看这 ${n} 张`);
        return;
      }
      if (act === "shortlist") {
        const seen = new Set(state.shortlistVisual.map((x) => x.id));
        let added = 0;
        ids.forEach((id) => {
          const it = findWallItem(id);
          if (!it || it.pending || it.qc_status === "pending_review") return;
          if (seen.has(it.id)) return;
          state.shortlistVisual.push(it);
          seen.add(it.id);
          added += 1;
        });
        if (!added) toast(n ? "这些已在短名单里了（或还不能收）" : "先勾几张再收");
        else {
          toast(`已收进短名单 ${added} 张 · 共 ${state.shortlistVisual.length}`);
          appendEvent({
            agent: "奎燕设计智能体",
            time: "现在",
            tag: "达成共识",
            tagClass: "consensus",
            dot: "ok",
            html: `<p>视觉墙勾的 ${added} 张已收进短名单。随时去「短名单」页看看。</p>
              <div class="chips-row"><button type="button" class="artifact-link" data-artifact="shortlist">看看短名单</button></div>`,
          });
        }
        return;
      }
      if (act === "open") {
        const it = findWallItem(state.focusId || ids[0]);
        if (it?.page_url) window.open(it.page_url, "_blank", "noopener");
        else toast("这张还没有可打开的原页");
      }
    });

    el.stream.addEventListener("click", (e) => {
      const art = e.target.closest("[data-artifact]");
      if (art) {
        handleArtifact(art.dataset.artifact);
        return;
      }
      const btn = e.target.closest("[data-card-action]");
      if (btn) {
        setDecision(btn.dataset.cardId, btn.dataset.cardAction);
        switchTab(btn.dataset.cardAction === "keep" ? "shortlist" : "strategy", {
          fromStage: true,
        });
      }
    });

    el.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = el.composerInput.value;
      el.composerInput.value = "";
      handleSend(v);
    });

    el.composerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.composer.requestSubmit();
      }
    });

    el.inspectorToggle.addEventListener("click", () => {
      closeInspector();
      // keep selection bar if still selected; only hide panel
      updateSelectionBar();
      syncWallSelectionClasses();
    });

    el.capList.addEventListener("click", (e) => {
      const card = e.target.closest(".cap-card");
      if (!card) return;
      const c = state.caps.find((x) => x.id === card.dataset.id);
      if (c) toast(`${c.name} · ${c.lastAction}`);
    });

    el.researchList.addEventListener("click", (e) => {
      const card = e.target.closest(".research-card");
      if (!card) return;
      const id = card.dataset.id;
      if (!id || id === state.activeResearchId) return;
      applyResearch(id);
    });

    el.btnNew.addEventListener("click", () => {
      toast("新建研究 — 把 Brief 贴进研究问题就行");
      el.researchQuestion.focus();
      el.researchQuestion.select();
    });

    document.querySelector(".attach-row").addEventListener("click", (e) => {
      const b = e.target.closest("[data-attach]");
      if (!b) return;
      toast(`附件「${b.dataset.attach}」先占个位，正式版再接上传`);
    });

    el.researchQuestion.addEventListener("input", updateQCount);

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-empty-action]");
      if (!btn) return;
      const act = btn.dataset.emptyAction;
      if (act === "show-all") {
        state.onlyBriefRelevant = false;
        if (el.briefToggle) {
          el.briefToggle.classList.remove("active");
          el.briefToggle.setAttribute("aria-pressed", "false");
          el.briefToggle.dataset.brief = "0";
        }
        toast("已显示全部参考");
        renderCanvas();
        updateWallCountBar();
      } else if (act === "ask-strategy" || act === "open-strategy") {
        setStage(4);
        switchTab("strategy", { fromStage: true });
      }
    });
  }

  async function boot() {
    // Product defaults (design P0): pending OFF, only-brief ON
    userArmedPending = false;
    bootSettled = false;
    forceProductWallDefaults("boot-start");
    // Guard against trap pages / stale scripts that click pending during load
    const guard = setInterval(() => {
      if (userArmedPending) return;
      if (state.includePending || (el.pendingToggle && el.pendingToggle.classList.contains("active"))) {
        forceProductWallDefaults("boot-guard");
        renderCanvas();
      }
    }, 200);
    setTimeout(() => { bootSettled = true; clearInterval(guard); if (!userArmedPending) forceProductWallDefaults("boot-settle"); }, 4000);

    renderCaps();
    renderResearch();
    renderSources();
    bindEvents();
    closeInspector();
    updateSelectionBar();
    updateQCount();
    updateFilterRow();
    if (el.canvasBody) {
      el.canvasBody.innerHTML = `<div class="empty"><div class="slogan">墙还在长</div><p class="hint">正在把和 brief 更贴的参考搬上来…</p><button type="button" class="empty-cta" data-empty-action="open-strategy">先去看策略卡</button></div>`;
    }
    try {
      // 1) Live feeds first for the visual wall
      let feedsOk = false;
      try {
        await loadLiveFeeds(RESEARCHES[0]);
        feedsOk = true;
      } catch (feedErr) {
        console.warn("live feeds", feedErr);
      }

      // 2) Product pack for L1 brief + L4 strategy cards.
      // Skip empty-l4 stubs and fall through to product-pack.
      state.bundle = await loadProductBundle();
      state._greenBundle = state.bundle;
      (state.bundle.l4_cards || []).forEach((c) => {
        state.decisions[c.card_id] = c.hou_decision || "pending";
      });
      const q0 = RESEARCHES[0].question;
      if (el.researchQuestion) {
        el.researchQuestion.value = q0.slice(0, 200);
        updateQCount();
      }

      if (!feedsOk) {
        state.wallItems = collectWallItemsFromBundleFallback();
        state.feedCounts = { main: state.wallItems.length, pending: 0 };
        rebuildSourcesFromWall();
        updateWallCountBar();
        toast("主墙暂时读不到，先用本地缓存顶上");
      } else {
        rebuildSourcesFromWall();
      }
      if (state.bundle?.l3 && state.feedCounts.main) {
        state.bundle.l3.counts = {
          ...(state.bundle.l3.counts || {}),
          total: state.feedCounts.main + state.feedCounts.pending,
          with_image: state.feedCounts.main,
          main_wall: state.feedCounts.main,
          pending_review: state.feedCounts.pending,
        };
      }
      state.stage = 3;
      syncStageButtons(3);
      switchTab("visual", { fromStage: true });
      if (!userArmedPending) forceProductWallDefaults("after-visual");
      seedStream();
      appendEvent({
        agent: "采集",
        time: "现在",
        tag: "主墙已挂上",
        tagClass: "consensus",
        dot: "ok",
        html: `<p>参考墙已挂上：主墙 <strong>${state.feedCounts.main}</strong> 张可用 · 待复核 <strong>${state.feedCounts.pending}</strong>。先刷一屏，不够再往下翻。</p>`,
      });
    } catch (err) {
      console.error(err);
      el.canvasBody.innerHTML = `<div class="empty"><div class="slogan">这会儿还没挂上参考</div><p class="hint">加载出了点问题，稍后再试。</p>
        <button type="button" class="empty-cta" id="emptyRetry">重新加载</button></div>`;
      const retry = document.getElementById("emptyRetry");
      if (retry) retry.addEventListener("click", () => location.reload());
      appendEvent({
        agent: "系统",
        time: "现在",
        tag: "提醒",
        tagClass: "challenge",
        dot: "kill",
        html: `<p>参考暂时读不到。点「重新加载」或稍后再来。</p>`,
      });
    }
  }

  boot();
})();
