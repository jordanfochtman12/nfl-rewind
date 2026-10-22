/** Depth-chart backs receive a realistic workload split as the game wears on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, teamUnits, thirdBackRotationShare } from "../src/lib/game/index.ts";

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
