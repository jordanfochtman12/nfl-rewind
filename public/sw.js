/*
 * Offline play. The game runs entirely in the browser and keeps the dynasty in IndexedDB, so
 * once the page and its build files are cached a season can be watched with no connection.
 *
 * - The page itself: network first (a new deploy shows up as soon as you're online), the
 *   cached copy when offline.
 * - Build files (/assets/*, hashed names): cached at install from /offline-manifest.json.
 * - Art, audio and logos: cached the first time they're used.
 * - Anything server-side (sign-in, APIs, server functions) is never cached.
 */
const SHELL = "rewind-shell";
const MEDIA = "rewind-media";
const ASSETS = "rewind-assets-";

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
          await cache.addAll(m.files);
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

  if (/^\/(art|audio|logos|brand|__grok)\//.test(url.pathname) || /\.(svg|png|jpg|webp|mp3|ogg|m4a|woff2?)$/.test(url.pathname)) {
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
