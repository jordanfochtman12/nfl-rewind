import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

test("service worker installs the app shell first and downloads the full offline library only on request", async () => {
  const handlers = new Map();
  const stores = new Map();
  const manifest = { version: "test", files: ["/assets/shell.js", "/assets/history.js"], precache: ["/assets/shell.js"], sizes: { "/assets/shell.js": 10, "/assets/history.js": 20 }, totalBytes: 30 };
  let failHistory = true;
  const responseFor = (url) => url === "/offline-manifest.json"
    ? new Response(JSON.stringify(manifest), { headers: { "content-type": "application/json" } })
    : url === "/assets/history.js" && failHistory
      ? new Response("unavailable", { status: 503 })
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
        async delete(path) { return values.delete(path); },
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
    clients: { async claim() {}, async matchAll() { return [{ postMessage(message) { replies.push(message); } }]; } },
    addEventListener(name, handler) { handlers.set(name, handler); },
    async skipWaiting() {},
  };
  const replies = [];
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
  handlers.get("message")({ data: { type: "PRECACHE_OPTIONAL" }, waitUntil() {} });
  assert.equal(await cache.match("/assets/history.js"), undefined, "older clients cannot trigger the full-library download");
  handlers.get("message")({
    data: { type: "PREPARE_FULL_OFFLINE" },
    source: { postMessage(message) { replies.push(message); } },
    waitUntil(promise) { backgroundWork = promise; },
  });
  await backgroundWork;
  assert.equal(await cache.match("/assets/history.js"), undefined, "a failed asset is left uncached for retry");
  assert.equal(await cache.match("/__offline_complete__"), undefined);
  assert.ok(replies.some((message) => message.type === "OFFLINE_CACHE_PROGRESS" && message.status === "incomplete"));

  failHistory = false;
  handlers.get("message")({
    data: { type: "PREPARE_FULL_OFFLINE" },
    waitUntil(promise) { backgroundWork = promise; },
  });
  await backgroundWork;
  assert.ok(await cache.match("/assets/history.js"));
  assert.ok(await cache.match("/__offline_complete__"));
  assert.equal(replies.at(-1).type, "OFFLINE_CACHE_READY");
  assert.ok(replies.some((message) => message.type === "OFFLINE_CACHE_PROGRESS" && message.completedBytes === 30));
  assert.equal(await cache.match("/__offline_progress__"), undefined);
});
