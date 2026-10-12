/** All-time ranks on a player's page, and a side-by-side career comparison (lib/game/careerBook.ts). */
import { useMemo, useState } from "react";
import { playerName, teamAbbr, type Player, type TeamId } from "@/lib/game";
import { careerRanks, compareCandidates, comparePlayers } from "@/lib/game/careerBook";
import { signatureClub } from "@/lib/game/legacy";
import { useGameStore } from "@/lib/game-store";

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

/** "3rd all-time in rushing yards · 1st in Bears history". */
export function CareerRanks({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const club = signatureClub(p)?.teamId as TeamId | undefined;
  const ranks = useMemo(() => careerRanks(save, p, club), [save, p, club]);
  if (!ranks.length) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="All-time ranks">
      {ranks.map((r) => (
        <li key={r.stat} className="rounded-md border border-brass/40 bg-brass/10 px-2.5 py-1 text-xs">
          <span className="font-semibold text-brass">{ord(r.rank)} all-time</span> in {r.label}{" "}
          <span className="tabular text-muted">({r.value.toLocaleString()})</span>
          {r.clubRank && club ? <span className="text-subtle"> · {ord(r.clubRank)} in {teamAbbr(club)} history</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Pick another player and see the two careers side by side. */
export function CareerCompare({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const [q, setQ] = useState("");
  const [otherId, setOtherId] = useState<string | null>(null);
  const options = useMemo(() => compareCandidates(save, p, q), [save, p, q]);
  const other = otherId ? save.players[otherId] : undefined;
  const cmp = useMemo(() => (other ? comparePlayers(save, p, other) : undefined), [save, p, other]);
  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label="Compare careers">
      <p className="text-xs tracking-[0.25em] text-muted">COMPARE CAREERS</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search, or pick a ${p.pos} below`}
          aria-label="Search for a player to compare"
          className="min-h-10 w-full max-w-xs rounded-md border border-line bg-surface-2 px-3 text-sm text-fg"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.slice(0, 8).map((x) => (
          <button key={x.id} type="button" onClick={() => setOtherId(x.id)} className={`bx-chip min-h-8 px-2.5 text-[11px] ${otherId === x.id ? "bx-chip-on" : ""}`}>
            {playerName(x)} <span className="text-subtle">{x.pos}</span>
          </button>
        ))}
      </div>
      {other && cmp && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-left font-medium" />
                <th className="py-1 text-right font-medium text-white">{playerName(p)}</th>
                <th className="py-1 text-right font-medium text-white">{playerName(other)}</th>
              </tr>
            </thead>
            {cmp.sections.map((sec) => (
              <tbody key={sec.title}>
                <tr>
                  <th colSpan={3} className="pt-3 text-left text-[11px] tracking-[0.2em] text-brass">
                    {sec.title.toUpperCase()}
                  </th>
                </tr>
                {sec.rows.map((r) => (
                  <tr key={sec.title + r.label} className="border-t border-line">
                    <td className="py-1 text-muted">{r.label}</td>
                    <td className={`tabular py-1 text-right ${r.a > r.b ? "font-semibold text-good" : ""}`}>{r.a.toLocaleString()}</td>
                    <td className={`tabular py-1 text-right ${r.b > r.a ? "font-semibold text-good" : ""}`}>{r.b.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
          <p className="mt-2 text-[11px] text-subtle">Regular season and playoffs are kept separate. Totals include real careers before the dynasty began.</p>
        </div>
      )}
    </section>
  );
}
