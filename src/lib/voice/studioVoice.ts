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

/**
 * Kokoro v1.0's voices, best first, with how they're labeled in Settings. `premium`: the
 * voices the model's own grading rates highest (C and up); the broadcast casts only these,
 * and the rest stay in Settings for anyone who wants them.
 */
export const HD_VOICES: { id: string; label: string; gender: "m" | "f"; premium?: boolean }[] = [
  { id: "am_michael", label: "Michael · American, warm baritone", gender: "m", premium: true },
  { id: "am_fenrir", label: "Fenrir · American, deep and gravelly", gender: "m", premium: true },
  { id: "am_puck", label: "Puck · American, bright and quick", gender: "m", premium: true },
  { id: "bm_george", label: "George · British, classic", gender: "m", premium: true },
  { id: "am_echo", label: "Echo · American, even", gender: "m"  },
  { id: "bm_fable", label: "Fable · British, storyteller", gender: "m", premium: true },
  { id: "am_eric", label: "Eric · American, plain-spoken", gender: "m"  },
  { id: "am_liam", label: "Liam · American, young", gender: "m"  },
  { id: "bm_lewis", label: "Lewis · British, low", gender: "m"  },
  { id: "am_onyx", label: "Onyx · American, dark", gender: "m"  },
  { id: "bm_daniel", label: "Daniel · British, crisp", gender: "m"  },
  { id: "am_adam", label: "Adam · American, flat", gender: "m"  },
  { id: "af_heart", label: "Heart · American, warm", gender: "f", premium: true },
  { id: "af_bella", label: "Bella · American, bright", gender: "f", premium: true },
  { id: "af_nicole", label: "Nicole · American, close and calm", gender: "f", premium: true },
  { id: "bf_emma", label: "Emma · British, polished", gender: "f", premium: true },
  { id: "af_aoede", label: "Aoede · American, smooth", gender: "f", premium: true },
  { id: "af_kore", label: "Kore · American, steady", gender: "f", premium: true },
  { id: "af_sarah", label: "Sarah · American, friendly", gender: "f", premium: true },
  { id: "bf_isabella", label: "Isabella · British, warm", gender: "f", premium: true },
  { id: "af_nova", label: "Nova · American, clear", gender: "f", premium: true },
  { id: "af_sky", label: "Sky · American, light", gender: "f"  },
  { id: "bf_alice", label: "Alice · British, bright", gender: "f"  },
  { id: "af_jessica", label: "Jessica · American, casual", gender: "f"  },
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
  const pool = HD_VOICES.filter((v) => v.gender === g && v.premium).map((v) => v.id);
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
  return typeof window !== "undefined" && typeof Worker !== "undefined" && settingsNow().hdVoices !== false && !phoneUsesDevice();
}

const goodDevice = (v: SpeechSynthesisVoice) => /^en([-_]|$)/i.test(v.lang) && /premium|enhanced|neural|natural/i.test(`${v.name} ${v.voiceURI}`);

/** The phone has a Premium or Enhanced English voice installed (iOS: Settings → Accessibility → Spoken Content → Voices). */
export function hasPremiumDeviceVoice(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().some(goodDevice);
}

/**
 * A phone reads with its own voices when the viewer picked them, or (auto) when it has a
 * Premium or Enhanced one: those are instant and dependable, where the studio voices made on a
 * phone's CPU are slow enough that live calls miss their moment.
 */
export function phoneUsesDevice(): boolean {
  if (!isPhone()) return false;
  const pref = settingsNow().phoneVoice ?? "auto";
  if (pref === "device") return true;
  if (pref === "studio") return false;
  return hasPremiumDeviceVoice();
}

