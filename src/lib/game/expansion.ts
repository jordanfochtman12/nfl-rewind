import type { DynastySave, TeamId } from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName } from "./teams.ts";
import { EXPANSION_COACHES, type CoachSeed } from "./data/coaches.ts";
import { expansionForYear, type ExpansionSpec } from "./data/expansions.ts";
import { addToRoster, fillRoster, generatePlayer, movePlayer, playerName, rosterOf } from "./players.ts";
import { emptyTeam, resetSeasonRecord } from "./save.ts";
import { rebuildSchedule } from "./schedule.ts";
import { addNews, addTx } from "./news.ts";
import { DEPTH_CHART } from "./players.ts";

function poolTeams(save: DynastySave, spec: ExpansionSpec, clubPool: "NFL" | "AFL" | "all"): TeamId[] {
  const year = save.year;
  return activeTeamIds(year).filter((id) => {
    if (spec.clubs.some((c) => c.id === id)) return false;
    if (clubPool === "all") return true;
    return conferenceOf(year, id) === clubPool || conferenceOf(Math.max(1966, year - 1), id) === clubPool;
  });
}

function exposeLists(save: DynastySave, sources: TeamId[], n: number): Record<TeamId, string[]> {
  const exposed: Record<TeamId, string[]> = {} as Record<TeamId, string[]>;
  for (const id of sources) {
    const roster = rosterOf(save, id).slice().sort((a, b) => b.ovr - a.ovr);
    const protectedIds = new Set(roster.slice(0, 3).map((p) => p.id));
    const rest = roster.filter((p) => !protectedIds.has(p.id));
    exposed[id] = rest.slice(-Math.max(n, 4)).map((p) => p.id);
  }
  return exposed;
}

function ensureCoach(save: DynastySave, seed: CoachSeed, teamId: TeamId): void {
  const existing = save.coaches[seed.id] ?? {
    id: seed.id,
    name: seed.name,
    teamId,
    yearAvail: seed.yearAvail,
    offense: seed.offense,
    defense: seed.defense,
    historical: true,
    role: "HC",
    offScheme: "multiple",
    defScheme: "4-3",
    yearsOnJob: 1,
    careerWins: 0,
    careerLosses: 0,
  };
  existing.role = existing.role ?? "HC";
  existing.offScheme = existing.offScheme ?? "multiple";
  existing.defScheme = existing.defScheme ?? "4-3";
  existing.yearsOnJob = existing.yearsOnJob ?? 1;
  existing.careerWins = existing.careerWins ?? 0;
  existing.careerLosses = existing.careerLosses ?? 0;
  existing.teamId = teamId;
  save.coaches[seed.id] = existing;
  save.teams[teamId].coachId = seed.id;
}

function activateClub(save: DynastySave, id: TeamId): void {
  if (!save.teams[id]) save.teams[id] = emptyTeam(id, true);
  save.teams[id].active = true;
  save.teams[id].roster = save.teams[id].roster ?? [];
  resetSeasonRecord(save.teams[id]);
}

function pickNeed(save: DynastySave, teamId: TeamId, ids: string[]): string | undefined {
  const have = rosterOf(save, teamId);
  const counts: Partial<Record<string, number>> = {};
  for (const p of have) counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  const ranked = ids
    .map((id) => save.players[id])
    .filter((p): p is NonNullable<typeof p> => !!p)
    .sort((a, b) => {
      const na = (counts[a.pos] ?? 0) - (DEPTH_CHART.find((d) => d[0] === a.pos)?.[1] ?? 2);
      const nb = (counts[b.pos] ?? 0) - (DEPTH_CHART.find((d) => d[0] === b.pos)?.[1] ?? 2);
      if (na !== nb) return na - nb;
      return b.ovr - a.ovr;
    });
  return ranked[0]?.id;
}

function relocateBrownsToRavens(save: DynastySave): void {
  activateClub(save, "rav");
  const seed = EXPANSION_COACHES.find((c) => c.id === "marchibroda-rav")!;
  ensureCoach(save, seed, "rav");
  const cle = save.teams.cle;
  const ids = rosterOf(save, "cle").map((p) => p.id);
  for (const pid of ids) movePlayer(save, pid, "rav");
  cle.roster = [];
  cle.active = false;
  cle.coachId = null;
  addNews(save, {
    kind: "expansion",
    headline: "Browns deactivate; Ravens begin in Baltimore",
    body: "The Cleveland name, colors, and history stay on Lake Erie. A new club, the Baltimore Ravens, takes the field with the relocated roster.",
    teamIds: ["cle", "rav"],
    playerIds: ids.slice(0, 4),
  });
}

