/** Compare era-level tight-end production with historical league totals. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, loadHistoryData, simUntil } from "../src/lib/game/index.ts";

const YEARS = [1985, 1994, 1999, 2009, 2019, 2024];
let history;

before(async () => {
  history = await loadHistoryData();
});

for (const year of YEARS) {
  test(`${year} tight-end receiving volume stays near its historical league total`, async () => {
    const actual = { rec: 0, recYds: 0 };
    for (const row of history.stats(year)) {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (pos !== "TE") continue;
      actual.rec += row.line.rec ?? 0;
      actual.recYds += row.line.recYds ?? 0;
    }
    assert.ok(actual.rec > 0 && actual.recYds > 0, `${year} historical tight-end data is present`);

    for (const seed of year === 1999 ? [4242, 9711] : [4242]) {
      let save = createNewGame({ userTeamId: "pit", startingYear: year, cpuOnly: true, seed });
      save = simUntil(save, (state) => state.year > year || state.phase === "complete");
      const simulated = Object.values(save.players).reduce(
        (total, player) => ({
          rec: total.rec + (player.pos === "TE" ? player.stats[year]?.rec ?? 0 : 0),
          recYds: total.recYds + (player.pos === "TE" ? player.stats[year]?.recYds ?? 0 : 0),
        }),
        { rec: 0, recYds: 0 },
      );
      const recRatio = simulated.rec / actual.rec;
      const yardRatio = simulated.recYds / actual.recYds;
      assert.ok(Math.abs(recRatio - 1) <= 0.25, `${year} seed ${seed} TE receptions ${simulated.rec}/${actual.rec} (${recRatio.toFixed(2)}x)`);
      assert.ok(Math.abs(yardRatio - 1) <= 0.25, `${year} seed ${seed} TE receiving yards ${simulated.recYds}/${actual.recYds} (${yardRatio.toFixed(2)}x)`);
    }
  });
}
