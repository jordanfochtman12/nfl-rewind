/**
 * Registers the offline service worker (public/sw.js) in production builds. The compact app
 * shell is cached at install; the full offline library is an explicit choice in Settings.
 */
import { useEffect } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    // A tab can stay open across a deployment. Its already-loaded app may then
    // request a lazy chunk from the previous build after the service worker has
    // activated the new build and removed the old cache. Vite reports that as a
    // preload error; reload once so the browser gets a matching HTML/chunk set.
    const recoverFromStaleChunk = (event: Event) => {
      event.preventDefault();
      const key = "rewind:chunk-recovery";
      let previousAttempt = 0;
      try {
        previousAttempt = Number(sessionStorage.getItem(key) ?? 0);
      } catch {
        // Storage can be disabled; recovery still gets one immediate attempt.
      }
      if (Date.now() - previousAttempt < 15_000) return;
      try {
        sessionStorage.setItem(key, String(Date.now()));
      } catch {
        // The page reload remains useful when storage is unavailable.
      }
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", recoverFromStaleChunk);
    if (!("serviceWorker" in navigator)) {
      return () => window.removeEventListener("vite:preloadError", recoverFromStaleChunk);
    }
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
    return () => {
      window.removeEventListener("vite:preloadError", recoverFromStaleChunk);
    };
  }, []);
  return null;
}
