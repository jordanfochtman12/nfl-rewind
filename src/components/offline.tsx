/**
 * Registers the offline service worker (public/sw.js) in production builds, and reports whether
 * this device can open the game without a connection.
 */
import { useEffect, useState } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

export type OfflineStatus = "unsupported" | "dev" | "preparing" | "ready";

export function useOfflineStatus(): OfflineStatus {
  const [status, setStatus] = useState<OfflineStatus>("preparing");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return setStatus("unsupported");
    if (!import.meta.env.PROD) return setStatus("dev");
    let live = true;
    const check = async () => {
      const keys = await caches.keys().catch(() => [] as string[]);
      const ready = !!navigator.serviceWorker.controller && keys.includes("rewind-shell") && keys.some((k) => k.startsWith("rewind-assets-"));
      if (live) setStatus(ready ? "ready" : "preparing");
    };
    void check();
    navigator.serviceWorker.addEventListener("controllerchange", check);
    return () => {
      live = false;
      navigator.serviceWorker.removeEventListener("controllerchange", check);
    };
  }, []);
  return status;
}
