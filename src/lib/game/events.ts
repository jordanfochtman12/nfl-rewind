import type { AwardsResult, DynastySave, Player, Pos, TeamId } from "./types.ts";
import { recordAward, recordAwards, recordProBowl, recordRings } from "./honors.ts";
import { activeTeamIds, conferenceOf, displayName, gamesInSeason, roman, superBowlNumber } from "./teams.ts";
import { proBowlSite, superBowlSite } from "./data/bowlSites.ts";
import { generatePlayer, livingPlayers, playerName, rosterOf, signRealFa } from "./players.ts";
import { simGame } from "./sim.ts";
import { addNews } from "./news.ts";
import { rand, randInt } from "./rng.ts";
import { shouldRetire } from "./development.ts";
import { careerTotals } from "./leaders.ts";
import { checkSeasonMilestones } from "./records.ts";
import { touchGrade } from "./grade.ts";
import { retireCoach, shouldRetireCoach } from "./staff.ts";
import { honorInductees, honorRetirees } from "./legacy.ts";
import { ownPlayer } from "./players.ts";
import { cpuHandles } from "./teamControl.ts";
import {
  coachHofBlurb,
  coachHofEligible,
  coachHofScore,
  lastCoachTeam,
  lastTeamOf,
  playerHofBlurb,
  playerHofEligible,
  playerHofScore,
} from "./hof.ts";

function seasonList(save: DynastySave): Player[] {
  return livingPlayers(save).filter((p) => p.teamId !== "retired" && p.teamId !== "hof" && p.stats[save.year]);
}

const OFFENSE: Pos[] = ["QB", "RB", "FB", "WR", "TE"];
const DEFENSE: Pos[] = ["DE", "DT", "OLB", "MLB", "CB", "S"];

/** What a player produced, scored the way voters weigh it at his position. */
function offPerf(p: Player, year: number): number {
  const s = p.stats[year];
  if (!s) return 0;
  if (p.pos === "QB")
    return s.passYds / 25 + s.passTd * 4 - s.passInt * 2 + s.rushYds / 10 + s.rushTd * 6;
  if (p.pos === "RB" || p.pos === "FB") return (s.rushYds + s.recYds) / 10 + (s.rushTd + s.recTd) * 6 + s.rec * 0.2;
  if (p.pos === "WR" || p.pos === "TE") return s.recYds / 10 + s.recTd * 6 + s.rec * 0.25;
  return 0;
}

/**
 * Defensive ballots go to the plays that change games: sacks, takeaways, stops behind the
 * line. Tackles count a little; a linebacker's 140 stops used to outvote every pass rusher.
 */
function defPerf(p: Player, year: number): number {
  const s = p.stats[year];
  if (!s) return 0;
  return s.sacks * 4 + s.ints * 4.5 + s.ff * 3 + (s.fr ?? 0) * 2 + (s.tfl ?? 0) * 0.8 + (s.pd ?? 0) * 0.5 + s.tackles * 0.05;
}

/** Old name kept for the All-Pro and Pro Bowl helpers below. */
function yearScore(p: Player, year: number): number {
  return OFFENSE.includes(p.pos) ? offPerf(p, year) : defPerf(p, year);
}

/** The year each award was first handed out (AP; Comeback from the PFWA in 1972). */
const FIRST_YEAR = { mvp: 1957, oroy: 1967, droy: 1967, defPoy: 1971, offPoy: 1972, cpoty: 1972, coy: 1957 } as const;

const ALLPRO_SLOTS: [Pos, number][] = [
  ["QB", 1],
  ["RB", 2],
  ["WR", 2],
  ["TE", 1],
  ["LT", 1],
  ["LG", 1],
  ["C", 1],
  ["RG", 1],
  ["RT", 1],
  ["DE", 2],
  ["DT", 2],
  ["OLB", 2],
  ["MLB", 1],
  ["CB", 2],
  ["S", 2],
  ["K", 1],
];

