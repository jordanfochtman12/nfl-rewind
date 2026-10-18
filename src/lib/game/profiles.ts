import type { Player, Pos, RatingKey, Ratings } from "./types.ts";
import { RATING_KEYS } from "./types.ts";
import { clamp } from "./rng.ts";
import { deriveOvr, emptyRatings, POS_BASE, primaryKeys } from "./ratings.ts";
import { isBody } from "./body.ts";
import { STAR_PROFILES } from "./data/starProfiles.ts";

/** How a player is built. Secondaries stay low — overall is derived, not copied onto every attribute. */
export type Arch =
  | "cannon"
  | "deadeye"
  | "scrambler"
  | "manager"
  | "dual"
  | "elusive"
  | "power-back"
  | "home-run"
  | "receiving-back"
  | "burner"
  | "possession"
  | "contested"
  | "slot"
  | "move-te"
  | "block-te"
  | "pass-ol"
  | "run-ol"
  | "anchor"
  | "edge"
  | "two-gap"
  | "finisher"
  | "cover-lb"
  | "thumper"
  | "blanket"
  | "hawk"
  | "box-s"
  | "leg"
  | "ice";

export const ARCH_LABEL: Record<Arch, string> = {
  cannon: "Cannon arm",
  deadeye: "Precision passer",
  scrambler: "Scrambler",
  manager: "Game manager",
  dual: "Dual-threat",
  elusive: "Elusive back",
  "power-back": "Between the tackles",
  "home-run": "Home-run speed",
  "receiving-back": "Third-down back",
  burner: "Take the top off",
  possession: "Possession receiver",
  contested: "Wins it in the air",
  slot: "Slot separator",
  "move-te": "Move tight end",
  "block-te": "In-line tight end",
  "pass-ol": "Pass setter",
  "run-ol": "Road grader",
  anchor: "Anchor",
  edge: "Edge rusher",
  "two-gap": "Two-gap nose",
  finisher: "Closer",
  "cover-lb": "Coverage linebacker",
  thumper: "Thumper",
  blanket: "Press corner",
  hawk: "Ball hawk",
  "box-s": "Box safety",
  leg: "Leg",
  ice: "Ice kicker",
};

export const ARCH_DELTA: Record<Arch, Partial<Ratings>> = {
  cannon: { throwPow: 16, throwAcc: 2, rel: 6, throwAwr: 2 },
  deadeye: { throwAcc: 14, throwAwr: 10, rel: 8, throwPow: -2 },
  scrambler: { speed: 14, agi: 14, accel: 10, throwAwr: 4, str: -6 },
  manager: { throwAcc: 8, throwAwr: 12, awareness: 10, throwPow: -4 },
  dual: { speed: 12, agi: 10, throwPow: 8, throwAcc: 4, accel: 8 },
  elusive: { elu: 14, agi: 12, accel: 8, truck: -8, btk: 4 },
  "power-back": { truck: 14, str: 10, btk: 10, elu: -6, speed: -4 },
  "home-run": { speed: 14, accel: 12, elu: 6, truck: -4 },
  "receiving-back": { catch: 12, rrt: 8, elu: 6, cit: 6, truck: -4 },
  burner: { speed: 14, accel: 12, rrt: 4, cit: -4 },
  possession: { catch: 12, rrt: 10, cit: 4, speed: -6 },
  contested: { cit: 14, catch: 6, str: 6, speed: -2 },
  slot: { rrt: 12, agi: 10, rel: 8, catch: 6, cit: -4 },
  "move-te": { speed: 10, catch: 10, rrt: 8, runBlk: -6 },
  "block-te": { runBlk: 12, passBlk: 8, str: 8, speed: -6, catch: -4 },
  "pass-ol": { passBlk: 12, agi: 6, runBlk: -2 },
  "run-ol": { runBlk: 12, str: 8, passBlk: -4 },
  anchor: { str: 12, passBlk: 8, runBlk: 6 },
  edge: { prs: 14, speed: 8, accel: 8, str: -4 },
  "two-gap": { str: 14, tak: 8, prs: -4 },
  finisher: { tak: 10, pur: 10, prs: 6 },
  "cover-lb": { cov: 12, speed: 8, tak: -4, awareness: 6 },
  thumper: { tak: 14, str: 8, cov: -6, awareness: 4 },
  blanket: { cov: 14, agi: 8, speed: 6, catch: -4 },
  hawk: { awareness: 10, catch: 10, cov: 6, speed: 4 },
  "box-s": { tak: 12, str: 6, cov: -4, pur: 6 },
  leg: { kickPow: 14, kickAcc: 2 },
  ice: { kickAcc: 14, kickPow: 2, awareness: 6 },
};

