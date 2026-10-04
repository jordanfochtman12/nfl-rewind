/**
 * The season preview special. Every club, one by one: what the roster says, what the schedule
 * says, how two thousand simulated seasons came out, and the calls the desk is willing to put
 * on the record. Pure: it reads the save and draws from its own seeded generator, so watching
 * the show never changes how the season plays.
 */
import type {
  Coach,
  DynastySave,
  GameResult,
  Player,
  PreviewPicks,
  PreviewTeam,
  SeasonPreview,
  TeamId,
} from "./types.ts";
import { activeTeamIds, conferenceOf, displayName, divisionKey, gamesInSeason, locationOf, nicknameOf, roman, superBowlNumber, teamAbbr } from "./teams.ts";
import { playerName, rosterOf, starters } from "./players.ts";
import { teamUnits } from "./sim.ts";
import { eraProfile, playoffTeamCount } from "./era.ts";
import { careerTotals } from "./leaders.ts";
import { isRivalry, realSchedule, rebuildSchedule } from "./schedule.ts";
import { cloneSave } from "./save.ts";
import { expansionForYear } from "./data/expansions.ts";
import { relocationsForYear } from "./data/relocations.ts";
import { REAL_POSTSEASON } from "./data/realPostseason.ts";
import { realRecords } from "./timeline.ts";
import { compose, crewFor, eraColor, fill, ORD_WORDS, P, tenure, vary } from "./previewVoice.ts";
import { seriesNote } from "./h2h.ts";

type Episode = SeasonPreview["episode"];
type Line = Episode["chapters"][number]["lines"][number];

/** The crew. Original characters; the cadence is the classic Sunday-morning studio. */
export const PREVIEW_CAST = {
  HOST: { name: "Rich Delaney", role: "Host" },
  ANALYST: { name: "Marcus “Hammer” Boyd", role: "Analyst · 11 seasons, linebacker" },
  REPORTER: { name: "Dana Whitfield", role: "League insider" },
} as const;

/* ------------------------------------------------------------------ helpers */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable choice from a list: same save, same words. */
function pick<T>(key: string, list: readonly T[]): T {
  return list[hash(key) % list.length]!;
}

const recText = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ""}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
const numberWord = (n: number) =>
  ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen"][n] ?? String(n);
const comma = (n: number) => Math.round(n).toLocaleString("en-US");

/** American odds from a probability, rounded the way a board shows them. */
export function oddsOf(p: number): string {
  const q = Math.min(0.97, Math.max(0.004, p));
  if (q >= 0.5) return `-${Math.round(((q / (1 - q)) * 100) / 10) * 10}`;
  const raw = ((1 - q) / q) * 100;
  const step = raw >= 2000 ? 500 : raw >= 1000 ? 100 : raw >= 400 ? 50 : 25;
  return `+${Math.round(raw / step) * step}`;
}

const isClub = (p: Player) => p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof";
const OFF = new Set(["QB", "RB", "FB", "WR", "TE"]);
const DEF = new Set(["DE", "DT", "OLB", "MLB", "CB", "S"]);

/* ------------------------------------------------------------------ strength */

/**
 * Club strength on the same footing the game is played on: the sim's own unit ratings,
 * weighted by how much the era throws. One point here is worth about a point on the line.
 */
function strengthOf(save: DynastySave, id: TeamId): { r: number; off: number; def: number } {
  const u = teamUnits(save, id);
  const era = eraProfile(save.year);
  const pw = era.passAtt / (era.passAtt + era.rushAtt);
  const off = u.offPass * pw + u.offRun * (1 - pw);
  const def = u.defPass * pw + u.defRun * (1 - pw);
  return { r: off + def, off, def };
}

/** Points of spread per point of strength, fit against simulated seasons. */
const SPREAD_K = 0.6;
const HOME = 2.5;
const winP = (spread: number) => 1 / (1 + Math.exp(-spread / 6.5));

/* ------------------------------------------------------------------ the projection */

/**
 * The season's games. Camp runs before the schedule is installed at kickoff, so the preview
 * reads it straight from the real schedule (pure data); years past the data get a scratch copy
 * scheduled on a throwaway save, so the real one's generator is never touched.
 */
function seasonSchedule(save: DynastySave): GameResult[] {
  const year = save.year;
  const have = save.schedule.filter((g) => g.year === year && g.phase === "regular");
  if (have.length) return have;
  const real = realSchedule(year);
  if (real?.length) return real.filter((g) => g.phase === "regular");
  const scratch = cloneSave(save);
  rebuildSchedule(scratch);
  return scratch.schedule.filter((g) => g.year === year && g.phase === "regular");
}

interface Sim {
  wins: Map<TeamId, number[]>;
  div: Map<TeamId, number>;
  playoff: Map<TeamId, number>;
  conf: Map<TeamId, number>;
  title: Map<TeamId, number>;
  finish: Map<TeamId, number>;
  runs: number;
}

function simulate(save: DynastySave, ids: TeamId[], rating: Map<TeamId, number>, runs: number, schedule: GameResult[]): Sim {
  const year = save.year;
  const games = schedule.filter((g) => ids.includes(g.homeId as TeamId) && ids.includes(g.awayId as TeamId));
  const probs = games.map((g) => {
    const spread = (rating.get(g.homeId as TeamId)! - rating.get(g.awayId as TeamId)!) * SPREAD_K + (g.site ? 0 : HOME);
    return winP(spread);
  });
  const divOf = new Map(ids.map((id) => [id, divisionKey(year, id)]));
  const confOf = new Map(ids.map((id) => [id, conferenceOf(year, id) as string]));
  const divs = [...new Set(divOf.values())];
  const confs = [...new Set(confOf.values())];
  const field = playoffTeamCount(year);
  const out: Sim = { wins: new Map(ids.map((id) => [id, []])), div: new Map(), playoff: new Map(), conf: new Map(), title: new Map(), finish: new Map(), runs };
  const bump = (m: Map<TeamId, number>, id: TeamId, n = 1) => m.set(id, (m.get(id) ?? 0) + n);
  const rnd = mulberry(hash(`${year}-${save.userTeamId}-preview`));
  const w = new Map<TeamId, number>();
  for (let run = 0; run < runs; run++) {
    for (const id of ids) w.set(id, 0);
    for (let i = 0; i < games.length; i++) {
      const g = games[i]!;
      const winner = (rnd() < probs[i]! ? g.homeId : g.awayId) as TeamId;
      w.set(winner, w.get(winner)! + 1);
    }
    // Ties on wins go to the stronger club, with a coin for the rest.
    const key = (id: TeamId) => w.get(id)! + rating.get(id)! * 0.001 + rnd() * 0.0005;
    const winners = new Set<TeamId>();
    for (const d of divs) {
      const order = ids.filter((id) => divOf.get(id) === d).sort((a, b) => key(b) - key(a));
      order.forEach((id, i) => bump(out.finish, id, i + 1));
      winners.add(order[0]!);
      bump(out.div, order[0]!);
    }
    const confChamps: TeamId[] = [];
    for (const c of confs) {
      const teams = ids.filter((id) => confOf.get(id) === c);
      let seeds: TeamId[];
      if (year < 1970) {
        // Before the merger: division winners only (1969's AFL took two from each side).
        seeds = teams.filter((id) => winners.has(id));
        if (year === 1969 && c === "AFL") {
          const rest = teams.filter((id) => !winners.has(id)).sort((a, b) => key(b) - key(a)).slice(0, 2);
          seeds = [...seeds, ...rest];
        }
      } else {
        const dw = teams.filter((id) => winners.has(id)).sort((a, b) => key(b) - key(a));
        const wc = teams.filter((id) => !winners.has(id)).sort((a, b) => key(b) - key(a));
        seeds = [...dw, ...wc].slice(0, field.perConf);
      }
      for (const id of seeds) bump(out.playoff, id);
      // Single elimination, top seed against the bottom, home field to the better seed.
      let alive = seeds.slice();
      while (alive.length > 1) {
        const next: TeamId[] = [];
        if (alive.length % 2) next.push(alive[0]!);
        const start = alive.length % 2;
        const pairs = alive.slice(start);
        for (let i = 0; i < pairs.length / 2; i++) {
          const a = pairs[i]!;
          const b = pairs[pairs.length - 1 - i]!;
          const p = winP((rating.get(a)! - rating.get(b)!) * SPREAD_K + HOME);
          next.push(rnd() < p ? a : b);
        }
        alive = next;
      }
      if (alive[0]) {
        confChamps.push(alive[0]);
        bump(out.conf, alive[0]);
      }
    }
    if (confChamps.length === 2) {
      const [a, b] = confChamps as [TeamId, TeamId];
      const p = winP((rating.get(a)! - rating.get(b)!) * SPREAD_K);
      bump(out.title, rnd() < p ? a : b);
    } else if (confChamps[0]) bump(out.title, confChamps[0]);
    for (const id of ids) out.wins.get(id)!.push(w.get(id)!);
  }
  return out;
}

/* ------------------------------------------------------------------ grades */

const GRADE_STEPS: [number, string][] = [
  [0.06, "A+"],
  [0.16, "A"],
  [0.27, "A-"],
  [0.38, "B+"],
  [0.5, "B"],
  [0.6, "B-"],
  [0.7, "C+"],
  [0.8, "C"],
  [0.88, "C-"],
  [0.95, "D"],
  [1.01, "F"],
];
const letter = (p: number) => GRADE_STEPS.find(([cut]) => p < cut)![1];
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function groupScores(save: DynastySave, id: TeamId): Record<PreviewTeam["grades"][number]["key"], number> {
  const s = (pos: Player["pos"], n: number) => starters(save, id, pos, n).map((p) => p.ovr);
  const t = save.teams[id]!;
  const coach = (cid?: string | null) => (cid ? save.coaches[cid] : undefined);
  const hc = coach(t.coachId);
  const oc = coach(t.ocId);
  const dc = coach(t.dcId);
  return {
    QB: s("QB", 1)[0] ?? 50,
    Skill: avg([...s("RB", 1), ...s("WR", 3), ...s("TE", 1)]),
    Line: avg([...s("LT", 1), ...s("LG", 1), ...s("C", 1), ...s("RG", 1), ...s("RT", 1)]),
    Front: avg([...s("DE", 2), ...s("DT", 2), ...s("OLB", 2), ...s("MLB", 1)]),
    Secondary: avg([...s("CB", 3), ...s("S", 2)]),
    Coaching: avg([hc ? (hc.offense + hc.defense) / 2 + (hc.leadership ?? 60) * 0.2 : 55, oc?.offense ?? 55, dc?.defense ?? 55]),
  };
}

const GROUP_WORDS: Record<PreviewTeam["grades"][number]["key"], { good: string; bad: string }> = {
  QB: { good: "the quarterback", bad: "the quarterback position" },
  Skill: { good: "the weapons", bad: "a thin set of weapons" },
  Line: { good: "the offensive line", bad: "the protection up front" },
  Front: { good: "the front seven", bad: "a front seven that can be run on" },
  Secondary: { good: "the secondary", bad: "the back end of the defense" },
  Coaching: { good: "the coaching staff", bad: "the sideline" },
};

/* ------------------------------------------------------------------ the build */