function kickPerf(p: Player, year: number): number {
  const s = p.stats[year];
  if (!s || !s.fgAtt) return 0;
  return s.fgMade * 3 + (s.fgMade / s.fgAtt) * 40;
}

function allProIds(players: Player[], year: number): string[] {
  const ids: string[] = [];
  const line = (p: Player) =>
    p.pos === "K" ? kickPerf(p, year) : ["LT", "LG", "C", "RG", "RT"].includes(p.pos) ? p.ovr : yearScore(p, year) + p.ovr * 0.4;
  for (const [pos, n] of ALLPRO_SLOTS) {
    const pool = players.filter((p) => p.pos === pos).sort((a, b) => line(b) - line(a));
    for (const p of pool.slice(0, n)) ids.push(p.id);
  }
  return ids;
}

const winPctOf = (save: DynastySave, p: Player, year: number): number => {
  const t = save.teams[(p.stats[year]?.teamId ?? p.teamId) as TeamId];
  if (!t) return 0.5;
  const g = t.wins + t.losses + t.ties;
  return g ? (t.wins + t.ties / 2) / g : 0.5;
};

/** One award's ballot, best first. */
export interface AwardBallots {
  mvp: Player[];
  offPoy: Player[];
  defPoy: Player[];
  oroy: Player[];
  droy: Player[];
  cpoty: Player[];
  coy: { teamId: TeamId; coachId: string }[];
}

/**
 * The ballots behind every award. Each award is judged the way its real voters judge it:
 * production relative to the best at the same position, the MVP weighted to quarterbacks
 * (overwhelmingly so since 2000) and to winning clubs, the defensive award to sacks and
 * takeaways, Comeback to a veteran back from an injury or a lost year. `live` measures playing
 * time against the games played so far, for the in-season race ladders.
 */
