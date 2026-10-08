/**
 * History mode's live desk: the real box score of every game, the clubs and players the
 * viewer follows, the viewer's calls before the results, the all-time record book as it
 * stood that week (and who's chasing it), and every franchise's ledger and series back to
 * 1920. History mode only.
 */
import { useEffect, useMemo, useState } from "react";
import {
  activeTeamIds,
  boxFor,
  boxPlayerId,
  boxSeason,
  callPoints,
  callsReport,
  displayName,
  follows,
  franchiseLedger,
  gamesInSeason,
  historyGrade,
  historyRecords,
  isFollowed,
  loadBoxSeason,
  seriesBetween,
  seriesOf,
  teamAbbr,
  upcomingHistoryGames,
  type BoxGame,
  type BoxLine,
  type DynastySave,
  type GameResult,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "0921" in the 1975 season -> "Sunday, September 21, 1975" (January and February games are the next year). */
function gameDate(season: number, mmdd: string): string {
  const m = Number(mmdd.slice(0, 2));
  const d = Number(mmdd.slice(2));
  const year = m < 7 ? season + 1 : season;
  const day = new Date(Date.UTC(year, m - 1, d)).getUTCDay();
  return `${DAYS[day]}, ${MONTHS[m - 1]} ${d}, ${year}`;
}

const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

/** Load a season's box scores and re-render when they arrive. */
function useBoxes(year: number | undefined): BoxGame[] | undefined | null {
  const [games, setGames] = useState<BoxGame[] | undefined | null>(year === undefined ? null : (boxSeason(year) ?? null));
  useEffect(() => {
    if (year === undefined) return;
    let live = true;
    setGames(boxSeason(year) ?? null);
    void loadBoxSeason(year).then((g) => {
      if (live) setGames(g);
    });
    return () => {
      live = false;
    };
  }, [year]);
  return games;
}

function Who({ save, who }: { save: DynastySave; who: string }) {
  const id = boxPlayerId(who);
  const p = id ? save.players[id] : undefined;
  return p ? <PlayerLink player={p} className="inline min-h-0" /> : <span>{who.startsWith("#") ? "—" : who}</span>;
}

/* ---------------- follow ---------------- */

export function FollowButton({ teamId, playerId, className = "" }: { teamId?: TeamId; playerId?: string; className?: string }) {
  const save = useGameStore((s) => s.save);
  const toggle = useGameStore((s) => s.toggleFollow);
  if (!save?.realHistory) return null;
  const on = isFollowed(save, { teamId, playerId });
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => toggle({ teamId, playerId })}
      className={`inline-flex min-h-11 items-center gap-1 rounded-md border px-3 text-sm ${on ? "border-brass bg-brass/20 text-brass" : "border-line bg-black/30 text-paper hover:border-brass"} ${className}`}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span> {on ? "Following" : "Follow"}
    </button>
  );
}

/* ---------------- box score ---------------- */

const PASS = (l: BoxLine) => !!l.pa;
const RUSH = (l: BoxLine) => !!l.ra;
const RECV = (l: BoxLine) => !!l.re;
const DEF = (l: BoxLine) => !!(l.in || l.sa || l.tk || l.ff || l.fr);
const KICKS = (l: BoxLine) => !!(l.pn || l.pr || l.kr);

