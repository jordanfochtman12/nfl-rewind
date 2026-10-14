import { BroadcastField } from "./BroadcastField";
import { FilmReport } from "./FilmReport";
import { useBroadcastSound } from "./BroadcastSound";
import { boothCall } from "@/lib/game/commentary";
import { boothFor, firstName } from "@/lib/game/broadcastCrew";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { clubInk, nicknameOf, ordersUpTo, teamAbbr, type GameResult, type Gameplan, type LiveOrder, type PlayLog, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { eraLook, useEraClass } from "./eraLook";
import { markWatched } from "./liveWatch";
import { wpSeries } from "@/lib/game/gameday";
import { CueChip, HalftimeDesk, KeyMatchups, MomentumMeter, PostgameInterviews } from "./Gameday";
import { PregameIntro, StatPop, WinMeter } from "./LiveExtras";

const ORD = ["", "1st", "2nd", "3rd", "4th"];
/** Games whose pregame already ran this session. */
const introSeen = new Set<string>();
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
  canCall = false,
  autoHalftime = false,
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
  /** The owner can send calls down from his box (the game replays from that snap). */
  canCall?: boolean;
  /** TV mode: the halftime report runs a few seconds and the second half starts on its own. */
  autoHalftime?: boolean;
}) {
  const save = useGameStore((s) => s.save)!;
  const eraCls = useEraClass(game.year);
  const home = game.homeId as TeamId;
  // Win probability is told from the owner's side when it's his game, else from the home side.
  const us = !save.sandbox && (game.homeId === save.userTeamId || game.awayId === save.userTeamId) ? save.userTeamId : home;
  const away = game.awayId as TeamId;
  const [i, setI] = useState(Math.min(startAt, Math.max(0, log.length - 1)));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(compact ? 1 : 0);
  const doneRef = useRef(false);
  const held = useRef(false);
  const [halftime, setHalftime] = useState(false);
  // The pregame (stadium, tunnels, starters) runs once per game, before the opening kick.
  const [intro, setIntro] = useState(() => !compact && startAt === 0 && !introSeen.has(game.id));
  const endIntro = useCallback(() => {
    introSeen.add(game.id);
    setIntro(false);
  }, [game.id]);
  const halfSeen = useRef(startAt > 0);
  const booth = boothFor(game.year);
  const callAt = (k: number) =>
    log[k]
      ? boothCall(log[k]!, k, {
          nick: (id) => nicknameOf(game.year, id as TeamId),
          homeId: home,
          awayId: away,
          pbpFirst: firstName(booth.pbp.name),
          colorFirst: firstName(booth.color.name),
          colorBackground: booth.color.background,
          prev: log[k - 1],
          year: game.year,
        })
      : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const call = useMemo(() => callAt(i), [i, log, game.year]);
  // The next three snaps' calls, so the booth's voices are made before the ball is snapped.
  const upcoming = useMemo(
    () => [1, 2, 3].filter((d) => log[i + d]).map((d) => ({ lines: callAt(i + d), cue: log[i + d]?.tag ?? "" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i, log, game.year],
  );
  // How loud the building is: tight and late, a big stage, a team on a run, the crowd cue itself.
  const atNow = log[i];
  const intensity = atNow
    ? Math.min(
        1,
        (atNow.q > 4 ? 0.85 : atNow.q === 4 && Math.abs(atNow.hs - atNow.as) <= 8 ? 0.55 + (900 - atNow.clock) / 3000 : atNow.q >= 3 && Math.abs(atNow.hs - atNow.as) <= 8 ? 0.3 : 0.12) +
          (game.rivalry || game.night || game.phase !== "regular" ? 0.12 : 0) +
          (Math.abs(atNow.mo ?? 0) >= 1.5 ? 0.12 : 0) +
          (atNow.cue === "crowd" ? 0.2 : 0),
      )
    : 0;
  const sound = useBroadcastSound(playing && !halftime && !intro && i < log.length - 1, log[i]?.tag ?? "", call, i, game.year, intensity, upcoming);
  const atEnd = i >= log.length - 1;
  const playMs = compact ? 300 : SPEEDS[speed]!.ms;

  useEffect(() => {
    if (!playing || atEnd || halftime || intro) return;
    if (!compact && !halfSeen.current && log[i]?.q <= 2 && (log[i + 1]?.q ?? 0) >= 3) {
      halfSeen.current = true; setHalftime(true); return;
    }
    // Like a telecast, the next snap waits for the booth to finish the call (not at 4x, which is
    // for skimming), then comes a beat after the last word.
    const hold = sound.holding && !compact && speed < SPEEDS.length - 1;
    if (hold) {
      held.current = true;
      return;
    }
    const wait = held.current ? Math.min(playMs, 650) : playMs;
    held.current = false;
    const t = setTimeout(() => setI((n) => Math.min(log.length - 1, n + 1)), wait);
    return () => clearTimeout(t);
  }, [i, playing, playMs, atEnd, log, halftime, compact, sound.holding, speed, intro]);

  // The desk reads the halftime report when the booth is on; TV mode waits for it to finish.
  const [halfRead, setHalfRead] = useState(false);
  const endHalfRead = useCallback(() => setHalfRead(true), []);
  useEffect(() => {
    if (halftime) setHalfRead(false);
  }, [halftime]);
  useEffect(() => {
    if (!halftime || !autoHalftime) return;
    const go = () => {
      setHalftime(false);
      setI((n) => Math.min(log.length - 1, n + 1));
      setPlaying(true);
    };
    // Unvoiced, the report stays up twelve seconds; voiced, a beat after the desk signs off
    // (and never longer than ninety, whatever happens to the read).
    const t = setTimeout(go, sound.voiced ? (halfRead ? 2500 : 90000) : 12000);
    return () => clearTimeout(t);
  }, [halftime, autoHalftime, log.length, sound.voiced, halfRead]);

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

  const wp = useMemo(() => wpSeries(log, us, home, final), [log, us, home, final]);
  const halfLog = useMemo(() => log.slice(0, i + 1), [log, i]);
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
  // This drive so far: back to the first snap since the ball last changed hands or a score.
  const drive = (() => {
    let k = i;
    while (k > 0) {
      const prev = log[k - 1]!;
      if (prev.poss !== cur.poss || prev.tag === "td" || prev.tag === "fg" || prev.tag === "safety" || prev.tag === "to") break;
      k -= 1;
    }
    return { start: log[k]!.spot, plays: i - k + 1 };
  })();

  // Win-probability path, drawn up to the current play.
  const W = 600;
  const H = compact ? 70 : 110;
  const pts = wp.slice(0, i + 1).map((v, k) => `${((k / Math.max(1, log.length - 1)) * W).toFixed(1)},${((1 - v) * H).toFixed(1)}`);
  const usWp = wp[i]!;

  // Running team totals for the stats strip, from the plays so far.
  const totals = (id: TeamId) => {
    let yds = 0, to = 0, third = 0, thirdAtt = 0;
    for (let k = 0; k <= i; k++) {
      const l = log[k]!;
      if (l.poss !== id) continue;
      if (l.snap && (l.snap.kind === "pass" || l.snap.kind === "run" || l.snap.kind === "sack")) yds += l.snap.yards;
      if (l.tag === "to") to += 1;
      if (l.down === 3 && l.snap && l.snap.kind !== "kick") {
        thirdAtt += 1;
        if (l.snap.yards >= l.togo || l.tag === "td") third += 1;
      }
    }
    return { yds: Math.round(yds), to, third, thirdAtt };
  };
  const timeoutsOf = (id: TeamId) => (id === home ? cur.homeTimeouts : cur.awayTimeouts);
  const slab = (id: TeamId, score: number, ink: ReturnType<typeof clubInk>, side: "l" | "r") => (
    <div
      className={`bug-slab flex min-w-0 items-center gap-2 px-3 py-2 ${side === "r" ? "flex-row-reverse text-right" : ""}`}
      style={{
        background: `linear-gradient(180deg, #ffffff2e, transparent 46%, #0000 54%, #0005), linear-gradient(${side === "l" ? 115 : 245}deg, ${ink.primary}, color-mix(in srgb, ${ink.primary} 40%, black) 90%)`,
        color: ink.onPrimary,
        ["--slab" as string]: ink.primary,
      }}
    >
      <Logo id={id} size={compact ? 28 : 36} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-sm font-extrabold italic uppercase">{teamAbbr(id)}</span>
        {timeoutsOf(id) !== undefined && (
          <span className={`mt-1 flex gap-0.5 ${side === "r" ? "justify-end" : ""}`} aria-label={`${timeoutsOf(id)} timeouts left`}>
            {[0, 1, 2].map((t) => (
              <i key={t} className={`block h-1 w-3 rounded-sm ${t < (timeoutsOf(id) ?? 0) ? "bg-brass" : "bg-black/40"}`} />
            ))}
          </span>
        )}
      </span>
      {!ended && sit.poss === id && <span className="h-2 w-2 rounded-full bg-brass shadow-[0_0_8px_#ffc629]" aria-label="possession" />}
      <span key={score} className={`bug-num score-pop ${compact ? "text-3xl" : "text-4xl sm:text-5xl"} ${side === "r" ? "mr-auto" : "ml-auto"}`}>{score}</span>
    </div>
  );

  return (
    <section className={`overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_24px_60px_-28px_#000] ${eraCls}`} aria-label="Live broadcast">
      {compact && !atEnd && <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-muted"><span>Replay to your decision</span><button type="button" className="bx-chip min-h-9 px-3" onClick={() => setI(log.length - 1)}>Jump to decision</button></div>}
      {eraCls && !compact && (
        <p className="k5-era-plate" aria-hidden>
          <span>{eraLook(game.year).label.replace(" broadcast", "")}</span> SUNDAY NETWORK PACKAGE
        </p>
      )}
      {/* The matchup open: the building behind both clubs, face to face. */}
      {!compact && (
        <div className="k5-matchup" style={{ "--away": awayInk.primary, "--home": homeInk.primary } as CSSProperties}>
          <div className="k5-matchup-bg" aria-hidden />
          <div className="k5-matchup-side">
            <span className="k5-matchup-logo">
              <Logo id={away} size={76} year={game.year} />
            </span>
            <span className="k5-matchup-name">{nicknameOf(game.year, away)}</span>
          </div>
          <div className="k5-matchup-mid">
            <span className="k5-matchup-at">{ended ? "FINAL" : "AT"}</span>
            <span className="k5-matchup-venue">{game.stadium}</span>
          </div>
          <div className="k5-matchup-side k5-matchup-home">
            <span className="k5-matchup-logo">
              <Logo id={home} size={76} year={game.year} />
            </span>
            <span className="k5-matchup-name">{nicknameOf(game.year, home)}</span>
          </div>
        </div>
      )}
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
        <div className="flex flex-col items-center justify-center gap-0.5 bg-black px-2 py-1 sm:px-3">
          <p className="bug-num text-lg text-brass sm:text-xl">{ended ? "FINAL" : halftime ? "HALFTIME" : `${sit.q > 4 ? "OT" : `Q${sit.q}`} ${clockText(sit.clock)}`}</p>
          {!ended && !halftime && (
            <>
              <p className="whitespace-nowrap rounded-sm bg-brass px-1.5 font-display text-[12px] font-extrabold uppercase italic leading-5 tracking-wide text-[#140f00]">
                {ORD[Math.min(4, sit.down)] ?? "4th"} & {sit.spot + sit.togo >= 100 ? "Goal" : sit.togo}
              </p>
              <p className="whitespace-nowrap font-display text-[10px] font-bold uppercase italic tracking-wide text-muted">Ball on {spotText(sit, opp)}</p>
            </>
          )}
        </div>
        {slab(home, cur.hs, homeInk, "r")}
      </div>

      {!compact && <WinMeter wp={usWp} us={us} home={home} away={away} year={game.year} />}
      {!compact && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/10 bg-black/40 px-3 py-1.5 font-display text-[11px] font-bold uppercase italic tracking-wide sm:text-xs" aria-label="Team stats">
          {[away, home].map((id, k) => {
            const t = totals(id);
            return (
              <span key={id} className={`flex flex-wrap gap-x-3 ${k === 1 ? "order-3 justify-end text-right" : ""}`}>
                <span className="text-white">{t.yds} yds</span>
                <span className={t.to ? "text-brick" : "text-muted"}>{t.to} TO</span>
                <span className="text-muted">3rd {t.third}/{t.thirdAtt}</span>
              </span>
            );
          })}
          <span className="order-2 text-[10px] text-subtle">Play {i + 1}/{log.length}</span>
        </div>
      )}

      <div className="relative">
        {intro ? <PregameIntro game={game} onDone={endIntro} /> : <BroadcastField driveStart={drive.start} drivePlays={drive.plays} play={cur} home={home} away={away} homeColor={homeInk.primary} awayColor={awayInk.primary} playing={playing && !halftime} index={i} duration={Math.min(1100, playMs * .8)} year={game.year} game={game} />}
        {!compact && !intro && <StatPop log={log} i={i} year={game.year} />}
      </div>
      {halftime && <div className="border-b border-brass/30"><HalftimeDesk game={game} log={halfLog} voiced={sound.voiced && !compact} onRead={endHalfRead} /><FilmReport game={game} log={log.slice(0, i + 1)} halftime /><div className="px-5 pb-4"><Btn kind="primary" onClick={() => { setHalftime(false); setI(n => Math.min(log.length - 1, n + 1)); setPlaying(true); }}>Start second half ▸</Btn></div></div>}
      {!compact && <div className="flex flex-wrap gap-2 px-3 pt-3"><button className="bx-chip min-h-9 px-3 text-xs" type="button" disabled={i === 0} onClick={() => { setHalftime(false); setPlaying(false); setI(n => Math.max(0,n-1)); }}>Previous play</button><button className="bx-chip min-h-9 px-3 text-xs" type="button" disabled={atEnd} onClick={() => { setHalftime(false); setPlaying(false); setI(n => Math.min(log.length-1,n+1)); }}>Next play</button><span className="self-center text-xs text-muted">Select a key moment below to replay it.</span></div>}

      {!compact && i < 4 && game.matchups?.length ? (
        <div className="border-b border-white/10 px-3 py-3">
          <KeyMatchups game={game} compact />
        </div>
      ) : null}

      {canCall && !ended && !compact && (
        <OwnersBoxCalls
          gameId={game.id}
          at={i + 1}
          onCall={() => setPlaying(true)}
        />
      )}

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
                  <CueChip cue={l.cue} />
                </p>
                <p className={k === 0 ? "text-[15px] text-white" : "text-sm text-paper"}>{l.text}</p>
                {k === 0 &&
                  call
                    .filter((c) => c.speaker === "COLOR")
                    .map((c) => (
                      <p key={c.text} className="mt-1 text-sm italic text-paper">
                        <span className="not-italic font-display text-[11px] font-bold uppercase tracking-wide text-brass">{booth.color.name}: </span>
                        {c.text}
                      </p>
                    ))}
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
            {log.some((l) => l.mo !== undefined) && <MomentumMeter log={log} i={i} home={home} away={away} />}
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
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          {game.played && <PostgameInterviews game={game} voiced={sound.voiced} />}
          <Btn kind="primary" onClick={() => onDone?.()}>
            Postgame film <span aria-hidden>▸</span>
          </Btn>
        </div>
      )}
    </section>
  );
}

