/**
 * Start a dynasty (or a Watch history league) in a later season, with the league as it
 * really was: History mode replays the record up to that season's draft (every real roster,
 * stat line, champion, award and Hall of Fame class before it), then the save is handed over
 * to the game. Everyone on a real roster that season gets a real rating:
 *
 * - a drafted player is rebuilt the way the draft room makes him (his draft class's ratings
 *   kit and his real career arc), then aged to where that arc had him that season;
 * - anyone else (undrafted, or no draft-class entry) is rated from what he really did in the
 *   seasons just before, given his real career span so he retires when he really did.
 *
 * From the start season on it's a dynasty like any other: the real draft classes keep coming
 * while the record has them, then the game makes its own.
 */
import { advanceHistory, createHistoryGame, hasHistoryData, ROSTERS_LAST, historyData, playerFor, seatCoaches } from "./historyMode.ts";
import { normalizedName } from "./identity.ts";
import { buildDraftBoard, ensureSeasonPicks, realDraftee } from "./draft.ts";
import { draftSeedsFor } from "./data/draftClasses.ts";
import { FRIENDS } from "./data/friends.ts";
import { arcTarget, calibrateVetPeak, honorsFloor, lookupArc, moveToward } from "./careerArc.ts";
import { DEPTH_CHART, emptyStats, generatePlayer, normalizeJerseys, playerName, retiredFor, rosterOf, signFriends, signRealFa, syncDepth } from "./players.ts";
import { jerseyFor } from "./names.ts";
import { randInt } from "./rng.ts";
import { deriveOvr } from "./ratings.ts";
import { refreshContracts } from "./salary.ts";
import { rebuildSchedule } from "./schedule.ts";
import { activeTeamIds, displayName, gamesInSeason } from "./teams.ts";
import { addNews } from "./news.ts";
import { setLabel } from "./season.ts";
import { fillCoachFields, makeCoachFromSeed, seedStaff } from "./staff.ts";
import { COACHES_1966, EXPANSION_COACHES, LATER_COACHES } from "./data/coaches.ts";
import { MORE_COACHES } from "./data/coachesMore.ts";
import { newOwnerState } from "./owner.ts";
import type { DynastySave, Player, Pos, SeasonStats, TeamId } from "./types.ts";

/**
 * The seasons a league can start in: every one the record has rosters for. 1966 is the classic
 * start; the rest begin from that year's real rosters.
 */
export const ERA_STARTS: readonly number[] = Array.from({ length: ROSTERS_LAST - 1966 + 1 }, (_, i) => 1966 + i);

const nameKey = (f: string, l: string) => `${f}|${l}`.toLowerCase().replace(/[^a-z|]/g, "");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What a season's line says about a player, on the game's overall scale. */
function lineScore(pos: Pos, st: SeasonStats): number | undefined {
  const k = 16 / Math.max(12, gamesInSeason(st.year));
  const gp = st.gp ?? 0;
  const unknown = new Set((st as SeasonStats & { unknown?: string[] }).unknown ?? []);
  const games = 58 + Math.min(gp * k, 16) * 0.85;
  switch (pos) {
    case "QB": {
      if ((st.passAtt ?? 0) < 120) return gp ? 60 + Math.min(gp, 8) : undefined;
      const v = (st.passYds ?? 0) * k;
      return 60 + clamp((v - 1200) / 3300, 0, 1) * 28 + clamp(((st.passTd ?? 0) - (st.passInt ?? 0)) * k, -10, 25) * 0.25;
    }
    case "RB":
      return 58 + clamp((((st.rushYds ?? 0) + 0.6 * (st.recYds ?? 0)) * k) / 1800, 0, 1) * 32;
    case "FB":
      return 62 + clamp((((st.rushYds ?? 0) + (st.recYds ?? 0)) * k) / 900, 0, 1) * 18;
    case "WR":
      return 58 + clamp(((st.recYds ?? 0) * k) / 1450, 0, 1) * 32;
    case "TE":
      return 60 + clamp(((st.recYds ?? 0) * k) / 1050, 0, 1) * 28;
    case "DE":
    case "DT":
    case "OLB":
      if (unknown.has("sacks")) return games;
      return Math.max(games - 4, 62 + clamp(((st.sacks ?? 0) * k) / 14, 0, 1) * 28);
    case "MLB":
      if (unknown.has("tackles")) return games;
      return Math.max(games - 4, 62 + clamp(((st.tackles ?? 0) * k) / 150, 0, 1) * 26);
    case "CB":
    case "S":
      return Math.max(games - 3, 62 + clamp(((st.ints ?? 0) * k) / 8, 0, 1) * 26);
    case "K":
      if ((st.fgAtt ?? 0) < 8) return gp ? 62 : undefined;
      return 58 + clamp(((st.fgMade ?? 0) / (st.fgAtt ?? 1) - 0.55) / 0.35, 0, 1) * 32;
    case "P":
      if ((st.punts ?? 0) < 15) return gp ? 62 : undefined;
      return 58 + clamp(((st.puntYds ?? 0) / (st.punts ?? 1) - 37) / 11, 0, 1) * 30;
    default:
      // Linemen leave no box-score trail: a full season up front is a starter's season.
      return gp ? games : undefined;
  }
}

