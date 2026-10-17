/**
 * Real career trajectories. A real draftee's seed rating is his career PEAK (derived from
 * actual production); on its own that made every future star a finished product at 22 and
 * let everyone drift upward forever. With his real arc (last season, seasons as a starter,
 * age at draft) he now arrives raw, climbs to that peak on a realistic ramp, holds it for
 * the stretch he actually held it, fades at the end, and retires the year he really did.
 */
import type { Player, Pos, RatingKey } from "./types.ts";
import { CAREER_ARCS, VET_ARCS, type CareerArcRow, type VetArcRow } from "./data/careerArcs.ts";
import { UNDRAFTED_ARCS } from "./data/undrafted.ts";
import { AUDIT_ARCS, AUDIT_VET_ARCS } from "./data/auditPlayers.ts";
import { applyAgeDelta } from "./profiles.ts";
import { deriveOvr, primaryKeys } from "./ratings.ts";
import { clamp } from "./rng.ts";

/** Last season the source data can speak to; careers still going then are open-ended. */
export const ARC_DATA_LAST = 2025;

/** Typical career length used when a real career is still ongoing at the data cutoff. */
const TYPICAL_LEN: Record<Pos, number> = {
  QB: 13, RB: 7, FB: 7, WR: 10, TE: 11, LT: 12, LG: 11, C: 12, RG: 11, RT: 12,
  DE: 10, DT: 10, OLB: 10, MLB: 10, CB: 9, S: 10, K: 16, P: 16,
};

