/** Depth-chart backs receive a realistic workload split as the game wears on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simGame, teamUnits, thirdBackRotationShare } from "../src/lib/game/index.ts";

test("a healthy third back joins the rotation only after the top two carry a heavy load", () => {
  let save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const team = save.teams.pit;
  assert.ok(team.depth.RB.length >= 3, "the test roster needs three healthy backs");
  const expectedThird = team.depth.RB[2];
  assert.equal(teamUnits(save, "pit").rb3?.id, expectedThird, "RB3 follows the saved depth chart");

  assert.equal(thirdBackRotationShare(0, true), 0);
  assert.equal(thirdBackRotationShare(16, true), 0, "the top two keep the opening workload");
  assert.equal(thirdBackRotationShare(26, true), 0.2, "the third back joins before one runner absorbs a full game's workload");
  assert.equal(thirdBackRotationShare(100, true), 0.34, "the lead back stays the main runner at the rotation cap");
  assert.equal(thirdBackRotationShare(100, false), 0, "an empty depth chart never invents a substitute");

  team.depth.RB = [team.depth.RB[1], team.depth.RB[2], team.depth.RB[0], ...team.depth.RB.slice(3)];
  assert.equal(teamUnits(save, "pit").rb3?.id, team.depth.RB[2], "RB3 selection updates with owner depth-chart edits");
});

test("offensive scheme selects the intended receiver personnel and uses both tight ends", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 624 });
  const team = save.teams.pit;

  team.offScheme = "vertical";
  const vertical = teamUnits(save, "pit");
  assert.equal(vertical.wr.length, 3, "vertical personnel use three wide receivers");
  assert.equal(vertical.te2, undefined, "vertical personnel use one tight end");
  assert.equal(vertical.fb, undefined, "vertical personnel remove the fullback");

  team.offScheme = "smashmouth";
  const smashmouth = teamUnits(save, "pit");
  assert.equal(smashmouth.wr.length, 1, "smashmouth personnel use one wide receiver");
  assert.ok(smashmouth.te && smashmouth.te2, "smashmouth personnel can include two tight ends");
  assert.ok(smashmouth.fb, "smashmouth keeps its fullback available");

  const secondTightEnd = smashmouth.te2.id;
  const game = { id: "smashmouth-te-rotation", year: save.year, week: 2, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  simGame(save, game);
  const box = [...(game.boxHome ?? []), ...(game.boxAway ?? [])].find((row) => row.playerId === secondTightEnd);
  assert.ok(box?.targets > 0, "the second tight end participates in the passing game");
});
