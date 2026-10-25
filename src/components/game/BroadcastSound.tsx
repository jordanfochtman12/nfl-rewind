import { footballSpeech } from "@/lib/game/footballSpeech";
import { settingsNow, useSettings } from "@/lib/settings-store";
import { useEffect, useRef, useState } from "react";
import { stadiumAudio } from "./stadiumAudio";
import { castVoices, PHONE_VOICE, voiceChoices, voiceKey, voiceLabel } from "@/lib/voiceCast";
import { boothFor } from "@/lib/game/broadcastCrew";
import type { BoothLine } from "@/lib/game/commentary";
import { cancelSpeech, isSpeaking, speakLine, speechGeneration, useTalking } from "@/lib/voice/speech";

export function useBroadcastSound(active: boolean, cue: string, lines: BoothLine[], index: number, year: number, intensity = 0) {
  // Stadium sound and music start as Settings has them (on by default); the first tap
  // anywhere wakes them, since phones only start sound from a tap.
  const [enabled, setEnabled] = useState(() => settingsNow().music);
  const [music, setMusic] = useState(() => settingsNow().music);
  const [volume, setVolume] = useState(0.3);
  const [announcer, setAnnouncer] = useState(() => settingsNow().boothVoices);
  const [unavailable, setUnavailable] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(() => settingsNow().voiceName);
  const supportVoices = useSettings((s) => s.supportVoiceNames);
  const setSettings = useSettings((s) => s.set);
  const engine = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const last = useRef(index);
  const callSeq = useRef(0);
  const booth = boothFor(year);
  // Two people in the booth, two voices: the play-by-play man and his color analyst, each cast
  // to match (a chosen voice goes to the play-by-play call).
  const utter = (line: BoothLine, playCue: string) => {
    const cast = castVoices(voices, [
      { key: "PBP", gender: booth.pbp.gender, rate: 1.02 },
      { key: "COLOR", gender: booth.color.gender, pitch: 0.94, rate: 0.97 },
    ], { PBP: voiceName, COLOR: supportVoices.COLOR });
    const speech = new SpeechSynthesisUtterance(footballSpeech(line.text, year));
    const c = cast.get(line.speaker);
    if (c?.voice) speech.voice = c.voice;
    speech.pitch = c?.pitch ?? 1;
    // The play-by-play man picks up the pace on a touchdown.
    speech.rate = (c?.rate ?? 1) * (line.speaker === "PBP" && playCue === "td" ? 1.08 : 1);
    speech.volume = line.speaker === "PBP" ? 0.9 : 0.85;
    return speech;
  };
  // The booth hands the device one line at a time, so whatever is being said can always finish:
  // a big play replaces what's still waiting and is the next thing said, instead of cancelling
  // the sentence on the air (the call used to stop mid-word on every touchdown).
  const waiting = useRef<{ line: BoothLine; cue: string }[]>([]);
  const onAir = useRef(0);
  const next = () => {
    const item = waiting.current.shift();
    if (!item) {
      onAir.current = 0;
      return;
    }
    const id = ++onAir.current;
    const g = speechGeneration();
    const u = utter(item.line, item.cue);
    const words = u.text.split(/\s+/).filter(Boolean).length;
    let done = false;
    const finish = () => {
      if (done || onAir.current !== id) return;
      done = true;
      window.clearTimeout(guard);
      // Cut off from elsewhere (the announcer switched off, the page hidden): nothing follows.
      if (speechGeneration() !== g) {
        waiting.current = [];
        onAir.current = 0;
        return;
      }
      next();
    };
    // Some phone engines never say a line ended: its length closes it out.
    const guard = window.setTimeout(finish, (words / (2.2 * (u.rate || 1))) * 1000 + 4000);
    u.onend = finish;
    u.onerror = finish;
    speakLine(u);
  };
  const speaking = (call: BoothLine[], big = false) => {
    if (!("speechSynthesis" in window)) return;
    const items = call.map((line) => ({ line, cue }));
    if (onAir.current) {
      // Ours on the air: a big play takes the place of what's queued; an ordinary call waits its turn.
      waiting.current = big ? items : [...waiting.current, ...items];
      return;
    }
    waiting.current = items;
    // Someone else's voice on the air (the desk, the opener): give the phone a beat after the
    // cut, since iOS drops a line started the instant after speech is cancelled.
    const seq = ++callSeq.current;
    if (!isSpeaking()) return next();
    cancelSpeech();
    window.setTimeout(() => {
      if (seq === callSeq.current) next();
    }, 160);
  };
  const talking = useTalking((t) => t.talking);
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
    // On from the start: the sound is set up now and wakes with the viewer's first tap.
    if ((enabled || music) && active && !engine.current) {
      try {
        engine.current = stadiumAudio();
      } catch {
        setUnavailable(true);
      }
    }
    engine.current?.setCrowd(enabled);
    engine.current?.setMusic(music, volume);
    const sync = () => {
      if (!active || document.hidden || (!enabled && !music)) {
        void engine.current?.context.suspend();
      } else void engine.current?.context.resume();
      // The last call of a half or the game plays out; only leaving the page stops it.
      if (document.hidden && "speechSynthesis" in window) cancelSpeech();
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
    // Ordinary calls are said when the booth is free; a major event is said next, once the
    // sentence on the air is finished.
    const big = ["td", "to", "safety"].includes(cue);
    if (announcer && (big || !isSpeaking())) speaking(lines, big);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, active, cue, enabled, announcer]);
  useEffect(() => {
    engine.current?.setIntensity(intensity);
  }, [intensity, enabled]);
  useEffect(
    () => () => {
      void engine.current?.close();
      engine.current = null;
      if ("speechSynthesis" in window) cancelSpeech();
    },
    [],
  );
  return {
    /** The booth is still calling the last snap: a telecast waits for it. */
    holding: announcer && active && talking,
    /** The booth's voices are on: the desk segments (halftime, the podium) are read aloud too. */
    voiced: announcer,
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
              if (announcer) {
                waiting.current = [];
                cancelSpeech();
              }
              else
                speaking([
                  { speaker: "PBP", text: `Hello again, everybody. I'm ${booth.pbp.name}, alongside ${booth.color.name}, and it is a great day for football.` },
                  { speaker: "COLOR", text: `It sure is. Let's get this thing started.` },
                ]);
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
            Play-by-play voice ({booth.pbp.name})
            <select
              aria-label="Play-by-play voice"
              className="min-h-9 max-w-full rounded border border-white/20 bg-studio px-2"
              value={voiceName}
              onChange={(e) => {
                setVoiceName(e.target.value);
                setSettings({ voiceName: e.target.value });
                cancelSpeech();
              }}
            >
              <option value="">Best available English voice</option>
              <option value={PHONE_VOICE}>Phone's voice (Spoken Content)</option>
              {voiceChoices(voices).map((v) => (
                  <option key={voiceKey(v)} value={voiceKey(v)}>
                    {voiceLabel(v)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {announcer && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Color analyst voice ({booth.color.name})
            <select aria-label="Color analyst voice" className="min-h-9 max-w-full rounded border border-white/20 bg-studio px-2" value={supportVoices.COLOR ?? ""} onChange={(e) => { setSettings({ supportVoiceNames: { ...supportVoices, COLOR: e.target.value } }); cancelSpeech(); }}>
              <option value="">Automatic cast</option>
              <option value={PHONE_VOICE}>Phone&apos;s voice (Spoken Content)</option>
              {voiceChoices(voices).map((v) => <option key={voiceKey(v)} value={voiceKey(v)}>{voiceLabel(v)}</option>)}
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
