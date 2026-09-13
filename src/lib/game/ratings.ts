import type { Pos, RatingKey, Ratings } from "./types.ts";
import { RATING_KEYS } from "./types.ts";
import { clamp } from "./rng.ts";

export const WEIGHTS: Record<Pos, Partial<Record<RatingKey, number>>> = {
  QB: {
    throwAcc: 0.22,
    throwAwr: 0.18,
    throwPow: 0.12,
    awareness: 0.16,
    rel: 0.06,
    agi: 0.06,
    speed: 0.04,
    stamina: 0.08,
    inj: 0.08,
  },
  RB: {
    speed: 0.14,
    accel: 0.12,
    elu: 0.12,
    btk: 0.1,
    truck: 0.08,
    agi: 0.1,
    catch: 0.06,
    stamina: 0.1,
    awareness: 0.08,
    inj: 0.1,
  },
  FB: {
    runBlk: 0.18,
    passBlk: 0.1,
    truck: 0.14,
    str: 0.14,
    btk: 0.1,
    catch: 0.08,
    awareness: 0.1,
    stamina: 0.08,
    inj: 0.08,
  },
  WR: {
    speed: 0.14,
    catch: 0.16,
    rrt: 0.14,
    cit: 0.1,
    rel: 0.08,
    accel: 0.1,
    agi: 0.08,
    awareness: 0.08,
    stamina: 0.06,
    inj: 0.06,
  },
  TE: {
    catch: 0.14,
    cit: 0.1,
    rrt: 0.1,
    runBlk: 0.14,
    passBlk: 0.1,
    str: 0.1,
    speed: 0.08,
    awareness: 0.1,
    stamina: 0.07,
    inj: 0.07,
  },
  LT: {
    passBlk: 0.24,
    runBlk: 0.18,
    str: 0.14,
    awareness: 0.14,
    agi: 0.08,
    stamina: 0.1,
    inj: 0.12,
  },
  LG: {
    runBlk: 0.22,
    passBlk: 0.18,
    str: 0.16,
    awareness: 0.14,
    stamina: 0.14,
    inj: 0.16,
  },
  C: {
    passBlk: 0.2,
    runBlk: 0.18,
    awareness: 0.2,
    str: 0.14,
    stamina: 0.14,
    inj: 0.14,
  },
  RG: {
    runBlk: 0.22,
    passBlk: 0.18,
    str: 0.16,
    awareness: 0.14,
    stamina: 0.14,
    inj: 0.16,
  },
  RT: {
    passBlk: 0.22,
    runBlk: 0.18,
    str: 0.16,
    awareness: 0.14,
    stamina: 0.14,
    inj: 0.16,
  },
  DE: {
    prs: 0.22,
    str: 0.12,
    tak: 0.12,
    speed: 0.1,
    pur: 0.12,
    accel: 0.08,
    awareness: 0.08,
    stamina: 0.08,
    inj: 0.08,
  },
  DT: {
    str: 0.2,
    prs: 0.16,
    tak: 0.14,
    runBlk: 0.05,
    pur: 0.1,
    awareness: 0.1,
    stamina: 0.12,
    inj: 0.13,
  },
  OLB: {
    tak: 0.16,
    prs: 0.12,
    cov: 0.12,
    speed: 0.12,
    pur: 0.12,
    awareness: 0.1,
    str: 0.08,
    stamina: 0.09,
    inj: 0.09,
  },
  MLB: {
    tak: 0.2,
    awareness: 0.16,
    pur: 0.12,
    cov: 0.1,
    str: 0.1,
    speed: 0.08,
    stamina: 0.12,
    inj: 0.12,
  },
  CB: {
    cov: 0.22,
    speed: 0.16,
    agi: 0.12,
    accel: 0.1,
    awareness: 0.1,
    pur: 0.08,
    catch: 0.06,
    stamina: 0.08,
    inj: 0.08,
  },
  S: {
    cov: 0.16,
    tak: 0.14,
    awareness: 0.14,
    speed: 0.12,
    pur: 0.12,
    catch: 0.06,
    stamina: 0.12,
    inj: 0.14,
  },
  K: { kickPow: 0.36, kickAcc: 0.4, awareness: 0.12, stamina: 0.06, inj: 0.06 },
  P: { kickPow: 0.4, kickAcc: 0.32, awareness: 0.12, stamina: 0.08, inj: 0.08 },
};

