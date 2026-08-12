const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bundles = ["ui-shell", "ship/key-vision", "ship/key-vision-vercel"];

for (const bundle of bundles) {
  const index = fs.readFileSync(path.join(root, bundle, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, bundle, "app.js"), "utf8");
  const store = fs.readFileSync(path.join(root, bundle, "research-store.js"), "utf8");

  assert.match(index, /id="newResearchDialog"/, `${bundle} exposes the new-research flow`);
  assert.match(index, /id="saveStatus"/, `${bundle} exposes persistence status`);
  assert.match(index, /research-store\.js/, `${bundle} loads the workspace store`);
  assert.match(app, /persistWorkspace\(\{ messages \}\)/, `${bundle} persists user messages`);
  assert.match(app, /shortlistVisualIds/, `${bundle} persists shortlist references`);
  assert.match(store, /key-vision\/research-workspace@1/, `${bundle} exports a versioned schema`);
}

console.log("workspace UI contract tests passed");
