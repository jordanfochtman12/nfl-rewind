import { test } from "node:test";
import assert from "node:assert/strict";
import { castVoices, PHONE_VOICE, voiceChoices, voiceLabel } from "./voiceCast.ts";

// iOS names an Enhanced or Premium voice the same as its compact one; only the voiceURI differs.
const ios = [
  { name: "Daniel", lang: "en-GB", voiceURI: "com.apple.voice.compact.en-GB.Daniel" },
  { name: "Daniel", lang: "en-GB", voiceURI: "com.apple.voice.enhanced.en-GB.Daniel" },
  { name: "Tom", lang: "en-US", voiceURI: "com.apple.voice.enhanced.en-US.Tom" },
  { name: "Zoe", lang: "en-US", voiceURI: "com.apple.voice.premium.en-US.Zoe" },
  { name: "Trinoids", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Trinoids" },
  { name: "Samantha", lang: "en-US", voiceURI: "com.apple.voice.compact.en-US.Samantha" },
  { name: "Samantha", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.samantha" },
  { name: "Ralph", lang: "en-US", voiceURI: "com.apple.speech.synthesis.voice.Ralph" },
];

test("the voice menu lists every Enhanced and Premium voice, labeled, best first, no novelty voices, no doubles", () => {
  const labels = voiceChoices(ios).map(voiceLabel);
  assert.deepEqual(labels, ["Zoe · Premium · US", "Daniel · Enhanced · UK", "Tom · Enhanced · US", "Daniel · UK", "Samantha · US"]);
});

test("a chosen voice is found by its voiceURI, and an old saved name takes the best version", () => {
  const pick = (preferred: string) => castVoices(ios, [{ key: "pbp", gender: "m" }], preferred).get("pbp")?.voice?.voiceURI;
  assert.equal(pick("com.apple.voice.enhanced.en-US.Tom"), "com.apple.voice.enhanced.en-US.Tom");
  assert.equal(pick("com.apple.voice.compact.en-GB.Daniel"), "com.apple.voice.compact.en-GB.Daniel");
  assert.equal(pick("Daniel"), "com.apple.voice.enhanced.en-GB.Daniel");
});

test("the phone's-voice choice leaves the lead voice unset so the phone picks it", () => {
  const cast = castVoices(ios, [{ key: "pbp", gender: "m" }, { key: "color", gender: "m" }], PHONE_VOICE);
  assert.equal(cast.get("pbp")?.voice, undefined);
  assert.ok(cast.get("color")?.voice);
});