/** The best English voice on the device: Premium/Enhanced first, then US English. */
function bestDeviceVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const en = window.speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
  return en.find(goodDevice) ?? en.find((v) => /^en[-_]US/i.test(v.lang)) ?? en[0];
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
    const m = e.data as { type: string; id?: number; pcm?: Float32Array; rate?: number; loaded?: number; total?: number; message?: string; rtf?: number; device?: string; triedGpu?: boolean };
    if (m.type === "progress" && m.total && first) useHdVoice.setState({ status: "loading", progress: Math.min(1, (m.loaded ?? 0) / m.total) });
    else if (m.type === "ready") {
      l.ready = true;
      if (first) notePhoneGpu(m.triedGpu ? m.device : undefined);
      if (m.rtf) rtf = first ? m.rtf : Math.min(rtf, m.rtf);
      useHdVoice.setState({ status: "ready", progress: 1, rtf, workers: lanes.filter((x) => x.ready).length });
      // A second lane on a CPU-bound device with cores to spare: twice the lines made at once.
      if (first && !isPhone() && rtf > 0.6 && lanes.length === 1 && (navigator.hardwareConcurrency ?? 2) >= 6) spawn(false);
    } else if (m.type === "failed") {
      if (first) notePhoneGpu("failed");
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
  // A worker that dies (no network for the model, a runtime the browser won't run) takes its
  // lines with it: they come back as errors, so the booth falls back to the device's voice
  // instead of waiting on a line that will never be read. The page keeps going.
  w.onerror = (e) => {
    e.preventDefault();
    const at = lanes.indexOf(l);
    if (at >= 0) lanes.splice(at, 1);
    w.terminate();
    for (const [id, p] of pending)
      if (p.lane === l) {
        pending.delete(id);
        p.resolve({ error: e.message || "voice worker stopped" });
      }
    if (!lanes.some((x) => x.ready)) useHdVoice.setState({ status: "failed", error: e.message || "voice worker stopped" });
    else useHdVoice.setState({ workers: lanes.filter((x) => x.ready).length });
    refreshTalking();
  };
  w.postMessage({ type: "load", phone: isPhone(), phoneGpu: first && phoneGpuAllowed() });
}

/**
 * A phone's GPU makes the voices many times faster than its CPU, but the GPU model is big
 * (about 325 MB) and a phone that can't hold it closes the tab. So a phone tries it a couple
 * of times: each attempt is counted before it starts and the count cleared when it works, and
 * tabs that died mid-attempt (or were closed during the download) leave the count behind, so
 * after two the phone goes straight to the CPU model.
 */
const GPU_KEY = "rewind-voice-gpu";
function phoneGpuAllowed(): boolean {
  if (!isPhone() || !("gpu" in navigator)) return false;
  try {
    const was = localStorage.getItem(GPU_KEY);
    if (was === "ok") return true;
    const tries = Number(/^try(\d)$/.exec(was ?? "")?.[1] ?? 0);
    if (was === "bad" || tries >= 2) {
      localStorage.setItem(GPU_KEY, "bad");
      return false;
    }
    localStorage.setItem(GPU_KEY, `try${tries + 1}`);
    return true;
  } catch {
    return false;
  }
}
/** How the attempt went: the device the model runs on, or undefined when the GPU was never tried. */
function notePhoneGpu(device: string | undefined): void {
  if (!isPhone()) return;
  try {
    const was = localStorage.getItem(GPU_KEY);
    if (!device) {
      // No GPU attempt this time (no adapter, or short of storage): this visit doesn't count.
      if (was?.startsWith("try")) {
        const n = Number(was.slice(3)) - 1;
        if (n > 0) localStorage.setItem(GPU_KEY, `try${n}`);
        else localStorage.removeItem(GPU_KEY);
      }
      return;
    }
    if (was === "ok" || was?.startsWith("try")) localStorage.setItem(GPU_KEY, device === "webgpu" ? "ok" : "bad");
  } catch {
    /* no storage */
  }
}

/** A phone or tablet: one voice worker and the small CPU model, so the tab stays inside its memory. */
export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/** Start loading the studio voices (idempotent). Called at startup, on the first read, or from Settings. */
export function warmHdVoices(force = false): void {
  if (!hdWanted() || lanes.length) return;
  // After a failed load the voices stay down until asked again (Settings), so a browser that
  // can't run them isn't made to re-download and fail on every line.
  if (useHdVoice.getState().status === "failed" && !force) return;
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

/** How long a live call may wait for its voice before the moment has passed. */
const LIVE_LAG_MS = 3500;

/** Lines already made or on their way, so a show can read ahead while a line plays. */
const made = new Map<string, { clip: Promise<Clip>; id: number; lane: Lane; done?: boolean }>();

/** Is this line already made (read ahead), so it can go on the air with no wait? */
function isMade(text: string, voice: string, speed: number): boolean {
  return !!made.get(`${voice}|${speed.toFixed(2)}|${text}`)?.done;
}

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
    // A line that couldn't be made (or was cleared) isn't kept: asked again, it's made again.
    if (r.error && made.get(k)?.id === id) made.delete(k);
    else if (made.get(k)?.id === id) made.get(k)!.done = true;
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
/** The studio voices are loaded and make speech at least as fast as it's spoken. */
export function studioKeepsUp(): boolean {
  return hdWanted() && useHdVoice.getState().status === "ready" && !!lane() && rtf <= 1.1;
}

export function prefetchLines(lines: { text: string; who: Speaker; rate?: number }[]): void {
  if (useHdVoice.getState().status !== "ready") return;
  for (const l of lines) for (const part of sentences(l.text)) void synth(part, hdVoiceFor(l.who), clampRate(l.rate), false);
}

export function prefetchLine(text: string, who: Speaker, rate = 1): void {
  prefetchLines([{ text, who, rate }]);
}

/* ---------------- on the air ---------------- */

let ctx: AudioContext | undefined;

/**
 * Phones only let a page make sound after a tap, and only from a context opened or resumed
 * during one. Every tap opens (or wakes) the studio's audio and the device voice, plays an
 * instant of silence to claim them, and asks iOS to play through the silent switch like a video
 * would. Without this the studio voices on an iPhone are made but never heard.
 */
/** The broadcasts' other sound (crowd, music): woken by the same tap as the voices. */
const others = new Set<AudioContext>();
export function registerAudio(c: AudioContext): AudioContext {
  others.add(c);
  return c;
}
export function forgetAudio(c: AudioContext): void {
  others.delete(c);
}

export function unlockAudio(): void {
  for (const c of others) if (c.state === "suspended") void c.resume().catch(() => undefined);
  if (typeof window === "undefined") return;
  try {
    const s = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (s && s.type !== "playback") s.type = "playback";
  } catch {
    /* not offered here */
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx ??= new AC();
      if (ctx.state !== "running") {
        void ctx.resume().catch(() => undefined);
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      }
    }
  } catch {
    /* no Web Audio */
  }
  if (!spokeOnce && "speechSynthesis" in window && !window.speechSynthesis.speaking) {
    spokeOnce = true;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* no device voice */
    }
  }
}
let spokeOnce = false;

