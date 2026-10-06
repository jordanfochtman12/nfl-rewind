import type { AdvanceOpts, DynastySave } from "./types.ts";
import { END_YEAR } from "./types.ts";
import { activeTeamIds, roman, superBowlNumber } from "./teams.ts";
import { cloneSave, resetSeasonRecord } from "./save.ts";
import { rebuildSchedule, gamesInWeek, maxWeek } from "./schedule.ts";
import { clampSeasonStats, CrunchPause, setCrunchHook, simGame } from "./sim.ts";
import {
  autoDraftRest,
  buildDraftBoard,
  currentDraftTeam,
  ensureSeasonPicks,
  makeDraftPick,
  maybeStartAflDraft,
  pruneUndraftedProspects,
  simUntilUserPick,
} from "./draft.ts";
import { applyYearExpansion, closeExpansion } from "./expansion.ts";
import { compactSaveInPlace } from "./compact.ts";
import { writeSeasonChapter } from "./almanac.ts";
import { closeOwnerSeason, followHistory, isCityMove, ownerOf, postRelocationNews, relocationsFor } from "./owner.ts";
import { resolveCamp } from "./camp.ts";
import { announceRuleChanges } from "./rulebook.ts";
import { honorTradeRequests, tradeDemands, weeklyMoments } from "./careerMoments.ts";
import { closeDeadline, deadlineWeek, openDeadline } from "./deadline.ts";
import {
  cpuInSeasonMoves,
  gatherHof,
  gatherRetirees,
  resolveAwards,
  resolveHof,
  resolveProBowl,
  resolveRetirement,
  resolveSuperBowl,
  weekPrimetime,
} from "./events.ts";
import {
  createSuperBowl,
  playoffReadyForSuperBowl,
  playoffWeekLabel,
  seedPlayoffs,
  simPlayoffWeek,
} from "./playoffs.ts";
import { fillRoster, livingPlayers, normalizeJerseys, rosterOf, syncDepth } from "./players.ts";
import { visibleOvr } from "./scout.ts";
import { expansionForYear } from "./data/expansions.ts";
import { rand } from "./rng.ts";
import { agePlayer } from "./development.ts";
import { addNews } from "./news.ts";
import { buildPrimetime } from "./primetime.ts";
import { recordTimeline } from "./timeline.ts";
import { phoneRings, resolveAllBids } from "./market.ts";
import { freezePreviewPicks } from "./seasonPreview.ts";
import { closeTalks } from "./contracts.ts";
import { buildSeasonPlan, checkAchievements, draftRetrospective, gradeSeasonPlan, holdoutReported, seasonArcs } from "./storylines.ts";
import { regradeClasses } from "./draftGrades.ts";
import { ensureStaff, runCoachingCarousel, ageStaff, blackMonday, hotSeatWeek, interviewWeek } from "./staff.ts";
import { expireContract, refreshContracts, teamPayroll } from "./salary.ts";
import { cpuTrades, processWaivers, cpuSignNeeds, tradeWindowOpen, enforceCapCompliance } from "./gm.ts";
import { prunePastPicks, sessionLabel } from "./draft.ts";
import { winPct } from "./standings.ts";
import { touchGrade } from "./grade.ts";
import { pickFeaturedGame } from "./sandbox.ts";
import { advanceHistory } from "./historyMode.ts";
import { clearCombine, runCombine } from "./scouting.ts";

export function setLabel(save: DynastySave): void {
  const y = save.year;
  switch (save.phase) {
    case "draft":
      save.weekLabel = `${y} ${sessionLabel(save)}`;
      break;
    case "freeAgency":
      save.weekLabel = `${y} Free Agency`;
      break;
    case "expansion":
      save.weekLabel = expansionForYear(y)?.title ?? `${y} Expansion`;
      break;
    case "preseason":
      save.weekLabel = `${y} Training camp`;
      break;
    case "regular":
      save.weekLabel = `Week ${save.week}`;
      break;
    case "deadline":
      save.weekLabel = save.year < 1994 ? `${y} Trading week` : `${y} Trade deadline`;
      break;
    case "playoffs":
      save.weekLabel = playoffWeekLabel(save);
      break;
    case "superBowl":
      save.weekLabel = `Super Bowl ${roman(superBowlNumber(y))}`;
      break;
    case "awards":
      save.weekLabel = `${y} Awards`;
      break;
    case "proBowl":
      save.weekLabel = `${y} Pro Bowl`;
      break;
    case "retirement":
      save.weekLabel = "Retirement Ceremony";
      break;
    case "hof":
      save.weekLabel = "Hall of Fame";
      break;
    case "carousel":
      save.weekLabel = `${y} Coaching carousel`;
      break;
    case "relocation":
      save.weekLabel = relocationsFor(save, y)[0]?.title ?? `${y} Moving vans`;
      break;
    case "complete":
      save.weekLabel = `${y} Dynasty complete`;
      break;
  }
}

