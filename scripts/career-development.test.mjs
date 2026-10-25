import { test } from "node:test";
import assert from "node:assert/strict";
import { developCareerWeek, snapshotCareerWeek } from "../src/lib/game/careerDevelopment.ts";
import { arcRetiresNow } from "../src/lib/game/careerArc.ts";
import { shouldRetire } from "../src/lib/game/development.ts";
import { deriveOvr, emptyRatings } from "../src/lib/game/ratings.ts";
import { seasonArcs } from "../src/lib/game/storylines.ts";
import { coachDevelopmentFactor, developmentCoordinator } from "../src/lib/game/coachDevelopment.ts";

function palkoLikeSave() {
  const ratings = emptyRatings(65);
  ratings.throwAcc = 66;
  ratings.throwAwr = 62;
  const p = {
    id: "palko-test", firstName: "Tyler", lastName: "Palko", pos: "QB", teamId: "pit", ratings,
    ovr: deriveOvr("QB", ratings), scoutOvr: 60, potential: 66, morale: 76, revealed: true, snaps: 0,
    age: 25, yearsPro: 2, jersey: 7, historical: true, generated: false, userTied: true, peakOvr: 66,
    contractYears: 2, salary: 1, abilities: [], traits: [], injuredWeeks: 0, onIR: false, arc: { dy: 2007, to: 2012, st: 0, g: 2, pb: 0, ap: 0, age: 22 },
    stats: { 2010: { year: 2010, teamId: "pit", gp: 0, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, sacksThrown: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tackles: 0, sacks: 0, ints: 0, ff: 0, fgAtt: 0, fgMade: 0, xpAtt: 0, xpMade: 0, punts: 0, puntYds: 0, krYds: 0, prYds: 0, targets: 0, tfl: 0, pd: 0, qbHits: 0 } },
  };
  const coach = { id: "coach", teamId: "pit", development: 82 };
  return { save: { realHistory: false, year: 2010, week: 1, players: { [p.id]: p }, teams: { pit: { coachId: coach.id } }, coaches: { [coach.id]: coach } }, p };
}

test("historical retirement year no longer ends a simulated career", () => {
  const { save, p } = palkoLikeSave();
  assert.equal(arcRetiresNow(p, 2030), undefined);
  p.age = 25;
  assert.equal(shouldRetire(save, p), false);
});

test("a real-life final season is not scripted into the dynasty calendar", () => {
  const { save, p } = palkoLikeSave();
  p.finalSeason = save.year;
  save.cpuOnly = true;
  seasonArcs(save, () => 0.5);
  assert.equal(p.finalSeason, undefined);
});

test("the head coach sets development while offense and defense coordinators affect their own units", () => {
  const hc = { id: "hc", role: "HC", development: 82, abilities: [], traits: [] };
  const oc = { id: "oc", role: "OC", development: 96, abilities: ["Developer"], traits: [] };
  const dc = { id: "dc", role: "DC", development: 48, abilities: [], traits: [] };
  const save = {
    teams: { pit: { ocId: oc.id, dcId: dc.id } },
    coaches: { [oc.id]: oc, [dc.id]: dc },
  };
  assert.equal(coachDevelopmentFactor(hc), coachDevelopmentFactor(hc, { ...oc, development: 70, abilities: [] }),
    "a neutral coordinator leaves the existing head-coach baseline unchanged");
  assert.ok(coachDevelopmentFactor(hc, oc) > coachDevelopmentFactor(hc), "a strong developer OC helps offensive players");
  assert.ok(coachDevelopmentFactor(hc, dc) < coachDevelopmentFactor(hc), "a weak-development DC slows defensive-unit growth");
  assert.equal(developmentCoordinator(save, "pit", { pos: "QB" }), oc);
  assert.equal(developmentCoordinator(save, "pit", { pos: "WR" }), oc);
  assert.equal(developmentCoordinator(save, "pit", { pos: "MLB" }), dc);
  assert.equal(developmentCoordinator(save, "pit", { pos: "K" }), undefined,
    "specialists without a represented coordinator use the head coach baseline");
  assert.equal(coachDevelopmentFactor({ ...hc, development: 99, abilities: ["Developer"] }, { ...oc, development: 99 }).toFixed(2), "1.28",
    "combined staff influence stays within the established development ceiling");
});

test("a standout veteran is not retired by the old generic age cliff", () => {
  const { save, p } = palkoLikeSave();
  p.age = 45;
  p.ovr = 94;
  assert.equal(shouldRetire(save, p), false, "an elite active quarterback can continue beyond the historical path");
});

test("elite running backs retain career agency while age and workload raise retirement risk", () => {
  const estimate = (carries) => {
    const { save, p } = palkoLikeSave();
    p.pos = "RB";
    p.age = 34;
    p.ovr = 90;
    p.teamId = "pit";
    p.stats[2009] = { ...p.stats[2010], rushAtt: carries };
    let retired = 0;
    const samples = 1000;
    for (let seed = 1; seed <= samples; seed++) {
      save.rng = seed;
      if (shouldRetire(save, p)) retired += 1;
    }
    return retired / samples;
  };

  const lightWorkload = estimate(100);
  const heavyWorkload = estimate(400);
  assert.ok(lightWorkload > 0.4 && lightWorkload < 0.7, `light-workload retirement rate ${lightWorkload}`);
  assert.ok(heavyWorkload > lightWorkload + 0.06, `${heavyWorkload} should exceed ${lightWorkload}`);
  assert.ok(heavyWorkload < 0.8, `even an elite back can continue: ${heavyWorkload}`);
});

test("Real History never receives simulated ratings or career-state updates", () => {
  const { save, p } = palkoLikeSave();
  save.realHistory = true;
  const before = snapshotCareerWeek(save);
  const initial = JSON.stringify(p.ratings);
  p.stats[save.year].gp = 1;
  p.stats[save.year].passAtt = 35;
  p.stats[save.year].passYds = 300;
  p.stats[save.year].passTd = 3;
  developCareerWeek(save, before, "regular");
  assert.equal(JSON.stringify(p.ratings), initial);
  assert.equal(p.careerDevelopment, undefined);
});

test("sustained standout play revises the ceiling and develops a low-rated historical player", () => {
  const { save, p } = palkoLikeSave();
  p.arcGap = 4;
  const initialPotential = p.potential;
  const initialOvr = p.ovr;
  const initialSkill = Object.values(p.ratings).reduce((sum, n) => sum + n, 0);
  for (let week = 1; week <= 12; week++) {
    save.week = week;
    const before = snapshotCareerWeek(save);
    const s = p.stats[save.year];
    s.gp += 1;
    s.passAtt += 34;
    s.passCmp += 24;
    s.passYds += 295;
    s.passTd += 3;
    s.passInt += 0;
    developCareerWeek(save, before, "regular");
  }
  assert.ok(p.potential > initialPotential, "repeated elite results should move the scouting ceiling");
  assert.ok(Object.values(p.ratings).reduce((sum, n) => sum + n, 0) > initialSkill, "weekly training should produce permanent skill growth");
  assert.ok(p.ovr >= initialOvr, "progression should not lower overall during a sustained breakout");
  p.age = 28;
  assert.equal(shouldRetire(save, p), false, "the historical 2012 endpoint must not force retirement");
});
