import { test } from "node:test";
import assert from "node:assert/strict";
import { careerHeadlines, colsForFamily } from "../src/lib/game/statsView.ts";
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

test("defensive touchdown and points are visible, while unrecorded historical defensive TDs stay unknown", () => {
  const line = { ...emptyStats(2024, "pit"), defTd: 1 };
  assert.equal(value("def", "defTd", line), 1);
  assert.equal(value("def", "pts", line), 6);
  const historical = { ...emptyStats(1980, "pit"), unknown: ["defTd"] };
  assert.equal(value("def", "defTd", historical), "—");
  assert.equal(value("def", "pts", historical), "—");
});

test("career summary exposes defensive touchdowns and hides incomplete historical point totals", () => {
  const line = { ...emptyStats(2024, "pit"), defTd: 1 };
  const player = { id: "defender", firstName: "Test", lastName: "Defender", pos: "MLB", teamId: "pit", age: 28, yearsPro: 6, stats: { 2024: line }, career: [] };
  const headline = (p, label) => careerHeadlines(p).find((row) => row.label === label)?.value;

  assert.equal(headline(player, "Def TD"), "1");
  assert.equal(headline(player, "Pts"), "6");
  const historical = { ...line, unknown: ["defTd", "pts"] };
  assert.equal(headline({ ...player, stats: { 2024: historical } }, "Def TD"), "—");
  assert.equal(headline({ ...player, stats: { 2024: historical } }, "Pts"), "—");
});
