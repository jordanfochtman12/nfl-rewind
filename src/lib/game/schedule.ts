import type { DynastySave, GameResult, TeamId } from "./types.ts";
import { activeTeamIds, conferenceOf, gamesInSeason } from "./teams.ts";
import { rand, shuffle } from "./rng.ts";

export const RIVALRIES: [TeamId, TeamId][] = [
  ["gnb", "chi"],
  ["gnb", "det"],
  ["gnb", "min"],
  ["chi", "det"],
  ["chi", "min"],
  ["min", "det"],
  ["dal", "was"],
  ["dal", "nyg"],
  ["dal", "phi"],
  ["nyg", "phi"],
  ["nyg", "was"],
  ["phi", "was"],
  ["rai", "kan"],
  ["rai", "den"],
  ["rai", "sdg"],
  ["kan", "den"],
  ["pit", "cle"],
  ["pit", "oti"],
  ["cle", "cin"],
  ["sfo", "ram"],
  ["sfo", "crd"],
  ["nyj", "nwe"],
  ["nyj", "buf"],
  ["buf", "mia"],
  ["mia", "nwe"],
  ["clt", "nwe"],
  ["ram", "crd"],
];

export function isRivalry(a: TeamId, b: TeamId): boolean {
  return RIVALRIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Circle method. Odd n uses a bye slot so every club still plays n-1 unique opponents. */
function circlePairings(teams: TeamId[]): [TeamId, TeamId][] {
  const n = teams.length;
  if (n < 2) return [];
  const slots = n % 2 === 0 ? n : n + 1;
  const idx = Array.from({ length: slots }, (_, i) => i);
  const pairs: [TeamId, TeamId][] = [];
  for (let r = 0; r < slots - 1; r++) {
    for (let i = 0; i < slots / 2; i++) {
      const a = idx[i]!;
      const b = idx[slots - 1 - i]!;
      if (a >= n || b >= n) continue;
      pairs.push([teams[a]!, teams[b]!]);
    }
    const last = idx.pop()!;
    idx.splice(1, 0, last);
  }
  return pairs;
}

function buildMatchups(save: DynastySave, teams: TeamId[], gamesNeeded: number): [TeamId, TeamId][] {
  const count = new Map<TeamId, number>(teams.map((t) => [t, 0]));
  const used = new Map<string, number>();
  const pairs: [TeamId, TeamId][] = [];

  const key = (a: TeamId, b: TeamId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const add = (a: TeamId, b: TeamId): boolean => {
    if (a === b) return false;
    if ((count.get(a) ?? 0) >= gamesNeeded || (count.get(b) ?? 0) >= gamesNeeded) return false;
    const k = key(a, b);
    used.set(k, (used.get(k) ?? 0) + 1);
    const homeFirst = rand(save) < 0.5;
    pairs.push(homeFirst ? [a, b] : [b, a]);
    count.set(a, (count.get(a) ?? 0) + 1);
    count.set(b, (count.get(b) ?? 0) + 1);
    return true;
  };

  const order = shuffle(save, teams.slice());
  let guard = 0;
  while (guard++ < 40) {
    const short = teams.filter((t) => (count.get(t) ?? 0) < gamesNeeded);
    if (short.length === 0) break;
    const round = circlePairings(guard === 1 ? order : shuffle(save, order.slice()));
    let placed = 0;
    for (const [a, b] of round) {
      if (add(a, b)) placed += 1;
    }
    if (placed === 0) break;
  }

  guard = 0;
  while (guard++ < 4000) {
    const short = teams.filter((t) => (count.get(t) ?? 0) < gamesNeeded);
    if (short.length < 2) break;
    short.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0));
    const a = short[0]!;
    let placed = false;
    const rest = short.slice(1).sort((x, y) => (used.get(key(a, x)) ?? 0) - (used.get(key(a, y)) ?? 0));
    for (const b of rest) {
      if (add(a, b)) {
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }

  return pairs;
}

function tagAlmanac(games: GameResult[], year: number): void {
  for (const g of games) {
    const home = g.homeId as TeamId;
    const away = g.awayId as TeamId;
    if (isRivalry(home, away)) g.rivalry = true;
  }
  if (year < 1970) return;
  const byWeek = new Map<number, GameResult[]>();
  for (const g of games) {
    const list = byWeek.get(g.week) ?? [];
    list.push(g);
    byWeek.set(g.week, list);
  }
  for (const weekGames of byWeek.values()) {
    const ranked = weekGames.slice().sort((a, b) => {
      const ra = a.rivalry ? 1 : 0;
      const rb = b.rivalry ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return a.id.localeCompare(b.id);
    });
    if (ranked[0]) ranked[0].night = true;
  }
}

function assignWeeks(save: DynastySave, matchups: [TeamId, TeamId][], year: number): GameResult[] {
  const remaining = matchups.slice();
  const games: GameResult[] = [];
  let week = 1;
  let stuck = 0;
  while (remaining.length && week <= 30) {
    const used = new Set<string>();
    let placed = 0;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const [a, b] = remaining[i]!;
      if (used.has(a) || used.has(b)) continue;
      used.add(a);
      used.add(b);
      remaining.splice(i, 1);
      games.push({
        id: `${year}-w${week}-${a}-${b}`,
        year,
        week,
        phase: "regular",
        homeId: a,
        awayId: b,
        homeScore: 0,
        awayScore: 0,
        played: false,
        rivalry: isRivalry(a, b),
      });
      placed += 1;
    }
    if (placed === 0) {
      stuck += 1;
      if (stuck > 2) {
        const last = remaining.pop();
        if (last) {
          games.push({
            id: `${year}-w${week}-${last[0]}-${last[1]}`,
            year,
            week,
            phase: "regular",
            homeId: last[0],
            awayId: last[1],
            homeScore: 0,
            awayScore: 0,
            played: false,
            rivalry: isRivalry(last[0], last[1]),
          });
        }
        stuck = 0;
        week += 1;
      }
    } else {
      stuck = 0;
      week += 1;
    }
  }
  tagAlmanac(games, year);
  return games;
}

export function rebuildSchedule(save: DynastySave): void {
  const year = save.year;
  const teams = activeTeamIds(year);
  const need = gamesInSeason(year);
  const groups =
    year < 1970
      ? [
          teams.filter((t) => conferenceOf(year, t) === "NFL"),
          teams.filter((t) => conferenceOf(year, t) === "AFL"),
        ]
      : [teams];
  const matchups: [TeamId, TeamId][] = [];
  for (const g of groups) {
    if (g.length >= 2) matchups.push(...buildMatchups(save, g, need));
  }
  save.schedule = assignWeeks(save, matchups, year);
}

export function gamesForTeam(save: DynastySave, teamId: TeamId): GameResult[] {
  return save.schedule.filter((g) => g.homeId === teamId || g.awayId === teamId);
}

export function maxWeek(save: DynastySave): number {
  return save.schedule.reduce((m, g) => Math.max(m, g.week), 0);
}

export function gamesInWeek(save: DynastySave, week: number): GameResult[] {
  return save.schedule.filter((g) => g.week === week);
}
