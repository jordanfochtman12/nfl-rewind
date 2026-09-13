import type { AdvanceOpts, DynastySave } from "./types.ts";
import { activeTeamIds, roman, superBowlNumber } from "./teams.ts";
import { cloneSave, resetSeasonRecord } from "./save.ts";
import { rebuildSchedule, gamesInWeek, maxWeek } from "./schedule.ts";
import { clampSeasonStats, simGame } from "./sim.ts";
import {
  autoDraftRest,
  buildDraftBoard,
  currentDraftTeam,
  ensureSeasonPicks,
  makeDraftPick,
  maybeStartAflDraft,
  simUntilUserPick,
} from "./draft.ts";
import { applyYearExpansion } from "./expansion.ts";
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
import { fillRoster, generatePlayer, rosterOf, syncDepth, DEPTH_CHART } from "./players.ts";
import { expansionForYear } from "./data/expansions.ts";
import { rand } from "./rng.ts";
import { agePlayer } from "./development.ts";
import { addNews } from "./news.ts";
import { buildPrimetime } from "./primetime.ts";
import { ensureStaff, runCoachingCarousel } from "./staff.ts";
import { refreshContracts, teamPayroll } from "./salary.ts";
import { cpuTrades, processWaivers, signPlayer, freeAgents } from "./gm.ts";
import { sessionLabel } from "./draft.ts";
import { winPct } from "./standings.ts";

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
      save.weekLabel = `${y} Preseason`;
      break;
    case "regular":
      save.weekLabel = `Week ${save.week}`;
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
  }
}

function ageAndRegen(save: DynastySave): void {
  for (const p of Object.values(save.players)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    agePlayer(save, p);
  }
}

function runCpuFreeAgency(save: DynastySave): void {
  const pool = freeAgents(save).sort((a, b) => b.ovr - a.ovr);
  for (const id of activeTeamIds(save.year)) {
    if (id === save.userTeamId && !save.cpuOnly) continue;
    const n = rosterOf(save, id).length;
    const want = n < 44 ? 2 + (n < 40 ? 2 : 0) : rand(save) < 0.25 ? 1 : 0;
    let signed = 0;
    for (const p of pool) {
      if (signed >= want) break;
      if (p.teamId !== "fa") continue;
      const have = rosterOf(save, id).filter((x) => x.pos === p.pos);
      const best = have.sort((a, b) => b.ovr - a.ovr)[0];
      if (best && best.ovr >= p.ovr - 1 && have.length >= 2) continue;
      if (save.year < 1994 && p.ovr >= 84 && p.yearsPro >= 5 && rand(save) > 0.08) continue;
      if (signPlayer(save, id, p.id).ok) signed += 1;
    }
  }
}

function fillThinRosters(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    const n = rosterOf(save, id).length;
    if (n < 42) {
      const pos = DEPTH_CHART[n % DEPTH_CHART.length]![0];
      generatePlayer(save, pos, id, 55 + (n % 10));
    }
    syncDepth(save, id);
    save.teams[id].payroll = teamPayroll(save, id);
  }
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
  for (const id of activeTeamIds(save.year)) resetSeasonRecord(save.teams[id]!);
  rebuildSchedule(save);
  save.waiverOrder = activeTeamIds(save.year).slice().sort((a, b) => winPct(save.teams[a]!) - winPct(save.teams[b]!));
  save.phase = "regular";
  save.week = 1;
  save.playoffGames = [];
  save.superBowl = undefined;
  save.proBowl = undefined;
  save.awards = undefined;
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

function tickInjuries(save: DynastySave): void {
  for (const p of Object.values(save.players)) {
    if (p.injuredWeeks > 0) {
      p.injuredWeeks -= 1;
      if (p.injuredWeeks <= 0) p.injuryName = undefined;
    }
  }
}

function simRegularWeek(save: DynastySave): void {
  tickInjuries(save);
  processWaivers(save);
  const games = gamesInWeek(save, save.week);
  for (const g of games) simGame(save, g);
  cpuInSeasonMoves(save);
  if (rand(save) < 0.08) cpuTrades(save);
  weekPrimetime(save);
  buildPrimetime(save);
  save.waiverOrder = activeTeamIds(save.year)
    .slice()
    .sort((a, b) => winPct(save.teams[a]!) - winPct(save.teams[b]!));
  const last = maxWeek(save);
  if (save.week >= last) {
    clampSeasonStats(save);
    seedPlayoffs(save);
    save.phase = "playoffs";
    save.week = 1;
  } else {
    save.week += 1;
  }
}

