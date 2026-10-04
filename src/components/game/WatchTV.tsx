/**
 * TV mode: watch mode as one continuous broadcast. The channel runs the calendar on its own -
 * the season preview show, a pregame look at each week's races and storylines, the
 * whip-around of every game, the studio recap, the playoffs, the Super Bowl live, awards
 * night, the draft and the winter - and breaks in with a bulletin when big news lands.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  breakingNews,
  buildSeasonPreview,
  displayName,
  draftQueue,
  featuredScore,
  gamesInSeason,
  gamesInWeek,
  playerName,
  weekIsInTheBooks,
  type AdvanceOpts,
  type DynastySave,
  type GameResult,
  type PrimetimeShow,
  type TeamId,
} from "@/lib/game";
import type { NewsItem } from "@/lib/game/types";
import { footballSpeech } from "@/lib/game/footballSpeech";
import { crewFor } from "@/lib/game/previewVoice";
import { castVoices } from "@/lib/voiceCast";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { StudioEpisode } from "./StudioEpisode";
import { WhipAround } from "./WhipAround";
import { LiveBroadcast } from "./LiveBroadcast";
import { DraftNight } from "./DraftNight";
import { GameRow, watchLabel } from "./Sandbox";
import { AwardLadders, PlayoffPicture, RecordChases, StoryBoard } from "./WatchStories";

type Episode = NonNullable<PrimetimeShow["episode"]>;

type Stage =
  | { k: "preview"; key: string; episode: Episode }
  | { k: "pregame"; key: string; slate: GameResult[] }
  | { k: "whip"; key: string; slate: GameResult[]; title: string }
  | { k: "live"; key: string; game: GameResult }
  | { k: "studio"; key: string; episode: Episode }
  | { k: "draft"; key: string }
  | { k: "card"; key: string; title: string; kicker: string; say: string; items: string[]; opts: AdvanceOpts; seconds: number }
  | { k: "end"; key: string };

const STUDIO_EDITIONS: Record<string, Episode["edition"][]> = {
  regular: ["weekly", "seasonFinale"],
  playoffs: ["playoffs", "championship"],
  superBowl: ["superBowl"],
  awards: ["awards"],
};

/** The slate that was just played (regular week or playoff round). */
function playedSlate(save: DynastySave): GameResult[] {
  if (save.phase === "regular") return gamesInWeek(save, save.week);
  const played = save.playoffGames.filter((g) => g.played);
  const last = Math.max(0, ...played.map((g) => g.week));
  return played.filter((g) => g.week === last);
}

/** The slate about to kick off. */
function nextSlate(save: DynastySave): GameResult[] {
  if (save.phase === "regular") return gamesInWeek(save, save.week).filter((g) => !g.played);
  const open = save.playoffGames.filter((g) => !g.played);
  const first = Math.min(...open.map((g) => g.week));
  return open.filter((g) => g.week === first);
}

const phaseNews = (save: DynastySave, phases: string[], n = 8) =>
  save.news.filter((x) => x.year === save.year && phases.includes(x.phase)).slice(0, n).map((x) => x.headline);

