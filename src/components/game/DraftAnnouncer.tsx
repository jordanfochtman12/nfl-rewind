import { castVoices } from "@/lib/voiceCast";
import { commissionerFor, draftAnalystFor, pickReaderFor } from "@/lib/game/broadcastCrew";
import {
  useCallback,
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
import { drafteeCall, pickBreakdown, type PickBreakdown } from "@/lib/game/draftNight";
import { draftCrowdAudio } from "./draftCrowdAudio";
import { stadiumAudio } from "./stadiumAudio";

import { DraftAudioContext } from "./draftAudio";
import { cancelSpeech, prefetchLines, speakLine, useHdVoice, type Speaker } from "@/lib/voice/studioVoice";
import { settingsNow } from "@/lib/settings-store";


function crowdFor(b: PickBreakdown): DraftReaction {
  if (b.value === "STEAL" || b.value === "VALUE")
    return { kind: "applause", label: "Applause from the crowd", reason: `The board had him at ${b.consensus}. He went ${b.overall}.` };
  if (b.value === "ON THE BOARD")
    return b.need
      ? { kind: "applause", label: "Applause from the crowd", reason: "A strong scouted fit for a position that needs help." }
      : { kind: "murmur", label: "Polite applause", reason: "Right about where the board had him." };
  if (b.value === "REACH") return { kind: "murmur", label: "Mixed reaction", reason: `A little early: the board had him at ${b.consensus}.` };
  return { kind: "boos", label: "Boos from the crowd", reason: `Fans see a reach: the board had him at ${b.consensus}, and he went ${b.overall}.` };
}

/** Stays mounted through the last pick so the closing announcement can finish. */
export function DraftAnnouncerProvider({ children }: { children: ReactNode }) {
  const save = useGameStore((s) => s.save)!;
  const tab = useGameStore((s) => s.tab);
  const inRoom = tab === "draft" || tab === "office";
  const previous = useRef<DraftAudioSnapshot | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  // The desk's last few takes, so the analyst doesn't say the same thing two picks apart.
  const recentDesk = useRef<string[]>([]);
  const snapshot = useMemo(
    () => (save.phase === "draft" || previous.current?.drafting ? draftAudioSnapshot(save) : null),
    [save],
  );
  // On by default, like the booth on game day (Settings → booth voices turns it off).
  const [enabled, setEnabled] = useState(() => settingsNow().boothVoices !== false);
  const hd = useHdVoice();
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
    desk?: string;
    round?: number;
    guest?: { name: string; line: string };
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
    if (ownsSpeech.current && "speechSynthesis" in window) cancelSpeech({ dropQueued: true });
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
    (text: string, response?: DraftReaction | null, nextLine?: string, desk?: string, round = 1, guest?: { name: string; line: string }) => {
      stop();
      if (!("speechSynthesis" in window)) {
        setError("Draft narration is unavailable in this browser.");
        setEnabled(false);
        return;
      }
      replay.current = { text, response, nextLine, desk, round, guest };
      setLine([text, desk, guest ? `${guest.name}: "${guest.line}"` : "", nextLine].filter(Boolean).join(" "));
      setError("");
      const token = serial.current;
      // The commissioner reads round one (Rozelle, Tagliabue, Goodell); a league official reads
      // the later rounds; the desk analyst reacts. Each gets a voice of their own.
      const official = pickReaderFor(save.year, 2);
      const analyst = draftAnalystFor(save.year);
      const cast = castVoices(
        voices,
        [
          { key: "COMM", gender: commissionerFor(save.year).gender, rate: 0.98 },
          { key: "DESK", gender: analyst.gender, rate: 1.04 },
          { key: official.key, gender: official.gender, rate: 1.02 },
        ],
        voice,
      );
      const readerKey = pickReaderFor(save.year, round).key;
      // Round one is read at the podium's pace; the later rounds move.
      const pace = round <= 1 ? 0.95 : 1.08;
      const speakerFor = (who: string): Speaker => {
        if (who.startsWith("guest:")) return { key: who, gender: "m" };
        const g = who === "COMM" ? commissionerFor(save.year).gender : who === "DESK" ? analyst.gender : official.gender;
        return { key: who === "COMM" ? `comm-${commissionerFor(save.year).gender}` : who === "DESK" ? `desk-${analyst.gender}` : who, gender: g, chair: who === "DESK" ? "analyst" : "draft" };
      };
      setBusy(true);
      const read = (words: string, onEnd: () => void, who = readerKey) => {
        const reader = cast.get(who);
        const chosen = reader?.voice;
        if (serial.current !== token) return;
        if (!words) {
          onEnd();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(footballSpeech(words, save.year));
        if (chosen) utterance.voice = chosen;
        utterance.pitch = reader?.pitch ?? 1;
        utterance.rate = 0.95 * pace * (reader?.rate ?? 1);
        utterance.volume = volume;
        // A line that can't be read is skipped, never the whole broadcast: the show goes on.
        const fail = () => {
          if (serial.current !== token) return;
          clearTimeout(watchdog.current);
          ownsSpeech.current = false;
          onEnd();
        };
        // A line stuck far past its length is let go, but not while the studio voices are
        // still downloading: the room waits for them.
        const guard = () => {
          watchdog.current = setTimeout(() => {
            if (useHdVoice.getState().status === "loading") guard();
            else {
              cancelSpeech();
              fail();
            }
          }, Math.max(30000, words.split(/\s+/).length * 900));
        };
        utterance.onend = () => {
          if (serial.current !== token) return;
          clearTimeout(watchdog.current);
          ownsSpeech.current = false;
          onEnd();
        };
        utterance.onerror = fail;
        ownsSpeech.current = true;
        guard();
        try {
          speakLine(utterance, speakerFor(who));
        } catch {
          fail();
        }
      };
      // The podium line is asked for first, so it's made first; then every other line of this
      // pick is made behind it, so the desk and the next club follow with no gap.
      const prefetchRest = () =>
        prefetchLines(
          ([[desk, "DESK"], [guest?.line, guest ? `guest:${guest.name}` : ""], [nextLine, readerKey]] as const)
            .filter(([w]) => !!w)
            .map(([w, who]) => ({ text: footballSpeech(w!, save.year), who: speakerFor(who), rate: 0.95 * pace * (cast.get(who)?.rate ?? 1) })),
        );
      read(text, () => {
        void (async () => {
          // The room reacts under the desk's take instead of holding the show for it.
          if (response) void playReaction(response, token, true);
          if (serial.current !== token) return;
          const clock = () => (nextLine ? read(nextLine, () => setBusy(false)) : setBusy(false));
          // The owner's own pick: the draftee on the phone before the next club comes up.
          const call = () => (guest ? read(guest.line, clock, `guest:${guest.name}`) : clock());
          if (desk) read(desk, call, "DESK");
          else call();
        })();
      });
      prefetchRest();
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
      previous.current && snapshot ? draftAnnouncementParts(previous.current, snapshot, recentDesk.current) : null;
    // The desk breaks the pick down against the board: value, need, a run, a trade.
    const b = parts?.pickId ? pickBreakdown(saveRef.current, parts.pickId) : undefined;
    if (parts && b) parts.desk = b.desk;
    const guest = b && !saveRef.current.sandbox && b.teamId === saveRef.current.userTeamId ? { name: b.name, line: drafteeCall(saveRef.current, b) } : undefined;
    if (parts?.desk) recentDesk.current = [...recentDesk.current, parts.desk.replace(/ (Good find this late|Day-two picks like that build a roster)\.$/, "")].slice(-6);
    // The room hears the pick the way the desk grades it, so the boos and the take agree.
    const response = b
      ? crowdFor(b)
      : previous.current && snapshot
        ? draftCrowdReaction(previous.current, snapshot)
        : null;
    previous.current = snapshot;
    if (!snapshot) {
      stop();
      setEnabled(false);
      setCrowd(false);
    }
    if (parts) {
      // The later rounds air short: the desk speaks up for a steal, a reach or your own pick,
      // and the next club is only called in round one (or when a draft changes over).
      const notable = !!guest || (!!b && (b.value === "STEAL" || (parts.round <= 3 && b.value !== "ON THE BOARD")));
      if (parts.round > 1 && !notable) parts.desk = undefined;
      if (parts.round > 1 && !/complete|concludes/.test(parts.onClock)) parts.onClock = "";
    }
    if (inRoom && !document.hidden && parts) {
      setLine([parts.podium, parts.desk, guest ? `${guest.name}: "${guest.line}"` : "", parts.onClock].filter(Boolean).join(" "));
      replay.current = { text: parts.podium, response, nextLine: parts.onClock, desk: parts.desk, round: parts.round, guest };
      setReaction(response);
      if (enabled) speak(parts.podium, response, parts.onClock, parts.desk, parts.round, guest);
      else if (crowd && response) {
        stop();
        void playReaction(response, serial.current);
      }
    }
  }, [snapshot, enabled, crowd, inRoom, speak, stop, playReaction]);

  const deskName = draftAnalystFor(save.year).name;
  const now = replay.current;
  const controls = (
    <section className="rounded-lg border border-brass/30 bg-black/50 px-3 py-2.5" aria-label="Draft announcer">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className="lb-pill"
          aria-pressed={enabled}
          aria-label="Announcer"
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
          Announcer
        </button>
        <button
          type="button"
          className="lb-pill"
          aria-pressed={crowd}
          aria-label="Crowd"
          onClick={() => {
            if (crowd) {
              audio.current?.stop();
              setCrowd(false);
            } else startCrowd();
          }}
        >
          Crowd
        </button>
        <button
          type="button"
          className="lb-pill"
          aria-pressed={music}
          aria-label="Music"
          onClick={() => {
            if (music) setMusic(false);
            else startMusic();
          }}
        >
          Music
        </button>
        {enabled && (
          <button
            type="button"
            className="lb-ctl ml-auto h-9"
            disabled={!line}
            aria-label="Replay announcement"
            onClick={() => {
              const r = replay.current;
              if (r) speak(r.text, r.response, r.nextLine, r.desk, r.round, r.guest);
            }}
          >
            <span aria-hidden>↺</span> Replay
          </button>
        )}
      </div>
      {enabled && hd.status === "loading" && (
        <p className="mt-2 text-xs text-brass" role="status">
          Warming up the studio voices · {Math.round(hd.progress * 100)}% · the first picks wait for them (about 90 MB, once).
        </p>
      )}
      {enabled && now && (
        <div className="mt-2.5 space-y-1 border-l-2 border-red pl-3 text-sm" aria-live="polite">
          <p className="flex items-center gap-2 font-display text-[10px] font-bold uppercase italic tracking-[0.2em] text-muted">
            <i className={`block h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-red" : "bg-subtle"}`} aria-hidden />
            {busy ? "At the podium" : "Last pick"}
          </p>
          <p className="text-[15px] leading-snug text-white">{now.text}</p>
          {now.desk && (
            <p className="italic leading-snug text-paper">
              <span className="not-italic font-display text-[11px] font-bold uppercase tracking-wide text-brass">{deskName}: </span>
              {now.desk}
            </p>
          )}
          {now.guest && (
            <p className="leading-snug text-paper">
              <span className="font-display text-[11px] font-bold uppercase tracking-wide text-brass">{now.guest.name}: </span>&ldquo;{now.guest.line}&rdquo;
            </p>
          )}
          {now.nextLine && <p className="text-xs text-muted">{now.nextLine}</p>}
        </div>
      )}
      {reaction && (
        <p className="mt-2 text-xs text-brass" role="status">
          <strong>{reaction.label}.</strong> {reaction.reason}
        </p>
      )}
      {error && (
        <p role="status" className="mt-2 text-sm text-brass">
          {error}
        </p>
      )}
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">Audio settings</summary>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {enabled && (
            <label>
              Voice
              <select
                aria-label="Draft announcer voice"
                className="ml-2 min-h-9 max-w-full rounded border border-line bg-studio px-2"
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
          )}
          <label className="flex items-center gap-2">
            Volume
            <input aria-label="Draft announcer volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            Music
            <input aria-label="Draft music volume" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} />
          </label>
        </div>
        <p className="mt-2">
          Fan reaction is based on today&apos;s scouting. Original draft theme: On the Clock. Crowd recordings:{" "}
          <a href="https://soundbible.com/1964-Small-Crowd-Applause.html" target="_blank" rel="noreferrer">
            Small Crowd Applause — Yannick Lemieux
          </a>
          ;{" "}
          <a href="https://soundbible.com/654-Crowd-Boo-And-Heckles.html" target="_blank" rel="noreferrer">
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
