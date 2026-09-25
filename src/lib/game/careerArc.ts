/**
 * Real career trajectories. A real draftee's seed rating is his career PEAK (derived from
 * actual production); on its own that made every future star a finished product at 22 and
 * let everyone drift upward forever. With his real arc (last season, seasons as a starter,
 * age at draft) he now arrives raw, climbs to that peak on a realistic ramp, holds it for
 * the stretch he actually held it, fades at the end, and retires the year he really did.
 */
import type { Player, Pos } from "./types.ts";
import { CAREER_ARCS, type CareerArcRow } from "./data/careerArcs.ts";
import { applyAgeDelta } from "./profiles.ts";
import { clamp } from "./rng.ts";

/** Last season the source data can speak to; careers still going then are open-ended. */
export const ARC_DATA_LAST = 2025;

/** Typical career length used when a real career is still ongoing at the data cutoff. */
const TYPICAL_LEN: Record<Pos, number> = {
  QB: 13, RB: 7, FB: 7, WR: 10, TE: 11, LT: 12, LG: 11, C: 12, RG: 11, RT: 12,
  DE: 10, DT: 10, OLB: 10, MLB: 10, CB: 9, S: 10, K: 16, P: 16,
};

function key(first: string, last: string): string {
  return `${first}|${last}`.toLowerCase().replace(/[.'’`]/g, "");
}

function keysOf(first: string, last: string): string[] {
  const out = [key(first, last)];
  const parts = `${first} ${last}`.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    out.push(key(parts[0]!, parts.slice(1).join(" ")));
    out.push(key(parts.slice(0, -1).join(" "), parts[parts.length - 1]!));
    out.push(key(parts[0]!, parts[parts.length - 1]!));
  }
  return out;
}

export function lookupArc(year: number, first: string, last: string): Player["arc"] | undefined {
  // Some sources list a supplemental or late-classified pick a year off; exact year first.
  for (const y of [year, year - 1, year + 1]) {
    const bucket = CAREER_ARCS[y];
    if (!bucket) continue;
    for (const k of keysOf(first, last)) {
      const row: CareerArcRow | undefined = bucket[k];
      if (row) return { dy: year, to: row[0], st: row[1], g: row[2], pb: row[3], ap: row[4], age: row[5] };
    }
  }
  return undefined;
}

/**
 * Minimum peak his real honors justify. The seed peak comes from counting stats, which
 * undersells stars from low-volume eras and positions (Bradshaw: 4 rings, MVP, 3 Pro
 * Bowls, seeded at 76). Only ever raises a peak, never lowers one.
 */
export function honorsFloor(arc: NonNullable<Player["arc"]>): number {
  if (arc.pb <= 0 && arc.ap <= 0) return 0;
  const base = arc.pb >= 9 ? 89 : arc.pb >= 6 ? 87 : arc.pb >= 3 ? 84 : 80;
  return Math.min(97, base + Math.min(arc.ap, 4));
}

function isOpen(arc: NonNullable<Player["arc"]>): boolean {
  return arc.to >= ARC_DATA_LAST;
}

function careerLength(p: Player, arc: NonNullable<Player["arc"]>): number {
  if (arc.to <= 0) return 1;
  const real = arc.to - arc.dy + 1;
  return isOpen(arc) ? Math.max(real, TYPICAL_LEN[p.pos]) : Math.max(1, real);
}

/** Where his rating should sit in season `idx` of his career (0 = rookie year). */
export function arcTarget(p: Player, idx: number): number {
  const arc = p.arc!;
  const peak = p.potential;
  const L = careerLength(p, arc);
  const starterShare = clamp(arc.st / L, 0, 1);
  const round = p.draftRound ?? 4;
  // How far from finished he arrived: guys who started nearly every year were ready early;
  // late-round picks and QBs came in rawest.
  let gap = 3 + 10 * (1 - starterShare);
  if (p.pos === "QB") gap += 3;
  if (p.pos === "RB") gap -= 2;
  if (round >= 6) gap += 5;
  else if (round >= 4) gap += 3;
  if (arc.to <= 0) gap = 3;
  gap = Math.round(clamp(gap, 1, 18));

  const ramp = L <= 2 ? 1 : Math.round(clamp(L * 0.3, 1, p.pos === "QB" ? 5 : 4));
  const decline = L >= 6 ? Math.round(clamp(L * 0.25, 1, 4)) : L >= 3 ? 1 : 0;
  const endDrop = 6 + (L >= 12 ? 2 : 0);

  if (idx >= L) return Math.round(peak - endDrop - 2 * (idx - L + 1));
  if (idx < ramp) return Math.round(peak - gap * (1 - idx / ramp));
  if (decline > 0 && idx >= L - decline) {
    const frac = (idx - (L - decline) + 1) / decline;
    return Math.round(peak - endDrop * frac);
  }
  return peak;
}

/** Nudge ratings until overall lands on target (ovr is derived, so one shift isn't exact). */
export function moveToward(p: Player, target: number): void {
  for (let i = 0; i < 8; i++) {
    const d = target - p.ovr;
    if (d === 0) return;
    const before = p.ovr;
    applyAgeDelta(p, Math.sign(d) * Math.min(Math.abs(d), 3));
    if (p.ovr === before) return;
  }
}

/** Real careers end the season they really ended; still-going careers age out normally. */
export function arcRetiresNow(p: Player, seasonJustPlayed: number): boolean | undefined {
  const arc = p.arc;
  if (!arc) return undefined;
  if (arc.to <= 0) return seasonJustPlayed >= arc.dy;
  if (isOpen(arc)) return undefined;
  return seasonJustPlayed >= arc.to;
}
