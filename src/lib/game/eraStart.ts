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
import { ageBodyBetween } from "./body.ts";
import { CAREER_SPOT } from "./data/realSpots.ts";
import { advanceHistory, coachFor, createHistoryGame, hasHistoryData, ROSTERS_LAST, historyData, playerFor, seatCoaches } from "./historyMode.ts";
import { normalizedName } from "./identity.ts";
import { buildDraftBoard, ensureSeasonPicks, realDraftee } from "./draft.ts";
import { draftSeedsFor } from "./data/draftClasses.ts";
import { FRIENDS } from "./data/friends.ts";
import { arcTarget, calibrateVetPeak, gradeTo, honorsFloor, lookupArc, moveToward } from "./careerArc.ts";
import { DEPTH_CHART, emptyStats, generatePlayer, normalizeJerseys, playerName, retiredFor, rosterOf, signFriends, signRealFa, syncDepth } from "./players.ts";
import { jerseyFor } from "./names.ts";
import { cpuHandles } from "./teamControl.ts";
import { randInt } from "./rng.ts";
import { deriveOvr } from "./ratings.ts";
import { refreshContracts } from "./salary.ts";
import { rebuildSchedule } from "./schedule.ts";
import { activeTeamIds, displayName, gamesInSeason } from "./teams.ts";
import { addNews } from "./news.ts";
import { setLabel } from "./season.ts";
import { autoHireCoord, fillCoachFields, makeCoachFromSeed, realCoordinator, seedStaff } from "./staff.ts";
import { COACHES_1966, EXPANSION_COACHES, LATER_COACHES } from "./data/coaches.ts";
import { MORE_COACHES } from "./data/coachesMore.ts";
import { newOwnerState } from "./owner.ts";
import { ensureContracts } from "./coachContracts.ts";
import type { Coach, DynastySave, Player, Pos, SeasonStats, TeamId } from "./types.ts";

/**
 * The seasons a league can start in: every one the record has rosters for. 1966 is the classic
 * start; the rest begin from that year's real rosters.
 */
export const ERA_STARTS: readonly number[] = Array.from({ length: ROSTERS_LAST - 1966 + 1 }, (_, i) => 1966 + i);

const nameKey = (f: string, l: string) => `${f}|${l}`.toLowerCase().replace(/[^a-z|]/g, "");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** What a season's line says about a player, on the game's overall scale. */
/**
 * How a season's passing and rushing compare with the 2010s, per team-game, from the record: a
 * 2,400-yard passer in 1972 was a top-five quarterback, and on modern yardage bars he scored like
 * a backup (John Hadl, Fran Tarkenton and Jim Hart all rated in the 70s).
 */
const eraScales = new Map<number, { pass: number; rush: number }>();
function eraScale(year: number): { pass: number; rush: number } {
  const have = eraScales.get(year);
  if (have) return have;
  const league = (y: number) => {
    let pass = 0;
    let rush = 0;
    for (const { line } of historyData().stats(y)) {
      if ((line.passYds ?? 0) > 0) pass += line.passYds!;
      if ((line.rushYds ?? 0) > 0) rush += line.rushYds!;
    }
    const teamGames = activeTeamIds(y).length * gamesInSeason(y);
    return { pass: pass / teamGames, rush: rush / teamGames };
  };
  let out = { pass: 1, rush: 1 };
  if (hasHistoryData()) {
    const now = league(year);
    let pass = 0;
    let rush = 0;
    for (let y = 2010; y <= 2019; y++) {
      const l = league(y);
      pass += l.pass / 10;
      rush += l.rush / 10;
    }
    if (now.pass > 0 && now.rush > 0) out = { pass: clamp(pass / now.pass, 0.8, 1.8), rush: clamp(rush / now.rush, 0.8, 1.4) };
  }
  eraScales.set(year, out);
  return out;
}

