/** Compare simulated field-goal volume and accuracy with the archived historical league. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";

const YEARS = [1966, 1985, 2009, 2019, 2024];
let measured;

before(async () => {
  const history = await loadHistoryData();
  setHistoryData(history);
  measured = {};
  for (const year of YEARS) {
    const actual = history.stats(year).reduce((totals, row) => ({
      attempts: totals.attempts + (row.line.fgAtt ?? 0),
      made: totals.made + (row.line.fgMade ?? 0),
    }), { attempts: 0, made: 0 });
    let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed: 8723 });
    save = simUntil(save, (state) => state.year > year || state.phase === "complete");
    const simulated = Object.values(save.players).reduce((totals, player) => {
      const line = player.stats[year];
      return {
        attempts: totals.attempts + (line?.fgAtt ?? 0),
        made: totals.made + (line?.fgMade ?? 0),
      };
    }, { attempts: 0, made: 0 });
    measured[year] = { actual, simulated };
  }
});

test("field-goal volume and accuracy stay close to five historical eras", () => {
  const misses = [];
  for (const year of YEARS) {
    const { actual, simulated } = measured[year];
    const attemptRatio = simulated.attempts / actual.attempts;
    const actualPct = actual.made / actual.attempts;
    const simulatedPct = simulated.made / simulated.attempts;
    const report = `${year}: ${simulated.attempts}/${simulated.made} vs ${actual.attempts}/${actual.made}; ` +
      `attempt ratio ${attemptRatio.toFixed(2)}, make rate ${(100 * simulatedPct).toFixed(1)}% vs ${(100 * actualPct).toFixed(1)}%`;
    assert.ok(actual.attempts > 0 && simulated.attempts > 0, `${year} has field-goal samples; ${report}`);
    if (Math.abs(attemptRatio - 1) > 0.15 || Math.abs(simulatedPct - actualPct) > 0.1) misses.push(report);
  }
  assert.deepEqual(misses, [], misses.join("\n"));
});
