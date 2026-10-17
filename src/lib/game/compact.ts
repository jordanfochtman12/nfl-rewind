/** Strip film we don't need so a 60-year file still loads. */
import type { DynastySave, GameResult, Player, SeasonStats } from "./types.ts";
import { archiveTransactions, liveTransactions } from "./transactions.ts";

const FILM_PHASES = new Set(["regular", "deadline", "playoffs", "superBowl", "proBowl"]);

/** This season's film is kept while the season is live; everything older is scores only. */
function keepsFilm(save: DynastySave, g: GameResult): boolean {
  return FILM_PHASES.has(save.phase) && g.year === save.year;
}

function stripGame(g: GameResult): void {
  g.boxHome = undefined;
  g.boxAway = undefined;
  g.drives = undefined;
  g.highlights = undefined;
  g.log = undefined;
}

function strippedCopy(save: DynastySave, g: GameResult): GameResult {
  if (keepsFilm(save, g) || (!g.boxHome && !g.boxAway && !g.drives && !g.highlights && !g.log)) return g;
  return { ...g, boxHome: undefined, boxAway: undefined, drives: undefined, highlights: undefined, log: undefined };
}

// News, the weekly wire and the transaction log are all newest-first (addNews/addTx unshift),
// so trimming keeps the head. (It used to keep the tail - the oldest entries - so every reload
// or export swapped the latest headlines for stale ones.)
const NEWS_KEEP = 80;
const WEEK_NEWS_KEEP = 16;
const TX_KEEP = 160;

/** Drop box scores / drives from prior seasons. Scores, sites, and history stay. Mutates. */
export function compactSaveInPlace(save: DynastySave): void {
  // Finished games are shared between save copies (see cloneSave), so a game that loses its
  // film is replaced with a stripped copy rather than edited.
  save.schedule = save.schedule.map((g) => strippedCopy(save, g));
  save.playoffGames = save.playoffGames.map((g) => strippedCopy(save, g));
  for (const g of [save.superBowl, save.proBowl]) {
    if (g && !keepsFilm(save, g)) stripGame(g);
  }
  if (save.news.length > NEWS_KEEP) save.news = save.news.slice(0, NEWS_KEEP);
  if (save.weekNews.length > WEEK_NEWS_KEEP) save.weekNews = save.weekNews.slice(0, WEEK_NEWS_KEEP);
  archiveTransactions(save);
  save.transactions = liveTransactions(save, TX_KEEP);
}

/*
 * Player packing, for disk only. Lossless: unpackPlayers() gives back the same players.
 * By the 2000s a timeline carries ~15k players (mostly retired), and their season lines are
 * three-quarters zeros, each written out with all ~35 keys; career[] repeats every simulated
 * season already in stats; ratings spell out 25 key names per player. Packed: zero stat
 * fields are left out (the save records which keys to put back), a career row identical to
 * that year's stats line is stored as just the year, and ratings are a plain array.
 */
type Packed = {
  v: 1;
  /** Record players' real seasons before this year were left out (see restoreRecordLines). */
  rl?: number;
  rk: string[];
  sk: string[];
  /** `players` is a column table (see toTable), and so are retirements and each club's picks. */
  pt?: boolean;
  rt?: boolean;
  kt?: boolean;
};

/**
 * Rows of objects as a column table: the key names once, then one array of values per row.
 * A key a row doesn't have is written as null, so a list that holds a real null anywhere is
 * left alone (returns undefined) and the round trip stays exact.
 */
type Table = { c: string[]; r: unknown[][] };
function toTable(rows: object[]): Table | undefined {
  const cols: string[] = [];
  const at = new Map<string, number>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (v === null) return undefined;
      if (!at.has(k)) {
        at.set(k, cols.length);
        cols.push(k);
      }
    }
  }
  const r = rows.map((row) => {
    const a: unknown[] = new Array(cols.length).fill(null);
    for (const [k, v] of Object.entries(row)) if (v !== undefined) a[at.get(k)!] = v;
    return a;
  });
  return { c: cols, r };
}
function fromTable<T>(t: Table): T[] {
  return t.r.map((a) => {
    const o: Record<string, unknown> = {};
    t.c.forEach((k, i) => {
      if (a[i] !== null) o[k] = a[i];
    });
    return o as T;
  });
}
const isTable = (v: unknown): v is Table => !!v && typeof v === "object" && Array.isArray((v as Table).c) && Array.isArray((v as Table).r);

