/**
 * The owner's scouting department, and the combine.
 *
 * - The combine (from 1982, when the league's invitational camp began) times and measures
 *   the class from each prospect's true athletic ratings. It's public: a workout that
 *   doesn't match the tape moves the consensus grade every club sees, and the risers and
 *   fallers make the wire.
 * - The scouting budget sets how close the owner's own grades get to the truth. Pro-day
 *   visits (more with a bigger budget) give a near-true read on a few prospects. These
 *   grades are the owner's alone; the CPU clubs never see them.
 *
 * All noise here is a hash of the player and season, not the save's RNG, so scouting
 * never shifts the rest of the sim. No React.
 */
import type { DynastySave, Player, ScoutBudget } from "./types.ts";
import { clamp } from "./rng.ts";
import { visibleOvr, visibleRatings } from "./scout.ts";
import { addNews } from "./news.ts";
import { playerName } from "./players.ts";
import { posLabel } from "./posLabel.ts";

export const COMBINE_FROM = 1982;

export const BUDGETS: Record<ScoutBudget, { label: string; accuracy: number; visits: number; blurb: string }> = {
  low: { label: "Lean", accuracy: 0.12, visits: 2, blurb: "A skeleton crew. Your grades lean on the consensus." },
  standard: { label: "Standard", accuracy: 0.32, visits: 4, blurb: "A full regional staff." },
  high: { label: "Deep", accuracy: 0.52, visits: 8, blurb: "Area scouts everywhere and a cross-checker on every top name." },
};

