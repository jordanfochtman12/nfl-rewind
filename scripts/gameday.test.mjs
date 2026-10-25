/**
 * Game day: every rule date changes play, and the owner's game-week tools behave.
 *
 * - Overtime by era: none before 1974 in the regular season, sudden death, the 2010 playoff /
 *   2012 regular-season modified rule, both teams guaranteed the ball (playoffs 2022, regular
 *   season 2025). Checked on simulated games, not just the rule table.
 * - Goalposts on the goal line before 1974 (kicks 10 yards shorter, misses out to the 20).
 * - Dynamic-kickoff touchbacks at the 30 (2024) and 35 (2025).
 * - Key matchups, the scouting report, practice focus scope, and swing plays.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simGame } from "../src/lib/game/index.ts";
import { fgSnapYards, kickoffRules, missedFgSpot, otRules } from "../src/lib/game/era.ts";
import { keyMatchups, matchupReport, practiceFor, rulesInPlay, scoutingReport, swingPlays, winProb, wpSeries } from "../src/lib/game/gameday.ts";

test("win probability responds to field position, down and distance, and late timeouts", () => {
  const situation = { q: 4, clock: 90, poss: "pit", down: 1, togo: 5, spot: 60, hs: 20, as: 20, homeTimeouts: 3, awayTimeouts: 0 };
  const base = winProb(situation, "pit", "pit", false);
  assert.ok(base > 0.5);
  assert.ok(winProb({ ...situation, spot: 25 }, "pit", "pit", false) < base, "deep field position should help the offense");
  assert.ok(winProb({ ...situation, down: 4, togo: 12 }, "pit", "pit", false) < base, "fourth-and-long should reduce the offense's chance");
  assert.ok(winProb({ ...situation, homeTimeouts: 0 }, "pit", "pit", false) < base, "late timeouts should affect clock-management leverage");
  assert.equal(winProb({ ...situation, hs: 21 }, "pit", "pit", true), 1);
});

test("overtime format follows the real rule dates", () => {
  assert.equal(otRules(1973, "regular").kind, "none");
  assert.equal(otRules(1973, "playoffs").kind, "sudden");
  assert.equal(otRules(1974, "regular").kind, "sudden");
  assert.equal(otRules(2009, "playoffs").kind, "sudden");
  assert.equal(otRules(2010, "playoffs").kind, "modified");
  assert.equal(otRules(2011, "regular").kind, "sudden");
  assert.equal(otRules(2012, "regular").kind, "modified");
  assert.equal(otRules(2017, "regular").seconds, 600);
  assert.equal(otRules(2021, "playoffs").kind, "modified");
  assert.equal(otRules(2022, "playoffs").kind, "both");
  assert.equal(otRules(2024, "regular").kind, "modified");
  assert.equal(otRules(2025, "regular").kind, "both");
  assert.equal(otRules(2025, "regular").seconds, 600);
});

test("goalposts and kickoffs move on their real dates", () => {
  assert.equal(fgSnapYards(1973), 7);
  assert.equal(fgSnapYards(1974), 17);
  assert.equal(missedFgSpot(1973, 70), 20);
  assert.equal(missedFgSpot(1980, 70), 23);
  assert.equal(missedFgSpot(1980, 85), 20);
  assert.equal(kickoffRules(2023).tb, 25);
  assert.equal(kickoffRules(2024).tb, 30);
  assert.equal(kickoffRules(2025).tb, 35);
  const titles = (y) => rulesInPlay(y, "regular", "pit").map((r) => r.title);
  assert.ok(titles(1970).includes("Goalposts on the goal line"));
  assert.ok(titles(1970).includes("No two-point try"));
  assert.ok(titles(1994).includes("Two-point conversion"));
  assert.ok(titles(2024).includes("Dynamic kickoff"));
  assert.ok(rulesInPlay(1968, "regular", "kan").some((r) => r.title === "AFL two-point try"));
});

/** The overtime drives of `n` simulated games under a year and phase. */
function overtimes(year, phase, n) {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed: 31 });
  save.year = year;
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = { id: `ot-${year}-${phase}-${i}`, year, week: 6, phase, homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
    simGame(save, g);
    if (g.ot) out.push({ g, drives: (g.drives ?? []).filter((d) => d.q >= 5) });
  }
  return out;
}

