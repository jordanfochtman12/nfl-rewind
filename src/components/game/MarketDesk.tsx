import { useMemo, useState } from "react";
import { ContractTalks } from "./ContractTalks";
import {
  claimWaiver,
  cutPlayer,
  displayName,
  executeTrade,
  formatMoney,
  freeAgents,
  playerName,
  rosterOf,
  bidEligible,
  placeBid,
  signPlayer,
  tradeWindowOpen,
  visibleOvr,
  type Player,
  type TeamId,
  type TradePiece,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, gradeTone, Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";
import { KitChips } from "./KitChips";

function Grade({ p }: { p: Player }) {
  const o = visibleOvr(p);
  return (
    <span className={`stat-glow tabular ${gradeTone(o)}`}>
      {p.revealed ? `${o}` : `sc ${o}`}
      {!p.revealed && <span className="ml-1 text-[10px] tracking-widest text-muted">HIDDEN</span>}
    </span>
  );
}

export function MarketDesk() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const step = useGameStore((s) => s.step);
  const [other, setOther] = useState<TeamId | "">("");
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const mine = rosterOf(save, save.userTeamId);
  const fa = useMemo(
    () =>
      freeAgents(save)
        .slice()
        .sort((a, b) => visibleOvr(b) - visibleOvr(a))
        .slice(0, 80),
    [save],
  );
  const clubs = Object.values(save.teams).filter((t) => t.active && t.id !== save.userTeamId);
  const windowOpen = tradeWindowOpen(save);
  const theirPlayers = other ? rosterOf(save, other as TeamId) : [];
  const myPicks = (save.teams[save.userTeamId].picks ?? []).filter((p) => !p.used && p.year <= save.year + 2);
  const theirPicks = other
    ? (save.teams[other as TeamId].picks ?? []).filter((p) => !p.used && p.year <= save.year + 2)
    : [];

  const toggle = (arr: string[], id: string, set: (n: string[]) => void) => {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  const pieces = (ids: string[], isMine: boolean): TradePiece[] => {
    const out: TradePiece[] = [];
    for (const id of ids) {
      if (save.players[id]) out.push({ playerId: id });
      else out.push({ pickId: id });
    }
    void isMine;
    return out;
  };

  return (
    <div className="space-y-8">
      <ContractTalks />
      {save.phase === "freeAgency" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brass/40 bg-surface p-4">
          <div>
            <p className="text-xs tracking-[0.25em] text-brass">OPEN MARKET</p>
            <p className="text-sm text-muted">
              {save.year < 1994
                ? "Rozelle-rule era. Stars rarely move. Sign camp help, then close the market."
                : "Unrestricted free agency. Watch the cap."}
            </p>
          </div>
          <Btn kind="primary" onClick={() => step({ closeFa: true })}>
            Close free agency
          </Btn>
        </div>
      )}
      {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}

      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Waivers</h3>
        {save.waivers.length === 0 ? (
          <p className="text-sm text-muted">Wire is empty.</p>
        ) : (
          <ul className="space-y-2">
            {save.waivers.map((w) => {
              const p = save.players[w.playerId];
              if (!p) return null;
              return (
                <li key={w.playerId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-3">
                  <span>
                    <PlayerLink player={p} className="inline min-h-0" />{" "}
                    <span className="text-muted">
                      {p.pos} · from {displayName(save.year, w.from)}
                    </span>
                  </span>
                  <Btn
                    onClick={() =>
                      desk((s) => {
                        const r = claimWaiver(s, s.userTeamId, p.id);
                        return r.ok ? `Claimed ${playerName(p)}.` : r.reason;
                      })
                    }
                  >
                    Claim
                  </Btn>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Free agents</h3>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wider text-muted">
              <tr>
                <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 font-medium">Player</th>
                {["", "Pos", "Grade", "Age", "College"].map((h) => (
                  <th key={h} className="bg-surface-2 px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fa.map((p, i) => (
                <tr key={p.id} className={`border-t border-line ${i === 0 ? "lead-row" : ""}`}>
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                    <PlayerLink player={p} />
                    {i === 0 ? <span className="ml-2 text-[10px] tracking-widest text-brass">TOP FA</span> : null}
                    <span className="mt-0.5 block">
                      <KitChips player={p} compact />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Btn
                      kind="primary"
                      onClick={() =>
                        desk((s) => {
                          if (bidEligible(s, s.players[p.id]!)) return placeBid(s, p.id, 0);
                          const r = signPlayer(s, s.userTeamId, p.id);
                          return r.ok ? `Signed ${playerName(p)}.` : r.reason;
                        })
                      }
                    >
                      {bidEligible(save, p) ? "Make offer" : "Sign"}
                    </Btn>
                  </td>
                  <td className="px-3 py-2">{p.pos}</td>
                  <td className="px-3 py-2">
                    <Grade p={p} />
                  </td>
                  <td className="tabular px-3 py-2">{p.age}</td>
                  <td className="px-3 py-2 text-muted">{p.college ?? "—"}</td>
                </tr>
              ))}
              {!fa.length && (
                <tr>
                  <td className="px-3 py-4 text-muted" colSpan={6}>
                    No one left on the street.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm tracking-[0.2em] text-muted">Trade desk</h3>
        {!windowOpen && (
          <p className="rounded-lg border border-brick/40 bg-brick/10 p-3 text-sm text-brick">
            The trade deadline has passed. No deals league-wide until next league year.
          </p>
        )}
        <div className={`flex flex-wrap gap-2 ${windowOpen ? "" : "pointer-events-none opacity-40"}`}>
          {clubs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setOther(t.id);
                setGet([]);
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs tracking-widest ${
                other === t.id ? "bx-chip bx-chip-on" : "bx-chip"
              }`}
            >
              <Logo id={t.id} size={18} year={save.year} />
              {displayName(save.year, t.id)}
            </button>
          ))}
        </div>
        {other && windowOpen && (
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border border-line bg-surface p-3">
              <p className="text-xs tracking-[0.2em] text-muted">You send</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
                {mine.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={give.includes(p.id)}
                        onChange={() => toggle(give, p.id, setGive)}
                      />
                      <span>
                        <span onClick={(e) => e.preventDefault()}>
                          <PlayerLink player={p} className="inline min-h-0" />
                        </span>{" "}
                        · {p.pos} · <Grade p={p} />
                      </span>
                    </label>
                  </li>
                ))}
                {myPicks.map((pk) => (
                  <li key={pk.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={give.includes(pk.id)}
                        onChange={() => toggle(give, pk.id, setGive)}
                      />
                      <span>
                        {pk.year} R{pk.round} ({pk.orig.toUpperCase()})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-line bg-surface p-3">
              <p className="text-xs tracking-[0.2em] text-muted">You receive</p>
              <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
                {theirPlayers.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={get.includes(p.id)}
                        onChange={() => toggle(get, p.id, setGet)}
                      />
                      <span>
                        <span onClick={(e) => e.preventDefault()}>
                          <PlayerLink player={p} className="inline min-h-0" />
                        </span>{" "}
                        · {p.pos} · <Grade p={p} />
                      </span>
                    </label>
                  </li>
                ))}
                {theirPicks.map((pk) => (
                  <li key={pk.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={get.includes(pk.id)}
                        onChange={() => toggle(get, pk.id, setGet)}
                      />
                      <span>
                        {pk.year} R{pk.round} ({pk.orig.toUpperCase()})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        )}
        {other && windowOpen && (
          <Btn
            kind="primary"
            onClick={() =>
              desk((s) => {
                const r = executeTrade(s, s.userTeamId, other as TeamId, pieces(give, true), pieces(get, false));
                if (r.ok) {
                  setGive([]);
                  setGet([]);
                  return "Trade is in.";
                }
                return r.reason;
              })
            }
          >
            Send the offer
          </Btn>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Your roster · cut / waive</h3>
        <p className="mb-2 text-sm text-muted">
          Payroll {formatMoney(save.teams[save.userTeamId].payroll, save.year)}
          {save.salaryCap ? ` · cap ${formatMoney(save.salaryCap, save.year)}` : " · pre-cap era"}
        </p>
        <ul className="space-y-1">
          {mine
            .slice()
            .sort((a, b) => a.ovr - b.ovr)
            .slice(0, 12)
            .map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <span>
                  <PlayerLink player={p} className="inline min-h-0" /> {p.pos} · <Grade p={p} />
                </span>
                <Btn
                  kind="brick"
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
    </div>
  );
}
