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
  assert.equal(loaded.version, 20);
  assert.equal(planFor(loaded, "gnb").protection, "balanced");
  assert.equal(planFor(loaded, "gnb").defensiveFocus, "balanced");
});
test("a full simulated game records real snap types, timeout bounds and independent kickoff sheets", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 1966 });
  const g = s.schedule.find((g) => g.homeId === "gnb" || g.awayId === "gnb");
  s.teams.gnb.planEdits = { protection: "maxProtect", defensiveFocus: "pass" };
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
  s.teams.gnb.planEdits.protection = "balanced";
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
  assert.ok(pressureAdjustment("heavy") > pressureAdjustment("normal"));
  assert.ok(pressureAdjustment("rare") < pressureAdjustment("normal"));
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 213 });
  // A dial nudges probabilities, so a single game can play out snap-for-snap the same; three
  // games together can't.
  const games = s.schedule.flatMap((g, i) => (g.homeId === "gnb" || g.awayId === "gnb" ? [i] : [])).slice(0, 3);
  const run = (patch) =>
    games
      .map((index) => {
        const c = structuredClone(s);
        c.teams.gnb.planEdits = { ...c.teams.gnb.planEdits, ...patch };
        simGame(c, c.schedule[index]);
        return JSON.stringify(c.schedule[index].log);
      })
      .join("|");
  const standard = run({ protection: "balanced", defensiveFocus: "balanced", blitz: "normal" });
  for (const patch of [
    { protection: "maxProtect" },
    { defensiveFocus: "run" },
    { defensiveFocus: "pass" },
  ])
    assert.notEqual(run(patch), standard);
});

