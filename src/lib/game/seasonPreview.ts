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
import { activeTeamIds, conferenceOf, displayName, divisionKey, gamesInSeason, nicknameOf, roman, superBowlNumber, teamAbbr } from "./teams.ts";
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
  const u = save.userTeamId;
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
        stretch = `Weeks ${three[0]!.week}-${three[2]!.week}: ${three.map((g) => `${g.homeId === id ? "vs" : "at"} ${teamAbbr(oppOf(g, id))}`).join(", ")}`;
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
    const k = `${year}-${id}`;
    const qbLine = qb ? `${playerName(qb)}${qb.age >= 34 ? `, ${qb.age} now,` : qb.draftYear === year ? ", a rookie," : ""} under center` : "an open question under center";
    const outlook = newClubs.has(id)
      ? `A brand-new club, built from other teams' leftovers and a draft class. ${pick(k + "exp", ["Nobody expects much. That's the freedom.", "The goal is respectability, and maybe one Sunday that makes a city fall in love.", "Expansion teams get patience. They also get hit in the mouth."])}`
      : `${pick(k + "o1", ["It starts with", "Everything here runs through", "The case begins with", "Start with"])} ${strong[0]} and ${strong[1]}. ${qbLine[0]!.toUpperCase() + qbLine.slice(1)}. The worry is ${weak}. ${
          delta >= 2.5
            ? pick(k + "up", ["Two thousand simulations say this club takes a real step forward.", "The numbers like this team a lot more than last year's record does.", "Last year's record undersells this roster."])
            : delta <= -2.5
              ? pick(k + "dn", ["Last year's record looks like the ceiling, not the floor.", "Some of last year's wins were borrowed. Payment comes due.", "Regression is coming, and it doesn't knock."])
              : pick(k + "fl", ["Expect something close to last year.", "This is who they are, give or take a bounce.", "Steady. Not spectacular."])
        }`;
    const bestCase =
      tier === "Contender" || tier === "Playoff hopeful"
        ? `${hi} wins, ${po >= 0.6 ? "a bye" : "a home playoff game"}, and a real shot at Super Bowl ${roman(superBowlNumber(year))}.`
        : `${hi} wins and ${po >= 0.15 ? "a playoff ticket nobody saw coming" : "the start of something"}.`;
    const worstCase = `${lo} wins${hc && (hc.yearsOnJob ?? 0) >= 3 && lo <= games * 0.35 ? `, and ${hc.name} is coaching for his job by Thanksgiving` : ""}${tier === "Contender" ? ", and a long winter of asking what happened" : ""}.`;
    const verdict =
      tier === "Contender"
        ? pick(k + "v", ["A Super Bowl or bust kind of year.", "Anything short of January is a failure.", "The roster is built to win now. So win now."])
        : tier === "Playoff hopeful"
          ? pick(k + "v", ["Good enough to play in January. Is it good enough to stay?", "A playoff team on paper. Paper doesn't tackle.", "Should be in the mix in December."])
          : tier === "In the mix"
            ? pick(k + "v", ["A coin flip for the playoffs. The schedule decides it.", "One break either way swings this whole season.", "They'll be in it into November. Then we'll find out."])
            : tier === "Long shot"
              ? pick(k + "v", ["Needs a lot to go right.", "A few upsets away from being interesting.", "Spoiler material. Circle the date if you're a contender."])
              : pick(k + "v", ["It's a development year. Judge the young players, not the record.", "Top-five pick territory, and that's not the worst thing.", "Patience. The building knows it's a long road."]);
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
      ? `${pick(key + year, ["Too close to call.", "A two-horse race.", "This one goes down to December."])} The ${nick(top.id)} take it in ${pct(top.divisionPct)} of our simulations, the ${nick(second!.id)} in ${pct(second!.divisionPct)}.`
      : `The ${nick(top.id)} win it ${pct(top.divisionPct)} of the time. ${top.divisionPct >= 0.6 ? "The rest are playing for a wild card." : "Not a lock, but the clear favorite."}`;
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
    { label: "Most Valuable Player", picks: mvp },
    { label: "Offensive Player of the Year", picks: opoy },
    { label: "Defensive Player of the Year", picks: dpoy },
    { label: "Offensive Rookie of the Year", picks: oroy },
    { label: "Defensive Rookie of the Year", picks: droy },
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
    .map((p) => ({ playerId: p.id, teamId: teamOf(p), note: `${p.pos}, ${p.age}. ${pick(p.id + year, ["The staff can't stop talking about him.", "Year two, three is when it clicks. This is the year.", "The tools were always there. Now the reps are too.", "Camp's best story."])}` }));
  const lastRide = all
    .filter((p) => p.age >= 33 && p.ovr >= 76 && p.pos !== "K" && p.pos !== "P")
    .sort((a, b) => b.ovr - a.ovr + (b.age - a.age))
    .slice(0, 4)
    .map((p) => {
      const c = careerTotals(p);
      const line = p.pos === "QB" ? `${comma(c.passYds)} career passing yards` : p.pos === "RB" ? `${comma(c.rushYds)} career rushing yards` : ["WR", "TE"].includes(p.pos) ? `${comma(c.rec)} career catches` : c.sacks ? `${Math.round(c.sacks)} career sacks` : `${p.yearsPro} seasons`;
      return { playerId: p.id, teamId: teamOf(p), note: `${p.age} years old, ${line}. ${pick(p.id + "r" + year, ["How many Sundays are left?", "He says he's got one more in him.", "Enjoy it while it lasts.", "Father Time is undefeated. He's still trying."])}` };
    });
  const hotSeat = teams
    .map((t) => ({ t, c: save.teams[t.id]!.coachId ? save.coaches[save.teams[t.id]!.coachId!] : undefined }))
    .filter((x): x is { t: PreviewTeam; c: Coach } => !!x.c && !x.t.newCoach && (x.c.yearsOnJob ?? 0) >= 3 && x.t.id !== u)
    .sort((a, b) => a.t.projW - b.t.projW - (a.c.yearsOnJob - b.c.yearsOnJob) * 0.15)
    .slice(0, 3)
    .map(({ t, c }) => ({ coachId: c.id, teamId: t.id, note: `Year ${c.yearsOnJob + 1}. ${recText(c.careerWins, c.careerLosses, c.careerTies)} career. Projected ${t.projW.toFixed(1)} wins. ${pick(c.id + year, ["Ownership's patience has a number on it.", "Needs a fast start.", "The rumors start by October if this goes wrong."])}` }));

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
          ? pick(g.id, ["Throw out the records.", "Bad blood, good football.", "The one both cities circle first."])
          : g.week === 1
            ? "Opening week, and it's a heavyweight bout."
            : T.get(h)!.tier === "Contender" && T.get(a)!.tier === "Contender"
              ? pick(g.id, ["Could be a January preview.", "Two contenders, one tiebreaker.", "Seeding implications in pencil."])
              : g.homeId === u || g.awayId === u
                ? "The owner's box will be full."
                : pick(g.id, ["Styles make fights.", "Prove-it game.", "Somebody's statement game."]);
      return { gameId: g.id, week: g.week, homeId: h, awayId: a, line, note: `${note}${g.night ? " Under the lights." : ""}` };
    });

  /* -------------------------------------------------- storylines */

  const stories: SeasonPreview["storylines"] = [];
  const story = (id: string, kicker: string, title: string, body: string, teamIds: TeamId[], playerIds: string[] = []) => stories.push({ id, kicker, title, body, teamIds, playerIds });
  if (lastChamp && T.get(lastChamp)) {
    const t = T.get(lastChamp)!;
    story(
      "champ",
      "THE CHAMPS",
      `Can the ${nick(lastChamp)} do it again?`,
      `The ${name(lastChamp)} won Super Bowl ${roman(lastSb!.number)}, ${Math.max(lastSb!.homeScore, lastSb!.awayScore)}-${Math.min(lastSb!.homeScore, lastSb!.awayScore)} over the ${name(lastRunner!)}. Repeating is the hardest thing in this sport. Our simulations give them a ${pct(t.titlePct)} chance to raise the trophy again, and ${pct(t.playoffPct)} to get back to January at all. ${t.departures.length ? `They lost ${t.departures.slice(0, 2).map((x) => playerName(save.players[x]!)).join(" and ")} this offseason.` : "They kept the band together."}`,
      [lastChamp],
      t.departures.slice(0, 2),
    );
  }
  if (lastRunner && T.get(lastRunner)) {
    const t = T.get(lastRunner)!;
    story("runner", "UNFINISHED BUSINESS", `The ${nick(lastRunner)} came up one game short`, `Nobody remembers who lost the Super Bowl, except the team that lost it. The ${name(lastRunner)} are back with a ${pct(t.confPct)} chance to win the ${conferenceOf(year, lastRunner)} again. ${t.playoffPct >= 0.6 ? "The roster is still there." : "But the hangover is real: just a " + pct(t.playoffPct) + " shot at the playoffs."}`, [lastRunner]);
  }
  const newCoachTeams = teams.filter((t) => t.newCoach);
  if (newCoachTeams.length) {
    story(
      "coaches",
      "NEW FACES ON THE SIDELINE",
      `${newCoachTeams.length === 1 ? "One club" : `${numberWord(newCoachTeams.length)[0]!.toUpperCase() + numberWord(newCoachTeams.length).slice(1)} clubs`} start over with a new head coach`,
      newCoachTeams
        .slice(0, 5)
        .map((t) => `${t.coach} takes over the ${name(t.id)} (${recText(t.lastYear.w, t.lastYear.l, t.lastYear.t)} last year, projected ${t.projW.toFixed(1)}).`)
        .join(" "),
      newCoachTeams.map((t) => t.id),
    );
  }
  const rookieQbs = teams.filter((t) => t.qbId && save.players[t.qbId]?.draftYear === year);
  if (rookieQbs.length) {
    story(
      "rookieqb",
      "BABY-FACED ASSASSINS",
      rookieQbs.length === 1 ? `A rookie starts at quarterback in ${displayName(year, rookieQbs[0]!.id).replace(` ${nick(rookieQbs[0]!.id)}`, "")}` : `${numberWord(rookieQbs.length)[0]!.toUpperCase() + numberWord(rookieQbs.length).slice(1)} rookie quarterbacks start week one`,
      rookieQbs.map((t) => `${playerName(save.players[t.qbId!]!)} gets the keys for the ${name(t.id)}.`).join(" ") + " Rookie quarterbacks get humbled. The question is how fast they recover.",
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
      "NEW ADDRESS",
      `${playerName(bigAdds[0]!)} headlines the offseason's biggest moves`,
      bigAdds.map((p) => `${playerName(p)} (${p.pos}) goes from the ${name(last(p)!.teamId as TeamId)} to the ${name(teamOf(p))}.`).join(" "),
      bigAdds.map(teamOf),
      bigAdds.map((p) => p.id),
    );
  }
  const holdouts = all.filter((p) => p.holdout && p.ovr >= 74).sort((a, b) => b.ovr - a.ovr).slice(0, 3);
  if (holdouts.length) {
    story("holdouts", "CONTRACT STANDOFFS", `${playerName(holdouts[0]!)} isn't in camp`, holdouts.map((p) => `${playerName(p)} wants a new deal from the ${name(teamOf(p))}.`).join(" ") + " These usually end the week before the opener. Usually.", holdouts.map(teamOf), holdouts.map((p) => p.id));
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
  if (risers[0]) story("rise", "ON THE RISE", `The ${nick(risers[0].id)} are coming`, `${recText(risers[0].lastYear.w, risers[0].lastYear.l, risers[0].lastYear.t)} a year ago. Projected ${risers[0].projW.toFixed(1)} wins now, with a ${pct(risers[0].playoffPct)} shot at the playoffs. ${risers[0].outlook}`, [risers[0].id]);
  if (fallers[0]) story("fall", "BUYER BEWARE", `Don't trust the ${nick(fallers[0].id)}' record`, `They went ${recText(fallers[0].lastYear.w, fallers[0].lastYear.l, fallers[0].lastYear.t)}. The roster projects closer to ${fallers[0].projW.toFixed(1)} wins. ${fallers[0].outlook}`, [fallers[0].id]);

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

  const mine = T.get(u)!;
  const gradeSorted = mine.grades.slice().sort((a, b) => a.pct - b.pct);
  const yours = {
    teamId: u,
    headline:
      mine.tier === "Contender"
        ? `The ${nick(u)} are a Super Bowl contender`
        : mine.tier === "Playoff hopeful"
          ? `The ${nick(u)} should be playing in January`
          : mine.tier === "In the mix"
            ? `The ${nick(u)} are a coin flip`
            : mine.tier === "Long shot"
              ? `The ${nick(u)} need things to break their way`
              : `A building year for the ${nick(u)}`,
    lines: [
      `Projected ${mine.projW.toFixed(1)}-${mine.projL.toFixed(1)}, ranked ${ordinal(mine.rank)} of ${ids.length}. The range runs from ${mine.range[0]} to ${mine.range[1]} wins.`,
      `${pct(mine.playoffPct)} to make the playoffs, ${pct(mine.divisionPct)} to win the ${mine.division}, ${pct(mine.titlePct)} to win it all.`,
      mine.toughStretch ? `The stretch that decides it: ${mine.toughStretch}.` : "",
      mine.opener ? `It starts in week one. ${mine.opener}.` : "",
    ].filter(Boolean),
    keys: gradeSorted.slice(0, 2).map((g) => `${GROUP_WORDS[g.key].good[0]!.toUpperCase() + GROUP_WORDS[g.key].good.slice(1)} grades out ${g.grade}.`),
    concerns: gradeSorted.slice(-2).reverse().map((g) => `${GROUP_WORDS[g.key].bad[0]!.toUpperCase() + GROUP_WORDS[g.key].bad.slice(1)}: ${g.grade}.`),
  };

  /* -------------------------------------------------- the broadcast */

  const chapters: Episode["chapters"] = [];
  const chap = (id: string, kicker: string, title: string, teamIds: TeamId[], lines: Line[]) => chapters.push({ id, kicker, title, teamIds, lines });
  const H = (text: string): Line => ({ speaker: "HOST", text });
  const A = (text: string): Line => ({ speaker: "ANALYST", text });
  const R = (text: string): Line => ({ speaker: "REPORTER", text });
  const k = String(year);
  const favorite = teams.slice().sort((a, b) => b.titlePct - a.titlePct)[0]!;
  chap("open", "SEASON PREVIEW", `${year}: here we go`, [favorite.id], [
    H(
      `${pick(k + "hi", ["Good morning, everybody, and welcome in.", "Welcome in, everybody. Pull up a chair.", "Hello again, everybody, and welcome to the season."])} The ${year} season is days away, ${ids.length} teams, ${games} games apiece, and one trophy. I'm ${PREVIEW_CAST.HOST.name}, alongside ${PREVIEW_CAST.ANALYST.name.replace(/ “.*” /, " ")} and ${PREVIEW_CAST.REPORTER.name}. We've watched the film, we've run the numbers two thousand times, and we're putting our picks on the record.`,
    ),
    A(`${pick(k + "a1", ["I've been waiting all summer for this.", "Rich, I've got some takes today. Hold onto something.", "Camp's over. Now it counts."])} The favorite on paper is the ${name(favorite.id)}, and I'm not going to pretend otherwise: ${pct(favorite.titlePct)} to win it all. That's the best number in the league. ${favorite.titlePct < 0.15 ? "But it also means the field is wide open." : "That's a team that knows exactly what it is."}`),
    ...(rules ? [R(`And before we go anywhere: ${rules}`)] : []),
  ]);
  for (const s of stories.slice(0, 4)) {
    chap(`story-${s.id}`, s.kicker, s.title, s.teamIds.slice(0, 2), [H(s.body), A(pick(s.id + k, ["I'll tell you what I'm watching: the first three weeks. You find out who you are early.", "Here's my issue. Talk is cheap in August. Show me in October.", "I played in this league. Momentum from last year doesn't carry over. You build it again from scratch.", "This is the storyline that'll define the first half of the season."]))]);
  }
  for (const d of divisions) {
    const order = d.order.map((id) => T.get(id)!);
    const top = order[0]!;
    const sleeperD = order.slice(1).sort((a, b) => b.playoffPct - a.playoffPct)[0];
    const newestKey = order.flatMap((t) => t.newcomers.slice(0, 1)).map((id) => save.players[id]!).filter(Boolean).sort((a, b) => b.ovr - a.ovr)[0];
    chap(`div-${d.key}`, d.conf, d.key, d.order.slice(0, 2), [
      H(`The ${d.key}. ${d.note}`),
      A(`Here's how I see it finishing: ${order.map((t, i) => `${i + 1}, the ${nick(t.id)}`).join("; ")}. ${top.outlook.split(". ").slice(0, 2).join(". ")}.${sleeperD && sleeperD.playoffPct >= 0.3 ? ` Don't sleep on the ${nick(sleeperD.id)}, though: ${pct(sleeperD.playoffPct)} to make the playoffs.` : ""}`),
      ...(newestKey ? [R(`${pick(d.key + k, ["I'm told", "People around the club tell me", "Talking to the staff this week,"])} ${playerName(newestKey)} has been the story of camp for the ${nick(teamOf(newestKey))}. ${newestKey.draftYear === year ? "Rookie or not, they expect him to play." : "The fit looks right."}`)] : []),
    ]);
  }
  chap(
    "lightning",
    "LIGHTNING ROUND",
    "Every club in one breath",
    [],
    ranked.flatMap((id, i) => {
      const t = T.get(id)!;
      const line = `${i + 1}. The ${name(id)}: ${t.projW.toFixed(1)} wins. ${t.verdict}`;
      return [i % 2 ? A(line) : H(line)];
    }),
  );
  for (const a of awards.slice(0, 3)) {
    const top = a.picks[0]!;
    const who = top.playerId ? playerName(save.players[top.playerId]!) : save.coaches[top.coachId!]?.name ?? "";
    chap(`award-${a.label}`, "AWARDS WATCH", a.label, [top.teamId], [
      H(`${a.label}. The favorite on our board: ${who}, ${top.odds}. ${top.note}`),
      A(`${a.picks.length > 1 ? `I'll give you a name at a better price: ${a.picks[1]!.playerId ? playerName(save.players[a.picks[1]!.playerId]!) : ""}, ${a.picks[1]!.odds}.` : ""} ${pick(a.label + k, ["Value is value.", "That's where the money is.", "Remember I said it."])}`),
    ]);
  }
  if (bold.length) chap("bold", "BOLD PREDICTIONS", "On the record", bold.slice(0, 2).flatMap((b) => b.teamIds.slice(0, 1)), bold.slice(0, 5).map((b, i) => (i % 2 ? H(b.text) : A(b.text))));
  chap("yours", "YOUR CLUB", yours.headline, [u], [
    H(`Now to the ${name(u)}. ${yours.lines[0]}`),
    A(`${yours.lines[1]} ${yours.keys.join(" ")} The concern: ${yours.concerns[0]?.toLowerCase() ?? "depth"}`),
    R(`${mine.toughStretch ? `Circle this: ${mine.toughStretch}. ` : ""}${mine.newcomers.length ? `Watch ${playerName(save.players[mine.newcomers[0]!]!)}, the newcomer the staff is most excited about.` : "Same core, one more year together."}`),
  ]);
  chap("sb", "THE PICK", `Super Bowl ${roman(superBowlNumber(year))}`, [sbPick.winner, sbPick.loser], [
    H(`All right. The pick. Super Bowl ${roman(superBowlNumber(year))}.`),
    A(`I've got the ${name(sbPick.winner)} over the ${name(sbPick.loser)}, ${sbPick.score}. ${T.get(sbPick.winner)!.outlook.split(". ")[0]}. That's my champion.`),
    R(`For what it's worth, our two thousand simulations agree: the ${nick(sbPick.winner)} win it ${pct(sbPick.confidence)} of the time. Which means ${pct(1 - sbPick.confidence)} of the time, somebody proves us wrong.`),
    ...(history ? [H(history)] : []),
    H(`${pick(k + "bye", ["That's the preview. Enjoy the season, everybody.", "That's our show. Kickoff is close. We'll see you Sunday.", "The picks are in. Now let's go play. See you on Sunday."])}`),
  ]);

  const episode: Episode = {
    id: `${year}-seasonPreview`,
    edition: "seasonPreview",
    headline: `${year} Season Preview`,
    subtitle: `${ids.length} teams · ${divisions.length} divisions · 2,000 simulated seasons`,
    chapters,
    focusIds: [],
    cast: PREVIEW_CAST,
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