export function awardBallots(save: DynastySave, opts: { live?: boolean; top?: number } = {}): AwardBallots {
  const year = save.year;
  const top = opts.top ?? 5;
  const soFar = opts.live
    ? Math.max(1, ...activeTeamIds(year).map((id) => { const t = save.teams[id]; return t ? t.wins + t.losses + t.ties : 0; }))
    : gamesInSeason(year);
  const share = (p: Player) => (p.stats[year]?.gp ?? 0) / soFar;
  const players = seasonList(save).filter((p) => share(p) >= 0.5);
  const off = players.filter((p) => OFFENSE.includes(p.pos));
  const def = players.filter((p) => DEFENSE.includes(p.pos));

  // Each position's bar: the average of its three best seasons this year.
  const bar = new Map<Pos, number>();
  for (const pos of OFFENSE) {
    const top = off.filter((p) => p.pos === pos).map((p) => offPerf(p, year)).sort((a, b) => b - a).slice(0, 3);
    bar.set(pos, Math.max(1, top.reduce((a, b) => a + b, 0) / Math.max(1, top.length)));
  }
  // Defenders by job. A sack-heavy line scores more on any single scale than an interception
  // season does, so each group is put on the edge rushers' scale: the factors are each group's
  // typical league leader measured over simulated seasons, tilted so the winners split the
  // way the real award has (about half edge rushers, the rest inside linemen, linebackers and
  // the secondary).
  const group = (pos: Pos) => (pos === "DE" || pos === "OLB" ? "edge" : pos === "DT" ? "inside" : pos === "MLB" ? "backer" : "db");
  // Refit after tackles moved to the linebackers and secondary and sacks to the true pass
  // rushers (where real ones are): 114 simulated seasons, fit to the real award's split.
  const DEF_SCALE = { edge: 1.12, inside: 1.1, backer: 1.46, db: 1.66 } as const;
  const edgeTop = def.filter((p) => group(p.pos) === "edge").map((p) => defPerf(p, year)).sort((a, b) => b - a).slice(0, 3);
  const edgeBar = Math.max(1, edgeTop.reduce((a, b) => a + b, 0) / Math.max(1, edgeTop.length));
  const rel = (p: Player) =>
    OFFENSE.includes(p.pos) ? offPerf(p, year) / bar.get(p.pos === "FB" ? "RB" : p.pos)! : (defPerf(p, year) * DEF_SCALE[group(p.pos)]) / edgeBar;

  // A back's MVP case by era, fit to the real award over two simulated histories: backs won a
  // third of the '70s and '90s votes, almost none in the '60s, the '80s or since 2010.
  const rbMvp = year <= 1969 ? 0.8 : year <= 1979 ? 0.94 : year <= 1989 ? 0.81 : year <= 1999 ? 0.95 : year <= 2009 ? 0.9 : year <= 2019 ? 0.84 : 0.8;
  const mvpWeight: Partial<Record<Pos, number>> = { QB: 1, RB: rbMvp, FB: 0.8 * (rbMvp / 0.9), WR: 0.78, TE: 0.62 };
  const rank = <T,>(list: T[], score: (x: T) => number, n = top) =>
    list.map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s).slice(0, n).map((r) => r.x);

  const mvpScore = (p: Player) =>
    (OFFENSE.includes(p.pos) ? (mvpWeight[p.pos] ?? 0.7) * rel(p) : 0.66 * rel(p)) + 0.7 * (winPctOf(save, p, year) - 0.5);
  const mvp = rank(players.filter((p) => OFFENSE.includes(p.pos) || DEFENSE.includes(p.pos)), mvpScore);

  // Tight ends are measured against tight ends, so a great one reads as dominant; no tight end
  // has won the real award, and this keeps them on the ballot without taking it.
  const opoyWeight: Partial<Record<Pos, number>> = { QB: 1, RB: 1, FB: 0.85, WR: 0.97, TE: 0.72 };
  const offPoy = rank(off, (p) => (opoyWeight[p.pos] ?? 0.8) * rel(p) + 0.25 * (winPctOf(save, p, year) - 0.5));
  const defPoy = rank(def, (p) => rel(p) + 0.2 * (winPctOf(save, p, year) - 0.5));

  const rookies = seasonList(save).filter((p) => p.draftYear === year && share(p) >= 0.4);
  // Rookie ballots lean the way the real ones do: backs and quarterbacks first, tight ends rarely.
  const rookieWeight: Partial<Record<Pos, number>> = { QB: 1.24, RB: 1.24, FB: 0.8, WR: 1, TE: 0.8 };
  // 1957-66 the AP named one rookie of the year; it went to an offensive player every time.
  const oroy = year >= FIRST_YEAR.oroy
    ? rank(rookies.filter((p) => OFFENSE.includes(p.pos)), (p) => (rookieWeight[p.pos] ?? 0.8) * rel(p))
    : rank(rookies, (p) => rel(p));
  const droy = rank(rookies.filter((p) => DEFENSE.includes(p.pos)), (p) => rel(p));

  // Comeback: a veteran whose last season was lost to injury, or fell well short of what he
  // had shown before, and who is back among the best at his position.
  const comeback = players
    .filter((p) => (p.draftYear ?? year) <= year - 2 && (OFFENSE.includes(p.pos) || DEFENSE.includes(p.pos)))
    .map((p) => {
      const last = p.stats[year - 1];
      const missed = last ? 1 - Math.min(1, last.gp / gamesInSeason(year - 1)) : 1;
      const prior = Object.keys(p.stats).map(Number).filter((y) => y < year - 1);
      const peak = Math.max(0, ...prior.map((y) => yearScore(p, y)));
      const slump = peak > 0 ? 1 - Math.min(1, yearScore(p, year - 1) / peak) : 0;
      const down = Math.max(missed, slump * 0.9);
      const now = rel(p);
      const w = ({ QB: 1.12, RB: 1, FB: 0.8, WR: 0.95, TE: 0.8 } as Partial<Record<Pos, number>>)[p.pos] ?? 0.9;
      return { p, down, now, score: w * now * (0.6 + down) };
    })
    // The MVP isn't also the year's comeback story; the writers give that one to someone else.
    .filter((x) => x.down >= 0.45 && x.now >= 0.7 && yearScore(x.p, year) > 0 && ![mvp[0]?.id, offPoy[0]?.id, defPoy[0]?.id].includes(x.p.id));
  const cpoty = rank(comeback, (x) => x.score).map((x) => x.p);

  // Coach of the Year: the biggest turnaround among winning clubs, then the best record.
  const coy = rank(
    activeTeamIds(year)
      .map((id) => ({ id, t: save.teams[id], c: save.teams[id]?.coachId ? save.coaches[save.teams[id]!.coachId!] : undefined }))
      .filter((x) => x.t && x.c),
    (x) => {
      const g = Math.max(1, x.t!.wins + x.t!.losses + x.t!.ties);
      const pct = (x.t!.wins + x.t!.ties / 2) / g;
      const prev = save.history.seasons.find((c) => c.year === year - 1 && c.teamId === x.id);
      const prevPct = prev ? (prev.wins + prev.ties / 2) / Math.max(1, prev.wins + prev.losses + prev.ties) : 0.5;
      return (pct - prevPct) * 1.4 + pct + (pct > 0.5 && prevPct < 0.5 ? 0.15 : 0);
    },
  ).map((x) => ({ teamId: x.id, coachId: x.c!.id }));

  return { mvp, offPoy, defPoy, oroy, droy, cpoty, coy };
}

