import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simGame } from "../src/lib/game/index.ts";

const DEFENSE = new Set(["DE", "DT", "OLB", "MLB", "CB", "S"]);

test("a defensive player hurt on a tackle is replaced from the saved depth chart", () => {
  let observedDefensiveReplacement = false;

  // Low durability makes contact injuries likely while fixed seeds keep this repeatable.
  for (let seed = 1; seed <= 32 && !observedDefensiveReplacement; seed += 1) {
    const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 7400 + seed });
    save.sandbox = true;
    const defenders = new Set();
    for (const teamId of ["pit", "cle"]) {
      for (const id of save.teams[teamId].roster) {
        const player = save.players[id];
        if (!player || !DEFENSE.has(player.pos)) continue;
        defenders.add(id);
        player.ratings.inj = 0;
      }
    }

    const game = {
      id: `defender-injury-${seed}`,
      year: save.year,
      week: 1,
      phase: "regular",
      homeId: "pit",
      awayId: "cle",
      homeScore: 0,
      awayScore: 0,
      played: false,
    };
    simGame(save, game);

    const hurtDefender = [...defenders].find((id) => save.players[id].injuredWeeks > 0);
    if (!hurtDefender) continue;
    const name = `${save.players[hurtDefender].firstName} ${save.players[hurtDefender].lastName}`;
    const notes = game.log?.map((play) => play.text).join(" ") ?? "";
    observedDefensiveReplacement = notes.includes(name) && notes.includes("Next man up:");
  }

  assert.ok(observedDefensiveReplacement, "a contact injury on defense produces a next-man-up substitution");
});
