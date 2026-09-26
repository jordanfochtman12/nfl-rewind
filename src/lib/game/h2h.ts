/** All-time head-to-head between every pair of clubs: the memory behind rivalries and revenge games. */
import type { DynastySave, GameResult, HeadToHead, TeamId } from "./types.ts";
import { displayName, teamAbbr } from "./teams.ts";

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
