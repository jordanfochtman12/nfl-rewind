import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData } from "../src/lib/game/index.ts";

before(async () => setHistoryData(await loadHistoryData()));

test("archived All-Pro honors carry into a new dynasty's Hall eligibility record", () => {
  const save = createEraGame({ userTeamId: "gnb", startingYear: 1967, seed: 1967 });
  const starr = Object.values(save.players).find((p) => p.firstName === "Bart" && p.lastName === "Starr");
  assert.ok(starr, "Bart Starr is present on the 1967 roster");
  assert.ok(starr.honors?.allPro.includes(1966), "his real 1966 All-Pro selection is retained");
  assert.ok(save.history.awards.some((a) => a.year === 1966 && a.allPro.includes(starr.id)));

  const boyd = Object.values(save.players).find((p) => p.firstName === "Bobby" && p.lastName === "Boyd");
  assert.ok(boyd, "Bobby Boyd remains in the historical player ledger");
  assert.ok(boyd.honors?.proBowl.includes(1966), "his real 1966 Pro Bowl selection is retained");
});
