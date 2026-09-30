import { BroadcastField } from "./BroadcastField";
import { FilmReport } from "./FilmReport";
import { useBroadcastSound } from "./BroadcastSound";
import { boothLine } from "@/lib/game/commentary";
import { useEffect, useMemo, useRef, useState } from "react";
import { clubInk, teamAbbr, type GameResult, type PlayLog, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";

/** Games already watched this session, so revisiting the film doesn't replay the broadcast. */
const watched = new Set<string>();
export function wasWatched(id: string): boolean {
  if (watched.has(id)) return true;
  try {
    return sessionStorage.getItem(`nfl-rewind:watched:${id}`) === "1";
  } catch {
    return false;
  }
}
function markWatched(id: string): void {
  watched.add(id);
  try {
    sessionStorage.setItem(`nfl-rewind:watched:${id}`, "1");
  } catch {
    /* private mode */
  }
}

// Standard normal CDF (Abramowitz-Stegun), for the win-probability line.
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Win probability for `us` after a play: score, time left, and who has the ball where. */
export function winProb(l: PlayLog, us: TeamId, home: TeamId, final: boolean): number {
  const ours = us === home ? l.hs : l.as;
  const theirs = us === home ? l.as : l.hs;
  const lead = ours - theirs;
  if (final) return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  const left = l.q <= 4 ? ((4 - l.q) * 900 + l.clock) / 3600 : Math.max(0.01, l.clock / 3600);
  const field = ((l.spot - 25) / 15) * (l.poss === us ? 1 : -1);
  return Math.min(0.995, Math.max(0.005, phi((lead + field) / (13.4 * Math.sqrt(Math.max(0.004, left)) + 0.6))));
}

const ORD = ["", "1st", "2nd", "3rd", "4th"];
const clockText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function spotText(l: PlayLog, opp: TeamId): string {
  if (l.spot === 50) return "midfield";
  return l.spot < 50 ? `${teamAbbr(l.poss)} ${l.spot}` : `${teamAbbr(opp)} ${100 - l.spot}`;
}

const TAG_STYLE: Record<NonNullable<PlayLog["tag"]>, { label: string; cls: string }> = {
  td: { label: "TOUCHDOWN", cls: "bg-brass text-[#140f00]" },
  fg: { label: "FIELD GOAL", cls: "bg-good text-black" },
  to: { label: "TURNOVER", cls: "bg-red text-white" },
  big: { label: "BIG PLAY", cls: "bg-white text-black" },
  call: { label: "YOUR CALL", cls: "bg-brass text-[#140f00]" },
  safety: { label: "SAFETY", cls: "bg-red text-white" },
};

const SPEEDS = [
  { label: "1x", ms: 2200 },
  { label: "2x", ms: 1000 },
  { label: "4x", ms: 400 },
];

/**
 * The owner's game as a broadcast: score bug, field strip, the play feed and a live win
 * probability line. `log` can be a partial game (a crunch-time call pauses it at the moment).
 */
export function LiveBroadcast({
  game,
  log,
  startAt = 0,
  onDone,
  onReachEnd,
  compact = false,
  final = true,
}: {
  game: GameResult;
  log: PlayLog[];
  startAt?: number;
  /** The owner leaves the broadcast (postgame film). */
  onDone?: () => void;
  /** Playback reached the last logged play. */
  onReachEnd?: () => void;
  compact?: boolean;
  /** False when the log stops mid-game (a crunch-time call); no FINAL at the end. */
  final?: boolean;
}) {
  const save = useGameStore((s) => s.save)!;
  const us = save.userTeamId;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const [i, setI] = useState(Math.min(startAt, Math.max(0, log.length - 1)));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(compact ? 1 : 0);
  const doneRef = useRef(false);
  const [halftime, setHalftime] = useState(false);
  const halfSeen = useRef(startAt > 0);
  const sound = useBroadcastSound(playing && !halftime && i < log.length - 1, log[i]?.tag ?? "", log[i] ? boothLine(log[i]!, i) : "", i);
  const atEnd = i >= log.length - 1;
  const playMs = compact ? 300 : SPEEDS[speed]!.ms;

  useEffect(() => {
    if (!playing || atEnd || halftime) return;
    if (!compact && !halfSeen.current && log[i]?.q <= 2 && (log[i + 1]?.q ?? 0) >= 3) {
      halfSeen.current = true; setHalftime(true); return;
    }
    const t = setTimeout(() => setI((n) => Math.min(log.length - 1, n + 1)), playMs);
    return () => clearTimeout(t);
  }, [i, playing, playMs, atEnd, log, halftime, compact]);

  useEffect(() => {
    if (atEnd && !doneRef.current) {
      doneRef.current = true;
      if (final) markWatched(game.id);
      onReachEnd?.();
    }
  }, [atEnd, final, game.id, onReachEnd]);

  const setLiveGame = useGameStore((s) => s.setLiveGame);
  const liveNow = !(final && atEnd);
  useEffect(() => {
    setLiveGame(liveNow ? game.id : null);
    return () => setLiveGame(null);
  }, [liveNow, game.id, setLiveGame]);

  const wp = useMemo(() => log.map((l, k) => winProb(l, us, home, final && k === log.length - 1)), [log, us, home, final]);
  const cur = log[i];
  if (!cur) return null;
  const next = log[i + 1];
  // What the screen shows as "now": the situation for the next snap, the score after this one.
  const sit = next ?? cur;
  const homeInk = clubInk(home, save.year);
  const awayInk = clubInk(away, save.year);
  const opp = (sit.poss === home ? away : home) as TeamId;
  const ended = final && atEnd;
  const feed = log.slice(Math.max(0, i - (compact ? 3 : 7)), i + 1).reverse();
  const keyPlays = log.slice(0, i + 1).filter((l) => l.tag && l.tag !== "big");

  // Win-probability path, drawn up to the current play.
  const W = 600;
  const H = compact ? 70 : 110;
  const pts = wp.slice(0, i + 1).map((v, k) => `${((k / Math.max(1, log.length - 1)) * W).toFixed(1)},${((1 - v) * H).toFixed(1)}`);
  const usWp = wp[i]!;

  const slab = (id: TeamId, score: number, ink: ReturnType<typeof clubInk>, side: "l" | "r") => (
    <div
      className={`flex min-w-0 items-center gap-2 px-3 py-2 ${side === "r" ? "flex-row-reverse text-right" : ""}`}
      style={{
        background: `linear-gradient(180deg, #ffffff2e, transparent 46%, #0000 54%, #0005), linear-gradient(${side === "l" ? 115 : 245}deg, ${ink.primary}, color-mix(in srgb, ${ink.primary} 40%, black) 90%)`,
        color: ink.onPrimary,
      }}
    >
      <Logo id={id} size={compact ? 28 : 36} />
      <span className="font-display text-sm font-extrabold italic uppercase">{teamAbbr(id)}</span>
      {!ended && sit.poss === id && <span className="h-2 w-2 rounded-full bg-brass shadow-[0_0_8px_#ffc629]" aria-label="possession" />}
      <span className={`bug-num ${compact ? "text-3xl" : "text-4xl"} ${side === "r" ? "mr-auto" : "ml-auto"}`}>{score}</span>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_24px_60px_-28px_#000]" aria-label="Live broadcast">
      {compact && !atEnd && <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-muted"><span>Replay to your decision</span><button type="button" className="bx-chip min-h-9 px-3" onClick={() => setI(log.length - 1)}>Jump to decision</button></div>}
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-[#161b26] to-[#07090e] px-4 py-2">
          <p className="bx-primary px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] [transform:skewX(-12deg)]">
            <span className="inline-block [transform:skewX(12deg)]">{ended ? "FINAL" : "LIVE"}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {!ended && (
              <>
                <button type="button" onClick={() => { sound.chime(); setPlaying((p) => !p); }} className="bx-chip min-h-8 px-3 text-[11px]">
                  {playing ? "Pause" : "Play"}
                </button>
                {SPEEDS.map((s2, k) => (
                  <button key={s2.label} type="button" onClick={() => { sound.chime(); setSpeed(k); }} className={`bx-chip min-h-8 px-2.5 text-[11px] ${speed === k ? "bx-chip-on" : ""}`}>
                    {s2.label}
                  </button>
                ))}
                <button type="button" onClick={() => { setHalftime(false); halfSeen.current = true; setI(log.length - 1); }} className="bx-chip min-h-8 px-3 text-[11px]">
                  Skip to final
                </button>
              </>
            )}
            {ended && (
              <button
                type="button"
                onClick={() => {
                  doneRef.current = true;
                  halfSeen.current = false;
                  setHalftime(false);
                  setI(0);
                  setPlaying(true);
                }}
                className="bx-chip min-h-8 px-3 text-[11px]"
              >
                Replay
              </button>
            )}
          </div>
        </div>
      )}

      {!compact && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">{sound.controls}<span className="text-[11px] text-muted">{game.stadium} · {game.indoor ? "Indoors" : game.weather ?? "Clear"}</span></div>}

      {/* score bug */}
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {slab(away, cur.as, awayInk, "l")}
        <div className="flex flex-col items-center justify-center bg-black px-3">
          <p className="bug-num text-xl text-brass">{ended ? "FINAL" : halftime ? "HALFTIME" : `${sit.q > 4 ? "OT" : `Q${sit.q}`} ${clockText(sit.clock)}`}</p>
          {!ended && !halftime && (
            <p className="whitespace-nowrap font-display text-[11px] font-bold uppercase italic tracking-wide text-muted">
              {ORD[Math.min(4, sit.down)] ?? "4th"} & {sit.togo} · {spotText(sit, opp)}
            </p>
          )}
        </div>
        {slab(home, cur.hs, homeInk, "r")}
      </div>

      <BroadcastField play={cur} home={home} away={away} homeColor={homeInk.primary} awayColor={awayInk.primary} playing={playing && !halftime} index={i} duration={Math.min(1100, playMs * .8)} />
      {!compact && <div className="flex flex-wrap items-center gap-3 border-y border-white/10 px-4 py-2 text-xs text-muted"><span>{teamAbbr(away)} timeouts: {cur.awayTimeouts ?? "—"}</span><span>{teamAbbr(home)} timeouts: {cur.homeTimeouts ?? "—"}</span><span className="ml-auto">Play {i + 1} / {log.length}</span></div>}
      {halftime && <div className="border-b border-brass/30"><FilmReport game={game} log={log.slice(0, i + 1)} halftime /><div className="px-5 pb-4"><Btn kind="primary" onClick={() => { setHalftime(false); setI(n => Math.min(log.length - 1, n + 1)); setPlaying(true); }}>Start second half ▸</Btn></div></div>}
      {!compact && <div className="flex flex-wrap gap-2 px-3 pt-3"><button className="bx-chip min-h-9 px-3 text-xs" type="button" disabled={i === 0} onClick={() => { setHalftime(false); setPlaying(false); setI(n => Math.max(0,n-1)); }}>Previous play</button><button className="bx-chip min-h-9 px-3 text-xs" type="button" disabled={atEnd} onClick={() => { setHalftime(false); setPlaying(false); setI(n => Math.min(log.length-1,n+1)); }}>Next play</button><span className="self-center text-xs text-muted">Select a key moment below to replay it.</span></div>}

      <div className={`grid gap-0 ${compact ? "" : "md:grid-cols-[1.4fr_1fr]"}`}>
        {/* play feed */}
        <ol className="space-y-1.5 p-3" aria-live="polite">
          {feed.map((l, k) => {
            const t = l.tag ? TAG_STYLE[l.tag] : undefined;
            return (
              <li key={`${l.q}-${l.clock}-${k}-${l.text}`} className={`border-l-2 pl-3 ${k === 0 ? "border-red" : "border-white/10 opacity-70"}`}>
                <p className="font-display text-[11px] font-bold uppercase italic tracking-wide text-subtle">
                  {l.q > 4 ? "OT" : `Q${l.q}`} {clockText(l.clock)} · {teamAbbr(l.poss)} · {ORD[Math.min(4, l.down)]} & {l.togo}
                  {t && <span className={`ml-2 px-1.5 py-px not-italic ${t.cls}`}>{t.label}</span>}
                </p>
                <p className={k === 0 ? "text-[15px] text-white" : "text-sm text-paper"}>{l.text}</p>
              </li>
            );
          })}
        </ol>

        {!compact && (
          <div className="border-t border-white/10 p-3 md:border-l md:border-t-0">
            <p className="flex items-baseline justify-between font-display text-xs font-bold uppercase italic tracking-wide text-muted">
              <span>Estimated win probability · {teamAbbr(us)}</span>
              <span className="bug-num text-2xl text-white">{Math.round(usWp * 100)}%</span>
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-24 w-full" preserveAspectRatio="none" aria-hidden>
              <rect width={W} height={H} fill="#0b0e15" />
              {[0.25, 0.5, 0.75].map((y) => (
                <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} stroke="#ffffff" strokeOpacity={y === 0.5 ? 0.25 : 0.08} strokeDasharray={y === 0.5 ? "4 4" : undefined} />
              ))}
              {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke="#ffc629" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
            </svg>
            {keyPlays.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                {keyPlays
                  .slice()
                  .reverse()
                  .map((l, k) => (
                    <li key={k} className="flex gap-2">
                      <span className={`shrink-0 px-1 font-display font-bold italic ${TAG_STYLE[l.tag!].cls}`}>{TAG_STYLE[l.tag!].label.split(" ")[0]}</span>
                      <button type="button" className="text-left text-paper underline decoration-white/20 hover:text-white" onClick={() => { setHalftime(false); setI(log.indexOf(l)); setPlaying(false); }}>
                        {l.q > 4 ? "OT" : `Q${l.q}`} {teamAbbr(l.poss)}: {l.text}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {ended && !compact && (
        <div className="border-t border-white/10 px-4 py-3">
          <Btn kind="primary" onClick={() => onDone?.()}>
            Postgame film <span aria-hidden>▸</span>
          </Btn>
        </div>
      )}
    </section>
  );
}
