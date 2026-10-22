import { test } from "node:test";
import assert from "node:assert/strict";
import { colsForFamily } from "../src/lib/game/statsView.ts";
import { emptyStats } from "../src/lib/game/players.ts";
import { scoring } from "../src/lib/game/statsView.ts";

function value(family, key, line) {
  return colsForFamily(family).find((column) => column.key === key)?.of(line);
}

test("known zero stats display as zero instead of looking unrecorded", () => {
  const line = emptyStats(2024, "pit");
  assert.equal(value("rush", "rec", line), 0);
  assert.equal(value("rush", "kr", line), 0);
  assert.equal(value("ret", "ret", line), "—", "combined return yards stay blank when there were no returns");
});

test("historical data gaps remain explicit em dashes", () => {
  const line = { ...emptyStats(1966, "pit"), unknown: ["tfl", "pd"] };
  assert.equal(value("def", "tfl", line), "—");
  assert.equal(value("def", "pd", line), "—");
  assert.equal(value("def", "ints", line), 0, "tracked zero interceptions remain distinct from missing records");
});

test("passing touchdowns are not counted as points scored by the passer", () => {
  const line = { ...emptyStats(2024, "pit"), passTd: 35, recTd: 2, krTd: 1, fgMade: 1, xpMade: 2 };
  assert.equal(scoring(line), 23, "three player-scored touchdowns, one field goal, and two extra points");
});
