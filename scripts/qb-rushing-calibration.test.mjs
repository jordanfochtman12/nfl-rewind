import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";
import { activeTeamIds, gamesInSeason } from "../src/lib/game/teams.ts";

let qbRushing;
before(async () => {
  const history = await loadHistoryData();
  setHistoryData(history);
  const actual = history.stats(2016).reduce((sum, row) => {
    const pos = history.seasonPos(2016).get(row.person) ?? history.people[row.person]?.pos;
    if (pos === "QB") {
      sum.attempts += row.line.rushAtt ?? 0;
      sum.yards += row.line.rushYds ?? 0;
    }
    return sum;
  }, { attempts: 0, yards: 0 });

  let save = createEraGame({ userTeamId: "pit", startingYear: 2016, sandbox: true, seed: 1716020 });
  save = simUntil(save, (state) => state.year === 2016 && state.phase === "playoffs");
  const simulated = Object.values(save.players).reduce((sum, player) => {
    const line = player.stats[2016];
    if (player.pos === "QB" && line) {
      sum.attempts += line.rushAtt ?? 0;
      sum.yards += line.rushYds ?? 0;
    }
    return sum;
  }, { attempts: 0, yards: 0 });
  qbRushing = { actual, simulated, teamGames: activeTeamIds(2016).length * gamesInSeason(2016) };
});

test("2016 quarterback rushing volume and efficiency track the real league", () => {
  const { actual, simulated, teamGames } = qbRushing;
  const attemptRatio = simulated.attempts / actual.attempts;
  const actualYpc = actual.yards / actual.attempts;
  const simulatedYpc = simulated.yards / simulated.attempts;
  const report = `simulated ${simulated.attempts} QB carries (${(simulated.attempts / teamGames).toFixed(2)}/team-game, ${attemptRatio.toFixed(2)}x actual); ${simulatedYpc.toFixed(2)} YPC vs actual ${actualYpc.toFixed(2)}`;

  assert.ok(attemptRatio >= 0.8 && attemptRatio <= 1.2, report);
  assert.ok(Math.abs(simulatedYpc - actualYpc) <= 0.55, report);
});