/**
 * A full season line (every stat key present) loses its zero fields; unpacking puts each one
 * back as 0. A line missing some keys (from an old save or a hand-built one) is kept whole and
 * marked, so unpacking leaves it exactly as it was.
 */
const AS_IS = "~";
// A season's grade is only on the seasons that have one; it rides along, never decides a full line.
const OPTIONAL = new Set(["ovr"]);
function numericKeys(s: SeasonStats, into: Set<string>): void {
  for (const [k, v] of Object.entries(s)) if (typeof v === "number" && !OPTIONAL.has(k)) into.add(k);
}
function stripZeros(s: SeasonStats, keys: Set<string>): SeasonStats {
  const row = s as unknown as Record<string, unknown>;
  for (const k of keys) {
    if (typeof row[k] !== "number") return { ...s, [AS_IS]: 1 } as unknown as SeasonStats;
  }
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (v === 0 && keys.has(k)) continue;
    o[k] = v;
  }
  return o as unknown as SeasonStats;
}

function sameLine(a: SeasonStats, b: SeasonStats | undefined): boolean {
  if (!b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if ((a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return false;
  return true;
}

function packPlayers(players: Record<string, Player>, recordBefore?: number): { players: Record<string, Player>; packed: Packed } {
  const rk: string[] = [];
  // Every numeric stat key in use, so a full line can be told from a partial one.
  const sk = new Set<string>();
  for (const p of Object.values(players)) {
    for (const line of Object.values(p.stats ?? {})) numericKeys(line, sk);
    for (const line of Object.values(p.playoffStats ?? {})) numericKeys(line, sk);
    for (const line of p.career ?? []) numericKeys(line, sk);
  }
  const out: Record<string, Player> = {};
  for (const [id, p] of Object.entries(players)) {
    const q: Record<string, unknown> = { ...p };
    if (p.ratings) {
      if (!rk.length) rk.push(...Object.keys(p.ratings));
      const r = p.ratings as unknown as Record<string, number>;
      // Only pack ratings that carry exactly the shared keys; anything else stays an object.
      if (Object.keys(r).length === rk.length && rk.every((k) => typeof r[k] === "number")) {
        q.ratings = rk.map((k) => r[k]);
      }
    }
    if (p.career?.length) {
      q.career = p.career.map((c) => (sameLine(c, p.stats?.[c.year]) ? c.year : stripZeros(c, sk)));
    }
    if (p.stats) {
      const st: Record<string, SeasonStats> = {};
      // A record player's real seasons before the league began are rebuilt from the record on load.
      const fromRecord = recordBefore !== undefined && id.startsWith("r-");
      for (const [y, line] of Object.entries(p.stats)) if (!(fromRecord && Number(y) < recordBefore)) st[y] = stripZeros(line, sk);
      q.stats = st;
    }
    if (p.playoffStats) {
      const st: Record<string, SeasonStats> = {};
      for (const [y, line] of Object.entries(p.playoffStats)) st[y] = stripZeros(line, sk);
      q.playoffStats = st;
    }
    out[id] = q as unknown as Player;
  }
  return { players: out, packed: { v: 1, rk, sk: [...sk] } };
}

/** The disk layout of a save: packed players, then column tables for the long lists. */
function packSave(save: DynastySave): Record<string, unknown> {
  const recordBefore = save.realPool && !save.recordLinesBefore ? save.startingYear : undefined;
  const { players, packed } = packPlayers(save.players, recordBefore);
  if (recordBefore !== undefined) packed.rl = recordBefore;
  const extra: Record<string, unknown> = {};
  const pt = toTable(Object.values(players));
  if (pt) {
    extra.players = pt;
    packed.pt = true;
  } else extra.players = players;
  const rt = toTable(save.history.retirements);
  if (rt) {
    extra.history = { ...save.history, retirements: rt };
    packed.rt = true;
  }
  const teams: Record<string, unknown> = {};
  let kt = true;
  for (const [id, t] of Object.entries(save.teams)) {
    const tab = toTable(t.picks ?? []);
    if (!tab) kt = false;
    teams[id] = { ...t, picks: tab };
  }
  if (kt) {
    extra.teams = teams;
    packed.kt = true;
  }
  extra.packed = packed;
  return extra;
}

/** Undo packPlayers in place. A save that was never packed passes through untouched. */
export function unpackPlayers(raw: { players?: unknown; packed?: Packed }): void {
  const pk = raw.packed;
  if (!pk || !raw.players) return;
  const r = raw as Record<string, unknown> & { players: Record<string, unknown> };
  if (pk.rl) r.recordLinesBefore = pk.rl;
  if (pk.pt && isTable(r.players)) {
    const list = fromTable<Record<string, unknown>>(r.players);
    r.players = Object.fromEntries(list.map((p) => [p.id as string, p]));
  }
  const hist = r.history as Record<string, unknown> | undefined;
  if (pk.rt && hist && isTable(hist.retirements)) hist.retirements = fromTable(hist.retirements);
  if (pk.kt && r.teams && typeof r.teams === "object") {
    for (const t of Object.values(r.teams as Record<string, Record<string, unknown>>)) {
      if (isTable(t.picks)) t.picks = fromTable(t.picks);
    }
  }
  const fill = (line: Record<string, unknown>) => {
    if (line[AS_IS]) delete line[AS_IS];
    else for (const k of pk.sk) if (line[k] === undefined) line[k] = 0;
    return line as unknown as SeasonStats;
  };
  for (const p of Object.values(r.players) as Record<string, unknown>[]) {
    if (Array.isArray(p.ratings)) {
      const r: Record<string, number> = {};
      pk.rk.forEach((k, i) => (r[k] = (p.ratings as number[])[i]!));
      p.ratings = r;
    }
    const stats = p.stats as Record<string, Record<string, unknown>> | undefined;
    if (stats) for (const line of Object.values(stats)) fill(line);
    const po = p.playoffStats as Record<string, Record<string, unknown>> | undefined;
    if (po) for (const line of Object.values(po)) fill(line);
    if (Array.isArray(p.career)) {
      p.career = (p.career as (number | Record<string, unknown>)[]).map((c) =>
        typeof c === "number" ? ({ ...stats?.[c] } as unknown as SeasonStats) : fill(c),
      );
    }
  }
  delete raw.packed;
}

/**
 * The compacted view of a save, for writing to disk or exporting. Shallow: it shares
 * everything it doesn't trim with the live save, so it must only be serialized, never mutated.
 * (Deep-cloning a late dynasty - 20k players - just to drop old box scores cost most of a second
 * on every autosave.)
 */
export function compactSave(save: DynastySave): DynastySave {
  return {
    ...save,
    ...(packSave(save) as Partial<DynastySave>),
    schedule: save.schedule.map((g) => strippedCopy(save, g)),
    playoffGames: save.playoffGames.map((g) => strippedCopy(save, g)),
    superBowl: save.superBowl && strippedCopy(save, save.superBowl),
    proBowl: save.proBowl && strippedCopy(save, save.proBowl),
    news: save.news.slice(0, NEWS_KEEP),
    weekNews: save.weekNews.slice(0, WEEK_NEWS_KEEP),
    transactions: liveTransactions(save, TX_KEEP),
  };
}

export function saveByteLength(save: DynastySave): number {
  try {
    return new Blob([JSON.stringify(compactSave(save))]).size;
  } catch {
    return JSON.stringify(save).length;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