type Dial<K extends keyof Gameplan> = { key: K; label: string; opts: { v: Gameplan[K]; label: string }[] };
const DIALS: [Dial<"attack">, Dial<"tempo">, Dial<"fourth">, Dial<"blitz">] = [
  { key: "attack", label: "Offense", opts: [{ v: "pass", label: "Throw it" }, { v: "balanced", label: "Balanced" }, { v: "run", label: "Run it" }] },
  { key: "tempo", label: "Clock", opts: [{ v: "hurry", label: "Hurry-up" }, { v: "standard", label: "Normal" }, { v: "chew", label: "Milk it" }] },
  { key: "fourth", label: "4th down", opts: [{ v: "aggressive", label: "Go for it" }, { v: "normal", label: "Normal" }, { v: "conservative", label: "Play it safe" }] },
  { key: "blitz", label: "Defense", opts: [{ v: "heavy", label: "Send the house" }, { v: "normal", label: "Normal" }, { v: "rare", label: "Sit in coverage" }] },
];

// Stays open across the replay that follows each call.
let boxOpen = false;

/** The owner's box: change the plan or pull the quarterback from the next snap on. */
function OwnersBoxCalls({ gameId, at, onCall }: { gameId: string; at: number; onCall: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const liveOrder = useGameStore((s) => s.liveOrder);
  const [open, setOpenState] = useState(boxOpen);
  const setOpen = (f: (v: boolean) => boolean) => setOpenState((v) => (boxOpen = f(v)));
  const [busy, setBusy] = useState(false);
  const now = ordersUpTo(save, gameId, at);
  const send = (o: Omit<LiveOrder, "gameId" | "at">) => {
    setBusy(true);
    // Let "Calling down..." paint before the replay runs.
    setTimeout(() => {
      liveOrder({ ...o, at });
      setBusy(false);
      onCall();
    }, 20);
  };
  return (
    <div className="border-b border-white/10 bg-black/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`bx-chip min-h-8 px-3 text-[11px] ${open ? "bx-chip-on" : ""}`}
          aria-expanded={open}
        >
          Owner&apos;s box {open ? "▴" : "▾"}
        </button>
        {busy ? (
          <span className="text-xs text-brass">Calling down to the sideline…</span>
        ) : (
          Object.keys(now.plan).length > 0 && (
            <span className="text-xs text-muted">
              Your orders:{" "}
              {DIALS.filter((d) => now.plan[d.key])
                .map((d) => d.opts.find((o) => o.v === now.plan[d.key])?.label)
                .join(" · ")}
            </span>
          )
        )}
      </div>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {DIALS.map((d) => (
            <div key={d.key} className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 font-display text-[11px] font-bold uppercase italic tracking-wide text-subtle">{d.label}</span>
              {d.opts.map((o) => {
                const on = now.plan[d.key] === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={busy || on}
                    onClick={() => send({ kind: "plan", plan: { [d.key]: o.v } as Partial<Gameplan> })}
                    className={`bx-chip min-h-8 px-2.5 text-[11px] ${on ? "bx-chip-on" : ""}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ kind: "benchQb" })}
              className="bx-chip min-h-8 px-3 text-[11px] text-brick"
            >
              Bench the quarterback
            </button>
            <span className="text-[11px] text-subtle">Calls take effect on the next snap. Everything before it stands.</span>
          </div>
        </div>
      )}
    </div>
  );
}
