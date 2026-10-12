/**
 * Morale and chemistry. Every rostered player carries a mood (0-100) that drifts each week
 * toward what his situation deserves: winning, playing time against how good he is, being
 * paid what he's worth, and the stability of the room. A club's chemistry is its starters'
 * mood plus how long they've played together, and it is worth a little on Sundays (about a
 * point either way at the extremes). A star who stays miserable asks out. No React.
 */
import { addNews } from "./news.ts";
import { playerName, rosterOf, starters } from "./players.ts";
import { salaryFor } from "./salary.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { winPct } from "./standings.ts";
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";

/** How many start at each position (the sim's base lineup, nickel corner included). */
export const STARTS: Partial<Record<Pos, number>> = {
  QB: 1, RB: 1, FB: 1, WR: 3, TE: 1, LT: 1, LG: 1, C: 1, RG: 1, RT: 1,
  DE: 2, DT: 2, OLB: 2, MLB: 1, CB: 3, S: 2, K: 1, P: 1,
};

export const MORALE_DEFAULT = 70;

export function moraleOf(p: Player): number {
  return p.morale ?? MORALE_DEFAULT;
}

export function moraleLabel(m: number): { label: string; tone: "good" | "ok" | "bad" } {
  if (m >= 84) return { label: "Fired up", tone: "good" };
  if (m >= 64) return { label: "Content", tone: "ok" };
  if (m >= 48) return { label: "Restless", tone: "ok" };
  if (m >= 30) return { label: "Frustrated", tone: "bad" };
  return { label: "Wants out", tone: "bad" };
}

export interface MoraleReason {
  text: string;
  delta: number;
}

/** What a player's mood is reaching for right now, and why. */
export function moraleTarget(save: DynastySave, p: Player, starterIds?: Set<string>): { target: number; reasons: MoraleReason[] } {
  const reasons: MoraleReason[] = [];
  const club = p.teamId as TeamId;
  const t = save.teams[club];
  if (!t) return { target: MORALE_DEFAULT, reasons };
  const played = t.wins + t.losses + t.ties;
  if (played >= 2) {
    const w = winPct(t);
    const d = Math.round((w - 0.5) * 30);
    if (Math.abs(d) >= 3) reasons.push({ text: d > 0 ? "The team is winning" : "The losing is wearing on him", delta: d });
  }
  const starting = starterIds ? starterIds.has(p.id) : starters(save, club, p.pos, STARTS[p.pos] ?? 1).some((x) => x.id === p.id);
  if (p.injuredWeeks <= 0 && !p.onIR) {
    if (starting && p.ovr >= 70) reasons.push({ text: "Starting", delta: 6 });
    else if (!starting && p.ovr >= 78) reasons.push({ text: "Wants to start", delta: -16 });
    else if (!starting && p.ovr >= 70) reasons.push({ text: "Wants more snaps", delta: -6 });
  }
  const worth = salaryFor(save.year, p.ovr, p.age, p.pos);
  if (p.ovr >= 76 && p.salary < worth * 0.75) reasons.push({ text: "Underpaid for what he does", delta: -12 });
  else if (p.salary > worth * 1.2) reasons.push({ text: "Paid well", delta: 4 });
  if (p.holdout) reasons.push({ text: "Holding out", delta: -20 });
  const streak = t.streak ?? "";
  const n = Number(streak.slice(1)) || 0;
  if (streak.startsWith("L") && n >= 4) reasons.push({ text: `${n} straight losses`, delta: -6 });
  if (streak.startsWith("W") && n >= 4) reasons.push({ text: `${n} straight wins`, delta: 5 });
  if (p.age >= 31 && p.ovr >= 80 && played >= 4 && winPct(t) < 0.35) reasons.push({ text: "Running out of time to win", delta: -6 });
  if ((p.yearsPro ?? 0) <= 1) reasons.push({ text: "Happy to be here", delta: 5 });
  const target = Math.max(5, Math.min(98, MORALE_DEFAULT + reasons.reduce((s, r) => s + r.delta, 0)));
  return { target, reasons };
}

