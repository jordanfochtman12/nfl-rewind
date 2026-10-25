/**
 * Week-to-week player development for simulated leagues. Real career data is a prior, not a
 * script: age, workload, opportunity, coaching and the player's own results shape his path.
 * Real History mode deliberately never calls this module.
 */
import type { DynastySave, Player, Pos, RatingKey, SeasonStats, TeamId } from "./types.ts";
import { RATING_KEYS } from "./types.ts";
import { deriveOvr, primaryKeys } from "./ratings.ts";
import { clamp } from "./rng.ts";
import { activeTeamIds } from "./teams.ts";
import { coachDevelopmentFactor, developmentCoordinator } from "./coachDevelopment.ts";

type Line = Partial<Record<keyof SeasonStats, number>>;
export type WeekSnapshot = Map<string, Line>;

const FIELDS: (keyof SeasonStats)[] = [
  "gp", "passAtt", "passCmp", "passYds", "passTd", "passInt", "sacksThrown", "rushAtt", "rushYds", "rushTd",
  "rec", "recYds", "recTd", "tackles", "sacks", "ints", "ff", "fgAtt", "fgMade", "xpAtt", "xpMade", "punts", "puntYds", "targets", "tfl", "pd", "qbHits",
];

/** Capture cumulative box-score totals before the week's games so only new evidence is used. */
export function snapshotCareerWeek(save: DynastySave, postseason = false): WeekSnapshot {
  const out: WeekSnapshot = new Map();
  for (const p of Object.values(save.players)) {
    if (p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") continue;
    const line = postseason ? p.playoffStats?.[save.year] : p.stats[save.year];
    out.set(p.id, Object.fromEntries(FIELDS.map((k) => [k, Number(line?.[k] ?? 0)])) as Line);
  }
  return out;
}

function production(p: Player, d: Line): number {
  const gp = Math.max(1, d.gp ?? 0);
  const perGame = (key: keyof SeasonStats) => (d[key] ?? 0) / gp;
  const clampScore = (n: number) => clamp(n, -1.2, 1.2);
  switch (p.pos) {
    case "QB": {
      const att = Math.max(1, d.passAtt ?? 0);
      const ypa = (d.passYds ?? 0) / att;
      const td = (d.passTd ?? 0) / att;
      const ints = (d.passInt ?? 0) / att;
      return (d.passAtt ?? 0) === 0 ? 0 : clampScore((ypa - 6.4) * 0.28 + (td - 0.035) * 11 - (ints - 0.025) * 8);
    }
    case "RB": case "FB": {
      const att = Math.max(1, d.rushAtt ?? 0);
      const ypc = (d.rushYds ?? 0) / att;
      return (d.rushAtt ?? 0) === 0 ? 0 : clampScore((ypc - 3.8) * 0.32 + (perGame("rushYds") - 45) / 130 + perGame("rushTd") * 0.45);
    }
    case "WR": case "TE": {
      const targets = Math.max(1, d.targets ?? d.rec ?? 0);
      const ypt = (d.recYds ?? 0) / targets;
      return (d.targets ?? d.rec ?? 0) === 0 ? 0 : clampScore((ypt - 7.2) * 0.2 + (perGame("recYds") - (p.pos === "WR" ? 42 : 30)) / 110 + perGame("recTd") * 0.55);
    }
    case "DE": case "DT": {
      return clampScore(perGame("sacks") * 0.32 + perGame("tfl") * 0.15 + (perGame("tackles") - 2.8) * 0.04);
    }
    case "OLB": case "MLB": {
      return clampScore((perGame("tackles") - 4.8) * 0.075 + perGame("sacks") * 0.2 + perGame("ints") * 0.5 + perGame("tfl") * 0.12);
    }
    case "CB": case "S": {
      return clampScore(perGame("ints") * 0.55 + perGame("pd") * 0.14 + (perGame("tackles") - 3.2) * 0.04);
    }
    case "K": return (d.fgAtt ?? 0) > 0 ? clampScore(((d.fgMade ?? 0) / (d.fgAtt ?? 1) - 0.78) * 2) : 0;
    case "P": return (d.punts ?? 0) > 0 ? clampScore(((d.puntYds ?? 0) / (d.punts ?? 1) - 39) / 12) : 0;
    default: return 0;
  }
}

function hasUsage(p: Player, d: Line): boolean {
  switch (p.pos) {
    case "QB": return (d.passAtt ?? 0) > 0;
    case "RB": case "FB": return (d.rushAtt ?? 0) + (d.targets ?? d.rec ?? 0) > 0;
    case "WR": case "TE": return (d.targets ?? d.rec ?? 0) > 0;
    case "DE": case "DT": return (d.tackles ?? 0) + (d.sacks ?? 0) + (d.tfl ?? 0) > 0;
    case "OLB": case "MLB": return (d.tackles ?? 0) + (d.sacks ?? 0) + (d.ints ?? 0) > 0;
    case "CB": case "S": return (d.tackles ?? 0) + (d.ints ?? 0) + (d.pd ?? 0) > 0;
    case "K": return (d.fgAtt ?? 0) + (d.xpAtt ?? 0) > 0;
    case "P": return (d.punts ?? 0) > 0;
    default: return false;
  }
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

const GROWTH_LAST: Record<Pos, number> = {
  QB: 30, RB: 25, FB: 26, WR: 28, TE: 29, LT: 30, LG: 29, C: 30, RG: 29, RT: 30,
  DE: 28, DT: 29, OLB: 28, MLB: 29, CB: 27, S: 28, K: 32, P: 32,
};
const SKILL_DECLINE: Record<Pos, number> = {
  QB: 35, RB: 28, FB: 30, WR: 31, TE: 32, LT: 33, LG: 32, C: 33, RG: 32, RT: 33,
  DE: 31, DT: 32, OLB: 31, MLB: 32, CB: 29, S: 30, K: 38, P: 38,
};

const FOCUS: Partial<Record<Pos, RatingKey[]>> = {
  QB: ["throwAcc", "throwAwr", "awareness", "rel"], RB: ["elu", "btk", "awareness", "catch"], FB: ["runBlk", "truck", "awareness"],
  WR: ["rrt", "catch", "rel", "awareness"], TE: ["catch", "rrt", "passBlk", "awareness"],
  LT: ["passBlk", "runBlk", "awareness"], LG: ["runBlk", "passBlk", "awareness"], C: ["awareness", "runBlk", "passBlk"],
  RG: ["runBlk", "passBlk", "awareness"], RT: ["passBlk", "runBlk", "awareness"],
  DE: ["prs", "pur", "tak", "awareness"], DT: ["prs", "tak", "pur", "awareness"], OLB: ["cov", "pur", "tak", "awareness"],
  MLB: ["tak", "awareness", "cov", "pur"], CB: ["cov", "awareness", "tak", "prs"], S: ["awareness", "cov", "tak", "prs"],
  K: ["kickAcc", "kickPow", "awareness"], P: ["kickPow", "kickAcc", "awareness"],
};

function activeTeam(save: DynastySave, p: Player) {
  return p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" && activeTeamIds(save.year).includes(p.teamId)
    ? save.teams[p.teamId]
    : undefined;
}

function changeSkill(p: Player, dir: 1 | -1, cursor: number): void {
  const primary = new Set(primaryKeys(p.pos));
  const keys = (FOCUS[p.pos] ?? []).filter((k) => primary.has(k));
  const ordered = [...keys, ...primaryKeys(p.pos).filter((k) => !keys.includes(k))];
  const offset = ordered.length ? cursor % ordered.length : 0;
  const rotated = [...ordered.slice(offset), ...ordered.slice(0, offset)];
  const key = rotated.find((k) => dir > 0 ? p.ratings[k] < 99 : p.ratings[k] > 25);
  if (!key || !(RATING_KEYS as readonly string[]).includes(key)) return;
  p.ratings[key] = clamp(p.ratings[key] + dir, 25, 99);
  p.ovr = deriveOvr(p.pos, p.ratings);
}

/** Apply one simulated week's training, performance evidence and age/workload adjustment. */
export function developCareerWeek(save: DynastySave, before: WeekSnapshot, stage: "regular" | "playoffs"): void {
  if (save.realHistory) return;
  const tick = `${stage}:${save.year}:${save.week}`;
  const entries = Object.values(save.players).flatMap((p) => {
    const club = activeTeam(save, p);
    if (!club) return [];
    const old = before.get(p.id) ?? {};
    const line = stage === "playoffs" ? p.playoffStats?.[save.year] : p.stats[save.year];
    const delta = Object.fromEntries(FIELDS.map((k) => [k, Math.max(0, Number(line?.[k] ?? 0) - Number(old[k] ?? 0))])) as Line;
    return [{ p, club, delta, raw: production(p, delta) }];
  });
  const peers = new Map<Pos, number[]>();
  for (const x of entries) {
    if (!hasUsage(x.p, x.delta)) continue;
    const rows = peers.get(x.p.pos) ?? [];
    rows.push(x.raw);
    peers.set(x.p.pos, rows);
  }
  const peerShape = new Map<Pos, { middle: number; spread: number }>();
  for (const [pos, rows] of peers) {
    const middle = median(rows);
    const mad = median(rows.map((x) => Math.abs(x - middle)));
    peerShape.set(pos, { middle, spread: Math.max(0.28, mad * 1.4826) });
  }
  for (const { p, club, delta: rawDelta, raw } of entries) {
    const delta = rawDelta;
    const state = p.careerDevelopment ??= { growth: 0, regression: 0, breakoutEvidence: 0, breakoutWeeks: 0, workload: 0, weeks: 0, keyCursor: 0 };
    state.keyCursor ??= 0;
    if (state.lastTick === tick) continue;
    state.lastTick = tick;
    state.weeks += 1;
    const gp = delta.gp ?? 0;
    const shape = peerShape.get(p.pos);
    // Same-week, same-position peers normalize stat context across eras and roles.
    const signal = gp > 0 && shape && (peers.get(p.pos)?.length ?? 0) >= 4
      ? clamp(((raw - shape.middle) / shape.spread) * 0.55, -1.2, 1.2)
      : raw;
    const coach = club.coachId ? save.coaches[club.coachId] : undefined;
    const coordinator = developmentCoordinator(save, p.teamId as TeamId, p);
    const coachFactor = coachDevelopmentFactor(coach, coordinator);
    const opportunity = gp > 0 ? 1 : p.injuredWeeks > 0 || p.onIR ? 0.38 : 0.62;
    const ceilingRoom = clamp((p.potential - p.ovr + 8) / 18, 0.35, 1.25);
    const ageRoom = p.age <= GROWTH_LAST[p.pos] ? clamp(1.25 - Math.max(0, p.age - 21) * 0.105, 0.28, 1.25) : 0;
    const moraleFactor = clamp(0.84 + (p.morale - 60) / 250, 0.68, 1.14);
    const formFactor = clamp(0.92 + state.breakoutEvidence * 0.12, 0.92, 1.1);
    const training = 0.34 * ageRoom * ceilingRoom * coachFactor * moraleFactor * opportunity * formFactor * (1 + Math.max(0, signal) * 0.18);
    if (training > 0) {
      state.growth += training;
      while (state.growth >= 1) {
        const oldOvr = p.ovr;
        changeSkill(p, 1, state.keyCursor++);
        state.growth -= 1;
        if (p.ovr > oldOvr) p.peakOvr = Math.max(p.peakOvr, p.ovr);
      }
    }

    // Performance can revise a historical ceiling, but requires repeated, real simulated proof.
    state.breakoutEvidence = clamp(state.breakoutEvidence * 0.88 + (gp ? Math.max(0, signal) : 0) * 0.24, 0, 1.5);
    if (gp > 0 && signal >= 0.42) state.breakoutWeeks += 1;
    else if (state.breakoutWeeks > 0) state.breakoutWeeks = Math.max(0, state.breakoutWeeks - 1);
    if (state.breakoutWeeks >= 8 && p.potential < 99) {
      p.potential += 1;
      state.breakoutWeeks -= 8;
    }

    // Workload accumulates slowly; off weeks and recovery reduce it. Physical traits already age
    // in the offseason, so this only adjusts skill regression at advanced ages.
    const touches = (delta.rushAtt ?? 0) + (delta.passAtt ?? 0) * 0.12 + (delta.targets ?? delta.rec ?? 0) * 0.5;
    let weeklyLoad = 0;
    if (p.pos === "RB" || p.pos === "FB") weeklyLoad = touches / 24;
    else if (p.pos === "QB") weeklyLoad = (delta.passAtt ?? 0) / 40;
    else if (p.pos === "WR" || p.pos === "TE") weeklyLoad = Math.max(0.35, (delta.targets ?? delta.rec ?? 0) / 14);
    else if (["LT", "LG", "C", "RG", "RT"].includes(p.pos)) weeklyLoad = 0.82;
    else if (["DE", "DT", "OLB", "MLB", "CB", "S"].includes(p.pos)) weeklyLoad = 0.55 + (delta.tackles ?? 0) / 22 + (delta.sacks ?? 0) * 0.25;
    else weeklyLoad = 0.25;
    state.workload = clamp(state.workload * 0.94 + (gp ? clamp(weeklyLoad, 0.2, 1) : -0.08), 0, 12);
    const declineAge = SKILL_DECLINE[p.pos];
    if (p.age >= declineAge) {
      const ageFactor = 0.055 + Math.min(0.09, (p.age - declineAge) * 0.018);
      const poorPlay = signal < -0.25 && gp > 0 ? 1.3 : 1;
      const sustainedSuccess = signal > 0.55 && gp > 0 || state.breakoutEvidence > 0.7 ? 0.6 : 1;
      state.regression += ageFactor * (1 + state.workload * 0.035) * poorPlay * sustainedSuccess;
      while (state.regression >= 1) {
        changeSkill(p, -1, state.keyCursor++);
        state.regression -= 1;
      }
    }
    if (p.revealed) p.scoutOvr = p.ovr;
  }
}
