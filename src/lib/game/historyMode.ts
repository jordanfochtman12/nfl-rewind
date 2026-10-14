/**
 * History mode: the league exactly as it happened. No club to run and nothing simulated:
 * every roster, score, playoff game, champion, award, draft pick and Hall of Fame class is
 * the real one, laid into the same save the rest of the game reads, so every tab shows the
 * real league as of the current week. Stat lines are the real ones where a source keeps
 * them (see historyData.ts); where none does, the line is left out rather than invented.
 * No React.
 */
import type { AwardsResult, Coach, DynastySave, GameResult, Player, SeasonStats, TeamId } from "./types.ts";
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
import { addNews, addTx } from "./news.ts";
import { rulesTakingEffect } from "./rulebook.ts";
import { boxFor, boxPlayerId, boxSeason, gradeCall, ledgerGame, recordBookNow, recordNews, seedLedgers, type RecordHolder } from "./historyExtras.ts";

export const HISTORY_FIRST = 1966;
export const HISTORY_LAST = 2025;

let DATA: HistoryData | undefined;

/** Hand the engine its tables (see loadHistoryData). */
export function setHistoryData(d: HistoryData): void {
  DATA = d;
}

/** The loaded record, for building a dynasty from a real season (eraStart.ts). */
export function historyData(): HistoryData {
  return data();
}

function data(): HistoryData {
  if (!DATA) throw new Error("History mode data is not loaded");
  return DATA;
}

const pid = (person: number) => `r-${person.toString(36)}`;

