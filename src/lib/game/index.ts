export { SAVE_VERSION, STARTING_YEAR, END_YEAR, ROSTER_TARGET, TEAM_IDS, ACTIVE_1966 } from "./types.ts";
export type {
  AdvanceOpts,
  AwardsResult,
  CreateGameOpts,
  DynastySave,
  GameResult,
  Player,
  Phase,
  Pos,
  TeamId,
  TeamState,
} from "./types.ts";

export {
  activeTeamIds,
  conferenceOf,
  confLabel,
  displayName,
  divisionOf,
  divisionKey,
  gamesInSeason,
  isActive,
  locationOf,
  nicknameOf,
  originalLeague,
  roman,
  superBowlNumber,
  teamAbbr,
  teamColors,
  TEAM_META,
  logoSrc,
} from "./teams.ts";

export { blankState, hydrateSave, cloneSave } from "./save.ts";
export { createNewGame } from "./createGame.ts";
export { advance, simUntil, simToSuperBowl, fastForwardToYear, setLabel } from "./season.ts";
export { rebuildSchedule, gamesForTeam, maxWeek, gamesInWeek } from "./schedule.ts";
export { simGame, teamUnits, clampSeasonStats } from "./sim.ts";
export { standingRows, winPct, compareTeams, conferenceTeams, divisionWinner } from "./standings.ts";
export {
  seedPlayoffs,
  simPlayoffWeek,
  playoffReadyForSuperBowl,
  leagueChampions,
  createSuperBowl,
  playoffWeekLabel,
} from "./playoffs.ts";
export { buildDraftBoard, makeDraftPick, autoDraftRest, currentDraftTeam, draftOrder, simUntilUserPick } from "./draft.ts";
export { applyYearExpansion, userExpansionPick } from "./expansion.ts";
export { playerName, rosterOf, starters, hasKit, pruneRoster, trimRoster } from "./players.ts";
export { hasFullKit } from "./ratings.ts";
export { eraProfile } from "./era.ts";
export { expansionForYear, EXPANSION_SPECS } from "./data/expansions.ts";
export { DRAFT_CLASSES, draftSeedsFor } from "./data/draftClasses.ts";
export { superBowlSite, proBowlSite } from "./data/bowlSites.ts";

export { formatMoney, salaryCapFor, teamPayroll } from "./salary.ts";
export { abilitiesFrom, abilityLine, assignKit, kitBoost, kitDef, kitImpactLine, kitInjMult, ABILITY_DEFS, TRAIT_DEFS } from "./abilities.ts";
export { buildPrimetime, depthChart } from "./primetime.ts";
export { draftStyleOf } from "./staff.ts";

export { formatHt } from "./development.ts";
export { seasonLeaders, careerTotals } from "./leaders.ts";
