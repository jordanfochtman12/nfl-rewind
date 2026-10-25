/** Scout grades vs true ratings. Sim always uses true `ovr` / `ratings`. */
import type { DynastySave, Player, Ratings } from "./types.ts";
import { clamp, rand } from "./rng.ts";
import { primaryKeys } from "./ratings.ts";
import { deriveOvr } from "./ratings.ts";

export function expectedOvrForRound(round: number): number {
  if (round <= 1) return 82;
  if (round === 2) return 76;
  if (round === 3) return 71;
  if (round === 4) return 67;
  if (round === 5) return 64;
  if (round === 6) return 61;
  if (round === 7) return 58;
  return Math.max(50, 62 - round);
}

/**
 * Late-round stars stay hidden. A 6th-round 96 (Brady) grades in the mid-60s.
 * First-round busts grade near the slot, not the career crater.
 */
export function scoutOvrFromRound(round: number, trueOvr: number, noise: number): number {
  const expected = expectedOvrForRound(round);
  const hide = trueOvr - expected;
  let grade: number;
  if (round >= 4 && hide > 12) {
    grade = expected + noise * 8;
  } else if (round <= 2 && hide < -10) {
    grade = expected + hide * 0.25 + noise * 5;
  } else {
    grade = expected * 0.58 + trueOvr * 0.42 + noise * 5;
  }
  return clamp(Math.round(grade), 46, 94);
}

export function isProspect(save: Pick<DynastySave, "year">, p: Player): boolean {
  return p.draftYear === save.year && p.yearsPro <= 0 && !p.revealed;
}

export function applyScout(save: Pick<DynastySave, "year" | "rng">, p: Player): void {
  const prospect = p.draftYear === save.year && p.yearsPro <= 0;
  p.revealed = !prospect;
  const ceilingBump = prospect ? 2 + Math.floor(rand(save) * 7) : Math.floor(rand(save) * 3);
  p.potential = clamp(p.ovr + ceilingBump, p.ovr, 99);
  p.morale = p.morale || 68 + Math.floor(rand(save) * 16);
  p.snaps = p.snaps ?? 0;
  if (prospect) {
    // Round 0 is an undrafted name: graded like the leftovers after the last round, not a first-rounder.
    const round = p.draftRound || 8;
    p.scoutOvr = scoutOvrFromRound(round, p.ovr, rand(save) * 2 - 1);
  } else {
    p.scoutOvr = clamp(p.ovr + Math.floor(rand(save) * 5) - 2, 40, 99);
  }
}

export function visibleOvr(p: Player): number {
  if (p.revealed) return p.ovr;
  return p.scoutOvr ?? p.ovr;
}

export function visibleRatings(p: Player): Ratings {
  if (p.revealed) return p.ratings;
  const target = p.scoutOvr ?? p.ovr;
  const d = target - p.ovr;
  const out = { ...p.ratings };
  const primaries = primaryKeys(p.pos);
  for (const k of primaries) {
    out[k] = clamp(p.ratings[k] + Math.round(d * 0.85), 25, 99);
  }
  return out;
}

export function maybeReveal(p: Player, extraSnaps = 0): void {
  p.snaps = (p.snaps ?? 0) + extraSnaps;
  if (p.revealed) return;
  if (p.snaps >= 6 || p.yearsPro >= 3 || p.age >= 27) p.revealed = true;
}

export function scoutLetter(ovr: number): string {
  if (ovr >= 92) return "A+";
  if (ovr >= 88) return "A";
  if (ovr >= 84) return "A-";
  if (ovr >= 80) return "B+";
  if (ovr >= 76) return "B";
  if (ovr >= 72) return "B-";
  if (ovr >= 68) return "C+";
  if (ovr >= 64) return "C";
  if (ovr >= 58) return "C-";
  if (ovr >= 52) return "D";
  return "F";
}

export function scoutLine(p: Player): string {
  const o = visibleOvr(p);
  if (p.revealed) return `${o} OVR`;
  return `Scout ${o} · ${scoutLetter(o)}`;
}

/** Derived scout overall from the noisy kit — used to keep the grade honest. */
export function derivedScoutOvr(p: Player): number {
  if (p.revealed) return p.ovr;
  return deriveOvr(p.pos, visibleRatings(p));
}
