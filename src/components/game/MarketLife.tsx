import {
  acceptCall,
  askingPrice,
  BID_TIERS,
  bidFor,
  declineCall,
  displayName,
  formatMoney,
  leaning,
  openCalls,
  placeBid,
  resolveBid,
  type Player,
  posLabel,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { Piece } from "./DeadlineNight";
import { PlayerLink } from "./PlayerProfile";

/** The Office phone: CPU clubs calling with trades during the season. */
export function PhoneLine() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const calls = openCalls(save);
  if (!calls.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-brass/50 bg-surface">
      <div className="flex items-center gap-2 border-b border-brass/30 bg-brass/10 px-4 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brick" aria-hidden />
        <p className="font-display text-xs tracking-[0.3em] text-brass">
          {calls.length === 1 ? "LINE ONE IS BLINKING" : `${calls.length} LINES BLINKING`}
        </p>
        <p className="ml-auto text-[11px] text-muted">Offers go cold after this week</p>
      </div>
      <ul className="divide-y divide-line">
        {calls.map((c) => (
          <li key={c.id} className="p-4">
            <p className="flex items-center gap-2 font-display text-lg">
              <Logo id={c.from} size={24} /> {displayName(save.year, c.from)}
            </p>
            <p className="mt-1 text-sm text-paper">{c.pitch}</p>
            <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <p>
                <span className="text-xs tracking-[0.2em] text-muted">YOU GET </span>
                {c.give.map((p, i) => (
                  <span key={i}>
                    {i > 0 ? ", " : ""}
                    <Piece piece={p} />
                  </span>
                ))}
              </p>
              <p>
                <span className="text-xs tracking-[0.2em] text-muted">YOU SEND </span>
                {c.get.map((p, i) => (
                  <span key={i}>
                    {i > 0 ? ", " : ""}
                    <Piece piece={p} />
                  </span>
                ))}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                kind="primary"
                className="min-h-9 px-4 text-sm"
                onClick={() =>
                  desk((s) => {
                    const r = acceptCall(s, c.id);
                    return r.ok ? `Deal done with the ${displayName(s.year, c.from)}.` : r.reason;
                  })
                }
              >
                Take the deal
              </Btn>
              <Btn className="min-h-9 px-4 text-sm" onClick={() => desk((s) => (declineCall(s, c.id), "You hung up."))}>
                Hang up
              </Btn>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Offer buttons for a star on the street, or the state of the war once it's on. */
export function BidControls({ player }: { player: Player }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const b = bidFor(save, player.id);
  const ask = askingPrice(save, player);
  if (b && b.status !== "open") {
    return <p className={`text-sm ${b.status === "won" ? "text-brass" : "text-brick"}`}>{b.note}</p>;
  }
  const lean = b ? leaning(save, b) : undefined;
  return (
    <div className="flex flex-col items-end gap-2">
      {b && (
        <div className="text-right text-xs">
          <p className="flex flex-wrap items-center justify-end gap-1 text-muted">
            In on him:
            {b.rivals.map((r) => (
              <span key={r.teamId} className="inline-flex items-center gap-1 rounded-sm border border-line px-1.5 py-0.5 text-paper">
                <Logo id={r.teamId} size={14} /> {displayName(save.year, r.teamId)}
              </span>
            ))}
          </p>
          <p className={lean?.kind === "you" ? "mt-1 text-brass" : lean?.kind === "them" ? "mt-1 text-brick" : "mt-1 text-paper"}>
            Your offer: {BID_TIERS[b.tier]!.label} · {formatMoney(b.salary, save.year)} ·{" "}
            {lean?.kind === "you"
              ? "leaning your way"
              : lean?.kind === "them"
                ? `leaning ${displayName(save.year, lean.teamId!)}`
                : "a toss-up"}
          </p>
          {lean?.why && <p className="mt-0.5 text-muted">His agent: {lean.why}.</p>}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-1.5">
        {BID_TIERS.map((t, i) =>
          b && i <= b.tier ? null : (
            <Btn
              key={t.label}
              kind={i === 0 && !b ? "primary" : i === 2 ? "gold" : "ghost"}
              className="min-h-9 px-3 text-xs"
              title={formatMoney(Math.round(ask * t.mult), save.year)}
              onClick={() => desk((s) => placeBid(s, player.id, i))}
            >
              {b ? `Raise: ${t.label}` : t.label} {formatMoney(Math.round(ask * t.mult), save.year)}
            </Btn>
          ),
        )}
        {b && (
          <Btn className="min-h-9 px-3 text-xs" onClick={() => desk((s) => resolveBid(s, player.id))}>
            Get his answer
          </Btn>
        )}
      </div>
    </div>
  );
}

/** Finished and ongoing wars this offseason. */
export function BiddingWars() {
  const save = useGameStore((s) => s.save)!;
  const bids = (save.faBids ?? []).filter((b) => b.year === save.year);
  if (!bids.length) return null;
  return (
    <section className="rounded-xl border border-brass/40 bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-brass">BIDDING WARS</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {bids.map((b) => {
          const p = save.players[b.playerId];
          if (!p) return null;
          return (
            <li key={b.playerId} className="flex flex-wrap items-baseline gap-x-2">
              <PlayerLink player={p} className="inline min-h-0" />
              <span className="text-muted">{posLabel(p)}</span>
              <span className={b.status === "won" ? "text-brass" : b.status === "lost" ? "text-brick" : "text-paper"}>
                {b.status === "open"
                  ? `still deciding · you vs the ${b.rivals.map((r) => displayName(save.year, r.teamId)).join(", ")}`
                  : b.status === "won"
                    ? "signed with you"
                    : b.winner
                      ? `signed with the ${displayName(save.year, b.winner)}`
                      : "unsigned"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Open offers get their answer when you close free agency.</p>
    </section>
  );
}

