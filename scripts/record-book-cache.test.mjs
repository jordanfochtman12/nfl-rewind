import { test } from "node:test";
import assert from "node:assert/strict";
import { careerRecordBook, seasonRecordBook } from "../src/lib/game/records.ts";
import { emptyStats } from "../src/lib/game/players.ts";

function saveWithRetiredRusher(id, name, yards) {
  const line = { ...emptyStats(2000, "pit"), rushAtt: Math.ceil(yards / 4), rushYds: yards };
  return {
    seed: 684221,
    year: 2001,
    teams: {},
    players: {
      [id]: {
        id,
        firstName: name,
        lastName: "Runner",
        pos: "RB",
        teamId: "retired",
        stats: {},
        career: [line],
      },
    },
  };
}

test("career record cache does not leak retired leaders between divergent saves", () => {
  const first = saveWithRetiredRusher("retired-a", "First", 18000);
  const branch = saveWithRetiredRusher("retired-b", "Second", 12000);

  const firstLeader = careerRecordBook(first, 1).find((category) => category.id === "rushYds")
    .rows[0];
  const branchLeader = careerRecordBook(branch, 1).find((category) => category.id === "rushYds")
    .rows[0];

  assert.equal(firstLeader.name, "First Runner");
  assert.equal(firstLeader.value, 18000);
  assert.equal(branchLeader.name, "Second Runner");
  assert.equal(branchLeader.value, 12000);
});

test("franchise career records display the franchise that owns the record", () => {
  const save = saveWithRetiredRusher("moved-rusher", "Moved", 9000);
  const player = save.players["moved-rusher"];
  player.teamId = "chi";

  const leader = careerRecordBook(save, 1, "pit").find((category) => category.id === "rushYds")
    .rows[0];

  assert.equal(leader.value, 9000);
  assert.equal(leader.team, "Pittsburgh Steelers");
});

test("season record rows use the club on the season stat line", () => {
  const save = saveWithRetiredRusher("season-mover", "Season", 2100);
  const player = save.players["season-mover"];
  player.teamId = "chi";
  player.stats = { 2000: { ...player.career[0] } };

  const leader = seasonRecordBook(save, 1).find((category) => category.id === "rushYds").rows[0];

  assert.equal(leader.value, 2100);
  assert.equal(leader.year, 2000);
  assert.equal(leader.team, "Pittsburgh Steelers");
});
