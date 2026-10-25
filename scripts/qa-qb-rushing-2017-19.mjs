import { test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";
import { isFriend } from "../src/lib/game/data/friends.ts";

test("2017–2019 quarterback rushing tracks real-roster league totals", async (t) => {
  const history = await loadHistoryData();
  setHistoryData(history);

  for (const year of [2017, 2018, 2019]) {
    const actual = history.stats(year).reduce((totals, row) => {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (pos === "QB") {
        totals.attempts += row.line.rushAtt ?? 0;
        totals.yards += row.line.rushYds ?? 0;
      }
      return totals;
    }, { attempts: 0, yards: 0 });
    const seeds = [year * 100 + 17, year * 100 + 29, year * 100 + 43, year * 100 + 61];
    const simulated = { attempts: 0, yards: 0 };

    for (const seed of seeds) {
      let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed });
      save = simUntil(save, (state) => state.year === year && state.phase === "playoffs");
      for (const player of Object.values(save.players)) {
        if (player.pos !== "QB" || isFriend(player)) continue;
        const line = player.stats[year];
        assert.ok(Number.isInteger(line?.rushAtt ?? 0), `${year} ${player.name}: QB rushing attempts stay whole`);
        assert.ok(Number.isInteger(line?.rushYds ?? 0), `${year} ${player.name}: QB rushing yards stay whole`);
        simulated.attempts += line?.rushAtt ?? 0;
        simulated.yards += line?.rushYds ?? 0;
      }
    }

    const attemptRatio = simulated.attempts / (actual.attempts * seeds.length);
    const yardRatio = simulated.yards / (actual.yards * seeds.length);
    const simulatedYpc = simulated.yards / simulated.attempts;
    const actualYpc = actual.yards / actual.attempts;
    const report = `${year}: ${seeds.length}-seed QB rushing ${attemptRatio.toFixed(3)}x attempts, ${yardRatio.toFixed(3)}x yards, ${simulatedYpc.toFixed(2)} YPC vs ${actualYpc.toFixed(2)} historical`;

    t.diagnostic(report);
    assert.ok(attemptRatio >= 0.9 && attemptRatio <= 1.1, report);
    assert.ok(yardRatio >= 0.9 && yardRatio <= 1.1, report);
    assert.ok(Math.abs(simulatedYpc - actualYpc) <= 0.2, report);
  }
});
