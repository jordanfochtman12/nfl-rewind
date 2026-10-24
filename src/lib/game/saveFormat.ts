import type { DynastySave } from "./types.ts";

/** Approximate serialized save size without loading historical simulation catalogs. */
export function displaySaveByteLength(save: DynastySave): number {
  try {
    return new Blob([JSON.stringify(save)]).size;
  } catch {
    return JSON.stringify(save).length;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
