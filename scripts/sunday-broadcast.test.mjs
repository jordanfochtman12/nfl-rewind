import { test } from "node:test";
import assert from "node:assert/strict";
import { filmReport, pressureAdjustment } from "../src/lib/game/broadcast.ts";
import { createNewGame } from "../src/lib/game/createGame.ts";
import { simGame, planFor, canKneelOut } from "../src/lib/game/sim.ts";
import { importDynasty } from "../src/lib/game/importSave.ts";
import { careerTotals, playoffTotals } from "../src/lib/game/leaders.ts";
import { emptyStats } from "../src/lib/game/players.ts";
import { boothLine } from "../src/lib/game/commentary.ts";

test("cumulative careers count each season once, include live totals, and retain retired players", () => {
  const prior={...emptyStats(1965,"gnb"),gp:14,passAtt:100,passCmp:50,passYds:1000,passTd:10};
  const archived={...emptyStats(1966,"gnb"),gp:1,passAtt:10,passCmp:5,passYds:100,passTd:1};
  const current={...archived,gp:2,passAtt:30,passCmp:20,passYds:350,passTd:3};
  const future={...emptyStats(1967,"chi"),gp:1,passYds:50};
  const player={teamId:"retired",career:[prior,archived],stats:{1966:current,1967:future},playoffStats:{1966:{...emptyStats(1966,"gnb"),gp:1,passYds:200}}};
  const snapshot=JSON.stringify(player);
  const full=careerTotals(player,{throughYear:1966});
  assert.equal(full.passYds,1350); assert.equal(full.gp,16); assert.equal(full.passTd,13);
  const dynasty=careerTotals(player,{fromYear:1966,throughYear:1966});
  assert.equal(dynasty.passYds,350); assert.equal(dynasty.passCmp,20); assert.equal(dynasty.passAtt,30);
  assert.equal(playoffTotals(player).passYds,200);
  assert.equal(careerTotals(player,{fromYear:1966,throughYear:1967}).passYds,400);
  assert.equal(JSON.stringify(player),snapshot);
});

test("natural commentary preserves names, gains and scoring without inventing play details", () => {
  const p=play({text:"Bart Starr to Carroll Dale for 18 yards.",togo:10,snap:{call:"med",kind:"pass",yards:18,complete:true}});
  assert.match(boothLine(p,2),/Bart Starr finds Carroll Dale/);
  assert.match(boothLine(p,2),/18/); assert.match(boothLine(p,2),/moves the chains/);
  assert.match(boothLine({...p,tag:"td",text:p.text+" Touchdown. The kick is good."},3),/Touchdown! And the extra point is good/);
  const legacy=play({text:"Frank Ryan incomplete.",snap:undefined});
  assert.equal(boothLine(legacy,1),legacy.text);
});