function lineScore(pos: Pos, st: SeasonStats): number | undefined {
  const k = 16 / Math.max(12, gamesInSeason(st.year));
  const era = eraScale(st.year);
  const gp = st.gp ?? 0;
  const unknown = new Set((st as SeasonStats & { unknown?: string[] }).unknown ?? []);
  const games = 58 + Math.min(gp * k, 16) * 0.85;
  switch (pos) {
    case "QB": {
      if ((st.passAtt ?? 0) < 120) return gp ? 60 + Math.min(gp, 8) : undefined;
      const v = (st.passYds ?? 0) * k * era.pass;
      return 60 + clamp((v - 1200) / 3300, 0, 1) * 28 + clamp(((st.passTd ?? 0) - (st.passInt ?? 0)) * k, -10, 25) * 0.25;
    }
    case "RB":
      return 58 + clamp((((st.rushYds ?? 0) * era.rush + 0.6 * (st.recYds ?? 0) * era.pass) * k) / 1800, 0, 1) * 32;
    case "FB":
      return 62 + clamp((((st.rushYds ?? 0) * era.rush + (st.recYds ?? 0) * era.pass) * k) / 900, 0, 1) * 18;
    case "WR":
      return 58 + clamp(((st.recYds ?? 0) * k * era.pass) / 1450, 0, 1) * 32;
    case "TE":
      return 60 + clamp(((st.recYds ?? 0) * k * era.pass) / 1050, 0, 1) * 28;
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
  // His recent seasons already show any slide; this is only the next year's. At 1.2 a year from
  // 32, Rich Gannon came into his 2002 MVP season a 72 and Reggie White his DPOY year an 80.
  if (p.age >= 34) v -= (p.age - 33) * 0.7;
  return Math.round(clamp(v, 48, 95));
}

/**
 * How good a real player was the season a league opens on, from that season itself: the career
 * arc is a smooth curve through a man's prime, and the year a league starts on can sit anywhere
 * on it (Brett Favre's 2006 was no 95; Larry Johnson's 1,789 yards were no 85).
 * - That season's honors set a floor: first-team All-Pro, second team, the Pro Bowl, the MVP.
 * - Where the box score measures the job (passers, runners, receivers, kickers), that season's
 *   line, with the one before it, pulls the rating toward what he really did.
 * - No honor that season or either side of it, and no 90s: those are for the men who won them.
 */
const MEASURED: ReadonlySet<Pos> = new Set(["QB", "RB", "WR", "TE", "K", "P"]);
const DEFENSE: ReadonlySet<Pos> = new Set(["DE", "DT", "OLB", "MLB", "CB", "S"]);
/** The season's line has the stat his position is judged on. */
function recorded(pos: Pos, st: SeasonStats): boolean {
  if (pos === "DE" || pos === "DT" || pos === "OLB") return st.sacks !== undefined;
  if (pos === "MLB") return st.tackles !== undefined;
  if (pos === "CB" || pos === "S") return st.ints !== undefined;
  return true;
}
const seasonLines = new Map<number, Map<number, SeasonStats>>();
function seasonLine(person: number, year: number): SeasonStats | undefined {
  let byPerson = seasonLines.get(year);
  if (!byPerson) {
    byPerson = new Map();
    for (const { person: who, line } of historyData().stats(year)) {
      const have = byPerson.get(who) ?? ({ year } as SeasonStats);
      for (const [k, v] of Object.entries(line)) {
        if (typeof v === "number") (have as unknown as Record<string, number>)[k] = ((have as unknown as Record<string, number>)[k] ?? 0) + v;
      }
      byPerson.set(who, have);
    }
    seasonLines.set(year, byPerson);
  }
  return byPerson.get(person);
}
/** The units a league ranks a season's men in, and how many of each a club starts. */
const UNIT: Record<Pos, string> = {
  QB: "QB", RB: "RB", FB: "FB", WR: "WR", TE: "TE", LT: "T", RT: "T", LG: "G", RG: "G", C: "C",
  DE: "DE", DT: "DT", OLB: "OLB", MLB: "MLB", CB: "CB", S: "S", K: "K", P: "P",
};
/** A fullback, a kicker or a punter is never the best player in the league. */
const CEILING: Record<string, number> = { FB: 88, K: 95, P: 95 };
const STARTING: Record<string, number> = { QB: 1, RB: 1, FB: 0.7, WR: 2.5, TE: 1, T: 2, G: 2, C: 1, DE: 2, DT: 2, OLB: 2, MLB: 1.3, CB: 2.4, S: 2, K: 1, P: 1 };

/** What the record says about a man's season, on the overall scale, before he's ranked. */
function seasonScore(p: Player, year: number): number {
  const person = parseInt(p.id.slice(2), 36);
  const h = historyData();
  let score = p.ovr;
  // That season and the two before it, the nearest counting most. A defender's line counts
  // only where the record kept his stat (sacks from 1982, tackles from 1999) and counts less.
  const weights = [0.5, 0.35, 0.15];
  let sum = 0;
  let total = 0;
  [year, year - 1, year - 2].forEach((y, k) => {
    const st = seasonLine(person, y);
    if (!st || !recorded(p.pos, st)) return;
    const v = lineScore(p.pos, st);
    if (v === undefined) return;
    sum += v * weights[k]!;
    total += weights[k]!;
  });
  if (total > 0) {
    const share = MEASURED.has(p.pos) ? 0.75 : DEFENSE.has(p.pos) ? 0.35 : 0;
    score = score * (1 - share) + (sum / total) * share;
  }
  const BONUS = { "1": 7, "2": 5, p: 3 } as const;
  const now = h.honors(year).get(person);
  const before = h.honors(year - 1).get(person);
  const after = h.honors(year + 1).get(person);
  if (now) score += BONUS[now];
  if (before) score += BONUS[before] / 2;
  if (after) score += 1;
  const awards = h.awards(year);
  if ((awards.mvp ?? []).includes(person)) score += 5;
  if ((awards.opoy ?? []).includes(person) || (awards.dpoy ?? []).includes(person)) score += 3;
  // The depth charts (2001 on): a starter all season, or a man who didn't start.
  const weeks = h.chartWeeks(year);
  if (weeks) {
    const share = Math.min(1, (h.starters(year).get(person)?.starts ?? 0) / weeks);
    score += share * 10 - 4;
    const prior = h.chartWeeks(year - 1);
    if (prior) score += (Math.min(1, (h.starters(year - 1).get(person)?.starts ?? 0) / prior) - 0.5) * 3;
  }
  return score;
}

/**
 * Every real man on a club, rated on his season against the league: within each unit
 * (quarterbacks, tackles, corners...), what the record says about him sets his rank, and the
 * rank sets his rating on a depth chart's scale. The best at his job is in the high 90s, the
 * last regular starter in the mid-70s, the backups below; honors keep a floor.
 */
function rankSeason(s: DynastySave, year: number): void {
  const teams = activeTeamIds(year).length;
  const h = historyData();
  const units = new Map<string, { p: Player; score: number }[]>();
  for (const id of activeTeamIds(year)) {
    for (const p of rosterOf(s, id)) {
      if (!p.id.startsWith("r-") || p.yearsPro < 1) continue;
      const unit = UNIT[p.pos];
      const list = units.get(unit) ?? [];
      list.push({ p, score: seasonScore(p, year) });
      units.set(unit, list);
    }
  }
  const FLOOR = { "1": 90, "2": 87, p: 84 } as const;
  const weeks = h.chartWeeks(year);
  const startedIn = (y: number, person: number) => (h.starters(y).get(person)?.starts ?? 0) / Math.max(1, h.chartWeeks(y)) >= 0.5;
  // A star who started and was honored the year before is still a starter when the season opens,
  // though he went down early that year (Rod Woodson's knee, 1995).
  const started = (p: Player) => {
    const person = parseInt(p.id.slice(2), 36);
    return startedIn(year, person) || (startedIn(year - 1, person) && h.honors(year - 1).has(person));
  };
  for (const [unit, list] of units) {
    // Where the record says who started (games started to 2000, the depth charts from 2001), the
    // men who started half the season are the starters, ranked among themselves; otherwise a
    // club's usual number at the job.
    let starters = Math.max(1, Math.round(teams * STARTING[unit]!));
    if (weeks) {
      list.sort((a, b) => Number(started(b.p)) - Number(started(a.p)) || b.score - a.score);
      starters = Math.max(1, list.filter(({ p }) => started(p)).length);
    } else list.sort((a, b) => b.score - a.score);
    list.forEach(({ p }, i) => {
      let target: number;
      // The few best at a job stand apart; the rest of the starters spread down to the mid-70s.
      const top = 1 - i / Math.max(1, starters - 1);
      if (i < starters) target = 74 + 23 * (0.7 * Math.pow(top, 4.5) + 0.3 * top);
      else target = 72 - 14 * Math.pow((i - starters) / Math.max(1, list.length - starters), 0.8);
      const honor = h.honors(year).get(parseInt(p.id.slice(2), 36));
      if (honor) target = Math.max(target, FLOOR[honor]);
      target = Math.round(Math.min(target, CEILING[unit] ?? 99));
      // An owner-graded player follows the owner's arc: the league's ranking doesn't pull him
      // under it (it had Roethlisberger at 76 in 2005, speed and all, against an 83 draft grade),
      // and only an honor lifts him above it, never past the owner's peak.
      if (p.arcGap !== undefined) target = Math.min(Math.max(p.ovr, honor ? FLOOR[honor] : 0), p.potential);
      if (target === p.ovr) return;
      moveToward(p, target);
      if (p.ovr < target) gradeTo(p, target);
      p.potential = Math.max(p.potential, p.ovr);
      p.peakOvr = Math.max(p.peakOvr, p.ovr);
    });
  }
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
    p.arcGap = made.arcGap;
    delete save.players[made.id];
    const idx = year - p.draftYear!;
    // Draft-day legs, aged to this season.
    ageBodyBetween(p, p.age - idx, p.age);
    p.ovr = deriveOvr(p.pos, p.ratings);
    let peak = p.ovr;
    for (let i = 0; i <= idx; i++) peak = Math.max(peak, arcTarget(p, i));
    moveToward(p, arcTarget(p, idx));
    if (p.arcGap !== undefined && p.ovr < arcTarget(p, idx)) gradeTo(p, arcTarget(p, idx));
    // Production can't lift him past his real peak, but a lean arc gives way to a big year.
    // An owner-graded peak is his peak: production doesn't move it.
    const real = productionOvr(p, year);
    if (real > p.ovr + 2 && p.arcGap === undefined) {
      // A late bloomer's real peak came after the counting stats that set his seed: Gannon's
      // journeyman years capped him below the MVP he became. What he's doing now sets it, and a
      // final season after a 2,000-yard one (Barry Sanders, 1998) doesn't start on the fade.
      if (real - 1 > p.potential) p.potential = real - 1;
      moveToward(p, Math.min(p.potential, real - 2));
    }
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
function balanceLine(s: DynastySave, id: TeamId, known: ReadonlySet<string> = new Set()): void {
  // A man the record puts at a spot stays at it: only the ones it doesn't place are moved.
  const roster = rosterOf(s, id).filter((p) => !known.has(p.id));
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
    const have = rosterOf(s, id).filter((p) => p.pos === to).length;
    const pool = roster.filter((p) => p.pos === from).sort((a, b) => heft(b) - heft(a) || a.ovr - b.ovr);
    // Never strip the spot he's moving from below what it needs itself.
    const keep = DEPTH_CHART.find(([pos]) => pos === from)?.[1] ?? 2;
    for (let n = have; n < want && pool.length > keep; n++) shift(pool.shift()!, to);
  }
}

/** Coaches the record seated get the game's ratings: from the coach catalogs when he's in them. */
function rateCoaches(save: DynastySave, year: number): void {
  for (const c of Object.values(save.coaches)) rateCoach(c, year);
}

let catalogByName: Map<string, (typeof LATER_COACHES)[number]> | undefined;

function rateCoach(c: Coach, year: number): void {
  catalogByName ??= new Map([...COACHES_1966, ...EXPANSION_COACHES, ...LATER_COACHES, ...MORE_COACHES].map((x) => [x.name.toLowerCase(), x]));
  const catalog = catalogByName;
  {
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

/**
 * The first season of a league begun from the record opens on the real rosters exactly, with
 * no signings before the draft. Once the draft is in, every club (the owner's too) fills what
 * its depth chart is still missing: real free agents first, a camp body at the spot only when
 * the market has nobody for it.
 */
export function openingFill(save: DynastySave): void {
  if (!save.realPool || save.realHistory || save.year !== save.startingYear) return;
  const before = new Set(Object.keys(save.players));
  const market = Object.values(save.players).filter((p) => p.teamId === "fa" && p.historical);
  for (const id of activeTeamIds(save.year)) {
    if (!cpuHandles(save, id, "roster")) continue;
    for (const [pos, need] of DEPTH_CHART) {
      for (let have = rosterOf(save, id).filter((p) => p.pos === pos).length; have < need; have++) {
        if (!signRealFa(save, id, pos, market)) generatePlayer(save, pos, id, 58, randInt(save, 23, 29));
      }
    }
    syncDepth(save, id);
  }
  // Depth the game had to add is depth: it never outranks the real players it stands behind.
  for (const [pid, p] of Object.entries(save.players)) {
    if (before.has(pid) || !save.teams[p.teamId as TeamId]) continue;
    if (p.ovr > 64) moveToward(p, 60 + (p.ovr % 5));
    p.potential = Math.min(p.potential, p.ovr + 4);
    p.peakOvr = p.ovr;
  }
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
      st.unknown = [...new Set([
        ...(st.unknown ?? []),
        "defTd", "krTd", "prTd", "pts",
        ...(y < 1999 ? ["tackles", "ff", "tfl", "pd"] : []),
        ...(y < 1970 ? ["sacks"] : []),
      ])];
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
  leagueSandbox?: boolean;
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
  s.leagueSandbox = o.leagueSandbox ? true : undefined;
  s.leagueControl = o.leagueSandbox ? {} : undefined;
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
  // Week one where the record has it (2002 on): the men the club really opened with, not
  // everyone it had at some point that season (December signings, the practice squad).
  const opening = historyData().opening(year);
  const jerseyOf = new Map<string, number>();
  for (const [teamId, list] of rosters)
    for (const { person, jersey } of list) if (jersey !== undefined) jerseyOf.set(`${teamId}|${person}`, jersey);
  const seasonPos = historyData().seasonPos(year);
  const spotOf = new Map<number, Pos>();
  let placed = rosters;
  // On the club's reserve list in week one (injured reserve, PUP, a suspension).
  const reserve = new Map<number, number | undefined>();
  if (opening.size) {
    placed = new Map();
    for (const [teamId, list] of opening) {
      for (const { person, pos, reserve: r, weeksOut } of list) {
        spotOf.set(person, pos);
        if (r) reserve.set(person, weeksOut);
      }
      placed.set(teamId, list.map(({ person }) => ({ person, jersey: jerseyOf.get(`${teamId}|${person}`) })));
    }
  }
  const on = new Set<string>();
  for (const id of Object.keys(s.teams) as TeamId[]) {
    const t = s.teams[id]!;
    t.roster = [];
    t.depth = {};
    t.active = activeTeamIds(year).includes(id);
  }
  for (const [teamId, list] of placed) {
    const t = s.teams[teamId];
    if (!t) continue;
    for (const { person, jersey } of list) {
      if (rookies.has(person)) continue;
      // 1987's strike games: the replacement players weren't anyone's opening roster.
      if (year === 1987 && historyData().firstSeason(person) === 1987 && historyData().lastSeason(person) === 1987) continue;
      const p = playerFor(s, person, year, teamId);
      if (on.has(p.id)) continue;
      on.add(p.id);
      p.teamId = teamId;
      if (jersey !== undefined) p.jersey = jersey;
      const born = historyData().people[person]?.birth;
      if (born) p.age = year - Number(born.slice(0, 4));
      p.yearsPro = Math.max(0, year - (historyData().firstSeason(person) ?? year));
      if (reserve.has(person)) {
        const out = reserve.get(person);
        if (out) {
          // Away from the club for the first weeks (a suspension, the PUP list) and back the week
          // he really returned. Not injured reserve, which before 2012 ended a man's season.
          p.injuredWeeks = Math.max(p.injuredWeeks, out);
          p.injuryName ??= "reserve list";
        } else {
          p.onIR = true;
          p.injuredWeeks = Math.max(p.injuredWeeks, 6);
          p.injuryName ??= "reserve list";
        }
      }
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
  // Who really made each club that season, so the first cuts keep them: week one where the record
  // has it (2002 on, with the rookies the club really kept), before that the men who played at
  // least four games for the club.
  const keep: Record<string, TeamId> = {};
  if (opening.size) {
    for (const [teamId, list] of opening) for (const { person } of list) keep[`r-${person.toString(36)}`] = teamId;
  } else {
    for (const row of historyData().stats(year)) if (row.team && (row.line.gp ?? 0) >= 4) keep[`r-${row.person.toString(36)}`] = row.team;
  }
  s.openingRoster = { year, keep };
  // The year's real head coaches, rated.
  s.year = year;
  seatCoaches(s);
  rateCoaches(s, year);
  seedStaff(s);
  seatRealCoordinators(s, year, false);
  ensureContracts(s);

  // Men the record puts at a spot that season: the depth chart's, or the roster's own listing.
  const placedAt = new Set<string>();
  for (const p of Object.values(s.players)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    rateReal(s, p, year);
    // The spot he played that season (a corner moved to safety, an end stood up at
    // linebacker), at the level he's rated.
    if (!p.id.startsWith("r-")) continue;
    const person = parseInt(p.id.slice(2), 36);
    // The depth chart's spot first (it names the side and the linebacker's job), then the roster's.
    const chart = historyData().starters(year).get(person);
    const charted = chart?.spot;
    if (chart?.role) p.role = chart.role;
    // A season with no spot for him (a backup, a year off the chart): where he mostly started.
    const career = CAREER_SPOT[person.toString(36)];
    let spot = charted ?? spotOf.get(person) ?? seasonPos.get(person) ?? career;
    // A season's listing can file a punter who kicked off as a kicker (Jason Baker, 2005):
    // kickers and punters stay what their careers were.
    const specialist = (x?: Pos) => x === "K" || x === "P";
    if (specialist(spot) && specialist(p.pos)) spot = career ?? p.pos;
    if (charted || seasonPos.has(person) || (career && !spotOf.has(person))) placedAt.add(p.id);
    if (spot && spot !== p.pos) {
      const level = p.ovr;
      p.pos = spot;
      p.ovr = deriveOvr(spot, p.ratings);
      moveToward(p, level);
    }
  }
  rankSeason(s, year);
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
  // The league opens on the real rosters and nothing else: no club signs anyone before the
  // draft. The holes are filled after it, in free agency, the way the clubs really filled them.
  for (const id of activeTeamIds(year)) {
    balanceLine(s, id, placedAt);
    syncDepth(s, id);
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

/**
 * The record's coaching carousel, in a league begun from it: a club still on the head coach it
 * really had makes the change it really made that winter (Cowher out and Tomlin in at
 * Pittsburgh after 2006), unless he's winning big here, where the record's reason to move on
 * is gone. A club the league has already taken off the record's path (a coach it fired or
 * hired on its own) goes its own way, and one whose coach the record kept keeps him unless the
 * season here was a collapse. Runs just before Black Monday's own calls; the carousel makes the hire.
 */
export function realBlackMonday(save: DynastySave): void {
  if (!save.realPool || !hasHistoryData() || save.realHistory) return;
  const now = historyData().coaches(save.year);
  const next = historyData().coaches(save.year + 1);
  if (!now.size || !next.size) return;
  if (save.coachSearch?.year !== save.year) save.coachSearch = { year: save.year, cuts: [], hot: [], interviews: [], midseason: 0 };
  const search = save.coachSearch;
  const inPlayoffs = new Set(save.playoffGames.filter((g) => g.year === save.year).flatMap((g) => [g.homeId, g.awayId]));
  for (const id of activeTeamIds(save.year)) {
    if (!cpuHandles(save, id, "staff")) continue;
    const t = save.teams[id];
    const hc = t?.coachId ? save.coaches[t.coachId] : undefined;
    const year = now.get(id) ?? [];
    const was = year.at(-1)?.name;
    const will = next.get(id)?.[0]?.name;
    if (!t || !hc || !was || !will) continue;
    const g = t.wins + t.losses + t.ties;
    const pct = g ? (t.wins + t.ties / 2) / g : 0.5;
    // Still on the record's path if he's any of the men who coached the club that year (Marion
    // Campbell in Philadelphia 1985, though an interim had the last game).
    if (!year.some((x) => x.name.toLowerCase() === hc.name.toLowerCase())) {
      // Off the record's path: the club makes its own calls, but in a winter the real one kept its
      // coach it is slower to fire (Black Monday ran two or three over the real league's six or so).
      if (was === will && pct >= 0.22 && randInt(save, 0, 1) === 0) (search.keep ??= []).push(id);
      continue;
    }
    // The record kept him: only a collapse here costs him the job.
    if (hc.name.toLowerCase() === will.toLowerCase()) {
      if (pct >= 0.25) (search.keep ??= []).push(id);
      continue;
    }
    if (pct >= 0.7) continue;
    const c = Object.values(save.coaches).find((x) => x.name.toLowerCase() === will.toLowerCase() && !x.retiredYear) ?? coachFor(save, will, save.year + 1);
    if (!c.offense && !c.defense) rateCoach(c, save.year + 1);
    save.coaches[c.id] = c;
    (search.real ??= {})[id] = c.id;
    if (search.cuts.includes(id)) continue;
    search.cuts.push(id);
    if (inPlayoffs.has(id)) continue;
    addNews(save, {
      kind: "headline",
      headline: `${displayName(save.year, id)} move on from ${hc.name}`,
      body: `After ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}, the club starts a search.`,
      teamIds: [id],
      playerIds: [],
    });
  }
}

/**
 * The record's coordinators. At the start every club gets the ones it really had that season;
 * each winter after (onPath) a computer club still on the record's head coach takes on his real
 * staff for the next one (McVay running Washington's offense before the Rams hire him). Clubs
 * off the record's path, and seasons whose staff the record doesn't name, hire as they always have.
 */
export function seatRealCoordinators(save: DynastySave, year: number, onPath: boolean): void {
  if (!save.realPool || !hasHistoryData() || save.realHistory) return;
  const rec = historyData().coordinators(year);
  if (!rec.size) return;
  const heads = historyData().coaches(year);
  const vacated: [TeamId, "OC" | "DC"][] = [];
  for (const id of activeTeamIds(year)) {
    const t = save.teams[id];
    const names = rec.get(id);
    if (!t || !names) continue;
    if (!cpuHandles(save, id, "staff")) continue;
    if (onPath) {
      const hc = t.coachId ? save.coaches[t.coachId] : undefined;
      const real = heads.get(id)?.[0]?.name;
      if (!hc || !real || hc.name.toLowerCase() !== real.toLowerCase()) continue;
    }
    for (const role of ["OC", "DC"] as const) {
      const name = role === "OC" ? names.oc : names.dc;
      const slot = role === "OC" ? "ocId" : "dcId";
      if (!name) continue;
      const now = t[slot] ? save.coaches[t[slot]!] : undefined;
      if (now?.name.toLowerCase() === name.toLowerCase()) continue;
      const c = realCoordinator(save, name, role, id);
      // A head coach somewhere in this league stays one.
      if (activeTeamIds(year).some((o) => save.teams[o]?.coachId === c.id)) continue;
      // Hired away from another staff: that club refills the job once everyone has moved.
      const from = c.teamId && c.teamId !== id ? c.teamId : undefined;
      if (from) {
        const ft = save.teams[from];
        if (ft?.ocId === c.id) {
          ft.ocId = null;
          vacated.push([from, "OC"]);
        }
        if (ft?.dcId === c.id) {
          ft.dcId = null;
          vacated.push([from, "DC"]);
        }
      }
      // The man in the job leaves it, unless he's moved up to head coach here.
      if (now && now.id !== t.coachId) {
        now.teamId = null;
        now.yearsOnJob = 0;
      }
      c.role = role;
      c.teamId = id;
      c.yearsOnJob = 1;
      t[slot] = c.id;
    }
  }
  for (const [id, role] of vacated) {
    const t = save.teams[id];
    if (t && !(role === "OC" ? t.ocId : t.dcId)) autoHireCoord(save, id, role);
  }
}

