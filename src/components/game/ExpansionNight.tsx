import {
  displayName,
  expansionForYear,
  expansionOnClock,
  playerName,
  remainingExposed,
  rosterOf,
  userExpansionPick,
  visibleOvr,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";

function sourceOf(exposed: Record<string, string[]>, playerId: string): TeamId | undefined {
  for (const [id, ids] of Object.entries(exposed)) {
    if (ids.includes(playerId)) return id as TeamId;
  }
  return undefined;
}

export function ExpansionNight() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const desk = useGameStore((s) => s.desk);
  const exp = save.expansion;
  const spec = expansionForYear(save.year);
  if (!exp || !spec) return null;

  const onClock = expansionOnClock(save);
  const userPicking = !exp.done && onClock === save.userTeamId;
  const capTotal = exp.pickCap * Math.max(1, exp.newTeamIds.length);
  const open = remainingExposed(save);
  const relocate = spec.kind === "relocate";

  const pick = (playerId: string) => {
    desk((s) => {
      userExpansionPick(s, playerId);
    });
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="helmet" veil="full" />
        <div className="relative space-y-4 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">
            {relocate ? "RELOCATION" : "EXPANSION DRAFT"}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl">{spec.title}</h2>
          <p className="max-w-2xl text-paper">
            {relocate
              ? "The Cleveland name, colors, and history stay on the lake. Baltimore takes the field as a new club."
              : "Existing clubs freeze three. The rest of the list is exposed. The new franchise stocks a roster by taking living veterans — not generated bodies."}
          </p>
          <div className="flex flex-wrap gap-4">
            {spec.clubs.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-brass/30 bg-black/55 px-3 py-2"
              >
                <Logo id={c.id} size={48} year={save.year} />
                <div>
                  <p className="font-display text-lg">{displayName(save.year, c.id)}</p>
                  <p className="text-xs text-muted">Coach {c.coachName}</p>
                </div>
              </div>
            ))}
          </div>
          {!relocate && (
            <p className="text-sm text-muted">
              Pick cap {exp.pickCap} per club · {exp.picksMade.length} of {capTotal} taken
              {onClock ? ` · on the clock: ${displayName(save.year, onClock)}` : exp.done ? " · lists closed" : ""}
            </p>
          )}
        </div>
      </section>

      {userPicking && (
        <section className="rounded-xl border border-accent/40 bg-accent/15 px-4 py-4">
          <p className="text-[11px] tracking-[0.35em] text-brass">YOUR ALLOCATION TABLE</p>
          <p className="mt-1 font-display text-2xl">You stock this club. Take a veteran off an exposed list.</p>
        </section>
      )}

      {!relocate && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs tracking-[0.25em] text-muted">EXPOSED</p>
            <div className="mt-3 max-h-[28rem] space-y-4 overflow-y-auto">
              {Object.entries(exp.exposed).map(([tid, ids]) => {
                const teamId = tid as TeamId;
                const rows = ids
                  .map((id) => save.players[id])
                  .filter((p): p is NonNullable<typeof p> => !!p);
                if (!rows.length) return null;
                return (
                  <div key={tid}>
                    <p className="mb-1 text-xs tracking-widest text-brass">{displayName(save.year, teamId)}</p>
                    <ul className="space-y-1 text-sm">
                      {rows.map((p) => {
                        const taken = exp.picksMade.includes(p.id);
                        const canTake = userPicking && open.includes(p.id);
                        return (
                          <li
                            key={p.id}
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${
                              taken ? "bg-surface-2 text-subtle line-through" : "hover:bg-surface-2"
                            }`}
                          >
                            <span>
                              <PlayerLink player={p} className="inline min-h-0" />{" "}
                              <span className="text-muted">
                                {p.pos} · {visibleOvr(p)}
                              </span>
                            </span>
                            {canTake ? (
                              <Btn kind="primary" className="min-h-9 px-3 text-xs" onClick={() => pick(p.id)}>
                                Take
                              </Btn>
                            ) : taken ? (
                              <span className="text-[11px] tracking-widest text-brass">TAKEN</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            {exp.newTeamIds.map((id) => {
              const club = rosterOf(save, id).slice().sort((a, b) => b.ovr - a.ovr);
              return (
                <article key={id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <Logo id={id} size={36} year={save.year} />
                    <div>
                      <p className="text-xs tracking-[0.25em] text-muted">BUILDING ROSTER</p>
                      <p className="font-display text-lg">{displayName(save.year, id)}</p>
                    </div>
                    <p className="ml-auto tabular text-sm text-muted">{club.length}</p>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {club.slice(0, 18).map((p) => {
                      const from = sourceOf(exp.exposed, p.id);
                      return (
                        <li key={p.id} className="flex justify-between gap-2">
                          <span>
                            <PlayerLink player={p} className="inline min-h-0" />{" "}
                            <span className="text-muted">{p.pos}</span>
                          </span>
                          <span className="text-subtle">
                            {from ? displayName(save.year, from) : p.historical ? "leftover" : "UDFA"}
                          </span>
                        </li>
                      );
                    })}
                    {!club.length && <li className="text-muted">Empty table. The first pick is still in the air.</li>}
                  </ul>
                </article>
              );
            })}
          </section>
        </div>
      )}

      {relocate && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">BALTIMORE TAKES THE ROSTER</p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {rosterOf(save, "rav")
              .slice(0, 16)
              .map((p) => (
                <li key={p.id} className="text-sm">
                  <PlayerLink player={p} className="inline min-h-0" />{" "}
                  <span className="text-muted">{p.pos}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {exp.done && !relocate && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">MOVED THIS WEEK</p>
          <ol className="mt-2 columns-1 gap-x-6 text-sm sm:columns-2">
            {exp.picksMade.slice(0, 24).map((id, i) => {
              const p = save.players[id];
              const from = sourceOf(exp.exposed, id);
              return (
                <li key={id} className="mb-1 break-inside-avoid">
                  {i + 1}. {p ? playerName(p) : id}
                  {from ? ` ← ${displayName(save.year, from)}` : ""}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Btn kind="primary" onClick={() => step({ auto: true })}>
          {exp.done ? "Open the college draft" : userPicking ? "Pass remaining picks" : "Complete expansion"}
        </Btn>
      </div>
    </div>
  );
}