/** Which awards existed in a given season (AP; Comeback from the PFWA in 1972). */
export function awardExists(year: number, k: keyof typeof FIRST_YEAR): boolean {
  return year >= FIRST_YEAR[k];
}

/** Pure ballot, also used by the regular-season studio special. */
export function calculateAwards(save: DynastySave): AwardsResult {
  const year = save.year;
  const b = awardBallots(save, { top: 1 });
  const has = (k: keyof typeof FIRST_YEAR) => year >= FIRST_YEAR[k];
  return {
    year,
    mvp: b.mvp[0]?.id,
    offPoy: has("offPoy") ? b.offPoy[0]?.id : undefined,
    defPoy: has("defPoy") ? b.defPoy[0]?.id : undefined,
    oroy: b.oroy[0]?.id,
    droy: has("droy") ? b.droy[0]?.id : undefined,
    cpoty: has("cpoty") ? b.cpoty[0]?.id : undefined,
    coy: b.coy[0]?.coachId,
    allPro: allProIds(seasonList(save), year),
  };
}

export function resolveAwards(save: DynastySave): AwardsResult {
  const year = save.year;
  const awards = calculateAwards(save);
  const cpoty = awards.cpoty ? save.players[awards.cpoty] : undefined;
  save.awards = awards;
  save.history.awards.push(awards);
  recordAwards(save, awards);
  const mvp = awards.mvp ? save.players[awards.mvp] : undefined;
  if (mvp) {
    addNews(save, {
      kind: "award",
      headline: `${playerName(mvp)} named ${year} MVP`,
      body: `The writers land on ${playerName(mvp)} (${mvp.pos}, ${String(mvp.teamId).toUpperCase()}).`,
      teamIds: mvp.teamId !== "fa" && mvp.teamId !== "retired" && mvp.teamId !== "hof" ? [mvp.teamId] : [],
      playerIds: [mvp.id],
    });
  }
  if (cpoty) {
    addNews(save, {
      kind: "award",
      headline: `Comeback Player: ${playerName(cpoty)}`,
      body: (cpoty.stats[year - 1]?.gp ?? 0) < gamesInSeason(year - 1) / 2
        ? `Last season ended early. This one ended with him among the best at his position.`
        : `Written off after a down year. He answered with one of the best seasons at his position.`,
      teamIds: cpoty.teamId !== "fa" && cpoty.teamId !== "retired" && cpoty.teamId !== "hof" ? [cpoty.teamId] : [],
      playerIds: [cpoty.id],
    });
  }
  const coach = awards.coy ? save.coaches[awards.coy] : undefined;
  if (coach) {
    coach.coyYears = [...(coach.coyYears ?? []).filter((y) => y !== year), year];
    addNews(save, {
      kind: "award",
      headline: `${coach.name} named ${year} Coach of the Year`,
      body: coach.teamId ? `The ${displayName(year, coach.teamId)} went ${save.teams[coach.teamId]?.wins}-${save.teams[coach.teamId]?.losses}.` : "",
      teamIds: coach.teamId ? [coach.teamId] : [],
      playerIds: [],
    });
  }
  checkSeasonMilestones(save);
  return awards;
}

