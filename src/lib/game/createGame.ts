import type { CreateGameOpts, DynastySave, TeamId } from "./types.ts";
import { STARTING_YEAR } from "./types.ts";
import { ACTIVE_1966 } from "./types.ts";
import { blankState } from "./save.ts";
import { fillRoster, seedVeterans, syncDepth, normalizeJerseys } from "./players.ts";
import { rebuildSchedule } from "./schedule.ts";
import { buildDraftBoard, ensureSeasonPicks } from "./draft.ts";
import { COACHES_1966, EXPANSION_COACHES, LATER_COACHES } from "./data/coaches.ts";
import { MORE_COACHES } from "./data/coachesMore.ts";
import { addNews } from "./news.ts";
import { setLabel } from "./season.ts";
import { displayName } from "./teams.ts";
import { seedStaff, makeCoachFromSeed } from "./staff.ts";
import { ensureContracts } from "./coachContracts.ts";
import { refreshContracts } from "./salary.ts";

function seedCoaches(save: DynastySave): void {
  for (const c of [...COACHES_1966, ...EXPANSION_COACHES, ...LATER_COACHES, ...MORE_COACHES]) {
    const sitting = !!(c.teamId && c.yearAvail <= save.year);
    const coach = makeCoachFromSeed(c, save.year, {
      teamId: sitting ? c.teamId : null,
      role: c.role ?? "HC",
    });
    save.coaches[coach.id] = coach;
    if (sitting && c.teamId && save.teams[c.teamId]) {
      save.teams[c.teamId].coachId = coach.id;
    }
  }
}

export function createNewGame(opts: CreateGameOpts | TeamId, year?: number): DynastySave {
  const o: CreateGameOpts =
    typeof opts === "string" ? { userTeamId: opts, startingYear: year ?? STARTING_YEAR } : opts;
  const startingYear = o.startingYear ?? STARTING_YEAR;
  const seed = o.seed ?? (startingYear * 97 + o.userTeamId.charCodeAt(0));
  const save = blankState(o.userTeamId, startingYear, seed);
  save.cpuOnly = o.cpuOnly ?? !!o.sandbox;
  if (o.sandbox) save.sandbox = true;
  if (o.leagueSandbox) {
    save.leagueSandbox = true;
    save.leagueControl = {};
  }
  for (const id of ACTIVE_1966) {
    save.teams[id].active = startingYear >= 1966;
  }
  seedCoaches(save);
  seedStaff(save);
  ensureContracts(save);
  seedVeterans(save);
  for (const id of ACTIVE_1966) fillRoster(save, id);
  for (const id of ACTIVE_1966) syncDepth(save, id);
  refreshContracts(save, { init: true });
  save.draftSession = startingYear === 1966 ? "nfl" : "common";
  ensureSeasonPicks(save);
  buildDraftBoard(save);
  rebuildSchedule(save);
  save.phase = "draft";
  save.week = 0;
  setLabel(save);
  addNews(save, o.sandbox
    ? {
        kind: "headline",
        headline: `The ${startingYear} season is about to begin`,
        body: `Two leagues, ${ACTIVE_1966.length} clubs, and a draft board with Tommy Nobis at the top. Starr, Unitas, Namath, Sayers, Butkus. Sit back and watch it unfold.`,
        teamIds: [],
        playerIds: [],
      }
    : o.leagueSandbox
    ? {
        kind: "headline",
        headline: `The league is yours to run`,
        body: `League Architect is open. Pick a club, take its front office, and decide which jobs each computer staff should handle.` ,
        teamIds: [],
        playerIds: [],
      }
    : {
        kind: "headline",
        headline: `A new dynasty in ${displayName(startingYear, o.userTeamId)}`,
        body: `The ${startingYear} draft is open. Starr, Unitas, Namath, Sayers, Butkus — and a board with Tommy Nobis at the top. Rewrite football history.`,
        teamIds: [o.userTeamId],
        playerIds: [],
      });
  normalizeJerseys(save);
  save.jerseyEra = true;
  return save;
}
