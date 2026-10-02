import { footballSpeech } from "@/lib/game/footballSpeech";
import { useEffect, useRef, useState } from "react";
import { stadiumAudio } from "./stadiumAudio";

function chooseVoice(voices: SpeechSynthesisVoice[], name: string) {
  if (name) return voices.find((v) => v.name === name);
  const english = voices.filter((v) => /^en(-|_)/i.test(v.lang));
  return (
    english.find((v) => /natural|online|google/i.test(v.name)) ??
    english.find((v) => /en-US/i.test(v.lang)) ??
    english[0]
  );
}

export function useBroadcastSound(active: boolean, cue: string, text: string, index: number, year: number) {
  const [enabled, setEnabled] = useState(false);
  const [music, setMusic] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [announcer, setAnnouncer] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const engine = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const last = useRef(index);
  const speaking = (line: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(footballSpeech(line, year));
    const voice = chooseVoice(voices, voiceName);
    if (voice) speech.voice = voice;
    speech.rate = cue === "td" ? 1.02 : 0.96;
    speech.pitch = 0.98;
    speech.volume = 0.85;
    window.speechSynthesis.speak(speech);
  };
  const ensureAudio = async () => {
    try {
      engine.current ??= stadiumAudio();
      await engine.current.context.resume();
      setUnavailable(false);
      return true;
    } catch {
      setUnavailable(true);
      return false;
    }
  };
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  useEffect(() => {
    engine.current?.setCrowd(enabled);
    engine.current?.setMusic(music, volume);
    const sync = () => {
      if (!active || document.hidden || (!enabled && !music)) {
        void engine.current?.context.suspend();
      } else void engine.current?.context.resume();
      if ((!active || document.hidden) && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [active, enabled, music, volume]);
  useEffect(() => {
    const sequential = index === last.current + 1;
    last.current = index;
    if (!sequential || !active || document.hidden) return;
    if (enabled && ["td", "to", "fg", "safety"].includes(cue)) engine.current?.cue(cue === "td");
    // Finish ordinary calls. Only a major event interrupts the current sentence.
    if (announcer && (["td", "to", "safety"].includes(cue) || !window.speechSynthesis.speaking))
      speaking(text);
  }, [index, active, cue, text, enabled, announcer]);
  useEffect(
    () => () => {
      void engine.current?.close();
      engine.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );
  return {
    chime: () => engine.current?.cue(),
    controls: (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="bx-chip min-h-9 px-3"
            aria-pressed={enabled}
            onClick={async () => {
              if (enabled) setEnabled(false);
              else if (await ensureAudio()) setEnabled(true);
            }}
          >
            Stadium sound: {enabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            className="bx-chip min-h-9 px-3"
            aria-pressed={music}
            onClick={async () => {
              if (music) setMusic(false);
              else if (await ensureAudio()) setMusic(true);
            }}
          >
            Music: {music ? "On" : "Off"}
          </button>
          <button
            type="button"
            className="bx-chip min-h-9 px-3"
            aria-pressed={announcer}
            onClick={() => {
              if (!("speechSynthesis" in window)) {
                setUnavailable(true);
                return;
              }
              setAnnouncer(!announcer);
              if (announcer) window.speechSynthesis.cancel();
              else speaking("Welcome to NFL Rewind. It's a great day for football.");
            }}
          >
            Announcer: {announcer ? "On" : "Off"}
          </button>
        </div>
        {music && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Sunday Lights · Network Mix{" "}
            <input
              aria-label="Music volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="max-w-36 accent-amber-300"
            />{" "}
            {Math.round(volume * 100)}%
          </label>
        )}
        {announcer && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Announcer voice
            <select
              aria-label="Announcer voice"
              className="min-h-9 max-w-full rounded border border-white/20 bg-studio px-2"
              value={voiceName}
              onChange={(e) => {
                setVoiceName(e.target.value);
                window.speechSynthesis.cancel();
              }}
            >
              <option value="">Best available English voice</option>
              {voices
                .filter((v) => /^en(-|_)/i.test(v.lang))
                .map((v) => (
                  <option key={v.voiceURI} value={v.name}>
                    {v.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {unavailable && (
          <p role="status" className="text-xs text-muted">
            Audio unavailable in this browser.
          </p>
        )}
      </div>
    ),
  };
}

export function StudioRecapAudio({ text, year }: { text: string; year: number }) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const stop = () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setPlaying(false);
    };
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [text]);
  return (
    <div className="my-3">
      <button
        className="bx-chip min-h-11 px-4 text-sm"
        type="button"
        onClick={() => {
          if (!("speechSynthesis" in window)) {
            setUnavailable(true);
            return;
          }
          window.speechSynthesis.cancel();
          if (playing) {
            setPlaying(false);
            return;
          }
          const speech = new SpeechSynthesisUtterance(footballSpeech(text, year));
          const voice = chooseVoice(window.speechSynthesis.getVoices(), "");
          if (voice) speech.voice = voice;
          speech.rate = .96;
          speech.onend = speech.onerror = () => setPlaying(false);
          window.speechSynthesis.speak(speech);
          setPlaying(true);
        }}
      >
        {playing ? "Stop studio recap" : "Listen to studio recap"}
      </button>
      {unavailable && <p className="text-xs">Voice is unavailable in this browser.</p>}
    </div>
  );
}
