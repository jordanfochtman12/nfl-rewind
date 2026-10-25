/** Compare era-level tight-end production with historical league totals. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";

const YEARS = [1985, 1994, 1999, 2009, 2014, 2016, 2019, 2024];
let history;

before(async () => {
  history = await loadHistoryData();
  setHistoryData(history);
});

for (const year of YEARS) {
  test(`${year} tight-end receiving volume stays near its historical league total`, async (t) => {
    const actual = { rec: 0, recYds: 0, byPosition: {} };
    for (const row of history.stats(year)) {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      const group = actual.byPosition[pos] ?? (actual.byPosition[pos] = { rec: 0, recYds: 0 });
      group.rec += row.line.rec ?? 0;
      group.recYds += row.line.recYds ?? 0;
    }
    actual.rec = actual.byPosition.TE?.rec ?? 0;
    actual.recYds = actual.byPosition.TE?.recYds ?? 0;
    assert.ok(actual.rec > 0 && actual.recYds > 0, `${year} historical tight-end data is present`);

    for (const seed of year === 1999 ? [4242, 9711] : [4242]) {
      let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed });
      save = simUntil(save, (state) => state.year > year || state.phase === "complete");
      const simulatedByPosition = {};
      for (const player of Object.values(save.players)) {
        const group = simulatedByPosition[player.pos] ?? (simulatedByPosition[player.pos] = { rec: 0, recYds: 0 });
        group.rec += player.stats[year]?.rec ?? 0;
        group.recYds += player.stats[year]?.recYds ?? 0;
      }
      const simulated = {
        rec: simulatedByPosition.TE?.rec ?? 0,
        recYds: simulatedByPosition.TE?.recYds ?? 0,
      };
      const recRatio = simulated.rec / actual.rec;
      const yardRatio = simulated.recYds / actual.recYds;
      const receptionShares = ["WR", "TE", "RB", "FB"].map((pos) => {
        const real = actual.byPosition[pos]?.rec ?? 0;
        const sim = simulatedByPosition[pos]?.rec ?? 0;
        return `${pos} ${(100 * sim / Math.max(1, Object.values(simulatedByPosition).reduce((sum, line) => sum + line.rec, 0))).toFixed(1)}%/${(100 * real / Math.max(1, Object.values(actual.byPosition).reduce((sum, line) => sum + line.rec, 0))).toFixed(1)}%`;
      }).join(", ");
      const totalRecRatio = Object.values(simulatedByPosition).reduce((sum, line) => sum + line.rec, 0) /
        Object.values(actual.byPosition).reduce((sum, line) => sum + line.rec, 0);
      const report = `${year} seed ${seed}: TE receptions ${simulated.rec}/${actual.rec} (${recRatio.toFixed(2)}x); receiving yards ${simulated.recYds}/${actual.recYds} (${yardRatio.toFixed(2)}x); all receptions ${totalRecRatio.toFixed(2)}x; WR/TE/RB/FB reception shares sim/real ${receptionShares}`;
      t.diagnostic(report);
      assert.ok(Math.abs(totalRecRatio - 1) <= 0.12, report);
      assert.ok(Math.abs(recRatio - 1) <= 0.25, report);
      assert.ok(Math.abs(yardRatio - 1) <= 0.25, report);
      for (const pos of ["WR", "TE", "RB", "FB"]) {
        const simShare = (simulatedByPosition[pos]?.rec ?? 0) / Object.values(simulatedByPosition).reduce((sum, line) => sum + line.rec, 0);
        const actualShare = (actual.byPosition[pos]?.rec ?? 0) / Object.values(actual.byPosition).reduce((sum, line) => sum + line.rec, 0);
        assert.ok(Math.abs(simShare - actualShare) <= 0.08, `${year} ${pos} share ${(100 * simShare).toFixed(1)}% vs historical ${(100 * actualShare).toFixed(1)}%; ${report}`);
      }
    }
  });
}
