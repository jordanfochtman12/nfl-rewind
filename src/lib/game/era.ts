import type { TeamId } from "./types.ts";
import { originalLeague } from "./teams.ts";

export interface EraProfile {
  name: string;
  cmpPct: number;
  passAtt: number;
  ypa: number;
  intRate: number;
  sackRate: number;
  rushAtt: number;
  ypc: number;
  pointsMu: number;
  teRecCap: number;
  recCap: number;
  rushTdCap: number;
  passTdCap: number;
  intCap: number;
  sackCap: number;
  teamSackCap: number;
}

export function eraProfile(year: number): EraProfile {
  if (year <= 1969) {
    return {
      name: "pre-merger",
      cmpPct: 0.58,
      passAtt: 28,
      ypa: 6.7,
      intRate: 0.055,
      sackRate: 0.07,
      rushAtt: 35,
      ypc: 3.85,
      pointsMu: 21.4,
      teRecCap: 55,
      recCap: 75,
      rushTdCap: 16,
      passTdCap: 32,
      intCap: 28,
      sackCap: 18,
      teamSackCap: 42,
    };
  }
  if (year <= 1977) {
    return {
      name: "dead-ball",
      cmpPct: 0.636,
      passAtt: 29.5,
      ypa: 6.6,
      intRate: 0.05,
      sackRate: 0.075,
      rushAtt: 34,
      ypc: 3.8,
      pointsMu: 19.8,
      teRecCap: 60,
      recCap: 80,
      rushTdCap: 16,
      passTdCap: 30,
      intCap: 24,
      sackCap: 20,
      teamSackCap: 48,
    };
  }
  if (year <= 1989) {
    return {
      name: "pass-boom",
      cmpPct: 0.64,
      passAtt: 33,
      ypa: 6.9,
      intRate: 0.042,
      sackRate: 0.072,
      rushAtt: 31,
      ypc: 3.95,
      pointsMu: 20.8,
      teRecCap: 70,
      recCap: 95,
      rushTdCap: 18,
      passTdCap: 38,
      intCap: 22,
      sackCap: 22,
      teamSackCap: 55,
    };
  }
  if (year <= 1999) {
    return {
      name: "nineties",
      cmpPct: 0.648,
      passAtt: 35,
      ypa: 6.9,
      intRate: 0.034,
      sackRate: 0.068,
      rushAtt: 27,
      ypc: 3.8,
      pointsMu: 21.5,
      teRecCap: 80,
      recCap: 105,
      rushTdCap: 18,
      passTdCap: 40,
      intCap: 20,
      sackCap: 20,
      teamSackCap: 52,
    };
  }
  if (year <= 2009) {
    return {
      name: "aughts",
      cmpPct: 0.693,
      passAtt: 35,
      ypa: 7.0,
      intRate: 0.03,
      sackRate: 0.065,
      rushAtt: 27,
      ypc: 3.95,
      pointsMu: 21.8,
      teRecCap: 90,
      recCap: 110,
      rushTdCap: 20,
      passTdCap: 42,
      intCap: 18,
      sackCap: 20,
      teamSackCap: 50,
    };
  }
  if (year <= 2019) {
    return {
      name: "spread",
      cmpPct: 0.692,
      passAtt: 37,
      ypa: 7.2,
      intRate: 0.025,
      sackRate: 0.062,
      rushAtt: 26,
      ypc: 4.05,
      pointsMu: 23.2,
      teRecCap: 100,
      recCap: 120,
      rushTdCap: 20,
      passTdCap: 48,
      intCap: 16,
      sackCap: 20,
      teamSackCap: 50,
    };
  }
  return {
    name: "modern",
    cmpPct: 0.709,
    passAtt: 35,
    ypa: 7.2,
    intRate: 0.023,
    sackRate: 0.063,
    rushAtt: 27,
    ypc: 4.1,
    pointsMu: 23.0,
    teRecCap: 110,
    recCap: 130,
    rushTdCap: 20,
    passTdCap: 50,
    intCap: 15,
    sackCap: 19,
    teamSackCap: 52,
  };
}

export function playoffTeamCount(year: number): { perConf: number; total: number } {
  if (year < 1970) {
    if (year === 1969) return { perConf: 4, total: 8 };
    if (year >= 1967) return { perConf: 4, total: 6 };
    return { perConf: 1, total: 4 };
  }
  if (year <= 1977) return { perConf: 4, total: 8 };
  if (year <= 1989) return { perConf: 5, total: 10 };
  if (year <= 2019) return { perConf: 6, total: 12 };
  return { perConf: 7, total: 14 };
}

