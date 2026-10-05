/**
 * History mode: the league exactly as it happened. No club to run and nothing simulated:
 * every roster, score, playoff game, champion, award, draft pick and Hall of Fame class is
 * the real one, laid into the same save the rest of the game reads, so every tab shows the
 * real league as of the current week. Stat lines are the real ones where a source keeps
 * them (see historyData.ts); where none does, the line is left out rather than invented.
 * No React.
 */
import type { AwardsResult, DynastySave, GameResult, Player, SeasonStats, TeamId } from "./types.ts";
import type { HistoryData } from "./historyData.ts";
import { createNewGame } from "./createGame.ts";
import { activeTeamIds, displayName, gamesInSeason, roman, superBowlNumber } from "./teams.ts";
import { emptyStats, makePlayer, playerName } from "./players.ts";
import { resetSeasonRecord } from "./save.ts";
import { rebuildSchedule, gamesInWeek, maxWeek } from "./schedule.ts";
import { creditStandings } from "./sim.ts";
import { resolveSuperBowl } from "./events.ts";
import { recordAward } from "./honors.ts";
import { writeSeasonChapter } from "./almanac.ts";
import { addNews } from "./news.ts";
import { rulesTakingEffect } from "./rulebook.ts";

export const HISTORY_FIRST = 1966;
export const HISTORY_LAST = 2025;

let DATA: HistoryData | undefined;

/** Hand the engine its tables (see loadHistoryData). */
export function setHistoryData(d: HistoryData): void {
  DATA = d;
}

function data(): HistoryData {
  if (!DATA) throw new Error("History mode data is not loaded");
  return DATA;
}

const pid = (person: number) => `r-${person.toString(36)}`;

/** The save's player for a real person, made the first time he appears. */
function playerFor(save: DynastySave, person: number, year: number, teamId: Player["teamId"]): Player {
  const id = pid(person);
  const have = save.players[id];
  if (have) return have;
  const h = data().people[person]!;
  const born = h.birth ? Number(h.birth.slice(0, 4)) : undefined;
  const p = makePlayer(save, {
    id,
    firstName: h.first,
    lastName: h.last,
    pos: h.pos,
    teamId,
    ovr: 70,
    age: born ? year - born : 23,
    historical: true,
    generated: false,
    college: h.college,
  });
  p.yearsPro = Math.max(0, year - (data().firstSeason(person) ?? year));
  return p;
}

/** A new History mode save, at the 1966 draft. */
export function createHistoryGame(): DynastySave {
  const s = createNewGame({ userTeamId: "pit", startingYear: HISTORY_FIRST, sandbox: true, seed: 1966 });
  s.realHistory = true;
  s.cpuOnly = true;
  s.sandbox = true;
  // Everyone in the league comes from the real rosters, not the game's generated pool.
  s.players = {};
  s.draftBoard = [];
  s.transactions = [];
  s.news = [];
  for (const t of Object.values(s.teams)) {
    t.roster = [];
    t.depth = {};
    t.coachId = null;
    t.ocId = null;
    t.dcId = null;
  }
  s.phase = "draft";
  s.week = 0;
  s.weekLabel = `${HISTORY_FIRST} draft`;
  addNews(s, {
    kind: "headline",
    headline: "History mode: the league as it really was",
    body: "Every roster, score, playoff game, award and draft pick from 1966 on is the real one. Step through it week by week and open any tab to see the league at that moment.",
    teamIds: [],
    playerIds: [],
  });
  return s;
}

/**
 * History mode's disk form. The whole league is rebuilt from the record, so a save is just how
 * far along it is (a full replay to 2025 holds ~28k players and would be ~50MB on disk).
 */
export function historyCursor(save: DynastySave): { realHistory: true; historyStep: number } {
  return { realHistory: true, historyStep: save.historyStep ?? 0 };
}

/** Replay the record to a saved step (the data must be loaded first). */
export function replayHistory(steps: number): DynastySave {
  const s = createHistoryGame();
  for (let i = 0; i < steps && s.phase !== "complete"; i++) advanceHistory(s);
  return s;
}

