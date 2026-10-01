import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGameStore } from "@/lib/game-store";
import {
  draftAnnouncementParts,
  draftAudioSnapshot,
  draftCrowdReaction,
  draftOnClock,
  type DraftAudioSnapshot,
  type DraftReaction,
} from "@/lib/game/draftAnnouncement";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { draftCrowdAudio } from "./draftCrowdAudio";
import { stadiumAudio } from "./stadiumAudio";

interface DraftAudio {
  enabled: boolean;
  busy: boolean;
  hidden: boolean;
  controls: ReactNode;
}
const DraftAudioContext = createContext<DraftAudio>({
  enabled: false,
  busy: false,
  hidden: false,
  controls: null,
});
export const useDraftAnnouncer = () => useContext(DraftAudioContext);

/** Stays mounted through the last pick so the closing announcement can finish. */
export function DraftAnnouncerProvider({ children }: { children: ReactNode }) {
  const save = useGameStore((s) => s.save)!;
  const tab = useGameStore((s) => s.tab);
  const inRoom = tab === "draft" || tab === "office";
  const previous = useRef<DraftAudioSnapshot | null>(null);
  const snapshot = useMemo(
    () => (save.phase === "draft" || previous.current?.drafting ? draftAudioSnapshot(save) : null),
    [save],
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [volume, setVolume] = useState(0.85);
  const [line, setLine] = useState("");
  const [error, setError] = useState("");
  const [music, setMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.28);
  const musicAudio = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const replay = useRef<{
    text: string;
    response?: DraftReaction | null;
    nextLine?: string;
  } | null>(null);
  const [crowd, setCrowd] = useState(false);
  const crowdEnabled = useRef(crowd);
  crowdEnabled.current = crowd;
  const [reaction, setReaction] = useState<DraftReaction | null>(null);
  const audio = useRef<ReturnType<typeof draftCrowdAudio> | null>(null);
  const serial = useRef(0);
  const ownsSpeech = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback(() => {
    serial.current++;
    clearTimeout(watchdog.current);
    audio.current?.stop();
    if (ownsSpeech.current && "speechSynthesis" in window) window.speechSynthesis.cancel();
    ownsSpeech.current = false;
    setBusy(false);
  }, []);
  const playReaction = useCallback(
    async (r: DraftReaction, token: number, keepBusy = false) => {
      if (!crowdEnabled.current || !audio.current) {
        if (!keepBusy) setBusy(false);
        return;
      }
      setBusy(true);
      try {
        await audio.current.play(r.kind, volume);
      } catch {
        if (serial.current === token)
          setError("Crowd audio is unavailable. The draft can continue.");
      } finally {
        if (serial.current === token && !keepBusy) setBusy(false);
      }
    },
    [volume],
  );
  const startCrowd = () => {
    try {
      audio.current ??= draftCrowdAudio();
      void audio.current.context.resume().catch(() => {
        setCrowd(false);
        setError("Crowd audio could not start.");
      });
      setCrowd(true);
    } catch {
      setError("Crowd audio is unavailable in this browser.");
    }
  };
  const stopMusic = useCallback(() => {
    if (musicAudio.current) void musicAudio.current.close();
    musicAudio.current = null;
    setMusic(false);
  }, []);
  const startMusic = () => {
    try {
      musicAudio.current ??= stadiumAudio("draft");
      void musicAudio.current.context.resume().catch(() => {
        setMusic(false);
        setError("Draft music could not start.");
      });
      setMusic(true);
    } catch {
      setError("Draft music is unavailable in this browser.");
    }
  };
  const speak = useCallback(
    (text: string, response?: DraftReaction | null, nextLine?: string) => {
      stop();
      if (!("speechSynthesis" in window)) {
        setError("Draft narration is unavailable in this browser.");
        setEnabled(false);
        return;
      }
      replay.current = { text, response, nextLine };
      setLine([text, nextLine].filter(Boolean).join(" "));
      setError("");
      const token = serial.current;
      const chosen =
        voices.find((v) => v.name === voice) ??
        voices.find((v) => /Natural|Online|Google/i.test(v.name)) ??
        voices.find((v) => v.lang === "en-US") ??
        voices[0];
      setBusy(true);
      const read = (words: string, onEnd: () => void) => {
        if (serial.current !== token) return;
        if (!words) {
          onEnd();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(footballSpeech(words, save.year));
        if (chosen) utterance.voice = chosen;
        utterance.rate = 0.95;
        utterance.volume = volume;
        const fail = () => {
          if (serial.current !== token) return;
          stop();
          setEnabled(false);
          setError("Narration stopped. Turn the announcer on again to retry.");
        };
        utterance.onend = () => {
          if (serial.current !== token) return;
          clearTimeout(watchdog.current);
          ownsSpeech.current = false;
          onEnd();
        };
        utterance.onerror = fail;
        ownsSpeech.current = true;
        watchdog.current = setTimeout(fail, Math.max(30000, words.split(/\s+/).length * 900));
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          fail();
        }
      };
      // Keep the CPU clock held across all three stages, including the crowd pause.
      read(text, () => {
        void (async () => {
          if (response) await playReaction(response, token, true);
          if (serial.current !== token) return;
          if (nextLine) read(nextLine, () => setBusy(false));
          else setBusy(false);
        })();
      });
    },
    [save.year, stop, voices, voice, volume, playReaction],
  );
  useEffect(() => {
    musicAudio.current?.setMusic(music, musicVolume * (busy ? 0.45 : 1));
    if (!music) void musicAudio.current?.context.suspend();
  }, [music, musicVolume, busy]);
  useEffect(() => {
    if (save.phase === "draft" || busy) return;
    const timer = setTimeout(stopMusic, 250);
    return () => clearTimeout(timer);
  }, [save.phase, busy, stopMusic]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () =>
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  useEffect(() => {
    const hide = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        stop();
        setEnabled(false);
        setCrowd(false);
        stopMusic();
        void audio.current?.context.suspend();
      }
    };
    hide();
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stop();
      audio.current?.close();
      audio.current = null;
      stopMusic();
    };
  }, [stop, stopMusic]);
  useEffect(() => {
    if (!inRoom) {
      stop();
      setEnabled(false);
      setCrowd(false);
      stopMusic();
      void audio.current?.context.suspend();
    }
  }, [inRoom, stop, stopMusic]);
  useEffect(() => {
    const parts =
      previous.current && snapshot ? draftAnnouncementParts(previous.current, snapshot) : null;
    const response =
      previous.current && snapshot ? draftCrowdReaction(previous.current, snapshot) : null;
    previous.current = snapshot;
    if (!snapshot) {
      stop();
      setEnabled(false);
      setCrowd(false);
    }
    if (inRoom && !document.hidden && parts) {
      setLine([parts.podium, parts.onClock].filter(Boolean).join(" "));
      replay.current = { text: parts.podium, response, nextLine: parts.onClock };
      setReaction(response);
      if (enabled) speak(parts.podium, response, parts.onClock);
      else if (crowd && response) {
        stop();
        void playReaction(response, serial.current);
      }
    }
  }, [snapshot, enabled, crowd, inRoom, speak, stop, playReaction]);

  const controls = (
    <section
      className="rounded-lg border border-brass/30 bg-black/50 p-4"
      aria-label="Draft announcer"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`bx-chip min-h-11 px-4 ${enabled ? "bx-chip-on" : ""}`}
          aria-pressed={enabled}
          onClick={() => {
            if (enabled) {
              stop();
              setEnabled(false);
            } else {
              setEnabled(true);
              if (!audio.current) startCrowd();
              if (!musicAudio.current) startMusic();
              if (snapshot)
                speak(
                  `Welcome to the ${save.year} ${snapshot.session === "afl" ? "AFL" : "NFL"} draft. ${draftOnClock(snapshot)}`,
                );
            }
          }}
        >
          Announcer: {enabled ? "on" : "off"}
        </button>
        <button
          type="button"
          className={`bx-chip min-h-11 px-4 ${crowd ? "bx-chip-on" : ""}`}
          aria-pressed={crowd}
          onClick={() => {
            if (crowd) {
              audio.current?.stop();
              setCrowd(false);
            } else startCrowd();
          }}
        >
          Crowd: {crowd ? "on" : "off"}
        </button>
        <button
          type="button"
          className={`bx-chip min-h-11 px-4 ${music ? "bx-chip-on" : ""}`}
          aria-pressed={music}
          onClick={() => {
            if (music) setMusic(false);
            else startMusic();
          }}
        >
          Music: {music ? "on" : "off"}
        </button>
        {music && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Music volume
            <input
              aria-label="Draft music volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
            />
          </label>
        )}
        {enabled && (
          <>
            <button
              type="button"
              className="bx-chip min-h-11 px-4"
              disabled={!line}
              onClick={() => {
                const r = replay.current;
                if (r) speak(r.text, r.response, r.nextLine);
              }}
            >
              Replay announcement
            </button>
            <label className="text-xs text-muted">
              Voice
              <select
                aria-label="Draft announcer voice"
                className="ml-2 min-h-11 max-w-full rounded border border-line bg-studio px-2"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              >
                <option value="">Best available English voice</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {(enabled || crowd) && (
          <label className="flex items-center gap-2 text-xs text-muted">
            Volume
            <input
              aria-label="Draft announcer volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {busy
          ? "At the podium — the next automatic pick waits for the announcement."
          : "Pick announcement, crowd reaction, then the next team on the clock."}
      </p>
      {enabled && line && <p className="mt-3 text-sm leading-relaxed text-paper">{line}</p>}
      {reaction && (
        <p className="mt-3 text-sm text-brass" role="status">
          <strong>{reaction.label}.</strong> {reaction.reason}{" "}
          <span className="text-muted">Fan reaction based on today's scouting.</span>
        </p>
      )}
      {error && (
        <p role="status" className="mt-2 text-sm text-brass">
          {error}
        </p>
      )}
      <details className="mt-3 text-xs text-muted">
        <summary>Audio credits</summary>
        <p className="mt-2">
          Original draft theme: On the Clock. Crowd recordings:{" "}
          <a
            href="https://soundbible.com/1964-Small-Crowd-Applause.html"
            target="_blank"
            rel="noreferrer"
          >
            Small Crowd Applause — Yannick Lemieux
          </a>
          ;{" "}
          <a
            href="https://soundbible.com/654-Crowd-Boo-And-Heckles.html"
            target="_blank"
            rel="noreferrer"
          >
            Crowd Boo And Heckles — Mike Koenig
          </a>
          .{" "}
          <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">
            CC BY 3.0
          </a>
          . Short excerpts with fades and volume adjustment.
        </p>
      </details>
    </section>
  );
  return (
    <DraftAudioContext.Provider value={{ enabled, busy, hidden, controls }}>
      {children}
      {busy && save.phase !== "draft" && (
        <aside
          className="fixed bottom-14 right-4 z-40 max-w-sm rounded-lg border border-brass/40 bg-studio p-4 shadow-xl"
          aria-label="Draft closing announcement"
        >
          <p className="text-sm text-paper">The commissioner is closing the draft.</p>
          <button
            type="button"
            className="bx-chip mt-2 min-h-11 px-4"
            onClick={() => {
              stop();
              setEnabled(false);
              setCrowd(false);
              stopMusic();
            }}
          >
            Stop draft audio
          </button>
        </aside>
      )}
    </DraftAudioContext.Provider>
  );
}
