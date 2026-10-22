/*
 * Offline play. The game runs entirely in the browser and keeps the dynasty in IndexedDB, so
 * once the page and its build files are cached a season can be watched with no connection.
 *
 * - The page itself: network first (a new deploy shows up as soon as you're online), the
 *   cached copy when offline.
 * - App-shell files: cached at install from /offline-manifest.json.
 * - Lazy game screens and catalogs: cached after the shell opens, in the background.
 * - Art, audio and logos: cached the first time they're used.
 * - Anything server-side (sign-in, APIs, server functions) is never cached.
 */
const SHELL = "rewind-shell";
const MEDIA = "rewind-media";
const ASSETS = "rewind-assets-";
let optionalCacheWork;

const serverSide = (path) =>
  path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/_serverFn") || path.startsWith("/__app-env") || path === "/sw.js" || path === "/offline-manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/offline-manifest.json", { cache: "no-store" });
        if (res.ok) {
          const m = await res.json();
          const cache = await caches.open(ASSETS + m.version);
          await cache.addAll(m.precache ?? m.files);
        }
        const page = await fetch("/", { cache: "no-store" });
        if (page.ok) await (await caches.open(SHELL)).put("/", page);
      } catch {
        // Offline at install: the next visit online fills the caches.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_OPTIONAL") return;
  if (optionalCacheWork) {
    event.waitUntil(optionalCacheWork);
    return;
  }
  optionalCacheWork = (async () => {
    try {
      const res = await fetch("/offline-manifest.json", { cache: "no-store" });
      if (!res.ok) return;
      const manifest = await res.json();
      const cache = await caches.open(ASSETS + manifest.version);
      const required = new Set(manifest.precache ?? manifest.files);
      const optional = manifest.files.filter((path) => !required.has(path));
      for (let i = 0; i < optional.length; i += 4) {
        await Promise.all(optional.slice(i, i + 4).map(async (path) => {
          if (await cache.match(path)) return;
          try {
            const response = await fetch(path);
            if (response.ok) await cache.put(path, response);
          } catch {
            // A single unavailable lazy asset should not block caching the rest.
          }
        }));
      }
      const complete = await Promise.all(manifest.files.map((path) => cache.match(path)));
      if (complete.every(Boolean)) {
        await cache.put("/__offline_complete__", new Response("ready", { headers: { "content-type": "text/plain" } }));
        event.source?.postMessage({ type: "OFFLINE_CACHE_READY" });
      }
    } catch {
      // A later page visit or online event retries the background cache fill.
    } finally {
      optionalCacheWork = undefined;
    }
  })();
  event.waitUntil(optionalCacheWork);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      let keep = "";
      try {
        const res = await fetch("/offline-manifest.json", { cache: "no-store" });
        if (res.ok) keep = ASSETS + (await res.json()).version;
      } catch {
        // Keep everything when the version can't be checked.
      }
      if (keep) for (const k of await caches.keys()) if (k.startsWith(ASSETS) && k !== keep) await caches.delete(k);
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
          if (res.ok && url.pathname === "/") (await caches.open(SHELL)).put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/", { cacheName: SHELL })) ?? Response.error();
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
