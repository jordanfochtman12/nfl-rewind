/** All-time head-to-head between every pair of clubs: the memory behind rivalries and revenge games. */
import type { DynastySave, GameResult, HeadToHead, TeamId } from "./types.ts";
import { displayName, teamAbbr } from "./teams.ts";
import { addNews } from "./news.ts";
import { isRivalry } from "./schedule.ts";

export function h2hKey(a: TeamId, b: TeamId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function recordMeeting(save: DynastySave, g: GameResult): void {
  if (g.phase === "preseason" || g.phase === "proBowl") return;
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  if (!save.teams[home] || !save.teams[away]) return;
  save.h2h = save.h2h ?? {};
  const k = h2hKey(home, away);
  const [a, b] = k.split("|") as [TeamId, TeamId];
  const r: HeadToHead = (save.h2h[k] = save.h2h[k] ?? { a, b, aWins: 0, bWins: 0, ties: 0 });
  const winner = g.homeScore > g.awayScore ? home : g.awayScore > g.homeScore ? away : undefined;
  if (!winner) r.ties += 1;
  else if (winner === a) r.aWins += 1;
  else r.bWins += 1;
  const playoff = g.phase !== "regular";
  const label = g.round ?? `Week ${g.week}`;
  const hi = Math.max(g.homeScore, g.awayScore);
  const lo = Math.min(g.homeScore, g.awayScore);
  r.last = { year: g.year, label, winner, score: `${hi}-${lo}`, playoff };
  if (playoff && winner) r.lastPlayoff = { year: g.year, label, winner, score: `${hi}-${lo}` };
  // Heat: a close game, an overtime, above all a playoff meeting. It cools by 30% a year, so a
  // division pair that just splits two games stays warm, not hot.
  const before = heatAt(r, g.year);
  const margin = hi - lo;
  const big = /Championship|Super Bowl/.test(g.round ?? "");
  const add = 0.2 + (margin <= 7 ? 0.8 : 0) + (margin <= 3 ? 0.4 : 0) + (g.ot ? 0.8 : 0) + (playoff ? 3 : 0) + (big ? 2 : 0);
  r.heat = before + add;
  r.heatYear = g.year;
  if (before < RIVALRY_HOT && r.heat >= RIVALRY_HOT && !isRivalry(a, b)) {
    addNews(save, {
      kind: "headline",
      headline: `${displayName(g.year, a)} and ${displayName(g.year, b)}: a rivalry is born`,
      body: `${playoff ? `They met again in the ${label}` : "Another one-score finish"}, ${hi}-${lo}. The series stands ${r.aWins}-${r.bWins}${r.ties ? `-${r.ties}` : ""}.`,
      teamIds: [a, b],
      playerIds: [],
    });
  }
}

/** A series is a rivalry once its heat reaches this (the classic rivalries always are). */
export const RIVALRY_HOT = 6;

function heatAt(r: HeadToHead, year: number): number {
  if (!r.heat) return 0;
  return r.heat * Math.pow(0.7, Math.max(0, year - (r.heatYear ?? year)));
}

/** How hot a series runs this season: built by close games and playoff meetings. */
export function rivalryHeat(save: DynastySave, a: TeamId, b: TeamId): number {
  const r = save.h2h?.[h2hKey(a, b)];
  return r ? heatAt(r, save.year) : 0;
}

/** The hottest series in the league right now that weren't rivalries to begin with. */
export function risingRivalries(save: DynastySave, n = 3): { a: TeamId; b: TeamId; heat: number; record: string }[] {
  return Object.values(save.h2h ?? {})
    .map((r) => ({ a: r.a, b: r.b, heat: heatAt(r, save.year), record: `${r.aWins}-${r.bWins}${r.ties ? `-${r.ties}` : ""}` }))
    .filter((x) => x.heat >= RIVALRY_HOT && !isRivalry(x.a, x.b) && save.teams[x.a]?.active && save.teams[x.b]?.active)
    .sort((x, y) => y.heat - x.heat)
    .slice(0, n);
}

export interface SeriesNote {
  series: string;
  last?: string;
  revenge?: string;
}

/** The series from `us`'s side: "Packers lead the series 12-7", last meeting, any score to settle. */
export function seriesNote(save: DynastySave, us: TeamId, them: TeamId): SeriesNote | undefined {
  const r = save.h2h?.[h2hKey(us, them)];
  if (!r) return undefined;
  const ourW = r.a === us ? r.aWins : r.bWins;
  const theirW = r.a === us ? r.bWins : r.aWins;
  const tie = r.ties ? `-${r.ties}` : "";
  const series =
    ourW === theirW
      ? `Series tied ${ourW}-${theirW}${tie}`
      : ourW > theirW
        ? `${displayName(save.year, us)} lead the series ${ourW}-${theirW}${tie}`
        : `${displayName(save.year, them)} lead the series ${theirW}-${ourW}${tie}`;
  let last: string | undefined;
  if (r.last) {
    last = r.last.winner
      ? `Last meeting: ${teamAbbr(r.last.winner)} won ${r.last.score} (${r.last.year} ${r.last.label})`
      : `Last meeting: tied ${r.last.score} (${r.last.year} ${r.last.label})`;
  }
  let revenge: string | undefined;
  if (r.lastPlayoff && r.lastPlayoff.winner === them && r.lastPlayoff.year >= save.year - 2) {
    revenge = `Revenge game: the ${displayName(save.year, them)} ended the ${displayName(save.year, us)}' season in the ${r.lastPlayoff.year} ${r.lastPlayoff.label}.`;
  } else if (r.last && r.last.winner === them && r.last.year === save.year) {
    revenge = `Rematch: the ${displayName(save.year, them)} won the first meeting this season, ${r.last.score}.`;
  }
  return { series, last, revenge };
}