/** A rating from the last three real seasons, the latest counting most. */
function productionOvr(p: Player, year: number): number {
  const seasons = [year - 1, year - 2, year - 3].map((y) => p.stats[y]).filter((s): s is SeasonStats => !!s);
  const scores = seasons.map((s) => lineScore(p.pos, s)).filter((v): v is number => v !== undefined);
  if (!scores.length) return clamp(56 + Math.min(p.yearsPro, 4) * 2, 52, 66);
  const w = [0.55, 0.3, 0.15].slice(0, scores.length);
  const sum = w.reduce((a, b) => a + b, 0);
  let v = scores.reduce((a, s, i) => a + s * w[i]!, 0) / sum;
  // The best season shows his ceiling; a vet's best is a little behind him.
  v = Math.max(v, Math.max(...scores) - 3);
  const honors = p.honors?.awards?.length ?? 0;
  if (honors) v = Math.max(v, 87);
  if (p.age >= 32) v -= (p.age - 31) * 1.2;
  return Math.round(clamp(v, 48, 95));
}

type Seed = ReturnType<typeof draftSeedsFor>[number];
const classes = new Map<number, Map<string, Seed>>();

/** A real draftee's draft-class entry, found by name in his draft year. */
function seedFor(p: Player): Seed | undefined {
  if (!p.draftYear) return;
  let byName = classes.get(p.draftYear);
  if (!byName) {
    byName = new Map(draftSeedsFor(p.draftYear).map((s) => [nameKey(s.f, s.l), s]));
    classes.set(p.draftYear, byName);
  }
  return byName.get(nameKey(p.firstName, p.lastName));
}

/** Give a real player his rating for `year`. */
export function rateReal(save: DynastySave, p: Player, year: number): void {
  const seed = seedFor(p);
  const arc = p.draftYear ? lookupArc(p.draftYear, p.firstName, p.lastName) : undefined;
  if (seed && arc) {
    // The draft room's version of him, then aged along his real arc to this season.
    const made = realDraftee(save, seed, p.draftYear!);
    p.ratings = { ...made.ratings };
    p.ovr = made.ovr;
    p.arch = made.arch;
    p.traits = made.traits;
    p.abilities = made.abilities;
    p.heightIn ??= made.heightIn;
    p.weight ??= made.weight;
    p.forty ??= made.forty;
    p.arc = made.arc ?? arc;
    p.potential = made.arc ? made.potential : Math.max(made.potential, honorsFloor(arc, p.pos));
    delete save.players[made.id];
    const idx = year - p.draftYear!;
    let peak = p.ovr;
    for (let i = 0; i <= idx; i++) peak = Math.max(peak, arcTarget(p, i));
    moveToward(p, arcTarget(p, idx));
    // Production can't lift him past his real peak, but a lean arc gives way to a big year.
    const real = productionOvr(p, year);
    if (real > p.ovr + 4) moveToward(p, Math.min(p.potential, real - 2));
    p.peakOvr = Math.max(peak, p.ovr);
  } else {
    moveToward(p, productionOvr(p, year));
    // His real span, so the sim retires him the season he really retired.
    const person = parseInt(p.id.slice(2), 36);
    const first = historyData().firstSeason(person) ?? year - p.yearsPro;
    const last = historyData().lastSeason(person) ?? year;
    const age = p.age - (year - first);
    p.arc = { dy: first, to: last, st: Math.max(1, last - first + 1), g: 0, pb: 0, ap: 0, age: clamp(age, 20, 30) };
    calibrateVetPeak(p, year);
    if (honorsFloor(p.arc, p.pos) > p.potential) p.potential = honorsFloor(p.arc, p.pos);
    p.peakOvr = Math.max(p.peakOvr ?? 0, p.ovr);
  }
  p.scoutOvr = p.ovr;
  p.revealed = true;
}

