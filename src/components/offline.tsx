/**
 * Registers the offline service worker (public/sw.js) in production builds. The compact app
 * shell is cached at install; the full offline library is an explicit choice in Settings.
 */
import { useEffect } from "react";
import { claimChunkRecovery, isModuleLoadFailure } from "@/lib/chunk-recovery";

export function OfflineSupport() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let recoveryRequested = false;
    // A tab can stay open across a deployment. Its already-loaded app may then
    // request a lazy chunk from the previous build after the service worker has
    // activated the new build and removed the old cache. Vite reports that as a
    // preload error; reload once so the browser gets a matching HTML/chunk set.
    const recoverFromModuleFailure = (event: Event) => {
      if (recoveryRequested) return;
      recoveryRequested = true;
      event.preventDefault();
      if (!claimChunkRecovery()) {
        window.dispatchEvent(new Event("rewind:chunk-recovery-exhausted"));
        return;
      }
      window.location.reload();
    };
    const recoverFromRejectedModule = (event: PromiseRejectionEvent) => {
      if (isModuleLoadFailure(event.reason)) recoverFromModuleFailure(event);
    };
    window.addEventListener("vite:preloadError", recoverFromModuleFailure);
    window.addEventListener("unhandledrejection", recoverFromRejectedModule);
    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("vite:preloadError", recoverFromModuleFailure);
        window.removeEventListener("unhandledrejection", recoverFromRejectedModule);
      };
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
      window.removeEventListener("vite:preloadError", recoverFromModuleFailure);
      window.removeEventListener("unhandledrejection", recoverFromRejectedModule);
    };
  }, []);
  return null;
}
