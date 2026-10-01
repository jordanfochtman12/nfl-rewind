import { footballSpeech } from "@/lib/game/footballSpeech";
import { useEffect, useRef, useState } from "react";
import type { PrimetimeShow } from "@/lib/game";
import { Logo } from "./chrome";
import { stadiumAudio } from "./stadiumAudio";

type Episode = NonNullable<PrimetimeShow["episode"]>;

/** A directed, chapter-by-chapter broadcast. The frozen script is also the accessible transcript. */
export function StudioEpisode({ episode, year }: { episode: Episode; year: number }) {
  const [index, setIndex] = useState(0),
    [line, setLine] = useState(0),
    [playing, setPlaying] = useState(false);
  const [narration, setNarration] = useState(true),
    [music, setMusic] = useState(true),
    [volume, setVolume] = useState(0.35);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState("");
  const [error, setError] = useState("");
  const audio = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const chapter = episode.chapters[index]!;
  const current = chapter.lines[line]!;
  const finale = episode.edition === "superBowl";
  const end = index === episode.chapters.length - 1 && line === chapter.lines.length - 1;
  const advance = () => {
    if (line < chapter.lines.length - 1) setLine(line + 1);
    else if (index < episode.chapters.length - 1) {
      setIndex(index + 1);
      setLine(0);
    } else setPlaying(false);
  };
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
      const preferred =
        voices.find((v) => v.name === voice) ??
        voices.find((v) => /Natural|Online|Google/i.test(v.name)) ??
        voices.find((v) => v.lang === "en-US") ??
        voices[0];
      if (preferred) speech.voice = preferred;
      speech.rate = current.speaker === "ANALYST" ? 0.96 : 1;
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
  }, [playing, index, line, narration, voice, voices, year]);
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
              try {
                if (!audio.current) audio.current = stadiumAudio();
                void audio.current.context.resume();
              } catch {
                setError("Music is unavailable. The show transcript remains available.");
              }
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
              aria-label="Studio narrator voice"
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
            <span className="pt-onair">{playing ? "ON AIR" : "STUDIO REPLAY"}</span>
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
                  {l.speaker === "HOST"
                    ? "STUDIO"
                    : l.speaker === "ANALYST"
                      ? "BREAKDOWN"
                      : "LEAGUE REPORT"}
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
        REWIND NETWORK · Original studio coverage · Music: Sunday Lights / Network Mix
      </p>
    </section>
  );
}