/** A steady pseudo-random number in [-1, 1) for this player, season and purpose. */
function wobble(id: string, year: number, salt: string): number {
  let h = 2166136261;
  for (const ch of `${id}|${year}|${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** This season's scouting settings, without writing to the save (safe from a render). */
export function scoutState(save: DynastySave): NonNullable<DynastySave["scouting"]> {
  return save.scouting?.year === save.year ? save.scouting : { year: save.year, budget: save.scouting?.budget ?? "standard", visits: [] };
}

/** This season's scouting settings, created on the save when a change needs them. */
function scouting(save: DynastySave): NonNullable<DynastySave["scouting"]> {
  if (!save.scouting || save.scouting.year !== save.year) save.scouting = { year: save.year, budget: save.scouting?.budget ?? "standard", visits: [] };
  return save.scouting;
}

const prospectsOf = (save: DynastySave): Player[] =>
  save.draftBoard.map((pr) => save.players[pr.playerId]).filter((p): p is Player => !!p && !p.revealed);

/** Combine numbers from true ratings (a measured 40 from the real class is kept as is). */
function measure(p: Player, year: number): NonNullable<Player["combine"]> {
  const r = p.ratings;
  const n = (salt: string, size: number) => wobble(p.id, year, salt) * size;
  const forty = p.forty ?? Math.round((5.62 - (r.speed - 40) * 0.0225 + n("40", 0.05)) * 100) / 100;
  return {
    forty: clamp(forty, 4.21, 5.9),
    bench: Math.max(4, Math.round(5 + (r.str - 40) * 0.55 + n("bench", 2.5))),
    vertical: Math.round((22 + ((r.accel + r.agi) / 2 - 40) * 0.24 + n("vert", 1.5)) * 2) / 2,
    cone: Math.round((7.95 - (r.agi - 40) * 0.022 + n("cone", 0.06)) * 100) / 100,
  };
}

/** Combine week: measure the class, move the consensus where the workout and the tape disagree. */
export function runCombine(save: DynastySave): void {
  if (save.year < COMBINE_FROM) return;
  const moves: { p: Player; d: number }[] = [];
  for (const p of prospectsOf(save)) {
    if (p.combine) continue;
    // Some top prospects only work out at their pro day.
    const sitOut = (p.scoutOvr ?? 0) >= 82 && wobble(p.id, save.year, "sit") > 0.6;
    p.combine = sitOut ? { satOut: true } : measure(p, save.year);
    if (sitOut || p.pos === "K" || p.pos === "P") continue;
    const keys = ["speed", "accel", "agi", "str"] as const;
    const seen = visibleRatings(p);
    const gap = keys.reduce((n, k) => n + (p.ratings[k] - seen[k]), 0) / keys.length;
    const d = clamp(Math.round(gap * 0.12), -3, 3);
    if (d) {
      p.scoutOvr = clamp((p.scoutOvr ?? p.ovr) + d, 46, 94);
      moves.push({ p, d });
    }
  }
  const risers = moves.filter((m) => m.d > 0).sort((a, b) => b.d - a.d || (b.p.scoutOvr ?? 0) - (a.p.scoutOvr ?? 0)).slice(0, 3);
  const fallers = moves.filter((m) => m.d < 0).sort((a, b) => a.d - b.d || (b.p.scoutOvr ?? 0) - (a.p.scoutOvr ?? 0)).slice(0, 2);
  if (risers.length || fallers.length) {
    const line = (m: { p: Player }) => `${playerName(m.p)} (${posLabel(m.p)}${m.p.combine?.forty ? `, ${m.p.combine.forty.toFixed(2)}` : ""})`;
    addNews(save, {
      kind: "headline",
      headline: `Combine week: ${risers[0] ? `${playerName(risers[0].p)} turns heads` : "a few stock drops"}`,
      body: [risers.length ? `Rising: ${risers.map(line).join(", ")}.` : "", fallers.length ? `Sliding: ${fallers.map(line).join(", ")}.` : ""].filter(Boolean).join(" "),
      teamIds: [],
      playerIds: [...risers, ...fallers].map((m) => m.p.id),
    });
  }
}

/** The owner's own grade for a prospect (the consensus for anyone already in the league). */
export function ownerGrade(save: DynastySave, p: Player): number {
  if (p.revealed || p.draftYear !== save.year || save.sandbox) return visibleOvr(p);
  const s = scoutState(save);
  const visited = s.visits.includes(p.id);
  const a = visited ? 0.88 : BUDGETS[s.budget].accuracy;
  const consensus = p.scoutOvr ?? p.ovr;
  const grade = consensus * (1 - a) + p.ovr * a + wobble(p.id, save.year, "mine") * 3 * (1 - a);
  return clamp(Math.round(grade), 40, 99);
}

export function setScoutBudget(save: DynastySave, budget: ScoutBudget): string {
  const s = scouting(save);
  s.budget = budget;
  s.visits = s.visits.slice(0, BUDGETS[budget].visits);
  return `Scouting budget set to ${BUDGETS[budget].label.toLowerCase()}.`;
}

export function visitsLeft(save: DynastySave): number {
  const s = scoutState(save);
  return Math.max(0, BUDGETS[s.budget].visits - s.visits.length);
}

/** Send the scouts to a prospect's pro day. */
export function proDayVisit(save: DynastySave, playerId: string): string {
  const p = save.players[playerId];
  if (!p || p.revealed) return "There's no pro day to see for him.";
  const s = scouting(save);
  if (s.visits.includes(playerId)) return `You've already worked out ${playerName(p)}.`;
  if (!visitsLeft(save)) return "No pro-day visits left on this budget.";
  s.visits.push(playerId);
  if (!p.combine || p.combine.satOut) p.combine = { ...measure(p, save.year), proDay: true };
  return `Pro day: your scouts grade ${playerName(p)} a ${ownerGrade(save, p)}.`;
}

/** The draft is over: the class's combine sheet isn't kept (it'd be ~0.5MB a save by 2025). */
export function clearCombine(save: DynastySave): void {
  for (const pr of save.draftBoard) {
    const p = save.players[pr.playerId];
    if (p?.combine && !Object.isFrozen(p)) delete p.combine;
  }
}