export function kickoffRules(year: number): { from: number; tb: number } {
  if (year >= 2016) return { from: 35, tb: 25 };
  if (year >= 2011) return { from: 35, tb: 20 };
  if (year >= 1994) return { from: 30, tb: 20 };
  if (year >= 1974) return { from: 35, tb: 20 };
  return { from: 40, tb: 20 };
}

/** AFL had two-point conversions from the start; NFL added them in 1994. */
export function twoPointOk(year: number, teamId: TeamId): boolean {
  if (year >= 1994) return true;
  if (year <= 1969 && originalLeague(teamId) === "AFL") return true;
  return false;
}

export function fgEraMod(year: number): number {
  if (year <= 1973) return 0.88;
  if (year <= 1993) return 0.94;
  return 1;
}

export function clockStopFirstDown(year: number): boolean {
  return year <= 1973;
}

export type OtKind = "none" | "sudden" | "modified";

export function otRules(
  year: number,
  phase: "preseason" | "regular" | "playoffs" | "superBowl" | "proBowl",
): { kind: OtKind; seconds: number } {
  const decisive = phase === "playoffs" || phase === "superBowl";
  if (!decisive && year < 1974) return { kind: "none", seconds: 0 };
  if (!decisive) {
    if (year >= 2017) return { kind: "sudden", seconds: 600 };
    return { kind: "sudden", seconds: 900 };
  }
  if (year >= 2012) return { kind: "modified", seconds: 900 };
  return { kind: "sudden", seconds: 900 };
}

/** Extra-point kick distance. NFL moved the XP back in 2015. */
export function xpKickYards(year: number): number {
  return year >= 2015 ? 33 : 20;
}

export function xpMakeBase(year: number): number {
  return year >= 2015 ? 0.934 : year <= 1973 ? 0.94 : 0.965;
}

/** Wide hashes made FGs harder until they were moved in (1972 NFL / 1974). */
export function hashFgMod(year: number): number {
  if (year <= 1971) return -0.07;
  if (year <= 1973) return -0.03;
  return 0;
}

/** 1978 chuck rule: 5-yard contact. Before that, bump-and-run down the field. */
export function chuckRule(year: number): { yards: number; illegalContact: boolean } {
  if (year >= 1978) return { yards: 5, illegalContact: true };
  return { yards: 99, illegalContact: false };
}

/** Fourth-down analytics bias. 1960s coaches almost never went; 2020s do. */
export function fourthGoBias(year: number): number {
  if (year <= 1969) return -0.16;
  if (year <= 1977) return -0.12;
  if (year <= 1989) return -0.08;
  if (year <= 1999) return -0.04;
  if (year <= 2014) return 0.02;
  if (year <= 2019) return 0.08;
  return 0.14;
}

/** Explosive-play multiplier. Dead-ball football did not live on 50-yard dashes. */
export function eraBigPlay(year: number): number {
  if (year <= 1969) return 0.58;
  if (year <= 1977) return 0.68;
  if (year <= 1989) return 0.88;
  if (year <= 2003) return 0.98;
  if (year <= 2013) return 1.05;
  return 1.14;
}

export function eraTargetWeights(year: number): { wr1: number; wr2: number; wr3: number; te: number; rb: number } {
  if (year <= 1969) return { wr1: 0.3, wr2: 0.28, wr3: 0.08, te: 0.15, rb: 0.19 };
  if (year <= 1977) return { wr1: 0.28, wr2: 0.26, wr3: 0.1, te: 0.17, rb: 0.19 };
  if (year <= 1989) return { wr1: 0.25, wr2: 0.23, wr3: 0.13, te: 0.2, rb: 0.19 };
  if (year <= 1999) return { wr1: 0.25, wr2: 0.23, wr3: 0.15, te: 0.19, rb: 0.18 };
  if (year <= 2009) return { wr1: 0.24, wr2: 0.21, wr3: 0.18, te: 0.21, rb: 0.16 };
  if (year <= 2019) return { wr1: 0.24, wr2: 0.21, wr3: 0.19, te: 0.21, rb: 0.15 };
  return { wr1: 0.23, wr2: 0.21, wr3: 0.19, te: 0.22, rb: 0.15 };
}

