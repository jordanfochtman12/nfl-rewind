/**
 * Save slots: several dynasties side by side. Each slot is its own IndexedDB entry (slot 1 is
 * the key the game always used, so an existing dynasty is slot 1 with no migration), and a
 * small index in localStorage remembers what's in each slot for the title screen.
 */
import type { DynastySave } from "@/lib/game/index.ts";
import { displayName } from "@/lib/game/index.ts";

export const SLOT_COUNT = 5;
const ACTIVE_KEY = "nfl-rewind-active-slot";
const INDEX_KEY = "nfl-rewind-slots";

export type SlotKind = "dynasty" | "watch" | "history";

export interface SlotMeta {
  slot: number;
  kind: SlotKind;
  /** The club for a dynasty; "Watch history" / "History mode" otherwise. */
  title: string;
  teamId?: string;
  year: number;
  weekLabel: string;
  /** Last written, ms since epoch. */
  t: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: slots still work for this visit */
  }
}

let active: number = Math.min(SLOT_COUNT, Math.max(1, Number(read(ACTIVE_KEY, 1)) || 1));

export const activeSlot = (): number => active;

export function setActiveSlot(slot: number): void {
  active = Math.min(SLOT_COUNT, Math.max(1, Math.round(slot)));
  write(ACTIVE_KEY, active);
}

/** The storage key a slot's save lives under (slot 1 keeps the original key). */
export function slotKey(name: string, slot = active): string {
  return slot === 1 ? name : `${name}:slot${slot}`;
}

export function slotIndex(): Record<number, SlotMeta> {
  return read<Record<number, SlotMeta>>(INDEX_KEY, {});
}

export function slotKind(save: DynastySave): SlotKind {
  return save.realHistory ? "history" : save.sandbox ? "watch" : "dynasty";
}

/** Note what a slot now holds (or that it's empty). */
export function recordSlot(slot: number, save: DynastySave | null): void {
  const index = slotIndex();
  if (!save) delete index[slot];
  else {
    const kind = slotKind(save);
    index[slot] = {
      slot,
      kind,
      title: kind === "history" ? "History mode" : kind === "watch" ? "Watch history" : displayName(save.year, save.userTeamId),
      teamId: kind === "dynasty" ? save.userTeamId : undefined,
      year: save.year,
      weekLabel: save.weekLabel,
      t: Date.now(),
    };
  }
  write(INDEX_KEY, index);
}

/** Copy what the index says about one slot onto another (a duplicated save). */
export function copySlotMeta(from: number, to: number): void {
  const index = slotIndex();
  const m = index[from];
  if (!m) return;
  index[to] = { ...m, slot: to, t: Date.now() };
  write(INDEX_KEY, index);
}
