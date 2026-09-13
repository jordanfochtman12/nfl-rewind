import type { DynastySave, Player, Pos, SeasonStats, TeamId } from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { deriveOvr, ratingsFromOvr, hasFullKit } from "./ratings.ts";
import { eraCollege, eraName, jerseyFor } from "./names.ts";
import { jitter, randInt } from "./rng.ts";
import { VETERANS_1966, type VetSeed } from "./data/veterans1966.ts";
import { assignKit } from "./abilities.ts";
import { salaryFor } from "./salary.ts";
import { measurables } from "./development.ts";

export const DEPTH_CHART: [Pos, number][] = [
  ["QB", 3],
  ["RB", 4],
  ["FB", 1],
  ["WR", 4],
  ["TE", 2],
  ["LT", 2],
  ["LG", 2],
  ["C", 2],
  ["RG", 2],
  ["RT", 2],
  ["DE", 4],
  ["DT", 3],
  ["OLB", 3],
  ["MLB", 2],
  ["CB", 4],
  ["S", 3],
  ["K", 1],
  ["P", 1],
];

export function emptyStats(year: number, teamId: TeamId | "two"): SeasonStats {
  return {
    year,
    teamId,
    gp: 0,
    passAtt: 0,
    passCmp: 0,
    passYds: 0,
    passTd: 0,
    passInt: 0,
    sacksThrown: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTd: 0,
    rec: 0,
    recYds: 0,
    recTd: 0,
    tackles: 0,
    sacks: 0,
    ints: 0,
    ff: 0,
    fgAtt: 0,
    fgMade: 0,
    xpAtt: 0,
    xpMade: 0,
    punts: 0,
    puntYds: 0,
    krYds: 0,
    prYds: 0,
  };
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function nextPlayerId(save: DynastySave, prefix: string): string {
  save.nextPlayerSeq += 1;
  return `${prefix}-${save.nextPlayerSeq}`;
}

export function makePlayer(
  save: DynastySave,
  opts: {
    firstName: string;
    lastName: string;
    pos: Pos;
    teamId: Player["teamId"];
    ovr: number;
    age: number;
    historical: boolean;
    generated: boolean;
    college?: string;
    jersey?: number;
    draftYear?: number;
    draftRound?: number;
    id?: string;
  },
): Player {
  const ratings = ratingsFromOvr(opts.pos, opts.ovr, (base) => jitter(save, base, 6));
  const ovr = deriveOvr(opts.pos, ratings);
  const kit = assignKit(opts.pos, ratings, opts.firstName, opts.lastName);
  const id =
    opts.id ??
    (opts.historical
      ? `h-${slug(opts.lastName)}-${slug(opts.firstName)}-${opts.pos}`
      : nextPlayerId(save, "g"));
  let finalId = id;
  if (save.players[finalId]) finalId = nextPlayerId(save, opts.historical ? "h" : "g");
  const p: Player = {
    id: finalId,
    firstName: opts.firstName,
    lastName: opts.lastName,
    pos: opts.pos,
    teamId: opts.teamId,
    ratings,
    ovr,
    age: opts.age,
    yearsPro: Math.max(0, opts.age - 22),
    jersey: opts.jersey ?? 0,
    college: opts.college,
    historical: opts.historical,
    generated: opts.generated,
    draftYear: opts.draftYear,
    draftRound: opts.draftRound,
    userTied: opts.teamId === save.userTeamId,
    peakOvr: ovr,
    contractYears: randInt(save, 1, 4),
    salary: salaryFor(save.year, ovr, opts.age),
    abilities: kit.abilities,
    traits: kit.traits,
    injuredWeeks: 0,
    stats: {},
    career: [],
    ...measurables(opts.pos, ovr, ratings.speed),
  };
  save.players[p.id] = p;
  return p;
}

export function addToRoster(save: DynastySave, teamId: TeamId, playerId: string): void {
  const team = save.teams[teamId];
  if (!team) return;
  if (!team.roster.includes(playerId)) team.roster.push(playerId);
  const p = save.players[playerId];
  if (p) {
    p.teamId = teamId;
    if (teamId === save.userTeamId) p.userTied = true;
  }
}

export function removeFromRoster(save: DynastySave, teamId: TeamId, playerId: string): void {
  const team = save.teams[teamId];
  if (!team) return;
  team.roster = team.roster.filter((id) => id !== playerId);
}

export function movePlayer(save: DynastySave, playerId: string, to: TeamId | "fa"): void {
  const p = save.players[playerId];
  if (!p) return;
  if (p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof") {
    removeFromRoster(save, p.teamId, playerId);
  }
  if (to === "fa") {
    p.teamId = "fa";
  } else {
    addToRoster(save, to, playerId);
  }
}

export function pruneRoster(save: DynastySave, teamId: TeamId): void {
  const team = save.teams[teamId];
  if (!team) return;
  team.roster = team.roster.filter((id) => {
    const p = save.players[id];
    return !!p && p.teamId === teamId;
  });
}

export function rosterOf(save: DynastySave, teamId: TeamId): Player[] {
  const team = save.teams[teamId];
  if (!team) return [];
  return team.roster
    .map((id) => save.players[id])
    .filter((p): p is Player => !!p && p.teamId === teamId);
}

export function starters(save: DynastySave, teamId: TeamId, pos: Pos, n = 1): Player[] {
  return rosterOf(save, teamId)
    .filter((p) => p.pos === pos && p.injuredWeeks <= 0)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, n);
}

