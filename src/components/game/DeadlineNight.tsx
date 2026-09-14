import {
  acceptDeadlineOffer,
  declineDeadlineOffer,
  displayName,
  type TradeOffer,
  type TradePiece,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";

function Piece({ piece }: { piece: TradePiece }) {
  const save = useGameStore((s) => s.save)!;
  if (piece.playerId) {
    const p = save.players[piece.playerId];
    if (!p) return <span>a player</span>;
    return (
      <span>
        <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{p.pos}</span>
      </span>
    );
  }
  if (piece.pickId) return <span className="text-muted">{piece.pickId.replace(/-/g, " ")}</span>;
  return <span>—</span>;
}

function OfferCard({ offer }: { offer: TradeOffer }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const open = offer.status === "open";
  return (
    <li className="rounded-lg border border-line bg-bg/40 p-4">
      <p className="text-xs tracking-[0.25em] text-brass">{displayName(save.year, offer.from).toUpperCase()}</p>
      <p className="mt-2 text-sm">
        They send {offer.give.map((p, i) => (
          <span key={i}>
            {i > 0 ? ", " : ""}
            <Piece piece={p} />
          </span>
        ))}
      </p>
      <p className="mt-1 text-sm">
        They want {offer.get.map((p, i) => (
          <span key={i}>
            {i > 0 ? ", " : ""}
            <Piece piece={p} />
          </span>
        ))}
      </p>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            kind="primary"
            className="min-h-9 px-3 text-xs"
            onClick={() =>
              desk((s) => {
                const r = acceptDeadlineOffer(s, offer.id);
                return r.ok ? "Deal done." : r.reason;
              })
            }
          >
            Accept
          </Btn>
          <Btn
            className="min-h-9 px-3 text-xs"
            onClick={() =>
              desk((s) => {
                const r = declineDeadlineOffer(s, offer.id);
                return r.ok ? "You hung up." : r.reason;
              })
            }
          >
            Decline
          </Btn>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{offer.status === "accepted" ? "Done." : "You passed."}</p>
      )}
      {lastDeskNote && open ? <p className="mt-2 text-sm text-brick">{lastDeskNote}</p> : null}
    </li>
  );
}

export function DeadlineNight() {
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const setTab = useGameStore((s) => s.setTab);
  const d = save.deadline;
  const rozelle = save.year < 1994;
  const offers = d?.offers ?? [];
  const open = offers.filter((o) => o.status === "open");
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="office" veil="full" />
        <div className="relative space-y-4 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">
            {rozelle ? `${save.year} TRADING WEEK` : `${save.year} TRADE DEADLINE`}
          </p>
          <h2 className="font-display text-4xl sm:text-5xl">{rozelle ? "The phone still works" : "The window is today"}</h2>
          <p className="max-w-xl text-paper">
            {rozelle
              ? "Stars rarely move under the Rozelle rule. Role players do. After you close this, the roster is the roster."
              : "After this week the league locks the window. What you have is what you take into December."}
          </p>
          <p className="text-sm text-muted">
            {open.length ? `${open.length} club${open.length === 1 ? "" : "s"} on the line` : "Nobody rang. You can still deal from the Market tab."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" onClick={() => step({})}>
              Close the window
            </Btn>
            <Btn onClick={() => setTab("market")}>Full market / trades</Btn>
          </div>
        </div>
      </section>

      {offers.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">INCOMING</p>
          <ul className="mt-3 space-y-3">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </ul>
        </section>
      )}

      {(d?.cpuMoves ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">AROUND THE LEAGUE</p>
          <ul className="mt-2 space-y-1 text-sm">
            {d!.cpuMoves.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {offers.length === 0 && (d?.cpuMoves ?? []).length === 0 && (
        <p className="text-sm text-muted">Quiet deadline. The wire is empty.</p>
      )}
    </div>
  );
}
