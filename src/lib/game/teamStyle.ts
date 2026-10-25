/**
 * A club's identity, as the broadcast and the scouts describe it: how it actually plays this
 * season (run/pass mix, pressure, takeaways, how stingy it is), backed by the staff's systems
 * when there's no film yet, and changed by who is missing. No React.
 */
import { eraProfile } from "./era.ts";
import { planFor } from "./sim.ts";
import { staffSystems } from "./gameplans.ts";
import { rosterOf, playerName, starters } from "./players.ts";
import { activeTeamIds } from "./teams.ts";
import type { BoxPlayer, DynastySave, GameResult, TeamId } from "./types.ts";

export interface TeamStyle {
  offense: string;
  defense: string;
  /** One sentence for the booth. */
  line: string;
  /** Share of offensive snaps that were passes, when there's film. */
  passShare?: number;
  games: number;
  /** Who's out that the identity runs through. */
  missing: string[];
}

interface Totals {
  att: number;
  rush: number;
  sacks: number;
  takeaways: number;
  pf: number;
  pa: number;
  ydsAllowed: number;
  games: number;
}

const sumBox = (box: BoxPlayer[] | undefined, k: keyof BoxPlayer) => (box ?? []).reduce((n, b) => n + ((b[k] as number | undefined) ?? 0), 0);

function totals(save: DynastySave, teamId: TeamId): Totals {
  const t: Totals = { att: 0, rush: 0, sacks: 0, takeaways: 0, pf: 0, pa: 0, ydsAllowed: 0, games: 0 };
  const games: GameResult[] = [...save.schedule, ...save.playoffGames].filter((g) => g.played && g.year === save.year && (g.homeId === teamId || g.awayId === teamId));
  for (const g of games) {
    const home = g.homeId === teamId;
    const own = home ? g.boxHome : g.boxAway;
    t.att += sumBox(own, "passAtt");
    t.rush += sumBox(own, "rushAtt");
    t.sacks += sumBox(own, "sacks");
    t.takeaways += (home ? g.awayTo : g.homeTo) ?? 0;
    t.pf += home ? g.homeScore : g.awayScore;
    t.pa += home ? g.awayScore : g.homeScore;
    t.ydsAllowed += (home ? g.awayTot : g.homeTot) ?? 0;
    t.games += 1;
  }
  return t;
}

const leagueCache = new Map<string, { pa: number; yds: number }>();
function leagueAllowed(save: DynastySave): { pa: number; yds: number } {
  const key = `${save.year}-${save.week}-${save.phase}`;
  const hit = leagueCache.get(key);
  if (hit) return hit;
  let pa = 0, yds = 0, n = 0;
  for (const id of activeTeamIds(save.year)) {
    const t = totals(save, id);
    if (!t.games) continue;
    pa += t.pa / t.games;
    yds += t.ydsAllowed / t.games;
    n += 1;
  }
  const out = n ? { pa: pa / n, yds: yds / n } : { pa: 20, yds: 320 };
  if (leagueCache.size > 8) leagueCache.clear();
  leagueCache.set(key, out);
  return out;
}

/** How a club plays, in the words a booth would use. */
export function teamStyle(save: DynastySave, teamId: TeamId): TeamStyle {
  const t = totals(save, teamId);
  const plan = planFor(save, teamId);
  const sys = staffSystems(save, teamId);
  const era = eraProfile(save.year);
  const leaguePass = era.passAtt / (era.passAtt + era.rushAtt);
  const film = t.games >= 3;
  const passShare = t.att + t.rush ? t.att / (t.att + t.rush) : undefined;
  const lean = film && passShare !== undefined ? passShare - leaguePass : plan.attack === "pass" ? 0.06 : plan.attack === "run" ? -0.06 : 0;

  let offense = lean >= 0.05 ? "Air it out" : lean <= -0.05 ? "Ground and pound" : "Balanced attack";
  if (plan.tempo === "hurry") offense += ", no-huddle";

  let defense: string;
  const league = leagueAllowed(save);
  const sacksPg = film ? t.sacks / t.games : 0;
  const takePg = film ? t.takeaways / t.games : 0;
  const paPg = film ? t.pa / t.games : league.pa;
  const ydsPg = film ? t.ydsAllowed / t.games : league.yds;
  if (film && sacksPg >= era.sackRate * era.passAtt + 1.4) defense = "Relentless pass rush";
  else if (plan.blitz === "heavy") defense = "Blitz-happy";
  else if (film && takePg >= 2) defense = "Ball hawks";
  else if (film && paPg <= league.pa - 3 && ydsPg >= league.yds - 10) defense = "Bend, don't break";
  else if (film && paPg <= league.pa - 3) defense = "Stingy";
  else if (plan.blitz === "rare") defense = "Sit-back coverage";
  else defense = `${sys.defense} base`;

  // The players an identity runs through: when one is out, the booth says how it changes.
  const missing: string[] = [];
  const hurt = rosterOf(save, teamId).filter((p) => (p.injuredWeeks > 0 || p.onIR) && p.ovr >= 78).sort((a, b) => b.ovr - a.ovr);
  const qb = hurt.find((p) => p.pos === "QB");
  const rb = hurt.find((p) => p.pos === "RB");
  const wr = hurt.find((p) => p.pos === "WR");
  if (qb) missing.push(`Without ${playerName(qb)} at quarterback, expect them to lean on the run.`);
  if (rb && lean <= 0) missing.push(`No ${playerName(rb)} means the ground game loses its hammer.`);
  if (wr && lean >= 0) missing.push(`The passing game has to find a way without ${playerName(wr)}.`);
  const pass = hurt.find((p) => p.pos === "DE" || (p.pos === "OLB" && p.arch === "edge"));
  if (pass && defense === "Relentless pass rush") missing.push(`${playerName(pass)} is out, and he's the pass rush.`);

  const qbNow = starters(save, teamId, "QB", 1)[0];
  const line = film
    ? `${offense}, ${Math.round((passShare ?? leaguePass) * 100)}% passes over ${t.games} games. ${defense}${sacksPg ? `, ${sacksPg.toFixed(1)} sacks a game` : ""}.`
    : `${sys.offense} and a ${sys.defense}${qbNow ? `, with ${playerName(qbNow)} under center` : ""}.`;
  return { offense, defense, line, passShare, games: t.games, missing };
}
