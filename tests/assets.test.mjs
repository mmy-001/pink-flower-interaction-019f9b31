import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("repository contains the complete transparent pink frame sequence", async () => {
  const directory = path.join(root, "assets", "pink-alpha-frames");
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );

  assert.equal(manifest.frameCount, 36);
  assert.equal(manifest.files.length, 36);
  assert.equal(manifest.width, 720);
  assert.equal(manifest.height, 720);
  assert.equal(manifest.matte, "soft");

  await Promise.all(
    manifest.files.map((file) => access(path.join(directory, file))),
  );
  await access(path.join(root, "assets", "phone-dream-background.jpg"));
  await access(path.join(root, "source", "pink-flower-source.mp4"));
});

