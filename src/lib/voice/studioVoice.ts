/**
 * One way to put a line on the air. With studio voices on (the default), every line is read by
 * Kokoro, a neural voice model running in workers on this device, each broadcaster cast to a
 * voice of his or her own. A device that makes speech slower than it's spoken still gets the
 * studio voices: shows read ahead, the live booth makes upcoming calls before the snap, and the
 * broadcast waits for the call (useTalking) the way a telecast waits for its announcers. The
 * device's own speech engine reads only while the model is still downloading, or where it can't
 * run at all. Callers build the same SpeechSynthesisUtterance they always did and hand it here
 * with who's speaking; onend and onerror fire either way.
 */
import { create } from "zustand";
import { settingsNow } from "../settings-store.ts";

export type HdStatus = "off" | "idle" | "loading" | "ready" | "failed";

export const useHdVoice = create<{ status: HdStatus; progress: number; error?: string; rtf?: number; workers?: number }>(() => ({ status: "idle", progress: 0 }));

/** Something is on the air or about to be: lines queued, being made, or playing. */
export const useTalking = create<{ talking: boolean; making: boolean; onAir: boolean }>(() => ({ talking: false, making: false, onAir: false }));

/** The chairs a viewer can recast in Settings. */
export type Chair = "host" | "analyst" | "reporter" | "pbp" | "color" | "draft";

export interface Speaker {
  /** Stable key for the person: their name, or a chair ("PBP"). */
  key: string;
  gender?: "m" | "f";
  /** The chair, so a voice the viewer picked for it wins. */
  chair?: Chair;
}

/** Kokoro v1.0's voices, best first, with how they're labeled in Settings. */
export const HD_VOICES: { id: string; label: string; gender: "m" | "f" }[] = [
  { id: "am_michael", label: "Michael · American, warm baritone", gender: "m" },
  { id: "am_fenrir", label: "Fenrir · American, deep and gravelly", gender: "m" },
  { id: "am_puck", label: "Puck · American, bright and quick", gender: "m" },
  { id: "bm_george", label: "George · British, classic", gender: "m" },
  { id: "am_echo", label: "Echo · American, even", gender: "m" },
  { id: "bm_fable", label: "Fable · British, storyteller", gender: "m" },
  { id: "am_eric", label: "Eric · American, plain-spoken", gender: "m" },
  { id: "am_liam", label: "Liam · American, young", gender: "m" },
  { id: "bm_lewis", label: "Lewis · British, low", gender: "m" },
  { id: "am_onyx", label: "Onyx · American, dark", gender: "m" },
  { id: "bm_daniel", label: "Daniel · British, crisp", gender: "m" },
  { id: "am_adam", label: "Adam · American, flat", gender: "m" },
  { id: "af_heart", label: "Heart · American, warm", gender: "f" },
  { id: "af_bella", label: "Bella · American, bright", gender: "f" },
  { id: "af_nicole", label: "Nicole · American, close and calm", gender: "f" },
  { id: "bf_emma", label: "Emma · British, polished", gender: "f" },
  { id: "af_aoede", label: "Aoede · American, smooth", gender: "f" },
  { id: "af_kore", label: "Kore · American, steady", gender: "f" },
  { id: "af_sarah", label: "Sarah · American, friendly", gender: "f" },
  { id: "bf_isabella", label: "Isabella · British, warm", gender: "f" },
  { id: "af_nova", label: "Nova · American, clear", gender: "f" },
  { id: "af_sky", label: "Sky · American, light", gender: "f" },
  { id: "bf_alice", label: "Alice · British, bright", gender: "f" },
  { id: "af_jessica", label: "Jessica · American, casual", gender: "f" },
];

/** Each chair's first choice, so the desk sounds the same every visit. */
const CHAIR_PICK: Record<Chair, { m: string; f: string }> = {
  host: { m: "am_michael", f: "af_heart" },
  analyst: { m: "am_fenrir", f: "af_bella" },
  reporter: { m: "am_puck", f: "af_nicole" },
  pbp: { m: "am_michael", f: "af_heart" },
  color: { m: "am_fenrir", f: "af_bella" },
  draft: { m: "bm_george", f: "bf_emma" },
};

const cast = new Map<string, string>();

/** The voice a person reads in: the viewer's pick for the chair, else a voice of his or her own. */
export function hdVoiceFor(who: Speaker): string {
  const picked = who.chair ? settingsNow().hdCast?.[who.chair] : undefined;
  if (picked && HD_VOICES.some((v) => v.id === picked)) return picked;
  const hit = cast.get(who.key);
  if (hit) return hit;
  const g = who.gender === "f" ? "f" : "m";
  const taken = new Set(cast.values());
  const first = who.chair ? CHAIR_PICK[who.chair][g] : undefined;
  const pool = HD_VOICES.filter((v) => v.gender === g).map((v) => v.id);
  const v = (first && !taken.has(first) ? first : pool.find((x) => !taken.has(x))) ?? pool[cast.size % pool.length]!;
  cast.set(who.key, v);
  return v;
}