/** Move a real player to the spot he really played, keeping how good he is. */
function shift(p: Player, pos: Pos): void {
  const ovr = p.ovr;
  p.pos = pos;
  p.ovr = deriveOvr(pos, p.ratings);
  moveToward(p, ovr);
}

const heft = (p: Player) => p.weight ?? 0;

/**
 * The record keeps positions in broad strokes: tackles and guards without a side, defensive
 * backs, linebackers and linemen often under one label. Spread each club's real players
 * across the depth chart the way a roster is built (the heavier men inside and deep), so
 * every spot is a real player before the game adds anyone.
 */
function balanceLine(s: DynastySave, id: TeamId): void {
  const roster = rosterOf(s, id);
  for (const [left, right] of [["LT", "RT"], ["LG", "RG"]] as const) {
    const group = roster.filter((p) => p.pos === left || p.pos === right).sort((a, b) => b.ovr - a.ovr);
    group.forEach((p, i) => {
      const pos = i % 2 === 0 ? left : right;
      if (p.pos !== pos) shift(p, pos);
    });
  }
  // [the position with too many, the one short, how many the short spot wants]
  const moves: [Pos, Pos, number][] = [
    ["CB", "S", 3],
    ["DE", "DT", 3],
    ["MLB", "OLB", 3],
    ["OLB", "MLB", 2],
    ["S", "CB", 4],
  ];
  for (const [from, to, want] of moves) {
    const have = roster.filter((p) => p.pos === to).length;
    const pool = roster.filter((p) => p.pos === from).sort((a, b) => heft(b) - heft(a) || a.ovr - b.ovr);
    // Never strip the spot he's moving from below what it needs itself.
    const keep = DEPTH_CHART.find(([pos]) => pos === from)?.[1] ?? 2;
    for (let n = have; n < want && pool.length > keep; n++) shift(pool.shift()!, to);
  }
}

/** Coaches the record seated get the game's ratings: from the coach catalogs when he's in them. */
function rateCoaches(save: DynastySave, year: number): void {
  const catalog = new Map([...COACHES_1966, ...EXPANSION_COACHES, ...LATER_COACHES, ...MORE_COACHES].map((c) => [c.name.toLowerCase(), c]));
  for (const c of Object.values(save.coaches)) {
    const seed = catalog.get(c.name.toLowerCase());
    if (seed) {
      const made = makeCoachFromSeed(seed, year, { teamId: c.teamId, role: c.role ?? "HC" });
      Object.assign(c, {
        offense: made.offense,
        defense: made.defense,
        offScheme: made.offScheme,
        defScheme: made.defScheme,
        leadership: made.leadership,
        development: made.development,
        evaluation: made.evaluation,
        born: made.born,
        abilities: made.abilities,
        traits: made.traits,
      });
    } else if (!c.offense && !c.defense) {
      // Not in the catalogs: rated off his real record so far.
      const g = c.careerWins + c.careerLosses + c.careerTies;
      const pct = g ? (c.careerWins + c.careerTies / 2) / g : 0.5;
      const r = Math.round(clamp(64 + (pct - 0.45) * 50 + Math.min(g, 160) / 40, 62, 90));
      c.offense = r;
      c.defense = r;
      c.leadership = r;
      c.development = 70;
      c.evaluation = 70;
      c.abilities = [];
      c.traits = [];
      c.age = 0;
      c.born = undefined;
      c.potential = undefined as unknown as number;
    }
    fillCoachFields(c, year);
  }
}

