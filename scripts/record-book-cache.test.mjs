import { test } from "node:test";
import assert from "node:assert/strict";
import { careerRecordBook } from "../src/lib/game/records.ts";
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