function finishOffseason(save: DynastySave): void {
  runCoachingCarousel(save);
  save.year += 1;
  ageAndRegen(save);
  applyYearExpansion(save);
  ensureStaff(save);
  for (const id of activeTeamIds(save.year)) {
    if (save.teams[id]?.active || activeTeamIds(save.year).includes(id)) {
      if (!save.teams[id]) continue;
      save.teams[id].active = true;
      fillRoster(save, id);
    }
  }
  refreshContracts(save);
  for (const id of activeTeamIds(save.year)) syncDepth(save, id);
  save.draftSession = save.year === 1966 ? "nfl" : "common";
  ensureSeasonPicks(save);
  buildDraftBoard(save);
  save.phase = "draft";
  save.week = 0;
  save.draftPickIndex = 0;
  save.faOpened = false;
  save.waivers = [];
}

export function advance(save: DynastySave, opts: AdvanceOpts = {}): DynastySave {
  const s = cloneSave(save);
  const auto = opts.auto || s.cpuOnly;
  switch (s.phase) {
    case "draft": {
      if (auto) {
        autoDraftRest(s);
        s.phase = "freeAgency";
        runCpuFreeAgency(s);
        s.faOpened = true;
        break;
      }
      if (opts.simToUser) {
        simUntilUserPick(s);
        if (!currentDraftTeam(s)) {
          if (maybeStartAflDraft(s)) break;
          s.phase = "freeAgency";
          runCpuFreeAgency(s);
          s.faOpened = true;
        }
        break;
      }
      const team = currentDraftTeam(s);
      if (!team) {
        if (maybeStartAflDraft(s)) break;
        s.phase = "freeAgency";
        runCpuFreeAgency(s);
        s.faOpened = true;
        break;
      }
      if (team === s.userTeamId && opts.userPickPlayerId) {
        makeDraftPick(s, opts.userPickPlayerId);
      } else if (team === s.userTeamId && !opts.userPickPlayerId) {
        setLabel(s);
        return s;
      } else {
        makeDraftPick(s);
      }
      if (!currentDraftTeam(s)) {
        if (maybeStartAflDraft(s)) break;
        s.phase = "freeAgency";
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
        runFreeAgency(s);
        s.faOpened = false;
        s.phase = "preseason";
      }
      break;
    case "expansion":
      if (!s.expansion?.done) applyYearExpansion(s);
      s.draftSession = s.year === 1966 ? "nfl" : "common";
      buildDraftBoard(s);
      s.phase = "draft";
      s.draftPickIndex = 0;
      break;
    case "preseason":
      startRegular(s);
      break;
    case "regular":
      simRegularWeek(s);
      break;
    case "playoffs":
      simPlayoffWeek(s);
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
    case "superBowl":
      if (!s.superBowl?.played) resolveSuperBowl(s);
      if (auto || s.superBowl?.played) s.phase = "awards";
      break;
    case "awards":
      if (!s.awards) resolveAwards(s);
      s.phase = "proBowl";
      break;
    case "proBowl":
      if (!s.proBowl?.played) {
        resolveProBowl(s);
        gatherRetirees(s);
      }
      s.phase = "retirement";
      break;
    case "retirement":
      resolveRetirement(s);
      gatherHof(s);
      s.phase = "hof";
      break;
    case "hof":
      resolveHof(s);
      finishOffseason(s);
      break;
  }
  setLabel(s);
  return s;
}

export function simUntil(
  save: DynastySave,
  pred: (s: DynastySave) => boolean,
  maxSteps = 12000,
): DynastySave {
  let s = save;
  for (let i = 0; i < maxSteps; i++) {
    if (pred(s)) return s;
    const next = advance(s, { auto: true });
    if (
      next.year === s.year &&
      next.phase === s.phase &&
      next.week === s.week &&
      next.draftPickIndex === s.draftPickIndex &&
      next.superBowl?.played === s.superBowl?.played &&
      next.draftSession === s.draftSession &&
      next.faOpened === s.faOpened
    ) {
      throw new Error(`simUntil stalled at ${s.year} ${s.phase} week ${s.week}`);
    }
    s = next;
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
          s.phase === "preseason" ||
          s.phase === "regular")),
  );
}
