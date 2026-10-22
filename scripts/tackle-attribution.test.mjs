import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simGame } from "../src/lib/game/index.ts";

const total = (box, key) => box.reduce((n, row) => n + (row[key] ?? 0), 0);
const halfSacks = (box) => box.reduce((n, row) => n + ((row.sacks ?? 0) % 1), 0);

test("simulated tackles reconcile to contact events, split sacks, and no postgame padding", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 4821 });
  const game = { id: "tackle-attribution", year: 2024, week: 6, phase: "regular",
    homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  simGame(save, game);

  const sides = [
    { defense: game.boxHome, offense: game.boxAway },
    { defense: game.boxAway, offense: game.boxHome },
  ];
  for (const { defense, offense } of sides) {
    const expected = total(offense, "rushAtt") - total(offense, "kneels") + total(offense, "passCmp")
      + total(offense, "sacksThrown") + halfSacks(defense) / 2;
    assert.equal(total(defense, "tackles"), expected,
      "one primary stop is credited per run, completion, or sack, with each split-sack partner credited too");
  }
});