export function resolveProBowl(save: DynastySave): void {
  const year = save.year;
  const confA: TeamId[] = [];
  const confB: TeamId[] = [];
  const labelA = year < 1970 ? "NFL" : "NFC";
  const labelB = year < 1970 ? "AFL" : "AFC";
  for (const id of activeTeamIds(year)) {
    const c = conferenceOf(year, id);
    if (c === "NFL" || c === "NFC") confA.push(id);
    else confB.push(id);
  }
  // A real roster: each conference sends its best at every position, not its 22 biggest
  // stat lines (which could leave the game without a lineman).
  const SLOTS: [Pos, number][] = [
    ["QB", 2], ["RB", 2], ["WR", 3], ["TE", 1], ["LT", 1], ["LG", 1], ["C", 1], ["RG", 1], ["RT", 1],
    ["DE", 2], ["DT", 2], ["OLB", 2], ["MLB", 1], ["CB", 2], ["S", 2], ["K", 1],
  ];
  const vote = (p: Player) =>
    p.pos === "K" ? kickPerf(p, year) : ["LT", "LG", "C", "RG", "RT"].includes(p.pos) ? p.ovr : yearScore(p, year) + p.ovr * 0.4;
  const pool = (ids: TeamId[]) => {
    const all = ids.flatMap((id) => rosterOf(save, id));
    return SLOTS.flatMap(([pos, n]) => all.filter((p) => p.pos === pos).sort((x, y) => vote(y) - vote(x)).slice(0, n));
  };
  const a = pool(confA);
  const b = pool(confB);
  const site = proBowlSite(year);
  const aScore = 14 + randInt(save, 0, 21);
  const bScore = 14 + randInt(save, 0, 21);
  const mvp = (aScore >= bScore ? a : b).filter((p) => OFFENSE.includes(p.pos)).sort((x, y) => vote(y) - vote(x))[0];
  for (const p of [...a, ...b]) recordProBowl(p, year);
  save.proBowl = {
    id: `${year}-pb`,
    year,
    week: 1,
    phase: "proBowl",
    round: `${year} Pro Bowl`,
    homeId: year < 1970 ? "nfl" : "nfc",
    awayId: year < 1970 ? "afl" : "afc",
    homeScore: aScore,
    awayScore: bScore,
    played: true,
    mvpPlayerId: mvp?.id,
    homeRoster: a.map((p) => p.id),
    awayRoster: b.map((p) => p.id),
    stadium: site.site,
    neutral: true,
  };
  addNews(save, {
    kind: "headline",
    headline: `${labelA} ${aScore}, ${labelB} ${bScore} at ${site.site}`,
    body: `${site.flavor} MVP: ${mvp ? playerName(mvp) : "shared"}.`,
    teamIds: [],
    playerIds: mvp ? [mvp.id] : [],
  });
}

export function gatherRetirees(save: DynastySave): string[] {
  const out: string[] = [];
  for (const p of Object.values(save.players)) {
    if (p.teamId === "retired" || p.teamId === "hof") continue;
    if (p.teamId === "fa" && p.age < 30 && !p.historical) continue;
    if (shouldRetire(save, p)) out.push(p.id);
  }
  // Every eligible player actually retires (state change) - RetirementNight's own
  // UI already truncates what it displays, so this list must not be capped here too,
  // or eligible players silently never retire and keep aging in the player pool.
  save.pendingRetirees = out;
  const coaches: string[] = [];
  for (const c of Object.values(save.coaches)) {
    if (shouldRetireCoach(save, c)) coaches.push(c.id);
  }
  save.pendingCoachRetirees = coaches;
  return save.pendingRetirees;
}

