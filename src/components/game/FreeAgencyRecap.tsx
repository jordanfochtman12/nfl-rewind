import { useState } from "react";
import { clubInk, displayName, faHeadlines, faRecap, formatMoney, nicknameOf, teamAbbr, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

const gradeTone = (g: string) => (g.startsWith("A") ? "text-good" : g.startsWith("B") ? "text-paper" : g.startsWith("C") ? "text-muted" : "text-brick");

/** The winter in review: the big signings, every club's grade, who won and who lost. */
export function FreeAgencyRecap({ year, compact = false }: { year?: number; compact?: boolean }) {
  const save = useGameStore((s) => s.save)!;
  const filed = Object.keys(save.faRecaps ?? {}).map(Number).sort((a, b) => b - a);
  const [pick, setPick] = useState<number>(year ?? (save.phase === "freeAgency" ? save.year : filed[0] ?? save.year));
  const r = faRecap(save, pick);
  const years = [...new Set([...(save.phase === "freeAgency" ? [save.year] : []), ...filed])];
  if (!r) return null;
  const heads = faHeadlines(save, r);
  // Watching history there's no club of your own to grade.
  const mine = save.sandbox ? undefined : r.teams.find((t) => t.teamId === save.userTeamId);
  const top = r.signings.slice(0, compact ? 6 : 12);
  // Only clubs that actually moved make the lists: a winter nobody signed has no winners.
  const winners = r.teams.filter((t) => t.score > 0).slice(0, 3);
  const losers = r.teams.filter((t) => t.score < 0).slice(-3).reverse();
  return (
    <section className="overflow-hidden rounded-xl border border-brass/30 bg-surface" aria-labelledby="fa-recap-title">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-gradient-to-r from-brass/15 to-transparent px-4 py-4">
        <div>
          <p className="font-display text-xs tracking-[0.4em] text-brass">{r.final ? "FREE AGENCY RECAP" : "FREE AGENCY · SO FAR"}</p>
          <h3 id="fa-recap-title" className="font-display text-3xl">
            The {r.year} market
          </h3>
          <p className="text-sm text-muted">
            {r.signings.length} signing{r.signings.length === 1 ? "" : "s"} tracked{r.final ? "" : " · live until the market closes"}
          </p>
        </div>
        {years.length > 1 && (
          <label className="text-sm text-muted">
            Winter{" "}
            <select className="ml-1 rounded-md border border-line bg-studio px-2 py-1 text-paper" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className="space-y-5 p-4">
        <ul className="space-y-1.5 text-[15px] text-paper">
          {heads.map((h) => (
            <li key={h} className="border-l-2 border-brass/60 pl-3">
              {h}
            </li>
          ))}
        </ul>

        {mine && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-studio p-3">
            <Logo id={mine.teamId} year={r.year} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-[0.25em] text-muted">YOUR WINTER</p>
              <p className="font-display text-lg">{displayName(r.year, mine.teamId)}</p>
              <p className="text-sm text-muted">
                Added {mine.added}
                {mine.bestAdd ? ` (best: ${mine.bestAdd})` : ""} · lost {mine.lost}
                {mine.bestLoss ? ` (${mine.bestLoss})` : ""}
                {mine.spent ? ` · ${formatMoney(mine.spent, r.year)} a year committed` : ""}
              </p>
            </div>
            <p className={`font-display text-5xl ${gradeTone(mine.grade)}`} aria-label={`Grade ${mine.grade}`}>
              {mine.grade}
            </p>
          </div>
        )}

        {top.length > 0 && (
          <div>
            <p className="mb-2 text-xs tracking-[0.25em] text-muted">BIGGEST SIGNINGS</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs tracking-wider text-muted">
                  <tr>
                    <th className="py-1 pr-2 font-normal">#</th>
                    <th className="py-1 pr-2 font-normal">Player</th>
                    <th className="py-1 pr-2 font-normal">Move</th>
                    <th className="py-1 pr-2 text-right font-normal">OVR</th>
                    <th className="py-1 text-right font-normal">Contract</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {top.map((s, i) => {
                    const p = save.players[s.playerId];
                    return (
                      <tr key={s.playerId}>
                        <td className="tabular py-2 pr-2 text-muted">{i + 1}</td>
                        <td className="py-2 pr-2">
                          {p ? <PlayerLink player={p} className="inline min-h-0 font-display text-base" /> : s.name}{" "}
                          <span className="text-muted">
                            {s.pos} · {s.age}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            {s.from ? <Logo id={s.from} year={r.year} size={20} /> : <span className="text-xs text-muted">FA</span>}
                            <span aria-hidden>→</span>
                            <Logo id={s.to} year={r.year} size={20} />
                            <span className="sr-only">
                              {s.from ? `from the ${nicknameOf(r.year, s.from)} ` : ""}to the {nicknameOf(r.year, s.to)}
                            </span>
                            <span className="text-muted" aria-hidden>
                              {teamAbbr(s.to)}
                            </span>
                          </span>
                        </td>
                        <td className="tabular py-2 pr-2 text-right">{s.ovr}</td>
                        <td className="tabular py-2 text-right text-muted">
                          {formatMoney(s.salary, r.year)} × {s.years}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(winners.length > 0 || losers.length > 0) && <div className="grid gap-3 sm:grid-cols-2">
          {([["WINNERS", winners], ["LOSERS", losers]] as const).filter(([, list]) => list.length > 0).map(([label, list]) => (
            <div key={label} className="min-w-0 rounded-lg border border-line p-3">
              <p className="text-xs tracking-[0.25em] text-muted">{label}</p>
              <ul className="mt-2 space-y-2">
                {list.map((t) => (
                  <li key={t.teamId} className="flex items-center gap-3">
                    <Logo id={t.teamId} year={r.year} size={30} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-display text-base">{nicknameOf(r.year, t.teamId)}</p>
                      <p className="truncate text-muted">
                        +{t.added} / −{t.lost}
                        {label === "WINNERS" ? (t.bestAdd ? ` · ${t.bestAdd}` : "") : t.bestLoss ? ` · lost ${t.bestLoss}` : ""}
                      </p>
                    </div>
                    <span className={`font-display text-2xl ${gradeTone(t.grade)}`}>{t.grade}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>}

        {!compact && (
          <div>
            <p className="mb-2 text-xs tracking-[0.25em] text-muted">EVERY CLUB'S GRADE</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {r.teams.map((t) => (
                <li
                  key={t.teamId}
                  className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5"
                  style={{ boxShadow: `inset 3px 0 0 ${clubInk(t.teamId as TeamId, r.year).primary}` }}
                >
                  <Logo id={t.teamId} year={r.year} size={22} />
                  <span className="flex-1 text-sm">{teamAbbr(t.teamId)}</span>
                  <span className={`font-display text-lg ${gradeTone(t.grade)}`}>{t.grade}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.unsigned.length > 0 && (
          <p className="text-sm text-muted">
            <span className="tracking-[0.2em]">STILL UNSIGNED · </span>
            {r.unsigned.map((u, i) => {
              const p = save.players[u.playerId];
              return (
                <span key={u.playerId}>
                  {i ? ", " : ""}
                  {p ? <PlayerLink player={p} className="inline min-h-0" /> : u.name} ({u.pos} {u.ovr})
                </span>
              );
            })}
          </p>
        )}
      </div>
    </section>
  );
}
