/** The studio voices: casting the desk and cutting reads into sentences. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { HD_VOICES, hdVoiceFor, sentences } from "../src/lib/voice/studioVoice.ts";
import { useSettings } from "../src/lib/settings-store.ts";

test("every broadcaster gets a voice of his or her own, and a chair the viewer recast wins", () => {
  const host = hdVoiceFor({ key: "Walt Prescott", gender: "m", chair: "host" });
  const analyst = hdVoiceFor({ key: "Hank Mullins", gender: "m", chair: "analyst" });
  const reporter = hdVoiceFor({ key: "Bob Kessler", gender: "m", chair: "reporter" });
  assert.equal(new Set([host, analyst, reporter]).size, 3, "three men on the desk, three voices");
  assert.equal(hdVoiceFor({ key: "Walt Prescott", gender: "m", chair: "host" }), host, "a person keeps his voice");
  const her = hdVoiceFor({ key: "Andrea Kremer", gender: "f", chair: "reporter" });
  assert.ok(HD_VOICES.find((v) => v.id === her)?.gender === "f");
  useSettings.getState().set({ hdCast: { host: "bm_george" } });
  assert.equal(hdVoiceFor({ key: "Walt Prescott", gender: "m", chair: "host" }), "bm_george");
  useSettings.getState().set({ hdCast: {} });
});

test("reads split at sentence ends so the first words air while the rest are made", () => {
  assert.deepEqual(sentences("Starr drops back to throw. He fires deep for Dowler! Touchdown, Green Bay!"), ["Starr drops back to throw.", "He fires deep for Dowler!", "Touchdown, Green Bay!"]);
  const s = sentences("The Packers win it, twelve to six, and the Lions go home with the loss. Rivalry week. These two don't like each other.");
  assert.ok(s.length >= 2 && s.join(" ").replace(/\s+/g, " ") === "The Packers win it, twelve to six, and the Lions go home with the loss. Rivalry week. These two don't like each other.");
  assert.ok(s.every((x) => x.length >= 18), "no tiny fragments on their own");
  assert.deepEqual(sentences("No punctuation at all"), ["No punctuation at all"]);
  assert.deepEqual(sentences("Wow. What a catch by Dowler there."), ["Wow. What a catch by Dowler there."], "a one-word sentence rides with the next");
});
