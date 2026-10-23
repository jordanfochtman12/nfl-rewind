/**
 * Registers the offline service worker (public/sw.js) in production builds. The compact app
 * shell is cached at install; the full offline library is an explicit choice in Settings.
 */
import { useEffect } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      } catch {
        // The game remains usable online when service-worker registration is unavailable.
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
