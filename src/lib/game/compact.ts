/** Strip film we don't need so a 60-year file still loads. */
import type { DynastySave, GameResult } from "./types.ts";
import { cloneSave } from "./save.ts";

function stripGame(g: GameResult, keepFilm: boolean): void {
  if (keepFilm) return;
  g.boxHome = undefined;
  g.boxAway = undefined;
  g.drives = undefined;
  g.highlights = undefined;
}

function walkFilm(save: DynastySave): void {
  const keepYear = save.year;
  const inFilm =
    save.phase === "regular" ||
    save.phase === "deadline" ||
    save.phase === "playoffs" ||
    save.phase === "superBowl" ||
    save.phase === "proBowl";
  const walk = (g?: GameResult) => {
    if (!g) return;
    stripGame(g, inFilm && g.year === keepYear);
  };
  for (const g of save.schedule) walk(g);
  for (const g of save.playoffGames) walk(g);
  walk(save.superBowl);
  walk(save.proBowl);
}

function trimLedger(save: DynastySave): void {
  if (save.news.length > 80) save.news = save.news.slice(-80);
  if (save.weekNews.length > 16) save.weekNews = save.weekNews.slice(-16);
  if (save.transactions.length > 160) save.transactions = save.transactions.slice(-160);
}

/** Drop box scores / drives from prior seasons. Scores, sites, and history stay. Mutates. */
export function compactSaveInPlace(save: DynastySave): void {
  walkFilm(save);
  trimLedger(save);
}

/** Drop box scores / drives from prior seasons. Scores, sites, and history stay. */
export function compactSave(save: DynastySave): DynastySave {
  const c = cloneSave(save);
  compactSaveInPlace(c);
  return c;
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
