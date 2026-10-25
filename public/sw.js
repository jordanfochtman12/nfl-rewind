/*
 * Offline play. The game runs entirely in the browser and keeps the dynasty in IndexedDB, so
 * once the page and its build files are cached a season can be watched with no connection.
 *
 * - The page itself: network first (a new deploy shows up as soon as you're online), the
 *   cached copy when offline.
 * - App-shell files: cached at install from /offline-manifest.json.
 * - Lazy game screens and catalogs: cached when used; the full offline library is user-triggered.
 * - Art, audio and logos: cached the first time they're used.
 * - Anything server-side (sign-in, APIs, server functions) is never cached.
 */
const SHELL = "rewind-shell-";
const MEDIA = "rewind-media";
const ASSETS = "rewind-assets-";
let optionalCacheWork;
let activeShellCache = "";

async function notifyOfflineProgress(clients, cache, progress) {
  await cache.put("/__offline_progress__", new Response(JSON.stringify(progress), {
    headers: { "content-type": "application/json" },
  }));
  for (const client of clients) client.postMessage({ type: "OFFLINE_CACHE_PROGRESS", ...progress });
}

const serverSide = (path) =>
  path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/_serverFn") || path.startsWith("/__app-env") || path === "/sw.js" || path === "/offline-manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Install atomically. If a deploy is only partly reachable, leave the current
      // worker and its matching app shell active instead of mixing old HTML with new assets.
      const res = await fetch("/offline-manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Offline manifest unavailable during install");
      const m = await res.json();
      const cache = await caches.open(ASSETS + m.version);
      await cache.addAll(m.precache ?? m.files);
      const page = await fetch("/", { cache: "no-store" });
      if (!page.ok) throw new Error("App shell unavailable during install");
      await (await caches.open(SHELL + m.version)).put("/", page);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_FULL_OFFLINE") return;
  if (optionalCacheWork) {
    event.waitUntil(optionalCacheWork);
    return;
  }
  optionalCacheWork = (async () => {
    try {
      const res = await fetch("/offline-manifest.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Offline asset manifest unavailable");
      const manifest = await res.json();
      const cache = await caches.open(ASSETS + manifest.version);
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
      const sizes = manifest.sizes ?? {};
      const totalBytes = manifest.totalBytes ?? 0;
      let completedBytes = 0;
      let completedFiles = 0;
      const cached = await Promise.all(manifest.files.map((path) => cache.match(path)));
      for (let i = 0; i < manifest.files.length; i += 1) {
        if (cached[i]) {
          completedFiles += 1;
          completedBytes += sizes[manifest.files[i]] ?? 0;
        }
      }
      const optional = manifest.files.filter((_, i) => !cached[i]);
      const progress = (status) => ({
        status,
        completedFiles,
        totalFiles: manifest.files.length,
        completedBytes,
        totalBytes,
      });
      await notifyOfflineProgress(clients, cache, progress("preparing"));
      for (let i = 0; i < optional.length; i += 4) {
        const batch = optional.slice(i, i + 4);
        await Promise.all(batch.map(async (path) => {
          if (await cache.match(path)) {
            completedFiles += 1;
            completedBytes += sizes[path] ?? 0;
            return;
          }
          try {
            const response = await fetch(path);
            if (response.ok) {
              await cache.put(path, response);
              completedFiles += 1;
              completedBytes += sizes[path] ?? 0;
            }
          } catch {
            // A single unavailable lazy asset should not block caching the rest.
          }
        }));
        await notifyOfflineProgress(clients, cache, progress("preparing"));
      }
      const complete = await Promise.all(manifest.files.map((path) => cache.match(path)));
      if (complete.every(Boolean)) {
        await cache.put("/__offline_complete__", new Response("ready", { headers: { "content-type": "text/plain" } }));
        await cache.delete("/__offline_progress__");
        for (const client of clients) client.postMessage({ type: "OFFLINE_CACHE_READY" });
      } else {
        await notifyOfflineProgress(clients, cache, progress("incomplete"));
      }
    } catch {
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" }).catch(() => []);
      for (const client of clients) client.postMessage({ type: "OFFLINE_CACHE_INCOMPLETE" });
      // The user can retry the full offline download from Settings.
    } finally {
      optionalCacheWork = undefined;
    }
  })();
  event.waitUntil(optionalCacheWork);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      let version = "";
      try {
        const res = await fetch("/offline-manifest.json", { cache: "no-store" });
        if (res.ok) version = (await res.json()).version;
      } catch {
        // Keep everything when the version can't be checked.
      }
      if (version) {
        const keepAssets = ASSETS + version;
        activeShellCache = SHELL + version;
        for (const k of await caches.keys()) {
          if ((k.startsWith(ASSETS) || k.startsWith(SHELL)) && k !== keepAssets && k !== activeShellCache) await caches.delete(k);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || serverSide(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname === "/" && activeShellCache) (await caches.open(activeShellCache)).put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/", { cacheName: activeShellCache || SHELL + "runtime" })) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          const name = (await caches.keys()).find((k) => k.startsWith(ASSETS)) ?? ASSETS + "runtime";
          (await caches.open(name)).put(req, res.clone());
        }
        return res;
      })(),
    );
    return;
  }

  if (/^\/(art|audio|logos|brand|icons)\//.test(url.pathname) || /\.(svg|png|jpg|webp|mp3|ogg|m4a|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MEDIA);
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok && res.type === "basic") cache.put(req, res.clone());
            return res;
          })
          .catch(() => undefined);
        return hit ?? (await fresh) ?? Response.error();
      })(),
    );
  }
});
