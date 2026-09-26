import type {
  BoxPlayer,
  DriveResult,
  DriveSummary,
  DynastySave,
  Gameplan,
  GameResult,
  Player,
  Pos,
  TeamId,
  SeasonStats,
  CrunchSituation,
} from "./types.ts";
import {
  clockStopFirstDown,
  dpiIsSpot,
  eraBigPlay,
  eraProfile,
  eraRb1Share,
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
} from "./era.ts";
import { clamp, rand, randInt } from "./rng.ts";
import { ARC_DATA_LAST } from "./careerArc.ts";
import { activeTeamIds, conferenceOf, divisionKey, gamesInSeason, originalLeague } from "./teams.ts";
import { emptyStats, playerName, rosterOf, starters, yearStats } from "./players.ts";
import { kitBoost, kitShare, kitInjMult } from "./abilities.ts";
import { coachKitBoost } from "./coachKit.ts";
import { maybeReveal } from "./scout.ts";
import { attendanceFor, bowlVenue, crowdNoise, pickWeather, venueOf, type VenueInfo, type Wx } from "./venues.ts";
import { proBowlSite, superBowlSite } from "./data/bowlSites.ts";
import { checkGameRecords } from "./records.ts";
import { ownerAfterGame, ownerCrowd, ownerNoise } from "./owner.ts";
import { recordMeeting } from "./h2h.ts";

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