export const ARCH_POOL: Record<Pos, Arch[]> = {
  QB: ["deadeye", "cannon", "scrambler", "manager", "dual"],
  RB: ["elusive", "power-back", "home-run", "receiving-back"],
  FB: ["power-back", "receiving-back"],
  WR: ["burner", "possession", "contested", "slot"],
  TE: ["move-te", "block-te"],
  LT: ["pass-ol", "anchor", "run-ol"],
  LG: ["run-ol", "anchor", "pass-ol"],
  C: ["anchor", "pass-ol"],
  RG: ["run-ol", "anchor", "pass-ol"],
  RT: ["pass-ol", "run-ol", "anchor"],
  DE: ["edge", "finisher", "two-gap"],
  DT: ["two-gap", "finisher", "anchor"],
  OLB: ["edge", "cover-lb", "finisher"],
  MLB: ["thumper", "cover-lb", "finisher"],
  CB: ["blanket", "hawk"],
  S: ["hawk", "box-s"],
  K: ["ice", "leg"],
  P: ["leg", "ice"],
};

export interface PlayerProfile {
  arch: Arch;
  label: string;
  rt?: Partial<Ratings>;
  ht?: number;
  wt?: number;
  fy?: number;
}

export function nameKey(first: string, last: string): string {
  return `${first}|${last}`.toLowerCase().replace(/[.'']/g, "");
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nameVariance(first: string, last: string, spread: number): (n: number) => number {
  const h = hash32(nameKey(first, last));
  let i = 0;
  return (n: number) => {
    if (spread <= 0) return n;
    const bit = (h >>> ((i * 5) % 24)) & 15;
    i += 1;
    const j = (bit % (spread * 2 + 1)) - spread;
    return n + j;
  };
}

export function nameSalt(first: string, last: string): number {
  return hash32(nameKey(first, last));
}

export function inferArch(pos: Pos, first: string, last: string): Arch {
  const star = STAR_PROFILES[nameKey(first, last)];
  if (star) return star.arch;
  const pool = ARCH_POOL[pos];
  return pool[hash32(nameKey(first, last)) % pool.length]!;
}

export function lookupProfile(pos: Pos, first: string, last: string): PlayerProfile {
  const star = STAR_PROFILES[nameKey(first, last)];
  const arch = star?.arch ?? inferArch(pos, first, last);
  return {
    arch,
    label: ARCH_LABEL[arch],
    rt: star?.rt,
    ht: star?.ht,
    wt: star?.wt,
    fy: star?.fy,
  };
}

export function ratingsFromProfile(
  pos: Pos,
  ovr: number,
  arch: Arch | undefined,
  extra: Partial<Ratings> | undefined,
  jitterFn: (n: number) => number,
  /** Ratings his real career set (scripts/rating-audit.mjs): the rest of the kit carries his level. */
  pinned?: ReadonlySet<RatingKey>,
): Ratings {
  const r = emptyRatings(36);
  const base = POS_BASE[pos];
  const delta = arch ? ARCH_DELTA[arch] : {};
  const primaries = new Set(primaryKeys(pos));
  const locked = new Set<RatingKey>(extra ? (Object.keys(extra) as RatingKey[]) : []);

  for (const k of RATING_KEYS) {
    const isPri = primaries.has(k);
    let v = isPri ? (base[k] ?? 58) : (base[k] ?? 34);
    v += delta[k] ?? 0;
    if (isPri) v = Math.round(v * 0.4 + ovr * 0.6);
    else v = Math.round(v + (ovr - 72) * 0.06);
    if (extra && extra[k] != null) {
      r[k] = clamp(extra[k]!, 25, 99);
    } else {
      r[k] = clamp(Math.round(jitterFn(v)), 25, 99);
    }
  }

  for (let i = 0; i < 5; i++) {
    const got = deriveOvr(pos, r);
    const diff = ovr - got;
    if (Math.abs(diff) <= 1) break;
    for (const k of primaries) {
      if (locked.has(k)) continue;
      r[k] = clamp(r[k] + Math.round(diff * 0.32), 25, 99);
    }
  }
  // A star profile can lock nearly every key rating, leaving nothing above to move: Manning's
  // locks alone came out a 91 against his 96 seed. The locks are his shape, the seed is his
  // level, so the whole profile shifts together until he lands on it.
  for (let i = 0; i < 8; i++) {
    const diff = ovr - deriveOvr(pos, r);
    if (Math.abs(diff) <= 1) break;
    const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.5));
    let moved = false;
    for (const k of primaries) {
      if (pinned?.has(k)) continue;
      const v = clamp(r[k] + step, 25, 99);
      if (v !== r[k]) moved = true;
      r[k] = v;
    }
    if (!moved) break;
  }
  return r;
}

