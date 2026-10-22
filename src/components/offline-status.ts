/** Whether this device can open the game with no connection (see public/sw.js). */
import { useEffect, useState } from "react";

export type OfflineStatus = "unsupported" | "dev" | "preparing" | "ready";

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>("preparing");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return setStatus("unsupported");
    if (!import.meta.env.PROD) return setStatus("dev");
    let live = true;
    const check = async () => {
      const keys = await caches.keys().catch(() => [] as string[]);
      const assetCacheName = keys.find((k) => k.startsWith("rewind-assets-"));
      const assetCache = assetCacheName ? await caches.open(assetCacheName) : undefined;
      const ready = !!navigator.serviceWorker.controller && keys.includes("rewind-shell") && !!await assetCache?.match("/__offline_complete__");
      if (live) setStatus(ready ? "ready" : "preparing");
    };
    void check();
    navigator.serviceWorker.addEventListener("controllerchange", check);
    navigator.serviceWorker.addEventListener("message", check);
    return () => {
      live = false;
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      navigator.serviceWorker.removeEventListener("message", check);
    };
  }, []);
  return status;
}