/** What the record keeps for a season, said plainly. */
export function coverageNote(year: number): string {
  if (year < 1970)
    return "Rosters, every score, the playoffs, the draft, the awards and the Hall of Fame classes are real. No individual stat lines for this season are in the record yet, so none are shown.";
  if (year < 1992)
    return "Rosters, scores, playoffs, the draft, awards and Hall of Fame classes are real. Stat lines cover passing, rushing and receiving. Defense, kicking and returns aren't in the record for this era, so they're left blank.";
  if (year < 1999)
    return "Rosters, scores, playoffs, the draft, awards and Hall of Fame classes are real. Stat lines cover passing, rushing and receiving (completions aren't in the record for these seasons, shown as —). Defense, kicking and returns are left blank.";
  return "Every roster, score, playoff game, draft pick, award and Hall of Fame class is real, and so is every stat line: offense, defense, kicking and returns.";
}

/** What the next step in History mode does, for the watch bar. */
export function historyLabel(save: DynastySave): string {
  switch (save.phase) {
    case "draft":
      return `The ${save.year} draft`;
    case "preseason":
      return `Open the ${save.year} season`;
    case "regular":
      return save.week >= maxWeek(save) && weekDone(save) ? "On to the playoffs" : `Week ${save.week}`;
    case "playoffs":
      return nextRound(save) === "Super Bowl" ? `Super Bowl ${roman(superBowlNumber(save.year))}` : (nextRound(save) ?? "Playoffs");
    case "superBowl":
      return "Awards";
    case "awards":
      return "Hall of Fame class";
    case "hof":
      return save.year >= HISTORY_LAST ? "The end of the record" : `On to ${save.year + 1}`;
    default:
      return "Continue";
  }
}

const weekDone = (save: DynastySave) => gamesInWeek(save, save.week).every((g) => g.played);

/** Next playoff round not yet on the board. */
function nextRound(save: DynastySave): string | undefined {
  const played = new Set(save.playoffGames.map((g) => g.round));
  return data()
    .playoffs(save.year)
    .map((g) => g.round)
    .find((r) => !played.has(r) && !(r === "Super Bowl" && save.superBowl));
}

/** One step through history. */
export function advanceHistory(save: DynastySave): void {
  if (save.phase === "complete") return;
  save.historyStep = (save.historyStep ?? 0) + 1;
  switch (save.phase) {
    case "draft":
      applyDraft(save);
      save.phase = "preseason";
      break;
    case "preseason":
      openSeason(save);
      break;
    case "regular":
      playWeek(save);
      break;
    case "playoffs":
      playRound(save);
      break;
    case "superBowl":
      giveAwards(save);
      save.phase = "awards";
      break;
    case "awards":
      inductHallOfFame(save);
      save.phase = "hof";
      break;
    case "hof":
      if (save.year >= HISTORY_LAST) {
        save.phase = "complete";
        break;
      }
      save.year += 1;
      save.phase = "draft";
      save.week = 0;
      break;
    default:
      break;
  }
  save.weekLabel = labelFor(save);
}

function labelFor(save: DynastySave): string {
  switch (save.phase) {
    case "draft":
      return `${save.year} draft`;
    case "preseason":
      return `${save.year} preseason`;
    case "regular":
      return `Week ${save.week}`;
    case "playoffs":
      return "Playoffs";
    case "superBowl":
      return `Super Bowl ${roman(superBowlNumber(save.year))}`;
    case "awards":
      return "Awards";
    case "hof":
      return "Hall of Fame";
    case "complete":
      return "The end of the record";
    default:
      return save.weekLabel;
  }
}

function applyDraft(save: DynastySave): void {
  const picks = data().drafts(save.year);
  for (const pk of picks) {
    const p = playerFor(save, pk.person, save.year, "fa");
    p.draftYear = save.year;
    p.draftRound = pk.round;
    p.draftPick = pk.pick;
    p.draftTeam = pk.team;
  }
  const first = picks.filter((p) => p.round === 1 && (save.year !== 1966 || p.league === "nfl")).sort((a, b) => a.pick - b.pick)[0];
  if (first) {
    const p = save.players[pid(first.person)]!;
    addNews(save, {
      kind: "headline",
      headline: `The ${save.year} draft: ${playerName(p)} goes first`,
      body: `The ${displayName(save.year, first.team)} take ${playerName(p)} (${p.pos}${p.college ? `, ${p.college}` : ""}) with the first pick. ${picks.length} players were drafted.`,
      teamIds: [first.team],
      playerIds: [p.id],
    });
  }
}