export function resolveRetirement(save: DynastySave): void {
  for (const id of save.pendingRetirees) {
    const p = save.players[id];
    if (!p) continue;
    const teamId = p.teamId;
    if (teamId !== "fa" && teamId !== "retired" && teamId !== "hof") {
      save.teams[teamId].roster = save.teams[teamId].roster.filter((x) => x !== id);
    }
    p.teamId = "retired";
    p.retiredYear = save.year + 1;
    const seasons = Math.max(1, p.yearsPro);
    const rec = {
      playerId: p.id,
      year: save.year,
      teamId: (teamId === "fa" || teamId === "retired" || teamId === "hof" ? save.userTeamId : teamId) as TeamId,
      seasons,
      blurb: (() => {
        const c = careerTotals(p);
        return `${playerName(p)} hangs them up after ${seasons} seasons. Peak ${p.peakOvr}. Career: ${c.passYds ? c.passYds + " pass yds" : ""} ${c.rushYds ? c.rushYds + " rush" : ""} ${c.rec ? c.rec + " rec" : ""}`
          .replace(/ +/g, " ")
          .trim();
      })(),
      kind: "player" as const,
    };
    save.history.retirements.push(rec);
    if (p.historical || p.peakOvr >= 84 || p.userTied) {
      addNews(save, {
        kind: "retire",
        headline: `${playerName(p)} retires`,
        body: rec.blurb,
        teamIds: [rec.teamId],
        playerIds: [p.id],
      });
    }
  }
  honorRetirees(save, save.pendingRetirees);
  for (const id of save.pendingCoachRetirees ?? []) {
    const c = save.coaches[id];
    if (c) retireCoach(save, c);
  }
}

export function gatherHof(save: DynastySave): string[] {
  const enshrinedPlayers = new Set(save.history.hof.flatMap((member) => member.playerId ? [member.playerId] : []));
  const eligible = Object.values(save.players).filter((p) => !enshrinedPlayers.has(p.id) && playerHofEligible(save, p));
  eligible.sort((a, b) => playerHofScore(save, b) - playerHofScore(save, a));
  save.pendingHof = eligible.slice(0, 5).map((p) => p.id);
  const enshrinedCoaches = new Set(save.history.hof.flatMap((member) => member.coachId ? [member.coachId] : []));
  const coaches = Object.values(save.coaches).filter((c) => !enshrinedCoaches.has(c.id) && coachHofEligible(save, c));
  coaches.sort((a, b) => coachHofScore(b) - coachHofScore(a));
  save.pendingCoachHof = coaches.slice(0, 2).map((c) => c.id);
  return save.pendingHof;
}

export function resolveHof(save: DynastySave): void {
  const classYear = save.year + 1;
  // The books, not the player record, are the authority: a stale copy once let Willie Lanier in twice.
  const enshrined = new Set(save.history.hof.map((m) => m.playerId ?? `coach:${m.coachId}`));
  for (const id of save.pendingHof) {
    const p = ownPlayer(save, id);
    if (!p || enshrined.has(p.id)) continue;
    p.hofYear = classYear;
    p.teamId = "hof";
    const teamId = lastTeamOf(save, p);
    const blurb = playerHofBlurb(save, p);
    save.history.hof.push({ playerId: p.id, year: classYear, teamId, blurb, kind: "player" });
    const honorList = save.history.teamOfHonor[teamId] ?? [];
    if (!honorList.includes(p.id)) honorList.push(p.id);
    save.history.teamOfHonor[teamId] = honorList;
    addNews(save, {
      kind: "hof",
      headline: `Hall of Fame: ${playerName(p)}`,
      body: blurb,
      teamIds: [teamId],
      playerIds: [p.id],
    });
  }
  honorInductees(save, save.pendingHof);
  for (const id of save.pendingCoachHof ?? []) {
    const c = save.coaches[id];
    if (!c || c.hofYear || enshrined.has(`coach:${c.id}`)) continue;
    c.hofYear = classYear;
    c.teamId = null;
    const teamId = lastCoachTeam(save, c);
    const blurb = coachHofBlurb(c);
    save.history.hof.push({ coachId: c.id, year: classYear, teamId, blurb, kind: "coach" });
    const coachHonorList = save.history.teamOfHonor[teamId] ?? [];
    if (!coachHonorList.includes(c.id)) coachHonorList.push(c.id);
    save.history.teamOfHonor[teamId] = coachHonorList;
    addNews(save, {
      kind: "hof",
      headline: `Hall of Fame: ${c.name}`,
      body: blurb,
      teamIds: [teamId],
      playerIds: [],
    });
  }
}