/* ---------------- the workers ---------------- */

type Clip = { pcm?: Float32Array; rate?: number; error?: string };
interface Lane {
  w: Worker;
  ready: boolean;
  inFlight: number;
}
const lanes: Lane[] = [];
let seq = 0;
const pending = new Map<number, { resolve: (c: Clip) => void; lane: Lane }>();
/** How long a second of speech takes to make on this device (1 = real time). */
let rtf = 1;

function hdWanted(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && settingsNow().hdVoices !== false;
}

function lane(): Lane | undefined {
  const up = lanes.filter((l) => l.ready);
  return up.sort((a, b) => a.inFlight - b.inFlight)[0];
}

function spawn(first: boolean): void {
  let w: Worker;
  try {
    w = new Worker(new URL("./kokoroWorker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    if (first) useHdVoice.setState({ status: "failed", error: String(err) });
    return;
  }
  const l: Lane = { w, ready: false, inFlight: 0 };
  lanes.push(l);
  w.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; id?: number; pcm?: Float32Array; rate?: number; loaded?: number; total?: number; message?: string; rtf?: number };
    if (m.type === "progress" && m.total && first) useHdVoice.setState({ status: "loading", progress: Math.min(1, (m.loaded ?? 0) / m.total) });
    else if (m.type === "ready") {
      l.ready = true;
      if (m.rtf) rtf = first ? m.rtf : Math.min(rtf, m.rtf);
      useHdVoice.setState({ status: "ready", progress: 1, rtf, workers: lanes.filter((x) => x.ready).length });
      // A second lane on a CPU-bound device with cores to spare: twice the lines made at once.
      if (first && rtf > 0.6 && lanes.length === 1 && (navigator.hardwareConcurrency ?? 2) >= 6) spawn(false);
    } else if (m.type === "failed") {
      lanes.splice(lanes.indexOf(l), 1);
      if (first && !lanes.some((x) => x.ready)) useHdVoice.setState({ status: "failed", error: m.message });
      for (const [id, p] of pending)
        if (p.lane === l) {
          pending.delete(id);
          p.resolve({ error: m.message });
        }
    } else if ((m.type === "audio" || m.type === "error") && m.id !== undefined) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      l.inFlight = Math.max(0, l.inFlight - 1);
      p?.resolve(m.type === "audio" ? { pcm: m.pcm, rate: m.rate } : { error: m.message });
      refreshTalking();
    }
  };
  w.onerror = (e) => {
    if (first && !l.ready) useHdVoice.setState({ status: "failed", error: e.message });
  };
  w.postMessage({ type: "load" });
}

/** Start loading the studio voices (idempotent). Called at startup, on the first read, or from Settings. */
export function warmHdVoices(): void {
  if (!hdWanted() || lanes.length) return;
  useHdVoice.setState({ status: "loading", progress: 0 });
  spawn(true);
}

/** Resolves once the studio voices can read (true), or can't load here (false). */
export function hdReady(): Promise<boolean> {
  warmHdVoices();
  return new Promise((resolve) => {
    const check = (s: ReturnType<typeof useHdVoice.getState>) => {
      if (s.status === "ready") resolve(true);
      else if (s.status === "failed" || s.status === "off" || !hdWanted()) resolve(false);
      else return false;
      return true;
    };
    if (check(useHdVoice.getState())) return;
    const off = useHdVoice.subscribe((s) => {
      if (check(s)) off();
    });
  });
}

/* ---------------- making lines ---------------- */

/** Lines already made or on their way, so a show can read ahead while a line plays. */
const made = new Map<string, { clip: Promise<Clip>; id: number; lane: Lane }>();

function synth(text: string, voice: string, speed: number, now: boolean): Promise<Clip> {
  const k = `${voice}|${speed.toFixed(2)}|${text}`;
  const hit = made.get(k);
  if (hit) {
    // Wanted on the air now: move it to the front of its worker's line.
    if (now) hit.lane.w.postMessage({ type: "urgent", id: hit.id });
    return hit.clip;
  }
  const l = lane();
  if (!l) return Promise.resolve({ error: "no voice worker" });
  const id = ++seq;
  const started = performance.now();
  l.inFlight += 1;
  const clip = new Promise<Clip>((resolve) => {
    pending.set(id, { resolve, lane: l });
    l.w.postMessage({ type: "say", id, text, voice, speed, now });
  }).then((r) => {
    if (r.pcm && r.rate) {
      const secs = r.pcm.length / r.rate;
      if (secs > 0.6) rtf = rtf * 0.8 + ((performance.now() - started) / 1000 / secs) * 0.2;
    }
    return r;
  });
  made.set(k, { clip, id, lane: l });
  if (made.size > 120) made.delete(made.keys().next().value!);
  refreshTalking();
  return clip;
}

