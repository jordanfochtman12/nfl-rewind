/**
 * History mode's front page: no simulation and no club to run, just the league as it really
 * was at this point on the calendar. This week's real scores, the real draft, the real
 * award winners and Hall of Fame class, the standings, and what the record does and doesn't
 * keep for the season on screen.
 */
import { useMemo, useState } from "react";
import {
  activeTeamIds,
  coverageNote,
  displayName,
  followedNews,
  gamesInWeek,
  roman,
  superBowlNumber,
  type DynastySave,
  type GameResult,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { GameRow } from "./Sandbox";
import { PlayoffPicture } from "./WatchStories";
import { CallsPanel, FollowingPanel, RecordBookPanel, RecordWatch } from "./HistoryLive";

function lastSlate(save: DynastySave): { title: string; games: GameResult[] } {
  if (save.phase === "regular") {
    const wk = gamesInWeek(save, save.week).some((g) => g.played) ? save.week : save.week - 1;
    if (wk >= 1) return { title: `Week ${wk} final scores`, games: gamesInWeek(save, wk).filter((g) => g.played) };
    return { title: "", games: [] };
  }
  if (save.phase === "playoffs" && save.playoffGames.length) {
    const wk = Math.max(...save.playoffGames.map((g) => g.week));
    const games = save.playoffGames.filter((g) => g.week === wk);
    return { title: `${games[0]?.round ?? "Playoffs"} final scores`, games };
  }
  return { title: "", games: [] };
}

const AWARD_ROWS: [string, "mvp" | "offPoy" | "defPoy" | "oroy" | "droy" | "cpoty"][] = [
  ["Most Valuable Player", "mvp"],
  ["Offensive Player of the Year", "offPoy"],
  ["Defensive Player of the Year", "defPoy"],
  ["Offensive Rookie of the Year", "oroy"],
  ["Defensive Rookie of the Year", "droy"],
  ["Comeback Player of the Year", "cpoty"],
];

function Who({ save, id }: { save: DynastySave; id: string }) {
  const p = save.players[id];
  return p ? <PlayerLink player={p} className="inline min-h-0" /> : <span>{id}</span>;
}

function SuperBowlCard({ save }: { save: DynastySave }) {
  const g = save.superBowl;
  if (!g?.played) return null;
  const winner = (g.homeScore >= g.awayScore ? g.homeId : g.awayId) as TeamId;
  const loser = (winner === g.homeId ? g.awayId : g.homeId) as TeamId;
  const mvp = g.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
  return (
    <section className="rounded-xl border border-brass/50 bg-brass/10 p-4">
      <p className="text-xs tracking-[0.25em] text-brass">SUPER BOWL {roman(superBowlNumber(save.year))}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Logo id={winner} size={44} year={save.year} />
        <p className="font-display text-2xl">
          {displayName(save.year, winner)} {Math.max(g.homeScore, g.awayScore)}, {displayName(save.year, loser)} {Math.min(g.homeScore, g.awayScore)}
        </p>
      </div>
      {mvp && (
        <p className="mt-2 text-sm text-muted">
          MVP: <PlayerLink player={mvp} className="inline min-h-0" />
        </p>
      )}
    </section>
  );
}

function AwardsCard({ save }: { save: DynastySave }) {
  const a = save.awards;
  if (!a) return null;
  const rows = AWARD_ROWS.filter(([, k]) => a[k]);
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-muted">{a.year} AWARDS</p>
      <ul className="mt-3 space-y-2">
        {rows.map(([label, k]) => (
          <li key={k} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted">{label}</span>
            <span className="text-paper">
              <Who save={save} id={a[k]!} />
              {a.co?.[k]?.map((id) => (
                <span key={id}>
                  {" "}
                  &amp; <Who save={save} id={id} />
                </span>
              ))}
            </span>
          </li>
        ))}
        {a.coyName && (
          <li className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-muted">Coach of the Year</span>
            <span className="text-paper">{a.coyName}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function HofCard({ save }: { save: DynastySave }) {
  const classYear = save.year + 1;
  const list = save.history.hof.filter((m) => m.year === classYear);
  if (!list.length) return null;
  return (
    <section className="rounded-xl border border-brass/40 bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-brass">HALL OF FAME · CLASS OF {classYear}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {list.map((m) => (
          <li key={m.playerId ?? m.name} className="rounded-md border border-line px-3 py-1.5 text-sm text-paper">
            {m.playerId ? <Who save={save} id={m.playerId} /> : m.name}
            {m.playerId && save.players[m.playerId] ? <span className="ml-1 text-muted">{save.players[m.playerId]!.pos}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DraftCard({ save }: { save: DynastySave }) {
  const year = save.phase === "draft" ? save.year - 1 : save.year;
  const picks = Object.values(save.players)
    .filter((p): p is Player & { draftPick: number } => p.draftYear === year && !!p.draftPick && p.draftRound === 1)
    .sort((a, b) => a.draftPick - b.draftPick || (a.draftTeam ?? "").localeCompare(b.draftTeam ?? ""));
  if (!picks.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-muted">THE {year} DRAFT · FIRST ROUND</p>
      <ol className="mt-3 grid gap-1 sm:grid-cols-2">
        {picks.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-sm">
            <span className="tabular w-6 text-right text-muted">{p.draftPick}</span>
            {p.draftTeam && <Logo id={p.draftTeam} size={20} year={year} />}
            <span className="min-w-0 truncate">
              <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{p.pos}{p.college ? `, ${p.college}` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The History mode front page. */
export function HistoryDesk() {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const setTab = useGameStore((s) => s.setTab);
  const slate = lastSlate(save);
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]);
  const played = ids.some((id) => save.teams[id]!.wins + save.teams[id]!.losses + save.teams[id]!.ties > 0);
  const leaders = ids
    .map((id) => ({ id, t: save.teams[id]! }))
    .sort((a, b) => b.t.wins - a.t.wins || a.t.losses - b.t.losses || a.id.localeCompare(b.id))
    .slice(0, 8);
  const [mine, setMine] = useState(false);
  const wire = (mine ? save.news.filter((n) => followedNews(save, n)) : save.news).slice(0, 8);
  const midSeason = save.phase === "regular" && save.week > 3;
  const afterSeason = ["superBowl", "awards", "hof", "complete"].includes(save.phase);
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="primetime" veil="full" />
        <div className="relative space-y-3 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">HISTORY MODE · {save.year}</p>
          <h2 className="font-display text-4xl sm:text-5xl">{save.weekLabel}</h2>
          <p className="max-w-2xl text-paper">
            The league exactly as it happened. Nothing here is simulated: step through the calendar and open any tab to
            see the real league at this moment.
          </p>
          <p className="max-w-2xl text-sm text-muted">{coverageNote(save.year)}</p>
        </div>
      </section>
      {afterSeason && <SuperBowlCard save={save} />}
      {(save.phase === "awards" || save.phase === "hof" || save.phase === "complete") && (
        <div className="grid gap-4 md:grid-cols-2">
          <AwardsCard save={save} />
          <HofCard save={save} />
        </div>
      )}
      {save.phase !== "complete" && <CallsPanel />}
      {slate.games.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">{slate.title.toUpperCase()} · TAP A GAME FOR ITS BOX SCORE</p>
          <ul className="mt-3 space-y-2">
            {slate.games.map((g) => (
              <GameRow key={g.id} save={save} g={g} />
            ))}
          </ul>
        </section>
      )}
      <FollowingPanel />
      <RecordWatch />
      {midSeason && <PlayoffPicture save={save} />}
      {(save.phase === "preseason" || (save.phase === "draft" && save.year > 1966)) && <DraftCard save={save} />}
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
        {(wire.length > 0 || mine) && (
          <section className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs tracking-[0.25em] text-muted">AROUND THE LEAGUE</p>
              <button type="button" aria-pressed={mine} className={`bx-chip min-h-9 px-3 text-[11px] ${mine ? "bx-chip-on" : ""}`} onClick={() => setMine((v) => !v)}>
                ★ Following only
              </button>
            </div>
            {mine && !wire.length && <p className="mt-2 text-sm text-muted">Nothing yet about who you follow.</p>}
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
      <RecordBookPanel />
    </div>
  );
}


/** Every real draft class so far, pick by pick. */
export function HistoryDraft() {
  const save = useGameStore((s) => s.save)!;
  const byYear = useMemo(() => {
    const out = new Map<number, Player[]>();
    for (const p of Object.values(save.players)) if (p.draftYear && p.draftPick) out.set(p.draftYear, [...(out.get(p.draftYear) ?? []), p]);
    return out;
  }, [save]);
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const [year, setYear] = useState<number | undefined>(undefined);
  const shown = year ?? years[0];
  const [round, setRound] = useState(1);
  if (shown === undefined)
    return <p className="text-muted">The {save.year} draft hasn&apos;t happened yet. Step forward to see it.</p>;
  const picks = (byYear.get(shown) ?? [])
    .slice()
    .sort((a, b) => (a.draftRound ?? 0) - (b.draftRound ?? 0) || a.draftPick! - b.draftPick! || (a.draftTeam ?? "").localeCompare(b.draftTeam ?? ""));
  const rounds = [...new Set(picks.map((p) => p.draftRound ?? 0))].sort((a, b) => a - b);
  const r = rounds.includes(round) ? round : (rounds[0] ?? 1);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="font-display text-3xl">The {shown} draft</h2>
        <select
          aria-label="Draft year"
          className="min-h-10 rounded-md border border-line bg-surface-2 px-2 text-sm"
          value={shown}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select aria-label="Round" className="min-h-10 rounded-md border border-line bg-surface-2 px-2 text-sm" value={r} onChange={(e) => setRound(Number(e.target.value))}>
          {rounds.map((x) => (
            <option key={x} value={x}>
              Round {x}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted">{picks.length} players drafted</span>
      </div>
      {shown === 1966 && <p className="text-sm text-muted">1966 had two drafts, the NFL&apos;s and the AFL&apos;s; both are listed.</p>}
      <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
        {picks
          .filter((p) => (p.draftRound ?? 0) === r)
          .map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="tabular w-8 text-right text-muted">{p.draftPick}</span>
              {p.draftTeam && <Logo id={p.draftTeam} size={22} year={shown} />}
              <span className="w-40 truncate text-muted max-sm:hidden">{p.draftTeam ? displayName(shown, p.draftTeam) : ""}</span>
              <span className="min-w-0 flex-1 truncate">
                <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{p.pos}</span>
              </span>
              <span className="truncate text-xs text-subtle max-sm:hidden">{p.college}</span>
            </li>
          ))}
      </ol>
    </section>
  );
}
