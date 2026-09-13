import { useEffect, useMemo, useState } from "react";
import {
  currentDraftTeam,
  displayName,
  draftOrder,
  formatHt,
  playerName,
  rosterOf,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { KitChips } from "./KitChips";

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] tracking-wider text-muted">
        <span>{label}</span>
        <span className="tabular">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brass" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function Clock({ seconds }: { seconds: number }) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return (
    <div className="tabular font-display text-4xl text-brass">
      {m}:{String(s).padStart(2, "0")}
    </div>
  );
}

export function DraftNight() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(8);
  const [scoutId, setScoutId] = useState<string | null>(null);

  const order = useMemo(() => draftOrder(save), [save.year, save.draftPickIndex, save.phase]);
  const teamsN = order.length || 24;
  const onClock = currentDraftTeam(save);
  const rnd = Math.floor(save.draftPickIndex / teamsN) + 1;
  const pickInRound = (save.draftPickIndex % teamsN) + 1;
  const overall = save.draftPickIndex + 1;
  const open = save.draftBoard.filter((p) => !p.taken);
  const board = open.slice(0, 18);
  const taken = save.draftBoard.filter((p) => p.taken);
  const last = taken[taken.length - 1];
  const lastPlayer = last ? save.players[last.playerId] : undefined;
  const scout = scoutId ? save.players[scoutId] : board[0] ? save.players[board[0].playerId] : undefined;
  const isUser = save.phase === "draft" && onClock === save.userTeamId;
  const cpuUp = save.phase === "draft" && !!onClock && onClock !== save.userTeamId;
  const done = save.phase !== "draft" || !onClock;
  const needs = onClock
    ? [...new Set(rosterOf(save, onClock).sort((a, b) => a.ovr - b.ovr).slice(0, 5).map((p) => p.pos))].join(" · ")
    : "";

  useEffect(() => {
    if (!cpuUp || paused) return;
    setHold(8);
    const tick = setInterval(() => setHold((h) => Math.max(0, h - 1)), 1000);
    const fire = setTimeout(() => step({}), 1800);
    return () => {
      clearInterval(tick);
      clearTimeout(fire);
    };
  }, [cpuUp, paused, save.draftPickIndex, step]);

  useEffect(() => {
    if (!isUser) return;
    setHold(75);
  }, [isUser, save.draftPickIndex]);

  if (save.phase !== "draft") {
    return (
      <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-6">
        <p className="font-display text-xs tracking-[0.3em] text-muted">{save.year} DRAFT</p>
        <h2 className="mt-2 text-3xl">Board is closed</h2>
        <p className="mt-2 text-muted">Free agency is next. The commissioner has left the podium.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="draft" veil="full" />
        <div className="relative space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} NFL DRAFT</p>
              <h2 className="font-display text-4xl sm:text-5xl">
                Round {rnd}
                <span className="ml-3 text-brass">Pick {pickInRound}</span>
              </h2>
              <p className="text-sm text-muted">
                Overall {Math.min(overall, save.draftBoard.length)} of {save.draftBoard.length} · {teamsN} clubs
              </p>
            </div>
            {onClock && (
              <div className="flex items-center gap-4 rounded-lg border border-brass/40 bg-black/65 px-4 py-3">
                <Logo id={onClock} size={64} year={save.year} />
                <div>
                  <p className="text-[11px] tracking-[0.35em] text-brass">
                    {isUser ? "YOUR WAR ROOM" : "ON THE CLOCK"}
                  </p>
                  <p className="font-display text-2xl">{displayName(save.year, onClock)}</p>
                  <p className="text-xs text-muted">Needs {needs || "best available"}</p>
                </div>
                <Clock seconds={hold} />
              </div>
            )}
          </div>

          {last && lastPlayer && !isUser && (
            <div className="rounded-lg border border-brass/25 bg-black/55 px-4 py-4">
              <p className="text-[11px] tracking-[0.4em] text-brass">THE PICK IS IN</p>
              <p className="mt-1 font-display text-lg text-paper">
                With the {last.slot} selection, the {last.takenBy ? displayName(save.year, last.takenBy) : "club"} select
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {last.takenBy && <Logo id={last.takenBy} size={48} year={save.year} />}
                <div>
                  <p className="font-display text-3xl">{playerName(lastPlayer)}</p>
                  <p className="text-sm text-muted">
                    {lastPlayer.pos} · {lastPlayer.college} · {formatHt(lastPlayer.heightIn)} · {lastPlayer.weight} lbs ·{" "}
                    {lastPlayer.forty?.toFixed(2)} forty
                  </p>
                  <div className="mt-1">
                    <KitChips player={lastPlayer} compact />
                  </div>
                </div>
              </div>
            </div>
          )}

          {isUser && (
            <div className="rounded-lg border border-accent/40 bg-accent/15 px-4 py-4">
              <p className="text-[11px] tracking-[0.35em] text-brass">COMMISSIONER · THE GREEN ROOM</p>
              <p className="mt-1 font-display text-2xl">You are on the clock. Turn a card.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {cpuUp && (
              <>
                <Btn kind="primary" onClick={() => step({})}>
                  Watch this pick
                </Btn>
                <Btn onClick={() => step({ simToUser: true })}>Jump to my pick</Btn>
                <Btn onClick={() => setPaused((p) => !p)}>{paused ? "Resume clock" : "Hold clock"}</Btn>
              </>
            )}
            {isUser && (
              <Btn kind="ghost" onClick={() => step({ auto: true })}>
                Auto remaining rounds
              </Btn>
            )}
            {cpuUp && (
              <Btn kind="ghost" onClick={() => step({ auto: true })}>
                Auto the rest
              </Btn>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <ol className="space-y-2 lg:col-span-2">
          {board.map((pr, i) => {
            const p = save.players[pr.playerId];
            if (!p) return null;
            return (
              <li
                key={pr.playerId}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
                  scout?.id === p.id ? "border-brass bg-brass/10" : "border-line bg-surface"
                }`}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setScoutId(p.id)}>
                  <p className="font-display text-lg">
                    {i + 1}. {playerName(p)}
                  </p>
                  <p className="text-sm text-muted">
                    {p.pos} · {p.college ?? "campus"} · {p.ovr} OVR · {formatHt(p.heightIn)}/{p.weight} · {p.forty?.toFixed(2)}
                  </p>
                  <div className="mt-1.5">
                    <KitChips player={p} compact />
                  </div>
                  <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
                    <Meter label="Speed" value={p.ratings.speed} />
                    <Meter label="Awareness" value={p.ratings.awareness} />
                  </div>
                </button>
                {isUser && (
                  <Btn kind={i === 0 ? "primary" : "ghost"} onClick={() => step({ userPickPlayerId: p.id })}>
                    Draft
                  </Btn>
                )}
              </li>
            );
          })}
        </ol>
        <aside className="space-y-4">
          {scout && (
            <div className="rounded-xl border border-brass/30 bg-surface p-4">
              <p className="mb-1 text-xs tracking-[0.25em] text-brass">Scout report</p>
              <p className="font-display text-2xl">{playerName(scout)}</p>
              <p className="text-sm text-muted">
                {scout.pos} · {scout.college ?? "campus"} · {scout.ovr} OVR
              </p>
              <p className="mt-2 text-xs text-muted">
                Abilities and traits change the sim — completions, sacks, carries, injuries, the fourth quarter.
              </p>
              <div className="mt-3">
                <KitChips player={scout} showDesc />
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="mb-3 text-xs tracking-[0.25em] text-muted">Cards turned</p>
            <ul className="space-y-2">
              {taken.slice(-12).reverse().map((pr) => {
                const p = save.players[pr.playerId];
                return (
                  <li key={pr.playerId} className="flex items-center gap-2 text-sm">
                    {pr.takenBy && <Logo id={pr.takenBy} size={28} year={save.year} />}
                    <span>
                      <span className="font-display">{p ? playerName(p) : "—"}</span>
                      <span className="block text-xs text-muted">
                        {p?.pos} · Rd {p?.draftRound} #{p?.draftPick}
                      </span>
                    </span>
                  </li>
                );
              })}
              {!taken.length && <li className="text-muted">Waiting on the first card.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 text-xs tracking-[0.25em] text-muted">This round</p>
            <ol className="grid grid-cols-4 gap-2">
              {order.map((id, i) => {
                const overallPick = (rnd - 1) * teamsN + i;
                const card = save.draftBoard[overallPick];
                const takenNow = card?.taken;
                const mine = id === save.userTeamId;
                return (
                  <li
                    key={`${id}-${i}`}
                    className={`flex flex-col items-center gap-1 rounded-md border p-1.5 ${
                      i === pickInRound - 1 && !done ? "border-brass bg-brass/15" : "border-line"
                    } ${mine ? "ring-1 ring-accent" : ""}`}
                  >
                    <Logo id={id as TeamId} size={28} year={save.year} />
                    <span className="text-[10px] text-muted">{takenNow ? "in" : i + 1}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
