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
      cmpPct: 0.6,
      passAtt: 30,
      ypa: 6.7,
      intRate: 0.055,
      sackRate: 0.075,
      rushAtt: 32,
      ypc: 3.85,
      pointsMu: 21.4,
      teRecCap: 50,
      recCap: 70,
      rushTdCap: 16,
      passTdCap: 36,
      intCap: 28,
      sackCap: 22,
      teamSackCap: 42,
    };
  }
  if (year <= 1977) {
    return {
      name: "dead-ball",
      cmpPct: 0.66,
      passAtt: 29.5,
      ypa: 6.6,
      intRate: 0.056,
      sackRate: 0.031,
      rushAtt: 34,
      ypc: 3.8,
      pointsMu: 19.8,
      teRecCap: 60,
      recCap: 70,
      rushTdCap: 16,
      passTdCap: 30,
      intCap: 24,
      sackCap: 22,
      teamSackCap: 48,
    };
  }
  if (year <= 1989) {
    return {
      name: "pass-boom",
      cmpPct: 0.637,
      passAtt: 31,
      ypa: 6.9,
      intRate: 0.0475,
      sackRate: 0.052,
      rushAtt: 31,
      ypc: 3.72,
      pointsMu: 20.8,
      teRecCap: 89,
      recCap: 106,
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
      cmpPct: 0.652,
      passAtt: 31.5,
      ypa: 6.9,
      intRate: 0.0375,
      sackRate: -0.002,
      rushAtt: 28.5,
      ypc: 3.8,
      pointsMu: 21.5,
      teRecCap: 94,
      recCap: 123,
      rushTdCap: 18,
      passTdCap: 40,
      intCap: 20,
      sackCap: 21,
      teamSackCap: 52,
    };
  }
  if (year <= 2009) {
    return {
      name: "aughts",
      cmpPct: 0.66,
      passAtt: 30,
      ypa: 7.0,
      intRate: 0.0366,
      sackRate: 0.016,
      rushAtt: 28,
      ypc: 3.95,
      pointsMu: 21.8,
      teRecCap: 102,
      recCap: 132,
      rushTdCap: 20,
      passTdCap: 42,
      intCap: 18,
      sackCap: 22,
      teamSackCap: 50,
    };
  }
  if (year <= 2019) {
    return {
      name: "spread",
      cmpPct: 0.683,
      passAtt: 30,
      ypa: 7.2,
      intRate: 0.035,
      sackRate: 0.02,
      rushAtt: 26,
      ypc: 4.05,
      pointsMu: 23.2,
      teRecCap: 116,
      recCap: 138,
      rushTdCap: 20,
      passTdCap: 48,
      intCap: 16,
      sackCap: 22,
      teamSackCap: 50,
    };
  }
  return {
    name: "modern",
    cmpPct: 0.665,
    passAtt: 30.5,
    ypa: 7.2,
    intRate: 0.0288,
    sackRate: 0.069,
    rushAtt: 28,
    ypc: 4.1,
    pointsMu: 23.0,
    teRecCap: 116,
    recCap: 140,
    rushTdCap: 20,
    passTdCap: 50,
    intCap: 15,
    sackCap: 22,
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
  // The dynamic kickoff (2024) brought touchbacks out to the 30, then the 35 in 2025.
  if (year >= 2025) return { from: 35, tb: 35 };
  if (year >= 2024) return { from: 35, tb: 30 };
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

/**
 * Field-goal accuracy by era, as a multiplier on a kick's make chance. Measured against the
 * real league: ~58% in the late '60s, ~62% through the '70s, ~71% in the '80s, ~77% in the
 * '90s, ~81% in the 2000s, ~85% since.
 */
export function fgEraMod(year: number): number {
  // Kicks before 1974 were ten yards shorter from the same spot (posts on the goal line).
  if (year <= 1969) return 0.78;
  if (year <= 1973) return 0.75;
  if (year <= 1977) return 0.79;
  // From the 80s on, real kickers try (and make) the longer ones the range gives them.
  if (year <= 1985) return 0.94;
  if (year <= 1993) return 0.98;
  if (year <= 1999) return 1.03;
  if (year <= 2009) return 1.08;
  return 1.14;
}

/** College football stops the clock to move the chains; the NFL never did. */
export function clockStopFirstDown(_year: number): boolean {
  return false;
}

export type OtKind = "none" | "sudden" | "modified" | "both";

export function otRules(
  year: number,
  phase: "preseason" | "regular" | "playoffs" | "superBowl" | "proBowl",
): { kind: OtKind; seconds: number } {
  const decisive = phase === "playoffs" || phase === "superBowl";
  if (!decisive && year < 1974) return { kind: "none", seconds: 0 };
  // Modified sudden death (a first-possession field goal doesn't end it) came to the playoffs
  // in 2010 and the regular season in 2012; regular-season overtime went to ten minutes in 2017.
  // Both teams are guaranteed a possession: playoffs from 2022, the regular season from 2025.
  if (!decisive) {
    if (year >= 2025) return { kind: "both", seconds: 600 };
    if (year >= 2017) return { kind: "modified", seconds: 600 };
    if (year >= 2012) return { kind: "modified", seconds: 900 };
    return { kind: "sudden", seconds: 900 };
  }
  if (year >= 2022) return { kind: "both", seconds: 900 };
  if (year >= 2010) return { kind: "modified", seconds: 900 };
  return { kind: "sudden", seconds: 900 };
}

/** The referee's overtime explanation, as the booth relays it. */
export function otCall(kind: OtKind, year: number): string {
  if (kind === "both") return "Overtime. Both teams are guaranteed a possession under the new rule; after that, next score wins.";
  if (kind === "modified")
    return year >= 2012
      ? "Overtime. A touchdown on the first possession wins it; a field goal gives the other side a chance to answer."
      : "Overtime under the new playoff rule: a first-drive field goal no longer ends it.";
  return "Sudden-death overtime. First score wins.";
}

/**
 * Goalposts stood on the goal line until 1974, so a field goal was ten yards shorter from
 * the same spot: the snap from the line of scrimmage plus seven.
 */
export function fgSnapYards(year: number): number {
  return year < 1974 ? 7 : 17;
}

/** Before 1974 a missed field goal came out to the 20; after, to the spot of the kick. */
export function missedFgSpot(year: number, spot: number): number {
  return year < 1974 ? 20 : Math.max(20, 100 - (spot + 7));
}

/** Extra-point kick distance. NFL moved the XP back in 2015. */
export function xpKickYards(year: number): number {
  return year >= 2015 ? 33 : 20;
}

export function xpMakeBase(year: number): number {
  // The league's real extra-point rate in each era (the 33-yard try from 2015 on). The sim
  // centres on it and lets the kicker move it a little; scaling it by his field-goal make
  // rate left the wide-hash era near 89% against a real 96-97%.
  if (year >= 2015) return 0.94;
  if (year <= 1973) return 0.966;
  if (year <= 1993) return 0.975;
  return 0.988;
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
  if (year <= 1989) return { wr1: 0.27, wr2: 0.22, wr3: 0.12, te: 0.2, rb: 0.19 };
  if (year <= 1999) return { wr1: 0.28, wr2: 0.22, wr3: 0.13, te: 0.19, rb: 0.18 };
  if (year <= 2009) return { wr1: 0.28, wr2: 0.2, wr3: 0.15, te: 0.21, rb: 0.16 };
  if (year <= 2019) return { wr1: 0.28, wr2: 0.2, wr3: 0.16, te: 0.21, rb: 0.15 };
  return { wr1: 0.28, wr2: 0.2, wr3: 0.15, te: 0.22, rb: 0.15 };
}

/** RB1 carry share. Workhorse era through the 90s, committees later. */
export function eraRb1Share(year: number): number {
  if (year <= 1977) return 0.6;
  // The 1980s split the work: a lead back and a fullback who carried it 100+ times, and a
  // second back for the passing downs. Real 1980s: about 13 thousand-yard rushers a year.
  if (year <= 1989) return 0.57;
  if (year <= 1999) return 0.62;
  if (year <= 2014) return 0.6;
  return 0.54;
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
  // The chart, all fourth quarter: down 2 to tie, down 5 to make it a field goal, down 10, 16-18;
  // up 1 or 5 to stretch it to 3 or 7 once the game is in its last ten minutes.
  if (late) {
    if (t === 2 || t === 5 || t === 10 || t === 16 || t === 17 || t === 18) return true;
    if ((t === -1 || t === -5) && clock <= 600) return true;
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
  // The dynamic kickoff (2024): about two kicks in three still a touchback, with the ball out
  // to the 30; from 2025 the touchback comes out to the 35 and kickers land it short instead.
  if (year >= 2025) return 0.3;
  if (year >= 2024) return 0.62;
  if (year >= 2016) return 0.52;
  if (year >= 2011) return 0.44;
  if (year >= 1994) return 0.22;
  if (year >= 1974) return 0.16;
  return 0.1;
}

export function huddleSeconds(year: number, tempo: "chew" | "standard" | "uptempo" | "hurry"): [number, number] {
  // "hurry" is the two-minute drill: racing the clock, snapping as fast as the ball is set.
  if (tempo === "hurry") return year <= 1979 ? [16, 22] : [12, 17];
  // A game-long no-huddle (the K-Gun, Marchibroda's Colts) still lets the clock run between
  // snaps; it just skips the huddle. Real ones ran ten or fifteen percent more plays, not double.
  if (tempo === "uptempo") return year <= 1979 ? [33, 39] : [32, 38];
  if (tempo === "chew") return year <= 1979 ? [38, 45] : [35, 42];
  // Snap-to-snap on a running clock: the play itself plus the huddle and most of the
  // play clock (30s from the ready signal before 1976, 40s from the previous whistle after).
  if (year <= 1969) return [36, 43];
  // The 70s ran about 66 snaps a side, a couple more than the huddle-and-clock model gave them.
  if (year <= 1977) return [34, 41];
  // The 2020s offense spends the play clock (motion, shifts, checks at the line): about 63
  // snaps a side, a few fewer than the 2010s' 65-66.
  // Measured against the record (2026): about 63 snaps a side from the 80s on, counting sacks.
  if (year >= 2020) return [40, 47];
  return [38, 45];
}

/**
 * Yards per completion ran ~10% short of real league averages in the old eras (12.8+ in the
 * 60s-70s, drifting to ~11 by the 2020s as short passing took over). Scales a completion's gain.
 */
export function passGainScale(year: number): number {
  if (year <= 1969) return 1.2;
  if (year <= 1977) return 1.18;
  // Measured against the record's league totals (2026): completions trimmed to real rates in the
  // 80s and 2000s, each catch carrying its real length.
  if (year <= 1989) return 1.12;
  if (year <= 1999) return 1.05;
  if (year <= 2009) return 1.01;
  if (year <= 2019) return 0.96;
  return 0.87;
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


/**
 * What a typical league leader did per game in each era (real leaders, averaged): passing,
 * rushing and receiving yards. The sim's stars taper toward these instead of the all-time
 * records, so a leader looks like a real leader and a record season stays a rarity.
 */
export function leaderPace(year: number): { pass: number; rush: number; recYds: number } {
  // Per game, at each era's average league leader: ~3,500 passing yards in the late '60s,
  // ~3,050 in the '70s, ~4,300 through the '80s and '90s, ~4,600 in the 2000s, ~5,000 since.
  if (year <= 1969) return { pass: 232, rush: 82, recYds: 92 };
  if (year <= 1977) return { pass: 200, rush: 104, recYds: 88 };
  if (year <= 1989) return { pass: 255, rush: 100, recYds: 93 };
  if (year <= 2003) return { pass: 248, rush: 104, recYds: 97 };
  if (year <= 2009) return { pass: 270, rush: 108, recYds: 100 };
  if (year <= 2019) return { pass: 295, rush: 98, recYds: 106 };
  if (year <= 2023) return { pass: 283, rush: 100, recYds: 104 };
  return { pass: 274, rush: 100, recYds: 102 };
}

/**
 * Usage multiplier for a player whose season pace runs past a typical leader's: 1 until 95%
 * of it, then down toward half at 130% (defenses key on him, the staff spreads it around).
 */
export function starTaper(perGame: number, ref: number): number {
  const r = perGame / ref;
  if (r <= 0.95) return 1;
  return Math.max(0.5, 1 - ((r - 0.95) / 0.35) * 0.55);
}