export interface Chemistry {
  value: number;
  mood: number;
  continuity: number;
  line: string;
}

/** A club's chemistry: its starters' mood and how many of them were here last year. */
export function chemistryOf(save: DynastySave, teamId: TeamId): Chemistry {
  const lineup: Player[] = [];
  for (const [pos, n] of Object.entries(STARTS) as [Pos, number][]) lineup.push(...starters(save, teamId, pos, n));
  if (!lineup.length) return { value: 60, mood: MORALE_DEFAULT, continuity: 0.6, line: "" };
  const mood = lineup.reduce((s, p) => s + moraleOf(p), 0) / lineup.length;
  const last = save.year - 1;
  const stayed = lineup.filter((p) => p.stats[last]?.teamId === teamId || (p.draftYear === save.year && p.draftTeam === teamId)).length / lineup.length;
  const value = Math.round(Math.max(0, Math.min(100, (mood - 10) * 0.7 + stayed * 100 * 0.3)));
  const line =
    value >= 75 ? "A tight room. These guys play for each other." : value >= 60 ? "A steady locker room." : value >= 45 ? "Some grumbling in the locker room." : "A fractured locker room.";
  return { value, mood: Math.round(mood), continuity: stayed, line };
}

/** Chemistry on the field: a point or so of unit grade either way at the extremes. */
export function chemistryEdge(save: DynastySave, teamId: TeamId): number {
  const c = save.teams[teamId]?.chemistry;
  if (c === undefined) return 0;
  return Math.max(-1.2, Math.min(1.2, (c - 60) / 25));
}

/**
 * How many stars can ask out in a season before it stops being news: one for every five clubs
 * (about five in 1966, seven today). Not a quota, a ceiling against a flood.
 */
export function requestCeiling(year: number): number {
  return Math.ceil(activeTeamIds(year).length / 5);
}

/** The weekly drift, the clubs' chemistry, and a public trade request from a miserable star. */
export function updateMorale(save: DynastySave): void {
  if (save.realHistory) return;
  // Public requests: no fixed number, just never a flood (see requestCeiling), one a club.
  const asked = Object.values(save.players).filter((p) => p.tradeRequest === save.year);
  let requests = asked.length;
  const clubsAsked = new Set(asked.map((p) => p.teamId));
  for (const id of activeTeamIds(save.year)) {
    const roster = rosterOf(save, id);
    const starterIds = new Set<string>();
    for (const [pos, n] of Object.entries(STARTS) as [Pos, number][]) for (const p of starters(save, id, pos, n)) starterIds.add(p.id);
    for (const p of roster) {
      const { target } = moraleTarget(save, p, starterIds);
      const now = moraleOf(p);
      p.morale = Math.round(now + (target - now) * 0.25);
      if (p.morale < 40 && p.ovr >= 80) p.moraleLow = (p.moraleLow ?? 0) + 1;
      else p.moraleLow = undefined;
      // A public request is rare: a handful a season league-wide.
      if ((p.moraleLow ?? 0) >= 3 && p.tradeRequest !== save.year && p.age <= 33 && requests < requestCeiling(save.year) && !clubsAsked.has(id)) {
        requests += 1;
        clubsAsked.add(id);
        p.tradeRequest = save.year;
        p.moraleLow = undefined;
        const why = moraleTarget(save, p, starterIds).reasons.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta)[0];
        addNews(save, {
          kind: "transaction",
          headline: `${playerName(p)} wants out of ${displayName(save.year, id)}`,
          body: `Weeks of frustration boiled over${why ? `: ${why.text.toLowerCase()}` : ""}. His agent has asked for a trade.`,
          teamIds: [id],
          playerIds: [p.id],
        });
      }
    }
    const t = save.teams[id];
    if (t) t.chemistry = chemistryOf(save, id).value;
  }
}
