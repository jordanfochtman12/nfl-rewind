/**
 * The league's transaction wire: every move this season, and the notable ones of seasons past
 * (kept in save.txArchive when the live log is trimmed each winter), with the coaching
 * carousel's hires and firings alongside. No React.
 */
import type { CarouselMove, DynastySave, TeamId, Transaction, TxKind } from "./types.ts";

/** Past seasons the wire keeps, and how many moves each. */
const ARCHIVE_SEASONS = 25;
const ARCHIVE_PER_SEASON = 120;

export type WireKind = "trade" | "sign" | "release" | "draft" | "injury" | "coaching" | "other";

export interface WireRow {
  id: string;
  year: number;
  week: number;
  kind: WireKind;
  /** The club the move is for (the signing club, the club releasing him, the club hiring). */
  teamId?: TeamId;
  /** The other club in a trade or a claim. */
  otherId?: TeamId;
  playerId?: string;
  text: string;
}

const KIND: Record<TxKind, WireKind> = {
  trade: "trade",
  claim: "trade",
  sign: "sign",
  cut: "release",
  waive: "release",
  draft: "draft",
  ir: "injury",
  activate: "injury",
  expansion: "other",
  retire: "other",
};

const isClub = (save: DynastySave, id: string): id is TeamId => !!save.teams[id as TeamId];

/** Worth keeping once the season is over: every trade, and the moves of players who mattered. */
function notable(save: DynastySave, t: Transaction): number {
  if (t.kind === "trade" || t.kind === "claim" || t.kind === "expansion") return 1000;
  const p = save.players[t.playerId];
  const grade = p ? Math.max(p.ovr, p.peakOvr ?? 0) : 0;
  if (t.kind === "draft") return /^Round [12]\b/.test(t.detail) ? 500 + grade : 0;
  if (t.kind === "sign" || t.kind === "cut" || t.kind === "waive") return grade >= 72 ? grade : 0;
  return 0;
}

/**
 * Before the live log is trimmed, each finished season's notable moves go to the archive (once).
 * Mutates.
 */
export function archiveTransactions(save: DynastySave): void {
  const byYear = new Map<number, Transaction[]>();
  for (const t of save.transactions) {
    if (t.year >= save.year || save.txArchive?.[t.year]) continue;
    if (!byYear.has(t.year)) byYear.set(t.year, []);
    byYear.get(t.year)!.push(t);
  }
  if (!byYear.size) return;
  save.txArchive ??= {};
  for (const [y, list] of byYear) {
    const kept = list
      .map((t) => ({ t, score: notable(save, t) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, ARCHIVE_PER_SEASON)
      .map((x) => x.t);
    save.txArchive[y] = kept;
  }
  const years = Object.keys(save.txArchive).map(Number).sort((a, b) => b - a);
  for (const y of years.slice(ARCHIVE_SEASONS)) delete save.txArchive[y];
}

/** The live log a save keeps on disk: this season's moves in full, then the most recent of the rest. */
export function liveTransactions(save: DynastySave, older: number): Transaction[] {
  const now = save.transactions.filter((t) => t.year >= save.year);
  return [...now, ...save.transactions.filter((t) => t.year < save.year).slice(0, older)];
}

/** Seasons the wire can show, newest first. */
export function wireSeasons(save: DynastySave): number[] {
  const ys = new Set<number>([save.year]);
  for (const t of save.transactions) ys.add(t.year);
  for (const y of Object.keys(save.txArchive ?? {})) ys.add(Number(y));
  for (const m of save.carousel ?? []) ys.add(m.year);
  return [...ys].sort((a, b) => b - a);
}

function coachingRow(m: CarouselMove, i: number): WireRow {
  return { id: `cc-${m.year}-${m.teamId}-${i}`, year: m.year, week: 0, kind: "coaching", teamId: m.teamId, text: m.note };
}

/**
 * One season's wire, newest first. The current season reads the live log in full; a past one
 * reads it while it's still there, else the archive's notable moves.
 */
export function transactionWire(save: DynastySave, year: number): WireRow[] {
  const live = save.transactions.filter((t) => t.year === year);
  const source = live.length && (year >= save.year || !save.txArchive?.[year]) ? live : (save.txArchive?.[year] ?? live);
  const seen = new Set<string>();
  const rows: WireRow[] = [];
  for (const t of source) {
    // A trade is logged once per side by some paths: one row per deal.
    const key = `${t.kind}|${t.week}|${t.detail}`;
    if (t.kind === "trade" && seen.has(key)) continue;
    seen.add(key);
    const kind = KIND[t.kind] ?? "other";
    const releasing = t.kind === "cut" || t.kind === "waive";
    const club = releasing ? t.from : t.to;
    const other = t.kind === "trade" || t.kind === "claim" ? (releasing ? t.to : t.from) : undefined;
    rows.push({
      id: t.id,
      year: t.year,
      week: t.week,
      kind,
      teamId: isClub(save, club) ? club : undefined,
      otherId: other && isClub(save, other) ? other : undefined,
      playerId: save.players[t.playerId] ? t.playerId : undefined,
      text: t.detail,
    });
  }
  // The log is newest first; the carousel is in the order it happened.
  const coaching = (save.carousel ?? []).map((m, i) => ({ m, i })).filter(({ m }) => m.year === year);
  for (const { m, i } of coaching.reverse()) rows.push(coachingRow(m, i));
  return rows;
}

/** Where in the year a move came: the offseason, a week of the season, the playoffs. */
export function wireWhen(row: WireRow, regularWeeks: number): string {
  if (row.kind === "coaching") return "Coaching carousel";
  if (row.week <= 0) return row.kind === "draft" ? "Draft" : "Offseason";
  if (row.week > regularWeeks) return "Postseason";
  return `Week ${row.week}`;
}
