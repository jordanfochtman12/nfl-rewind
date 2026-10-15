/** The voices are the device's own: a line always ends, so a show never stalls on one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelSpeech, isSpeaking, speakLine, useTalking } from "../src/lib/voice/speech.ts";

test("with no device voice a line still ends, and nothing is left on the air", async () => {
  // Node has no speechSynthesis: the line closes out on its own.
  const u = { text: "With the first pick in the draft, the club selects...", onend: null, onerror: null };
  const ended = new Promise((resolve) => {
    u.onend = resolve;
  });
  speakLine(u);
  await ended;
  assert.equal(useTalking.getState().talking, false);
  cancelSpeech();
  assert.equal(isSpeaking(), false);
});
