import type { BoxPlayer, DynastySave, GameResult, Player, TeamId } from "./types.ts";
import { eraProfile } from "./era.ts";
import { clamp, rand, randInt } from "./rng.ts";
import { conferenceOf, divisionKey, locationOf } from "./teams.ts";
import { playerName, rosterOf, starters, yearStats } from "./players.ts";
import { kitBoost, kitShare, kitInjMult } from "./abilities.ts";

function avg(ns: number[]): number {
  if (!ns.length) return 50;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

export interface TeamUnits {
  qb?: Player;
  rb?: Player;
  fb?: Player;
  wr: Player[];
  te?: Player;
  ol: Player[];
  dl: Player[];
  lb: Player[];
  db: Player[];
  k?: Player;
  p?: Player;
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
  };
}

export function teamUnits(save: DynastySave, teamId: TeamId): TeamUnits {
  const qb = starters(save, teamId, "QB", 1)[0];
  const rb = starters(save, teamId, "RB", 1)[0];
  const fb = starters(save, teamId, "FB", 1)[0];
  const wr = starters(save, teamId, "WR", 2);
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
  const db = [...starters(save, teamId, "CB", 2), ...starters(save, teamId, "S", 2)];
  const k = starters(save, teamId, "K", 1)[0];
  const p = starters(save, teamId, "P", 1)[0];
  const team = save.teams[teamId];
  const coach = team?.coachId ? save.coaches[team.coachId] : undefined;
  const oc = team?.ocId ? save.coaches[team.ocId] : undefined;
  const dc = team?.dcId ? save.coaches[team.dcId] : undefined;
  const passBlk = avg(ol.map((x) => x.ratings.passBlk));
  const runBlk = avg(ol.map((x) => x.ratings.runBlk));
  const recSkill = avg(
    [...wr, te].filter((x): x is Player => !!x).map((x) => (x.ratings.catch + x.ratings.rrt + x.ratings.cit) / 3),
  );
  const rushSkill = rb
    ? (rb.ratings.speed + rb.ratings.btk + rb.ratings.elu + rb.ratings.truck) / 4
    : 50;
  const passRush = avg(dl.map((x) => x.ratings.prs));
  const cov = avg(db.map((x) => x.ratings.cov));
  const tak = avg([...dl, ...lb].map((x) => (x.ratings.tak + x.ratings.pur) / 2));
  const offIq = ((qb?.ratings.throwAwr ?? 50) + (qb?.ratings.awareness ?? 50) + (oc?.offense ?? coach?.offense ?? 70)) / 3;
  const defIq = ((lb[0]?.ratings.awareness ?? 50) + (dc?.defense ?? coach?.defense ?? 70)) / 2;
  let offPass =
    (qb?.ratings.throwAcc ?? 50) * 0.32 +
    (qb?.ratings.throwAwr ?? 50) * 0.18 +
    (qb?.ratings.throwPow ?? 50) * 0.1 +
    recSkill * 0.18 +
    passBlk * 0.12 +
    offIq * 0.1;
  let offRun = rushSkill * 0.48 + runBlk * 0.32 + (rb?.ratings.awareness ?? 50) * 0.1 + offIq * 0.1;
  let defPass = cov * 0.4 + passRush * 0.32 + defIq * 0.16 + tak * 0.12;
  let defRun = tak * 0.42 + avg(dl.map((x) => x.ratings.str)) * 0.22 + defIq * 0.2 + passRush * 0.16;
  const scheme = team?.offScheme;
  if (scheme === "vertical") offPass += 3.5;
  if (scheme === "smashmouth") offRun += 3.5;
  if (scheme === "westcoast") offPass += 2;
  if (team?.defScheme === "cover-2") defPass += 2.5;
  if (team?.defScheme === "3-4") defRun += 2;
  const skill = [qb, rb, fb, te, k, p, ...wr, ...ol, ...dl, ...lb, ...db];
  offPass += kitBoost(qb, "offPass") + wr.reduce((n, p) => n + kitBoost(p, "offPass"), 0) + kitBoost(te, "offPass") + ol.reduce((n, p) => n + kitBoost(p, "offPass"), 0);
  offRun += kitBoost(rb, "offRun") + kitBoost(fb, "offRun") + ol.reduce((n, p) => n + kitBoost(p, "offRun"), 0) + kitBoost(qb, "offRun");
  defPass += db.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defPass"), 0) + dl.reduce((n, p) => n + kitBoost(p, "defPass"), 0);
  defRun += dl.reduce((n, p) => n + kitBoost(p, "defRun"), 0) + lb.reduce((n, p) => n + kitBoost(p, "defRun"), 0);
  const kit = {
    cmp: kitBoost(qb, "cmp") + wr.reduce((n, p) => n + kitBoost(p, "cmp"), 0),
    sack: kitBoost(qb, "sack") + ol.reduce((n, p) => n + kitBoost(p, "sack"), 0) + dl.reduce((n, p) => n + kitBoost(p, "sack"), 0),
    int: kitBoost(qb, "int") + db.reduce((n, p) => n + kitBoost(p, "int"), 0),
    fum: kitBoost(rb, "fum") + kitBoost(qb, "fum") + wr.reduce((n, p) => n + kitBoost(p, "fum"), 0),
    td: kitBoost(qb, "td") + kitBoost(rb, "td") + wr.reduce((n, p) => n + kitBoost(p, "td"), 0),
    fg: kitBoost(k, "fg"),
    scramble: kitBoost(qb, "scramble"),
    clutch: skill.reduce((n, p) => n + kitBoost(p, "clutch"), 0),
    inj: skill.reduce((n, p) => n + kitBoost(p, "inj"), 0),
  };
  return { qb, rb, fb, wr, te, ol, dl, lb, db, k, p, offPass, offRun, defPass, defRun, kit };
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

function applyBox(save: DynastySave, teamId: TeamId, box: BoxPlayer[], year: number): void {
  for (const b of box) {
    const p = save.players[b.playerId];
    if (!p) continue;
    const s = yearStats(p, year, teamId);
    s.gp += 1;
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
  }
}

type Wx = "clear" | "rain" | "wind" | "cold" | "snow";

function pickWeather(save: DynastySave, loc: string): Wx {
  const late = save.week >= 10;
  const north = /Green Bay|Chicago|Cleveland|Buffalo|Boston|Minneapolis|Pittsburgh|New York|Denver|Kansas City/.test(
    loc,
  );
  const r = rand(save);
  if (late && north && r < 0.16) return "snow";
  if (late && north && r < 0.34) return "cold";
  if (r < 0.12) return "rain";
  if (r < 0.2) return "wind";
  return "clear";
}

function bumpBox(box: BoxPlayer[], id: string, patch: Partial<BoxPlayer>): void {
  let row = box.find((b) => b.playerId === id);
  if (!row) {
    row = { playerId: id };
    box.push(row);
  }
  for (const [k, v] of Object.entries(patch)) {
    const key = k as keyof BoxPlayer;
    if (typeof v === "number") {
      const rec = row as unknown as Record<string, number>;
      rec[String(key)] = (rec[String(key)] ?? 0) + v;
    }
  }
}

function pickRec(save: DynastySave, off: TeamUnits): Player | undefined {
  const pool = [...off.wr, off.te, off.rb].filter((p): p is Player => !!p);
  if (!pool.length) return undefined;
  return pool[
    dist(
      save,
      pool.map((p) => (p.ratings.catch + p.ratings.rrt + p.ratings.speed * 0.35) * kitShare(p, "recShare")),
    )
  ];
}

function driveResult(
  save: DynastySave,
  off: TeamUnits,
  def: TeamUnits,
  era: ReturnType<typeof eraProfile>,
  trail: number,
  wx: Wx,
  qi: number,
): { kind: "td" | "fg" | "punt" | "int" | "fumble" | "safety"; pass: boolean; yds: number } {
  const clutch = (trail > 0 || qi === 3) ? off.kit.clutch : 0;
  const edge = (off.offPass + off.offRun - def.defPass - def.defRun) / 2 + clutch;
  let passW = era.passAtt / (era.passAtt + era.rushAtt);
  if (trail >= 8) passW += 0.14;
  if (trail <= -10) passW -= 0.1;
  if (wx === "snow" || wx === "rain") passW -= 0.08;
  if (wx === "wind") passW -= 0.04;
  if (off.kit.scramble > 8) passW += 0.02;
  passW = clamp(passW, 0.28, 0.72);
  const pass = rand(save) < passW;
  const unit = pass ? off.offPass - def.defPass : off.offRun - def.defRun;
  const success = 1 / (1 + Math.exp(-(unit + edge * 0.25 + clutch) / 16));
  let tdP = 0.14 + success * 0.16 + off.kit.td;
  let fgP = 0.12 + success * 0.12 + off.kit.fg * 0.4;
  let toP = 0.06 + (1 - success) * 0.07 + era.intRate * (pass ? 1.4 : 0.4) + (pass ? off.kit.int + def.kit.int : off.kit.fum);
  if (wx === "snow") {
    tdP *= 0.85;
    toP += 0.03;
  }
  if (wx === "wind") fgP *= 0.75;
  const r = rand(save);
  const intBand = Math.max(0.01, toP * 0.55 + (pass ? off.kit.int * 0.5 : 0));
  if (r < intBand) return { kind: "int", pass: true, yds: randInt(save, 8, 38) };
  if (r < toP + Math.max(0, off.kit.fum)) return { kind: "fumble", pass, yds: randInt(save, 6, 28) };
  if (r < toP + tdP) return { kind: "td", pass, yds: randInt(save, 55, 82) };
  if (r < toP + tdP + fgP) return { kind: "fg", pass, yds: randInt(save, 32, 58) };
  if (r < 0.015) return { kind: "safety", pass: false, yds: 0 };
  return { kind: "punt", pass, yds: randInt(save, 8, 36) };
}

function sideFromDrives(
  save: DynastySave,
  off: TeamUnits,
  def: TeamUnits,
  era: ReturnType<typeof eraProfile>,
  trailFn: () => number,
  wx: Wx,
  drives: number,
): { pts: number; box: BoxPlayer[]; ints: number; sacks: number; highlights: string[]; q: [number, number, number, number] } {
  const box: BoxPlayer[] = [];
  let pts = 0;
  let ints = 0;
  let sacks = 0;
  const highlights: string[] = [];
  const q: [number, number, number, number] = [0, 0, 0, 0];
  let passAtt = 0;
  let passCmp = 0;
  let passYds = 0;
  let passTd = 0;
  let rushAtt = 0;
  let rushYds = 0;
  let rushTd = 0;
  let fgAtt = 0;
  let fgMade = 0;
  let xpAtt = 0;
  let xpMade = 0;
  let punts = 0;
  let puntYds = 0;

  for (let d = 0; d < drives; d++) {
    const qi = Math.min(3, Math.floor((d / Math.max(1, drives)) * 4));
    const res = driveResult(save, off, def, era, trailFn() - pts, wx, qi);
    const plays = randInt(save, 3, 8);
    if (res.pass) {
      const att = Math.max(1, Math.round(plays * 0.7));
      const cmp = Math.max(0, Math.round(att * clamp(era.cmpPct + (off.offPass - def.defPass) / 400 + off.kit.cmp, 0.38, 0.72)));
      passAtt += att;
      passCmp += cmp;
      passYds += res.yds;
    } else {
      const att = Math.max(2, Math.round(plays * 0.75));
      rushAtt += att;
      rushYds += res.yds;
    }
    if (rand(save) < clamp(era.sackRate + off.kit.sack, 0.02, 0.16)) sacks += 1;

    if (res.kind === "td") {
      const xp = rand(save) < 0.94;
      const add = 6 + (xp ? 1 : 0);
      pts += add;
      q[qi] += add;
      xpAtt += 1;
      if (xp) xpMade += 1;
      if (res.pass) {
        passTd += 1;
        const rec = pickRec(save, off);
        if (rec) {
          bumpBox(box, rec.id, { rec: 1, recYds: Math.round(res.yds * 0.7), recTd: 1 });
          if (highlights.length < 8) {
            highlights.push(
              rec.ratings.speed >= 88
                ? `${playerName(rec)} takes it the distance. He could go all the way.`
                : `${off.qb ? playerName(off.qb) : "The quarterback"} hits ${playerName(rec)} — freeze-frame, sideline, six.`,
            );
          }
        }
      } else {
        rushTd += 1;
        if (off.rb && highlights.length < 8) {
          highlights.push(`${playerName(off.rb)} north-south, ${res.yds} yards worth of hurt. Touchdown.`);
        }
      }
    } else if (res.kind === "fg") {
      fgAtt += 1;
      const make = rand(save) < clamp((off.k?.ratings.kickAcc ?? 70) / 100 + off.kit.fg - (wx === "wind" || wx === "snow" ? 0.12 : 0), 0.55, 0.96);
      if (make) {
        fgMade += 1;
        pts += 3;
        q[qi] += 3;
      }
    } else if (res.kind === "int") {
      ints += 1;
      const thief = def.db[0] ?? def.lb[0];
      if (thief && highlights.length < 8) {
        highlights.push(
          kitBoost(thief, "intShare") > 0
            ? `${playerName(thief)} is a ball hawk. That's his football.`
            : `${playerName(thief)} jumps the route. Ballgame if they close it.`,
        );
      }
      if (off.qb && kitBoost(off.qb, "int") > 0 && highlights.length < 8) {
        highlights.push(`${playerName(off.qb)} threw it anyway. The gunslinger tax.`);
      }
    } else if (res.kind === "fumble") {
      if (off.rb) bumpBox(box, off.rb.id, { ff: 1 });
      if (off.rb && highlights.length < 8) {
        highlights.push(
          kitBoost(off.rb, "fum") > 0
            ? `${playerName(off.rb)} puts it on the carpet. The fumbler label sticks.`
            : `${playerName(off.rb)} coughs it up. The pigskin is live.`,
        );
      }
    } else if (res.kind === "safety") {
      pts += 0;
    } else {
      punts += 1;
      puntYds += randInt(save, 36, 52);
    }
  }

  if (off.qb) {
    bumpBox(box, off.qb.id, {
      passAtt,
      passCmp,
      passYds,
      passTd,
      passInt: ints,
      sacksThrown: sacks,
      rushAtt: Math.round(rushAtt * (0.08 + Math.max(0, off.kit.scramble) / 200)),
      rushYds: Math.round(rushYds * (0.06 + Math.max(0, off.kit.scramble) / 180)),
    });
  }
  if (off.rb) {
    bumpBox(box, off.rb.id, {
      rushAtt: Math.round(rushAtt * (off.fb ? 0.62 : 0.78) * (off.rb ? kitShare(off.rb, "rushShare") : 1)),
      rushYds: Math.round(rushYds * (off.fb ? 0.6 : 0.76) * (off.rb ? kitShare(off.rb, "rushShare") : 1)),
      rushTd: Math.max(0, rushTd - (off.fb && rushTd > 1 ? 1 : 0)),
      rec: Math.max(0, Math.round(passCmp * 0.12)),
      recYds: Math.round(passYds * 0.08),
    });
  }
  if (off.fb && rushAtt) {
    bumpBox(box, off.fb.id, {
      rushAtt: Math.round(rushAtt * 0.16),
      rushYds: Math.round(rushYds * 0.14),
      rushTd: rushTd > 1 ? 1 : 0,
    });
  }
  const recTargets = [...off.wr, off.te].filter((p): p is Player => !!p);
  let recLeft = Math.max(0, passCmp - Math.round(passCmp * 0.12));
  let ydsLeft = Math.max(0, passYds - Math.round(passYds * 0.08));
  let tdLeft = passTd;
  const wts = recTargets.map((p) => (p.ratings.catch + p.ratings.rrt + p.ratings.speed * 0.4) * kitShare(p, "recShare"));
  const wsum = Math.max(1, wts.reduce((a, b) => a + b, 0));
  for (let i = 0; i < recTargets.length; i++) {
    const share = wts[i]! / wsum;
    const rec = i === recTargets.length - 1 ? recLeft : Math.round(recLeft * share);
    const yds = i === recTargets.length - 1 ? ydsLeft : Math.round(ydsLeft * share);
    const td = i === recTargets.length - 1 ? tdLeft : Math.min(tdLeft, Math.round(tdLeft * share));
    recLeft -= rec;
    ydsLeft -= yds;
    tdLeft -= td;
    bumpBox(box, recTargets[i]!.id, { rec: Math.max(0, rec), recYds: Math.max(0, yds), recTd: Math.max(0, td) });
  }
  if (off.k) bumpBox(box, off.k.id, { fgMade, fgAtt, xpMade, xpAtt });
  if (off.p && punts) bumpBox(box, off.p.id, { punts, puntYds });
  return { pts, box, ints, sacks, highlights, q };
}

function defBox(save: DynastySave, def: TeamUnits, sacks: number, ints: number): BoxPlayer[] {
  const box: BoxPlayer[] = [];
  const rushers = [...def.dl, ...def.lb];
  for (let i = 0; i < sacks; i++) {
    if (!rushers.length) break;
    const idx = dist(
      save,
      rushers.map((p) => p.ratings.prs * kitShare(p, "sackShare")),
    );
    const p = rushers[idx]!;
    bumpBox(box, p.id, { sacks: 1, tackles: randInt(save, 1, 4) });
  }
  const dbs = [...def.db, ...def.lb];
  for (let i = 0; i < ints; i++) {
    if (!dbs.length) break;
    const idx = dist(
      save,
      dbs.map((p) => (p.ratings.cov + p.ratings.catch * 0.3) * kitShare(p, "intShare")),
    );
    bumpBox(box, dbs[idx]!.id, { ints: 1, tackles: randInt(save, 1, 4) });
  }
  for (const p of [...def.lb, ...def.dl, ...def.db].slice(0, 8)) {
    bumpBox(box, p.id, { tackles: randInt(save, 2, 8) });
  }
  return box;
}

export function simGame(save: DynastySave, game: GameResult): void {
  if (game.played) return;
  const year = save.year;
  const era = eraProfile(year);
  const homeId = game.homeId as TeamId;
  const awayId = game.awayId as TeamId;
  const loc = locationOf(year, homeId);
  const wx = pickWeather(save, loc);
  const homeU = teamUnits(save, homeId);
  const awayU = teamUnits(save, awayId);
  homeU.offPass += 2.2;
  homeU.offRun += 1.8;
  if (wx === "snow" || wx === "rain") {
    homeU.offPass -= 3;
    awayU.offPass -= 3;
    homeU.offRun += 1;
    awayU.offRun += 1;
  }
  const drives = 11 + randInt(save, 0, 3);
  const homeOff = sideFromDrives(save, homeU, awayU, era, () => 0, wx, drives);
  const awayOff = sideFromDrives(save, awayU, homeU, era, () => homeOff.pts, wx, drives);
  homeOff.pts += 1;
  if (homeOff.pts === awayOff.pts) {
    if (rand(save) < 0.72) homeOff.pts += 3;
    else awayOff.pts += 3;
  }
  const homeDef = defBox(save, homeU, awayOff.sacks, awayOff.ints);
  const awayDef = defBox(save, awayU, homeOff.sacks, homeOff.ints);
  game.homeScore = homeOff.pts;
  game.awayScore = awayOff.pts;
  game.played = true;
  game.boxHome = [...homeOff.box, ...homeDef];
  game.boxAway = [...awayOff.box, ...awayDef];
  game.weather = wx;
  game.homeQ = homeOff.q;
  game.awayQ = awayOff.q;
  game.highlights = [...homeOff.highlights, ...awayOff.highlights].slice(0, 5);
  game.attendance = randInt(save, 38_000, 76_000);
  game.mvpPlayerId =
    game.homeScore >= game.awayScore
      ? (homeOff.box[0]?.playerId ?? homeU.qb?.id)
      : (awayOff.box[0]?.playerId ?? awayU.qb?.id);
  applyBox(save, homeId, game.boxHome, year);
  applyBox(save, awayId, game.boxAway, year);

  const ht = save.teams[homeId];
  const at = save.teams[awayId];
  if (!ht || !at) return;
  ht.pf += game.homeScore;
  ht.pa += game.awayScore;
  at.pf += game.awayScore;
  at.pa += game.homeScore;
  const sameDiv = divisionKey(year, homeId) === divisionKey(year, awayId);
  const sameConf = conferenceOf(year, homeId) === conferenceOf(year, awayId);
  if (game.homeScore > game.awayScore) {
    ht.wins += 1;
    at.losses += 1;
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
  }
  rollInjuries(save, homeId);
  rollInjuries(save, awayId);
}

const INJURIES = ["ankle", "knee", "shoulder", "ribs", "hamstring", "hip", "hand", "shaken up", "concussion", "foot"];

function rollInjuries(save: DynastySave, teamId: TeamId): void {
  const eraHit = save.year <= 1979 ? 0.032 : save.year <= 1999 ? 0.024 : 0.02;
  for (const p of rosterOf(save, teamId)) {
    if (p.injuredWeeks > 0) continue;
    const injMult = kitInjMult(p);
    const chance = eraHit * ((100 - p.ratings.inj) / 55) * injMult;
    if (rand(save) > chance) continue;
    const durable = p.ratings.inj >= 88 || injMult <= 0.8;
    const weeks = durable
      ? randInt(save, 1, 2)
      : p.ratings.inj >= 70
        ? randInt(save, 1, 5)
        : randInt(save, 2, 8);
    p.injuredWeeks = weeks;
    p.injuryName = INJURIES[randInt(save, 0, INJURIES.length - 1)];
  }
}

export function clampSeasonStats(save: DynastySave): void {
  const era = eraProfile(save.year);
  for (const p of Object.values(save.players)) {
    const s = p.stats[save.year];
    if (!s) continue;
    if (p.pos === "TE") s.rec = Math.min(s.rec, era.teRecCap);
    else s.rec = Math.min(s.rec, era.recCap);
    s.rushTd = Math.min(s.rushTd, era.rushTdCap);
    s.passTd = Math.min(s.passTd, era.passTdCap);
    s.passInt = Math.min(s.passInt, era.intCap);
    s.sacks = Math.min(s.sacks, era.sackCap);
    if (!p.career) p.career = [];
    const existing = p.career.find((c) => c.year === save.year);
    if (!existing) p.career.push({ ...s });
  }
}
