import type { DynastySave, GameResult, TeamId } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName, gamesInSeason, originalLeague } from "./teams.ts";
import { rand, shuffle } from "./rng.ts";
import { REAL_SCHEDULES } from "./data/realSchedules.ts";
import { RIVALRY_HOT, rivalryHeat } from "./h2h.ts";

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

  return balanceHomeAway(pairs);
}

/**
 * Home field was a coin flip per game, which handed some clubs 12 home dates and others 3.
 * Real schedules split evenly: teams that meet twice go home-and-home, and everyone else gets
 * flipped until no club is more than one home game off an even split. Uses no RNG, so the
 * rest of the season's draws are untouched.
 */
function balanceHomeAway(pairs: [TeamId, TeamId][]): [TeamId, TeamId][] {
  const key = (a: TeamId, b: TeamId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const byPair = new Map<string, number[]>();
  pairs.forEach(([a, b], i) => {
    const k = key(a, b);
    byPair.set(k, [...(byPair.get(k) ?? []), i]);
  });
  const fixed = new Set<number>();
  for (const idxs of byPair.values()) {
    for (let j = 1; j < idxs.length; j += 2) {
      const [a, b] = pairs[idxs[j - 1]!]!;
      pairs[idxs[j]!] = [b, a];
      fixed.add(idxs[j - 1]!);
      fixed.add(idxs[j]!);
    }
  }
  const home = new Map<TeamId, number>();
  const games = new Map<TeamId, number>();
  for (const [a, b] of pairs) {
    home.set(a, (home.get(a) ?? 0) + 1);
    games.set(a, (games.get(a) ?? 0) + 1);
    games.set(b, (games.get(b) ?? 0) + 1);
  }
  const excess = (t: TeamId) => (home.get(t) ?? 0) - (games.get(t) ?? 0) / 2;
  for (let pass = 0; pass < 50; pass++) {
    let flipped = false;
    for (let i = 0; i < pairs.length; i++) {
      if (fixed.has(i)) continue;
      const [a, b] = pairs[i]!;
      if (excess(a) - excess(b) >= 2) {
        pairs[i] = [b, a];
        home.set(a, (home.get(a) ?? 0) - 1);
        home.set(b, (home.get(b) ?? 0) + 1);
        flipped = true;
      }
    }
    if (!flipped) break;
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

/**
 * The schedule the league actually played that season: same opponents, same home sites,
 * same weeks and TV slots, and what really happened in each game. Weeks with no games (the
 * 1982 and 1987 strikes) are closed up. Returns undefined when there is no real card for the
 * year, or it doesn't match the clubs actually in this league that season.
 */
export function realSchedule(year: number): GameResult[] | undefined {
  const raw = REAL_SCHEDULES[year];
  if (!raw) return undefined;
  const active = new Set(activeTeamIds(year));
  const rows = raw.split("|").map((g) => g.split(","));
  const teams = new Set(rows.flatMap((r) => [r[1], r[2]]));
  if (teams.size !== active.size || [...teams].some((t) => !active.has(t as TeamId))) return undefined;
  const weeks = [...new Set(rows.map((r) => Number(r[0])))].sort((a, b) => a - b);
  const dense = new Map(weeks.map((w, i) => [w, i + 1]));
  const games: GameResult[] = rows.map((r) => {
    const [wk, home, away, hs, as, date, slot, site] = r as [string, TeamId, TeamId, string, string, string, string, string];
    const week = dense.get(Number(wk))!;
    const md = Number(date);
    const thanksgiving = slot === "T" && md >= 1122 && md <= 1128;
    const night = year >= 1970 && (slot === "M" || slot === "N" || (slot === "T" && year >= 2006 && !thanksgiving));
    const g: GameResult = {
      id: `${year}-w${week}-${home}-${away}`,
      year,
      week,
      phase: "regular",
      homeId: home,
      awayId: away,
      homeScore: 0,
      awayScore: 0,
      played: false,
      rivalry: isRivalry(home, away),
      date,
      slot: slot || undefined,
    };
    if (night) g.night = true;
    if (site) g.site = site;
    if (Number(hs) >= 0 && Number(as) >= 0) {
      g.realHome = Number(hs);
      g.realAway = Number(as);
    }
    return g;
  });
  return games;
}

export function rebuildSchedule(save: DynastySave): void {
  const year = save.year;
  const real = realSchedule(year);
  if (real) {
    save.schedule = real;
    markHotRivalries(save);
    return;
  }
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
  markHotRivalries(save);
}

/** A series that has heated up in this timeline is billed as a rivalry game, like the classics. */
function markHotRivalries(save: DynastySave): void {
  for (const g of save.schedule) {
    if (g.rivalry || g.played) continue;
    if (rivalryHeat(save, g.homeId as TeamId, g.awayId as TeamId) >= RIVALRY_HOT) g.rivalry = true;
  }
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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sun Sep 11" for a game on the real calendar (January games belong to the next year). */
export function gameDateLabel(g: GameResult): string | undefined {
  if (!g.date) return undefined;
  const m = Number(g.date.slice(0, 2));
  const d = Number(g.date.slice(2));
  const dt = new Date(Date.UTC(m <= 2 ? g.year + 1 : g.year, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}`;
}

/** History's result from this club's side, e.g. "W 23-14". */
export function realResultFor(g: GameResult, teamId: TeamId): string | undefined {
  if (g.realHome === undefined || g.realAway === undefined) return undefined;
  const home = g.homeId === teamId;
  const us = home ? g.realHome : g.realAway;
  const them = home ? g.realAway : g.realHome;
  return `${us > them ? "W" : us < them ? "L" : "T"} ${us}-${them}`;
}

/**
 * Why the owner's club has no game this week, in real-calendar terms. Before the merger the
 * two leagues kept their own calendars on one shared week count: the AFL opened a week early
 * in 1966, so every NFL club is idle in week 1 - exactly as it was.
 */
export function byeNote(save: DynastySave, week = save.week): string {
  const id = save.userTeamId;
  const season = save.schedule.filter((g) => g.year === save.year && g.phase === "regular");
  const next = season
    .filter((g) => g.week > week && (g.homeId === id || g.awayId === id))
    .sort((a, b) => a.week - b.week)[0];
  const nextText = next
    ? `Next: ${gameDateLabel(next) ?? `week ${next.week}`}, ${next.homeId === id ? "vs" : "at"} the ${displayName(save.year, (next.homeId === id ? next.awayId : next.homeId) as TeamId)}.`
    : "";
  const played = (g: GameResult) => g.homeId === id || g.awayId === id;
  const opened = season.some((g) => g.week < week && played(g));
  if (save.year <= 1969 && !opened) {
    const mine = originalLeague(id) === "AFL" ? "AFL" : "NFL";
    const other = mine === "NFL" ? "AFL" : "NFL";
    const ourLeagueThisWeek = season.some(
      (g) => g.week === week && originalLeague(g.homeId as TeamId) === mine && originalLeague(g.awayId as TeamId) === mine,
    );
    if (!ourLeagueThisWeek) {
      return `The ${mine} hasn't opened yet. Only the ${other} played this weekend, just like the real ${save.year} calendar. ${nextText}`.trim();
    }
  }
  const odd = activeTeamIds(save.year).length % 2 === 1;
  return `${odd ? "An odd number of clubs means someone sits every week, and this one is yours." : "Bye week."} ${nextText}`.trim();
}
