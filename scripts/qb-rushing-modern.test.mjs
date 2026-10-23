import { test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";

test("2024 quarterback rushing volume and efficiency track the historical league", async (t) => {
  const year = 2024;
  const history = await loadHistoryData();
  setHistoryData(history);
  const actual = history.stats(year).reduce((sum, row) => {
    const position = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
    if (position === "QB") {
      sum.attempts += row.line.rushAtt ?? 0;
      sum.yards += row.line.rushYds ?? 0;
    }
    return sum;
  }, { attempts: 0, yards: 0 });
  const seeds = [20241023, 20241024, 20241025, 20241026];
  const simulated = { attempts: 0, yards: 0 };

  for (const seed of seeds) {
    let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed });
    // Stop at the regular-season boundary. Including playoffs here compares a longer simulated
    // sample to the historical regular-season line and can hide underproduction per game.
    save = simUntil(save, (state) => state.year === year && state.phase === "playoffs");
    for (const game of save.schedule) {
      if (game.year !== year || game.phase !== "regular") continue;
      for (const box of [game.boxHome ?? [], game.boxAway ?? []]) {
        for (const row of box) {
          if (save.players[row.playerId]?.pos !== "QB") continue;
          simulated.attempts += row.rushAtt ?? 0;
          simulated.yards += row.rushYds ?? 0;
        }
      }
    }
  }

  const attemptRatio = simulated.attempts / (actual.attempts * seeds.length);
  const yardRatio = simulated.yards / (actual.yards * seeds.length);
  const actualYpc = actual.yards / actual.attempts;
  const simulatedYpc = simulated.yards / simulated.attempts;
  const report = `four-seed sim ${simulated.attempts} carries (${attemptRatio.toFixed(2)}x actual), ${simulated.yards} yards (${yardRatio.toFixed(2)}x actual), at ${simulatedYpc.toFixed(2)} YPC vs historical ${actual.attempts} carries and ${actual.yards} yards at ${actualYpc.toFixed(2)} YPC`;

  t.diagnostic(report);
  assert.ok(attemptRatio >= 0.85 && attemptRatio <= 1.15, report);
  assert.ok(yardRatio >= 0.85 && yardRatio <= 1.15, report);
  assert.ok(Math.abs(simulatedYpc - actualYpc) <= 0.65, report);
});