export function resolveSuperBowl(save: DynastySave): void {
  const g = save.superBowl;
  if (!g) return;
  if (!g.played) simGame(save, g);
  const site = superBowlSite(save.year);
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const winner = g.homeScore >= g.awayScore ? home : away;
  const mvpId = g.mvpPlayerId;
  const mvp = mvpId ? save.players[mvpId] : undefined;
  save.history.superBowls.push({
    year: save.year,
    number: superBowlNumber(save.year),
    site: site.site,
    city: site.city,
    homeId: home,
    awayId: away,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    mvpId,
    mvpName: mvp ? playerName(mvp) : undefined,
    atmosphere: site.flavor,
  });
  save.history.championships.push({
    year: save.year,
    league: save.year < 1970 ? "Super Bowl" : "NFL",
    teamId: winner,
  });
  recordRings(save, save.year, winner);
  if (mvp) recordAward(mvp, save.year, "SBMVP");
  const credit = (id: TeamId, won: boolean) => {
    const hc = save.teams[id]?.coachId ? save.coaches[save.teams[id]!.coachId!] : undefined;
    if (!hc) return;
    hc.careerBowls = (hc.careerBowls ?? 0) + 1;
    if (won) hc.careerTitles = (hc.careerTitles ?? 0) + 1;
  };
  credit(winner, true);
  credit(winner === home ? away : home, false);
  addNews(save, {
    kind: "headline",
    headline: `${displayName(save.year, winner)} win Super Bowl ${roman(superBowlNumber(save.year))}`,
    body: `${g.homeScore}–${g.awayScore} at ${site.site}. ${mvp ? `MVP: ${playerName(mvp)}.` : ""} ${site.flavor}`,
    teamIds: [home, away],
    playerIds: mvp ? [mvp.id] : [],
  });
  // History mode has no owner to grade.
  if (!save.realHistory) touchGrade(save);
}

