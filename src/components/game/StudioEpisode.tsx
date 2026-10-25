import { footballSpeech } from "@/lib/game/footballSpeech";
import { settingsNow, useSettings } from "@/lib/settings-store";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { clubInk, logoSrc, showGraphic, showTicker, type PrimetimeShow } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { LowerThird, ShowGraphicView, ShowOpen, ShowTicker } from "./ShowKit";
import { Logo } from "./chrome";
import { stadiumAudio } from "./stadiumAudio";
import { castVoices, PHONE_VOICE, voiceChoices, voiceKey, voiceLabel } from "@/lib/voiceCast";
import { crewFor, crewGender } from "@/lib/game/previewVoice";
import { cancelSpeech, speakLine, useTalking } from "@/lib/voice/speech";
import { tvSpeechWatchdogMs } from "@/lib/game/tvCountdown";

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
  const supportVoices = useSettings((s) => s.supportVoiceNames);
  const setSettings = useSettings((s) => s.set);
  const [error, setError] = useState("");
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  const misses = useRef(0);
  const audio = useRef<ReturnType<typeof stadiumAudio> | null>(null);
  const save = useGameStore((s) => s.save);
  // The show this episode belongs to (this week's or an archived one): its boards and honorees.
  const show = useMemo(
    () => (save ? [save.primetime, ...(save.primetimeArchive ?? [])].find((x) => x?.episode?.id === episode.id) : undefined),
    [save, episode.id],
  );
  const [opening, setOpening] = useState(false);
  const doneCalled = useRef(false);
  const chapter = episode.chapters[index]!;
  const graphic = useMemo(() => (save ? showGraphic(save, year, episode, chapter, show) : undefined), [save, year, episode, chapter, show]);
  const ticker = useMemo(() => (save ? showTicker(save, year, show?.week) : []), [save, year, show?.week]);
  const current = chapter.lines[line]!;
  const finale = episode.edition === "superBowl";
  const preview = episode.edition === "seasonPreview";
  const end = index === episode.chapters.length - 1 && line === chapter.lines.length - 1;
  const finishBroadcast = () => {
    if (doneCalled.current) return;
    doneCalled.current = true;
    setPlaying(false);
    if (autoPlay && "speechSynthesis" in window) cancelSpeech();
    done.current?.();
  };
  const advance = () => {
    if (line < chapter.lines.length - 1) setLine(line + 1);
    else if (index < episode.chapters.length - 1) {
      setIndex(index + 1);
      setLine(0);
    } else {
      finishBroadcast();
    }
  };  // The narration effect calls the latest advance without restarting on every render.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const start = () => {
    try {
      if (!audio.current) audio.current = stadiumAudio();
      void audio.current.context.resume();
    } catch {
      setError("Music is unavailable. The show transcript remains available.");
    }
  };
  const air = useTalking();
  // The open rolls, then the desk comes up and the show starts.
  const endOpen = useCallback(() => {
    setOpening(false);
    setPlaying(true);
  }, []);
  useEffect(() => {
    if (!autoPlay) return;
    start();
    setOpening(true);
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
      if ("speechSynthesis" in window) cancelSpeech();
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
      if (active) advanceRef.current();
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
      const cast = castVoices(voicesRef.current, [
        { ...who("HOST"), rate: 1 },
        { ...who("ANALYST"), pitch: 0.96, rate: 0.97 },
        { ...who("REPORTER"), rate: 1.03 },
      ], { HOST: voice, ...supportVoices });
      const c = cast.get(current.speaker);
      if (c?.voice) speech.voice = c.voice;
      speech.pitch = c?.pitch ?? 1;
      speech.rate = c?.rate ?? 1;
      let settled = false;
      const settle = () => {
        if (!active || settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        next();
      };
      // iOS can suspend speechSynthesis without sending onend or onerror. A bounded fallback
      // keeps TV moving, while the permanent Continue control below lets viewers skip now.
      const watchdog = window.setTimeout(() => {
        if (active && autoPlay) {
          setError("Phone narration paused; continuing the historical broadcast.");
          cancelSpeech();
          settle();
        }
      }, tvSpeechWatchdogMs(current.text));
      speech.onend = () => {
        misses.current = 0;
        settle();
      };
      // A line the voice couldn't read is skipped, not the show: phones drop one now and then.
      // Only when nothing will read does the show stop.
      speech.onerror = () => {
        if (!active) return;
        misses.current += 1;
        if (misses.current >= 3) {
          setError("Narration stopped. You can continue with the transcript or switch voices.");
          if (autoPlay) settle();
          else setPlaying(false);
          return;
        }
        if (autoPlay) window.setTimeout(settle, 600);
      };
      speakLine(speech);
      return () => {
        active = false;
        window.clearTimeout(watchdog);
        cancelSpeech();
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
    // The voice list is read from a ref: the phone reloading it mid-line must not restart the read.
  }, [playing, index, line, narration, voice, supportVoices, year, episode.cast, current.speaker, current.text, chapter.lines, episode.chapters, autoPlay]);
  const select = (n: number) => {
    setIndex(n);
    setLine(0);
    setPlaying(false);
    setError("");
  };
  return (
    <section
      className={`pt-show ${finale ? "pt-show-finale" : ""} ${playing ? "is-playing" : ""}`}
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
              if (end || (index === 0 && line === 0)) {
                setOpening(true);
                return;
              }
            }
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause show" : end ? "Replay show" : "Watch show"}
        </button>
        {autoPlay && (
          <button className="bx-chip min-h-11 px-3" onClick={finishBroadcast}>
            Continue broadcast ▸
          </button>
        )}
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
          <div className="flex flex-wrap gap-2">
            {(["HOST", "ANALYST", "REPORTER"] as const).map((speaker) => {
              const selectedVoice = speaker === "HOST" ? voice : supportVoices[speaker];
              return <label className="pt-voice" key={speaker}>
                {speaker === "HOST" ? "Host" : speaker === "ANALYST" ? "Analyst" : "Reporter"}
                <select
                  aria-label={`${speaker === "HOST" ? "Host" : speaker === "ANALYST" ? "Analyst" : "Reporter"} voice`}
                  value={selectedVoice ?? ""}
                  onChange={(e) => {
                    if (speaker === "HOST") {
                      setVoice(e.target.value);
                      setSettings({ voiceName: e.target.value });
                    } else setSettings({ supportVoiceNames: { ...supportVoices, [speaker]: e.target.value } });
                  }}
                >
                  <option value="">Automatic cast</option>
                  <option value={PHONE_VOICE}>Phone's voice (Spoken Content)</option>
                  {voiceChoices(voices).map((v) => (
                    <option key={voiceKey(v)} value={voiceKey(v)}>{voiceLabel(v)}</option>
                  ))}
                </select>
              </label>;
            })}
          </div>
        )}
      </div>
      {error && (
        <p role="status" className="px-5 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="pt-show-grid">
        <div
          className={`pt-stage k5-studio ${year < 1980 ? "is-era-70s" : year < 2000 ? "is-era-90s" : "is-era-now"}`}
          style={{ "--club": chapter.teamIds[0] ? clubInk(chapter.teamIds[0], year).primary : "#d51c38" } as CSSProperties}
        >
          <div className="k5-studio-set" aria-hidden />
          {chapter.teamIds[0] && (
            <img key={`mark-${chapter.id}`} className="k5-studio-mark" src={logoSrc(year, chapter.teamIds[0])} alt="" aria-hidden />
          )}
          {playing && index > 0 && (
            <div key={`bump-${chapter.id}`} className="k5-bumper" aria-hidden>
              <span>{chapter.kicker}</span>
              <b>{chapter.title}</b>
            </div>
          )}
          {opening && (
            <ShowOpen
              show={finale ? "SUPER BOWL POSTGAME" : preview ? "SEASON PREVIEW SPECIAL" : episode.edition === "awards" ? "AWARDS NIGHT" : episode.edition === "playoffs" || episode.edition === "championship" ? "PLAYOFF PRIMETIME" : "PRIMETIME"}
              title={episode.headline}
              sub={episode.subtitle}
              teamIds={episode.chapters[0]?.teamIds ?? []}
              year={year}
              onDone={endOpen}
            />
          )}
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
            {playing && narration && air.talking && <span className="pt-mic" role="status">● On the mic…</span>}
            <span>
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(episode.chapters.length).padStart(2, "0")} SEGMENTS
            </span>
          </div>
          {!graphic && (
            <div className="pt-stage-emblems" aria-hidden>
              {chapter.teamIds.slice(0, 2).map((id) => (
                <Logo key={id} id={id} size={90} />
              ))}
            </div>
          )}
          <p className="pt-kicker">{chapter.kicker}</p>
          <h3>{chapter.title}</h3>
          {graphic && <ShowGraphicView key={chapter.id} g={graphic} year={year} />}
          {(() => {
            const who = episode.cast?.[current.speaker] ?? crewFor(year)[current.speaker];
            return <LowerThird key={`${index}-${line}`} name={who.name} role={who.role} accent={current.speaker === "HOST" ? "#d51c38" : current.speaker === "ANALYST" ? "#2f6fd6" : "#c9a24f"} />;
          })()}
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
          <ShowTicker items={ticker} />
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