/** Real rosters on the field, the real schedule up, last season's records cleared. */
function openSeason(save: DynastySave): void {
  const y = save.year;
  const rosters = data().rosters(y);
  const on = new Set<string>();
  for (const id of Object.keys(save.teams) as TeamId[]) {
    const t = save.teams[id]!;
    t.roster = [];
    t.depth = {};
    t.active = activeTeamIds(y).includes(id);
  }
  for (const [teamId, list] of rosters) {
    const t = save.teams[teamId];
    if (!t) continue;
    for (const { person, jersey } of list) {
      const p = playerFor(save, person, y, teamId);
      if (on.has(p.id)) continue; // a midseason move: he counts for his first club's roster
      on.add(p.id);
      p.teamId = teamId;
      if (jersey) p.jersey = jersey;
      const born = data().people[person]?.birth;
      if (born) p.age = y - Number(born.slice(0, 4));
      p.yearsPro = Math.max(0, y - (data().firstSeason(person) ?? y));
      t.roster.push(p.id);
    }
  }
  // Everyone not on a roster this season is out of the league for now, or done for good.
  for (const p of Object.values(save.players)) {
    if (on.has(p.id) || p.teamId === "hof") continue;
    const person = parseInt(p.id.slice(2), 36);
    const last = data().lastSeason(person);
    if (last !== undefined && last < y) {
      if (p.teamId !== "retired") {
        p.teamId = "retired";
        p.retiredYear = last;
        p.finalSeason = last;
      }
    } else p.teamId = "fa";
  }
  for (const id of activeTeamIds(y)) resetSeasonRecord(save.teams[id]!);
  rebuildSchedule(save);
  save.playoffGames = [];
  save.superBowl = undefined;
  save.awards = undefined;
  save.phase = "regular";
  save.week = 1;
  const rules = rulesTakingEffect(y);
  if (rules.length)
    addNews(save, {
      kind: "headline",
      headline: `New for ${y}: ${rules[0]!.title}`,
      body: rules.map((r) => r.body).join(" "),
      teamIds: [],
      playerIds: [],
    });
}

/** The real final scores for this week's games, into the standings. */
function playWeek(save: DynastySave): void {
  const games = gamesInWeek(save, save.week);
  for (const g of games) {
    if (g.played) continue;
    if (g.realHome === undefined || g.realAway === undefined) continue;
    g.homeScore = g.realHome;
    g.awayScore = g.realAway;
    g.played = true;
    creditStandings(save, g, false);
  }
  if (save.week >= maxWeek(save)) {
    closeRegularSeason(save);
    return;
  }
  save.week += 1;
}

/** The season's real stat lines go on the books once the regular season is over. */
function closeRegularSeason(save: DynastySave): void {
  const y = save.year;
  for (const { person, team, line } of data().stats(y)) {
    const p = playerFor(save, person, y, (team || "fa") as Player["teamId"]);
    const st: SeasonStats = { ...emptyStats(y, (team || p.teamId) as TeamId), ...(line as Partial<SeasonStats>) };
    p.stats[y] = st;
  }
  save.phase = "playoffs";
  save.week = 1;
  addNews(save, {
    kind: "headline",
    headline: `The ${y} regular season is in the books`,
    body: `${gamesInSeason(y)} games a club. The season's real stat lines are on the board.`,
    teamIds: [],
    playerIds: [],
  });
}

function gameFor(save: DynastySave, g: ReturnType<HistoryData["playoffs"]>[number], index: number, week: number): GameResult {
  return {
    id: `${save.year}-hp-${index}`,
    year: save.year,
    week,
    phase: g.round === "Super Bowl" ? "superBowl" : "playoffs",
    round: g.round,
    homeId: g.home,
    awayId: g.away,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    played: true,
  } as GameResult;
}