/**
 * A move in how well he plays: his skills, never his body. Speed, burst, agility, strength,
 * stamina and durability age on their own clock (body.ts), so a star climbing to his peak or
 * eased down to a draft grade keeps the legs he has.
 */
export function applyAgeDelta(p: Player, delta: number): void {
  if (!delta) return;
  const skills = primaryKeys(p.pos).filter((k) => !isBody(k));
  for (const k of skills) {
    p.ratings[k] = clamp(p.ratings[k] + delta, 25, 99);
  }
  if (delta > 0) p.ratings.awareness = clamp(p.ratings.awareness + 1, 25, 99);
  p.ovr = deriveOvr(p.pos, p.ratings);
}

export const SCOUT_KEYS: Record<Pos, { key: RatingKey; label: string }[]> = {
  QB: [
    { key: "throwPow", label: "Arm" },
    { key: "throwAcc", label: "Accuracy" },
    { key: "throwAwr", label: "Reads" },
    { key: "rel", label: "Release" },
    { key: "agi", label: "Escape" },
    { key: "speed", label: "Speed" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
  RB: [
    { key: "speed", label: "Speed" },
    { key: "elu", label: "Elude" },
    { key: "btk", label: "Break" },
    { key: "truck", label: "Power" },
    { key: "accel", label: "Burst" },
    { key: "catch", label: "Hands" },
    { key: "stamina", label: "Work" },
    { key: "inj", label: "Tough" },
  ],
  FB: [
    { key: "runBlk", label: "Run blk" },
    { key: "truck", label: "Power" },
    { key: "str", label: "Str" },
    { key: "catch", label: "Hands" },
    { key: "passBlk", label: "Pass blk" },
  ],
  WR: [
    { key: "speed", label: "Speed" },
    { key: "catch", label: "Hands" },
    { key: "rrt", label: "Routes" },
    { key: "cit", label: "Contested" },
    { key: "accel", label: "Burst" },
    { key: "agi", label: "Agility" },
    { key: "rel", label: "Release" },
  ],
  TE: [
    { key: "catch", label: "Hands" },
    { key: "cit", label: "Contested" },
    { key: "runBlk", label: "Run blk" },
    { key: "speed", label: "Speed" },
    { key: "str", label: "Str" },
    { key: "rrt", label: "Routes" },
  ],
  LT: [
    { key: "passBlk", label: "Pass blk" },
    { key: "runBlk", label: "Run blk" },
    { key: "str", label: "Str" },
    { key: "awareness", label: "IQ" },
    { key: "agi", label: "Feet" },
    { key: "inj", label: "Tough" },
  ],
  LG: [
    { key: "runBlk", label: "Run blk" },
    { key: "passBlk", label: "Pass blk" },
    { key: "str", label: "Str" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
  C: [
    { key: "awareness", label: "IQ" },
    { key: "passBlk", label: "Pass blk" },
    { key: "runBlk", label: "Run blk" },
    { key: "str", label: "Str" },
    { key: "inj", label: "Tough" },
  ],
  RG: [
    { key: "runBlk", label: "Run blk" },
    { key: "passBlk", label: "Pass blk" },
    { key: "str", label: "Str" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
  RT: [
    { key: "passBlk", label: "Pass blk" },
    { key: "runBlk", label: "Run blk" },
    { key: "str", label: "Str" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
  DE: [
    { key: "prs", label: "Pass rush" },
    { key: "speed", label: "Speed" },
    { key: "tak", label: "Tackle" },
    { key: "str", label: "Str" },
    { key: "pur", label: "Pursue" },
    { key: "accel", label: "First step" },
  ],
  DT: [
    { key: "str", label: "Str" },
    { key: "prs", label: "Pass rush" },
    { key: "tak", label: "Tackle" },
    { key: "pur", label: "Pursue" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
  OLB: [
    { key: "prs", label: "Pass rush" },
    { key: "tak", label: "Tackle" },
    { key: "cov", label: "Cover" },
    { key: "speed", label: "Speed" },
    { key: "pur", label: "Pursue" },
    { key: "awareness", label: "IQ" },
  ],
  MLB: [
    { key: "tak", label: "Tackle" },
    { key: "awareness", label: "IQ" },
    { key: "pur", label: "Pursue" },
    { key: "cov", label: "Cover" },
    { key: "str", label: "Str" },
    { key: "speed", label: "Speed" },
  ],
  CB: [
    { key: "cov", label: "Cover" },
    { key: "speed", label: "Speed" },
    { key: "agi", label: "Agility" },
    { key: "accel", label: "Burst" },
    { key: "awareness", label: "IQ" },
    { key: "catch", label: "Ball" },
  ],
  S: [
    { key: "cov", label: "Cover" },
    { key: "tak", label: "Tackle" },
    { key: "awareness", label: "IQ" },
    { key: "speed", label: "Speed" },
    { key: "pur", label: "Pursue" },
    { key: "catch", label: "Ball" },
  ],
  K: [
    { key: "kickPow", label: "Leg" },
    { key: "kickAcc", label: "Accuracy" },
    { key: "awareness", label: "Ice" },
    { key: "inj", label: "Tough" },
  ],
  P: [
    { key: "kickPow", label: "Leg" },
    { key: "kickAcc", label: "Accuracy" },
    { key: "awareness", label: "IQ" },
    { key: "inj", label: "Tough" },
  ],
};

export const RATING_GROUPS: { label: string; keys: { key: RatingKey; label: string }[] }[] = [
  {
    label: "Pass",
    keys: [
      { key: "throwPow", label: "Arm" },
      { key: "throwAcc", label: "Acc" },
      { key: "throwAwr", label: "Reads" },
      { key: "rel", label: "Rel" },
    ],
  },
  {
    label: "Run",
    keys: [
      { key: "speed", label: "Spd" },
      { key: "accel", label: "Acc" },
      { key: "agi", label: "Agi" },
      { key: "str", label: "Str" },
      { key: "truck", label: "Tru" },
      { key: "elu", label: "Elu" },
      { key: "btk", label: "Brk" },
    ],
  },
  {
    label: "Hands",
    keys: [
      { key: "catch", label: "Cth" },
      { key: "cit", label: "Cit" },
      { key: "rrt", label: "Rte" },
    ],
  },
  {
    label: "Line",
    keys: [
      { key: "passBlk", label: "PB" },
      { key: "runBlk", label: "RB" },
    ],
  },
  {
    label: "D",
    keys: [
      { key: "tak", label: "Tak" },
      { key: "prs", label: "Prs" },
      { key: "cov", label: "Cov" },
      { key: "pur", label: "Pur" },
    ],
  },
  {
    label: "Boot",
    keys: [
      { key: "kickPow", label: "Leg" },
      { key: "kickAcc", label: "Acc" },
    ],
  },
  {
    label: "Body",
    keys: [
      { key: "stamina", label: "Sta" },
      { key: "inj", label: "Inj" },
      { key: "awareness", label: "IQ" },
    ],
  },
];
