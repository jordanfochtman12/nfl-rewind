import { test } from "node:test";
import assert from "node:assert/strict";
import { createTVAdvance, shouldHoldForNarration, TV_NARRATION_GRACE_MS, tvMarkKey } from "../src/lib/game/tvCountdown.ts";

test("TV calendar only gives narration a short grace period before advancing", () => {
  assert.equal(shouldHoldForNarration(0), true);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS - 1), true);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS), false);
  assert.equal(shouldHoldForNarration(TV_NARRATION_GRACE_MS + 300), false);
});

test("manual Continue cancels the pending timer and timer/tap races advance only once", () => {
  let advances = 0;
  let cancelled = 0;
  const continueNow = createTVAdvance(() => advances++, () => cancelled++);

  continueNow(); // manual tap
  continueNow(); // queued zero-second timer callback

  assert.equal(advances, 1);
  assert.equal(cancelled, 1);
});

test("Record-mode draft and season cards use the same mark key when checking and continuing", () => {
  const seen = new Set([tvMarkKey("record-draft", 1966), tvMarkKey("record-season", 1966)]);

  assert.equal(seen.has(tvMarkKey("record-draft", 1966)), true);
  assert.equal(seen.has(tvMarkKey("record-season", 1966)), true);
  assert.equal(seen.has(tvMarkKey("record-season", 1967)), false);
});