/** What the channel shows next, given the calendar and what has already aired. */
function direct(save: DynastySave, seen: Set<string>, preview: () => Episode): Stage {
  const y = save.year;
  const ep = save.primetime?.episode;
  const studio = ep && save.primetime!.year === y && STUDIO_EDITIONS[save.phase]?.includes(ep.edition) && !seen.has(ep.id) ? ep : undefined;
  const card = (key: string, title: string, kicker: string, say: string, items: string[], opts: AdvanceOpts = {}, seconds = 10): Stage => ({
    // Unique per calendar state, so each card gets its own countdown.
    k: "card", key: `${key}-${y}-${save.phase}-${save.week}-${save.draftPickIndex}`, title, kicker, say, items, opts, seconds,
  });
  switch (save.phase) {
    case "preseason": {
      if (save.camp?.year !== y)
        return card("camp", "Training camp opens", `${y} PRESEASON`, `Training camps open around the league. The ${y} season is almost here.`, phaseNews(save, ["freeAgency", "preseason"]));
      const p = preview();
      if (!seen.has(`preview-${y}`)) return { k: "preview", key: `preview-${y}`, episode: p };
      return card("kickoff", `The ${y} season kicks off`, "OPENING WEEKEND", `Cut-downs are done. Here comes week one of the ${y} season.`, phaseNews(save, ["preseason"]));
    }
    case "regular":
    case "playoffs": {
      if (!weekIsInTheBooks(save)) {
        const slate = nextSlate(save);
        return { k: "pregame", key: `pre-${y}-${slate[0]?.id ?? save.week}`, slate };
      }
      const slate = playedSlate(save);
      const key = `whip-${y}-${slate[0]?.id ?? save.week}`;
      if (!seen.has(key)) return { k: "whip", key, slate, title: save.phase === "playoffs" ? slate[0]?.round ?? "Playoffs" : `Week ${save.week}` };
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      return card("next", watchLabel(save), save.weekLabel.toUpperCase(), "", [], {}, 0);
    }
    case "deadline":
      return card("deadline", "The trade window", "AROUND THE LEAGUE", "The trade window is open. Here's who dealt.", phaseNews(save, ["deadline", "regular"], 6));
    case "superBowl": {
      const g = save.superBowl;
      if (g && !g.played) return { k: "pregame", key: `pre-sb-${y}`, slate: [g] };
      if (g?.log?.length && !seen.has(`sb-${y}`)) return { k: "live", key: `sb-${y}`, game: g };
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      return card("sbdone", "On to awards night", "THE SEASON IS IN THE BOOKS", "", [], {}, 4);
    }
    case "awards": {
      if (studio) return { k: "studio", key: studio.id, episode: studio };
      const a = save.awards;
      const nm = (id?: string) => (id && save.players[id] ? playerName(save.players[id]!) : undefined);
      const items = a
        ? [
            ["MVP", nm(a.mvp)],
            ["Offensive Player of the Year", nm(a.offPoy)],
            ["Defensive Player of the Year", nm(a.defPoy)],
            [a.droy ? "Offensive Rookie of the Year" : "Rookie of the Year", nm(a.oroy)],
            ["Defensive Rookie of the Year", nm(a.droy)],
            ["Comeback Player of the Year", nm(a.cpoty)],
            ["Coach of the Year", a.coy ? save.coaches[a.coy]?.name : undefined],
          ].filter((r) => r[1]).map((r) => `${r[0]}: ${r[1]}`)
        : [];
      return card("awards", "Awards night", `${y} HONORS`, items[0] ? `The ${y} ${items[0]}.` : "", items, {}, 14);
    }
    case "proBowl": {
      const g = save.proBowl;
      return card("probowl", "The Pro Bowl", "ALL-STAR WEEK", "", g?.played ? [`${String(g.awayId).toUpperCase()} ${g.awayScore}, ${String(g.homeId).toUpperCase()} ${g.homeScore}`] : phaseNews(save, ["proBowl", "awards"], 5), {}, 8);
    }
    case "retirement":
      return card("retire", "Farewells", "RETIREMENTS", "Some familiar names are hanging it up.", phaseNews(save, ["retirement", "proBowl"]), {}, 10);
    case "hof":
      return card("hof", "The Hall of Fame class", "CANTON", "The new Hall of Fame class is in.", phaseNews(save, ["hof", "retirement"]), {}, 12);
    case "carousel":
      return card("carousel", "The coaching carousel", "HIRINGS AND FIRINGS", "The coaching carousel is spinning.", phaseNews(save, ["carousel", "hof"]), {}, 10);
    case "relocation":
    case "expansion":
      return card(save.phase, save.phase === "expansion" ? "Expansion" : "On the move", "LEAGUE OFFICE", "", phaseNews(save, [save.phase, "carousel"]), {}, 10);
    case "draft": {
      const q = draftQueue(save);
      const pick = q[save.draftPickIndex];
      if (pick && pick.round <= 1) return { k: "draft", key: `draft-${y}` };
      return card("draftrest", "The rest of the draft", `${y} DRAFT`, "Round one is in the books. The rest of the draft goes fast.", [], { auto: true }, 5);
    }
    case "freeAgency":
      return card("fa", y < 1994 ? "The offseason" : "Free agency", "THE WINTER", y < 1994 ? "Stars rarely move in this era. Here's who changed teams." : "The market is open. Here's who signed where.", phaseNews(save, ["freeAgency", "draft"], 8), { closeFa: true }, 10);
    case "complete":
      return { k: "end", key: "end" };
  }
}

