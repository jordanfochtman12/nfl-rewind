/**
 * One way to put a line on the air: the device's own voices (on an iPhone, the Premium and
 * Enhanced ones when they're installed). Callers build a SpeechSynthesisUtterance, pick its voice
 * if they cast one, and hand it here; onend and onerror fire either way, so a show never stalls
 * on a line that can't be read.
 */
import { create } from "zustand";
import { settingsNow } from "../settings-store.ts";
import { PHONE_VOICE } from "../voiceCast.ts";

/** Who is reading a line, so a desk can cast each person a device voice of their own. */
export interface Speaker {
  key: string;
  gender?: "m" | "f";
}

/** Something is on the air or about to be: lines handed to the device voice and not finished. */
export const useTalking = create<{ talking: boolean }>(() => ({ talking: false }));

const goodDevice = (v: SpeechSynthesisVoice) => /^en([-_]|$)/i.test(v.lang) && /premium|enhanced|neural|natural/i.test(`${v.name} ${v.voiceURI}`);

/** The device has a Premium or Enhanced English voice installed (iOS: Settings → Accessibility → Spoken Content → Voices). */
export function hasPremiumDeviceVoice(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().some(goodDevice);
}

/** The best English voice on the device: Premium/Enhanced first, then US English. */
function bestDeviceVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const en = window.speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
  return en.find(goodDevice) ?? en.find((v) => /^en[-_]US/i.test(v.lang)) ?? en[0];
}

/** A phone or tablet. */
export function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/* ---------------- waking the sound on a phone ---------------- */

let ctx: AudioContext | undefined;
/** The broadcasts' other sound (crowd, music): woken by the same tap as the voices. */
const others = new Set<AudioContext>();
export function registerAudio(c: AudioContext): AudioContext {
  others.add(c);
  return c;
}
export function forgetAudio(c: AudioContext): void {
  others.delete(c);
}

/**
 * Phones only let a page make sound after a tap, and only from a context opened or resumed
 * during one. Every tap wakes the page's audio and the device voice, plays an instant of
 * silence to claim them, and asks iOS to play through the silent switch like a video would.
 */