/**
 * The record keeps everyone who ever played; a save doesn't need the fringe. A retired player
 * stays when the books mention him (awards, records, the Hall, a title game) or when he had a
 * real career (three seasons' worth of games); the rest are let go.
 */
function pruneRetired(s: DynastySave): void {
  const named = new Set(JSON.stringify([s.history, s.teamGameRecords, s.bestSeasonMarks ?? {}]).match(/r-[0-9a-z]+/g) ?? []);
  for (const [id, p] of Object.entries(s.players)) {
    if (p.teamId !== "retired" || named.has(id) || p.honors?.awards?.length) continue;
    const games = Object.values(p.stats).reduce((n, st) => n + (st?.gp ?? 0), 0);
    if (games >= 40) continue;
    delete s.players[id];
  }
}

/**
 * Free agency's real market. Everyone the record has on an NFL roster this season who isn't
 * in the league yet (an undrafted rookie, a man out of the league last year, a player the
 * classic start never knew) comes in as a free agent, rated from what he really did, so a
 * club's open spots go to real players. This year's draftees come through the draft instead.
 */
interface RealNumber {
  team: TeamId;
  n: number;
  person: number;
  pos: Pos;
  /** Games he played for that club that year: two men in one number, the regular wears it. */
  gp: number;
}

const numbersByYear = new Map<number, Map<string, RealNumber[]>>();

/** Who wore what in `year`, by name, from the record's rosters. */
function realNumbers(year: number): Map<string, RealNumber[]> {
  let idx = numbersByYear.get(year);
  if (idx) return idx;
  idx = new Map();
  const h = historyData();
  const games = new Map<string, number>();
  for (const { person, team, line } of h.stats(year)) games.set(`${person}|${team}`, (games.get(`${person}|${team}`) ?? 0) + (line.gp ?? 0));
  for (const [team, list] of h.rosters(year)) {
    for (const { person, jersey } of list) {
      const who = h.people[person];
      if (!who || jersey == null) continue;
      const k = normalizedName(who.first, who.last);
      const rows = idx.get(k) ?? [];
      rows.push({ team, n: jersey, person, pos: who.pos, gp: games.get(`${person}|${team}`) ?? 0 });
      idx.set(k, rows);
    }
  }
  numbersByYear.set(year, idx);
  return idx;
}

const GROUP: Record<Pos, string> = {
  QB: "qb", RB: "rb", FB: "rb", WR: "rec", TE: "rec", LT: "ol", LG: "ol", C: "ol", RG: "ol", RT: "ol",
  DE: "front", DT: "front", OLB: "front", MLB: "lb", CB: "db", S: "db", K: "kick", P: "kick",
};

/**
 * Each season the record covers, a real player wears the number he really wore that year:
 * the rookie who switched (Nick Chubb's 44 to 24), the veteran who changed it on a new club.
 * Numbers were set once and kept, so a league begun in 2012 had three in four of them wrong by
 * 2021. The man who really wore a number for this club gets it over a teammate who wore it
 * somewhere else (who takes another); on a club the record never had him on, his real number
 * that year comes along when it's free.
 */
