/**
 * Whip-around Sunday: every game on the slate plays at once on one shared game clock. The
 * channel stays on a game until something better happens somewhere else - a score, a turnover,
 * a drive inside the twenty, a close finish - and cuts there. The scoreboard tiles always show
 * the whole slate; tap one to lock the channel on it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { settingsNow } from "@/lib/settings-store";
import { clubInk, displayName, nicknameOf, teamAbbr, type GameResult, type PlayLog, type TeamId } from "@/lib/game";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { boothFor } from "@/lib/game/broadcastCrew";
import { castVoices } from "@/lib/voiceCast";
import { Logo } from "./chrome";
import { useEraClass } from "./eraLook";
import { cancelSpeech, speakLine } from "@/lib/voice/studioVoice";

/** Seconds of game time since kickoff. Overtime runs on past the end of the fourth. */
const gameTime = (l: Pick<PlayLog, "q" | "clock">) => (l.q - 1) * 900 + (900 - l.clock);
const clockText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const ORD = ["", "1st", "2nd", "3rd", "4th"];

/** Game seconds that pass per real second, by speed. A full slate takes ~3 / 1.5 / 0.75 minutes. */
const SPEEDS = [
  { label: "1x", rate: 20 },
  { label: "2x", rate: 40 },
  { label: "4x", rate: 80 },
];
const TICK_MS = 250;
/** The channel holds a cut at least this long before it can move again. */
const HOLD_S = 4;

type Cut = { gameId: string; why: string; at: number };

interface Feed {
  game: GameResult;
  log: PlayLog[];
  times: number[];
  end: number;
}

/** How long to stay with the latest play: big moments get the whole hold. */
const CUE: Record<NonNullable<PlayLog["tag"]>, string> = {
  td: "TOUCHDOWN",
  fg: "FIELD GOAL",
  to: "TURNOVER",
  safety: "SAFETY",
  big: "BIG PLAY",
  call: "",
};