const play = (patch = {}) => ({
  q: 1,
  clock: 800,
  poss: "gnb",
  down: 1,
  togo: 10,
  spot: 25,
  hs: 0,
  as: 0,
  text: "Recorded play",
  snap: { call: "run", kind: "run", yards: 4 },
  ...patch,
});
test("studio reports respect film prefix and success thresholds without future spoilers", () => {
  const log = [
    play(),
    play({ down: 2, snap: { call: "short", kind: "pass", yards: 5, complete: true } }),
    play({ snap: { call: "deep", kind: "pass", yards: 25, complete: true } }),
  ];
  const before = JSON.stringify(log);
  const half = filmReport(log.slice(0, 2), "gnb");
  assert.equal(half.successful, 1);
  assert.equal(half.early, 2);
  assert.equal(half.explosives, 0);
  assert.equal(filmReport(log, "gnb").explosives, 1);
  assert.equal(filmReport(log, "chi").recorded, 0);
  assert.equal(JSON.stringify(log), before);
});
test("film separates sacks and excludes kneels, spikes, turnovers and legacy unknown snaps", () => {
  const r = filmReport(
    [
      play({ snap: undefined }),
      play({ snap: { call: "kneel", kind: "run", yards: -1 } }),
      play({ snap: { call: "spike", kind: "pass", yards: 0 } }),
      play({ snap: { call: "deep", kind: "sack", yards: 0 } }),
      play({ tag: "to", snap: { call: "run", kind: "run", yards: 12 } }),
    ],
    "gnb",
  );
  assert.equal(r.recorded, 2);
  assert.equal(r.sacks, 1);
  assert.equal(r.passes, 0);
  assert.equal(r.successful, 0);
  assert.equal(r.explosives, 1);
});
test("version 16 saves hydrate new coaching defaults and keep legacy film readable", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 1966 });
  s.version = 16;
  delete s.teams.gnb.plan.protection;
  delete s.teams.gnb.plan.defensiveFocus;
  const loaded = importDynasty(JSON.stringify(s));
  assert.equal(loaded.version, 18);
  assert.equal(planFor(loaded, "gnb").protection, "balanced");
  assert.equal(planFor(loaded, "gnb").defensiveFocus, "balanced");
});
test("a full simulated game records real snap types, timeout bounds and independent kickoff sheets", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 1966 });
  const g = s.schedule.find((g) => g.homeId === "gnb" || g.awayId === "gnb");
  s.teams.gnb.plan.protection = "maxProtect";
  s.teams.gnb.plan.defensiveFocus = "pass";
  simGame(s, g);
  assert.ok(g.played);
  assert.ok(g.log.length > 60);
  assert.ok(g.log.some((p) => p.snap.kind === "pass"));
  assert.ok(g.log.some((p) => p.snap.kind === "run"));
  for (let i=1; i<g.log.length; i++) {
    const a=g.log[i-1], b=g.log[i];
    assert.ok(b.q>a.q || (b.q===a.q && b.clock<=a.clock), "play clock never rewinds within a quarter");
  }
  for (const p of g.log) {
    assert.ok(Number.isInteger(p.snap.yards));
    assert.ok(p.homeTimeouts >= 0 && p.homeTimeouts <= 3);
    assert.ok(p.awayTimeouts >= 0 && p.awayTimeouts <= 3);
  }
  const sheet = g.homeId === "gnb" ? g.callSheets.home : g.callSheets.away;
  s.teams.gnb.plan.protection = "balanced";
  assert.equal(sheet.protection, "maxProtect");
  for (const id of [g.homeId, g.awayId]) {
    const box = id === g.homeId ? g.boxHome : g.boxAway;
    const report = filmReport(g.log, id);
    const spikes = g.log.filter((p) => p.poss === id && p.snap.call === "spike").length;
    assert.equal(
      report.passes + spikes,
      box.reduce((n, b) => n + (b.passAtt ?? 0), 0),
    );
    assert.equal(
      report.sacks,
      box.reduce((n, b) => n + (b.sacksThrown ?? 0), 0),
    );
  }
});

test("victory kneels depend on the defense's remaining timeouts and safe clock/down/field position", () => {
  assert.equal(canKneelOut(4,30,1,25,-7,0),true);
  for (const timeouts of [1,2,3]) assert.equal(canKneelOut(4,30,1,25,-7,timeouts),false);
  for (const args of [[4,41,1,25,-7,0],[4,30,4,25,-7,0],[4,30,1,1,-7,0],[2,30,1,25,-7,0],[4,30,1,25,0,0]]) assert.equal(canKneelOut(...args),false);
});
test("coaching dials change seeded simulation outcomes without changing the standard pressure calibration", () => {
  assert.equal(pressureAdjustment("normal"), 0);
  assert.ok(pressureAdjustment("heavy") > pressureAdjustment("rare"));
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 213 });
  const index = s.schedule.findIndex((g) => g.homeId === "gnb" || g.awayId === "gnb");
  const run = (patch) => {
    const c = structuredClone(s);
    Object.assign(c.teams.gnb.plan, patch);
    simGame(c, c.schedule[index]);
    return JSON.stringify(c.schedule[index].log);
  };
  const standard = run({ protection: "balanced", defensiveFocus: "balanced", blitz: "normal" });
  for (const patch of [
    { protection: "maxProtect" },
    { defensiveFocus: "run" },
    { defensiveFocus: "pass" },
    { blitz: "heavy" },
  ])
    assert.notEqual(run(patch), standard);
});
