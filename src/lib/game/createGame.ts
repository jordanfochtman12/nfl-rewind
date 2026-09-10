import type { CreateGameOpts, DynastySave, TeamId } from "./types.ts";
import { STARTING_YEAR } from "./types.ts";
import { ACTIVE_1966 } from "./types.ts";
import { blankState } from "./save.ts";
import { fillRoster, seedVeterans } from "./players.ts";
import { rebuildSchedule } from "./schedule.ts";
import { buildDraftBoard } from "./draft.ts";
import { COACHES_1966, EXPANSION_COACHES, LATER_COACHES } from "./data/coaches.ts";
import { addNews } from "./news.ts";
import { setLabel } from "./season.ts";
import { displayName } from "./teams.ts";
import { seedStaff } from "./staff.ts";
import { refreshContracts } from "./salary.ts";

function seedCoaches(save: DynastySave): void {
  for (const c of [...COACHES_1966, ...EXPANSION_COACHES, ...LATER_COACHES]) {
    save.coaches[c.id] = {
      id: c.id,
      name: c.name,
      teamId: c.teamId,
      yearAvail: c.yearAvail,
      offense: c.offense,
      defense: c.defense,
      historical: true,
      role: "HC",
      offScheme: "multiple",
      defScheme: "4-3",
      yearsOnJob: 3,
      careerWins: 0,
      careerLosses: 0,
    };
    if (c.teamId && save.teams[c.teamId] && c.yearAvail <= save.year) {
      save.teams[c.teamId].coachId = c.id;
    }
  }
}

export function createNewGame(opts: CreateGameOpts | TeamId, year?: number): DynastySave {
  const o: CreateGameOpts =
    typeof opts === "string" ? { userTeamId: opts, startingYear: year ?? STARTING_YEAR } : opts;
  const startingYear = o.startingYear ?? STARTING_YEAR;
  const seed = o.seed ?? (startingYear * 97 + o.userTeamId.charCodeAt(0));
  const save = blankState(o.userTeamId, startingYear, seed);
  save.cpuOnly = o.cpuOnly ?? false;
  for (const id of ACTIVE_1966) {
    save.teams[id].active = startingYear >= 1966;
  }
  seedCoaches(save);
  seedStaff(save);
  seedVeterans(save);
  for (const id of ACTIVE_1966) fillRoster(save, id);
  refreshContracts(save);
  buildDraftBoard(save);
  rebuildSchedule(save);
  save.phase = "draft";
  save.week = 0;
  setLabel(save);
  addNews(save, {
    kind: "headline",
    headline: `A new dynasty in ${displayName(startingYear, o.userTeamId)}`,
    body: `The ${startingYear} draft is open. Starr, Unitas, Namath, Sayers, Butkus — and a board with Tommy Nobis at the top. Rewrite football history.`,
    teamIds: [o.userTeamId],
    playerIds: [],
  });
  return save;
}
