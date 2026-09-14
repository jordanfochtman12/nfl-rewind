import {
  ROSTER_TARGET,
  campBubble,
  cutPlayer,
  deskHoles,
  displayName,
  playerName,
  rosterOf,
  visibleOvr,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { KitChips } from "./KitChips";

export function CampNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const step = useGameStore((s) => s.step);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const camp = save.camp;
  const roster = rosterOf(save, save.userTeamId);
  const n = roster.length;
  const holes = deskHoles(save, save.userTeamId);
  const bubble = campBubble(save, save.userTeamId);
  const oursHurt = (camp?.injuries ?? []).filter((x) => x.teamId === save.userTeamId);
  const fat = n > ROSTER_TARGET;
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="office" veil="full" />
        <div className="relative space-y-4 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} TRAINING CAMP</p>
          <h2 className="font-display text-4xl sm:text-5xl">Cut-down week</h2>
          <p className="max-w-xl text-paper">
            {fat
              ? `You are carrying ${n}. The club is ${ROSTER_TARGET}. September does not wait on a maybe.`
              : `Roster ${n}. The CPU already trimmed its own camps. Yours stays a hole if you cut and do not sign.`}
          </p>
          <p className="text-sm text-muted">
            {displayName(save.year, save.userTeamId)} · {holes.length ? `${holes.length} hole${holes.length === 1 ? "" : "s"}` : "depth covered"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" onClick={() => step({})}>
              Kick off the regular season
            </Btn>
          </div>
          {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}
        </div>
      </section>

      {camp?.battles && camp.battles.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">CAMP BATTLES</p>
          <ul className="mt-3 space-y-3">
            {camp.battles.map((b) => (
              <li key={b.pos} className="rounded-lg border border-line bg-bg/40 px-3 py-3">
                <p className="text-xs tracking-[0.2em] text-brass">{b.pos}</p>
                <p className="mt-1 text-sm text-paper">{b.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {oursHurt.length > 0 && (
        <section className="rounded-xl border border-brick/40 bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">TRAINING ROOM</p>
          <ul className="mt-2 space-y-1 text-sm">
            {oursHurt.map((x) => {
              const p = save.players[x.playerId];
              return (
                <li key={x.playerId} className="flex justify-between gap-3">
                  <span>
                    {p ? <PlayerLink player={p} className="inline min-h-0" /> : x.playerId}{" "}
                    <span className="text-muted">{p?.pos}</span>
                  </span>
                  <span className="tabular text-brick">
                    {x.name} · {x.weeks}w
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">BUBBLE</p>
        <p className="mt-1 text-sm text-muted">The names at the bottom. Cut them here or carry them into Week 1.</p>
        <ul className="mt-3 divide-y divide-line">
          {bubble.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <PlayerLink player={p} className="font-display text-base" />
                <p className="text-sm text-muted">
                  {p.pos} · scout {visibleOvr(p)} · {p.age} yrs
                </p>
                <KitChips player={p} compact />
              </div>
              <Btn
                kind="brick"
                className="min-h-9 px-3 text-xs"
                onClick={() =>
                  desk((s) => {
                    const r = cutPlayer(s, s.userTeamId, p.id);
                    return r.ok ? `Cut ${playerName(p)}.` : r.reason;
                  })
                }
              >
                Cut
              </Btn>
            </li>
          ))}
        </ul>
      </section>

      {(camp?.cuts ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">AROUND THE LEAGUE</p>
          <ul className="mt-2 space-y-1 text-sm">
            {camp!.cuts.slice(0, 12).map((c) => {
              const p = save.players[c.playerId];
              return (
                <li key={`${c.teamId}-${c.playerId}`}>
                  {displayName(save.year, c.teamId)} cut {p ? <PlayerLink player={p} className="inline min-h-0" /> : c.playerId}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
