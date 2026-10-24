import assert from "node:assert/strict";
import { test } from "node:test";
import { careerTotals, seasonLeaders } from "../src/lib/game/leaders.ts";
import { createNewGame, simGame } from "../src/lib/game/index.ts";
import { emptyStats } from "../src/lib/game/players.ts";
import { hydrateSave } from "../src/lib/game/save.ts";
import { individualScoringPoints } from "../src/lib/game/statRules.ts";
import { scoring } from "../src/lib/game/statsView.ts";

test("individual points count conversions, safeties, touchdowns scored and kicking points, not passing touchdowns", () => {
  const passer = { id: "qb", firstName: "Pass", lastName: "Leader", pos: "QB", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), passTd: 40 } } };
  const scorer = { id: "rb", firstName: "Touchdown", lastName: "Runner", pos: "RB", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), rushTd: 8, krTd: 1, defTd: 1, twoPtMade: 1, safeties: 1 } } };
  const kicker = { id: "k", firstName: "Field", lastName: "Goal", pos: "K", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), fgMade: 4, xpMade: 3 } } };
  const leaders = seasonLeaders({ year: 2024, players: { qb: passer, rb: scorer, k: kicker } });

  assert.deepEqual(leaders.scoring.map(({ playerId, value }) => [playerId, value]), [["rb", 64], ["k", 15]]);
  assert.equal(scoring(passer.stats[2024]), 0);
  assert.equal(scoring(scorer.stats[2024]), 64);
  assert.equal(scoring(kicker.stats[2024]), 15);
});

test("a successful simulated two-point try credits one scorer and accumulates in career stats", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 1 });
  let game;
  let credited = [];
  for (const entry of save.schedule.filter((candidate) => candidate.week === 4 && candidate.phase === "regular")) {
    simGame(save, entry);
    const scorers = [...(entry.boxHome ?? []), ...(entry.boxAway ?? [])].filter((line) => (line.twoPtMade ?? 0) > 0);
    if (scorers.length) {
      game = entry;
      credited = scorers;
      break;
    }
  }
  assert.ok(game, "fixed-seed week contains a successful two-point try");

  assert.equal(credited.length, 1, "fixed-seed game records one two-point scorer");
  assert.equal(credited[0].twoPtMade, 1);
  const player = save.players[credited[0].playerId];
  assert.ok(player);
  assert.equal(player.stats[save.year].twoPtMade, 1);
  assert.equal(careerTotals(player).twoPtMade, 1);
  assert.equal(individualScoringPoints(player.stats[save.year]), 2);
});

test("defensive touchdown leaderboard excludes historical source gaps", () => {
  const scorer = { id: "def", firstName: "Pick", lastName: "Six", pos: "CB", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), defTd: 2 } } };
  const unknown = { id: "unknown", firstName: "Old", lastName: "Record", pos: "S", teamId: "gb", stats: { 2024: { ...emptyStats(2024, "gb"), defTd: 0, unknown: ["defTd"] } } };
  const leaders = seasonLeaders({ year: 2024, players: { def: scorer, unknown } });
  assert.deepEqual(leaders.defTd.map(({ playerId, value }) => [playerId, value]), [["def", 2]]);
});

test("a simulated fumble-return touchdown reaches the credited defender's career line", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 10 });
  // Pin the game RNG and lower ball-carrier break-tackle ratings for these two clubs so this
  // regression always exercises the rare fumble-return scoring path instead of relying on an
  // incidental turnover from an ordinary seed.
  save.rng = 39;
  for (const player of Object.values(save.players)) {
    if (["pit", "cle"].includes(player.teamId) && ["QB", "RB", "FB", "WR", "TE"].includes(player.pos)) {
      player.ratings.btk = 0;
    }
  }
  const defensiveTouchdownsBefore = new Map(
    Object.values(save.players).map((player) => [player.id, careerTotals(player).defTd]),
  );
  const game = { id: "defensive-score-regression", year: save.year, week: 4, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  simGame(save, game);
  const returners = [...(game.boxHome ?? []), ...(game.boxAway ?? [])].filter((line) => line.defTd);

  assert.equal(returners.length, 2, "fixed seed includes one fumble-return and one interception-return touchdown");
  const fumbleReturner = returners.find((line) => line.fr === 1);
  assert.ok(fumbleReturner, "one defensive touchdown comes from a fumble return");
  const defender = save.players[fumbleReturner.playerId];
  assert.ok(defender);
  assert.equal(defender.stats[save.year].defTd, 1);
  assert.equal(individualScoringPoints(defender.stats[save.year]), 6);
  assert.equal(
    careerTotals(defender).defTd,
    (defensiveTouchdownsBefore.get(defender.id) ?? 0) + 1,
    "the defensive score adds to the player's accumulated career total",
  );
});

test("older save stat lines default the new defensive-TD field without losing other totals", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 381 });
  const player = save.players[save.teams.pit.depth.QB?.[0] ?? ""];
  assert.ok(player);
  const regular = player.stats[save.year] ?? (player.stats[save.year] = emptyStats(save.year, "pit"));
  regular.rushYds = 41;
  delete regular.defTd;
  delete regular.twoPtMade;
  delete regular.safeties;
  const postseason = { ...emptyStats(save.year, player.teamId), sacks: 2 };
  delete postseason.defTd;
  delete postseason.twoPtMade;
  delete postseason.safeties;
  player.playoffStats = { [save.year]: postseason };

  const hydrated = hydrateSave(save);
  assert.equal(hydrated.players[player.id].stats[save.year].defTd, 0);
  assert.equal(hydrated.players[player.id].stats[save.year].twoPtMade, 0);
  assert.equal(hydrated.players[player.id].stats[save.year].safeties, 0);
  assert.equal(hydrated.players[player.id].stats[save.year].rushYds, 41);
  assert.equal(hydrated.players[player.id].playoffStats[save.year].defTd, 0);
  assert.equal(hydrated.players[player.id].playoffStats[save.year].twoPtMade, 0);
  assert.equal(hydrated.players[player.id].playoffStats[save.year].safeties, 0);
  assert.equal(hydrated.players[player.id].playoffStats[save.year].sacks, 2);
});
