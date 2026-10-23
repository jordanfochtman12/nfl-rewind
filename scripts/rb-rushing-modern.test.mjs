import { test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";

test("2024 regular-season RB carry volume and efficiency track historical league output", async (t) => {
  const year = 2024;
  const history = await loadHistoryData();
  setHistoryData(history);
  const actual = history.stats(year).reduce(
    (sum, row) => {
      const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
      if (pos === "RB") {
        sum.attempts += row.line.rushAtt ?? 0;
        sum.yards += row.line.rushYds ?? 0;
      }
      return sum;
    },
    { attempts: 0, yards: 0 },
  );
  const actualByTeam = new Map();
  for (const row of history.stats(year)) {
    const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
    if (pos !== "RB" || !row.team) continue;
    const backs = actualByTeam.get(row.team) ?? new Map();
    backs.set(row.person, (backs.get(row.person) ?? 0) + (row.line.rushAtt ?? 0));
    actualByTeam.set(row.team, backs);
  }
  const seeds = [20241031, 20241032, 20241033, 20241034];
  const simulated = { attempts: 0, yards: 0 };
  const simulatedByTeam = new Map();

  for (const seed of seeds) {
    let save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed });
    // Stop as soon as the regular season ends so the sample matches the historical
    // regular-season reference instead of mixing regular-season and playoff boxes.
    save = simUntil(save, (state) => state.year === year && state.phase === "playoffs");
    for (const game of save.schedule) {
      if (game.year !== year || game.phase !== "regular") continue;
      for (const [teamId, box] of [[game.homeId, game.boxHome ?? []], [game.awayId, game.boxAway ?? []]]) {
        for (const row of box) {
          if (save.players[row.playerId]?.pos !== "RB") continue;
          simulated.attempts += row.rushAtt ?? 0;
          simulated.yards += row.rushYds ?? 0;
          // Each seed is a separate season sample. Combining four seasons under one team before
          // counting 50-carry backs made those counts incomparable to the single real season.
          const teamSample = `${seed}:${teamId}`;
          const backs = simulatedByTeam.get(teamSample) ?? new Map();
          backs.set(row.playerId, (backs.get(row.playerId) ?? 0) + (row.rushAtt ?? 0));
          simulatedByTeam.set(teamSample, backs);
        }
      }
    }
  }

  const attemptsPerSeason = simulated.attempts / seeds.length;
  const yardsPerSeason = simulated.yards / seeds.length;
  const attemptRatio = attemptsPerSeason / actual.attempts;
  const actualYpc = actual.yards / actual.attempts;
  const simulatedYpc = simulated.yards / simulated.attempts;
  const workload = (byTeam) => {
    const teams = [...byTeam.values()].map((backs) => [...backs.values()].sort((a, b) => b - a)).filter((carries) => carries.length);
    return {
      leadShare: teams.reduce((sum, carries) => sum + carries[0] / carries.reduce((a, b) => a + b, 0), 0) / teams.length,
      topTwoShare: teams.reduce((sum, carries) => sum + carries.slice(0, 2).reduce((a, b) => a + b, 0) / carries.reduce((a, b) => a + b, 0), 0) / teams.length,
      backs50: teams.reduce((sum, carries) => sum + carries.filter((attempts) => attempts >= 50).length, 0) / teams.length,
      rankShares: [0, 1, 2, 3].map((rank) => teams.reduce((sum, carries) => sum + (carries[rank] ?? 0) / carries.reduce((a, b) => a + b, 0), 0) / teams.length),
      rank50: [0, 1, 2, 3].map((rank) => teams.filter((carries) => (carries[rank] ?? 0) >= 50).length / teams.length),
    };
  };
  const actualWorkload = workload(actualByTeam);
  const simulatedWorkload = workload(simulatedByTeam);
  const byRank = (workload) => workload.rankShares.map((share) => share.toFixed(3)).join("/");
  const fiftyByRank = (workload) => workload.rank50.map((count) => count.toFixed(2)).join("/");
  const report = `four-seed 2024 regular-season sim averages ${attemptsPerSeason.toFixed(0)} RB carries (${attemptRatio.toFixed(2)}x actual) and ${yardsPerSeason.toFixed(0)} yards at ${simulatedYpc.toFixed(2)} YPC vs historical ${actual.attempts} carries and ${actual.yards} yards at ${actualYpc.toFixed(2)} YPC; lead share ${simulatedWorkload.leadShare.toFixed(3)} vs ${actualWorkload.leadShare.toFixed(3)}, top-two share ${simulatedWorkload.topTwoShare.toFixed(3)} vs ${actualWorkload.topTwoShare.toFixed(3)}, 50+ carry backs/team ${simulatedWorkload.backs50.toFixed(2)} vs ${actualWorkload.backs50.toFixed(2)}; ranked carry shares RB1/RB2/RB3/RB4+ ${byRank(simulatedWorkload)} vs ${byRank(actualWorkload)}, ranked 50+ counts ${fiftyByRank(simulatedWorkload)} vs ${fiftyByRank(actualWorkload)}`;

  t.diagnostic(report);
  assert.ok(attemptRatio >= 0.85 && attemptRatio <= 1.15, report);
  assert.ok(Math.abs(simulatedYpc - actualYpc) <= 0.28, report);
  assert.ok(Math.abs(simulatedWorkload.leadShare - actualWorkload.leadShare) <= 0.04, report);
  assert.ok(Math.abs(simulatedWorkload.topTwoShare - actualWorkload.topTwoShare) <= 0.1, report);
  assert.ok(Math.abs(simulatedWorkload.backs50 - actualWorkload.backs50) <= 0.75, report);
  assert.ok(simulatedWorkload.rankShares.every((share, rank) => Math.abs(share - actualWorkload.rankShares[rank]) <= 0.05), report);
});