export function weekPrimetime(save: DynastySave): void {
  save.weekNews = [];
  const weekGames = save.schedule.filter((g) => g.year === save.year && g.week === save.week && g.phase === 'regular' && g.played);
  save.lastPow = {};
  if (!weekGames.length) return;
  const night = weekGames.find((g) => g.night);
  const blow = [...weekGames].sort(
    (a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore),
  )[0];
  const featured = night ?? blow;
  if (featured) {
    const w = featured.homeScore >= featured.awayScore ? featured.homeId : featured.awayId;
    const l = w === featured.homeId ? featured.awayId : featured.homeId;
    addNews(save, {
      kind: "headline",
      headline: `${displayName(save.year, w as TeamId)} ${Math.max(featured.homeScore, featured.awayScore)}, ${displayName(save.year, l as TeamId)} ${Math.min(featured.homeScore, featured.awayScore)}`,
      body: featured.night
        ? featured.slot === 'M' ? "Monday night. The country watched." : "Under the lights. The evening's featured game."
        : featured.rivalry
          ? "A rivalry game that will sit in the Monday papers."
          : Math.abs(featured.homeScore - featured.awayScore) >= 17
            ? "A rout that will sit in the Monday papers."
            : featured.homeScore === featured.awayScore ? "All square at the final whistle." : `Decided by ${Math.abs(featured.homeScore - featured.awayScore)} points.`,
      teamIds: [w as TeamId, l as TeamId],
      playerIds: featured.mvpPlayerId ? [featured.mvpPlayerId] : [],
    });
  }
  const confs = save.year < 1970 ? (["NFL", "AFL"] as const) : (["AFC", "NFC"] as const);
  for (const conf of confs) {
    let best: Player | undefined;
    let bestTeam: TeamId | undefined;
    let bestN = -Infinity;
    for (const game of weekGames) {
      for (const [id, box] of [[game.homeId, game.boxHome], [game.awayId, game.boxAway]] as const) {
        if (conferenceOf(save.year, id as TeamId) !== conf) continue;
        for (const line of box ?? []) {
        const p = save.players[line.playerId];
        if (!p || !['QB', 'RB', 'FB', 'WR', 'TE'].includes(p.pos)) continue;
        if (!(line.passAtt || line.rushAtt || line.rec)) continue;
        const n = (line.passYds ?? 0) * .04 + (line.passTd ?? 0) * 4 +
          (line.rushYds ?? 0) * .1 + (line.rushTd ?? 0) * 6 +
          (line.rec ?? 0) * .5 + (line.recYds ?? 0) * .1 + (line.recTd ?? 0) * 6 - (line.passInt ?? 0) * 2;
        if (n > bestN) {
          bestN = n;
          best = p;
          bestTeam = id as TeamId;
        }
        }
      }
    }
    if (best && bestTeam) {
      addNews(save, {
        kind: "pow",
        headline: `${conf} Offensive Player of the Week: ${playerName(best)}`,
        body: `${best.pos} for ${displayName(save.year, bestTeam)}. Based on this week's game.`,
        teamIds: [bestTeam],
        playerIds: [best.id],
      });
      if (conf === "NFL" || conf === "NFC") save.lastPow.nfc = best.id;
      else save.lastPow.afc = best.id;
    }
  }
  const injured = save.sandbox ? undefined : Object.values(save.players).find((p) => p.injuredWeeks > 0 && p.teamId === save.userTeamId);
  if (injured) {
    addNews(save, {
      kind: "injury",
      headline: `${playerName(injured)} week-to-week`,
      body: `The ${displayName(save.year, save.userTeamId)} list him with a ${injured.injuryName ?? injured.pos} injury.`,
      teamIds: [save.userTeamId],
      playerIds: [injured.id],
    });
  } else {
    const tx = save.transactions.find((t) => t.year === save.year);
    if (tx) {
      const p = save.players[tx.playerId];
      addNews(save, {
        kind: "transaction",
        headline: tx.detail,
        body: p ? `${playerName(p)} (${p.pos}).` : tx.kind,
        teamIds: [],
        playerIds: [tx.playerId],
      });
    }
  }
}

export function cpuInSeasonMoves(save: DynastySave): void {
  if (rand(save) > 0.18) return;
  const teams = activeTeamIds(save.year).filter((t) => cpuHandles(save, t, "roster"));
  if (!teams.length) return;
  const teamId = teams[randInt(save, 0, teams.length - 1)]!;
  const roster = rosterOf(save, teamId).sort((a, b) => a.ovr - b.ovr);
  const cut = roster[0];
  if (!cut || cut.ovr > 62) return;
  save.teams[teamId].roster = save.teams[teamId].roster.filter((id) => id !== cut.id);
  cut.teamId = "fa";
  save.waivers.push({ playerId: cut.id, from: teamId, week: save.week, year: save.year });
  if (!signRealFa(save, teamId, cut.pos)) generatePlayer(save, cut.pos, teamId, randInt(save, 54, 66));
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} churn the bottom of the roster`,
    body: `${playerName(cut)} is waived.`,
    teamIds: [teamId],
    playerIds: [cut.id],
  });
}
