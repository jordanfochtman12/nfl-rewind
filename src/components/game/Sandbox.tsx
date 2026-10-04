/**
 * Watch mode: the computer runs every club and the owner sits back. The desk shows the league
 * — this week's slate, the standings, the wire, and how this timeline compares with real
 * history — and the watch bar steps, fast-forwards, or auto-plays the calendar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeTeamIds,
  displayName,
  featuredScore,
  gamesInWeek,
  realPostseason,
  weekIsInTheBooks,
  type DynastySave,
  type GameResult,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, ClubHash, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { startTv } from "./WatchTV";
import { AwardLadders, PlayoffPicture, RecordChases, StoryBoard } from "./WatchStories";

type Speed = "slow" | "normal" | "fast";
const SPEED_MS: Record<Speed, number> = { slow: 6000, normal: 3000, fast: 1000 };

/** What the next press does, said the way a viewer would. */
export function watchLabel(save: DynastySave): string {
  switch (save.phase) {
    case "draft":
      return "Next pick";
    case "freeAgency":
      return "Close free agency";
    case "expansion":
      return save.expansion?.done ? "On to the college draft" : "Finish the expansion draft";
    case "preseason":
      return save.camp?.year === save.year ? "Kick off the season" : "Open training camp";
    case "regular":
      return weekIsInTheBooks(save) ? "Next week" : `Play week ${save.week}`;
    case "deadline":
      return "Close the trade window";
    case "playoffs":
      return save.weekFilm ? (save.playoffGames.some((g) => !g.played) ? "Next round" : "On to the Super Bowl") : "Play the round";
    case "superBowl":
      return save.superBowl?.played ? "On to awards night" : "Play the Super Bowl";
    case "awards":
      return "The Pro Bowl";
    case "proBowl":
      return "Retirements";
    case "retirement":
      return "The Hall of Fame";
    case "hof":
      return "The coaching carousel";
    case "carousel":
      return "Turn the calendar";
    case "relocation":
      return "Continue";
    case "complete":
      return "The end of the line";
    default:
      return "Continue";
  }
}

/** The moments auto-play stops for, so the big nights don't fly past. */
function bigNight(prev: DynastySave, next: DynastySave): string | null {
  if (next.phase === "draft" && prev.phase !== "draft") return `The ${next.year} draft is on the clock.`;
  if (next.phase === "superBowl" && next.superBowl?.played && !prev.superBowl?.played) return "Super Bowl night.";
  if (next.phase === "awards" && prev.phase !== "awards") return "Awards night.";
  if (next.phase === "hof" && prev.phase !== "hof") return "The Hall of Fame class is in.";
  if (next.phase === "complete") return "That's the end of the timeline.";
  return null;
}

export function WatchBar() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const watchSim = useGameStore((s) => s.watchSim);
  const live = useGameStore((s) => s.liveGameId);
  const tab = useGameStore((s) => s.tab);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>("normal");
  const [stopBig, setStopBig] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const done = save.phase === "complete";

  const once = () => {
    const s = useGameStore.getState().save;
    if (!s || s.phase === "complete") return;
    if (s.phase === "freeAgency") step({ closeFa: true });
    // Without the stops, auto-play runs the whole draft at once; with them, the draft room
    // reads the picks itself.
    else if (s.phase === "draft" && auto && !stopBig) step({ auto: true });
    else step({});
    const n = useGameStore.getState().save!;
    const why = bigNight(s, n);
    if (why && auto && stopBig) {
      setAuto(false);
      setNote(`${why} Auto-play paused. Press play to keep going.`);
    }
  };
  const onceRef = useRef(once);
  onceRef.current = once;

  // The draft room makes its own picks on a clock, so auto-play waits for it there.
  const draftRunsItself = save.phase === "draft" && stopBig && (tab === "office" || tab === "draft");
  useEffect(() => {
    if (!auto || done || live || draftRunsItself) return;
    const t = setTimeout(() => onceRef.current(), SPEED_MS[speed]);
    return () => clearTimeout(t);
  }, [auto, speed, done, live, draftRunsItself, save]);

  const jump = (target: "playoffs" | "superBowl" | "nextSeason") => {
    setAuto(false);
    setBusy(target);
    setNote(null);
    // Let the label paint before the main thread goes to work.
    setTimeout(() => {
      watchSim(target);
      setBusy(null);
    }, 30);
  };
  const inSeason = ["preseason", "regular", "deadline"].includes(save.phase);
  return (
    <section className="hq-panel space-y-3 p-4" aria-label="Watch controls">
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="primary" className="min-h-12 px-6 text-lg" disabled={done || !!busy} onClick={() => { setNote(null); once(); }}>
          {watchLabel(save)} <span aria-hidden>▸</span>
        </Btn>
        <Btn kind="gold" className="min-h-12 px-4" disabled={done || !!busy} onClick={() => { setAuto(false); startTv(save.year); }}>
          📺 TV mode
        </Btn>
        <Btn
          className="min-h-12 px-4"
          disabled={done || !!busy}
          aria-pressed={auto}
          onClick={() => {
            setNote(null);
            setAuto((a) => !a);
          }}
        >
          {auto ? "❚❚ Pause" : "▶ Auto-play"}
        </Btn>
        <label className="flex items-center gap-2 text-xs text-muted">
          Speed
          <select
            className="min-h-10 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg"
            value={speed}
            onChange={(e) => setSpeed(e.target.value as Speed)}
          >
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={stopBig} onChange={(e) => setStopBig(e.target.checked)} />
          Stop for the big nights
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {inSeason && (
          <Btn className="min-h-10 px-4 text-sm" disabled={!!busy} onClick={() => jump("playoffs")}>
            {busy === "playoffs" ? "Simming…" : "Sim to the playoffs ▸▸"}
          </Btn>
        )}
        {!done && !["superBowl", "awards", "proBowl", "retirement", "hof", "carousel", "relocation"].includes(save.phase) && (
          <Btn className="min-h-10 px-4 text-sm" disabled={!!busy} onClick={() => jump("superBowl")}>
            {busy === "superBowl" ? "Simming…" : "Sim to the Super Bowl ▸▸"}
          </Btn>
        )}
        {!done && (
          <Btn className="min-h-10 px-4 text-sm" disabled={!!busy} onClick={() => jump("nextSeason")}>
            {busy === "nextSeason" ? "Simming the year…" : `Sim to the ${save.year + 1} draft ▸▸`}
          </Btn>
        )}
      </div>
      {live && auto && <p className="text-sm text-muted">Auto-play waits while the game of the week is on.</p>}
      {draftRunsItself && auto && <p className="text-sm text-muted">The draft room reads the picks on its own clock. Auto-play picks up when it's done.</p>}
      {note && <p className="text-sm text-brass">{note}</p>}
    </section>
  );
}

