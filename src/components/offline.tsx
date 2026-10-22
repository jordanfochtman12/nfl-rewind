/**
 * Registers the offline service worker (public/sw.js) in production builds, and reports whether
 * this device can open the game without a connection.
 */
import { useEffect } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const fillCache = () => {
          if (!navigator.onLine) return;
          (navigator.serviceWorker.controller ?? registration.active)?.postMessage({ type: "PRECACHE_OPTIONAL" });
        };
        await navigator.serviceWorker.ready;
        fillCache();
        navigator.serviceWorker.addEventListener("controllerchange", fillCache);
        window.addEventListener("online", fillCache);
      } catch {
        // The game remains usable online when service-worker registration is unavailable.
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
