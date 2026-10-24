import { test } from "node:test";
import assert from "node:assert/strict";
import { blankState, clubWindow } from "../src/lib/game/index.ts";
import { needFor } from "../src/lib/game/tradeAI.ts";

function clubWith({ overall, wins = 0, losses = 0 }) {
  const save = blankState("pit", 2025, 44);
  const team = save.teams.pit;
  team.active = true;
  team.wins = wins;
  team.losses = losses;
  for (let i = 0; i < 24; i++) {
    const id = `test-pit-${i}`;
    save.players[id] = { id, teamId: "pit", pos: "QB", ovr: overall, revealed: true };
    team.roster.push(id);
  }
  return save;
}

test("CPU club windows blend early results with roster strength, then trust a full season", () => {
  const overperformer = clubWith({ overall: 70, wins: 4 });
  const underperformer = clubWith({ overall: 80, losses: 4 });
  const sustainedWinner = clubWith({ overall: 70, wins: 12, losses: 4 });
  const sustainedLoser = clubWith({ overall: 66, wins: 4, losses: 12 });

  assert.equal(clubWindow(overperformer, "pit"), "middle", "a four-game hot start alone should not trigger contender buying");
  assert.equal(clubWindow(underperformer, "pit"), "middle", "a four-game skid alone should not trigger a fire sale");
  assert.equal(clubWindow(sustainedWinner, "pit"), "contend", "a strong season earns contender status");
  assert.equal(clubWindow(sustainedLoser, "pit"), "rebuild", "a weak roster and sustained losing justify rebuilding");
});

test("CPU trade needs use the club's offensive personnel scheme", () => {
  const save = blankState("pit", 2025, 44);
  const team = save.teams.pit;
  const starter = { id: "pit-wr1", teamId: "pit", pos: "WR", ovr: 78, revealed: true };
  const prospect = { id: "available-wr", teamId: null, pos: "WR", ovr: 72, revealed: true };
  save.players[starter.id] = starter;
  team.roster.push(starter.id);

  team.offScheme = "smashmouth";
  const smashmouthNeed = needFor(save, "pit", prospect);
  team.offScheme = "vertical";
  const verticalNeed = needFor(save, "pit", prospect);

  assert.equal(smashmouthNeed, 0.6, "a one-WR offense already has its only starting receiver");
  assert.ok(verticalNeed > 1, "a three-WR offense values another starter behind only one receiver");
  const fullback = { id: "available-fb", teamId: null, pos: "FB", ovr: 72, revealed: true };
  assert.equal(needFor(save, "pit", fullback), 0.6, "a vertical offense with no fullback role should not treat FB as a starter need");
});
