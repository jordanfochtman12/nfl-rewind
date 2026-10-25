import { test } from "node:test";
import assert from "node:assert/strict";

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.volume = 1;
  }
}

test("a real line clears an orphaned silent speech queue before speaking", async () => {
  const spoken = [];
  const synthesis = {
    speaking: true,
    pending: true,
    paused: false,
    cancelCount: 0,
    getVoices() {
      return [];
    },
    cancel() {
      this.cancelCount += 1;
      this.speaking = false;
      this.pending = false;
    },
    resume() {
      this.paused = false;
      return Promise.resolve();
    },
    speak(utterance) {
      spoken.push(utterance.text);
      this.pending = false;
      this.speaking = true;
      setTimeout(() => {
        this.speaking = false;
        utterance.onend?.call(utterance, new Event("end"));
      }, 0);
    },
  };
  globalThis.SpeechSynthesisUtterance = FakeUtterance;
  globalThis.window = {
    speechSynthesis: synthesis,
    addEventListener() {},
  };

  const { speakLine, useTalking } = await import("../src/lib/voice/speech.ts?orphan-queue-test");
  const line = new FakeUtterance("The broadcast is back on the air.");
  const ended = new Promise((resolve) => {
    line.onend = resolve;
  });

  speakLine(line);
  await ended;

  assert.equal(synthesis.cancelCount, 1);
  assert.deepEqual(spoken, [line.text]);
  assert.equal(useTalking.getState().talking, false);
});
