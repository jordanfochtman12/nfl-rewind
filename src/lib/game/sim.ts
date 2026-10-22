import { pressureAdjustment } from "./broadcast.ts";
import type {
  BoxPlayer,
  PlayLog,
  DriveResult,
  DriveSummary,
  DefScheme,
  DynastySave,
  Gameplan,
  GameResult,
  Player,
  Pos,
  TeamId,
  SeasonStats,
  CrunchSituation,
  LiveOrder,
} from "./types.ts";
import {
  clockStopFirstDown,
  dpiIsSpot,
  eraBigPlay,
  eraProfile,
  eraRb1Share,
  eraFullbackCarryShare,
  eraQbCarryShare,
  eraTargetWeights,
  fairCatchKickoff,
  fgEraMod,
  fourthGoBias,
  hashFgMod,
  huddleSeconds,
  kickoffOobSpot,
  kickoffRules,
  kickoffTbRate,
  otRules,
  otCall,
  fgSnapYards,
  missedFgSpot,
  penaltyRates,
  playoffBrake,
  replayReview,
  sneakBoost,
  tenSecondRunoff,
  tightCatchRule,
  twoPointMakeP,
  twoPointOk,
  wantTwoPoint,
  xpKickYards,
  xpMakeBase,
  passGainScale,
  leaderPace,
  starTaper,
} from "./era.ts";
import { clamp, rand, randInt } from "./rng.ts";
import { ARC_DATA_LAST } from "./careerArc.ts";
import { activeTeamIds, conferenceOf, divisionKey, gamesInSeason, nicknameOf, originalLeague } from "./teams.ts";
import { creditSeasonTeam, emptyStats, playerName, rosterOf, starters, yearStats } from "./players.ts";
import { kitBoost, kitShare, kitInjMult } from "./abilities.ts";
import { coachKitBoost } from "./coachKit.ts";
import { maybeReveal } from "./scout.ts";
import { attendanceFor, bowlVenue, crowdNoise, pickWeather, venueOf, type VenueInfo, type Wx } from "./venues.ts";
import { proBowlSite, superBowlSite } from "./data/bowlSites.ts";
import { checkGameRecords } from "./records.ts";
import { chemistryEdge } from "./morale.ts";
import { focusMatchesReport, keyMatchups, practiceFor, type KeyMatchup, type PracticeFocus } from "./gameday.ts";
import { gameWatches, leagueMarks, liveMarkCall, pregameMemory, WATCH_STATS, type MemoryNote, type Watch } from "./boothMemory.ts";
import { ownerAfterGame, ownerCrowd, ownerNoise } from "./owner.ts";
import { recordMeeting } from "./h2h.ts";
import { defaultPlan, staffPlan } from "./gameplans.ts";
import { cpuHandles } from "./teamControl.ts";

