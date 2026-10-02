export { SAVE_VERSION, STARTING_YEAR, END_YEAR, ROSTER_TARGET, TEAM_IDS, ACTIVE_1966, HOF_WAIT_YEARS, COACH_HOF_WAIT_YEARS } from "./types.ts";
export type {
  AdvanceOpts,
  TradeCall,
  SeasonPreview,
  PreviewTeam,
  PreviewPicks,
  LiveOrder,
  FaBid,
  Rumor,
  AwardsResult,
  BoxPlayer,
  CampReport,
  CreateGameOpts,
  DeadlineSession,
  DraftPickAsset,
  DraftSession,
  DynastySave,
  GameResult,
  Gameplan,
  GmResult,
  Player,
  Phase,
  Pos,
  SeasonStats,
  TeamId,
  TeamState,
  TradeOffer,
  TradePiece,
  Coach,
  CoachRole,
  HofMember,
  OffScheme,
  DefScheme,
  DraftStyle,
  DynastyGrade,
  SeasonChapter,
  PrimetimeShow,
  PlayLog,
  TimelineEntry,
  SeasonPlan,
  SeasonGoal,
  Achievement,
  PrimetimeHonoree,
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
  clubInk,
  onClubColor,
  hexLum,
  TEAM_META,
  logoSrc,
} from "./teams.ts";

export { blankState, hydrateSave, cloneSave } from "./save.ts";
export { createNewGame } from "./createGame.ts";
export { advance, simUntil, simToSuperBowl, fastForwardToYear, setLabel, weekIsInTheBooks } from "./season.ts";
export { byeNote, rebuildSchedule, gamesForTeam, gameDateLabel, realResultFor, realSchedule, maxWeek, gamesInWeek, isRivalry, RIVALRIES } from "./schedule.ts";
export { simGame, teamUnits, clampSeasonStats, formatClock, planFor, defaultPlan } from "./sim.ts";
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
export { applyYearExpansion, userExpansionPick, closeExpansion, expansionOnClock, remainingExposed } from "./expansion.ts";
export {
  playerName,
  rosterOf,
  activeRosterOf,
  starters,
  starterCount,
  isStarter,
  hasKit,
  pruneRoster,
  trimRoster,
  depthAt,
  syncDepth,
} from "./players.ts";
export { hasFullKit, isPrimary, primaryKeys } from "./ratings.ts";
export { eraProfile, xpKickYards, fourthGoBias, eraTargetWeights, dpiIsSpot, playoffBrake } from "./era.ts";
export { expansionForYear, EXPANSION_SPECS } from "./data/expansions.ts";
export { DRAFT_CLASSES, draftSeedsFor } from "./data/draftClasses.ts";
export { superBowlSite, proBowlSite } from "./data/bowlSites.ts";

export { formatMoney, salaryCapFor, teamPayroll } from "./salary.ts";
export { abilitiesFrom, abilityLine, assignKit, kitBoost, kitDef, kitImpactLine, kitInjMult, ABILITY_DEFS, TRAIT_DEFS } from "./abilities.ts";
export { lookupProfile, ratingsFromProfile, SCOUT_KEYS, RATING_GROUPS, ARCH_LABEL, inferArch } from "./profiles.ts";
export type { Arch } from "./profiles.ts";
export { buildPrimetime, depthChart, previewGame, projectWins } from "./primetime.ts";
export { goalProgress, endHoldout, holdoutAsk, milestoneChases, type Chase } from "./storylines.ts";
export { seriesNote } from "./h2h.ts";
export { draftStyleOf, availableCoaches, hireCoach, fireCoach, setTeamScheme, fillCoachFields, staffOf } from "./staff.ts";
export { assignCoachKit, coachAbilityLine, coachKitLine, coachKitDef, COACH_ABILITY_DEFS, COACH_TRAIT_DEFS } from "./coachKit.ts";
export { playerHofScore, coachHofScore } from "./hof.ts";

export { formatHt } from "./development.ts";
export { venueOf, pickWeather, bowlVenue, crowdNoise } from "./venues.ts";
export { seasonLeaders, careerTotals, playoffTotals } from "./leaders.ts";
export { honorLines, AWARD_LABEL } from "./honors.ts";
export {
  seasonRecordBook,
  careerRecordBook,
  gameRecordBook,
  allDecadeTeam,
  availableDecades,
  type RecordCategory,
  type RecordRow,
  type DecadeTeamSlot,
} from "./records.ts";
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
  deskPlan,
  freeAgents,
  deskHoles,
  placeOnIR,
  activateFromIR,
  canReturnFromIR,
  tradeWindowOpen,
  rozelleLock,
} from "./gm.ts";

export { gradeDynasty, touchGrade } from "./grade.ts";
export { writeSeasonChapter, seasonResultLine, chapterLine } from "./almanac.ts";
export { relocationsForYear, RELOCATION_SPECS } from "./data/relocations.ts";
export { compactSave, compactSaveInPlace, saveByteLength, formatBytes } from "./compact.ts";
export { resolveCamp, campBubble } from "./camp.ts";
export {
  retiredNumbers,
  ringOfHonor,
  clubSeasons,
  signatureClub,
  seasonLine,
  legacyCase,
  canRetireNumber,
  retireNumber,
  canInductRing,
  inductRing,
  inRing,
  isNumberRetired,
  legacyCandidates,
  type LegacyCase,
} from "./legacy.ts";
export {
  openCalls,
  acceptCall,
  declineCall,
  BID_TIERS,
  bidEligible,
  askingPrice,
  bidFor,
  leaning,
  placeBid,
  resolveBid,
  hotFreeAgents,
  type Leaning,
} from "./market.ts";
export { buildSeasonPreview, freezePreviewPicks, oddsOf, PREVIEW_CAST } from "./seasonPreview.ts";
export { findGame, ownerGameJustPlayed, ordersUpTo, withOrder } from "./liveCalls.ts";
export { deadlineWeek, openDeadline, closeDeadline, acceptDeadlineOffer, declineDeadlineOffer, offerLine } from "./deadline.ts";
export {
  TICKET_TIERS,
  ticketPrice,
  avgTicketPrice,
  formatPrice,
  supportMood,
  ownerOf,
  setTicketTier,
  acceptRelocation,
  declineRelocation,
  followHistory,
  stayHome,
  relocationsFor,
} from "./owner.ts";
export { draftPreview, collegeLine, groupOf, POS_GROUPS, type DraftPreviewData, type PosGroup, type PreviewProspect, type MockPick } from "./draftPreview.ts";
export { realLine, realPostseason, realRecords, recordTimeline } from "./timeline.ts";
