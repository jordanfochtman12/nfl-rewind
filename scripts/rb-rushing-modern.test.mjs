import { test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData, simUntil } from "../src/lib/game/index.ts";
import { isFriend } from "../src/lib/game/data/friends.ts";

function seasonWorkload(byTeam) {
  const teams = [...byTeam.values()]
    .map((backs) => [...backs.values()].sort((a, b) => b - a))
    .filter((carries) => carries.length);
  return {
    leadShare: teams.reduce((sum, carries) => sum + carries[0] / carries.reduce((a, b) => a + b, 0), 0) / teams.length,
    topTwoShare: teams.reduce((sum, carries) => sum + carries.slice(0, 2).reduce((a, b) => a + b, 0) / carries.reduce((a, b) => a + b, 0), 0) / teams.length,
    backs50: teams.reduce((sum, carries) => sum + carries.filter((attempts) => attempts >= 50).length, 0) / teams.length,
    rankShares: [0, 1, 2, 3].map((rank) => teams.reduce((sum, carries) => sum + (carries[rank] ?? 0) / carries.reduce((a, b) => a + b, 0), 0) / teams.length),
    rank50: [0, 1, 2, 3].map((rank) => teams.filter((carries) => (carries[rank] ?? 0) >= 50).length / teams.length),
  };
}

function seasonLines(history, year) {
  const rows = history.stats(year);
  const actual = rows.reduce((sum, row) => {
    const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
    if (pos === "RB") {
      sum.attempts += row.line.rushAtt ?? 0;
      sum.yards += row.line.rushYds ?? 0;
    }
    return sum;
  }, { attempts: 0, yards: 0 });
  const actualByTeam = new Map();
  for (const row of rows) {
    const pos = history.seasonPos(year).get(row.person) ?? history.people[row.person]?.pos;
    if (pos !== "RB" || !row.team) continue;
    const backs = actualByTeam.get(row.team) ?? new Map();
    backs.set(row.person, (backs.get(row.person) ?? 0) + (row.line.rushAtt ?? 0));
    actualByTeam.set(row.team, backs);
  }
  return { actual, actualWorkload: seasonWorkload(actualByTeam), simulated: { attempts: 0, yards: 0 }, simulatedByTeam: new Map() };
}

test("modern RB volume, efficiency, and substitutions track 2020-2024 league seasons", async (t) => {
  const history = await loadHistoryData();
  setHistoryData(history);
  // Use two alternate timelines for 2020-2022 and four for 2023-2024, where rank-level
  // distribution changes were specifically tuned. This matches complete season samples.
  const seasons = [2020, 2021, 2022, 2023, 2024].map((year) => ({
    year,
    seeds: year === 2020 || year >= 2023
      ? [year * 100 + 31, year * 100 + 32, year * 100 + 33, year * 100 + 34]
      : [year * 100 + 31, year * 100 + 32],
    ...seasonLines(history, year),
  }));

  for (const season of seasons) {
    for (const seed of season.seeds) {
      let save = createEraGame({ userTeamId: "pit", startingYear: season.year, sandbox: true, seed });
      save = simUntil(save, (state) => state.year === season.year && state.phase === "playoffs");
      for (const game of save.schedule) {
        if (game.year !== season.year || game.phase !== "regular") continue;
        for (const [teamId, box] of [[game.homeId, game.boxHome ?? []], [game.awayId, game.boxAway ?? []]]) {
          for (const row of box) {
            const player = save.players[row.playerId];
            if (player?.pos !== "RB" || isFriend(player)) continue;
            season.simulated.attempts += row.rushAtt ?? 0;
            season.simulated.yards += row.rushYds ?? 0;
            const teamSample = `${seed}:${teamId}`;
            const backs = season.simulatedByTeam.get(teamSample) ?? new Map();
            backs.set(row.playerId, (backs.get(row.playerId) ?? 0) + (row.rushAtt ?? 0));
            season.simulatedByTeam.set(teamSample, backs);
          }
        }
      }
    }

    const simulatedWorkload = seasonWorkload(season.simulatedByTeam);
    const attemptsPerSeason = season.simulated.attempts / season.seeds.length;
    const yardsPerSeason = season.simulated.yards / season.seeds.length;
    const attemptRatio = attemptsPerSeason / season.actual.attempts;
    const yardRatio = yardsPerSeason / season.actual.yards;
    const actualYpc = season.actual.yards / season.actual.attempts;
    const simulatedYpc = season.simulated.yards / season.simulated.attempts;
    const rankShares = (shape) => shape.rankShares.map((share) => share.toFixed(3)).join("/");
    const rankFifties = (shape) => shape.rank50.map((share) => share.toFixed(2)).join("/");
    const report = `${season.year}: ${season.seeds.length}-seed sim ${attemptsPerSeason.toFixed(0)} carries (${attemptRatio.toFixed(2)}x actual), ${yardsPerSeason.toFixed(0)} yards (${yardRatio.toFixed(2)}x actual), ${simulatedYpc.toFixed(2)} YPC vs ${actualYpc.toFixed(2)}; lead share ${simulatedWorkload.leadShare.toFixed(3)}/${season.actualWorkload.leadShare.toFixed(3)}, top-two ${simulatedWorkload.topTwoShare.toFixed(3)}/${season.actualWorkload.topTwoShare.toFixed(3)}, 50+ backs/team ${simulatedWorkload.backs50.toFixed(2)}/${season.actualWorkload.backs50.toFixed(2)}; rank RB1/RB2/RB3/RB4+ ${rankShares(simulatedWorkload)}/${rankShares(season.actualWorkload)}, 50+ rank counts ${rankFifties(simulatedWorkload)}/${rankFifties(season.actualWorkload)}`;

    t.diagnostic(report);
    assert.ok(attemptRatio >= 0.85 && attemptRatio <= 1.15, report);
    assert.ok(yardRatio >= 0.85 && yardRatio <= 1.15, report);
    assert.ok(Math.abs(simulatedYpc - actualYpc) <= 0.25, report);
    assert.ok(Math.abs(simulatedWorkload.leadShare - season.actualWorkload.leadShare) <= 0.04, report);
    assert.ok(Math.abs(simulatedWorkload.topTwoShare - season.actualWorkload.topTwoShare) <= 0.1, report);
    assert.ok(Math.abs(simulatedWorkload.backs50 - season.actualWorkload.backs50) <= 0.75, report);
    assert.ok(simulatedWorkload.rankShares.every((share, rank) => Math.abs(share - season.actualWorkload.rankShares[rank]) <= 0.05), report);
  }
});
