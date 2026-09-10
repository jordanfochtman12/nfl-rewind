import type { DynastySave } from "./types.ts";

export function nextRng(state: number): { state: number; value: number } {
  let a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: a, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export function rand(save: Pick<DynastySave, "rng">): number {
  const r = nextRng(save.rng);
  save.rng = r.state;
  return r.value;
}

export function randInt(save: Pick<DynastySave, "rng">, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rand(save) * (max - min + 1));
}

export function pick<T>(save: Pick<DynastySave, "rng">, arr: readonly T[]): T {
  return arr[Math.floor(rand(save) * arr.length)]!;
}

export function shuffle<T>(save: Pick<DynastySave, "rng">, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(save) * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function jitter(save: Pick<DynastySave, "rng">, base: number, spread: number): number {
  return clamp(Math.round(base + (rand(save) * 2 - 1) * spread), 1, 99);
}