export function syncRealNumbers(save: DynastySave): number {
  // Only a league begun from the record keeps it loaded: a classic league plays the same either way.
  if (!save.realPool || !hasHistoryData() || save.realHistory || save.year > ROSTERS_LAST) return 0;
  const idx = realNumbers(save.year);
  if (!idx.size) return 0;
  const recordOf = (p: Player): RealNumber[] => {
    if (!p.historical) return [];
    const rows = idx.get(normalizedName(p.firstName, p.lastName)) ?? [];
    // The record's own players are that exact man; anyone else has to fit the position too,
    // or a defensive tackle takes the number of the corner who shares his name.
    if (p.id.startsWith("r-")) return rows.filter((r) => r.person === parseInt(p.id.slice(2), 36));
    if (new Set(rows.map((r) => r.person)).size <= 1) return rows;
    return rows.filter((r) => GROUP[r.pos] === GROUP[p.pos]);
  };
  let fixed = 0;
  for (const id of activeTeamIds(save.year)) {
    const roster = rosterOf(save, id);
    const retired = retiredFor(save, id);
    // His number here, or the one he wore elsewhere that year (if the record has just one).
    const claim = (p: Player): { n: number; here: boolean; gp: number } | undefined => {
      const rows = recordOf(p);
      const here = rows.filter((r) => r.team === id).sort((a, b) => b.gp - a.gp)[0];
      if (here) return { n: here.n, here: true, gp: here.gp };
      if (rows.length && rows.every((r) => r.n === rows[0]!.n)) return { n: rows[0]!.n, here: false, gp: 0 };
      return undefined;
    };
    const claims = new Map(roster.map((p) => [p.id, claim(p)]));
    // Real numbers here first, the regulars before the men cut in camp; carried numbers after.
    const order = roster
      .filter((p) => claims.get(p.id))
      .sort((a, b) => Number(claims.get(b.id)!.here) - Number(claims.get(a.id)!.here) || claims.get(b.id)!.gp - claims.get(a.id)!.gp);
    const settled = new Set<string>();
    for (const p of order) {
      const c = claims.get(p.id)!;
      p.recordNo = c.n;
      if (retired.has(c.n) && retired.get(c.n) !== p.id) continue;
      const holder = roster.find((x) => x.id !== p.id && x.jersey === c.n);
      if (holder && settled.has(holder.id)) continue;
      settled.add(p.id);
      if (p.jersey === c.n) continue;
      p.jersey = c.n;
      fixed += 1;
      if (holder) holder.jersey = jerseyFor(save, holder.pos, new Set([...roster.map((x) => x.jersey), ...retired.keys()]));
    }
  }
  return fixed;
}

export function realIntake(save: DynastySave): number {
  if (!save.realPool || save.realHistory || !hasHistoryData() || save.year > ROSTERS_LAST) return 0;
  const h = historyData();
  const year = save.year;
  const drafted = new Set(h.drafts(year).map((d) => d.person));
  // Players already in the save by name (the draft room and the classic start make their
  // own ids), with when they came into the league, so a namesake isn't mistaken for him.
  const known = new Map<string, number[]>();
  for (const p of Object.values(save.players)) {
    if (!p.historical) continue;
    const k = normalizedName(p.firstName, p.lastName);
    const list = known.get(k) ?? [];
    list.push(p.draftYear ?? p.arc?.dy ?? year - p.yearsPro);
    known.set(k, list);
  }
  let added = 0;
  for (const [, list] of h.rosters(year)) {
    for (const { person } of list) {
      if (drafted.has(person) || save.players[`r-${person.toString(36)}`]) continue;
      const who = h.people[person];
      if (!who) continue;
      const first = h.firstSeason(person) ?? year;
      if (known.get(normalizedName(who.first, who.last))?.some((dy) => Math.abs(dy - first) <= 2)) continue;
      const p = playerFor(save, person, year, "fa");
      if (who.birth) p.age = year - Number(who.birth.slice(0, 4));
      p.yearsPro = Math.max(0, year - first);
      rateReal(save, p, year);
      added += 1;
    }
  }
  return added;
}

/**
 * Put back the real seasons a disk save leaves out (compact.ts): a record player's lines from
 * before the league began are the record's, so they're read from it rather than stored. Needs
 * the record loaded; returns whether the save is whole.
 */