/** The age a good player at each spot usually plays to. */
const END_AGE: Record<Pos, number> = {
  QB: 37, RB: 30, FB: 31, WR: 32, TE: 33, LT: 34, LG: 33, C: 34, RG: 33, RT: 34,
  DE: 32, DT: 32, OLB: 32, MLB: 32, CB: 31, S: 32, K: 38, P: 38,
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

/**
 * Brief comebacks that would otherwise read as an unbroken career: Philip Rivers retired after
 * 2020 and came back for three games in 2025, which left his arc "still going" and kept him at
 * his peak into his mid-40s. For the sim his career ends where it really did.
 */
const CAMEO_ENDS: Record<string, number> = { "philip|rivers": 2020 };

export function lookupArc(year: number, first: string, last: string): Player["arc"] | undefined {
  const arc = lookupArcRow(year, first, last);
  if (!arc) return arc;
  for (const k of keysOf(first, last)) {
    const end = CAMEO_ENDS[k];
    if (end !== undefined) return { ...arc, to: end };
  }
  return arc;
}

/**
 * Supplemental-draft picks the imported arc tables skip: without a real career to follow,
 * Kosar (1985 supplemental) aged like a generic passer and kept starting until 2001.
 * [lastSeason, seasonsAsStarter, games, proBowls, firstTeamAllPros, ageAtDraft]
 */
const SUPPLEMENTAL: Record<string, { dy: number; row: CareerArcRow }> = {
  "bernie|kosar": { dy: 1985, row: [1996, 9, 124, 1, 0, 21] },
  "cris|carter": { dy: 1987, row: [2002, 12, 234, 8, 2, 21] },
  "brian|bosworth": { dy: 1987, row: [1989, 2, 24, 0, 0, 22] },
  "steve|young": { dy: 1984, row: [1999, 10, 169, 7, 3, 22] },
};

function lookupArcRow(year: number, first: string, last: string): Player["arc"] | undefined {
  const found = lookupTable(year, first, last);
  if (found) return found;
  for (const k of keysOf(first, last)) {
    const sup = SUPPLEMENTAL[k] ?? UNDRAFTED_ARCS[k] ?? AUDIT_ARCS[k];
    if (sup && Math.abs(sup.dy - year) <= 1) {
      const r = sup.row;
      return { dy: year, to: r[0], st: r[1], g: r[2], pb: r[3], ap: r[4], age: r[5] };
    }
  }
  return undefined;
}

function lookupTable(year: number, first: string, last: string): Player["arc"] | undefined {
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

/** Which game positions an old-era draft-table position code could mean. */
const RAW_POS_FITS: Record<string, Pos[]> = {
  QB: ["QB"],
  B: ["QB", "RB", "FB", "CB", "S"],
  HB: ["RB", "FB", "CB", "S"],
  FB: ["FB", "RB", "MLB"],
  RB: ["RB", "FB"],
  E: ["WR", "TE", "DE", "OLB"],
  WR: ["WR", "TE"],
  FL: ["WR"],
  TE: ["TE", "WR"],
  T: ["LT", "RT", "LG", "RG", "DT", "DE"],
  G: ["LG", "RG", "C", "LT", "RT", "DT", "MLB"],
  C: ["C", "LG", "RG", "MLB", "OLB"],
  OT: ["LT", "RT", "LG", "RG"],
  OG: ["LG", "RG", "C"],
  DE: ["DE", "OLB", "DT"],
  DT: ["DT", "DE"],
  LB: ["MLB", "OLB", "DE"],
  DB: ["CB", "S"],
  K: ["K", "P"],
  P: ["P", "K"],
};

function fits(raw: string, pos: Pos): boolean {
  const codes = raw.split(/[^A-Z]+/).filter(Boolean);
  if (!codes.length) return true;
  return codes.some((c) => (RAW_POS_FITS[c] ?? []).includes(pos));
}

/** A 1966 veteran's real arc, matched on name and a loose position check against old draft tables. */
export function lookupVetArc(first: string, last: string, pos: Pos): Player["arc"] | undefined {
  let rows: VetArcRow[] = [];
  for (const k of keysOf(first, last)) {
    const hit = VET_ARCS[k] ?? AUDIT_VET_ARCS[k];
    if (hit?.length) {
      rows = hit;
      break;
    }
  }
  if (!rows.length) return undefined;
  const fitting = rows.filter((r) => fits(r[7], pos));
  const pick = (fitting.length ? fitting : rows.length === 1 ? rows : []).sort((a, b) => b[3] - a[3])[0];
  if (!pick) return undefined;
  return { dy: pick[0], to: pick[1], st: pick[2], g: pick[3], pb: pick[4], ap: pick[5], age: pick[6] };
}

/**
 * A veteran arrives mid-career with a hand-curated 1966 rating. Arc targets are
 * `peak - offset(season)`, so set his peak so that the curve passes through that 1966
 * rating - his real past and future then hang off the rating he already has.
 */
export function calibrateVetPeak(p: Player, season: number): void {
  if (!p.arc) return;
  const idx = season - p.arc.dy;
  p.potential = p.ovr;
  p.potential = p.ovr + (p.ovr - arcTarget(p, idx));
  // Already on the back side of his career: that peak happened before 1966, so it counts
  // toward his legacy (HOF ballot). A young vet still climbing hasn't reached it yet.
  if (arcTarget(p, idx + 1) <= arcTarget(p, idx)) p.peakOvr = Math.max(p.peakOvr, p.potential);
}

/**
 * Minimum peak his real honors justify. The seed peak comes from counting stats, which
 * undersells stars from low-volume eras and positions (Bradshaw: 4 rings, MVP, 3 Pro
 * Bowls, seeded at 76). Only ever raises a peak, never lowers one.
 */
export function honorsFloor(arc: NonNullable<Player["arc"]>, pos?: Pos): number {
  let { pb, ap } = arc;
  // A career still going at the data cutoff has only banked part of its honors: five Pro Bowls
  // in five seasons is a nine-Pro-Bowl career in the making, not a three-to-five one. With a
  // few seasons to go on, carry most of his pace through a typical career at his position.
  const played = arc.to - arc.dy + 1;
  if (pos && isOpen(arc) && played >= 3 && played < TYPICAL_LEN[pos]) {
    const left = (TYPICAL_LEN[pos] - played) * 0.7;
    pb = Math.round(pb + (pb / played) * left);
    ap = Math.round(ap + (ap / played) * left);
  }
  if (pb <= 0 && ap <= 0) return 0;
  const base = pb >= 9 ? 89 : pb >= 6 ? 87 : pb >= 3 ? 84 : 80;
  return Math.min(97, base + Math.min(ap, 4));
}

function isOpen(arc: NonNullable<Player["arc"]>): boolean {
  return arc.to >= ARC_DATA_LAST || unplayed(arc);
}

/**
 * Drafted after the data ends: the table's 0 means "no seasons on record yet", not "never
 * played". Read as a career that ended on draft day, the whole 2026 class retired after its
 * rookie year.
 */
function unplayed(arc: NonNullable<Player["arc"]>): boolean {
  return arc.to <= 0 && arc.dy > ARC_DATA_LAST;
}

/** Drafted after the record ends: his peak is still the scouts' projection. */
export function projectedOnly(arc: NonNullable<Player["arc"]>): boolean {
  return unplayed(arc);
}

/** He really never played a down: the real record is done with him on draft day. */
function neverPlayed(arc: NonNullable<Player["arc"]>): boolean {
  return arc.to <= 0 && !unplayed(arc);
}

function careerLength(p: Player, arc: NonNullable<Player["arc"]>): number {
  if (neverPlayed(arc)) return 1;
  const real = Math.max(0, arc.to - arc.dy + 1);
  if (!isOpen(arc)) return Math.max(1, real);
  const L = Math.max(real, TYPICAL_LEN[p.pos]);
  // A star still going when the record stops plays to his position's usual end, not an average
  // career's length: given a typical one, every 2017-20 Pro Bowler was fading by 2027 and the
  // league had four 90s left in 2031.
  if (p.potential >= 86 && !unplayed(arc)) return Math.max(L, END_AGE[p.pos] - (arc.age || 22) + 1);
  return L;
}

/** Where his rating should sit in season `idx` of his career (0 = rookie year). */
export function arcTarget(p: Player, idx: number): number {
  const arc = p.arc!;
  const peak = p.potential;
  const L = careerLength(p, arc);
  const round = p.draftRound ?? 4;
  // No seasons on record yet: his draft slot is the best read on how ready he is.
  const starterShare = unplayed(arc) ? (round <= 1 ? 0.7 : round <= 2 ? 0.5 : round <= 4 ? 0.3 : 0.15) : clamp(arc.st / L, 0, 1);
  // How far from finished he arrived: guys who started nearly every year were ready early;
  // late-round picks and QBs came in rawest.
  let gap = 3 + 10 * (1 - starterShare);
  if (p.pos === "QB") gap += 3;
  if (p.pos === "RB") gap -= 2;
  if (round >= 6) gap += 5;
  else if (round >= 4) gap += 3;
  if (neverPlayed(arc)) gap = 3;
  gap = Math.round(clamp(gap, 1, 18));
  // The owner set his draft-day grade and his peak: the climb between them is his.
  if (p.arcGap !== undefined) gap = p.arcGap;

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

/**
 * Set an owner's grade exactly. His core skills move a point at a time, so the overall can't
 * skip past the target; release, then pocket movement, rise only once those top out. Speed
 * stays at his real 40 time. A grade his ratings can't carry stops at the closest one they can.
 */
export function gradeTo(p: Player, target: number): void {
  const bump = (keys: RatingKey[], d: number): boolean => {
    let moved = false;
    for (const k of keys) {
      const v = clamp(p.ratings[k] + d, 25, 99);
      if (v !== p.ratings[k]) {
        p.ratings[k] = v;
        moved = true;
      }
    }
    return moved;
  };
  const core = primaryKeys(p.pos);
  for (let i = 0; i < 400 && p.ovr !== target; i++) {
    const up = target > p.ovr;
    const moved = up ? bump(core, 1) || bump(["rel"], 1) || bump(["agi"], 1) : bump(core, -1) || bump(["rel"], -1);
    if (!moved) return;
    p.ovr = deriveOvr(p.pos, p.ratings);
  }
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
  if (neverPlayed(arc)) return seasonJustPlayed >= arc.dy;
  if (isOpen(arc)) {
    // Still going when the record stops: done once he's had a typical career for his position
    // and slipped, or two years past it unless he's still a star. Left to the generic age rules,
    // 2017-19 draftees were still on rosters at 36 as 70s, a tenth of the 2030s league past 33.
    const past = seasonJustPlayed - arc.dy + 1 - careerLength(p, arc);
    if (past >= 2 && p.ovr < 85) return true;
    if (past >= 0 && p.ovr < 78) return true;
    return undefined;
  }
  return seasonJustPlayed >= arc.to;
}
