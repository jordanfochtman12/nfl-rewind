import { test } from "node:test";
import assert from "node:assert/strict";
import { footballSpeech } from "./footballSpeech.ts";

test("football speech expands the requested State abbreviation and common 1-0 record", () => {
  assert.equal(footballSpeech("S.T. opens 1-0 after the win.", 2025), "State opens one and oh after the win.");
});

test("record expansion does not change scorelines or numeric ranges", () => {
  assert.equal(footballSpeech("The score is 10-0 after a 1966-67 season.", 1967), "The score is 10-0 after a 1966-67 season.");
});
