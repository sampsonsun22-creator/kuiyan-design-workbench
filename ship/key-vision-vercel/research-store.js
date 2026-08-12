(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KeyVisionResearchStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "key-vision.research-workspace.v1";
  const SCHEMA = "key-vision/research-workspace@1";

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value))];
  }

  function normalizeResearch(raw, now) {
    const source = raw && typeof raw === "object" ? raw : {};
    const createdAt = source.createdAt || source.date || now;
    return {
      id: String(source.id || ""),
      title: String(source.title || "未命名研究"),
      question: String(source.question || ""),
      createdAt,
      updatedAt: source.updatedAt || createdAt,
      status: source.status === "done" ? "done" : "running",
      stage: Number.isInteger(source.stage) && source.stage >= 1 && source.stage <= 5 ? source.stage : 1,
      tab: ["visual", "strategy", "shortlist"].includes(source.tab) ? source.tab : "visual",
      decisions: source.decisions && typeof source.decisions === "object" ? { ...source.decisions } : {},
      shortlistVisualIds: uniqueStrings(source.shortlistVisualIds),
      messages: (Array.isArray(source.messages) ? source.messages : [])
        .filter((message) => message && typeof message.text === "string" && message.text.trim())
        .map((message, index) => ({
          id: String(message.id || `m-${index + 1}`),
          text: message.text.trim(),
          createdAt: message.createdAt || createdAt,
        })),
    };
  }

  function createResearchStore(storage, options = {}) {
    const now = options.now || (() => new Date().toISOString());
    const randomId =
      options.randomId ||
      (() =>
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10));
    const seeds = Array.isArray(options.seeds) ? options.seeds : [];

    function seedSnapshot() {
      const timestamp = now();
      const requestedActiveId = seeds.find((seed) => seed && seed.active)?.id;
      const researches = seeds
        .map((seed) => normalizeResearch(seed, timestamp))
        .filter((research) => research.id);
      return {
        version: 1,
        activeResearchId:
          researches.find((research) => research.id === requestedActiveId)?.id || researches[0]?.id || null,
        researches,
      };
    }

    function persist(snapshot) {
      storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return snapshot;
    }

    function load() {
      try {
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.researches)) throw new Error("invalid snapshot");
        const timestamp = now();
        const researches = parsed.researches
          .map((research) => normalizeResearch(research, timestamp))
          .filter((research) => research.id);
        if (!researches.length) throw new Error("empty snapshot");
        const activeResearchId = researches.some((research) => research.id === parsed.activeResearchId)
          ? parsed.activeResearchId
          : researches[0].id;
        return persist({ version: 1, activeResearchId, researches });
      } catch (_error) {
        return persist(seedSnapshot());
      }
    }

    let snapshot = load();

    function getSnapshot() {
      return JSON.parse(JSON.stringify(snapshot));
    }

    function getActive() {
      const active = snapshot.researches.find((research) => research.id === snapshot.activeResearchId);
      return active ? JSON.parse(JSON.stringify(active)) : null;
    }

    function update(id, patch) {
      const timestamp = now();
      let updated = null;
      snapshot.researches = snapshot.researches.map((research) => {
        if (research.id !== id) return research;
        updated = normalizeResearch({ ...research, ...patch, id, updatedAt: timestamp }, timestamp);
        return updated;
      });
      persist(snapshot);
      return updated ? JSON.parse(JSON.stringify(updated)) : null;
    }

    function setActive(id) {
      if (!snapshot.researches.some((research) => research.id === id)) return null;
      snapshot.activeResearchId = id;
      persist(snapshot);
      return getActive();
    }

    function create(input) {
      const timestamp = now();
      let id;
      do {
        id = `r-${randomId()}`;
      } while (snapshot.researches.some((research) => research.id === id));
      const research = normalizeResearch(
        {
          id,
          title: input?.title,
          question: input?.question,
          createdAt: timestamp,
          updatedAt: timestamp,
          status: "running",
          stage: 1,
          tab: "visual",
        },
        timestamp
      );
      snapshot.researches.unshift(research);
      snapshot.activeResearchId = research.id;
      persist(snapshot);
      return JSON.parse(JSON.stringify(research));
    }

    function exportJson() {
      return JSON.stringify(
        {
          schema: SCHEMA,
          exportedAt: now(),
          activeResearchId: snapshot.activeResearchId,
          researches: snapshot.researches,
        },
        null,
        2
      );
    }

    return { getSnapshot, getActive, update, setActive, create, exportJson };
  }

  return { createResearchStore, STORAGE_KEY, SCHEMA };
});
