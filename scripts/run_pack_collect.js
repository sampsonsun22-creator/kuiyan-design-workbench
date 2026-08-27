#!/usr/bin/env node
/**
 * CLI wrapper for /api/pack/collect — local studio only.
 * Reads JSON {product} from stdin, prints JSON to stdout.
 */
const { collectPack } = require("../ship/key-vision-live/api/pack/collect.js");

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const product = String(body.product_name || "").trim();
  const result = await collectPack(product);
  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) })
  );
  process.exit(0);
});
