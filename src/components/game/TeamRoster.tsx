import { useEffect, useState } from "react";
import {
  activeTeamIds,
  depthChart,
  displayName,
  divisionKey,
  formatMoney,
  playerName,
  retiredNumbers,
  ringOfHonor,
  rosterOf,
  teamAbbr,
  teamColors,
  teamPayroll,
  visibleOvr,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { KitChips } from "./KitChips";
import { PlayerLink } from "./PlayerProfile";

type View = "overview" | "roster" | "schedule";

/** A club's page: record, staff, money, leaders, results, starters, the full roster and its legacy. */
export function TeamRosterModal() {
  const save = useGameStore((s) => s.save);
  const viewTeamId = useGameStore((s) => s.viewTeamId);
  const closeTeam = useGameStore((s) => s.closeTeam);
  const openProfile = useGameStore((s) => s.openProfile);
  const [view, setView] = useState<View>("overview");
  const [pos, setPos] = useState("");

  useEffect(() => {
    setView("overview");
    setPos("");
  }, [viewTeamId]);

  useEffect(() => {
    if (!viewTeamId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeTeam();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewTeamId, closeTeam]);

  if (!save || !viewTeamId || !save.teams[viewTeamId]) return null;

  const id = viewTeamId;
  const year = save.year;
  const t = save.teams[id]!;
  const colors = teamColors(id, year);
  const coach = (cid?: string | null) => (cid ? save.coaches[cid] : undefined);
  const hc = coach(t.coachId);
  const oc = coach(t.ocId);
  const dc = coach(t.dcId);
  const roster = rosterOf(save, id);
  const rows = roster
    .filter((p) => !pos || p.pos === pos)
    .slice()
    .sort((a, b) => visibleOvr(b) - visibleOvr(a));
  const div = divisionKey(year, id);
  const divTeams = activeTeamIds(year)
    .filter((x) => save.teams[x] && divisionKey(year, x) === div)
    .sort((a, b) => save.teams[b]!.wins - save.teams[a]!.wins || save.teams[a]!.losses - save.teams[b]!.losses);
  const place = divTeams.indexOf(id) + 1;
  const payroll = teamPayroll(save, id);
  const cap = save.salaryCap;
  // Until a game is played, the club's record on file is still last season's.
  const fresh = !save.schedule.some((g) => g.year === year && g.played && (g.homeId === id || g.awayId === id));
  const rec = `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}${fresh && t.wins + t.losses + t.ties ? ` in ${year - 1}` : ""}`;
  const titles = save.history.superBowls.filter((b) => (b.homeScore >= b.awayScore ? b.homeId : b.awayId) === id);
  const games = [...save.schedule.filter((g) => g.year === year), ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])]
    .filter((g) => g.homeId === id || g.awayId === id)
    .sort((a, b) => (a.phase === b.phase ? a.week - b.week : a.phase === "regular" ? -1 : 1));
  const leader = (label: string, of: (p: Player) => number, fmt = (n: number) => n.toLocaleString("en-US")) => {
    const best = roster.map((p) => ({ p, v: p.stats[year] ? of(p) : 0 })).sort((a, b) => b.v - a.v)[0];
    return best && best.v > 0 ? { label, p: best.p, v: fmt(best.v) } : undefined;
  };
  const leaders = [
    leader("Passing", (p) => p.stats[year]!.passYds),
    leader("Rushing", (p) => p.stats[year]!.rushYds),
    leader("Receiving", (p) => p.stats[year]!.recYds),
    leader("Sacks", (p) => p.stats[year]!.sacks, (n) => String(Math.round(n * 10) / 10)),
    leader("Interceptions", (p) => p.stats[year]!.ints),
    leader("Tackles", (p) => p.stats[year]!.tackles),
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const starters = depthChart(save, id);
  const nums = retiredNumbers(save, id);
  const ring = ringOfHonor(save, id);
  const tabs: { id: View; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "roster", label: `Roster (${roster.length})` },
    { id: "schedule", label: "Schedule" },
  ];
  const positions = [...new Set(roster.map((p) => p.pos))];
  const ord = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-studio/80 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close team" onClick={closeTeam} />
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-roster-name"
        className="relative z-10 flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border-0 border-line bg-bg sm:max-h-[92dvh] sm:rounded-xl sm:border"
      >
        <header
          className="flex items-center gap-4 border-b border-line px-4 py-4 sm:px-5"
          style={{ background: `linear-gradient(105deg, ${colors.primary} 0%, color-mix(in srgb, ${colors.primary} 35%, #07090e) 60%, #07090e 100%)` }}
        >
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-black/30 sm:size-20">
            <Logo id={id} size={52} year={year} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.3em] text-brass">
              {year} · {div}
            </p>
            <h2 id="team-roster-name" className="font-display text-3xl leading-none text-white sm:text-4xl">
              {displayName(year, id)}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              <span className="bug-num text-lg text-white">{rec}</span>
              {place && !fresh ? ` · ${ord(place)} in the division` : ""}
              {titles.length ? ` · ${titles.length} title${titles.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={closeTeam}
            aria-label="Close"
            className="chrome-bevel inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-surface-2 text-fg hover:brightness-110"
          >
            ✕
          </button>
        </header>
        <nav className="flex gap-1.5 border-b border-line px-4 py-2" aria-label="Team sections">
          {tabs.map((x) => (
            <button key={x.id} type="button" onClick={() => setView(x.id)} className={`bx-chip min-h-9 px-3 text-[11px] ${view === x.id ? "bx-chip-on" : ""}`}>
              {x.label}
            </button>
          ))}
        </nav>

        <div className="overflow-auto">
          {view === "overview" && (
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <section className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs tracking-[0.25em] text-muted">Front office</p>
                <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
                  <dt className="text-muted">Head coach</dt>
                  <dd className="text-white">
                    {hc?.name ?? "—"}
                    {hc ? (
                      <span className="text-muted">
                        {" "}
                        · {hc.careerWins}-{hc.careerLosses} career
                      </span>
                    ) : null}
                  </dd>
                  <dt className="text-muted">Offense</dt>
                  <dd className="text-paper">
                    {oc?.name ?? "—"} <span className="text-muted">· {t.offScheme}</span>
                  </dd>
                  <dt className="text-muted">Defense</dt>
                  <dd className="text-paper">
                    {dc?.name ?? "—"} <span className="text-muted">· {t.defScheme}</span>
                  </dd>
                  <dt className="text-muted">Payroll</dt>
                  <dd className="text-paper">
                    {formatMoney(payroll, year)}
                    {cap ? <span className="text-muted"> of {formatMoney(cap, year)} cap</span> : null}
                  </dd>
                  <dt className="text-muted">Points</dt>
                  <dd className="text-paper">
                    {t.pf} for, {t.pa} against
                  </dd>
                </dl>
              </section>
              <section className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs tracking-[0.25em] text-muted">{year} leaders</p>
                {leaders.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {leaders.map((l) => (
                      <li key={l.label} className="flex items-center justify-between gap-2">
                        <span className="w-24 shrink-0 text-muted">{l.label}</span>
                        <PlayerLink player={l.p} className="min-h-0 flex-1 truncate text-white" />
                        <span className="tabular text-paper">{l.v}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No games played yet this season.</p>
                )}
              </section>
              <section className="rounded-lg border border-line bg-surface p-3 md:col-span-2">
                <p className="text-xs tracking-[0.25em] text-muted">Starting lineup</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  {starters.map((g) => (
                    <div key={g.label}>
                      <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">{g.label}</p>
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {g.rows
                          .filter((r) => r.players[0])
                          .map((r) => (
                            <li key={r.pos} className="flex items-center gap-2">
                              <span className="w-9 shrink-0 text-xs text-muted">{r.pos}</span>
                              <PlayerLink player={r.players[0]!} className="min-h-0 truncate text-paper" />
                              <span className="tabular ml-auto text-xs text-subtle">{visibleOvr(r.players[0]!)}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
              {(nums.length > 0 || ring.length > 0 || titles.length > 0) && (
                <section className="rounded-lg border border-brass/30 bg-surface p-3 md:col-span-2">
                  <p className="text-xs tracking-[0.25em] text-brass">Legacy</p>
                  {titles.length > 0 && <p className="mt-1 text-sm text-paper">Super Bowl titles: {titles.map((b) => b.year).join(", ")}</p>}
                  {nums.length > 0 && (
                    <p className="mt-1 text-sm text-paper">
                      Retired numbers:{" "}
                      {nums.map((r, i) => (
                        <span key={r.n}>
                          {i ? ", " : ""}
                          <button type="button" className="hover:text-brass" onClick={() => openProfile(r.playerId)}>
                            #{r.n} {save.players[r.playerId] ? playerName(save.players[r.playerId]!) : ""}
                          </button>
                        </span>
                      ))}
                    </p>
                  )}
                  {ring.length > 0 && (
                    <p className="mt-1 text-sm text-paper">
                      Ring of Honor:{" "}
                      {ring.map((r, i) => (
                        <span key={r.playerId}>
                          {i ? ", " : ""}
                          <button type="button" className="hover:text-brass" onClick={() => openProfile(r.playerId)}>
                            {save.players[r.playerId] ? playerName(save.players[r.playerId]!) : ""}
                          </button>
                        </span>
                      ))}
                    </p>
                  )}
                </section>
              )}
            </div>
          )}

          {view === "roster" && (
            <div>
              <div className="flex flex-wrap gap-1 px-4 py-2">
                {["", ...positions].map((x) => (
                  <button key={x || "all"} type="button" onClick={() => setPos(x)} className={`bx-chip min-h-8 px-2 text-[11px] ${pos === x ? "bx-chip-on" : ""}`}>
                    {x || "All"}
                  </button>
                ))}
              </div>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs tracking-wider text-muted">
                  <tr>
                    <th className="sticky top-0 left-0 z-20 w-12 bg-surface-2 px-3 py-2 font-medium">#</th>
                    <th className="sticky top-0 left-12 z-20 bg-surface-2 px-3 py-2 font-medium">Player</th>
                    {["Pos", "Grade", "Age", "Contract", "Kit", "Status"].map((h) => (
                      <th key={h} className="sticky top-0 z-10 bg-surface-2 px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => openProfile(p.id)}>
                      <td className="sticky left-0 z-10 w-12 bg-bg tabular px-3 py-2 text-muted">{p.jersey}</td>
                      <td className="sticky left-12 z-10 bg-bg px-3 py-2">
                        <PlayerLink player={p} className="font-display text-base" />
                        <span className="block text-[11px] text-subtle">{p.college ?? ""}</span>
                      </td>
                      <td className="px-3 py-2">{p.pos}</td>
                      <td className="tabular px-3 py-2">{p.revealed ? p.ovr : `sc ${visibleOvr(p)}`}</td>
                      <td className="tabular px-3 py-2">{p.age}</td>
                      <td className="tabular px-3 py-2 text-muted">
                        {formatMoney(p.salary ?? 0, year)} · {p.contractYears ?? 0}y
                      </td>
                      <td className="px-3 py-2">
                        <KitChips player={p} compact />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.onIR ? <span className="text-brick">IR</span> : p.injuredWeeks > 0 ? <span className="text-brick">hurt · {p.injuredWeeks}w</span> : <span className="text-good">active</span>}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td className="px-3 py-4 text-muted" colSpan={8}>
                        No roster yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {view === "schedule" && (
            <ul className="divide-y divide-line p-2">
              {games.map((g) => {
                const home = g.homeId === id;
                const opp = (home ? g.awayId : g.homeId) as TeamId;
                const us = home ? g.homeScore : g.awayScore;
                const them = home ? g.awayScore : g.homeScore;
                const res = !g.played ? "" : us > them ? "W" : us < them ? "L" : "T";
                return (
                  <li key={g.id} className="flex items-center gap-3 px-2 py-2 text-sm">
                    <span className="w-20 shrink-0 text-xs text-muted">{g.phase === "regular" ? `Week ${g.week}` : g.round ?? "Playoffs"}</span>
                    <span className="w-6 text-xs text-subtle">{home ? "vs" : "at"}</span>
                    <Logo id={opp} size={22} year={year} />
                    <span className="flex-1 font-display text-xs font-bold uppercase italic text-white">{teamAbbr(opp)}</span>
                    {g.played ? (
                      <span className={`tabular ${res === "W" ? "text-good" : res === "L" ? "text-red" : "text-paper"}`}>
                        {res} {us}-{them}
                      </span>
                    ) : (
                      <span className="text-xs text-subtle">upcoming</span>
                    )}
                  </li>
                );
              })}
              {!games.length && <li className="px-2 py-4 text-sm text-muted">The schedule isn't out yet.</li>}
            </ul>
          )}
        </div>
      </article>
    </div>
  );
}