function ageAndRegen(save: DynastySave): void {
  // The owner's camp report: who came back better, who came back slower.
  const before = rosterOf(save, save.userTeamId).map((p) => ({ p, from: visibleOvr(p) }));
  for (const p of Object.values(save.players)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    agePlayer(save, p);
  }
  ageStaff(save);
  save.progression = {
    year: save.year,
    rows: before.map(({ p, from }) => ({ playerId: p.id, from, to: visibleOvr(p) })).filter((r) => r.to !== r.from),
  };
}

function runCpuFreeAgency(save: DynastySave): void {
  // Free agency opening is the deadline for the owner's contract talks.
  closeTalks(save, (p) => expireContract(save, p));
  cpuSignNeeds(save);
}

function fillCpuRosters(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    if (id === save.userTeamId && !save.cpuOnly) continue;
    if (!save.teams[id]) continue;
    fillRoster(save, id);
    save.teams[id].payroll = teamPayroll(save, id);
    syncDepth(save, id);
  }
}

function fillThinRosters(save: DynastySave): void {
  fillCpuRosters(save);
}

function runFreeAgency(save: DynastySave): void {
  runCpuFreeAgency(save);
  fillThinRosters(save);
  addNews(save, {
    kind: "transaction",
    headline: `${save.year} free agency closes`,
    body:
      save.year < 1994
        ? "Rozelle-rule era. Most veterans stay put. Clubs fill camp with leftovers."
        : "Unrestricted market closes. Cap numbers go to the league office.",
    teamIds: [],
    playerIds: [],
  });
}

function startRegular(save: DynastySave): void {
  // The preview's calls go on the record before the records reset (it reads last season's).
  if (!save.cpuOnly || save.sandbox) save.previewPicks = freezePreviewPicks(save);
  for (const id of activeTeamIds(save.year)) resetSeasonRecord(save.teams[id]!);
  rebuildSchedule(save);
  save.waiverOrder = activeTeamIds(save.year).slice().sort((a, b) => winPct(save.teams[a]!) - winPct(save.teams[b]!));
  save.phase = "regular";
  save.week = 1;
  save.weekFilm = false;
  save.deadline = undefined;
  save.playoffGames = [];
  save.superBowl = undefined;
  save.proBowl = undefined;
  save.awards = undefined;
  seasonArcs(save, () => rand(save));
  buildSeasonPlan(save);
  if (save.year === 1970) {
    addNews(save, {
      kind: "headline",
      headline: "The merger is complete",
      body: "AFL and NFL are now AFC and NFC. Colts, Browns, and Steelers play in the AFC. The playoff field is eight. Monday Night Football is on the board.",
      teamIds: ["clt", "cle", "pit"],
      playerIds: [],
    });
  }
}

/** Awards night: the honors, the owner's report card, the season's chapter, the trophy case, then the show. */
function closeSeasonBooks(s: DynastySave): void {
  resolveAwards(s);
  gradeSeasonPlan(s);
  writeSeasonChapter(s);
  checkAchievements(s);
  recordTimeline(s);
  buildPrimetime(s, "awards");
}

function tickInjuries(save: DynastySave): void {
  for (const p of livingPlayers(save)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    if (p.injuredWeeks > 0) {
      p.injuredWeeks -= 1;
      if (p.injuredWeeks <= 0) {
        p.injuryName = undefined;
        if (p.holdout) holdoutReported(save, p);
      }
    }
  }
}

/**
 * Crunch time. Before the owner's game is played for real, a throwaway copy of the week is
 * simulated; if the game reaches an undecided big moment it pauses there and asks. Once
 * every moment has an answer, the real week is played with those calls - the sim is
 * deterministic, so it's the same game up to each decision and the owner's call from there.
 * Returns false while a decision is pending.
 */