/** The save's player for a real person, made the first time he appears. */
export function playerFor(save: DynastySave, person: number, year: number, teamId: Player["teamId"]): Player {
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
  s.coaches = {};
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
  seedLedgers(s, data().before1966.franchise, data().before1966.series);
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
export interface HistoryCursor {
  realHistory: true;
  historyStep: number;
  follow?: DynastySave["historyFollow"];
  calls?: DynastySave["historyCalls"];
}

export function historyCursor(save: DynastySave): HistoryCursor {
  return {
    realHistory: true,
    historyStep: save.historyStep ?? 0,
    ...(save.historyFollow ? { follow: save.historyFollow } : {}),
    ...(save.historyCalls ? { calls: save.historyCalls } : {}),
  };
}

/** Replay the record to a saved step (the data must be loaded first). The viewer's follows and calls ride along. */
export function replayHistory(steps: number, extras: Pick<HistoryCursor, "follow" | "calls"> = {}): DynastySave {
  const s = createHistoryGame();
  if (extras.follow) s.historyFollow = extras.follow;
  if (extras.calls) s.historyCalls = extras.calls;
  for (let i = 0; i < steps && s.phase !== "complete"; i++) advanceHistory(s);
  applyLiveLines(s);
  return s;
}

/** What the record keeps for a season, said plainly. */
export function coverageNote(year: number): string {
  const base = "Rosters, every score, the playoffs, the draft, the awards and the Hall of Fame classes are real.";
  if (year < 1970)
    return `${base} Stat lines are real too: passing, rushing, receiving, interceptions, fumble recoveries, kicking, punting and returns. Sacks, tackles and forced fumbles weren't counted yet, so they're left blank.`;
  if (year < 1982)
    return `${base} Stat lines are real: offense, interceptions, sacks, fumble recoveries, kicking, punting and returns. Sacks weren't official until 1982; these are researchers' counts from game film. Tackles and forced fumbles aren't in the record, so they're left blank.`;
  if (year < 1999)
    return `${base} Stat lines are real: offense, interceptions, sacks, fumble recoveries, kicking, punting and returns. Tackles and forced fumbles aren't in the record before 1999, so they're left blank.`;
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

const coachId = (name: string) => `rc-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** The save's coach for a real head coach, made the first time he's on a sideline. */
function coachFor(save: DynastySave, name: string, year: number): Coach {
  const id = coachId(name);
  const have = save.coaches[id];
  if (have) return have;
  const c: Coach = {
    id,
    name,
    teamId: null,
    yearAvail: year,
    offense: 0,
    defense: 0,
    historical: true,
    role: "HC",
    offScheme: "multiple",
    defScheme: "4-3",
    yearsOnJob: 0,
    careerWins: 0,
    careerLosses: 0,
    careerTies: 0,
    careerTitles: 0,
    careerBowls: 0,
    yearsCoaching: 0,
    age: 0,
    potential: 0,
    peakOffense: 0,
    peakDefense: 0,
    leadership: 0,
    development: 0,
    evaluation: 0,
    abilities: [],
    traits: [],
    firedCount: 0,
    tenure: {},
    // A coach already on a sideline in 1966 had a career before the record starts.
    ...(year <= HISTORY_FIRST ? { recordFrom: HISTORY_FIRST } : {}),
  };
  save.coaches[id] = c;
  return c;
}

/** Who's on the sideline after a club's first `played` games of the season. */
function coachAfter(list: { name: string; games: number }[], played: number): string | undefined {
  let n = 0;
  for (const c of list) {
    n += c.games;
    if (played < n) return c.name;
  }
  return list.at(-1)?.name;
}

/** Put the season's real head coaches on the sidelines (and note the new ones). */
export function seatCoaches(save: DynastySave): void {
  const y = save.year;
  const real = data().coaches(y);
  const hired: string[] = [];
  for (const c of Object.values(save.coaches)) c.teamId = null;
  for (const id of activeTeamIds(y)) {
    const t = save.teams[id];
    const list = real.get(id);
    if (!t || !list?.length) continue;
    const before = t.coachId;
    const c = coachFor(save, list[0]!.name, y);
    c.teamId = id;
    c.yearsOnJob = before === c.id ? c.yearsOnJob + 1 : 1;
    c.yearsCoaching += 1;
    for (const x of list) {
      const k = coachFor(save, x.name, y);
      k.tenure = { ...k.tenure, [id]: (k.tenure?.[id] ?? 0) + 2 };
    }
    t.coachId = c.id;
    if (before !== c.id && y > HISTORY_FIRST) hired.push(`${c.name} (${displayName(y, id)})`);
  }
  if (hired.length)
    addNews(save, {
      kind: "headline",
      headline: `New head coaches for ${y}`,
      body: hired.join(", ") + ".",
      teamIds: [],
      playerIds: [],
    });
}

/** A club's record so far this season. */
const playedBy = (save: DynastySave, id: TeamId) => {
  const t = save.teams[id]!;
  return t.wins + t.losses + t.ties;
};

/** Credit a real result to the coaches on each sideline, then make any midseason change. */
function creditCoaches(save: DynastySave, g: GameResult): void {
  for (const [id, us, them] of [
    [g.homeId, g.homeScore, g.awayScore],
    [g.awayId, g.awayScore, g.homeScore],
  ] as [TeamId, number, number][]) {
    const t = save.teams[id];
    const c = t?.coachId ? save.coaches[t.coachId] : undefined;
    if (!c) continue;
    if (us > them) c.careerWins += 1;
    else if (us < them) c.careerLosses += 1;
    else c.careerTies += 1;
  }
}

function midseasonChanges(save: DynastySave): void {
  const y = save.year;
  const real = data().coaches(y);
  for (const id of activeTeamIds(y)) {
    const t = save.teams[id];
    const list = real.get(id);
    if (!t || !list || list.length < 2) continue;
    const name = coachAfter(list, playedBy(save, id));
    if (!name || coachId(name) === t.coachId) continue;
    const out = t.coachId ? save.coaches[t.coachId] : undefined;
    const c = coachFor(save, name, y);
    if (out) {
      out.teamId = null;
      out.firedCount += 1;
    }
    c.teamId = id;
    c.yearsOnJob = 1;
    t.coachId = c.id;
    addNews(save, {
      kind: "headline",
      headline: `${displayName(y, id)}: ${c.name} takes over`,
      body: `${out ? `${out.name} is out after ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}. ` : ""}${c.name} will coach the rest of the season.`,
      teamIds: [id],
      playerIds: [],
    });
  }
}

/** The real trades that land before this week's games (week 0: the offseason's). */
function applyTrades(save: DynastySave, week: number, move: boolean): void {
  const y = save.year;
  for (const tr of data().trades(y)) {
    if (tr.week !== week) continue;
    const got = new Map<TeamId, string[]>();
    const players: string[] = [];
    for (const part of tr.parts) {
      let what = part.pick ? `a ${part.pick} pick${part.name ? ` (${part.name})` : ""}` : part.name ?? "";
      if (part.person !== undefined && !part.pick) {
        const p = playerFor(save, part.person, y, part.gave);
        what = `${playerName(p)} (${p.pos})`;
        players.push(p.id);
        if (move && p.teamId === part.gave) {
          const from = save.teams[part.gave];
          const to = save.teams[part.received];
          if (from) from.roster = from.roster.filter((x) => x !== p.id);
          if (to && !to.roster.includes(p.id)) to.roster.push(p.id);
          p.teamId = part.received;
        }
      }
      if (what) got.set(part.received, [...(got.get(part.received) ?? []), what]);
    }
    if (!players.length) continue;
    const sides = [...got.entries()].map(([id, list]) => `The ${displayName(y, id)} get ${list.join(", ")}.`);
    for (const pid of players) {
      const part = tr.parts.find((x) => x.person !== undefined && `r-${x.person.toString(36)}` === pid)!;
      addTx(save, "trade", pid, part.gave, part.received, sides.join(" "));
    }
    const lead = tr.parts.find((x) => x.person !== undefined && !x.pick)!;
    addNews(save, {
      kind: "headline",
      headline: `Trade: ${playerName(save.players[players[0]!]!)} to the ${displayName(y, lead.received)}`,
      body: sides.join(" "),
      teamIds: [...new Set(tr.parts.flatMap((x) => [x.gave, x.received]))],
      playerIds: players,
    });
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
  seatCoaches(save);
  // Offseason deals are already in the season's rosters; they go on the wire.
  applyTrades(save, 0, false);
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
  // Deals made since last week's games move the players before this week's.
  if (save.week > 1) applyTrades(save, save.week, true);
  const games = gamesInWeek(save, save.week);
  for (const g of games) {
    if (g.played) continue;
    if (g.realHome === undefined || g.realAway === undefined) continue;
    g.homeScore = g.realHome;
    g.awayScore = g.realAway;
    g.played = true;
    creditStandings(save, g, false);
    creditCoaches(save, g);
    ledgerGame(save, g);
    gradeCall(save, g.id, [g.homeScore > g.awayScore ? g.homeId : g.awayScore > g.homeScore ? g.awayId : "tie"]);
  }
  applyLiveLines(save);
  recordNews(save, data().records, save.week, personPlayer(save));
  midseasonChanges(save);
  if (save.week >= maxWeek(save)) {
    applyTrades(save, save.week + 1, false);
    closeRegularSeason(save);
    return;
  }
  save.week += 1;
}

/** The season's real stat lines go on the books once the regular season is over. */
function closeRegularSeason(save: DynastySave): void {
  const y = save.year;
  clearLiveLines(save);
  for (const { person, team, line } of data().stats(y)) {
    const p = playerFor(save, person, y, (team || "fa") as Player["teamId"]);
    const st: SeasonStats = { ...emptyStats(y, (team || p.teamId) as TeamId), ...(line as Partial<SeasonStats>) };
    // Tackles, forced fumbles, tackles for loss and passes defensed weren't kept before 1999,
    // and sacks (unofficial until 1982) aren't in the record before 1970.
    if (y < 1999) st.unknown = y < 1970 ? ["tackles", "ff", "tfl", "pd", "sacks"] : ["tackles", "ff", "tfl", "pd"];
    p.stats[y] = st;
  }
  save.phase = "playoffs";
  save.week = 1;
  recordNews(save, data().records, 99, personPlayer(save));
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
    date: g.mmdd,
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
    ledgerGame(save, game);
    const winner = game.homeScore > game.awayScore ? game.homeId : game.awayId;
    gradeCall(save, game.id, [winner]);
    if (round === "Super Bowl") gradeCall(save, `sb:${save.year}`, [winner]);
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
  if (a.mvp) gradeCall(save, `mvp:${y}`, [a.mvp, ...(co.mvp ?? [])]);
  const coy = real.coy?.find((x): x is string => typeof x === "string");
  if (coy) {
    a.coyName = coy;
    const c = save.coaches[coachId(coy)];
    if (c) {
      a.coy = c.id;
      c.coyYears = [...(c.coyYears ?? []), y];
    }
  }
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
      const c = save.coaches[coachId(x)];
      const home = c && Object.entries(c.tenure ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (c && home) {
        c.hofYear = classYear;
        save.history.hof.push({ coachId: c.id, year: classYear, teamId: home as TeamId, blurb: `Class of ${classYear}.`, kind: "coach" });
      } else save.history.hof.push({ name: x, year: classYear, teamId: "pit", blurb: `Class of ${classYear}.`, kind: "contributor" });
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

/** The save's player for a real person, if he's in it. */
const personPlayer = (save: DynastySave) => (person: number) => save.players[pid(person)];

/** Running season lines out: the official ones are going on the books. */
function clearLiveLines(save: DynastySave): void {
  const y = save.year;
  for (const p of Object.values(save.players)) if (p.stats[y]?.live) delete p.stats[y];
}

const LIVE_FIELD: Record<string, keyof SeasonStats> = {
  pa: "passAtt",
  pc: "passCmp",
  py: "passYds",
  pt: "passTd",
  pi: "passInt",
  sk: "sacksThrown",
  ra: "rushAtt",
  ry: "rushYds",
  rt: "rushTd",
  re: "rec",
  ey: "recYds",
  et: "recTd",
  tg: "targets",
  in: "ints",
  sa: "sacks",
  pn: "punts",
  pny: "puntYds",
  pry: "prYds",
  kry: "krYds",
  prt: "prTd",
  krt: "krTd",
  tk: "tackles",
  tl: "tfl",
  pd: "pd",
  qh: "qbHits",
  ff: "ff",
  fr: "fr",
  fm: "fgMade",
  fa: "fgAtt",
  xm: "xpMade",
  xa: "xpAtt",
};

/**
 * This season's running stat lines, summed from the real box scores of the games played so
 * far (when the season's box scores are loaded). The official season line replaces them when
 * the regular season closes. Only players already on a roster get a line, so this never
 * changes who's in the league.
 */
export function applyLiveLines(save: DynastySave): void {
  const y = save.year;
  if (save.phase !== "regular" || !boxSeason(y)) return;
  clearLiveLines(save);
  const unknown = ["fgAtt", "fgMade", "xpAtt", "xpMade", ...(y < 1999 ? ["tackles", "ff", "tfl", "pd"] : []), ...(y < 1970 ? ["sacks"] : [])];
  const lineFor = (id: string | undefined, team: TeamId): SeasonStats | undefined => {
    const p = id ? save.players[id] : undefined;
    if (!p || (p.stats[y] && !p.stats[y]!.live)) return undefined;
    return (p.stats[y] ??= { ...emptyStats(y, team), live: true, unknown });
  };
  for (const g of save.schedule) {
    if (g.year !== y || g.phase !== "regular" || !g.played) continue;
    const box = boxFor(g);
    if (!box) continue;
    const sides: TeamId[] = [box.a, box.h];
    const seen = new Set<string>();
    for (const [side, who, ln] of box.p) {
      const id = boxPlayerId(who);
      const st = lineFor(id, sides[side]!);
      if (!st) continue;
      if (!seen.has(id!)) {
        seen.add(id!);
        st.gp += 1;
      }
      for (const [k, v] of Object.entries(ln)) {
        const f = LIVE_FIELD[k];
        if (f) (st[f] as number) += v;
      }
    }
    box.l?.forEach((list, side) => {
      for (const [, who] of list) {
        const id = boxPlayerId(who);
        if (!id || seen.has(id)) continue;
        const st = lineFor(id, sides[side]!);
        if (!st) continue;
        seen.add(id);
        st.gp += 1;
      }
    });
  }
}

/** The all-time record book as of this point in the record. */
export function historyRecords(save: DynastySave): RecordHolder[] {
  return DATA ? recordBookNow(save, data().records, personPlayer(save)) : [];
}

/**
 * The games the next step plays, for calling them first: this week's slate, or the next
 * playoff round (its matchups are already set by then).
 */
export function upcomingHistoryGames(save: DynastySave): GameResult[] {
  if (!DATA) return [];
  if (save.phase === "regular") return gamesInWeek(save, save.week).filter((g) => !g.played && g.realHome !== undefined);
  if (save.phase !== "playoffs") return [];
  const round = nextRound(save);
  if (!round) return [];
  const week = new Set(save.playoffGames.map((g) => g.round)).size + 1;
  return data()
    .playoffs(save.year)
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.round === round)
    .map(({ g, i }) => ({ ...gameFor(save, g, i, week), homeScore: 0, awayScore: 0, played: false }));
}
