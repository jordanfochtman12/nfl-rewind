import { before, test } from "node:test";
import assert from "node:assert/strict";
import { activeTeamIds, createEraGame, gamesInSeason, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";
import { opponentFumbleRecoveryChance } from "../src/lib/game/sim.ts";

const WINDOWS = [
  { year: 2000, seeds: [7211, 7212, 7213, 7214] },
  { year: 2024, seeds: [7211, 7212, 7213, 7214] },
];
const DEFENSE = new Set(["DE", "DT", "OLB", "MLB", "CB", "S"]);
let history;
const results = new Map();

before(async () => {
  history = await loadHistoryData();
  setHistoryData(history);
  for (const sample of WINDOWS) {
    const { year, seeds } = sample;
    const actualRows = history.stats(year);
    // History's `fr` field maps to nflverse fumble_recovery_opp, so compare only
    // defensive recoveries in the sim, not a runner recovering his own fumble.
    const actual = {
      fr: actualRows.reduce((sum, row) => sum + (row.line.fr ?? 0), 0),
      ff: actualRows.reduce((sum, row) => sum + (row.line.ff ?? 0), 0),
    };
    const simulated = { fr: 0, ff: 0 };
    for (const seed of seeds) {
      let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed });
      save = simUntil(save, (state) => state.year === year && state.phase === "playoffs");
      for (const game of save.schedule) {
        if (game.year !== year || game.phase !== "regular") continue;
        for (const box of [game.boxHome ?? [], game.boxAway ?? []]) {
          for (const row of box) {
            const pos = save.players[row.playerId]?.pos;
            if (DEFENSE.has(pos)) simulated.fr += row.fr ?? 0;
            simulated.ff += row.ff ?? 0;
          }
        }
      }
    }
    sample.actual = actual;
    sample.simulated = simulated;
    sample.actualTeamGames = activeTeamIds(year).length * gamesInSeason(year);
    sample.rates = {
      frActual: actual.fr / sample.actualTeamGames,
      frSimulated: simulated.fr / (seeds.length * sample.actualTeamGames),
      ffActual: actual.ff / sample.actualTeamGames,
      ffSimulated: simulated.ff / (seeds.length * sample.actualTeamGames),
    };
    sample.report = `${year}: opponent FR ${sample.rates.frSimulated.toFixed(3)} vs ${sample.rates.frActual.toFixed(3)} per team-game; FF ${sample.rates.ffSimulated.toFixed(3)} vs ${sample.rates.ffActual.toFixed(3)}`;
    results.set(year, sample);
  }
});

test("fumble recovery chance follows the measured modern historical eras", () => {
  assert.equal(opponentFumbleRecoveryChance(1998), 0.48, "keep pre-1999 behavior where comparable data is missing");
  assert.equal(opponentFumbleRecoveryChance(1998, 0.52), 0.52, "preserve the prior sack recovery chance before calibration data exists");
  assert.equal(opponentFumbleRecoveryChance(1998, 0.5), 0.5, "preserve the prior receiving recovery chance before calibration data exists");
  assert.equal(opponentFumbleRecoveryChance(1999), 0.724);
  assert.equal(opponentFumbleRecoveryChance(2008), 0.685);
  assert.equal(opponentFumbleRecoveryChance(2016), 0.665);
});

for (const { year } of WINDOWS) {
  test(`${year} fumble recoveries and forced fumbles track historical records`, (t) => {
    const sample = results.get(year);
    assert.ok(sample, `the ${year} historical sample completed`);
    const { rates, report } = sample;
    t.diagnostic(report);
    assert.ok(rates.frSimulated / rates.frActual >= 0.78 && rates.frSimulated / rates.frActual <= 1.22, `${year} opponent recoveries: ${report}`);
    assert.ok(rates.ffSimulated / rates.ffActual >= 0.8 && rates.ffSimulated / rates.ffActual <= 1.2, `${year} forced fumbles: ${report}`);
  });
}
