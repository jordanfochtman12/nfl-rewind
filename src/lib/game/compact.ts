/** Strip film we don't need so a 60-year file still loads. */
import type { DynastySave, GameResult } from "./types.ts";

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
}

function strippedCopy(save: DynastySave, g: GameResult): GameResult {
  if (keepsFilm(save, g) || (!g.boxHome && !g.boxAway && !g.drives && !g.highlights)) return g;
  return { ...g, boxHome: undefined, boxAway: undefined, drives: undefined, highlights: undefined };
}

// News, the weekly wire and the transaction log are all newest-first (addNews/addTx unshift),
// so trimming keeps the head. (It used to keep the tail - the oldest entries - so every reload
// or export swapped the latest headlines for stale ones.)
const NEWS_KEEP = 80;
const WEEK_NEWS_KEEP = 16;
const TX_KEEP = 160;

/** Drop box scores / drives from prior seasons. Scores, sites, and history stay. Mutates. */
export function compactSaveInPlace(save: DynastySave): void {
  for (const g of [...save.schedule, ...save.playoffGames, save.superBowl, save.proBowl]) {
    if (g && !keepsFilm(save, g)) stripGame(g);
  }
  if (save.news.length > NEWS_KEEP) save.news = save.news.slice(0, NEWS_KEEP);
  if (save.weekNews.length > WEEK_NEWS_KEEP) save.weekNews = save.weekNews.slice(0, WEEK_NEWS_KEEP);
  if (save.transactions.length > TX_KEEP) save.transactions = save.transactions.slice(0, TX_KEEP);
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
    schedule: save.schedule.map((g) => strippedCopy(save, g)),
    playoffGames: save.playoffGames.map((g) => strippedCopy(save, g)),
    superBowl: save.superBowl && strippedCopy(save, save.superBowl),
    proBowl: save.proBowl && strippedCopy(save, save.proBowl),
    news: save.news.slice(0, NEWS_KEEP),
    weekNews: save.weekNews.slice(0, WEEK_NEWS_KEEP),
    transactions: save.transactions.slice(0, TX_KEEP),
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
