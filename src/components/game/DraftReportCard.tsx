/** Draft classes revisited: the re-draft, the steals and busts, and every club's grade. */
import { useMemo, useState } from "react";
import { displayName, draftClassReport, gradableClasses, teamAbbr, type ClassPick } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

function PickLine({ x, year, note }: { x: ClassPick; year: number; note?: string }) {
  const openProfile = useGameStore((s) => s.openProfile);
  return (
    <li className="flex items-center gap-2 border-b border-line py-1.5 text-sm last:border-0">
      <Logo id={x.teamId} size={22} year={year} />
      <button type="button" className="min-h-8 truncate text-left text-paper hover:text-brass" onClick={() => openProfile(x.playerId)}>
        {x.name}
      </button>
      <span className="text-xs text-muted">{x.pos}</span>
      <span className="ml-auto shrink-0 text-xs tabular text-muted">{note}</span>
    </li>
  );
}

export function DraftReportCard() {
  const save = useGameStore((s) => s.save)!;
  const classes = useMemo(() => gradableClasses(save), [save]);
  const [year, setYear] = useState<number | undefined>(undefined);
  const pick = year ?? classes[0];
  const r = useMemo(() => (pick ? draftClassReport(save, pick) : undefined), [save, pick]);
  if (!classes.length) return null;
  return (
    <section className="space-y-4 rounded-xl border border-line bg-surface p-4" aria-label="Draft classes revisited">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs tracking-[0.25em] text-muted">DRAFT CLASSES REVISITED</p>
          {r && <p className="mt-1 text-sm text-paper">The {r.year} class, {r.seasons} seasons in, re-drafted by what each pick became.</p>}
        </div>
        <label className="text-xs text-muted">
          Class{" "}
          <select aria-label="Draft class" className="ml-1 min-h-10 rounded-md border border-line bg-surface-2 px-2 text-sm text-fg" value={pick} onChange={(e) => setYear(Number(e.target.value))}>
            {classes.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      {r && (
        <div className="grid gap-4 lg:grid-cols-3">
          <article>
            <h4 className="mb-1 text-xs tracking-[0.2em] text-brass">THE RE-DRAFT</h4>
            <ol>
              {r.redraft.slice(0, 10).map((x, i) => (
                <PickLine key={x.playerId} x={x} year={r.year} note={`${i + 1}. was No. ${x.pick}${x.proBowls ? ` · ${x.proBowls} PB` : ""}`} />
              ))}
            </ol>
          </article>
          <div className="space-y-4">
            <article>
              <h4 className="mb-1 text-xs tracking-[0.2em] text-brass">STEALS</h4>
              {r.steals.length ? (
                <ul>
                  {r.steals.map((x) => (
                    <PickLine key={x.playerId} x={x} year={r.year} note={`No. ${x.pick} → re-draft ${x.reRank}`} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No late-round stars in this class.</p>
              )}
            </article>
            <article>
              <h4 className="mb-1 text-xs tracking-[0.2em] text-brass">BUSTS</h4>
              {r.busts.length ? (
                <ul>
                  {r.busts.map((x) => (
                    <PickLine key={x.playerId} x={x} year={r.year} note={`No. ${x.pick} → re-draft ${x.reRank}`} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Every early pick has held up.</p>
              )}
            </article>
          </div>
          <article>
            <h4 className="mb-1 text-xs tracking-[0.2em] text-brass">CLUB GRADES</h4>
            <ul className="grid grid-cols-2 gap-x-3 text-sm">
              {r.teams.map((t) => (
                <li key={t.teamId} className={`flex items-center gap-1.5 py-1 ${t.teamId === save.userTeamId && !save.sandbox ? "text-brass" : ""}`} title={t.best ? `Best pick: ${t.best.name}` : undefined}>
                  <Logo id={t.teamId} size={18} year={r.year} />
                  <span className="truncate">{teamAbbr(t.teamId)}</span>
                  <span className="ml-auto font-display text-base">{t.grade}</span>
                </li>
              ))}
            </ul>
            {r.teams[0] && (
              <p className="mt-2 text-xs text-muted">
                Best haul: {displayName(r.year, r.teams[0].teamId)}
                {r.teams[0].best ? `, led by ${r.teams[0].best.name}` : ""}.
              </p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
