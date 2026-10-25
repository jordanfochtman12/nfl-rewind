import type { DynastySave, TeamId } from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName } from "./teams.ts";
import { EXPANSION_COACHES, type CoachSeed } from "./data/coaches.ts";
import { expansionForYear, type ExpansionSpec } from "./data/expansions.ts";
import { fillRoster, generatePlayer, movePlayer, playerName, rosterOf, DEPTH_CHART } from "./players.ts";
import { emptyTeam, resetSeasonRecord } from "./save.ts";
import { rebuildSchedule } from "./schedule.ts";
import { addNews, addTx } from "./news.ts";
import { makeCoachFromSeed, fillCoachFields } from "./staff.ts";

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
  const existing = save.coaches[seed.id] ?? makeCoachFromSeed(seed, save.year, { teamId, role: "HC" });
  fillCoachFields(existing, save.year);
  existing.teamId = teamId;
  existing.role = "HC";
  existing.yearsOnJob = existing.yearsOnJob || 1;
  save.coaches[seed.id] = existing;
  save.teams[teamId].coachId = seed.id;
  save.teams[teamId].offScheme = existing.offScheme;
  save.teams[teamId].defScheme = existing.defScheme;
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

export function remainingExposed(save: DynastySave): string[] {
  const exp = save.expansion;
  if (!exp) return [];
  const taken = new Set(exp.picksMade);
  const newbie = new Set(exp.newTeamIds);
  const out: string[] = [];
  for (const ids of Object.values(exp.exposed)) {
    for (const id of ids) {
      if (taken.has(id)) continue;
      const p = save.players[id];
      if (!p) continue;
      if (newbie.has(p.teamId as TeamId)) continue;
      out.push(id);
    }
  }
  return out;
}

export function expansionOnClock(save: DynastySave): TeamId | undefined {
  const exp = save.expansion;
  if (!exp || exp.done) return undefined;
  const total = exp.pickCap * Math.max(1, exp.newTeamIds.length);
  if (exp.picksMade.length >= total) return undefined;
  if (!exp.newTeamIds.length) return undefined;
  return exp.newTeamIds[exp.picksMade.length % exp.newTeamIds.length];
}

function takeExpansionPick(save: DynastySave, clubId: TeamId, playerId: string, title: string): void {
  const exp = save.expansion;
  if (!exp) return;
  const p = save.players[playerId];
  const from = p ? String(p.teamId) : "";
  movePlayer(save, playerId, clubId);
  exp.picksMade.push(playerId);
  exp.pickingIndex = exp.picksMade.length;
  if (p) {
    p.contractYears = Math.max(p.contractYears ?? 1, 2);
    addTx(save, "expansion", playerId, from, clubId, title);
  }
}

function fillExpansionClub(save: DynastySave, clubId: TeamId): void {
  while (rosterOf(save, clubId).length < ROSTER_TARGET) {
    // Leftover prospects who have since retired stay retired.
    const leftover = save.draftBoard.filter((d) => {
      const lp = save.players[d.playerId];
      return !d.taken && !(lp && (lp.teamId === "retired" || lp.teamId === "hof"));
    })[0];
    if (leftover) {
      leftover.taken = true;
      leftover.takenBy = clubId;
      const lp = save.players[leftover.playerId];
      if (lp) {
        lp.contractYears = Math.max(lp.contractYears ?? 1, 2);
        movePlayer(save, leftover.playerId, clubId);
      } else {
        const pos = DEPTH_CHART[rosterOf(save, clubId).length % DEPTH_CHART.length]![0];
        const g = generatePlayer(save, pos, clubId, 58 + (rosterOf(save, clubId).length % 12));
        g.contractYears = 2;
      }
    } else {
      const pos = DEPTH_CHART[rosterOf(save, clubId).length % DEPTH_CHART.length]![0];
      const g = generatePlayer(save, pos, clubId, 58 + (rosterOf(save, clubId).length % 12));
      g.contractYears = 2;
    }
  }
  fillRoster(save, clubId);
}

export function finishExpansionRosters(save: DynastySave): void {
  const exp = save.expansion;
  if (!exp) return;
  const spec = expansionForYear(save.year);
  for (const id of exp.newTeamIds) fillExpansionClub(save, id);
  exp.done = true;
  rebuildSchedule(save);
  if (!spec) return;
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

export function autoExpansionPicks(save: DynastySave, force = false): void {
  const exp = save.expansion;
  if (!exp || exp.done) return;
  const spec = expansionForYear(save.year);
  const title = spec?.title ?? `${save.year} Expansion`;
  const total = exp.pickCap * Math.max(1, exp.newTeamIds.length);
  let guard = 0;
  while (exp.picksMade.length < total && guard++ < 2000) {
    const club = expansionOnClock(save);
    if (!club) break;
    if (!force && club === save.userTeamId && !save.cpuOnly) return;
    const pick = pickNeed(save, club, remainingExposed(save));
    if (!pick) break;
    takeExpansionPick(save, club, pick, title);
  }
  const pickingDone = exp.picksMade.length >= total || remainingExposed(save).length === 0;
  if (pickingDone && (force || save.cpuOnly || !exp.newTeamIds.includes(save.userTeamId))) {
    finishExpansionRosters(save);
  }
}

export function closeExpansion(save: DynastySave): void {
  if (!save.expansion) return;
  if (!save.expansion.done) {
    autoExpansionPicks(save, true);
    if (!save.expansion.done) finishExpansionRosters(save);
  }
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
  save.expansion = {
    specId: spec.id,
    newTeamIds: spec.clubs.map((c) => c.id),
    exposed,
    picksMade: [],
    pickCap: spec.picksPerClub,
    pickingIndex: 0,
    done: false,
  };
  addNews(save, {
    kind: "expansion",
    headline: spec.title,
    body: `${spec.clubs.map((c) => `${displayName(save.year, c.id)} · ${c.coachName}`).join(". ")}. Exposed lists are on the table. The new club takes veterans off existing rosters.`,
    teamIds: spec.clubs.map((c) => c.id),
    playerIds: [],
  });
  const userIsNew = spec.clubs.some((c) => c.id === save.userTeamId);
  autoExpansionPicks(save, save.cpuOnly || !userIsNew);
  if (!save.expansion.done && (save.cpuOnly || !userIsNew)) finishExpansionRosters(save);
  rebuildSchedule(save);
}

export function applyYearExpansion(save: DynastySave): boolean {
  const spec = expansionForYear(save.year);
  if (!spec) {
    save.expansion = undefined;
    return false;
  }
  if (save.expansion?.specId === spec.id) {
    if (!save.expansion.done) autoExpansionPicks(save, save.cpuOnly);
    return true;
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
  if (!exp.newTeamIds.includes(save.userTeamId)) return;
  const club = expansionOnClock(save);
  if (club !== save.userTeamId) return;
  if (!remainingExposed(save).includes(playerId)) return;
  const spec = expansionForYear(save.year);
  takeExpansionPick(save, save.userTeamId, playerId, spec?.title ?? "Expansion");
  autoExpansionPicks(save, false);
  const total = exp.pickCap * Math.max(1, exp.newTeamIds.length);
  if ((exp.picksMade.length >= total || remainingExposed(save).length === 0) && !exp.done) {
    finishExpansionRosters(save);
  }
}