test("simulated overtime ends the way each era's rule says", () => {
  // Both teams guaranteed a possession: a first-drive score is always answered.
  const both = overtimes(2023, "playoffs", 1500);
  assert.ok(both.length >= 40, `only ${both.length} overtime games`);
  for (const { drives } of both) {
    if (drives[0] && (drives[0].result === "td" || drives[0].result === "fg")) assert.ok(drives.length >= 2, "a first-possession score ended a both-possess overtime");
  }
  // Modified sudden death: a first-drive touchdown wins it, a first-drive field goal doesn't.
  const mod = overtimes(2015, "playoffs", 1500);
  for (const { drives } of mod) {
    if (drives[0]?.result === "td") assert.equal(drives.length, 1, "a first-possession TD should end modified overtime");
    if (drives[0]?.result === "fg") assert.ok(drives.length >= 2, "a first-possession FG ended modified overtime");
  }
  // Sudden death: the first score of any kind ends it.
  const sudden = overtimes(2005, "playoffs", 1500);
  for (const { drives } of sudden) {
    const k = drives.findIndex((d) => d.result === "td" || d.result === "fg");
    if (k >= 0) assert.equal(k, drives.length - 1, "play continued after a sudden-death score");
  }
  // Playoff games never end tied.
  for (const { g } of [...both, ...mod, ...sudden]) assert.notEqual(g.homeScore, g.awayScore);
});

test("game week: matchups, the scout's report, and a practice focus only the owner's club gets", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 12 });
  const ms = keyMatchups(save, "pit", "cle");
  assert.equal(ms.length, 6);
  assert.deepEqual(new Set(ms.map((m) => m.kind)), new Set(["wr-cb", "lt-edge", "rb-lb"]));
  for (const m of ms) assert.ok(save.players[m.offId] && save.players[m.defId]);
  const before = JSON.stringify(save);
  const r = scoutingReport(save, "cle");
  assert.ok(r.lines.length >= 3);
  assert.equal(JSON.stringify(save), before, "the scouting report must not touch the save");
  const game = { id: "g1", year: 1966, week: 1, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  save.practice = { gameId: "g1", focus: "redZone" };
  assert.equal(practiceFor(save, game), "redZone");
  assert.equal(practiceFor(save, { ...game, id: "g2" }), undefined);
  assert.equal(practiceFor(save, { ...game, homeId: "nyg", awayId: "cle" }), undefined);
  assert.equal(practiceFor({ ...save, sandbox: true }, game), undefined);
  assert.equal(practiceFor({ ...save, realHistory: true }, game), undefined);
});

test("postgame matchup grades use pair-specific events and old saved games disclose missing tracking", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, seed: 33 });
  const matchup = keyMatchups(save, "pit", "cle").find((m) => m.kind === "wr-cb" && m.teamId === "pit");
  assert.ok(matchup);
  const game = {
    id: "matchup-report-test", year: 2024, week: 1, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: true,
    boxHome: [{ playerId: matchup.offId, rec: 8, recYds: 140, recTd: 2 }],
    boxAway: [{ playerId: matchup.defId, ints: 0, pd: 0 }],
    matchups: [{ ...matchup, result: { targets: 5, receptions: 1, receivingYards: 8, receivingTds: 0, interceptions: 0 } }],
  };
  const report = matchupReport(save, game)[0];
  assert.equal(report.winner, "defense", "the targeted one-on-one was poor despite the receiver's unrelated full-game totals");
  assert.match(report.line, /1 catches on 5 matchup targets for 8 yards/);

  const smallSample = matchupReport(save, { ...game, matchups: [{ ...game.matchups[0], result: { targets: 1 } }] })[0];
  assert.equal(smallSample.winner, "inconclusive", "one target is not enough to call the matchup a draw or winner");

  const legacy = matchupReport(save, { ...game, matchups: [matchup] })[0];
  assert.equal(legacy.winner, "unavailable");
  assert.match(legacy.line, /no play-by-play matchup tracking/);
});

test("the owner's game keeps its matchups, cues and momentum, and its swing plays read after the snap", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 5 });
  const game = { id: "own-1", year: 1966, week: 1, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false, night: true };
  save.practice = { gameId: "own-1", focus: "ballSecurity" };
  simGame(save, game);
  assert.equal(game.practice, "ballSecurity");
  assert.equal(game.matchups?.length, 6);
  assert.ok(game.matchups.some((m) => (m.result?.dropbacks ?? 0) > 0), "the featured tackle-edge pair records pass-play opportunities");
  assert.ok(game.matchups.some((m) => (m.result?.carries ?? 0) > 0), "the featured back-linebacker pair records matched carries");
  assert.ok(game.log.length > 80);
  assert.ok(game.log.some((l) => l.cue === "crowd"), "a prime-time game opens with the crowd");
  assert.ok(game.log.some((l) => typeof l.mo === "number"));
  const wp = wpSeries(game.log, "pit", "pit");
  assert.equal(wp.length, game.log.length);
  assert.ok(wp.every((v) => v >= 0 && v <= 1));
  const sw = swingPlays(game.log, "pit", "pit", 3);
  assert.equal(sw.length, 3);
  for (let k = 1; k < sw.length; k++) assert.ok(Math.abs(sw[k - 1].after - sw[k - 1].before) >= Math.abs(sw[k].after - sw[k].before));
});
