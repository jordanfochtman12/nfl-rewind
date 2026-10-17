/** Hall of Fame ballot. Players and coaches. Engine-only. */
import type { Coach, DynastySave, Player, TeamId } from "./types.ts";
import { COACH_HOF_WAIT_YEARS, HOF_WAIT_YEARS } from "./types.ts";
import { careerTotals } from "./leaders.ts";
import { playerName } from "./players.ts";
import { posLabel } from "./posLabel.ts";

export function playerHofScore(save: DynastySave, p: Player): number {
  const c = careerTotals(p);
  const peak = p.peakOvr ?? p.ovr;
  let n = peak * 0.5;
  n += Math.min(18, (p.yearsPro ?? 0) * 0.55);
  if (p.pos === "QB") {
    n += Math.min(28, c.passYds / 1100);
    n += c.passTd * 0.08;
    n -= c.passInt * 0.03;
  } else if (p.pos === "RB" || p.pos === "FB") {
    n += Math.min(22, c.rushYds / 450);
    n += c.rushTd * 0.12;
    n += c.rec * 0.02;
  } else if (p.pos === "WR" || p.pos === "TE") {
    n += Math.min(22, c.recYds / 400);
    n += c.recTd * 0.14;
    n += c.rec * 0.03;
  } else if (["DE", "DT", "OLB", "MLB"].includes(p.pos)) {
    n += c.sacks * 0.35;
    n += c.ints * 0.4;
    n += (c.tfl ?? 0) * 0.08;
    n += (c.tackles ?? 0) * 0.015;
  } else if (p.pos === "CB" || p.pos === "S") {
    n += c.ints * 1.1;
    n += (c.pd ?? 0) * 0.08;
  } else if (["LT", "LG", "C", "RG", "RT"].includes(p.pos)) {
    n += Math.min(16, (p.yearsPro ?? 0) * 0.7);
    if (peak >= 90) n += 8;
  } else if (p.pos === "K" || p.pos === "P") {
    n += (c.fgMade ?? 0) * 0.04;
    if (peak >= 88) n += 4;
  }
  let allPro = 0;
  let mvp = 0;
  for (const a of save.history.awards ?? []) {
    if (a.mvp === p.id) mvp += 1;
    if ((a.allPro ?? []).includes(p.id)) allPro += 1;
  }
  n += allPro * 5.5;
  n += mvp * 8;
  let bowls = 0;
  for (const b of save.history.superBowls ?? []) {
    const w = b.homeScore >= b.awayScore ? b.homeId : b.awayId;
    if (b.mvpId === p.id) n += 6;
    const st = p.stats[b.year];
    if (st && (st.teamId === w || p.userTied)) bowls += 1;
  }
  n += bowls * 3.5;
  if (p.historical && peak >= 88) n += 8;
  if (p.historical && peak >= 91) n += 8;
  if (peak >= 94) n += 6;
  return n;
}

export function coachHofScore(c: Coach): number {
  const games = c.careerWins + c.careerLosses + (c.careerTies ?? 0);
  const pct = games ? (c.careerWins + (c.careerTies ?? 0) * 0.5) / games : 0;
  let n = c.careerWins * 0.28;
  n += (c.careerTitles ?? 0) * 16;
  n += (c.careerBowls ?? 0) * 5;
  n += (c.coyYears?.length ?? 0) * 3;
  n += Math.min(18, (c.yearsCoaching ?? 0) * 0.45);
  if (pct >= 0.6 && games >= 80) n += 12;
  else if (pct >= 0.55 && games >= 60) n += 7;
  n += Math.max(c.peakOffense ?? c.offense, c.peakDefense ?? c.defense) * 0.12;
  if (c.historical) n += 4;
  return n;
}

export function playerHofEligible(save: DynastySave, p: Player): boolean {
  if (p.hofYear || p.twinOf) return false;
  if (!p.retiredYear) return false;
  if (save.year + 1 < p.retiredYear + HOF_WAIT_YEARS) return false;
  const score = playerHofScore(save, p);
  return score >= 64 || (p.historical && (p.peakOvr ?? p.ovr) >= 92 && score >= 58);
}

export function coachHofEligible(save: DynastySave, c: Coach): boolean {
  if (c.hofYear) return false;
  if (!c.retiredYear) return false;
  if (save.year + 1 < c.retiredYear + COACH_HOF_WAIT_YEARS) return false;
  if ((c.careerWins ?? 0) < 40 && (c.careerTitles ?? 0) < 1) return false;
  return coachHofScore(c) >= 52;
}

export function playerHofBlurb(save: DynastySave, p: Player): string {
  const c = careerTotals(p);
  const bits = [
    c.passYds ? `${c.passYds} pass yds` : "",
    c.rushYds ? `${c.rushYds} rush yds` : "",
    c.rec ? `${c.rec} rec` : "",
    c.sacks ? `${c.sacks} sacks` : "",
    c.ints ? `${c.ints} INT` : "",
  ].filter(Boolean);
  return `${playerName(p)}, ${posLabel(p)}. Peak ${p.peakOvr}. ${bits.join(" · ") || "The film is the argument."}`;
}

export function coachHofBlurb(c: Coach): string {
  const rec = `${c.careerWins}-${c.careerLosses}${c.careerTies ? `-${c.careerTies}` : ""}`;
  const titles = c.careerTitles ? ` · ${c.careerTitles} title${c.careerTitles === 1 ? "" : "s"}` : "";
  return `${c.name}, head coach. ${rec}${titles}. ${c.abilities?.slice(0, 2).join(" · ") ?? "The whistle was the argument."}`;
}

/** Retirement log by player, rebuilt only when the log grows (it is append-only). */
const retiredIndex = new WeakMap<object, { n: number; by: Map<string, TeamId> }>();
export function lastTeamOf(save: DynastySave, p: Player): TeamId {
  const log = save.history.retirements;
  let idx = retiredIndex.get(log);
  if (!idx || idx.n !== log.length) {
    const by = new Map<string, TeamId>();
    // First entry wins, as find() did.
    for (const r of log) if (r.playerId && r.teamId && !by.has(r.playerId)) by.set(r.playerId, r.teamId);
    idx = { n: log.length, by };
    retiredIndex.set(log, idx);
  }
  return idx.by.get(p.id) ?? save.userTeamId;
}

export function lastCoachTeam(save: DynastySave, c: Coach): TeamId {
  const retired = save.history.retirements.find((r) => r.coachId === c.id);
  if (retired?.teamId) return retired.teamId;
  return save.userTeamId;
}
