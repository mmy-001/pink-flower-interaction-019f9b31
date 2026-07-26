import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("page is accessible and has a non-blank static fallback", async () => {
  const html = await readFile(path.join(root, "index.html"), "utf8");
  const app = await readFile(path.join(root, "src", "phone-preview.mjs"), "utf8");

  assert.match(html, /role="button"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /role="status"/);
  assert.match(html, /class="phone-fallback"/);
  assert.match(html, /pink-alpha-000\.webp/);
  assert.match(app, /new Image\(\)/);
  assert.doesNotMatch(app, /createImageBitmap/);
  assert.doesNotMatch(app, /getUserMedia|mediaDevices/);
});

