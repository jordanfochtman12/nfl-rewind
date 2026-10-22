/** Honors must matter to a Hall ballot, while future and duplicate entries cannot inflate it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, playerHofScore } from "../src/lib/game/index.ts";

test("Hall of Fame scoring recognizes Pro Bowls and major position awards with diminishing returns", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 94 });
  const player = Object.values(save.players).find((p) => p.pos === "RB");
  assert.ok(player);
  player.honors = { proBowl: [], allPro: [], awards: [], rings: [] };
  const noPastHonors = playerHofScore(save, player);

  player.honors.proBowl = [1962, 1963, 1964, 1965, 1966];
  player.honors.awards = [
    { year: 1964, award: "OPOY" },
    { year: 1964, award: "OPOY" },
    { year: 1965, award: "DPOY" },
    { year: 1967, award: "OPOY" },
  ];
  const decorated = playerHofScore(save, player);
  assert.equal(decorated - noPastHonors, 5 * 1.35 + 4 + 5, "duplicate and future honors do not count");
  player.honors.proBowl = Array.from({ length: 30 }, (_, i) => 1936 + i);
  const capDifference = playerHofScore(save, player) - playerHofScore(save, { ...player, honors: { ...player.honors, proBowl: [1966] } });
  assert.ok(Math.abs(capDifference - (16 - 1.35)) < 1e-9, "Pro Bowl credit is capped");
});
