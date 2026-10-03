import { displayName, gradeDynasty, type SeasonChapter } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";
import { GradeCard } from "./GradeCard";

function Chapter({ ch }: { ch: SeasonChapter }) {
  const save = useGameStore((s) => s.save)!;
  const rec = `${ch.wins}-${ch.losses}${ch.ties ? `-${ch.ties}` : ""}`;
  const ring = /Won Super Bowl/i.test(ch.result);
  return (
    <article className={`rounded-xl border p-4 ${ring ? "border-brass/50 bg-brass/10" : "border-line bg-surface"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo id={ch.teamId} size={40} year={ch.year} />
          <div>
            <p className="font-display text-2xl">
              {ch.year}{" "}
              <span className="tabular text-brass">{rec}</span>
            </p>
            <p className="text-sm text-muted">
              {ch.result}
              {ch.coach ? ` · ${ch.coach}` : ""}
            </p>
          </div>
        </div>
        <p className="tabular text-xs text-subtle">
          {ch.pf}–{ch.pa}
        </p>
      </div>
      {ch.honors.length > 0 && (
        <p className="mt-3 text-sm text-brass">{ch.honors.join(" · ")}</p>
      )}
      {ch.drafted.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {ch.drafted.slice(0, 8).map((d) => {
            const p = save.players[d.playerId];
            return (
              <li key={d.playerId} className="rounded-md border border-line px-2 py-1 text-xs">
                {p ? <PlayerLink player={p} className="inline min-h-0 text-xs" /> : d.name}{" "}
                <span className="text-muted">
                  {d.pos}
                  {d.round ? ` · Rd ${d.round}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

export function FranchiseBook() {
  const save = useGameStore((s) => s.save)!;
  const grade = gradeDynasty(save);
  const chapters = (save.history.seasons ?? []).filter((c) => c.teamId === save.userTeamId).slice().reverse();
  const honor = save.history.teamOfHonor[save.userTeamId] ?? [];
  return (
    <div className="space-y-8">
      {grade.seasons > 0 && <GradeCard grade={grade} />}
      <section>
        <p className="text-xs tracking-[0.3em] text-brass">THE BOOK</p>
        <h3 className="mt-1 font-display text-3xl">
          {displayName(save.year, save.userTeamId)} {save.startingYear}–{save.year}
        </h3>
        {chapters.length === 0 && (
          <p className="mt-3 text-muted">Play a Sunday. The chapter is written after the Super Bowl.</p>
        )}
        <div className="mt-4 space-y-3">
          {chapters.map((ch) => (
            <Chapter key={ch.year} ch={ch} />
          ))}
        </div>
      </section>
      {honor.length > 0 && (
        <section>
          <p className="text-xs tracking-[0.3em] text-brass">TEAM OF HONOR</p>
          <ul className="mt-2 space-y-1 text-sm">
            {honor.map((id) => {
              const p = save.players[id];
              const c = save.coaches[id];
              return (
                <li key={id}>
                  {p ? <PlayerLink player={p} className="inline min-h-0" /> : c ? <span>{c.name} <span className="text-muted">· coach</span></span> : id}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