if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "touchend", "keydown"]) window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}

/** Wakes the audio for a line; false when the phone still holds it locked (no tap yet). */
async function awake(c: AudioContext): Promise<boolean> {
  if (c.state === "running") return true;
  await Promise.race([c.resume().catch(() => undefined), new Promise((r) => setTimeout(r, 1200))]);
  return (c.state as string) === "running";
}
let playing: AudioBufferSourceNode | undefined;
/** Bumped by cancel: any line still being made is dropped when it arrives. */
let generation = 0;
/** Lines waiting to play, in order. */
let queue: Promise<void> = Promise.resolve();
let queued = 0;
/** Lines the device's own voice has been handed and hasn't finished. */
let deviceLines = 0;
let deviceGen = 0;
/** When the device voice should be through everything it's been handed (lines queue there). */
let deviceBusyUntil = 0;

function refreshTalking(): void {
  const making = pending.size > 0;
  const talking = queued > 0 || !!playing || deviceLines > 0;
  const onAir = !!playing || deviceLines > 0;
  const now = useTalking.getState();
  if (now.talking !== talking || now.making !== making || now.onAir !== onAir) useTalking.setState({ talking, making, onAir });
}

function fire(u: SpeechSynthesisUtterance, kind: "end" | "error") {
  const ev = new Event(kind) as SpeechSynthesisEvent;
  if (kind === "end") u.onend?.call(u, ev);
  else u.onerror?.call(u, ev as SpeechSynthesisErrorEvent);
}

function deviceSpeak(u: SpeechSynthesisUtterance): void {
  // A line with no voice of its own reads in the device's best one, not its default.
  if (!u.voice) {
    const v = bestDeviceVoice();
    if (v) u.voice = v;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    globalThis.setTimeout(() => fire(u, "end"), 0);
    return;
  }
  // The device voice counts as on the air too, so a broadcast waits for its call the same as
  // for a studio voice. iOS sometimes never says a line ended, so a timer from the line's
  // length closes it out.
  const gen = deviceGen;
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    globalThis.clearTimeout(guard);
    if (gen === deviceGen) deviceLines = Math.max(0, deviceLines - 1);
    refreshTalking();
  };
  const words = u.text.split(/\s+/).filter(Boolean).length;
  const now = Date.now();
  deviceBusyUntil = Math.max(now, deviceBusyUntil) + (words / (2.2 * (u.rate || 1))) * 1000;
  const guard = globalThis.setTimeout(close, deviceBusyUntil - now + 5000);
  const end = u.onend;
  const err = u.onerror;
  u.onend = function (ev) {
    close();
    end?.call(this, ev);
  };
  u.onerror = function (ev) {
    close();
    err?.call(this, ev);
  };
  deviceLines += 1;
  refreshTalking();
  const synth = window.speechSynthesis;
  // A stuck engine (iOS after an interruption) won't read anything until it's resumed.
  if (synth.paused) synth.resume();
  const chunks = u.text.length > 180 ? chunk(u.text) : [u.text];
  if (chunks.length === 1) {
    synth.speak(u);
    return;
  }
  // Phone engines cut a long utterance off partway (Chrome at about 15 seconds): a long
  // line is read as its sentences, one utterance each, and ends when the last one does.
  let failed = false;
  chunks.forEach((t, i) => {
    const part = new SpeechSynthesisUtterance(t);
    part.voice = u.voice;
    part.rate = u.rate;
    part.pitch = u.pitch;
    part.volume = u.volume;
    part.lang = u.lang;
    if (i === chunks.length - 1) part.onend = (ev) => u.onend?.call(u, ev);
    part.onerror = (ev) => {
      if (failed) return;
      failed = true;
      u.onerror?.call(u, ev);
    };
    synth.speak(part);
  });
}