/** Speak one line in the studio host's voice. */
function useHost(year: number, on: boolean) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return useCallback(
    (text: string) => {
      if (!on || !text || !("speechSynthesis" in window)) return;
      const host = crewFor(year).HOST;
      const u = new SpeechSynthesisUtterance(footballSpeech(text, year));
      const c = castVoices(voices, [{ key: host.name, gender: host.gender }]).get(host.name);
      if (c?.voice) u.voice = c.voice;
      u.rate = c?.rate ?? 1;
      u.pitch = c?.pitch ?? 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voices, year, on],
  );
}

/** Keeps a phone's screen awake while the channel is on. */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } };
    let lock: Lock | undefined;
    const take = () => {
      if (document.visibilityState === "visible") nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

/** Starts the channel from a tap, which also unlocks speech on phones. */
export function startTv(year: number): void {
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(footballSpeech(`Welcome to Rewind TV. The ${year} season, all of it, starts now.`, year)));
    }
  } catch {
    /* no speech on this device */
  }
  useGameStore.getState().setTv(true);
}

export function WatchTV() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const setTv = useGameStore((s) => s.setTv);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(true);
  const say = useHost(save.year, voice);
  useWakeLock();

  const previewYear = useRef<number>(-1);
  const previewEp = useRef<Episode | null>(null);
  const preview = useCallback(() => {
    if (previewYear.current !== save.year || !previewEp.current) {
      previewEp.current = buildSeasonPreview(save).episode as Episode;
      previewYear.current = save.year;
    }
    return previewEp.current;
  }, [save]);
  const stage = useMemo(() => direct(save, seen, preview), [save, seen, preview]);

  // Breaking news: anything big that lands while the channel is on gets a bulletin, held until
  // the games in progress are over so a score is never spoiled.
  const known = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<NewsItem[]>([]);
  useEffect(() => {
    const now = breakingNews(save);
    if (!known.current) {
      known.current = new Set(now.map((n) => n.id));
      return;
    }
    const fresh = now.filter((n) => !known.current!.has(n.id)).reverse();
    for (const n of fresh) known.current.add(n.id);
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-4));
  }, [save]);
  const onAir = stage.k === "whip" || stage.k === "live" || stage.k === "draft" || stage.k === "preview";
  const bulletin = !onAir ? queue[0] : undefined;

  const mark = useCallback((key: string) => setSeen((s) => new Set(s).add(key)), []);
  const advance = useCallback(
    (opts: AdvanceOpts) => {
      const s = useGameStore.getState().save;
      if (!s || s.phase === "complete") return;
      step(opts);
    },
    [step],
  );
  /** Ends the current segment: marks it aired, or moves the calendar. */
  const next = useCallback(() => {
    if (bulletin) {
      setQueue((q) => q.slice(1));
      return;
    }
    switch (stage.k) {
      case "preview":
      case "whip":
      case "live":
      case "studio":
        mark(stage.key);
        return;
      case "pregame":
        advance({});
        return;
      case "card":
        advance(stage.opts);
        return;
      case "draft":
        advance({ auto: true });
        return;
      case "end":
        return;
    }
  }, [bulletin, stage, mark, advance]);

  // The draft room reads round one; then the rest of the board goes at once.
  useEffect(() => {
    if (stage.k !== "draft") return;
    const pick = draftQueue(save)[save.draftPickIndex];
    if (!pick || pick.round > 1) advance({ auto: true });
  }, [save, stage.k, advance]);

  const exit = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setTv(false);
  };

  return (
    <div className="tv-mode fixed inset-0 z-[60] overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Rewind TV">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#04050ae6] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p className="flex min-w-0 items-center gap-2">
            <span className="bg-red px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] text-white">REWIND TV</span>
            <span className="truncate font-display text-sm uppercase italic text-paper">
              {save.year} · {save.weekLabel}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" aria-pressed={paused} onClick={() => setPaused(!paused)}>
              {paused ? "▶ Resume" : "❚❚ Hold"}
            </button>
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" aria-pressed={voice} onClick={() => { if (voice) window.speechSynthesis?.cancel(); setVoice(!voice); }}>
              Host: {voice ? "on" : "off"}
            </button>
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" disabled={stage.k === "end"} onClick={next}>
              Skip ▸
            </button>
            <button type="button" className="bx-chip min-h-10 px-3 text-xs" onClick={exit}>
              Exit TV
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-3 pb-16 pt-4 sm:px-4">
        {bulletin ? (
          <Bulletin key={bulletin.id} item={bulletin} save={save} say={say} paused={paused} onDone={() => setQueue((q) => q.slice(1))} />
        ) : stage.k === "preview" ? (
          <StudioEpisode key={stage.key} episode={stage.episode} year={save.year} autoPlay onDone={() => mark(stage.key)} />
        ) : stage.k === "studio" ? (
          <StudioEpisode key={stage.key} episode={stage.episode} year={save.year} autoPlay onDone={() => mark(stage.key)} />
        ) : stage.k === "whip" ? (
          <WhipAround key={stage.key} games={stage.slate} year={save.year} title={stage.title} onDone={() => mark(stage.key)} />
        ) : stage.k === "live" ? (
          <LiveTv key={stage.key} game={stage.game} onDone={() => mark(stage.key)} />
        ) : stage.k === "pregame" ? (
          <Pregame key={stage.key} save={save} slate={stage.slate} say={say} paused={paused} onGo={next} />
        ) : stage.k === "draft" ? (
          <DraftNight />
        ) : stage.k === "card" ? (
          <Card key={stage.key} stage={stage} save={save} say={say} paused={paused} onGo={next} />
        ) : (
          <section className="rounded-xl border border-brass/40 bg-studio p-6 text-center">
            <p className="font-display text-xs tracking-[0.4em] text-brass">THAT'S THE TIMELINE</p>
            <h2 className="mt-2 font-display text-4xl">Thanks for watching</h2>
            <Btn kind="primary" className="mt-4" onClick={exit}>
              Back to the desk
            </Btn>
          </section>
        )}
      </div>
    </div>
  );
}