/** RB1 carry share. Workhorse era through the 90s, committees later. */
export function eraRb1Share(year: number): number {
  if (year <= 1977) return 0.78;
  if (year <= 1999) return 0.74;
  if (year <= 2014) return 0.66;
  return 0.58;
}

export function penaltyRates(year: number): {
  preSnap: number;
  hold: number;
  pi: number;
  contact: number;
  personal: number;
  delay: number;
} {
  const chuck = chuckRule(year);
  return {
    preSnap: year <= 1979 ? 0.028 : 0.024,
    hold: year <= 1977 ? 0.018 : 0.022,
    pi: year >= 2014 ? 0.016 : year >= 2004 ? 0.012 : 0.008,
    contact: chuck.illegalContact ? (year >= 2014 ? 0.01 : 0.006) : 0.002,
    personal: year <= 1979 ? 0.006 : 0.004,
    delay: 0.003,
  };
}

/**
 * Two-point chart. AFL had it from the start; NFL added it in 1994.
 * `trail` is opponent minus us *before* the extra-point decision (so after the TD it's trail-6).
 */
export function wantTwoPoint(year: number, trailAfterTd: number, q: number, clock: number, afl: boolean): boolean {
  const allowed = year >= 1994 || (year <= 1969 && afl);
  if (!allowed) return false;
  const late = q >= 4 || (q >= 5);
  if (year <= 1969 && afl && !late) return false;
  const t = trailAfterTd;
  if (late && clock <= 240) {
    if (t === 2 || t === 5 || t === 10 || t === 16 || t === 17 || t === 18) return true;
    if (t === -1 && clock <= 40) return true;
  }
  if (late && clock <= 90 && (t === 8 || t === 9)) return true;
  if (year <= 1969 && afl) return false;
  return false;
}

export function twoPointMakeP(year: number): number {
  if (year <= 1969) return 0.42;
  if (year <= 1999) return 0.44;
  if (year <= 2014) return 0.47;
  return 0.49;
}

/** Kickoff touchback rate by rule era. */
export function kickoffTbRate(year: number): number {
  if (year >= 2024) return 0.58;
  if (year >= 2016) return 0.52;
  if (year >= 2011) return 0.44;
  if (year >= 1994) return 0.22;
  if (year >= 1974) return 0.16;
  return 0.1;
}

export function huddleSeconds(year: number, tempo: "chew" | "standard" | "hurry"): [number, number] {
  if (tempo === "hurry") return year <= 1979 ? [16, 22] : [12, 17];
  if (tempo === "chew") return year <= 1979 ? [38, 45] : [35, 42];
  // Snap-to-snap on a running clock: the play itself plus the huddle and most of the
  // play clock (30s from the ready signal before 1976, 40s from the previous whistle after).
  if (year <= 1969) return [36, 43];
  if (year <= 1977) return [36, 43];
  return [36, 43];
}

/**
 * Yards per completion ran ~10% short of real league averages in the old eras (12.8+ in the
 * 60s-70s, drifting to ~11 by the 2020s as short passing took over). Scales a completion's gain.
 */
export function passGainScale(year: number): number {
  if (year <= 1977) return 1.12;
  if (year <= 1989) return 1.08;
  if (year <= 1999) return 1.04;
  if (year <= 2009) return 0.99;
  return 0.94;
}

/** 1974 NFL: DPI becomes a spot foul. Before that (and AFL), 15 yards. */
export function dpiIsSpot(year: number): boolean {
  return year >= 1974;
}

export function kickoffOobSpot(_year: number): number {
  return 40;
}

/** Fair-catch on kickoffs, 2018–2023. */
export function fairCatchKickoff(year: number): boolean {
  return year >= 2018 && year <= 2023;
}

/** 10-second runoff in the last minute of a half, 2017+. */
export function tenSecondRunoff(year: number): boolean {
  return year >= 2017;
}

export function replayReview(year: number): boolean {
  return year >= 1999;
}

/** Calvin Johnson / Dez Bryant catch window — more dropped “catches.” */
export function tightCatchRule(year: number): boolean {
  return year >= 2010 && year <= 2017;
}

/** Tush-push / sneak conversion boost. */
export function sneakBoost(year: number): number {
  if (year >= 2022) return 0.55;
  if (year >= 2011) return 0.22;
  return 0;
}

export function playoffBrake(phase: string): number {
  if (phase === "superBowl") return 0.84;
  if (phase === "playoffs") return 0.9;
  return 1;
}

