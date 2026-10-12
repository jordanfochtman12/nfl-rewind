/** Morale on the roster and the locker room's chemistry (see lib/game/morale.ts). */
import { useMemo } from "react";
import type { Player } from "@/lib/game";
import { chemistryOf, moraleLabel, moraleOf, moraleTarget } from "@/lib/game/morale";
import { useGameStore } from "@/lib/game-store";
import { PlayerLink } from "./PlayerProfile";

const TONE = { good: "text-good", ok: "text-paper", bad: "text-brick" } as const;

/** A player's mood as a word, with what's driving it on hover and for screen readers. */
export function MoodCell({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const m = moraleOf(p);
  const l = moraleLabel(m);
  const why = moraleTarget(save, p)
    .reasons.filter((r) => r.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
    .map((r) => r.text)
    .join(", ");
  return (
    <span className={`relative ${TONE[l.tone]} whitespace-nowrap`} title={why || undefined}>
      {l.label} <span className="tabular text-subtle">{m}</span>
      {why ? <span className="sr-only">: {why}</span> : null}
    </span>
  );
}

/** The locker room at a glance: chemistry, and who's unhappy and why. */
export function LockerRoom() {
  const save = useGameStore((s) => s.save)!;
  const chem = useMemo(() => chemistryOf(save, save.userTeamId), [save]);
  const unhappy = useMemo(
    () =>
      Object.values(save.players)
        .filter((p) => p.teamId === save.userTeamId && moraleOf(p) < 48 && p.ovr >= 70)
        .sort((a, b) => moraleOf(a) - moraleOf(b))
        .slice(0, 4),
    [save],
  );
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Locker room">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-xs tracking-[0.25em] text-muted">LOCKER ROOM</p>
        <p className="text-xs text-subtle">Starters&apos; mood {chem.mood} · {Math.round(chem.continuity * 100)}% back from last year</p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="bug-num text-4xl text-white">{chem.value}</span>
        <div className="min-w-0 flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-black/40" role="meter" aria-label="Chemistry" aria-valuemin={0} aria-valuemax={100} aria-valuenow={chem.value}>
            <div className="h-full rounded-full bg-gradient-to-r from-brick via-brass to-good" style={{ width: `${chem.value}%` }} />
          </div>
          <p className="mt-1 text-sm text-paper">{chem.line} Chemistry is worth about a point either way on Sundays.</p>
        </div>
      </div>
      {unhappy.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {unhappy.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline gap-x-2">
              <PlayerLink player={p} className="inline min-h-0" /> <span className="text-xs text-muted">{p.pos}</span> <MoodCell p={p} />
              {p.tradeRequest === save.year && <span className="text-xs font-semibold text-brick">TRADE REQUEST</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-subtle">Winning, starting the players who earn it, and paying stars what they&apos;re worth keep the room together.</p>
    </section>
  );
}
