import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame } from "../src/lib/game/index.ts";
import { cpuMarket } from "../src/lib/game/gm.ts";

test("CPU veteran market skips a fullback for vertical personnel, then signs him for smashmouth", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 9173 });
  save.leagueSandbox = true;
  save.leagueControl = {};
  for (const id of Object.keys(save.teams)) save.leagueControl[id] = { roster: id === "pit" };
  save.salaryCap = 1_000_000_000;
  save.teams.pit.offScheme = "vertical";

  const team = save.teams.pit;
  const oldFullbackId = team.roster.find((id) => save.players[id]?.pos === "FB");
  assert.ok(oldFullbackId, "the test club has a fullback to release into the market");
  team.roster = team.roster.filter((id) => id !== oldFullbackId);
  const freeAgent = save.players[oldFullbackId];
  freeAgent.teamId = "fa";
  freeAgent.ovr = 82;
  freeAgent.potential = 82;
  freeAgent.age = 26;
  freeAgent.classOf = true;
  freeAgent.injuredWeeks = 0;
  freeAgent.onIR = false;

  cpuMarket(save);
  assert.equal(freeAgent.teamId, "fa", "a vertical offense does not bid on a position absent from its active personnel");

  team.offScheme = "smashmouth";
  cpuMarket(save);
  assert.equal(freeAgent.teamId, "pit", "the same team recognizes a fullback need when its scheme uses the position");
});
