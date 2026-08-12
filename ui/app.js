/**
 * 奎燕设计工作台 · 演示原型
 * Brief → 市场地图 → 策略卡 → 短名单
 */
(function () {
  "use strict";

  const STORAGE_KEY = "kuiyan-workbench-state-v1";
  const STEPS = ["brief", "map", "cards", "shortlist"];

  /** @type {any} */
  let bundle = null;

  const state = {
    step: "brief",
    pinned_buckets: /** @type {string[]} */ ([]),
    muted_buckets: /** @type {string[]} */ ([]),
    pinned_item_ids: /** @type {string[]} */ ([]),
    card_decisions: /** @type {Record<string,string>} */ ({}),
    merges: /** @type {Record<string,string>} */ ({}),
    wallTab: "primary",
    filters: {
      onlyImage: true,
      onlyPinnedBuckets: false,
      source: "",
      showMuted: false,
      shelfView: "info",
      analogyEdge: "",
    },
    showIntentEdit: false,
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function brandEmpty(hint) {
    return `<div class="brand-empty empty-col">
      <img class="brand-empty-mark" src="assets/brand/logo-key-mark.svg" alt="" width="72" height="28" />
      <div class="brand-empty-slogan">每个市场，都有一把独特的钥匙</div>
      <div class="brand-empty-hint">${hint}</div>
    </div>`;
  }


  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function openModal(html) {
    const backdrop = $("#modalBackdrop");
    $("#modal").innerHTML = html;
    backdrop.classList.add("show");
  }

  function closeModal() {
    $("#modalBackdrop").classList.remove("show");
    $("#modal").innerHTML = "";
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      ["pinned_buckets", "muted_buckets", "pinned_item_ids"].forEach((k) => {
        if (Array.isArray(saved[k])) state[k] = saved[k];
      });
      if (saved.card_decisions && typeof saved.card_decisions === "object") {
        state.card_decisions = saved.card_decisions;
      }
      if (saved.merges && typeof saved.merges === "object") {
        state.merges = saved.merges;
      }
    } catch (_) {}
  }

  function saveState() {
    const payload = {
      pinned_buckets: state.pinned_buckets,
      muted_buckets: state.muted_buckets,
      pinned_item_ids: state.pinned_item_ids,
      card_decisions: state.card_decisions,
      merges: state.merges,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function bucketZh(idOrZh) {
    if (!idOrZh) return "";
    if (bundle.bucket_id_to_zh[idOrZh]) return bundle.bucket_id_to_zh[idOrZh];
    if (bundle.bucket_zh_to_id[idOrZh]) return idOrZh;
    return idOrZh;
  }

  function bucketId(idOrZh) {
    if (!idOrZh) return "";
    if (bundle.bucket_zh_to_id[idOrZh]) return bundle.bucket_zh_to_id[idOrZh];
    if (bundle.bucket_id_to_zh[idOrZh]) return idOrZh;
    return idOrZh;
  }

  function getItem(id) {
    return (bundle.item_catalog && bundle.item_catalog[id]) || null;
  }

  function itemImage(it) {
    if (!it) return "";
    return it.image_url || it.thumbnail_url || "";
  }

  function isPinnedBucket(id) {
    return state.pinned_buckets.includes(bucketId(id));
  }

  function isMutedBucket(id) {
    return state.muted_buckets.includes(bucketId(id));
  }

  function togglePinBucket(id) {
    id = bucketId(id);
    const i = state.pinned_buckets.indexOf(id);
    if (i >= 0) state.pinned_buckets.splice(i, 1);
    else {
      state.pinned_buckets.push(id);
      state.muted_buckets = state.muted_buckets.filter((x) => x !== id);
    }
    saveState();
    render();
  }

  function muteBucket(id) {
    id = bucketId(id);
    if (!state.muted_buckets.includes(id)) state.muted_buckets.push(id);
    state.pinned_buckets = state.pinned_buckets.filter((x) => x !== id);
    saveState();
    render();
  }

  function unmuteBucket(id) {
    id = bucketId(id);
    state.muted_buckets = state.muted_buckets.filter((x) => x !== id);
    saveState();
    render();
  }

  function togglePinItem(id) {
    const i = state.pinned_item_ids.indexOf(id);
    if (i >= 0) state.pinned_item_ids.splice(i, 1);
    else state.pinned_item_ids.push(id);
    saveState();
    render();
  }

  function setDecision(cardId, decision) {
    state.card_decisions[cardId] = decision;
    if (decision !== "merge") delete state.merges[cardId];
    saveState();
    render();
  }

  function initDefaults() {
    if (state.pinned_buckets.length) return;
    const prior = new Set((bundle.l1.intent.style_prior || []).map(bucketId));
    const ai = (bundle.l3.ai_recommended_buckets || []).map((b) => b.id);
    const pre = ai.filter((id) => prior.has(id)).slice(0, 3);
    state.pinned_buckets = pre.length ? pre : ai.slice(0, 3);
    (bundle.l4_cards || []).forEach((c) => {
      if (!state.card_decisions[c.card_id]) {
        state.card_decisions[c.card_id] = c.hou_decision || "pending";
      }
    });
    saveState();
  }

  function goStep(step) {
    if (!STEPS.includes(step)) return;
    state.step = step;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- renderers ---------- */

  function renderStepper() {
    $$(".step-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.step === state.step);
    });
  }

  function renderBasket() {
    const el = $("#basket");
    const pinnedBuckets = state.pinned_buckets.map((id) => ({
      id,
      zh: bucketZh(id),
    }));
    const pins = state.pinned_item_ids
      .map((id) => getItem(id) || { id, title: id })
      .filter(Boolean);
    const show = pins.slice(0, 12);
    const overflow = pins.length - show.length;

    const counts = { keep: 0, kill: 0, merge: 0, pending: 0 };
    Object.values(state.card_decisions).forEach((d) => {
      if (counts[d] != null) counts[d]++;
    });

    el.innerHTML = `
      <h3>侯总工作篮</h3>
      <div class="basket-section">
        <h4>关注桶</h4>
        ${
          pinnedBuckets.length
            ? `<div class="row">${pinnedBuckets
                .map(
                  (b) =>
                    `<span class="chip accent">${esc(b.zh)} <button type="button" data-unpin-bucket="${esc(
                      b.id
                    )}" title="取消钉选">×</button></span>`
                )
                .join("")}</div>`
            : `<div class="empty-hint">还没有钉选风格桶</div>`
        }
      </div>
      <div class="basket-section">
        <h4>钉选参考</h4>
        ${
          show.length
            ? `<div class="basket-thumbs">${show
                .map((it) => {
                  const img = itemImage(it);
                  return `<div class="thumb" title="${esc(it.title || it.id)}">${
                    img
                      ? `<img src="${esc(img)}" alt="" loading="lazy" />`
                      : `<span class="empty-hint">无图</span>`
                  }</div>`;
                })
                .join("")}${
                overflow > 0 ? `<div class="thumb more">+${overflow}</div>` : ""
              }</div>`
            : `<div class="empty-hint">钉参考会出现在这里</div>`
        }
      </div>
      <div class="basket-section">
        <h4>卡决策</h4>
        <div class="decision-stats">
          <div class="stat-row keep"><span>保留</span><span class="n">${counts.keep}</span></div>
          <div class="stat-row kill"><span>杀掉</span><span class="n">${counts.kill}</span></div>
          <div class="stat-row"><span>合并</span><span class="n">${counts.merge}</span></div>
          <div class="stat-row"><span>未决</span><span class="n">${counts.pending}</span></div>
        </div>
      </div>
      <div class="cta-row">
        <button type="button" class="btn sm ghost" id="btnClearBasket">清空工作篮</button>
      </div>
    `;

    $$("[data-unpin-bucket]", el).forEach((btn) => {
      btn.addEventListener("click", () => togglePinBucket(btn.dataset.unpinBucket));
    });
    $("#btnClearBasket")?.addEventListener("click", () => {
      openModal(`
        <h3>清空工作篮？</h3>
        <p class="muted">将清除钉选桶、钉选参考与卡决策（演示本地状态）。</p>
        <div class="actions">
          <button type="button" class="btn ghost" id="modalCancel">取消</button>
          <button type="button" class="btn danger" id="modalConfirm">清空</button>
        </div>
      `);
      $("#modalCancel").onclick = closeModal;
      $("#modalConfirm").onclick = () => {
        state.pinned_buckets = [];
        state.muted_buckets = [];
        state.pinned_item_ids = [];
        state.card_decisions = {};
        state.merges = {};
        (bundle.l4_cards || []).forEach((c) => {
          state.card_decisions[c.card_id] = "pending";
        });
        saveState();
        closeModal();
        render();
      };
    });
  }

  function renderBrief() {
    const l1 = bundle.l1;
    const input = l1.input || {};
    const intent = l1.intent || {};
    const main = $("#main");

    main.innerHTML = `
      <div class="between" style="margin-bottom:14px">
        <div>
          <h1>Brief 意图</h1>
          <p class="muted tiny">先看清方向与约束，再进市场地图扫样本。</p>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel stack">
          <div class="field-label">原始 brief</div>
          <div class="brief-box" id="briefText">${esc(l1.raw_brief || "")}</div>
        </div>
        <div class="panel stack">
          <h2>意图识别</h2>
          <dl class="intent-dl">
            <dt>品类</dt>
            <dd>${esc(intent.domain_label_zh || "")}<span class="mono"> · ${esc(intent.domain_id || "")}</span></dd>
            <dt>渠道</dt>
            <dd>${esc(input.channel || "—")}</dd>
            <dt>客群</dt>
            <dd>${esc(input.audience || "—")}</dd>
            <dt>价格带</dt>
            <dd>${esc(input.price_band || "—")}</dd>
            <dt>气质</dt>
            <dd>${esc(input.culture_tone || "—")} <span class="tiny">（中式现代，不仿古）</span></dd>
            <dt>必须有</dt>
            <dd class="tag-list">${(input.must_have || []).map((x) => `<span class="chip accent">${esc(x)}</span>`).join("") || "—"}</dd>
            <dt>必须避免</dt>
            <dd class="tag-list">${(input.must_avoid || []).map((x) => `<span class="chip danger">${esc(x)}</span>`).join("") || "—"}</dd>
            <dt>类比计划</dt>
            <dd class="tag-list">${(intent.analogy_plan || [])
              .map((a) => `<span class="chip" title="${esc((a.targets || []).join(" · "))}">${esc(a.label_zh || a.rule_id)}</span>`)
              .join("") || "—"}</dd>
            <dt>风格先验</dt>
            <dd class="tag-list">${(intent.style_prior || [])
              .map((id) => `<span class="chip" title="${esc(id)}">${esc(bucketZh(id))}</span>`)
              .join("") || "—"}</dd>
          </dl>
          ${(intent.risk_notes || [])
            .map((n) => `<div class="warn-bar">${esc(n)}</div>`)
            .join("")}
        </div>
      </div>
      <div class="cta-row">
        <button type="button" class="btn primary" id="btnToMap">看市场地图</button>
        <button type="button" class="btn ghost" id="btnEditIntent">调整意图</button>
      </div>
      ${
        state.showIntentEdit
          ? `<div class="panel" style="margin-top:12px"><p class="muted">演示模式：意图调整为示意，不改写后端数据。直接进入地图即可。</p></div>`
          : ""
      }
    `;

    $("#btnToMap").onclick = () => goStep("map");
    $("#btnEditIntent").onclick = () => {
      state.showIntentEdit = !state.showIntentEdit;
      renderBrief();
    };
  }

  function filterItems(items) {
    const f = state.filters;
    return items.filter((it) => {
      if (f.onlyImage && !itemImage(it)) return false;
      if (f.source && (it.source || "") !== f.source) return false;
      if (f.onlyPinnedBuckets) {
        const buckets = (it.buckets || it.suggested_style_buckets || []).map(bucketId);
        const fromCatalog = getItem(it.id);
        const more = (fromCatalog?.suggested_style_buckets || []).map(bucketId);
        const all = new Set([...buckets, ...more]);
        if (![...all].some((b) => isPinnedBucket(b))) {
          // also allow by wall column name match later
          const zhBuckets = (it.buckets || []).map(bucketId);
          if (!zhBuckets.some((b) => isPinnedBucket(b))) return false;
        }
      }
      return true;
    });
  }

  function renderItemCard(it, opts = {}) {
    const img = itemImage(it);
    const pinned = state.pinned_item_ids.includes(it.id);
    const buckets = (it.buckets || []).slice(0, 2);
    const catalog = getItem(it.id);
    const bucketChips = buckets.length
      ? buckets
      : (catalog?.suggested_style_buckets || []).slice(0, 2).map(bucketZh);

    return `
      <div class="item-card ${pinned ? "pinned-item" : ""}" data-item="${esc(it.id)}">
        ${
          img
            ? `<div class="item-thumb"><img src="${esc(img)}" alt="" loading="lazy" /></div>`
            : ""
        }
        <div class="item-body">
          <div class="item-title" title="${esc(it.title || "")}">${esc(it.title || it.id)}</div>
          <div class="item-meta">
            <span class="badge">${esc(it.source || "—")}</span>
            ${opts.sale ? `<span class="badge sale">在售</span>` : ""}
            ${opts.listing ? `<span class="badge sale">listing级</span>` : ""}
            ${
              it.analogy_from
                ? `<span class="badge analogy">${esc(it.analogy_from)}</span>`
                : ""
            }
            ${bucketChips
              .map((b) => `<span class="badge">${esc(typeof b === "string" ? b : bucketZh(b))}</span>`)
              .join("")}
          </div>
          <div class="item-actions">
            <button type="button" class="btn sm ${pinned ? "active-keep" : ""}" data-pin-item="${esc(
              it.id
            )}">${pinned ? "已钉参考" : "钉参考"}</button>
          </div>
        </div>
      </div>
    `;
  }

  function collectSources() {
    const set = new Set();
    const walls = bundle.l3.walls;
    Object.values(walls.primary.by_bucket || {}).forEach((arr) =>
      arr.forEach((it) => it.source && set.add(it.source))
    );
    (walls.analogy.items || []).forEach((it) => it.source && set.add(it.source));
    (walls.shelf.items || []).forEach((it) => it.source && set.add(it.source));
    return [...set].sort();
  }

  function renderMap() {
    const l3 = bundle.l3;
    const summary = l3.l1_summary || {};
    const counts = l3.counts || {};
    const main = $("#main");
    const ai = l3.ai_recommended_buckets || [];

    const summaryLine = [
      summary.domain || "茶礼盒",
      summary.channel || "",
      "新中产",
      summary.tone || "",
      summary.price_band || "",
    ]
      .filter(Boolean)
      .join(" · ");

    const sources = collectSources();

    main.innerHTML = `
      <div class="between">
        <div>
          <h1>市场地图</h1>
          <p class="muted tiny">${esc(summaryLine)}</p>
        </div>
        <div class="tiny">样本 ${counts.total ?? "—"} · 有图 ${counts.with_image ?? "—"} · 货架 ${counts.shelf ?? "—"}</div>
      </div>

      <div class="panel" style="margin-top:12px">
        <div class="between" style="margin-bottom:8px">
          <h3>AI 推荐桶</h3>
          <span class="tiny">钉选只影响排序，不自动出稿</span>
        </div>
        <div class="bucket-rail">
          ${ai
            .map((b) => {
              const pinned = isPinnedBucket(b.id);
              const muted = isMutedBucket(b.id);
              const why = b.why || `因为 brief 气质与样本命中，所以看「${b.name_zh}」`;
              return `
              <div class="bucket-card ${pinned ? "pinned" : ""} ${muted ? "muted" : ""}">
                <div class="name" title="${esc(b.id)}">${esc(b.name_zh || bucketZh(b.id))}</div>
                <div class="why">${esc(why)}</div>
                <div class="bucket-actions">
                  <button type="button" class="btn sm ${pinned ? "active-keep" : ""}" data-pin-bucket="${esc(b.id)}">${pinned ? "已钉选" : "钉选"}</button>
                  ${
                    muted
                      ? `<button type="button" class="btn sm ghost" data-unmute-bucket="${esc(b.id)}">取消排除</button>`
                      : `<button type="button" class="btn sm ghost" data-mute-bucket="${esc(b.id)}">排除</button>`
                  }
                </div>
              </div>`;
            })
            .join("")}
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button type="button" class="tab ${state.wallTab === "primary" ? "active" : ""}" data-wall="primary">主品类墙</button>
        <button type="button" class="tab ${state.wallTab === "analogy" ? "active" : ""}" data-wall="analogy">类比墙</button>
        <button type="button" class="tab ${state.wallTab === "shelf" ? "active" : ""}" data-wall="shelf">货架墙</button>
      </div>

      <div class="filters">
        <label><input type="checkbox" id="fOnlyImage" ${state.filters.onlyImage ? "checked" : ""}/> 只看有图</label>
        <label><input type="checkbox" id="fOnlyPinned" ${state.filters.onlyPinnedBuckets ? "checked" : ""}/> 仅钉选桶</label>
        <label><input type="checkbox" id="fShowMuted" ${state.filters.showMuted ? "checked" : ""}/> 显示已排除</label>
        <select id="fSource">
          <option value="">来源 · 全部</option>
          ${sources.map((s) => `<option value="${esc(s)}" ${state.filters.source === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
        </select>
        ${
          state.wallTab === "shelf"
            ? `<select id="fShelfView">
                <option value="info" ${state.filters.shelfView === "info" ? "selected" : ""}>视角 · 信息锤</option>
                <option value="busy" ${state.filters.shelfView === "busy" ? "selected" : ""}>视角 · 货架热闹度</option>
              </select>`
            : ""
        }
      </div>

      <div id="wallBody"></div>

      <div class="cta-row">
        <button type="button" class="btn primary" id="btnToCards">去选方向（策略卡）</button>
        <button type="button" class="btn ghost" id="btnExportMap">导出地图说明</button>
      </div>
    `;

    $("#wallBody").innerHTML = renderWallBody();

    $$("[data-pin-bucket]", main).forEach((btn) => {
      btn.onclick = () => togglePinBucket(btn.dataset.pinBucket);
    });
    $$("[data-mute-bucket]", main).forEach((btn) => {
      btn.onclick = () => muteBucket(btn.dataset.muteBucket);
    });
    $$("[data-unmute-bucket]", main).forEach((btn) => {
      btn.onclick = () => unmuteBucket(btn.dataset.unmuteBucket);
    });
    $$(".tab", main).forEach((btn) => {
      btn.onclick = () => {
        state.wallTab = btn.dataset.wall;
        renderMap();
      };
    });
    $("#fOnlyImage").onchange = (e) => {
      state.filters.onlyImage = e.target.checked;
      renderMap();
    };
    $("#fOnlyPinned").onchange = (e) => {
      state.filters.onlyPinnedBuckets = e.target.checked;
      renderMap();
    };
    $("#fShowMuted").onchange = (e) => {
      state.filters.showMuted = e.target.checked;
      renderMap();
    };
    $("#fSource").onchange = (e) => {
      state.filters.source = e.target.value;
      renderMap();
    };
    const shelfSel = $("#fShelfView");
    if (shelfSel) {
      shelfSel.onchange = (e) => {
        state.filters.shelfView = e.target.value;
        renderMap();
      };
    }
    bindPinItems(main);

    $("#btnToCards").onclick = () => {
      if (!state.pinned_buckets.length && !state.pinned_item_ids.length) {
        toast("先钉 1 个桶或 1 张参考");
        return;
      }
      goStep("cards");
    };
    $("#btnExportMap").onclick = () => {
      toast("演示：地图说明可对照 L3-MARKET-MAP.md");
    };
  }

  function bindPinItems(root) {
    $$("[data-pin-item]", root).forEach((btn) => {
      btn.onclick = () => togglePinItem(btn.dataset.pinItem);
    });
  }

  function renderWallBody() {
    if (state.wallTab === "primary") return renderPrimaryWall();
    if (state.wallTab === "analogy") return renderAnalogyWall();
    return renderShelfWall();
  }

  function renderPrimaryWall() {
    const byBucket = bundle.l3.walls.primary.by_bucket || {};
    // Sort: pinned first, then by count
    let cols = Object.keys(byBucket).map((zh) => ({
      zh,
      id: bucketId(zh),
      items: byBucket[zh] || [],
    }));

    cols = cols.filter((c) => {
      if (isMutedBucket(c.id) && !state.filters.showMuted) return false;
      if (state.filters.onlyPinnedBuckets && !isPinnedBucket(c.id)) return false;
      // show if hit >=1 or pinned
      if ((c.items || []).length >= 1 || isPinnedBucket(c.id)) return true;
      return false;
    });

    cols.sort((a, b) => {
      const ap = isPinnedBucket(a.id) ? 0 : 1;
      const bp = isPinnedBucket(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (b.items.length || 0) - (a.items.length || 0);
    });

    if (!cols.length) {
      return brandEmpty("当前筛选下没有可展示的桶列");
    }

    const noCoverAll = [];

    const colsHtml = cols
      .map((col) => {
        let items = filterItems(col.items);
        const withImg = [];
        const noImg = [];
        items.forEach((it) => (itemImage(it) ? withImg : noImg).push(it));
        noCoverAll.push(...noImg.map((it) => ({ ...it, _col: col.zh })));

        // if onlyImage filter already removed no-img, withImg is items
        const show = state.filters.onlyImage ? withImg : withImg;
        const highlight = isPinnedBucket(col.id);

        return `
          <div class="wall-col ${highlight ? "highlight" : ""}">
            <div class="wall-col-title">
              <span title="${esc(col.id)}">${esc(col.zh)}</span>
              <span class="count">${show.length}</span>
            </div>
            ${
              show.length
                ? show.map((it) => renderItemCard(it)).join("")
                : `<div class="empty-col">此桶暂无样本 · 可从类比墙借入
                    <div style="margin-top:8px"><button type="button" class="btn sm" data-goto-analogy="${esc(
                      col.id
                    )}">去类比墙</button></div>
                   </div>`
            }
          </div>`;
      })
      .join("");

    // When onlyImage is on, collect no-cover from original
    let noCoverList = [];
    if (state.filters.onlyImage) {
      cols.forEach((col) => {
        (col.items || []).forEach((it) => {
          if (!itemImage(it)) noCoverList.push(it);
        });
      });
    }

    return `
      <div class="wall-cols">${colsHtml}</div>
      ${
        noCoverList.length
          ? `<details class="no-cover"><summary>无封面列表（${noCoverList.length}）</summary>
              <div class="stack" style="margin-top:8px">${noCoverList
                .map(
                  (it) =>
                    `<div class="row between"><span class="tiny">${esc(
                      it.title || it.id
                    )}</span><button type="button" class="btn sm" data-pin-item="${esc(
                      it.id
                    )}">钉参考</button></div>`
                )
                .join("")}</div></details>`
          : ""
      }
    `;
  }

  function renderAnalogyWall() {
    const wall = bundle.l3.walls.analogy || {};
    const items = filterItems(wall.items || []);
    const edges = wall.planned_edges || bundle.l1.intent.analogy_plan || [];

    const edgeChips = edges
      .map((e) => {
        const label = e.label_zh || e.rule_id;
        const active = state.filters.analogyEdge === (e.rule_id || label);
        return `<button type="button" class="chip ${active ? "accent" : ""}" data-edge="${esc(
          e.rule_id || label
        )}">${esc(label)}</button>`;
      })
      .join("");

    let filtered = items;
    if (state.filters.analogyEdge) {
      const edge = state.filters.analogyEdge;
      filtered = items.filter((it) => {
        if (!it.analogy_from) return false;
        return (
          String(it.analogy_from).includes(edge) ||
          String(it.analogy_from) === edge
        );
      });
      // if filter too strict for demo, fall back to all when empty
      if (!filtered.length) filtered = items;
    }

    if (!items.length) {
      return `
        <div class="info-bar">类比样本还在补 · 先看计划边</div>
        <div class="row" style="margin-top:10px">${edges
          .map(
            (e) =>
              `<span class="chip" title="${esc((e.targets || []).join(" · "))}">${esc(
                e.label_zh || e.rule_id
              )}：${esc((e.targets || []).slice(0, 3).join(" / "))}</span>`
          )
          .join("")}</div>`;
    }

    return `
      <div class="row" style="margin-bottom:10px">${edgeChips}</div>
      <div class="wall-cols">
        <div class="wall-col">
          <div class="wall-col-title"><span>类比样本</span><span class="count">${filtered.length}</span></div>
          ${filtered.map((it) => renderItemCard(it)).join("")}
        </div>
        <div class="wall-col">
          <div class="wall-col-title"><span>计划边</span></div>
          ${(edges || [])
            .map(
              (e) => `
            <div class="panel" style="padding:10px;margin-bottom:8px;box-shadow:none">
              <div class="field-value">${esc(e.label_zh || e.rule_id)}</div>
              <div class="tiny">${esc((e.targets || []).join(" · "))}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderShelfWall() {
    const wall = bundle.l3.walls.shelf || {};
    let items = filterItems(wall.items || []);
    const note =
      wall.note ||
      "货架墙样本不足：区隔论证偏弱，建议补天猫/京东深链后再拍板";

    const weak = (wall.count || items.length) < 8;

    return `
      <div class="warn-bar">${esc(
        weak
          ? "货架墙样本不足：区隔论证偏弱，建议补天猫/京东深链后再拍板"
          : note
      )}</div>
      <p class="tiny" style="margin:8px 0 12px">用来对照「市场上常见长什么样」，不是抄爆款。当前视角：${
        state.filters.shelfView === "busy" ? "货架热闹度" : "信息锤"
      }</p>
      <div class="wall-cols">
        <div class="wall-col" style="grid-column:1/-1">
          <div class="wall-col-title"><span>货架样本</span><span class="count">${items.length}</span></div>
          <div class="wall-cols">
            ${
              items.length
                ? items
                    .map((it) =>
                      renderItemCard(it, {
                        sale: true,
                        listing: String(it.id || "").includes("listing") || it.source_type === "shelf",
                      })
                    )
                    .join("")
                : `<div class="empty-col">暂无货架样本</div>`
            }
          </div>
        </div>
      </div>
    `;
  }

  function afterMapDom() {
    // edge chips + goto analogy
    $$("[data-edge]").forEach((btn) => {
      btn.onclick = () => {
        state.filters.analogyEdge =
          state.filters.analogyEdge === btn.dataset.edge ? "" : btn.dataset.edge;
        renderMap();
      };
    });
    $$("[data-goto-analogy]").forEach((btn) => {
      btn.onclick = () => {
        state.wallTab = "analogy";
        renderMap();
      };
    });
    bindPinItems($("#main"));
  }

  function renderCards() {
    const cards = bundle.l4_cards || [];
    const main = $("#main");
    main.innerHTML = `
      <div class="between" style="margin-bottom:14px">
        <div>
          <h1>策略卡</h1>
          <p class="muted tiny">对方向做保留 / 杀掉 / 合并；至少留下一个方向再进短名单。</p>
        </div>
      </div>
      <div class="cards-grid">
        ${cards.map((c) => renderStrategyCard(c)).join("")}
      </div>
      <div class="cta-row">
        <button type="button" class="btn primary" id="btnToShortlist">生成短名单</button>
        <button type="button" class="btn ghost" id="btnBackMap">回地图补参考</button>
      </div>
    `;

    cards.forEach((c) => {
      $$("[data-decision]", main)
        .filter((b) => b.dataset.card === c.card_id)
        .forEach((btn) => {
          btn.onclick = () => {
            const d = btn.dataset.decision;
            if (d === "merge") {
              promptMerge(c.card_id);
              return;
            }
            setDecision(c.card_id, d);
          };
        });
    });

    $$("[data-jump-item]", main).forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.jumpItem;
        if (!state.pinned_item_ids.includes(id)) {
          state.pinned_item_ids.push(id);
          saveState();
        }
        state.wallTab = "primary";
        goStep("map");
        toast("已回到地图（参考已钉）");
      };
    });

    $("#btnToShortlist").onclick = () => {
      const keeps = Object.values(state.card_decisions).filter((d) => d === "keep");
      if (!keeps.length) {
        toast("至少留下一个方向");
        return;
      }
      goStep("shortlist");
    };
    $("#btnBackMap").onclick = () => goStep("map");
  }

  function renderStrategyCard(c) {
    const decision = state.card_decisions[c.card_id] || "pending";
    const cls =
      decision === "kill"
        ? "killed"
        : decision === "keep"
        ? "kept"
        : decision === "merge"
        ? "merged"
        : "";
    const buckets = c.recommended_style_buckets_zh ||
      (c.recommended_style_buckets || []).map(bucketZh);
    const refs = c.reference_montage || [];
    const mergeNote =
      decision === "merge" && state.merges[c.card_id]
        ? `<div class="info-bar">已合并进 ${esc(state.merges[c.card_id])}</div>`
        : "";

    // inbound merges
    const inbound = Object.entries(state.merges)
      .filter(([, tid]) => tid === c.card_id)
      .map(([sid]) => {
        const src = (bundle.l4_cards || []).find((x) => x.card_id === sid);
        return src ? src.title : sid;
      });

    return `
      <article class="strategy-card ${cls}">
        <div>
          <h3>${esc(c.title)}</h3>
          <div class="one-liner">${esc(c.one_liner || "")}</div>
        </div>
        <div class="kv"><b>优势</b>${esc(c.advantage || "")}</div>
        <div class="kv"><b>区隔</b>${esc(c.differentiation || "")}</div>
        <div class="row">${buckets.map((b) => `<span class="chip accent">${esc(b)}</span>`).join("")}</div>
        <div>
          <div class="field-label">参考编排</div>
          <div class="refs-row">
            ${refs
              .map((r) => {
                const img = r.image_url || itemImage(getItem(r.item_id));
                return `<div class="ref-thumb" data-jump-item="${esc(
                  r.item_id
                )}" title="${esc(r.why || r.title || "")}">${
                  img ? `<img src="${esc(img)}" alt="" loading="lazy" />` : ""
                }</div>`;
              })
              .join("")}
          </div>
        </div>
        <details class="fold">
          <summary>文案方向</summary>
          <ul>${(c.verbal_directions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </details>
        <details class="fold">
          <summary>草图方向</summary>
          <ul>${(c.sketch_directions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </details>
        <details class="fold">
          <summary>Demo prompt</summary>
          <div class="warn-bar" style="margin-top:6px">${esc(
            c.demo_disclaimer || "Demo only — 情绪板示意，不是完稿"
          )}</div>
          <div class="demo-prompt">${esc(c.demo_prompt || "")}</div>
        </details>
        ${
          inbound.length
            ? `<div class="info-bar">合并备注：并入了 ${esc(inbound.join("、"))}</div>`
            : ""
        }
        ${mergeNote}
        <div class="decision-bar" role="group" aria-label="卡决策">
          <button type="button" class="btn ${decision === "keep" ? "active-keep" : ""}" data-card="${esc(
            c.card_id
          )}" data-decision="keep" title="这个方向留下">保留</button>
          <button type="button" class="btn ${decision === "kill" ? "active-kill" : ""}" data-card="${esc(
            c.card_id
          )}" data-decision="kill" title="这个先不要">杀掉</button>
          <button type="button" class="btn ${decision === "merge" ? "active-merge" : ""}" data-card="${esc(
            c.card_id
          )}" data-decision="merge" title="并进另一张">合并</button>
        </div>
        <button type="button" class="btn ghost sm" style="align-self:flex-start;margin-top:4px;padding-left:0;border:0;color:var(--text-mute)" data-card="${esc(
          c.card_id
        )}" data-decision="pending">再想想</button>
      </article>
    `;
  }

  function promptMerge(fromId) {
    const others = (bundle.l4_cards || []).filter((c) => c.card_id !== fromId);
    openModal(`
      <h3>并进另一张</h3>
      <p class="muted tiny">选择合并目标；源卡将标记为合并。</p>
      <div class="merge-options">
        ${others
          .map(
            (c) =>
              `<button type="button" class="btn" data-merge-target="${esc(
                c.card_id
              )}">${esc(c.title)} <span class="tiny">(${esc(c.card_id)})</span></button>`
          )
          .join("")}
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" id="modalCancel">取消</button>
      </div>
    `);
    $("#modalCancel").onclick = closeModal;
    $$("[data-merge-target]").forEach((btn) => {
      btn.onclick = () => {
        state.card_decisions[fromId] = "merge";
        state.merges[fromId] = btn.dataset.mergeTarget;
        saveState();
        closeModal();
        render();
      };
    });
  }

  function renderShortlist() {
    const l1 = bundle.l1;
    const input = l1.input || {};
    const keeps = (bundle.l4_cards || []).filter(
      (c) => state.card_decisions[c.card_id] === "keep"
    );
    const main = $("#main");
    const briefLine = [
      input.product || "青绿茶礼盒",
      input.channel,
      input.audience,
      input.culture_tone,
      input.price_band,
    ]
      .filter(Boolean)
      .join(" · ");

    main.innerHTML = `
      <div class="between" style="margin-bottom:14px">
        <div>
          <h1>短名单</h1>
          <p class="muted tiny">供内部对齐 / 客户前预览 · 只读汇总</p>
        </div>
      </div>
      <div class="panel">
        <div class="field-label">Brief</div>
        <div class="field-value">${esc(briefLine)}</div>
      </div>
      <div style="margin-top:14px">
        ${
          keeps.length
            ? keeps
                .map((c) => {
                  const refs = c.reference_montage || [];
                  return `
                  <div class="shortlist-card">
                    <h2>${esc(c.title)}</h2>
                    <div class="one-liner">${esc(c.one_liner || "")}</div>
                    <div class="kv" style="margin-top:8px"><b>区隔</b>${esc(c.differentiation || "")}</div>
                    <div class="refs-row" style="margin-top:10px">
                      ${refs
                        .map((r) => {
                          const img = r.image_url || itemImage(getItem(r.item_id));
                          return `<div class="ref-thumb">${
                            img ? `<img src="${esc(img)}" alt="" loading="lazy" />` : ""
                          }</div>`;
                        })
                        .join("")}
                    </div>
                  </div>`;
                })
                .join("")
            : brandEmpty("还没有保留的方向。在策略卡上 Keep 后会出现在这里。")
        }
      </div>
      <div class="panel">
        <div class="field-label">钉选桶</div>
        <div class="row">${
          state.pinned_buckets.length
            ? state.pinned_buckets
                .map((id) => `<span class="chip accent">${esc(bucketZh(id))}</span>`)
                .join("")
            : `<span class="empty-hint">无</span>`
        }</div>
      </div>
      <p class="tiny" style="margin-top:16px">以上供侯总遴选；表现与完稿由设计执行，AI 不替代决策</p>
      <div class="cta-row">
        <button type="button" class="btn primary" id="btnCopy">复制纪要</button>
        <button type="button" class="btn ghost" id="btnBackCards">回到策略卡调整</button>
      </div>
    `;

    $("#btnCopy").onclick = async () => {
      const lines = [
        "【奎燕短名单纪要】",
        briefLine,
        "",
        ...keeps.map(
          (c, i) =>
            `${i + 1}. ${c.title} — ${c.one_liner}\n   区隔：${c.differentiation || ""}`
        ),
        "",
        "钉选桶：" + state.pinned_buckets.map(bucketZh).join("、"),
        "以上供侯总遴选；表现与完稿由设计执行，AI 不替代决策",
      ];
      const text = lines.join("\n");
      try {
        await navigator.clipboard.writeText(text);
        toast("纪要已复制");
      } catch (_) {
        openModal(`
          <h3>复制纪要</h3>
          <textarea style="width:100%;height:180px;background:var(--bg-soft);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px">${esc(
            text
          )}</textarea>
          <div class="actions"><button type="button" class="btn primary" id="modalCancel">关闭</button></div>
        `);
        $("#modalCancel").onclick = closeModal;
      }
    };
    $("#btnBackCards").onclick = () => goStep("cards");
  }

  function renderMain() {
    if (state.step === "brief") renderBrief();
    else if (state.step === "map") {
      renderMap();
      afterMapDom();
    } else if (state.step === "cards") renderCards();
    else renderShortlist();
  }

  function render() {
    renderStepper();
    renderBasket();
    renderMain();
  }

  function bindGlobal() {
    $$(".step-btn").forEach((btn) => {
      btn.addEventListener("click", () => goStep(btn.dataset.step));
    });
    $("#modalBackdrop").addEventListener("click", (e) => {
      if (e.target === $("#modalBackdrop")) closeModal();
    });
  }

  async function boot() {
    bindGlobal();
    loadState();
    try {
      const res = await fetch("data/demo-bundle.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      bundle = await res.json();
    } catch (err) {
      $("#main").innerHTML = `<div class="warn-bar">加载演示数据失败：${esc(
        String(err.message || err)
      )}。请用本地静态服务器打开本目录。</div>`;
      return;
    }

    $("#briefKey").textContent = bundle.l1?.brief_id || bundle.meta?.brief_id || "KEY";
    if (bundle.meta?.footer) $("#footer").textContent = bundle.meta.footer;

    initDefaults();
    render();
  }

  boot();
})();