export function GameRow({ save, g, tag }: { save: DynastySave; g: GameResult; tag?: string }) {
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const real = g.realHome !== undefined && g.realAway !== undefined && g.realHome >= 0;
  return (
    <li className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${tag ? "border-brass/60 bg-brass/10" : "border-line"}`}>
      <span className="flex min-w-0 items-center gap-2">
        <ClubHash id={away} year={save.year} className="h-6 w-1 shrink-0 rounded-full" />
        <Logo id={away} size={28} year={save.year} />
        <span className="truncate text-sm">{displayName(save.year, away)}</span>
      </span>
      <span className="shrink-0 text-center">
        {g.played ? (
          <span className="bug-num block whitespace-nowrap text-2xl">
            {g.awayScore}–{g.homeScore}
          </span>
        ) : (
          <span className="block font-display text-sm uppercase italic text-muted">at</span>
        )}
        {tag && <span className="block text-[10px] tracking-[0.2em] text-brass">{tag}</span>}
        {g.played && real && <span className="tabular block text-[10px] text-subtle">real {g.realAway}–{g.realHome}</span>}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2">
        <span className="truncate text-right text-sm">{displayName(save.year, home)}</span>
        <Logo id={home} size={28} year={save.year} />
        <ClubHash id={home} year={save.year} className="h-6 w-1 shrink-0 rounded-full" />
      </span>
    </li>
  );
}

/** How this timeline stacks up against the real one, season by season. */
export function HistoryCheck() {
  const save = useGameStore((s) => s.save)!;
  const rows = (save.history.timeline ?? []).slice().sort((a, b) => b.year - a.year);
  if (!rows.length) return null;
  const withReal = rows.filter((r) => r.realChamp);
  const held = withReal.filter((r) => r.realChamp === r.simChamp).length;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">THIS TIMELINE VS. REAL HISTORY</p>
        {withReal.length > 0 && (
          <p className="text-sm text-paper">
            The real champion won it here {held} of {withReal.length} season{withReal.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {rows.slice(0, 12).map((r) => (
          <li key={r.year} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
            <span className="tabular w-12 font-display text-lg text-brass">{r.year}</span>
            <span className="flex items-center gap-2">
              <Logo id={r.simChamp} size={22} year={r.year} />
              <span>
                {displayName(r.year, r.simChamp)} <span className="text-muted">{r.simScore}</span>
              </span>
            </span>
            {r.realChamp && (
              <span className={`text-xs ${r.realChamp === r.simChamp ? "text-brass" : "text-subtle"}`}>
                {r.realChamp === r.simChamp ? "✓ same as real life" : `Real: ${displayName(r.year, r.realChamp)} ${r.realScore ?? ""}`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const DESK_AWARDS = ["mvp", "defPoy", "oroy", "droy"];

/** The sandbox front page: no front office, just the league. */
export function WatchDesk() {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const setTab = useGameStore((s) => s.setTab);
  const champ = save.history.superBowls.at(-1);
  const champId = champ ? ((champ.homeScore >= champ.awayScore ? champ.homeId : champ.awayId) as TeamId) : undefined;
  const real = realPostseason(save.year);
  const slate = save.phase === "regular" ? gamesInWeek(save, save.week) : save.phase === "playoffs" ? save.playoffGames.filter((g) => g.week === save.week) : [];
  const featured = useMemo(() => {
    const open = slate.filter((g) => !g.played);
    return open.length ? open.slice().sort((a, b) => featuredScore(save, b) - featuredScore(save, a) || a.id.localeCompare(b.id))[0] : undefined;
  }, [save, slate]);
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]);
  const played = ids.some((id) => save.teams[id]!.wins + save.teams[id]!.losses + save.teams[id]!.ties > 0);
  const leaders = ids
    .map((id) => ({ id, t: save.teams[id]! }))
    .sort((a, b) => b.t.wins - a.t.wins || a.t.losses - b.t.losses || a.id.localeCompare(b.id))
    .slice(0, 8);
  const wire = save.news.slice(0, 8);
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="primetime" veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">WATCH HISTORY · {save.year}</p>
          <h2 className="font-display text-4xl sm:text-5xl">{save.weekLabel}</h2>
          <p className="max-w-2xl text-paper">
            Every club is on autopilot, with real rosters, real draft classes and real coaches. Sit back and watch the
            league write its own history. Real results show up next to every score.
          </p>
          {champId && (
            <p className="text-sm text-muted">
              Reigning champions: <span className="text-paper">{displayName(champ!.year, champId)}</span>
            </p>
          )}
          {real && save.phase !== "draft" && save.phase !== "freeAgency" && (
            <p className="text-sm text-muted">
              In the real {save.year} season, the {displayName(save.year, real.champ as TeamId)} won it all.
            </p>
          )}
        </div>
      </section>
      {slate.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs tracking-[0.25em] text-muted">{save.phase === "playoffs" ? save.weekLabel.toUpperCase() : `WEEK ${save.week}`} SLATE</p>
            {featured && <p className="text-xs text-brass">Gold is the game of the week. It gets the live call.</p>}
          </div>
          <ul className="mt-3 space-y-2">
            {slate.map((g) => (
              <GameRow key={g.id} save={save} g={g} tag={g.id === featured?.id ? "GAME OF THE WEEK" : undefined} />
            ))}
          </ul>
        </section>
      )}
      {played && (save.phase === "regular" || save.phase === "deadline" || save.phase === "playoffs") && (
        <div className="grid gap-4 md:grid-cols-2">
          <StoryBoard save={save} />
          <div className="space-y-4">
            <RecordChases save={save} />
            <AwardLadders save={save} only={DESK_AWARDS} top={3} />
          </div>
        </div>
      )}
      {played && (save.phase === "regular" || save.phase === "deadline") && <PlayoffPicture save={save} />}
      <div className="grid gap-4 md:grid-cols-2">
        {played && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs tracking-[0.25em] text-muted">BEST RECORDS</p>
              <button type="button" className="text-xs text-brass underline" onClick={() => setTab("standings")}>
                Full standings
              </button>
            </div>
            <ol className="mt-3 space-y-1">
              {leaders.map(({ id, t }, i) => (
                <li key={id}>
                  <button type="button" className="flex min-h-10 w-full items-center gap-3 text-left text-sm hover:text-brass" onClick={() => openTeam(id)}>
                    <span className="tabular w-5 text-muted">{i + 1}</span>
                    <Logo id={id} size={24} year={save.year} />
                    <span className="flex-1 truncate">{displayName(save.year, id)}</span>
                    <span className="tabular text-paper">
                      {t.wins}-{t.losses}
                      {t.ties ? `-${t.ties}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
        {wire.length > 0 && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs tracking-[0.25em] text-muted">AROUND THE LEAGUE</p>
            <ul className="mt-3 space-y-3">
              {wire.map((n) => (
                <li key={n.id}>
                  <p className="text-sm text-paper">{n.headline}</p>
                  {n.body && <p className="text-xs text-muted">{n.body}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <HistoryCheck />
    </div>
  );
}

/** Free agency, the trade window or camp in a sandbox: what the league did, no desk to run. */
export function WatchMoves({ title, kinds, blurb }: { title: string; kinds: string[]; blurb: string }) {
  const save = useGameStore((s) => s.save)!;
  const moves = save.transactions.filter((t) => t.year === save.year && kinds.includes(t.kind)).slice(-30).reverse();
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="office" veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">
            {save.year} · {save.weekLabel}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl">{title}</h2>
          <p className="max-w-xl text-paper">{blurb}</p>
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">THE MOVES</p>
        {moves.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {moves.map((t) => (
              <li key={t.id} className="border-b border-line pb-2 last:border-0">
                {t.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nothing yet. The league is still working the phones.</p>
        )}
      </section>
    </div>
  );
}