function avg(ns: number[]): number {
  if (!ns.length) return 50;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

function creditCoachWl(save: DynastySave, teamId: TeamId, result: "W" | "L" | "T"): void {
  const id = save.teams[teamId]?.coachId;
  const c = id ? save.coaches[id] : undefined;
  if (!c) return;
  if (result === "W") c.careerWins += 1;
  else if (result === "L") c.careerLosses += 1;
  else c.careerTies = (c.careerTies ?? 0) + 1;
}

function gauss(save: DynastySave): number {
  return (rand(save) + rand(save) + rand(save) - 1.5) * 1.6;
}

function sampleYds(save: DynastySave, mu: number, sigma: number, lo: number, hi: number): number {
  return clamp(Math.round(mu + gauss(save) * sigma), lo, hi);
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export { defaultPlan };

/** The call sheet a club takes into a game: its staff's plan, plus the owner's own changes for his club. */
export function planFor(save: DynastySave, teamId: TeamId): Gameplan {
  const base = staffPlan(save, teamId);
  const edits = !cpuHandles(save, teamId, "gameplan") ? save.teams[teamId]?.planEdits : undefined;
  return edits ? { ...base, ...edits } : base;
}

export interface TeamUnits {
  qb?: Player;
  qb2?: Player;
  rb?: Player;
  rb2?: Player;
  /** Third back becomes a situational workload sub after the top two carry the load. */
  rb3?: Player;
  fb?: Player;
  wr: Player[];
  te?: Player;
  ol: Player[];
  dl: Player[];
  lb: Player[];
  db: Player[];
  k?: Player;
  p?: Player;
  returner?: Player;
  offPass: number;
  offRun: number;
  defPass: number;
  defRun: number;
  kit: {
    cmp: number;
    sack: number;
    int: number;
    fum: number;
    td: number;
    fg: number;
    scramble: number;
    clutch: number;
    inj: number;
    pen: number;
  };
}

/** Apply quarter-long fatigue using only the players assigned to that side of the ball. */
export function unitFatigueMultiplier(
  u: TeamUnits,
  side: "offense" | "defense",
  late: boolean,
  altitudePenalty = false,
): number {
  const active = side === "offense"
    ? [u.qb, u.rb, u.rb2, u.rb3, u.fb, ...u.wr, u.te, ...u.ol]
    : [...u.dl, ...u.lb, ...u.db];
  const stamina = avg(active.filter((p): p is Player => !!p).map((p) => p.ratings.stamina));
  const multiplier = 1 - ((100 - stamina) / 420) * (late ? 1.5 : 0.35);
  return multiplier * (altitudePenalty ? 0.93 : 1);
}

/** Share of a team's running-back carries that moves to its healthy RB3 as RB1/RB2 wear down. */
export function thirdBackRotationShare(topTwoCarries: number, hasThirdBack: boolean): number {
  return hasThirdBack ? clamp((Math.max(0, topTwoCarries) - 16) * 0.02, 0, 0.34) : 0;
}

/**
 * A passer on a pace past the era's typical leader sees the coverage roll his way: fewer
 * chunk gains. It starts at the leader's pace and firms up quickly above it, so ordinary
 * starters are untouched and record seasons stay rare rather than impossible.
 */
function passTaper(perGame: number | undefined, ref: number, hot = false): number {
  if (!perGame) return 1;
  // A career year: the coverage never quite catches up with him.
  const r = perGame / (ref * (hot ? 1.12 : 1));
  if (r <= 0.95) return 1;
  // Closing on a typical leader's pace, defenses key on him and the staff spreads it around;
  // well past it the coverage rolls harder, so a record falls now and then, by a little.
  return Math.max(0.55, 1 - (r - 0.95) * 1.6 - Math.max(0, r - 1.18) * 1.2);
}

/**
 * Anything can happen: each season a few players have the year of their lives (about one in
 * twenty-five), and nothing slows them down. Fixed by player and season, so it holds all year.
 */
export function careerYear(p: Player | undefined, year: number): boolean {
  if (!p) return false;
  let h = 2166136261 ^ year;
  for (const ch of p.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  return (h >>> 0) % 25 === 0;
}

/** A typical league-leading interception total for the era (real decade leaders). */
function intLeaderRef(year: number): number {
  if (year <= 1969) return 28;
  if (year <= 1989) return 25;
  if (year <= 2009) return 21;
  if (year <= 2019) return 19;
  return 17;
}

/**
 * A passer on pace for far more picks than a typical leader gets more careful (and his staff
 * calls safer throws), so a 40-interception season stays a near-impossibility, not a cap.
 */
function intTaper(p: Player | undefined, year: number): number {
  const s = p?.stats[year];
  if (!s || s.gp < 3) return 1;
  const pace = (s.passInt / s.gp) * gamesInSeason(year);
  const soft = intLeaderRef(year) * 0.8;
  if (pace <= soft) return 1;
  return clamp(1 - ((pace - soft) / intLeaderRef(year)) * 1.2, 0.6, 1);
}

/** A quarterback whose interceptions this season run far past his era's normal rate. */
function pickHappy(p: Player | undefined, year: number): boolean {
  const st = p?.stats[year];
  if (!st || st.passAtt < 100) return false;
  const rate = st.passInt / st.passAtt;
  const norm = eraProfile(year).intRate;
  return rate >= norm * 1.7 || (st.passInt >= 20 && rate >= norm * 1.35);
}

export function teamUnits(save: DynastySave, teamId: TeamId, benched?: ReadonlySet<string>): TeamUnits {
  const qbs = starters(save, teamId, "QB", 2, benched);
  // A starter giving the ball away at a historic rate loses the job to a backup who's close to
  // him, the way real coaches pull a quarterback long before he can throw 50 interceptions.
  if (qbs[1] && pickHappy(qbs[0], save.year) && qbs[1].ovr >= (qbs[0]?.ovr ?? 0) - 15 && !pickHappy(qbs[1], save.year)) qbs.reverse();
  const qb = qbs[0];
  const qb2 = qbs[1];
  const rbs = starters(save, teamId, "RB", 2);
  const rb = rbs[0];
  const rb2 = rbs[1];
  const rb3 = starters(save, teamId, "RB", 3)[2];
  const fb = starters(save, teamId, "FB", 1)[0];
  const wr = starters(save, teamId, "WR", 3);
  const te = starters(save, teamId, "TE", 1)[0];
  const ol = [
    ...starters(save, teamId, "LT", 1),
    ...starters(save, teamId, "LG", 1),
    ...starters(save, teamId, "C", 1),
    ...starters(save, teamId, "RG", 1),
    ...starters(save, teamId, "RT", 1),
  ];
  const dl = [...starters(save, teamId, "DE", 2), ...starters(save, teamId, "DT", 2)];
  const lb = [...starters(save, teamId, "OLB", 2), ...starters(save, teamId, "MLB", 1)];
  const db = [...starters(save, teamId, "CB", 3), ...starters(save, teamId, "S", 2)];
  const k = starters(save, teamId, "K", 1)[0];
  const p = starters(save, teamId, "P", 1)[0];
  const team = save.teams[teamId];
  const coach = team?.coachId ? save.coaches[team.coachId] : undefined;
  const oc = team?.ocId ? save.coaches[team.ocId] : undefined;
  const dc = team?.dcId ? save.coaches[team.dcId] : undefined;
  // str carries real weight in an OL's overall (14-16%) but line push in the run
  // game especially is a strength stat as much as a technique one - blend it in
  // rather than let it sit purely decorative. A fullback's headline stats
  // (runBlk, str) are just as dead otherwise - he was a fixed-odds ball carrier
  // and nothing else, so fold him into the run-blocking unit as a lead blocker.
  const passBlk = avg(ol.map((x) => x.ratings.passBlk * 0.75 + x.ratings.str * 0.25));
  const runBlk = avg(
    [...ol, ...(fb ? [fb] : [])].map((x) => x.ratings.runBlk * 0.75 + x.ratings.str * 0.25),
  );
  const recSkill = avg(
    [...wr, te].filter((x): x is Player => !!x).map((x) =>
      // rel (release off press) only means something for a true WR - a TE never
      // ran that weight into his overall, so don't drag his score on it here.
      x.pos === "WR"
        ? (x.ratings.catch + x.ratings.rrt + x.ratings.cit + x.ratings.rel) / 4
        : (x.ratings.catch + x.ratings.rrt + x.ratings.cit) / 3,
    ),
  );
  const rushSkill = rb
    ? (rb.ratings.speed + rb.ratings.accel + rb.ratings.btk + rb.ratings.elu + rb.ratings.truck) / 5
    : 50;
  const passRush = avg(dl.map((x) => x.ratings.prs));
  const cov = avg(
    // agi (mirroring receivers) is a CB skill, not a safety one - same reasoning as rel above.
    db.map((x) => (x.pos === "CB" ? (x.ratings.cov + x.ratings.agi) / 2 : x.ratings.cov)),
  );
  const tak = avg([...dl, ...lb].map((x) => (x.ratings.tak + x.ratings.pur) / 2));
  const offIq = ((qb?.ratings.throwAwr ?? 50) + (qb?.ratings.awareness ?? 50) + (oc?.offense ?? coach?.offense ?? 70)) / 3;
  const defIq = ((lb[0]?.ratings.awareness ?? 50) + (dc?.defense ?? coach?.defense ?? 70)) / 2;
  let offPass =
    (qb?.ratings.throwAcc ?? 50) * 0.3 +
    (qb?.ratings.throwAwr ?? 50) * 0.16 +
    (qb?.ratings.throwPow ?? 50) * 0.1 +
    (qb?.ratings.rel ?? 50) * 0.06 +
    recSkill * 0.18 +
    passBlk * 0.12 +
    offIq * 0.08;
  let offRun = rushSkill * 0.46 + runBlk * 0.32 + (rb?.ratings.awareness ?? 50) * 0.1 + offIq * 0.12;
  let defPass = cov * 0.4 + passRush * 0.32 + defIq * 0.16 + tak * 0.12;
  let defRun = tak * 0.42 + avg(dl.map((x) => x.ratings.str)) * 0.22 + defIq * 0.2 + passRush * 0.16;
  // A scheme is only as good as the personnel running it - flat bonuses meant a
  // vertical passing attack helped just as much with possession receivers as
  // with burners. Scale each bonus by the roster trait the scheme actually
  // leans on, centered on the old flat value at a roughly average (75) roster.
  const scheme = team?.offScheme;
  if (scheme === "vertical") offPass += clamp(3.5 + (avg(wr.map((x) => x.ratings.speed)) - 75) * 0.15, 1.5, 5.5);
  if (scheme === "smashmouth") offRun += clamp(3.5 + (rushSkill - 75) * 0.15, 1.5, 5.5);
  if (scheme === "westcoast") offPass += clamp(2 + (recSkill - 75) * 0.12, 0.5, 3.5);
  if (team?.defScheme === "cover-2") defPass += clamp(2.5 + (cov - 75) * 0.12, 1, 4);
  if (team?.defScheme === "3-4") defRun += clamp(2 + (avg(lb.map((x) => x.ratings.tak)) - 75) * 0.12, 0.5, 3.5);
  const skill = [qb, qb2, rb, rb2, rb3, fb, te, k, p, ...wr, ...ol, ...dl, ...lb, ...db];
  offPass += kitBoost(qb, "offPass") + wr.reduce((n, p) => n + kitBoost(p, "offPass"), 0) + kitBoost(te, "offPass") + ol.reduce((n, p) => n + kitBoost(p, "offPass"), 0);
  offRun += kitBoost(rb, "offRun") + kitBoost(rb3, "offRun") + kitBoost(fb, "offRun") + ol.reduce((n, p) => n + kitBoost(p, "offRun"), 0) + kitBoost(qb, "offRun");
  defPass += db.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + dl.reduce((n, p) => n + kitBoost(p, "defPass"), 0);
  defRun += dl.reduce((n, p) => n + kitBoost(p, "defRun"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defRun"), 0);
  offPass += coachKitBoost(coach, "offPass") + coachKitBoost(oc, "offPass") + (coach?.offense ?? 70) * 0.02;
  offRun += coachKitBoost(coach, "offRun") + coachKitBoost(oc, "offRun");
  defPass += coachKitBoost(coach, "defPass") + coachKitBoost(dc, "defPass") + (coach?.defense ?? 70) * 0.02;
  defRun += coachKitBoost(coach, "defRun") + coachKitBoost(dc, "defRun");
  const cands = [...wr, rb, rb2, rb3, fb, ...db].filter((x): x is Player => !!x);
  const returner = cands.slice().sort((a, b) => {
    const as = a.ratings.speed + (a.traits?.includes("Return man") ? 12 : 0);
    const bs = b.ratings.speed + (b.traits?.includes("Return man") ? 12 : 0);
    return bs - as;
  })[0];
  const kit = {
    cmp: kitBoost(qb, "cmp") + wr.reduce((n, p) => n + kitBoost(p, "cmp"), 0),
    sack: kitBoost(qb, "sack") + ol.reduce((n, p) => n + kitBoost(p, "sack"), 0) + dl.reduce((n, p) => n + kitBoost(p, "sack"), 0),
    int: kitBoost(qb, "int") + db.reduce((n, p) => n + kitBoost(p, "int"), 0),
    fum: kitBoost(rb, "fum") + kitBoost(rb3, "fum") + kitBoost(qb, "fum") + wr.reduce((n, p) => n + kitBoost(p, "fum"), 0),
    td: kitBoost(qb, "td") + kitBoost(rb, "td") + kitBoost(rb3, "td") + wr.reduce((n, p) => n + kitBoost(p, "td"), 0),
    fg: kitBoost(k, "fg"),
    scramble: kitBoost(qb, "scramble"),
    clutch: skill.reduce((n, p) => n + kitBoost(p, "clutch"), 0) + coachKitBoost(coach, "clutch") + coachKitBoost(oc, "clutch") + coachKitBoost(dc, "clutch"),
    inj: skill.reduce((n, p) => n + kitBoost(p, "inj"), 0),
    pen: coachKitBoost(coach, "pen") + coachKitBoost(oc, "pen") + coachKitBoost(dc, "pen"),
  };
  // A tight locker room plays a little better; a fractured one a little worse.
  const chem = chemistryEdge(save, teamId);
  return { qb, qb2, rb, rb2, rb3, fb, wr, te, ol, dl, lb, db, k, p, returner, offPass: offPass + chem, offRun: offRun + chem, defPass: defPass + chem, defRun: defRun + chem, kit };
}

function dist(save: DynastySave, weights: number[]): number {
  const t = weights.reduce((a, b) => a + Math.max(0.01, b), 0);
  let r = rand(save) * t;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0.01, weights[i]!);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function applyBox(save: DynastySave, teamId: TeamId, box: BoxPlayer[], year: number, postseason = false): void {
  for (const b of box) {
    const p = save.players[b.playerId];
    if (!p) continue;
    let s: SeasonStats;
    if (postseason) {
      p.playoffStats = p.playoffStats ?? {};
      s = p.playoffStats[year] ?? (p.playoffStats[year] = emptyStats(year, teamId));
    } else {
      s = yearStats(p, year, teamId);
    }
    creditSeasonTeam(s, teamId);
    s.gp += 1;
    maybeReveal(p, 1);
    p.snaps = (p.snaps ?? 0) + 1;
    s.passAtt += b.passAtt ?? 0;
    s.passCmp += b.passCmp ?? 0;
    s.passYds += b.passYds ?? 0;
    s.passTd += b.passTd ?? 0;
    s.passInt += b.passInt ?? 0;
    s.sacksThrown += b.sacksThrown ?? 0;
    s.rushAtt += b.rushAtt ?? 0;
    s.rushYds += b.rushYds ?? 0;
    s.rushTd += b.rushTd ?? 0;
    s.rec += b.rec ?? 0;
    s.recYds += b.recYds ?? 0;
    s.recTd += b.recTd ?? 0;
    s.sacks += b.sacks ?? 0;
    s.ints += b.ints ?? 0;
    s.tackles += b.tackles ?? 0;
    s.ff += b.ff ?? 0;
    s.fgMade += b.fgMade ?? 0;
    s.fgAtt += b.fgAtt ?? 0;
    s.xpMade += b.xpMade ?? 0;
    s.xpAtt += b.xpAtt ?? 0;
    s.punts += b.punts ?? 0;
    s.puntYds += b.puntYds ?? 0;
    s.krYds += b.krYds ?? 0;
    s.prYds += b.prYds ?? 0;
    s.targets += b.targets ?? 0;
    s.tfl += b.tfl ?? 0;
    s.pd += b.pd ?? 0;
    s.qbHits += b.qbHits ?? 0;
    s.fr += b.fr ?? 0;
    s.defTd += b.defTd ?? 0;
    s.krTd += b.krTd ?? 0;
    s.prTd += b.prTd ?? 0;
  }
}

/** While the owner's game is on, every stat event of the current snap is also handed here. */
let playTap: ((id: string, patch: Partial<BoxPlayer>) => void) | undefined;

interface OpenPlay {
  call?: string;
  sackYards?: number;
  q: number;
  clock: number;
  poss: TeamId;
  down: number;
  togo: number;
  spot: number;
  bumps: [string, Partial<BoxPlayer>][];
  notes: string[];
  cue?: PlayLog["cue"];
}

/** One line of play-by-play from the stat events of a snap. */
function describePlay(save: DynastySave, cur: OpenPlay): { text: string; tag?: PlayLog["tag"] } | undefined {
  const nm = (id: string) => {
    const p = save.players[id];
    return p ? playerName(p) : "—";
  };
  const find = (k: keyof BoxPlayer) => cur.bumps.find(([, b]) => (b[k] as number | undefined) !== undefined && (b[k] as number) !== 0);
  const notes = cur.notes.join(" ");
  let text = "";
  let tag: PlayLog["tag"];
  const fg = find("fgAtt");
  const punt = find("punts");
  const sack = find("sacksThrown");
  const att = find("passAtt");
  const rush = find("rushAtt");
  const kr = find("krYds") ?? find("krTd");
  if (fg) {
    text = find("fgMade") ? `${nm(fg[0])} field goal is good.` : `${nm(fg[0])} field goal is no good.`;
    if (find("fgMade")) tag = "fg";
  } else if (punt) {
    const pr = find("prYds");
    text = `${nm(punt[0])} punts ${Math.round(punt[1].puntYds ?? 0)} yards${pr ? `, ${nm(pr[0])} returns it ${Math.round(pr[1].prYds ?? 0)}` : ""}.`;
  } else if (sack) {
    const by = find("sacks");
    text = `${nm(sack[0])} sacked${by ? ` by ${nm(by[0])}` : ""}.`;
  } else if (att) {
    const cmp = att[1].passCmp;
    const rec = find("rec");
    const int = att[1].passInt ? find("ints") : undefined;
    const yds = att[1].passYds ?? 0;
    if (int) {
      text = `${nm(att[0])} is intercepted by ${nm(int[0])}.`;
      tag = "to";
    } else if (cmp && rec) {
      const gain = find("passTd") || find("recTd") ? Math.round(100 - cur.spot) : yds;
      text = `${nm(att[0])} to ${nm(rec[0])} for ${gain} yard${Math.abs(gain) === 1 ? "" : "s"}.`;
      if (yds >= 20) tag = "big";
    } else text = `${nm(att[0])} incomplete.`;
    if (find("passTd") || find("recTd")) tag = "td";
  } else if (rush) {
    const yds = find("rushTd") ? Math.round(100 - cur.spot) : (rush[1].rushYds ?? 0);
    text = yds < 0 ? `${nm(rush[0])} dropped for a loss of ${-yds}.` : `${nm(rush[0])} runs for ${yds} yard${yds === 1 ? "" : "s"}.`;
    if (yds >= 20) tag = "big";
    if (find("rushTd")) tag = "td";
  } else if (kr) {
    text = `${nm(kr[0])} returns the kickoff ${kr[1].krYds ?? 0} yards.`;
    if (find("krTd")) tag = "td";
  }
  if (find("prTd")) tag = "td";
  if (/coughs it up|fumble/i.test(notes) && tag !== "td") tag = "to";
  if (/pick-six|house|the other way, six|scoop and score/i.test(notes)) tag = "td";
  if (/safety/i.test(notes)) tag = "safety";
  if (/owner's call/i.test(notes)) tag = tag ?? "call";
  const extra = cur.notes.filter((n) => !/It's good\.$/.test(n));
  if (extra.length) text = text ? `${text} ${extra.join(" ")}` : extra.join(" ");
  if (tag === "td" && !/touchdown|house|six|distance|score/i.test(text)) text += " Touchdown!";
  if (find("xpAtt")) text += find("xpMade") ? " The kick is good." : " The kick is no good.";
  return text ? { text, tag } : undefined;
}

function bumpBox(box: BoxPlayer[], id: string | undefined, patch: Partial<BoxPlayer>): void {
  if (!id) return;
  playTap?.(id, patch);
  let row = box.find((b) => b.playerId === id);
  if (!row) {
    row = { playerId: id };
    box.push(row);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "number") {
      const rec = row as unknown as Record<string, number>;
      rec[k] = Math.round((rec[k] ?? 0) + v);
    }
  }
}

/*
 * No season stat has a ceiling. Each era's reference number sits near that era's real record;
 * a player's usage tapers once his pace runs well past a typical leader's (defenses key on him,
 * the staff spreads it around), so records fall now and then, the way they do, without five
 * players a year piling up on the same number.
 */

function paceDamp(p: Player, key: "rec" | "sacks" | "ints", year: number, eraRef: number): number {
  const s = p.stats[year];
  if (!s || s.gp < 3) return 1;
  // A career year: the brake comes on later for him.
  if (careerYear(p, year)) eraRef *= 1.12;
  const pace = (s[key] / s.gp) * gamesInSeason(year);
  // The taper starts at a typical leader's pace (about three-quarters of the record), so
  // leaders land where real leaders did and the record itself takes a rare season. Sacks
  // brake harder: with the rush concentrated on the true edge players, the gentler curve let
  // five ends a year run into the cap.
  const soft = eraRef * (key === "sacks" ? 0.5 : 0.7);
  if (pace <= soft) return 1;
  // Sacks taper by ratio, not a straight slope: a slope flattened everyone past the knee onto
  // the same 14-16 and left three ends tied for the lead; a ratio keeps the best rusher ahead.
  // No wall at the record: the brake eases a leader toward the pack, and a man who keeps
  // beating it keeps his numbers.
  return key === "sacks"
    ? Math.max(0.15, Math.pow(soft / pace, 2))
    : clamp(1 - ((pace - soft) / (eraRef * 0.26)) * 0.6 - Math.max(0, (pace - eraRef) / eraRef) * 1.5, 0.2, 1);
}

/** A player's season pace in one stat (per game), once he has a few games in the book. */
function seasonPace(p: Player | undefined, key: "passYds" | "rushYds" | "recYds", year: number): number | undefined {
  const s = p?.stats[year];
  if (!s || s.gp < 3) return undefined;
  return s[key] / s.gp;
}
const taperOf = (p: Player | undefined, key: "passYds" | "rushYds" | "recYds", year: number, ref: number): number => {
  const pace = seasonPace(p, key, year);
  return pace === undefined ? 1 : starTaper(pace, ref * (careerYear(p, year) ? 1.12 : 1));
};

function pickRec(save: DynastySave, off: TeamUnits, deep: boolean, year: number, redZone: boolean): Player | undefined {
  const era = eraProfile(year);
  const w = eraTargetWeights(year);
  const slots: { p: Player | undefined; wt: number }[] = [
    { p: off.wr[0], wt: w.wr1 * (deep ? 1.1 : 1) * (redZone ? 1.6 : 1) },
    { p: off.wr[1], wt: w.wr2 },
    { p: off.wr[2], wt: w.wr3 * (deep ? 0.65 : 1.15) },
    { p: off.te, wt: w.te * (deep ? 0.55 : 1.15) * (redZone ? 1.45 : 1) },
    { p: off.rb, wt: w.rb * (deep ? 0.3 : 1.25) * (redZone ? 0.7 : 1) },
  ];
  const pool = slots.filter((s): s is { p: Player; wt: number } => !!s.p);
  if (!pool.length) return undefined;
  return pool[
    dist(
      save,
      pool.map((s) => {
        const yac = deep ? s.p.ratings.speed * 0.7 + s.p.ratings.cit * 0.5 : s.p.ratings.rrt * 0.6 + s.p.ratings.catch * 0.5;
        // Talent and target-hog traits tilt the split, but gently: the raw product of ratings
        // and stacked recShare traits sent ~47% of a team's targets to its WR1 (2,800-yard
        // seasons). Real top targets draw 25-30%, a true alpha a bit more.
        // Near the goal line the ball goes to the best hands on the field (real scoring leaders
        // catch 40% of their team's touchdown passes), so talent counts for more there.
        const skill = Math.pow((s.p.ratings.catch + yac) / 150, redZone ? 1.1 : 0.3);
        const kit = 1 + Math.min(0.3, kitShare(s.p, "recShare") - 1) * 0.5;
        const pace = paceDamp(s.p, "rec", year, s.p.pos === "TE" ? era.teRecCap : era.recCap);
        return s.wt * skill * kit * pace * (redZone ? 1 : taperOf(s.p, "recYds", year, leaderPace(year).recYds));
      }),
    )
  ]!.p;
}

function pickRusher(
  save: DynastySave,
  off: TeamUnits,
  passingDown: boolean,
  year: number,
  call: Call,
  goal: boolean,
  carriesSoFar?: (id: string) => number,
): Player | undefined {
  const rb1 = eraRb1Share(year);
  // A back who's already carried a heavy load this game gets spelled more -
  // without this, a lead back's flat per-play weight can compound into an
  // unrealistic 50+ carry game over enough plays.
  const workloadDamp = (id: string | undefined) => {
    if (!id || !carriesSoFar) return 1;
    const n = carriesSoFar(id);
    return n <= 18 ? 1 : Math.max(0.3, 1 - (n - 18) * 0.06);
  };
  const backCarries = (off.rb ? carriesSoFar?.(off.rb.id) ?? 0 : 0) + (off.rb2 ? carriesSoFar?.(off.rb2.id) ?? 0 : 0);
  // Once the top two backs have absorbed a real workload, a healthy third back starts getting
  // meaningful series. Keep the total RB share steady while redistributing it; passing downs
  // remain with the backs trusted to protect the quarterback.
  const thirdBackShare = thirdBackRotationShare(backCarries, !!off.rb3 && !!carriesSoFar);
  const topBackScale = 1 - thirdBackShare * (passingDown ? 0.3 : 1);
  const pool: { p: Player; w: number }[] = [];
  if (off.rb)
    pool.push({
      p: off.rb,
      w:
        (passingDown ? rb1 * 0.7 : rb1) *
        topBackScale *
        kitShare(off.rb, "rushShare") *
        (off.rb.ratings.stamina / 80) *
        workloadDamp(off.rb.id) *
        taperOf(off.rb, "rushYds", year, leaderPace(year).rush),
    });
  if (off.rb2)
    pool.push({
      p: off.rb2,
      w: (passingDown ? 0.32 : 1 - rb1) * topBackScale * kitShare(off.rb2, "rushShare") * workloadDamp(off.rb2.id),
    });
  // No healthy second back: the fullback takes the backup's carries, or a receiver some of them.
  // Without anyone in that share the lead back got every run (Stephen Davis, 593 carries for
  // 3,187 yards behind an injured depth chart; the real record is 416 carries).
  else if (off.rb) {
    const spell = (passingDown ? 0.32 : 1 - rb1) * 0.8;
    if (off.fb) pool.push({ p: off.fb, w: spell * workloadDamp(off.fb.id) });
    else if (off.wr[0]) pool.push({ p: off.wr[0], w: spell * 0.4 });
  }
  if (off.rb3 && thirdBackShare > 0) {
    pool.push({
      p: off.rb3,
      w:
        thirdBackShare *
        (passingDown ? 0.3 : 1) *
        kitShare(off.rb3, "rushShare") *
        (off.rb3.ratings.stamina / 80) *
        workloadDamp(off.rb3.id),
    });
  }
  if (off.fb && (goal || !passingDown)) {
    const fbShare = eraFullbackCarryShare(year) * kitShare(off.fb, "rushShare") * workloadDamp(off.fb.id);
    pool.push({ p: off.fb, w: goal ? Math.max(fbShare * 1.5, year <= 1968 ? 0.08 : 0.04) : fbShare });
  }
  if (off.qb && (goal || call === "draw")) {
    // Keep the league's era-specific quarterback share, then let the player's style shape
    // which quarterbacks take those carries. A pocket statue still sneaks; a scrambler gets
    // more designed runs, but neither trait can dominate the team carry pool on its own.
    const mobility = clamp(1 + (off.qb.ratings.speed - 65) / 500 + (off.qb.ratings.agi - 65) / 500, 0.8, 1.2);
    const style = off.qb.abilities.includes("Scrambler") ? 1.1 : off.qb.traits.includes("Pocket statue") ? 0.8 : 1;
    const qbShare = eraQbCarryShare(year) * mobility * style * workloadDamp(off.qb.id);
    pool.push({
      p: off.qb,
      w: goal ? Math.max(qbShare * 1.5, 0.08 + Math.max(0, off.kit.scramble) / 180) : qbShare,
    });
  }
  if (!pool.length) return off.qb;
  return pool[dist(save, pool.map((x) => x.w))]!.p;
}

/**
 * Who makes the stop, by where he lines up: linebackers fill against the run, the secondary
 * tackles the catch, linemen get the plays that die at the line. Weighted on grades alone,
 * a 4-3 end tackled as often as the middle linebacker (85 a year; real ends make ~45).
 */
const RUN_STOP: Partial<Record<Pos, number>> = { MLB: 1.25, OLB: 0.95, S: 0.7, CB: 0.55, DE: 0.8, DT: 0.7 };
const PASS_STOP: Partial<Record<Pos, number>> = { CB: 1.2, S: 0.85, MLB: 0.8, OLB: 0.55, DE: 0.2, DT: 0.14 };

function pickTackler(save: DynastySave, def: TeamUnits, pass: boolean): Player | undefined {
  const pool = pass ? [...def.db, ...def.lb, ...def.dl] : [...def.lb, ...def.dl, ...def.db];
  if (!pool.length) return undefined;
  const role = pass ? PASS_STOP : RUN_STOP;
  // An edge-rushing outside linebacker plays the down like an end.
  const job = (p: Player): Pos => (p.pos === "OLB" && p.arch === "edge" ? "DE" : p.pos);
  return pool[dist(save, pool.map((p) => (p.ratings.tak + p.ratings.pur) * (role[job(p)] ?? 0.6) * (pass ? p.ratings.cov / 80 : 1)))];
}

/**
 * How much of a club's pass rush runs through each job. Ends and edge linebackers take most of
 * it; interior linemen some; an off-ball linebacker gets home on the odd blitz. On grades
 * alone, coverage linebackers with a decent rush grade ran up 12-16 sacks a year (real: 2-5).
 */
const RUSH_ROLE: Partial<Record<Pos, Partial<Record<string, number>> & { base: number }>> = {
  DE: { base: 0.8, edge: 0.88, finisher: 0.8, "two-gap": 0.65 },
  DT: { base: 0.55, finisher: 0.65, "two-gap": 0.5, anchor: 0.4 },
  OLB: { base: 0.26, edge: 0.85, finisher: 0.28, "cover-lb": 0.16 },
  MLB: { base: 0.17, finisher: 0.2, thumper: 0.17, "cover-lb": 0.11 },
};
function rushRole(p: Player, scheme: DefScheme | undefined): number {
  const r = RUSH_ROLE[p.pos];
  if (!r) return 0.1;
  let w = (p.arch ? r[p.arch] : undefined) ?? r.base;
  // In a 3-4 the outside linebackers are the rushers and the ends play inside.
  if (scheme === "3-4") {
    if (p.pos === "OLB") w = Math.max(w, p.arch === "cover-lb" ? 0.3 : 0.75);
    if (p.pos === "DE") w *= 0.7;
  }
  return w;
}

function pickRusherDef(save: DynastySave, def: TeamUnits, scheme?: DefScheme): Player | undefined {
  const pool = [...def.dl, ...def.lb];
  if (!pool.length) return undefined;
  const ref = eraProfile(save.year).sackCap;
  // Sacks lean toward the true edge rushers (a real sack leader takes ~35-40% of his team's
  // total). Linear on pass-rush grade spread them almost evenly; cubed, once league sacks were
  // at real rates, gave the top rusher over half of them (Dent 232 career, seasons stuck at 22).
  return pool[
    dist(
      save,
      pool.map((p) => Math.pow(p.ratings.prs / 70, 0.8) * rushRole(p, scheme) * kitShare(p, "sackShare") * paceDamp(p, "sacks", save.year, ref)),
    )
  ];
}

function pickThief(save: DynastySave, def: TeamUnits): Player | undefined {
  const pool = [...def.db, ...def.lb];
  if (!pool.length) return undefined;
  // Ball skills compound: on a linear weight every corner and safety split a club's picks
  // evenly and three of them tied for the league lead most years.
  // A ballhawk far ahead of a typical leader's pace sees fewer throws his way: real leaders
  // land at 9-11 and the record (14) takes a rare season, never a run of 18s.
  const ref = (gamesInSeason(save.year) * 11) / 14;
  return pool[dist(save, pool.map((p) => Math.pow((p.ratings.cov + p.ratings.catch * 0.35 + p.ratings.awareness * 0.2) / 100, 2.5) * kitShare(p, "intShare") * paceDamp(p, "ints", save.year, ref)))];
}

function fgRange(k: Player | undefined, year: number, altitude: number): number {
  const pow = k?.ratings.kickPow ?? 70;
  const air = altitude >= 4000 ? 4 : 0;
  // Legs got longer with the soccer-style kickers and year-round specialists: a 2020s kicker
  // tries from 55 as a matter of course, where a 70s one was stretching at 45.
  // Before 1974 the posts sat on the goal line: the same leg reached from further out, and the
  // field goal was half the scoring (2.3 tries a game in the late 60s).
  const era = year >= 2010 ? 8 : year >= 2000 ? 6 : year >= 1978 ? 4 : year >= 1974 ? 7 : 6;
  return Math.round(38 + era + (pow - 70) * 0.55 + air);
}

function fgMakeP(k: Player | undefined, distYds: number, wx: Wx, year: number, clutch: number, altitude: number): number {
  const acc = k?.ratings.kickAcc ?? 70;
  const pow = k?.ratings.kickPow ?? 70;
  // Every yard costs less for the modern specialist (real 40-49 makes: ~65% in the 80s, ~85% now).
  let p = 0.97 - Math.max(0, distYds - 28) * (year >= 2000 ? 0.011 : year >= 1994 ? 0.014 : 0.018);
  p += (acc - 74) / 220;
  p += hashFgMod(year);
  if (altitude >= 4000) p += 0.04;
  if (distYds > 48) p -= (distYds - 48) * (year >= 2000 ? 0.016 : year >= 1990 ? 0.022 : 0.03);
  if (distYds > fgRange(k, year, altitude) + 2) p -= 0.25;
  if (pow < 72 && distYds >= 45) p -= 0.12;
  if (wx === "wind" || wx === "snow") p -= 0.12;
  if (wx === "cold") p -= 0.05;
  if (wx === "rain") p -= 0.04;
  p *= fgEraMod(year);
  p += clutch * 0.01;
  return clamp(p, 0.16, 0.97);
}

type Call = "run" | "short" | "med" | "deep" | "screen" | "draw" | "pa" | "sneak" | "punt" | "fg" | "kneel" | "spike";

/** Protect a trailing team's final possession before ordinary era/coach tendencies. */
export function finalPossessionCall(
  q: number, clock: number, down: number, spot: number, trail: number, kickRange: number, snapYards = 17,
): Call | undefined {
  // End of the half: with one snap left in range, take the points.
  if (q === 2) return clock <= 8 && 100 - spot + snapYards <= kickRange ? "fg" : undefined;
  if (q < 4 || clock > 30 || trail < 0) return undefined;
  // Take a tying or winning kick on fourth down or when only one snap remains. Tied counts:
  // nobody runs out the clock in field-goal range.
  if (trail <= 3 && 100 - spot + snapYards <= kickRange && (down === 4 || clock <= 8)) return "fg";
  // Tied and out of range, the staff plays it as it would (often for overtime).
  if (trail === 0) return undefined;
  // A punt or a clock-consuming run cannot rescue this possession. Avoid blind
  // spikes too: the engine may already have a stopped clock after an incompletion.
  return spot < 65 ? "deep" : spot < 85 ? "med" : "short";
}

export function canKneelOut(q: number, clock: number, down: number, spot: number, trail: number, defensiveTimeouts: number): boolean {
  return q >= 4 && clock > 0 && clock <= 40 && down < 4 && spot > 1 && trail < 0 && defensiveTimeouts === 0;
}

function callPlay(
  save: DynastySave,
  year: number,
  down: number,
  togo: number,
  spot: number,
  trail: number,
  q: number,
  clock: number,
  eraPassW: number,
  plan: Gameplan,
  k: Player | undefined,
  wx: Wx,
  toLeft: number,
  defensiveTimeouts: number,
  lastRun: boolean,
  scramble: number,
  altitude: number,
  /** Personnel lean toward the pass (+) or the run (-): who's healthy, and where the matchup is. */
  lean = 0,
): Call {
  const late = q >= 4 && clock <= 180;
  const last = q >= 4 && clock <= 40;
  const desperate = late && trail >= 3;
  // Ahead in the last five minutes, any lead: run it and keep the clock moving.
  const chew = (plan.tempo === "chew" || (q >= 4 && trail <= -1 && clock < 300)) && !desperate;
  const twoMin = (q === 2 || q >= 4) && clock <= 120;
  const finalCall = finalPossessionCall(q, clock, down, spot, trail,
    fgRange(k, year, altitude) + (wx === "wind" || wx === "snow" ? -6 : 0), fgSnapYards(year));
  if (finalCall) return finalCall;
  if (canKneelOut(q, clock, down, spot, trail, defensiveTimeouts)) return "kneel";
  // Pinned deep with the half nearly gone: take a knee rather than risk a giveaway.
  if (q === 2 && clock <= 35 && down < 4 && spot <= 25) return "kneel";
  if (down === 4) {
    const fgDist = 100 - spot + fgSnapYards(year);
    // In overtime a make ends it (or answers), so kickers get sent out from longer range.
    const range = fgRange(k, year, altitude) + (wx === "wind" || wx === "snow" ? -6 : 0) + (q >= 5 ? 3 : 0);
    const goP =
      0.04 +
      fourthGoBias(year) +
      (plan.fourth === "aggressive" ? 0.14 : plan.fourth === "conservative" ? -0.1 : 0);
    const short = togo <= 1;
    const mid = spot >= 55 && spot < 70;
    // Behind in the fourth with the clock going: a punt is giving up. Under two minutes any deficit
    // goes (unless a field goal ties or wins it); under four, a deficit a field goal won't fix;
    // under seven, two scores down. Too deep in his own end with time left, he still punts.
    const fgSaves = trail <= 3 && fgDist <= range;
    // Three scores down there's nothing to save: he punts like anyone would.
    const urgent =
      q === 4 &&
      trail >= 1 &&
      trail <= 16 &&
      !fgSaves &&
      ((clock <= 120 && togo <= 20) ||
        (clock <= 240 && trail >= 4 && togo <= 10 && spot >= 25) ||
        (clock <= 420 && trail >= 9 && togo <= 6 && spot >= 35));
    const go =
      urgent ||
      (plan.fourth === "aggressive" && togo <= 3 && spot >= 55) ||
      (plan.fourth === "normal" && togo <= 1 && spot >= 60) ||
      // Down a field goal, kick to tie; down more than that, a field goal doesn't help.
      (desperate && (trail >= 4 || fgDist > range + 4) && spot >= 42 && togo <= 8) ||
      // Wind and snow make the kick a coin flip, so short yardage in range goes for it.
      ((wx === "wind" || wx === "snow") && togo <= 2 && spot >= 55 && spot < 80 && rand(save) < 0.35) ||
      spot >= 97 ||
      (last && trail > 0 && spot >= 50) ||
      (q >= 5 && clock <= 420 && togo <= 3 && spot >= 40 && fgDist > range + 4) ||
      (short && mid && rand(save) < clamp(goP, 0.02, 0.55)) ||
      (togo <= 2 && spot >= 62 && rand(save) < clamp(goP, 0.02, 0.4));
    if (go) {
      // Fourth-and-goal / short yardage: modern offenses throw it a good share of the time.
      if ((spot >= 97 || togo <= 1) && rand(save) < (year >= 2000 ? 0.38 : year >= 1985 ? 0.25 : 0.12)) return "short";
      if (spot >= 97 || togo <= 1) return scramble > 8 && rand(save) < 0.35 ? "sneak" : "run";
      return togo >= 8 || spot < 70 ? (spot >= 55 ? "med" : "deep") : "run";
    }
    if (fgDist <= range + 4 && !(desperate && trail >= 8 && clock > 30 && spot < 55)) return "fg";
    return "punt";
  }
  if (spot >= 99 && togo <= 1 && rand(save) < (year >= 2000 ? 0.35 : year >= 1985 ? 0.2 : 0.08)) return "short";
  if (spot >= 99 && togo <= 1) return rand(save) < 0.55 ? "sneak" : "run";
  if (spot >= 95 && plan.redZone === "power") return rand(save) < 0.72 ? "run" : "short";
  let passW = eraPassW;
  // A plan leans a club, it doesn't remake it: real clubs' pass volume ran about 420 to 640
  // a season, and a full plan push had them at 360 to 780.
  const planPush = year <= 1977 ? 0.6 : 1;
  if (plan.attack === "pass") passW += 0.045 * planPush;
  if (plan.attack === "run") passW -= 0.04 * planPush;
  if (down === 3 && togo >= 6) passW += 0.22;
  if (down === 3 && togo <= 2) passW -= 0.18;
  if (down === 2 && togo <= 3) passW -= 0.08;
  if (spot >= 95 && plan.redZone === "power") passW -= 0.07;
  // Red-zone offense moved to the air over the decades: by the 2010s most TDs inside the 20 were passes.
  if (spot >= 80) passW += year >= 2010 ? 0.1 : year >= 2000 ? 0.05 : year >= 1990 ? 0.03 : 0;
  if (spot >= 90 && plan.redZone === "spread") passW += 0.05;
  // Behind, the 70s still ran it more than later eras did.
  if (trail >= 8) passW += 0.12 * (year <= 1977 ? 0.6 : 1);
  if (trail <= -10 && !desperate) passW -= 0.1;
  // Three scores up after the half: hand it off and let the clock run.
  if (trail <= -21 && q >= 3) passW -= 0.15;
  // A ball-control plan leans on the run most when it's ahead; the clock-killing push at the end stays strong.
  if (chew) passW -= q >= 4 && trail <= -7 && clock < 240 ? 0.1 : trail <= 0 ? 0.03 : 0.015;
  if (wx === "snow" || wx === "rain") passW -= 0.08;
  if (wx === "wind") passW -= 0.04;
  if (desperate) passW += 0.18;
  if (twoMin && (trail >= 1 || q === 2)) passW += 0.16;
  passW += lean;
  passW = clamp(passW, 0.2, 0.8);
  if (rand(save) > passW) {
    if (down === 3 && togo >= 6 && rand(save) < 0.22) return "draw";
    if (spot >= 99) return "sneak";
    return "run";
  }
  if (last && trail >= 3 && spot < 65) return "deep";
  if (twoMin && (trail >= 1 || q === 2) && togo >= 8) return rand(save) < 0.4 ? "deep" : "med";
  if (down === 3 && togo >= 12) return rand(save) < 0.45 ? "deep" : "med";
  if (spot >= 88) return rand(save) < 0.35 ? "screen" : "short";
  if (lastRun && down <= 2 && togo >= 6 && rand(save) < 0.28) return "pa";
  const r = rand(save);
  if (r < 0.1) return "screen";
  if (r < 0.48) return "short";
  if (r < 0.82) return "med";
  return "deep";
}

function snapClock(
  save: DynastySave,
  plan: Gameplan,
  year: number,
  q: number,
  clock: number,
  trail: number,
  complete: boolean,
  oob: boolean,
  firstDown: boolean,
  spiked: boolean,
): { used: number; stopped: boolean } {
  const twoMin = (q === 2 || q >= 4) && clock <= 120;
  // Racing the clock (late and behind) is the true two-minute drill; a hurry-up game plan
  // otherwise means a no-huddle pace, not a drill for sixty minutes.
  // Before the half every offense works the drill to steal points; late in the game only
  // the trailing side does.
  // Late in a short regular-season overtime nobody wants a tie: both sides run the drill.
  const urgent = (q >= 4 && trail >= 4 && clock <= 240) || (twoMin && (trail > 0 || q === 2)) || (q >= 5 && clock <= 300 && plan.tempo === "hurry");
  const hurry = urgent || plan.tempo === "hurry";
  const chew = plan.tempo === "chew" && trail <= 0 && !(q >= 4 && clock <= 180 && trail >= 1);
  const stopFd = clockStopFirstDown(year) && firstDown;
  if (spiked) return { used: 3, stopped: true };
  // Only the real drill rushes to the line after a stopped clock; a no-huddle plan still
  // spends the usual few seconds getting the call in.
  if (oob || !complete) return { used: urgent || twoMin ? randInt(save, 4, 7) : randInt(save, 6, 9), stopped: true };
  if (stopFd) return { used: randInt(save, 6, 9), stopped: true };
  const [lo, hi] = huddleSeconds(year, urgent ? "hurry" : hurry ? "uptempo" : chew ? "chew" : "standard");
  const used = randInt(save, lo, hi);
  // A live snap may cross 2:00, but its between-play runoff cannot cross the warning.
  return { used: (q === 2 || q === 4) && clock > 120 ? Math.min(used, Math.max(7, clock - 120)) : used, stopped: false };
}

const INJURIES = ["ankle", "knee", "shoulder", "ribs", "hamstring", "hip", "hand", "shaken up", "concussion", "foot", "groin", "wrist"];

// Real NFL injury rates vary a lot by position - RBs, FBs, and the trench positions take
// a hit on nearly every snap, while a QB is protected by rule and a kicker barely gets
// touched. Without this every position shared one flat rate, which is not how it works.
const POS_INJURY_RISK: Partial<Record<Pos, number>> = {
  RB: 1.35,
  FB: 1.25,
  LT: 1.2,
  LG: 1.2,
  C: 1.15,
  RG: 1.2,
  RT: 1.2,
  DE: 1.2,
  DT: 1.2,
  OLB: 1.1,
  MLB: 1.1,
  TE: 1.1,
  QB: 0.75,
  K: 0.3,
  P: 0.3,
};

function posInjuryRisk(p: Player, year: number): number {
  // Modern starting QBs miss real time (only about half play every game); the lower modern
  // base injury rate had them near-indestructible, taking ~94% of their team's attempts.
  // Measured against the record (2026): a club's leading passer played about 14 of 16 games
  // and threw about four in five of its passes; at 1.6 he missed under one game a year.
  if (p.pos === "QB") return year >= 2000 ? 3.0 : 2.0;
  return POS_INJURY_RISK[p.pos] ?? 1;
}

function maybeInGameInjury(save: DynastySave, p: Player | undefined, wx: Wx, turf: boolean): boolean {
  if (!p || p.injuredWeeks > 0) return false;
  const eraHit = save.year <= 1979 ? 0.0018 : save.year <= 1999 ? 0.0014 : 0.0012;
  const wxHit = wx === "cold" || wx === "snow" ? 1.15 : 1;
  const turfHit = turf && save.year >= 1970 && save.year <= 1999 ? 1.2 : turf ? 1.08 : 1;
  const chance = eraHit * ((100 - p.ratings.inj) / 55) * kitInjMult(p) * wxHit * turfHit * posInjuryRisk(p, save.year);
  if (rand(save) > chance) return false;
  const durable = p.ratings.inj >= 88 || kitInjMult(p) <= 0.8;
  p.injuredWeeks = durable ? (p.pos === "QB" ? randInt(save, 1, 3) : 1) : p.ratings.inj >= 70 ? randInt(save, 1, 4) : randInt(save, 2, 7);
  p.injuryName = INJURIES[randInt(save, 0, INJURIES.length - 1)];
  p.injuredOn = { year: save.year, week: save.week, phase: save.phase };
  return true;
}

/**
 * League-average lead-back elusiveness + power this season. A runner is measured against his
 * own league, so each era's yards per carry comes from its era target instead of drifting
 * upward as rating scales inflate over sixty seasons of development.
 */
const rbAnchorCache = new WeakMap<DynastySave, { year: number; v: number }>();
function rbAnchor(save: DynastySave): number {
  const hit = rbAnchorCache.get(save);
  if (hit && hit.year === save.year) return hit.v;
  const vals: number[] = [];
  for (const id of activeTeamIds(save.year)) {
    const rb = starters(save, id, "RB", 1)[0];
    if (rb) vals.push(rb.ratings.btk + rb.ratings.elu);
  }
  // Pull toward the old fixed anchor so a whole league of great backs still runs a bit better.
  const v = vals.length ? 0.75 * (vals.reduce((a, b) => a + b, 0) / vals.length) + 0.25 * 130 : 130;
  rbAnchorCache.set(save, { year: save.year, v });
  return v;
}

/**
 * League-average passing accuracy (starting QB accuracy + his top target's hands and routes).
 * A passer is judged against his league, like runners, so an era's completion rate comes from
 * its era target and the gap between an elite QB and a backup reads like real life (~15
 * points of completion %, not 35).
 */
const passAnchorCache = new WeakMap<DynastySave, { year: number; v: number }>();
function passAnchor(save: DynastySave): number {
  const hit = passAnchorCache.get(save);
  if (hit && hit.year === save.year) return hit.v;
  const vals: number[] = [];
  for (const id of activeTeamIds(save.year)) {
    const qb = starters(save, id, "QB", 1)[0];
    const wr = starters(save, id, "WR", 1)[0];
    if (qb) vals.push(qb.ratings.throwAcc + (wr ? (wr.ratings.catch + wr.ratings.rrt) / 2 : 50));
  }
  const v = vals.length ? 0.75 * (vals.reduce((a, b) => a + b, 0) / vals.length) + 0.25 * 140 : 140;
  passAnchorCache.set(save, { year: save.year, v });
  return v;
}

/**
 * The field shrinks inside the 20: fewer windows, no deep safety to beat. Red-zone TD rates
 * ran 56-67% in the sim against a real 50-56%, worst in the 1990s-2000s when defenses were
 * built to bend and not break (and scoring ran ~2.5 points a game hot there).
 */
function redZoneSqueeze(year: number): number {
  // Eased by ~0.02 when sacks were brought up to real rates: a sack ends drives the old
  // near-sackless calibration never lost, and scoring ran about a point a game light.
  // The 60s and 70s finished more of their trips: scoring ran 1-3 points a game light.
  // Retuned once both teams ran the drill before the half (more second-quarter points) and
  // field goals and completions were set to each era's real rates.
  // With the posts back on the goal line before 1974, stalled trips kick real field goals
  // (2.3-2.7 tries a game) instead of being finished at an inflated touchdown rate.
  if (year <= 1969) return -0.32;
  if (year <= 1973) return -0.32;
  if (year <= 1977) return -0.48;
  if (year <= 1983) return -0.2;
  if (year <= 1989) return -0.25;
  if (year <= 1999) return -0.2;
  if (year <= 2009) return -0.2;
  if (year === 2010) return -0.15;
  if (year <= 2019) return -0.18;
  // From 2024 the dynamic kickoff starts drives further out: the red zone tightens to match.
  if (year >= 2024) return -0.2;
  return -0.3;
}

function pinAtGoal(save: DynastySave, spot: number, yds: number, year: number, brake: number, pass = false): number {
  if (spot + yds < 100) return yds;
  // A catch across the stripe is six; getting dragged down at the one is a runner's fate far
  // more than a receiver's. Pinning passes as often as runs turned passing TDs into goal-line
  // rushing TDs (sim had ~2 rush TDs per pass TD; the real league is closer to 2 pass per rush).
  const dive = ((year <= 1969 ? 0.22 : year <= 1977 ? 0.18 : 0.14) + (1 - brake) * 0.25) * (pass ? 0.35 : 1);
  if (rand(save) < clamp(dive, pass ? 0.03 : 0.1, 0.55)) return Math.max(1, 99 - spot);
  return yds;
}

function deadBall(year: number, score: number, trail = 0, q = 1): number {
  let m = 1;
  // Up big in the second half, the starters sit and the calls go vanilla: the long ones dry up.
  if (q >= 3 && trail <= -21) m *= q >= 4 || trail <= -28 ? 0.7 : 0.82;
  // Softer than it once was: this used to offset the extra snaps from a (college-only)
  // first-down clock stop. With real snap counts it just shaves the era's big plays.
  if (year <= 1969 && score >= 28) m *= 0.85;
  if (year <= 1977 && score >= 35) m *= 0.8;
  return m;
}

export function teamNetYards(box: BoxPlayer[]): number {
  let pass = 0;
  let rush = 0;
  let sackLoss = 0;
  for (const b of box) {
    pass += b.passYds ?? 0;
    rush += b.rushYds ?? 0;
    sackLoss += b.sackYdsLost ?? 0;
  }
  return pass + rush - sackLoss;
}

function halfDist(spot: number, yds: number, againstOff: boolean): number {
  const room = againstOff ? Math.max(1, spot) : Math.max(1, 100 - spot);
  return Math.max(1, Math.min(yds, Math.floor(room / 2)));
}

function schemeEdge(offS: string | undefined, defS: string | undefined, pass: boolean): number {
  if (offS === "vertical" && defS === "cover-2") return pass ? -2.4 : 0.5;
  if (offS === "smashmouth" && defS === "3-4") return pass ? 0.4 : -1.4;
  if (offS === "smashmouth" && defS === "4-3") return pass ? -0.2 : 1.2;
  if (offS === "westcoast" && defS === "cover-2") return pass ? 1.7 : 0.2;
  if (offS === "westcoast" && defS === "wide-9") return pass ? -0.9 : 0.5;
  if (offS === "vertical" && defS === "wide-9") return pass ? 1.3 : -0.7;
  return 0;
}

function qbCliff(save: DynastySave, teamId: TeamId, qb: Player | undefined): number {
  if (!qb) return 0.02;
  const hurt = rosterOf(save, teamId)
    .filter((p) => p.pos === "QB" && p.injuredWeeks > 0)
    .sort((a, b) => b.ovr - a.ovr)[0];
  if (hurt && hurt.ovr - qb.ovr >= 8) return 0.035;
  if (qb.yearsPro <= 0) return 0.012;
  return 0;
}

function maybeOverturn(save: DynastySave, year: number): boolean {
  if (!replayReview(year)) return false;
  if (rand(save) > 0.09) return false;
  return rand(save) < 0.28;
}

/**
 * Availability prior. Historical missed time helps estimate durability when a simulated career
 * begins; that extra risk fades as this league supplies its own evidence. Current ratings,
 * position and recent workload drive ongoing injury risk.
 */
const missCache = new WeakMap<object, number>();
function arcHazard(p: Player): number {
  const arc = p.arc;
  if (!arc || arc.to <= 0 || arc.g <= 0) return 0;
  let h = missCache.get(arc);
  if (h === undefined) {
    const last = Math.min(arc.to, ARC_DATA_LAST);
    let possible = 0;
    for (let y = arc.dy; y <= last; y++) {
      possible += y <= 1960 ? 12 : y === 1982 ? 9 : y === 1987 ? 15 : gamesInSeason(y);
    }
    const seasons = Math.max(1, last - arc.dy + 1);
    const st = Math.min(arc.st, seasons);
    const starterShare = st / seasons;
    // Years as a backup aren't "missed" games: a backup QB rarely plays; everyone else still
    // covers kicks. Only the shortfall against that expectation is time lost to injury.
    const backupPlays = p.pos === "QB" || p.pos === "K" || p.pos === "P" ? 0.2 : 0.75;
    const expected = (possible / seasons) * (st + (seasons - st) * backupPlays);
    const missed = clamp(1 - arc.g / Math.max(1, expected), 0, 0.6);
    const extra = Math.max(0, missed - 0.1) * clamp(starterShare * 1.4, 0, 1);
    h = extra <= 0 ? 0 : Math.min(0.14, extra / (3.2 * (1 - extra)));
    missCache.set(arc, h);
  }
  // Real missed-time history is a starting durability prior. As the simulated career builds its
  // own evidence, it steadily replaces that real-life outcome instead of trapping the player in it.
  const simulatedSeasons = (p.careerDevelopment?.weeks ?? 0) / 17;
  return h * clamp(1 - simulatedSeasons * 0.1, 0.35, 1);
}

function rollInjuries(save: DynastySave, teamId: TeamId): void {
  const eraHit = save.year <= 1979 ? 0.016 : save.year <= 1999 ? 0.013 : 0.011;
  for (const p of rosterOf(save, teamId)) {
    if (p.injuredWeeks > 0) continue;
    const injMult = kitInjMult(p);
    const recentWorkload = p.careerDevelopment?.workload ?? 0;
    const workloadRisk = clamp(1 + Math.max(0, recentWorkload - 4) * 0.025, 0.9, 1.18);
    const chance = eraHit * ((100 - p.ratings.inj) / 55) * injMult * posInjuryRisk(p, save.year) * workloadRisk + arcHazard(p);
    if (rand(save) > chance) continue;
    const durable = p.ratings.inj >= 88 || injMult <= 0.8;
    const weeks = durable ? randInt(save, 1, 2) : p.ratings.inj >= 70 ? randInt(save, 1, 5) : randInt(save, 2, 8);
    p.injuredWeeks = weeks;
    p.injuryName = INJURIES[randInt(save, 0, INJURIES.length - 1)];
    p.injuredOn = { year: save.year, week: save.week, phase: save.phase };
  }
}

/** End of the regular season: each player's line goes into his career record. */
export function clampSeasonStats(save: DynastySave): void {
  for (const p of Object.values(save.players)) {
    const s = p.stats[save.year];
    if (!s) continue;
    if (!p.career) p.career = [];
    const existing = p.career.find((c) => c.year === save.year);
    if (!existing) p.career.push({ ...s });
  }
}

/**
 * Crunch time: the owner's call in a close game late. A probe run pauses the game at the
 * first undecided big moment by throwing CrunchPause (on a throwaway copy of the save); the
 * real run replays the identical game - same RNG, same plays - and applies the choices made.
 */

export type { CrunchSituation };

export class CrunchPause extends Error {
  situation: CrunchSituation;
  constructor(situation: CrunchSituation) {
    super("crunch");
    this.situation = situation;
  }
}

let crunchHook: { gameId: string; teamId: TeamId; choices: string[]; probe: boolean } | undefined;
export function setCrunchHook(h: typeof crunchHook): void {
  crunchHook = h;
}

/** A finished regular-season game into the standings: records, points, streaks, division and conference marks. */
export function creditStandings(save: DynastySave, game: GameResult, coaches = true): void {
  const year = game.year;
  const homeId = game.homeId as TeamId;
  const awayId = game.awayId as TeamId;
  const ht = save.teams[homeId];
  const at = save.teams[awayId];
  if (!ht || !at) return;
  // Standings, streaks and head-to-head records are the regular season. Playoff results live
  // in the bracket; counting them here gave 14-game champions 16-2 records, and since each
  // playoff round re-reads the standings to order its field, it could reshuffle the bracket.
  if (game.phase === "regular") {
    ht.pf += game.homeScore;
    ht.pa += game.awayScore;
    at.pf += game.awayScore;
    at.pa += game.homeScore;
    const sameDiv = divisionKey(year, homeId) === divisionKey(year, awayId);
    const sameConf = conferenceOf(year, homeId) === conferenceOf(year, awayId);
    if (game.homeScore > game.awayScore) {
      ht.wins += 1;
      at.losses += 1;
      if (game.phase === "regular") {
        ht.careerWins = (ht.careerWins ?? 0) + 1;
        at.careerLosses = (at.careerLosses ?? 0) + 1;
        if (coaches) creditCoachWl(save, homeId, "W");
        if (coaches) creditCoachWl(save, awayId, "L");
      }
      ht.streak = ht.streak.startsWith("W") ? `W${Number(ht.streak.slice(1)) + 1}` : "W1";
      at.streak = at.streak.startsWith("L") ? `L${Number(at.streak.slice(1)) + 1}` : "L1";
      if (sameDiv) {
        ht.divWins += 1;
        at.divLosses += 1;
      }
      if (sameConf) {
        ht.confWins += 1;
        at.confLosses += 1;
      }
    } else if (game.awayScore > game.homeScore) {
      at.wins += 1;
      ht.losses += 1;
      if (game.phase === "regular") {
        at.careerWins = (at.careerWins ?? 0) + 1;
        ht.careerLosses = (ht.careerLosses ?? 0) + 1;
        if (coaches) creditCoachWl(save, awayId, "W");
        if (coaches) creditCoachWl(save, homeId, "L");
      }
      at.streak = at.streak.startsWith("W") ? `W${Number(at.streak.slice(1)) + 1}` : "W1";
      ht.streak = ht.streak.startsWith("L") ? `L${Number(ht.streak.slice(1)) + 1}` : "L1";
      if (sameDiv) {
        at.divWins += 1;
        ht.divLosses += 1;
      }
      if (sameConf) {
        at.confWins += 1;
        ht.confLosses += 1;
      }
    } else {
      ht.ties += 1;
      at.ties += 1;
      if (game.phase === "regular") {
        ht.careerTies = (ht.careerTies ?? 0) + 1;
        at.careerTies = (at.careerTies ?? 0) + 1;
        if (coaches) creditCoachWl(save, homeId, "T");
        if (coaches) creditCoachWl(save, awayId, "T");
      }
    }
  }
}

export function simGame(save: DynastySave, game: GameResult): void {
  if (game.played) return;
  const year = save.year;
  const era = eraProfile(year);
  const homeId = game.homeId as TeamId;
  const awayId = game.awayId as TeamId;
  const hook = crunchHook && crunchHook.gameId === game.id ? crunchHook : undefined;
  let crunchN = 0;
  const crunchCalls: string[] = [];
  const bowl =
    game.phase === "superBowl" ? superBowlSite(year) : game.phase === "proBowl" ? proBowlSite(year) : null;
  // Real neutral-site regular-season games (London, Mexico City, Germany...) play at that stadium.
  const siteGame = !bowl && game.phase === "regular" && !!game.site;
  const venue: VenueInfo = bowl ? bowlVenue(bowl.site, year) : siteGame ? bowlVenue(game.site!, year) : venueOf(year, homeId);
  const wx: Wx = pickWeather(year, save.week, venue.climate, venue.indoor, () => rand(save));
  const homeU = teamUnits(save, homeId);
  const awayU = teamUnits(save, awayId);
  const neutral = !!bowl || siteGame;
  const playoff = game.phase === "playoffs" || game.phase === "superBowl";
  const homeField = neutral ? 0 : 2.1 + (game.night ? 0.5 : 0) + (venue.altitude >= 4000 ? 0.6 : 0);
  const noise = neutral
    ? 0
    : crowdNoise(homeId, venue, !!game.night, year) + (homeId === save.userTeamId ? ownerNoise(save) : 0);
  if (game.rivalry) {
    homeU.offPass += 1.1;
    homeU.offRun += 1.1;
    awayU.offPass += 1.1;
    awayU.offRun += 1.1;
  }
  if (wx === "snow" || wx === "rain") {
    homeU.offPass -= 3.2;
    awayU.offPass -= 3.2;
    homeU.offRun += 1.2;
    awayU.offRun += 1.2;
  }
  if (wx === "wind") {
    homeU.offPass -= 1.6;
    awayU.offPass -= 1.6;
  }
  if (venue.altitude >= 4000) {
    homeU.offPass += 1.4;
    awayU.offPass += 0.6;
    awayU.offRun -= 0.8;
  }

  const ko = kickoffRules(year);
  const eraPassW = era.passAtt / (era.passAtt + era.rushAtt);
  const big = eraBigPlay(year) * playoffBrake(game.phase);
  const pens = penaltyRates(year);
  const homeBox: BoxPlayer[] = [];
  const awayBox: BoxPlayer[] = [];
  const drives: DriveSummary[] = [];
  const highlights: string[] = [];
  const hq: number[] = [0, 0, 0, 0];
  const aq: number[] = [0, 0, 0, 0];
  let homeScore = 0;
  let awayScore = 0;
  let homePoss = 0;
  let awayPoss = 0;
  let homeFd = 0;
  let awayFd = 0;
  let homePen = 0;
  let awayPen = 0;
  let homePenYds = 0;
  let awayPenYds = 0;
  let home3rd = 0;
  let home3rdAtt = 0;
  let away3rd = 0;
  let away3rdAtt = 0;
  let homeRz = 0;
  let homeRzAtt = 0;
  let awayRz = 0;
  let awayRzAtt = 0;
  let homeTo = 0;
  let awayTo = 0;
  let homeSafeties = 0;
  let awaySafeties = 0;
  let homeRushYds = 0;
  let awayRushYds = 0;
  let q = 1;
  let clock = 900;
  let warned = false;
  let homeTO = 3;
  let awayTO = 3;
  let ot = false;
  // Overtime bookkeeping: which possession of overtime this is, who has the ball on it, and
  // the score when it was last checked, so every era's rule is judged in one place.
  let otPossNo = 0;
  let otOff: TeamId | null = null;
  let otPts: [number, number] = [0, 0];
  const otRule = otRules(year, game.phase);
  // Game week. The one-on-ones that decide games are looked up for every game so the league
  // plays one way; the owner's practice focus only ever touches his own club (see gameday.ts).
  const userIn = !save.cpuOnly && !save.sandbox && !save.realHistory && (homeId === save.userTeamId || awayId === save.userTeamId);
  const focus = userIn ? practiceFor(save, game) : undefined;
  const focusFit = focus ? (focusMatchesReport(save, homeId === save.userTeamId ? awayId : homeId, focus) ? 1.5 : 1) : 0;
  const focusOf = (id: TeamId, f: PracticeFocus) => (id === save.userTeamId && focus === f ? focusFit : 0);
  const matchups = keyMatchups(save, homeId, awayId);
  const matchupOf = (kind: KeyMatchup["kind"], offense: TeamId) => matchups.find((m) => m.kind === kind && m.teamId === offense);
  const bigStage = playoff || !!game.night || !!game.rivalry || !!game.slot;
  // Momentum, from the home side: turnovers, stops and scores push it, every snap lets it fade.
  let mo = 0;
  const moFor = (id: TeamId) => (id === homeId ? mo : -mo);
  const ruleSaid = new Set<string>();
  const ruleOnce = (key: string, text: string) => {
    if (!logOn || ruleSaid.has(key)) return;
    ruleSaid.add(key);
    note(text);
    cue("rule");
  };
  let crowdQ = 0;
  let longDriveSaid = 0;
  let freshLegs = false;
  const matchupSaid: Record<string, number> = {};
  const units: Record<string, TeamUnits> = { [homeId]: homeU, [awayId]: awayU };
  const boxOf = (id: TeamId) => (id === homeId ? homeBox : awayBox);
  // The owner's sideline orders (live broadcast): a new plan or a benched quarterback, from a
  // given snap on. Everything before that snap plays out exactly as it did.
  const orders = (save.liveOrders ?? []).filter((o) => o.gameId === game.id).sort((a, b) => a.at - b.at);
  let orderAt = 0;
  let ownerPlan: Partial<Gameplan> = {};
  const benched = new Set<string>();
  /** Clubs whose starter came out of a blowout. */
  const pulled = new Set<TeamId>();
  const planNow = (id: TeamId, trail: number, qq: number, ck: number): Gameplan => {
    const auto = planNowAuto(id, trail, qq, ck);
    return id === save.userTeamId ? { ...auto, ...ownerPlan } : auto;
  };
  const planNowAuto = (id: TeamId, trail: number, qq: number, ck: number): Gameplan => {
    const base = planFor(save, id);
    // Overtime is no place to punt from midfield: coaches play to end it, and a side that has
    // to answer a score plays like it's the two-minute drill.
    if (qq >= 5) return { ...base, fourth: "aggressive", tempo: trail > 0 || ck <= 150 || game.phase === "regular" ? "hurry" : base.tempo };
    if (qq >= 4 && trail >= 8 && ck <= 300) return { ...base, attack: "pass", fourth: "aggressive", tempo: "hurry" };
    if (qq >= 4 && trail <= -8 && ck <= 240) return { ...base, attack: "run", fourth: "conservative", tempo: "chew" };
    // The four-minute offense: protecting any lead late, run it and bleed the clock.
    if (qq >= 4 && trail < 0 && ck <= 300) return { ...base, attack: trail <= -4 ? "run" : base.attack, tempo: "chew" };
    if (playoff && base.fourth === "aggressive" && trail > -3) return { ...base, fourth: "normal" };
    if (year <= 1979 && base.tempo === "hurry") return { ...base, tempo: "standard" };
    return base;
  };

  // Play-by-play for the owner's own games: each snap's stat events and booth notes become a line.
  // In a sandbox every game is logged for the whip-around; only the featured one keeps its log
  // past the next week (see pickFeaturedGame).
  const logOn =
    !!save.sandbox || (!save.cpuOnly && (homeId === save.userTeamId || awayId === save.userTeamId || game.phase === "superBowl"));
  const log: PlayLog[] = [];
  let cur: OpenPlay | undefined;
  // The booth's memory: what it knows going in, and who it's watching for a milestone, a
  // record, or a big day against his old team.
  const watches: Watch[] = logOn ? gameWatches(save, game) : [];
  const watchOf = new Map(watches.map((w) => [w.playerId, w]));
  const marks = logOn ? leagueMarks(save) : undefined;
  const memory: MemoryNote[] = logOn ? pregameMemory(save, game, watches) : [];
  const momentSaid = new Set<string>();
  const callMoments = (play: OpenPlay) => {
    const touched = new Map<string, Partial<BoxPlayer>[]>();
    for (const [id, b] of play.bumps) if (watchOf.has(id)) touched.set(id, [...(touched.get(id) ?? []), b]);
    for (const [id, bs] of touched) {
      const w = watchOf.get(id)!;
      const row = boxOf(w.teamId).find((b) => b.playerId === id);
      for (const k of WATCH_STATS) {
        const delta = bs.reduce((n, b) => n + (((b as Record<string, number | undefined>)[k]) ?? 0), 0);
        if (!delta) continue;
        const after = (row as unknown as Record<string, number> | undefined)?.[k] ?? delta;
        const call = marks && liveMarkCall(save, w, k, after - delta, after, marks);
        if (call && !momentSaid.has(call.text)) {
          momentSaid.add(call.text);
          play.notes.push(call.text);
          play.cue = "record";
        }
      }
      const big = bs.some((b) => (b.passTd ?? 0) + (b.rushTd ?? 0) + (b.recTd ?? 0) + (b.ints ?? 0) + (b.sacks ?? 0) > 0);
      const p = save.players[id];
      if (big && w.formerClub && p && !momentSaid.has(`old:${id}`)) {
        momentSaid.add(`old:${id}`);
        play.notes.push(
          w.formerClub.traded
            ? `${playerName(p)} does it against the team that traded him. He'll enjoy that one.`
            : `${playerName(p)}, against his old team. He knows where they line up.`,
        );
        if (!play.cue) play.cue = "story";
      }
    }
  };
  const injuryUpdates: { at: number; text: string }[] = [];
  const tellMemory = () => {
    const m = memory.shift();
    if (!m || !cur) return;
    cur.notes.push(m.text);
    if (!cur.cue) cur.cue = "story";
  };
  const flushPlay = () => {
    if (!cur) return;
    if (watchOf.size) callMoments(cur);
    const d = describePlay(save, cur);
    if (d) {
      const sum = (key: keyof BoxPlayer) => cur!.bumps.reduce((n, [, b]) => n + (typeof b[key] === "number" ? b[key] as number : 0), 0);
      const kind = sum("sacksThrown") ? "sack" : sum("passAtt") ? "pass" : sum("rushAtt") ? "run" : sum("fgAtt") || sum("punts") ? "kick" : "other";
      const yards = kind === "pass" ? sum("passYds") : kind === "run" ? sum("rushYds") : kind === "sack" ? cur.sackYards ?? 0 : 0;
      log.push({ q: cur.q, clock: cur.clock, poss: cur.poss, down: cur.down, togo: Math.max(1, Math.round(cur.togo)), spot: Math.round(cur.spot), text: d.text, hs: homeScore, as: awayScore, tag: d.tag,
        snap: { call: cur.call ?? "special", kind, yards: Math.round(Math.min(yards, 100 - cur.spot)), complete: kind === "pass" ? sum("passCmp") > 0 : undefined }, homeTimeouts: homeTO, awayTimeouts: awayTO,
        ...(cur.cue ? { cue: cur.cue } : {}), ...(Math.abs(mo) >= 0.05 ? { mo: Math.round(mo * 10) / 10 } : {}) });
    }
    cur = undefined;
  };
  playTap = logOn ? (id, patch) => cur?.bumps.push([id, patch]) : undefined;
  const note = (s: string) => {
    if (highlights.length < 12) highlights.push(s);
    cur?.notes.push(s);
  };
  const cue = (c: NonNullable<PlayLog["cue"]>) => {
    if (cur && (!cur.cue || c === "inj")) cur.cue = c;
  };
  const swing = (toward: TeamId, amt: number, why?: string) => {
    const before = moFor(toward);
    mo = clamp(mo + (toward === homeId ? amt : -amt), -3, 3);
    const after = moFor(toward);
    // The booth calls a swing when the game turns, not every time a drive ends.
    if (why && logOn && before < 0.6 && after >= 1.4) {
      note(`${why} Momentum has swung to the ${nicknameOf(year, toward)}.`);
      cue("momentum");
    }
  };
  const qi = () => (q <= 4 ? q - 1 : 4);
  const addPts = (id: TeamId, n: number) => {
    while (hq.length <= qi()) hq.push(0);
    while (aq.length <= qi()) aq.push(0);
    if (id === homeId) {
      homeScore += n;
      hq[qi()]! += n;
    } else {
      awayScore += n;
      aq[qi()]! += n;
    }
  };
  const trailOf = (id: TeamId) => (id === homeId ? awayScore - homeScore : homeScore - awayScore);
  const ask = (
    kind: CrunchSituation["kind"],
    teamId: TeamId,
    options: CrunchSituation["options"],
    fgDist?: number,
  ): string | undefined => {
    if (!hook || teamId !== hook.teamId) return undefined;
    const i = crunchN++;
    let pick: string | undefined;
    if (i < hook.choices.length) pick = hook.choices[i];
    else if (hook.probe && i < 3) {
      const us = teamId === homeId ? homeScore : awayScore;
      const them = teamId === homeId ? awayScore : homeScore;
      flushPlay();
      playTap = undefined;
      throw new CrunchPause({ gameId: game.id, index: i, kind, q, clock, us, them, down, togo, spot, fgDist, options, log: logOn ? log.slice() : undefined });
    }
    const opt = options.find((o) => o.id === pick);
    // "coach" (or anything unknown) hands the call back to the staff's own logic.
    if (!opt) return undefined;
    crunchCalls.push(`Q${q > 4 ? "OT" : q} ${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")} — ${opt.label}`);
    note(`The owner's call: ${opt.label.toLowerCase()}.`);
    return pick;
  };
  /** Kick deep or onside? Late and trailing, the owner can make the call. */
  const onsideCall = (kicker: TeamId, auto: boolean): boolean => {
    const trailK = trailOf(kicker);
    if (hook && kicker === hook.teamId && q >= 4 && clock <= 300 && trailK >= 1 && trailK <= 16) {
      const pick = ask("onside", kicker, [
        { id: "onside", label: "Onside kick" },
        { id: "deep", label: "Kick it deep and trust the defense" },
      ]);
      if (pick) return pick === "onside";
    }
    return auto;
  };
  const live = (id: TeamId) => units[id]!;
  homeU.defRun += focusOf(homeId, "runD") * 1.2;
  awayU.defRun += focusOf(awayId, "runD") * 1.2;
  /** A matched pair only counts while both men are still out there. */
  const pairOn = (m: KeyMatchup | undefined): m is KeyMatchup => {
    if (!m) return false;
    const o = live(m.teamId);
    const d = live(m.teamId === homeId ? awayId : homeId);
    const ids = (u: TeamUnits) => [u.qb, u.rb, u.rb2, u.rb3, u.fb, u.te, ...u.wr, ...u.ol, ...u.dl, ...u.lb, ...u.db].map((x) => x?.id);
    return ids(o).includes(m.offId) && ids(d).includes(m.defId);
  };
  const edgeVsTackle = (offense: TeamId) => {
    const m = matchupOf("lt-edge", offense);
    return pairOn(m) ? (m.defGrade - m.offGrade) / 1100 : 0;
  };
  const toOf = (id: TeamId) => (id === homeId ? homeTO : awayTO);
  const spendTO = (id: TeamId) => {
    if (id === homeId) homeTO = Math.max(0, homeTO - 1);
    else awayTO = Math.max(0, awayTO - 1);
  };
  const addPoss = (id: TeamId, used: number) => {
    if (id === homeId) homePoss += used;
    else awayPoss += used;
  };
  const addFd = (id: TeamId) => {
    if (id === homeId) homeFd += 1;
    else awayFd += 1;
  };
  const addPen = (id: TeamId, yds: number) => {
    if (id === homeId) {
      homePen += 1;
      homePenYds += yds;
    } else {
      awayPen += 1;
      awayPenYds += yds;
    }
  };
  const markTo = (offenseId: TeamId) => {
    if (offenseId === homeId) homeTo += 1;
    else awayTo += 1;
  };
  const markSafety = (scorer: TeamId) => {
    if (scorer === homeId) homeSafeties += 1;
    else awaySafeties += 1;
  };
  const mark3rd = (id: TeamId, converted: boolean) => {
    if (id === homeId) {
      home3rdAtt += 1;
      if (converted) home3rd += 1;
    } else {
      away3rdAtt += 1;
      if (converted) away3rd += 1;
    }
  };
  const fatigue = (u: TeamUnits, side: "offense" | "defense", qq: number, ck: number, id: TeamId) => {
    const late = qq >= 4 || (qq === 3 && ck < 240);
    return unitFatigueMultiplier(u, side, late, venue.altitude >= 4000 && id === awayId);
  };

  let poss = rand(save) < 0.5 ? homeId : awayId;
  const openingReceiver = poss;
  let spot = ko.tb;
  let down = 1;
  let togo = 10;
  let drivePlays = 0;
  let driveYds = 0;
  let driveStart = spot;
  let driveQ = 1;
  let driveClock = 900;
  let driveRz = false;
  let lastRun = false;
  let plays = 0;

  const closeDrive = (result: DriveResult) => {
    const other = poss === homeId ? awayId : homeId;
    if (logOn && (result === "td" || result === "fg") && drivePlays >= 4) {
      const secs = Math.max(0, (q - driveQ) * 900 + driveClock - clock);
      note(`That drive: ${drivePlays} plays, ${Math.max(0, Math.round(driveYds))} yards, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}.`);
      if (cur && !cur.cue) cur.cue = "drive";
    }
    if (result === "td") swing(poss, 0.8);
    else if (result === "fg") swing(poss, 0.3);
    else if (result === "int" || result === "fumble") swing(other, 1.5, "Takeaway.");
    else if (result === "downs") swing(other, 1.1, "Stopped on fourth down.");
    else if (result === "safety") swing(other, 0.9, "Safety.");
    else if (result === "miss") swing(other, 0.4);
    drives.push({
      teamId: poss,
      q: driveQ,
      plays: drivePlays,
      yards: Math.round(driveYds),
      result,
      startSpot: Math.round(driveStart),
      label: `Q${driveQ} ${formatClock(clock)}`,
    });
    drivePlays = 0;
    driveYds = 0;
    driveRz = false;
  };

  const flipPoss = (newSpot: number) => {
    poss = poss === homeId ? awayId : homeId;
    spot = clamp(newSpot, 1, 99);
    down = 1;
    togo = 10;
    driveStart = spot;
    driveQ = q;
    driveClock = clock;
    drivePlays = 0;
    driveYds = 0;
    driveRz = false;
    lastRun = false;
  };

  const newSet = () => {
    down = 1;
    togo = Math.min(10, Math.max(1, 100 - spot));
  };

  const rebuild = (id: TeamId) => {
    const next = teamUnits(save, id, benched);
    if (id === homeId && !neutral) {
      next.offPass += homeField;
      next.offRun += 1.6;
    }
    if (wx === "snow" || wx === "rain") {
      next.offPass -= 3.2;
      next.offRun += 1.2;
    }
    if (wx === "wind") next.offPass -= 1.6;
    if (venue.altitude >= 4000 && id === awayId) {
      next.offPass -= 0.8;
      next.offRun -= 0.6;
    }
    if (game.rivalry) {
      next.offPass += 1.1;
      next.offRun += 1.1;
    }
    next.defRun += focusOf(id, "runD") * 1.2;
    units[id] = next;
  };

  const injure = (id: TeamId, p: Player | undefined) => {
    if (!p) return;
    if (!maybeInGameInjury(save, p, wx, venue.turf)) return;
    const hurt = p.injuryName ?? "injury";
    note(
      hurt === "shaken up"
        ? `${playerName(p)} is shaken up and slow to get off the turf.`
        : hurt === "concussion"
          ? `${playerName(p)} is down. He's being checked for a concussion.`
          : `${playerName(p)} is down with a ${hurt === "ribs" ? "rib" : hurt} injury.`,
    );
    const onField = (u: TeamUnits) => [u.qb, u.rb, u.rb2, u.rb3, u.fb, u.te, ...u.wr, ...u.ol, ...u.dl, ...u.lb, ...u.db, u.k, u.p].filter((x): x is Player => !!x);
    const was = new Set(onField(live(id)).map((x) => x.id));
    rebuild(id);
    const u = live(id);
    cue("inj");
    const sub = onField(u).find((x) => !was.has(x.id) && x.pos === p.pos) ?? onField(u).find((x) => !was.has(x.id));
    if (p.pos === "QB" && u.qb && u.qb.id !== p.id) {
      note(`${playerName(u.qb)} is in at quarterback (${u.qb.ovr}, down from ${p.ovr}).`);
    } else if (sub) {
      const drop = p.ovr - sub.ovr;
      note(`Next man up: ${playerName(sub)} (${sub.ovr})${drop >= 8 ? `, a real drop from ${p.ovr}` : ""}.`);
    } else {
      note(`Nobody behind him at ${p.pos}. They'll shuffle the lineup.`);
    }
    if (logOn && hurt !== "shaken up") {
      injuryUpdates.push({
        at: plays + 6,
        text:
          p.injuredWeeks >= 3
            ? `Injury update: ${playerName(p)} (${hurt}) has been ruled out for the rest of the game.`
            : `Injury update: ${playerName(p)} is questionable to return with a ${hurt === "ribs" ? "rib" : hurt} injury.`,
      });
    }
  };

  const tickClock = (id: TeamId, used: number) => {
    addPoss(id, Math.min(clock, used));
    clock = Math.max(0, clock - used);
  };

  const kickoffTo = (receiving: TeamId, onside: boolean, kind: "regular" | "free" = "regular") => {
    const kicking = receiving === homeId ? awayId : homeId;
    const ku = live(kicking);
    const ru = live(receiving);
    if (kind === "free") {
      const boom = 48 + ((ku.k?.ratings.kickPow ?? 72) - 70) * 0.3 + sampleYds(save, 0, 4, -6, 8);
      const land = clamp(20 + boom, 35, 75);
      clock = Math.max(0, clock - 6);
      poss = receiving;
      spot = clamp(100 - land + sampleYds(save, 8, 4, 0, 16), 20, 55);
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      driveClock = clock;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    if (onside) {
      const recover = rand(save) < 0.22 + ((ku.k?.ratings.kickAcc ?? 70) - 70) / 400;
      clock = Math.max(0, clock - 6);
      if (recover) {
        poss = kicking;
        spot = clamp(45 + sampleYds(save, 0, 4, -8, 8), 35, 55);
        down = 1;
        togo = 10;
        driveStart = spot;
        driveQ = q;
        driveClock = clock;
        drivePlays = 0;
        driveYds = 0;
        driveRz = false;
        note("Onside kick. They keep it.");
        return;
      }
      poss = receiving;
      spot = clamp(48 + sampleYds(save, 4, 6, -4, 16), 40, 70);
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      driveClock = clock;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    const hang = 58 + ((ku.k?.ratings.kickPow ?? 72) - 70) * 0.35 + (wx === "wind" ? -4 : 0) + (venue.altitude >= 4000 ? 3 : 0);
    const tbChance = kickoffTbRate(year) + (fairCatchKickoff(year) ? 0.12 : 0);
    if (rand(save) < 0.035) {
      poss = receiving;
      spot = kickoffOobSpot(year);
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      driveClock = clock;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      note("Kickoff out of bounds.");
      clock = Math.max(0, clock - 5);
      return;
    }
    if (rand(save) < tbChance + Math.max(0, hang - 62) / 90) {
      if (year >= 2024) ruleOnce("tb", `Touchback. The new kickoff brings it out to the ${ko.tb}.`);
      poss = receiving;
      spot = ko.tb;
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      driveClock = clock;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    const ret = ru.returner;
    if (fairCatchKickoff(year) && rand(save) < 0.32) {
      poss = receiving;
      // A fair catch inside the 25 comes out to the 25 (2021-23); before that, where it's caught.
      spot = Math.max(ko.tb, clamp(100 - ko.from - Math.round(hang + 2), 1, 40));
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      driveClock = clock;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    // The dynamic kickoff (2024) sets the coverage up five yards from the return man: the
    // returns run longer, and the drive starts around the 30.
    let yds = sampleYds(save, year >= 2024 ? 25 : 20, 6, 4, 34);
    const house = 0.007 * big * (ret ? ret.ratings.speed / 80 : 0.6) * (ret?.traits?.includes("Return man") ? 1.6 : 1);
    if (rand(save) < house) yds = randInt(save, 88, 109);
    else if (ret && rand(save) < 0.04 * big) yds += randInt(save, 12, 28);
    if (ret) bumpBox(boxOf(receiving), ret.id, { krYds: Math.min(yds, 109) });
    // Where the return man fields it, in his own team's yards: the kick carries about sixty
    // yards from the kicking line (the 40 before 1974, the 35, the 30 from 1994 to 2010), so a
    // normal kick is caught at the goal line or a few yards out of it.
    const caught = 100 - ko.from - Math.round(hang + 2);
    const land = clamp(caught + yds, 1, 100);
    if (land >= 100) {
      addPts(receiving, 6);
      if (ret) {
        bumpBox(boxOf(receiving), ret.id, { krTd: 1 });
        note(`${playerName(ret)} takes the kick back. House call.`);
      }
      extraPoint(receiving);
      const trailNow = trailOf(kicking);
      kickoffTo(kicking, q >= 4 && clock <= 180 && trailNow >= 1 && trailNow <= 8);
      return;
    }
    poss = receiving;
    spot = land;
    down = 1;
    togo = 10;
    driveStart = spot;
    driveQ = q;
    driveClock = clock;
    drivePlays = 0;
    driveYds = 0;
    driveRz = false;
  };

  const extraPoint = (id: TeamId) => {
    const u = live(id);
    const trail = trailOf(id);
    const afl = year <= 1969 && originalLeague(id) === "AFL";
    let go2 = twoPointOk(year, id) && wantTwoPoint(year, trail, q, clock, afl);
    if (twoPointOk(year, id) && hook && id === hook.teamId && q >= 4 && Math.abs(trail) <= 8) {
      const pick = ask("two", id, [
        { id: "kick", label: "Kick the extra point" },
        { id: "two", label: "Go for two" },
      ]);
      if (pick) go2 = pick === "two";
    }
    if (go2) {
      if (year === 1994) ruleOnce("two", "New this season: the NFL's first two-point conversions.");
      else if (afl) ruleOnce("two", "The AFL's two-point try, a rule the NFL won't adopt until 1994.");
      const ok = rand(save) < clamp(twoPointMakeP(year) + (u.offPass - 70) / 220 + u.kit.td, 0.28, 0.58);
      if (ok) addPts(id, 2);
      if (logOn) note(ok ? "The two-point try is good." : "The two-point try fails.");
      return;
    }
    if (u.k) bumpBox(boxOf(id), u.k.id, { xpAtt: 1 });
    const xpYds = xpKickYards(year);
    const make = fgMakeP(u.k, xpYds, wx, year, 0, venue.altitude);
    // Unit grades sit around 105, not 70: centred on 70 this blocked ~5% of tries (real ~1%).
    const block = rand(save) < clamp(0.009 + (live(id === homeId ? awayId : homeId).defPass - 105) / 2500, 0.003, 0.02);
    const xp = !block && rand(save) < clamp(xpMakeBase(year) + (make - 0.9) * 0.12 + ((u.k?.ratings.kickAcc ?? 70) - 70) / 600 + u.kit.fg * 0.5, 0.8, 0.997);
    if (xp) {
      addPts(id, 1);
      if (u.k) bumpBox(boxOf(id), u.k.id, { xpMade: 1 });
    } else if (block) {
      note("The extra point is blocked.");
    }
  };

  kickoffTo(poss, false);

  const scoreTd = (id: TeamId, how: string) => {
    if (driveRz || spot >= 80) {
      if (id === homeId) homeRz += 1;
      else awayRz += 1;
    }
    addPts(id, 6);
    note(how);
    closeDrive("td");
    extraPoint(id);
    const defId = id === homeId ? awayId : homeId;
    const trailK = trailOf(id);
    kickoffTo(defId, onsideCall(id, q >= 4 && clock <= 150 && trailK >= 1 && trailK <= 8));
  };

  /** A timeout stops the clock where the play ended: the huddle runoff is given back. */
  const stopClock = (used: number) => {
    const refund = Math.max(0, used - 6);
    clock += refund;
    addPoss(poss, -refund);
  };
  const tryTimeout = (id: TeamId, running: boolean, used = 0) => {
    if (!running) return;
    if (toOf(id) <= 0) return;
    const trail = trailOf(id);
    const twoMin = (q === 2 || q >= 4) && clock <= 120;
    if (twoMin && (trail >= 1 || q === 2 || q >= 5) && clock > 8) {
      spendTO(id);
      stopClock(used);
    }
  };
  /** Trailing late, the defense spends its timeouts to get the ball back with time to use it. */
  const tryDefTimeout = (id: TeamId, running: boolean, used: number) => {
    if (!running || toOf(id) <= 0) return;
    const trail = trailOf(id);
    if (q >= 4 && clock <= 150 && clock > 8 && trail >= 1 && trail <= 16) {
      spendTO(id);
      stopClock(used);
      if (logOn) note(`Timeout, ${nicknameOf(year, id)}. They need the ball back.`);
    }
  };
  // Who started: when the quarterback or the lead back goes down, the play-calling changes with him.
  const startedQb: Record<string, string | undefined> = { [homeId]: homeU.qb?.id, [awayId]: awayU.qb?.id };
  const startedRb: Record<string, string | undefined> = { [homeId]: homeU.rb?.id, [awayId]: awayU.rb?.id };
  const personnelLean = (offense: TeamId, defense: TeamId) => {
    const o = live(offense);
    const d = live(defense);
    let lean = clamp((o.offPass - d.defPass - (o.offRun - d.defRun)) / 150, -0.05, 0.05);
    if (o.qb && startedQb[offense] && o.qb.id !== startedQb[offense]) lean -= 0.05;
    if (startedRb[offense] && o.rb?.id !== startedRb[offense]) lean += 0.03;
    return lean;
  };

  homeU.offPass += homeField;
  homeU.offRun += neutral ? 0 : 1.6;

  const applyOrder = (o: LiveOrder) => {
    const u = save.userTeamId;
    let text = "";
    if (o.kind === "plan" && o.plan) {
      ownerPlan = { ...ownerPlan, ...o.plan };
      const bits = [
        o.plan.attack && (o.plan.attack === "pass" ? "throw it" : o.plan.attack === "run" ? "run the ball" : "stay balanced"),
        o.plan.tempo && (o.plan.tempo === "hurry" ? "go hurry-up" : o.plan.tempo === "chew" ? "milk the clock" : "normal tempo"),
        o.plan.fourth && (o.plan.fourth === "aggressive" ? "go for it on fourth down" : o.plan.fourth === "conservative" ? "punt and play field position" : "take the points"),
        o.plan.blitz && (o.plan.blitz === "heavy" ? "send the house" : o.plan.blitz === "rare" ? "sit back in coverage" : "normal pressure"),
      ].filter(Boolean);
      text = `Word from the owner's box: ${bits.join(", ")}.`;
    } else if (o.kind === "benchQb") {
      const qb = live(u).qb;
      if (!qb) return;
      benched.add(qb.id);
      rebuild(u);
      const next = live(u).qb;
      if (!next || next.id === qb.id) {
        benched.delete(qb.id);
        rebuild(u);
        return;
      }
      text = `The owner has seen enough. ${playerName(qb)} is out; ${playerName(next)} takes over at quarterback.`;
    }
    if (text) {
      log.push({ q, clock, poss, down, togo: Math.max(1, Math.round(togo)), spot: Math.round(spot), text, hs: homeScore, as: awayScore, tag: "call" });
      note(text);
    }
  };

  // Each drive's `after` score is stamped at the next snap, once the try and kickoff are done.
  let stamped = 0;
  const stampDrives = () => {
    for (; stamped < drives.length; stamped++) drives[stamped]!.after = [homeScore, awayScore];
  };
  while (plays < 260) {
    stampDrives();
    mo *= 0.94;
    if (ot && otRule.kind !== "none") {
      // A score ends overtime once the scores differ, except a first-possession score the era
      // lets the other side answer: a field goal under modified sudden death (2010), any
      // score once both teams are guaranteed the ball (playoffs 2022, regular season 2025).
      const homeGain = homeScore - otPts[0];
      const awayGain = awayScore - otPts[1];
      if (homeGain > 0 || awayGain > 0) {
        const scorer = homeGain > 0 ? homeId : awayId;
        const answerable =
          otPossNo === 1 &&
          scorer === otOff &&
          (otRule.kind === "both" || (otRule.kind === "modified" && Math.max(homeGain, awayGain) === 3));
        if (homeScore !== awayScore && !answerable) break;
      }
      if (poss !== otOff) {
        // A possession just ended. Past the guaranteed ones, whoever leads has won.
        if (otPossNo >= 2 && homeScore !== awayScore) break;
        otPossNo += 1;
        otOff = poss;
      }
      otPts = [homeScore, awayScore];
    }
    if (logOn) {
      flushPlay();
      while (orderAt < orders.length && orders[orderAt]!.at <= log.length) applyOrder(orders[orderAt++]!);
      cur = { q, clock, poss, down, togo, spot, bumps: [], notes: [] };
    }
    plays += 1;
    if (plays === 1 && logOn && bigStage) {
      note(
        playoff
          ? "Playoff football. Win or go home."
          : game.night
            ? "Prime time. The whole country is watching this one."
            : game.rivalry
              ? "Rivalry week. These two don't like each other."
              : "A national TV window. The lights are a little brighter.",
      );
      cue("crowd");
    }
    if (logOn && (plays === 2 || plays === 6 || plays === 12 || plays === 20)) tellMemory();
    while (logOn && injuryUpdates.length && injuryUpdates[0]!.at <= plays) {
      note(injuryUpdates.shift()!.text);
      cue("inj");
    }
    if (q === 2 || q === 4) {
      if (!warned && clock <= 120 && clock > 0) {
        warned = true;
        note("Two-minute warning.");
      }
    }
    if (clock <= 0) {
      if (q === 1 || q === 3) {
        q += 1;
        if (q === 4 && logOn && !neutral && Math.abs(homeScore - awayScore) <= 8) {
          note(`Fourth quarter, one-score game. ${venue.stadium} is on its feet.`);
          cue("crowd");
        }
        clock = 900;
        warned = q === 2 || q === 4 ? false : warned;
        continue;
      }
      if (q === 2) {
        flushPlay();
        closeDrive("end");
        q = 3;
        clock = 900;
        warned = false;
        homeTO = 3;
        awayTO = 3;
        const receiver = openingReceiver === homeId ? awayId : homeId;
        if (logOn) cur = { q, clock, poss: receiver, down: 1, togo: 10, spot: 20, bumps: [], notes: [] };
        kickoffTo(receiver, false);
        continue;
      }
      if (q === 4 && !ot) {
        if (homeScore !== awayScore) break;
        if (otRule.kind === "none") break;
        closeDrive("end");
        ot = true;
        q = 5;
        clock = otRule.seconds;
        const otReceiver = rand(save) < 0.5 ? homeId : awayId;
        otPossNo = 1;
        otOff = otReceiver;
        otPts = [homeScore, awayScore];
        if (logOn) {
          note(otCall(otRule.kind, year));
          cue("rule");
        }
        kickoffTo(otReceiver, false);
        continue;
      }
      if (q >= 5) {
        if (homeScore !== awayScore) break;
        if (game.phase === "regular" || game.phase === "preseason") break;
        q += 1;
        clock = 900;
        continue;
      }
      break;
    }

    // Up three scores in the fourth with ten minutes left, the starter sits and the backup
    // finishes it: real starters threw about four in five of a club's passes, here they threw 94%.
    if (q >= 4 && clock <= 600 && trailOf(poss) <= -21 && !pulled.has(poss)) {
      const qb = live(poss).qb;
      const second = qb ? starters(save, poss, "QB", 2, benched).find((x) => x.id !== qb.id) : undefined;
      if (qb && second) {
        pulled.add(poss);
        benched.add(qb.id);
        rebuild(poss);
        if (logOn) note(`${playerName(second)} comes in at quarterback.`);
      }
    }
    const off = live(poss);
    const defId = poss === homeId ? awayId : homeId;
    const def = live(defId);
    const trail = trailOf(poss);
    const plan = planNow(poss, trail, q, clock);
    const defensivePlan = planNow(defId, -trail, q, clock);
    const fat = fatigue(off, "offense", q, clock, poss);
    const dfat = fatigue(def, "defense", q, clock, defId);
    const clutch = (q >= 4 && (trail > 0 || clock < 180) ? off.kit.clutch : 0) * 0.35;
    const was3rd = down === 3;
    if (spot >= 80 && !driveRz) {
      driveRz = true;
      if (poss === homeId) homeRzAtt += 1;
      else awayRzAtt += 1;
    }

    const offScore = poss === homeId ? homeScore : awayScore;
    const brake = deadBall(year, offScore, trail, q);
    // Up three scores after halftime the starters come out and the calls go vanilla: the whole
    // offense slows, not only the long ones. A 24-point halftime lead kept growing by 19 more,
    // twice real 1966's share of 35-point games.
    const vanilla = q >= 3 && trail <= -21 ? (q >= 4 || trail <= -28 ? 1 : 0.6) : 0;
    // The other side of it: the leader's second-string defense gives some of it back.
    const soft = q >= 3 && trail >= 21 ? (q >= 4 || trail >= 28 ? 1 : 0.6) : 0;
    // Garbage time is the trailing side's: three scores down late it throws on every down into
    // a prevent shell. (The sign was flipped: the club up 17 was the one throwing more, which
    // ran the best quarterbacks' attempts past 700.)
    const garbage = q >= 4 && trail >= 17 && clock <= 360;
    const prevent = garbage;
    const pressure = pressureAdjustment(defensivePlan.blitz);

    const offU = poss === homeId ? homeU : awayU;
    const disc = Math.max(0.55, 1 + (offU.kit.pen ?? 0));
    // The building matters most when the game is tight, the stage is big and the home side has it rolling.
    const tight = (q >= 4 && Math.abs(homeScore - awayScore) <= 8) || ot;
    const crowdLift = (bigStage ? 1.15 : 1) * (tight ? 1.35 : 1) * (mo > 1.2 ? 1.15 : 1);
    const pre = pens.preSnap * disc + (poss === awayId && !neutral ? noise * crowdLift : 0);
    if (rand(save) < pre) {
      if (poss === awayId && !neutral && tight && noise > 0 && crowdQ !== q) {
        crowdQ = q;
        note("False start. The crowd forced that one.");
        cue("crowd");
      }
      const yds = halfDist(spot, 5, true);
      addPen(poss, yds);
      spot = Math.max(1, spot - yds);
      togo += yds;
      driveYds -= yds;
      clock = Math.max(0, clock - 4);
      if (tenSecondRunoff(year) && (q === 2 || q >= 4) && clock <= 60 && clock > 10) clock = Math.max(0, clock - 10);
      if (spot <= 0) {
        addPts(defId, 2);
        markSafety(defId);
        closeDrive("safety");
        kickoffTo(defId, false, "free");
        if (ot) break;
      }
      continue;
    }
    if (rand(save) < pens.delay && plan.tempo === "hurry") {
      addPen(poss, 5);
      spot = Math.max(1, spot - 5);
      togo += 5;
      clock = Math.max(0, clock - 3);
      continue;
    }

    let call = callPlay(
      save,
      year,
      down,
      togo,
      spot,
      trail,
      q,
      clock,
      // The trailing side's own lean (behind by 8, desperate late) already carries most of it.
      eraPassW + (garbage ? 0.05 : 0),
      plan,
      off.k,
      wx,
      toOf(poss),
      toOf(defId),
      lastRun,
      off.kit.scramble,
      venue.altitude,
      personnelLean(poss, defId),
    );
    if (call === "fg" && togo <= 2 && spot >= 58 && rand(save) < 0.014) {
      note("Fake field goal.");
      call = togo <= 1 ? "sneak" : "run";
    }
    if (call === "punt" && togo <= 3 && spot >= 40 && spot < 70 && rand(save) < 0.016) {
      note("Fake punt. They keep it.");
      call = "run";
    }
    if (
      down === 4 &&
      hook &&
      poss === hook.teamId &&
      q >= 4 &&
      Math.abs(trailOf(poss)) <= 8 &&
      togo <= 5 &&
      spot >= 30 &&
      call !== "kneel" &&
      call !== "spike"
    ) {
      const fgDist = 100 - spot + fgSnapYards(year);
      const opts: CrunchSituation["options"] = [{ id: "go", label: `Go for it on 4th-and-${Math.max(1, Math.round(togo))}` }];
      if (fgDist <= 58) opts.push({ id: "fg", label: `Kick the ${Math.round(fgDist)}-yard field goal` });
      if (spot < 72) opts.push({ id: "punt", label: "Punt it away" });
      const pick = ask("fourth", poss, opts, fgDist);
      if (pick === "go") call = togo <= 1 ? "sneak" : togo <= 2 ? "run" : "short";
      else if (pick === "fg") call = "fg";
      else if (pick === "punt") call = "punt";
    }

    if (cur) cur.call = call;
    if (call === "kneel") {
      const used = Math.min(clock, 40);
      tickClock(poss, used);
      drivePlays += 1;
      down += 1;
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { rushAtt: 1, rushYds: -1, kneels: 1 });
      lastRun = true;
      // A kneel before the half just runs out the second quarter; the loop takes it to halftime.
      if (q < 4) continue;
      if (down > 4 || clock <= 0) {
        closeDrive("end");
        break;
      }
      continue;
    }
    if (call === "spike") {
      const used = snapClock(save, plan, year, q, clock, trail, false, false, false, true);
      tickClock(poss, used.used);
      drivePlays += 1;
      down += 1;
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1 });
      lastRun = false;
      continue;
    }

    if (call === "fg") {
      const fgDist = 100 - spot + fgSnapYards(year);
      if (off.k) bumpBox(boxOf(poss), off.k.id, { fgAtt: 1 });
      if (year < 1974) ruleOnce("posts", "The goalposts sit on the goal line in this era, ten yards closer than they will.");
      if (q >= 4 && clock <= 28 && toOf(defId) > 0 && rand(save) < 0.55) {
        spendTO(defId);
      }
      // Real field goals are blocked about 1.5-2% of the time; the unit grades centre near 100.
      const blocked = rand(save) < clamp(0.016 + (def.defRun - 100) / 2000, 0.006, 0.035);
      const make = !blocked && rand(save) < fgMakeP(off.k, fgDist, wx, year, clutch, venue.altitude) * (q >= 4 && clock <= 28 ? 0.97 : 1);
      clock = Math.max(0, clock - 6);
      drivePlays += 1;
      lastRun = false;
      if (blocked) {
        note("The kick is blocked.");
        const scoop = rand(save) < 0.12;
        closeDrive("miss");
        if (scoop) {
          addPts(defId, 6);
          note("Scoop and score off the block.");
          extraPoint(defId);
          kickoffTo(poss, false);
        } else {
          flipPoss(missedFgSpot(year, spot));
        }
        continue;
      }
      if (make) {
        if (off.k) bumpBox(boxOf(poss), off.k.id, { fgMade: 1 });
        addPts(poss, 3);
        note(`${off.k ? playerName(off.k) : "The kicker"} from ${Math.round(fgDist)}. It's good.`);
        closeDrive("fg");
        if (ot && otRule.kind === "sudden") break;
        const trailK = trailOf(poss);
        kickoffTo(defId, onsideCall(poss, q >= 4 && clock <= 150 && trailK >= 1 && trailK <= 8));
      } else {
        closeDrive("miss");
        flipPoss(missedFgSpot(year, spot));
        if (year < 1974) ruleOnce("miss20", "No good. Under these rules a miss comes back out to the 20.");
      }
      continue;
    }

    if (call === "punt") {
      const boom = 40 + ((off.p?.ratings.kickPow ?? 72) - 70) * 0.45 + sampleYds(save, 0, 4, -8, 8) + (venue.altitude >= 4000 ? 3 : 0);
      let raw = clamp(boom + (wx === "wind" ? -5 : 0), 28, 62);
      if (spot >= 60 && (off.p?.ratings.kickAcc ?? 70) >= 74 && rand(save) < 0.35) {
        raw = clamp(100 - spot - randInt(save, 4, 10), 28, 52);
      }
      if (off.p) bumpBox(boxOf(poss), off.p.id, { punts: 1, puntYds: raw });
      clock = Math.max(0, clock - 7);
      drivePlays += 1;
      lastRun = false;
      if (rand(save) < 0.008 + (def.defPass - 75) / 2000 + (spot <= 12 ? 0.012 : 0)) {
        note("Blocked punt.");
        closeDrive("punt");
        if (spot <= 8) {
          addPts(defId, 2);
          markSafety(defId);
          note("Blocked through the end zone. Safety.");
          kickoffTo(defId, false, "free");
          if (ot) break;
          continue;
        }
        flipPoss(clamp(100 - (spot - 8), 1, 99));
        continue;
      }
      const land = spot + raw;
      if (land >= 100) {
        closeDrive("punt");
        flipPoss(ko.tb);
      } else {
        const ret = def.returner;
        const fair = land >= 88 || (q >= 4 && trailOf(defId) <= -8);
        if (fair && rand(save) < 0.7) {
          closeDrive("punt");
          flipPoss(clamp(100 - land, 1, 99));
          continue;
        }
        let retYds = sampleYds(save, 7, 5, 0, 18);
        const house = 0.006 * big * (ret ? ret.ratings.speed / 82 : 0.5) * (ret?.traits?.includes("Return man") ? 1.7 : 1);
        if (rand(save) < house) retYds = randInt(save, 70, 95);
        else if (ret && rand(save) < 0.035 * big) retYds += randInt(save, 8, 22);
        if (ret) bumpBox(boxOf(defId), ret.id, { prYds: retYds });
        if (rand(save) < 0.015 + (wx === "rain" || wx === "snow" ? 0.02 : 0)) {
          note("Muffed punt.");
          closeDrive("fumble");
          if (rand(save) < 0.45) {
            flipPoss(clamp(100 - land + 2, 1, 99));
          } else {
            spot = clamp(land - 2, 1, 99);
            down = 1;
            togo = 10;
          }
          continue;
        }
        closeDrive("punt");
        const recvSpot = clamp(100 - land + retYds, 1, 100);
        if (recvSpot >= 100 && ret) {
          poss = defId;
          addPts(defId, 6);
          bumpBox(boxOf(defId), ret.id, { prTd: 1 });
          note(`${playerName(ret)} down the sideline on the punt return.`);
          extraPoint(defId);
          kickoffTo(poss === homeId ? awayId : homeId, false);
        } else {
          flipPoss(recvSpot);
        }
      }
      continue;
    }

    if (rand(save) < pens.hold * Math.max(0.55, 1 + (offU.kit.pen ?? 0))) {
      const yds = halfDist(spot, 10, true);
      cur?.notes.push(`Holding on the offense, ${yds} yards.`);
      addPen(poss, yds);
      spot = Math.max(1, spot - yds);
      togo += yds;
      drivePlays += 1;
      driveYds -= yds;
      clock = Math.max(0, clock - 8);
      lastRun = false;
      if (spot <= 0) {
        addPts(defId, 2);
        markSafety(defId);
        closeDrive("safety");
        kickoffTo(defId, false, "free");
        if (ot) break;
      }
      continue;
    }

    const pass = call !== "run" && call !== "draw" && call !== "sneak";
    const pa = call === "pa";
    const offClub = save.teams[poss];
    const defClub = save.teams[defId];
    const sch = schemeEdge(offClub?.offScheme, defClub?.defScheme, pass);
    const openScript = drives.length <= 1 && drivePlays < 8 ? 1.15 : 0;
    const wear =
      q >= 4
        ? ((poss === homeId ? homeRushYds : awayRushYds) > 110 ? 0.9 : 0) +
          ((poss === homeId ? awayRushYds : homeRushYds) > 110 && pass ? 0.6 : 0)
        : 0;
    const offP = (pass ? off.offPass : off.offRun) * fat + clutch + sch + openScript + wear - (prevent ? 1.5 : 0) + moFor(poss) * 0.8 + (ot ? 4 : 0);
    // A defense kept on the field for a long drive wears down, and a no-huddle offense won't let it substitute.
    const gassed = Math.max(0, drivePlays - 9) * (plan.tempo === "hurry" ? 0.009 : 0.006);
    if (logOn && drivePlays === 11 && longDriveSaid < 2) {
      longDriveSaid += 1;
      note("Eleven plays into this drive. That defense has its hands on its hips.");
    }
    const focusEdge = defensivePlan.defensiveFocus === "run" ? (pass ? -5 : 5) : defensivePlan.defensiveFocus === "pass" ? (pass ? 5 : -5) : 0;
    const defP = (pass ? def.defPass : def.defRun) * dfat * (1 - gassed) + (pass ? 3.2 : 0) + (prevent && pass ? -2.4 : 0) + focusEdge;
    const edge = offP - defP;

    const resolveScramble = (yds: number): boolean => {
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { rushAtt: 1, rushYds: yds });
      const t = pickTackler(save, def, false);
      if (t) bumpBox(boxOf(defId), t.id, { tackles: 1 });
      const used = snapClock(save, plan, year, q, clock, trail, true, rand(save) < 0.25, yds >= togo, false);
      tickClock(poss, used.used);
      drivePlays += 1;
      driveYds += yds;
      spot = clamp(spot + yds, 0, 100);
      lastRun = true;
      if (was3rd) mark3rd(poss, yds >= togo || spot >= 100);
      if (spot >= 100) {
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { rushTd: 1 });
        scoreTd(poss, `${playerName(off.qb!)} keeps it and goes.`);
        return ot && otRule.kind === "sudden";
      }
      if (yds >= togo) {
        addFd(poss);
        newSet();
      } else {
        down += 1;
        togo -= yds;
        if (down > 4) {
          closeDrive("downs");
          flipPoss(100 - spot);
        }
      }
      return false;
    };

    if (pass) {
      const sackP = clamp(
        era.sackRate + pressure - (plan.protection === "maxProtect" ? 0.025 : 0) +
          (defP - off.offPass * fat) / 220 +
          off.kit.sack +
          (call === "deep" ? 0.02 : 0) +
          (rand(save) < 0.5 ? 0.03 : -0.01) -
          (pa ? 0.02 : 0) +
          edgeVsTackle(poss) -
          focusOf(poss, "passPro") * 0.006 -
          Math.min(0.012, Math.max(0, drivePlays - 8) * 0.003) -
          // Quick release helps relative to an average passer. Uncentered, this term took ~8
          // points off every dropback and cancelled the era sack rate (sacks ran 35-50% low).
          ((off.qb?.ratings.rel ?? 70) - 70) / 900,
        0.018,
        0.16,
      );
      const sacked = rand(save) < sackP;
      if (sacked) {
        const sackEscapeP = clamp(0.08 + (off.qb?.ratings.agi ?? 50) / 500 + off.kit.scramble / 180, 0.08, 0.65);
        const qb = off.qb;
        const mobileQb =
          qb &&
          (qb.abilities.includes("Scrambler") ||
            qb.arch === "scrambler" ||
            (qb.ratings.speed >= 74 && qb.ratings.agi >= 70));
        if (qb && mobileQb && rand(save) < sackEscapeP) {
          const yds = sampleYds(save, 7 + qb.ratings.speed / 20, 4, 1, 28);
          if (resolveScramble(yds)) break;
          continue;
        }
        const loss = sampleYds(save, 6.3, 2, 3, 14);
        if (cur) cur.sackYards = -loss;
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { sacksThrown: 1, sackYdsLost: loss });
        const rusher = pickRusherDef(save, def, defClub?.defScheme);
        // Since 1982 two men who get there together split it: half a sack each.
        const helper = year >= 1982 && rusher && rand(save) < 0.14 ? pickRusherDef(save, def, defClub?.defScheme) : undefined;
        if (rusher && helper && helper.id !== rusher.id) {
          bumpBox(boxOf(defId), rusher.id, { sacks: 0.5, tackles: 1, tfl: 1, qbHits: 1 });
          bumpBox(boxOf(defId), helper.id, { sacks: 0.5, tackles: 1, qbHits: 1 });
        } else if (rusher) bumpBox(boxOf(defId), rusher.id, { sacks: 1, tackles: 1, tfl: 1, qbHits: 1 });
        const edgeM = matchupOf("lt-edge", poss);
        if (logOn && rusher && edgeM && rusher.id === edgeM.defId) {
          const lt = save.players[edgeM.offId];
          note(`${playerName(rusher)} wins the edge${lt ? ` against ${playerName(lt)}` : ""}.`);
          cue("matchup");
        }
        const used = snapClock(save, plan, year, q, clock, trail, true, false, false, false);
        tickClock(poss, Math.max(used.used, 18));
        drivePlays += 1;
        driveYds -= loss;
        spot = Math.max(0, spot - loss);
        lastRun = false;
        if (was3rd) mark3rd(poss, false);
        if (spot <= 0) {
          addPts(defId, 2);
          markSafety(defId);
          note("Safety. The pocket collapsed in the end zone.");
          closeDrive("safety");
          kickoffTo(defId, false, "free");
          if (ot) break;
          continue;
        }
        const fumP = Math.max(0.02, 0.05 + (off.qb ? kitBoost(off.qb, "fum") : 0) + (wx === "rain" || wx === "snow" ? 0.03 : 0));
        if (rand(save) < fumP) {
          if (rusher) bumpBox(boxOf(defId), rusher.id, { ff: 1 });
          const lost = rand(save) < 0.52;
          if (lost) {
            if (rusher) bumpBox(boxOf(defId), rusher.id, { fr: 1 });
            markTo(poss);
            if (rand(save) < 0.06 * big) {
              if (rusher) bumpBox(boxOf(defId), rusher.id, { defTd: 1 });
              addPts(defId, 6);
              note("Strip-sack, house.");
              extraPoint(defId);
              closeDrive("fumble");
              kickoffTo(poss, false);
              if (ot) break;
              continue;
            }
            closeDrive("fumble");
            flipPoss(100 - spot);
          } else {
            if (off.qb) bumpBox(boxOf(poss), off.qb.id, { fr: 1 });
            down += 1;
            togo += loss;
            if (down > 4) {
              closeDrive("downs");
              flipPoss(100 - spot);
            }
          }
          continue;
        }
        down += 1;
        togo += loss;
        if (down > 4) {
          closeDrive("downs");
          flipPoss(100 - spot);
        }
        continue;
      }

      // A mobile passer can turn a non-sack dropback into a scramble. This is separate from RB
      // handoffs and scales with real quarterback mobility and the era's observed run tendency.
      if (off.qb) {
        const mobility =
          eraQbCarryShare(year) * 0.35 +
          Math.max(0, off.qb.ratings.speed - 60) * 0.001 +
          Math.max(0, off.qb.ratings.agi - 60) * 0.0013 +
          Math.max(0, off.kit.scramble) / 500 -
          (off.qb.traits.includes("Pocket statue") ? 0.06 : 0);
        if (rand(save) < clamp(mobility, 0.008, 0.18)) {
          const yds = sampleYds(
            save,
            era.ypc + 1 + (off.qb.ratings.speed - 60) / 20 + (off.qb.ratings.agi - 60) / 40,
            4.5,
            -3,
            32,
          );
          if (resolveScramble(yds)) break;
          continue;
        }
      }

      if (rand(save) < pens.pi && (call === "deep" || call === "med")) {
        const rec = pickRec(save, off, true, year, spot >= 80);
        const raw = dpiIsSpot(year) && call === "deep" ? randInt(save, 15, 34) : 15;
        const yds = halfDist(spot, raw, false);
        addPen(defId, yds);
        const thief = pickThief(save, def);
        if (thief) bumpBox(boxOf(defId), thief.id, { pd: 1 });
        spot = clamp(spot + yds, 1, 99);
        driveYds += yds;
        drivePlays += 1;
        clock = Math.max(0, clock - 8);
        addFd(poss);
        newSet();
        lastRun = false;
        if (was3rd) mark3rd(poss, true);
        if (rec) note(`Pass interference. ${playerName(rec)} would have had it.`);
        continue;
      }
      if (rand(save) < pens.contact && year >= 1978) {
        addPen(defId, 5);
        spot = clamp(spot + 5, 1, 99);
        driveYds += 5;
        drivePlays += 1;
        clock = Math.max(0, clock - 5);
        addFd(poss);
        newSet();
        lastRun = false;
        if (was3rd) mark3rd(poss, true);
        continue;
      }

      const rec = pickRec(save, off, call === "deep" || call === "pa", year, spot >= 80);
      const acc = (off.qb?.ratings.throwAcc ?? 60) + (rec ? (rec.ratings.catch + rec.ratings.rrt) / 2 : 50);
      const cov = avg(def.db.map((p) => p.ratings.cov));
      // Pressure was tuned against the sack chance before its release term was centered, which
      // raised sackP by ~0.057 across the board; back that out so pressure keeps its calibration.
      const hurryP = clamp((sackP - 0.057) * 1.7 + 0.06 + pressure, 0.05, 0.32);
      const hurried = rand(save) < hurryP;
      if (hurried) {
        const hitter = pickRusherDef(save, def, defClub?.defScheme);
        if (hitter) bumpBox(boxOf(defId), hitter.id, { qbHits: 1 });
      }
      let cmpP =
        era.cmpPct + pressure - (plan.protection === "maxProtect" ? 0.025 : 0) +
        // Elite passers sit a little closer to the league than a raw grade gap implies:
        // at /400 the best QBs ran 9-13% past real passing leaders at an on-target league rate.
        (acc - passAnchor(save)) / 470 +
        off.kit.cmp +
        edge / 380 -
        (call === "deep" ? 0.16 : call === "med" ? 0.05 : call === "pa" ? 0.03 : 0) -
        (hurried ? 0.08 : 0) -
        (prevent ? -0.04 : 0);
      if (call === "screen") cmpP += 0.12;
      if (wx === "rain" || wx === "snow") cmpP -= 0.05;
      if (wx === "wind" && call === "deep") cmpP -= 0.06;
      if (year < 1978) cmpP -= Math.max(0, cov - 74) / 400;
      // The early 70s were the low point for completions (51% in 1970), below even the late 60s.
      if (year >= 1970 && year <= 1972) cmpP -= 0.03;
      if (was3rd && togo >= 7) cmpP -= 0.07;
      // Tight windows near the goal line separate the passers: the great ones still find a man.
      // The squeeze on completions stays small (the field shrinks either way); how much a trip
      // finishes is mostly the run game's and the gain's.
      if (spot >= 80) cmpP -= 0.04 + Math.max(-0.12, redZoneSqueeze(year)) - ((off.qb?.ratings.throwAcc ?? 70) - 72) / 260;
      if (tightCatchRule(year) && (call === "deep" || call === "med")) cmpP -= 0.02;
      // The top corner follows the No. 1 receiver; that one-on-one counts a little more.
      const shadow = matchupOf("wr-cb", poss);
      const shadowed = !!rec && pairOn(shadow) && rec.id === shadow.offId;
      const cover = shadowed ? def.db.find((p) => p.id === shadow!.defId) ?? def.db[0] : def.db[0];
      if (rec && cover) {
        const mismatch = (rec.ratings.speed + rec.ratings.rrt) / 2 - (cover.ratings.cov + cover.ratings.speed) / 2;
        cmpP += mismatch / (shadowed ? 340 : 420);
      }
      if (spot >= 80) cmpP += focusOf(poss, "redZone") * 0.015;
      cmpP += soft * 0.05 - vanilla * 0.08;
      cmpP = clamp(cmpP, 0.3, year <= 1969 ? 0.64 : year < 2000 ? 0.78 : 0.82);
      let intP =
        era.intRate *
          (call === "deep" ? 1.85 : call === "med" ? 1.2 : call === "pa" ? 0.95 : call === "screen" ? 0.5 : 0.95) +
        off.kit.int * 0.35 +
        def.kit.int * 0.35;
      // Decision-making moves a passer's pick rate, but within the range real passers live in:
      // at /380 a poor decision-maker nearly doubled it and threw 40-50 a year.
      intP += (70 - (off.qb?.ratings.throwAwr ?? 70)) / 620 - 0.005;
      if (hurried) intP += 0.014;
      if (wx === "rain") intP += 0.012;
      if (wx === "wind" && call === "deep") intP += 0.008;
      // Real 60s passers threw ~1.7 picks a game (6% of throws); the sim ran ~1.25.
      if (year <= 1969) intP += 0.02;
      intP += qbCliff(save, poss, off.qb);
      intP *= intTaper(off.qb, year);
      intP -= focusOf(poss, "ballSecurity") * 0.003;
      intP = clamp(intP, 0.018, 0.11);
      const roll = rand(save);
      if (rec) bumpBox(boxOf(poss), rec.id, { targets: 1 });
      if (roll < intP) {
        if (maybeOverturn(save, year)) {
          note("The booth takes a look. Incomplete.");
          if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1 });
          const used = snapClock(save, plan, year, q, clock, trail, false, true, false, false);
          tickClock(poss, used.used);
          drivePlays += 1;
          lastRun = false;
          if (was3rd) mark3rd(poss, false);
          down += 1;
          if (down > 4) {
            closeDrive("downs");
            flipPoss(100 - spot);
          }
          continue;
        }
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1, passInt: 1 });
        const thief = pickThief(save, def);
        if (thief) bumpBox(boxOf(defId), thief.id, { ints: 1 });
        const used = snapClock(save, plan, year, q, clock, trail, false, true, false, false);
        tickClock(poss, used.used);
        drivePlays += 1;
        lastRun = false;
        if (was3rd) mark3rd(poss, false);
        markTo(poss);
        const retYds = sampleYds(save, 8, 8, 0, 42);
        // Interception returns scored far more often before the 80s (open field, slower QBs).
        const pickSix = rand(save) < (year <= 1977 ? 0.14 : 0.09) * big * ((thief?.ratings.speed ?? 70) / 85);
        if (thief) note(`${playerName(thief)} jumps it.`);
        if (logOn && thief && shadowed && thief.id === cover?.id && rec) {
          note(`${playerName(thief)} wins that one against ${playerName(rec)}.`);
          cue("matchup");
        }
        if (pickSix && thief) {
          bumpBox(boxOf(defId), thief.id, { defTd: 1 });
          addPts(defId, 6);
          note(`${playerName(thief)} the other way. Pick-six.`);
          closeDrive("int");
          extraPoint(defId);
          kickoffTo(poss, false);
          if (ot) break;
          continue;
        }
        closeDrive("int");
        if (spot >= 98) flipPoss(20);
        else flipPoss(clamp(100 - (spot + retYds), 1, 99));
        continue;
      }
      if (roll < intP + (1 - cmpP)) {
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1 });
        const t = pickTackler(save, def, true);
        if (t && rand(save) < 0.45) bumpBox(boxOf(defId), t.id, { pd: 1 });
        const used = snapClock(save, plan, year, q, clock, trail, false, true, false, false);
        tickClock(poss, used.used);
        drivePlays += 1;
        lastRun = false;
        if (was3rd) mark3rd(poss, false);
        tryTimeout(poss, false);
        down += 1;
        if (down > 4) {
          closeDrive("downs");
          flipPoss(100 - spot);
        }
        continue;
      }

      const mu =
        call === "deep" || call === "pa"
          ? 20 + (off.qb?.ratings.throwPow ?? 70) / 22 + (pa ? 3 : 0)
          : call === "med"
            ? 12
            : call === "screen"
              ? 6
              : 7;
      const hi = call === "deep" || call === "pa" ? Math.round(48 * (0.75 + 0.25 * big)) : 22;
      let yds = sampleYds(save, mu + edge / 34, call === "deep" ? 7 : 4, call === "deep" ? 11 : 2, hi);
      // Yards after the catch: now and then the receiver breaks it, and some of those go the
      // distance (real: about one completion in forty goes for 40 or more).
      if (rec && rand(save) < (rec.ratings.speed / 1700) * big * brake) {
        yds += randInt(save, 8, Math.round(28 * big + 6));
        if (rand(save) < 0.4) yds += randInt(save, 10, 45);
      }
      // Third and long: the defense sits on the sticks (looser before the 80s' sub packages).
      if (was3rd && togo >= 6) yds = Math.round(yds * (year <= 1977 ? 1 : year <= 1989 ? 0.94 : 0.88));
      // A passer on a record pace sees the coverage roll his way: fewer chunk gains.
      yds = Math.round(yds * passGainScale(year) * passTaper(seasonPace(off.qb, "passYds", year), leaderPace(year).pass, careerYear(off.qb, year)));
      // In the red zone the field runs out: the catch is at most the end zone. (Scaled first, so
      // a ball thrown into the end zone isn't shrunk back to the two after it got there.)
      if (spot >= 80) yds = Math.min(yds, Math.max(2, 100 - spot - (rand(save) < 0.15 ? 1 : 0)));
      yds = pinAtGoal(save, spot, yds, year, brake, true);
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1, passCmp: 1, passYds: yds });
      if (rec) bumpBox(boxOf(poss), rec.id, { rec: 1, recYds: yds });
      if (logOn && shadowed && rec && cover && yds >= 18) {
        const n = (matchupSaid[rec.id] = (matchupSaid[rec.id] ?? 0) + 1);
        note(n === 1 ? `${playerName(rec)} gets behind ${playerName(cover)}. That's the matchup they circled.` : `${playerName(rec)} beats ${playerName(cover)} again.`);
        cue("matchup");
      }
      const t = pickTackler(save, def, true);
      if (t) bumpBox(boxOf(defId), t.id, { tackles: 1 });
      const sideline = call === "deep" || ((q === 2 || q >= 4) && clock <= 120 && (trail >= 1 || q === 2));
      const oob = rand(save) < (sideline ? 0.42 : 0.16);
      const used = snapClock(save, plan, year, q, clock, trail, true, oob, yds >= togo, false);
      tickClock(poss, used.used);
      drivePlays += 1;
      driveYds += yds;
      spot = clamp(spot + yds, 0, 100);
      lastRun = false;
      if (was3rd) mark3rd(poss, yds >= togo || spot >= 100);
      if (spot >= 100) {
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passTd: 1 });
        if (rec) bumpBox(boxOf(poss), rec.id, { recTd: 1 });
        const line = rec
          ? rec.ratings.speed >= 88
            ? `${playerName(rec)} takes it the distance.`
            : `${off.qb ? playerName(off.qb) : "The quarterback"} hits ${playerName(rec)} — freeze-frame, six.`
          : "Touchdown pass.";
        scoreTd(poss, line);
        if (ot && otRule.kind === "sudden") break;
        continue;
      }
      // The catcher's own ball security, not the whole receiving corps' traits summed.
      const fumP = Math.max(0.002, 0.009 + (rec ? kitBoost(rec, "fum") : 0) + (wx === "rain" || wx === "snow" ? 0.01 : 0) - focusOf(poss, "ballSecurity") * 0.001);
      if (rand(save) < fumP) {
        if (t) bumpBox(boxOf(defId), t.id, { ff: 1 });
        const lost = rand(save) < 0.5;
        if (lost && maybeOverturn(save, year)) {
          note("Replay. He was down.");
        } else if (lost) {
          if (t) bumpBox(boxOf(defId), t.id, { fr: 1 });
          markTo(poss);
          closeDrive("fumble");
          if (spot >= 100) flipPoss(20);
          else flipPoss(100 - spot);
        }
        continue;
      }
      if (yds >= togo) {
        addFd(poss);
        newSet();
        tryTimeout(poss, !used.stopped && (trail >= 1 || (q === 2 && clock <= 120) || (q >= 5 && clock <= 120)), used.used);
        tryDefTimeout(defId, !used.stopped, used.used);
      } else {
        down += 1;
        togo -= yds;
        if (down > 4) {
          closeDrive("downs");
          flipPoss(100 - spot);
        }
      }
      injure(poss, rec);
      continue;
    }

    const rusher = pickRusher(save, off, down === 3 && togo >= 5, year, call, spot >= 95 || call === "sneak", (id) =>
      boxOf(poss).find((b) => b.playerId === id)?.rushAtt ?? 0,
    );
    let mu = era.ypc + edge / 28 + ((rusher?.ratings.btk ?? 60) + (rusher?.ratings.elu ?? 60) - rbAnchor(save)) / 80 - vanilla * 0.9 + soft * 0.5;
    if (rusher?.pos === "QB" && call !== "sneak") {
      // QB speed and agility were invisible to the old generic runner formula, making even a
      // true scrambler run like a slow halfback. Keep pocket passers' gains lower by the same
      // measure while rewarding real mobility.
      mu += (rusher.ratings.speed - 55) * 0.035 + (rusher.ratings.agi - 55) * 0.025;
    }
    if (rusher?.pos === "FB") mu += 0.45;
    const lane = matchupOf("rb-lb", poss);
    if (rusher && pairOn(lane) && rusher.id === lane.offId) mu += (lane.offGrade - lane.defGrade) / 90;
    // A back's legs go after twenty carries; the drop is steeper for one without stamina.
    const carries = rusher ? boxOf(poss).find((b) => b.playerId === rusher.id)?.rushAtt ?? 0 : 0;
    if (rusher?.pos === "RB" && carries > 20) mu -= (carries - 20) * 0.035 * (80 / Math.max(50, rusher.ratings.stamina));
    if (logOn && !freshLegs && rusher && rusher.id === off.rb2?.id && off.rb) {
      const lead = boxOf(poss).find((b) => b.playerId === off.rb!.id)?.rushAtt ?? 0;
      if (lead >= 16) {
        freshLegs = true;
        note(`Fresh legs: ${playerName(rusher)} spells ${playerName(off.rb)}, who has carried it ${lead} times.`);
      }
    }
    if (spot >= 80) mu += focusOf(poss, "redZone") * 0.12;
    if (call === "draw") mu += 0.8;
    if (call === "sneak") mu = 0.7 + (off.ol[2]?.ratings.str ?? 70) / 80 + sneakBoost(year);
    if (togo <= 1 && call !== "sneak") mu += 0.4;
    if (spot >= 95) mu *= 0.5;
    if (spot >= 80) mu *= 0.72 * (1 - redZoneSqueeze(year) * 2);
    if (spot >= 80 && plan.redZone === "power") mu += 0.25;
    if (was3rd && togo >= 5) mu -= year <= 1977 ? 0.3 : 0.7;
    // A run is mostly a few yards, with a real share of 10-to-15-yard pops (about one carry in
    // nine goes for 10+); the mean comes down a touch so yards per carry holds.
    // The rating and matchup terms lift the realized mean above the historical era baseline.
    // Hold the typical carry near league history; explosive runs below remain skill-weighted.
    let yds = sampleYds(save, call === "sneak" ? mu : mu - 0.55, call === "sneak" ? 1.2 : 3.6, call === "sneak" ? -1 : -4, call === "sneak" ? 4 : 17);
    // The era big-play curve is a passing-game story; long runs didn't get longer or more
    // common the way deep balls did, so ground breakaways stop scaling at the late-70s level.
    const runBig = Math.min(big, 0.72);
    if (call !== "sneak" && rusher && rand(save) < ((rusher.ratings.speed / 1500) * runBig + kitBoost(rusher, "td") * 0.2) * brake) {
      yds += randInt(save, 9, Math.round(32 * runBig + 6));
      // A few of those get to the second level clean and keep going (real: 40+ on about one
      // carry in two hundred).
      if (rand(save) < 0.18) yds += randInt(save, 12, 55);
    }
    yds = pinAtGoal(save, spot, yds, year, brake);
    if (rusher) {
      bumpBox(boxOf(poss), rusher.id, { rushAtt: 1, rushYds: yds });
      if (poss === homeId) homeRushYds += Math.max(0, yds);
      else awayRushYds += Math.max(0, yds);
    }
    const t = pickTackler(save, def, false);
    if (t) bumpBox(boxOf(defId), t.id, { tackles: 1, ...(yds < 0 ? { tfl: 1 } : {}) });
    const oob = rand(save) < 0.1;
    const used = snapClock(save, plan, year, q, clock, trail, true, oob, yds >= togo, false);
    tickClock(poss, used.used);
    drivePlays += 1;
    driveYds += yds;
    spot = clamp(spot + yds, 0, 100);
    lastRun = true;
    if (was3rd) mark3rd(poss, yds >= togo || spot >= 100);
    if (spot >= 100) {
      if (rusher) bumpBox(boxOf(poss), rusher.id, { rushTd: 1 });
      scoreTd(poss, rusher ? `${playerName(rusher)} north-south. Touchdown.` : "Rushing touchdown.");
      if (ot && otRule.kind === "sudden") break;
      continue;
    }
    if (spot <= 0) {
      addPts(defId, 2);
      markSafety(defId);
      closeDrive("safety");
      kickoffTo(defId, false, "free");
      if (ot) break;
      continue;
    }
    // Ball security is a small edge around the era's fumble rate. It used to subtract btk/2000
    // from a 1.1% base, so any back with a break-tackle rating over ~22 simply never fumbled.
    // Lost fumbles ran about 1.2 a team-game in the 70s, 1.0 in the 80s, 0.75 in the 2000s and
    // 0.55 now: this is most of them.
    const fumBase = year <= 1977 ? 0.04 : year <= 1989 ? 0.033 : year <= 2005 ? 0.026 : 0.02;
    const fumP = Math.max(
      0.003,
      fumBase + (rusher ? kitBoost(rusher, "fum") : 0) + (wx === "rain" || wx === "snow" ? 0.012 : 0) - (rusher ? (rusher.ratings.btk - 70) / 3000 : 0) -
        focusOf(poss, "ballSecurity") * 0.002,
    );
    if (rand(save) < fumP) {
      if (t) bumpBox(boxOf(defId), t.id, { ff: 1 });
      const lost = rand(save) < 0.48;
      if (rusher) note(`${playerName(rusher)} coughs it up.`);
      if (lost && maybeOverturn(save, year)) {
        note("The replay booth says down by contact.");
      } else if (lost) {
        if (t) bumpBox(boxOf(defId), t.id, { fr: 1 });
        markTo(poss);
        if (rand(save) < 0.05 * big) {
          if (t) bumpBox(boxOf(defId), t.id, { defTd: 1 });
          addPts(defId, 6);
          note("Fumble, the other way, six.");
          extraPoint(defId);
          closeDrive("fumble");
          kickoffTo(poss, false);
          if (ot) break;
          continue;
        }
        closeDrive("fumble");
        if (spot >= 100) flipPoss(20);
        else flipPoss(100 - spot);
      } else if (rusher) {
        bumpBox(boxOf(poss), rusher.id, { fr: 1 });
      }
      continue;
    }
    if (yds >= togo) {
      addFd(poss);
      newSet();
      tryTimeout(poss, !used.stopped && (trail >= 1 || (q === 2 && clock <= 120) || (q >= 5 && clock <= 120)), used.used);
      tryDefTimeout(defId, !used.stopped, used.used);
    } else {
      down += 1;
      togo -= yds;
      if (down > 4) {
        closeDrive("downs");
        flipPoss(100 - spot);
      }
    }
    injure(poss, rusher);
    if (off.qb && rusher?.id !== off.qb.id) injure(poss, off.qb);
  }

  if (homeScore === awayScore && (game.phase === "playoffs" || game.phase === "superBowl")) {
    addPts(teamNetYards(homeBox) >= teamNetYards(awayBox) ? homeId : awayId, 3);
    ot = true;
  }

  // These legacy draws used to add unearned tackles to a fixed group of linebackers and
  // safeties. Consume them without awarding stats so a stats-only correction does not shift
  // the saved deterministic simulation stream for subsequent games.
  const preserveTackleRolls = (u: TeamUnits) => {
    const candidates = [...u.lb.filter((l) => !(l.pos === "OLB" && l.arch === "edge")), ...u.db.filter((d) => d.pos === "S").slice(0, 1)].slice(0, 5);
    for (const _ of candidates) randInt(save, 0, 3);
  };
  preserveTackleRolls(homeU);
  preserveTackleRolls(awayU);

  // Season and career lines are regular season only, like the real record book. Playoff and
  // Super Bowl production goes on a separate postseason line; the Pro Bowl counts for neither.
  if (game.phase === "regular") {
    applyBox(save, homeId, homeBox, year);
    applyBox(save, awayId, awayBox, year);
  } else if (game.phase === "playoffs" || game.phase === "superBowl") {
    applyBox(save, homeId, homeBox, year, true);
    applyBox(save, awayId, awayBox, year, true);
  }
  const mvpSort = (b: BoxPlayer) =>
    (b.passYds ?? 0) +
    (b.rushYds ?? 0) * 1.1 +
    (b.recYds ?? 0) * 1.2 +
    (b.passTd ?? 0) * 40 +
    (b.rushTd ?? 0) * 40 +
    (b.recTd ?? 0) * 40 +
    (b.ints ?? 0) * 35 +
    (b.krTd ?? 0) * 50 +
    (b.prTd ?? 0) * 50 +
    (b.defTd ?? 0) * 50;
  const homeMvp = homeBox.slice().sort((a, b) => mvpSort(b) - mvpSort(a))[0];
  const awayMvp = awayBox.slice().sort((a, b) => mvpSort(b) - mvpSort(a))[0];
  const mvp = homeScore >= awayScore ? homeMvp : awayMvp;
  const ht = save.teams[homeId];
  game.played = true;
  game.callSheets = { home: { ...planFor(save, homeId) }, away: { ...planFor(save, awayId) } };
  game.homeScore = homeScore;
  game.awayScore = awayScore;
  game.boxHome = homeBox;
  game.boxAway = awayBox;
  game.weather = wx;
  game.highlights = highlights.slice(0, 8);
  game.homeQ = hq.slice(0, ot ? 5 : 4);
  game.awayQ = aq.slice(0, ot ? 5 : 4);
  while (game.homeQ.length < (ot ? 5 : 4)) game.homeQ.push(0);
  while (game.awayQ.length < (ot ? 5 : 4)) game.awayQ.push(0);
  game.mvpPlayerId = mvp?.playerId;
  game.homePoss = homePoss;
  game.awayPoss = awayPoss;
  game.homeFd = homeFd;
  game.awayFd = awayFd;
  game.homeTot = teamNetYards(homeBox);
  game.awayTot = teamNetYards(awayBox);
  game.ot = ot;
  stampDrives();
  flushPlay();
  playTap = undefined;
  if (logOn) game.log = log;
  if (userIn) {
    game.matchups = matchups;
    if (focus) game.practice = focus;
  }
  game.drives = drives.slice(0, 40);
  game.homePen = homePen;
  game.awayPen = awayPen;
  game.homePenYds = homePenYds;
  game.awayPenYds = awayPenYds;
  game.home3rd = home3rd;
  game.home3rdAtt = home3rdAtt;
  game.away3rd = away3rd;
  game.away3rdAtt = away3rdAtt;
  game.homeRz = homeRz;
  game.homeRzAtt = homeRzAtt;
  game.awayRz = awayRz;
  game.awayRzAtt = awayRzAtt;
  game.stadium = venue.stadium;
  game.surface = venue.turf ? "turf" : "grass";
  game.indoor = venue.indoor;
  game.attendance = attendanceFor(year, venue, ht?.wins ?? 0, !!game.rivalry, !!game.night, () => rand(save));
  if (!neutral && homeId === save.userTeamId) game.attendance = ownerCrowd(save, game, game.attendance, venue.capacity);
  game.homeTo = homeTo;
  game.awayTo = awayTo;
  game.homeSafeties = homeSafeties;
  game.awaySafeties = awaySafeties;
  game.neutral = neutral;
  if (crunchCalls.length) game.crunchCalls = crunchCalls;
  const filmBits = [
    bowl ? `Neutral site · ${bowl.site}` : null,
    wx !== "clear" ? wx : null,
    !neutral && noise >= 0.018 ? "loud house" : null,
    venue.altitude >= 4000 ? "thin air" : null,
    playoff ? "playoff football" : null,
    game.rivalry ? "divisional blood" : null,
  ].filter(Boolean);
  game.filmNote = filmBits.join(" · ") || undefined;
  checkGameRecords(save, game);
  ownerAfterGame(save, game);
  recordMeeting(save, game);

  if (!ht || !save.teams[awayId]) return;
  creditStandings(save, game);
  rollInjuries(save, homeId);
  rollInjuries(save, awayId);
}
