import { claimWaiver, displayName, playerName, posLabel, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

/** A short, playable front-office window between Sunday's film and the next week. */
export function WaiverNight() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const desk = useGameStore((s) => s.desk);
  const candidates = save.waivers
    .map((wire) => ({ wire, player: save.players[wire.playerId] }))
    .filter((item) => item.player?.teamId === "fa")
    .sort((a, b) => (b.player?.ovr ?? 0) - (a.player?.ovr ?? 0));

  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
      <div className="relative space-y-6 px-5 py-7 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-xs tracking-[0.4em] text-brass">WEEK {save.week} · FRONT OFFICE</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Waiver wire</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Clubs have moved on from these players. Make a claim before the league processes the wire and the next Sunday arrives.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-black/40 px-4 py-3 text-right">
            <p className="font-display text-3xl tabular">{candidates.length}</p>
            <p className="text-[10px] tracking-[0.2em] text-muted">AVAILABLE CLAIMS</p>
          </div>
        </div>

        {candidates.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {candidates.map(({ wire, player: p }) => p && (
              <li key={p.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-line bg-black/45 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center">
                  <Logo id={wire.from as TeamId} year={save.year} size={38} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-xl"><PlayerLink player={p} className="inline min-h-0" /></p>
                  <p className="text-xs text-muted">{posLabel(p)} · Waived by {displayName(save.year, wire.from)}</p>
                  <p className="mt-1 text-xs text-muted">Age {p.age} · Grade {p.ovr} · {p.yearsPro} pro seasons</p>
                </div>
                <Btn
                  kind="primary"
                  className="min-h-10"
                  onClick={() => desk((s) => {
                    const result = claimWaiver(s, s.userTeamId, p.id);
                    return result.ok ? `Claim submitted for ${playerName(p)}.` : result.reason;
                  })}
                >
                  Claim player
                </Btn>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-line bg-black/35 px-5 py-8 text-center">
            <p className="font-display text-2xl">No players are waiting on waivers.</p>
            <p className="mt-1 text-sm text-muted">Your next opponent and weekly headlines are ready.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">Claims must fit your active roster and the era's payroll rules.</p>
          <Btn kind="primary" className="min-h-12 px-7 text-lg" onClick={() => step({})}>
            Run the wire and continue <span aria-hidden>▸</span>
          </Btn>
        </div>
      </div>
    </article>
  );
}
