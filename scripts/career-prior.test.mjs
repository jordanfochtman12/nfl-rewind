import assert from "node:assert/strict";
import { test } from "node:test";
import { seedPriorCareer } from "../src/lib/game/data/careerPrior.ts";

test("pre-1966 career summaries keep two-point credit unknown only where the rule existed", () => {
  const namath = { firstName: "Joe", lastName: "Namath", teamId: "nyj" };
  const starr = { firstName: "Bart", lastName: "Starr", teamId: "gnb" };
  const aflLine = seedPriorCareer(namath, 1965).find((line) => line.year === 1965);
  const nflLine = seedPriorCareer(starr, 1965).find((line) => line.year === 1965);

  assert.ok(aflLine?.unknown?.includes("twoPtMade"), "the AFL allowed conversions, but the career source has no scorer credit");
  assert.ok(!nflLine?.unknown?.includes("twoPtMade"), "the NFL did not allow conversions in 1965, so zero is known");
  assert.ok(aflLine?.unknown?.includes("safeties"), "pre-1966 individual safety credit is not in the career source");
});
