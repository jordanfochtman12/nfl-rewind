/** Audit actual historical rosters at uniform-rule transitions and the newest archive year. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { activeTeamIds, createEraGame, loadHistoryData, rosterOf, setHistoryData } from "../src/lib/game/index.ts";
import { jerseyLegal } from "../src/lib/game/names.ts";

before(async () => setHistoryData(await loadHistoryData()));

test("historical era-start rosters have unique numbers legal for their season", () => {
  // Cover the first grandfathered-number season, the 1973 baseline, 2002 opening-day
  // records, position-band updates, modern zero eligibility, and the archive endpoint.
  for (const year of [1966, 1972, 1973, 2002, 2015, 2021, 2023, 2024, 2026]) {
    const save = createEraGame({ userTeamId: "pit", startingYear: year, sandbox: true, seed: year + 20 });
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
