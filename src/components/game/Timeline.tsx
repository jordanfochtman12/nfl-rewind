import { displayName, type TeamId, type TimelineEntry } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

const rec = (r?: { w: number; l: number; t: number }) => (r ? `${r.w}-${r.l}${r.t ? `-${r.t}` : ""}` : "—");

function Side({ label, champ, runner, score, year, tone }: { label: string; champ?: TeamId; runner?: TeamId; score?: string; year: number; tone: string }) {
  return (
    <div className="min-w-0 border border-white/10 bg-black/35 p-3">
      <p className={`font-display text-[11px] font-extrabold uppercase italic tracking-[0.2em] ${tone}`}>{label}</p>
      {champ ? (
        <div className="mt-1 flex items-center gap-3">
          <Logo id={champ} size={44} year={year} />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-extrabold uppercase italic leading-tight">{displayName(year, champ)}</p>
            <p className="text-sm text-muted">
              {score} over the {runner ? displayName(year, runner) : "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">Beyond the real record. This part of history is yours alone.</p>
      )}
    </div>
  );
}

/** One season: the real champion beside this league's, and where the timeline split. */
export function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const save = useGameStore((s) => s.save)!;
  const same = entry.realChamp === entry.simChamp;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Side label="Real history" champ={entry.realChamp} runner={entry.realRunnerUp} score={entry.realScore} year={entry.year} tone="text-muted" />
        <Side label={save.sandbox ? "This timeline" : "Your timeline"} champ={entry.simChamp} runner={entry.simRunnerUp} score={entry.simScore} year={entry.year} tone="text-brass" />
      </div>
      {!save.sandbox && <p className="text-sm">
        <span className="font-display font-bold uppercase italic text-white">{displayName(entry.year, save.userTeamId)}:</span>{" "}
        <span className="text-paper">
          {rec(entry.user.sim)} here{entry.user.simPlayoffs ? ", in the playoffs" : ""}
          {entry.user.real ? ` · ${rec(entry.user.real)} in real life${entry.user.realPlayoffs ? ", in the playoffs" : ""}` : ""}.
        </span>
      </p>}
      {entry.notes.length > 0 && (
        <ul className="space-y-1.5">
          {entry.notes.map((n) => (
            <li key={n} className={`border-l-2 pl-3 text-sm ${same && n.startsWith("History held") ? "border-good" : "border-brass"} text-paper`}>
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The History tab's season-by-season split with real history. */
export function TimelineSection() {
  const save = useGameStore((s) => s.save)!;
  const list = (save.history.timeline ?? []).slice().reverse();
  const splits = list.filter((e) => e.realChamp && e.realChamp !== e.simChamp).length;
  return (
    <section>
      <h3 className="mb-1 text-sm tracking-[0.2em] text-muted">Real history vs. your timeline</h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Finish a season and the almanac starts comparing your league to the real one.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {splits} of {list.filter((e) => e.realChamp).length} seasons crowned a different champion than real history.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2">Year</th>
                  <th className="px-2 py-2">Real champion</th>
                  <th className="px-2 py-2">Your league</th>
                  <th className="px-2 py-2">{displayName(save.year, save.userTeamId)} (real)</th>
                  <th className="px-2 py-2">Where it split</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.year} className="border-t border-white/5 align-top">
                    <td className="tabular px-2 py-2">{e.year}</td>
                    <td className="px-2 py-2">
                      {e.realChamp ? (
                        <span className="flex items-center gap-2">
                          <Logo id={e.realChamp} size={20} year={e.year} /> {displayName(e.year, e.realChamp)}
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`flex items-center gap-2 ${e.realChamp && e.realChamp !== e.simChamp ? "text-brass" : ""}`}>
                        <Logo id={e.simChamp} size={20} year={e.year} /> {displayName(e.year, e.simChamp)}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2">
                      {rec(e.user.sim)} <span className="text-muted">({rec(e.user.real)})</span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted">{e.notes.find((n) => !n.startsWith("History held") && !n.includes("fell short")) ?? e.notes.find((n) => !n.startsWith("History held")) ?? "History held."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
