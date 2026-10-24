import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldHoldForNarration, TV_NARRATION_GRACE_MS } from "../src/lib/game/tvCountdown.ts";

test("TV calendar only gives narration a short grace period before advancing", () => {
  assert.equal(shouldHoldForNarration(0), true);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS - 1), true);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS), false);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS + 300), false);
});
