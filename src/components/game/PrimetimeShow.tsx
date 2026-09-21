import { displayName, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { FilmStill } from "./Art";

export function PrimetimeShow() {
  const save = useGameStore((s) => s.save)!;
  const show = save.primetime;
  if (!show || show.year !== save.year) {
    return (
      <section className="relative overflow-hidden rounded-xl border border-brass/25 bg-studio p-6">
        <FilmStill still="primetime" veil="full" />
        <div className="relative">
        <p className="font-display text-xs tracking-[0.4em] text-brass">NFL · THE WEEK IN REVIEW</p>
        <h2 className="mt-2 font-display text-4xl tracking-[0.14em] text-brass">PRIMETIME</h2>
        <p className="mt-3 max-w-xl text-muted">
          Sim a Sunday. The crawl lights up, packages roll, and one play freezes the frame. Every score. One show.
        </p>
        </div>
      </section>
    );
  }
  const feature = show.recaps[0];
  return (
    <section className="relative overflow-hidden rounded-xl border border-brass/35 bg-studio">
      <FilmStill still="primetime" veil="full" />
      <header className="relative overflow-hidden border-b border-brass/25 px-5 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(196,165,116,0.12),transparent_55%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-[11px] tracking-[0.45em] text-brass">HELLO EVERYBODY · WELCOME TO</p>
            <h2 className="font-display text-5xl tracking-[0.14em] text-brass sm:text-6xl">PRIMETIME</h2>
          </div>
          <p className="font-display text-sm tracking-[0.3em] text-brass">
            {show.year} · WEEK {String(show.week).padStart(2, "0")}
          </p>
        </div>
      </header>

      <p className="border-b border-brass/15 px-5 py-3 text-sm leading-relaxed text-paper">{show.open}</p>

      <div className="overflow-hidden border-b border-brass/20 bg-black/50 py-2.5">
        <div className="ticker flex w-max gap-6 px-5">
        {show.recaps.concat(show.recaps).map((r, i) => (
          <div key={`${r.awayId}-${r.homeId}-tick-${i}`} className="flex shrink-0 items-center gap-2 text-xs tracking-wide">
            <Logo id={r.awayId} size={18} />
            <span className="tabular text-paper">{r.awayScore}</span>
            <span className="text-subtle">@</span>
            <span className="tabular text-paper">{r.homeScore}</span>
            <Logo id={r.homeId} size={18} />
          </div>
        ))}
        </div>
      </div>

      {feature && (
        <div className="grid gap-4 border-b border-brass/20 px-5 py-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-3">
            <Logo id={feature.awayId} size={56} />
            <span className="tabular font-display text-5xl">{feature.awayScore}</span>
            <span className="px-2 text-brass">@</span>
            <span className="tabular font-display text-5xl">{feature.homeScore}</span>
            <Logo id={feature.homeId} size={56} />
          </div>
          <div>
            <p className="text-[11px] tracking-[0.35em] text-brass">SEGMENT 1 · FEATURED PACKAGE</p>
            <p className="mt-1 font-display text-2xl leading-tight text-paper">{feature.line}</p>
            <p className="mt-2 text-sm text-muted">{feature.note}</p>
          </div>
        </div>
      )}

      <p className="border-b border-brass/15 bg-black/30 px-5 py-2 text-[11px] tracking-[0.4em] text-brass">
        SEGMENT 2 · AROUND THE LEAGUE
      </p>
      <ol>
        {show.recaps.slice(1, 8).map((r, i) => (
          <li key={`${r.homeId}-${r.awayId}-pkg`} className="grid gap-3 border-t border-brass/10 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <div className="flex items-center gap-2">
              <span className="w-6 font-display text-brass">{String(i + 2).padStart(2, "0")}</span>
              <Logo id={r.awayId} size={28} />
              <span className="tabular text-lg">{r.awayScore}</span>
              <span className="text-subtle">–</span>
              <span className="tabular text-lg">{r.homeScore}</span>
              <Logo id={r.homeId} size={28} />
            </div>
            <div>
              <p className="font-display text-lg leading-snug">{r.line}</p>
              <p className="mt-1 text-sm text-muted">{r.note}</p>
              <p className="text-xs text-subtle">
                {displayName(save.year, r.awayId as TeamId)} at {displayName(save.year, r.homeId as TeamId)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {(show.powerPoll || show.wire?.length) && (
        <div className="grid gap-6 border-t border-brass/20 bg-black/35 px-5 py-6 sm:grid-cols-2">
          {show.powerPoll && (
            <div>
              <p className="text-[11px] tracking-[0.35em] text-brass">SEGMENT 3 · POWER POLL</p>
              <p className="mt-2 text-sm leading-relaxed text-paper">{show.powerPoll}</p>
            </div>
          )}
          {!!show.wire?.length && (
            <div>
              <p className="text-[11px] tracking-[0.35em] text-brass">SEGMENT 4 · ON THE WIRE</p>
              <ul className="mt-2 space-y-1.5 text-sm text-paper">
                {show.wire.map((w, i) => (
                  <li key={`${i}-${w}`}>— {w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-brass/30 bg-black/55 px-5 py-6">
        <p className="text-[11px] tracking-[0.4em] text-brass">FINAL SEGMENT · PLAY OF THE NIGHT · FREEZE FRAME</p>
        <p className="font-display text-3xl leading-snug text-paper sm:text-4xl">{show.playOfNight}</p>
        <p className="text-sm text-muted">{show.pow}</p>
        <p className="pt-3 font-display text-sm tracking-[0.08em] text-brass">{show.close}</p>
      </div>
    </section>
  );
}
