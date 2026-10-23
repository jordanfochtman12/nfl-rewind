import { useState } from "react";
import {
  acceptCounter,
  accruedSeasonsFor,
  creditedSeasonsFor,
  canTag,
  erfaMinimumSalary,
  formatMoney,
  franchiseTag,
  letWalk,
  makeOffer,
  isRestrictedFreeAgent,
  isExclusiveRightsFreeAgent,
  rfaCompensationRound,
  rfaTenderPrice,
  tagPrice,
  tenderRfa,
  tenderErfa,
  talksSummary,
  type Negotiation,
  type Player,
  type RfaTenderLevel,
  posLabel,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

const STATUS: Record<Negotiation["status"], { label: string; tone: string }> = {
  open: { label: "At the table", tone: "bg-brass text-[#140f00]" },
  signed: { label: "Signed", tone: "bg-good text-black" },
  tagged: { label: "Franchise tag", tone: "bg-white text-black" },
  tendered: { label: "RFA tender placed", tone: "bg-good text-black" },
  walked: { label: "Talks broke down", tone: "bg-red text-white" },
  option: { label: "Playing out option", tone: "bg-chrome-2 text-white" },
  staff: { label: "Handled by staff", tone: "bg-chrome-2 text-white" },
  gone: { label: "Left", tone: "bg-red-deep text-white" },
};

const OFFERS = [0.85, 0.92, 0.97, 1, 1.06] as const;
const RFA_LEVELS: { level: RfaTenderLevel; label: string }[] = [
  { level: "first", label: "First-round compensation" },
  { level: "second", label: "Second-round compensation" },
  { level: "original", label: "Original-round compensation" },
  { level: "rofr", label: "Right of first refusal only" },
];

function RfaTenderOptions({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  return (
    <div className="w-full rounded-lg border border-brass/25 bg-black/25 p-3">
      <p className="mb-2 text-xs text-muted">Tender level sets the one-year salary and what your club receives if it declines an offer sheet. Compensation is from next year’s draft in this game’s offseason order.</p>
      <div className="flex flex-wrap gap-2">
        {RFA_LEVELS.map(({ level, label }) => {
          const round = rfaCompensationRound(level, p);
          return (
            <Btn key={level} kind="gold" className="min-h-10 px-3 text-xs" onClick={() => desk((s) => tenderRfa(s, p.id, level))}>
              {label} · {formatMoney(rfaTenderPrice(save.year, level, p), save.year)}
              {round ? ` · ${round}${round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th"} pick` : " · no pick"}
            </Btn>
          );
        })}
      </div>
    </div>
  );
}

function ErfaTenderOption({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const credited = creditedSeasonsFor(p);
  return (
    <div className="w-full rounded-lg border border-sky-300/25 bg-black/25 p-3">
      <p className="mb-2 text-xs text-muted">An exclusive-rights tender is a one-year league-minimum contract. If tendered, the player may negotiate only with this club.</p>
      <Btn kind="primary" className="min-h-10 px-3 text-xs" onClick={() => desk((s) => tenderErfa(s, p.id))}>
        ERFA minimum tender · {formatMoney(erfaMinimumSalary(save.year, credited), save.year)} · exclusive rights
      </Btn>
    </div>
  );
}

function Talk({ t }: { t: Negotiation }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const p = save.players[t.playerId];
  const [years, setYears] = useState(t.askYears);
  const [mult, setMult] = useState<number>(1);
  if (!p) return null;
  const y = save.year;
  const open = t.status === "open";
  const walked = t.status === "walked";
  const rfa = isRestrictedFreeAgent(save, p);
  const erfa = isExclusiveRightsFreeAgent(save, p);
  const offer = Math.round((t.ask * mult) / 10) * 10;
  const last = p.stats[y - 1];
  const line = last
    ? p.pos === "QB"
      ? `${last.passYds.toLocaleString("en-US")} yds, ${last.passTd} TD`
      : last.rushAtt >= 50
        ? `${last.rushYds.toLocaleString("en-US")} rush yds`
        : last.rec >= 15
          ? `${last.rec} rec, ${last.recYds.toLocaleString("en-US")} yds`
          : last.sacks >= 2
            ? `${Math.round(last.sacks * 10) / 10} sacks`
            : last.ints
              ? `${last.ints} INT`
              : `${last.gp} games`
    : "Didn't play";
  const st = t.erfaTender ? { ...STATUS.tendered, label: "ERFA tender placed" } : STATUS[t.status];
  return (
    <li className={`border ${open ? "border-brass/50" : "border-white/10"} bg-black/40`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <PlayerLink player={p} className="inline min-h-0 font-display text-lg font-bold uppercase italic" />
            <span className="text-sm text-muted">
              {posLabel(p)} · {p.age} · {p.ovr} ovr{rfa ? ` · RFA · ${accruedSeasonsFor(p)} accrued seasons` : erfa ? ` · ERFA · ${accruedSeasonsFor(p)} accrued seasons` : ""}
            </span>
            <span className={`px-1.5 py-0.5 font-display text-[10px] font-extrabold uppercase italic tracking-wider ${st.tone}`}>{st.label}</span>
          </p>
          <p className="text-xs text-subtle">
            Last year: {line} · was paid {formatMoney(p.salary ?? 0, y)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[10px] font-bold uppercase italic tracking-wider text-muted">The ask</p>
          <p className="bug-num text-2xl text-white">{formatMoney(t.ask, y)}</p>
          <p className="text-xs text-muted">
            × {t.askYears} yr{t.askYears === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <p className="px-4 text-sm text-paper">{t.pitch}</p>
      {t.rounds.length > 0 && (
        <ol className="mx-4 mt-2 space-y-1 border-l-2 border-white/15 pl-3 text-xs">
          {t.rounds.map((r, i) => (
            <li key={i} className={r.tone === "yes" ? "text-good" : r.tone === "insult" || r.tone === "no" ? "text-red" : "text-paper"}>
              You: {formatMoney(r.salary, y)} × {r.years}. {r.reply}
            </li>
          ))}
        </ol>
      )}
      {t.result && !open && <p className="mx-4 mt-2 text-sm text-brass">{t.result}</p>}
      {open ? (
        <div className="mt-3 space-y-3 border-t border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">Per year</span>
            {OFFERS.map((m) => (
              <button key={m} type="button" onClick={() => setMult(m)} className={`bx-chip min-h-9 px-2.5 text-[11px] ${mult === m ? "bx-chip-on" : ""}`}>
                {formatMoney(Math.round((t.ask * m) / 10) * 10, y)}
                <span className="ml-1 opacity-70">{m === 1 ? "ask" : `${m > 1 ? "+" : ""}${Math.round((m - 1) * 100)}%`}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-14 font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">Years</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setYears(n)} className={`bx-chip min-h-9 min-w-9 px-2 text-[11px] ${years === n ? "bx-chip-on" : ""}`}>
                {n}
              </button>
            ))}
            <span className="ml-2 flex items-center gap-1 text-[11px] text-muted" aria-label={`Patience: ${t.patience} rounds left`}>
              Patience
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={`h-2 w-3 [transform:skewX(-14deg)] ${i < t.patience ? "bg-brass" : "bg-white/15"}`} />
              ))}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" className="min-h-10 px-4 text-sm" onClick={() => desk((s) => makeOffer(s, t.playerId, offer, years))}>
              Offer {formatMoney(offer, y)} × {years}
            </Btn>
            {t.counter && (
              <Btn kind="gold" className="min-h-10 px-4 text-sm" onClick={() => desk((s) => acceptCounter(s, t.playerId))}>
                Take their counter: {formatMoney(t.counter.salary, y)} × {t.counter.years}
              </Btn>
            )}
            {canTag(save) && (
              <Btn className="min-h-10 px-4 text-sm" onClick={() => desk((s) => franchiseTag(s, t.playerId))}>
                Franchise tag · {formatMoney(tagPrice(save, p), y)}
              </Btn>
            )}
            <Btn className="min-h-10 px-4 text-sm" onClick={() => desk((s) => letWalk(s, t.playerId))}>
              Let him walk
            </Btn>
          </div>
          {rfa && <RfaTenderOptions p={p} />}
          {erfa && <ErfaTenderOption p={p} />}
        </div>
      ) : walked && (canTag(save) || rfa || erfa) ? (
        <div className="mt-2 flex flex-wrap gap-2 px-4 pb-3">
          {canTag(save) && (
            <Btn className="min-h-10 px-4 text-sm" onClick={() => desk((s) => franchiseTag(s, t.playerId))}>
              Keep him with the franchise tag · {formatMoney(tagPrice(save, p), y)}
            </Btn>
          )}
          {rfa && <RfaTenderOptions p={p} />}
          {erfa && <ErfaTenderOption p={p} />}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </li>
  );
}

/** The owner's expiring contracts: negotiate, tag, or let them go before free agency opens. */
export function ContractTalks() {
  const save = useGameStore((s) => s.save)!;
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const talks = (save.talks ?? []).filter((t) => t.year === save.year);
  if (!talks.length) return null;
  const open = talks.filter((t) => t.status === "open");
  const ordered = talks.slice().sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || (save.players[b.playerId]?.ovr ?? 0) - (save.players[a.playerId]?.ovr ?? 0));
  const deadlinePassed = save.phase === "freeAgency" || save.phase === "preseason" || save.phase === "regular";
  return (
    <section className="rounded-xl border border-brass/40 bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">Contract talks</p>
          <h3 className="text-xl text-white">
            {open.length ? `${open.length} of your players ${open.length === 1 ? "is" : "are"} waiting on a deal` : "Every expiring contract is settled"}
          </h3>
          <p className="text-xs text-muted">
            {deadlinePassed
              ? "Free agency has opened. These were this year's talks."
              : `Deadline: the start of free agency. ${save.year >= 1994 ? "Anyone unsigned hits the open market." : "Anyone unsigned plays out his option year, unhappily."} Players you never make an offer to are left to your staff.`}
            {canTag(save) ? " One franchise tag available." : save.year >= 1994 ? " Franchise tag used." : ""}
          </p>
        </div>
      </div>
      {lastDeskNote && <p className="px-4 pt-3 text-sm text-brass">{lastDeskNote}</p>}
      <ul className="space-y-2 p-3">
        {ordered.map((t) => (
          <Talk key={t.playerId} t={t} />
        ))}
      </ul>
    </section>
  );
}

/** A one-line reminder that sends the owner to the table. */
export function TalksReminder() {
  const save = useGameStore((s) => s.save)!;
  const setTab = useGameStore((s) => s.setTab);
  const { open } = talksSummary(save);
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={() => setTab("market")}
      className="flex w-full items-center gap-3 rounded-xl border border-brass/50 bg-gradient-to-r from-brass/15 to-black/60 px-4 py-3 text-left"
    >
      <span className="bx-primary px-2 py-0.5 font-display text-xs font-extrabold italic [transform:skewX(-12deg)]">
        <span className="inline-block [transform:skewX(12deg)]">{open}</span>
      </span>
      <span className="text-sm text-paper">
        <span className="font-display font-bold uppercase italic text-white">Contract talks: </span>
        {open} expiring {open === 1 ? "contract needs" : "contracts need"} a decision before free agency opens.
      </span>
      <span className="ml-auto shrink-0 font-display text-sm font-bold uppercase italic text-brass">To the table ▸</span>
    </button>
  );
}
