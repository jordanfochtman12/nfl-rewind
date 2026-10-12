/// <reference lib="webworker" />
/**
 * The studio's voices: Kokoro-82M (Apache-2.0), a neural text-to-speech model that runs on the
 * viewer's own device. Loaded once (about 90 MB, cached by the browser after that) and kept off
 * the main thread so the broadcast never stutters while a line is being read.
 */
import { KokoroTTS } from "kokoro-js";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
let tts: Promise<KokoroTTS> | undefined;
const files = new Map<string, { loaded: number; total: number }>();

/** The GPU when the browser offers one (much faster; the full-precision model the GPU wants). */
async function gpu(): Promise<boolean> {
  try {
    const g = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    return !!g && !!(await g.requestAdapter());
  } catch {
    return false;
  }
}

function open(device: "webgpu" | "wasm"): Promise<KokoroTTS> {
  return KokoroTTS.from_pretrained(MODEL, {
    dtype: device === "webgpu" ? "fp32" : "q8",
    device,
    progress_callback: (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file || !p.total) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      self.postMessage({ type: "progress", loaded, total });
    },
  });
}

function load(): Promise<KokoroTTS> {
  tts ??= gpu()
    .then((g) => (g ? open("webgpu").catch(() => open("wasm")) : open("wasm")))
    .then(async (t) => {
      // A short read to learn how fast this device makes speech (1 = real time).
      const t0 = performance.now();
      const a = await t.generate("The studio is ready. Let's go to the field.", { voice: "am_michael" as never });
      const secs = a.audio.length / a.sampling_rate;
      self.postMessage({ type: "ready", rtf: (performance.now() - t0) / 1000 / Math.max(0.5, secs) });
      return t;
    })
    .catch((err: unknown) => {
      tts = undefined;
      self.postMessage({ type: "failed", message: String(err) });
      throw err;
    });
  return tts;
}

type Job = { id: number; text: string; voice: string; speed: number; now: boolean };
/** Lines waiting to be made: a line wanted on the air now goes ahead of read-ahead work. */
const jobs: Job[] = [];
let busy = false;

async function pump(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const t = await load();
    while (jobs.length) {
      const k = jobs.findIndex((j) => j.now);
      const job = jobs.splice(k >= 0 ? k : 0, 1)[0]!;
      try {
        const audio = await t.generate(job.text, { voice: job.voice as never, speed: job.speed });
        const pcm = audio.audio as Float32Array;
        self.postMessage({ type: "audio", id: job.id, pcm, rate: audio.sampling_rate }, [pcm.buffer]);
      } catch (err) {
        self.postMessage({ type: "error", id: job.id, message: String(err) });
      }
    }
  } catch (err) {
    for (const j of jobs.splice(0)) self.postMessage({ type: "error", id: j.id, message: String(err) });
  } finally {
    busy = false;
  }
}

self.onmessage = (e: MessageEvent<{ type: "load" } | { type: "urgent"; id: number } | ({ type: "say" } & Job)>) => {
  const m = e.data;
  if (m.type === "load") {
    void load().catch(() => {});
    return;
  }
  if (m.type === "urgent") {
    const j = jobs.find((x) => x.id === m.id);
    if (j) j.now = true;
    return;
  }
  jobs.push({ id: m.id, text: m.text, voice: m.voice, speed: m.speed, now: m.now });
  void pump();
};
