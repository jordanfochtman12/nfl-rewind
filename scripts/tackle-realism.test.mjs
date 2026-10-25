/** Defensive tackle totals include helpers; keep the sim's totals and role mix close to history. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simGame, simUntil } from "../src/lib/game/index.ts";

const DEFENSE = ["DE", "DT", "MLB", "OLB", "CB", "S"];
const YEARS = [1999, 2009, 2019, 2024];
let historical;
let simulated;

before(async () => {
  const history = await loadHistoryData();
  setHistoryData(history);
  historical = {};
  simulated = {};
  for (const year of YEARS) {
    historical[year] = Object.fromEntries(DEFENSE.map((pos) => [pos, 0]));
    for (const row of history.stats(year)) {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (pos in historical[year]) historical[year][pos] += row.line.tackles ?? 0;
    }

    let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed: 9711 });
    save = simUntil(save, (state) => state.year > year || state.phase === "complete");
    simulated[year] = Object.fromEntries(DEFENSE.map((pos) => [pos, 0]));
    for (const player of Object.values(save.players)) {
      if (player.pos in simulated[year]) simulated[year][player.pos] += player.stats[year]?.tackles ?? 0;
    }
  }
});

test("assist attribution is deterministic and does not make outcome depend on run order", () => {
  const make = () => createEraGame({ userTeamId: "pit", startingYear: 1999, sandbox: true, seed: 9711 });
  const game = {
    id: "tackle-audit-pit-cle-1999",
    year: 1999,
    week: 1,
    phase: "regular",
    homeId: "pit",
    awayId: "cle",
    homeScore: 0,
    awayScore: 0,
    played: false,
  };

  const firstSave = make();
  const firstGame = { ...game };
  const secondSave = make();
  const secondGame = { ...game };
  simGame(firstSave, firstGame);
  simGame(secondSave, secondGame);
  assert.equal(firstSave.rng, secondSave.rng);
  assert.deepEqual(firstGame, secondGame, "the same seed and game identity reproduce the same box score and play log");
});

test("simulated defensive tackle totals and position shares track four historical eras", () => {
  for (const year of YEARS) {
    const historicalTotal = Object.values(historical[year]).reduce((total, value) => total + value, 0);
    const simulatedTotal = Object.values(simulated[year]).reduce((total, value) => total + value, 0);
    const error = Math.abs(simulatedTotal - historicalTotal) / historicalTotal;
    const report = DEFENSE.map((pos) => {
      const real = historical[year][pos] / historicalTotal;
      const sim = simulated[year][pos] / simulatedTotal;
      return `${pos} ${(100 * sim).toFixed(1)}% vs ${(100 * real).toFixed(1)}%`;
    }).join(", ");

    assert.ok(historicalTotal > 0, `${year} historical defensive tackle data is available`);
    assert.ok(error <= 0.1, `${year} simulated ${simulatedTotal} tackles vs historical ${historicalTotal} (${(error * 100).toFixed(1)}% error); ${report}`);
    for (const pos of DEFENSE) {
      const realShare = historical[year][pos] / historicalTotal;
      const simShare = simulated[year][pos] / simulatedTotal;
      assert.ok(Math.abs(simShare - realShare) <= 0.06, `${year} ${pos} share ${(100 * simShare).toFixed(1)}% vs historical ${(100 * realShare).toFixed(1)}%; ${report}`);
    }
  }
});
