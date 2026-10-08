/**
 * History mode's extras: the real box score of every game, the all-time record book as it
 * really changed, every franchise's ledger and every series back to 1920, the clubs and
 * players the viewer follows, and the viewer's calls made before the results. History mode
 * only (the regular game never reads any of this). No React.
 */
import type { DynastySave, GameResult, HeadToHead, Player, TeamId } from "./types.ts";
import { addNews } from "./news.ts";
import { displayName } from "./teams.ts";
import { h2hKey } from "./h2h.ts";

/* ---------------- box scores ---------------- */

/** One player's line in one game; keys as the ingest writes them (see scripts/ingest-boxscores.py). */
export type BoxLine = Record<string, number>;

export interface BoxGame {
  /** MMDD. */
  d: string;
  a: TeamId;
  h: TeamId;
  /** Neutral site. */
  n?: 1;
  /** Venue, city, attendance, weather. */
  v?: string;
  c?: string;
  at?: number;
  w?: string;
  /** Points by quarter (overtime after the fourth), away then home. */
  q: [number[], number[]];
  /** Final score, away then home. */
  f: [number, number];
  /** Scoring plays: quarter (5 = overtime), side (0 away, 1 home), the play, then the score after it (away, home). */
  s: [number, 0 | 1, string, number?, number?][];
  /** Starting lineups: position, then "#id" (a player in the save) or a name. */
  l?: [[string, string][], [string, string][]];
  /** Team stats, away then home. */
  t: [Record<string, number | string>, Record<string, number | string>];
  /** Player lines: side, "#id" or a name, the line. */
  p: [0 | 1, string, BoxLine][];
}

const BOXES = new Map<number, BoxGame[]>();
const LOADING = new Map<number, Promise<BoxGame[] | undefined>>();

/** Load (once) a season's box scores. Undefined when the record has none for that season. */
export function loadBoxSeason(year: number): Promise<BoxGame[] | undefined> {
  const have = BOXES.get(year);
  if (have) return Promise.resolve(have);
  let p = LOADING.get(year);
  if (!p) {
    p = import(`./data/history/box/${year}.ts`)
      .then((m: { BOX: string }) => {
        const games = JSON.parse(m.BOX) as BoxGame[];
        BOXES.set(year, games);
        return games;
      })
      .catch(() => undefined);
    LOADING.set(year, p);
  }
  return p;
}

/** A season's box scores if they're loaded. */
export function boxSeason(year: number): BoxGame[] | undefined {
  return BOXES.get(year);
}

/** For tests: hand the engine a season's box scores directly. */
export function setBoxSeason(year: number, games: BoxGame[]): void {
  BOXES.set(year, games);
}

const dayOf = (mmdd: string) => {
  const m = Number(mmdd.slice(0, 2));
  return (m < 7 ? m + 12 : m) * 31 + Number(mmdd.slice(2));
};

/** The real box score for a game, when the season's are loaded. */
export function boxFor(g: Pick<GameResult, "year" | "homeId" | "awayId" | "date">): BoxGame | undefined {
  const list = BOXES.get(g.year);
  if (!list) return undefined;
  const same = list.filter((b) => (b.h === g.homeId && b.a === g.awayId) || (b.h === g.awayId && b.a === g.homeId));
  if (same.length <= 1 || !g.date) return same[0];
  const want = dayOf(g.date);
  return same.slice().sort((x, y) => Math.abs(dayOf(x.d) - want) - Math.abs(dayOf(y.d) - want))[0];
}

/** "#id" -> the save's player id. */
export const boxPlayerId = (who: string): string | undefined => (who.startsWith("#") ? `r-${who.slice(1)}` : undefined);

/* ---------------- the record book ---------------- */

export const RECORD_LABEL: Record<string, string> = {
  passYds: "passing yards",
  passTd: "touchdown passes",
  rushYds: "rushing yards",
  rushTd: "rushing touchdowns",
  rec: "catches",
  recYds: "receiving yards",
  recTd: "touchdown catches",
  ints: "interceptions",
  sacks: "sacks",
};