export const POS_BASE: Record<Pos, Partial<Ratings>> = {
  QB: { throwPow: 72, throwAcc: 74, throwAwr: 70, rel: 68, awareness: 72 },
  RB: { speed: 82, accel: 80, elu: 74, btk: 70, truck: 68 },
  FB: { str: 78, truck: 76, runBlk: 74, passBlk: 68 },
  WR: { speed: 84, catch: 76, rrt: 74, cit: 70, rel: 72 },
  TE: { catch: 72, cit: 70, runBlk: 70, str: 74, speed: 68 },
  LT: { passBlk: 76, runBlk: 74, str: 80 },
  LG: { runBlk: 76, passBlk: 72, str: 82 },
  C: { passBlk: 74, runBlk: 74, awareness: 76, str: 78 },
  RG: { runBlk: 76, passBlk: 72, str: 82 },
  RT: { passBlk: 74, runBlk: 74, str: 80 },
  DE: { prs: 74, str: 78, tak: 70, speed: 72 },
  DT: { str: 84, prs: 68, tak: 70 },
  OLB: { tak: 74, prs: 68, cov: 66, speed: 74 },
  MLB: { tak: 78, awareness: 76, pur: 74, str: 74 },
  CB: { cov: 76, speed: 86, agi: 82, accel: 84 },
  S: { cov: 72, tak: 72, awareness: 74, speed: 80 },
  K: { kickPow: 78, kickAcc: 76 },
  P: { kickPow: 80, kickAcc: 72 },
};

export function emptyRatings(fill = 45): Ratings {
  const r = {} as Ratings;
  for (const k of RATING_KEYS) r[k] = fill;
  return r;
}

export function deriveOvr(pos: Pos, ratings: Ratings): number {
  const w = WEIGHTS[pos];
  let sum = 0;
  let tw = 0;
  for (const [k, wt] of Object.entries(w)) {
    sum += ratings[k as RatingKey] * (wt ?? 0);
    tw += wt ?? 0;
  }
  if (tw <= 0) return 50;
  return clamp(Math.round(sum / tw), 1, 99);
}

export function primaryKeys(pos: Pos): RatingKey[] {
  return (Object.entries(WEIGHTS[pos]) as [RatingKey, number][])
    .filter(([, w]) => (w ?? 0) >= 0.08)
    .map(([k]) => k);
}

export function isPrimary(pos: Pos, key: RatingKey): boolean {
  return (WEIGHTS[pos][key] ?? 0) >= 0.08;
}

export function ratingsFromOvr(
  pos: Pos,
  ovr: number,
  jitterFn: (base: number, key: RatingKey) => number,
): Ratings {
  const r = emptyRatings(Math.round(ovr * 0.55));
  const base = POS_BASE[pos];
  const scale = ovr / 75;
  for (const k of RATING_KEYS) {
    const b = base[k] ?? 50;
    r[k] = clamp(jitterFn(b * scale, k), 25, 99);
  }
  for (let i = 0; i < 6; i++) {
    const got = deriveOvr(pos, r);
    const delta = ovr - got;
    if (Math.abs(delta) <= 1) break;
    for (const [k, wt] of Object.entries(WEIGHTS[pos])) {
      if ((wt ?? 0) < 0.08) continue;
      r[k as RatingKey] = clamp(r[k as RatingKey] + Math.round(delta * (wt ?? 0) * 1.4), 25, 99);
    }
  }
  return r;
}

export function hasFullKit(ratings: Ratings | undefined): boolean {
  if (!ratings) return false;
  return RATING_KEYS.every((k) => typeof ratings[k] === "number" && ratings[k] >= 1);
}
