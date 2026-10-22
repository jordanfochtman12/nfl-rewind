import { test } from "node:test";
import assert from "node:assert/strict";
import { creditSeasonTeam, emptyStats, movePlayer } from "../src/lib/game/players.ts";
import { seasonLeaders } from "../src/lib/game/leaders.ts";
import { displayName } from "../src/lib/game/teams.ts";
import { createNewGame, simGame } from "../src/lib/game/index.ts";

test("season stat attribution changes to multi-team when the player appears for another club", () => {
  const line = emptyStats(2024, "pit");
  creditSeasonTeam(line, "pit");
  assert.equal(line.teamId, "pit", "the first and same-team appearances preserve the club");

  creditSeasonTeam(line, "rav");
  assert.equal(line.teamId, "two", "a trade marks the aggregate season line as multi-team");

  creditSeasonTeam(line, "pit");
  assert.equal(line.teamId, "two", "a later return does not erase the multi-team history");
});

test("league leader club label follows the season line rather than the player's current roster", () => {
  const traded = {
    id: "p-traded", firstName: "Test", lastName: "Runner", pos: "RB", teamId: "rav",
    stats: { 2024: { ...emptyStats(2024, "two"), rushYds: 1200 } },
  };
  const oneClub = {
    id: "p-one", firstName: "Single", lastName: "Club", pos: "RB", teamId: "pit",
    stats: { 2024: { ...emptyStats(2024, "pit"), rushYds: 900 } },
  };
  const leaders = seasonLeaders({ year: 2024, players: { [traded.id]: traded, [oneClub.id]: oneClub } });

  assert.equal(leaders.rushYds[0]?.playerId, traded.id);
  assert.equal(leaders.rushYds[0]?.team, "2 teams");
  assert.equal(leaders.rushYds[1]?.team, displayName(2024, "pit"));
});

test("box-score accumulation marks a traded player's season as multi-team", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 2241 });
  const pid = save.teams.pit.depth.QB?.[0];
  assert.ok(pid && save.players[pid], "Pittsburgh has a starting quarterback");
  const quarterback = save.players[pid];
  const play = (id, homeId, awayId) => {
    const game = { id, year: save.year, week: 1, phase: "regular", homeId, awayId,
      homeScore: 0, awayScore: 0, played: false };
    simGame(save, game);
  };

  play("stat-club-one", "pit", "cle");
  assert.ok(quarterback.stats[save.year]?.passAtt > 0, "the first club records passing stats");
  movePlayer(save, pid, "rav");
  save.teams.rav.depth.QB = [pid, ...(save.teams.rav.depth.QB ?? []).filter((id) => id !== pid)];
  play("stat-club-two", "rav", "pit");

  assert.equal(quarterback.stats[save.year]?.teamId, "two");
});