export interface RecordMoment {
  year: number;
  /** 99 = season's end. */
  week: number;
  stat: string;
  /** s / c: a single-season / career record fell; S / C: the official numbers settle it at season's end. */
  scope: "s" | "c" | "S" | "C";
  person: number;
  value: number;
  prevHolder: string;
  prevValue: number;
  prevYear: number;
}

export interface RecordTables {
  moments: RecordMoment[];
  /** "stat:s" / "stat:c" -> holder, value, year, as the 1966 season opened. */
  start: Record<string, [string, number, number]>;
}

export function parseRecordMoments(raw: string, start: Record<string, [string, number, number]>): RecordTables {
  const moments = raw
    .split("|")
    .filter(Boolean)
    .map((r): RecordMoment => {
      const [y, wk, stat, scope, person, v, ph, pv, py] = r.split(",");
      return {
        year: Number(y),
        week: Number(wk),
        stat: stat!,
        scope: scope as RecordMoment["scope"],
        person: parseInt(person!, 16),
        value: Number(v),
        prevHolder: ph ?? "",
        prevValue: Number(pv),
        prevYear: Number(py),
      };
    });
  return { moments, start };
}

const fmt = (v: number) => (v % 1 ? String(v) : v.toLocaleString("en-US"));

/** Is this moment already on the calendar? (Regular season: weeks before `save.week`; 99 once it's over.) */
function reached(save: DynastySave, m: RecordMoment): boolean {
  if (m.year !== save.year) return m.year < save.year;
  if (save.phase === "draft" || save.phase === "preseason") return false;
  if (save.phase === "regular") return m.week < save.week;
  return true;
}

/** News for the records that fell in this week's real games (week 99: the season just closed). */
export function recordNews(save: DynastySave, tables: RecordTables, week: number, nameOf: (person: number) => Player | undefined): void {
  for (const m of tables.moments) {
    if (m.year !== save.year || m.week !== week || (m.scope !== "s" && m.scope !== "c")) continue;
    const p = nameOf(m.person);
    if (!p) continue;
    const who = `${p.firstName} ${p.lastName}`;
    const label = RECORD_LABEL[m.stat] ?? m.stat;
    const team = p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? [p.teamId as TeamId] : [];
    const going = week === 99 ? "" : " and counting";
    addNews(save, {
      kind: "award",
      headline:
        m.scope === "s"
          ? `Record: ${who} has the most ${label} ever in a season`
          : `Record: ${who} passes ${m.prevHolder} for the most career ${label}`,
      body:
        m.scope === "s"
          ? `${fmt(m.value)}${going}, past ${m.prevHolder}'s ${fmt(m.prevValue)} (${m.prevYear}).`
          : `${fmt(m.value)}${going}. ${m.prevHolder} had held the record with ${fmt(m.prevValue)}.`,
      teamIds: team,
      playerIds: [p.id],
    });
  }
}

export interface RecordHolder {
  stat: string;
  label: string;
  scope: "season" | "career";
  holder: string;
  playerId?: string;
  value: number;
  year?: number;
  /** When it last changed hands (the year it fell). */
  since?: number;
}

/** The all-time record book as of this point in the calendar. */
export function recordBookNow(save: DynastySave, tables: RecordTables, nameOf: (person: number) => Player | undefined): RecordHolder[] {
  const out = new Map<string, RecordHolder>();
  for (const [key, [holder, value, year]] of Object.entries(tables.start)) {
    const [stat, s] = key.split(":") as [string, string];
    out.set(key, { stat, label: RECORD_LABEL[stat] ?? stat, scope: s === "s" ? "season" : "career", holder, value, year: year || undefined });
  }
  for (const m of tables.moments) {
    if (!reached(save, m)) continue;
    const s = m.scope.toLowerCase() as "s" | "c";
    const key = `${m.stat}:${s}`;
    const p = nameOf(m.person);
    const prev = out.get(key);
    const changed = !prev || prev.playerId !== p?.id;
    out.set(key, {
      stat: m.stat,
      label: RECORD_LABEL[m.stat] ?? m.stat,
      scope: s === "s" ? "season" : "career",
      holder: p ? `${p.firstName} ${p.lastName}` : (prev?.holder ?? ""),
      playerId: p?.id,
      value: m.value,
      year: s === "s" ? m.year : undefined,
      since: changed ? m.year : prev?.since,
    });
  }
  const order = Object.keys(RECORD_LABEL);
  return [...out.values()].sort((a, b) => order.indexOf(a.stat) - order.indexOf(b.stat) || (a.scope === "season" ? -1 : 1));
}

