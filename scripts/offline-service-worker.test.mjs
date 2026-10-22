import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

test("service worker installs the app shell first and marks offline ready after lazy assets cache", async () => {
  const handlers = new Map();
  const stores = new Map();
  const manifest = { version: "test", files: ["/assets/shell.js", "/assets/history.js"], precache: ["/assets/shell.js"] };
  const responseFor = (url) => url === "/offline-manifest.json"
    ? new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } })
    : new Response(url, { status: 200 });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name);
      return {
        async addAll(paths) {
          for (const path of paths) {
            const response = await responseFor(path);
            if (!response.ok) throw new Error(`failed to cache ${path}`);
            values.set(path, response);
          }
        },
        async match(path) { return values.get(typeof path === "string" ? path : path.url); },
        async put(path, response) { values.set(typeof path === "string" ? path : path.url, response); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request, options = {}) {
      const names = options.cacheName ? [options.cacheName] : [...stores.keys()];
      for (const name of names) {
        const response = stores.get(name)?.get(typeof request === "string" ? request : request.url);
        if (response) return response;
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: "https://game.test" },
    clients: { async claim() {} },
    addEventListener(name, handler) { handlers.set(name, handler); },
    async skipWaiting() {},
  };
  const context = vm.createContext({ self, caches, fetch: async (url) => responseFor(String(url)), Response, URL });
  vm.runInContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), context);

  let installWork;
  handlers.get("install")({ waitUntil(promise) { installWork = promise; } });
  await installWork;
  const cache = await caches.open("rewind-assets-test");
  assert.ok(await cache.match("/assets/shell.js"));
  assert.equal(await cache.match("/assets/history.js"), undefined, "lazy history waits until the app shell is available");
  assert.equal(await cache.match("/__offline_complete__"), undefined);

  let backgroundWork;
  const replies = [];
  handlers.get("message")({
    data: { type: "PRECACHE_OPTIONAL" },
    source: { postMessage(message) { replies.push(message); } },
    waitUntil(promise) { backgroundWork = promise; },
  });
  await backgroundWork;
  assert.ok(await cache.match("/assets/history.js"));
  assert.ok(await cache.match("/__offline_complete__"));
  assert.equal(replies.length, 1);
  assert.equal(replies[0].type, "OFFLINE_CACHE_READY");
});