/** A long line as sentence groups of up to ~180 characters. */
function chunk(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length + 1 > 180) {
      out.push(cur);
      cur = p;
    } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Read a line in the studio voice. `maxLagMs`: a live call that would air later than this after
 * it was asked for is dropped instead (the moment has passed); shows wait for every line.
 * `live`: a call from the field. It is read in the studio voice or not at all: one that can't
 * air within a few seconds of the snap is dropped, so the game is held only briefly.
 *
 * The studio voices are the only voices: while they're still downloading a line waits for
 * them (a live call that waits too long is dropped) instead of going to the device's robot
 * voice. The device voice reads only when the studio voices are switched off in Settings or
 * can't run in this browser at all.
 */
/**
 * `timely`: a show that can't hide the wait (the draft podium: nobody knows the pick until it's
 * made) never goes quiet for a studio voice. While the voices download, or on a device that makes
 * speech slower than it's spoken, the device's own voice reads it (see studioKeepsUp).
 */
export function speakLine(u: SpeechSynthesisUtterance, who: Speaker, opts: { maxLagMs?: number; live?: boolean; timely?: boolean } = {}): void {
  const lag = opts.maxLagMs ?? (opts.live ? LIVE_LAG_MS : undefined);
  if (!hdWanted()) {
    deviceSpeak(u);
    return;
  }
  warmHdVoices();
  const status = useHdVoice.getState().status;
  if (status === "failed" || (opts.timely && !studioKeepsUp())) {
    deviceSpeak(u);
    return;
  }
  // A phone doesn't hold the broadcast for voices still downloading: its own voice reads
  // until they're ready.
  if ((status !== "ready" || !lane()) && isPhone()) {
    deviceSpeak(u);
    return;
  }
  if (status !== "ready" || !lane()) {
    const gen = generation;
    const t0 = performance.now();
    void hdReady().then((ok) => {
      if (gen !== generation) return; // cancelled while the voices loaded
      if (!ok) {
        deviceSpeak(u);
        return;
      }
      const waited = performance.now() - t0;
      if (lag !== undefined && waited >= lag) {
        fire(u, "end");
        return;
      }
      speakLine(u, who, { ...opts, maxLagMs: lag !== undefined ? lag - waited : undefined });
    });
    return;
  }
  const mine = generation;
  const asked = performance.now();
  const voice = hdVoiceFor(who);
  const parts = sentences(u.text);
  opts = { ...opts, maxLagMs: lag };
  // On a phone that makes speech slower than it's spoken, a live call the read-ahead hasn't
  // made yet is read by the phone's own voice right away rather than missing its moment.
  if (isPhone() && opts.live && rtf > 1.1 && !isMade(parts[0]!, voice, clampRate(u.rate))) {
    deviceSpeak(u);
    return;
  }
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
          // A sentence the model can't read is left out; the show goes on in the studio voice.
          continue;
        }
        ctx ??= new AudioContext();
        if (!(await awake(ctx))) {
          // The phone is holding the page's audio (no tap yet, or iOS paused it): its own
          // voice reads the rest, so the line is still heard.
          const rest = new SpeechSynthesisUtterance(parts.slice(i).join(" "));
          rest.rate = u.rate;
          rest.volume = u.volume;
          if (u.voice) rest.voice = u.voice;
          rest.onend = () => fire(u, "end");
          rest.onerror = () => fire(u, "end");
          deviceSpeak(rest);
          return;
        }
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
export function cancelSpeech(opts: { dropQueued?: boolean } = {}): void {
  generation += 1;
  // The show moved on for good (a new pick at the podium): lines still waiting in the workers
  // are for what was cancelled, so they go too. A live booth keeps its read-ahead.
  if (opts.dropQueued) for (const l of lanes) l.w.postMessage({ type: "clear" });
  queue = Promise.resolve();
  queued = 0;
  deviceGen += 1;
  deviceLines = 0;
  deviceBusyUntil = 0;
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