/* ---------------- franchise ledgers and series ---------------- */

export type Ledger = [number, number, number, number, number, number[]];

/** Start the ledgers where the record before 1966 leaves them. */
export function seedLedgers(
  save: DynastySave,
  franchise: Record<string, Ledger>,
  series: Record<string, [number, number, number, number, string, string, number]>,
): void {
  save.historyLedger = {};
  for (const id of Object.keys(save.teams)) {
    const f = franchise[id];
    save.historyLedger[id] = f ? [f[0], f[1], f[2], f[3], f[4], f[5].slice()] : [0, 0, 0, 0, 0, []];
  }
  save.h2h = {};
  for (const [k, [aw, bw, ties, year, winner, score, playoff]] of Object.entries(series)) {
    const [a, b] = k.split("|") as [TeamId, TeamId];
    save.h2h[k] = {
      a,
      b,
      aWins: aw,
      bWins: bw,
      ties,
      last: { year, label: playoff ? "Playoffs" : "Regular season", winner: (winner || undefined) as TeamId | undefined, score, playoff: !!playoff },
    };
  }
}

/** A real result into the ledgers and the series. */
export function ledgerGame(save: DynastySave, g: GameResult): void {
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const L = save.historyLedger;
  if (!L) return;
  const playoff = g.phase !== "regular";
  for (const [id, us, them] of [
    [home, g.homeScore, g.awayScore],
    [away, g.awayScore, g.homeScore],
  ] as [TeamId, number, number][]) {
    const r = (L[id] ??= [0, 0, 0, 0, 0, []]);
    if (playoff) r[us > them ? 3 : 4] += 1;
    else r[us > them ? 0 : us < them ? 1 : 2] += 1;
  }
  // A league title: the NFL and AFL championships through 1969, the Super Bowl after.
  const winner = g.homeScore > g.awayScore ? home : g.awayScore > g.homeScore ? away : undefined;
  const title = g.year <= 1969 ? /^(NFL|AFL) Championship$/.test(g.round ?? "") : g.round === "Super Bowl";
  if (title && winner && !L[winner]![5].includes(g.year)) L[winner]![5].push(g.year);
  save.h2h ??= {};
  const k = h2hKey(home, away);
  const [a, b] = k.split("|") as [TeamId, TeamId];
  const r: HeadToHead = (save.h2h[k] ??= { a, b, aWins: 0, bWins: 0, ties: 0 });
  if (!winner) r.ties += 1;
  else if (winner === a) r.aWins += 1;
  else r.bWins += 1;
  const hi = Math.max(g.homeScore, g.awayScore);
  const lo = Math.min(g.homeScore, g.awayScore);
  const label = g.round ?? `Week ${g.week}`;
  r.last = { year: g.year, label, winner, score: `${hi}-${lo}`, playoff };
  if (playoff && winner) r.lastPlayoff = { year: g.year, label, winner, score: `${hi}-${lo}` };
}

export interface FranchiseLedger {
  wins: number;
  losses: number;
  ties: number;
  playoffWins: number;
  playoffLosses: number;
  titles: number[];
}

export function franchiseLedger(save: DynastySave, id: TeamId): FranchiseLedger | undefined {
  const r = save.historyLedger?.[id];
  if (!r) return undefined;
  return { wins: r[0], losses: r[1], ties: r[2], playoffWins: r[3], playoffLosses: r[4], titles: r[5].slice().sort((a, b) => a - b) };
}

export interface SeriesRow {
  them: TeamId;
  wins: number;
  losses: number;
  ties: number;
  last?: HeadToHead["last"];
  lastPlayoff?: HeadToHead["lastPlayoff"];
}

