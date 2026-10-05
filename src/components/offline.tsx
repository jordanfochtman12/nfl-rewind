/**
 * Registers the offline service worker (public/sw.js) in production builds, and reports whether
 * this device can open the game without a connection.
 */
import { useEffect } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