function crunchGate(s: DynastySave, gameId: string | undefined, run: (x: DynastySave) => void): boolean {
  if (!gameId || s.cpuOnly || s.crunchOn === false) {
    run(s);
    return true;
  }
  if (!s.crunch || s.crunch.gameId !== gameId) s.crunch = { gameId, choices: [] };
  const choices = s.crunch.choices.slice();
  const probe = cloneSave(s);
  setCrunchHook({ gameId, teamId: s.userTeamId, choices, probe: true });
  try {
    run(probe);
  } catch (e) {
    setCrunchHook(undefined);
    if (e instanceof CrunchPause) {
      s.crunch.situation = e.situation;
      return false;
    }
    throw e;
  }
  setCrunchHook({ gameId, teamId: s.userTeamId, choices, probe: false });
  try {
    run(s);
  } finally {
    setCrunchHook(undefined);
  }
  s.crunch = undefined;
  return true;
}

function userGameId(s: DynastySave, games: { id: string; homeId: string; awayId: string; played: boolean }[]): string | undefined {
  return games.find((g) => !g.played && (g.homeId === s.userTeamId || g.awayId === s.userTeamId))?.id;
}

function simThisWeek(save: DynastySave): void {
  tickInjuries(save);
  processWaivers(save);
  const games = gamesInWeek(save, save.week);
  pickFeaturedGame(save, games);
  for (const g of games) simGame(save, g);
  weeklyMoments(save, games);
  cpuInSeasonMoves(save);
  if (rand(save) < 0.08 && tradeWindowOpen(save)) cpuTrades(save);
  tradeDemands(save);
  honorTradeRequests(save);
  hotSeatWeek(save);
  phoneRings(save);
  weekPrimetime(save);
  // The finale's ballot and stat boards must use the same era-bounded season totals as awards night.
  if (save.schedule.filter(g => g.year === save.year && g.phase === "regular").every(g => g.played)) clampSeasonStats(save);
  buildPrimetime(save);
  save.waiverOrder = activeTeamIds(save.year)
    .slice()
    .sort((a, b) => winPct(save.teams[a]!) - winPct(save.teams[b]!));
  save.weekFilm = true;
}

function leaveRegularWeek(save: DynastySave): void {
  save.weekFilm = false;
  const last = maxWeek(save);
  if (save.week === deadlineWeek(save.year) && save.deadline?.year !== save.year) {
    openDeadline(save);
    save.phase = "deadline";
    return;
  }
  if (save.week >= last) {
    clampSeasonStats(save);
    seedPlayoffs(save);
    blackMonday(save);
    save.phase = "playoffs";
    save.week = 1;
  } else {
    save.week += 1;
  }
}

export function weekIsInTheBooks(save: DynastySave): boolean {
  if (save.phase === "regular") {
    const games = gamesInWeek(save, save.week);
    return games.length > 0 && games.every((g) => g.played);
  }
  if (save.phase === "playoffs") return !!save.weekFilm;
  return false;
}

function openDraft(save: DynastySave): void {
  pruneUndraftedProspects(save);
  save.draftSession = save.year === 1966 ? "nfl" : "common";
  ensureSeasonPicks(save);
  buildDraftBoard(save);
  runCombine(save);
  save.phase = "draft";
  save.week = 0;
  save.draftPickIndex = 0;
  save.faOpened = false;
  save.waivers = [];
  draftRetrospective(save);
  regradeClasses(save);
}

function finishOffseason(save: DynastySave): void {
  closeOwnerSeason(save);
  save.year += 1;
  compactSaveInPlace(save);
  prunePastPicks(save);
  ageAndRegen(save);
  const exp = expansionForYear(save.year);
  applyYearExpansion(save);
  ensureStaff(save);
  fillCpuRosters(save);
  refreshContracts(save);
  fillCpuRosters(save);
  enforceCapCompliance(save);
  normalizeJerseys(save);
  for (const id of activeTeamIds(save.year)) syncDepth(save, id);
  touchGrade(save);
  const moves = relocationsFor(save, save.year);
  if (moves.length) {
    save.phase = "relocation";
    save.week = 0;
    for (const m of moves) {
      // Your own club leaving town is your signature on the lease, not a headline you read.
      if (m.teamId === save.userTeamId && !save.cpuOnly && isCityMove(m)) {
        ownerOf(save).historic = { year: m.year, from: m.from, to: m.to };
        continue;
      }
      postRelocationNews(save, m);
    }
    return;
  }
  if (exp && save.expansion) {
    save.phase = "expansion";
    save.week = 0;
    return;
  }
  openDraft(save);
}

