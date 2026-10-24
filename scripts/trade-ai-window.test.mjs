import { test } from "node:test";
import assert from "node:assert/strict";
import { blankState, clubWindow } from "../src/lib/game/index.ts";

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