test("every broadcaster gets a voice of their own that matches them", async () => {
  const { castVoices, voiceGender } = await import("../src/lib/voiceCast.ts");
  const windows = [
    { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft Guy Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft Jenny Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft Christopher Online (Natural) - English (United States)", lang: "en-US" },
    { name: "Microsoft David - English (United States)", lang: "en-US" },
    { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  ];
  const mac = [
    { name: "Samantha", lang: "en-US" },
    { name: "Alex", lang: "en-US" },
    { name: "Daniel", lang: "en-GB" },
    { name: "Karen", lang: "en-AU" },
    { name: "Bubbles", lang: "en-US" },
  ];
  const chrome = [
    { name: "Google US English", lang: "en-US" },
    { name: "Google UK English Female", lang: "en-GB" },
    { name: "Google UK English Male", lang: "en-GB" },
  ];
  assert.equal(voiceGender({ name: "Google US English", lang: "en-US" }), "f");
  assert.equal(voiceGender({ name: "Google UK English Male", lang: "en-GB" }), "m");
  const desk = [
    { key: "Rich Delaney", gender: "m" },
    { key: "Tony Vance", gender: "m" },
    { key: "Dana Whitfield", gender: "f" },
  ];
  for (const voices of [windows, mac, chrome]) {
    const cast = castVoices(voices, desk);
    for (const p of desk) {
      const c = cast.get(p.key);
      assert.ok(c?.voice, `${p.key} has a voice`);
      const g = voiceGender(c.voice);
      // Never the wrong gender when a right one exists; a shared voice is pitched toward the person.
      if (voices.some((v) => voiceGender(v) === p.gender)) assert.equal(g, p.gender, `${p.key} on ${c.voice.name}`);
      assert.ok(!/bubbles/i.test(c.voice.name));
    }
    const names = desk.map((p) => cast.get(p.key).voice.name);
    if (voices.filter((v) => voiceGender(v) === "m").length >= 2) assert.notEqual(names[0], names[1], "two men, two voices");
  }
  // Natural voices win over the old robotic ones.
  assert.match(castVoices(windows, desk).get("Rich Delaney").voice.name, /Online \(Natural\)/);
  // Two men on a device with one male voice still sound like two people.
  const one = castVoices(mac.slice(0, 2), desk.slice(0, 2));
  const [a, b] = desk.slice(0, 2).map((p) => one.get(p.key));
  assert.ok(a.pitch !== b.pitch || a.rate !== b.rate);
});

test("watch history: every club is the computer's, picks come one at a time, and one game a week gets the call", async () => {
  const { createNewGame: make, advance: step } = await import("../src/lib/game/index.ts");
  let s = make({ userTeamId: "gnb", startingYear: 1966, sandbox: true, seed: 7 });
  assert.equal(s.sandbox, true);
  assert.equal(s.cpuOnly, true);
  const before = s.draftPickIndex;
  s = step(s, {});
  assert.equal(s.phase, "draft");
  assert.equal(s.draftPickIndex, before + 1, "a sandbox step reads one pick, even when the placeholder club is on the clock");
  s = step(s, { auto: true });
  for (let i = 0; i < 40 && !(s.phase === "regular" && s.week >= 3); i++) s = step(s, s.phase === "freeAgency" ? { closeFa: true } : {});
  const played = s.schedule.filter((g) => g.year === 1966 && g.played);
  assert.ok(played.length > 0);
  const weeks = new Set(played.map((g) => g.week));
  const last = Math.max(...weeks);
  assert.equal(played.filter((g) => g.featured).length, weeks.size, "exactly one featured broadcast per week played");
  assert.ok(played.filter((g) => g.week === last).every((g) => g.log?.length), "the latest slate is all on film for the whip-around");
  assert.ok(played.filter((g) => g.week < last && g.log?.length).every((g) => g.featured), "older weeks keep only the featured film");
  assert.ok(!s.news.some((n) => /^A new dynasty/.test(n.headline)), "no owner's-club headline in a sandbox");
});

test("watch TV: playoff picture, award ladders, record chases and bulletins hold up over a season", async () => {
  const G = await import("../src/lib/game/index.ts");
  let s = G.createNewGame({ userTeamId: "gnb", startingYear: 1966, sandbox: true, seed: 11 });
  const mid = [];
  for (let i = 0; i < 400 && !(s.phase === "playoffs"); i++) {
    s = G.advance(s, s.phase === "freeAgency" ? { closeFa: true } : s.phase === "draft" ? { auto: true } : {});
    if (s.phase === "regular" && G.weekIsInTheBooks(s)) mid.push(G.playoffPicture(s));
  }
  assert.ok(mid.length >= 10, "weekly pictures were taken");
  // A mark, once earned, never has to be taken back: clinched stays clinched, out stays out.
  const marks = new Map();
  for (const pic of mid)
    for (const g of pic)
      for (const r of g.rows) {
        const was = marks.get(r.teamId);
        if (was === "division") assert.equal(r.mark, "division", `${r.teamId} lost a division clinch`);
        if (was === "out") assert.equal(r.mark, "out", `${r.teamId} came back from elimination`);
        if (r.mark === "division" || r.mark === "out") marks.set(r.teamId, r.mark);
      }
  // The last regular-season picture names exactly the clubs that made the postseason.
  const final = mid.at(-1).flatMap((g) => g.rows.filter((r) => r.mark === "division" || r.mark === "playoffs").map((r) => r.teamId)).sort();
  const field = [...new Set(s.playoffGames.flatMap((g) => [g.homeId, g.awayId]))].sort();
  assert.deepEqual(final, field);
  // 1966: there was an MVP and one rookie award, nothing else yet.
  const races = G.awardRaces(s);
  assert.deepEqual(races.map((l) => l.key), ["mvp", "oroy", "coy"]);
  assert.ok(races.every((l) => l.rows.length > 0 && l.rows.length <= 5));
  // Records the league carried into 1966 count: nobody "breaks" a mark he didn't pass.
  for (const n of s.news.filter((n) => /sets the all-time single-season/.test(n.headline))) {
    assert.match(n.body, /breaking the old mark of \d+/);
  }
  assert.ok(G.leagueStorylines(s).length > 0);
  assert.ok(G.breakingNews(s).every((n) => n.year === s.year));
});

test("saves pack for disk and come back exactly the same", async () => {
  const G = await import("../src/lib/game/index.ts");
  let s = G.createNewGame({ userTeamId: "gnb", startingYear: 1966, sandbox: true, seed: 4 });
  for (let i = 0; i < 500 && s.year < 1967; i++) s = G.advance(s, s.phase === "freeAgency" ? { closeFa: true } : s.phase === "draft" ? { auto: true } : {});
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const same = (x) => JSON.stringify(canon(JSON.parse(JSON.stringify(x))));
  // Loading a plain copy and loading the packed disk copy give the same dynasty.
  const plain = G.hydrateSave(JSON.parse(JSON.stringify(s)));
  const disk = JSON.stringify(G.compactSave(s));
  const back = G.hydrateSave(JSON.parse(disk));
  assert.equal(back.packed, undefined);
  assert.ok(same(back.players) === same(plain.players), "players survive packing");
  assert.ok(same(back.history) === same(plain.history), "history survives packing");
  assert.ok(same(back.teams) === same(plain.teams), "clubs and picks survive packing");
  assert.ok(disk.length < JSON.stringify(s).length * 0.75, `packed ${disk.length} vs ${JSON.stringify(s).length}`);
});

test("the league's year: rule changes at camp, career milestones, trade requests and rivalries that build", async () => {
  const G = await import("../src/lib/game/index.ts");
  let s = G.createNewGame({ userTeamId: "gnb", startingYear: 1966, sandbox: true, seed: 13 });
  const step = () => (s = G.advance(s, s.phase === "freeAgency" ? { closeFa: true } : s.phase === "draft" ? { auto: true } : {}));
  for (let i = 0; i < 2000 && !(s.year === 1974 && s.phase === "regular"); i++) step();
  // The 1974 rule changes were announced at 1974 camp, once each.
  const told = s.news.filter((n) => n.year === 1974 && /^New for 1974:/.test(n.headline));
  assert.equal(told.length, G.rulesTakingEffect(1974).length);
  for (let i = 0; i < 2000 && s.year < 1975; i++) step();
  assert.ok(G.rulebookThrough(1975).every((r) => r.year <= 1975));
  // Rivalry heat only builds from games played, cools over time, and never goes negative.
  const pairs = Object.values(s.h2h ?? {});
  assert.ok(pairs.length > 0);
  for (const r of pairs) assert.ok((r.heat ?? 0) >= 0);
  const hot = G.risingRivalries(s, 5);
  for (const r of hot) assert.ok(r.heat >= G.RIVALRY_HOT);
  // Trade requests: no fixed number, but never a flood, and one per club.
  for (let y = 1966; y < 1975; y++) {
    const asked = Object.values(s.players).filter((p) => p.tradeRequest === y);
    assert.ok(asked.length <= G.requestCeiling(y), `${y}: ${asked.length} requests`);
  }
  // Milestones name a round number that was actually crossed.
  for (const n of s.news.filter((n) => / passes [\d,]+ career /.test(n.headline))) {
    const mark = Number(n.headline.match(/passes ([\d,]+)/)[1].replace(/,/g, ""));
    const now = Number(n.body.match(/^([\d,]+)/)[1].replace(/,/g, ""));
    assert.ok(now >= mark, n.headline);
  }
});
