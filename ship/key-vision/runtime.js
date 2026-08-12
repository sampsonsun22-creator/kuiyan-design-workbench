/* KEY 视界 · data landing runtime (L1 mapper / coarse tag / 4-wall / L4 cards)
 * Loaded before app.js. Does not rewrite locked 452/2680 jsonl.
 */
(function (global) {
  "use strict";

  const BUCKET_IDS = [
    "chinese_modern",
    "chinese_ceremonial",
    "global_minimal",
    "swiss_international",
    "natural_organic",
    "luxury_gilt",
    "minimal_white",
    "color_youth",
    "cartoon_ip",
    "retro_nostalgia",
    "craft_material",
    "appetite_photo",
    "illustration_story",
    "efficacy_hammer",
    "regional_culture",
    "pet_cute",
    "maternal_safe",
    "nightlife_trend",
    "sustainable_plain",
    "art_collab",
  ];

  const RULES = [
    ["illustration_story", [/插画/i, /illustration/i, /手绘/i, /story illustr/i]],
    ["luxury_gilt", [/奢华/i, /金箔/i, /烫金/i, /\bgilt\b/i, /\bluxury\b/i, /black gold/i]],
    ["minimal_white", [/极简白/i, /白盒/i, /minimal white/i, /white box/i]],
    ["natural_organic", [/自然有机/i, /\borganic\b/i, /草本/i, /\bherbal\b/i, /绿叶/i]],
    ["regional_culture", [/地域/i, /文旅/i, /地方特产/i, /\bregional\b/i, /非遗/i, /产地/i]],
    ["craft_material", [/材质/i, /工艺/i, /特种纸/i, /\bcraft\b/i, /\bemboss/i, /纸感/i]],
    ["appetite_photo", [/食欲/i, /food photo/i, /实拍食品/i, /\bappetite\b/i]],
    ["color_youth", [/年轻潮/i, /色彩冲击/i, /荧光/i, /\by2k\b/i, /colorful youth/i]],
    ["cartoon_ip", [/卡通/i, /ip联名/i, /萌系/i, /\bcartoon\b/i, /\bmascot\b/i]],
    ["retro_nostalgia", [/复古/i, /怀旧/i, /\bretro\b/i, /\bvintage\b/i]],
    ["efficacy_hammer", [/功效/i, /成分/i, /视觉锤/i, /visual\s*hammer/i, /语言钉/i]],
    ["pet_cute", [/宠物/i, /猫粮/i, /狗粮/i, /\bpet food\b/i]],
    ["maternal_safe", [/母婴/i, /\bbaby\b/i, /婴幼儿/i]],
    ["sustainable_plain", [/可持续/i, /环保/i, /再生纸/i, /sustainable/i, /eco[- ]?friendly/i]],
    ["chinese_modern", [/中式现代/i, /新中式/i, /chinese modern/i, /国潮(?!礼)/i]],
    [
      "chinese_ceremonial",
      [/中式典雅/i, /礼赠仪式/i, /tea gift/i, /开箱仪式/i, /锦盒/i, /腰封/i],
    ],
    ["global_minimal", [/国际简约/i, /极简(?!白)/i, /\bminimal\b/i, /\bswiss\b/i, /干净留白/i]],
  ];

  const SHELF_SOURCES = /^(jd|taobao|tmall|tmall-taobao)$/i;
  const ANALOGY_RE =
    /黄酒|白酒|滋补|阿胶|人参|燕窝|咖啡|香氛|sake|huangjiu|tonic|coffee|wine gift|国潮美妆|巧克力|糕点|高端水|wine box/i;
  const TEA_RE = /茶|tea|matcha|绿茶|青茶/i;
  const GIFT_RE = /礼盒|gift\s*box|giftbox|礼赠/i;

  function hash32(s) {
    let h = 2166136261;
    const str = String(s || "");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function blobOf(item) {
    const extra = item.extra || {};
    const theme = Array.isArray(extra.theme) ? extra.theme.join(" ") : extra.theme || "";
    return [
      item.title || "",
      item.query_used || "",
      (item.raw_tags || []).join(" "),
      item.author_or_brand || "",
      item.category_label || "",
      theme,
    ]
      .join(" ")
      .toLowerCase();
  }

  function coarseTag(item, stylePrior) {
    const existing = (item.suggested_style_buckets || []).filter((b) =>
      BUCKET_IDS.includes(b)
    );
    if (existing.length) return existing.slice(0, 3);
    const text = blobOf(item);
    const hits = [];
    for (const [bid, pats] of RULES) {
      if (pats.some((p) => p.test(text))) {
        hits.push(bid);
        if (hits.length >= 3) return hits;
      }
    }
    if (hits.length) return hits.slice(0, 3);
    const prior = (stylePrior || []).filter((b) => BUCKET_IDS.includes(b));
    if (prior.length) {
      const i = hash32(item.id || item.title) % prior.length;
      return [prior[i], prior[(i + 1) % prior.length]].slice(0, 2);
    }
    if (/packag|包装|礼盒|gift/i.test(text)) return ["chinese_modern", "global_minimal"];
    return ["chinese_modern"];
  }

  function classifyWall(item, briefSpec) {
    const src = String(item.source || "").toLowerCase();
    const st = String(item.source_type || "").toLowerCase();
    const market = item.is_on_market;
    if (
      st === "shelf" ||
      market === true ||
      market === "true" ||
      SHELF_SOURCES.test(src)
    ) {
      return "shelf";
    }
    if (item.analogy_from) return "analogy";
    const rel = item.extra && item.extra.brief_relevance_v1;
    if (rel === "keep_analogy") return "analogy";
    const text = blobOf(item);
    const analogyTerms = (briefSpec && briefSpec.analogy_terms) || [];
    if (analogyTerms.length && analogyTerms.some((t) => t && text.includes(String(t).toLowerCase()))) {
      const core = (briefSpec.core_terms || []).filter(Boolean);
      const hitCore = core.some((t) => text.includes(String(t).toLowerCase()));
      if (!hitCore) return "analogy";
    }
    if (ANALOGY_RE.test(text) && !TEA_RE.test(text)) return "analogy";
    if (ANALOGY_RE.test(text) && GIFT_RE.test(text) && !TEA_RE.test(text)) return "analogy";
    return "primary";
  }

  function scoreAgainstSpec(item, spec) {
    if (!spec) return "match";
    const pre = item.extra && item.extra.brief_relevance_v1;
    if (pre === "pass_brief" || pre === "keep_core" || pre === "keep_analogy") return "match";
    if (pre === "pending_low_relevance" || pre === "soft_pack_only") return "low";
    if (pre === "pending_offtopic" || pre === "kill_noise" || pre === "kill_unrelated") {
      return "off";
    }
    const text = blobOf(item);
    const has = (terms) =>
      (terms || []).some((t) => t && text.includes(String(t).toLowerCase()));
    const core = has(spec.core_terms);
    const analogy = has(spec.analogy_terms);
    const noise = has(spec.noise_terms);
    const pack = /包装|packag|礼盒|gift|盒|tin|carton/i.test(text);
    if (noise && !core && !analogy) return "off";
    if (core && pack) return "match";
    if (analogy && pack) return "match";
    if (core) return "match";
    if (pack) return "low";
    return "off";
  }

  function mapBrief(text, ontology, researches) {
    const q = String(text || "").trim();
    const lower = q.toLowerCase();
    let bestResearch = null;
    let bestScore = 0;
    (researches || []).forEach((r) => {
      const spec = r.brief_spec || {};
      let s = 0;
      (spec.core_terms || []).forEach((t) => {
        if (t && lower.includes(String(t).toLowerCase())) s += 3;
      });
      if (r.title && q.includes(r.title.slice(0, 4))) s += 2;
      if (s > bestScore) {
        bestScore = s;
        bestResearch = r;
      }
    });
    if (bestResearch && bestScore >= 3) {
      return { kind: "research", research: bestResearch, score: bestScore };
    }
    let bestDom = null;
    let domScore = 0;
    (ontology || []).forEach((d) => {
      let s = 0;
      if (d.name && q.includes(d.name)) s += 4;
      (d.examples || []).forEach((ex) => {
        if (ex && q.includes(ex)) s += 3;
      });
      (d.analogy_seeds || []).forEach((ex) => {
        if (ex && q.includes(ex)) s += 1;
      });
      if (d.id && lower.includes(d.id.replace(/_/g, " "))) s += 2;
      if (s > domScore) {
        domScore = s;
        bestDom = d;
      }
    });
    const domain = bestDom || {
      id: "other_fmcg",
      name: "其他快消包装",
      analogy_seeds: [],
    };
    const tone = /中式现代|新中式/.test(q)
      ? "中式现代"
      : /国际|极简|简约/.test(q)
        ? "国际简约"
        : "中式现代";
    const channel = /电商/.test(q) && /礼/.test(q) ? "礼赠 + 电商" : /电商/.test(q) ? "电商" : "礼赠";
    return {
      kind: "mapped",
      score: domScore,
      l1: {
        brief_id: "brief-adhoc-" + Date.now(),
        raw_brief: q,
        input: {
          brand: "（新研究）",
          product: q.slice(0, 24) || "包装研究",
          category_text: domain.name,
          channel,
          audience: "待补充",
          price_band: "中高端",
          culture_tone: tone,
          must_have: ["开箱记忆点", "差异化", tone + "气质"],
          must_avoid: ["仿古堆砌", "廉价喜庆模板"],
        },
        intent: {
          domain_id: domain.id,
          domain_label_zh: domain.name,
          confidence: Math.min(0.9, 0.45 + domScore * 0.08),
          style_prior: ["chinese_modern", "chinese_ceremonial", "global_minimal", "craft_material"],
          analogy_plan: (domain.analogy_seeds || []).slice(0, 4).map((t) => ({
            rule_id: "seed",
            label_zh: t,
            targets: [t],
          })),
          risk_notes: ["新品类样本可能偏薄，先看墙上已有参考再决定要不要补采"],
        },
      },
      brief_spec: {
        brief_id: domain.id,
        name: domain.name,
        domain: domain.id,
        core_terms: [domain.name].concat(domain.examples || []).slice(0, 10),
        analogy_terms: domain.analogy_seeds || [],
        noise_terms: [],
      },
    };
  }

  function cardImage(card, findItem) {
    const refs = card.reference_montage || [];
    for (const r of refs) {
      if (r.image_url) return r.image_url;
      const it = findItem && r.item_id ? findItem(r.item_id) : null;
      if (it && (it.thumbnail_url || it.image_url)) return it.thumbnail_url || it.image_url;
    }
    return card.local_ref_image || "";
  }

  function synthesizeCards(items, l1, bucketIdToZh, houSpeak) {
    const input = (l1 && l1.input) || {};
    const intent = (l1 && l1.intent) || {};
    const product = input.product || "这款包装";
    const tone = input.culture_tone || "中式现代";
    const prior = intent.style_prior || ["chinese_modern", "chinese_ceremonial", "global_minimal"];
    const byBucket = {};
    (items || []).forEach((it) => {
      const ids = it.suggested_style_buckets || [];
      const id = ids[0];
      if (!id) return;
      (byBucket[id] = byBucket[id] || []).push(it);
    });
    const ordered = prior.filter((id) => (byBucket[id] || []).length);
    const extra = Object.keys(byBucket)
      .filter((id) => !ordered.includes(id))
      .sort((a, b) => byBucket[b].length - byBucket[a].length);
    const pick = ordered.concat(extra).slice(0, 3);
    while (pick.length < 3 && extra.length) pick.push(extra[pick.length] || extra[0]);
    const templates = [
      {
        title: tone + "主轴",
        one_liner: `把「${product}」做成一眼${tone}、二眼礼的主视觉。`,
        advantage: "礼赠体面，电商主图也站得住。",
        differentiation: "相对货架常见模板，用克制结构和记忆色拉开。",
      },
      {
        title: "留白贵气",
        one_liner: "少装饰、多材质，把礼盒做成安静的贵。",
        advantage: "新中产审美友好，跨礼赠/自用。",
        differentiation: "用留白和触感对抗信息噪音，不靠金红堆砌。",
      },
      {
        title: "开箱记忆",
        one_liner: "仪式感做在结构开箱，而不是贴符号。",
        advantage: "详情页/开箱视频天然有内容点。",
        differentiation: "仪式来自层次，不是纹样堆砌。",
      },
    ];
    return pick.map((bid, i) => {
      const list = byBucket[bid] || items || [];
      const refs = list.slice(0, 2).map((it) => ({
        item_id: it.id,
        why: `落在「${bucketIdToZh[bid] || bid}」，可借结构/气质，别整段照搬`,
        wall: it.wall_kind || "primary",
        title: it.title,
        image_url: it.thumbnail_url || it.image_url,
        page_url: it.page_url,
      }));
      const t = templates[i] || templates[0];
      const zh = bucketIdToZh[bid] || bid;
      return {
        card_id: "card-live-" + bid + "-" + (i + 1),
        title: t.title,
        one_liner: t.one_liner,
        advantage: t.advantage,
        differentiation: t.differentiation,
        recommended_style_buckets: [bid],
        recommended_style_buckets_zh: [zh],
        reference_montage: refs,
        verbal_directions: [
          `主视觉围绕「${zh}」展开`,
          "品名层级大于装饰纹样",
          (input.must_have && input.must_have[0]) || "外侧克制，内侧给开箱惊喜",
        ],
        sketch_directions: ["外盒色块构成", "开箱分层结构"],
        demo_prompt: `Premium FMCG gift packaging, direction "${t.title}", style ${zh}, ${tone}, elegant unboxing, studio product photography, not a final artwork`,
        demo_disclaimer: "Demo only — 情绪板示意，不是完稿",
        hou_decision: "pending",
        merge_into: null,
        _generated: true,
      };
    });
  }

  function enrichItem(raw, wallStatus, ctx) {
    const status = wallStatus || raw.wall_status || "main_wall";
    const pending = status === "pending_review";
    const item = Object.assign({}, raw, {
      wall_status: status,
      qc_status: pending ? "pending_review" : raw.qc_status || "pass_main",
      pending,
      image_url: raw.image_url || raw.thumbnail_url || "",
      thumbnail_url: raw.thumbnail_url || raw.image_url || "",
      suggested_style_buckets: coarseTag(raw, ctx && ctx.stylePrior),
    });
    item.wall_kind = classifyWall(item, ctx && ctx.briefSpec);
    return item;
  }

  function shortlistMarkdown(l1, kept, visual) {
    const input = (l1 && l1.input) || {};
    const lines = [
      "# KEY 视界 · 短名单",
      "",
      `- 品类：${input.product || ""}`,
      `- 渠道：${input.channel || ""}`,
      `- 气质：${input.culture_tone || ""}`,
      "",
      "## 留下的方向",
    ];
    (kept || []).forEach((c) => {
      lines.push(`- **${c.title}**：${c.one_liner || ""}`);
      if (c.differentiation) lines.push(`  - 区隔：${c.differentiation}`);
    });
    if (visual && visual.length) {
      lines.push("", "## 视觉短名单");
      visual.forEach((it) => lines.push(`- ${it.title || it.id}（${it.source || ""}）`));
    }
    lines.push("", "以上供遴选；表现与完稿由设计执行，AI 不替代决策。");
    return lines.join("\n");
  }

  global.KuiyanRuntime = {
    BUCKET_IDS,
    coarseTag,
    classifyWall,
    scoreAgainstSpec,
    mapBrief,
    cardImage,
    synthesizeCards,
    enrichItem,
    shortlistMarkdown,
    hash32,
  };
})(window);
