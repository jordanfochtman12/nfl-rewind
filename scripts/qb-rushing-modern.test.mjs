import { test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";
import { isFriend } from "../src/lib/game/data/friends.ts";

test("modern quarterback rushing volume and efficiency track each historical season", async (t) => {
  const history = await loadHistoryData();
  setHistoryData(history);
  // 2025 is intentionally not a calibration year: its final archived stats include real
  // season-long injury absences that a new alternate-timeline season does not replay.
  const years = [2020, 2021, 2022, 2023, 2024];
  const seasons = years.map((year) => {
    const actual = history.stats(year).reduce((sum, row) => {
      const position = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (position === "QB") {
        sum.attempts += row.line.rushAtt ?? 0;
        sum.yards += row.line.rushYds ?? 0;
      }
      return sum;
    }, { attempts: 0, yards: 0 });
    return { year, actual, simulated: { attempts: 0, yards: 0 }, seeds: year === 2024
      ? [20241023, 20241024, 20241025, 20241026]
      : [year * 100 + 23, year * 100 + 24] };
  });

  const failures = [];
  for (const season of seasons) {
    for (const seed of season.seeds) {
      let save = createEraGame({ userTeamId: "pit", startingYear: season.year, sandbox: true, seed });
      // Stop at the regular-season boundary. Including playoffs compares a longer simulated
      // sample to the historical regular-season line and can hide underproduction per game.
      save = simUntil(save, (state) => state.year === season.year && state.phase === "playoffs");
      for (const game of save.schedule) {
        if (game.year !== season.year || game.phase !== "regular") continue;
        for (const box of [game.boxHome ?? [], game.boxAway ?? []]) {
          for (const row of box) {
            const player = save.players[row.playerId];
            if (player?.pos !== "QB" || isFriend(player)) continue;
            season.simulated.attempts += row.rushAtt ?? 0;
            season.simulated.yards += row.rushYds ?? 0;
          }
        }
      }
    }

    const attemptRatio = season.simulated.attempts / (season.actual.attempts * season.seeds.length);
    const yardRatio = season.simulated.yards / (season.actual.yards * season.seeds.length);
    const actualYpc = season.actual.yards / season.actual.attempts;
    const simulatedYpc = season.simulated.yards / season.simulated.attempts;
    const report = `${season.year}: ${season.seeds.length}-seed sim ${season.simulated.attempts} carries (${attemptRatio.toFixed(2)}x actual), ${season.simulated.yards} yards (${yardRatio.toFixed(2)}x actual), ${simulatedYpc.toFixed(2)} YPC vs historical ${season.actual.attempts} carries and ${season.actual.yards} yards at ${actualYpc.toFixed(2)} YPC`;

    t.diagnostic(report);
    if (attemptRatio < 0.85 || attemptRatio > 1.15) failures.push(`${season.year} attempt volume: ${report}`);
    if (yardRatio < 0.85 || yardRatio > 1.15) failures.push(`${season.year} yard volume: ${report}`);
    if (Math.abs(simulatedYpc - actualYpc) > 0.25) failures.push(`${season.year} yards per carry: ${report}`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});
