/* KEY 视界 · Light Research Lab shell
 * P0: Inspector 320 / 选中底栏 / 黄 pill / 品牌三行 / 人情味文案
 */
(() => {
  const STAGES = [
    { id: 1, key: "brief", label: "先听清你要什么", tab: "visual", canvas: "brief" },
    { id: 2, key: "crawl", label: "去市场上找参考", tab: "visual", canvas: "crawl" },
    { id: 3, key: "explore", label: "一起看版图", tab: "visual", canvas: "visual" },
    { id: 4, key: "critique", label: "商量方向", tab: "strategy", canvas: "strategy" },
    { id: 5, key: "output", label: "收成短名单", tab: "shortlist", canvas: "shortlist" },
  ];
  const RT = window.KuiyanRuntime || {};

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

  // Live channel chips (reality, not aspirational)
  const SOURCES = [
    { id: "behance", label: "Behance", status: "ok", statusText: "已采集" },
    { id: "packagingoftheworld", label: "Packaging of the World", status: "ok", statusText: "已采集" },
    { id: "zcool", label: "站酷", status: "thin", statusText: "薄页/待深采" },
    { id: "taobao", label: "淘宝", status: "pending", statusText: "货架通道待开通" },
    { id: "jd", label: "京东", status: "pending", statusText: "货架通道待开通" },
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

  let SAVED = [
    {
      id: "r-green",
      title: "青绿茶礼盒竞品调研",
      date: "2026-08-12",
      status: "running",
      active: true,
    },
    {
      id: "r-huangjiu",
      title: "黄酒礼盒气质对标",
      date: "2026-08-05",
      status: "done",
    },
    {
      id: "r-tonic",
      title: "滋补礼盒开箱记忆点",
      date: "2026-07-28",
      status: "done",
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
    activeYearFilter: "",
    activeMarketFilter: "",
    activeDirectionFilter: "",
    activeToneFilter: "",
    wallMode: "primary",
    pinnedBuckets: [],
    mutedBuckets: [],
    briefSpec: null,
    researches: [],
    activeResearchId: "r-green",
    defaultWall: [],
    defaultPending: [],
    defaultFeedCounts: { main: 0, pending: 0 },
    _wallObserver: null,
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
    wallMode: $("wallMode"),
    recBuckets: $("recBuckets"),
    compareBackdrop: $("compareBackdrop"),
    compareModal: $("compareModal"),
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
    el.researchList.innerHTML = SAVED.map(
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
    state.onlyBriefRelevant = true;
    const pt = el.pendingToggle || document.getElementById("pendingToggle");
    const bt = el.briefToggle || document.getElementById("briefToggle");
    if (pt) {
      pt.classList.remove("active");
      pt.setAttribute("aria-pressed", "false");
      pt.dataset.pending = "0";
    }
    if (bt) {
      bt.classList.add("active");
      bt.setAttribute("aria-pressed", "true");
      bt.dataset.brief = "1";
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
    const prior = state.bundle?.l1?.intent?.style_prior || [];
    const enriched = RT.enrichItem
      ? RT.enrichItem(raw, status, { stylePrior: prior, briefSpec: state.briefSpec })
      : { ...raw };
    const item = {
      ...raw,
      ...enriched,
      wall_status: status,
      qc_status: pending ? "pending_review" : raw.qc_status || "pass_main",
      pending,
      image_url: raw.image_url || raw.thumbnail_url || "",
      thumbnail_url: raw.thumbnail_url || raw.image_url || "",
      title: humanTitle(raw.title || raw.name || ""),
      _raw_title: raw.title || raw.name || "",
      _raw_id: raw.id || "",
      source: raw.source || "",
      page_url: raw.page_url || "",
      query_used: raw.query_used || "",
      suggested_style_buckets:
        enriched.suggested_style_buckets || raw.suggested_style_buckets || [],
      wall_kind: enriched.wall_kind || "primary",
    };
    item.bucket = bucketName(item);
    return item;
  }

  function rebuildSourcesFromWall() {
    const counts = {};
    for (const it of state.wallItems) {
      const s = String(it.source || "").toLowerCase();
      if (!s) continue;
      counts[s] = (counts[s] || 0) + 1;
    }
    // Always surface P0 channels with truthful status chips
    const pinned = [
      {
        id: "behance",
        status: counts.behance ? "ok" : "ok",
        statusText: counts.behance ? `已采集 · ${counts.behance}` : "已采集",
      },
      {
        id: "packagingoftheworld",
        status: "ok",
        statusText: counts.packagingoftheworld
          ? `已采集 · ${counts.packagingoftheworld}`
          : "已采集",
      },
      { id: "zcool", status: "thin", statusText: "薄页/待深采" },
      { id: "taobao", status: "pending", statusText: "货架通道待开通" },
      { id: "jd", status: "pending", statusText: "货架通道待开通" },
    ];
    const pinnedIds = new Set(pinned.map((p) => p.id));
    const extras = Object.entries(counts)
      .filter(([id]) => !pinnedIds.has(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        label: (SOURCE_META[id] && SOURCE_META[id].label) || id,
        status: "ok",
        statusText: `已上墙 ${count}`,
        count,
      }));
    state.sources = [
      ...pinned.map((p) => ({
        ...p,
        label: (SOURCE_META[p.id] && SOURCE_META[p.id].label) || p.id,
        count: counts[p.id] || 0,
      })),
      ...extras,
    ];
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
      el.wallCountBar.style.display = state.tab === "visual" && state.stage >= 3 ? "" : "none";
    }
    if (el.wallMode) {
      el.wallMode.style.display = state.tab === "visual" && state.stage >= 3 ? "" : "none";
    }
    if (el.recBuckets) {
      el.recBuckets.style.display = state.tab === "visual" && state.stage >= 3 ? "" : "none";
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
    if (syncTab && meta) {
      if (meta.tab === "visual" && n < 3) {
        state.tab = "visual";
        document.querySelectorAll(".tab").forEach((t) => {
          const on = t.dataset.tab === "visual";
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        updateFilterRow();
        renderCanvas();
      } else {
        switchTab(meta.tab, { fromStage: true });
      }
    }
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

  async function loadLiveFeeds() {
    // Live wall feeds (~452 / ~2680). Prefer underscore names; hyphen aliases ok.
    async function fetchFeed(paths) {
      let res = null;
      for (const p of paths) {
        res = await fetch(p);
        if (res.ok) return res;
      }
      return res;
    }
    const [mainPartA, mainPartB, pendingRes, bucketsRes] = await Promise.all([
      fetch("data/l2_main_wall_a.jsonl"),
      fetch("data/l2_main_wall_b.jsonl"),
      fetchFeed([
        "data/l2_pending_review.jsonl",
        "data/l2-pending-review.jsonl",
        "data/l2_pending_review_20260812.jsonl",
      ]),
      fetch("data/style-buckets-v1.json"),
    ]);
    let mainRes = null;
    let mainText = "";
    if (mainPartA.ok || mainPartB.ok) {
      if (mainPartA.ok) mainText += await mainPartA.text();
      if (mainPartB.ok) mainText += (mainText && !mainText.endsWith("\n") ? "\n" : "") + await mainPartB.text();
      mainRes = { ok: true, status: 200, text: async () => mainText };
    } else {
      mainRes = await fetchFeed([
        "data/l2_main_wall.jsonl",
        "data/l2-main-wall.jsonl",
        "data/l2_main_wall_20260812.jsonl",
      ]);
    }
    if (!mainRes.ok) throw new Error("main wall " + mainRes.status);
    if (bucketsRes.ok) {
      const bj = await bucketsRes.json();
      const map = {};
      (bj.buckets || []).forEach((b) => {
        if (b.id) map[b.id] = b.name_zh || b.id;
      });
      state.bucketIdToZh = map;
      if (state.bundle) {
        state.bundle.bucket_id_to_zh = { ...(state.bundle.bucket_id_to_zh || {}), ...map };
      }
    } else if (state.bundle?.bucket_id_to_zh) {
      state.bucketIdToZh = { ...state.bundle.bucket_id_to_zh };
    }
    const mainRaw = parseJsonl(await mainRes.text());
    const pendingRaw = pendingRes.ok ? parseJsonl(await pendingRes.text()) : [];
    state.wallItems = mainRaw
      .map((r) => normalizeFeedItem(r, "main_wall"))
      .filter((it) => imgFor(it) || it.page_url);
    state.wallItems = demoteFragileWallOrder(state.wallItems);
    // Keep pending even if image missing (badge still useful); counts = file lines
    state.pendingItems = pendingRaw.map((r) => normalizeFeedItem(r, "pending_review"));
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


  /** Mirror L3/brief_relevance_v1.py, or the active research brief_spec. */
  function scoreBriefRelevance(item) {
    if (!item) return "off";
    if (RT.scoreAgainstSpec && state.briefSpec) {
      return RT.scoreAgainstSpec(item, state.briefSpec);
    }
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
    if (state.activeCat === "pack") {
      items = items.filter(
        (it) =>
          /货架|实物|pack|shelf/i.test(it.bucket || "") || it.source_type === "shelf"
      );
    } else if (state.activeCat === "case") {
      items = items.filter((it) => !/货架|实物|shelf/i.test(it.bucket || ""));
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
    if (state.wallMode && state.wallMode !== "all") {
      items = items.filter((it) => (it.wall_kind || "primary") === state.wallMode);
    }
    if (state.pinnedBuckets.length || state.mutedBuckets.length) {
      const pinnedZh = new Set(
        state.pinnedBuckets.map(
          (id) => state.bucketIdToZh[id] || state.bundle?.bucket_id_to_zh?.[id] || id
        )
      );
      const pinned = [];
      const rest = [];
      items.forEach((it) => {
        const ids = it.suggested_style_buckets || [];
        if (ids.some((id) => state.mutedBuckets.includes(id))) return;
        const hit =
          ids.some((id) => state.pinnedBuckets.includes(id)) || pinnedZh.has(it.bucket);
        if (hit) pinned.push(it);
        else rest.push(it);
      });
      items = state.pinnedBuckets.length ? pinned.concat(rest) : rest.concat(pinned);
    }
    if (state.activeMarketFilter) {
      const m = state.activeMarketFilter;
      items = items.filter((it) => {
        const blob = `${it.query_used || ""} ${it._raw_title || it.title || ""}`;
        if (m === "gift") return /礼赠|礼盒|gift/i.test(blob);
        if (m === "ecommerce") return /电商|天猫|京东|淘宝|主图/i.test(blob) || it.wall_kind === "shelf";
        return true;
      });
    }
    if (state.activeToneFilter) {
      const toneMap = {
        中式现代: ["chinese_modern", "chinese_ceremonial"],
        国际简约: ["global_minimal", "minimal_white", "swiss_international"],
        地域文旅: ["regional_culture"],
      };
      const ids = toneMap[state.activeToneFilter];
      if (ids) {
        items = items.filter((it) =>
          (it.suggested_style_buckets || []).some((b) => ids.includes(b))
        );
      }
    }
    if (state.activeDirectionFilter) {
      const dirMap = {
        开箱记忆: ["chinese_ceremonial", "craft_material"],
        货架识别: ["efficacy_hammer", "global_minimal", "minimal_white"],
        礼赠仪式: ["chinese_ceremonial", "luxury_gilt"],
      };
      const ids = dirMap[state.activeDirectionFilter];
      if (ids) {
        items = items.filter((it) =>
          (it.suggested_style_buckets || []).some((b) => ids.includes(b))
        );
      }
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
      <div class="insp-block">
        <h4><span class="ico">📎</span>支持证据</h4>
        <div class="evidence-tags">
          <span>Brief 笔记</span><span>开箱清单</span><span>${escapeHtml(item.bucket || "主墙")}</span>
        </div>
      </div>
      <div class="insp-block">
        <h4><span class="ico">◎</span>采集字段</h4>
        <ul>
          <li>来源：${escapeHtml(humanSource(item.source) || "待核实")} · ${escapeHtml(item.source_type || "inspiration")}</li>
          <li>墙：${escapeHtml({ primary: "主品类", analogy: "类比", shelf: "货架" }[item.wall_kind] || "主品类")}</li>
          <li>风格桶：${escapeHtml(
            (item.suggested_style_buckets || [])
              .map((id) => state.bucketIdToZh[id] || id)
              .join(" / ") || item.bucket || "待粗标"
          )}</li>
          ${
            (item.structure_tags || []).length
              ? `<li>结构：${escapeHtml((item.structure_tags || []).join("、"))}</li>`
              : ""
          }
          ${
            item.page_url
              ? `<li><a href="${escapeAttr(item.page_url)}" target="_blank" rel="noopener">打开原页</a></li>`
              : "<li>原页待补</li>"
          }
        </ul>
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

  function renderBrief() {
    const l1 = state.bundle?.l1 || {};
    const input = l1.input || {};
    const intent = l1.intent || {};
    const rec = state.bundle?.l3?.ai_recommended_buckets || [];
    return `<div class="brief-canvas">
      <div class="wall-summary"><span>Brief 理解</span><span>${escapeHtml(
        intent.domain_label_zh || input.category_text || ""
      )}</span></div>
      <p class="one-liner">${escapeHtml(l1.raw_brief || el.researchQuestion?.value || "")}</p>
      <dl class="intent-grid">
        <div><dt>品类</dt><dd>${escapeHtml(intent.domain_label_zh || input.product || "—")}</dd></div>
        <div><dt>渠道</dt><dd>${escapeHtml(input.channel || "—")}</dd></div>
        <div><dt>客群</dt><dd>${escapeHtml(input.audience || "—")}</dd></div>
        <div><dt>价格带</dt><dd>${escapeHtml(input.price_band || "—")}</dd></div>
        <div><dt>气质</dt><dd>${escapeHtml(input.culture_tone || "中式现代")}</dd></div>
        <div><dt>把握</dt><dd>${
          intent.confidence != null ? Math.round(intent.confidence * 100) + "%" : "—"
        }</dd></div>
      </dl>
      <div class="bucket-label">必须有</div>
      <div class="chip-row">${(input.must_have || [])
        .map((t) => `<span>${escapeHtml(t)}</span>`)
        .join("")}</div>
      <div class="bucket-label">必须避开</div>
      <div class="chip-row">${(input.must_avoid || [])
        .map((t) => `<span class="avoid">${escapeHtml(t)}</span>`)
        .join("")}</div>
      <div class="bucket-label">风格先验</div>
      <div class="chip-row">${(intent.style_prior || rec.map((x) => x.id) || [])
        .map(
          (id) =>
            `<span>${escapeHtml(state.bucketIdToZh[id] || id)}</span>`
        )
        .join("")}</div>
      ${
        (intent.risk_notes || []).length
          ? `<div class="gap-banner">${escapeHtml((intent.risk_notes || []).join(" · "))}</div>`
          : ""
      }
      <button type="button" class="brief-cta" data-empty-action="to-map">看市场地图</button>
    </div>`;
  }

  function renderCrawl() {
    const plan = state.bundle?.l1?.intent?.query_plan || {};
    const counts = state.bundle?.l3?.counts || state.feedCounts;
    const channels = state.bundle?.l3?.channel_status || state.sources || [];
    return `<div class="crawl-canvas">
      <div class="wall-summary"><span>采集拆解</span><span>主墙 ${
        counts.main_wall || state.feedCounts.main || 0
      } · 待复核 ${counts.pending_review || state.feedCounts.pending || 0}</span></div>
      <p>按灵感 / 货架 / 类比三路摸样本。主墙已经挂上真数据；货架通道仍诚实标「待开通」。</p>
      <div class="query-col">
        <h4>灵感</h4>
        <ul>${(plan.inspiration || ["green tea packaging design gift box", "青绿茶 礼盒 包装设计"])
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join("")}</ul>
        <h4>货架</h4>
        <ul>${(plan.shelf || ["天猫 绿茶礼盒 包装", "京东 高端茶礼盒"])
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join("")}</ul>
        <h4>类比</h4>
        <ul>${(plan.analogy || ["huangjiu gift box packaging", "tcm tonic gift packaging modern"])
          .map((q) => `<li>${escapeHtml(q)}</li>`)
          .join("")}</ul>
      </div>
      <div class="bucket-label">通道现状</div>
      <div class="chip-row">${channels
        .map(
          (c) =>
            `<span>${escapeHtml(c.label || c.id)} · ${escapeHtml(
              c.note || c.statusText || c.status || ""
            )}</span>`
        )
        .join("")}</div>
      <button type="button" class="crawl-cta" data-empty-action="to-map">打开视觉墙</button>
    </div>`;
  }

  function renderRecBuckets() {
    if (!el.recBuckets) return;
    const rec = state.bundle?.l3?.ai_recommended_buckets || [];
    if (!rec.length) {
      el.recBuckets.innerHTML = "";
      return;
    }
    el.recBuckets.innerHTML = rec
      .map((b) => {
        const pinned = state.pinnedBuckets.includes(b.id);
        const muted = state.mutedBuckets.includes(b.id);
        return `<button type="button" class="rec-chip ${pinned ? "pinned" : ""} ${
          muted ? "muted" : ""
        }" data-rec="${escapeAttr(b.id)}" title="${escapeAttr(b.why || "")}">${escapeHtml(
          b.name_zh || b.id
        )}</button>`;
      })
      .join("");
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
      const gap =
        state.wallMode === "shelf"
          ? "货架墙样本不足：区隔论证偏弱，建议补天猫/京东深链后再拍板。"
          : state.wallMode === "analogy"
            ? "类比样本还在补 · 可先看计划边，或从主品类墙借入。"
            : "换个类别或来源再看看，或者打开「含待复核」。";
      return `<div class="empty"><div class="slogan">这会儿墙上还空着</div><p class="hint">${gap}</p>
      <button type="button" class="empty-cta" data-empty-action="show-all">看看全部参考</button>
      ${
        state.wallMode !== "primary"
          ? `<button type="button" class="empty-cta" data-empty-action="wall-primary">回到主品类墙</button>`
          : ""
      }</div>`;
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
    const wallLabel =
      state.wallMode === "shelf" ? "货架墙" : state.wallMode === "analogy" ? "类比墙" : "主品类墙";
    const briefSummary = state.onlyBriefRelevant
      ? `${wallLabel} · 先看和 brief 更贴的 · 约 ${filtered.length} 张`
      : `${wallLabel} · 主墙 ${mainN} · 待复核 ${pendN}${
          state.includePending ? ` · 这屏待复核 ${pendingShown}` : ""
        } · 先看着 ${visible.length} 张`;
    let html = `<div class="wall-summary">
      <span>${escapeHtml(tone)} · ${escapeHtml(channel)}</span>
      <span>${briefSummary}</span>
    </div>`;
    if (state.wallMode === "shelf" && filtered.length < 8) {
      html += `<div class="gap-banner">货架墙样本偏薄：用来对照「市场上常见长什么样」，不是抄爆款。淘宝/京东通道仍待开通。</div>`;
    }
    if (state.wallMode === "analogy" && filtered.length < 8) {
      html += `<div class="gap-banner">类比墙用来逼出跨品类造型语言。样本不足时可从主品类墙借入同桶参考。</div>`;
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

  function renderStrategy() {
    const cards = state.bundle?.l4_cards || [];
    if (!cards.length) {
      return `<div class="empty"><div class="slogan">还没有方向卡</div><p class="hint">等视觉墙看顺眼了，再请智能体帮你写三张可批判的方向。</p>
      <button type="button" class="empty-cta" data-empty-action="ask-strategy">去聊聊方向</button></div>`;
    }
    const findItem = (id) => findWallItem(id);
    return `<div class="strategy-list">${cards
      .map((c) => {
        const d = state.decisions[c.card_id] || c.hou_decision || "pending";
        const img =
          (RT.cardImage && RT.cardImage(c, findItem)) ||
          c.local_ref_image ||
          c.reference_montage?.[0]?.image_url ||
          "";
        const refs = c.reference_montage || [];
        return `
        <article class="strategy-card ${d === "keep" ? "keep" : d === "kill" ? "kill" : ""}" data-card-id="${c.card_id}">
          <div class="sc-img-big" style="background-image:url('${escapeAttr(img)}')"></div>
          <div class="sc-body">
            <h4>${escapeHtml(c.title)}</h4>
            <p class="one-liner">${escapeHtml(c.one_liner || "")}</p>
            <p class="adv">${escapeHtml(c.advantage || "")}</p>
            ${
              c.differentiation
                ? `<p class="sc-diff">区隔：${escapeHtml(c.differentiation)}</p>`
                : ""
            }
            <div class="sc-tags">
              ${(c.recommended_style_buckets_zh || [])
                .map((t) => `<span>${escapeHtml(t)}</span>`)
                .join("")}
            </div>
            ${
              refs.length
                ? `<div class="sc-refs">${refs
                    .slice(0, 3)
                    .map(
                      (r) =>
                        `<img referrerpolicy="no-referrer" src="${escapeAttr(
                          r.image_url || ""
                        )}" alt="${escapeAttr(r.title || "")}" title="${escapeAttr(
                          r.why || ""
                        )}" />`
                    )
                    .join("")}</div>`
                : ""
            }
            <details class="sc-fold">
              <summary>文案 / 草图方向</summary>
              <ul>${(c.verbal_directions || [])
                .concat(c.sketch_directions || [])
                .map((t) => `<li>${escapeHtml(t)}</li>`)
                .join("")}</ul>
            </details>
            <details class="sc-fold">
              <summary>Demo prompt</summary>
              <p class="demo-disclaimer">${escapeHtml(
                c.demo_disclaimer || "Demo only — 情绪板示意，不是完稿"
              )}</p>
              <p>${escapeHtml(c.demo_prompt || "")}</p>
            </details>
          </div>
          <div class="sc-actions">
            <button type="button" class="keep-btn ${d === "keep" ? "active-keep" : ""}" data-decide="keep" data-card-id="${c.card_id}">留下</button>
            <button type="button" class="kill-btn ${d === "kill" ? "active-kill" : ""}" data-decide="kill" data-card-id="${c.card_id}">先放下</button>
            <button type="button" class="merge-btn ${d === "merge" ? "active-merge" : ""}" data-decide="merge" data-card-id="${c.card_id}">合并</button>
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
    let html = `<div class="shortlist-actions">
      <button type="button" data-empty-action="copy-shortlist">复制纪要</button>
    </div>`;
    if (kept.length) {
      html += kept
        .map((c) => {
          const refs = (c.reference_montage || [])
            .slice(0, 3)
            .map(
              (r) =>
                `<img referrerpolicy="no-referrer" src="${escapeAttr(r.image_url || "")}" alt="" />`
            )
            .join("");
          return `
      <div class="shortlist-item">
        <span class="dot"></span>
        <div>
          <div class="t">${escapeHtml(c.title)}</div>
          <div class="s">${escapeHtml(c.one_liner || "")}</div>
          ${c.differentiation ? `<div class="s">区隔：${escapeHtml(c.differentiation)}</div>` : ""}
          ${refs ? `<div class="shortlist-thumbs">${refs}</div>` : ""}
        </div>
      </div>`;
        })
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
    html += `<p class="demo-disclaimer">以上供遴选；表现与完稿由设计执行，AI 不替代决策。</p>`;
    return html;
  }

  function renderCanvas({ preserveScroll = false } = {}) {
    const prev =
      preserveScroll && el.canvasBody ? el.canvasBody.scrollTop : 0;
    renderRecBuckets();
    if (state.tab === "visual" && state.stage === 1) {
      el.canvasBody.innerHTML = renderBrief();
    } else if (state.tab === "visual" && state.stage === 2) {
      el.canvasBody.innerHTML = renderCrawl();
    } else if (state.tab === "visual") {
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

    appendEvent({
      agent: "奎燕设计智能体",
      time: "11:58",
      tag: "读 Brief",
      tagClass: "stage",
      dot: "ok",
      html: `<p>先帮你把 Brief 读明白了——青绿茶礼盒，走中式现代，礼赠+电商都要站得住。</p>
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
      html: `<p>摸了一轮包装参考：主品类 + 类比 + 货架大概 ${counts.total || 0} 条，有图 ${counts.with_image || 0} 张。</p>
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
      html: `<p>花瓣和小红书还差登录深采——先用 Behance / 站酷把墙铺起来，不耽误讨论。</p>
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
    if (decision === "merge") {
      const others = (state.bundle?.l4_cards || []).filter((c) => c.card_id !== cardId);
      if (!others.length) {
        toast("没有可合并的另一张卡");
        return;
      }
      const target = others.find((c) => state.decisions[c.card_id] === "keep") || others[0];
      state.decisions[cardId] = "merge";
      const card = state.bundle?.l4_cards?.find((c) => c.card_id === cardId);
      if (card) card.merge_into = target.card_id;
      renderCanvas();
      toast(`「${card?.title || cardId}」并进「${target.title}」`);
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "合并",
        tagClass: "consensus",
        dot: "ok",
        html: `<p>把「${escapeHtml(card?.title || cardId)}」并进「${escapeHtml(
          target.title
        )}」。短名单只保留目标卡。</p>`,
      });
      return;
    }
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
    if (/市场地图|视觉|探索|看墙|地图/.test(t)) {
      setCap("orchestrator", "working", "正在帮你汇总视觉墙");
      setCap("dotdot", "working", "按风格桶重新摆墙");
      setTimeout(() => {
        setCap("orchestrator", "online", "视觉墙刷新好了，等你点选");
        setCap("dotdot", "idle", "桶标签已就绪");
        setStage(3);
      }, 400);
      return;
    }
    if (/brief|意图|听清|研究问题/.test(lower) || /brief|意图/.test(t)) {
      setStage(1);
      return;
    }
    if (
      (state.stage === 1 || /包装|礼盒|品类|brief/i.test(t)) &&
      RT.mapBrief &&
      t.length >= 8
    ) {
      const mapped = RT.mapBrief(
        t,
        state.bundle?.ontology_lite || [],
        state.researches
      );
      if (mapped.kind === "research" && mapped.research) {
        switchResearch(mapped.research.id);
        return;
      }
      if (mapped.kind === "mapped" && mapped.l1) {
        applyMappedBrief(mapped);
        return;
      }
    }
    if (/策略|三张|生成.*卡|批判/.test(t)) {
      setCap("dotdot", "working", "正在帮你写 / 刷新策略卡");
      setTimeout(() => {
        setCap("dotdot", "idle", "等你留下 / 先放下");
        setStage(4);
      }, 450);
      return;
    }
    if (/crawler|采集|同步/.test(lower) || /同步|采集/.test(t)) {
      setCap("crawler", "working", "正在帮你拉取包装参考…");
      setTimeout(() => {
        setCap(
          "crawler",
          "idle",
          `同步好了 ${state.bundle?.l3?.counts?.total || 23} 条 · 货架 ${state.bundle?.l3?.counts?.shelf || 6}`
        );
        setStage(2);
        switchTab("visual", { fromStage: true });
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
      html: `<p>收到。可以说「看视觉墙」「生成三张策略卡」「同步采集」或「输出短名单」——我跟着你走。</p>`,
    });
  }

  function updateQCount() {
    if (!el.researchQuestion || !el.qCount) return;
    const n = el.researchQuestion.value.length;
    el.qCount.textContent = `${n}/200`;
  }

  function applyMappedBrief(mapped) {
    state.bundle = state.bundle || {};
    state.bundle.l1 = mapped.l1;
    state.briefSpec = mapped.brief_spec;
    if (state.bundle.l3) {
      state.bundle.l3.l1_summary = {
        domain: mapped.l1.intent.domain_label_zh,
        channel: mapped.l1.input.channel,
        tone: mapped.l1.input.culture_tone,
        price_band: mapped.l1.input.price_band,
      };
    }
    if (el.researchQuestion) {
      el.researchQuestion.value = mapped.l1.raw_brief.slice(0, 200);
      updateQCount();
    }
    if (el.researchTitle) el.researchTitle.textContent = mapped.brief_spec.name + " · 新研究";
    state.wallItems = (state.defaultWall.length ? state.defaultWall : state.wallItems).map((it) =>
      normalizeFeedItem(it, it.wall_status || "main_wall")
    );
    if (RT.synthesizeCards) {
      state.bundle.l4_cards = RT.synthesizeCards(
        state.wallItems,
        mapped.l1,
        state.bucketIdToZh,
        state.bundle.bucket_hou_speak || {}
      );
      state.decisions = {};
      state.bundle.l4_cards.forEach((c) => {
        state.decisions[c.card_id] = "pending";
      });
    }
    toast(`已按「${mapped.brief_spec.name}」对齐 Brief`);
    setStage(1, { appendEvent: true });
    appendEvent({
      agent: "奎燕设计智能体",
      time: "现在",
      tag: "读 Brief",
      tagClass: "stage",
      dot: "ok",
      html: `<p>新品类先落到「${escapeHtml(
        mapped.l1.intent.domain_label_zh
      )}」。墙上先筛已有参考，不够再补采。</p>
        <div class="chips-row"><button type="button" class="artifact-link" data-artifact="brief">Brief 笔记</button>
        <button type="button" class="artifact-link" data-artifact="map">看市场地图</button></div>`,
    });
  }

  async function switchResearch(id) {
    const rec = (state.researches || []).find((r) => r.id === id);
    if (!rec) {
      toast("这份研究还没落地");
      return;
    }
    SAVED.forEach((r) => (r.active = r.id === id));
    renderResearch();
    state.activeResearchId = id;
    state.briefSpec = rec.brief_spec || null;
    state.selectedIds = new Set();
    state.shortlistVisual = [];
    state.includePending = false;
    if (el.researchTitle) el.researchTitle.textContent = rec.title;
    if (el.researchQuestion && rec.question) {
      el.researchQuestion.value = rec.question;
      updateQCount();
    }
    if (rec.l1) {
      state.bundle.l1 = rec.l1;
      if (state.bundle.l3) {
        state.bundle.l3.l1_summary = {
          domain: rec.l1.intent?.domain_label_zh,
          channel: rec.l1.input?.channel,
          tone: rec.l1.input?.culture_tone,
          price_band: rec.l1.input?.price_band,
        };
      }
    }
    try {
      if (rec.use_default_feeds) {
        state.wallItems = state.defaultWall.slice();
        state.pendingItems = state.defaultPending.slice();
        state.feedCounts = { ...state.defaultFeedCounts };
        if (rec.l4_from_pack && state.bundle._packCards) {
          state.bundle.l4_cards = state.bundle._packCards.map((c) => ({ ...c }));
        }
      } else if (rec.wall) {
        const res = await fetch(rec.wall);
        if (!res.ok) throw new Error("research wall " + res.status);
        const raw = parseJsonl(await res.text());
        state.wallItems = raw.map((r) => normalizeFeedItem(r, "main_wall"));
        state.wallItems = demoteFragileWallOrder(state.wallItems);
        state.pendingItems = [];
        state.feedCounts = { main: raw.length, pending: 0 };
        if (RT.synthesizeCards) {
          state.bundle.l4_cards = RT.synthesizeCards(
            state.wallItems,
            state.bundle.l1,
            state.bucketIdToZh,
            state.bundle.bucket_hou_speak || {}
          );
        }
      }
      state.decisions = {};
      (state.bundle.l4_cards || []).forEach((c) => {
        state.decisions[c.card_id] = c.hou_decision || "pending";
      });
      rebuildSourcesFromWall();
      updateWallCountBar();
      setCap("crawler", "idle", `主墙 ${state.feedCounts.main} · 待复核 ${state.feedCounts.pending}`);
      setStage(3, { appendEvent: false });
      seedStream();
      toast(`已切换到「${rec.title}」`);
    } catch (err) {
      console.warn(err);
      toast("这份研究的墙还没挂上");
    }
  }

  function openCompare() {
    const ids = [...state.selectedIds];
    if (ids.length < 2) {
      toast("再勾一张，才能对比一下");
      return;
    }
    const items = ids.map(findWallItem).filter(Boolean).slice(0, 4);
    if (!el.compareBackdrop || !el.compareModal) {
      toast(`先并排看这 ${items.length} 张`);
      return;
    }
    el.compareModal.innerHTML = `<div class="compare-head">
      <strong>并排看这 ${items.length} 张</strong>
      <button type="button" class="compare-close" data-compare-close="1">关闭</button>
    </div>
    <div class="compare-grid">${items
      .map(
        (it) => `<div class="compare-card">
        <img referrerpolicy="no-referrer" src="${escapeAttr(imgFor(it))}" alt="" />
        <div class="t">${escapeHtml(humanTitle(it.title))}</div>
        <div class="s">${escapeHtml(humanSource(it.source))} · ${escapeHtml(it.bucket || "")}</div>
      </div>`
      )
      .join("")}</div>`;
    el.compareBackdrop.hidden = false;
  }

  function closeCompare() {
    if (el.compareBackdrop) el.compareBackdrop.hidden = true;
  }

  function copyShortlist() {
    const md =
      (RT.shortlistMarkdown &&
        RT.shortlistMarkdown(state.bundle?.l1, keptCards(), state.shortlistVisual)) ||
      "";
    if (!md) {
      toast("短名单还是空的");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        () => toast("纪要已复制"),
        () => toast("复制失败，请手动选中")
      );
    } else toast("浏览器不支持一键复制");
  }

  function applyRuntimePack(pack) {
    if (!pack || typeof pack !== "object") return;
    const hasCards = Array.isArray(pack.l4_cards) && pack.l4_cards.length;
    if (!state.bundle || !Array.isArray(state.bundle.l4_cards) || !state.bundle.l4_cards.length) {
      state.bundle = pack;
    } else {
      state.bundle = { ...pack, ...state.bundle, l4_cards: state.bundle.l4_cards };
    }
    if (hasCards) {
      state.bundle.l4_cards = pack.l4_cards;
      state.bundle._packCards = pack.l4_cards.map((c) => ({ ...c }));
    }
    if (pack.bucket_id_to_zh) {
      state.bucketIdToZh = { ...state.bucketIdToZh, ...pack.bucket_id_to_zh };
      state.bundle.bucket_id_to_zh = state.bucketIdToZh;
    }
    if (pack.researches) {
      state.researches = pack.researches;
      SAVED = pack.researches.map((r, i) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        status: r.status || (i === 0 ? "running" : "done"),
        active: r.id === state.activeResearchId,
      }));
    }
    const active = (state.researches || []).find((r) => r.id === state.activeResearchId);
    if (active) state.briefSpec = active.brief_spec || null;
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

    if (el.wallMode) {
      el.wallMode.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-wall]");
        if (!btn) return;
        state.wallMode = btn.dataset.wall;
        el.wallMode.querySelectorAll(".wall-mode-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.wall === state.wallMode);
        });
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        if (state.tab !== "visual" || state.stage < 3) setStage(3, { appendEvent: false });
        else renderCanvas();
      });
    }

    if (el.recBuckets) {
      el.recBuckets.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-rec]");
        if (!chip) return;
        const id = chip.dataset.rec;
        if (e.shiftKey || e.altKey) {
          if (state.mutedBuckets.includes(id)) {
            state.mutedBuckets = state.mutedBuckets.filter((x) => x !== id);
          } else {
            state.mutedBuckets.push(id);
            state.pinnedBuckets = state.pinnedBuckets.filter((x) => x !== id);
          }
        } else if (state.pinnedBuckets.includes(id)) {
          state.pinnedBuckets = state.pinnedBuckets.filter((x) => x !== id);
        } else {
          state.pinnedBuckets.push(id);
          state.mutedBuckets = state.mutedBuckets.filter((x) => x !== id);
        }
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        renderRecBuckets();
        renderCanvas();
      });
    }

    if (el.compareBackdrop) {
      el.compareBackdrop.addEventListener("click", (e) => {
        if (e.target === el.compareBackdrop || e.target.closest("[data-compare-close]")) {
          closeCompare();
        }
      });
    }

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
        } else if (sel.dataset.filter === "market") {
          const v = sel.value || "";
          state.activeMarketFilter = /电商/.test(v) && !/礼赠/.test(v) ? "ecommerce" : /礼赠$/.test(v) ? "gift" : "";
          state.wallVisibleLimit = WALL_BATCH_INITIAL;
          renderCanvas();
        } else if (sel.dataset.filter === "direction" || sel.classList.contains("filter-direction")) {
          state.activeDirectionFilter = /开箱|货架|礼赠/.test(sel.value) ? sel.value.replace(/^方向 · /, "") : "";
          if (sel.value.indexOf("全部") >= 0) state.activeDirectionFilter = "";
          state.wallVisibleLimit = WALL_BATCH_INITIAL;
          renderCanvas();
        } else if (sel.dataset.filter === "tone" || sel.classList.contains("filter-tone")) {
          state.activeToneFilter = /中式现代|国际简约|地域文旅/.test(sel.value)
            ? sel.value.replace(/^气质 · /, "")
            : "";
          if (sel.value.indexOf("全部") >= 0) state.activeToneFilter = "";
          state.wallVisibleLimit = WALL_BATCH_INITIAL;
          renderCanvas();
        }
      });
    }

    el.canvasBody.addEventListener("click", (e) => {
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
        openCompare();
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
      switchResearch(card.dataset.id);
    });

    el.btnNew.addEventListener("click", () => {
      toast("新建研究 — 把 Brief 贴进研究问题，点「看市场地图」或发送");
      el.researchQuestion.focus();
      el.researchQuestion.select();
      setStage(1, { appendEvent: false });
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "新研究",
        tagClass: "stage",
        dot: "yellow",
        html: `<p>把你要搞清的事写在上面。我先映射品类和类比边，再拿现有墙上的参考顶上。</p>`,
      });
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
      } else if (act === "to-map") {
        const q = el.researchQuestion?.value || "";
        if (q && RT.mapBrief && state.stage === 1) {
          const mapped = RT.mapBrief(q, state.bundle?.ontology_lite || [], state.researches);
          if (mapped.kind === "research" && mapped.research && mapped.research.id !== state.activeResearchId) {
            switchResearch(mapped.research.id);
            return;
          }
          if (mapped.kind === "mapped" && mapped.score >= 3) applyMappedBrief(mapped);
        }
        setStage(3);
      } else if (act === "wall-primary") {
        state.wallMode = "primary";
        if (el.wallMode) {
          el.wallMode.querySelectorAll(".wall-mode-btn").forEach((b) => {
            b.classList.toggle("active", b.dataset.wall === "primary");
          });
        }
        renderCanvas();
      } else if (act === "copy-shortlist") {
        copyShortlist();
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
        await loadLiveFeeds();
        feedsOk = true;
      } catch (feedErr) {
        console.warn("live feeds", feedErr);
      }

      // 2) Slim runtime pack first (L1+L4). Never let a stub bundle without cards win.
      let pack = null;
      for (const p of ["data/product-runtime.json", "data/product-pack.json", "data/product-bundle.json"]) {
        try {
          const res = await fetch(p);
          if (!res.ok) continue;
          const json = await res.json();
          const cards = json.l4_cards || json.l4?.cards;
          if (p.endsWith("product-bundle.json") && !(Array.isArray(cards) && cards.length)) {
            continue;
          }
          pack = json;
          if (Array.isArray(cards) && cards.length) pack.l4_cards = cards;
          break;
        } catch (e) {
          console.warn("pack", p, e);
        }
      }
      if (!pack) throw new Error("product pack missing");
      applyRuntimePack(pack);
      (state.bundle.l4_cards || []).forEach((c) => {
        state.decisions[c.card_id] = c.hou_decision || "pending";
      });
      if (el.researchQuestion) {
        const rec = (state.researches || []).find((r) => r.id === state.activeResearchId);
        el.researchQuestion.value =
          rec?.question ||
          "新品牌青绿茶礼盒：中式现代气质下，礼赠+电商渠道如何做出开箱记忆点与差异化？";
        updateQCount();
      }
      renderResearch();

      if (!feedsOk) {
        state.wallItems = collectWallItemsFromBundleFallback();
        state.feedCounts = { main: state.wallItems.length, pending: 0 };
        rebuildSourcesFromWall();
        updateWallCountBar();
        toast("主墙暂时读不到，先用本地缓存顶上");
      }
      state.defaultWall = state.wallItems.slice();
      state.defaultPending = state.pendingItems.slice();
      state.defaultFeedCounts = { ...state.feedCounts };
      // Re-enrich now that L1 style_prior / briefSpec exist
      state.wallItems = state.wallItems.map((it) =>
        normalizeFeedItem(it, it.wall_status || "main_wall")
      );
      state.defaultWall = state.wallItems.slice();
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