function closeRelocation(save: DynastySave): void {
  if (save.owner?.historic) followHistory(save);
  const exp = expansionForYear(save.year);
  if (exp && save.expansion) {
    save.phase = "expansion";
    save.week = 0;
    return;
  }
  openDraft(save);
}

/**
 * The actual step logic, mutating `s` in place and returning the same reference. Split out
 * of `advance` so a batch runner (simUntil) can clone once at the start of a whole
 * fast-forward instead of once per step - re-cloning the entire save every week made a long
 * dynasty's fast-forward cost scale with steps-taken x save-size, and both grow together
 * the deeper a save runs.
 */
function advanceInPlace(s: DynastySave, opts: AdvanceOpts = {}): DynastySave {
  // History mode doesn't simulate anything: each step lays down what really happened.
  if (s.realHistory) {
    advanceHistory(s);
    return s;
  }
  // A sandbox steps one moment at a time like a dynasty does, so each Sunday and each pick can
  // be watched; a plain cpu-only run (QA, batch sims) still rushes every phase.
  const auto = opts.auto || (s.cpuOnly && !s.sandbox);
  switch (s.phase) {
    case "draft": {
      if (auto) {
        autoDraftRest(s);
        s.phase = "freeAgency";
        clearCombine(s);
        runCpuFreeAgency(s);
        s.faOpened = true;
        break;
      }
      if (opts.simToUser) {
        simUntilUserPick(s);
        if (!currentDraftTeam(s)) {
          if (maybeStartAflDraft(s)) break;
          s.phase = "freeAgency";
        clearCombine(s);
          runCpuFreeAgency(s);
          s.faOpened = true;
        }
        break;
      }
      const team = currentDraftTeam(s);
      if (!team) {
        if (maybeStartAflDraft(s)) break;
        s.phase = "freeAgency";
        clearCombine(s);
        runCpuFreeAgency(s);
        s.faOpened = true;
        break;
      }
      if (team === s.userTeamId && !s.cpuOnly && opts.userPickPlayerId) {
        makeDraftPick(s, opts.userPickPlayerId);
      } else if (team === s.userTeamId && !s.cpuOnly && !opts.userPickPlayerId) {
        setLabel(s);
        return s;
      } else {
        makeDraftPick(s);
      }
      if (!currentDraftTeam(s)) {
        if (maybeStartAflDraft(s)) break;
        s.phase = "freeAgency";
        clearCombine(s);
        runCpuFreeAgency(s);
        s.faOpened = true;
      }
      break;
    }
    case "freeAgency":
      if (!s.faOpened) {
        runCpuFreeAgency(s);
        s.faOpened = true;
      }
      if (auto || opts.closeFa) {
        resolveAllBids(s);
        runFreeAgency(s);
        s.faOpened = false;
        s.phase = "preseason";
        resolveCamp(s);
        announceRuleChanges(s);
      }
      break;
    case "expansion":
      closeExpansion(s);
      openDraft(s);
      break;
    case "preseason":
      if (!s.camp || s.camp.year !== s.year) {
        resolveCamp(s);
        announceRuleChanges(s);
        if (!auto) break;
      }
      startRegular(s);
      break;
    case "regular": {
      const games = gamesInWeek(s, s.week);
      const unplayed = games.some((g) => !g.played);
      if (unplayed) {
        if (auto) simThisWeek(s);
        else if (!crunchGate(s, userGameId(s, games), simThisWeek)) break;
        if (!auto) break;
      }
      leaveRegularWeek(s);
      break;
    }
    case "deadline":
      closeDeadline(s);
      break;
    case "playoffs": {
      if (!s.weekFilm) {
        const before = s.playoffGames.filter((g) => g.played).length;
        if (auto) simPlayoffWeek(s);
        else {
          const open = s.playoffGames.filter((g) => !g.played);
          const w = Math.min(...open.map((g) => g.week));
          if (!crunchGate(s, userGameId(s, open.filter((g) => g.week === w)), simPlayoffWeek)) break;
        }
        const after = s.playoffGames.filter((g) => g.played).length;
        if (after > before) {
          interviewWeek(s);
          buildPrimetime(s, "playoffs");
          s.weekFilm = true;
          if (!auto) break;
        }
      }
      s.weekFilm = false;
      if (playoffReadyForSuperBowl(s)) {
        createSuperBowl(s);
        s.phase = "superBowl";
        s.week = 1;
      } else if (s.playoffGames.every((g) => g.played)) {
        throw new Error(`playoff bracket stuck ${s.year} week ${s.week} games=${s.playoffGames.map((g) => g.round).join(",")}`);
      } else {
        s.week += 1;
      }
      break;
    }
    case "superBowl": {
      const unplayed = !!s.superBowl && !s.superBowl.played;
      if (unplayed) {
        if (auto) resolveSuperBowl(s);
        else if (!crunchGate(s, s.superBowl ? userGameId(s, [s.superBowl]) : undefined, resolveSuperBowl)) break;
        buildPrimetime(s, "superBowl");
      }
      if (unplayed && !auto) break;
      if (!s.awards) closeSeasonBooks(s);
      else writeSeasonChapter(s);
      s.phase = "awards";
      break;
    }
    case "awards":
      if (!s.awards) closeSeasonBooks(s);
      else writeSeasonChapter(s);
      if (!s.proBowl?.played) {
        resolveProBowl(s);
        gatherRetirees(s);
      }
      s.phase = "proBowl";
      break;
    case "proBowl":
      if (!s.proBowl?.played) {
        resolveProBowl(s);
        gatherRetirees(s);
        if (!auto) break;
      }
      if (!s.pendingRetirees.length) gatherRetirees(s);
      s.phase = "retirement";
      break;
    case "retirement":
      resolveRetirement(s);
      gatherHof(s);
      s.phase = "hof";
      break;
    case "hof":
      resolveHof(s);
      if (s.year >= END_YEAR) {
        s.phase = "complete";
        const g = touchGrade(s);
        g.final = true;
        s.history.grade = g;
      } else {
        runCoachingCarousel(s);
        s.phase = "carousel";
        s.week = 0;
      }
      break;
    case "carousel":
      finishOffseason(s);
      break;
    case "relocation":
      closeRelocation(s);
      break;
    case "complete":
      touchGrade(s);
      if (s.history.grade) s.history.grade.final = true;
      break;
  }
  setLabel(s);
  return s;
}