export function defaultPlan(offScheme?: string): Gameplan {
  if (offScheme === "smashmouth") return { attack: "run", fourth: "conservative", tempo: "chew", blitz: "rare", redZone: "power" };
  if (offScheme === "vertical") return { attack: "pass", fourth: "normal", tempo: "hurry", blitz: "normal", redZone: "spread" };
  if (offScheme === "westcoast") return { attack: "pass", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced" };
  return { attack: "balanced", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced" };
}

export function planFor(save: DynastySave, teamId: TeamId): Gameplan {
  const t = save.teams[teamId];
  const base = defaultPlan(t?.offScheme);
  if (!t?.plan) return base;
  return {
    attack: t.plan.attack,
    fourth: t.plan.fourth,
    tempo: t.plan.tempo,
    blitz: t.plan.blitz ?? base.blitz,
    redZone: t.plan.redZone ?? base.redZone,
  };
}

export interface TeamUnits {
  qb?: Player;
  qb2?: Player;
  rb?: Player;
  rb2?: Player;
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

export function teamUnits(save: DynastySave, teamId: TeamId): TeamUnits {
  const qbs = starters(save, teamId, "QB", 2);
  const qb = qbs[0];
  const qb2 = qbs[1];
  const rbs = starters(save, teamId, "RB", 2);
  const rb = rbs[0];
  const rb2 = rbs[1];
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
  const skill = [qb, qb2, rb, rb2, fb, te, k, p, ...wr, ...ol, ...dl, ...lb, ...db];
  offPass += kitBoost(qb, "offPass") + wr.reduce((n, p) => n + kitBoost(p, "offPass"), 0) + kitBoost(te, "offPass") + ol.reduce((n, p) => n + kitBoost(p, "offPass"), 0);
  offRun += kitBoost(rb, "offRun") + kitBoost(fb, "offRun") + ol.reduce((n, p) => n + kitBoost(p, "offRun"), 0) + kitBoost(qb, "offRun");
  defPass += db.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + dl.reduce((n, p) => n + kitBoost(p, "defPass"), 0);
  defRun += dl.reduce((n, p) => n + kitBoost(p, "defRun"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defRun"), 0);
  offPass += coachKitBoost(coach, "offPass") + coachKitBoost(oc, "offPass") + (coach?.offense ?? 70) * 0.02;
  offRun += coachKitBoost(coach, "offRun") + coachKitBoost(oc, "offRun");
  defPass += coachKitBoost(coach, "defPass") + coachKitBoost(dc, "defPass") + (coach?.defense ?? 70) * 0.02;
  defRun += coachKitBoost(coach, "defRun") + coachKitBoost(dc, "defRun");
  const cands = [...wr, rb, rb2, fb, ...db].filter((x): x is Player => !!x);
  const returner = cands.slice().sort((a, b) => {
    const as = a.ratings.speed + (a.traits?.includes("Return man") ? 12 : 0);
    const bs = b.ratings.speed + (b.traits?.includes("Return man") ? 12 : 0);
    return bs - as;
  })[0];
  const kit = {
    cmp: kitBoost(qb, "cmp") + wr.reduce((n, p) => n + kitBoost(p, "cmp"), 0),
    sack: kitBoost(qb, "sack") + ol.reduce((n, p) => n + kitBoost(p, "sack"), 0) + dl.reduce((n, p) => n + kitBoost(p, "sack"), 0),
    int: kitBoost(qb, "int") + db.reduce((n, p) => n + kitBoost(p, "int"), 0),
    fum: kitBoost(rb, "fum") + kitBoost(qb, "fum") + wr.reduce((n, p) => n + kitBoost(p, "fum"), 0),
    td: kitBoost(qb, "td") + kitBoost(rb, "td") + wr.reduce((n, p) => n + kitBoost(p, "td"), 0),
    fg: kitBoost(k, "fg"),
    scramble: kitBoost(qb, "scramble"),
    clutch: skill.reduce((n, p) => n + kitBoost(p, "clutch"), 0) + coachKitBoost(coach, "clutch") + coachKitBoost(oc, "clutch") + coachKitBoost(dc, "clutch"),
    inj: skill.reduce((n, p) => n + kitBoost(p, "inj"), 0),
    pen: coachKitBoost(coach, "pen") + coachKitBoost(oc, "pen") + coachKitBoost(dc, "pen"),
  };
  return { qb, qb2, rb, rb2, fb, wr, te, ol, dl, lb, db, k, p, returner, offPass, offRun, defPass, defRun, kit };
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
  const era = eraProfile(year);
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
    s.krTd += b.krTd ?? 0;
    s.prTd += b.prTd ?? 0;
    if (postseason) continue;
    if (p.pos === "TE") s.rec = Math.min(s.rec, hardCap(era.teRecCap));
    else s.rec = Math.min(s.rec, hardCap(era.recCap));
    s.rushTd = Math.min(s.rushTd, hardCap(era.rushTdCap));
    s.passTd = Math.min(s.passTd, hardCap(era.passTdCap));
    s.passInt = Math.min(s.passInt, hardCap(era.intCap));
    s.sacks = Math.min(s.sacks, hardCap(era.sackCap));
  }
}

function bumpBox(box: BoxPlayer[], id: string | undefined, patch: Partial<BoxPlayer>): void {
  if (!id) return;
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

/**
 * Season ceilings. Each era's number sits at that era's real record. Usage starts to taper once
 * a player's pace passes 80% of it (defenses key on him, the staff spreads it around) and is
 * about halved by the time he reaches it, so the hard stop almost never binds. Without the taper
 * the clamp truncated seasons mid-stream - five receivers finishing on exactly 130 catches.
 */
function hardCap(eraRef: number): number {
  return eraRef;
}

function paceDamp(p: Player, key: "rec" | "sacks", year: number, eraRef: number): number {
  const s = p.stats[year];
  if (!s || s.gp < 3) return 1;
  const pace = (s[key] / s.gp) * gamesInSeason(year);
  const soft = eraRef * 0.8;
  if (pace <= soft) return 1;
  return clamp(1 - ((pace - soft) / (eraRef * 0.2)) * 0.55, 0.4, 1);
}

function pickRec(save: DynastySave, off: TeamUnits, deep: boolean, year: number, redZone: boolean): Player | undefined {
  const era = eraProfile(year);
  const w = eraTargetWeights(year);
  const slots: { p: Player | undefined; wt: number }[] = [
    { p: off.wr[0], wt: w.wr1 * (deep ? 1.1 : 1) * (redZone ? 0.9 : 1) },
    { p: off.wr[1], wt: w.wr2 },
    { p: off.wr[2], wt: w.wr3 * (deep ? 0.65 : 1.15) },
    { p: off.te, wt: w.te * (deep ? 0.55 : 1.15) * (redZone ? 1.35 : 1) },
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
        const skill = Math.pow((s.p.ratings.catch + yac) / 150, 0.3);
        const kit = 1 + Math.min(0.3, kitShare(s.p, "recShare") - 1) * 0.5;
        const pace = paceDamp(s.p, "rec", year, s.p.pos === "TE" ? era.teRecCap : era.recCap);
        return s.wt * skill * kit * pace;
      }),
    )
  ]!.p;
}

function pickRusher(
  save: DynastySave,
  off: TeamUnits,
  passingDown: boolean,
  year: number,
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
  const pool: { p: Player; w: number }[] = [];
  if (off.rb)
    pool.push({
      p: off.rb,
      w:
        (passingDown ? rb1 * 0.7 : rb1) *
        kitShare(off.rb, "rushShare") *
        (off.rb.ratings.stamina / 80) *
        workloadDamp(off.rb.id),
    });
  if (off.rb2) pool.push({ p: off.rb2, w: (passingDown ? 0.32 : 1 - rb1) * kitShare(off.rb2, "rushShare") });
  if (off.fb && (goal || !passingDown)) pool.push({ p: off.fb, w: goal ? (year <= 1995 ? 0.22 : 0.08) : year <= 1995 ? 0.12 : 0.05 });
  if (off.qb && (off.kit.scramble > 6 || goal)) pool.push({ p: off.qb, w: goal ? 0.08 + off.kit.scramble / 180 : 0.03 + off.kit.scramble / 220 });
  if (!pool.length) return off.qb;
  return pool[dist(save, pool.map((x) => x.w))]!.p;
}

function pickTackler(save: DynastySave, def: TeamUnits, pass: boolean): Player | undefined {
  const pool = pass ? [...def.db, ...def.lb, ...def.dl] : [...def.lb, ...def.dl, ...def.db];
  if (!pool.length) return undefined;
  return pool[dist(save, pool.map((p) => (p.ratings.tak + p.ratings.pur) * (pass ? p.ratings.cov / 80 : 1)))];
}

function pickRusherDef(save: DynastySave, def: TeamUnits): Player | undefined {
  const pool = [...def.dl, ...def.lb];
  if (!pool.length) return undefined;
  const ref = eraProfile(save.year).sackCap;
  // Sacks lean toward the true edge rushers (a real sack leader takes ~35-40% of his team's
  // total). Linear on pass-rush grade spread them almost evenly; cubed, once league sacks were
  // at real rates, gave the top rusher over half of them (Dent 232 career, seasons stuck at 22).
  return pool[
    dist(
      save,
      pool.map((p) => Math.pow(p.ratings.prs / 70, 2) * kitShare(p, "sackShare") * paceDamp(p, "sacks", save.year, ref)),
    )
  ];
}

function pickThief(save: DynastySave, def: TeamUnits): Player | undefined {
  const pool = [...def.db, ...def.lb];
  if (!pool.length) return undefined;
  return pool[dist(save, pool.map((p) => (p.ratings.cov + p.ratings.catch * 0.35 + p.ratings.awareness * 0.2) * kitShare(p, "intShare")))];
}

function fgRange(k: Player | undefined, year: number, altitude: number): number {
  const pow = k?.ratings.kickPow ?? 70;
  const air = altitude >= 4000 ? 4 : 0;
  return Math.round((38 + (pow - 70) * 0.55 + air) * (year <= 1973 ? 0.92 : 1));
}

function fgMakeP(k: Player | undefined, distYds: number, wx: Wx, year: number, clutch: number, altitude: number): number {
  const acc = k?.ratings.kickAcc ?? 70;
  const pow = k?.ratings.kickPow ?? 70;
  let p = 0.97 - Math.max(0, distYds - 28) * 0.018;
  p += (acc - 74) / 220;
  p += hashFgMod(year);
  if (altitude >= 4000) p += 0.04;
  if (distYds > 48) p -= (distYds - 48) * 0.03;
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
  lastRun: boolean,
  scramble: number,
  altitude: number,
): Call {
  const late = q >= 4 && clock <= 180;
  const last = q >= 4 && clock <= 40;
  const desperate = late && trail >= 3;
  const chew = (plan.tempo === "chew" || (q >= 4 && trail <= -7 && clock < 240)) && !desperate;
  const twoMin = (q === 2 || q >= 4) && clock <= 120;
  if (q >= 4 && trail <= -1 && clock <= 90 && spot > 35 && toLeft === 0 && down !== 4) {
    if (clock <= 12 && down <= 2) return "kneel";
    if (clock <= 40) return "kneel";
  }
  if (last && trail >= 1 && down <= 2 && clock <= 8) return "spike";
  if (down === 4) {
    const fgDist = 100 - spot + 17;
    const range = fgRange(k, year, altitude) + (wx === "wind" || wx === "snow" ? -6 : 0);
    const goP =
      0.04 +
      fourthGoBias(year) +
      (plan.fourth === "aggressive" ? 0.14 : plan.fourth === "conservative" ? -0.1 : 0);
    const short = togo <= 1;
    const mid = spot >= 55 && spot < 70;
    const go =
      (plan.fourth === "aggressive" && togo <= 3 && spot >= 55) ||
      (plan.fourth === "normal" && togo <= 1 && spot >= 60) ||
      (desperate && spot >= 42 && togo <= 8) ||
      spot >= 97 ||
      (last && trail > 0 && spot >= 50) ||
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
  if (plan.attack === "pass") passW += 0.08;
  if (plan.attack === "run") passW -= 0.09;
  if (down === 3 && togo >= 6) passW += 0.22;
  if (down === 3 && togo <= 2) passW -= 0.18;
  if (down === 2 && togo <= 3) passW -= 0.08;
  if (spot >= 95 && plan.redZone === "power") passW -= 0.07;
  // Red-zone offense moved to the air over the decades: by the 2010s most TDs inside the 20 were passes.
  if (spot >= 80) passW += year >= 2010 ? 0.2 : year >= 2000 ? 0.08 : year >= 1990 ? 0.04 : 0;
  if (spot >= 90 && plan.redZone === "spread") passW += 0.05;
  if (trail >= 8) passW += 0.12;
  if (trail <= -10 && !desperate) passW -= 0.1;
  if (chew) passW -= 0.1;
  if (wx === "snow" || wx === "rain") passW -= 0.08;
  if (wx === "wind") passW -= 0.04;
  if (desperate) passW += 0.18;
  if (twoMin && trail >= 1) passW += 0.16;
  passW = clamp(passW, 0.2, 0.8);
  if (rand(save) > passW) {
    if (down === 3 && togo >= 6 && rand(save) < 0.22) return "draw";
    if (spot >= 99) return "sneak";
    return "run";
  }
  if (last && trail >= 3 && spot < 65) return "deep";
  if (twoMin && trail >= 1 && togo >= 8) return rand(save) < 0.4 ? "deep" : "med";
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
  const hurry = plan.tempo === "hurry" || (q >= 4 && trail >= 4 && clock <= 240);
  const chew = plan.tempo === "chew" && trail <= 0 && !(q >= 4 && clock <= 180 && trail >= 1);
  const stopFd = clockStopFirstDown(year) && firstDown;
  const stopped = oob || !complete || spiked || stopFd || twoMin && oob;
  if (spiked) return { used: 3, stopped: true };
  if (oob || !complete) return { used: hurry || twoMin ? randInt(save, 4, 7) : randInt(save, 6, 9), stopped: true };
  if (stopFd) return { used: randInt(save, 6, 9), stopped: true };
  const [lo, hi] = huddleSeconds(year, hurry ? "hurry" : chew ? "chew" : "standard");
  return { used: randInt(save, lo, hi), stopped: false };
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
  if (p.pos === "QB") return year >= 2000 ? 1.6 : 1.35;
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
  p.injuredWeeks = durable ? 1 : p.ratings.inj >= 70 ? randInt(save, 1, 4) : randInt(save, 2, 7);
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
  if (year <= 1977) return -0.02;
  if (year <= 1989) return 0.005;
  if (year <= 2009) return 0.075;
  return 0.02;
}

function pinAtGoal(save: DynastySave, spot: number, yds: number, year: number, brake: number, pass = false): number {
  if (spot + yds < 100) return yds;
  // A catch across the stripe is six; getting dragged down at the one is a runner's fate far
  // more than a receiver's. Pinning passes as often as runs turned passing TDs into goal-line
  // rushing TDs (sim had ~2 rush TDs per pass TD; the real league is closer to 2 pass per rush).
  const dive = ((year <= 1969 ? 0.32 : year <= 1977 ? 0.22 : 0.14) + (1 - brake) * 0.25) * (pass ? 0.35 : 1);
  if (rand(save) < clamp(dive, pass ? 0.03 : 0.1, 0.55)) return Math.max(1, 99 - spot);
  return yds;
}

function deadBall(year: number, score: number): number {
  let m = 1;
  // Softer than it once was: this used to offset the extra snaps from a (college-only)
  // first-down clock stop. With real snap counts it just shaves the era's big plays.
  if (year <= 1969) m = 0.86;
  else if (year <= 1977) m = 0.88;
  else if (year <= 1989) m = 0.94;
  if (year <= 1969 && score >= 28) m *= 0.85;
  if (year <= 1977 && score >= 35) m *= 0.8;
  return m;
}

function homeTotYards(box: BoxPlayer[]): number {
  let pass = 0;
  let rush = 0;
  for (const b of box) {
    pass += b.passYds ?? 0;
    rush += b.rushYds ?? 0;
  }
  return pass + rush;
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
 * Real availability. A healthy sim plays its stars every week, but real stars missed time -
 * Montana and Unitas each played under 12 games a season. A real starter whose career games fall
 * short of the schedule gets an extra weekly injury risk sized so he misses about the share of
 * games he really missed (beyond what the sim's ordinary injuries already take).
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
  return h;
}

function rollInjuries(save: DynastySave, teamId: TeamId): void {
  const eraHit = save.year <= 1979 ? 0.016 : save.year <= 1999 ? 0.013 : 0.011;
  for (const p of rosterOf(save, teamId)) {
    if (p.injuredWeeks > 0) continue;
    const injMult = kitInjMult(p);
    const chance = eraHit * ((100 - p.ratings.inj) / 55) * injMult * posInjuryRisk(p, save.year) + arcHazard(p);
    if (rand(save) > chance) continue;
    const durable = p.ratings.inj >= 88 || injMult <= 0.8;
    const weeks = durable ? randInt(save, 1, 2) : p.ratings.inj >= 70 ? randInt(save, 1, 5) : randInt(save, 2, 8);
    p.injuredWeeks = weeks;
    p.injuryName = INJURIES[randInt(save, 0, INJURIES.length - 1)];
    p.injuredOn = { year: save.year, week: save.week, phase: save.phase };
  }
}

export function clampSeasonStats(save: DynastySave): void {
  const era = eraProfile(save.year);
  for (const p of Object.values(save.players)) {
    const s = p.stats[save.year];
    if (!s) continue;
    if (p.pos === "TE") s.rec = Math.min(s.rec, hardCap(era.teRecCap));
    else s.rec = Math.min(s.rec, hardCap(era.recCap));
    s.rushTd = Math.min(s.rushTd, hardCap(era.rushTdCap));
    s.passTd = Math.min(s.passTd, hardCap(era.passTdCap));
    s.passInt = Math.min(s.passInt, hardCap(era.intCap));
    s.sacks = Math.min(s.sacks, hardCap(era.sackCap));
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
  let modifiedFirst = true;
  let modifiedGotScore = false;
  const otRule = otRules(year, game.phase);
  const units: Record<string, TeamUnits> = { [homeId]: homeU, [awayId]: awayU };
  const boxOf = (id: TeamId) => (id === homeId ? homeBox : awayBox);
  const planNow = (id: TeamId, trail: number, qq: number, ck: number): Gameplan => {
    const base = planFor(save, id);
    if (qq >= 4 && trail >= 8 && ck <= 300) return { ...base, attack: "pass", fourth: "aggressive", tempo: "hurry" };
    if (qq >= 4 && trail <= -8 && ck <= 240) return { ...base, attack: "run", fourth: "conservative", tempo: "chew" };
    if (playoff && base.fourth === "aggressive" && trail > -3) return { ...base, fourth: "normal" };
    if (year <= 1979 && base.tempo === "hurry") return { ...base, tempo: "standard" };
    return base;
  };

  const note = (s: string) => {
    if (highlights.length < 12) highlights.push(s);
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
      throw new CrunchPause({ gameId: game.id, index: i, kind, q, clock, us, them, down, togo, spot, fgDist, options });
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
  const fatigue = (u: TeamUnits, qq: number, ck: number, id: TeamId) => {
    const late = qq >= 4 || (qq === 3 && ck < 240);
    const stam = avg([u.qb, u.rb, ...u.ol, ...u.dl].filter((x): x is Player => !!x).map((p) => p.ratings.stamina));
    let m = 1 - ((100 - stam) / 420) * (late ? 1.5 : 0.35);
    if (venue.altitude >= 4000 && id === awayId) m *= 0.93;
    return m;
  };

  let poss = rand(save) < 0.5 ? homeId : awayId;
  let spot = ko.tb;
  let down = 1;
  let togo = 10;
  let drivePlays = 0;
  let driveYds = 0;
  let driveStart = spot;
  let driveQ = 1;
  let driveRz = false;
  let lastRun = false;
  let plays = 0;
  let justScored = false;

  const closeDrive = (result: DriveResult) => {
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
    const next = teamUnits(save, id);
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
    units[id] = next;
  };

  const injure = (id: TeamId, p: Player | undefined) => {
    if (!p) return;
    if (!maybeInGameInjury(save, p, wx, venue.turf)) return;
    note(`${playerName(p)} is down. ${p.injuryName}.`);
    rebuild(id);
    const u = live(id);
    if (p.pos === "QB" && u.qb && u.qb.id !== p.id) {
      note(`${playerName(u.qb)} is in at quarterback.`);
    }
  };

  const tickClock = (id: TeamId, used: number) => {
    addPoss(id, used);
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
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      note("Kickoff out of bounds.");
      clock = Math.max(0, clock - 5);
      return;
    }
    if (rand(save) < tbChance + Math.max(0, hang - 62) / 90) {
      poss = receiving;
      spot = ko.tb;
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    const ret = ru.returner;
    if (fairCatchKickoff(year) && rand(save) < 0.32) {
      poss = receiving;
      spot = clamp(100 - Math.round(hang), 20, 40);
      down = 1;
      togo = 10;
      driveStart = spot;
      driveQ = q;
      drivePlays = 0;
      driveYds = 0;
      driveRz = false;
      return;
    }
    let yds = sampleYds(save, 20, 6, 4, 34);
    const house = 0.007 * big * (ret ? ret.ratings.speed / 80 : 0.6) * (ret?.traits?.includes("Return man") ? 1.6 : 1);
    if (rand(save) < house) yds = randInt(save, 88, 109);
    else if (ret && rand(save) < 0.04 * big) yds += randInt(save, 12, 28);
    if (ret) bumpBox(boxOf(receiving), ret.id, { krYds: Math.min(yds, 109) });
    const land = clamp(100 - Math.round(hang) + yds, 1, 100);
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
      const ok = rand(save) < clamp(twoPointMakeP(year) + (u.offPass - 70) / 220 + u.kit.td, 0.28, 0.58);
      if (ok) addPts(id, 2);
      justScored = true;
      return;
    }
    if (u.k) bumpBox(boxOf(id), u.k.id, { xpAtt: 1 });
    const xpYds = xpKickYards(year);
    const make = fgMakeP(u.k, xpYds, wx, year, 0, venue.altitude);
    const block = rand(save) < 0.012 + (live(id === homeId ? awayId : homeId).defPass - 70) / 900;
    const xp = !block && rand(save) < clamp(xpMakeBase(year) * (make / 0.9) + ((u.k?.ratings.kickAcc ?? 70) - 70) / 500 + u.kit.fg, 0.78, 0.99);
    if (xp) {
      addPts(id, 1);
      if (u.k) bumpBox(boxOf(id), u.k.id, { xpMade: 1 });
    } else if (block) {
      note("The extra point is blocked.");
    }
    justScored = true;
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

  const tryTimeout = (id: TeamId, running: boolean) => {
    if (!running) return;
    if (toOf(id) <= 0) return;
    const trail = trailOf(id);
    const twoMin = (q === 2 || q >= 4) && clock <= 120;
    if (twoMin && trail >= 1 && clock > 8) {
      spendTO(id);
    }
  };

  homeU.offPass += homeField;
  homeU.offRun += neutral ? 0 : 1.6;

  // Each drive's `after` score is stamped at the next snap, once the try and kickoff are done.
  let stamped = 0;
  const stampDrives = () => {
    for (; stamped < drives.length; stamped++) drives[stamped]!.after = [homeScore, awayScore];
  };
  while (plays < 260) {
    stampDrives();
    plays += 1;
    if (q === 2 || q === 4) {
      if (!warned && clock <= 120 && clock > 0) {
        warned = true;
        clock = 120;
      }
    }
    if (clock <= 0) {
      if (q === 1 || q === 3) {
        q += 1;
        clock = 900;
        warned = q === 2 || q === 4 ? false : warned;
        continue;
      }
      if (q === 2) {
        q = 3;
        clock = 900;
        warned = false;
        homeTO = 3;
        awayTO = 3;
        closeDrive("end");
        kickoffTo(poss === homeId ? awayId : homeId, false);
        continue;
      }
      if (q === 4 && !ot) {
        if (homeScore !== awayScore) break;
        if (otRule.kind === "none") break;
        ot = true;
        q = 5;
        clock = otRule.seconds;
        modifiedFirst = true;
        modifiedGotScore = false;
        closeDrive("end");
        kickoffTo(rand(save) < 0.5 ? homeId : awayId, false);
        continue;
      }
      if (q >= 5) {
        if (homeScore !== awayScore) break;
        if (game.phase === "regular" || game.phase === "preseason") break;
        q += 1;
        clock = 900;
        modifiedFirst = false;
        continue;
      }
      break;
    }

    const off = live(poss);
    const defId = poss === homeId ? awayId : homeId;
    const def = live(defId);
    const trail = trailOf(poss);
    const plan = planNow(poss, trail, q, clock);
    const fat = fatigue(off, q, clock, poss);
    const dfat = fatigue(def, q, clock, defId);
    const clutch = (q >= 4 && (trail > 0 || clock < 180) ? off.kit.clutch : 0) * 0.35;
    const was3rd = down === 3;
    if (spot >= 80 && !driveRz) {
      driveRz = true;
      if (poss === homeId) homeRzAtt += 1;
      else awayRzAtt += 1;
    }

    const offScore = poss === homeId ? homeScore : awayScore;
    const brake = deadBall(year, offScore);
    const garbage = q >= 4 && trail <= -17 && clock <= 360;
    const prevent = garbage && trail <= -17;
    const blitz =
      (plan.blitz === "heavy" ? 0.18 : plan.blitz === "rare" ? 0.05 : 0.1) +
      (down === 3 && togo >= 6 ? 0.08 : 0) +
      (def.kit.sack > 0 ? 0.02 : 0);

    const offU = poss === homeId ? homeU : awayU;
    const disc = Math.max(0.55, 1 + (offU.kit.pen ?? 0));
    const pre = pens.preSnap * disc + (poss === awayId && !neutral ? noise : 0);
    if (rand(save) < pre) {
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
      eraPassW + (garbage ? 0.12 : 0),
      plan,
      off.k,
      wx,
      toOf(poss),
      lastRun,
      off.kit.scramble,
      venue.altitude,
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
      const fgDist = 100 - spot + 17;
      const opts: CrunchSituation["options"] = [{ id: "go", label: `Go for it on 4th-and-${togo}` }];
      if (fgDist <= 58) opts.push({ id: "fg", label: `Kick the ${fgDist}-yard field goal` });
      if (spot < 72) opts.push({ id: "punt", label: "Punt it away" });
      const pick = ask("fourth", poss, opts, fgDist);
      if (pick === "go") call = togo <= 1 ? "sneak" : togo <= 2 ? "run" : "short";
      else if (pick === "fg") call = "fg";
      else if (pick === "punt") call = "punt";
    }

    if (call === "kneel") {
      const used = Math.min(clock, 40);
      tickClock(poss, used);
      drivePlays += 1;
      down += 1;
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { rushAtt: 1, rushYds: -1 });
      lastRun = true;
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
      const fgDist = 100 - spot + 17;
      if (off.k) bumpBox(boxOf(poss), off.k.id, { fgAtt: 1 });
      if (q >= 4 && clock <= 28 && toOf(defId) > 0 && rand(save) < 0.55) {
        spendTO(defId);
      }
      const blocked = rand(save) < 0.012 + (def.defRun - 72) / 800;
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
          flipPoss(Math.max(20, 100 - (spot + 7)));
        }
        continue;
      }
      if (make) {
        if (off.k) bumpBox(boxOf(poss), off.k.id, { fgMade: 1 });
        addPts(poss, 3);
        note(`${off.k ? playerName(off.k) : "The kicker"} from ${Math.round(fgDist)}. It's good.`);
        closeDrive("fg");
        if (ot && (otRule.kind === "sudden" || (otRule.kind === "modified" && !modifiedFirst && modifiedGotScore))) break;
        if (ot && otRule.kind === "modified" && modifiedFirst) {
          modifiedGotScore = true;
          modifiedFirst = false;
          kickoffTo(defId, false);
          continue;
        }
        const trailK = trailOf(poss);
        kickoffTo(defId, onsideCall(poss, q >= 4 && clock <= 150 && trailK >= 1 && trailK <= 8));
      } else {
        closeDrive("miss");
        flipPoss(Math.max(20, 100 - (spot + 7)));
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
    const offP = (pass ? off.offPass : off.offRun) * fat + clutch + sch + openScript + wear - (prevent ? 1.5 : 0);
    const defP = (pass ? def.defPass : def.defRun) * dfat + (blitz && pass ? 3.2 : 0) + (prevent && pass ? -2.4 : 0);
    const edge = offP - defP;

    if (pass) {
      const sackP = clamp(
        era.sackRate +
          (defP - off.offPass * fat) / 220 +
          off.kit.sack +
          (call === "deep" ? 0.02 : 0) +
          (blitz && rand(save) < 0.5 ? 0.03 : -0.01) -
          (pa ? 0.02 : 0) -
          // Quick release helps relative to an average passer. Uncentered, this term took ~8
          // points off every dropback and cancelled the era sack rate (sacks ran 35-50% low).
          ((off.qb?.ratings.rel ?? 70) - 70) / 900,
        0.018,
        0.16,
      );
      if (rand(save) < sackP) {
        const scram = (off.qb?.ratings.agi ?? 50) / 400 + off.kit.scramble / 140;
        if (off.kit.scramble > 6 && rand(save) < scram) {
          const yds = sampleYds(save, 7 + (off.qb?.ratings.speed ?? 50) / 20, 4, 1, 28);
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
            if (ot && otRule.kind !== "none") {
              if (otRule.kind === "sudden" || !modifiedFirst) break;
              modifiedGotScore = true;
              modifiedFirst = false;
            }
            continue;
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
          continue;
        }
        const loss = sampleYds(save, 6.3, 2, 3, 14);
        if (off.qb) bumpBox(boxOf(poss), off.qb.id, { sacksThrown: 1 });
        const rusher = pickRusherDef(save, def);
        if (rusher) bumpBox(boxOf(defId), rusher.id, { sacks: 1, tackles: 1, tfl: 1, qbHits: 1 });
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
      const hurryP = clamp((sackP - 0.057) * 1.7 + (blitz ? 0.06 : 0), 0.05, 0.32);
      const hurried = rand(save) < hurryP;
      if (hurried) {
        const hitter = pickRusherDef(save, def);
        if (hitter) bumpBox(boxOf(defId), hitter.id, { qbHits: 1 });
      }
      let cmpP =
        era.cmpPct +
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
      if (was3rd && togo >= 7) cmpP -= 0.07;
      if (spot >= 80) cmpP -= 0.04 + redZoneSqueeze(year);
      if (tightCatchRule(year) && (call === "deep" || call === "med")) cmpP -= 0.02;
      if (rec && def.db[0]) {
        const mismatch =
          (rec.ratings.speed + rec.ratings.rrt) / 2 - (def.db[0].ratings.cov + def.db[0].ratings.speed) / 2;
        cmpP += mismatch / 420;
      }
      cmpP = clamp(cmpP, 0.3, year <= 1969 ? 0.64 : year < 2000 ? 0.78 : 0.82);
      let intP =
        era.intRate *
          (call === "deep" ? 1.85 : call === "med" ? 1.2 : call === "pa" ? 0.95 : call === "screen" ? 0.5 : 0.95) +
        off.kit.int * 0.35 +
        def.kit.int * 0.35;
      intP += (70 - (off.qb?.ratings.throwAwr ?? 70)) / 380;
      if (hurried) intP += 0.014;
      if (wx === "rain") intP += 0.012;
      if (wx === "wind" && call === "deep") intP += 0.008;
      if (year <= 1969) intP += 0.008;
      intP += qbCliff(save, poss, off.qb);
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
        if (thief) bumpBox(boxOf(defId), thief.id, { ints: 1, tackles: 1 });
        const used = snapClock(save, plan, year, q, clock, trail, false, true, false, false);
        tickClock(poss, used.used);
        drivePlays += 1;
        lastRun = false;
        if (was3rd) mark3rd(poss, false);
        markTo(poss);
        const retYds = sampleYds(save, 8, 8, 0, 42);
        const pickSix = rand(save) < 0.09 * big * ((thief?.ratings.speed ?? 70) / 85);
        if (thief) note(`${playerName(thief)} jumps it.`);
        if (pickSix && thief) {
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
      if (rec && rand(save) < (rec.ratings.speed / 1700) * big * brake) yds += randInt(save, 8, Math.round(28 * big + 6));
      if (spot >= 80) yds = Math.min(yds, Math.max(2, 100 - spot - (rand(save) < 0.15 ? 1 : 0)));
      if (was3rd && togo >= 6) yds = Math.round(yds * 0.88);
      yds = Math.round(yds * passGainScale(year));
      yds = pinAtGoal(save, spot, yds, year, brake, true);
      if (off.qb) bumpBox(boxOf(poss), off.qb.id, { passAtt: 1, passCmp: 1, passYds: yds });
      if (rec) bumpBox(boxOf(poss), rec.id, { rec: 1, recYds: yds });
      const t = pickTackler(save, def, true);
      if (t) bumpBox(boxOf(defId), t.id, { tackles: 1 });
      const sideline = call === "deep" || ((q === 2 || q >= 4) && clock <= 120 && trail >= 1);
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
        if (ot && (otRule.kind === "sudden" || !modifiedFirst)) break;
        if (ot && otRule.kind === "modified") {
          modifiedGotScore = true;
          modifiedFirst = false;
        }
        continue;
      }
      // The catcher's own ball security, not the whole receiving corps' traits summed.
      const fumP = Math.max(0.002, 0.009 + (rec ? kitBoost(rec, "fum") : 0) + (wx === "rain" || wx === "snow" ? 0.01 : 0));
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
        tryTimeout(poss, !used.stopped && trail >= 1);
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

    const rusher = pickRusher(save, off, down === 3 && togo >= 5, year, spot >= 95 || call === "sneak", (id) =>
      boxOf(poss).find((b) => b.playerId === id)?.rushAtt ?? 0,
    );
    let mu = era.ypc + edge / 28 + ((rusher?.ratings.btk ?? 60) + (rusher?.ratings.elu ?? 60) - rbAnchor(save)) / 80;
    if (call === "draw") mu += 0.8;
    if (call === "sneak") mu = 0.7 + (off.ol[2]?.ratings.str ?? 70) / 80 + sneakBoost(year);
    if (togo <= 1 && call !== "sneak") mu += 0.4;
    if (spot >= 95) mu *= 0.5;
    if (spot >= 80) mu *= 0.72 * (1 - redZoneSqueeze(year) * 2);
    if (spot >= 80 && plan.redZone === "power") mu += 0.25;
    if (was3rd && togo >= 5) mu -= 0.7;
    let yds = sampleYds(save, mu, call === "sneak" ? 1.2 : 3.0, call === "sneak" ? -1 : -4, call === "sneak" ? 4 : 12);
    // The era big-play curve is a passing-game story; long runs didn't get longer or more
    // common the way deep balls did, so ground breakaways stop scaling at the late-70s level.
    const runBig = Math.min(big, 0.72);
    if (call !== "sneak" && rusher && rand(save) < ((rusher.ratings.speed / 1500) * runBig + kitBoost(rusher, "td") * 0.2) * brake) {
      yds += randInt(save, 9, Math.round(32 * runBig + 6));
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
      if (ot && (otRule.kind === "sudden" || !modifiedFirst)) break;
      if (ot && otRule.kind === "modified") {
        modifiedGotScore = true;
        modifiedFirst = false;
      }
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
    const fumBase = year <= 1977 ? 0.028 : year <= 1989 ? 0.024 : year <= 2005 ? 0.019 : 0.016;
    const fumP = Math.max(
      0.003,
      fumBase + (rusher ? kitBoost(rusher, "fum") : 0) + (wx === "rain" || wx === "snow" ? 0.012 : 0) - (rusher ? (rusher.ratings.btk - 70) / 3000 : 0),
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
      tryTimeout(poss, !used.stopped && trail >= 1);
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
    addPts(homeTotYards(homeBox) >= homeTotYards(awayBox) ? homeId : awayId, 3);
    ot = true;
  }

  const padTackles = (box: BoxPlayer[], u: TeamUnits) => {
    for (const p of [...u.lb, ...u.dl].slice(0, 5)) {
      bumpBox(box, p.id, { tackles: randInt(save, 0, 3) });
    }
  };
  padTackles(homeBox, homeU);
  padTackles(awayBox, awayU);

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
    (b.prTd ?? 0) * 50;
  const homeMvp = homeBox.slice().sort((a, b) => mvpSort(b) - mvpSort(a))[0];
  const awayMvp = awayBox.slice().sort((a, b) => mvpSort(b) - mvpSort(a))[0];
  const mvp = homeScore >= awayScore ? homeMvp : awayMvp;
  const ht = save.teams[homeId];
  game.played = true;
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
  game.homeTot = homeTotYards(homeBox);
  game.awayTot = homeTotYards(awayBox);
  game.ot = ot;
  stampDrives();
  game.drives = drives.slice(0, 32);
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
        creditCoachWl(save, homeId, "W");
        creditCoachWl(save, awayId, "L");
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
        creditCoachWl(save, awayId, "W");
        creditCoachWl(save, homeId, "L");
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
        creditCoachWl(save, homeId, "T");
        creditCoachWl(save, awayId, "T");
      }
    }
  }
  rollInjuries(save, homeId);
  rollInjuries(save, awayId);
}
