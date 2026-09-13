export { SAVE_VERSION, STARTING_YEAR, END_YEAR, ROSTER_TARGET, TEAM_IDS, ACTIVE_1966 } from "./types.ts";
export type {
  AdvanceOpts,
  AwardsResult,
  CreateGameOpts,
  DraftPickAsset,
  DraftSession,
  DynastySave,
  GameResult,
  GmResult,
  Player,
  Phase,
  Pos,
  SeasonStats,
  TeamId,
  TeamState,
  TradePiece,
  CoachRole,
  OffScheme,
  DefScheme,
  DraftStyle,
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
export { rebuildSchedule, gamesForTeam, maxWeek, gamesInWeek, isRivalry, RIVALRIES } from "./schedule.ts";
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
export {
  buildDraftBoard,
  makeDraftPick,
  autoDraftRest,
  currentDraftTeam,
  draftOrder,
  draftQueue,
  simUntilUserPick,
  sessionLabel,
  sessionOf,
  allPicks,
  transferPick,
} from "./draft.ts";
export { applyYearExpansion, userExpansionPick } from "./expansion.ts";
export { playerName, rosterOf, starters, hasKit, pruneRoster, trimRoster, depthAt, syncDepth } from "./players.ts";
export { hasFullKit, isPrimary, primaryKeys } from "./ratings.ts";
export { eraProfile } from "./era.ts";
export { expansionForYear, EXPANSION_SPECS } from "./data/expansions.ts";
export { DRAFT_CLASSES, draftSeedsFor } from "./data/draftClasses.ts";
export { superBowlSite, proBowlSite } from "./data/bowlSites.ts";

export { formatMoney, salaryCapFor, teamPayroll } from "./salary.ts";
export { abilitiesFrom, abilityLine, assignKit, kitBoost, kitDef, kitImpactLine, kitInjMult, ABILITY_DEFS, TRAIT_DEFS } from "./abilities.ts";
export { lookupProfile, ratingsFromProfile, SCOUT_KEYS, RATING_GROUPS, ARCH_LABEL, inferArch } from "./profiles.ts";
export type { Arch } from "./profiles.ts";
export { buildPrimetime, depthChart } from "./primetime.ts";
export { draftStyleOf, availableCoaches, hireCoach, fireCoach, setTeamScheme } from "./staff.ts";

export { formatHt } from "./development.ts";
export { seasonLeaders, careerTotals } from "./leaders.ts";
export { lookupCollege } from "./data/colleges.ts";
export {
  statCols,
  statGroup,
  seasonLog,
  careerOf,
  draftLine,
  passerRating,
  pct,
  avg,
  scoring,
  hasSeasonWork,
  colsForFamily,
  familyOfPos,
  familiesOf,
  familiesAcross,
  careerHeadlines,
  seasonLabel,
  FAMILY_LABEL,
  type StatCol,
  type StatFamily,
} from "./statsView.ts";

export { visibleOvr, visibleRatings, scoutLetter, scoutLine, applyScout, maybeReveal } from "./scout.ts";
export {
  cutPlayer,
  signPlayer,
  claimWaiver,
  executeTrade,
  setDepthOrder,
  moveDepth,
  deskHire,
  deskFire,
  deskScheme,
  freeAgents,
} from "./gm.ts";
