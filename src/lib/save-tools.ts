/**
 * Save management on the title screen: how big each slot is, backing a slot up to a file
 * without loading it, copying a dynasty into an empty slot, and how much room the browser
 * has left. Reads the same packed IndexedDB entries the store writes.
 */
import { dynastyStorage } from "@/lib/save-idb.ts";
import { copySlotMeta, restoreSlotMeta, slotIndex, slotKey, SLOT_COUNT } from "@/lib/save-slots.ts";
import { displayName, type TeamId } from "@/lib/game/index.ts";

const SAVE_NAME = "nfl-rewind-dynasty";
const PACKED = (name: string) => `${name}:packed`;

async function rawOf(slot: number): Promise<{ key: string; raw: string } | null> {
  const base = slotKey(SAVE_NAME, slot);
  const packed = await dynastyStorage.getItem(PACKED(base));
  if (packed) return { key: PACKED(base), raw: packed };
  const old = await dynastyStorage.getItem(base);
  return old ? { key: base, raw: old } : null;
}

/** Bytes on disk for a slot (0 when empty). */
export async function slotBytes(slot: number): Promise<number> {
  const r = await rawOf(slot);
  return r ? r.raw.length : 0;
}

/** The slot's save as an export file's contents (the same JSON the Export button writes). */
export async function slotExport(slot: number): Promise<string | null> {
  const r = await rawOf(slot);
  if (!r) return null;
  try {
    const parsed = JSON.parse(r.raw) as { state?: { save?: unknown } };
    const save = parsed.state?.save;
    return save ? JSON.stringify(save) : null;
  } catch {
    return null;
  }
}

/** Copy a slot's save into another slot (which must be empty). */
export async function duplicateSlot(from: number, to: number): Promise<boolean> {
  const r = await rawOf(from);
  if (!r || (await rawOf(to))) return false;
  await dynastyStorage.setItem(PACKED(slotKey(SAVE_NAME, to)), r.raw);
  copySlotMeta(from, to);
  return true;
}

/** How much the browser lets the game store, if it will say. */
export async function storageRoom(): Promise<{ used: number; quota: number } | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota) return null;
    return { used: est.usage ?? 0, quota: est.quota };
  } catch {
    return null;
  }
}

export function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

/** Hand the browser a file to save. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Saves the slot list has lost track of (its index lives in localStorage, the saves in
 * IndexedDB, and a browser can clear one without the other): put every stored save back on
 * the list. Returns how many came back.
 */
export async function recoverSlots(): Promise<number> {
  const index = slotIndex();
  let found = 0;
  for (let n = 1; n <= SLOT_COUNT; n++) {
    if (index[n]) continue;
    const r = await rawOf(n);
    if (!r) continue;
    try {
      const save = (JSON.parse(r.raw) as { state?: { save?: Record<string, unknown> | null } }).state?.save;
      if (!save) continue;
      const history = !!save.realHistory;
      const watch = !!save.sandbox;
      const team = save.userTeamId as TeamId | undefined;
      const year = typeof save.year === "number" ? save.year : 1966;
      restoreSlotMeta(n, {
        kind: history ? "history" : watch ? "watch" : "dynasty",
        title: history ? "History mode" : watch ? "Watch history" : team ? displayName(year, team) : "Dynasty",
        teamId: !history && !watch ? team : undefined,
        year,
        weekLabel: typeof save.weekLabel === "string" ? save.weekLabel : "",
      });
      found += 1;
    } catch {
      /* unreadable: leave it off the list rather than guess */
    }
  }
  return found;
}
