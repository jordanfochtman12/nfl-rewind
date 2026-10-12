import {
  deskHoles,
  formatMoney,
  freeAgents,
  playerName,
  rosterOf,
  bidEligible,
  signPlayer,
  visibleOvr,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { KitChips } from "./KitChips";
import { BidControls, BiddingWars } from "./MarketLife";
import { FreeAgencyRecap } from "./FreeAgencyRecap";

export function FreeAgencyNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const step = useGameStore((s) => s.step);
  const setTab = useGameStore((s) => s.setTab);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const holes = deskHoles(save, save.userTeamId);
  const n = rosterOf(save, save.userTeamId).length;
  const rozelle = save.year < 1994;
  const board = freeAgents(save)
    .slice()
    .sort((a, b) => visibleOvr(b) - visibleOvr(a))
    .slice(0, 14);
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="office" veil="full" />
        <div className="relative space-y-4 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} FREE AGENCY</p>
          <h2 className="font-display text-4xl sm:text-5xl">{rozelle ? "Rozelle-rule winter" : "The market is open"}</h2>
          <p className="max-w-xl text-paper">
            {rozelle
              ? "Stars rarely move. Compensation hangs over every veteran. Sign camp help. The hole you leave stays a hole."
              : "Unrestricted names. Watch the cap. Close the market when the roster can survive September."}
          </p>
          <p className="text-sm text-muted">
            Roster {n}
            {save.salaryCap ? ` · cap ${formatMoney(save.salaryCap, save.year)}` : " · pre-cap era"}
            {holes.length ? ` · ${holes.length} hole${holes.length === 1 ? "" : "s"}` : ""}
          </p>
          {holes.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {holes.map((h) => (
                <li key={h.pos} className="rounded-md border border-brick/50 px-2 py-1 text-sm text-brick">
                  {h.pos} {h.healthy}/{h.need}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" onClick={() => step({ closeFa: true })}>
              Close free agency
            </Btn>
            <Btn onClick={() => setTab("market")}>Full market / trades</Btn>
          </div>
          {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}
        </div>
      </section>

      <BiddingWars />

      <FreeAgencyRecap year={save.year} compact />

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">ON THE STREET</p>
        <ul className="mt-3 divide-y divide-line">
          {board.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-display text-lg">
                  <PlayerLink player={p} className="inline min-h-0" />{" "}
                  <span className="text-sm text-muted">
                    {p.pos} · {p.age}
                  </span>
                </p>
                <KitChips player={p} compact />
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular text-muted">{p.revealed ? p.ovr : `sc ${visibleOvr(p)}`}</span>
                {bidEligible(save, p) ? (
                  <BidControls player={p} />
                ) : (
                <Btn
                  kind="primary"
                  onClick={() =>
                    desk((s) => {
                      const r = signPlayer(s, s.userTeamId, p.id);
                      return r.ok ? `Signed ${playerName(p)}.` : r.reason;
                    })
                  }
                >
                  Sign
                </Btn>
                )}
              </div>
            </li>
          ))}
          {!board.length && <p className="text-sm text-muted">The street is empty.</p>}
        </ul>
      </section>
    </div>
  );
}
