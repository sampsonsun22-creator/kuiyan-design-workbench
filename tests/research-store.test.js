const assert = require("node:assert/strict");

const {
  createResearchStore,
  STORAGE_KEY,
} = require("../ui-shell/research-store.js");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

const seeds = [
  {
    id: "r-green",
    title: "青绿茶礼盒竞品调研",
    question: "青绿茶礼盒如何做出开箱记忆点？",
    status: "running",
    stage: 3,
    tab: "visual",
  },
];

{
  const storage = memoryStorage();
  const store = createResearchStore(storage, {
    seeds,
    now: () => "2026-08-12T16:00:00.000Z",
    randomId: () => "abc123",
  });

  assert.equal(store.getSnapshot().version, 1);
  assert.equal(store.getActive().id, "r-green");

  const created = store.create({
    title: "咖啡新品研究",
    question: "高端即饮咖啡如何建立货架识别？",
  });
  assert.equal(created.id, "r-abc123");
  assert.equal(store.getActive().id, created.id);
  assert.equal(store.getActive().stage, 1);

  store.update(created.id, {
    stage: 4,
    tab: "strategy",
    decisions: { direction_a: "keep" },
    shortlistVisualIds: ["wall-1"],
    messages: [{ id: "m-1", text: "保留更克制的方向", createdAt: "2026-08-12T16:01:00.000Z" }],
  });

  const restored = createResearchStore(storage, { seeds });
  assert.deepEqual(restored.getActive().decisions, { direction_a: "keep" });
  assert.deepEqual(restored.getActive().shortlistVisualIds, ["wall-1"]);
  assert.equal(restored.getActive().messages[0].text, "保留更克制的方向");
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).activeResearchId, created.id);
}

{
  const storage = memoryStorage({ [STORAGE_KEY]: "{not-json" });
  const store = createResearchStore(storage, { seeds });
  assert.equal(store.getActive().id, "r-green");
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1);
}

{
  const storage = memoryStorage();
  const store = createResearchStore(storage, { seeds });
  store.update("r-green", { shortlistVisualIds: ["a", "a", "", "b"] });
  assert.deepEqual(store.getActive().shortlistVisualIds, ["a", "b"]);

  const exported = JSON.parse(store.exportJson());
  assert.equal(exported.schema, "key-vision/research-workspace@1");
  assert.equal(exported.researches.length, 1);
}

console.log("research-store tests passed");
