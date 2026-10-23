/** Whether this device has the app shell and optional full game library cached offline. */
import { useCallback, useEffect, useState } from "react";

export type OfflineStatus = "checking" | "unsupported" | "dev" | "available" | "preparing" | "ready";
export type OfflineProgress = {
  status: OfflineStatus;
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
};

const initial: OfflineProgress = {
  status: "checking",
  completedFiles: 0,
  totalFiles: 0,
  completedBytes: 0,
  totalBytes: 0,
};

export function useOfflineStatus() {
  const [progress, setProgress] = useState<OfflineProgress>(initial);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) {
      setProgress({ ...initial, status: "unsupported" });
      return;
    }
    if (!import.meta.env.PROD) {
      setProgress({ ...initial, status: "dev" });
      return;
    }

    let live = true;
    const check = async () => {
      const [manifest, keys] = await Promise.all([
        fetch("/offline-manifest.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).catch(() => null),
        caches.keys().catch(() => [] as string[]),
      ]);
      const totalBytes = Number(manifest?.totalBytes) || 0;
      const totalFiles = Array.isArray(manifest?.files) ? manifest.files.length : 0;
      const assetCacheName = keys.find((key) => key.startsWith("rewind-assets-"));
      const assetCache = assetCacheName ? await caches.open(assetCacheName) : undefined;
      if (!navigator.serviceWorker.controller || !keys.includes("rewind-shell")) {
        if (live) setProgress({ ...initial, status: "available", totalBytes, totalFiles });
        return;
      }

      if (await assetCache?.match("/__offline_complete__")) {
        if (live) setProgress({ status: "ready", completedFiles: totalFiles, totalFiles, completedBytes: totalBytes, totalBytes });
        return;
      }
      const saved = await assetCache?.match("/__offline_progress__");
      const snapshot = saved ? await saved.json().catch(() => null) : null;
      if (live) setProgress({
        status: snapshot?.status === "preparing" ? "preparing" : "available",
        completedFiles: Number(snapshot?.completedFiles) || 0,
        totalFiles: Number(snapshot?.totalFiles) || totalFiles,
        completedBytes: Number(snapshot?.completedBytes) || 0,
        totalBytes: Number(snapshot?.totalBytes) || totalBytes,
      });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_CACHE_PROGRESS") {
        setProgress({
          status: event.data.status === "preparing" ? "preparing" : "available",
          completedFiles: Number(event.data.completedFiles) || 0,
          totalFiles: Number(event.data.totalFiles) || 0,
          completedBytes: Number(event.data.completedBytes) || 0,
          totalBytes: Number(event.data.totalBytes) || 0,
        });
      } else if (event.data?.type === "OFFLINE_CACHE_READY") {
        setProgress((current) => ({ ...current, status: "ready", completedFiles: current.totalFiles, completedBytes: current.totalBytes }));
      } else if (event.data?.type === "OFFLINE_CACHE_INCOMPLETE") {
        setProgress((current) => ({ ...current, status: "available" }));
      }
    };
    void check();
    navigator.serviceWorker.addEventListener("controllerchange", check);
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      live = false;
      navigator.serviceWorker.removeEventListener("controllerchange", check);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const prepare = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    setProgress((current) => ({ ...current, status: "preparing" }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller ?? registration.active;
      if (worker) worker.postMessage({ type: "PREPARE_FULL_OFFLINE" });
      else setProgress((current) => ({ ...current, status: "available" }));
    } catch {
      setProgress((current) => ({ ...current, status: "available" }));
    }
  }, []);

  return { ...progress, prepare };
}