const MVP_ONLY = ["mvp"];

/** A countdown that can be held, then fires once. */
function useCountdown(seconds: number, paused: boolean, onGo: () => void) {
  const [left, setLeft] = useState(seconds);
  const go = useRef(onGo);
  go.current = onGo;
  const fired = useRef(false);
  useEffect(() => {
    if (paused) return;
    if (left <= 0) {
      if (!fired.current) {
        fired.current = true;
        go.current();
      }
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);
  return left;
}

function Countdown({ left, label, onGo }: { left: number; label: string; onGo: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn kind="primary" className="min-h-12 px-6" onClick={onGo}>
        {label} <span aria-hidden>▸</span>
      </Btn>
      <span className="tabular text-sm text-muted" aria-live="off">
        Starting in {Math.max(0, left)}s
      </span>
    </div>
  );
}

function Pregame({ save, slate, say, paused, onGo }: { save: DynastySave; slate: GameResult[]; say: (t: string) => void; paused: boolean; onGo: () => void }) {
  const left = useCountdown(save.phase === "superBowl" ? 15 : 14, paused, onGo);
  const played = Math.max(0, ...Object.values(save.teams).map((t) => t.wins + t.losses + t.ties));
  const featured = useMemo(
    () => slate.slice().sort((a, b) => featuredScore(save, b) - featuredScore(save, a) || a.id.localeCompare(b.id))[0],
    [save, slate],
  );
  const focus = useMemo(() => (slate.length <= 2 ? slate.flatMap((g) => [g.homeId, g.awayId] as TeamId[]) : undefined), [slate]);
  const title = save.phase === "superBowl" ? save.superBowl?.round ?? "The Super Bowl" : save.phase === "playoffs" ? slate[0]?.round ?? "The playoffs" : `Week ${save.week}`;
  useEffect(() => {
    const f = featured;
    const line = f
      ? save.phase === "superBowl"
        ? `It's Super Bowl Sunday. The ${displayName(save.year, f.awayId as TeamId)} and the ${displayName(save.year, f.homeId as TeamId)}, for all of it.`
        : `${title}. ${slate.length} game${slate.length === 1 ? "" : "s"} on the board, and the game of the week is the ${displayName(save.year, f.awayId as TeamId)} at the ${displayName(save.year, f.homeId as TeamId)}.`
      : title;
    say(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still={save.phase === "superBowl" ? "superbowl" : "primetime"} veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">PREGAME · {save.year}</p>
          <h2 className="font-display text-4xl sm:text-5xl">{title}</h2>
          <Countdown left={left} label={save.phase === "superBowl" ? "Kick it off" : "Go to the whip-around"} onGo={onGo} />
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">ON THE BOARD</p>
        <ul className="mt-3 space-y-2">
          {slate.map((g) => (
            <GameRow key={g.id} save={save} g={g} tag={g.id === featured?.id && slate.length > 1 ? "GAME OF THE WEEK" : undefined} />
          ))}
        </ul>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <StoryBoard save={save} max={4} focus={focus} />
        <div className="space-y-4">
          <RecordChases save={save} />
          {played >= 4 && save.phase === "regular" && <AwardLadders save={save} only={MVP_ONLY} top={3} />}
        </div>
      </div>
      {save.phase === "regular" && played >= Math.ceil(gamesInSeason(save.year) * 0.4) && <PlayoffPicture save={save} compact />}
    </div>
  );
}

function Card({ stage, save, say, paused, onGo }: { stage: Extract<Stage, { k: "card" }>; save: DynastySave; say: (t: string) => void; paused: boolean; onGo: () => void }) {
  const left = useCountdown(stage.seconds, paused, onGo);
  useEffect(() => {
    if (stage.say) say(stage.say);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (stage.seconds === 0) return <p className="py-10 text-center text-muted">{stage.title}…</p>;
  return (
    <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <FilmStill still="office" veil="full" />
      <div className="relative space-y-4 px-5 py-6">
        <p className="font-display text-xs tracking-[0.4em] text-brass">{stage.kicker}</p>
        <h2 className="font-display text-4xl sm:text-5xl">{stage.title}</h2>
        {stage.items.length > 0 && (
          <ul className="max-w-2xl space-y-2">
            {stage.items.map((t, i) => (
              <li key={i} className="border-l-2 border-brass/50 pl-3 text-paper">
                {t}
              </li>
            ))}
          </ul>
        )}
        <Countdown left={left} label={watchLabel(save)} onGo={onGo} />
      </div>
    </section>
  );
}

function Bulletin({ item, save, say, paused, onDone }: { item: NewsItem; save: DynastySave; say: (t: string) => void; paused: boolean; onDone: () => void }) {
  const left = useCountdown(9, paused, onDone);
  useEffect(() => {
    say(`This just in. ${item.headline}. ${item.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="tv-bulletin overflow-hidden rounded-xl border-2 border-red bg-studio" role="alert">
      <div className="flex items-center justify-between bg-red px-4 py-2">
        <span className="font-display text-sm font-extrabold italic tracking-[0.3em] text-white">BREAKING NEWS</span>
        <span className="tabular text-xs text-white/80">{Math.max(0, left)}s</span>
      </div>
      <div className="flex gap-4 px-5 py-8">
        <div className="flex shrink-0 flex-col gap-2">
          {item.teamIds.slice(0, 2).map((id) => (
            <Logo key={id} id={id} size={56} year={save.year} />
          ))}
        </div>
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">{item.headline}</h2>
          {item.body && <p className="mt-2 max-w-2xl text-paper">{item.body}</p>}
          <Btn className="mt-4" onClick={onDone}>
            Back to the broadcast
          </Btn>
        </div>
      </div>
    </section>
  );
}

function LiveTv({ game, onDone }: { game: GameResult; onDone: () => void }) {
  const [ended, setEnded] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => done.current(), 8000);
    return () => clearTimeout(t);
  }, [ended]);
  return <LiveBroadcast game={game} log={game.log!} onDone={onDone} onReachEnd={() => setEnded(true)} autoHalftime />;
}
