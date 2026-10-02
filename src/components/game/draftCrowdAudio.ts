import type { DraftReaction } from "@/lib/game/draftAnnouncement";

/** Licensed human crowd recordings. Local assets, with a short broadcast fade. */
export function draftCrowdAudio() {
  const context = new AudioContext();
  const output = context.createGain();
  output.gain.value = 0.6;
  output.connect(context.destination);
  const buffers = new Map<string, AudioBuffer>();
  const ready = Promise.all(
    ["applause", "boos"].map(async (kind) => {
      const response = await fetch(`/audio/draft/${kind}.mp3`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Crowd recording unavailable");
      buffers.set(kind, await context.decodeAudioData(await response.arrayBuffer()));
    }),
  );
  // A rejected preload is handled by play; do not leave an unhandled rejection.
  void ready.catch(() => {});
  let active: AudioBufferSourceNode | undefined;
  let serial = 0;
  const stop = () => {
    serial++;
    active?.stop();
    active = undefined;
  };
  return {
    context,
    stop,
    async play(kind: DraftReaction["kind"], volume: number): Promise<void> {
      stop();
      const token = serial;
      await ready;
      if (token !== serial || context.state === "closed") return;
      const source = context.createBufferSource();
      const envelope = context.createGain();
      const filter = context.createBiquadFilter();
      const buffer = buffers.get(kind === "applause" ? "applause" : "boos")!;
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.value = kind === "murmur" ? 350 : 9500;
      const duration = Math.min(kind === "murmur" ? 1.2 : 3.2, buffer.duration);
      const offset = Math.random() * Math.max(0, buffer.duration - duration);
      const start = context.currentTime;
      const level = volume * (kind === "murmur" ? 0.12 : 0.65);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level, start + 0.12);
      envelope.gain.setValueAtTime(level, start + duration - 0.5);
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.connect(filter).connect(envelope).connect(output);
      active = source;
      await new Promise<void>((resolve) => {
        let ended = false;
        const finish = () => {
          if (ended) return;
          ended = true;
          source.disconnect();
          filter.disconnect();
          envelope.disconnect();
          if (active === source) active = undefined;
          resolve();
        };
        // Interrupted mobile audio contexts must not hold the next pick forever.
        const timeout = setTimeout(
          () => {
            source.stop();
            finish();
          },
          (duration + 1.5) * 1000,
        );
        source.onended = () => {
          clearTimeout(timeout);
          finish();
        };
        source.start(start, offset, duration);
      });
    },
    close() {
      stop();
      void context.close();
    },
  };
}
