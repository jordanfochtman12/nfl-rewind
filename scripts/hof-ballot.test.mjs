/** Honors must matter to a Hall ballot, while future and duplicate entries cannot inflate it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, playerHofScore } from "../src/lib/game/index.ts";
import { coachHofEligible } from "../src/lib/game/hof.ts";

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

test("a retired coach becomes Hall-eligible after one complete season out of football", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 95 });
  const coach = Object.values(save.coaches)[0];
  assert.ok(coach);
  Object.assign(coach, {
    retiredYear: 1967,
    careerWins: 100,
    careerLosses: 20,
    careerTitles: 1,
    yearsCoaching: 20,
    peakOffense: 95,
  });

  assert.equal(coachHofEligible(save, coach), false, "not eligible during his retirement-year ballot");
  save.year = 1967;
  assert.equal(coachHofEligible(save, coach), true, "eligible after that season is complete");
});
