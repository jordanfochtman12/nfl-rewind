import { footballSpeech } from "@/lib/game/footballSpeech";
import { settingsNow } from "@/lib/settings-store";
import { useEffect, useRef, useState } from "react";
import type { PrimetimeShow } from "@/lib/game";
import { Logo } from "./chrome";
import { stadiumAudio } from "./stadiumAudio";
import { castVoices } from "@/lib/voiceCast";
import { crewFor, crewGender } from "@/lib/game/previewVoice";

type Episode = NonNullable<PrimetimeShow["episode"]>;

/**
 * A directed, chapter-by-chapter broadcast. The frozen script is also the accessible transcript.
 * `autoPlay` starts the show on mount and `onDone` fires when the last read ends (TV mode).
 */
export function StudioEpisode({
  episode,
  year,
  autoPlay,
  onDone,
}: {
  episode: Episode;
  year: number;
  autoPlay?: boolean;
  onDone?: () => void;
}) {
  const [index, setIndex] = useState(0),
    [line, setLine] = useState(0),
    [playing, setPlaying] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const [narration, setNarration] = useState(() => settingsNow().narration),
    [music, setMusic] = useState(() => settingsNow().music),
    [volume, setVolume] = useState(0.35);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState(() => settingsNow().voiceName);
  const [error, setError] = useState("");
  const audio = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const chapter = episode.chapters[index]!;
  const current = chapter.lines[line]!;
  const finale = episode.edition === "superBowl";
  const preview = episode.edition === "seasonPreview";
  const end = index === episode.chapters.length - 1 && line === chapter.lines.length - 1;
  const advance = () => {
    if (line < chapter.lines.length - 1) setLine(line + 1);
    else if (index < episode.chapters.length - 1) {
      setIndex(index + 1);
      setLine(0);
    } else {
      setPlaying(false);
      done.current?.();
    }
  };
  const start = () => {
    try {
      if (!audio.current) audio.current = stadiumAudio();
      void audio.current.context.resume();
    } catch {
      setError("Music is unavailable. The show transcript remains available.");
    }
  };
  useEffect(() => {
    if (!autoPlay) return;
    start();
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () =>
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      audio.current?.close();
      audio.current = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  useEffect(() => {
    audio.current?.setMusic(music, volume);
    if (playing) void audio.current?.context.resume();
    else void audio.current?.context.suspend();
  }, [playing, music, volume]);
  useEffect(() => {
    if (!playing) return;
    let active = true;
    const next = () => {
      if (active) advance();
    };
    if (narration && "speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(footballSpeech(current.text, year));
      // Every person on the desk has a voice of their own that matches them: the host takes a
      // chosen voice if one is picked, and nobody shares a voice unless the device runs out.
      const crew = crewFor(year);
      const who = (k: "HOST" | "ANALYST" | "REPORTER") => {
        const c = episode.cast?.[k];
        return { key: k, gender: c?.gender ?? (c ? crewGender(c.name) : undefined) ?? crew[k].gender };
      };
      const cast = castVoices(voices, [
        { ...who("HOST"), rate: 1 },
        { ...who("ANALYST"), pitch: 0.96, rate: 0.97 },
        { ...who("REPORTER"), rate: 1.03 },
      ], voice);
      const c = cast.get(current.speaker);
      if (c?.voice) speech.voice = c.voice;
      speech.pitch = c?.pitch ?? 1;
      speech.rate = c?.rate ?? 1;
      speech.onend = next;
      speech.onerror = () => {
        if (active) {
          setError("Narration stopped. You can continue with the transcript or switch voices.");
          setPlaying(false);
        }
      };
      window.speechSynthesis.speak(speech);
      return () => {
        active = false;
        window.speechSynthesis.cancel();
      };
    }
    const timer = window.setTimeout(
      next,
      Math.max(5000, (current.text.split(/\s+/).length / 2.8) * 1000),
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [playing, index, line, narration, voice, voices, year, episode.cast]);
  const select = (n: number) => {
    setIndex(n);
    setLine(0);
    setPlaying(false);
    setError("");
  };
  return (
    <section
      className={`pt-show ${finale ? "pt-show-finale" : ""}`}
      aria-label="Primetime episode player"
    >
      <div className="pt-show-control">
        <button
          className="bx-primary min-h-11 px-5"
          onClick={() => {
            if (!playing) {
              start();
              if (end) {
                setIndex(0);
                setLine(0);
              }
            }
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause show" : end ? "Replay show" : "Watch show"}
        </button>
        <button
          className="bx-chip min-h-11 px-3"
          aria-pressed={narration}
          onClick={() => setNarration(!narration)}
        >
          Narration: {narration ? "on" : "off"}
        </button>
        <button
          className="bx-chip min-h-11 px-3"
          aria-pressed={music}
          onClick={() => setMusic(!music)}
        >
          Theme: {music ? "on" : "off"}
        </button>
        <label className="pt-volume">
          Music{" "}
          <input
            aria-label="Studio music volume"
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
          />
          <span>{Math.round(volume * 100)}%</span>
        </label>
        {narration && (
          <label className="pt-voice">
            Voice
            <select
              aria-label="Host voice"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              <option value="">Best available English voice</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="status" className="px-5 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="pt-show-grid">
        <div className="pt-stage">
          {finale && (
            <div className="pt-celebration" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `-${i * 0.43}s`,
                    animationDuration: `${5 + (i % 4)}s`,
                  }}
                />
              ))}
              <svg className="pt-trophy" viewBox="0 0 100 180">
                <defs>
                  <linearGradient id="studio-trophy">
                    <stop stopColor="#fff5d0" />
                    <stop offset=".5" stopColor="#b3914c" />
                    <stop offset="1" stopColor="#fff4ca" />
                  </linearGradient>
                </defs>
                <path d="M34 68 24 146h52L65 68ZM20 148h60v18H20z" fill="url(#studio-trophy)" />
                <ellipse
                  cx="50"
                  cy="40"
                  rx="25"
                  ry="39"
                  transform="rotate(30 50 40)"
                  fill="url(#studio-trophy)"
                />
                <path
                  d="m35 58 30-40M41 49l12 8M46 41l12 8M51 33l12 8"
                  stroke="#6b5326"
                  strokeWidth="2"
                />
              </svg>
            </div>
          )}
          <div className="pt-stage-top">
            <span className="pt-onair">{playing ? "ON AIR" : preview ? "SEASON PREVIEW" : "STUDIO REPLAY"}</span>
            <span>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(episode.chapters.length).padStart(2, "0")} SEGMENTS
            </span>
          </div>
          <div className="pt-stage-emblems" aria-hidden>
            {chapter.teamIds.slice(0, 2).map((id) => (
              <Logo key={id} id={id} size={90} />
            ))}
          </div>
          <p className="pt-kicker">{chapter.kicker}</p>
          <h3>{chapter.title}</h3>
          <div className="pt-script" aria-live={playing ? "off" : "polite"}>
            {chapter.lines.map((l, i) => (
              <div key={i} className={i === line ? "pt-script-line is-speaking" : "pt-script-line"}>
                <span>
                  {(episode.cast?.[l.speaker]?.name ?? crewFor(year)[l.speaker].name).toUpperCase()}
                </span>
                <p>{l.text}</p>
              </div>
            ))}
          </div>
          <div className="pt-stage-bottom">
            <button
              className="bx-chip min-h-11 px-3"
              disabled={!index}
              onClick={() => select(index - 1)}
            >
              Previous segment
            </button>
            <span>
              {line + 1} / {chapter.lines.length} reads
            </span>
            <button
              className="bx-chip min-h-11 px-3"
              disabled={index === episode.chapters.length - 1}
              onClick={() => select(index + 1)}
            >
              Next segment
            </button>
          </div>
        </div>
        <nav className="pt-rundown" aria-label="Episode chapters">
          <p>TONIGHT'S RUNDOWN</p>
          {episode.chapters.map((c, i) => (
            <button
              key={c.id}
              aria-current={i === index ? "step" : undefined}
              onClick={() => select(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <small>{c.kicker}</small>
                <strong>{c.title}</strong>
              </div>
            </button>
          ))}
        </nav>
      </div>
      <p className="pt-production-note">
        REWIND NETWORK · {preview ? "Season preview special" : "Original studio coverage"} · Music: Sunday Lights / Network Mix
      </p>
    </section>
  );
}