export function usedJerseys(save: DynastySave, teamId: TeamId): Set<number> {
  return new Set(rosterOf(save, teamId).map((p) => p.jersey));
}

export function generatePlayer(
  save: DynastySave,
  pos: Pos,
  teamId: Player["teamId"],
  ovr: number,
  age?: number,
): Player {
  const name = eraName(save);
  const used = teamId !== "fa" && teamId !== "retired" && teamId !== "hof" ? usedJerseys(save, teamId) : new Set<number>();
  const p = makePlayer(save, {
    firstName: name.first,
    lastName: name.last,
    pos,
    teamId,
    ovr,
    age: age ?? randInt(save, 22, 30),
    historical: false,
    generated: true,
    college: eraCollege(save),
    jersey: jerseyFor(save, pos, used),
  });
  if (teamId !== "fa" && teamId !== "retired" && teamId !== "hof") addToRoster(save, teamId, p.id);
  return p;
}

export function seedVeterans(save: DynastySave): void {
  const seen = new Set<string>();
  for (const v of VETERANS_1966 as VetSeed[]) {
    const key = `${v.t}:${v.f}:${v.l}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const used = usedJerseys(save, v.t);
    const jersey = v.n && !used.has(v.n) ? v.n : jerseyFor(save, v.p, used);
    const p = makePlayer(save, {
      firstName: v.f,
      lastName: v.l,
      pos: v.p,
      teamId: v.t,
      ovr: v.o,
      age: v.a,
      historical: true,
      generated: false,
      college: v.c,
      jersey,
    });
    addToRoster(save, v.t, p.id);
  }
}

export function fillRoster(save: DynastySave, teamId: TeamId): void {
  pruneRoster(save, teamId);
  for (const [pos, need] of DEPTH_CHART) {
    let have = rosterOf(save, teamId).filter((p) => p.pos === pos).length;
    let slot = have;
    while (have < need) {
      const ovr =
        slot === 0 ? randInt(save, 68, 78) : slot === 1 ? randInt(save, 58, 70) : randInt(save, 48, 62);
      generatePlayer(save, pos, teamId, ovr);
      have += 1;
      slot += 1;
    }
  }
  while (rosterOf(save, teamId).length < ROSTER_TARGET) {
    const pos = DEPTH_CHART[randInt(save, 0, DEPTH_CHART.length - 1)]![0];
    generatePlayer(save, pos, teamId, randInt(save, 48, 64));
  }
  trimRoster(save, teamId);
}

export function trimRoster(save: DynastySave, teamId: TeamId, cap = ROSTER_TARGET): void {
  pruneRoster(save, teamId);
  const roster = rosterOf(save, teamId).slice().sort((a, b) => b.ovr - a.ovr);
  if (roster.length <= cap) return;
  const keep = new Set<string>();
  for (const [pos, need] of DEPTH_CHART) {
    for (const p of roster.filter((x) => x.pos === pos).slice(0, need)) keep.add(p.id);
  }
  for (const p of roster) {
    if (keep.size >= cap) break;
    keep.add(p.id);
  }
  for (const p of roster) {
    if (!keep.has(p.id)) movePlayer(save, p.id, "fa");
  }
}

export function yearStats(p: Player, year: number, teamId: TeamId): SeasonStats {
  const existing = p.stats[year];
  if (existing) return existing;
  const s = emptyStats(year, teamId);
  p.stats[year] = s;
  return s;
}

export function allPlayers(save: DynastySave): Player[] {
  return Object.values(save.players);
}

export function hasKit(p: Player): boolean {
  return hasFullKit(p.ratings);
}