export function WhipAround({
  games,
  year,
  onDone,
  title,
}: {
  games: GameResult[];
  year: number;
  onDone?: () => void;
  title?: string;
}) {
  const feeds = useMemo<Feed[]>(
    () =>
      games
        .filter((g) => g.log?.length)
        .map((g) => {
          const log = g.log!;
          // Logged snaps carry the clock at the snap; keep time moving forward within a game.
          let last = 0;
          const times = log.map((l) => (last = Math.max(last, gameTime(l))));
          return { game: g, log, times, end: Math.max(3600, last + 5) };
        }),
    [games],
  );
  const finalOnly = games.filter((g) => !g.log?.length);
  const eraCls = useEraClass(year);
  const end = Math.max(3600, ...feeds.map((f) => f.end));
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(() => settingsNow().whipSpeed);
  const [voice, setVoice] = useState(() => settingsNow().narration);
  const [lock, setLock] = useState<string | null>(null);
  const [cut, setCut] = useState<Cut | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const finished = now >= end;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      cancelSpeech();
    };
  }, []);

  // The clock.
  useEffect(() => {
    if (!playing || finished) return;
    const t = setInterval(() => setNow((n) => Math.min(end, n + (SPEEDS[speed]!.rate * TICK_MS) / 1000)), TICK_MS);
    return () => clearInterval(t);
  }, [playing, finished, speed, end]);

  // Hand back to the show a few seconds after the last final.
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => doneRef.current?.(), 6000);
    return () => clearTimeout(t);
  }, [finished]);

  /** Index of the last play each game has reached by `now`. */
  const at = (f: Feed, t: number) => {
    let lo = -1;
    for (let k = 0; k < f.times.length && f.times[k]! <= t; k++) lo = k;
    return lo;
  };
  const state = feeds.map((f) => ({ f, i: at(f, now) }));
  const prevNow = useRef(0);

  // Cuts: look at what happened since the last tick and move the channel.
  useEffect(() => {
    const from = prevNow.current;
    prevNow.current = now;
    if (now <= from) return;
    const hot: { gameId: string; why: string; score: number; text?: string }[] = [];
    for (const { f, i } of state) {
      if (i < 0) continue;
      for (let k = at(f, from) + 1; k <= i; k++) {
        const l = f.log[k]!;
        if (l.tag && l.tag !== "call" && l.tag !== "big") hot.push({ gameId: f.game.id, why: CUE[l.tag], score: l.tag === "td" ? 10 : l.tag === "to" ? 8 : 6, text: l.text });
        else if (l.tag === "big") hot.push({ gameId: f.game.id, why: CUE.big, score: 4, text: l.text });
      }
      const next = f.log[i + 1];
      if (next && next.spot >= 80 && f.times[i + 1]! - now < 90) hot.push({ gameId: f.game.id, why: "RED ZONE", score: 5 });
      const cur = f.log[i]!;
      if (cur.q >= 4 && cur.clock <= 300 && Math.abs(cur.hs - cur.as) <= 8 && i < f.log.length - 1) hot.push({ gameId: f.game.id, why: cur.q > 4 ? "OVERTIME" : "CLOSE FINISH", score: 3 });
    }
    if (lock || !hot.length) return;
    const held = cut && now - cut.at < HOLD_S * SPEEDS[speed]!.rate;
    const best = hot.sort((a, b) => b.score - a.score)[0]!;
    if (held && best.score < 8 && best.gameId !== cut?.gameId) return;
    if (cut && best.gameId === cut.gameId && best.why === cut.why && best.score < 6) return;
    setCut({ gameId: best.gameId, why: best.why, at: now });
    if (voice && best.text && best.score >= 6 && "speechSynthesis" in window) {
      const f = feeds.find((x) => x.game.id === best.gameId)!;
      const l = f.log[at(f, now)];
      const scorer = l ? nicknameOf(year, l.poss as TeamId) : "";
      const line = best.why === "TOUCHDOWN" ? `Touchdown, ${scorer}! ${best.text}` : best.why === "TURNOVER" ? `Turnover! ${best.text}` : best.text;
      const u = new SpeechSynthesisUtterance(footballSpeech(line, year));
      const pbp = boothFor(year).pbp;
      const c = castVoices(voices, [{ key: pbp.name, gender: pbp.gender, rate: 1.08 }], settingsNow().voiceName).get(pbp.name);
      if (c?.voice) u.voice = c.voice;
      u.rate = c?.rate ?? 1.08;
      u.pitch = c?.pitch ?? 1;
      cancelSpeech();
      // The whip-around cuts game to game; a call that would land late is dropped.
      speakLine(u, { key: pbp.name, gender: pbp.gender, chair: "pbp" }, { maxLagMs: 3500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const focusId = lock ?? cut?.gameId ?? feeds[0]?.game.id;
  const focus = state.find((s) => s.f.game.id === focusId) ?? state[0];
  const liveCount = state.filter(({ f, i }) => i < f.log.length - 1).length;

  return (
    <section className={`whip overflow-hidden rounded-xl border border-white/10 bg-studio ${eraCls}`} aria-label="Whip-around">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-b from-[#161b26] to-[#07090e] px-3 py-2">
        <p className="flex items-center gap-2">
          <span className="bg-red px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] text-white">{finished ? "FINAL" : "LIVE"}</span>
          <span className="font-display text-sm font-bold uppercase italic tracking-wide">{title ?? "Whip-around"}</span>
          {!finished && <span className="text-xs text-muted">{liveCount} game{liveCount === 1 ? "" : "s"} in progress</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {!finished && (
            <>
              <button type="button" className="bx-chip min-h-9 px-3 text-xs" onClick={() => setPlaying((p) => !p)}>
                {playing ? "Pause" : "Play"}
              </button>
              {SPEEDS.map((s, k) => (
                <button key={s.label} type="button" className={`bx-chip min-h-9 px-2.5 text-xs ${speed === k ? "bx-chip-on" : ""}`} onClick={() => setSpeed(k)}>
                  {s.label}
                </button>
              ))}
            </>
          )}
          <button type="button" className="bx-chip min-h-9 px-3 text-xs" aria-pressed={voice} onClick={() => { if (voice) window.speechSynthesis?.cancel(); setVoice(!voice); }}>
            Voice: {voice ? "on" : "off"}
          </button>
          {lock && (
            <button type="button" className="bx-chip min-h-9 px-3 text-xs" onClick={() => setLock(null)}>
              Back to the whip
            </button>
          )}
          {!finished && (
            <button type="button" className="bx-chip min-h-9 px-3 text-xs" onClick={() => setNow(end)}>
              Skip to finals
            </button>
          )}
        </div>
      </div>

      {focus && <Channel f={focus.f} i={focus.i} year={year} why={lock ? "YOUR CHANNEL" : cut?.gameId === focus.f.game.id ? cut.why : undefined} final={focus.i >= focus.f.log.length - 1 && now >= focus.f.times.at(-1)!} />}

      <ul className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Scoreboard">
        {state.map(({ f, i }) => (
          <Tile key={f.game.id} f={f} i={i} year={year} on={f.game.id === focusId} locked={lock === f.game.id} onPick={() => setLock(lock === f.game.id ? null : f.game.id)} />
        ))}
        {finalOnly.map((g) => (
          <li key={g.id} className="rounded-md border border-line bg-black/30 px-2 py-1.5 text-xs">
            <ScoreLine year={year} away={g.awayId as TeamId} home={g.homeId as TeamId} as={g.awayScore} hs={g.homeScore} />
            <p className="mt-0.5 text-[10px] tracking-[0.2em] text-subtle">FINAL</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScoreLine({ year, away, home, as, hs, poss }: { year: number; away: TeamId; home: TeamId; as: number; hs: number; poss?: TeamId }) {
  const row = (id: TeamId, n: number, win: boolean) => (
    <span className={`flex items-center gap-1.5 ${win ? "text-white" : "text-paper"}`}>
      <Logo id={id} size={18} year={year} />
      <span className="font-display text-xs font-bold uppercase italic">{teamAbbr(id)}</span>
      {poss === id && <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-label="possession" />}
      <span className="bug-num ml-auto text-base">{n}</span>
    </span>
  );
  return (
    <div className="space-y-0.5">
      {row(away, as, as > hs)}
      {row(home, hs, hs > as)}
    </div>
  );
}

function Tile({ f, i, year, on, locked, onPick }: { f: Feed; i: number; year: number; on: boolean; locked: boolean; onPick: () => void }) {
  const l = i >= 0 ? f.log[i]! : undefined;
  const next = f.log[i + 1];
  const done = i >= f.log.length - 1;
  const home = f.game.homeId as TeamId;
  const away = f.game.awayId as TeamId;
  const rz = !done && next && next.spot >= 80;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={locked}
        className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${on ? "border-brass bg-brass/10" : rz ? "border-red/70 bg-red/10" : "border-line bg-black/30"}`}
      >
        <ScoreLine year={year} away={away} home={home} as={l?.as ?? 0} hs={l?.hs ?? 0} poss={done ? undefined : (next ?? l)?.poss as TeamId} />
        <p className="mt-0.5 flex justify-between text-[10px] tracking-[0.15em] text-subtle">
          <span>{done ? (f.game.ot ? "FINAL/OT" : "FINAL") : !l ? "KICKOFF" : `${l.q > 4 ? "OT" : `Q${l.q}`} ${clockText((next ?? l).clock)}`}</span>
          {rz && <span className="text-red">RED ZONE</span>}
          {locked && <span className="text-brass">LOCKED</span>}
        </p>
      </button>
    </li>
  );
}

function Channel({ f, i, year, why, final }: { f: Feed; i: number; year: number; why?: string; final: boolean }) {
  const home = f.game.homeId as TeamId;
  const away = f.game.awayId as TeamId;
  const l = i >= 0 ? f.log[i]! : undefined;
  const next = f.log[i + 1];
  const sit = next ?? l;
  const homeInk = clubInk(home, year);
  const awayInk = clubInk(away, year);
  const recent = i >= 0 ? f.log.slice(Math.max(0, i - 2), i + 1).reverse() : [];
  // Ball on the field strip, drawn from the away end zone (left) to the home end zone (right).
  const ball = sit ? (sit.poss === away ? sit.spot : 100 - sit.spot) : 50;
  const slab = (id: TeamId, n: number, ink: ReturnType<typeof clubInk>, side: "l" | "r") => (
    <div
      className={`bug-slab flex min-w-0 items-center gap-2 px-3 py-2 ${side === "r" ? "flex-row-reverse text-right" : ""}`}
      style={{ background: `linear-gradient(${side === "l" ? 115 : 245}deg, ${ink.primary}, color-mix(in srgb, ${ink.primary} 40%, black) 90%)`, color: ink.onPrimary, ["--slab" as string]: ink.primary }}
    >
      <Logo id={id} size={34} year={year} />
      <span className="min-w-0 truncate font-display text-sm font-extrabold italic uppercase max-sm:hidden">{nicknameOf(year, id)}</span>
      <span className="font-display text-sm font-extrabold italic uppercase sm:hidden">{teamAbbr(id)}</span>
      <span className={`bug-num text-4xl ${side === "r" ? "mr-auto" : "ml-auto"}`}>{n}</span>
    </div>
  );
  return (
    <div className="border-b border-white/10" aria-live="polite">
      <div className="flex items-center justify-between gap-2 px-3 pt-2 text-xs">
        <span className="truncate text-muted">
          {displayName(year, away)} at {displayName(year, home)}
        </span>
        {why && <span key={why + i} className="whip-cue shrink-0 bg-brass px-2 py-0.5 font-display font-extrabold italic tracking-[0.2em] text-[#140f00]">{why}</span>}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr]">
        {slab(away, l?.as ?? 0, awayInk, "l")}
        <div className="flex flex-col items-center justify-center bg-black px-3">
          <p className="bug-num text-lg text-brass">{final ? "FINAL" : !sit ? "KICKOFF" : `${sit.q > 4 ? "OT" : `Q${sit.q}`} ${clockText(sit.clock)}`}</p>
          {!final && sit && (
            <p className="whitespace-nowrap font-display text-[11px] font-bold uppercase italic text-muted">
              {ORD[Math.min(4, sit.down)] ?? "4th"} & {sit.togo}
            </p>
          )}
        </div>
        {slab(home, l?.hs ?? 0, homeInk, "r")}
      </div>
      <div className="relative mx-3 mt-3 h-6 overflow-hidden rounded bg-[#1d4a2b]" aria-hidden>
        <div className="absolute inset-y-0 left-0 w-[8%]" style={{ background: awayInk.primary }} />
        <div className="absolute inset-y-0 right-0 w-[8%]" style={{ background: homeInk.primary }} />
        {[20, 30, 40, 50, 60, 70, 80].map((x) => (
          <div key={x} className="absolute inset-y-0 w-px bg-white/25" style={{ left: `${8 + x * 0.84}%` }} />
        ))}
        {!final && sit && (
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8a4b1f] shadow-[0_0_0_2px_#fff]" style={{ left: `${8 + ball * 0.84}%`, transition: "left 400ms ease" }} />
        )}
      </div>
      <ol className="space-y-1 p-3">
        {recent.map((p, k) => (
          <li key={`${i - k}`} className={`border-l-2 pl-3 ${k === 0 ? "border-red" : "border-white/10 opacity-70"}`}>
            <p className="font-display text-[11px] font-bold uppercase italic tracking-wide text-subtle">
              {p.q > 4 ? "OT" : `Q${p.q}`} {clockText(p.clock)} · {teamAbbr(p.poss)}
              {p.tag && CUE[p.tag] && <span className="ml-2 bg-brass px-1.5 not-italic text-[#140f00]">{CUE[p.tag]}</span>}
            </p>
            <p className={k === 0 ? "text-[15px] text-white" : "text-sm text-paper"}>{p.text}</p>
          </li>
        ))}
        {!recent.length && <li className="text-sm text-muted">Kickoff is coming up.</li>}
      </ol>
    </div>
  );
}
