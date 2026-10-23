/** Sample the full league at every major uniform-number rule change and into future rosters. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeTeamIds, createNewGame, rosterOf } from "../src/lib/game/index.ts";
import { jerseyLegal } from "../src/lib/game/names.ts";

test("league rosters have no duplicate numbers and respect each era's position bands", () => {
  // Check every supported season so narrow rule transitions (especially the 2015
  // linebacker change and 2023 number zero) cannot hide between sampled eras.
  for (let year = 1966; year <= 2040; year += 1) {
    const save = createNewGame({ userTeamId: "pit", startingYear: year, cpuOnly: true, seed: year + 20 });
    for (const teamId of activeTeamIds(year)) {
      const seen = new Map();
      for (const p of rosterOf(save, teamId)) {
        const prior = seen.get(p.jersey);
        assert.equal(prior, undefined, `${year} ${teamId}: ${p.firstName} ${p.lastName} shares #${p.jersey} with ${prior ?? "another player"}`);
        seen.set(p.jersey, p.id);
        const rookieYear = p.draftYear ?? year - (p.yearsPro ?? 0);
        assert.ok(
          rookieYear < 1973 || jerseyLegal(p.pos, year, p.jersey) || p.jersey === p.recordNo,
          `${year} ${teamId}: ${p.firstName} ${p.lastName} (${p.pos}) wears illegal #${p.jersey}`,
        );
      }
    }
  }
});