/** Sentences, so the first one is on the air while the rest are still being made. */
export function sentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];
  // Very short fragments ride with the sentence before them.
  const out: string[] = [];
  for (const p of parts) {
    if (out.length && (p.length < 18 || out[out.length - 1]!.length < 18)) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out.length ? out : [text];
}

const clampRate = (r: number | undefined) => Math.max(0.8, Math.min(1.3, r || 1));

/** Start making lines before they're read: the next lines of a show, the next snaps' calls. */
export function prefetchLines(lines: { text: string; who: Speaker; rate?: number }[]): void {
  if (useHdVoice.getState().status !== "ready") return;
  for (const l of lines) for (const part of sentences(l.text)) void synth(part, hdVoiceFor(l.who), clampRate(l.rate), false);
}

export function prefetchLine(text: string, who: Speaker, rate = 1): void {
  prefetchLines([{ text, who, rate }]);
}

/* ---------------- on the air ---------------- */

let ctx: AudioContext | undefined;
let playing: AudioBufferSourceNode | undefined;
/** Bumped by cancel: any line still being made is dropped when it arrives. */
let generation = 0;
/** Lines waiting to play, in order. */
let queue: Promise<void> = Promise.resolve();
let queued = 0;

function refreshTalking(): void {
  const making = pending.size > 0;
  const talking = queued > 0 || !!playing;
  const onAir = !!playing;
  const now = useTalking.getState();
  if (now.talking !== talking || now.making !== making || now.onAir !== onAir) useTalking.setState({ talking, making, onAir });
}

function fire(u: SpeechSynthesisUtterance, kind: "end" | "error") {
  const ev = new Event(kind) as SpeechSynthesisEvent;
  if (kind === "end") u.onend?.call(u, ev);
  else u.onerror?.call(u, ev as SpeechSynthesisErrorEvent);
}

function deviceSpeak(u: SpeechSynthesisUtterance): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.speak(u);
  else globalThis.setTimeout(() => fire(u, "end"), 0);
}

/**
 * Read a line in the studio voice. `maxLagMs`: a live call that would air later than this after
 * it was asked for is dropped instead (the moment has passed); shows wait for every line.
 */
export function speakLine(u: SpeechSynthesisUtterance, who: Speaker, opts: { maxLagMs?: number } = {}): void {
  if (hdWanted()) warmHdVoices();
  if (!hdWanted() || useHdVoice.getState().status !== "ready" || !lane()) {
    deviceSpeak(u);
    return;
  }
  const mine = generation;
  const asked = performance.now();
  const voice = hdVoiceFor(who);
  const parts = sentences(u.text);
  // Making starts now for every sentence (the first ahead of any read-ahead work); playback
  // waits its turn, so queued lines read in order like the device engine's own queue.
  const clips = parts.map((t, k) => synth(t, voice, clampRate(u.rate), k === 0));
  queued += 1;
  refreshTalking();
  queue = queue.then(async () => {
    try {
      for (const [i, clip] of clips.entries()) {
        const r = await clip;
        if (mine !== generation) return; // cancelled while it was being made
        if (i === 0 && opts.maxLagMs && performance.now() - asked > opts.maxLagMs) {
          fire(u, "end");
          return;
        }
        if (!r.pcm || !r.rate) {
          // A sentence the model can't read goes to the device voice; the show goes on.
          const rest = new SpeechSynthesisUtterance(parts.slice(i).join(" "));
          rest.rate = u.rate;
          rest.volume = u.volume;
          rest.onend = () => fire(u, "end");
          rest.onerror = () => fire(u, "error");
          deviceSpeak(rest);
          return;
        }
        ctx ??= new AudioContext();
        if (ctx.state === "suspended") await ctx.resume();
        const buf = ctx.createBuffer(1, r.pcm.length, r.rate);
        buf.copyToChannel(r.pcm as Float32Array<ArrayBuffer>, 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, u.volume ?? 1));
        src.connect(gain).connect(ctx.destination);
        playing = src;
        refreshTalking();
        await new Promise<void>((done) => {
          src.onended = () => {
            if (playing === src) playing = undefined;
            done();
          };
          src.start();
        });
        if (mine !== generation) return;
      }
      fire(u, "end");
    } catch {
      fire(u, "error");
    } finally {
      queued = Math.max(0, queued - 1);
      refreshTalking();
    }
  });
}

/** Stop whatever is being read, on either engine. */
export function cancelSpeech(): void {
  generation += 1;
  queue = Promise.resolve();
  queued = 0;
  try {
    playing?.stop();
  } catch {
    /* already stopped */
  }
  playing = undefined;
  refreshTalking();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Is anything on the air (or queued to be) right now? */
export function isSpeaking(): boolean {
  return useTalking.getState().talking || (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking);
}

/** Read one sample line in a voice (Settings). */
export function previewVoice(voice: string, text: string): void {
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  void hdReady().then((ok) => {
    if (!ok || !lane()) {
      deviceSpeak(u);
      return;
    }
    const k = `preview-${voice}`;
    cast.set(k, voice);
    speakLine(u, { key: k });
  });
}