export function restoreRecordLines(save: DynastySave): boolean {
  const before = save.recordLinesBefore;
  if (!before) return true;
  if (!hasHistoryData()) return false;
  const h = historyData();
  for (let y = 1966; y < before; y++) {
    for (const { person, team, line } of h.stats(y)) {
      const p = save.players[`r-${person.toString(36)}`];
      if (!p || p.stats[y]) continue;
      const st: SeasonStats = { ...emptyStats(y, (team || p.teamId) as TeamId), ...(line as Partial<SeasonStats>) };
      if (y < 1999) st.unknown = y < 1970 ? ["tackles", "ff", "tfl", "pd", "sacks"] : ["tackles", "ff", "tfl", "pd"];
      p.stats[y] = st;
    }
  }
  save.recordLinesBefore = undefined;
  return true;
}

export interface EraOpts {
  userTeamId: TeamId;
  startingYear: number;
  sandbox?: boolean;
  seed?: number;
}

/** A new league at the `startingYear` draft, built from the record (history data must be loaded). */
export function createEraGame(o: EraOpts): DynastySave {
  const year = o.startingYear;
  const s = createHistoryGame();
  for (let guard = 0; guard < 6000 && !(s.year === year && s.phase === "draft") && s.phase !== "complete"; guard++) advanceHistory(s);
  // The season after History mode's last: its rosters are in the record (ROSTERS_LAST) but its
  // games aren't played yet, so the league opens at that draft straight from the record's end.
  if (s.phase === "complete" && year === s.year + 1 && year <= ROSTERS_LAST) {
    s.year = year;
    s.phase = "draft";
    s.week = 0;
  }
  if (s.year !== year) throw new Error(`The record doesn't reach the ${year} draft`);

  // Hand the league to the game.
  s.realHistory = undefined;
  s.historyStep = undefined;
  s.historyFollow = undefined;
  s.historyCalls = undefined;
  s.sandbox = o.sandbox ? true : undefined;
  s.cpuOnly = !!o.sandbox;
  s.userTeamId = o.userTeamId;
  s.startingYear = year;
  s.realPool = true;
  s.seed = o.seed ?? year * 97 + o.userTeamId.charCodeAt(0);
  s.rng = s.seed >>> 0;
  s.owner = newOwnerState();

  // Opening-day rosters for the season, minus this year's draft class (they're on the board).
  const rookies = new Set(historyData().drafts(year).map((d) => d.person));
  // A class the record has no draft table for yet: its rookies are the men on this year's
  // rosters for the first time who are in the year's real draft class, and they belong on the board.
  if (!rookies.size) {
    const named = new Set(draftSeedsFor(year).map((d) => normalizedName(d.f, d.l)));
    for (const [, list] of historyData().rosters(year)) {
      for (const { person } of list) {
        const who = historyData().people[person];
        if (who && historyData().firstSeason(person) === year && named.has(normalizedName(who.first, who.last))) rookies.add(person);
      }
    }
  }
  const rosters = historyData().rosters(year);
  const on = new Set<string>();
  for (const id of Object.keys(s.teams) as TeamId[]) {
    const t = s.teams[id]!;
    t.roster = [];
    t.depth = {};
    t.active = activeTeamIds(year).includes(id);
  }
  for (const [teamId, list] of rosters) {
    const t = s.teams[teamId];
    if (!t) continue;
    for (const { person, jersey } of list) {
      if (rookies.has(person)) continue;
      const p = playerFor(s, person, year, teamId);
      if (on.has(p.id)) continue;
      on.add(p.id);
      p.teamId = teamId;
      if (jersey) p.jersey = jersey;
      const born = historyData().people[person]?.birth;
      if (born) p.age = year - Number(born.slice(0, 4));
      p.yearsPro = Math.max(0, year - (historyData().firstSeason(person) ?? year));
      t.roster.push(p.id);
    }
  }
  for (const p of Object.values(s.players)) {
    if (on.has(p.id) || p.teamId === "hof" || p.teamId === "retired") continue;
    const person = parseInt(p.id.slice(2), 36);
    const last = historyData().lastSeason(person);
    // Gone before this season, or a pick who never made a roster: out of the league.
    if (last === undefined || last < year) {
      p.teamId = "retired";
      p.retiredYear = last ?? p.draftYear ?? year - 1;
    } else p.teamId = "fa";
  }
  pruneRetired(s);
  // The year's real head coaches, rated.
  s.year = year;
  seatCoaches(s);
  rateCoaches(s, year);
  seedStaff(s);

  for (const p of Object.values(s.players)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    rateReal(s, p, year);
  }
  // The owner's own undrafted class (data/friends.ts) is in the league however late it starts:
  // a class already past is on the market, a few seasons further along.
  for (const [fy, list] of Object.entries(FRIENDS)) {
    const from = Number(fy);
    if (from >= year) continue;
    for (const seed of list) {
      const p = realDraftee(s, seed, from);
      const years = year - from;
      p.age += years;
      p.yearsPro = years;
      // A real undrafted player's climb: steady, not straight to the top. The rest of the
      // ceiling is still there for the dynasty to see him reach.
      moveToward(p, p.gem ? Math.min(seed.ceiling - 6, Math.round(seed.start + years * 1.5)) : Math.min(p.potential, seed.start + years));
      p.peakOvr = p.ovr;
      p.scoutOvr = p.ovr;
      p.revealed = true;
    }
  }
  const before = new Set(Object.keys(s.players));
  const market = Object.values(s.players).filter((p) => p.teamId === "fa" && p.historical);
  for (const id of activeTeamIds(year)) {
    balanceLine(s, id);
    // Only the depth chart's holes are filled now: the rest of the roster is for this
    // year's real draft class, which is on the board.
    for (const [pos, need] of DEPTH_CHART) {
      for (let have = rosterOf(s, id).filter((p) => p.pos === pos).length; have < need; have++) {
        if (!signRealFa(s, id, pos, market)) generatePlayer(s, pos, id, 58, randInt(s, 23, 29));
      }
    }
    syncDepth(s, id);
  }
  // Depth the game had to add is depth: it never outranks the real players it stands behind.
  for (const [pid, p] of Object.entries(s.players)) {
    if (before.has(pid) || !s.teams[p.teamId as TeamId]) continue;
    if (p.ovr > 64) moveToward(p, 60 + (p.ovr % 5));
    p.potential = Math.min(p.potential, p.ovr + 4);
    p.peakOvr = p.ovr;
  }
  signFriends(s, activeTeamIds(year));
  refreshContracts(s, { init: true });
  s.draftSession = "common";
  s.draftBoard = [];
  ensureSeasonPicks(s);
  buildDraftBoard(s);
  rebuildSchedule(s);
  s.playoffGames = [];
  s.superBowl = undefined;
  s.awards = undefined;
  s.phase = "draft";
  s.week = 0;
  setLabel(s);
  syncRealNumbers(s);
  normalizeJerseys(s);
  s.jerseyEra = true;
  const champ = s.history.superBowls.at(-1);
  const champId = champ ? ((champ.homeScore >= champ.awayScore ? champ.homeId : champ.awayId) as TeamId) : undefined;
  const star = rosterOf(s, o.userTeamId).sort((a, b) => b.ovr - a.ovr)[0];
  addNews(s, o.sandbox
    ? {
        kind: "headline",
        headline: `The ${year} season is about to begin`,
        body: `Every roster is the real ${year} roster${champId ? `, and the ${displayName(year - 1, champId)} are the champions` : ""}. Sit back and watch it unfold.`,
        teamIds: champId ? [champId] : [],
        playerIds: [],
      }
    : {
        kind: "headline",
        headline: `A new dynasty in ${displayName(year, o.userTeamId)}`,
        body: `It's ${year}. The real roster is yours${star ? `, ${playerName(star)} and all` : ""}. The ${year} draft is open. Rewrite football history from here.`,
        teamIds: [o.userTeamId],
        playerIds: star ? [star.id] : [],
      });
  return s;
}
