import { currentDraftTeam, displayName, formatHt, playerName, rosterOf } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] tracking-wider text-muted">
        <span>{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export function DraftNight() {
  const save = useGameStore((s) => s.save)!;
  const { step } = useGameStore();
  const onClock = currentDraftTeam(save);
  const teamsN = Object.values(save.teams).filter((t) => t.active).length || 24;
  const rnd = Math.floor(save.draftPickIndex / teamsN) + 1;
  const pickInRound = (save.draftPickIndex % teamsN) + 1;
  const overall = save.draftPickIndex + 1;
  const open = save.draftBoard.filter((p) => !p.taken);
  const board = open.slice(0, 16);
  const recent = save.draftBoard.filter((p) => p.taken).slice(-10).reverse();
  const isUser = save.phase === "draft" && onClock === save.userTeamId;
  const needs = onClock
    ? rosterOf(save, onClock)
        .sort((a, b) => a.ovr - b.ovr)
        .slice(0, 4)
        .map((p) => p.pos)
        .join(" · ")
    : "";
  const featured = board[0] ? save.players[board[0].playerId] : undefined;
  const style = onClock ? save.teams[onClock]?.draftStyle : undefined;

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="draft" veil="full" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} NFL DRAFT</p>
            <h2 className="font-display text-4xl sm:text-5xl">
              Round {rnd}
              <span className="ml-3 text-brass">Pick {pickInRound}</span>
            </h2>
            <p className="text-sm text-muted">
              Overall {overall} of {save.draftBoard.length} · {teamsN} clubs on the clock this round
            </p>
          </div>
          {onClock && (
            <div className="flex items-center gap-4 rounded-lg border border-brass/35 bg-black/50 px-4 py-3">
              <Logo id={onClock} size={64} />
              <div>
                <p className="text-[11px] tracking-[0.35em] text-brass">ON THE CLOCK</p>
                <p className="font-display text-2xl">{displayName(save.year, onClock)}</p>
                <p className="text-xs text-muted">
                  {style ? `War room: ${style}` : "BPA"} · holes {needs || "none"}
                </p>
              </div>
              <div className="tabular font-display text-4xl text-brass">10:00</div>
            </div>
          )}
        </div>

        {featured && (
          <div className="grid gap-5 border-t border-brass/20 bg-black/40 px-5 py-5 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[11px] tracking-[0.35em] text-brass">THE PICK IS IN</p>
              <p className="mt-2 font-display text-xl leading-snug sm:text-2xl">
                {onClock
                  ? `With the ${overall} selection in the ${save.year} draft, the ${displayName(save.year, onClock)} select…`
                  : "The board is empty."}
              </p>
              <p className="mt-3 font-display text-4xl text-paper">{playerName(featured)}</p>
              <p className="mt-1 text-muted">
                {featured.pos} · {featured.college} · {formatHt(featured.heightIn)} · {featured.weight} lbs · {featured.forty?.toFixed(2)} forty · #
                {featured.jersey}
              </p>
              <p className="mt-2 text-xs tracking-wide text-brass">{featured.abilities?.join(" · ")}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Meter label="OVR" value={featured.ovr} />
              <Meter label="Speed" value={featured.ratings.speed} />
              <Meter label="Awareness" value={featured.ratings.awareness} />
              <Meter label="Strength" value={featured.ratings.str} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
          <Btn kind="primary" onClick={() => step({ auto: true })}>
            Auto remaining
          </Btn>
          {isUser && featured && (
            <Btn kind="brick" onClick={() => step({ userPickPlayerId: featured.id })}>
              Make the pick
            </Btn>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ol className="space-y-2 lg:col-span-2">
          {board.map((pr, i) => {
            const p = save.players[pr.playerId];
            if (!p) return null;
            return (
              <li key={pr.playerId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-3">
                <div>
                  <p className="font-display text-lg">
                    {pr.slot}. {playerName(p)}
                  </p>
                  <p className="text-sm text-muted">
                    {p.pos} · {p.college ?? "campus"} · {p.ovr} OVR · {formatHt(p.heightIn)}/{p.weight} · {p.forty?.toFixed(2)}
                  </p>
                </div>
                {isUser && (
                  <Btn kind={i === 0 ? "primary" : "ghost"} onClick={() => step({ userPickPlayerId: p.id })}>
                    Draft
                  </Btn>
                )}
              </li>
            );
          })}
        </ol>
        <aside className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-xs tracking-[0.25em] text-muted">Cards turned</p>
          <ul className="space-y-3">
            {recent.map((pr) => {
              const p = save.players[pr.playerId];
              return (
                <li key={pr.playerId} className="flex items-center gap-2 text-sm">
                  {pr.takenBy && <Logo id={pr.takenBy} size={28} />}
                  <span>
                    <span className="font-display">{p ? playerName(p) : "—"}</span>
                    <span className="block text-xs text-muted">
                      {p?.pos} · Rd {p?.draftRound} #{p?.draftPick}
                    </span>
                  </span>
                </li>
              );
            })}
            {!recent.length && <li className="text-muted">Commissioner has not stepped to the podium.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
