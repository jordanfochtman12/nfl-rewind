import { displayName, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

export function PrimetimeShow() {
  const save = useGameStore((s) => s.save)!;
  const show = save.primetime;
  if (!show || show.year !== save.year) {
    return (
      <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <p className="font-display text-xs tracking-[0.35em] text-brass">PRIMETIME</p>
        <h2 className="text-2xl">The studio is dark</h2>
        <p className="max-w-xl text-muted">
          Sim a Sunday. Scores hit the board, packages roll, and the play of the night freezes the frame. This is the week-in-review — every game, one show.
        </p>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-xl border border-brass/35 bg-studio">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-brass/25 px-5 py-4">
        <div>
          <p className="font-display text-xs tracking-[0.4em] text-brass">NFL · THE WEEK IN REVIEW</p>
          <h2 className="font-display text-4xl tracking-[0.12em] text-brass">PRIMETIME</h2>
        </div>
        <p className="text-sm tracking-[0.25em] text-brass">
          {show.year} · WEEK {String(show.week).padStart(2, "0")}
        </p>
      </header>
      <p className="border-b border-brass/15 px-5 py-3 text-sm text-paper">{show.open}</p>
      <div className="flex gap-6 overflow-x-auto border-b border-brass/15 px-5 py-3">
        {show.recaps.map((r) => (
          <div key={`${r.awayId}-${r.homeId}`} className="flex shrink-0 items-center gap-2 text-sm">
            <Logo id={r.awayId} size={22} />
            <span className="tabular">{r.awayScore}</span>
            <span className="text-subtle">@</span>
            <span className="tabular">{r.homeScore}</span>
            <Logo id={r.homeId} size={22} />
          </div>
        ))}
      </div>
      <ol className="space-y-0 divide-y divide-brass/15">
        {show.recaps.slice(0, 8).map((r, i) => (
          <li key={`${r.homeId}-${r.awayId}-pkg`} className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-2">
              <span className="w-6 font-display text-brass">{String(i + 1).padStart(2, "0")}</span>
              <Logo id={r.awayId} size={36} />
              <span className="tabular text-2xl">{r.awayScore}</span>
              <span className="text-subtle">@</span>
              <span className="tabular text-2xl">{r.homeScore}</span>
              <Logo id={r.homeId} size={36} />
            </div>
            <div>
              <p className="font-display text-lg leading-tight">{r.line}</p>
              <p className="mt-1 text-sm text-muted">{r.note}</p>
              <p className="text-xs text-subtle">
                {displayName(save.year, r.awayId as TeamId)} at {displayName(save.year, r.homeId as TeamId)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="space-y-2 border-t border-brass/25 bg-black/40 px-5 py-5">
        <p className="text-xs tracking-[0.3em] text-brass">PLAY OF THE NIGHT</p>
        <p className="font-display text-2xl leading-snug text-paper sm:text-3xl">{show.playOfNight}</p>
        <p className="text-sm text-muted">{show.pow}</p>
        <p className="pt-2 text-sm italic text-brass">{show.close}</p>
      </div>
    </section>
  );
}
