import { test } from "node:test";
import assert from "node:assert/strict";
import { castVoices, voiceChoices, voiceLabel } from "./voiceCast.ts";

// iOS names an Enhanced or Premium voice the same as its compact one; only the voiceURI differs.
const ios = [
  { name: "Daniel", lang: "en-GB", voiceURI: "com.apple.voice.compact.en-GB.Daniel" },
  { name: "Daniel", lang: "en-GB", voiceURI: "com.apple.voice.enhanced.en-GB.Daniel" },
  { name: "Tom", lang: "en-US", voiceURI: "com.apple.voice.enhanced.en-US.Tom" },
  { name: "Zoe", lang: "en-US", voiceURI: "com.apple.voice.premium.en-US.Zoe" },
  { name: "Trinoids", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Trinoids" },
  { name: "Samantha", lang: "en-US", voiceURI: "com.apple.voice.compact.en-US.Samantha" },
];

test("the voice menu lists every Enhanced and Premium voice, labeled, best first, no novelty voices", () => {
  const labels = voiceChoices(ios).map(voiceLabel);
  assert.deepEqual(labels, ["Zoe · Premium · US", "Daniel · Enhanced · UK", "Tom · Enhanced · US", "Daniel · UK", "Samantha · US"]);
});

test("a chosen voice is found by its voiceURI, and an old saved name takes the best version", () => {
  const pick = (preferred: string) => castVoices(ios, [{ key: "pbp", gender: "m" }], preferred).get("pbp")?.voice?.voiceURI;
  assert.equal(pick("com.apple.voice.enhanced.en-US.Tom"), "com.apple.voice.enhanced.en-US.Tom");
  assert.equal(pick("com.apple.voice.compact.en-GB.Daniel"), "com.apple.voice.compact.en-GB.Daniel");
  assert.equal(pick("Daniel"), "com.apple.voice.enhanced.en-GB.Daniel");
});