function runAllocation(save: DynastySave, spec: ExpansionSpec): void {
  for (const club of spec.clubs) {
    activateClub(save, club.id);
    const seed = EXPANSION_COACHES.find((c) => c.id === club.coachId) ?? {
      id: club.coachId,
      name: club.coachName,
      teamId: club.id,
      yearAvail: spec.year,
      offense: 74,
      defense: 74,
    };
    ensureCoach(save, seed, club.id);
  }
  const sources = poolTeams(save, spec, spec.clubs[0]?.pool ?? "all");
  const exposed = exposeLists(save, sources, spec.exposedPerClub);
  const remaining = new Set(Object.values(exposed).flat());
  const picksMade: string[] = [];
  const cap = spec.picksPerClub;
  let guard = 0;
  while (picksMade.length < cap * spec.clubs.length && remaining.size && guard++ < 2000) {
    const club = spec.clubs[picksMade.length % spec.clubs.length]!;
    const pick = pickNeed(save, club.id, [...remaining]);
    if (!pick) break;
    remaining.delete(pick);
    movePlayer(save, pick, club.id);
    picksMade.push(pick);
    const p = save.players[pick];
    if (p) addTx(save, "expansion", pick, String(p.teamId), club.id, spec.title);
  }
  for (const club of spec.clubs) {
    while (rosterOf(save, club.id).length < ROSTER_TARGET) {
      const leftover = save.draftBoard.filter((d) => !d.taken)[0];
      if (leftover) {
        leftover.taken = true;
        leftover.takenBy = club.id;
        addToRoster(save, club.id, leftover.playerId);
      } else {
        const pos = DEPTH_CHART[rosterOf(save, club.id).length % DEPTH_CHART.length]![0];
        generatePlayer(save, pos, club.id, 58 + (rosterOf(save, club.id).length % 12));
      }
    }
    fillRoster(save, club.id);
  }
  save.expansion = {
    specId: spec.id,
    newTeamIds: spec.clubs.map((c) => c.id),
    exposed,
    picksMade,
    pickCap: cap,
    pickingIndex: picksMade.length,
    done: true,
  };
  rebuildSchedule(save);
  for (const club of spec.clubs) {
    const named = rosterOf(save, club.id)
      .filter((p) => p.historical)
      .slice(0, 4)
      .map(playerName)
      .join(", ");
    addNews(save, {
      kind: "expansion",
      headline: `${displayName(save.year, club.id)} join the league`,
      body: `${spec.title}. Coach ${club.coachName}. Early names: ${named || "a build of veterans and UDFAs"}. Roster ${rosterOf(save, club.id).length}.`,
      teamIds: [club.id],
      playerIds: rosterOf(save, club.id)
        .slice(0, 3)
        .map((p) => p.id),
    });
  }
}

export function applyYearExpansion(save: DynastySave): boolean {
  const spec = expansionForYear(save.year);
  if (!spec) {
    save.expansion = undefined;
    return false;
  }
  if (spec.kind === "relocate") {
    relocateBrownsToRavens(save);
    rebuildSchedule(save);
    save.expansion = {
      specId: spec.id,
      newTeamIds: ["rav"],
      exposed: {} as Record<TeamId, string[]>,
      picksMade: save.teams.rav.roster.slice(),
      pickCap: 0,
      pickingIndex: 0,
      done: true,
    };
    return true;
  }
  runAllocation(save, spec);
  return true;
}

export function userExpansionPick(save: DynastySave, playerId: string): void {
  const exp = save.expansion;
  if (!exp || exp.done) return;
  const userNew = exp.newTeamIds.includes(save.userTeamId);
  if (!userNew) return;
  const exposed = Object.values(exp.exposed).flat();
  if (!exposed.includes(playerId)) return;
  if (exp.picksMade.includes(playerId)) return;
  movePlayer(save, playerId, save.userTeamId);
  exp.picksMade.push(playerId);
  if (exp.picksMade.length >= exp.pickCap) exp.done = true;
}