export function buildSeasonPreview(save: DynastySave): SeasonPreview {
  const year = save.year;
  const ids = activeTeamIds(year).filter((id) => save.teams[id]);
  // In a sandbox nobody's club gets the home-team treatment.
  const u = (save.sandbox ? "" : save.userTeamId) as TeamId;
  const name = (id: TeamId) => displayName(year, id);
  const nick = (id: TeamId) => nicknameOf(year, id);
  const games = gamesInSeason(year);
  const str = new Map(ids.map((id) => [id, strengthOf(save, id)]));
  const rating = new Map(ids.map((id) => [id, str.get(id)!.r]));
  const schedule = seasonSchedule(save);
  const sim = simulate(save, ids, rating, 2000, schedule);
  const runs = sim.runs;
  const meanW = (id: TeamId) => avg(sim.wins.get(id)!);
  const ranked = ids.slice().sort((a, b) => meanW(b) - meanW(a) || rating.get(b)! - rating.get(a)!);
  const rankOf = new Map(ranked.map((id, i) => [id, i + 1]));
  const lastSb = save.history.superBowls.find((b) => b.year === year - 1);
  const lastChamp = lastSb ? ((lastSb.homeScore >= lastSb.awayScore ? lastSb.homeId : lastSb.awayId) as TeamId) : undefined;
  const lastRunner = lastSb ? ((lastSb.homeScore >= lastSb.awayScore ? lastSb.awayId : lastSb.homeId) as TeamId) : undefined;
  const lastPlayoff = new Set<TeamId>();
  for (const g of save.playoffGames) if (g.year === year - 1) lastPlayoff.add(g.homeId as TeamId), lastPlayoff.add(g.awayId as TeamId);
  if (lastSb) lastPlayoff.add(lastSb.homeId as TeamId), lastPlayoff.add(lastSb.awayId as TeamId);
  const lastRec = (id: TeamId) => {
    const t = save.teams[id]!;
    return { w: t.wins, l: t.losses, t: t.ties, playoffs: lastPlayoff.has(id) || undefined };
  };
  const newClubs = new Set((expansionForYear(year)?.clubs ?? []).map((c) => c.id as TeamId));
  const hcChange = new Map<TeamId, string>();
  for (const c of save.carousel ?? []) if (c.year === year - 1 && c.role === "HC" && c.fired !== c.hired) hcChange.set(c.teamId, c.hired);

  // Who moved where since last season, from last year's stat lines.
  const was = new Map<TeamId, Player[]>();
  const came = new Map<TeamId, Player[]>();
  for (const p of Object.values(save.players)) {
    const prev = p.stats[year - 1]?.teamId as TeamId | "two" | undefined;
    const now = isClub(p) ? (p.teamId as TeamId) : undefined;
    if (prev && prev !== "two" && prev !== now && p.ovr >= 66) was.set(prev, [...(was.get(prev) ?? []), p]);
    if (now && ((prev && prev !== now) || p.draftYear === year)) came.set(now, [...(came.get(now) ?? []), p]);
  }

  // Position-group grades across the league.
  const scores = new Map(ids.map((id) => [id, groupScores(save, id)]));
  const keys = ["QB", "Skill", "Line", "Front", "Secondary", "Coaching"] as const;
  const gradeOf = (id: TeamId) =>
    keys.map((k) => {
      const mine = scores.get(id)![k];
      const better = ids.filter((x) => scores.get(x)![k] > mine).length;
      const p = better / Math.max(1, ids.length - 1);
      return { key: k, grade: letter(p), pct: p };
    });

  // Strength of schedule and the hardest three-week run.
  const sched = (id: TeamId) =>
    schedule
      .filter((g) => g.homeId === id || g.awayId === id)
      .sort((a, b) => a.week - b.week);
  const oppOf = (g: GameResult, id: TeamId) => (g.homeId === id ? g.awayId : g.homeId) as TeamId;
  const sos = new Map(ids.map((id) => [id, avg(sched(id).map((g) => rating.get(oppOf(g, id)) ?? 0))]));
  const sosRank = new Map(ids.slice().sort((a, b) => sos.get(b)! - sos.get(a)!).map((id, i) => [id, i + 1]));

  // Tiers from projected win share, so they read the same with four playoff spots or fourteen.
  const tierOf = (id: TeamId): PreviewTeam["tier"] => {
    const share = meanW(id) / games;
    const t = (sim.title.get(id) ?? 0) / runs;
    if (share >= 0.66 || t >= 0.12) return "Contender";
    if (share >= 0.56) return "Playoff hopeful";
    if (share >= 0.47) return "In the mix";
    if (share >= 0.38) return "Long shot";
    return "Rebuilding";
  };

  const teams: PreviewTeam[] = ids.map((id) => {
    const ws = sim.wins.get(id)!.slice().sort((a, b) => a - b);
    const lo = ws[Math.floor(ws.length * 0.1)]!;
    const hi = ws[Math.floor(ws.length * 0.9)]!;
    const projW = Math.round(meanW(id) * 10) / 10;
    const grades = gradeOf(id);
    const qb = starters(save, id, "QB", 1)[0];
    const roster = rosterOf(save, id).filter((p) => p.injuredWeeks <= 0);
    const stars = roster
      .filter((p) => p.id !== qb?.id && p.pos !== "K" && p.pos !== "P")
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 3)
      .map((p) => p.id);
    const x = roster
      .filter((p) => p.age <= 26 && p.potential - p.ovr >= 5 && p.ovr >= 66)
      .sort((a, b) => b.potential - a.potential + (b.ovr - a.ovr) * 0.5)[0];
    const newcomers = (came.get(id) ?? []).sort((a, b) => b.ovr - a.ovr).slice(0, 4).map((p) => p.id);
    const departures = (was.get(id) ?? []).sort((a, b) => b.ovr - a.ovr).slice(0, 4).map((p) => p.id);
    const hc = save.teams[id]!.coachId ? save.coaches[save.teams[id]!.coachId!] : undefined;
    const sch = sched(id);
    let stretch: string | undefined;
    let worst = -Infinity;
    for (let i = 0; i + 2 < sch.length; i++) {
      const three = sch.slice(i, i + 3);
      const v = avg(three.map((g) => rating.get(oppOf(g, id)) ?? 0));
      if (v > worst) {
        worst = v;
        // Said the way a broadcaster would: "weeks 10 through 12: the Raiders at home, then at the Broncos and at the 49ers".
        const leg = (g: (typeof three)[number]) => (g.homeId === id ? `the ${nick(oppOf(g, id))} at home` : `at the ${nick(oppOf(g, id))}`);
        stretch = `weeks ${three[0]!.week} through ${three[2]!.week}: ${leg(three[0]!)}, then ${leg(three[1]!)} and ${leg(three[2]!)}`;
      }
    }
    const first = sch[0];
    const opener = first ? `${first.homeId === id ? "Home against" : "At"} the ${name(oppOf(first, id))}` : undefined;
    const lr = lastRec(id);
    const delta = projW - lr.w * (games / Math.max(1, lr.w + lr.l + lr.t || games));
    const best = grades.slice().sort((a, b) => a.pct - b.pct);
    const strong = best.slice(0, 2).map((g) => GROUP_WORDS[g.key].good);
    const weak = GROUP_WORDS[best[best.length - 1]!.key].bad;
    const tier = tierOf(id);
    const po = (sim.playoff.get(id) ?? 0) / runs;
    const k = `pv-${id}`;
    const cap = (x: string) => x[0]!.toUpperCase() + x.slice(1);
    const qbName = qb ? `${playerName(qb)}${qb.age >= 34 ? `, ${qb.age} years old,` : qb.draftYear === year ? ", a rookie," : ""}` : "";
    const qbSentence = qb
      ? compose(k + "qb", year, [
          qbName.endsWith(",") ? ["{Q} "] : ["{Q} ", "{Q}, the starter, ", "Once again {Q} ", "This year {Q} ", "Again, {Q} "],
          ["is under center", "takes the snaps", "runs the offense", "has the keys", "is the triggerman", "calls the signals"],
          [".", ", for better or worse.", ", and that's the story.", ", no controversy.", ", and the staff sleeps fine.", ", the way it should be."],
        ], { Q: qbName }).replace(/^./, (c) => c.toUpperCase())
      : "Nobody has won the quarterback job yet.";
    const worry = compose(k + "w", year, [
      ["The worry is ", "The question mark: ", "What keeps the staff up at night: ", "The soft spot is ", "Where they can be beaten: ", "Opponents will attack "],
      ["{W}", "{W}"],
      [".", ", and everybody on the schedule knows it.", ", until proven otherwise.", ", and fixing it raises the ceiling.", ", and it showed in camp.", ", which is fixable.", ", which might not be fixable."],
    ], { W: weak });
    // Facts that only this club has this year; two of them make each write-up its own.
    const facts: string[] = [];
    const hcNew = hcChange.get(id);
    if (hcNew) facts.push(vary(k + "nc", year, [`${hcNew} takes over, and the scheme changes with him.`, `New head coach ${hcNew} gets his first look at what he inherited.`, `${hcNew}'s first year on the job.`]));
    const add = (came.get(id) ?? []).filter((p) => p.draftYear !== year).sort((a, b) => b.ovr - a.ovr)[0];
    if (add && add.ovr >= 74) facts.push(compose(k + "add", year, [[`${playerName(add)} is the addition that matters`, `Adding ${playerName(add)} changes the math at ${add.pos}`, `${playerName(add)} arrives with something to prove`, `The new ${add.pos}, ${playerName(add)}, fills a need`], [".", ", and it shows on the practice field.", ", a smart move by the front office.", ", and he fits the scheme."]]));
    const gone = (was.get(id) ?? []).sort((a, b) => b.ovr - a.ovr)[0];
    if (gone && gone.ovr >= 76) facts.push(vary(k + "gone", year, [`Losing ${playerName(gone)} hurts more than people think.`, `Replacing ${playerName(gone)} is the job of the summer.`, `There's a ${gone.pos}-sized hole where ${playerName(gone)} used to be.`]));
    if (x && x.id !== qb?.id) facts.push(compose(k + "x", year, [[`Keep an eye on ${playerName(x)}`, `${playerName(x)}, ${x.age}, is the wild card`, `The upside play is ${playerName(x)}`, `Watch ${playerName(x)}`, `The name to know is ${playerName(x)}`], [".", ": if he hits, the projection is low.", ", the kind of player who changes a season.", ", ready for more snaps."]]));
    const sr = sosRank.get(id)!;
    if (sr <= 4) facts.push(vary(k + "sos", year, [`The schedule is brutal: ${ordinal(sr)} toughest in the league.`, `Nobody envies this schedule, the ${ordinal(sr)} hardest around.`]));
    else if (sr > ids.length - 4) facts.push(vary(k + "sos", year, [`The schedule is a gift, one of the softest in football.`, `Few teams get an easier slate.`]));
    if (lr.playoffs) facts.push(compose(k + "po", year, [[`They made the playoffs a year ago at ${recText(lr.w, lr.l, lr.t)}`, `Back after a ${recText(lr.w, lr.l, lr.t)} playoff season`, `A ${recText(lr.w, lr.l, lr.t)} playoff team last year`], [".", ", and the expectations went up.", ", so January is the standard now.", ", and they want more."]]));
    const star = stars[0] ? save.players[stars[0]] : undefined;
    if (star) facts.push(compose(k + "star", year, [[`${playerName(star)} `, `The ${star.pos}, ${playerName(star)}, `], ["is the best player on the field most Sundays", "is the reason to buy a ticket", "makes the whole thing go", "is a matchup nightmare", "is worth the price of admission"], [".", ", plain and simple.", ", and every opponent game-plans for him.", ", and he's in his prime."]]));
    const chosen = facts.length <= 2 ? facts : [facts[(hash(k) + year) % facts.length]!, facts[(hash(k) + year + 1 + (year % 2)) % facts.length]!].filter((f, i, arr) => arr.indexOf(f) === i);
    const trend =
      delta >= 2.5 ? vary(k + "up", year, P.outlookUp) : delta <= -2.5 ? vary(k + "dn", year, P.outlookDown) : vary(k + "fl", year, P.outlookFlat);
    const trendTail = vary(k + "tt", year, ["", ` Our number is ${projW.toFixed(1)}, with a range of ${lo} to ${hi}.`, ` We'll say ${Math.round(projW)} wins, give or take ${Math.max(1, Math.round((hi - lo) / 2))}.`, ` ${projW.toFixed(1)} wins in the simulations, ${lo} on a bad day and ${hi} on a great one.`, ` Somewhere between ${lo} and ${hi} wins.`, ""]);
    const lead = `${vary(k + "o1", year, P.outlookStart)} ${strong[0]} and ${strong[1]}.`;
    const order = (hash(k) + year) % 3;
    const outlook = newClubs.has(id)
      ? `A brand-new club, built from other teams' leftovers and a draft class. ${vary(k + "exp", year, ["Nobody expects much. That's the freedom.", "The goal is respectability, and maybe one Sunday that makes a city fall in love.", "Expansion teams get patience. They also get hit in the mouth."])}`
      : order === 0
        ? [lead, qbSentence, worry, ...chosen, trend + trendTail].join(" ")
        : order === 1
          ? [cap(trend) + trendTail, lead, ...chosen, qbSentence, worry].join(" ")
          : [qbSentence, lead, ...chosen.slice(0, 1), worry, trend + trendTail, ...chosen.slice(1)].join(" ");
    const sb = `Super Bowl ${roman(superBowlNumber(year))}`;
    const bestCase =
      tier === "Contender" || tier === "Playoff hopeful"
        ? compose(k + "bc", year, [
            [`${hi} wins`, `${hi} wins, maybe ${hi + 1}`, `A ${hi}-win season`, `${hi} victories`],
            [po >= 0.6 ? ", a first-round bye" : ", a home playoff game", ", the division crown", ", home field in January", ", a top-two seed"],
            [`, and a real shot at ${sb}.`, `, and a trip to ${sb}.`, ", and a parade route.", ", and the trophy.", `, and ${star ? `${playerName(star)} on the All-Pro team` : "a stack of Pro Bowlers"}.`, ", and February football."],
          ])
        : compose(k + "bc", year, [
            [`${hi} wins`, `A ${hi}-win surprise`, `${hi} wins and some swagger`],
            [po >= 0.15 ? ", a playoff ticket nobody saw coming" : ", the start of something", ", a winning record", ", a spoiler's reputation", x ? `, and ${playerName(x)} becomes a star` : ", a young core that grows up fast"],
            [".", ", and the league takes notice.", ", and a winter of optimism.", ", and next year starts early.", ", and a fan base that believes again."],
          ]);
    const hotSeatTail = hc && (hc.yearsOnJob ?? 0) >= 3 && lo <= games * 0.35;
    const worstCase = compose(k + "wc", year, [
      lo <= 1
        ? [`A winless season`, `One win, maybe none`, `A long, winless fall`]
        : [`${lo} wins`, `A ${lo}-win slog`, `Just ${lo} wins`, `${lo} wins, maybe fewer`, `Only ${lo} wins`],
      hotSeatTail
        ? [`, and ${hc!.name} is coaching for his job by Thanksgiving`, `, and ${hc!.name}'s seat gets hot`, `, and ownership starts asking ${hc!.name} hard questions`]
        : tier === "Contender"
          ? [", and a long winter of asking what happened", ", and the window starts to close", ", and the injury report decides the season", ", and a first-round exit"]
          : [", and a high draft pick", ", and a long December", ", and a rebuild that speeds up", ", and empty seats by November"],
      [".", ", and it could happen.", ", which nobody in the building wants to think about.", ", if things break wrong.", ", if the injuries pile up."],
    ]);
    const verdict = vary(
      k + "v",
      year,
      tier === "Contender" ? P.contender : tier === "Playoff hopeful" ? P.hopeful : tier === "In the mix" ? P.mix : tier === "Long shot" ? P.longShot : P.rebuilding,
    );
    return {
      id,
      rank: rankOf.get(id)!,
      tier,
      projW,
      projL: Math.round((games - projW) * 10) / 10,
      range: [lo, hi],
      playoffPct: po,
      divisionPct: (sim.div.get(id) ?? 0) / runs,
      titlePct: (sim.title.get(id) ?? 0) / runs,
      confPct: (sim.conf.get(id) ?? 0) / runs,
      division: divisionKey(year, id),
      divFinish: Math.round(((sim.finish.get(id) ?? runs) / runs) * 10) / 10,
      lastYear: lr,
      grades,
      qbId: qb?.id,
      coach: hc?.name,
      newCoach: hcChange.has(id) || undefined,
      stars,
      xFactorId: x?.id,
      newcomers,
      departures,
      sosRank: sosRank.get(id)!,
      toughStretch: stretch,
      opener,
      outlook,
      bestCase,
      worstCase,
      verdict,
    };
  });
  // Tiers read down the board in order: nobody ranked below a club sits in a better tier.
  const TIERS: PreviewTeam["tier"][] = ["Contender", "Playoff hopeful", "In the mix", "Long shot", "Rebuilding"];
  let floor = 0;
  for (const t of teams.slice().sort((a, b) => a.rank - b.rank)) {
    floor = Math.max(floor, TIERS.indexOf(t.tier));
    t.tier = TIERS[floor]!;
  }
  const T = new Map(teams.map((t) => [t.id, t]));

  // Divisions.
  const divKeys = [...new Set(teams.map((t) => t.division))].sort();
  const divisions = divKeys.map((key) => {
    const order = teams.filter((t) => t.division === key).sort((a, b) => b.divisionPct - a.divisionPct || b.projW - a.projW).map((t) => t.id);
    const top = T.get(order[0]!)!;
    const second = order[1] ? T.get(order[1])! : undefined;
    const tight = second && top.divisionPct - second.divisionPct < 0.15;
    const note = tight
      ? `${vary(key, year, P.divTight)} The ${nick(top.id)} take it in ${pct(top.divisionPct)} of our simulations, the ${nick(second!.id)} in ${pct(second!.divisionPct)}.`
      : `${compose(key + "dn", year, [[`The ${nick(top.id)} `, `It's the ${nick(top.id)}: they `, `Our model says the ${nick(top.id)}: they `], ["win it ", "take the division ", "come out on top "], [`${pct(top.divisionPct)} of the time.`, `in ${pct(top.divisionPct)} of the simulations.`]])} ${top.divisionPct >= 0.6 ? vary(key + "l", year, P.divLock) : vary(key + "c", year, P.divClear)}`;
    return { key, conf: conferenceOf(year, order[0]!) as string, order, note };
  });

  // Conference champions and the Super Bowl pick.
  const confs = [...new Set(teams.map((t) => conferenceOf(year, t.id) as string))];
  const confChamps = confs.map((c) => {
    const best = teams.filter((t) => conferenceOf(year, t.id) === c).sort((a, b) => b.confPct - a.confPct)[0]!;
    return { conf: c, teamId: best.id, note: `${pct(best.confPct)} to win the ${c}. ${best.verdict}` };
  });
  const [ca, cb] = confChamps;
  const sbPick = (() => {
    if (!ca || !cb) {
      const t = teams.slice().sort((a, b) => b.titlePct - a.titlePct);
      return { winner: t[0]!.id, loser: t[1]!.id, score: "24-17", note: "", confidence: t[0]!.titlePct };
    }
    const ra = rating.get(ca.teamId)!;
    const rb = rating.get(cb.teamId)!;
    // The champion pick is the club that wins it most often, so the desk agrees with itself.
    const winner = T.get(ca.teamId)!.titlePct >= T.get(cb.teamId)!.titlePct ? ca.teamId : cb.teamId;
    const loser = winner === ca.teamId ? cb.teamId : ca.teamId;
    const edge = Math.abs(ra - rb) * SPREAD_K;
    const ws = 20 + Math.round(edge) + (edge > 3 ? 7 : 4);
    const ls = Math.max(10, ws - Math.max(3, Math.round(edge + 1)));
    return {
      winner,
      loser,
      score: `${ws}-${ls}`,
      note: `Super Bowl ${roman(superBowlNumber(year))}: the ${name(winner)} over the ${name(loser)}.`,
      confidence: T.get(winner)!.titlePct,
    };
  })();

  /* -------------------------------------------------- award picks */

  const all = Object.values(save.players).filter(isClub);
  const teamOf = (p: Player) => p.teamId as TeamId;
  const projOf = (p: Player) => T.get(teamOf(p))?.projW ?? games / 2;
  const toPicks = (rows: { p: Player; s: number; note: string }[]) => {
    const top = rows.sort((a, b) => b.s - a.s).slice(0, 4);
    const w = top.map((r) => Math.exp(r.s / 4));
    const tot = w.reduce((a, b) => a + b, 0) * 1.35;
    return top.map((r, i) => ({ playerId: r.p.id, teamId: teamOf(r.p), odds: oddsOf(w[i]! / tot), note: r.note }));
  };
  const last = (p: Player) => p.stats[year - 1];
  const mvp = toPicks(
    all
      .filter((p) => (p.pos === "QB" || p.pos === "RB") && starters(save, teamOf(p), p.pos, 1)[0]?.id === p.id)
      .map((p) => ({
        p,
        s: p.ovr + (projOf(p) / games) * 18 + (p.pos === "RB" ? -3 : 0),
        note:
          p.pos === "QB"
            ? `${last(p)?.passYds ? `${comma(last(p)!.passYds)} yards and ${last(p)!.passTd} touchdowns last year.` : "The keys are his."} The ${nick(teamOf(p))} project at ${T.get(teamOf(p))!.projW.toFixed(1)} wins.`
            : `${last(p)?.rushYds ? `${comma(last(p)!.rushYds)} rushing yards last year.` : "The offense runs through him."} A back can still win it.`,
      })),
  );
  const starting = (p: Player) =>
    starters(save, teamOf(p), p.pos, p.pos === "WR" ? 3 : p.pos === "CB" ? 2 : p.pos === "DE" || p.pos === "DT" || p.pos === "OLB" || p.pos === "S" ? 2 : 1).some((x) => x.id === p.id);
  const output = (p: Player) => Math.min(12, ((last(p)?.rushYds ?? 0) + (last(p)?.recYds ?? 0)) / 140);
  const opoy = toPicks(
    all
      // A starter with a real offensive role: veterans need last year's yards to back it up.
      .filter((p) => ["RB", "WR", "TE"].includes(p.pos) && starting(p) && (p.yearsPro <= 1 || output(p) >= 4))
      .map((p) => ({ p, s: p.ovr * 0.7 + output(p) + (p.pos === "TE" ? -2 : 0), note: last(p) ? `${p.pos === "RB" ? `${comma(last(p)!.rushYds)} rush yds` : `${last(p)!.rec} catches, ${comma(last(p)!.recYds)} yds`} last season.` : "First year in the spotlight." })),
  );
  const dpoy = toPicks(
    all
      .filter((p) => DEF.has(p.pos) && starting(p))
      .map((p) => ({
        p,
        s: p.ovr + (["DE", "OLB"].includes(p.pos) ? 1.5 : 0) + (last(p)?.sacks ?? 0) * 0.15 + (last(p)?.ints ?? 0) * 0.3,
        note: last(p) ? `${last(p)!.sacks ? `${Math.round(last(p)!.sacks * 10) / 10} sacks` : `${last(p)!.ints} interceptions`} a year ago. Offenses build their week around him.` : "Offenses will build their week around him.",
      })),
  );
  const rookies = all.filter((p) => p.draftYear === year);
  const oroy = toPicks(rookies.filter((p) => OFF.has(p.pos)).map((p) => ({ p, s: p.ovr + (starters(save, teamOf(p), p.pos, p.pos === "WR" ? 3 : 1).some((x) => x.id === p.id) ? 4 : 0), note: `${p.draftRound ? `${ordinal(p.draftRound)}-round pick` : "Rookie"} out of ${p.college ?? "college"}.` })));
  const droy = toPicks(rookies.filter((p) => DEF.has(p.pos)).map((p) => ({ p, s: p.ovr + (p.draftRound === 1 ? 2 : 0), note: `${p.draftRound ? `${ordinal(p.draftRound)}-round pick` : "Rookie"} out of ${p.college ?? "college"}.` })));
  const coy = (() => {
    const rows = teams
      .map((t) => {
        const c = save.teams[t.id]!.coachId ? save.coaches[save.teams[t.id]!.coachId!] : undefined;
        return c ? { c, t, s: (t.projW - t.lastYear.w) * 1.4 + t.playoffPct * 4 + (t.newCoach ? 2 : 0) } : undefined;
      })
      .filter((x): x is { c: Coach; t: PreviewTeam; s: number } => !!x)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
    const w = rows.map((r) => Math.exp(r.s / 2.5));
    const tot = w.reduce((a, b) => a + b, 0) * 1.4;
    return rows.map((r, i) => ({
      coachId: r.c.id,
      teamId: r.t.id,
      odds: oddsOf(w[i]! / tot),
      note: `${recText(r.t.lastYear.w, r.t.lastYear.l, r.t.lastYear.t)} last year, ${r.t.projW.toFixed(1)} projected.${r.t.newCoach ? " First year on the job." : ""}`,
    }));
  })();
  const awards: SeasonPreview["awards"] = [
    // Only the awards that existed that year: OPOY 1972, DPOY 1971, the split rookie awards 1967.
    { label: "Most Valuable Player", picks: mvp },
    ...(year >= 1972 ? [{ label: "Offensive Player of the Year", picks: opoy }] : []),
    ...(year >= 1971 ? [{ label: "Defensive Player of the Year", picks: dpoy }] : []),
    { label: year >= 1967 ? "Offensive Rookie of the Year" : "Rookie of the Year", picks: oroy },
    ...(year >= 1967 ? [{ label: "Defensive Rookie of the Year", picks: droy }] : []),
    { label: "Coach of the Year", picks: coy },
  ].filter((a) => a.picks.length);

  /* -------------------------------------------------- watch lists */

  const rookieWatch = rookies
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 6)
    .map((p) => {
      const starting = starters(save, teamOf(p), p.pos, p.pos === "WR" || p.pos === "CB" ? 3 : p.pos === "DE" || p.pos === "DT" ? 2 : 1).some((x) => x.id === p.id);
      return {
        playerId: p.id,
        teamId: teamOf(p),
        note: `${p.pos}, ${p.college ?? "college"}${p.draftRound ? `, ${ordinal(p.draftRound)} round` : ""}. ${starting ? "Starts from day one." : "Has to earn snaps."}`,
      };
    });
  const breakouts = all
    .filter((p) => p.age <= 25 && p.potential - p.ovr >= 6 && p.ovr >= 68 && p.draftYear !== year && p.pos !== "K" && p.pos !== "P")
    .sort((a, b) => b.potential - b.ovr - (a.potential - a.ovr) + (b.ovr - a.ovr) * 0.4)
    .slice(0, 5)
    .map((p) => ({ playerId: p.id, teamId: teamOf(p), note: `${p.pos}, ${p.age}. ${vary(p.id + "b", year, P.breakout)}` }));
  const lastRide = all
    .filter((p) => p.age >= 33 && p.ovr >= 76 && p.pos !== "K" && p.pos !== "P")
    .sort((a, b) => b.ovr - a.ovr + (b.age - a.age))
    .slice(0, 4)
    .map((p) => {
      const c = careerTotals(p);
      const line = p.pos === "QB" ? `${comma(c.passYds)} career passing yards` : p.pos === "RB" ? `${comma(c.rushYds)} career rushing yards` : ["WR", "TE"].includes(p.pos) ? `${comma(c.rec)} career catches` : c.sacks ? `${Math.round(c.sacks)} career sacks` : `${p.yearsPro} seasons`;
      return { playerId: p.id, teamId: teamOf(p), note: `${p.age} years old, ${line}. ${vary(p.id + "r", year, P.lastRide)}` };
    });
  const hotSeat = teams
    .map((t) => ({ t, c: save.teams[t.id]!.coachId ? save.coaches[save.teams[t.id]!.coachId!] : undefined }))
    .filter((x): x is { t: PreviewTeam; c: Coach } => !!x.c && !x.t.newCoach && (x.c.yearsOnJob ?? 0) >= 3 && x.t.id !== u)
    .sort((a, b) => a.t.projW - b.t.projW - (a.c.yearsOnJob - b.c.yearsOnJob) * 0.15)
    .slice(0, 3)
    .map(({ t, c }) => ({ coachId: c.id, teamId: t.id, note: `Year ${c.yearsOnJob + 1}. ${recText(c.careerWins, c.careerLosses, c.careerTies)} career. Projected ${t.projW.toFixed(1)} wins. ${vary(c.id + "h", year, P.hotSeat)}` }));

  // Career milestones within reach this season.
  const MARKS: { of: (p: Player) => number; per: (p: Player) => number; steps: number[]; label: string; pos: Player["pos"][] }[] = [
    { of: (p) => careerTotals(p).passYds, per: (p) => last(p)?.passYds ?? 0, steps: [20000, 30000, 40000, 50000, 60000, 70000, 80000], label: "career passing yards", pos: ["QB"] },
    { of: (p) => careerTotals(p).passTd, per: (p) => last(p)?.passTd ?? 0, steps: [200, 250, 300, 350, 400, 450, 500], label: "career touchdown passes", pos: ["QB"] },
    { of: (p) => careerTotals(p).rushYds, per: (p) => last(p)?.rushYds ?? 0, steps: [8000, 10000, 12000, 14000, 16000], label: "career rushing yards", pos: ["RB"] },
    { of: (p) => careerTotals(p).rec, per: (p) => last(p)?.rec ?? 0, steps: [500, 750, 1000, 1200], label: "career catches", pos: ["WR", "TE", "RB"] },
    { of: (p) => careerTotals(p).recYds, per: (p) => last(p)?.recYds ?? 0, steps: [10000, 12000, 14000, 16000], label: "career receiving yards", pos: ["WR", "TE"] },
    { of: (p) => careerTotals(p).sacks, per: (p) => last(p)?.sacks ?? 0, steps: [100, 125, 150, 175, 200], label: "career sacks", pos: ["DE", "DT", "OLB", "MLB"] },
  ];
  const milestones: SeasonPreview["milestones"] = [];
  for (const p of all.filter((x) => x.ovr >= 70 && x.yearsPro >= 3)) {
    for (const m of MARKS) {
      if (!m.pos.includes(p.pos)) continue;
      const have = m.of(p);
      const per = m.per(p);
      const step = m.steps.find((s) => s > have);
      if (!step || per <= 0) continue;
      const need = step - have;
      if (need > per * 0.9) continue;
      milestones.push({ playerId: p.id, teamId: teamOf(p), note: `${comma(need)} from ${comma(step)} ${m.label}. Had ${comma(per)} last year.` });
      // One mark per player, so six different names make the list.
      break;
    }
  }
  milestones.sort((a, b) => save.players[b.playerId]!.ovr - save.players[a.playerId]!.ovr);
  milestones.splice(6);

  // Must-watch games.
  const allGames = schedule;
  const watchScore = (g: GameResult) => {
    const h = T.get(g.homeId as TeamId);
    const a = T.get(g.awayId as TeamId);
    if (!h || !a) return -99;
    const sbRematch = lastSb && ((g.homeId === lastSb.homeId && g.awayId === lastSb.awayId) || (g.homeId === lastSb.awayId && g.awayId === lastSb.homeId));
    return h.titlePct + a.titlePct + (isRivalry(g.homeId as TeamId, g.awayId as TeamId) ? 0.06 : 0) + (sbRematch ? 0.2 : 0) + (g.night ? 0.03 : 0) + (g.homeId === u || g.awayId === u ? 0.03 : 0) + (g.week === 1 ? 0.02 : 0);
  };
  const usedWeeks = new Map<number, number>();
  let ownGames = 0;
  const mustWatch = allGames
    .slice()
    .sort((a, b) => watchScore(b) - watchScore(a))
    .filter((g) => {
      const n = usedWeeks.get(g.week) ?? 0;
      if (n >= 2) return false;
      // The league's show, not the owner's: two of his games at most.
      const ours = g.homeId === u || g.awayId === u;
      if (ours && ownGames >= 2) return false;
      if (ours) ownGames += 1;
      usedWeeks.set(g.week, n + 1);
      return true;
    })
    .slice(0, 8)
    .sort((a, b) => a.week - b.week)
    .map((g) => {
      const h = g.homeId as TeamId;
      const a = g.awayId as TeamId;
      const spread = (rating.get(h)! - rating.get(a)!) * SPREAD_K + (g.site ? 0 : HOME);
      const s = Math.round(Math.abs(spread) * 2) / 2;
      const line = s < 0.5 ? "Pick'em" : `${teamAbbr(spread > 0 ? h : a)} -${s}`;
      const sbRematch = lastSb && [lastSb.homeId, lastSb.awayId].includes(h) && [lastSb.homeId, lastSb.awayId].includes(a);
      const note = sbRematch
        ? `Super Bowl ${roman(lastSb!.number)} rematch.`
        : isRivalry(h, a)
          ? vary(g.homeId + g.awayId, year, P.watchRivalry)
          : g.week === 1
            ? "Opening week, and it's a heavyweight bout."
            : T.get(h)!.tier === "Contender" && T.get(a)!.tier === "Contender"
              ? vary(g.id, year, P.watchTitans)
              : g.homeId === u || g.awayId === u
                ? "The owner's box will be full."
                : vary(g.id, year, P.watchMisc);
      return { gameId: g.id, week: g.week, homeId: h, awayId: a, line, note: `${note}${g.night ? " Under the lights." : ""}` };
    });

  /* -------------------------------------------------- storylines */

  const stories: SeasonPreview["storylines"] = [];
  const story = (id: string, kicker: string, title: string, body: string, teamIds: TeamId[], playerIds: string[] = []) => stories.push({ id, kicker, title, body, teamIds, playerIds });
  const V = (slot: string, list: readonly string[]) => vary(slot, year, list);
  const sbOf = (y: number) => save.history.superBowls.find((x) => x.year === y);
  const winnerOf = (b: { homeId: TeamId; awayId: TeamId; homeScore: number; awayScore: number }) => (b.homeScore >= b.awayScore ? b.homeId : b.awayId) as TeamId;
  if (lastChamp && T.get(lastChamp)) {
    const t = T.get(lastChamp)!;
    const twoAgo = sbOf(year - 2);
    const threePeat = twoAgo && winnerOf(twoAgo) === lastChamp;
    const sc = `${Math.max(lastSb!.homeScore, lastSb!.awayScore)}-${Math.min(lastSb!.homeScore, lastSb!.awayScore)}`;
    story(
      "champ",
      threePeat ? "THREE-PEAT WATCH" : V("ck", ["THE CHAMPS", "DEFENDING CHAMPIONS", "TITLE DEFENSE", "THE HUNTED"]),
      threePeat ? `The ${nick(lastChamp)} go for three straight` : V("ct", [`Can the ${nick(lastChamp)} do it again?`, `The ${nick(lastChamp)} have a target on their backs`, `Repeat or retreat for the ${nick(lastChamp)}?`, `Everybody's chasing the ${nick(lastChamp)}`, `The ${nick(lastChamp)} defend the crown`]),
      `${V("cb1", [
        `The ${name(lastChamp)} won Super Bowl ${roman(lastSb!.number)}, ${sc} over the ${name(lastRunner!)}.`,
        `Seven months ago the ${name(lastChamp)} beat the ${name(lastRunner!)} ${sc} in Super Bowl ${roman(lastSb!.number)}.`,
        `Super Bowl ${roman(lastSb!.number)} belonged to the ${name(lastChamp)}: ${sc} over the ${name(lastRunner!)}.`,
      ])}${threePeat ? " That's two in a row. Nobody has ever made three look easy." : ` ${V("cb2", ["Repeating is the hardest thing in this sport.", "Everybody gets your best shot the year after.", "The parade's over. Now everyone wants a piece of you.", "Defending a title is a different job than winning one."])}`} Our simulations give them a ${pct(t.titlePct)} chance to raise the trophy again, and ${pct(t.playoffPct)} to get back to January at all. ${t.departures.length ? `They lost ${t.departures.slice(0, 2).map((x) => playerName(save.players[x]!)).join(" and ")} this offseason.` : V("cb3", ["They kept the band together.", "The core is intact.", "Nobody important walked out the door."])}`,
      [lastChamp],
      t.departures.slice(0, 2),
    );
  }
  if (lastRunner && T.get(lastRunner)) {
    const t = T.get(lastRunner)!;
    story(
      "runner",
      V("rk", ["UNFINISHED BUSINESS", "SO CLOSE", "THE HANGOVER", "ONE GAME SHORT"]),
      V("rt", [`The ${nick(lastRunner)} came up one game short`, `Can the ${nick(lastRunner)} get back?`, `The ${nick(lastRunner)} and the Super Bowl hangover`, `Revenge tour for the ${nick(lastRunner)}?`]),
      `${V("rb1", ["Nobody remembers who lost the Super Bowl, except the team that lost it.", "Losing the last game of the year stays with you all summer.", "History is cruel to Super Bowl losers. Most of them don't make it back."])} The ${name(lastRunner)} are back with a ${pct(t.confPct)} chance to win the ${conferenceOf(year, lastRunner)} again. ${t.playoffPct >= 0.6 ? V("rb2", ["The roster is still there.", "They have the talent to get back.", "The team that got there is mostly intact."]) : "But the hangover is real: just a " + pct(t.playoffPct) + " shot at the playoffs."}`,
      [lastRunner],
    );
  }
  // A dynasty in the making, or a contender still waiting for its first title in this league.
  const recent = [1, 2, 3, 4, 5].map((n) => sbOf(year - n)).filter((x): x is NonNullable<typeof x> => !!x);
  const wins5 = new Map<TeamId, number>();
  for (const b of recent) wins5.set(winnerOf(b), (wins5.get(winnerOf(b)) ?? 0) + 1);
  const dyn = [...wins5].filter(([id, n]) => n >= 2 && T.get(id)).sort((a, b) => b[1] - a[1])[0];
  if (dyn) story("dynasty", "DYNASTY WATCH", V("dt", [`${numberWord(dyn[1])[0]!.toUpperCase() + numberWord(dyn[1]).slice(1)} titles in five years for the ${nick(dyn[0])}`, `Is this the ${nick(dyn[0])}' league now?`, `The ${nick(dyn[0])} and the D-word`]), `${dyn[1]} Super Bowls in the last five seasons. ${T.get(dyn[0])!.verdict} ${pct(T.get(dyn[0])!.titlePct)} to add another.`, [dyn[0]]);
  const titled = new Set(save.history.superBowls.map((b) => winnerOf(b)));
  const drought = teams.filter((t) => t.rank <= 6 && !titled.has(t.id) && save.history.superBowls.length >= 5).sort((a, b) => b.titlePct - a.titlePct)[0];
  if (drought) story("drought", V("drk", ["STILL WAITING", "THE DROUGHT", "NEVER BEEN THERE"]), V("drt", [`The ${nick(drought.id)} have never won it`, `Is this the year for the ${nick(drought.id)}?`, `The ${nick(drought.id)} are tired of waiting`]), `${save.history.superBowls.length} Super Bowls in this league, and none for the ${name(drought.id)}. They're ranked ${ordinal(drought.rank)} going in, ${pct(drought.titlePct)} to win it all. ${drought.outlook.split(". ")[0]}.`, [drought.id]);
  const newCoachTeams = teams.filter((t) => t.newCoach);
  if (newCoachTeams.length) {
    const n = numberWord(newCoachTeams.length);
    story(
      "coaches",
      V("nk", ["NEW FACES ON THE SIDELINE", "COACHING CAROUSEL", "FRESH STARTS", "NEW HEADSETS"]),
      newCoachTeams.length === 1
        ? V("nt1", [`${newCoachTeams[0]!.coach} takes over in ${locationOf(year, newCoachTeams[0]!.id)}`, `One new head coach: ${newCoachTeams[0]!.coach}`])
        : V("nt", [`${n[0]!.toUpperCase() + n.slice(1)} clubs start over with a new head coach`, `${n[0]!.toUpperCase() + n.slice(1)} new head coaches, ${n} fresh starts`, `The carousel stopped ${n} times`]),
      newCoachTeams
        .slice(0, 5)
        .map((t, i) => (i % 2 ? `In ${locationOf(year, t.id)}, ${t.coach} inherits a ${recText(t.lastYear.w, t.lastYear.l, t.lastYear.t)} team projected for ${t.projW.toFixed(1)} wins.` : `${t.coach} takes over the ${name(t.id)} (${recText(t.lastYear.w, t.lastYear.l, t.lastYear.t)} last year, projected ${t.projW.toFixed(1)}).`))
        .join(" "),
      newCoachTeams.map((t) => t.id),
    );
  }
  const rookieQbs = teams.filter((t) => t.qbId && save.players[t.qbId]?.draftYear === year);
  if (rookieQbs.length) {
    story(
      "rookieqb",
      V("qk", ["BABY-FACED ASSASSINS", "ROOKIES UNDER CENTER", "TRIAL BY FIRE", "THE KIDS ARE STARTING"]),
      rookieQbs.length === 1 ? `A rookie starts at quarterback in ${locationOf(year, rookieQbs[0]!.id)}` : `${numberWord(rookieQbs.length)[0]!.toUpperCase() + numberWord(rookieQbs.length).slice(1)} rookie quarterbacks start week one`,
      rookieQbs.map((t) => `${playerName(save.players[t.qbId!]!)} gets the keys for the ${name(t.id)}.`).join(" ") + ` ${V("qb2", ["Rookie quarterbacks get humbled. The question is how fast they recover.", "The first interception is coming. What matters is the next throw.", "Defensive coordinators have been waiting all summer for this.", "Every rookie quarterback hits a wall. The good ones climb it."])}`,
      rookieQbs.map((t) => t.id),
      rookieQbs.map((t) => t.qbId!),
    );
  }
  const bigAdds = all
    .filter((p) => p.ovr >= 80 && p.draftYear !== year && last(p) && last(p)!.teamId !== p.teamId && last(p)!.teamId !== "two")
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 4);
  if (bigAdds.length) {
    story(
      "moves",
      V("mk", ["NEW ADDRESS", "OFFSEASON WINNERS", "ON THE MOVE", "NEW COLORS"]),
      V("mt", [`${playerName(bigAdds[0]!)} headlines the offseason's biggest moves`, `${playerName(bigAdds[0]!)} has a new home`, `The ${nick(teamOf(bigAdds[0]!))} landed ${playerName(bigAdds[0]!)}`]),
      bigAdds.map((p, i) => (i % 2 ? `The ${name(teamOf(p))} added ${playerName(p)} (${p.pos}) from the ${name(last(p)!.teamId as TeamId)}.` : `${playerName(p)} (${p.pos}) goes from the ${name(last(p)!.teamId as TeamId)} to the ${name(teamOf(p))}.`)).join(" "),
      bigAdds.map(teamOf),
      bigAdds.map((p) => p.id),
    );
  }
  const holdouts = all.filter((p) => p.holdout && p.ovr >= 74).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  if (holdouts.length) {
    story("holdouts", V("hk", ["CONTRACT STANDOFFS", "HOLDOUT WATCH", "SHOW ME THE MONEY"]), V("ht", [`${playerName(holdouts[0]!)} isn't in camp`, `Where is ${playerName(holdouts[0]!)}?`, `${playerName(holdouts[0]!)} wants paid`]), holdouts.map((p) => `${playerName(p)} wants a new deal from the ${name(teamOf(p))}.`).join(" ") + ` ${V("hb", ["These usually end the week before the opener. Usually.", "Somebody blinks before week one. Probably.", "Missed practice time adds up by October."])}`, holdouts.map(teamOf), holdouts.map((p) => p.id));
  }
  for (const r of relocationsForYear(year)) {
    if (!T.get(r.teamId)) continue;
    story(`move-${r.teamId}`, "NEW HOME", r.title, `${r.body} A new stadium, new fans, the same roster. Projected ${T.get(r.teamId)!.projW.toFixed(1)} wins.`, [r.teamId]);
  }
  for (const id of newClubs) {
    if (!T.get(id)) continue;
    story(`exp-${id}`, "WELCOME TO THE LEAGUE", `The ${name(id)} play their first season`, `Built from the expansion draft and a rookie class. ${T.get(id)!.outlook} Our number: ${T.get(id)!.projW.toFixed(1)} wins.`, [id]);
  }
  const risers = teams.filter((t) => t.projW - t.lastYear.w >= 3 && t.lastYear.w + t.lastYear.l > 0).sort((a, b) => b.projW - b.lastYear.w - (a.projW - a.lastYear.w));
  const fallers = teams.filter((t) => t.lastYear.w - t.projW >= 3).sort((a, b) => b.lastYear.w - b.projW - (a.lastYear.w - a.projW));
  if (risers[0]) story("rise", V("uk", ["ON THE RISE", "COMING UP FAST", "BREAKOUT TEAM", "WATCH OUT"]), V("ut", [`The ${nick(risers[0].id)} are coming`, `The ${nick(risers[0].id)} are for real`, `Nobody wants to play the ${nick(risers[0].id)} now`]), `${recText(risers[0].lastYear.w, risers[0].lastYear.l, risers[0].lastYear.t)} a year ago. Projected ${risers[0].projW.toFixed(1)} wins now, with a ${pct(risers[0].playoffPct)} shot at the playoffs. ${risers[0].outlook}`, [risers[0].id]);
  if (fallers[0]) story("fall", V("fk", ["BUYER BEWARE", "REGRESSION WATCH", "CORRECTION COMING"]), V("ftl", [`Don't trust the ${nick(fallers[0].id)}' record`, `The ${nick(fallers[0].id)} are due for a fall`, `Last year's ${nick(fallers[0].id)} were a mirage`]), `They went ${recText(fallers[0].lastYear.w, fallers[0].lastYear.l, fallers[0].lastYear.t)}. The roster projects closer to ${fallers[0].projW.toFixed(1)} wins. ${fallers[0].outlook}`, [fallers[0].id]);

  // Rule changes and league history the season opens with.
  const RULES: Record<number, string> = {
    1970: "The merger is done. Twenty-six teams, two conferences, one league, and Monday Night Football.",
    1972: "The hash marks move toward the middle of the field. Expect the running game to open up.",
    1974: "The goal posts move to the back of the end zone, kickoffs move to the 35 and sudden-death overtime comes to the regular season.",
    1977: "Defenders can make contact with receivers only once downfield. The head slap is gone.",
    1978: "Sixteen games, a second wild card, and new rules that protect receivers and let linemen extend their arms. The passing game is about to explode.",
    1979: "The officials will blow a quarterback down once he's in the grasp. Protect the passer.",
    1990: "The playoff field grows to twelve. One more wild card in each conference.",
    1994: "The salary cap arrives, and so does the two-point conversion. Free agency changes everything.",
    2002: "Thirty-two teams, eight divisions of four. The Texans join and the map gets redrawn.",
    2011: "Kickoffs move back to the 35. Touchbacks are coming.",
    2015: "Extra points move back to the 15-yard line. Nothing is automatic anymore.",
    2020: "Seven playoff teams per conference. Only one bye now.",
    2021: "Seventeen games. The longest regular season in league history.",
  };
  const rules = RULES[year];
  const realPost = REAL_POSTSEASON[year];
  const real = realRecords(year);
  const realBest = real ? [...real.entries()].filter(([id]) => T.get(id as TeamId)).sort((a, b) => b[1].w - a[1].w)[0] : undefined;
  const history = realPost
    ? `In the real ${year} season, the ${displayName(year, realPost.champ as TeamId)} beat the ${displayName(year, realPost.runnerUp as TeamId)} ${realPost.score} for the title${realBest ? `, and the best regular-season record belonged to the ${displayName(year, realBest[0] as TeamId)} at ${recText(realBest[1].w, realBest[1].l, realBest[1].t)}` : ""}. That was then. This league writes its own.`
    : undefined;

  /* -------------------------------------------------- bold predictions */

  const bold: SeasonPreview["bold"] = [];
  const lastPlace = divisions.map((d) => d.order.map((id) => T.get(id)!).sort((a, b) => a.lastYear.w - b.lastYear.w)[0]!).filter((t) => t.lastYear.w + t.lastYear.l > 0);
  const wtf = lastPlace.sort((a, b) => b.divisionPct - a.divisionPct)[0];
  if (wtf && wtf.divisionPct >= 0.12) bold.push({ text: `Worst to first: the ${name(wtf.id)} win the ${wtf.division}. It happens ${pct(wtf.divisionPct)} of the time in our simulations, more than you'd think.`, teamIds: [wtf.id] });
  const sleeper = teams.filter((t) => !t.lastYear.playoffs && t.playoffPct < 0.5 && t.id !== wtf?.id).sort((a, b) => b.playoffPct - a.playoffPct)[0];
  if (sleeper) bold.push({ text: `The ${name(sleeper.id)} make the playoffs. ${sleeper.verdict}`, teamIds: [sleeper.id] });
  const collapse = teams.filter((t) => t.lastYear.playoffs).sort((a, b) => a.playoffPct - b.playoffPct)[0];
  if (collapse && collapse.playoffPct < 0.5) bold.push({ text: `A playoff team from last year misses: the ${name(collapse.id)}. ${collapse.worstCase[0]!.toUpperCase() + collapse.worstCase.slice(1)}`, teamIds: [collapse.id] });
  const topQb = mvp.find((m) => save.players[m.playerId!]?.pos === "QB");
  if (topQb) {
    const top3 = all.map((p) => last(p)?.passYds ?? 0).sort((a, b) => b - a).slice(0, 3);
    const leader = top3[1] ?? 0;
    const p = save.players[topQb.playerId!]!;
    if (leader > 0) bold.push({ text: `${playerName(p)} leads the league with ${comma(Math.round((leader * 1.04) / 50) * 50)} passing yards.`, teamIds: [topQb.teamId] });
  }
  if (oroy[0]) bold.push({ text: `${playerName(save.players[oroy[0].playerId!]!)} is the best rookie in football by Halloween.`, teamIds: [oroy[0].teamId] });
  if (lastChamp && T.get(lastChamp) && T.get(lastChamp)!.playoffPct < 0.65) bold.push({ text: `The defending champion ${nick(lastChamp)} miss the playoffs.`, teamIds: [lastChamp] });

  /* -------------------------------------------------- your club */

  // A sandbox has no club of its own; the data still describes the favorite, but no chapter airs.
  const mine = T.get(u) ?? [...T.values()].sort((a, b) => a.rank - b.rank)[0]!;
  const me = mine.id;
  const gradeSorted = mine.grades.slice().sort((a, b) => a.pct - b.pct);
  const yours = {
    teamId: me,
    headline:
      mine.tier === "Contender"
        ? `The ${nick(me)} are a Super Bowl contender`
        : mine.tier === "Playoff hopeful"
          ? `The ${nick(me)} should be playing in January`
          : mine.tier === "In the mix"
            ? `The ${nick(me)} are a coin flip`
            : mine.tier === "Long shot"
              ? `The ${nick(me)} need things to break their way`
              : `A building year for the ${nick(me)}`,
    lines: [
      `Projected ${mine.projW.toFixed(1)}-${mine.projL.toFixed(1)}, ranked ${ordinal(mine.rank)} of ${ids.length}. The range runs from ${mine.range[0]} to ${mine.range[1]} wins.`,
      `${pct(mine.playoffPct)} to make the playoffs, ${pct(mine.divisionPct)} to win the ${mine.division}, ${pct(mine.titlePct)} to win it all.`,
      mine.toughStretch ? `The stretch that decides it: ${mine.toughStretch}.` : "",
      mine.opener ? `It starts in week one. ${mine.opener}.` : "",
    ].filter(Boolean),
    keys: gradeSorted.slice(0, 2).map((g) => `${GROUP_WORDS[g.key].good[0]!.toUpperCase() + GROUP_WORDS[g.key].good.slice(1)} grades out ${g.grade}.`),
    concerns: gradeSorted.slice(-2).reverse().map((g) => `${GROUP_WORDS[g.key].bad[0]!.toUpperCase() + GROUP_WORDS[g.key].bad.slice(1)}: ${g.grade}.`),
  };

  /* -------------------------------------------------- the desk, the receipts, the features */

  const crew = crewFor(year);
  const cast = {
    HOST: { name: crew.HOST.name, role: crew.HOST.role, tenure: tenure(crew.HOST, year), gender: crew.HOST.gender },
    ANALYST: { name: crew.ANALYST.name, role: crew.ANALYST.role, tenure: tenure(crew.ANALYST, year), gender: crew.ANALYST.gender },
    REPORTER: { name: crew.REPORTER.name, role: crew.REPORTER.role, tenure: tenure(crew.REPORTER, year), gender: crew.REPORTER.gender },
  };
  const first = (n: string) => n.replace(/ “.*”/, "").split(" ")[0]!;
  const v = (slot: string, list: readonly string[]) => vary(slot, year, list);
  const tic = (who: "HOST" | "ANALYST" | "REPORTER", slot: string) => v(`tic-${who}-${slot}`, crew[who].tics);

  // Last year's calls against what happened.
  let receipts: SeasonPreview["receipts"];
  const old = save.previewPicks?.year === year - 1 ? save.previewPicks : undefined;
  if (old && lastChamp) {
    const lines: string[] = [];
    let good = 0;
    const lname = (id: TeamId) => displayName(year - 1, id);
    if (old.superBowl.winner === lastChamp) {
      lines.push(`A year ago on this set we picked the ${lname(lastChamp)} to win it all. They did.`);
      good += 2;
    } else if (lastSb && [lastSb.homeId, lastSb.awayId].includes(old.superBowl.winner)) {
      lines.push(`We had the ${lname(old.superBowl.winner)} winning the Super Bowl. They got there and lost to the ${lname(lastChamp)}.`);
      good += 1;
    } else {
      const t = save.teams[old.superBowl.winner];
      lines.push(`We picked the ${lname(old.superBowl.winner)} to win the Super Bowl. They went ${t ? recText(t.wins, t.losses, t.ties) : "nowhere"}. The ${lname(lastChamp)} won it.`);
    }
    const errs = Object.entries(old.projW)
      .filter(([id]) => save.teams[id as TeamId])
      .map(([id, w]) => ({ id: id as TeamId, w, act: save.teams[id as TeamId]!.wins }))
      .map((x) => ({ ...x, d: x.act - x.w }));
    const nailed = errs.filter((x) => x.act >= games * 0.6).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))[0];
    const missed = errs.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    if (nailed && Math.abs(nailed.d) <= 1) {
      lines.push(`We said ${nailed.w.toFixed(1)} wins for the ${lname(nailed.id)}. They won ${nailed.act}.`);
      good += 1;
    }
    if (missed && Math.abs(missed.d) >= 3)
      lines.push(missed.d > 0 ? `We had the ${lname(missed.id)} at ${missed.w.toFixed(1)} wins. They won ${missed.act}. We'll take the hit.` : `We had the ${lname(missed.id)} at ${missed.w.toFixed(1)} wins. They won ${missed.act}. Ouch.`);
    const lastAwards = save.history.awards.find((x) => x.year === year - 1);
    const mvpCall = old.awards.find((x) => x.label === "Most Valuable Player")?.playerId;
    if (lastAwards?.mvp && mvpCall) {
      const pick0 = save.players[mvpCall];
      const won = save.players[lastAwards.mvp];
      if (mvpCall === lastAwards.mvp) {
        lines.push(`Our MVP pick, ${pick0 ? playerName(pick0) : "our guy"}, won it.`);
        good += 1;
      } else if (won) lines.push(`Our MVP pick was ${pick0 ? playerName(pick0) : "somebody else"}. ${playerName(won)} won it.`);
    }
    receipts = { headline: good >= 2 ? "Last year's picks held up" : "Last year's picks, revisited", lines };
    receipts.lines.push(good >= 2 ? v("rg", P.receiptsGood) : v("rb", P.receiptsBad));
  }

  // The rotating features.
  type Feature = SeasonPreview["features"][number];
  const qbs = teams.map((t) => (t.qbId ? save.players[t.qbId] : undefined)).filter((p): p is Player => !!p).sort((a, b) => b.ovr - a.ovr);
  const line2 = (x: number) => Math.round(x * 2) / 2;
  const builders: (() => Feature | undefined)[] = [
    () =>
      qbs.length >= 6
        ? {
            id: "qbs",
            kicker: "Ranked",
            title: "The quarterback top ten",
            intro: v("fqb", ["Everything in this league starts at quarterback. Here's our top ten.", "The most important position in sports, ranked.", "Ten quarterbacks we'd build around. In order."]),
            rows: qbs.slice(0, 10).map((p, i) => ({
              playerId: p.id,
              teamId: teamOf(p),
              label: String(i + 1),
              value: `${p.age}`,
              note: last(p)?.passYds ? `${comma(last(p)!.passYds)} yds, ${last(p)!.passTd} TD last year` : p.draftYear === year ? "Rookie" : "New starter",
            })),
          }
        : undefined,
    () => {
      const pool = teams.slice().sort((a, b) => hash(a.id + year) - hash(b.id + year)).slice(0, 8).sort((a, b) => b.projW - a.projW);
      return {
        id: "ou",
        kicker: "Win totals",
        title: "Over or under",
        intro: v("fou", ["We set the lines. The analyst picks a side.", "Win totals, and a call on every one.", "Over or under. No pushes allowed."]),
        rows: pool.map((t) => {
          const lineW = line2(t.projW * 0.65 + (t.lastYear.w + t.lastYear.l > 0 ? t.lastYear.w : t.projW) * 0.35);
          const over = t.projW > lineW + 0.2 || (Math.abs(t.projW - lineW) <= 0.2 && !!t.xFactorId);
          return {
            teamId: t.id,
            label: nick(t.id),
            value: `${over ? "Over" : "Under"} ${lineW.toFixed(1)}`,
            note: over
              ? t.xFactorId
                ? `${playerName(save.players[t.xFactorId]!)} pushes them past it.`
                : "The roster is better than the line."
              : t.lastYear.w > t.projW
                ? "Last year's record is propping up this number."
                : "Too many questions for that many wins.",
          };
        }),
      };
    },
    () => {
      const qs: { q: string; a: string; teamId?: TeamId; playerId?: string }[] = [];
      const [c1, c2] = confChamps;
      if (c1) qs.push({ q: `Who wins the ${c1.conf}?`, a: `The ${name(c1.teamId)}. ${pct(T.get(c1.teamId)!.confPct)} in our simulations.`, teamId: c1.teamId });
      if (c2) qs.push({ q: `And the ${c2.conf}?`, a: `The ${name(c2.teamId)}, ${pct(T.get(c2.teamId)!.confPct)}.`, teamId: c2.teamId });
      if (lastChamp && T.get(lastChamp)) qs.push({ q: `Can the ${nick(lastChamp)} repeat?`, a: `${pct(T.get(lastChamp)!.titlePct)} chance. ${T.get(lastChamp)!.titlePct >= 0.15 ? "Better than most defending champions get." : "History says no."}`, teamId: lastChamp });
      if (oroy[0]) qs.push({ q: "Which rookie makes the biggest splash?", a: `${playerName(save.players[oroy[0].playerId!]!)} with the ${nick(oroy[0].teamId)}.`, playerId: oroy[0].playerId, teamId: oroy[0].teamId });
      if (hotSeat[0]) qs.push({ q: "Which coach is in trouble first?", a: `${save.coaches[hotSeat[0].coachId]?.name} in ${locationOf(year, hotSeat[0].teamId)}.`, teamId: hotSeat[0].teamId });
      if (sleeper) qs.push({ q: "Who's the surprise playoff team?", a: `The ${name(sleeper.id)}. ${pct(sleeper.playoffPct)} and climbing.`, teamId: sleeper.id });
      const sackMan = dpoy.find((d) => ["DE", "OLB", "DT"].includes(save.players[d.playerId!]?.pos ?? ""));
      if (sackMan) qs.push({ q: "Who leads the league in sacks?", a: `${playerName(save.players[sackMan.playerId!]!)}.`, playerId: sackMan.playerId, teamId: sackMan.teamId });
      if (lastRide[0]) qs.push({ q: `Is this ${playerName(save.players[lastRide[0].playerId]!)}'s last season?`, a: v("lastq", ["Don't bet against him playing again.", "I think so. Enjoy it.", "He'll decide in January. The tape says he can still go."]), playerId: lastRide[0].playerId, teamId: lastRide[0].teamId });
      if (qs.length < 4) return undefined;
      const start = year % qs.length;
      const five = [...qs.slice(start), ...qs.slice(0, start)].slice(0, 5);
      return { id: "questions", kicker: "Five questions", title: `Five questions for ${year}`, intro: v("fq", ["Five questions that decide the season. Five answers.", "Rapid fire. Five questions.", "We asked ourselves five questions. Here are the answers."]), rows: five.map((x, i) => ({ label: `${i + 1}`, teamId: x.teamId, playerId: x.playerId, value: x.q, note: x.a })) };
    },
    () => {
      const g = schedule
        .filter((x) => isRivalry(x.homeId as TeamId, x.awayId as TeamId) && T.get(x.homeId as TeamId) && T.get(x.awayId as TeamId))
        .sort((a, b) => T.get(b.homeId as TeamId)!.titlePct + T.get(b.awayId as TeamId)!.titlePct - (T.get(a.homeId as TeamId)!.titlePct + T.get(a.awayId as TeamId)!.titlePct))[0];
      if (!g) return undefined;
      const h = g.homeId as TeamId;
      const a = g.awayId as TeamId;
      const sn = seriesNote(save, h, a);
      return {
        id: "rivalry",
        kicker: "Rivalry spotlight",
        title: `${nick(a)} at ${nick(h)}, week ${g.week}`,
        intro: v("frv", ["Some games mean more. This is the one.", "Throw out the records. This is a rivalry.", "The game both fan bases circled the day the schedule came out."]),
        rows: [
          { teamId: a, label: nick(a), value: `${T.get(a)!.projW.toFixed(1)} proj. wins`, note: T.get(a)!.verdict },
          { teamId: h, label: nick(h), value: `${T.get(h)!.projW.toFixed(1)} proj. wins`, note: T.get(h)!.verdict },
          ...(sn ? [{ label: "Series", value: sn.series, note: sn.revenge ?? sn.last }] : []),
        ],
      };
    },
    () => {
      const ago = [50, 40, 30, 25, 20, 15, 10, 5]
        .map((n) => ({ n, b: save.history.superBowls.find((x) => x.year === year - n) }))
        .filter((x): x is { n: number; b: NonNullable<typeof x.b> } => !!x.b)
        .slice(0, 4);
      if (!ago.length) return undefined;
      return {
        id: "anniversary",
        kicker: "This league's history",
        title: `${ago[0]!.n} years ago this season`,
        intro: v("fan", ["Before we look ahead, a look back at this league's own history.", "Anniversaries worth remembering.", "Where this league has been."]),
        rows: ago.map(({ n, b }) => {
          const w = (b.homeScore >= b.awayScore ? b.homeId : b.awayId) as TeamId;
          const l = (w === b.homeId ? b.awayId : b.homeId) as TeamId;
          const mine0 = save.history.seasons.find((c) => c.year === b.year && c.teamId === u);
          return {
            teamId: w,
            label: `${n} years`,
            value: `${displayName(b.year, w)}, Super Bowl ${roman(b.number)}`,
            note: `${Math.max(b.homeScore, b.awayScore)}-${Math.min(b.homeScore, b.awayScore)} over the ${displayName(b.year, l)}${b.mvpName ? `. MVP: ${b.mvpName}` : ""}${mine0 ? `. Your club went ${recText(mine0.wins, mine0.losses, mine0.ties)}` : ""}.`,
          };
        }),
      };
    },
    () => {
      const by = (k2: "Line" | "Front") => teams.slice().sort((a, b) => a.grades.find((g) => g.key === k2)!.pct - b.grades.find((g) => g.key === k2)!.pct).slice(0, 3);
      return {
        id: "trenches",
        kicker: "Won up front",
        title: "The best lines in football",
        intro: v("ftr", ["Games are won in the trenches. These are the teams that win there.", "The big uglies. Ranked.", "Forget the skill players for a minute. Here's where football is decided."]),
        rows: [
          ...by("Line").map((t, i) => ({ teamId: t.id, label: `OL ${i + 1}`, value: nick(t.id), note: `Offensive line grade ${t.grades.find((g) => g.key === "Line")!.grade}` })),
          ...by("Front").map((t, i) => ({ teamId: t.id, label: `DL ${i + 1}`, value: nick(t.id), note: `Front seven grade ${t.grades.find((g) => g.key === "Front")!.grade}` })),
        ],
      };
    },
    () => {
      const hcs = teams
        .map((t) => ({ t, c: save.teams[t.id]!.coachId ? save.coaches[save.teams[t.id]!.coachId!] : undefined }))
        .filter((x): x is { t: PreviewTeam; c: Coach } => !!x.c);
      if (hcs.length < 4) return undefined;
      const tenured = hcs.slice().sort((a, b) => b.c.yearsOnJob - a.c.yearsOnJob)[0]!;
      const winning = hcs.slice().sort((a, b) => b.c.careerWins - a.c.careerWins)[0]!;
      const rings = hcs.filter((x) => x.c.careerTitles > 0).sort((a, b) => b.c.careerTitles - a.c.careerTitles)[0];
      const fresh = hcs.filter((x) => x.t.newCoach);
      return {
        id: "coaches",
        kicker: "Coaches' corner",
        title: "The men with the headsets",
        intro: v("fco", ["Players win games. Coaches win seasons.", "The sideline, by the numbers.", "A look at the coaches who'll decide this year."]),
        rows: [
          { teamId: tenured.t.id, label: "Longest tenure", value: tenured.c.name, note: `Year ${tenured.c.yearsOnJob + 1} with the ${nick(tenured.t.id)}.` },
          { teamId: winning.t.id, label: "Most wins", value: winning.c.name, note: `${recText(winning.c.careerWins, winning.c.careerLosses, winning.c.careerTies)} career.` },
          ...(rings ? [{ teamId: rings.t.id, label: "Rings", value: rings.c.name, note: `${rings.c.careerTitles} championship${rings.c.careerTitles === 1 ? "" : "s"}.` }] : []),
          ...fresh.slice(0, 3).map((x) => ({ teamId: x.t.id, label: "New", value: x.c.name, note: `Takes over a ${recText(x.t.lastYear.w, x.t.lastYear.l, x.t.lastYear.t)} team.` })),
        ],
      };
    },
    () => {
      const ageOf = (id: TeamId) => {
        const xs = rosterOf(save, id).sort((a, b) => b.ovr - a.ovr).slice(0, 22).map((p) => p.age);
        return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      };
      const rowsA = teams.map((t) => ({ t, a: ageOf(t.id) })).sort((a, b) => a.a - b.a);
      return {
        id: "ages",
        kicker: "Old guard, new blood",
        title: "Youngest and oldest starting lineups",
        intro: v("fag", ["Youth is a strategy. So is experience.", "Who's built for now, and who's built for later.", "Age is just a number. It's also a pretty good predictor."]),
        rows: [
          ...rowsA.slice(0, 3).map((x) => ({ teamId: x.t.id, label: "Young", value: nick(x.t.id), note: `Starters average ${x.a.toFixed(1)} years old.` })),
          ...rowsA.slice(-3).reverse().map((x) => ({ teamId: x.t.id, label: "Veteran", value: nick(x.t.id), note: `Starters average ${x.a.toFixed(1)} years old.` })),
        ],
      };
    },
    () => {
      const bySos = teams.slice().sort((a, b) => a.sosRank - b.sosRank);
      return {
        id: "schedules",
        kicker: "The schedule makers",
        title: "Toughest and softest schedules",
        intro: v("fsc", ["Not all sixteen-game slates are created equal.", "The schedule can make a season. Here's who got lucky.", "Strength of schedule, from the gauntlet to the cakewalk."]).replace("sixteen", numberWord(games)),
        rows: [
          ...bySos.slice(0, 3).map((t) => ({ teamId: t.id, label: "Toughest", value: nick(t.id), note: t.toughStretch ?? "" })),
          ...bySos.slice(-3).reverse().map((t) => ({ teamId: t.id, label: "Softest", value: nick(t.id), note: `${pct(t.playoffPct)} to make the playoffs with it.` })),
        ],
      };
    },
  ];
  const features: Feature[] = [];
  const nB = builders.length;
  for (const start of [year, year + 3, year + 6]) {
    for (let step = 0; step < nB && features.length < 3; step++) {
      const i = (start + step) % nB;
      const f = builders[i]!();
      if (f && !features.some((x) => x.id === f.id)) {
        features.push(f);
        break;
      }
    }
  }

  /* -------------------------------------------------- the broadcast */

  const chapters: Episode["chapters"] = [];
  const chap = (id: string, kicker: string, title: string, teamIds: TeamId[], lines: Line[]) => chapters.push({ id, kicker, title, teamIds, lines });
  const H = (text: string): Line => ({ speaker: "HOST", text });
  const A = (text: string): Line => ({ speaker: "ANALYST", text });
  const R = (text: string): Line => ({ speaker: "REPORTER", text });
  const favorite = teams.slice().sort((a, b) => b.titlePct - a.titlePct)[0]!;
  const hostN = cast.HOST.tenure;
  const intro = hostN === 1 ? `I'm ${crew.HOST.name}, and this is my first preview on this desk.` : `I'm ${crew.HOST.name}, back for my ${ORD_WORDS[hostN - 1] ?? `${hostN}th`} season preview.`;
  const analystN = cast.ANALYST.tenure;
  const withCrew =
    analystN === 1
      ? `Joining us for the first time, ${crew.ANALYST.name}, and as always, ${crew.REPORTER.name}.`
      : v("with", [
          `With me, ${first(crew.ANALYST.name)} ${crew.ANALYST.name.split(" ").at(-1)} and ${crew.REPORTER.name}.`,
          `${crew.ANALYST.name} is here, and so is ${crew.REPORTER.name}.`,
          `Alongside me as always, ${crew.ANALYST.name} and ${crew.REPORTER.name}.`,
          `${crew.ANALYST.name} and ${crew.REPORTER.name} are back with me on the desk.`,
        ]);
  chap("open", "SEASON PREVIEW", v("ttl", [`${year}: here we go`, `The ${year} season starts now`, `Welcome to ${year}`, `${year}: everybody's undefeated`, `Kickoff ${year}`]), [favorite.id], [
    H(`${v("hello", P.hello)} ${intro} ${withCrew} ${v("era", eraColor(year))} ${ids.length} teams, ${games} games apiece, one trophy. ${v("prom", P.promise)}`),
    A(
      `${tic("ANALYST", "open")} ${v("ft", P.firstTake)} ${fill(v("fav", P.favorite), { T: name(favorite.id), P: pct(favorite.titlePct) })} ${favorite.titlePct < 0.15 ? v("fw", P.favoriteWide) : v("fn", P.favoriteNarrow)}`,
    ),
    ...(rules ? [R(`${tic("REPORTER", "rules")} The rulebook changed this year: ${rules[0]!.toLowerCase()}${rules.slice(1)}`)] : []),
  ]);
  if (receipts) {
    chap("receipts", "THE RECEIPTS", receipts.headline, lastChamp ? [lastChamp] : [], [
      H(`${tic("HOST", "rc")} Before the new picks, the old ones. ${receipts.lines.slice(0, 2).join(" ")}`),
      A(receipts.lines.slice(2).join(" ") || v("rcA", P.receiptsBad)),
    ]);
  }
  // The champion's story leads; the rest come in a different order every year.
  const [lead0, ...restStories] = stories;
  const orderedStories = lead0 ? [lead0, ...restStories.sort((a, b) => hash(a.id + year) - hash(b.id + year))] : [];
  const storyCount = 2 + (year % 3);
  for (const st of orderedStories.slice(0, storyCount)) {
    chap(`story-${st.id}`, st.kicker, st.title, st.teamIds.slice(0, 2), [H(st.body), A(`${tic("ANALYST", st.id)} ${v("sr" + st.id, P.storyReply)}`)]);
  }
  // Features are talked through, not read off the table: the desk works the list in sentences.
  const listOf = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  const words = (t: string) => t.replace(/\byds\b/g, "yards").replace(/\bTD\b/g, "touchdowns").replace(/\bproj\. wins\b/g, "projected wins");
  const speakFeature = (f: Feature): Line[] => {
    const rows = f.rows;
    const who = (r: Feature["rows"][number]) => (r.playerId ? playerName(save.players[r.playerId]!) : r.value ?? r.label);
    switch (f.id) {
      case "qbs": {
        const q = rows.map((r) => `${who(r)} of the ${nick(r.teamId!)}`);
        return [
          H(f.intro),
          A(`Number one: ${q[0]}. ${words(rows[0]!.note ?? "")}.${q[1] ? ` Then ${q[1]}${q[2] ? `, and ${q[2]} at three` : ""}.` : ""}`),
          q.length > 3 ? H(`Four through seven: ${listOf(rows.slice(3, 7).map(who))}.`) : undefined,
          q.length > 7 ? R(`And rounding out the ten, ${listOf(rows.slice(7, 10).map(who))}.`) : undefined,
          A(v("qbr", ["I'd take any one of those guys and build a team around him.", "You could argue the order. You can't argue the names.", "Number one isn't close, in my opinion.", "Watch the young ones on that list. They'll climb."])),
        ].filter((x): x is Line => !!x);
      }
      case "ou": {
        const out: Line[] = [H(f.intro)];
        for (const [i, r] of rows.slice(0, 5).entries()) {
          const [side, n] = (r.value ?? "").split(" ");
          out.push(H(i === 0 ? `The ${r.label}, ${n} wins.` : v(`ouq${i}`, [`The ${r.label}, ${n}.`, `${r.label}: ${n}.`, `How about the ${r.label} at ${n}?`])));
          const why = /propping/.test(r.note ?? "")
            ? v(`ouw${i}`, ["Last year's record is propping up that number.", "They overachieved last year. That's baked into the line.", "I don't trust last year's record."])
            : /questions/.test(r.note ?? "")
              ? v(`ouw${i}`, ["Too many questions for that many wins.", "I need to see it first.", "There's a lot that has to go right for that."])
              : /better than the line/.test(r.note ?? "")
                ? v(`ouw${i}`, ["The roster is better than the line.", "That number's too low. They're good.", "I like this team more than the oddsmakers do."])
                : r.note ?? "";
          out.push(A(`${side}. ${why}`));
        }
        return out;
      }
      case "questions":
        return [H(f.intro), ...rows.flatMap((r, i) => [i % 2 ? R(r.value ?? "") : H(r.value ?? ""), A(r.note ?? "")])];
      case "rivalry": {
        const [x, y, series] = rows;
        return [
          H(`${f.intro} ${f.title}.`),
          A(`The ${x!.label}: ${x!.note} The ${y!.label}: ${y!.note}`),
          series ? R(`${series.value}. ${series.note ?? ""}`) : undefined,
        ].filter((l): l is Line => !!l);
      }
      case "anniversary":
        return [
          H(f.intro),
          ...rows.map((r, i) => (i % 2 ? A : R)(`${r.label} ago: the ${r.value}. ${r.note}`)),
          A(v("ann", ["Feels like yesterday.", "What a team that was.", "They don't make them like that anymore."])),
        ];
      case "trenches": {
        const ol = rows.filter((r) => r.label.startsWith("OL"));
        const dl = rows.filter((r) => r.label.startsWith("DL"));
        return [
          H(f.intro),
          A(`The best offensive lines in football: the ${listOf(ol.map((r) => r.value!))}. The ${ol[0]!.value} grade out at ${ol[0]!.note!.split(" ").at(-1)}.`),
          R(`On the other side of the ball, the best fronts belong to the ${listOf(dl.map((r) => r.value!))}.`),
          A(v("trn", ["Win up front and everything else gets easier.", "That's where championships start.", "Nobody talks about it, but that's the whole game."])),
        ];
      }
      case "coaches": {
        const by = (l: string) => rows.filter((r) => r.label === l);
        const tenure = by("Longest tenure")[0];
        const most = by("Most wins")[0];
        const rings = by("Rings")[0];
        const fresh = by("New");
        return [
          H(f.intro),
          tenure ? H(`${tenure.value} has been on the job longest. ${tenure.note}`) : undefined,
          most ? A(`${most.value} has won more than anybody on a sideline right now: ${most.note!.replace(" career.", "")} for his career.${rings && rings.value === most.value ? ` And ${rings.note!.replace(".", "")} to go with it.` : ""}`) : undefined,
          rings && rings.value !== most?.value ? A(`${rings.value} has the hardware: ${rings.note}`) : undefined,
          fresh.length ? R(`New faces: ${listOf(fresh.map((r) => `${r.value}, who ${r.note!.replace("Takes", "takes").replace(/\.$/, "")}`))}.`) : undefined,
        ].filter((l): l is Line => !!l);
      }
      case "ages": {
        const young = rows.filter((r) => r.label === "Young");
        const old = rows.filter((r) => r.label === "Veteran");
        const age = (r: Feature["rows"][number]) => r.note!.match(/[\d.]+/)?.[0] ?? "";
        return [
          H(f.intro),
          A(`The youngest lineups in football: the ${listOf(young.map((r) => r.value!))}. The ${young[0]!.value} start guys averaging ${age(young[0]!)}.`),
          R(`And the most experienced: the ${listOf(old.map((r) => r.value!))}, up around ${age(old[0]!)}.`),
          A(v("agr", ["Young legs win in December. Old heads win in January.", "Experience matters, until the hamstrings start going.", "I'll take the veterans in a big game every time."])),
        ];
      }
      case "schedules": {
        const tough = rows.filter((r) => r.label === "Toughest");
        const soft = rows.filter((r) => r.label === "Softest");
        return [
          H(f.intro),
          R(`The toughest schedules belong to the ${listOf(tough.map((r) => r.value!))}.${tough[0]?.note ? ` Look at the ${tough[0].value} in ${tough[0].note}.` : ""}`),
          A(`The easiest: the ${listOf(soft.map((r) => r.value!))}. With that slate, the ${soft[0]!.value} make the playoffs ${soft[0]!.note!.replace(" to make the playoffs with it.", "")} of the time.`),
        ];
      }
      default:
        return [H(f.intro), ...rows.slice(0, 6).map((r, i) => (i % 2 ? H : A)(words(`${r.label}: ${who(r)}${r.value && r.value !== who(r) ? `, ${r.value}` : ""}. ${r.note ?? ""}`)))];
    }
  };
  const featChap = (f: Feature) =>
    chap(`feature-${f.id}`, f.kicker.toUpperCase(), f.title, f.rows.map((r) => r.teamId).filter((x): x is TeamId => !!x).slice(0, 2), speakFeature(f));
  if (features[0]) featChap(features[0]);
  const divFmt = (d: (typeof divisions)[number], idx: number) => {
    const order = d.order.map((id) => T.get(id)!);
    const top = order[0]!;
    const second = order[1];
    const sleeperD = order.slice(1).sort((a, b) => b.playoffPct - a.playoffPct)[0];
    const camp = order.flatMap((t) => t.newcomers.slice(0, 1)).map((id) => save.players[id]!).filter(Boolean).sort((a, b) => b.ovr - a.ovr)[0];
    const finish = `${order.slice(0, -1).map((t) => `the ${nick(t.id)}`).join(", ")}, and the ${nick(order[order.length - 1]!.id)}, in that order.`;
    const reason = top.outlook.split(". ").slice(0, 2).join(". ") + ".";
    const campLine = camp ? `${tic("REPORTER", d.key)} ${fill(v("rc" + d.key, P.reporterCamp), { P: playerName(camp), T: nick(teamOf(camp)) })} ${camp.draftYear === year ? v("rk" + d.key, ["Rookie or not, they expect him to play.", "He'll play early.", "The rookie isn't waiting his turn."]) : v("vt" + d.key, ["He fits what they do.", "He's already a leader in that room.", "The coaches love the fit.", "Expect him on the field a lot."])}` : "";
    const opener = fill(v("do" + d.key, P.divOpen), { D: d.key });
    const fmt = (hash(d.key) + year + idx) % 3;
    if (fmt === 1 && second && top.divisionPct - second.divisionPct < 0.25) {
      return [
        H(`${opener} ${tic("HOST", d.key)} I'm taking the ${nick(second.id)}.`),
        A(`${v("dis" + d.key, P.disagree)} It's the ${nick(top.id)}. ${reason} My order: ${finish}`),
        R(`The numbers split the difference: ${nick(top.id)} ${pct(top.divisionPct)}, ${nick(second.id)} ${pct(second.divisionPct)}.${campLine ? ` ${campLine}` : ""}`),
      ];
    }
    if (fmt === 2 && campLine) {
      return [R(campLine), H(`${opener} ${d.note}`), A(`${v("ag" + d.key, P.agree)} ${finish}${sleeperD && sleeperD.playoffPct >= 0.3 ? ` Watch the ${nick(sleeperD.id)}.` : ""}`)];
    }
    return [
      H(`${opener} ${d.note}`),
      A(`${v("hs" + d.key, ["Here's how I see it finishing:", "My order:", "Top to bottom:", "Put me down for:"])} ${finish} ${reason}${sleeperD && sleeperD.playoffPct >= 0.3 ? ` ${compose(d.key + "sl", year, [["Don't sleep on ", "Keep an eye on ", "Watch out for ", "Circle "], [`the ${nick(sleeperD.id)}`], [`, though: ${pct(sleeperD.playoffPct)} to make the playoffs.`, `. ${pct(sleeperD.playoffPct)} playoff odds.`, `, ${/^(8|11|18)/.test(pct(sleeperD.playoffPct)) ? "an" : "a"} ${pct(sleeperD.playoffPct)} playoff team in our numbers.`]])}` : ""}`),
      ...(campLine ? [R(campLine)] : []),
    ];
  };
  const half = Math.ceil(divisions.length / 2);
  divisions.forEach((d, i) => {
    chap(`div-${d.key}`, d.conf, d.key, d.order.slice(0, 2), divFmt(d, i));
    if (i === half - 1 && features[1]) featChap(features[1]);
  });
  if (year % 2) {
    // Fast, but still a conversation: the board in five tiers, a different take on each.
    const groups = [
      { at: 0, n: 5, lead: v("lt0", ["At the top of the board", "The heavyweights", "Our top five"]) },
      { at: 5, n: 7, lead: v("lt1", ["Next up", "The next tier", "Right behind them"]) },
      { at: 12, n: 7, lead: v("lt2", ["The middle of the pack", "The muddle in the middle", "The coin flips"]) },
      { at: 19, n: 6, lead: v("lt3", ["Long shots", "Needing some luck", "The hopefuls"]) },
      { at: 25, n: 99, lead: v("lt4", ["And the bottom of the board", "Rebuilding", "The long road"]) },
    ];
    const spoken = new Set<string>();
    chap("lightning", "LIGHTNING ROUND", v("lt", ["Every club in one breath", "All of them, fast", "Around the league in sixty seconds"]), [], [
      H(v("lth", ["Lightning round. Every team, our projected wins, as fast as we can.", "Let's go fast. All of them.", "Thirty seconds on the clock. Every club."]).replace("Every team", "Every team").replace("Thirty", ids.length > 30 ? "Forty" : "Thirty")),
      ...groups.flatMap((gr, i) => {
        const part = ranked.slice(gr.at, gr.at + gr.n);
        if (!part.length) return [];
        const list = listOf(part.map((id, j) => `the ${nick(id)}${j < 2 ? ` at ${T.get(id)!.projW.toFixed(1)}` : ""}`));
        const take = part.map((id) => T.get(id)!.verdict).find((x) => !spoken.has(x));
        if (take) spoken.add(take);
        const speak = [A, R, A, R, A][i]!;
        return [speak(`${gr.lead}: ${list}.`), ...(take ? [H(`${take}`)] : [])];
      }),
    ]);
  } else {
    const tiers = ["Contender", "Playoff hopeful", "In the mix", "Long shot", "Rebuilding"] as const;
    chap("tiers", "THE TIERS", v("tt", ["Sorting the league", "Where everybody stands", "Tier by tier"]), [], tiers
      .map((tier) => ({ tier, list: teams.filter((t) => t.tier === tier) }))
      .filter((x) => x.list.length)
      .map((x, i) => {
        const text = `${x.tier}${x.list.length === 1 ? "" : "s"}: ${x.list.map((t) => `the ${nick(t.id)}`).join(", ")}.`;
        return i % 2 ? A(text) : H(text);
      }));
  }
  const others = awards.slice(1);
  const shownAwards = [awards[0]!, ...others.slice(year % Math.max(1, others.length)), ...others.slice(0, year % Math.max(1, others.length))].filter(Boolean).slice(0, 3);
  for (const a of shownAwards) {
    const top = a.picks[0]!;
    const who = top.playerId ? playerName(save.players[top.playerId]!) : save.coaches[top.coachId!]?.name ?? "";
    const alt = a.picks[1];
    chap(`award-${a.label}`, "AWARDS WATCH", a.label, [top.teamId], [
      H(`${fill(v("ao" + a.label, P.awardOpen), { A: a.label })} The favorite on our board: ${who}, ${top.odds}. ${top.note}`),
      A(`${alt ? `${v("alt" + a.label, ["I'll give you a name at a better price:", "My value play:", "Give me", "Don't overlook"])} ${alt.playerId ? playerName(save.players[alt.playerId]!) : save.coaches[alt.coachId!]?.name ?? ""}, ${alt.odds}.` : ""} ${v("av" + a.label, P.awardValue)}`),
    ]);
  }
  if (features[2]) featChap(features[2]);
  if (bold.length) chap("bold", "BOLD PREDICTIONS", v("bt", ["On the record", "Hold us to it", "Calls we'll regret"]), bold.slice(0, 2).flatMap((b) => b.teamIds.slice(0, 1)), [H(v("bi", P.boldIntro)), ...bold.slice(0, 5).map((b, i) => (i % 2 ? H(b.text) : A(b.text)))]);
  if (!save.sandbox) chap("yours", "YOUR CLUB", yours.headline, [u], [
    H(`${v("yo", ["Now to the", "Let's talk about the", "And then there's the", "Time for the"])} ${name(u)}. ${yours.lines[0]}`),
    A(`${yours.lines[1]} ${yours.keys.join(" ")} ${v("yc", ["The concern:", "What worries me:", "The question:"])} ${yours.concerns[0]?.toLowerCase() ?? "depth"}`),
    R(`${mine.toughStretch ? `Circle this: ${mine.toughStretch}. ` : ""}${mine.newcomers.length ? `${tic("REPORTER", "yours")} ${playerName(save.players[mine.newcomers[0]!]!)} is the newcomer the staff is most excited about.` : "Same core, one more year together."}`),
  ]);
  chap("sb", "THE PICK", `Super Bowl ${roman(superBowlNumber(year))}`, [sbPick.winner, sbPick.loser], [
    H(`${v("sbi", P.sbIntro)} Super Bowl ${roman(superBowlNumber(year))}.`),
    A(`I've got the ${name(sbPick.winner)} over the ${name(sbPick.loser)}, ${sbPick.score}. ${T.get(sbPick.winner)!.outlook.split(". ")[0]}. ${v("sbb", P.sbBack)}`),
    R(`${fill(v("sbo", P.odds), { T: nick(sbPick.winner), P: pct(sbPick.confidence) })} ${v("sbu", P.upset)}`),
    ...(history ? [H(history)] : []),
    H(v("bye", crew.signoff)),
  ]);

  const episode: Episode = {
    id: `${year}-seasonPreview`,
    edition: "seasonPreview",
    headline: `${year} Season Preview`,
    subtitle: `${ids.length} teams · ${divisions.length} divisions · 2,000 simulated seasons`,
    chapters,
    focusIds: [],
    cast: { HOST: cast.HOST, ANALYST: cast.ANALYST, REPORTER: cast.REPORTER },
  };

  return {
    year,
    teams: teams.sort((a, b) => a.rank - b.rank),
    divisions,
    awards,
    superBowl: sbPick,
    confChamps,
    storylines: stories,
    bold,
    mustWatch,
    rookies: rookieWatch,
    breakouts,
    lastRide,
    hotSeat,
    milestones,
    rules,
    history,
    yours,
    cast,
    features,
    receipts,
    episode,
  };
}

/** The calls to grade later, frozen when the season kicks off. */
export function freezePreviewPicks(save: DynastySave): PreviewPicks {
  const pv = buildSeasonPreview(save);
  return {
    year: pv.year,
    superBowl: { winner: pv.superBowl.winner, loser: pv.superBowl.loser },
    divisions: pv.divisions.map((d) => ({ key: d.key, teamId: d.order[0]! })),
    awards: pv.awards.map((a) => ({ label: a.label, playerId: a.picks[0]?.playerId, coachId: a.picks[0]?.coachId })),
    projW: Object.fromEntries(pv.teams.map((t) => [t.id, t.projW])),
  };
}
