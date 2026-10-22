import assert from "node:assert/strict";
import { test } from "node:test";
import { seasonLeaders } from "../src/lib/game/leaders.ts";
import { emptyStats } from "../src/lib/game/players.ts";
import { scoring } from "../src/lib/game/statsView.ts";

test("individual points count touchdowns scored and kicking points, not passing touchdowns", () => {
  const passer = { id: "qb", firstName: "Pass", lastName: "Leader", pos: "QB", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), passTd: 40 } } };
  const scorer = { id: "rb", firstName: "Touchdown", lastName: "Runner", pos: "RB", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), rushTd: 8, krTd: 1 } } };
  const kicker = { id: "k", firstName: "Field", lastName: "Goal", pos: "K", teamId: "pit", stats: { 2024: { ...emptyStats(2024, "pit"), fgMade: 4, xpMade: 3 } } };
  const leaders = seasonLeaders({ year: 2024, players: { qb: passer, rb: scorer, k: kicker } });

  assert.deepEqual(leaders.scoring.map(({ playerId, value }) => [playerId, value]), [["rb", 54], ["k", 15]]);
  assert.equal(scoring(passer.stats[2024]), 0);
  assert.equal(scoring(scorer.stats[2024]), 54);
  assert.equal(scoring(kicker.stats[2024]), 15);
});