export function unlockAudio(): void {
  for (const c of others) if (c.state === "suspended") void c.resume().catch(() => undefined);
  if (typeof window === "undefined") return;
  // A voice on the air is proof the sound is already unlocked. While it talks, an iPhone marks
  // the page's own audio "interrupted", and waking it again (or changing the audio mode) stops
  // the voice: every touch, even the start of a scroll, used to cut the line off.
  if (lines > 0 || ("speechSynthesis" in window && window.speechSynthesis.speaking)) return;
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

/* ---------------- on the air ---------------- */

/** Lines the device voice has been handed and hasn't finished. */
let lines = 0;
let gen = 0;
/** When the device voice should be through everything it's been handed (lines queue there). */
let busyUntil = 0;

function refreshTalking(): void {
  const talking = lines > 0;
  if (useTalking.getState().talking !== talking) useTalking.setState({ talking });
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

/** Read a line. Lines queue in order, the way the device engine queues them. */
export function speakLine(u: SpeechSynthesisUtterance): void {
  // A line with no voice of its own reads in the device's best one, not its default (unless the
  // viewer chose the phone's own voice).
  if (!u.voice && settingsNow().voiceName !== PHONE_VOICE) {
    const v = bestDeviceVoice();
    if (v) u.voice = v;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    globalThis.setTimeout(() => u.onend?.call(u, new Event("end") as SpeechSynthesisEvent), 0);
    return;
  }
  // iOS sometimes never says a line ended, so a timer from the line's length closes it out.
  const mine = gen;
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    globalThis.clearTimeout(guard);
    if (mine === gen) lines = Math.max(0, lines - 1);
    refreshTalking();
  };
  const words = u.text.split(/\s+/).filter(Boolean).length;
  const now = Date.now();
  busyUntil = Math.max(now, busyUntil) + (words / (2.2 * (u.rate || 1))) * 1000;
  const guard = globalThis.setTimeout(close, busyUntil - now + 5000);
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
  lines += 1;
  refreshTalking();
  const synth = window.speechSynthesis;
  const pieces = u.text.length > 180 ? chunk(u.text) : [u.text];
  // iOS is primed with a silent utterance on the first touch. If Safari leaves that
  // utterance queued without an end event, the synthesis engine can stay busy while our
  // line counter is idle; new narration would then sit behind something the viewer cannot
  // hear. Clear only that untracked queue, then give Safari a beat before the audible line.
  if (lines === 1 && (synth.speaking || synth.pending)) {
    synth.cancel();
    globalThis.setTimeout(() => {
      if (mine !== gen) return;
      if (synth.paused) synth.resume();
      readPieces(u, pieces, mine);
    }, 160);
    return;
  }
  // A stuck engine (iOS after an interruption) won't read anything until it's resumed.
  if (synth.paused) synth.resume();
  // Phone engines cut a long utterance off partway (Chrome at about 15 seconds): a long
  // line is read as its sentences, one utterance each, and ends when the last one does.
  readPieces(u, pieces, mine);
}

/**
 * Read a line's pieces in order. A phone stops the voice on its own when other sound wakes up
 * (a tap that starts the crowd or the music on an iPhone): a piece cut off that way, when
 * nobody here cancelled it, picks up again from the word it was on instead of ending the line.
 */
function readPieces(u: SpeechSynthesisUtterance, pieces: string[], mine: number): void {
  const synth = window.speechSynthesis;
  let failed = false;
  const say = (text: string, last: boolean, tries: number) => {
    const part = new SpeechSynthesisUtterance(text);
    part.voice = u.voice;
    part.rate = u.rate;
    part.pitch = u.pitch;
    part.volume = u.volume;
    part.lang = u.lang;
    // Where the voice got to: the start of the word it's on.
    let at = -1;
    part.onboundary = (ev) => {
      if (ev.name === "word" || ev.name === undefined) at = ev.charIndex;
    };
    let settled = false;
    const resume = (): boolean => {
      // Cut off by us (cancelSpeech) or tried enough: this piece is over.
      if (mine !== gen || tries >= 3) return false;
      const rest = text.slice(Math.max(0, at)).trim();
      if (!rest) return false;
      globalThis.setTimeout(() => {
        if (mine !== gen) return;
        if (synth.paused) synth.resume();
        say(rest, last, tries + 1);
      }, 250);
      return true;
    };
    part.onend = (ev) => {
      if (settled) return;
      settled = true;
      // Ended with words still to say (the engine reported where it was) and nothing queued
      // behind it: the phone cut it off.
      const left = at >= 0 ? text.slice(at).trim().split(/\s+/).filter(Boolean).length : 0;
      if (left > 2 && !synth.pending && resume()) return;
      if (last) u.onend?.call(u, ev);
    };
    part.onerror = (ev) => {
      if (settled) return;
      settled = true;
      const kind = (ev as SpeechSynthesisErrorEvent).error;
      if ((kind === "interrupted" || kind === "canceled" || kind === "audio-busy") && resume()) return;
      if (failed) return;
      failed = true;
      u.onerror?.call(u, ev);
    };
    synth.speak(part);
  };
  // Every piece is handed over now, so lines queued after this one still read after it.
  pieces.forEach((t, k) => say(t, k === pieces.length - 1, 0));
}

/** Stop whatever is being read. */
export function cancelSpeech(): void {
  gen += 1;
  lines = 0;
  busyUntil = 0;
  refreshTalking();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Bumped by every cancelSpeech: a caller pacing its own lines knows when it was cut off. */
export function speechGeneration(): number {
  return gen;
}

/** Is anything on the air (or queued to be) right now? */
export function isSpeaking(): boolean {
  return useTalking.getState().talking || (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking);
}

/**
 * The studio voices this app used to download (about 90 MB in the browser's cache) aren't used
 * any more: the space goes back to the device, once.
 */
export function clearOldVoiceModel(): void {
  try {
    if (typeof caches !== "undefined") void caches.delete("transformers-cache").catch(() => undefined);
    localStorage.removeItem("rewind-voice-gpu");
  } catch {
    /* nothing to clear */
  }
}
