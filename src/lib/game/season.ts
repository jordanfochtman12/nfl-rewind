import type { AdvanceOpts, DynastySave } from "./types.ts";
import { activeTeamIds, roman, superBowlNumber } from "./teams.ts";
import { cloneSave, resetSeasonRecord } from "./save.ts";
import { rebuildSchedule, gamesInWeek, maxWeek } from "./schedule.ts";
import { clampSeasonStats, simGame } from "./sim.ts";
import { autoDraftRest, buildDraftBoard, currentDraftTeam, makeDraftPick } from "./draft.ts";
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
import { fillRoster, generatePlayer, rosterOf, DEPTH_CHART } from "./players.ts";
import { expansionForYear } from "./data/expansions.ts";
import { rand } from "./rng.ts";
import { agePlayer } from "./development.ts";
import { addNews } from "./news.ts";
import { buildPrimetime } from "./primetime.ts";
import { ensureStaff, runCoachingCarousel } from "./staff.ts";
import { refreshContracts } from "./salary.ts";

export function setLabel(save: DynastySave): void {
  const y = save.year;
  switch (save.phase) {
    case "draft":
      save.weekLabel = `${y} Draft`;
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

function runFreeAgency(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    const n = rosterOf(save, id).length;
    if (n < 42) {
      const pos = DEPTH_CHART[n % DEPTH_CHART.length]![0];
      generatePlayer(save, pos, id, 55 + (n % 10));
    }
  }
  addNews(save, {
    kind: "transaction",
    headline: `${save.year} free agency closes`,
    body: "Clubs sign leftover veterans and camp bodies.",
    teamIds: [],
    playerIds: [],
  });
}

function startRegular(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) resetSeasonRecord(save.teams[id]!);
  rebuildSchedule(save);
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
      body: "AFL and NFL are now AFC and NFC. Colts, Browns, and Steelers play in the AFC. The playoff field is eight.",
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
  const games = gamesInWeek(save, save.week);
  for (const g of games) simGame(save, g);
  cpuInSeasonMoves(save);
  weekPrimetime(save);
  buildPrimetime(save);
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
  buildDraftBoard(save);
  save.phase = "draft";
  save.week = 0;
  save.draftPickIndex = 0;
}

export function advance(save: DynastySave, opts: AdvanceOpts = {}): DynastySave {
  const s = cloneSave(save);
  const auto = opts.auto || s.cpuOnly;
  switch (s.phase) {
    case "draft": {
      if (auto) {
        autoDraftRest(s);
        s.phase = "freeAgency";
        break;
      }
      const team = currentDraftTeam(s);
      if (!team) {
        s.phase = "freeAgency";
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
      if (s.draftPickIndex >= s.draftBoard.length) s.phase = "freeAgency";
      break;
    }
    case "freeAgency":
      runFreeAgency(s);
      s.phase = "preseason";
      break;
    case "expansion":
      if (!s.expansion?.done) applyYearExpansion(s);
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
      next.superBowl?.played === s.superBowl?.played
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
