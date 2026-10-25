/** Pro Bowl selections retain the real club and jersey data used by the broadcast cards. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, displayName } from "../src/lib/game/index.ts";
import { resolveProBowl } from "../src/lib/game/events.ts";

test("every Pro Bowl selection can render with a current team and jersey", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 4001 });
  resolveProBowl(save);
  const game = save.proBowl;
  assert.ok(game);
  for (const ids of [game.homeRoster ?? [], game.awayRoster ?? []]) {
    assert.ok(ids.length >= 20, `expected a full conference roster, got ${ids.length}`);
    const seen = new Set();
    for (const id of ids) {
      const p = save.players[id];
      assert.ok(p, `missing Pro Bowl player ${id}`);
      assert.ok(p.teamId in save.teams, `${p.firstName} ${p.lastName} has no active club`);
      assert.ok(Number.isInteger(p.jersey) && p.jersey > 0, `${p.firstName} ${p.lastName} has no jersey number`);
      assert.ok(displayName(save.year, p.teamId), `${p.firstName} ${p.lastName} has no displayable club`);
      assert.ok(!seen.has(id), `${p.firstName} ${p.lastName} appears twice on one conference roster`);
      seen.add(id);
    }
  }
});