function StatTable({
  save,
  box,
  side,
  title,
  has,
  cols,
}: {
  save: DynastySave;
  box: BoxGame;
  side: 0 | 1;
  title: string;
  has: (l: BoxLine) => boolean;
  cols: [string, (l: BoxLine) => string | number][];
}) {
  const rows = box.p.filter(([s, , l]) => s === side && has(l));
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] text-sm">
        <thead>
          <tr className="text-[11px] tracking-[0.15em] text-muted">
            <th className="py-1 text-left font-normal">{title}</th>
            {cols.map(([h]) => (
              <th key={h} className="px-1 py-1 text-right font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map(([, who, l], i) => (
            <tr key={`${who}-${i}`} className="border-t border-line/60">
              <td className="max-w-[10rem] truncate py-1 pr-2 text-paper">
                <Who save={save} who={who} />
              </td>
              {cols.map(([h, f]) => (
                <td key={h} className="px-1 py-1 text-right">
                  {f(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const lg = (l: BoxLine, k: string) => (l[k] ? `${l[k]}${l[`${k}t`] ? "t" : ""}` : "");

function TeamLines({ save, box, side, year }: { save: DynastySave; box: BoxGame; side: 0 | 1; year: number }) {
  const id = side ? box.h : box.a;
  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-3">
      <p className="flex items-center gap-2 text-xs tracking-[0.25em] text-muted">
        <Logo id={id} size={20} year={year} /> {displayName(year, id).toUpperCase()}
      </p>
      <StatTable save={save} box={box} side={side} title="Passing" has={PASS} cols={[["C/A", (l) => `${l.pc ?? 0}/${l.pa ?? 0}`], ["Yds", (l) => l.py ?? 0], ["TD", (l) => l.pt ?? 0], ["Int", (l) => l.pi ?? 0], ["Lg", (l) => lg(l, "pl")]]} />
      <StatTable save={save} box={box} side={side} title="Rushing" has={RUSH} cols={[["Att", (l) => l.ra ?? 0], ["Yds", (l) => l.ry ?? 0], ["TD", (l) => l.rt ?? 0], ["Lg", (l) => lg(l, "rl")]]} />
      <StatTable save={save} box={box} side={side} title="Receiving" has={RECV} cols={[["Rec", (l) => l.re ?? 0], ["Yds", (l) => l.ey ?? 0], ["TD", (l) => l.et ?? 0], ["Lg", (l) => lg(l, "el")]]} />
      <StatTable
        save={save}
        box={box}
        side={side}
        title="Defense"
        has={DEF}
        cols={[
          ["Int", (l) => l.in ?? ""],
          ["Sk", (l) => l.sa ?? ""],
          ...(box.p.some(([, , l]) => l.tk) ? ([["Tkl", (l: BoxLine) => l.tk ?? ""]] as [string, (l: BoxLine) => string | number][]) : []),
          ["FR", (l) => l.fr ?? ""],
        ]}
      />
      <StatTable
        save={save}
        box={box}
        side={side}
        title="Kicks & returns"
        has={KICKS}
        cols={[
          ["Punts", (l) => (l.pn ? `${l.pn}-${l.pny ?? 0}` : "")],
          ["PR", (l) => (l.pr ? `${l.pr}-${l.pry ?? 0}` : "")],
          ["KR", (l) => (l.kr ? `${l.kr}-${l.kry ?? 0}` : "")],
        ]}
      />
    </section>
  );
}

function TeamStats({ box }: { box: BoxGame }) {
  const [a, h] = box.t;
  const num = (x: Record<string, number | string>, k: string) => (typeof x[k] === "number" ? (x[k] as number) : undefined);
  const net = (x: Record<string, number | string>) => {
    const ry = num(x, "ry");
    const py = num(x, "py");
    return ry === undefined || py === undefined ? undefined : ry + py - (num(x, "sy") ?? 0);
  };
  const rows: [string, (x: Record<string, number | string>) => string | number | undefined][] = [
    ["First downs", (x) => num(x, "fd")],
    ["Total yards", net],
    ["Rushing", (x) => (num(x, "ra") !== undefined ? `${x.ra}-${x.ry}` : undefined)],
    ["Passing", (x) => (num(x, "pa") !== undefined ? `${x.pc}/${x.pa}, ${(num(x, "py") ?? 0) - (num(x, "sy") ?? 0)} net` : undefined)],
    ["Sacked", (x) => (num(x, "sk") !== undefined ? `${x.sk}-${x.sy ?? 0}` : undefined)],
    ["Turnovers", (x) => (num(x, "pi") !== undefined || num(x, "fl") !== undefined ? (num(x, "pi") ?? 0) + (num(x, "fl") ?? 0) : undefined)],
    ["Penalties", (x) => (num(x, "pen") !== undefined ? `${x.pen}-${x.peny ?? 0}` : undefined)],
    ["Third down", (x) => (x["3d"] as string | undefined) ?? undefined],
    ["Time of possession", (x) => (x.top as string | undefined) ?? undefined],
  ];
  const shown = rows.filter(([, f]) => f(a) !== undefined || f(h) !== undefined);
  if (!shown.length) return null;
  return (
    <section className="rounded-lg border border-line bg-surface p-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] tracking-[0.15em] text-muted">
            <th className="py-1 text-left font-normal">TEAM STATS</th>
            <th className="py-1 text-right font-normal">{teamAbbr(box.a)}</th>
            <th className="py-1 text-right font-normal">{teamAbbr(box.h)}</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {shown.map(([label, f]) => (
            <tr key={label} className="border-t border-line/60">
              <td className="py-1 text-muted">{label}</td>
              <td className="py-1 text-right">{f(a) ?? "—"}</td>
              <td className="py-1 text-right">{f(h) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function BoxScore({ save, box, season, round }: { save: DynastySave; box: BoxGame; season: number; round?: string }) {
  const year = season;
  const quarters = Math.max(box.q[0].length, box.q[1].length, 4);
  const series = seriesBetween(save, box.a, box.h);
  const [showLineups, setShowLineups] = useState(false);
  const qlabel = (i: number) => (i < 4 ? String(i + 1) : quarters > 5 ? `OT${i - 3}` : "OT");
  return (
    <div className="space-y-4">
      <section className="space-y-1 text-sm text-muted">
        <p className="text-paper">
          {round ? `${round} · ` : ""}
          {gameDate(year, box.d)}
        </p>
        <p>{[box.v, box.c].filter(Boolean).join(", ")}{box.n ? " (neutral site)" : ""}</p>
        <p>{[box.at ? `Attendance ${box.at.toLocaleString("en-US")}` : "", box.w ?? ""].filter(Boolean).join(" · ")}</p>
      </section>
      <section className="overflow-x-auto rounded-lg border border-line bg-surface p-3">
        <table className="w-full min-w-[18rem] text-sm">
          <thead>
            <tr className="text-[11px] tracking-[0.15em] text-muted">
              <th className="py-1 text-left font-normal" />
              {Array.from({ length: quarters }, (_, i) => (
                <th key={i} className="w-9 py-1 text-right font-normal">
                  {qlabel(i)}
                </th>
              ))}
              <th className="w-12 py-1 text-right font-normal">FINAL</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {([0, 1] as const).map((side) => {
              const id = side ? box.h : box.a;
              const won = box.f[side] > box.f[side ? 0 : 1];
              return (
                <tr key={side} className="border-t border-line/60">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <Logo id={id} size={22} year={year} />
                      <span className={won ? "text-white" : "text-paper"}>{displayName(year, id)}</span>
                    </span>
                  </td>
                  {Array.from({ length: quarters }, (_, i) => (
                    <td key={i} className="py-1.5 text-right">
                      {box.q[side][i] ?? (i < 4 ? 0 : "")}
                    </td>
                  ))}
                  <td className={`bug-num py-1.5 text-right text-lg ${won ? "text-white" : "text-paper"}`}>{box.f[side]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {series && (
          <p className="mt-2 text-xs text-muted">
            All-time series:{" "}
            {series.wins === series.losses
              ? `tied ${rec(series.wins, series.losses, series.ties)}`
              : `${displayName(year, series.wins > series.losses ? box.a : box.h)} lead ${rec(Math.max(series.wins, series.losses), Math.min(series.wins, series.losses), series.ties)}`}
          </p>
        )}
      </section>
      {box.s.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-3">
          <p className="text-xs tracking-[0.25em] text-muted">SCORING</p>
          <ol className="mt-2 space-y-1.5 text-sm">
            {box.s.map(([q, side, text, as, hs], i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="w-8 shrink-0 text-xs text-subtle">{qlabel(q - 1)}</span>
                <span className="w-10 shrink-0 text-xs text-brass">{teamAbbr(side ? box.h : box.a)}</span>
                <span className="min-w-0 flex-1 text-paper">{text}</span>
                {as !== undefined && hs !== undefined && (
                  <span className="tabular shrink-0 text-xs text-muted">
                    {as}-{hs}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      <TeamStats box={box} />
      <div className="grid gap-3 md:grid-cols-2">
        <TeamLines save={save} box={box} side={0} year={year} />
        <TeamLines save={save} box={box} side={1} year={year} />
      </div>
      {box.l && (box.l[0].length > 0 || box.l[1].length > 0) && (
        <section className="rounded-lg border border-line bg-surface p-3">
          <button type="button" className="min-h-10 text-xs tracking-[0.25em] text-brass underline" onClick={() => setShowLineups((v) => !v)} aria-expanded={showLineups}>
            {showLineups ? "HIDE" : "SHOW"} STARTING LINEUPS
          </button>
          {showLineups && (
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {([0, 1] as const).map((side) => (
                <ul key={side} className="space-y-0.5 text-sm">
                  <li className="text-xs tracking-[0.2em] text-muted">{displayName(year, side ? box.h : box.a).toUpperCase()}</li>
                  {box.l![side].map(([pos, who], i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-10 shrink-0 text-xs text-subtle">{pos}</span>
                      <Who save={save} who={who} />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          )}
        </section>
      )}
      <p className="text-xs text-subtle">Box score: Pro Football Archives. Blank cells are numbers the record doesn&apos;t have.</p>
    </div>
  );
}

/** The box score window, opened from any game in History mode. */
export function HistoryBoxModal() {
  const save = useGameStore((s) => s.save);
  const view = useGameStore((s) => s.boxView);
  const close = useGameStore((s) => s.closeBox);
  const games = useBoxes(view?.year);
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, close]);
  if (!save?.realHistory || !view) return null;
  const box = games ? boxFor({ year: view.year, homeId: view.homeId, awayId: view.awayId, date: view.date }) : undefined;
  const title = `${displayName(view.year, view.awayId)} at ${displayName(view.year, view.homeId)}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-studio/80 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close box score" onClick={close} />
      <article role="dialog" aria-modal="true" aria-label={`Box score: ${title}`} className="relative z-10 flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border-line bg-bg sm:max-h-[92dvh] sm:rounded-xl sm:border">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.25em] text-brass">BOX SCORE · {view.round ?? (view.week ? `${view.year} · WEEK ${view.week}` : view.year)}</p>
            <h2 className="truncate font-display text-2xl">{title}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="chrome-bevel inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-surface-2">
            ✕
          </button>
        </header>
        <div className="overflow-auto p-4">
          {games === null ? (
            <p className="text-muted">Loading the {view.year} box scores…</p>
          ) : box ? (
            <BoxScore save={save} box={box} season={view.year} round={view.round} />
          ) : (
            <p className="text-muted">The record doesn&apos;t have a box score for this game.</p>
          )}
        </div>
      </article>
    </div>
  );
}

/* ---------------- following ---------------- */

/** A followed player's line in a box score, in a few words. */
function gameLine(l: BoxLine): string {
  const bits: string[] = [];
  if (l.pa) bits.push(`${l.pc ?? 0}/${l.pa}, ${l.py ?? 0} yds${l.pt ? `, ${l.pt} TD` : ""}${l.pi ? `, ${l.pi} INT` : ""}`);
  if (l.ra) bits.push(`${l.ra} rush, ${l.ry ?? 0} yds${l.rt ? `, ${l.rt} TD` : ""}`);
  if (l.re) bits.push(`${l.re} rec, ${l.ey ?? 0} yds${l.et ? `, ${l.et} TD` : ""}`);
  if (l.in) bits.push(`${l.in} INT`);
  if (l.sa) bits.push(`${l.sa} sack${l.sa === 1 ? "" : "s"}`);
  if (l.tk) bits.push(`${l.tk} tackles`);
  if (l.kr) bits.push(`${l.kr} KR, ${l.kry ?? 0} yds`);
  if (l.pr) bits.push(`${l.pr} PR, ${l.pry ?? 0} yds`);
  if (l.pn) bits.push(`${l.pn} punts, ${l.pny ?? 0} yds`);
  return bits.join("; ");
}

function seasonLine(p: Player, year: number): string {
  const s = p.stats[year];
  if (!s) return "No stats yet this season";
  const bits: string[] = [];
  if (s.passAtt) bits.push(`${s.passCmp}/${s.passAtt}, ${s.passYds.toLocaleString("en-US")} yds, ${s.passTd} TD, ${s.passInt} INT`);
  if (s.rushAtt >= 10 || (s.rushAtt && !s.passAtt)) bits.push(`${s.rushAtt} rush, ${s.rushYds.toLocaleString("en-US")} yds, ${s.rushTd} TD`);
  if (s.rec) bits.push(`${s.rec} rec, ${s.recYds.toLocaleString("en-US")} yds, ${s.recTd} TD`);
  if (s.ints) bits.push(`${s.ints} INT`);
  if (s.sacks && !s.unknown?.includes("sacks")) bits.push(`${s.sacks} sacks`);
  if (s.tackles && !s.unknown?.includes("tackles")) bits.push(`${s.tackles} tackles`);
  if (s.fgAtt && !s.unknown?.includes("fgAtt")) bits.push(`${s.fgMade}/${s.fgAtt} FG`);
  return `${s.gp} games${bits.length ? ` · ${bits.join(" · ")}` : ""}${s.live ? " (so far)" : ""}`;
}

function teamGames(save: DynastySave, id: TeamId): GameResult[] {
  return [...save.schedule.filter((g) => g.year === save.year), ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])].filter(
    (g) => g.homeId === id || g.awayId === id,
  );
}

export function FollowingPanel() {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const openBox = useGameStore((s) => s.openBox);
  const until = useGameStore((s) => s.historyUntilFollowed);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useBoxes(save.year);
  const f = follows(save);
  const year = save.year;
  const any = f.teams.length + f.players.length > 0;
  const go = () => {
    setBusy(true);
    setNote(null);
    setTimeout(() => {
      const why = until();
      setBusy(false);
      setNote(why === "season" ? "Nothing new for them the rest of the season. On to the next one." : why ? `Stopped: ${why}` : null);
    }, 20);
  };
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Following">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-brass">★ FOLLOWING</p>
        {any && save.phase !== "complete" && (
          <Btn className="min-h-10 px-3 text-sm" disabled={busy} onClick={go}>
            {busy ? "Playing…" : "Play to their next moment ▸▸"}
          </Btn>
        )}
      </div>
      {note && <p className="mt-2 text-sm text-paper">{note}</p>}
      {!any ? (
        <p className="mt-2 text-sm text-muted">Open any club or player and press ☆ Follow. Their games, lines and news show up here, and you can skip straight to their next moment.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {f.teams.map((id) => {
            const t = save.teams[id];
            if (!t) return null;
            const games = teamGames(save, id);
            const last = games.filter((g) => g.played).at(-1);
            const next = games.find((g) => !g.played);
            const us = (g: GameResult) => (g.homeId === id ? [g.homeScore, g.awayScore] : [g.awayScore, g.homeScore]);
            const opp = (g: GameResult) => (g.homeId === id ? `vs. ${displayName(year, g.awayId as TeamId)}` : `at ${displayName(year, g.homeId as TeamId)}`);
            return (
              <li key={id} className="flex flex-wrap items-center gap-3">
                <Logo id={id} size={32} year={year} />
                <button type="button" className="min-h-10 text-left font-display text-lg hover:text-brass" onClick={() => openTeam(id)}>
                  {displayName(year, id)} <span className="tabular text-paper">{rec(t.wins, t.losses, t.ties)}</span>
                </button>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  {last && (
                    <button type="button" className="underline decoration-line hover:text-brass" onClick={() => openBox(last)}>
                      {(() => {
                        const [a, b] = us(last);
                        return `${a > b ? "W" : a < b ? "L" : "T"} ${a}-${b} ${opp(last)}`;
                      })()}
                    </button>
                  )}
                  {next && <span>{last ? " · " : ""}Next: {opp(next)}{next.round ? ` (${next.round})` : ` (week ${next.week})`}</span>}
                </span>
              </li>
            );
          })}
          {f.players.map((pid) => {
            const p = save.players[pid];
            if (!p) return null;
            const team = (p.stats[year]?.teamId ?? p.teamId) as TeamId;
            const box = save.teams[team] ? teamGames(save, team).filter((g) => g.played).reverse().map((g) => ({ g, b: boxFor(g) })).find((x) => x.b?.p.some(([, who]) => boxPlayerId(who) === pid)) : undefined;
            const line = box?.b?.p.find(([, who]) => boxPlayerId(who) === pid)?.[2];
            return (
              <li key={pid} className="space-y-0.5">
                <p className="text-sm">
                  <PlayerLink player={p} className="inline min-h-0 font-display text-lg" /> <span className="text-muted">{p.pos}{save.teams[team] ? `, ${displayName(year, team)}` : ""}</span>
                </p>
                <p className="text-xs text-muted">{seasonLine(p, year)}</p>
                {line && box && (
                  <button type="button" className="text-left text-xs text-paper underline decoration-line hover:text-brass" onClick={() => openBox(box.g)}>
                    Last game ({box.g.round ?? `week ${box.g.week}`}): {gameLine(line)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- calling it ---------------- */

export function CallsPanel() {
  const save = useGameStore((s) => s.save)!;
  const makeCall = useGameStore((s) => s.makeCall);
  const year = save.year;
  const upcoming = upcomingHistoryGames(save);
  const calls = save.historyCalls ?? {};
  const report = callsReport(save);
  const seasonOpen = save.phase === "draft" || save.phase === "preseason" || (save.phase === "regular" && save.week === 1);
  const teams = activeTeamIds(year).filter((id) => save.teams[id]).sort((a, b) => displayName(year, a).localeCompare(displayName(year, b)));
  const [mvpText, setMvpText] = useState("");
  const candidates = useMemo(() => {
    if (!seasonOpen) return [] as Player[];
    const ids = new Set(activeTeamIds(year).flatMap((t) => save.teams[t]?.roster ?? []));
    return [...ids].map((id) => save.players[id]).filter((p): p is Player => !!p && ["QB", "RB", "WR", "TE", "DE", "DT", "OLB", "MLB", "CB", "S"].includes(p.pos));
  }, [save, year, seasonOpen]);
  const mvpPick = calls[`mvp:${year}`] ? save.players[calls[`mvp:${year}`]!] : undefined;
  const label = (p: Player) => `${p.firstName} ${p.lastName} (${p.pos}, ${teamAbbr(p.teamId as TeamId)})`;
  const pickMvp = (text: string) => {
    setMvpText(text);
    const p = candidates.find((c) => label(c) === text);
    if (p) makeCall(`mvp:${year}`, p.id);
  };
  const title = save.phase === "playoffs" ? upcoming[0]?.round ?? "The playoffs" : `Week ${save.week}`;
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Call it">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-brass">CALL IT</p>
        <p className="tabular text-xs text-muted">
          {report.points} pts · {report.right}/{report.made} right{report.made ? ` (${Math.round((report.right / report.made) * 100)}%)` : ""} · streak {report.streak} · best {report.best}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">Pick before the results come in. A game is a point (playoffs 2), the champion or the MVP is 10.</p>
      {seasonOpen && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted">
            {year} champion
            <select
              className="mt-1 block min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-sm text-fg"
              value={calls[`sb:${year}`] ?? ""}
              onChange={(e) => makeCall(`sb:${year}`, e.target.value || null)}
            >
              <option value="">Pick a club…</option>
              {teams.map((id) => (
                <option key={id} value={id}>
                  {displayName(year, id)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            {year} MVP
            <input
              list="history-mvp-list"
              className="mt-1 block min-h-11 w-full rounded-md border border-line bg-surface-2 px-2 text-sm text-fg"
              placeholder={mvpPick ? label(mvpPick) : "Type a name…"}
              value={mvpText}
              onChange={(e) => pickMvp(e.target.value)}
            />
            <datalist id="history-mvp-list">
              {candidates.map((p) => (
                <option key={p.id} value={label(p)} />
              ))}
            </datalist>
            {mvpPick && <span className="mt-1 block text-paper">Your pick: {label(mvpPick)}</span>}
          </label>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="mt-3">
          <p className="text-xs tracking-[0.2em] text-muted">{title.toUpperCase()}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {upcoming.map((g) => {
              const pick = calls[g.id];
              const side = (id: TeamId) => (
                <button
                  type="button"
                  aria-pressed={pick === id}
                  onClick={() => makeCall(g.id, pick === id ? null : id)}
                  className={`flex min-h-11 flex-1 items-center gap-2 rounded-md border px-2 text-left text-sm ${pick === id ? "border-brass bg-brass/20 text-white" : "border-line bg-black/30 text-paper hover:border-brass"}`}
                >
                  <Logo id={id} size={22} year={year} />
                  <span className="truncate">{teamAbbr(id)}</span>
                </button>
              );
              return (
                <li key={g.id} className="flex items-center gap-2">
                  {side(g.awayId as TeamId)}
                  <span className="text-xs text-subtle">at</span>
                  {side(g.homeId as TeamId)}
                  <span className="w-6 text-right text-[10px] text-subtle">{callPoints(g.id)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {report.byDecade.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {report.byDecade.map((d) => (
            <li key={d.decade} className="rounded-md border border-line px-2 py-1 text-xs">
              <span className="text-muted">{d.decade}s</span> <span className="font-display text-base text-brass">{historyGrade(d.right, d.made)}</span>{" "}
              <span className="tabular text-subtle">
                {d.right}/{d.made}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- the record book ---------------- */

const fmtV = (v: number) => (v % 1 ? String(v) : v.toLocaleString("en-US"));

export function RecordBookPanel() {
  const save = useGameStore((s) => s.save)!;
  const book = historyRecords(save);
  const [scope, setScope] = useState<"season" | "career">("season");
  if (!book.length) return null;
  const rows = book.filter((r) => r.scope === scope);
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Record book">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">ALL-TIME RECORDS · AS OF {save.weekLabel.toUpperCase()}, {save.year}</p>
        <div className="flex gap-1">
          {(["season", "career"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`bx-chip min-h-9 px-3 text-[11px] ${scope === s ? "bx-chip-on" : ""}`}>
              {s === "season" ? "Single season" : "Career"}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map((r) => {
          const p = r.playerId ? save.players[r.playerId] : undefined;
          const fresh = r.since === save.year;
          return (
            <li key={r.stat} className={`flex flex-wrap items-baseline justify-between gap-2 ${fresh ? "text-brass" : ""}`}>
              <span className="text-muted">{r.label.replace(/^./, (c) => c.toUpperCase())}</span>
              <span className="text-paper">
                <span className="tabular font-display text-base text-white">{fmtV(r.value)}</span> {p ? <PlayerLink player={p} className="inline min-h-0" /> : r.holder}
                {r.year ? <span className="text-muted"> ({r.year})</span> : null}
                {fresh ? <span className="ml-1 text-[10px] tracking-[0.2em] text-brass">NEW</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {scope === "season" && save.year < 1982 && <p className="mt-2 text-xs text-subtle">Sacks became an official stat in 1982; their records start there.</p>}
    </section>
  );
}

/** This season's leaders against the single-season records, once the chase means something. */
export function RecordWatch() {
  const save = useGameStore((s) => s.save)!;
  if (save.phase !== "regular") return null;
  const year = save.year;
  const book = historyRecords(save).filter((r) => r.scope === "season");
  const total = gamesInSeason(year);
  const played = Math.max(0, save.week - 1);
  if (played < Math.max(4, Math.round(total * 0.4))) return null;
  const KEY: Record<string, keyof Player["stats"][number]> = {
    passYds: "passYds",
    passTd: "passTd",
    rushYds: "rushYds",
    rushTd: "rushTd",
    rec: "rec",
    recYds: "recYds",
    recTd: "recTd",
    ints: "ints",
    sacks: "sacks",
  };
  const rows = book
    .map((r) => {
      const k = KEY[r.stat];
      if (!k || (r.stat === "sacks" && year < 1982)) return undefined;
      let best: { p: Player; v: number } | undefined;
      for (const p of Object.values(save.players)) {
        const s = p.stats[year];
        if (!s?.live) continue;
        const v = s[k] as number;
        if (v > (best?.v ?? 0)) best = { p, v };
      }
      if (!best) return undefined;
      const left = total - played;
      const pace = Math.round((best.v / Math.max(1, played)) * total);
      const holderIsHim = r.playerId === best.p.id && r.year === year;
      if (!holderIsHim && (pace < r.value * 0.97 || left <= 0)) return undefined;
      return { r, ...best, pace, left, holderIsHim };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .slice(0, 4);
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-brass/40 bg-brass/5 p-4" aria-label="Record watch">
      <p className="text-xs tracking-[0.25em] text-brass">RECORD WATCH</p>
      <ul className="mt-2 space-y-2 text-sm">
        {rows.map((x) => (
          <li key={x.r.stat}>
            <PlayerLink player={x.p} className="inline min-h-0 text-white" />{" "}
            {x.holderIsHim ? (
              <span className="text-paper">owns the {x.r.label} record now: {fmtV(x.v)} and counting.</span>
            ) : (
              <span className="text-paper">
                has {fmtV(x.v)} {x.r.label} with {x.left} game{x.left === 1 ? "" : "s"} left, on pace for {fmtV(x.pace)}. The record: {fmtV(x.r.value)}, {x.r.holder} ({x.r.year}).
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- franchise ledger and series ---------------- */

export function FranchisePanel({ id }: { id: TeamId }) {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const L = franchiseLedger(save, id);
  if (!L) return null;
  const year = save.year;
  const games = L.wins + L.losses + L.ties;
  const pct = games ? ((L.wins + L.ties / 2) / games).toFixed(3).replace(/^0/, "") : "—";
  const series = seriesOf(save, id).slice(0, 8);
  return (
    <section className="rounded-lg border border-line bg-surface p-3 md:col-span-2">
      <p className="text-xs tracking-[0.25em] text-muted">FRANCHISE HISTORY · ALL-TIME, AS OF NOW</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Regular season</dt>
          <dd className="tabular text-white">
            {rec(L.wins, L.losses, L.ties)} <span className="text-muted">({pct})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Playoffs</dt>
          <dd className="tabular text-white">{rec(L.playoffWins, L.playoffLosses, 0)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">League championships ({L.titles.length})</dt>
          <dd className="text-paper">{L.titles.length ? L.titles.join(", ") : "None yet"}</dd>
        </div>
      </dl>
      {series.length > 0 && (
        <div className="mt-3">
          <p className="text-xs tracking-[0.2em] text-muted">MOST-PLAYED SERIES</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {series.map((r) => (
              <li key={r.them} className="flex items-center gap-2 text-sm">
                <Logo id={r.them} size={20} year={year} />
                <button type="button" className="min-h-9 flex-1 truncate text-left hover:text-brass" onClick={() => openTeam(r.them)}>
                  {displayName(year, r.them)}
                </button>
                <span className="tabular text-paper">{rec(r.wins, r.losses, r.ties)}</span>
                {r.last && <span className="tabular text-xs text-subtle">last {r.last.year}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-subtle">Back to 1920 for the NFL&apos;s old clubs and 1960 for the AFL&apos;s (the AAFC isn&apos;t counted, as the league&apos;s record book doesn&apos;t count it).</p>
    </section>
  );
}

/* ---------------- a player's games ---------------- */

const shortDate = (mmdd: string) => `${MONTHS[Number(mmdd.slice(0, 2)) - 1]!.slice(0, 3)} ${Number(mmdd.slice(2))}`;

/** A player's real games, season by season, from the box scores (only games already played on the calendar). */
export function PlayerGameLog({ player }: { player: Player }) {
  const save = useGameStore((s) => s.save)!;
  const openBox = useGameStore((s) => s.openBox);
  const seasons = useMemo(() => {
    const ys = new Set(Object.keys(player.stats).map(Number));
    if (player.teamId !== "fa" && player.teamId !== "retired" && player.teamId !== "hof" && save.phase !== "draft") ys.add(save.year);
    return [...ys].filter((y) => y <= save.year).sort((a, b) => b - a);
  }, [player, save.year, save.phase]);
  const [year, setYear] = useState<number | undefined>(undefined);
  const shown = year ?? seasons[0];
  const games = useBoxes(shown);
  if (shown === undefined) return null;
  const me = `#${player.id.slice(2)}`;
  // This season, only what's been played so far.
  const played =
    shown === save.year
      ? [...save.schedule.filter((g) => g.year === shown && g.played), ...save.playoffGames, ...(save.superBowl?.played ? [save.superBowl] : [])]
      : undefined;
  const rows = (games ?? [])
    .map((b) => ({ b, line: b.p.find(([, who]) => who === me) }))
    .filter((x): x is { b: BoxGame; line: [0 | 1, string, BoxLine] } => !!x.line)
    .filter(({ b }) => !played || played.some((g) => g.date === b.d && ((g.homeId === b.h && g.awayId === b.a) || (g.homeId === b.a && g.awayId === b.h))));
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">GAME BY GAME</p>
        {seasons.length > 1 && (
          <select aria-label="Season" className="min-h-10 rounded-md border border-line bg-surface-2 px-2 text-sm" value={shown} onChange={(e) => setYear(Number(e.target.value))}>
            {seasons.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>
      {games === null ? (
        <p className="mt-2 text-sm text-muted">Loading the {shown} box scores…</p>
      ) : !rows.length ? (
        <p className="mt-2 text-sm text-muted">No game lines for him in {shown}{shown === save.year ? " yet" : ""}.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line/60 text-sm">
          {rows.map(({ b, line: [side, , l] }) => {
            const us = b.f[side];
            const them = b.f[side ? 0 : 1];
            const opp = side ? b.a : b.h;
            return (
              <li key={`${b.d}-${b.h}`}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 py-1 text-left hover:text-brass"
                  onClick={() => openBox({ year: shown, homeId: b.h, awayId: b.a, date: b.d, week: 0 })}
                >
                  <span className="tabular w-14 shrink-0 text-xs text-muted">{shortDate(b.d)}</span>
                  <span className="w-6 shrink-0 text-xs text-subtle">{side ? "vs" : "at"}</span>
                  <Logo id={opp} size={18} year={shown} />
                  <span className="w-10 shrink-0 text-xs">{teamAbbr(opp)}</span>
                  <span className={`tabular w-14 shrink-0 text-xs ${us > them ? "text-good" : us < them ? "text-red" : "text-paper"}`}>
                    {us > them ? "W" : us < them ? "L" : "T"} {us}-{them}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-paper">{gameLine(l) || "Played"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
