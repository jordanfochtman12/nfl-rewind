import { footballSpeech } from "@/lib/game/footballSpeech";
import { settingsNow } from "@/lib/settings-store";
import { useEffect, useRef, useState } from "react";
import { stadiumAudio } from "./stadiumAudio";
import { castVoices } from "@/lib/voiceCast";
import { boothFor } from "@/lib/game/broadcastCrew";
import type { BoothLine } from "@/lib/game/commentary";
import { cancelSpeech, isSpeaking, prefetchLines, speakLine, useTalking } from "@/lib/voice/studioVoice";

export function useBroadcastSound(active: boolean, cue: string, lines: BoothLine[], index: number, year: number, intensity = 0, upcoming: { lines: BoothLine[]; cue: string }[] = []) {
  // Stadium sound and music start as Settings has them (on by default); the first tap
  // anywhere wakes them, since phones only start sound from a tap.
  const [enabled, setEnabled] = useState(() => settingsNow().music);
  const [music, setMusic] = useState(() => settingsNow().music);
  const [volume, setVolume] = useState(0.3);
  const [announcer, setAnnouncer] = useState(() => settingsNow().boothVoices);
  const [unavailable, setUnavailable] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(() => settingsNow().voiceName);
  const engine = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const last = useRef(index);
  const booth = boothFor(year);
  // Two people in the booth, two voices: the play-by-play man and his color analyst, each cast
  // to match (a chosen voice goes to the play-by-play call).
  const utter = (line: BoothLine, playCue: string) => {
    const cast = castVoices(voices, [
      { key: "PBP", gender: booth.pbp.gender, rate: 1.02 },
      { key: "COLOR", gender: booth.color.gender, pitch: 0.94, rate: 0.97 },
    ], voiceName);
    const speech = new SpeechSynthesisUtterance(footballSpeech(line.text, year));
    const c = cast.get(line.speaker);
    if (c?.voice) speech.voice = c.voice;
    speech.pitch = c?.pitch ?? 1;
    // The play-by-play man picks up the pace on a touchdown.
    speech.rate = (c?.rate ?? 1) * (line.speaker === "PBP" && playCue === "td" ? 1.08 : 1);
    speech.volume = line.speaker === "PBP" ? 0.9 : 0.85;
    const person = line.speaker === "PBP" ? booth.pbp : booth.color;
    return { speech, who: { key: person.name, gender: person.gender, chair: line.speaker === "PBP" ? ("pbp" as const) : ("color" as const) } };
  };
  const speaking = (call: BoothLine[]) => {
    if (!("speechSynthesis" in window)) return;
    cancelSpeech();
    for (const line of call) {
      const { speech, who } = utter(line, cue);
      speakLine(speech, who, { live: true });
    }
  };
  // The next snaps' calls are made while this one is on the air, so the booth never lags the field.
  const ahead = upcoming.map((u) => `${u.cue}:${u.lines.map((l) => l.text).join("|")}`).join("#");
  useEffect(() => {
    if (!announcer || !active) return;
    prefetchLines(upcoming.flatMap((u) => u.lines.map((l) => {
      const { speech, who } = utter(l, u.cue);
      return { text: speech.text, who, rate: speech.rate };
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahead, announcer, active, voices]);
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
      if ((!active || document.hidden) && "speechSynthesis" in window)
        cancelSpeech();
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
    if (announcer && (["td", "to", "safety"].includes(cue) || !isSpeaking()))
      speaking(lines);
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
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="lb-pill"
            aria-pressed={enabled}
            aria-label="Stadium sound"
            onClick={async () => {
              if (enabled) setEnabled(false);
              else if (await ensureAudio()) setEnabled(true);
            }}
          >
            Crowd
          </button>
          <button
            type="button"
            className="lb-pill"
            aria-pressed={music}
            aria-label="Music"
            onClick={async () => {
              if (music) setMusic(false);
              else if (await ensureAudio()) setMusic(true);
            }}
          >
            Music
          </button>
          <button
            type="button"
            className="lb-pill"
            aria-pressed={announcer}
            aria-label="Announcers"
            onClick={() => {
              if (!("speechSynthesis" in window)) {
                setUnavailable(true);
                return;
              }
              setAnnouncer(!announcer);
              if (announcer) cancelSpeech();
              else
                speaking([
                  { speaker: "PBP", text: `Hello again, everybody. I'm ${booth.pbp.name}, alongside ${booth.color.name}, and it is a great day for football.` },
                  { speaker: "COLOR", text: `It sure is. Let's get this thing started.` },
                ]);
            }}
          >
            Booth
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
                cancelSpeech();
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
