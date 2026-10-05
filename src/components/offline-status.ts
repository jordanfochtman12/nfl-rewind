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
