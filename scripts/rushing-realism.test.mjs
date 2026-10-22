/**
 * Keep early-era rushing close to the real record. The fixed seed set catches drift in both
 * play volume and yards per carry without hard-coding a particular player's season line.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, loadHistoryData, simUntil } from "../src/lib/game/index.ts";

test("1966 rushing attempts and efficiency track the historical league", async () => {
  const history = await loadHistoryData();
  const actual = history.stats(1966).reduce(
    (totals, row) => ({
      attempts: totals.attempts + (row.line.rushAtt ?? 0),
      yards: totals.yards + (row.line.rushYds ?? 0),
    }),
    { attempts: 0, yards: 0 },
  );
  const simulated = { attempts: 0, yards: 0 };
  const actualByPosition = new Map();
  const simulatedByPosition = new Map();

  for (const row of history.stats(1966)) {
    const pos = history.seasonPos(1966).get(row.person) ?? history.people[row.person]?.pos;
    if (!pos) continue;
    actualByPosition.set(pos, (actualByPosition.get(pos) ?? 0) + (row.line.rushAtt ?? 0));
  }

  for (const seed of [4242, 70122, 13001]) {
    let save = createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed });
    save = simUntil(save, (state) => state.year > 1966 || state.phase === "complete");
    for (const player of Object.values(save.players)) {
      const line = player.stats[1966];
      const attempts = line?.rushAtt ?? 0;
      simulated.attempts += attempts;
      simulated.yards += line?.rushYds ?? 0;
      simulatedByPosition.set(player.pos, (simulatedByPosition.get(player.pos) ?? 0) + attempts);
    }
  }

  const simulatedYpc = simulated.yards / simulated.attempts;
  const actualYpc = actual.yards / actual.attempts;
  const positionReport = ["RB", "FB", "QB"]
    .map((pos) => `${pos} ${(100 * (simulatedByPosition.get(pos) ?? 0) / simulated.attempts).toFixed(1)}%/${(100 * (actualByPosition.get(pos) ?? 0) / actual.attempts).toFixed(1)}%`)
    .join(", ");
  assert.ok(
    Math.abs(simulated.attempts / 3 - actual.attempts) / actual.attempts <= 0.04,
    `simulated ${Math.round(simulated.attempts / 3)} carries per season vs historical ${actual.attempts}; YPC ${simulatedYpc.toFixed(2)}/${actualYpc.toFixed(2)}; shares ${positionReport}`,
  );
  assert.ok(
    Math.abs(simulatedYpc - actualYpc) <= 0.2,
    `simulated ${simulatedYpc.toFixed(2)} yards per carry vs historical ${actualYpc.toFixed(2)}; shares ${positionReport}`,
  );
  for (const [pos, tolerance] of [["RB", 0.05], ["FB", 0.05], ["QB", 0.03]]) {
    const simulatedShare = (simulatedByPosition.get(pos) ?? 0) / simulated.attempts;
    const actualShare = (actualByPosition.get(pos) ?? 0) / actual.attempts;
    assert.ok(
      Math.abs(simulatedShare - actualShare) <= tolerance,
      `${pos} carried ${(simulatedShare * 100).toFixed(1)}% of simulated attempts vs ${(actualShare * 100).toFixed(1)}% historically; YPC ${simulatedYpc.toFixed(2)}/${actualYpc.toFixed(2)}`,
    );
  }
});

test("fullback and quarterback roles transition across the late 1960s", async () => {
  const history = await loadHistoryData();
  let save = createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed: 4242 });
  save = simUntil(save, (state) => state.year > 1969 || state.phase === "complete");

  for (const year of [1967, 1968, 1969]) {
    const actual = new Map();
    const simulated = new Map();
    let actualAttempts = 0;
    let actualYards = 0;
    let simAttempts = 0;
    let simYards = 0;
    for (const row of history.stats(year)) {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (!pos) continue;
      const bucket = actual.get(pos) ?? { attempts: 0, yards: 0 };
      bucket.attempts += row.line.rushAtt ?? 0;
      bucket.yards += row.line.rushYds ?? 0;
      actual.set(pos, bucket);
      actualAttempts += row.line.rushAtt ?? 0;
      actualYards += row.line.rushYds ?? 0;
    }
    for (const player of Object.values(save.players)) {
      const line = player.stats[year];
      if (!line) continue;
      const bucket = simulated.get(player.pos) ?? { attempts: 0, yards: 0 };
      bucket.attempts += line.rushAtt ?? 0;
      bucket.yards += line.rushYds ?? 0;
      simulated.set(player.pos, bucket);
      simAttempts += line.rushAtt ?? 0;
      simYards += line.rushYds ?? 0;
    }
    assert.ok(
      Math.abs(simAttempts - actualAttempts) / actualAttempts <= 0.06,
      `${year}: ${simAttempts} rushing attempts vs historical ${actualAttempts}`,
    );
    assert.ok(
      Math.abs(simYards / simAttempts - actualYards / actualAttempts) <= 0.25,
      `${year}: ${(simYards / simAttempts).toFixed(2)} yards per carry vs historical ${(actualYards / actualAttempts).toFixed(2)}`,
    );
    for (const [pos, tolerance] of [["RB", 0.04], ["FB", 0.04], ["QB", 0.03]]) {
      const simShare = (simulated.get(pos)?.attempts ?? 0) / simAttempts;
      const actualShare = (actual.get(pos)?.attempts ?? 0) / actualAttempts;
      assert.ok(
        Math.abs(simShare - actualShare) <= tolerance,
        `${year}: ${pos} share ${(simShare * 100).toFixed(1)}% vs historical ${(actualShare * 100).toFixed(1)}%`,
      );
    }
  }
});
