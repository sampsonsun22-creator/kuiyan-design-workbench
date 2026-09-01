/* KEY 视界 · Light Research Lab shell
 * Studio: 任务栏 + 对话 + 自有库画布。底层五步不做成向导。
 */
(() => {
  const STAGES = [
    { id: 1, key: "intent", label: "听清 Brief", tab: "intent" },
    { id: 2, key: "search", label: "穷尽搜索", tab: "visual" },
    { id: 3, key: "classify", label: "分类拆解", tab: "visual" },
    { id: 4, key: "decide", label: "决策筛选", tab: "shortlist" },
    { id: 5, key: "report", label: "结论报告", tab: "report" },
  ];

  const SOURCE_META = {
    behance: { label: "Behance", short: "Behance" },
    pinterest: { label: "Pinterest", short: "Pinterest" },
    huaban: { label: "花瓣", short: "花瓣" },
    xiaohongshu: { label: "小红书", short: "小红书" },
    zcool: { label: "站酷", short: "站酷" },
    packagingoftheworld: { label: "Packaging of the World", short: "POTW" },
    jd: { label: "京东", short: "京东" },
    taobao: { label: "淘宝", short: "淘宝" },
    royalcanin: { label: "皇家", short: "皇家" },
    orijen: { label: "渴望", short: "渴望" },
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
      lastAction: "问清 Brief → 检索自有库 → 打标 → 老板选 → 报告",
    },
    {
      id: "crawler",
      name: "采集",
      status: "idle",
      lastAction: "只检索自有库 · 不对外网站点新爬",
    },
    {
      id: "dotdot",
      name: "点点",
      status: "working",
      lastAction: "正在铺墙打标，缺值一律写未标注",
    },
  ];

  // 青绿茶必须走壳权威 452/2680，禁止回落到 184 口径的过时绿茶 brief 文件
  const LANDING_RESEARCHES = [
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
  const CUSTOM_STORE = "key-vision-custom-researches";
  const LLM_STORE = "key-vision-llm-agents";
  let RESEARCHES = LANDING_RESEARCHES.map((r) => ({ ...r, feeds: r.feeds ? { ...r.feeds } : undefined }));

  const LLM_PROVIDERS = {
    openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    anthropic: { label: "Anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-20250514" },
    deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    moonshot: { label: "Moonshot 月之暗面", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-auto" },
    qwen: { label: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    zhipu: { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
    custom: { label: "自定义 OpenAI 兼容", baseUrl: "", model: "" },
  };

  const AGENT_LLM_META = [
    {
      id: "orchestrator",
      name: "奎燕设计智能体",
      job: "对话、看参考墙、短名单和结论都走这一套模型。",
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
    extraSourceIds: [],
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
    houComment: "",
    shortlistReasons: {},
    shortlistRemoved: new Set(),
    shortlistAuto: false,
    shortlistTouched: false,
    dims: null,
    chatTurns: [],
    llmBusy: false,
    llmAgents: {},
    llmFocus: "orchestrator",
    proxyOk: null,
    activeLibLane: "",
    activeMarketStyle: "",
    marketStyles: [],
    artifactOpen: true,
    holdResults: false,
    briefAskKey: "",
    railQuery: "",
    railCollapsed: false,
    filtersCompact: false,
    scopeRef: null,
    _runTimers: [],
    _cmdIndex: 0,
    _slashIndex: 0,
    _mentionIndex: 0,
    benyanSessionPending: [],
  };

  const SHORTLIST_TARGET = 12;
  const SHORTLIST_MIN = 8;

  /**
   * 本研调研：Brief 钉产品后，墙只挂 POST /api/pack/collect 的 session 袋面。
   * 短名单只认 extra.collect_method==="api_pack_collect"；英文标题也过。
   * 不绑 452/2680，不重开 directed 包。PET_FOOD_DIRECTED 保持空。
   */
  const PET_FOOD_DIRECTED = "";
  const BENYAN_PET_RE = /宠物|猫粮|狗粮|宠物粮|pet\s*food|orijen|渴望|royal\s*canin|皇家/i;
  const BENYAN_CAT_RE = /猫粮|猫主粮|成猫|幼猫|室内猫|猫罐|猫零食|cat\s*food|\bcats?\b|feline/i;
  const BENYAN_DOG_RE = /狗粮|犬粮|成犬|幼犬|狗主粮|犬主粮|dog\s*food|\bdogs?\b|canine/i;
  const LONG_DETAIL_IMAGE_RE = /I27_%E5%AE%A4%E5%86%85|I27_室内成猫|14395/i;

  /** analogy_plan 里明显跨行业的目标；只用于把计划标成「跨界」，不代表已采到样本。 */
  const CROSS_TARGET_RE = /美妆|护肤|香氛|香水|潮玩|家居|服饰|数码|球鞋|艺术衍生/i;

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
    wallFilters: $("wallFilters"),
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
    btnSettings: $("btnLlmSettings"),
    btnCapConfig: $("btnCapConfig"),
    briefOverlay: $("briefOverlay"),
    briefForm: $("briefForm"),
    briefFields: $("briefFields"),
    briefLead: $("briefLead"),
    briefClose: $("briefClose"),
    briefError: $("briefError"),
    llmOverlay: $("llmOverlay"),
    llmForm: $("llmForm"),
    llmAgentFields: $("llmAgentFields"),
    llmProxyHint: $("llmProxyHint"),
    llmClose: $("llmClose"),
    llmTest: $("llmTest"),
    llmError: $("llmError"),
    sendBtn: $("sendBtn"),
    qHint: document.querySelector(".q-hint"),
    right: document.querySelector(".right"),
    wallCountBar: $("wallCountBar"),
    pendingToggle: $("pendingToggle"),
    briefToggle: $("briefToggle"),
    phaseWhisper: $("phaseWhisper"),
    libraryLanes: $("libraryLanes"),
    marketStyles: $("marketStyles"),
    userChip: $("userChip"),
    userMenu: $("userMenu"),
    btnToggleArtifact: $("btnToggleArtifact"),
    btnNavChat: $("btnNavChat"),
    btnNavSearch: $("btnNavSearch"),
    btnNavResult: $("btnNavResult"),
    btnDockGear: $("btnDockGear"),
    btnCloseResult: $("btnCloseResult"),
    gutterRail: $("gutterRail"),
    gutterResult: $("gutterResult"),
    resultChromeTitle: $("resultChromeTitle"),
    composerPlus: $("composerPlus"),
    composerModel: $("composerModel"),
    composerLibChip: $("composerLibChip"),
    composerSlash: $("composerSlash"),
    railSearch: $("railSearch"),
    runStep: $("runStep"),
    btnNavTags: $("btnNavTags"),
    btnNavReport: $("btnNavReport"),
    metaModel: $("metaModel"),
    appRoot: $("app"),
    btnRailCollapse: $("btnRailCollapse"),
    btnFilterCompact: $("btnFilterCompact"),
    btnCommandPalette: $("btnCommandPalette"),
    cmdOverlay: $("cmdOverlay"),
    cmdInput: $("cmdInput"),
    cmdList: $("cmdList"),
    slashMenu: $("slashMenu"),
    mentionMenu: $("mentionMenu"),
    scopeChips: $("scopeChips"),
  };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("show"), 2200);
  }

  const GEAR_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M19.4 13.1a1.2 1.2 0 0 0 .24-1.1 7.4 7.4 0 0 0 0-.2 1.2 1.2 0 0 0-.24-1.1l1.6-1.3-1.8-3.1-2 .8a7.2 7.2 0 0 0-1.9-1.1l-.3-2.1h-3.6l-.3 2.1a7.2 7.2 0 0 0-1.9 1.1l-2-.8-1.8 3.1 1.6 1.3a1.2 1.2 0 0 0-.24 1.1 7.4 7.4 0 0 0 0 .2 1.2 1.2 0 0 0 .24 1.1l-1.6 1.3 1.8 3.1 2-.8a7.2 7.2 0 0 0 1.9 1.1l.3 2.1h3.6l.3-2.1a7.2 7.2 0 0 0 1.9-1.1l2 .8 1.8-3.1-1.6-1.3Z"/></svg>`;

  function defaultAgentLlm(id) {
    return {
      id: id || "orchestrator",
      provider: "deepseek",
      baseUrl: LLM_PROVIDERS.deepseek.baseUrl,
      model: LLM_PROVIDERS.deepseek.model,
      apiKey: "",
    };
  }

  function cleanApiKey(raw) {
    return String(raw || "").trim().replace(/^["']+|["']+$/g, "");
  }

  function normalizeLlmBase(provider, base) {
    let b = String(base || "").trim().replace(/\/+$/, "");
    if ((provider || "deepseek") === "deepseek") {
      if (!b || b === "https://api.deepseek.com") b = "https://api.deepseek.com/v1";
    }
    return b;
  }

  function loadLlmAgents() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(LLM_STORE) || "{}") || {};
    } catch (_) {
      saved = {};
    }
    const old = saved.orchestrator || saved.llm || {};
    const cfg = {
      ...defaultAgentLlm("orchestrator"),
      provider: old.provider || saved.provider || "deepseek",
      baseUrl: old.baseUrl || saved.baseUrl || LLM_PROVIDERS.deepseek.baseUrl,
      model: old.model || saved.model || LLM_PROVIDERS.deepseek.model,
      apiKey: cleanApiKey(old.apiKey || saved.apiKey || ""),
    };
    cfg.baseUrl = normalizeLlmBase(cfg.provider, cfg.baseUrl);
    state.llm = cfg;
    state.llmAgents = { orchestrator: cfg };
    return state.llmAgents;
  }

  function persistLlmAgents() {
    const cfg = currentLlm();
    const blob = {
      orchestrator: {
        id: "orchestrator",
        provider: cfg.provider || "deepseek",
        baseUrl: cfg.baseUrl || "",
        model: cfg.model || "",
        apiKey: cleanApiKey(cfg.apiKey),
      },
    };
    try {
      localStorage.setItem(LLM_STORE, JSON.stringify(blob));
      const check = JSON.parse(localStorage.getItem(LLM_STORE) || "{}");
      const kept = cleanApiKey((check.orchestrator || {}).apiKey);
      if (blob.orchestrator.apiKey && kept !== blob.orchestrator.apiKey) {
        toast("这台浏览器没能记住密钥");
      }
    } catch (_) {}
    syncLlmUi();
  }

  function currentLlm() {
    if (!state.llm) loadLlmAgents();
    return state.llm || defaultAgentLlm("orchestrator");
  }

  function llmReady() {
    const cfg = currentLlm();
    return Boolean(cfg && cfg.apiKey && cfg.model && cfg.baseUrl);
  }

  function llmConfigFor() {
    return currentLlm();
  }

  function syncLlmUi() {
    const any = llmReady();
    if (el.btnSettings) el.btnSettings.classList.toggle("ready", any);
    document.querySelectorAll(".cap-gear").forEach((btn) => {
      btn.classList.toggle("ready", any);
    });
    if (el.composerInput) {
      el.composerInput.placeholder = any
        ? "输入你的问题，或用 / 分析指令、@ 调用素材库…"
        : "输入问题，或用 / 看库、筛选、出结论。先点齿轮配 API 才能真正对话。";
    }
    if (el.composerModel) {
      const cfg = currentLlm();
      const short = String((cfg && cfg.model) || "奎燕").split("/").pop();
      el.composerModel.textContent = any ? `模型 · ${short}` : "模型 · 奎燕";
      el.composerModel.classList.toggle("ready", any);
    }
    if (el.metaModel) {
      const cfg = currentLlm();
      const short = String((cfg && cfg.model) || "奎燕").split("/").pop();
      el.metaModel.textContent = any ? `模型 · ${short}` : "模型 · 奎燕";
    }
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function hydrateCustomResearches() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_STORE) || "[]");
      if (!Array.isArray(raw) || !raw.length) return;
      const landing = new Set(LANDING_RESEARCHES.map((r) => r.id));
      const extras = raw.filter((r) => r && r.id && !landing.has(r.id)).slice(0, 20);
      if (extras.length) RESEARCHES = extras.concat(RESEARCHES);
    } catch (_) {}
  }

  function persistCustomResearches() {
    const extras = RESEARCHES.filter((r) => r.custom).map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      status: r.status,
      question: r.question,
      custom: true,
      emptyWall: true,
      onlyBriefDefault: false,
      feeds: { main: [] },
      brief: r.brief || {},
    }));
    try {
      localStorage.setItem(CUSTOM_STORE, JSON.stringify(extras));
    } catch (_) {}
  }

  function researchBriefBlob(r) {
    const input = (r && r.brief) || {};
    const live =
      r && r.id === state.activeResearchId && state.bundle && state.bundle.l1
        ? state.bundle.l1.input || {}
        : {};
    return [r && r.title, r && r.question, input.product, live.product].filter(Boolean).join(" ");
  }

  function benyanProductText(r = currentResearch()) {
    const input = (r && r.brief) || {};
    const live =
      r && r.id === state.activeResearchId && state.bundle && state.bundle.l1
        ? state.bundle.l1.input || {}
        : {};
    return [input.product, live.product, r && r.title].filter(Boolean).join(" ");
  }

  function isBenyanResearch(r = currentResearch()) {
    if (!r || !r.custom) return false;
    if (isDraftInterview(r)) return false;
    return Boolean(String((r.brief && r.brief.product) || "").trim());
  }

  function isKnownLongDetailImage(url) {
    return LONG_DETAIL_IMAGE_RE.test(String(url || ""));
  }

  function isPendingReview(it) {
    if (!it) return true;
    return Boolean(
      it.pending ||
        it.qc_status === "pending_review" ||
        it.wall_status === "pending_review" ||
        (it.extra && it.extra.qc_status === "pending_review")
    );
  }

  function benyanSpeciesOfText(text) {
    const s = String(text || "");
    const cat = BENYAN_CAT_RE.test(s);
    const dog = BENYAN_DOG_RE.test(s);
    if (cat && !dog) return "cat";
    if (dog && !cat) return "dog";
    return "";
  }

  function benyanBriefSpecies(r = currentResearch()) {
    return benyanSpeciesOfText(benyanProductText(r));
  }

  function benyanItemSpecies(row) {
    if (!row) return "";
    if (row.extra && (row.extra.species === "cat" || row.extra.species === "dog")) {
      return row.extra.species;
    }
    return benyanSpeciesOfText(
      [row.title, row.query_used, row.page_url, row.author_or_brand, (row.raw_tags || []).join(" ")]
        .filter(Boolean)
        .join(" ")
    );
  }

  function benyanSubjectLabel(species) {
    if (species === "cat") return "猫粮";
    if (species === "dog") return "犬粮";
    return "未分猫/犬";
  }

  function passesBagFrontQc(row) {
    if (!row) return false;
    const img = String(row.image_url || row.thumbnail_url || "");
    const page = String(row.page_url || "");
    if (!/^https:\/\//i.test(img) || !/^https:\/\//i.test(page)) return false;
    if (isKnownLongDetailImage(img)) return false;
    const aspect = Number(row.extra && row.extra.aspect);
    if (Number.isFinite(aspect) && aspect > 0 && (aspect < 0.8 || aspect >= 3 || aspect > 2.2)) {
      return false;
    }
    return true;
  }

  function benyanRowsForProduct(_product) {
    // directed 包不接。PET_FOOD_DIRECTED 必须保持空。墙只收 POST /api/pack/collect。
    void PET_FOOD_DIRECTED;
    return [];
  }

  function isApiPackCollect(it) {
    return Boolean(it && it.extra && it.extra.collect_method === "api_pack_collect");
  }

  function benyanEligibleItems() {
    const want = benyanBriefSpecies();
    const seen = new Set();
    const pool = [];
    (state.wallItems || []).concat(state.pendingItems || []).forEach((it) => {
      if (!it || seen.has(it.id)) return;
      seen.add(it.id);
      if (!isApiPackCollect(it)) return;
      if (!passesBagFrontQc(it)) return;
      if (!imgFor(it) || !pageUrlOf(it)) return;
      if (state.shortlistRemoved.has(it.id)) return;
      const got = benyanItemSpecies(it);
      if (want && got && want !== got) return;
      pool.push(it);
    });
    return pool;
  }

  function benyanShortlistFormed() {
    return benyanEligibleItems().length > 0;
  }

  function benyanGapState() {
    const species = benyanBriefSpecies();
    const passedN = benyanEligibleItems().length;
    const pendingN = (state.pendingItems || []).filter((it) => {
      const got = benyanItemSpecies(it);
      return !species || got === species;
    }).length;
    const pendingOnWall = (state.wallItems || []).filter((it) => {
      if (!isPendingReview(it)) return false;
      const got = benyanItemSpecies(it);
      return !species || got === species;
    }).length;
    return {
      species,
      speciesLabel: benyanSubjectLabel(species),
      passedN,
      pendingN: pendingN + pendingOnWall,
      libraryN: (state.wallItems || []).length + (state.pendingItems || []).length,
      formed: benyanShortlistFormed(),
      deficit: Math.max(0, SHORTLIST_MIN - passedN),
    };
  }

  function benyanGapSentences(g = benyanGapState()) {
    const lines = [];
    if (!g.formed) {
      lines.push("短名单未成立：墙上还没有 api 采回袋面。");
      lines.push("不凑 8，不报产品过。");
    }
    lines.push("不当选型，不挂方向卡戳。");
    return lines;
  }

  function applyBenyanShortlist() {
    if (!benyanShortlistFormed()) {
      setShortlist([]);
      state.shortlistAuto = true;
      return 0;
    }
    const items = benyanEligibleItems();
    setShortlist(items);
    state.shortlistAuto = true;
    return items.length;
  }

  function packCollectKey(product) {
    return String(product || "").trim().slice(0, 80);
  }

  function sourceFromCollectUrl(url) {
    const h = String(url || "").toLowerCase();
    if (h.includes("orijen")) return "orijen";
    if (h.includes("royalcanin")) return "royalcanin";
    if (h.includes("jd.com")) return "jd";
    return "official";
  }

  function packCollectToRow(product, item) {
    const name = packCollectKey(product);
    const page = item.deep_link || item.product_url || "";
    const img = item.pack_url || "";
    const species = benyanSpeciesOfText(name) || benyanSpeciesOfText(item.name);
    return {
      id: `benyan:pack:${String(item.product_url || img || name).replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 72)}`,
      title: item.name || name,
      author_or_brand: "",
      source: sourceFromCollectUrl(item.product_url || page),
      source_type: "shelf",
      page_url: page,
      image_url: img,
      thumbnail_url: img,
      query_used: name,
      raw_tags: ["benyan-bagfront", "pack-collect"],
      suggested_style_buckets: [],
      structure_tags: [],
      info_hierarchy_tags: [],
      color_roles: [],
      is_on_market: "yes",
      collected_at: new Date().toISOString(),
      extra: {
        bag_front_qc: "pending",
        aspect: item.ratio,
        width: item.width,
        height: item.height,
        research_seat: "benyan",
        species: species || undefined,
        pack_collect: true,
        collect_method: "api_pack_collect",
        qc_status: "pending_review",
      },
      wall_status: "pending_review",
      qc_status: "pending_review",
      _collect_product: name,
    };
  }

  function sessionPendingForProduct(product) {
    const r = currentResearch();
    const keys = new Set(
      [packCollectKey(product), packCollectKey(r && r.brief && r.brief.product)].filter(Boolean)
    );
    return (state.benyanSessionPending || []).filter((it) => keys.has(it._collect_product));
  }

  function ingestPackCollectItem(product, item) {
    const row = packCollectToRow(product, item);
    state.benyanSessionPending = (state.benyanSessionPending || []).filter((it) => it.id !== row.id);
    state.benyanSessionPending.push(row);
    return row;
  }

  let packCollectTimer = 0;
  let packCollectInflight = "";
  const packCollectTried = new Set();

  async function requestPackCollect(product, opts) {
    const name = packCollectKey(product);
    const immediate = Boolean(opts && opts.immediate);
    if (!name) return null;
    const run = async () => {
      if (packCollectInflight === name) return null;
      if (packCollectTried.has(name) && !immediate) return null;
      packCollectTried.add(name);
      packCollectInflight = name;
      setCap("crawler", "working", "按品名收袋面");
      try {
        const res = await fetch("/api/pack/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product: name }),
        });
        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          data = {};
        }
        if (res.status === 404) {
          packCollectTried.delete(name);
          toast("按品名收袋面通道未接上");
          setCap("crawler", "idle", "按品名收袋面未接上");
          return data;
        }
        if (data.no_truncate) {
          toast("产品词过短，不按品类硬收");
          setCap("crawler", "idle", "产品词过短");
          return data;
        }
        if (data.missing_key && (!data.ok || !data.item)) {
          packCollectTried.delete(name);
          toast("TAVILY_API_KEY 未配置，官网降级未收到袋面");
          setCap("crawler", "idle", "袋面通道缺钥");
          return data;
        }
        if (!data.ok || !data.item || !data.item.pack_url) {
          packCollectTried.delete(name);
          toast(data.error || "空袋面");
          setCap("crawler", "idle", "空袋面");
          return data;
        }
        ingestPackCollectItem(name, data.item);
        const r = currentResearch();
        if (r && r.custom && r.brief && packCollectKey(r.brief.product) === name) {
          await loadBenyanResearchWall(r);
          if (state.tab === "visual") renderCanvas();
        }
        toast("按品名收袋面已入待复核");
        setCap("crawler", "idle", "按品名收袋面 · 待复核");
        return data;
      } catch (err) {
        packCollectTried.delete(name);
        toast("按品名收袋面未打通");
        setCap("crawler", "idle", "按品名收袋面未打通");
        return { ok: false, error: String(err && err.message ? err.message : err) };
      } finally {
        if (packCollectInflight === name) packCollectInflight = "";
      }
    };
    if (immediate) {
      clearTimeout(packCollectTimer);
      return run();
    }
    clearTimeout(packCollectTimer);
    return new Promise((resolve) => {
      packCollectTimer = setTimeout(() => {
        resolve(run());
      }, 640);
    });
  }

  async function loadBenyanResearchWall(research) {
    const r = research || currentResearch();
    const product = benyanProductText(r);
    state.wallItems = [];
    state.pendingItems = [];
    state.feedCounts = { main: 0, pending: 0 };
    state.shortlistVisual = [];
    state.shortlistTouched = false;
    state.shortlistReasons = {};
    const raw = benyanRowsForProduct(product);
    const session = sessionPendingForProduct(product);
    const pendingRaw = raw.filter((row) => isPendingReview(row)).concat(session);
    const passRaw = raw.filter((row) => !isPendingReview(row));
    state.wallItems = passRaw
      .map((row) => normalizeFeedItem(row, "main_wall"))
      .filter((it) => passesBagFrontQc(it) && (imgFor(it) || pageUrlOf(it)));
    state.pendingItems = pendingRaw
      .map((row) => normalizeFeedItem(row, "pending_review"))
      .filter((it) => passesBagFrontQc(it) && (imgFor(it) || pageUrlOf(it)));
    const seen = new Set(state.wallItems.map((it) => it.id));
    state.pendingItems.forEach((it) => {
      if (seen.has(it.id)) return;
      if (!(it.extra && (it.extra.pack_collect || it.extra.collect_method === "api_pack_collect"))) return;
      seen.add(it.id);
      state.wallItems.push(it);
    });
    state.feedCounts = { main: state.wallItems.filter((it) => !isPendingReview(it)).length, pending: state.pendingItems.length };
    state.preferredBuckets = [];
    state.wallVisibleLimit = WALL_BATCH_INITIAL;
    rebuildSourcesFromWall();
    updateWallCountBar();
    const gap = benyanGapState();
    setCap("crawler", "idle", `本课题${gap.speciesLabel} 库内 ${gap.libraryN} 条 · 不绑茶墙`);
    setCap(
      "dotdot",
      "idle",
      gap.formed
        ? `采回袋面 ${gap.passedN} 款入选，待复核，不报产品过`
        : `短名单未成立 · 采回 ${gap.passedN} · 待复核 ${gap.pendingN}`
    );
    if (state.bundle) state.bundle.l4_cards = [];
    r.onlyBriefDefault = true;
    if (!userArmedPending) forceProductWallDefaults("after-benyan-wall");
    return state.wallItems.length;
  }

  function emptyBundleFor(r) {
    const input = r.brief || {};
    const bundle = {
      bucket_id_to_zh: (state.bundle && state.bundle.bucket_id_to_zh) || {},
      l1: {
        brief_id: r.id,
        raw_brief: r.question || "",
        input: {
          product: input.product || "",
          audience: input.audience || "",
          channel: input.channel || "",
          occasion: input.occasion || "",
          culture_tone: input.culture_tone || "",
          price_band: input.price_band || "",
          job_type: input.job_type || "",
          must_have: input.must_have || [],
          must_avoid: input.must_avoid || [],
        },
        intent: {},
      },
      l3: { counts: {}, ai_recommended_buckets: [], l1_summary: {} },
      l4_cards: [],
    };
    if (isBenyanResearch(r)) bundle.l4_cards = [];
    return bundle;
  }

  function syncQuestionMode() {
    const r = currentResearch();
    const editable = Boolean(r && r.custom);
    if (el.researchQuestion) el.researchQuestion.readOnly = !editable;
    if (el.qHint) el.qHint.textContent = editable ? "本轮研究问题（可改）" : "本轮研究问题（只读）";
    syncPhaseWhisper();
  }

  const BRIEF_SLOTS = [
    { key: "audience", label: "人群", ask: "卖给谁？年龄、身份，送礼还是自用。" },
    { key: "price_band", label: "价格带", ask: "价格带大概在哪一档？大众、中端、中高端还是高端。" },
    { key: "channel", label: "渠道市场", ask: "线上、线下，还是都有？电商、商超、专柜？" },
    { key: "product", label: "分析对象", ask: "这轮要分析的具体产品是什么？例如青绿茶礼盒、白酒礼盒。" },
    { key: "culture_tone", label: "品牌定位", ask: "品牌气质怎么说？东方、国际简约、专业、时尚，还是别的。" },
    { key: "occasion", label: "使用场景", ask: "主要用在什么场合？节日礼赠、商务、还是日常自用？" },
    { key: "job_type", label: "课题类型", ask: "这是 0-1 新包装，还是现有包装升级？" },
  ];

  const PHASE_WHISPER = {
    1: "先把卖给谁、什么价、线上还是线下问清楚。Brief 粗，我就追问。",
    2: "只检索这台机器上的自有库。中国在售、概念稿分开看，不对外网站点新爬。",
    3: "按市场主流风格打标。没标的写未标注，不编一套好看的分类。",
    4: "老板看评分、拿掉、写一句再筛。这是一个来回，不是一次性向导。",
    5: "按你留下的参考出可下载报告。到这里为止，还不会有包装完稿。",
  };

  function isDraftInterview(r = currentResearch()) {
    return Boolean(r && r.custom && r.emptyWall && missingBriefSlots().length);
  }

  function syncPhaseWhisper() {
    if (!el.phaseWhisper) return;
    if (isDraftInterview()) {
      el.phaseWhisper.textContent = "缺的 Brief 项在对话框里一次填。中栏不再一问一答。";
      return;
    }
    el.phaseWhisper.textContent = PHASE_WHISPER[state.stage] || PHASE_WHISPER[1];
  }

  const RESULT_TAB_LABEL = {
    intent: "Brief",
    visual: "参考",
    shortlist: "候选方向",
    report: "结论",
    strategy: "结论",
  };

  function syncResultChrome() {
    if (el.resultChromeTitle) {
      const label = RESULT_TAB_LABEL[state.tab] || "结果";
      const n =
        state.tab === "visual"
          ? state.feedCounts.main || 0
          : state.tab === "shortlist"
            ? state.shortlistVisual.length
            : "";
      el.resultChromeTitle.textContent = n === "" ? label : `${label} · ${n}`;
    }
    if (el.btnNavChat) el.btnNavChat.classList.toggle("active", !state.artifactOpen);
    if (el.btnNavResult) {
      const on = state.artifactOpen && state.tab === "visual";
      el.btnNavResult.classList.toggle("active", on);
      el.btnNavResult.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (el.btnNavReport) el.btnNavReport.classList.toggle("active", state.artifactOpen && state.tab === "report");
  }

  function setArtifactOpen(open, opts = {}) {
    if (open && !opts.force && isDraftInterview()) {
      refuseDraftReveal(opts.why || "先开口问清 Brief，右边先不弹出。");
      return;
    }
    state.artifactOpen = Boolean(open);
    if (state.artifactOpen) state.holdResults = false;
    if (el.appRoot) el.appRoot.classList.toggle("artifact-open", state.artifactOpen);
    if (el.btnToggleArtifact) {
      el.btnToggleArtifact.setAttribute("aria-pressed", state.artifactOpen ? "true" : "false");
      el.btnToggleArtifact.textContent = state.artifactOpen ? "收起结果" : "弹出结果";
    }
    syncResultChrome();
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  const LAYOUT_STORE = "key-vision-layout-v4";
  const LAYOUT_LEGACY = "key-vision-layout-v3";
  const RAIL_COLLAPSED_W = 72;
  const layoutState = {
    railW: 240,
    resultW: 560,
    railCollapsed: false,
    filtersCompact: false,
  };

  function defaultLayout() {
    return {
      railW: 240,
      resultW: Math.round(Math.min(640, Math.max(480, window.innerWidth * 0.46))),
      railCollapsed: false,
      filtersCompact: false,
    };
  }

  function readLayout() {
    try {
      const raw = localStorage.getItem(LAYOUT_STORE) || localStorage.getItem(LAYOUT_LEGACY) || "{}";
      const saved = JSON.parse(raw) || {};
      const d = defaultLayout();
      return {
        railW: clamp(Number(saved.railW) || d.railW, 200, 360),
        resultW: clamp(Number(saved.resultW) || d.resultW, 400, Math.max(420, window.innerWidth - 640)),
        railCollapsed: Boolean(saved.railCollapsed),
        filtersCompact: false,
      };
    } catch (_) {
      return defaultLayout();
    }
  }

  function persistStudioLayout() {
    try {
      localStorage.setItem(
        LAYOUT_STORE,
        JSON.stringify({
          railW: layoutState.railW,
          resultW: layoutState.resultW,
          railCollapsed: layoutState.railCollapsed,
        })
      );
    } catch (_) {}
  }

  function applyStudioLayout() {
    const root = el.appRoot;
    if (!root) return;
    const railW = layoutState.railCollapsed ? RAIL_COLLAPSED_W : layoutState.railW;
    root.style.setProperty("--rail-w", `${railW}px`);
    root.style.setProperty("--result-w", `${layoutState.resultW}px`);
    root.classList.toggle("rail-collapsed", layoutState.railCollapsed);
    root.classList.toggle("filters-compact", layoutState.filtersCompact);
    state.railCollapsed = layoutState.railCollapsed;
    state.filtersCompact = layoutState.filtersCompact;
    if (el.btnRailCollapse) {
      el.btnRailCollapse.setAttribute("aria-pressed", layoutState.railCollapsed ? "true" : "false");
      el.btnRailCollapse.textContent = layoutState.railCollapsed ? "›" : "‹";
      el.btnRailCollapse.setAttribute("aria-label", layoutState.railCollapsed ? "展开任务栏" : "收起任务栏");
      el.btnRailCollapse.title = layoutState.railCollapsed ? "展开任务栏 · Ctrl+B" : "收起任务栏 · Ctrl+B";
    }
    if (el.btnFilterCompact) {
      el.btnFilterCompact.setAttribute("aria-pressed", layoutState.filtersCompact ? "true" : "false");
      el.btnFilterCompact.textContent = layoutState.filtersCompact ? "展开筛选" : "收起筛选";
    }
    if (el.gutterRail) {
      el.gutterRail.setAttribute("aria-hidden", layoutState.railCollapsed ? "true" : "false");
    }
  }

  function setRailCollapsed(collapsed) {
    layoutState.railCollapsed = Boolean(collapsed);
    applyStudioLayout();
    persistStudioLayout();
  }

  function setFiltersCompact(compact) {
    layoutState.filtersCompact = Boolean(compact);
    applyStudioLayout();
    persistStudioLayout();
  }

  function bindLayoutPanes() {
    const root = el.appRoot;
    if (!root) return;
    Object.assign(layoutState, readLayout());
    applyStudioLayout();

    const startDrag = (gutter, key) => {
      if (!gutter) return;
      gutter.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (key === "railW" && layoutState.railCollapsed) {
          setRailCollapsed(false);
          return;
        }
        e.preventDefault();
        gutter.setPointerCapture(e.pointerId);
        gutter.classList.add("is-dragging");
        document.body.classList.add("is-resizing");
        const startX = e.clientX;
        const start = layoutState[key];
        let frame = 0;
        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const next =
            key === "railW"
              ? clamp(start + dx, 200, 360)
              : clamp(start - dx, 400, Math.max(420, window.innerWidth - 640));
          layoutState[key] = next;
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            applyStudioLayout();
          });
        };
        const stop = () => {
          gutter.classList.remove("is-dragging");
          document.body.classList.remove("is-resizing");
          gutter.removeEventListener("pointermove", onMove);
          persistStudioLayout();
        };
        gutter.addEventListener("pointermove", onMove);
        gutter.addEventListener("pointerup", stop, { once: true });
        gutter.addEventListener("pointercancel", stop, { once: true });
      });
      gutter.addEventListener("dblclick", () => {
        const d = defaultLayout();
        layoutState[key] = d[key];
        if (key === "railW") layoutState.railCollapsed = false;
        applyStudioLayout();
        persistStudioLayout();
      });
      gutter.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        if (key === "railW" && layoutState.railCollapsed) setRailCollapsed(false);
        const step = e.shiftKey ? 28 : 10;
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const signed = key === "resultW" ? -dir : dir;
        layoutState[key] =
          key === "railW"
            ? clamp(layoutState[key] + signed * step, 200, 360)
            : clamp(layoutState[key] + signed * step, 400, Math.max(420, window.innerWidth - 640));
        applyStudioLayout();
        persistStudioLayout();
      });
    };

    startDrag(el.gutterRail, "railW");
    startDrag(el.gutterResult, "resultW");
  }

  function briefInput() {
    const r = currentResearch();
    return { ...(state.bundle?.l1?.input || {}), ...(r && r.brief ? r.brief : {}) };
  }

  function missingBriefSlots() {
    const input = briefInput();
    return BRIEF_SLOTS.filter((slot) => {
      const v = input[slot.key];
      if (Array.isArray(v)) return !v.length;
      return !String(v || "").trim();
    });
  }

  function absorbBriefAnswer(text) {
    const r = currentResearch();
    if (!r) return null;
    const key = state.briefAskKey || (missingBriefSlots()[0] && missingBriefSlots()[0].key);
    if (!key) return null;
    const value = String(text || "").trim().slice(0, 80);
    if (!value) return null;
    r.brief = r.brief || {};
    r.brief[key] = value;
    if (r.custom && key === "product") r.title = `${value}竞品调研`;
    if (r.custom) persistCustomResearches();
    const l1 = state.bundle && state.bundle.l1 ? state.bundle.l1 : { input: {}, intent: {} };
    l1.input = { ...(l1.input || {}), [key]: value };
    if (state.bundle) state.bundle.l1 = l1;
    if (isBenyanResearch(r) && state.bundle) state.bundle.l4_cards = [];
    if (el.researchTitle && r.title) el.researchTitle.textContent = r.title;
    state.briefAskKey = "";
    return key;
  }

  function showBriefError(msg) {
    if (!el.briefError) return;
    if (!msg) {
      el.briefError.hidden = true;
      el.briefError.textContent = "";
      return;
    }
    el.briefError.hidden = false;
    el.briefError.textContent = msg;
  }

  function closeBriefDialog() {
    if (el.briefOverlay) el.briefOverlay.hidden = true;
  }

  function openBriefDialog() {
    const missing = missingBriefSlots();
    if (!missing.length) {
      state.briefAskKey = "";
      closeBriefDialog();
      return false;
    }
    state.briefAskKey = "";
    const input = briefInput();
    const showAll = missing.length === BRIEF_SLOTS.length;
    const slots = showAll ? BRIEF_SLOTS : missing;
    if (el.briefLead) {
      el.briefLead.textContent = showAll
        ? "一次收齐下面这些项。中栏不再一问一答。"
        : `还缺 ${missing.map((s) => s.label).join(" / ")}。缺哪问哪，填完就铺短名单。`;
    }
    if (el.briefFields) {
      el.briefFields.innerHTML = slots
        .map((slot) => {
          const val = String(input[slot.key] || "").trim();
          return `<div class="brief-field missing">
            <label for="brief-slot-${escapeAttr(slot.key)}">${escapeHtml(slot.label)}</label>
            <span class="brief-ask">${escapeHtml(slot.ask)}</span>
            <input id="brief-slot-${escapeAttr(slot.key)}" name="${escapeAttr(slot.key)}" data-brief-slot="${escapeAttr(
              slot.key
            )}" value="${escapeAttr(val)}" maxlength="80" required autocomplete="off" />
          </div>`;
        })
        .join("");
    }
    showBriefError("");
    if (el.briefOverlay) el.briefOverlay.hidden = false;
    const first = el.briefFields && el.briefFields.querySelector("input");
    if (first) first.focus();
    return true;
  }

  function revealAfterBriefReady() {
    const r = currentResearch();
    state.holdResults = false;
    if (isBenyanResearch(r) && state.bundle) state.bundle.l4_cards = [];
    ensureShortlist();
    const n = state.shortlistVisual.length;
    const gap = isBenyanResearch(r) ? benyanGapState() : null;
    appendRun({
      title: "Brief 已收齐",
      detail: gap ? (gap.formed ? `短名单 ${n} 款` : "短名单未成立") : n ? `短名单 ${n} 款` : "结论已开",
      html: `<p class="run-quiet">${
        gap
          ? gap.formed
            ? `采回袋面 ${gap.passedN} 款入选，待复核，不报产品过，不绑茶墙。`
            : `${benyanGapSentences(gap).join("")}不绑茶墙。`
          : n
            ? "短名单和结论已按已落地样本铺上。"
            : "这轮墙上还没有能进短名单的样本，结论只写缺口。"
      }中栏不再一问一答。</p>`,
    });
    openDecisionLayer("shortlist", { stamp: false });
    openDecisionLayer("report", { stamp: false });
  }

  async function commitBriefDialog() {
    const r = currentResearch();
    if (!r) return false;
    r.brief = r.brief || {};
    const root = el.briefFields;
    if (root) {
      root.querySelectorAll("[data-brief-slot]").forEach((node) => {
        const key = node.dataset.briefSlot;
        const value = String(node.value || "").trim().slice(0, 80);
        if (!key) return;
        if (value) r.brief[key] = value;
      });
    }
    if (r.custom && r.brief.product) r.title = `${r.brief.product}竞品调研`;
    if (r.custom) persistCustomResearches();
    state.bundle = emptyBundleFor(r);
    if (el.researchTitle && r.title) el.researchTitle.textContent = r.title;
    renderResearch();
    state.briefAskKey = "";
    if (missingBriefSlots().length) {
      openBriefDialog();
      showBriefError("还缺几项，补完再铺短名单。");
      return false;
    }
    if (r.custom && r.brief && r.brief.product) {
      await requestPackCollect(r.brief.product, { immediate: true });
      await loadBenyanResearchWall(r);
    }
    closeBriefDialog();
    revealAfterBriefReady();
    return true;
  }

  function saveBriefFillDialog() {
    return commitBriefDialog();
  }

  function bindBriefDialog() {
    if (!el.briefForm || el.briefForm.dataset.bound) return;
    el.briefForm.dataset.bound = "1";
    el.briefForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveBriefFillDialog();
    });
    if (el.briefClose) el.briefClose.addEventListener("click", closeBriefDialog);
    if (el.briefOverlay) {
      el.briefOverlay.addEventListener("click", (e) => {
        if (e.target === el.briefOverlay) closeBriefDialog();
      });
    }
  }

  function askNextBriefSlot() {
    return openBriefDialog();
  }

  function libraryLaneOf(it) {
    const src = String(it.source || "").toLowerCase();
    const volume = String((it.extra && it.extra.volume) || it.volume || "").toLowerCase();
    if (volume === "head" || volume === "头部") return "head";
    if (volume === "rising" || volume === "新锐") return "rising";
    if (wallRole(it) === "shelf" || /taobao|tmall|jd|douyin|tiktok/.test(src)) return "sold";
    if (/behance|pinterest|huaban|packagingoftheworld|dribbble|zcool/.test(src)) return "concept";
    return "";
  }

  function itemMatchesMarketStyle(it, styleId) {
    const style = (state.marketStyles || []).find((s) => s.id === styleId);
    if (!style) return true;
    const ids = new Set(style.bucket_ids || []);
    const names = new Set(
      (style.bucket_ids || []).map((id) => state.bucketIdToZh[id] || "").filter(Boolean)
    );
    if (names.has(it.bucket)) return true;
    return (it.suggested_style_buckets || []).some((id) => ids.has(id));
  }

  async function loadMarketStyles() {
    try {
      const res = await fetch("data/market-styles-v1.json");
      if (!res.ok) return;
      const doc = await res.json();
      state.marketStyles = doc.styles || [];
      renderMarketStyles();
    } catch (_) {}
  }

  function marketStyleCount(styleId) {
    const pool = state.onlyBriefRelevant
      ? (state.wallItems || []).filter((it) => scoreBriefRelevance(it) === "match")
      : state.wallItems || [];
    return pool.filter((it) => itemMatchesMarketStyle(it, styleId)).length;
  }

  function renderMarketStyles() {
    if (!el.marketStyles) return;
    const styles = state.marketStyles || [];
    if (!styles.length) {
      el.marketStyles.innerHTML = "";
      return;
    }
    el.marketStyles.innerHTML = `<span class="source-kicker">风格</span>${styles
      .map((s) => {
        const on = state.activeMarketStyle === s.id;
        const n = state.wallItems && state.wallItems.length ? marketStyleCount(s.id) : 0;
        return `<button type="button" class="mstyle-chip${on ? " active" : ""}${
          n ? "" : " is-empty"
        }" data-mstyle="${escapeAttr(s.id)}">${escapeHtml(s.name_zh)}${
          n ? ` · ${n}` : ""
        }</button>`;
      })
      .join("")}`;
  }

  function downloadReportNotes() {
    const panel = el.canvasBody && el.canvasBody.querySelector(".report-panel");
    const text = panel ? String(panel.innerText || "").replace(/\n{3,}/g, "\n\n").trim() : "";
    if (!text) {
      toast("报告还没出来");
      return;
    }
    const title = (currentResearch().title || "KEY视界报告").replace(/[\\/:*?"<>|]/g, "");
    const blob = new Blob([`KEY 视界 · ${title}\n\n${text}\n`], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title}-差异化报告.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("报告已下载，不是包装完稿");
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
    if (/benyan/.test(key)) return "本研";
    if (/^[a-z0-9_-]+$/i.test(raw)) {
      return raw.replace(/[-_]/g, " ").replace(/\b([a-z])/g, (m, ch) => ch.toUpperCase());
    }
    return raw.length > 24 ? raw.slice(0, 24) + "…" : raw;
  }

  /** Only the collected page_url. Never invent a gallery URL. */
  function pageUrlOf(it) {
    const u = String(it && it.page_url ? it.page_url : "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }

  function pageHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (_) {
      return "";
    }
  }

  function originAnchorHtml(it, opts) {
    const page = pageUrlOf(it);
    const o = opts || {};
    const cls = o.className || "src-link";
    const label = o.label || "原页";
    if (!page) return `<span class="src-missing">原页未标注</span>`;
    const host = pageHost(page);
    let text = label;
    if (o.showUrl) text = page;
    else if (o.showHost && host) text = `${label} · ${host}`;
    return `<a class="${escapeAttr(cls)}" data-wall-link href="${escapeAttr(
      page
    )}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(page)}">${escapeHtml(
      text
    )}</a>`;
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
  function isExpiredHuabanUrl(url) {
    return /gd-hbimg|hbimg\.huaban/i.test(url || "");
  }

  function isFragileImageHost(url) {
    if (!url) return true;
    return (
      isExpiredHuabanUrl(url) ||
      /xhscdn|sns-webpic|img\.zcool\.cn/i.test(url)
    );
  }

  function expiredHuabanCount(items) {
    return (items || state.wallItems || []).filter((it) => {
      if (it.pending || it.qc_status === "pending_review") return false;
      return isExpiredHuabanUrl(imgFor(it));
    }).length;
  }

  function imageGapNoteHtml() {
    const n = expiredHuabanCount();
    return n
      ? ` · <span class="muted">花瓣 ${n} 张图链过期，卡片仍留着</span>`
      : "";
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
          <div class="cap-name-row">
            <div class="cap-name">${escapeHtml(c.name)}</div>
            <button type="button" class="cap-gear${llmReady(c.id) ? " ready" : ""}" data-llm-agent="${c.id}" title="配置 ${escapeAttr(c.name)} 的 API" aria-label="配置 ${escapeAttr(c.name)} 的 API">${GEAR_SVG}</button>
          </div>
          <div class="cap-action">${escapeHtml(c.lastAction)}</div>
        </div>
      </li>`
      )
      .join("");
  }

  function renderResearch() {
    const q = String(state.railQuery || "").trim().toLowerCase();
    const list = RESEARCHES.filter((r) => !q || String(r.title || "").toLowerCase().includes(q));
    el.researchList.innerHTML = list.length
      ? list
          .map(
            (r) => `
      <li class="research-card ${r.active ? "active" : ""}" data-id="${r.id}" title="${escapeAttr(r.title)}">
        <span class="task-dot ${r.status === "running" ? "running" : "done"}" aria-hidden="true"></span>
        <div>
          <div class="rtitle">${escapeHtml(r.title)}</div>
          <div class="rmeta">
            <span>${escapeHtml(r.date)}</span>
            <span class="badge ${r.status}">${r.status === "running" ? "进行中" : "已完成"}</span>
          </div>
        </div>
      </li>`
          )
          .join("")
      : `<li class="research-empty">没有匹配的任务</li>`;
  }

  function renderSources() {
    const list = (state.sources.length
      ? state.sources
      : Object.entries(SOURCE_META).map(([id, m]) => ({
          id,
          label: m.label,
          status: "pending",
          statusText: "待加载",
          count: 0,
        }))
    ).filter((s) => (s.count || 0) > 0);
    if (!list.length) {
      el.sourceChips.innerHTML =
        `<span class="source-kicker">出处</span><span class="source-empty">墙还没有带来源的卡片</span>`;
      return;
    }
    const allBtn = `<button type="button" class="source-card ${
      state.activeSource ? "" : "active"
    }" data-source="all" title="看全部来源">全部</button><span class="source-split" aria-hidden="true"></span>`;
    el.sourceChips.innerHTML =
      `<span class="source-kicker">出处</span>` +
      allBtn +
      list
        .map((s) => {
          const short = (SOURCE_META[s.id] && SOURCE_META[s.id].short) || s.label;
          const tip = `${s.label} · ${s.statusText || s.count}`;
          return `
      <button type="button" class="source-card ${
        state.activeSource === s.id ? "active" : ""
      }" data-source="${s.id}" title="${escapeAttr(tip)}">
        <span class="sdot ${escapeAttr(s.status || "ok")}"></span>
        <span class="sc-name">${escapeHtml(short)}</span>
        <span class="sc-n">· ${s.count}</span>
      </button>`;
        })
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
      if (isBenyanResearch()) {
        el.wallCountBar.textContent = `本课题${benyanSubjectLabel(benyanBriefSpecies())} · 短名单未成立`;
        return;
      }
      el.wallCountBar.textContent = currentResearch().emptyWall ? "这轮还没有采集 · 墙是空的" : "墙还在长";
      return;
    }
    const shown = getFilteredWallItems().length;
    const filtered =
      Boolean(state.activeSource) ||
      (state.activeCat && state.activeCat !== "all") ||
      Boolean(state.activeStyleFilter) ||
      Boolean(state.activeMarketStyle) ||
      Boolean(state.activeLibLane);
    if (filtered) {
      el.wallCountBar.innerHTML = `这屏 ${shown} · 主墙 ${main}${
        state.includePending ? ` · 待复核 ${pending}` : ""
      }${imageGapNoteHtml()}`;
      return;
    }
    if (state.onlyBriefRelevant && !state.includePending) {
      el.wallCountBar.innerHTML = `先看和 brief 更贴的 · ${shown || main} 张${imageGapNoteHtml()}`;
      return;
    }
    if (state.includePending) {
      el.wallCountBar.innerHTML = `主墙 ${main} · 含待复核 · 这屏 ${shown} · <span class="muted">角色芯片仍按主墙计</span>${imageGapNoteHtml()}`;
      return;
    }
    el.wallCountBar.innerHTML = `主墙 ${main} · 这屏 ${shown}${imageGapNoteHtml()}`;
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
      .filter(([id]) => !pinnedIds.has(id) && (counts[id] || 0) > 0)
      .sort((a, b) => b[1] - a[1]);
    state.extraSourceIds = extras.map(([id]) => id);
    const extraCount = extras.reduce((n, [, c]) => n + c, 0);
    const other = extraCount
      ? [
          {
            id: "__other__",
            label: "其他",
            status: "ok",
            statusText: extras.map(([id, c]) => `${humanSource(id)} ${c}`).join(" · "),
            count: extraCount,
          },
        ]
      : [];
    state.sources = [...pinned, ...other];
    renderSources();
    renderRoleChips();
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
    const strategyMode = state.tab !== "visual";
    if (el.filters) {
      el.filters.classList.toggle("strategy-mode", strategyMode);
      el.filters.style.display = strategyMode ? "none" : "";
    }
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
    if (sourceSel) sourceSel.hidden = !isVisual;
    if (styleSel) styleSel.hidden = !isVisual;
    if (yearSel) yearSel.hidden = true;
    if (dirSel) dirSel.hidden = true;
    if (toneSel) toneSel.hidden = true;
    if (marketSel) marketSel.hidden = true;
    if (el.wallFilters) {
      el.wallFilters.style.display = isVisual ? "" : "none";
    }
    if (el.categoryChips) {
      el.categoryChips.style.display = isVisual ? "" : "none";
    }
    if (el.sourceChips) {
      el.sourceChips.style.display = isVisual ? "" : "none";
    }
    if (el.wallCountBar) {
      el.wallCountBar.style.display = isVisual ? "" : "none";
    }
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
    syncPhaseWhisper();
    syncRunStep(n);
  }

  function switchTab(tab, { fromStage = false, reveal = false } = {}) {
    if (tab === "strategy") tab = "report";
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateFilterRow();
    renderCanvas();
    if (reveal || !state.holdResults) setArtifactOpen(true);
    else syncResultChrome();
    syncPhaseWhisper();
    if (!fromStage) {
      const map = { intent: 1, visual: 3, shortlist: 4, report: 5, strategy: 5 };
      if (map[tab] && map[tab] !== state.stage) {
        state.stage = map[tab];
        syncStageButtons(state.stage);
      }
    }
  }

  function refuseDraftReveal(why) {
    if (!isDraftInterview()) return false;
    toast(why || "缺的 Brief 项在对话框里一次填。");
    openBriefDialog();
    return true;
  }

  function revealAndSwitch(tab, opts = {}) {
    if (!opts.force && refuseDraftReveal()) return false;
    state.holdResults = false;
    switchTab(tab, { ...opts, reveal: true });
    return true;
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
    if (Array.isArray(paths) && paths.length === 0) return "";
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
    return "";
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

  function isUnsafePack(j) {
    if (!j || typeof j !== "object") return true;
    const counts = (j.l3 && j.l3.counts) || {};
    if (counts.image_gate) return true;
    const cat = j.item_catalog;
    if (cat && typeof cat === "object" && Object.keys(cat).length > 50) return true;
    if ((j.meta && Number(j.meta.item_catalog_size)) > 50) return true;
    return false;
  }

  function sanitizeBundle(j) {
    const out = normalizeBundle(j);
    if (out.item_catalog) delete out.item_catalog;
    if (out.l3 && out.l3.counts && out.l3.counts.image_gate) delete out.l3.counts.image_gate;
    if (out.l3 && out.l3.walls && out.l3.walls.pending_review && Array.isArray(out.l3.walls.pending_review.items)) {
      out.l3.walls.pending_review.items = [];
    }
    return out;
  }

  async function loadProductBundle() {
    const paths = ["data/product-bundle.json", "data/product-pack.json"];
    let fallback = null;
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (!res.ok) continue;
        const raw = await res.json();
        if (isUnsafePack(raw)) continue;
        const j = sanitizeBundle(raw);
        if (j.l4_cards && j.l4_cards.length) return j;
        if (!fallback) fallback = j;
      } catch (err) {
        console.warn("bundle", p, err);
      }
    }
    if (fallback) return fallback;
    throw new Error("product pack missing");
  }

  async function loadPendingFeed(research) {
    const r = research || RESEARCHES.find((x) => x.id === state.activeResearchId) || RESEARCHES[0];
    if (!r || r.id !== "r-green") {
      state.pendingItems = [];
      state.feedCounts.pending = 0;
      return;
    }
    if (state.pendingItems.length) return;
    const pendingPaths = (r.feeds && r.feeds.pending) || [
      "data/l2_pending_review.jsonl",
      "data/l2-pending-review.jsonl",
      "data/l2_pending_review_20260812.jsonl",
    ];
    const pendingRes = await fetchFirstOk(pendingPaths);
    const pendingRaw = pendingRes && pendingRes.ok ? parseJsonl(await pendingRes.text()) : [];
    state.pendingItems = pendingRaw.map((row) => normalizeFeedItem(row, "pending_review"));
    state.feedCounts.pending = pendingRaw.length;
    if (state.bundle?.l3?.counts) {
      state.bundle.l3.counts.pending_review = pendingRaw.length;
    }
  }

  async function loadLiveFeeds(research) {
    const r = research || RESEARCHES.find((x) => x.id === state.activeResearchId) || RESEARCHES[0];
    if (isBenyanResearch(r)) {
      await loadBenyanResearchWall(r);
      return;
    }
    const emptyWall = Boolean(r.emptyWall) || (r.feeds && Array.isArray(r.feeds.main) && r.feeds.main.length === 0);
    if (emptyWall) {
      state.wallItems = [];
      state.pendingItems = [];
      state.feedCounts = { main: 0, pending: 0 };
      state.preferredBuckets = [];
      state.wallVisibleLimit = WALL_BATCH_INITIAL;
      rebuildSourcesFromWall();
      updateWallCountBar();
      setCap("crawler", "idle", "这轮还没有采集，墙是空的");
      setCap("dotdot", "idle", "没有样本可打标");
      if (!userArmedPending) forceProductWallDefaults("after-empty-feeds");
      return;
    }
    const [mainText, bucketsRes] = await Promise.all([
      loadMainWallText(r.feeds && r.feeds.main),
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
    if (r.id === "r-green" && !mainRaw.length) throw new Error("main wall missing");
    state.wallItems = mainRaw
      .map((row) => normalizeFeedItem(row, "main_wall"))
      .filter((it) => imgFor(it) || it.page_url || it.id);
    if (!state.wallItems.length && mainRaw.length) {
      state.wallItems = mainRaw.map((row) => normalizeFeedItem(row, "main_wall"));
    }
    state.wallItems = demoteFragileWallOrder(state.wallItems);
    renderMarketStyles();
    state.pendingItems = [];
    const knownPend =
      r.id === "r-green"
        ? Number((state.bundle && state.bundle.l3 && state.bundle.l3.counts && state.bundle.l3.counts.pending_review) || 2680)
        : 0;
    state.feedCounts = {
      main: mainRaw.length,
      pending: knownPend,
    };
    if (state.includePending && r.id === "r-green") {
      await loadPendingFeed(r);
    }
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
    const lanesNow = scopeCounts();
    setCap(
      "crawler",
      "idle",
      `同类 ${lanesNow.same} · 不同类 ${lanesNow.adjacent} · 跨界 ${lanesNow.cross} · 货架 ${lanesNow.shelf}`
    );
    setCap("dotdot", "idle", `主墙已经铺好，等你点选`);
    if (!userArmedPending) forceProductWallDefaults("after-feeds");
  }


  /** Mirror L3/brief_relevance_v1.py → 'match' | 'low' | 'off' (pass_brief / low / offtopic). */
  function scoreBriefRelevance(item) {
    if (!item) return "off";
    if (item.extra && item.extra.collect_method === "api_pack_collect") {
      if (isKnownLongDetailImage(imgFor(item))) return "off";
      if (!passesBagFrontQc(item)) return "off";
      return "match";
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

    if (isBenyanResearch()) {
      if (isKnownLongDetailImage(imgFor(item))) return "off";
      const want = benyanBriefSpecies();
      const got = benyanItemSpecies(item);
      if (!want || !got || want !== got) return "off";
      if (!passesBagFrontQc(item)) return "off";
      if (isPendingReview(item)) return "low";
      return "match";
    }

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

  const LANE_LEX = {
    tea: /茶|tea|matcha|绿茶|青茶|红茶|白茶|乌龙|普洱|龙井|茉莉|花茶|茶叶/i,
    liquor: /白酒|黄酒|酒礼|葡萄酒|wine|sake|baijiu|huangjiu|红酒|洋酒|beer|啤酒|mezcal|威士忌|白酒礼/i,
    tonic: /滋补|阿胶|人参|膏方|保健礼|tonic|herbal\s*gift|养生/i,
    pastry: /糕点|月饼|巧克力|chocolate|饼干|bakery|点心礼/i,
    coffee: /咖啡|coffee|latte|espresso/i,
    pet: /宠物|猫粮|狗粮|宠物粮|pet\s*food|orijen|渴望|royal\s*canin|皇家/i,
    cultural: /文创|博物馆|特产礼/i,
    cross: /香氛|香水|perfume|fragrance|美妆|护肤|cosmetic|skincare|潮玩|家居|服饰|球鞋|艺术衍生|高端水|mineral\s*water|国潮美妆/i,
  };

  function itemLaneBlob(it) {
    return [
      it.title,
      it.query_used,
      it.category_label,
      Array.isArray(it.raw_tags) ? it.raw_tags.join(" ") : "",
      it.author_or_brand,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function briefLaneLex() {
    const input = state.bundle?.l1?.input || {};
    const intent = state.bundle?.l1?.intent || {};
    const blob = [input.product, input.category_text, intent.domain_label_zh, currentResearch().title, currentResearch().question]
      .filter(Boolean)
      .join(" ");
    if (LANE_LEX.liquor.test(blob) && !LANE_LEX.tea.test(blob)) {
      return {
        same: LANE_LEX.liquor,
        adjacent: new RegExp(
          `${LANE_LEX.tea.source}|${LANE_LEX.tonic.source}|${LANE_LEX.pastry.source}|${LANE_LEX.coffee.source}`,
          "i"
        ),
      };
    }
    if (LANE_LEX.tonic.test(blob) && !LANE_LEX.tea.test(blob)) {
      return {
        same: LANE_LEX.tonic,
        adjacent: new RegExp(`${LANE_LEX.tea.source}|${LANE_LEX.liquor.source}|${LANE_LEX.pastry.source}`, "i"),
      };
    }
    if (LANE_LEX.pet.test(blob) && !LANE_LEX.tea.test(blob)) {
      return {
        same: LANE_LEX.pet,
        adjacent: new RegExp(`${LANE_LEX.tea.source}|${LANE_LEX.liquor.source}|${LANE_LEX.tonic.source}`, "i"),
      };
    }
    return {
      same: LANE_LEX.tea,
      adjacent: new RegExp(
        `${LANE_LEX.liquor.source}|${LANE_LEX.tonic.source}|${LANE_LEX.pastry.source}|${LANE_LEX.coffee.source}|${LANE_LEX.cultural.source}`,
        "i"
      ),
    };
  }

  function searchScope(it) {
    if (!it) return "same";
    if (String(it.source_type || "").toLowerCase() === "shelf") return "shelf";
    const blob = itemLaneBlob(it);
    const lex = briefLaneLex();
    if (LANE_LEX.cross.test(blob) && !lex.same.test(blob)) return "cross";
    if (lex.adjacent.test(blob) && !lex.same.test(blob)) return "adjacent";
    const rel = it.extra && it.extra.brief_relevance_v1;
    if ((it.analogy_from || rel === "keep_analogy") && !lex.same.test(blob)) return "adjacent";
    return "same";
  }

  function wallRole(it) {
    const s = searchScope(it);
    if (s === "shelf") return "shelf";
    if (s === "adjacent") return "analogy";
    if (s === "cross") return "cross";
    return "primary";
  }

  function renderRoleChips() {
    if (!el.categoryChips) return;
    const n = { primary: 0, analogy: 0, shelf: 0, cross: 0 };
    state.wallItems.forEach((it) => {
      const scope = searchScope(it);
      if (scope === "cross") n.cross += 1;
      else n[wallRole(it)] = (n[wallRole(it)] || 0) + 1;
    });
    const labels = {
      primary: `同类 · ${n.primary}`,
      analogy: `不同类 · ${n.analogy}`,
      cross: `跨界 · ${n.cross || 0}`,
      shelf: `货架 · ${n.shelf}`,
    };
    el.categoryChips.querySelectorAll(".cat-chip[data-cat]").forEach((chip) => {
      const cat = chip.dataset.cat;
      if (labels[cat]) chip.textContent = labels[cat];
    });
  }

  function isAnalogyItem(it) {
    return wallRole(it) === "analogy";
  }

  function briefRelLabel(item) {
    const pre = item?.extra?.brief_relevance_v1;
    const s = scoreBriefRelevance(item);
    if (pre === "keep_analogy" || (s === "match" && pre === "keep_analogy")) return "贴合（类比）";
    if (s === "match") return "贴合";
    if (s === "low") return "弱相关";
    return "跑题/低相关";
  }

  const SCOPE_ZH = { same: "同类", adjacent: "不同类", cross: "跨界", shelf: "货架" };

  function scopeLabel(it) {
    return SCOPE_ZH[searchScope(it)] || "同类";
  }

  /** 三路 + 货架的真实计数，全部来自已落地主墙，不做补数。 */
  function scopeCounts() {
    const n = { same: 0, adjacent: 0, cross: 0, shelf: 0 };
    state.wallItems.forEach((it) => {
      const s = searchScope(it);
      if (n[s] != null) n[s] += 1;
    });
    return n;
  }

  async function loadClassifyDims() {
    if (state.dims) return state.dims;
    try {
      const res = await fetch("data/classify-dimensions-v1.json");
      if (res.ok) state.dims = await res.json();
    } catch (err) {
      console.warn("classify dims", err);
    }
    return state.dims;
  }

  /** 取维度字段的真实值；一律不编造，取不到就是 null。 */
  function dimValue(item, fields) {
    for (const f of fields || []) {
      let v = item ? item[f] : null;
      if (v == null && item && item.extra) v = item.extra[f];
      if (Array.isArray(v)) {
        const list = v.filter((x) => x != null && String(x).trim());
        if (list.length) return list.map((x) => String(x)).join(" / ");
        continue;
      }
      if (typeof v === "string" && v.trim() && v.trim() !== "unknown") return v.trim();
      if (typeof v === "number") return String(v);
    }
    return null;
  }

  /** 维度取值；货架表现力只认真在售的样本，别让 source_type=inspiration 冒充已覆盖。 */
  function dimValueZh(item, dim) {
    if (dim.id === "shelf_impact") {
      if (String(item.source_type || "").toLowerCase() !== "shelf") return null;
      const region = Array.isArray(item.market_region) ? item.market_region.join(" / ") : "";
      return `在售 listing 样${region ? ` · ${region}` : ""}`;
    }
    const raw = dimValue(item, dim.fields);
    if (!raw) return null;
    if (dim.id === "style_bucket") {
      return raw
        .split(" / ")
        .map((id) => state.bucketIdToZh?.[id] || state.bundle?.bucket_id_to_zh?.[id] || id)
        .join(" / ");
    }
    return raw;
  }

  /** L5 第 3 段：每个维度在主墙上到底标了多少条。 */
  function coverageStats() {
    const groups = (state.dims && state.dims.groups) || [];
    const total = state.wallItems.length;
    return groups.map((g) => ({
      id: g.id,
      name: g.name_zh,
      dims: (g.dimensions || []).map((d) => ({
        id: d.id,
        name: d.name_zh,
        notCollected: d.collect_status === "not_collected",
        labeled: state.wallItems.reduce((acc, it) => acc + (dimValueZh(it, d) ? 1 : 0), 0),
        total,
      })),
    }));
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
      items = items.filter((it) => wallRole(it) === "primary" && searchScope(it) !== "cross");
    } else if (state.activeCat === "analogy") {
      items = items.filter((it) => searchScope(it) === "adjacent");
    } else if (state.activeCat === "cross") {
      items = items.filter((it) => searchScope(it) === "cross");
    } else if (state.activeCat === "shelf" || state.activeCat === "pack") {
      items = items.filter((it) => wallRole(it) === "shelf");
    } else if (state.activeCat === "case") {
      items = items.filter((it) => wallRole(it) === "primary");
    }
    if (state.activeSource === "__other__") {
      const extra = new Set(state.extraSourceIds || []);
      items = items.filter((it) => extra.has(String(it.source || "").toLowerCase()));
    } else if (state.activeSource) {
      items = items.filter(
        (it) =>
          String(it.source || "").toLowerCase() ===
          String(state.activeSource).toLowerCase()
      );
    }
    if (state.activeStyleFilter) {
      items = items.filter((it) => it.bucket === state.activeStyleFilter);
    }
    if (state.activeLibLane) {
      items = items.filter((it) => libraryLaneOf(it) === state.activeLibLane);
    }
    if (state.activeMarketStyle) {
      items = items.filter((it) => itemMatchesMarketStyle(it, state.activeMarketStyle));
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
    const page = pageUrlOf(it);
    const host = pageHost(page);
    const img = imgFor(it);
    const briefScore = scoreBriefRelevance(it);
    return `
          <article class="wall-card ${sel ? "selected" : ""} ${
            weak
              ? "qc-pending pending-review pending brief-weak"
              : "qc-pass"
          }" data-id="${escapeAttr(it.id)}" data-qc="${escapeAttr(
      it.qc_status || "pass_main"
    )}" data-brief="${escapeAttr(briefScore)}" title="${escapeAttr(page || "原页未标注")}">
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
            )}" alt="${escapeAttr(it.title || "")}" onerror="this.onerror=null;this.classList.add('img-broken');const c=this.closest('.wall-card');if(c){c.classList.add('img-broken-card');}" /><div class="thumb-fallback" aria-hidden="true">图链失效</div></div>
            <div class="meta">
              <div class="title">${escapeHtml(humanTitle(it.title || it.id))}</div>
              <div class="src">
                <span class="src-name">${escapeHtml(srcLine)}${
                  host ? ` · ${escapeHtml(host)}` : ""
                }</span>
                ${originAnchorHtml(it)}
              </div>
            </div>
            ${
              (it.suggested_style_buckets || []).length
                ? `<div class="card-tags">${(it.suggested_style_buckets || [])
                    .slice(0, 2)
                    .map((id) => `<span class="card-tag">${escapeHtml(state.bucketIdToZh[id] || id)}</span>`)
                    .join("")}</div>`
                : ""
            }
            <div class="card-foot">
              <span class="card-score">荐 ${pickScore(it)}</span>
              <span class="card-verify ${page ? "ok" : "miss"}">${page ? "原页已核" : "原页未标注"}</span>
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

  /** 只回 Brief 里真写过的红线，没有就 null；不替设计师编评语。 */
  function briefRelation() {
    const input = state.bundle?.l1?.input || {};
    const avoid = (input.must_avoid || []).filter(Boolean);
    return { avoid: avoid.length ? avoid.join(" / ") : null };
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

  function setScopeFromItem(item) {
    if (!item) return;
    state.scopeRef = {
      id: item.id,
      title: humanTitle(item.title || item.id),
      lane: scopeLabel(item),
      brief: briefRelLabel(item),
      page: pageUrlOf(item) || "",
    };
    renderScopeChips();
  }

  function clearScope() {
    state.scopeRef = null;
    renderScopeChips();
  }

  function renderScopeChips() {
    if (!el.scopeChips) return;
    const ref = state.scopeRef;
    if (!ref) {
      el.scopeChips.hidden = true;
      el.scopeChips.innerHTML = "";
      return;
    }
    el.scopeChips.hidden = false;
    el.scopeChips.innerHTML = `<span class="scope-chip" data-scope-id="${escapeAttr(ref.id)}"><b>这张图 · ${escapeHtml(
      ref.title
    )}</b><button type="button" data-clear-scope aria-label="去掉对照">×</button></span>`;
  }

  function openInspector(item) {
    state.focusId = item.id;
    setScopeFromItem(item);
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
    const page = pageUrlOf(item);
    const host = pageHost(page);
    const groups = (state.dims && state.dims.groups) || [];
    const groupIco = { visual_style: "◎", experience: "◇", commerce: "¥" };
    const dimBlocks = groups
      .map((g) => {
        const pin = { color: 0, graphic_type: 1 };
        const rows = (g.dimensions || [])
          .slice()
          .sort((a, b) => (pin[a.id] ?? 10) - (pin[b.id] ?? 10))
          .map((d) => {
            const v = dimValueZh(item, d);
            if (v) {
              return `<li><span class="dim-k">${escapeHtml(d.name_zh)}</span><span class="dim-v">${escapeHtml(
                v
              )}</span></li>`;
            }
            const why = d.collect_status === "not_collected" ? "未标注 · 本轮未采集" : "未标注";
            return `<li class="dim-empty"><span class="dim-k">${escapeHtml(
              d.name_zh
            )}</span><span class="dim-v">${escapeHtml(why)}</span></li>`;
          })
          .join("");
        return `<div class="insp-block dims">
          <h4><span class="ico">${groupIco[g.id] || "·"}</span>${escapeHtml(g.name_zh)}</h4>
          <ul class="dim-list">${rows}</ul>
        </div>`;
      })
      .join("");
    el.inspectorBody.innerHTML = `
      <div class="inspector-preview"><img referrerpolicy="no-referrer" src="${escapeAttr(imgFor(item))}" alt="" onerror="this.onerror=null;this.classList.add('img-broken');const f=this.nextElementSibling;if(f)f.hidden=false;" /><div class="thumb-fallback inspector-fallback" hidden>图链失效</div></div>
      <div class="inspector-title">${escapeHtml(humanTitle(item.title || item.id))}</div>
      <div class="why-quad" id="whyQuad">
        <div><span>贴合</span><strong>${escapeHtml(briefRelLabel(item))}</strong></div>
        <div><span>路线</span><strong>${escapeHtml(scopeLabel(item))}</strong></div>
        <div><span>可落地</span><strong>荐 ${pickScore(item)} · 字段覆盖</strong></div>
        <div><span>证据</span><strong>${page ? "原页已核" : "原页未标注"}</strong></div>
      </div>
      <div class="inspector-origin">
        <div class="inspector-src">${escapeHtml(humanSource(item.source) || "来源待核实")}${
          item.author_or_brand ? " · " + escapeHtml(item.author_or_brand) : ""
        }${host ? " · " + escapeHtml(host) : ""}</div>
        <div class="insp-origin-actions">
          ${originAnchorHtml(item, { className: "insp-open", label: "打开原页" })}
          ${
            page
              ? `<button type="button" class="insp-copy-url" data-copy-url="${escapeAttr(
                  page
                )}">复制链接</button>`
              : ""
          }
        </div>
        <div class="insp-url-box">
          <div class="insp-url-label">原始页面地址</div>
          ${
            page
              ? `<span class="insp-url">${escapeHtml(page)}</span>`
              : `<p class="src-missing">原页未标注 — 没有可核对的链接，提案里先别引用。</p>`
          }
        </div>
      </div>
      <p class="insp-summary">${escapeHtml(
        `口径：${scopeLabel(item)} · ${briefRelLabel(item)}${
          bucketZh.length ? ` · 风格桶 ${bucketZh[0]}` : " · 风格桶未标注"
        }。色彩和排版有值才写；没标就「未标注」，不替你判字体或色板。`
      )}</p>
      <div class="insp-block match">
        <h4><span class="ico">✓</span>对 Brief 这条</h4>
        <ul>
          <li>判定：${escapeHtml(briefRelLabel(item))}${
            item.extra && item.extra.brief_relevance_v1
              ? `（${escapeHtml(item.extra.brief_relevance_v1)}）`
              : ""
          }</li>
          <li>路线：${escapeHtml(scopeLabel(item))}${
            searchScope(item) === "shelf" ? "（在售 listing 样）" : ""
          }</li>
          <li>红线提醒：${escapeHtml(rel.avoid || "未标注")}</li>
        </ul>
      </div>
      ${dimBlocks}
      <div class="insp-block collect">
        <h4><span class="ico">#</span>采集字段</h4>
        <ul>
          <li>来源：${escapeHtml(humanSource(item.source) || "未标注")} · ${escapeHtml(item.source_type || "未标注")}</li>
          <li>贴 brief：${escapeHtml(briefRelLabel(item))}${
            item.extra && item.extra.brief_relevance_v1
              ? `（${escapeHtml(item.extra.brief_relevance_v1)}）`
              : ""
          }</li>
          <li>风格桶：${escapeHtml(bucketZh.join(" / ") || "未标注")}</li>
          <li>结构：${escapeHtml(struct.length ? struct.slice(0, 4).join(" / ") : "未标注")}</li>
          <li>检索：${escapeHtml(item.query_used ? String(item.query_used).slice(0, 80) : "未标注")}</li>
        </ul>
      </div>
      <div class="insp-block">
        <h4><span class="ico">📎</span>这条的来历</h4>
        <div class="evidence-tags">
          <span>${escapeHtml(state.bundle?.l1?.brief_id || "本轮 Brief")}</span>
          <span>${escapeHtml(
            item.extra && item.extra.research_seat === "benyan"
              ? isPendingReview(item)
                ? "本研待复核"
                : "本研调研"
              : item.wall_status === "pending_review"
                ? "待复核 2680"
                : "主墙 452"
          )}</span>
          <span>${escapeHtml(item.collected_at ? String(item.collected_at).slice(0, 10) : "采集时间未标注")}</span>
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
    clearScope();
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
    if (isBenyanResearch() && !getFilteredWallItems().length) {
      const gap = benyanGapState();
      return `<div class="empty"><div class="slogan">短名单未成立</div>
        <p class="hint">${escapeHtml(benyanGapSentences(gap).join(""))}墙上只挂本课题库内袋面，有几挂几，不绑茶墙。</p>
        <button type="button" class="empty-cta" data-empty-action="open-intent">回 Brief 看课题</button></div>`;
    }
    if (!isBenyanResearch() && currentResearch().emptyWall && !state.wallItems.length) {
      return `<div class="empty"><div class="slogan">这轮墙是空的</div>
        <p class="hint">新建研究不会从青绿茶那轮抄 452 张过来。先在 Brief 钉死卖给谁；采集通道开通前，这里就是空的。</p>
        <button type="button" class="empty-cta" data-empty-action="open-intent">去填 Brief</button></div>`;
    }
    if (!state.bundle && !state.wallItems.length) {
      return `<div class="empty"><div class="slogan">墙还在长</div><p class="hint">正在把和 brief 更贴的参考搬上来…</p><button type="button" class="empty-cta" data-empty-action="open-intent">先看这次要搞清的事</button></div>`;
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
      if (state.activeLibLane === "head" || state.activeLibLane === "rising") {
        const zh = state.activeLibLane === "head" ? "头部体量" : "新锐增速";
        return `<div class="empty"><div class="slogan">本轮库未标「${escapeHtml(zh)}」</div>
        <p class="hint">自有库还没有体量/增速字段，这里不按品牌名猜谁是头部、谁是新锐。等入库时标上 volume，再回来筛。</p>
        <button type="button" class="empty-cta" data-empty-action="show-all">看看全部参考</button></div>`;
      }
      if (state.activeCat === "cross") {
        return `<div class="empty"><div class="slogan">本轮跨界样本 0，不编造</div>
        <p class="hint">Brief 的类比计划里写了香氛、国潮美妆这类跨界目标，但这一轮一张都没采到，所以这里就是空的。<br>缺口已经写进 L5 报告的「风险与下一步」，等开跨界采集再回来看。</p>
        <button type="button" class="empty-cta" data-empty-action="open-report">看缺口写在哪</button></div>`;
      }
      if (state.activeCat === "analogy" || state.activeCat === "shelf") {
        const zh = state.activeCat === "analogy" ? "不同类" : "货架";
        return `<div class="empty"><div class="slogan">这一路现在没有样本</div>
        <p class="hint">${escapeHtml(zh)}这路在本轮很薄，换个筛选条件（来源 / 风格 / 只看贴 brief）可能就有了。</p>
        <button type="button" class="empty-cta" data-empty-action="show-all">看看全部参考</button></div>`;
      }
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
      <span class="wall-summary-gap">花瓣 ${expiredHuabanCount()} 张图链已过期，卡片仍留着可点开看字段；其它源按加载结果，打不开的标「图链失效」</span>
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
      const showBucket = visOrder.length > 1;
      html += `${
        showBucket
          ? `<div class="bucket-label">${escapeHtml(name)} · ${totalInBucket}</div>`
          : ""
      }
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
    // Prefer live wall/montage https so public hosts work without multi-MB local assets.
    for (const m of c.reference_montage || []) {
      if (m.image_url && /^https:/i.test(m.image_url)) return m.image_url;
      const it = findWallItem(m.item_id);
      const u = it && imgFor(it);
      if (u && /^https:/i.test(u)) return u;
    }
    const local = c.cover_image || c.local_ref_image || "";
    if (local && /^https:/i.test(local)) return local;
    if (local && !/^https?:/i.test(local)) return local;
    return "";
  }

  function renderStrategy() {
    const cards = state.bundle?.l4_cards || [];
    if (!cards.length) {
      return `<p class="muted">这轮还没有方向卡。青绿茶礼盒那轮有三张。</p>`;
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

  function currentResearch() {
    return RESEARCHES.find((x) => x.id === state.activeResearchId) || RESEARCHES[0];
  }

  function splitTags(v) {
    return String(v || "")
      .split(/[、,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function researchContextText() {
    const r = currentResearch();
    const input = state.bundle?.l1?.input || {};
    const lanes = scopeCounts();
    return [
      `研究：${r.title}`,
      `问题：${r.question || (el.researchQuestion && el.researchQuestion.value) || ""}`,
      `产品：${input.product || "未标注"}；客群：${input.audience || "未标注"}；渠道：${input.channel || "渠道未标注"}；场合：${input.occasion || "未标注"}；气质：${input.culture_tone || "未标注"}`,
      `必须有：${(input.must_have || []).join("、") || "未标注"}；必须避开：${(input.must_avoid || []).join("、") || "未标注"}`,
      `主墙 ${state.feedCounts.main} 张；待复核 ${state.feedCounts.pending}`,
      `按 Brief 动态分路：同类 ${lanes.same} · 不同类 ${lanes.adjacent} · 跨界 ${lanes.cross} · 货架 ${lanes.shelf}（货架是在售切片，不是第四品类）`,
      isBenyanResearch()
        ? benyanShortlistFormed()
          ? `短名单 ${state.shortlistVisual.length} 款；按采回袋面入选，待复核，不报产品过`
          : benyanGapSentences().join(" ")
        : `短名单 ${state.shortlistVisual.length} 款；方向卡 ${(state.bundle?.l4_cards || []).length} 张`,
      isBenyanResearch()
        ? "铁律：短名单只认 api_pack_collect；英文标题也过；短名单未成立只报缺口；不绑茶墙。"
        : "铁律：不编造没采到的跨界/用户评论/开箱/成本；缺就写缺；不发起新采集。",
    ].join("\n");
  }

  function agentSystemPrompt(id) {
    const meta = AGENT_LLM_META.find((m) => m.id === id) || AGENT_LLM_META[0];
    const extra = {
      orchestrator:
        "你是奎燕设计智能体，KEY 视界的编排者。用中文、短句、像内部工作台同事。可以调度采集做分路、点点做打标/重筛，但本版不能真的去网上爬。先回答用户，必要时指出该点哪个页签。",
      crawler:
        "你是采集。只根据已落地主墙和 Brief 谈同类/不同类/跨界/货架。货架=在售切片。禁止声称已经连上淘宝深采或编造样本。",
      dotdot:
        "你是点点。按视觉/体验/商业三组说话。没采到的维度写未标注。批注重筛只在已落地墙上重排。",
    };
    return `${extra[id] || extra.orchestrator}\n职责：${meta.job}\n\n当前研究上下文：\n${researchContextText()}`;
  }

  async function probeLlmProxy() {
    try {
      const res = await fetch("/api/llm/health", { cache: "no-store" });
      const j = res.ok ? await res.json() : null;
      state.proxyOk = Boolean(j && j.ok);
    } catch (_) {
      state.proxyOk = false;
    }
    if (el.llmProxyHint) {
      el.llmProxyHint.className = "llm-proxy " + (state.proxyOk ? "ok" : "warn");
      el.llmProxyHint.textContent = state.proxyOk
        ? "本机转发已接通。Key 只随这次请求送到对应模型，不会落盘。"
        : "没找到本机转发（/api/llm/health）。静态托管会因浏览器跨域失败；请用 scripts/key_vision_server.py 打开本页。";
    }
    return state.proxyOk;
  }

  function humanizeLlmError(raw) {
    const text = String(raw || "");
    const low = text.toLowerCase();
    if (/no_llm/.test(low)) return "还没填 API Key。";
    if (/401|authentication|invalid.*api key|unauthorized/.test(low)) {
      return "DeepSeek 说这把 Key 无效。请完整复制 sk- 开头的密钥，不要带空格或引号。";
    }
    if (/402|insufficient|balance|quota|arrearage/.test(low)) {
      return "DeepSeek 余额不足，请先到 platform.deepseek.com 充值。";
    }
    if (/429|rate limit/.test(low)) return "DeepSeek 限流，稍等再试。";
    if (/failed to fetch|network|timeout|timed out|name or service/.test(low)) {
      return "连不上模型接口。确认本页转发已接通。";
    }
    return text.replace(/\s+/g, " ").slice(0, 180);
  }

  function showLlmError(msg) {
    if (!el.llmError) return;
    const text = String(msg || "").trim();
    el.llmError.hidden = !text;
    el.llmError.textContent = text;
  }

  async function callLlm(agentId, messages, { json: wantJson } = {}) {
    const cfg = llmConfigFor(agentId);
    if (!cfg || !cfg.apiKey || !cfg.model) {
      const err = new Error("NO_LLM");
      err.code = "NO_LLM";
      err.agent = agentId;
      throw err;
    }
    const payload = {
      agent: agentId,
      provider: cfg.provider,
      base_url: cfg.baseUrl,
      api_key: cfg.apiKey,
      model: cfg.model,
      messages,
    };
    const res = await fetch("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok || !data.ok) {
      throw new Error(humanizeLlmError(data.detail || data.error || `HTTP ${res.status}`));
    }
    const text = String(data.text || "").trim();
    if (wantJson) {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("模型没有返回 JSON");
      return JSON.parse(m[0]);
    }
    return text;
  }

  function renderLlmForm() {
    loadLlmAgents();
    const cfg = currentLlm();
    const providerOpts = Object.entries(LLM_PROVIDERS)
      .map(([id, p]) => `<option value="${id}">${escapeHtml(p.label)}</option>`)
      .join("");
    const keyHint = cfg.apiKey
      ? `已保存 ${escapeHtml(cfg.apiKey.slice(0, 3))}…${escapeHtml(cfg.apiKey.slice(-4))}，留空保存则不改`
      : "sk- 开头，只存在这台浏览器";
    el.llmAgentFields.innerHTML = `<section class="llm-agent active-edit" data-agent="orchestrator">
        <h3>奎燕设计智能体</h3>
        <p class="llm-job">整台视界只接这一套。对话、看墙、短名单和结论都走它。</p>
        <div class="llm-grid">
          <label>提供商</label>
          <select data-llm-field="provider">${providerOpts.replace(
            `value="${cfg.provider}"`,
            `value="${cfg.provider}" selected`
          )}</select>
          <label>接口地址</label>
          <input data-llm-field="baseUrl" value="${escapeAttr(cfg.baseUrl || "")}" placeholder="https://api.deepseek.com/v1" />
          <label>模型</label>
          <input data-llm-field="model" value="${escapeAttr(cfg.model || "")}" placeholder="deepseek-chat" />
          <label>API Key</label>
          <input data-llm-field="apiKey" type="password" autocomplete="off" placeholder="${keyHint}" value="" />
        </div>
        <p class="llm-key-state">${cfg.apiKey ? "密钥已保存在这台浏览器 · 刷新后仍在" : "还没填密钥"}</p>
      </section>`;
    showLlmError("");
    probeLlmProxy();
  }

  function readLlmForm() {
    const prev = currentLlm();
    const root = el.llmAgentFields;
    const get = (name) => {
      const node = root.querySelector(`[data-llm-field="${name}"]`);
      if (!node) return prev[name];
      return String(node.value || "").trim();
    };
    const provider = get("provider") || prev.provider;
    const cfg = {
      ...prev,
      id: "orchestrator",
      provider,
      baseUrl: normalizeLlmBase(provider, get("baseUrl") || prev.baseUrl),
      model: get("model") || prev.model,
      apiKey: cleanApiKey(get("apiKey")) || prev.apiKey || "",
    };
    state.llm = cfg;
    state.llmAgents = { orchestrator: cfg };
  }

  function openLlmSettings(agentId) {
    loadLlmAgents();
    if (agentId) state.llmFocus = agentId;
    renderLlmForm(state.llmFocus);
    if (el.llmOverlay) el.llmOverlay.hidden = false;
  }

  function closeLlmSettings() {
    if (el.llmOverlay) el.llmOverlay.hidden = true;
  }

  function bindLlmFormEvents() {
    if (!el.llmForm || el.llmForm.dataset.bound) return;
    el.llmForm.dataset.bound = "1";
    el.llmAgentFields.addEventListener("change", (e) => {
      const field = e.target.closest("[data-llm-field]");
      if (!field) return;
      readLlmForm();
      if (field.dataset.llmField !== "provider") return;
      const p = LLM_PROVIDERS[field.value];
      if (p) {
        if (p.baseUrl) state.llm.baseUrl = p.baseUrl;
        if (p.model) state.llm.model = p.model;
      }
      renderLlmForm();
    });
    el.llmForm.addEventListener("submit", (e) => {
      e.preventDefault();
      readLlmForm();
      persistLlmAgents();
      closeLlmSettings();
      toast(llmReady() ? "模型已保存在这台浏览器" : "还没填 API Key，先贴 sk- 再保存");
      appendEvent({
        agent: "系统",
        time: "现在",
        tag: llmReady() ? "模型已接上" : "模型未接",
        tagClass: llmReady() ? "consensus" : "challenge",
        dot: llmReady() ? "ok" : "warn",
        html: `<p>${llmReady() ? "这一套模型可以开始对话。" : "齿轮里把 API Key 贴完整再测一次。"}</p>`,
      });
    });
    if (el.llmTest) {
      el.llmTest.addEventListener("click", async () => {
        readLlmForm();
        persistLlmAgents();
        showLlmError("");
        el.llmTest.disabled = true;
        try {
          const text = await callLlm("orchestrator", [
            { role: "system", content: agentSystemPrompt("orchestrator") },
            { role: "user", content: "只回四个字：已接通。" },
          ]);
          toast(`已接通：${String(text).slice(0, 24)}`);
          showLlmError("");
        } catch (err) {
          const msg = humanizeLlmError(err.message || err);
          showLlmError(msg);
          toast(`测试失败：${msg}`);
          if (err.code === "NO_LLM") openLlmSettings();
        } finally {
          el.llmTest.disabled = false;
        }
      });
    }
    if (el.llmClose) el.llmClose.addEventListener("click", closeLlmSettings);
    if (el.llmOverlay) {
      el.llmOverlay.addEventListener("click", (e) => {
        if (e.target === el.llmOverlay) closeLlmSettings();
      });
    }
  }

  function mdLite(text) {
    const safe = escapeHtml(text || "").replace(/\n/g, "<br>");
    return `<p>${safe}</p>`;
  }

  async function askAgent(agentId, userText) {
    const pinned = currentResearch();
    if (pinned && pinned.brief && pinned.brief.product) {
      requestPackCollect(pinned.brief.product);
    }
    const history = state.chatTurns.slice(-8);
    const messages = [
      { role: "system", content: agentSystemPrompt(agentId) },
      ...history,
      { role: "user", content: userText },
    ];
    const reply = await callLlm(agentId, messages);
    state.chatTurns.push({ role: "user", content: userText });
    state.chatTurns.push({ role: "assistant", content: reply });
    if (state.chatTurns.length > 16) state.chatTurns = state.chatTurns.slice(-16);
    return reply;
  }

  function createNewResearch() {
    const id = `r-draft-${Date.now()}`;
    const r = {
      id,
      title: "未命名研究",
      date: todayISO(),
      status: "running",
      active: true,
      custom: true,
      emptyWall: true,
      onlyBriefDefault: false,
      question: "",
      feeds: { main: [] },
      brief: {
        product: "",
        audience: "",
        channel: "",
        occasion: "",
        culture_tone: "",
        price_band: "",
        job_type: "",
        must_have: [],
        must_avoid: [],
      },
    };
    RESEARCHES.forEach((x) => (x.active = false));
    RESEARCHES.unshift(r);
    persistCustomResearches();
    applyResearch(id);
  }

  function saveCustomBriefFromDom() {
    const r = currentResearch();
    if (!r || !r.custom) return;
    const panel = el.canvasBody.querySelector(".intent-panel");
    if (!panel) return;
    const val = (name) => {
      const node = panel.querySelector(`[data-brief-field="${name}"]`);
      return node ? node.value.trim() : "";
    };
    r.brief = r.brief || {};
    r.brief.product = val("product");
    r.brief.audience = val("audience");
    r.brief.channel = val("channel");
    r.brief.occasion = val("occasion");
    r.brief.culture_tone = val("culture_tone");
    r.brief.price_band = val("price_band");
    r.brief.job_type = val("job_type");
    r.brief.must_have = splitTags(val("must_have"));
    r.brief.must_avoid = splitTags(val("must_avoid"));
    if (r.brief.product) r.title = `${r.brief.product}竞品调研`;
    r.question = (el.researchQuestion && el.researchQuestion.value) || r.question;
    state.bundle = emptyBundleFor(r);
    persistCustomResearches();
    renderResearch();
    if (el.researchTitle) el.researchTitle.textContent = r.title;
    if (r.brief.product) requestPackCollect(r.brief.product);
  }

  /* ---------- L4 决策筛选：只在已落地主墙上收短名单 ---------- */

  function itemBlob(it) {
    const zh = (it.suggested_style_buckets || [])
      .map((id) => state.bucketIdToZh?.[id] || id)
      .join(" ");
    return [
      it.title,
      it.bucket,
      zh,
      it.query_used,
      Array.isArray(it.raw_tags) ? it.raw_tags.join(" ") : "",
      it.author_or_brand,
      humanSource(it.source),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function shortlistCandidates() {
    const briefGate = currentResearch().onlyBriefDefault !== false;
    return state.wallItems.filter((it) => {
      if (isPendingReview(it)) return false;
      if (!imgFor(it)) return false;
      if (state.shortlistRemoved.has(it.id)) return false;
      if (briefGate && scoreBriefRelevance(it) !== "match") return false;
      return true;
    });
  }

  /** 打分只看已有字段：标得越全越好选，不给没采到的东西加分。 */
  function pickScore(it) {
    let s = 0;
    if ((it.suggested_style_buckets || []).length) s += 3;
    if ((it.structure_tags || []).length) s += 2;
    if ((it.color_roles || []).length) s += 2;
    if ((it.info_hierarchy_tags || []).length) s += 1;
    if (it.author_or_brand) s += 1;
    if (!isFragileImageHost(imgFor(it))) s += 1;
    const pre = it.extra && it.extra.brief_relevance_v1;
    if (pre === "keep_core" || pre === "pass_brief") s += 2;
    if (searchScope(it) === "shelf" || searchScope(it) === "adjacent") s += 1;
    if (kuiyanOccasionAligned(it)) s += 1;
    return s;
  }

  function kuiyanCaseNames() {
    return (state.bundle?.l1?.input?.kuiyan_case_refs || []).map((s) => String(s).trim()).filter(Boolean);
  }

  /** 场合/气质对齐，不是视觉对图。没有案例名单就不加分。 */
  function kuiyanOccasionAligned(it) {
    if (!kuiyanCaseNames().length) return false;
    const blob = itemBlob(it);
    const occasion = String(state.bundle?.l1?.input?.occasion || "");
    const tone = String(state.bundle?.l1?.input?.culture_tone || "");
    const gift = /礼赠|礼盒|馈赠|仪式/.test(blob) || /礼赠|礼盒|馈赠/.test(occasion);
    const modern = /中式|现代|海派|简约/.test(blob) || /中式|现代/.test(tone);
    return gift || modern;
  }

  function kuiyanReasonLine(it) {
    const cases = kuiyanCaseNames();
    if (!cases.length) return "奎燕先验：本轮没有案例图可对，只按 Brief 收";
    if (kuiyanOccasionAligned(it)) {
      const shown = cases.slice(0, 2).join(" / ");
      return `奎燕先验：和「${shown}」同一类礼赠/中式现代场合，不是视觉对图`;
    }
    return "奎燕先验：本轮没有案例图可对，只按 Brief 收";
  }

  function pickDiverse(cands, limit, scoreFn) {
    const score = scoreFn || pickScore;
    const sorted = cands.slice().sort((a, b) => score(b) - score(a));
    const used = new Set();
    const picked = [];
    const take = (it) => {
      if (!it || used.has(it.id) || picked.length >= limit) return;
      used.add(it.id);
      picked.push(it);
    };
    // 不同类 / 货架 / 跨界先各留位置：有才收，没有就是没有
    ["adjacent", "shelf", "cross"].forEach((scope) => {
      sorted.filter((it) => searchScope(it) === scope).slice(0, 2).forEach(take);
    });
    // 同类是核心战场，剩下的位置优先给同类，按风格桶轮转铺开
    const core = sorted.filter((it) => searchScope(it) === "same");
    const pool = core.length >= limit ? core : sorted;
    const lanes = new Map();
    pool.forEach((it) => {
      const k = it.bucket || "其他";
      if (!lanes.has(k)) lanes.set(k, []);
      lanes.get(k).push(it);
    });
    const laneList = [...lanes.values()];
    let guard = 0;
    while (picked.length < limit && laneList.some((l) => l.length) && guard < 5000) {
      laneList.forEach((lane) => {
        while (lane.length && used.has(lane[0].id)) lane.shift();
        if (lane.length) take(lane.shift());
      });
      guard += 1;
    }
    return picked;
  }

  function unlabeledDims(it) {
    const groups = (state.dims && state.dims.groups) || [];
    const missing = [];
    groups.forEach((g) => {
      (g.dimensions || []).forEach((d) => {
        if (d.collect_status === "not_collected") return;
        if (!dimValueZh(it, d)) missing.push(d.name_zh);
      });
    });
    return missing;
  }

  function reasonFor(it, hits) {
    const bucketZh = dimValueZh(it, { id: "style_bucket", fields: ["suggested_style_buckets"] });
    const color = dimValueZh(it, { id: "color", fields: ["color_roles", "color_palette"] });
    const type = dimValueZh(it, { id: "graphic_type", fields: ["info_hierarchy_tags", "info_hierarchy"] });
    const query = it.query_used ? String(it.query_used).slice(0, 40) : "";
    const lines = [
      `路线：${scopeLabel(it)}${searchScope(it) === "shelf" ? "（在售 listing 样）" : ""}`,
      `贴 brief：${briefRelLabel(it)}`,
      `风格桶：${bucketZh || "未标注"}`,
      `来源：${humanSource(it.source) || "未标注"} · ${it.source_type || "未标注"}`,
      `检索词：${query || "未标注"}`,
    ];
    if (it.author_or_brand) lines.push(`品牌/作者：${String(it.author_or_brand).slice(0, 40)}`);
    if (color) lines.push(`色彩：${color}`);
    if (type) lines.push(`排版：${type}`);
    lines.push(kuiyanReasonLine(it));
    if (hits && hits.length) lines.push(`命中你的批注：${hits.join(" / ")}`);
    return lines;
  }

  function setShortlist(items, hitsById) {
    state.shortlistVisual = items;
    state.shortlistReasons = {};
    items.forEach((it) => {
      state.shortlistReasons[it.id] = reasonFor(it, hitsById && hitsById.get(it.id));
    });
  }

  function ensureShortlist() {
    if (isBenyanResearch()) {
      applyBenyanShortlist();
      return;
    }
    if (state.shortlistVisual.length || state.shortlistTouched) return;
    const cands = shortlistCandidates();
    if (!cands.length) return;
    setShortlist(pickDiverse(cands, SHORTLIST_TARGET));
    state.shortlistAuto = true;
  }

  /** 设计常用说法 → 风格桶。只是词表，不是给样本补数据。 */
  const COMMENT_BUCKET_HINTS = [
    { words: ["金红", "金箔", "烫金", "喜庆", "土", "俗"], buckets: ["luxury_gilt"] },
    { words: ["仿古", "龙凤", "复古", "怀旧"], buckets: ["retro_nostalgia"] },
    { words: ["留白", "简约", "极简", "干净", "安静", "静奢", "克制"], buckets: ["global_minimal", "minimal_white", "swiss_international"] },
    { words: ["中式", "东方", "国潮", "新中式"], buckets: ["chinese_modern", "chinese_ceremonial"] },
    { words: ["礼赠", "礼盒", "仪式", "开箱", "层次"], buckets: ["chinese_ceremonial", "craft_material"] },
    { words: ["材质", "工艺", "质感", "异形", "结构"], buckets: ["craft_material"] },
    { words: ["自然", "有机", "纸感", "环保", "可持续", "质朴"], buckets: ["natural_organic", "sustainable_plain"] },
    { words: ["年轻", "潮", "撞色", "鲜艳", "高饱和"], buckets: ["color_youth", "cartoon_ip"] },
    { words: ["地域", "文旅", "特产"], buckets: ["regional_culture"] },
    { words: ["插画", "手绘", "叙事"], buckets: ["illustration_story"] },
  ];

  function bucketsForWord(w) {
    const out = new Set();
    COMMENT_BUCKET_HINTS.forEach((h) => {
      if (h.words.some((x) => w.includes(x) || x.includes(w))) h.buckets.forEach((b) => out.add(b));
    });
    return out;
  }

  /** 无分词器，就用 2–4 字 n-gram，再用语料把没意义的词滤掉。 */
  function ngrams(phrase) {
    const out = [];
    const runs = (String(phrase).match(/[\u4e00-\u9fa5]+/g) || []).flatMap((r) =>
      r.split(/[的了和与在是就都也很把给再又还只想能别]/)
    );
    runs.forEach((run) => {
      for (let len = 2; len <= Math.min(4, run.length); len += 1) {
        for (let i = 0; i + len <= run.length; i += 1) out.push(run.slice(i, i + len));
      }
    });
    (String(phrase).match(/[A-Za-z]{3,}/g) || []).forEach((w) => out.push(w.toLowerCase()));
    return out;
  }

  const PARTICLE = "的了和与要多别不只想能走偏个把给再又很就都还也是有把把";

  function trimParticles(w) {
    let s = w;
    while (s.length > 2 && PARTICLE.includes(s[0])) s = s.slice(1);
    while (s.length > 2 && PARTICLE.includes(s[s.length - 1])) s = s.slice(0, -1);
    return s;
  }

  /** n-gram 会互相套娃，只留最长的那个，读起来才像人话。 */
  function dropOverlaps(list) {
    const out = [];
    [...new Set(list)]
      .sort((a, b) => b.length - a.length)
      .forEach((w) => {
        if (out.some((k) => k.includes(w) || w.includes(k))) return;
        out.push(w);
      });
    return out;
  }

  /** 把批注拆成「别要什么 / 想要什么」；只认已有文本与风格桶词表，认不出就说认不出。 */
  function parseComment(text, corpus) {
    const t = String(text || "");
    const negPhrases = [];
    const NEG_RE = /(?:不要|不想要|别|避开|去掉|少用|不用|拿掉)\s*([^，,。；;、！!？?\s]{1,10})/g;
    let m;
    while ((m = NEG_RE.exec(t))) negPhrases.push(m[1]);
    const rest = t.replace(NEG_RE, "，");
    const keep = (w) =>
      w.length >= 2 && (bucketsForWord(w).size > 0 || (corpus && corpus.includes(w)));
    const prep = (list) => dropOverlaps(list.map(trimParticles).filter(keep)).slice(0, 6);
    const neg = prep(negPhrases.flatMap(ngrams));
    const pos = prep(ngrams(rest)).filter((w) => !neg.some((n) => n.includes(w) || w.includes(n)));
    const resolved = neg.concat(pos);
    const edge = (w) => PARTICLE.includes(w[0]) || PARTICLE.includes(w[w.length - 1]);
    const unresolved = dropOverlaps(
      [...new Set(negPhrases.concat(rest).flatMap(ngrams))]
        .map(trimParticles)
        .filter(
          (w) => w.length >= 2 && !edge(w) && !keep(w) && !resolved.some((r) => r.includes(w))
        )
    ).slice(0, 4);
    return { neg, pos, unresolved };
  }

  function wordHitsItem(word, it) {
    if (itemBlob(it).includes(word)) return true;
    const wanted = bucketsForWord(word);
    if (!wanted.size) return false;
    return (it.suggested_style_buckets || []).some((b) => wanted.has(b));
  }

  function applyLocalRescreen(comment) {
    if (isBenyanResearch()) {
      applyBenyanShortlist();
      state.shortlistTouched = true;
      renderCanvas();
      toast(benyanShortlistFormed() ? "按采回袋面入选，待复核，不报产品过" : "短名单未成立，只报缺口");
      appendEvent({
        agent: "点点",
        time: "现在",
        tag: "按批注重筛",
        tagClass: "challenge",
        dot: "warn",
        html: `<p>「${escapeHtml(comment.slice(0, 40))}」不扩成 8–12。${escapeHtml(
          benyanGapSentences().join("")
        )}</p>
          <div class="event-note">不加采新图，不写 452/2680 jsonl。</div>`,
      });
      return;
    }
    const cands = shortlistCandidates();
    const corpus = cands.map(itemBlob).join(" ");
    const parsed = parseComment(comment, corpus);
    let { neg, pos, unresolved } = parsed;
    COMMENT_BUCKET_HINTS.forEach((h) => {
      h.words.forEach((w) => {
        if (comment.includes(w) && !pos.includes(w) && !neg.includes(w)) {
          if (/(不要|别|避开|去掉)/.test(comment) && comment.indexOf(w) > comment.search(/不要|别|避开|去掉/)) {
            if (!neg.includes(w)) neg.push(w);
          } else if (!pos.includes(w)) pos.push(w);
        }
      });
    });
    const dropped = [];
    const kept = cands.filter((it) => {
      if (neg.some((w) => wordHitsItem(w, it))) {
        dropped.push(it);
        return false;
      }
      return true;
    });
    const hits = new Map();
    kept.forEach((it) => hits.set(it.id, pos.filter((w) => wordHitsItem(w, it))));
    const scoreFn = (it) => pickScore(it) + (hits.get(it.id) || []).length * 5;
    const picked = pickDiverse(kept.length ? kept : cands, SHORTLIST_TARGET, scoreFn);
    setShortlist(picked, hits);
    state.shortlistTouched = true;
    state.shortlistAuto = true;
    renderCanvas();
    const hitN = picked.filter((it) => (hits.get(it.id) || []).length).length;
    const mapped = Boolean(neg.length || pos.length);
    toast(mapped ? "按批注在已落地主墙上重排了 · 没有新采集" : "字段对不上这句，先按 Brief 重收了一轮");
    appendEvent({
      agent: "点点",
      time: "现在",
      tag: "按批注重筛",
      tagClass: mapped ? "consensus" : "challenge",
      dot: mapped ? "ok" : "warn",
      html: `<p>按你这句「${escapeHtml(comment.slice(0, 40))}」在墙上重排：认出<strong>${escapeHtml(
        pos.join("、") || "—"
      )}</strong>${neg.length ? `，要躲开<strong>${escapeHtml(neg.join("、"))}</strong>` : ""}；短名单 ${picked.length} 款，直接命中 ${hitN}，剔除 ${dropped.length}。</p>
        <div class="event-note">重筛只在已落地的 ${state.feedCounts.main} 张主墙上重排，没有发起新采集。${
          unresolved.length
            ? `「${escapeHtml(unresolved.slice(0, 3).join("、"))}」这类词本轮判不了。`
            : ""
        }${mapped ? "" : " 配好点点的 API，才能按自然语言重筛。"}</div>`,
    });
  }

  async function rescreenWithLlm(comment, agentId) {
    if (isBenyanResearch()) {
      applyLocalRescreen(comment);
      return;
    }
    const cands = shortlistCandidates().slice(0, 40);
    if (!cands.length) {
      toast("墙上没有能进短名单的样本");
      return;
    }
    const compact = cands.map((it) => ({
      id: it.id,
      title: humanTitle(it.title || it.id),
      scope: scopeLabel(it),
      source: humanSource(it.source),
      query: it.query_used || "",
      buckets: (it.suggested_style_buckets || []).map((b) => state.bucketIdToZh[b] || b),
      brief: briefRelLabel(it),
    }));
    toast("点点正在按批注重筛…");
    const data = await callLlm(
      agentId,
      [
        {
          role: "system",
          content: `${agentSystemPrompt(agentId)}\n只返回 JSON：{"keep":["id"],"drop":["id"],"note":"一句中文说明"}。keep 必须来自给定 id，8到12个。禁止发明新样本。`,
        },
        { role: "user", content: `批注：${comment}\n候选：${JSON.stringify(compact)}` },
      ],
      { json: true }
    );
    const allow = new Set(cands.map((it) => it.id));
    const keepIds = (data.keep || []).filter((id) => allow.has(id));
    let picked = keepIds.map((id) => cands.find((it) => it.id === id)).filter(Boolean);
    if (picked.length < SHORTLIST_MIN) {
      cands.forEach((it) => {
        if (picked.length >= SHORTLIST_TARGET) return;
        if (!picked.some((x) => x.id === it.id)) picked.push(it);
      });
    }
    picked = picked.slice(0, SHORTLIST_TARGET);
    const hits = new Map();
    picked.forEach((it) => hits.set(it.id, [comment.slice(0, 24)]));
    setShortlist(picked, hits);
    state.shortlistTouched = true;
    state.shortlistAuto = true;
    renderCanvas();
    toast("点点已按批注重筛 · 没有新采集");
    appendEvent({
      agent: "点点",
      time: "现在",
      tag: "按批注重筛",
      tagClass: "consensus",
      dot: "ok",
      html: `<p>${escapeHtml(data.note || "已按批注在已落地墙上重排。")} 短名单 ${picked.length} 款。</p>
        <div class="event-note">重筛只动排序，不动 ${state.feedCounts.main} 张主墙的边界。</div>`,
    });
  }

  async function rescreenByComment() {
    const box = document.getElementById("houCommentBox");
    if (box) state.houComment = box.value;
    const comment = String(state.houComment || "").trim();
    if (!comment) {
      toast("先写一句批注，再按它重筛");
      if (box) box.focus();
      return;
    }
    const agentId = llmReady() ? "orchestrator" : "";
    if (agentId) {
      try {
        await rescreenWithLlm(comment, agentId);
        return;
      } catch (err) {
        appendEvent({
          agent: "点点",
          time: "现在",
          tag: "模型没接通",
          tagClass: "challenge",
          dot: "warn",
          html: `<p>点点这次没打通（${escapeHtml(err.message || String(err))}）。先用墙上已有字段做一轮本地重筛。</p>`,
        });
      }
    }
    applyLocalRescreen(comment);
  }

  /* ---------- L1 意图识别 ---------- */

  function kvRow(label, value) {
    const v = value == null || value === "" ? "未标注" : value;
    return `<div class="kv-row"><span class="kv-k">${escapeHtml(label)}</span><span class="kv-v${
      v === "未标注" ? " kv-empty" : ""
    }">${escapeHtml(String(v))}</span></div>`;
  }

  function tagList(list, cls) {
    const arr = (list || []).filter(Boolean);
    if (!arr.length) return `<span class="tag-empty">未标注</span>`;
    return arr.map((t) => `<span class="tag ${cls || ""}">${escapeHtml(String(t))}</span>`).join("");
  }

  function renderIntent() {
    const l1 = state.bundle?.l1 || {};
    const input = l1.input || {};
    const intent = l1.intent || {};
    const counts = scopeCounts();
    const plan = intent.analogy_plan || [];
    const queries = intent.query_plan || {};

    const laneRows = [
      { key: "same", zh: "同类", note: "主导品牌 + 设计新锐，核心战场", n: counts.same },
      { key: "adjacent", zh: "不同类", note: "同行业打开视野（茶礼 → 酒礼 / 滋补礼）", n: counts.adjacent },
      { key: "cross", zh: "跨界", note: "别的行业做成 IP / 独特风格的包装", n: counts.cross },
      { key: "shelf", zh: "货架", note: "在售 listing 切片，属于同类里的一层", n: counts.shelf },
    ];

    const planHtml = plan.length
      ? plan
          .map((p) => {
            const targets = (p.targets || []).map((t) => {
              const cross = CROSS_TARGET_RE.test(String(t));
              return `<span class="tag ${cross ? "tag-cross" : "tag-adj"}">${escapeHtml(t)}<em>${
                cross ? "跨界" : "不同类"
              }</em></span>`;
            });
            return `<div class="plan-row">
              <div class="plan-name">${escapeHtml(p.label_zh || p.rule_id || "类比线")}</div>
              <div class="plan-tags">${targets.join("") || '<span class="tag-empty">未标注</span>'}</div>
            </div>`;
          })
          .join("")
      : `<p class="muted">这轮 Brief 还没写类比计划，先只按同类铺。</p>`;

    const qLine = (label, arr) =>
      `<div class="kv-row"><span class="kv-k">${escapeHtml(label)}</span><span class="kv-v${
        (arr || []).length ? "" : " kv-empty"
      }">${escapeHtml((arr || []).join(" · ") || "未标注")}</span></div>`;

    const custom = Boolean(currentResearch().custom);
    const briefLoaded = Boolean(
      l1.raw_brief && (input.channel || input.audience || (input.must_have || []).length)
    );
    const field = (name, label, value, placeholder) =>
      `<div class="kv-edit"><label>${escapeHtml(label)}</label><input class="brief-input" data-brief-field="${name}" value="${escapeAttr(
        value || ""
      )}" placeholder="${escapeAttr(placeholder || "")}" /></div>`;

    return `
    <section class="panel intent-panel">
      <div class="panel-head">
        <h3>L1 意图识别 · 先钉死卖给谁</h3>
        <p class="panel-sub">客群、渠道、场合没钉住，后面的墙只是一堆图，不能当已经问清。</p>
      </div>
      ${
        custom
          ? `<p class="rp-warn">这是新建的一轮。墙是空的，不会抄青绿茶 452 张。先把 Brief 钉住；齿轮里配好一套模型就能对话。</p>
      <div class="panel-block" data-sop="audience">
        <h4>卖给谁 · 在哪卖 · 什么价</h4>
        ${field("audience", "客群", input.audience, "例如 28–45 新中产")}
        ${field("channel", "渠道", input.channel, "例如 礼赠 + 电商")}
        ${field("price_band", "价格带", input.price_band, "例如 中高端")}
        ${field("occasion", "场合", input.occasion, "例如 节日/商务馈赠")}
        ${field("job_type", "课题类型", input.job_type, "0-1 新包装 / 现有升级")}
      </div>
      <div class="panel-block" data-sop="object">
        <h4>分析对象</h4>
        ${field("product", "产品", input.product, "例如 青绿茶礼盒")}
      </div>
      <div class="panel-block">
        <h4>气质与红线</h4>
        ${field("culture_tone", "气质", input.culture_tone, "例如 中式现代")}
        ${field("must_have", "必须有", (input.must_have || []).join("、"), "顿号分隔")}
        ${field("must_avoid", "必须避开", (input.must_avoid || []).join("、"), "顿号分隔")}
      </div>`
          : `${
        briefLoaded
          ? ""
          : `<p class="rp-warn">这轮只有落地的墙，Brief 还没录入。下面除了品名基本都是未标注，不能当已经问清的分析对象。</p>`
      }

      <div class="panel-block" data-sop="audience">
        <h4>卖给谁 · 在哪卖 · 什么价</h4>
        <div class="kv">
          ${kvRow("客群", input.audience)}
          ${kvRow("渠道", input.channel)}
          ${kvRow("价格带", input.price_band)}
          ${kvRow("场合", input.occasion)}
          ${kvRow("课题类型", input.job_type)}
        </div>
      </div>

      <div class="panel-block" data-sop="object">
        <h4>分析对象</h4>
        <div class="kv">
          ${kvRow("产品", input.product)}
          ${kvRow("品类", input.category_text)}
          ${kvRow("本体域", intent.domain_label_zh ? `${intent.domain_label_zh}${
            intent.confidence ? `（置信 ${intent.confidence}）` : ""
          }` : null)}
          ${kvRow("品牌", input.brand)}
        </div>
      </div>

      <div class="panel-block">
        <h4>气质与红线</h4>
        <div class="kv">${kvRow("气质", input.culture_tone)}</div>
        <div class="tag-line"><span class="tag-label">必须有</span>${tagList(input.must_have, "tag-keep")}</div>
        <div class="tag-line"><span class="tag-label">必须避开</span>${tagList(input.must_avoid, "tag-kill")}</div>
        <div class="tag-line"><span class="tag-label">工艺前提</span>${tagList(input.constraints)}</div>
      </div>`
      }

      <div class="panel-block">
        <h4>奎燕会什么（先验）</h4>
        <div class="tag-line"><span class="tag-label">过往案例</span>${tagList(input.kuiyan_case_refs)}</div>
        <div class="kv">${kvRow("品类 fit", input.kuiyan_fit)}</div>
        <div class="tag-line"><span class="tag-label">气质参照</span>${tagList(input.competitors)}</div>
      </div>

      <div class="panel-block">
        <h4>搜索往哪扩 · 三路计划</h4>
        ${planHtml}
        <div class="kv plan-queries">
          ${qLine("同类检索", queries.inspiration)}
          ${qLine("货架检索", queries.shelf)}
          ${qLine("类比检索", queries.analogy)}
        </div>
      </div>

      <div class="panel-block">
        <h4>计划 vs 已落地</h4>
        <div class="lane-table">
          ${laneRows
            .map(
              (r) => `<div class="lane-row${r.n ? "" : " lane-zero"}">
                <span class="lane-zh">${escapeHtml(r.zh)}</span>
                <span class="lane-n">${r.n}</span>
                <span class="lane-note">${escapeHtml(r.note)}</span>
              </div>`
            )
            .join("")}
        </div>
        <p class="honest-note">本轮跨界 0：计划里写了香氛 / 国潮美妆这类跨界目标，但一张都还没采，UI 里不给你补假的。</p>
      </div>
    </section>`;
  }

  /* ---------- L4 决策筛选 ---------- */

  function renderShortlist() {
    ensureShortlist();
    const list = state.shortlistVisual;
    const comment = state.houComment || "";
    const commentBox = `
      <div class="l4-comment">
        <label class="l4-comment-label" for="houCommentBox">你的批注（按这句在已落地墙上重排）</label>
        <textarea id="houCommentBox" rows="3" placeholder="例：不要金红，多留白，只要能拍开箱视频的">${escapeHtml(
          comment
        )}</textarea>
        <div class="l4-comment-foot">
          <span class="muted">写完点重筛。只认标题 / 检索词 / 已标风格桶，认不出的词会直说。不发起新采集。</span>
          <button type="button" class="l4-rescreen" data-shortlist-action="rescreen">按批注重筛</button>
        </div>
      </div>`;

    if (!list.length) {
      const benyan = isBenyanResearch();
      const gap = benyan ? benyanGapState() : null;
      const cands = benyan ? 0 : shortlistCandidates().length;
      return `<section class="panel l4-panel">
        <div class="panel-head">
          <h3>L4 决策筛选 · 短名单</h3>
          <p class="panel-sub">${
            benyan
              ? "短名单未成立只报缺口。只认 api 采回袋面，英文标题也过，不凑 8，不当选型。"
              : `从主墙里收 ${SHORTLIST_MIN}–${SHORTLIST_TARGET} 款给你拍板，不是 452 张全甩过来。`
          }</p>
        </div>
        ${commentBox}
        <div class="empty"><div class="slogan">${benyan ? "短名单未成立" : "短名单现在是空的"}</div>
        <p class="hint">${
          benyan
            ? escapeHtml(benyanGapSentences(gap).join(""))
            : cands
            ? `墙上还有 ${cands} 张能进短名单。要我按 Brief 命中 + 风格桶多样性再收一轮吗？`
            : currentResearch().onlyBriefDefault !== false
              ? "「只看贴 brief」把能进短名单的都筛掉了，或者这轮墙还没有可用图。可以关掉贴 brief 筛选，或换一轮已落地的研究。"
              : "这轮墙上还没有带图、能进短名单的参考。跨界 / 评论 / 开箱都还没采，这里不会补假样本。"
        }</p>
        <button type="button" class="empty-cta" data-shortlist-action="refill">${
          benyan ? "再看缺口" : "重新收一轮"
        }</button></div>
      </section>`;
    }

    const laneN = { same: 0, adjacent: 0, cross: 0, shelf: 0 };
    list.forEach((it) => {
      const s = searchScope(it);
      if (laneN[s] != null) laneN[s] += 1;
    });

    const cards = list
      .map((it, i) => {
        const reasons = state.shortlistReasons[it.id] || reasonFor(it);
        const missing = unlabeledDims(it);
        return `
        <article class="sl-item" data-id="${escapeAttr(it.id)}">
          <div class="sl-idx">${i + 1}</div>
          <div class="sl-thumb"><img loading="lazy" referrerpolicy="no-referrer" src="${escapeAttr(
            imgFor(it)
          )}" alt="" onerror="this.onerror=null;this.classList.add('img-broken');const f=this.nextElementSibling;if(f)f.hidden=false;" /><div class="thumb-fallback" hidden>图链失效</div></div>
          <div class="sl-body">
            <div class="sl-title">${escapeHtml(humanTitle(it.title || it.id))}<span class="sl-score" title="只按已有字段打分">荐 ${pickScore(it)}</span></div>
            <div class="sl-scope"><span class="scope-pill scope-${escapeAttr(
              searchScope(it)
            )}">${escapeHtml(scopeLabel(it))}</span><span class="sl-src">${escapeHtml(
          humanSource(it.source)
        )}</span></div>
            <ul class="sl-reason">${reasons
              .map((r) => `<li>${escapeHtml(r)}</li>`)
              .join("")}</ul>
            <div class="sl-gap">${
              missing.length
                ? `还没标：${escapeHtml(missing.join(" / "))}。开箱、用户反馈、成本本轮未采，不写进理由。`
                : "色彩 / 造型 / 排版 / 风格桶这几项有值；开箱、用户反馈、成本本轮未采，不写进理由。"
            }</div>
          </div>
          <div class="sl-actions">
            ${originAnchorHtml(it, { className: "sl-open", showHost: true })}
            <button type="button" class="sl-remove" data-shortlist-remove="${escapeAttr(
              it.id
            )}">拿掉</button>
          </div>
        </article>`;
      })
      .join("");

    return `<section class="panel l4-panel">
      <div class="panel-head">
        <h3>L4 决策筛选 · 短名单 ${list.length} 款</h3>
        <p class="panel-sub">${
          isBenyanResearch()
            ? "按采回袋面入选，待复核，不报产品过，不凑 8，不用茶墙。"
            : state.shortlistAuto
            ? "先按 Brief 命中 + 风格桶多样性替你收了一轮，留哪个、拿掉哪个你说了算。"
            : "这是你自己从墙上勾进来的。"
        }</p>
      </div>
      <div class="sl-lanes">同类 ${laneN.same} · 不同类 ${laneN.adjacent} · 货架 ${laneN.shelf} · 跨界 ${
      laneN.cross
    }${laneN.cross ? "" : "（本轮无跨界样本，不编造）"}</div>
      ${commentBox}
      <div class="sl-list">${cards}</div>
      <p class="honest-note">推荐理由只引用已采到的字段。奎燕案例只对齐场合/气质，没有案例图可对视觉。色彩、排版没标就写未标注；开箱、用户反馈没采到不编。</p>
    </section>`;
  }

  /* ---------- L5 结论报告 ---------- */

  function renderReport() {
    ensureShortlist();
    const l1 = state.bundle?.l1 || {};
    const input = l1.input || {};
    const counts = scopeCounts();
    const mainN = state.feedCounts.main || 0;
    const pendN = state.feedCounts.pending || 0;
    const list = isBenyanResearch() && !benyanShortlistFormed() ? [] : state.shortlistVisual;
    const cards = state.bundle?.l4_cards || [];
    const cov = coverageStats();

    const benyanUnformed = isBenyanResearch() && !benyanShortlistFormed();
    const emptyBanner = list.length
      ? ""
      : benyanUnformed
        ? `<p class="rp-warn">短名单未成立。下面只报缺口，第 4、5 段不当选型。</p>`
        : `<p class="rp-warn">尚未完成筛选：短名单是空的。下面 1–3、6 段只报告覆盖缺口，第 4、5 段还不能当选型结论。</p>`;

    const sec1 = `
      <section class="rp-sec">
        <h4><span class="rp-n">1</span>分析对象</h4>
        <div class="kv">
          ${kvRow("客群", input.audience)}
          ${kvRow("渠道", input.channel)}
          ${kvRow("价格带", input.price_band)}
          ${kvRow("场合", input.occasion)}
          ${kvRow("产品 / 品类", [input.product, input.category_text].filter(Boolean).join(" · ") || null)}
          ${kvRow("气质", input.culture_tone)}
        </div>
        <div class="tag-line"><span class="tag-label">必须有</span>${tagList(input.must_have, "tag-keep")}</div>
        <div class="tag-line"><span class="tag-label">必须避开</span>${tagList(input.must_avoid, "tag-kill")}</div>
      </section>`;

    const sec2 = `
      <section class="rp-sec">
        <h4><span class="rp-n">2</span>样本结构</h4>
        <div class="lane-table">
          <div class="lane-row"><span class="lane-zh">同类</span><span class="lane-n">${counts.same}</span><span class="lane-note">核心战场，主墙主体</span></div>
          <div class="lane-row${counts.adjacent ? "" : " lane-zero"}"><span class="lane-zh">不同类</span><span class="lane-n">${counts.adjacent}</span><span class="lane-note">同行业打开，本轮偏薄</span></div>
          <div class="lane-row${counts.cross ? "" : " lane-zero"}"><span class="lane-zh">跨界</span><span class="lane-n">${counts.cross}</span><span class="lane-note">本轮未单列采集与打标</span></div>
          <div class="lane-row${counts.shelf ? "" : " lane-zero"}"><span class="lane-zh">货架</span><span class="lane-n">${counts.shelf}</span><span class="lane-note">在售 listing 样，深采未开通</span></div>
        </div>
        <p class="rp-note">${
          isBenyanResearch()
            ? escapeHtml(
                `本课题${benyanGapState().speciesLabel} 库内 ${benyanGapState().libraryN} 条，采回 ${benyanGapState().passedN}，待复核可进短名单（只认 api_pack_collect）。不绑茶墙，也不把这份报告当全市场扫描。`
              )
            : `主墙 ${mainN} 张已上墙，其中花瓣 ${expiredHuabanCount()} 张图链已过期（点不开图，字段还在）。待复核 ${pendN} 张没算进结论。三路里只有同类算铺开了，不同类和跨界都不够，别把这份报告当「全市场扫描」。`
        }</p>
      </section>`;

    const covRows = cov
      .map(
        (g) => `<div class="cov-group">
          <div class="cov-gname">${escapeHtml(g.name)}</div>
          ${g.dims
            .map((d) => {
              const pct = d.total ? Math.round((d.labeled / d.total) * 100) : 0;
              const status = d.notCollected
                ? `<span class="cov-none">本轮未采集</span>`
                : `<span class="cov-num">${d.labeled}/${d.total}</span>`;
              return `<div class="cov-row${d.notCollected ? " cov-row-none" : ""}">
                <span class="cov-name">${escapeHtml(d.name)}</span>
                <span class="cov-bar"><i style="width:${d.notCollected ? 0 : pct}%"></i></span>
                ${status}
              </div>`;
            })
            .join("")}
        </div>`
      )
      .join("");

    const sec3 = `
      <section class="rp-sec">
        <h4><span class="rp-n">3</span>分类覆盖</h4>
        ${covRows || '<p class="muted">维度合同还没读到（data/classify-dimensions-v1.json）。</p>'}
        <p class="rp-note">分母是主墙 ${mainN} 张。色彩、排版多数还空着，检查器里写「未标注」。开箱、功能、用户反馈、成本这四项本轮没采。奎燕稿件字体密度高，本轮排版覆盖不够，这里不判字体、也不生图。</p>
      </section>`;

    const sec4 = list.length
      ? `<section class="rp-sec">
          <h4><span class="rp-n">4</span>入选参考 · ${list.length} 款</h4>
          <ol class="rp-shortlist">
            ${list
              .map(
                (it) => `<li>
                  <span class="scope-pill scope-${escapeAttr(searchScope(it))}">${escapeHtml(
                  scopeLabel(it)
                )}</span>
                  <strong>${escapeHtml(humanTitle(it.title || it.id))}</strong>
                  <span class="rp-src">${escapeHtml(humanSource(it.source))}</span>
                  ${originAnchorHtml(it, { className: "rp-link", showUrl: true })}
                  <span class="rp-why">${escapeHtml(
                    (state.shortlistReasons[it.id] || reasonFor(it)).slice(0, 3).join(" · ")
                  )}</span>
                </li>`
              )
              .join("")}
          </ol>
          ${
            state.houComment
              ? `<p class="rp-note">已按你的批注重排过：「${escapeHtml(state.houComment.slice(0, 60))}」。重排只动排序，不动 452 张的边界。</p>`
              : ""
          }
        </section>`
      : `<section class="rp-sec">
          <h4><span class="rp-n">4</span>入选参考</h4>
          <p class="rp-warn">${
            isBenyanResearch()
              ? escapeHtml(benyanGapSentences().join(""))
              : "短名单是空的，这一段没有入选款。先去 L4 收 8–12 款，或点「重新收一轮」。在那之前，不要把这份报告当成已经选完。"
          }</p>
          <button type="button" class="empty-cta" data-empty-action="open-shortlist">${
            isBenyanResearch() ? "看 L4 缺口" : "去 L4 收短名单"
          }</button>
        </section>`;

    const contrastGaps = honestContrastGaps(counts);
    const benyan = isBenyanResearch();
    const sec5 = benyan
      ? `
      <section class="rp-sec">
        <h4><span class="rp-n">5</span>差异化机会</h4>
        <p class="rp-note">${
          list.length
            ? "这一段只写短名单袋面里能看见的差异。没有样本就不假装有对照，也不挂方向假设卡。"
            : escapeHtml(benyanGapSentences().join(""))
        }</p>
        <ul class="rp-risk">${contrastGaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
        ${
          list.length
            ? `<ul class="rp-risk">${list
                .map(
                  (it) =>
                    `<li><b>${escapeHtml(humanTitle(it.title || it.id))}</b>：官网袋面可出图，深链 ${escapeHtml(
                      pageHost(pageUrlOf(it)) || "可开"
                    )}。按已见袋面写，不升格成完稿方向。</li>`
                )
                .join("")}</ul>`
            : `<p class="muted">短名单未成立，这一段不当选型，只记缺口。</p>`
        }
      </section>`
      : `
      <section class="rp-sec">
        <h4><span class="rp-n">5</span>差异化机会</h4>
        <p class="rp-note">这一段只写能从样本结构数出来的空白。没有样本就不假装有对照。</p>
        <ul class="rp-risk">${contrastGaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
        ${
          cards.length
            ? `<p class="rp-note">下面三张是方向卡，挂在结论层，不是 L4 短名单，也不是货架/跨界对照。</p><div class="rp-cards">${renderStrategy()}</div>`
            : `<p class="muted">本轮没有方向卡。能交付的是 L4 短名单和上面的覆盖缺口。</p>`
        }
      </section>`;

    const covBy = {};
    cov.forEach((g) => g.dims.forEach((d) => (covBy[d.id] = d.labeled)));
    const sbN = covBy.style_bucket || 0;
    const colorN = covBy.color || 0;
    const structN = covBy.form_material || 0;

    const typeN = covBy.graphic_type || 0;

    const sec6 = benyan
      ? `
      <section class="rp-sec">
        <h4><span class="rp-n">6</span>风险与下一步</h4>
        <ul class="rp-risk">
          ${
            list.length
              ? ""
              : benyanGapSentences().map((g) => `<li>${escapeHtml(g)}</li>`).join("")
          }
          <li><b>样本薄</b>：本课题${benyanGapState().speciesLabel} 采回 ${benyanGapState().passedN}，不够谈全市场。</li>
          <li><b>跨界 ${counts.cross}</b>：${counts.cross ? "按已落地样本写。" : "样本 0，不做对照。"}</li>
          <li><b>用户反馈 / 开箱 / 成本</b>：本轮未采，不做对照。</li>
        </ul>
        <p class="rp-note">${
          list.length
            ? "下一步按缺口补本课题采回袋面。不挂方向卡戳。"
            : "下一步按缺口补本课题采回袋面。短名单未成立就不写选型。"
        }</p>
      </section>`
      : `
      <section class="rp-sec">
        <h4><span class="rp-n">6</span>风险与下一步</h4>
        <ul class="rp-risk">
          <li><b>跨界 0</b>：三路里最缺这一路，本轮没有单列采集与打标，所以造型语言只能从同类里借。</li>
          <li><b>不同类 ${counts.adjacent}</b>：薄到不足以谈行业趋势，酒礼 / 滋补礼 / 精品咖啡都得补。</li>
          <li><b>货架 ${counts.shelf}</b>：只有 listing 样，电商深采没开通，「货架表现力」这一维基本是空的。</li>
          <li><b>色彩校准做不了</b>：色彩 ${colorN}/${mainN}，货架 ${counts.shelf} 条 listing，没有淘宝竞品色板可对照。</li>
          <li><b>字体判不了</b>：排版 ${typeN}/${mainN}。奎燕稿件字体密度高，生图过不了这一关，本产品到报告为止，不生包装完稿。</li>
          <li><b>用户反馈未采</b>：电商评价与社交槽点一条没抓，「好看但容易漏」这类判断现在给不出。</li>
          <li><b>成本与定位未采</b>：质感是否配得上中高端价格带，本轮无数据，只能靠人看。</li>
          <li><b>打标覆盖低</b>：风格桶 ${sbN}/${mainN}、造型 ${structN}/${mainN}、色彩 ${colorN}/${mainN}，其余全是未标注。</li>
          <li><b>待复核 ${pendN}</b>：没进主墙，也没进这份结论。</li>
        </ul>
        <p class="rp-note">下一步按缺口排：先补货架 listing 主色与用户反馈，再开跨界，最后补成本。字体要等排版标注上来，不能靠生图凑。</p>
      </section>`;

    return `<section class="panel report-panel">
      <div class="panel-head rp-head-row">
        <div>
          <h3>L5 结论报告 · 差异化机会</h3>
          <p class="panel-sub">${
            benyan
              ? benyanShortlistFormed()
                ? `按采回袋面入选 ${list.length} 款，待复核，不报产品过，不绑茶墙。`
                : "短名单未成立，只报缺口。不绑茶墙，不加采，不当选型。"
              : `可复核的决策备忘：只用已落地的主墙 ${mainN} 张和你定的短名单，没有新采集，也没有补数。`
          }</p>
        </div>
        <button type="button" class="rp-copy" data-report-action="copy">复制本页要点</button>
        <button type="button" class="rp-download" data-report-action="download">下载报告</button>
      </div>
      ${emptyBanner}${sec1}${sec2}${sec3}${sec4}${sec5}${sec6}
    </section>`;
  }

  function renderCanvas({ preserveScroll = false } = {}) {
    const prev = preserveScroll && el.canvasBody ? el.canvasBody.scrollTop : 0;
    if (state.tab === "visual") {
      el.canvasBody.innerHTML = renderVisual();
      attachWallLoader();
    } else if (state.tab === "intent") {
      el.canvasBody.innerHTML = renderIntent();
    } else if (state.tab === "report" || state.tab === "strategy") {
      el.canvasBody.innerHTML = renderReport();
    } else {
      el.canvasBody.innerHTML = renderShortlist();
    }
    if (preserveScroll && el.canvasBody) el.canvasBody.scrollTop = prev;
  }

  function clockNow() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function clearRunTimers() {
    (state._runTimers || []).forEach((id) => clearTimeout(id));
    state._runTimers = [];
  }

  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    (state._runTimers || (state._runTimers = [])).push(id);
    return id;
  }

  function briefTableHtml(input = {}) {
    const rows = [
      ["卖给谁", input.audience],
      ["价格带", input.price_band],
      ["渠道市场", input.channel],
      ["分析对象", input.product],
      ["品牌定位", input.culture_tone],
      ["使用场景", input.occasion],
      ["课题类型", input.job_type],
    ];
    return `<table class="brief-table"><tbody>${rows
      .map(
        ([k, v]) =>
          `<tr><th>${escapeHtml(k)}</th><td class="${v ? "" : "empty"}">${escapeHtml(v || "未标注")}</td></tr>`
      )
      .join("")}</tbody></table>`;
  }

  function libraryStats() {
    const input = state.bundle?.l1?.input || {};
    const counts = state.bundle?.l3?.counts || {};
    const cards = state.bundle?.l4_cards || [];
    const lanes = scopeCounts();
    const mainN = state.feedCounts.main || counts.main_wall || 0;
    const pendN = state.feedCounts.pending || counts.pending_review || 0;
    const product = input.product || (currentResearch() && currentResearch().title) || "";
    const tone = input.culture_tone || "中式现代";
    const sbN = (state.wallItems || []).reduce(
      (a, it) => a + ((it.suggested_style_buckets || []).length ? 1 : 0),
      0
    );
    return { input, counts, cards, lanes, mainN, pendN, product, tone, sbN };
  }

  function wallThumbs(limit = 8) {
    const out = [];
    for (const it of state.wallItems || []) {
      const src = imgFor(it);
      if (!src || !/^https?:/i.test(src) || isFragileImageHost(src)) continue;
      out.push({ src, title: it.title || "" });
      if (out.length >= limit) break;
    }
    return out;
  }

  function renderThumbStrip(thumbs) {
    if (!thumbs || !thumbs.length) return "";
    return `<div class="run-thumbs" role="list">${thumbs
      .map(
        (t) => `<button type="button" class="run-thumb" data-artifact="map" title="${escapeAttr(
          t.title || ""
        )}" role="listitem"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${escapeAttr(
          t.src
        )}" alt="" /></button>`
      )
      .join("")}</div>`;
  }

  function syncRunStep(n) {
    if (!el.runStep) return;
    const stage = Number(n || state.stage || 0);
    const r = currentResearch();
    if (!stage || (r && (r.emptyWall || r.custom) && state.holdResults)) {
      el.runStep.hidden = true;
      el.runStep.textContent = "";
      return;
    }
    const meta = STAGES.find((s) => s.id === stage);
    el.runStep.hidden = false;
    el.runStep.textContent = `第 ${stage}/5 步 · ${meta ? meta.label : ""}`;
  }

  function inferJump(kind, title) {
    if (kind === "user") return "";
    const t = String(title || "");
    if (/Brief|听清|追问|记下|意图/.test(t)) return "brief";
    if (/短名单|筛选|决策|入选|老板/.test(t)) return "shortlist";
    if (/结论|报告|方向假设/.test(t)) return "report";
    if (/检索|参考|写入|分类|打标|穷尽|采集|库|墙/.test(t)) return "map";
    return "";
  }

  function appendRun({
    kind = "run",
    actor = "奎燕设计智能体",
    title = "",
    detail = "",
    status = "done",
    tag = "",
    tagClass = "",
    time = "",
    thumbs = [],
    html = "",
    actions = [],
    jump = "",
  } = {}) {
    const node = document.createElement("article");
    const statusClass =
      status === "working" ? "is-working" : status === "warn" ? "is-warn" : status === "fail" ? "is-fail" : "is-done";
    node.className = `event run run-${kind} ${statusClass}`;
    const jumpTo = jump || inferJump(kind, title);
    if (jumpTo && !state.holdResults && !isDraftInterview()) node.dataset.jump = jumpTo;
    const actionHtml = (actions || []).length
      ? `<div class="chips-row">${actions
          .map(
            (a) =>
              `<button type="button" class="artifact-link" data-artifact="${escapeAttr(a.artifact)}">${escapeHtml(
                a.label
              )}</button>`
          )
          .join("")}</div>`
      : "";
    if (kind === "user") {
      node.innerHTML = `<div class="run-body"><div class="run-user-bubble">${escapeHtml(
        detail || title || ""
      )}</div></div>`;
    } else {
      node.innerHTML = `
      <div class="run-gutter"><span class="run-mark" aria-hidden="true">{K}</span></div>
      <div class="run-body">
        <div class="run-line">
          <span class="run-verb">${escapeHtml(title || tag || actor)}</span>
          ${detail ? `<span class="run-obj">${escapeHtml(detail)}</span>` : ""}
          ${tag && tag !== title ? `<span class="event-tag ${tagClass || ""}">${escapeHtml(tag)}</span>` : ""}
          <span class="run-actor">${escapeHtml(actor)}</span>
          <span class="run-time">${escapeHtml(time || clockNow())}</span>
        </div>
        ${html ? `<div class="run-extra event-card">${html}</div>` : ""}
        ${renderThumbStrip(thumbs)}
        ${actionHtml}
      </div>`;
    }
    el.stream.appendChild(node);
    el.stream.scrollTop = el.stream.scrollHeight;
    return node;
  }

  function finishRun(node, patch = {}) {
    if (!node) return node;
    node.classList.remove("is-working", "is-done", "is-warn", "is-fail");
    const st = patch.status || "done";
    node.classList.add(st === "warn" ? "is-warn" : st === "fail" ? "is-fail" : "is-done");
    const verb = node.querySelector(".run-verb");
    let obj = node.querySelector(".run-obj");
    if (patch.title && verb) verb.textContent = patch.title;
    if (patch.detail != null) {
      if (obj) obj.textContent = patch.detail;
      else if (verb) {
        obj = document.createElement("span");
        obj.className = "run-obj";
        obj.textContent = patch.detail;
        verb.after(obj);
      }
    }
    if (patch.html != null) {
      let extra = node.querySelector(".run-extra");
      if (!extra) {
        extra = document.createElement("div");
        extra.className = "run-extra event-card";
        const body = node.querySelector(".run-body");
        const thumbs = body && body.querySelector(".run-thumbs");
        if (thumbs) body.insertBefore(extra, thumbs);
        else if (body) body.appendChild(extra);
      }
      extra.innerHTML = patch.html;
    }
    if (patch.thumbs) {
      const body = node.querySelector(".run-body");
      if (body) {
        const old = body.querySelector(".run-thumbs");
        if (old) old.remove();
        if (patch.thumbs.length) body.insertAdjacentHTML("beforeend", renderThumbStrip(patch.thumbs));
      }
    }
    if (el.stream) el.stream.scrollTop = el.stream.scrollHeight;
    return node;
  }

  function appendEvent({ agent, time, tag, tagClass, dot, html }) {
    if (agent === "你") {
      const tmp = document.createElement("div");
      tmp.innerHTML = html || "";
      return appendRun({
        kind: "user",
        title: tag || "留言",
        detail: (tmp.textContent || "").trim(),
        time: time === "现在" ? clockNow() : time,
      });
    }
    const status = dot === "warn" ? "warn" : dot === "kill" ? "fail" : /追问/.test(tag || "") ? "working" : "done";
    return appendRun({
      kind: /追问/.test(tag || "") ? "ask" : "run",
      actor: agent,
      title: tag || agent,
      status,
      tagClass,
      time: time === "现在" ? clockNow() : time,
      html,
    });
  }

  function playLibraryRun({ animate = false } = {}) {
    const r = currentResearch();
    if (isDraftInterview() || (r && r.emptyWall && !(state.wallItems || []).length)) return;
    const { lanes, mainN, pendN, sbN } = libraryStats();
    const thumbs = wallThumbs(8);
    const paintDone = () => {
      appendRun({
        title: "检索自有库",
        detail: `${mainN} 张`,
        thumbs,
        html: pendN ? `<p class="run-quiet">待复核 ${pendN} 没算进来。不发起新采集。</p>` : `<p class="run-quiet">不发起新采集，只读本机库。</p>`,
        actions: [{ artifact: "map", label: "打开参考墙" }],
      });
      appendRun({
        actor: "点点",
        title: "风格打标",
        detail: `${sbN}/${mainN}`,
        html: `<p class="run-quiet">东方 / 国际 / 简约按已有桶映射。开箱、反馈、成本、头部/新锐大多未标。</p>`,
      });
      appendRun({
        title: "分类拆解",
        detail: `同类 ${lanes.same} · 不同类 ${lanes.adjacent} · 跨界 ${lanes.cross} · 货架 ${lanes.shelf}`,
      });
      syncRunStep(3);
    };
    if (!animate) {
      paintDone();
      return;
    }
    const retrieve = appendRun({ title: "检索自有库", detail: "只读本机库…", status: "working" });
    later(280, () => {
      finishRun(retrieve, {
        status: "done",
        detail: `${mainN} 张`,
        thumbs,
        html: pendN ? `<p class="run-quiet">待复核 ${pendN} 没算进来。不发起新采集。</p>` : "",
      });
      const tag = appendRun({ actor: "点点", title: "风格打标", detail: "对照已有桶…", status: "working" });
      later(240, () => {
        finishRun(tag, { status: "done", detail: `${sbN}/${mainN}` });
        appendRun({
          title: "写入参考墙",
          detail: `同类 ${lanes.same} · 不同类 ${lanes.adjacent} · 跨界 ${lanes.cross} · 货架 ${lanes.shelf}`,
          actions: [{ artifact: "map", label: "打开参考墙" }],
        });
        syncRunStep(3);
      });
    });
  }

  function seedStream() {
    clearRunTimers();
    el.stream.innerHTML = "";
    state.chatTurns = [];
    clearScope();
    const r = currentResearch();
    if (r.emptyWall || r.custom) {
      syncRunStep(0);
      return;
    }
    const { input, cards, product } = libraryStats();
    appendRun({
      title: "听清 Brief",
      detail: product || "已问清的项",
      html: briefTableHtml(input),
    });
    playLibraryRun({ animate: false });
    const cardLines = cards
      .slice(0, 3)
      .map((c) => `<li><strong>${escapeHtml(c.title)}</strong> — ${escapeHtml(c.one_liner || "")}</li>`)
      .join("");
    if (cardLines) {
      appendRun({
        title: "方向卡",
        detail: `${cards.length} 张`,
        html: `<p class="run-quiet">青绿茶这轮挂了三张方向卡：</p><ul>${cardLines}</ul>`,
        actions: [
          { artifact: "shortlist", label: "先收一版给老板" },
          { artifact: "report", label: "打开结论" },
        ],
      });
    }
    appendRun({
      kind: "follow",
      title: "接下来",
      detail: "栏可收起，结果可弹出",
      html: `<p class="run-quiet">Ctrl+K 命令面板 · Ctrl+B 收起任务栏。结果栏像 Canvas / Artifact 一样随时弹出。</p>`,
      actions: [
        { artifact: "map", label: "打开参考墙" },
        { artifact: "shortlist", label: "先收一版短名单" },
        { artifact: "report", label: "打开结论" },
      ],
    });
    const last = el.stream && el.stream.lastElementChild;
    if (last) last.classList.add("follow-row");
    syncRunStep(3);
  }

  function pushStageEvent(n) {
    const lanes = scopeCounts();
    const mainN = state.feedCounts.main || 0;
    const map = {
      1: () =>
        appendRun({
          title: "听清 Brief",
          detail: "回到客群 / 渠道 / 场合",
          actions: [{ artifact: "brief", label: "看 Brief" }],
        }),
      2: () => {
        setCap("crawler", "idle", `同类 ${lanes.same} · 不同类 ${lanes.adjacent} · 跨界 ${lanes.cross} · 货架 ${lanes.shelf}`);
        appendRun({
          actor: "采集",
          title: "穷尽自有库",
          detail: `同类 ${lanes.same} · 不同类 ${lanes.adjacent} · 跨界 ${lanes.cross} · 货架 ${lanes.shelf}`,
          html: `<p class="run-quiet">本版不发起新采集，穷尽还差跨界那一路。</p>`,
          actions: [{ artifact: "map", label: "打开参考墙" }],
        });
      },
      3: () => {
        setCap("dotdot", "idle", "维度标签已就绪，缺值写未标注");
        appendRun({
          actor: "点点",
          title: "分类拆解",
          detail: "视觉 / 体验 / 商业",
          html: `<p class="run-quiet">点一张，看标了什么、什么还没标。</p>`,
          actions: [{ artifact: "map", label: "打开参考墙" }],
        });
      },
      4: () => {
        appendRun({
          title: "决策筛选",
          detail: `${mainN} 张里收短名单`,
          status: "warn",
          html: `<p class="run-quiet">拿掉不合意的，或写一句批注让我重排。不发起新采集。</p>`,
          actions: [{ artifact: "shortlist", label: "打开短名单" }],
        });
      },
      5: () => {
        const kept = state.shortlistVisual.length;
        appendRun({
          title: "结论报告",
          detail: kept ? `${kept} 款短名单` : "缺口报告",
          html: kept
            ? `<p class="run-quiet">六段结论。差异化是方向假设，不是完稿；跨界 0、用户反馈未采都写在最后。</p>`
            : `<p class="run-quiet">短名单空着，这份只能算覆盖缺口报告。</p>`,
          actions: [{ artifact: kept ? "report" : "shortlist", label: kept ? "看结论" : "先去收短名单" }],
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
    toast(
      decision === "keep"
        ? `留下方向假设「${title}」· 记在结论报告里`
        : `先放下「${title}」· 以后还能翻回来`
    );
    if (decision === "keep") {
      appendEvent({
        agent: "奎燕设计智能体",
        time: "现在",
        tag: "L5 方向假设",
        tagClass: "consensus",
        dot: "ok",
        html: `<p>留下方向假设「${escapeHtml(title)}」。它只是结论报告里的一条假设，还得靠短名单和后面补的货架/反馈数据顶住。</p>
          <div class="chips-row"><button type="button" class="artifact-link" data-artifact="report">回结论报告</button></div>`,
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

  function honestContrastGaps(counts) {
    return [
      counts.cross
        ? `跨界对照：主墙有 ${counts.cross} 张，按已落地样本写，不补假的。`
        : "跨界对照：样本 0，不做。",
      counts.shelf
        ? `货架对照：只有 ${counts.shelf} 条 listing 样，没有主色/评价，没有淘宝色板，也不做口碑对照。`
        : "货架对照：没有 listing 样，没有淘宝色板，不做。",
      counts.adjacent
        ? `不同类对照：只有 ${counts.adjacent} 张，薄到不够谈行业趋势。`
        : "不同类对照：样本 0，不做。",
      "用户反馈 / 开箱 / 成本：本轮未采，不做对照。",
    ];
  }

  function openDecisionLayer(tab, { stamp = true } = {}) {
    if (tab !== "shortlist" && tab !== "report") return false;
    if (isDraftInterview()) {
      refuseDraftReveal(
        tab === "shortlist" ? "墙还是空的，短名单没有样本可收。" : "墙还是空的，结论没有样本可写。"
      );
      return false;
    }
    const benyan = isBenyanResearch();
    if (!benyan && currentResearch().emptyWall && !(state.wallItems || []).length) {
      toast(tab === "shortlist" ? "墙还是空的，短名单没有样本可收。" : "墙还是空的，结论没有样本可写。");
      return false;
    }
    ensureShortlist();
    const n = state.shortlistVisual.length;
    const lanes = scopeCounts();
    if (tab === "shortlist") {
      setStage(4, { appendEvent: false });
      revealAndSwitch("shortlist", { fromStage: true });
      if (stamp) {
        appendRun({
          title: "L4 决策筛选",
          detail: benyan && !benyanShortlistFormed() ? "短名单未成立" : n ? `短名单 ${n} 款` : "短名单是空的",
          html: benyan
            ? `<p class="run-quiet">${
                benyanShortlistFormed()
                  ? `按采回袋面入选 ${n} 款，待复核，不报产品过，不绑茶墙。`
                  : `${benyanGapSentences().join("")}不加采新图。`
              }</p>`
            : `<p class="run-quiet">只从已落地 ${state.feedCounts.main || 0} 张主墙收 8–12 款。跨界 ${lanes.cross}，不加采。</p>`,
          actions: [{ artifact: "shortlist", label: "打开短名单" }],
        });
      }
      return true;
    }
    setStage(5, { appendEvent: false });
    revealAndSwitch("report", { fromStage: true });
    if (stamp) {
      appendRun({
        title: "L5 结论报告",
        detail: benyan && !benyanShortlistFormed() ? "短名单未成立 · 只报缺口" : n ? `入选 ${n} 款` : "覆盖缺口",
        html: `<p class="run-quiet">${
          benyan && !benyanShortlistFormed()
            ? benyanGapSentences().join("")
            : `六段结论。跨界 ${lanes.cross} 不编。没有样本的对照不做。`
        }</p>`,
        actions: [{ artifact: "report", label: "打开结论" }],
      });
    }
    return true;
  }

  function handleArtifact(kind) {
    if (kind === "brief" || kind === "intent") {
      setStage(1, { appendEvent: false });
      revealAndSwitch("intent", { fromStage: true });
    } else if (kind === "map" || kind === "visual") {
      setStage(3, { appendEvent: false });
      revealAndSwitch("visual", { fromStage: true });
    } else if (kind === "shortlist") {
      openDecisionLayer("shortlist");
    } else if (kind === "report" || kind === "strategy") {
      openDecisionLayer("report");
    }
  }

  const STUDIO_COMMANDS = [
    { id: "new", title: "新建分析", hint: "空白任务，先开口", keys: "新建 分析 任务", run: () => createNewResearch() },
    { id: "toggle", title: "弹出 / 收起结果", hint: "ChatGPT Canvas 式", keys: "弹出 收起 结果 canvas", run: () => setArtifactOpen(!state.artifactOpen) },
    { id: "brief", title: "打开 Brief", hint: "听清的项", keys: "brief 意图 听清", run: () => handleArtifact("brief") },
    { id: "library", title: "打开素材库", hint: "参考墙 · 自有库", keys: "素材库 参考 看库 墙", run: () => handleArtifact("map") },
    { id: "shortlist", title: "打开短名单", hint: "候选方向", keys: "短名单 筛选 候选", run: () => handleArtifact("shortlist") },
    { id: "report", title: "打开结论", hint: "六段报告", keys: "结论 报告", run: () => handleArtifact("report") },
    { id: "search", title: "搜索任务", hint: "聚焦任务栏", keys: "搜索 任务", run: () => { setRailCollapsed(false); if (el.railSearch) { el.railSearch.focus(); el.railSearch.select(); } } },
    { id: "rail", title: "收起 / 展开任务栏", hint: "Ctrl+B", keys: "任务栏 收起栏 sidebar", run: () => setRailCollapsed(!layoutState.railCollapsed) },
    { id: "filters", title: "收起 / 展开筛选", hint: "出处与分类", keys: "筛选 出处", run: () => setFiltersCompact(!layoutState.filtersCompact) },
    { id: "llm", title: "模型与权限", hint: "一套 DeepSeek / 兼容接口", keys: "模型 权限 api", run: () => openLlmSettings() },
    { id: "chat", title: "回到对话", hint: "聚焦输入", keys: "对话 输入", run: () => { if (el.composerInput) el.composerInput.focus(); } },
  ];

  const SLASH_COMMANDS = [
    { id: "lib", token: "/看库", title: "/看库", hint: "打开参考墙", send: "看库" },
    { id: "filter", token: "/筛选", title: "/筛选", hint: "先收一版短名单", send: "帮我筛选" },
    { id: "report", token: "/结论", title: "/结论", hint: "打开六段报告", send: "出结论" },
    { id: "brief", token: "/brief", title: "/brief", hint: "看 Brief", send: "看 Brief" },
    { id: "new", token: "/新建", title: "/新建", hint: "空白分析", send: "/新建" },
    { id: "toggle", token: "/弹出", title: "/弹出", hint: "弹出或收起结果", send: "/弹出" },
  ];

  const MENTION_ITEMS = [
    { id: "lib", token: "@素材库", title: "@素材库", hint: "只检索本机自有库", send: "看库" },
    { id: "shortlist", token: "@短名单", title: "@短名单", hint: "候选方向", send: "帮我筛选" },
    { id: "report", token: "@结论", title: "@结论", hint: "差异化报告", send: "出结论" },
    { id: "brief", token: "@Brief", title: "@Brief", hint: "听清的项", send: "看 Brief" },
  ];

  function isCmdOpen() {
    return Boolean(el.cmdOverlay && !el.cmdOverlay.hidden);
  }

  function closeCommandPalette() {
    if (!el.cmdOverlay) return;
    el.cmdOverlay.hidden = true;
    state._cmdIndex = 0;
  }

  function filteredCommands(q) {
    const needle = String(q || "").trim().toLowerCase();
    if (!needle) return STUDIO_COMMANDS.slice();
    return STUDIO_COMMANDS.filter((c) => `${c.title} ${c.hint} ${c.keys}`.toLowerCase().includes(needle));
  }

  function renderCommandList(q) {
    if (!el.cmdList) return;
    const items = filteredCommands(q);
    if (!items.length) {
      el.cmdList.innerHTML = `<li class="cmd-empty">没有匹配的指令</li>`;
      return;
    }
    state._cmdIndex = clamp(state._cmdIndex, 0, items.length - 1);
    el.cmdList.innerHTML = items
      .map(
        (c, i) =>
          `<li><button type="button" class="cmd-item${i === state._cmdIndex ? " active" : ""}" data-cmd="${escapeAttr(
            c.id
          )}" role="option" aria-selected="${i === state._cmdIndex ? "true" : "false"}"><strong>${escapeHtml(
            c.title
          )}</strong><span>${escapeHtml(c.hint)}</span></button></li>`
      )
      .join("");
  }

  function openCommandPalette() {
    if (!el.cmdOverlay) return;
    el.cmdOverlay.hidden = false;
    state._cmdIndex = 0;
    if (el.cmdInput) el.cmdInput.value = "";
    renderCommandList("");
    if (el.cmdInput) el.cmdInput.focus();
  }

  function runStudioCommand(id) {
    const cmd = STUDIO_COMMANDS.find((c) => c.id === id);
    closeCommandPalette();
    if (cmd) cmd.run();
  }

  function closeSlashMenu() {
    if (!el.slashMenu) return;
    el.slashMenu.hidden = true;
    el.slashMenu.innerHTML = "";
    state._slashIndex = 0;
    if (el.composerPlus) el.composerPlus.setAttribute("aria-expanded", "false");
  }

  function closeMentionMenu() {
    if (!el.mentionMenu) return;
    el.mentionMenu.hidden = true;
    el.mentionMenu.innerHTML = "";
    state._mentionIndex = 0;
  }

  function filteredSlash(q) {
    const needle = String(q || "").replace(/^\//, "").toLowerCase();
    return SLASH_COMMANDS.filter((c) => !needle || `${c.title} ${c.hint}`.toLowerCase().includes(needle));
  }

  function renderSlashMenu(q) {
    if (!el.slashMenu) return;
    const items = filteredSlash(q);
    if (!items.length) {
      closeSlashMenu();
      return;
    }
    state._slashIndex = clamp(state._slashIndex, 0, items.length - 1);
    el.slashMenu.hidden = false;
    if (el.composerPlus) el.composerPlus.setAttribute("aria-expanded", "true");
    el.slashMenu.innerHTML = items
      .map(
        (c, i) =>
          `<button type="button" class="slash-item${i === state._slashIndex ? " active" : ""}" data-slash="${escapeAttr(
            c.id
          )}"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(c.hint)}</span></button>`
      )
      .join("");
  }

  function renderMentionMenu(q) {
    if (!el.mentionMenu) return;
    const items = filteredMention(q);
    if (!items.length) {
      closeMentionMenu();
      return;
    }
    state._mentionIndex = clamp(state._mentionIndex, 0, items.length - 1);
    el.mentionMenu.hidden = false;
    el.mentionMenu.innerHTML = items
      .map(
        (c, i) =>
          `<button type="button" class="mention-item${i === state._mentionIndex ? " active" : ""}" data-mention="${escapeAttr(
            c.id
          )}"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(c.hint)}</span></button>`
      )
      .join("");
  }

  function runStudioShortcut(id) {
    if (id === "lib") {
      if (refuseDraftReveal("先问清分析对象，这轮墙还是空的。")) return;
      handleArtifact("map");
      playLibraryRun({ animate: true });
      return;
    }
    if (id === "filter" || id === "shortlist") handleArtifact("shortlist");
    else if (id === "report") handleArtifact("report");
    else if (id === "brief") handleArtifact("brief");
    else if (id === "new") createNewResearch();
    else if (id === "toggle") setArtifactOpen(!state.artifactOpen);
  }

  function pickSlash(id) {
    const item = SLASH_COMMANDS.find((c) => c.id === id);
    closeSlashMenu();
    if (!item) return;
    if (el.composerInput) {
      el.composerInput.value = el.composerInput.value.replace(/^\/[^\s]*/, "").trimStart();
      el.composerInput.focus();
    }
    runStudioShortcut(item.id);
  }

  function pickMention(id) {
    const item = MENTION_ITEMS.find((c) => c.id === id);
    closeMentionMenu();
    if (!item) return;
    if (el.composerInput) {
      el.composerInput.value = el.composerInput.value.replace(/@[^\s]*$/, "").replace(/\s+$/, " ");
      el.composerInput.focus();
    }
    runStudioShortcut(item.id);
  }

  function syncComposerMenus() {
    const v = el.composerInput ? el.composerInput.value : "";
    if (/^\/[^\s]*$/.test(v)) {
      closeMentionMenu();
      renderSlashMenu(v);
      return;
    }
    const mention = v.match(/(@[^\s]*)$/);
    if (mention) {
      closeSlashMenu();
      renderMentionMenu(mention[1]);
      return;
    }
    closeSlashMenu();
    closeMentionMenu();
  }

  function filteredMention(q) {
    const needle = String(q || "").replace(/^@/, "").toLowerCase();
    return MENTION_ITEMS.filter((c) => !needle || `${c.title} ${c.hint}`.toLowerCase().includes(needle));
  }

  function isStudioCommandText(raw) {
    const t = String(raw || "").trim();
    if (!t) return false;
    if (t.startsWith("/") || t.startsWith("@")) return true;
    const n = normalizeComposerText(t).toLowerCase();
    const known = new Set();
    SLASH_COMMANDS.concat(MENTION_ITEMS).forEach((c) => {
      known.add(normalizeComposerText(c.token).toLowerCase());
      known.add(normalizeComposerText(c.send).toLowerCase());
      known.add(normalizeComposerText(c.title).toLowerCase());
    });
    return known.has(n) || /^(看库|帮我筛选|出结论|看\s*brief|brief|弹出|收起|新建分析|新建|筛选|结论|短名单|素材库|本机库)$/i.test(n);
  }

  function resolveComposerAction(raw) {
    const t = String(raw || "").trim();
    if (t === "/" || t === "@") return { kind: "menu-only" };
    if (t.startsWith("/")) {
      const exact = SLASH_COMMANDS.find((c) => c.token.toLowerCase() === t.toLowerCase());
      const hit = exact || filteredSlash(t)[0];
      return hit ? { kind: "slash", id: hit.id } : { kind: "menu-only" };
    }
    if (t.startsWith("@")) {
      const exact = MENTION_ITEMS.find((c) => c.token.toLowerCase() === t.toLowerCase());
      const hit = exact || filteredMention(t)[0];
      return hit ? { kind: "mention", id: hit.id } : { kind: "menu-only" };
    }
    return null;
  }

  function normalizeComposerText(raw) {
    let t = String(raw || "").trim();
    if (t.startsWith("/")) t = t.replace(/^\//, "").trim();
    if (t.startsWith("@")) t = t.replace(/^@/, "").trim();
    return t;
  }

  function scopeContextLine(ref) {
    if (!ref) return "";
    const bits = [ref.title, ref.lane, ref.brief, ref.page || "原页未标注"].filter(Boolean);
    return bits.join(" · ");
  }

  function handleSend(text) {
    const scoped = state.scopeRef;
    let raw = text.trim();
    if (!raw && scoped) raw = `对照这张：${scoped.title}`;
    if (!raw) return;
    appendRun({ kind: "user", detail: scoped && !text.trim() ? `对照这张 · ${scoped.title}` : raw });

    const action = resolveComposerAction(raw);
    if (action) {
      if (action.kind === "slash") pickSlash(action.id);
      else if (action.kind === "mention") pickMention(action.id);
      return;
    }
    if (raw === "/新建" || raw === "新建分析") {
      createNewResearch();
      return;
    }
    if (raw === "/弹出" || raw === "/收起") {
      setArtifactOpen(!state.artifactOpen);
      appendRun({
        title: state.artifactOpen ? "已弹出结果" : "已收起结果",
        detail: "栏宽和收起状态会记住",
      });
      return;
    }

    const pinnedSend = currentResearch();
    if (pinnedSend && pinnedSend.brief && pinnedSend.brief.product) {
      requestPackCollect(pinnedSend.brief.product);
    }

    if (
      !isStudioCommandText(raw) &&
      (state.briefAskKey || (currentResearch().custom && missingBriefSlots().length))
    ) {
      openBriefDialog();
      toast("缺的 Brief 项在对话框里一次填，中栏不再一问一答。");
      return;
    }

    const t = normalizeComposerText(raw);
    const lower = t.toLowerCase();
    if (scoped && (/^对照这张/.test(t) || /^这张图/.test(t))) {
      appendRun({
        title: "对照这张",
        detail: scoped.title,
        jump: "map",
        html: `<p class="run-quiet">${escapeHtml(scopeContextLine(scoped))}。字段没有的仍写未标注，不编评语。</p>`,
        actions: [{ artifact: "map", label: "回到参考墙" }],
      });
      clearScope();
      return;
    }
    const mainN = state.feedCounts.main || 0;
    const pendN = state.feedCounts.pending || 0;
    const lanes = scopeCounts();
    const cards = state.bundle?.l4_cards || [];
    const rec = (state.bundle?.l3?.ai_recommended_buckets || [])
      .map((b) => b.name_zh || b.id)
      .filter(Boolean)
      .slice(0, 5)
      .join(" / ");
    const cardNames = cards.map((c) => c.title).filter(Boolean).join(" / ");

    if (/重筛|重排|按批注/.test(t)) {
      state.houComment = t;
      setStage(4, { appendEvent: false });
      revealAndSwitch("shortlist", { fromStage: true });
      rescreenByComment();
      return;
    }
    if (/brief|意图|分析对象|听清|对齐/i.test(t)) {
      setStage(1);
      revealAndSwitch("intent", { fromStage: true });
      return;
    }
    if (/下载报告|导出报告/.test(t)) {
      setStage(5);
      revealAndSwitch("report", { fromStage: true });
      downloadReportNotes();
      return;
    }
    if (/版图|视觉|看墙|看库|素材库|本机库|穷尽搜索|跨界样本|不同类|货架|自有库|打开库|参考墙|看参考/.test(t)) {
      setStage(3, { appendEvent: false });
      revealAndSwitch("visual", { fromStage: true });
      playLibraryRun({ animate: true });
      if (rec) {
        later(560, () =>
          appendRun({
            title: "先盯这几桶",
            detail: rec,
            html: lanes.cross ? "" : `<p class="run-quiet">跨界 chip 点进去是空的——本轮确实一张没采，不编造。</p>`,
          })
        );
      }
      return;
    }
    if (/筛选|短名单|选参考|收几张|入选/.test(t)) {
      openDecisionLayer("shortlist");
      return;
    }
    if (/报告|结论|差异化|机会|下一步|纪要/.test(t)) {
      openDecisionLayer("report");
      return;
    }
    if (/方向假设|策略卡|三张方向|三张卡/.test(t)) {
      setStage(5);
      revealAndSwitch("report", { fromStage: true });
      appendRun({
        title: "方向卡",
        detail: cards.length ? cardNames : "这轮还没有",
        status: cards.length ? "warn" : "done",
        html: cards.length
          ? `<p class="run-quiet">挂在结论第 5 段「差异化机会」里，先看样本结构再决定留哪张。</p>`
          : `<p class="run-quiet">青绿茶礼盒那轮有三张方向卡。</p>`,
      });
      return;
    }
    if (/crawler|采集|同步/.test(lower) || /同步|采集/.test(t)) {
      setCap("crawler", "idle", `主墙 ${mainN} · 待复核 ${pendN}`);
      setStage(2, { appendEvent: false });
      revealAndSwitch("visual", { fromStage: true });
      appendRun({
        actor: "采集",
        title: "不发起新采集",
        detail: `主墙 ${mainN} · 待复核 ${pendN}`,
        html: `<p class="run-quiet">跨界 ${lanes.cross}、货架 ${lanes.shelf} 都还是缺口，我不假装连上了。</p>`,
      });
      return;
    }
    const agentId = /点点|打标|维度/.test(t)
      ? "dotdot"
      : /采集|穷尽|货架通道/.test(t)
        ? "crawler"
        : "orchestrator";
    if (!llmReady()) {
      appendRun({
        title: "还没接模型",
        status: "warn",
        html: `<p class="run-quiet">点右下角「模型」或齿轮，贴一套 API。也可以直接说「看 Brief」「看版图」「帮我筛选」「出结论」。</p>`,
      });
      openLlmSettings();
      return;
    }
    const useId = "orchestrator";
    const meta = AGENT_LLM_META.find((m) => m.id === useId);
    state.llmBusy = true;
    if (el.sendBtn) el.sendBtn.disabled = true;
    const pending = appendRun({
      actor: meta.name,
      title: meta.name,
      detail: "在想…",
      status: "working",
    });
    askAgent(useId, scoped ? `${t}\n\n[对照这张参考：${scopeContextLine(scoped)}]` : t)
      .then((reply) => {
        finishRun(pending, { status: "done", detail: "回复", html: mdLite(reply) });
        clearScope();
      })
      .catch((err) => {
        finishRun(pending, {
          status: "fail",
          title: "没打通",
          detail: "",
          html: `<p>${escapeHtml(err.message || String(err))}</p>
            <p class="run-quiet">检查 API Key、模型名，以及是不是用 key_vision_server.py 打开的本页。</p>`,
        });
        clearScope();
      })
      .finally(() => {
        state.llmBusy = false;
        if (el.sendBtn) el.sendBtn.disabled = false;
      });
  }

  async function applyResearch(id) {
    const r = RESEARCHES.find((x) => x.id === id);
    if (!r) return;
    RESEARCHES.forEach((x) => (x.active = x.id === id));
    state.activeResearchId = id;
    state.selectedIds.clear();
    state.shortlistVisual = [];
    state.shortlistReasons = {};
    state.shortlistRemoved = new Set();
    state.shortlistTouched = false;
    state.shortlistAuto = false;
    state.houComment = "";
    state.chatTurns = [];
    state.decisions = {};
    state.activeCat = "all";
    state.activeSource = null;
    state.activeStyleFilter = "";
    state.activeLibLane = "";
    state.activeMarketStyle = "";
    state.briefAskKey = "";
    state.pendingItems = [];
    state.includePending = false;
    closeInspector();
    clearScope();
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
    closeBriefDialog();
    if (!(r.custom && r.emptyWall)) toast(`正在打开「${r.title}」…`);
    try {
      if (r.id === "r-green") {
        if (state._greenBundle) state.bundle = state._greenBundle;
        else state.bundle = await loadProductBundle();
        (state.bundle.l4_cards || []).forEach((c) => {
          state.decisions[c.card_id] = c.hou_decision || "pending";
        });
      } else if (r.custom) {
        if (!state._greenBundle && state.bundle?.l4_cards?.length) {
          state._greenBundle = state.bundle;
        }
        state.bundle = emptyBundleFor(r);
      } else {
        if (!state._greenBundle && state.bundle?.l4_cards?.length) {
          state._greenBundle = state.bundle;
        }
        // 白酒/滋补只有落地墙：L1 除了品名都还没填，L4/L5 一律不借用茶礼那轮的卡
        state.bundle = {
          bucket_id_to_zh: (state.bundle && state.bundle.bucket_id_to_zh) || {},
          l1: {
            brief_id: r.id,
            raw_brief: r.question,
            input: { product: r.title.replace(/竞品调研|调研|开箱记忆点/g, "").trim() || r.title },
            intent: {},
          },
          l3: { counts: {}, ai_recommended_buckets: [], l1_summary: {} },
          l4_cards: [],
        };
      }
      await loadLiveFeeds(r);
      if (r.id === "r-green") ensureShortlist();
      else if (isBenyanResearch(r) && !isDraftInterview(r)) ensureShortlist();
      setCap("orchestrator", "online", `正在看「${r.title}」`);
      seedStream();
      if (r.custom) {
        state.stage = 1;
        syncStageButtons(1);
        state.holdResults = isDraftInterview(r);
        state.tab = "intent";
        document.querySelectorAll(".tab").forEach((t) => {
          const on = t.dataset.tab === "intent";
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        if (el.canvasBody) el.canvasBody.innerHTML = "";
        setArtifactOpen(!state.holdResults);
        if (!state.holdResults) renderCanvas();
        syncQuestionMode();
        syncPhaseWhisper();
        syncResultChrome();
        if (state.holdResults) openBriefDialog();
        toast(state.holdResults ? "缺的 Brief 项在对话框里填。" : `正在打开「${r.title}」`);
      } else {
        state.holdResults = false;
        state.stage = 3;
        syncStageButtons(3);
        switchTab("visual", { fromStage: true, reveal: true });
        syncQuestionMode();
        if (!r.onlyBriefDefault) {
          appendRun({
            title: "打开自有库",
            detail: `${state.feedCounts.main} 张`,
            html: `<p class="run-quiet">这轮 Brief 还没录入，客群、红线都是未标注。茶礼那轮的方向卡不会跟过来。</p>`,
          });
          openBriefDialog();
        }
      }
    } catch (err) {
      console.warn(err);
      state.holdResults = false;
      toast("这轮研究的墙还没挂上");
    }
  }

  function updateQCount() {
    if (!el.researchQuestion || !el.qCount) return;
    const n = el.researchQuestion.value.length;
    el.qCount.textContent = `${n}/200`;
  }

  function copyReportNotes() {
    const panel = el.canvasBody.querySelector(".report-panel");
    const text = panel ? String(panel.innerText || "").replace(/\n{3,}/g, "\n\n").trim() : "";
    if (!text) {
      toast("报告还没出来");
      return;
    }
    const done = () => toast("要点已复制，可贴进纪要或群");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      toast("复制失败，请手动划选");
    }
    ta.remove();
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
      if (!id || id === "all") state.activeSource = null;
      else state.activeSource = state.activeSource === id ? null : id;
      renderSources();
      const src =
        state.sources.find((s) => s.id === id) ||
        (SOURCE_META[id] ? { id, label: SOURCE_META[id].label, status: "ok", statusText: "" } : null);
      state.wallVisibleLimit = WALL_BATCH_INITIAL;
      toast(
        !id || id === "all"
          ? "全部出处"
          : `${src?.label || id}：${src?.statusText || "按来源过滤主墙"}`
      );
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
        if (state.includePending) {
          toast("正在加载待复核…");
          loadPendingFeed().then(() => {
            updateWallCountBar();
            renderCanvas();
          });
        } else {
          toast("已隐藏待复核");
        }
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

    el.canvasBody.addEventListener("input", (e) => {
      const box = e.target.closest("#houCommentBox");
      if (box) state.houComment = box.value;
      if (e.target.closest("[data-brief-field]")) saveCustomBriefFromDom();
    });
    el.canvasBody.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.closest("#houCommentBox")) {
        e.preventDefault();
        rescreenByComment();
      }
    });

    el.canvasBody.addEventListener("click", (e) => {
      if (e.target.closest("[data-wall-link]")) return;
      const copyBtn = e.target.closest("[data-report-action='copy']");
      if (copyBtn) {
        copyReportNotes();
        return;
      }
      const dlBtn = e.target.closest("[data-report-action='download']");
      if (dlBtn) {
        downloadReportNotes();
        return;
      }
      const slAction = e.target.closest("[data-shortlist-action]");
      if (slAction) {
        const act = slAction.dataset.shortlistAction;
        if (act === "rescreen") rescreenByComment();
        else if (act === "refill") {
          state.shortlistRemoved = new Set();
          state.shortlistTouched = false;
          state.shortlistVisual = [];
          state.shortlistReasons = {};
          ensureShortlist();
          renderCanvas();
          toast(
            isBenyanResearch()
              ? benyanShortlistFormed()
                ? `按采回袋面入选 ${state.shortlistVisual.length} 款，待复核，不报产品过`
                : "短名单未成立，只报缺口"
              : `又收了 ${state.shortlistVisual.length} 款 · 还是那 452 张墙`
          );
        }
        return;
      }
      const remove = e.target.closest("[data-shortlist-remove]");
      if (remove) {
        const id = remove.dataset.shortlistRemove;
        const it = findWallItem(id);
        state.shortlistRemoved.add(id);
        state.shortlistTouched = true;
        state.shortlistVisual = state.shortlistVisual.filter((x) => x.id !== id);
        delete state.shortlistReasons[id];
        renderCanvas({ preserveScroll: true });
        toast(`拿掉了「${humanTitle(it?.title || id).slice(0, 12)}」· 重筛时不会再来`);
        return;
      }
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
                clearScope();
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
        toast("对比还没接上，先在检查器里一张张看");
        return;
      }
      if (act === "shortlist") {
        if (isBenyanResearch()) {
          toast(
            benyanShortlistFormed()
              ? "短名单只认 api 采回袋面，不从茶墙凑"
              : "短名单未成立：墙上还没有 api 采回袋面，不当选型"
          );
          return;
        }
        ensureShortlist();
        const seen = new Set(state.shortlistVisual.map((x) => x.id));
        let added = 0;
        ids.forEach((id) => {
          const it = findWallItem(id);
          if (!it || it.pending || it.qc_status === "pending_review") return;
          if (seen.has(it.id)) return;
          state.shortlistRemoved.delete(it.id);
          state.shortlistVisual.push(it);
          state.shortlistReasons[it.id] = reasonFor(it).concat("你自己从墙上勾进来的");
          seen.add(it.id);
          added += 1;
        });
        if (!added) toast(n ? "这些已在短名单里了（或还不能收）" : "先勾几张再收");
        else {
          state.shortlistTouched = true;
          toast(`已收进短名单 ${added} 张 · 共 ${state.shortlistVisual.length}`);
          appendEvent({
            agent: "奎燕设计智能体",
            time: "现在",
            tag: "L4 决策筛选",
            tagClass: "consensus",
            dot: "ok",
            html: `<p>你从墙上勾的 ${added} 张已进短名单，现在一共 ${state.shortlistVisual.length} 款。理由那栏我按字段补好了，写句批注还能再重排。</p>
              <div class="chips-row"><button type="button" class="artifact-link" data-artifact="shortlist">看看短名单</button></div>`,
          });
        }
        return;
      }
      if (act === "keep") {
        toast(n ? `这 ${n} 张先留在参考墙，不进短名单` : "先勾几张");
        return;
      }
      if (act === "exclude") {
        ids.forEach((id) => {
          state.selectedIds.delete(id);
          state.shortlistRemoved.add(id);
          state.shortlistVisual = state.shortlistVisual.filter((x) => x.id !== id);
        });
        closeInspector();
        clearScope();
        updateSelectionBar();
        syncWallSelectionClasses();
        toast(n ? `已从本轮选择里排除 ${n} 张，墙还留着` : "先勾几张");
        return;
      }
      if (act === "open") {
        const it = findWallItem(state.focusId || ids[0]);
        const href = pageUrlOf(it);
        if (href) window.open(href, "_blank", "noopener");
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
        switchTab("report", { fromStage: true });
        return;
      }
      const jumpRun = e.target.closest(".run[data-jump]");
      if (jumpRun && !e.target.closest("button, a, input, textarea")) {
        handleArtifact(jumpRun.dataset.jump);
      }
    });

    el.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      if (state.llmBusy) return;
      if (el.slashMenu && !el.slashMenu.hidden) {
        const items = filteredSlash(el.composerInput.value);
        if (items[state._slashIndex]) {
          pickSlash(items[state._slashIndex].id);
          return;
        }
      }
      if (el.mentionMenu && !el.mentionMenu.hidden) {
        const needle = (el.composerInput.value.match(/@[^\s]*$/) || ["@"])[0];
        const items = filteredMention(needle);
        if (items[state._mentionIndex]) {
          pickMention(items[state._mentionIndex].id);
          return;
        }
      }
      closeSlashMenu();
      closeMentionMenu();
      const v = el.composerInput.value;
      el.composerInput.value = "";
      handleSend(v);
    });

    el.composerInput.addEventListener("input", () => syncComposerMenus());
    el.composerInput.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      const slashOpen = el.slashMenu && !el.slashMenu.hidden;
      const mentionOpen = el.mentionMenu && !el.mentionMenu.hidden;
      if ((slashOpen || mentionOpen) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const mentionTok = (el.composerInput.value.match(/@[^\s]*$/) || ["@"])[0];
        const items = slashOpen
          ? filteredSlash(el.composerInput.value)
          : MENTION_ITEMS.filter((c) => {
              const n = mentionTok.replace(/^@/, "").toLowerCase();
              return !n || `${c.title} ${c.hint}`.toLowerCase().includes(n);
            });
        if (!items.length) return;
        const key = slashOpen ? "_slashIndex" : "_mentionIndex";
        const next = state[key] + (e.key === "ArrowDown" ? 1 : -1);
        state[key] = (next + items.length) % items.length;
        if (slashOpen) renderSlashMenu(el.composerInput.value);
        else renderMentionMenu(mentionTok);
        return;
      }
      if ((slashOpen || mentionOpen) && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (slashOpen) {
          const items = filteredSlash(el.composerInput.value);
          if (items[state._slashIndex]) pickSlash(items[state._slashIndex].id);
        } else {
          const needle = (el.composerInput.value.match(/@[^\s]*$/) || ["@"])[0];
          const items = MENTION_ITEMS.filter((c) => {
            const n = needle.replace(/^@/, "").toLowerCase();
            return !n || `${c.title} ${c.hint}`.toLowerCase().includes(n);
          });
          if (items[state._mentionIndex]) pickMention(items[state._mentionIndex].id);
        }
        return;
      }
      if ((slashOpen || mentionOpen) && e.key === "Escape") {
        e.preventDefault();
        closeSlashMenu();
        closeMentionMenu();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.composer.requestSubmit();
      }
    });

    el.inspectorBody.addEventListener("click", (e) => {
      const copyBtn = e.target.closest("[data-copy-url]");
      if (!copyBtn) return;
      const url = copyBtn.getAttribute("data-copy-url") || "";
      if (!url) {
        toast("这张还没有可打开的原页");
        return;
      }
      const done = () => {
        copyBtn.textContent = "已复制";
        toast("原页链接已复制，可贴给客户核对");
        window.setTimeout(() => {
          if (copyBtn.isConnected) copyBtn.textContent = "复制链接";
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
      } else {
        fallbackCopy(url, done);
      }
    });

    el.inspectorToggle.addEventListener("click", () => {
      closeInspector();
      // keep selection bar if still selected; only hide panel
      updateSelectionBar();
      syncWallSelectionClasses();
    });

    el.capList.addEventListener("click", (e) => {
      const gear = e.target.closest("[data-llm-agent]");
      if (gear) {
        e.preventDefault();
        e.stopPropagation();
        openLlmSettings(gear.dataset.llmAgent);
        return;
      }
      const card = e.target.closest(".cap-card");
      if (!card) return;
      openLlmSettings(card.dataset.id);
    });

    el.researchList.addEventListener("click", (e) => {
      const card = e.target.closest(".research-card");
      if (!card) return;
      const id = card.dataset.id;
      if (!id || id === state.activeResearchId) return;
      applyResearch(id);
    });

    if (el.btnNew) {
      el.btnNew.addEventListener("click", () => createNewResearch());
    }
    if (el.btnSettings) el.btnSettings.addEventListener("click", () => openLlmSettings("orchestrator"));
    if (el.btnCapConfig) el.btnCapConfig.addEventListener("click", () => openLlmSettings("orchestrator"));
    if (el.btnToggleArtifact) {
      el.btnToggleArtifact.addEventListener("click", () => setArtifactOpen(!state.artifactOpen));
    }
    if (el.btnRailCollapse) {
      el.btnRailCollapse.addEventListener("click", () => setRailCollapsed(!layoutState.railCollapsed));
    }
    if (el.btnFilterCompact) {
      el.btnFilterCompact.addEventListener("click", () => setFiltersCompact(!layoutState.filtersCompact));
    }
    if (el.btnCommandPalette) {
      el.btnCommandPalette.addEventListener("click", () => openCommandPalette());
    }
    if (el.btnNavResult) {
      el.btnNavResult.addEventListener("click", () => revealAndSwitch("visual", { fromStage: true }));
    }
    if (el.btnNavTags) {
      el.btnNavTags.addEventListener("click", () => {
        revealAndSwitch("visual", { fromStage: true });
        const styles = document.getElementById("marketStyles");
        if (styles) styles.scrollIntoView({ block: "nearest" });
        toast("风格标签来自已有桶，不是另爬一套");
      });
    }
    if (el.btnNavReport) {
      el.btnNavReport.addEventListener("click", () => openDecisionLayer("report"));
    }
    if (el.btnNavChat) {
      el.btnNavChat.addEventListener("click", () => {
        if (el.composerInput) el.composerInput.focus();
      });
    }
    if (el.btnNavSearch) {
      el.btnNavSearch.addEventListener("click", () => {
        setRailCollapsed(false);
        if (el.railSearch) {
          el.railSearch.focus();
          el.railSearch.select();
        }
      });
    }
    if (el.btnDockGear) {
      el.btnDockGear.addEventListener("click", () => openLlmSettings("orchestrator"));
    }
    if (el.btnCloseResult) {
      el.btnCloseResult.addEventListener("click", () => setArtifactOpen(false));
    }
    if (el.composerPlus) {
      el.composerPlus.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (el.slashMenu && !el.slashMenu.hidden) {
          closeSlashMenu();
          return;
        }
        if (el.composerInput) {
          if (!el.composerInput.value.startsWith("/")) el.composerInput.value = "/";
          el.composerInput.focus();
        }
        renderSlashMenu(el.composerInput ? el.composerInput.value : "/");
      });
    }
    if (el.composer) {
      el.composer.addEventListener("click", (e) => {
        if (e.target.closest("button, a, input, select, textarea, .slash-menu, .mention-menu, .scope-chips")) return;
        if (el.composerInput) el.composerInput.focus();
      });
    }
    if (el.composerLibChip) {
      el.composerLibChip.addEventListener("click", () => {
        if (refuseDraftReveal("先问清分析对象，这轮墙还是空的。")) return;
        revealAndSwitch("visual", { fromStage: true });
        playLibraryRun({ animate: true });
      });
    }
    if (el.scopeChips) {
      el.scopeChips.addEventListener("click", (e) => {
        if (e.target.closest("[data-clear-scope]")) {
          e.preventDefault();
          clearScope();
        }
      });
    }
    if (el.composerSlash) {
      el.composerSlash.addEventListener("click", () => {
        if (el.composerInput) {
          el.composerInput.value = "/";
          el.composerInput.focus();
        }
        renderSlashMenu("/");
      });
    }
    if (el.slashMenu) {
      el.slashMenu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-slash]");
        if (btn) pickSlash(btn.dataset.slash);
      });
    }
    if (el.mentionMenu) {
      el.mentionMenu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-mention]");
        if (btn) pickMention(btn.dataset.mention);
      });
    }
    if (el.cmdOverlay) {
      el.cmdOverlay.addEventListener("click", (e) => {
        if (e.target === el.cmdOverlay) closeCommandPalette();
      });
    }
    if (el.cmdList) {
      el.cmdList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cmd]");
        if (btn) runStudioCommand(btn.dataset.cmd);
      });
    }
    if (el.cmdInput) {
      el.cmdInput.addEventListener("input", () => {
        state._cmdIndex = 0;
        renderCommandList(el.cmdInput.value);
      });
      el.cmdInput.addEventListener("keydown", (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        const items = filteredCommands(el.cmdInput.value);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!items.length) return;
          const next = state._cmdIndex + (e.key === "ArrowDown" ? 1 : -1);
          state._cmdIndex = (next + items.length) % items.length;
          renderCommandList(el.cmdInput.value);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (items[state._cmdIndex]) runStudioCommand(items[state._cmdIndex].id);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          closeCommandPalette();
        }
      });
    }
    document.addEventListener("keydown", (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCmdOpen()) closeCommandPalette();
        else openCommandPalette();
        return;
      }
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setRailCollapsed(!layoutState.railCollapsed);
        return;
      }
      if (e.key === "Escape") {
        if (isCmdOpen()) {
          e.preventDefault();
          closeCommandPalette();
          return;
        }
        if (el.briefOverlay && !el.briefOverlay.hidden) {
          e.preventDefault();
          closeBriefDialog();
          return;
        }
        if (el.llmOverlay && !el.llmOverlay.hidden) {
          e.preventDefault();
          closeLlmSettings();
          return;
        }
        closeSlashMenu();
        closeMentionMenu();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#composer")) return;
      closeSlashMenu();
      closeMentionMenu();
    });
    if (el.composerModel) {
      el.composerModel.addEventListener("click", () => openLlmSettings("orchestrator"));
    }
    if (el.railSearch) {
      el.railSearch.addEventListener("input", () => {
        state.railQuery = el.railSearch.value || "";
        renderResearch();
      });
    }
    bindLayoutPanes();
    syncResultChrome();
    if (el.libraryLanes) {
      el.libraryLanes.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-lib]");
        if (!chip) return;
        const lane = chip.dataset.lib || "";
        state.activeLibLane = state.activeLibLane === lane ? "" : lane;
        el.libraryLanes.querySelectorAll(".lib-chip").forEach((c) => {
          const id = c.dataset.lib || "";
          c.classList.toggle("active", id === state.activeLibLane);
        });
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        if (state.tab !== "visual") switchTab("visual", { fromStage: true });
        else renderCanvas();
      });
    }
    if (el.marketStyles) {
      el.marketStyles.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-mstyle]");
        if (!chip) return;
        const id = chip.dataset.mstyle || "";
        state.activeMarketStyle = state.activeMarketStyle === id ? "" : id;
        renderMarketStyles();
        state.wallVisibleLimit = WALL_BATCH_INITIAL;
        if (state.tab !== "visual") switchTab("visual", { fromStage: true });
        else renderCanvas();
      });
    }
    if (el.userChip && el.userMenu) {
      el.userChip.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = el.userMenu.hasAttribute("hidden");
        if (open) el.userMenu.removeAttribute("hidden");
        else el.userMenu.setAttribute("hidden", "");
        el.userChip.setAttribute("aria-expanded", open ? "true" : "false");
      });
      el.userMenu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-user-action]");
        if (!btn) return;
        const act = btn.dataset.userAction;
        el.userMenu.setAttribute("hidden", "");
        if (act === "llm") openLlmSettings("orchestrator");
        else if (act === "profile") toast("席位资料本机保存，不写进仓库");
        else if (act === "help") {
          appendRun({
            title: "怎么用",
            html: `<p>左边是任务和席位，Ctrl+B 可收成图标栏。中间是对话。右边像 ChatGPT Canvas / Claude Artifact，随时弹出。Ctrl+K 打开命令面板，输入框用 / 指令、@ 调素材库。</p>
              <p class="run-quiet">底层还是问清 → 检索库 → 打标 → 筛选 → 报告。界面不再做成五步向导。</p>`,
          });
        }
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest("#userDock")) el.userMenu.setAttribute("hidden", "");
      });
    }
    bindLlmFormEvents();
    bindBriefDialog();

    const attachRow = document.querySelector(".attach-row");
    if (attachRow) {
      attachRow.addEventListener("click", (e) => {
        const b = e.target.closest("[data-attach]");
        if (!b) return;
        toast("本版不支持上传附件");
      });
    }

    el.researchQuestion.addEventListener("input", () => {
      updateQCount();
      const r = currentResearch();
      if (r && r.custom) {
        r.question = el.researchQuestion.value;
        persistCustomResearches();
      }
    });

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
        state.activeLibLane = "";
        state.activeMarketStyle = "";
        if (el.libraryLanes) {
          el.libraryLanes.querySelectorAll(".lib-chip").forEach((c) => {
            c.classList.toggle("active", !c.dataset.lib);
          });
        }
        renderMarketStyles();
        renderCanvas();
        updateWallCountBar();
      } else if (act === "open-intent") {
        setStage(1);
        switchTab("intent", { fromStage: true });
      } else if (act === "open-shortlist") {
        setStage(4);
        switchTab("shortlist", { fromStage: true });
      } else if (act === "open-report" || act === "ask-strategy" || act === "open-strategy") {
        setStage(5);
        switchTab("report", { fromStage: true });
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

    loadLlmAgents();
    hydrateCustomResearches();
    renderCaps();
    renderResearch();
    renderSources();
    setArtifactOpen(true);
    bindEvents();
    loadMarketStyles();
    syncLlmUi();
    probeLlmProxy();
    closeInspector();
    updateSelectionBar();
    updateQCount();
    updateFilterRow();
    if (el.canvasBody) {
      el.canvasBody.innerHTML = `<div class="empty"><div class="slogan">墙还在长</div><p class="hint">正在把和 brief 更贴的参考搬上来…</p><button type="button" class="empty-cta" data-empty-action="open-intent">先看这次要搞清的事</button></div>`;
    }
    try {
      // 0) L3 维度合同：检查器与 L5 覆盖表都靠它，缺了就只能写未标注
      await loadClassifyDims();

      // 1) Live feeds first for the visual wall
      let feedsOk = false;
      const bootR = RESEARCHES.find((x) => x.id === "r-green") || LANDING_RESEARCHES[0];
      RESEARCHES.forEach((x) => (x.active = x.id === bootR.id));
      state.activeResearchId = bootR.id;
      try {
        await loadLiveFeeds(bootR);
        feedsOk = true;
      } catch (feedErr) {
        console.warn("live feeds", feedErr);
      }

      // 2) Product pack for L1 brief + L4 strategy cards.
      // Skip empty-l4 stubs / unsafe image_gate packs and fall through to product-pack.
      try {
        state.bundle = await loadProductBundle();
      } catch (bundleErr) {
        console.warn("product bundle", bundleErr);
        state.bundle = { l4_cards: [], l1: {}, l3: { counts: {} } };
        toast("Brief 与方向假设暂时读不到，先看主墙");
      }
      state._greenBundle = state.bundle;
      (state.bundle.l4_cards || []).forEach((c) => {
        state.decisions[c.card_id] = c.hou_decision || "pending";
      });
      const q0 = bootR.question || "";
      if (el.researchQuestion) {
        el.researchQuestion.value = q0.slice(0, 200);
        updateQCount();
      }
      if (el.researchTitle) el.researchTitle.textContent = bootR.title;
      syncQuestionMode();

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
      syncRunStep(3);
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
