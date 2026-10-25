/**
 * The Super Bowl book: every game in this league's history, the clubs by rings and trips,
 * the dynasties, the record games (blowouts, thrillers, shootouts), the clubs still waiting,
 * and the old NFL and AFL champions from before the merger. No React.
 */
import { activeTeamIds } from "./teams.ts";
import type { BowlAlmanacEntry, DynastySave, TeamId } from "./types.ts";

export interface BowlGame {
  year: number;
  number: number;
  site: string;
  city: string;
  winner: TeamId;
  loser: TeamId;
  winScore: number;
  loseScore: number;
  margin: number;
  total: number;
  mvpId?: string;
  mvpName?: string;
}

export interface BowlClub {
  teamId: TeamId;
  wins: number;
  losses: number;
  /** Seasons won, oldest first. */
  years: number[];
  lastTrip?: number;
}

export interface Dynasty {
  teamId: TeamId;
  wins: number;
  from: number;
  to: number;
  label: string;
}

export interface SuperBowlBook {
  games: BowlGame[];
  clubs: BowlClub[];
  dynasties: Dynasty[];
  records: { label: string; game: BowlGame; note: string }[];
  /** Active clubs with no ring; those who have never even been. */
  waiting: TeamId[];
  neverBeen: TeamId[];
  /** Pre-merger league champions (NFL and AFL, 1966-69). */
  leagueTitles: { year: number; league: string; teamId: TeamId }[];
  /** The defending champion and how many straight he's won. */
  defending?: { teamId: TeamId; streak: number };
  mvpRepeat: { name: string; count: number }[];
}

export function bowlGame(b: BowlAlmanacEntry): BowlGame {
  const homeWon = b.homeScore >= b.awayScore;
  const winner = homeWon ? b.homeId : b.awayId;
  const loser = homeWon ? b.awayId : b.homeId;
  const winScore = Math.max(b.homeScore, b.awayScore);
  const loseScore = Math.min(b.homeScore, b.awayScore);
  return { year: b.year, number: b.number, site: b.site, city: b.city, winner, loser, winScore, loseScore, margin: winScore - loseScore, total: winScore + loseScore, mvpId: b.mvpId, mvpName: b.mvpName };
}

/** Everything the league's Super Bowl history adds up to. */
export function superBowlBook(save: DynastySave): SuperBowlBook {
  const games = (save.history.superBowls ?? []).map(bowlGame).sort((a, b) => a.year - b.year);
  const clubs = new Map<TeamId, BowlClub>();
  const club = (id: TeamId) => {
    let c = clubs.get(id);
    if (!c) clubs.set(id, (c = { teamId: id, wins: 0, losses: 0, years: [] }));
    return c;
  };
  for (const g of games) {
    const w = club(g.winner);
    w.wins += 1;
    w.years.push(g.year);
    w.lastTrip = g.year;
    const l = club(g.loser);
    l.losses += 1;
    l.lastTrip = g.year;
  }
  const ranked = [...clubs.values()].sort((a, b) => b.wins - a.wins || b.wins + b.losses - (a.wins + a.losses) || (b.lastTrip ?? 0) - (a.lastTrip ?? 0));

  // Dynasties: two in a row, or three in any four seasons; the longest window per run.
  const dynasties: Dynasty[] = [];
  for (const c of clubs.values()) {
    const ys = c.years;
    let i = 0;
    while (i < ys.length) {
      let j = i;
      while (j + 1 < ys.length && ys[j + 1]! - ys[i]! <= Math.max(3, (j + 1 - i) * 2)) j += 1;
      const n = j - i + 1;
      const backToBack = ys.slice(i, j + 1).some((y, k, a) => k > 0 && y - a[k - 1]! === 1);
      if (n >= 3 || (n === 2 && backToBack)) {
        const span = ys[j]! - ys[i]! + 1;
        dynasties.push({ teamId: c.teamId, wins: n, from: ys[i]!, to: ys[j]!, label: n === span ? (n === 2 ? "Back-to-back" : `${n} straight`) : `${n} in ${span} years` });
      }
      i = j + 1;
    }
  }
  dynasties.sort((a, b) => b.wins - a.wins || a.from - b.from);

  const records: SuperBowlBook["records"] = [];
  const pick = (label: string, by: (g: BowlGame) => number, note: (g: BowlGame) => string) => {
    if (!games.length) return;
    const g = games.reduce((best, x) => (by(x) > by(best) ? x : best));
    records.push({ label, game: g, note: note(g) });
  };
  pick("Biggest blowout", (g) => g.margin, (g) => `won by ${g.margin}`);
  pick("Closest finish", (g) => -g.margin * 100 + g.total / 100, (g) => (g.margin === 0 ? "level" : `decided by ${g.margin}`));
  pick("Highest scoring", (g) => g.total, (g) => `${g.total} points`);
  pick("Most by one club", (g) => g.winScore, (g) => `${g.winScore} points`);
  pick("Defensive battle", (g) => -g.total, (g) => `${g.total} points in all`);

  const active = activeTeamIds(save.year);
  const waiting = active.filter((id) => !(clubs.get(id)?.wins ?? 0));
  const neverBeen = active.filter((id) => !clubs.has(id));

  let defending: SuperBowlBook["defending"];
  const last = games.at(-1);
  if (last) {
    let streak = 0;
    for (let k = games.length - 1; k >= 0 && games[k]!.winner === last.winner; k--) streak += 1;
    defending = { teamId: last.winner, streak };
  }

  const mvps = new Map<string, number>();
  for (const g of games) if (g.mvpName) mvps.set(g.mvpName, (mvps.get(g.mvpName) ?? 0) + 1);
  const mvpRepeat = [...mvps.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  const leagueTitles = (save.history.championships ?? []).filter((c) => c.year <= 1969).sort((a, b) => a.year - b.year || a.league.localeCompare(b.league));
  return { games, clubs: ranked, dynasties, records, waiting, neverBeen, leagueTitles, defending, mvpRepeat };
}
