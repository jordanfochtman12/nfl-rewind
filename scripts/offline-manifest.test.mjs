import assert from "node:assert/strict";
import { test } from "node:test";
import { offlineManifest } from "./offline-manifest.mjs";

test("offline manifest precaches static shell imports and defers dynamic chunks", () => {
  const bundle = {
    "index.js": { type: "chunk", code: "i", isEntry: true, imports: ["router.js"], viteMetadata: { importedCss: new Set(["shell.css"]), importedAssets: new Set() } },
    "router.js": { type: "chunk", code: "r", isEntry: false, imports: ["shared.js"], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
    "shared.js": { type: "chunk", code: "s", isEntry: false, imports: [], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
    "history.js": { type: "chunk", code: "h", isEntry: false, imports: ["shared.js"], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
    "shell.css": { type: "asset", source: "body{}", viteMetadata: { importedAssets: new Set(["font.woff2"]) } },
    "font.woff2": { type: "asset", source: new Uint8Array([1]) },
    "2036-abc.js": { type: "chunk", isEntry: false, imports: [], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
  };

  const manifest = offlineManifest(bundle);
  assert.deepEqual(manifest.precache, ["font.woff2", "index.js", "router.js", "shared.js", "shell.css"]);
  assert.deepEqual(manifest.files, ["2036-abc.js", "font.woff2", "history.js", "index.js", "router.js", "shared.js", "shell.css"]);
  assert.ok(!manifest.precache.includes("2036-abc.js"), "historical season chunks remain optional and do not delay first load");
  assert.equal(manifest.totalBytes, 11);
  assert.equal(manifest.precacheBytes, 10);
  assert.equal(manifest.sizes["font.woff2"], 1);
});
