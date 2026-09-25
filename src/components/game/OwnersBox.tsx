import {
  TICKET_TIERS,
  acceptRelocation,
  declineRelocation,
  formatMoney,
  formatPrice,
  supportMood,
  ticketPrice,
  setTicketTier,
  venueOf,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";

const TONE: Record<string, string> = {
  good: "text-good",
  ok: "text-paper",
  warn: "text-brass",
  bad: "text-brick",
};

const BAR: Record<string, string> = {
  good: "bg-good",
  ok: "bg-chrome",
  warn: "bg-brass",
  bad: "bg-brick",
};

/** The owner's side of the job: the crowd, the gate, the price of a seat, and the city's patience. */
export function OwnersBox() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const o = save.owner;
  if (!o) return null;
  const support = Math.round(o.support);
  const mood = supportMood(support);
  const house = venueOf(save.year, save.userTeamId);
  const fill = o.capacityTotal ? Math.round((100 * o.crowdTotal) / o.capacityTotal) : null;
  const avgCrowd = o.homeGames ? Math.round(o.crowdTotal / o.homeGames) : null;
  const last = o.ledger[o.ledger.length - 1];
  const recent = o.ledger.slice(-6).reverse();
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">THE OWNER&apos;S BOX</p>
        <p className={`text-xs tracking-[0.2em] ${TONE[mood.tone]}`}>{mood.label.toUpperCase()}</p>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span>Fan support</span>
          <span className={`tabular font-display text-2xl ${TONE[mood.tone]}`}>{support}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={support} aria-valuemin={0} aria-valuemax={100} aria-label="Fan support">
          <div className={`h-full ${BAR[mood.tone]}`} style={{ width: `${support}%` }} />
        </div>
        <p className="mt-1 text-xs text-subtle">
          Wins, stars and fair prices build it. Losing and gouging burn it. A loud house is worth a little on third down.
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">Avg crowd{o.homeGames ? "" : " last year"}</dt>
          <dd className="tabular">{avgCrowd ? avgCrowd.toLocaleString() : last?.avgCrowd ? last.avgCrowd.toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Filled{o.homeGames ? "" : " last year"}</dt>
          <dd className="tabular">{fill !== null ? `${fill}%` : last ? `${Math.round(last.fill)}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Gate {o.homeGames ? "this year" : "last year"}</dt>
          <dd className="tabular">{formatMoney(o.homeGames ? o.gate : last?.gate ?? 0, save.year)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Capacity</dt>
          <dd className="tabular">{house.capacity.toLocaleString()}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-xs tracking-[0.2em] text-muted">TICKET PRICES</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TICKET_TIERS.map((t) => {
            const on = o.ticket === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => desk((s) => setTicketTier(s, t.id))}
                className={`rounded-lg border p-2 text-left transition ${on ? "border-brass bg-brass/10" : "border-line hover:border-chrome-2"}`}
              >
                <span className="block text-sm">{t.label}</span>
                <span className="tabular block text-xs text-muted">{formatPrice(ticketPrice(save.year, t.id))}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-subtle">{TICKET_TIERS.find((t) => t.id === o.ticket)?.blurb}</p>
      </div>

      <RelocationOffer />
      {!o.offer && o.threat >= 1 && (
        <p className="mt-4 rounded-lg border border-brass/40 bg-brass/10 p-3 text-sm text-brass">
          The crowds are thin and the city has noticed. Another season like this and other markets will start calling.
        </p>
      )}

      {recent.length > 0 && (
        <div className="mt-4">
          <p className="text-xs tracking-[0.2em] text-muted">THE BOOKS</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal">Year</th>
                <th className="font-normal">Record</th>
                <th className="text-right font-normal">Crowd</th>
                <th className="text-right font-normal">Filled</th>
                <th className="text-right font-normal">Gate</th>
                <th className="text-right font-normal">Support</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {recent.map((l) => (
                <tr key={l.year} className="border-t border-line">
                  <td className="py-1">{l.year}</td>
                  <td>
                    {l.wins}-{l.losses}
                    {l.ties ? `-${l.ties}` : ""}
                  </td>
                  <td className="text-right">{l.avgCrowd ? l.avgCrowd.toLocaleString() : "—"}</td>
                  <td className="text-right">{l.fill ? `${Math.round(l.fill)}%` : "—"}</td>
                  <td className="text-right">{formatMoney(l.gate, l.year)}</td>
                  <td className={`text-right ${TONE[supportMood(l.support).tone]}`}>{l.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {o.moves.length > 0 && (
        <p className="mt-3 text-xs text-subtle">
          {o.moves.map((m) => `${m.year}: ${m.from} → ${m.to}`).join(" · ")}
        </p>
      )}
    </section>
  );
}

/** A city's offer to move the club. Also pinned over the offseason screens, since those take over the Office. */
export function RelocationOffer({ standalone = false }: { standalone?: boolean }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const offer = save.owner?.offer;
  if (!offer) return null;
  return (
    <div className={`${standalone ? "mb-6" : "mt-4"} rounded-lg border border-brick/50 bg-brick/10 p-3`}>
      <p className="text-xs tracking-[0.2em] text-brick">A CITY IS CALLING</p>
      <p className="mt-1 text-sm">{offer.pitch}</p>
      <p className="mt-1 text-xs text-muted">
        The offer stands until the season opens. Move and the club starts fresh somewhere that wants it. Stay and you
        have to win this town back.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn kind="brick" className="min-h-9 px-3 text-xs" onClick={() => desk((s) => acceptRelocation(s))}>
          Move to {offer.city}
        </Btn>
        <Btn kind="ghost" className="min-h-9 px-3 text-xs" onClick={() => desk((s) => declineRelocation(s))}>
          Stay home
        </Btn>
      </div>
    </div>
  );
}