/** A club's series with every club it has played, most games first. */
export function seriesOf(save: DynastySave, id: TeamId): SeriesRow[] {
  const out: SeriesRow[] = [];
  for (const r of Object.values(save.h2h ?? {})) {
    if (r.a !== id && r.b !== id) continue;
    const us = r.a === id;
    out.push({ them: us ? r.b : r.a, wins: us ? r.aWins : r.bWins, losses: us ? r.bWins : r.aWins, ties: r.ties, last: r.last, lastPlayoff: r.lastPlayoff });
  }
  return out.sort((x, y) => y.wins + y.losses + y.ties - (x.wins + x.losses + x.ties));
}

export function seriesBetween(save: DynastySave, a: TeamId, b: TeamId): SeriesRow | undefined {
  return seriesOf(save, a).find((r) => r.them === b);
}

/* ---------------- following ---------------- */

export function follows(save: DynastySave): { teams: TeamId[]; players: string[] } {
  return save.historyFollow ?? { teams: [], players: [] };
}

export function isFollowed(save: DynastySave, what: { teamId?: TeamId; playerId?: string }): boolean {
  const f = follows(save);
  return (!!what.teamId && f.teams.includes(what.teamId)) || (!!what.playerId && f.players.includes(what.playerId));
}

export function toggleFollow(save: DynastySave, what: { teamId?: TeamId; playerId?: string }): void {
  const f = follows(save);
  const teams = what.teamId ? (f.teams.includes(what.teamId) ? f.teams.filter((t) => t !== what.teamId) : [...f.teams, what.teamId]) : f.teams;
  const players = what.playerId ? (f.players.includes(what.playerId) ? f.players.filter((p) => p !== what.playerId) : [...f.players, what.playerId]) : f.players;
  save.historyFollow = { teams, players };
}

/** Does this news item touch who the viewer follows? */
export function followedNews(save: DynastySave, n: { teamIds: TeamId[]; playerIds: string[] }): boolean {
  const f = follows(save);
  return n.teamIds.some((t) => f.teams.includes(t)) || n.playerIds.some((p) => f.players.includes(p));
}

/* ---------------- calling it ---------------- */

export interface CallsReport {
  made: number;
  right: number;
  points: number;
  streak: number;
  best: number;
  byDecade: { decade: number; made: number; right: number }[];
}

/** Points a correct call earns. */
export function callPoints(id: string): number {
  if (id.startsWith("sb:") || id.startsWith("mvp:")) return 10;
  if (/-hp-/.test(id)) return 2;
  return 1;
}

/** Grade a call once its result is in (kept on the save as `historyGraded`, rebuilt on replay). */
export function gradeCall(save: DynastySave, id: string, correct: string[]): void {
  const pick = save.historyCalls?.[id];
  if (!pick) return;
  const done = (save.historyGraded ??= {});
  if (done[id]) return;
  done[id] = [save.year, correct.includes(pick) ? 1 : 0];
}

export function graded(save: DynastySave): Record<string, [number, 0 | 1]> {
  return save.historyGraded ?? {};
}

export function callsReport(save: DynastySave): CallsReport {
  const g = graded(save);
  let made = 0;
  let right = 0;
  let points = 0;
  let streak = 0;
  let best = 0;
  const dec = new Map<number, { made: number; right: number }>();
  // In the order they were graded (insertion order follows the calendar).
  for (const [id, [year, ok]] of Object.entries(g)) {
    made += 1;
    const d = Math.floor(year / 10) * 10;
    const row = dec.get(d) ?? { made: 0, right: 0 };
    row.made += 1;
    if (ok) {
      right += 1;
      row.right += 1;
      points += callPoints(id);
      streak += 1;
      best = Math.max(best, streak);
    } else streak = 0;
    dec.set(d, row);
  }
  return { made, right, points, streak, best, byDecade: [...dec.entries()].sort((a, b) => a[0] - b[0]).map(([decade, r]) => ({ decade, ...r })) };
}

/** A letter for how well the viewer knows a decade (picking at random is about 50%). */
export function historyGrade(right: number, made: number): string {
  if (made < 10) return "—";
  const pct = right / made;
  return pct >= 0.8 ? "A+" : pct >= 0.72 ? "A" : pct >= 0.66 ? "B" : pct >= 0.6 ? "C" : pct >= 0.54 ? "D" : "F";
}

export const clubLabel = (year: number, id: TeamId) => displayName(year, id);