export function advance(save: DynastySave, opts: AdvanceOpts = {}): DynastySave {
  return advanceInPlace(cloneSave(save), opts);
}

export function simUntil(
  save: DynastySave,
  pred: (s: DynastySave) => boolean,
  maxSteps = 12000,
): DynastySave {
  // One clone for the whole batch, not one per step - simUntil owns this copy outright and
  // mutates it in place across every step, so the caller's `save` is still never touched.
  const s = cloneSave(save);
  for (let i = 0; i < maxSteps; i++) {
    if (pred(s)) return s;
    if (s.phase === "complete") return s;
    const prevYear = s.year;
    const prevPhase = s.phase;
    const prevWeek = s.week;
    const prevPickIndex = s.draftPickIndex;
    const prevSbPlayed = s.superBowl?.played;
    const prevSession = s.draftSession;
    const prevFaOpened = s.faOpened;
    const prevHistoryStep = s.historyStep;
    advanceInPlace(s, { auto: true });
    if (
      s.year === prevYear &&
      s.phase === prevPhase &&
      s.week === prevWeek &&
      s.draftPickIndex === prevPickIndex &&
      s.superBowl?.played === prevSbPlayed &&
      s.draftSession === prevSession &&
      s.faOpened === prevFaOpened &&
      s.historyStep === prevHistoryStep
    ) {
      throw new Error(`simUntil stalled at ${s.year} ${s.phase} week ${s.week}`);
    }
  }
  throw new Error(`simUntil exceeded max steps at ${s.year} ${s.phase} week ${s.week}`);
}

export function simToSuperBowl(save: DynastySave): DynastySave {
  const start = save.year;
  return simUntil(save, (s) => s.year === start && !!s.superBowl?.played);
}

export function fastForwardToYear(save: DynastySave, year: number): DynastySave {
  return simUntil(
    save,
    (s) =>
      s.year > year ||
      (s.year === year &&
        (s.phase === "draft" ||
          s.phase === "freeAgency" ||
          s.phase === "expansion" ||
          s.phase === "carousel" ||
          s.phase === "relocation" ||
          s.phase === "deadline" ||
          s.phase === "preseason" ||
          s.phase === "regular")),
  );
}