/** One real playoff round, or the Super Bowl. */
function playRound(save: DynastySave): void {
  const all = data().playoffs(save.year);
  const round = nextRound(save);
  if (!round) {
    save.phase = "superBowl";
    return;
  }
  const week = new Set(save.playoffGames.map((g) => g.round)).size + 1;
  all.forEach((g, i) => {
    if (g.round !== round) return;
    const game = gameFor(save, g, i, week);
    if (round === "Super Bowl") {
      const mvp = data().awards(save.year).sbmvp?.find((x): x is number => typeof x === "number");
      if (mvp !== undefined) game.mvpPlayerId = playerFor(save, mvp, save.year, "fa").id;
      save.superBowl = game;
    } else save.playoffGames.push(game);
  });
  if (round === "Super Bowl") {
    resolveSuperBowl(save);
    writeSeasonChapter(save);
    save.phase = "superBowl";
  }
}

const AWARD_FIELD: Record<string, keyof AwardsResult> = { mvp: "mvp", opoy: "offPoy", dpoy: "defPoy", oroy: "oroy", droy: "droy", cpoy: "cpoty" };
const AWARD_KEY = { mvp: "MVP", opoy: "OPOY", dpoy: "DPOY", oroy: "OROY", droy: "DROY", cpoy: "CPOY" } as const;

/** The real award winners (co-winners too) and the real Coach of the Year. */
function giveAwards(save: DynastySave): void {
  const y = save.year;
  const real = data().awards(y);
  const a: AwardsResult = { year: y, allPro: [] };
  const co: Record<string, string[]> = {};
  for (const [k, field] of Object.entries(AWARD_FIELD)) {
    const ids = (real[k] ?? []).filter((x): x is number => typeof x === "number").map((person) => playerFor(save, person, y, "fa"));
    if (!ids.length) continue;
    (a as unknown as Record<string, string>)[field] = ids[0]!.id;
    if (ids.length > 1) co[field] = ids.slice(1).map((p) => p.id);
    for (const p of ids) recordAward(p, y, AWARD_KEY[k as keyof typeof AWARD_KEY]);
  }
  if (Object.keys(co).length) a.co = co;
  const coy = real.coy?.find((x): x is string => typeof x === "string");
  if (coy) a.coyName = coy;
  save.awards = a;
  save.history.awards = save.history.awards.filter((x) => x.year !== y);
  save.history.awards.push(a);
  const mvp = a.mvp ? save.players[a.mvp] : undefined;
  if (mvp)
    addNews(save, {
      kind: "award",
      headline: `${playerName(mvp)} is the ${y} MVP`,
      body: [
        a.co?.mvp?.length ? `He shares it with ${a.co.mvp.map((id) => playerName(save.players[id]!)).join(", ")}.` : "",
        a.offPoy ? `Offensive Player of the Year: ${playerName(save.players[a.offPoy]!)}.` : "",
        a.defPoy ? `Defensive Player of the Year: ${playerName(save.players[a.defPoy]!)}.` : "",
        a.coyName ? `Coach of the Year: ${a.coyName}.` : "",
      ].filter(Boolean).join(" "),
      teamIds: [],
      playerIds: [mvp.id],
    });
}

/** The class announced that winter (inducted the summer after this season). */
function inductHallOfFame(save: DynastySave): void {
  const classYear = save.year + 1;
  const names: string[] = [];
  for (const x of data().hof(classYear)) {
    if (typeof x === "number") {
      const p = playerFor(save, x, save.year, "retired");
      p.teamId = "hof";
      p.hofYear = classYear;
      const teams = Object.entries(p.stats).sort((a, b) => (b[1].gp ?? 0) - (a[1].gp ?? 0));
      const teamId = (teams[0]?.[1].teamId ?? p.draftTeam ?? "pit") as TeamId;
      save.history.hof.push({ playerId: p.id, year: classYear, teamId, blurb: `Class of ${classYear}.`, kind: "player" });
      names.push(playerName(p));
    } else {
      save.history.hof.push({ name: x, year: classYear, teamId: "pit", blurb: `Class of ${classYear}.`, kind: "contributor" });
      names.push(x);
    }
  }
  if (names.length)
    addNews(save, {
      kind: "hof",
      headline: `The Hall of Fame class of ${classYear}`,
      body: names.join(", ") + ".",
      teamIds: [],
      playerIds: [],
    });
}
