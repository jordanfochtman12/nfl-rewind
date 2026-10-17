import { useDraftAnnouncer } from "./draftAudio";
import { TalksReminder } from "./ContractTalks";
import { useEffect, useMemo, useState } from "react";
import {
  ARCH_LABEL,
  currentDraftTeam,
  originalLeague,
  sessionOf,
  displayName,
  draftOrder,
  draftQueue,
  formatHt,
  playerName,
  SCOUT_KEYS,
  sessionLabel,
  visibleOvr,
  visibleRatings,
  scoutLetter,
  type Player,
  type Pos,
  type TeamId,
  executePickDeal,
  tradeDownOffers,
  tradeUpPackage,
  type PickDeal,
  BUDGETS,
  COMBINE_FROM,
  ownerGrade,
  proDayVisit,
  scoutState,
  setScoutBudget,
  visitsLeft,
  draftTicker,
  draftVenue,
  posLabel,
} from "@/lib/game";
import { counterOffer, gradeRange, positionalNeeds, schemeFit } from "@/lib/game/draftFit";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { KitChips } from "./KitChips";
import { PlayerLink } from "./PlayerProfile";
import { NightShow } from "./ShowKit";
import { DraftMasthead, OnTheClockPlate, PickReveal, RoundRecapCard } from "./DraftStage";
import { DraftOpening } from "./DraftOpening";
import { DraftRecapView } from "./DraftRecap";

const POS_FILTERS: (Pos | "ALL")[] = [
  "ALL",
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "DE",
  "DT",
  "OLB",
  "MLB",
  "CB",
  "S",
  "K",
  "P",
];

function Meter({ label, value }: { label: string; value: number }) {
  const tone = value >= 90 ? "bg-brass" : value >= 80 ? "bg-accent" : value >= 70 ? "bg-paper" : "bg-muted";
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] tracking-wider text-muted">
        <span>{label}</span>
        <span className="tabular text-fg">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function archLabel(p: Player): string {
  const a = p.arch as keyof typeof ARCH_LABEL | undefined;
  return a && ARCH_LABEL[a] ? ARCH_LABEL[a] : "Prospect";
}

function scoutKeys(p: Player) {
  return SCOUT_KEYS[p.pos] ?? SCOUT_KEYS.WR;
}

function measLine(p: Player): string {
  const ht = formatHt(p.heightIn);
  const wt = p.weight ? `${p.weight} lbs` : "";
  const fy = p.forty != null ? `${p.forty.toFixed(2)} forty` : "";
  return [ht, wt, fy].filter(Boolean).join(" · ");
}

export function DraftNight() {
  const announcer = useDraftAnnouncer();
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const setTab = useGameStore((s) => s.setTab);
  const openProfile = useGameStore((s) => s.openProfile);
  const desk = useGameStore((s) => s.desk);
  // The room opens on hold: the draft starts when the owner says so, not the moment it loads.
  const [paused, setPaused] = useState(() => save.phase === "draft" && save.draftPickIndex === 0);
  // Before the first pick the room opens on the welcome; the owner starts the draft from it.
  const [opening, setOpening] = useState(() => save.phase === "draft" && save.draftPickIndex === 0);
  const showOpening = opening && save.phase === "draft" && save.draftPickIndex === 0;
  const [hold, setHold] = useState(8);
  const [scoutId, setScoutId] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<Pos | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(40);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const compared = compareIds.map(id => save.players[id]).filter((p): p is Player => !!p);

  // Keyed on the whole save: a draft-day trade changes who owns a pick without moving the index.
  const order = useMemo(() => draftOrder(save), [save]);
  const teamsN = order.length || 24;
  const onClock = currentDraftTeam(save);
  const rnd = Math.floor(save.draftPickIndex / teamsN) + 1;
  const pickInRound = (save.draftPickIndex % teamsN) + 1;
  const overall = save.draftPickIndex + 1;
  const totalPicks = useMemo(() => draftQueue(save).length, [save]);
  const openAll = save.draftBoard.filter((p) => !p.taken);
  const taken = save.draftBoard.filter((p) => p.taken);
  const namedLeft = openAll.filter((pr) => save.players[pr.playerId]?.historical).length;

  const board = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openAll.filter((pr) => {
      const p = save.players[pr.playerId];
      if (!p) return false;
      if (posFilter !== "ALL" && p.pos !== posFilter) return false;
      if (q && !playerName(p).toLowerCase().includes(q) && !(p.college ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [openAll, posFilter, query, save.players]);

  const scout = scoutId
    ? save.players[scoutId]
    : board[0]
      ? save.players[board[0].playerId]
      : undefined;
  // In a sandbox every club is on autopilot; the room just watches the board.
  const isUser = !save.sandbox && save.phase === "draft" && onClock === save.userTeamId;
  const myPicksLeft = !save.sandbox && draftQueue(save).slice(save.draftPickIndex).some((p) => p.owner === save.userTeamId);
  const cpuUp = save.phase === "draft" && !!onClock && (save.sandbox || onClock !== save.userTeamId);
  const done = save.phase !== "draft" || !onClock;
  // The owner's own needs are measured against the league's starters, not just his weakest men.
  const myNeeds = useMemo(() => (isUser && onClock ? positionalNeeds(save, onClock, 4).map((n) => n.pos) : undefined), [save, isUser, onClock]);

  useEffect(() => {
    if (!cpuUp || paused || announcer.busy || announcer.hidden) return;
    setHold(8);
    const tick = setInterval(() => setHold((h) => Math.max(0, h - 1)), 1000);
    const fire = setTimeout(() => step({}), 1800);
    return () => {
      clearInterval(tick);
      clearTimeout(fire);
    };
  }, [cpuUp, paused, save.draftPickIndex, step, announcer.busy, announcer.hidden]);

  // Your own clock runs too. It is television: the pick is yours whenever you make it.
  useEffect(() => {
    if (!isUser) return;
    setHold(75);
    const tick = setInterval(() => setHold((h) => Math.max(0, h - 1)), 1000);
    return () => clearInterval(tick);
  }, [isUser, save.draftPickIndex]);
  const ticker = useMemo(() => draftTicker(save, 20), [save]);
  // After the last pick the room becomes the morning-after review, until next year's board.
  const hasRecap = save.draftBoard.some((pr) => pr.taken && save.players[pr.playerId]?.draftYear === save.year);

  if (save.phase !== "draft" && hasRecap) return <DraftRecapView />;
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
    <NightShow
      id={`draft-${save.year}-${sessionOf(save)}`}
      show={sessionOf(save) === "afl" ? "AFL DRAFT" : "NFL DRAFT"}
      title={`The ${save.year} Draft`}
      sub={draftVenue(save.year)}
      year={save.year}
      ticker={ticker}
      tickerLabel="THE PICKS"
    >
    <div className="space-y-4">
      <TalksReminder />
      {announcer.controls}
      {!save.sandbox && <section className="hq-panel p-4" aria-label="Prospect comparison">
        <ScoutDesk /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl">Your draft room</h3><p className="mt-1 text-xs text-muted">Compare up to three prospects. Grades are your scouts' read, not the truth.</p></div>{compared.length > 0 && <Btn onClick={() => setCompareIds([])}>Clear comparison</Btn>}</div>
        {compared.length === 0 ? <p className="mt-3 text-sm text-muted">Use Compare on any prospect to build your decision board.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{compared.map(p => <article className="rounded-lg border border-line bg-surface-2 p-4" key={p.id}><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-brass">{posLabel(p)} · {p.age} years old</p><h4 className="mt-1 text-xl">{playerName(p)}</h4></div><button className="min-h-9 min-w-9 text-muted" aria-label={`Remove ${playerName(p)} from comparison`} onClick={() => setCompareIds(ids => ids.filter(id => id !== p.id))}>×</button></div><p className="mt-2 text-sm text-muted">{p.college ?? 'Campus'} · {archLabel(p)}</p><p className="mt-2 font-display text-3xl text-brass">{ownerGrade(save, p)} <span className="text-sm text-muted">{p.revealed ? 'Overall' : 'Your grade'}</span></p><div className="mt-3 space-y-3">{scoutKeys(p).slice(0, 5).map(k => <Meter key={k.key} label={k.label} value={visibleRatings(p)[k.key]}/>)}</div><p className="mt-3 text-xs text-muted">{openAll.some(pr => pr.playerId === p.id) ? 'Available on the board' : 'Already selected'}</p></article>)}</div>}
      </section>}
      {showOpening && (
        <DraftOpening
          onStart={() => {
            setOpening(false);
            setPaused(false);
          }}
        />
      )}
      <section className={`relative overflow-hidden rounded-xl border border-brass/30 bg-studio ${showOpening ? "hidden" : ""}`}>
        <FilmStill still="draft" veil="full" />
        <div className="relative space-y-4 px-5 py-5">
          <DraftMasthead round={rnd} pickInRound={pickInRound} overall={overall} total={totalPicks} />
          <p className="text-xs text-muted">
            {sessionLabel(save)} · {namedLeft} named prospects still on the board
          </p>
          <RoundRecapCard />
          <PickReveal />
          {onClock && <OnTheClockPlate seconds={hold} limit={isUser ? 75 : 8} isUser={isUser} needs={myNeeds} />}

          <div className="-mx-1 overflow-x-auto pb-1">
            <p className="mb-2 text-[11px] tracking-[0.35em] text-brass">ROUND {rnd} · THE BOARD</p>
            <ol className="flex gap-2">
              {order.map((id, i) => {
                const overallPickNo = (rnd - 1) * teamsN + i + 1;
                const takenPick = taken.find((pr) => save.players[pr.playerId]?.draftPick === overallPickNo);
                const takenPlayer = takenPick ? save.players[takenPick.playerId] : undefined;
                const mine = !save.sandbox && id === save.userTeamId;
                const onNow = i === pickInRound - 1 && !done;
                return (
                  <li
                    key={`${id}-${i}`}
                    className={`flex w-20 shrink-0 flex-col items-center gap-1 rounded-md border p-2 text-center ${
                      onNow ? "border-brass bg-brass/15" : takenPlayer ? "border-line bg-surface-2" : "border-line bg-surface"
                    } ${mine ? "ring-1 ring-accent" : ""}`}
                  >
                    <Logo id={id as TeamId} size={28} year={save.year} />
                    <span className="text-[10px] text-muted">#{i + 1}</span>
                    <span className="w-full truncate text-[10px] text-fg">
                      {takenPlayer ? playerName(takenPlayer).split(" ").slice(-1)[0] : onNow ? "on the clock" : "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {isUser && (
            <div className="rounded-lg border border-accent/40 bg-accent/15 px-4 py-4">
              <p className="text-[11px] tracking-[0.35em] text-brass">COMMISSIONER · THE GREEN ROOM</p>
              <p className="mt-1 font-display text-2xl">You are on the clock. Open a card and read the kit.</p>
            </div>
          )}

          {cpuUp && !myPicksLeft && !save.sandbox && (
            <p className="rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm">
              {sessionOf(save) === "nfl" && originalLeague(save.userTeamId) === "AFL"
                ? "This is the NFL's draft, so your club doesn't pick here. In 1966 the leagues still drafted separately, and the AFL draft starts right after this one. Jump to my pick takes you straight to your first selection."
                : "You have no picks left in this draft. They were used or traded away. Let the board finish, or auto the rest."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn kind="gold" onClick={() => setTab("primetime")}>
              Draft preview show
            </Btn>
            {cpuUp && (
              <>
                <Btn kind="primary" onClick={() => step({})}>
                  Watch this pick
                </Btn>
                {!save.sandbox && <Btn onClick={() => step({ simToUser: true })}>Jump to my pick</Btn>}
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

      {!save.sandbox && (isUser || myPicksLeft) && <DraftDeals onClock={isUser} paused={() => setPaused(true)} />}

      <div className="flex flex-wrap items-center gap-2">
        {POS_FILTERS.map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => setPosFilter(pos)}
            className={`min-h-11 rounded-md border px-3 text-xs tracking-widest ${
              posFilter === pos ? "bx-chip bx-chip-on" : "bx-chip"
            }`}
          >
            {pos}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or school"
          className="min-h-11 min-w-[12rem] flex-1 rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ol className="space-y-2 lg:col-span-2">
          {board.slice(0, shown).map((pr, i) => {
            const p = save.players[pr.playerId];
            if (!p) return null;
            const keys = scoutKeys(p).slice(0, 4);
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
                    <span className="ml-2 font-body text-xs tracking-widest text-muted">
                      {p.historical ? "NAMED" : "CAMP"}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    {p.collegeNo != null ? `#${p.collegeNo} · ` : ""}{posLabel(p)} · {archLabel(p)} · {p.college ?? "campus"} · {p.revealed ? `${p.ovr} OVR` : `Scout ${ownerGrade(save, p)} · ${scoutLetter(ownerGrade(save, p))}`} · Rd {p.draftRound ?? "—"} ·{" "}
                    {measLine(p)}
                  </p>
                  {!save.sandbox && <FitLine p={p} />}
                  <div className="mt-1.5">
                    <KitChips player={p} compact />
                  </div>
                  <div className="mt-2 grid max-w-lg grid-cols-2 gap-2 sm:grid-cols-4">
                    {keys.map((k) => (
                      <Meter key={k.key} label={k.label} value={visibleRatings(p)[k.key]} />
                    ))}
                  </div>
                </button>
                <div className="flex shrink-0 flex-col gap-2">
                  <Btn disabled={!compareIds.includes(p.id) && compareIds.length >= 3} onClick={() => setCompareIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])}>{compareIds.includes(p.id) ? 'Remove' : 'Compare'}</Btn>
                  <Btn onClick={() => openProfile(p.id)}>Profile</Btn>
                  {isUser && (
                    <Btn kind={i === 0 ? "primary" : "ghost"} onClick={() => step({ userPickPlayerId: p.id })}>
                      Draft
                    </Btn>
                  )}
                </div>
              </li>
            );
          })}
          {!board.length && <li className="rounded-lg border border-line bg-surface p-4 text-muted">No prospects match.</li>}
          {board.length > shown && (
            <li>
              <button
                type="button"
                className="w-full min-h-11 rounded-md border border-line bg-surface text-xs tracking-widest text-muted"
                onClick={() => setShown((n) => n + 40)}
              >
                {board.length - shown} more on the board — show next 40
              </button>
            </li>
          )}
        </ol>
        <aside className="space-y-4">
          {scout && (
            <div className="rounded-xl border border-brass/30 bg-surface p-4">
              <p className="mb-1 text-xs tracking-[0.25em] text-brass">Scout report</p>
              <p className="font-display text-2xl">
                <PlayerLink player={scout} className="inline min-h-0 font-display text-2xl" />
              </p>
              <p className="text-sm text-muted">
                {posLabel(scout)} · {archLabel(scout)} · {scout.college ?? "campus"}
              </p>
              <p className="mt-1 font-display text-3xl tabular text-brass">{ownerGrade(save, scout)}</p>
              <p className="text-xs tracking-widest text-muted">
                {scout.revealed
                  ? "OVERALL — derived from the kit"
                  : `${save.sandbox ? "SCOUT GRADE" : "YOUR GRADE"} · ${scoutLetter(ownerGrade(save, scout))} — true kit sealed`}
              </p>
              {!scout.revealed && !save.sandbox && ownerGrade(save, scout) !== visibleOvr(scout) && (
                <p className="text-xs text-muted">League consensus: {visibleOvr(scout)}</p>
              )}
              {!save.sandbox && <ScoutRange p={scout} />}
              <p className="mt-2 text-sm text-muted">{measLine(scout)}</p>
              <CombineLine p={scout} />
              <div className="mt-3">
                <KitChips player={scout} showDesc />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {scoutKeys(scout).map((k) => (
                  <Meter key={k.key} label={k.label} value={visibleRatings(scout)[k.key]} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn onClick={() => openProfile(scout.id)}>Full profile</Btn>
                {!save.sandbox && !scout.revealed && !scoutState(save).visits.includes(scout.id) && (
                  <Btn
                    disabled={!visitsLeft(save)}
                    onClick={() => desk((s) => proDayVisit(s, scout.id))}
                    title={visitsLeft(save) ? "Send your scouts to his pro day" : "No visits left on this budget"}
                  >
                    Pro day ({visitsLeft(save)} left)
                  </Btn>
                )}
                {isUser && (
                  <Btn kind="primary" onClick={() => step({ userPickPlayerId: scout.id })}>
                    Draft
                  </Btn>
                )}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="mb-3 text-xs tracking-[0.25em] text-muted">Cards turned</p>
            <ul className="space-y-2">
              {taken
                .slice()
                .sort((a, b) => (save.players[b.playerId]?.draftPick ?? -1) - (save.players[a.playerId]?.draftPick ?? -1))
                .slice(0, 12)
                .map((pr) => {
                const p = save.players[pr.playerId];
                return (
                  <li key={pr.playerId} className="flex items-center gap-2 text-sm">
                    {pr.takenBy && <Logo id={pr.takenBy} size={28} year={save.year} />}
                    <span>
                      {p ? (
                        <PlayerLink player={p} className="inline min-h-0 font-display" />
                      ) : (
                        <span className="font-display">—</span>
                      )}
                      <span className="block text-xs text-muted">
                        {p?.pos} · {p ? archLabel(p) : ""} · {p?.ovr} · Rd {p?.draftRound} #{p?.draftPick}
                      </span>
                    </span>
                  </li>
                );
              })}
              {!taken.length && <li className="text-muted">Waiting on the first card.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
    </NightShow>
  );
}

/** Draft-day trades: the phone while you're on the clock, and moving up to a club's pick. */
function DraftDeals({ onClock, paused }: { onClock: boolean; paused: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const note = useGameStore((s) => s.lastDeskNote);
  const [target, setTarget] = useState<string>("");
  const offered = useMemo(() => (onClock ? tradeDownOffers(save) : []), [save, onClock]);
  // One counter per call: ask for more and they either sweeten it or hold firm.
  const [asked, setAsked] = useState<string[]>([]);
  const [countered, setCountered] = useState<Record<string, PickDeal>>({});
  const [reply, setReply] = useState("");
  useEffect(() => {
    setAsked([]);
    setCountered({});
    setReply("");
  }, [save.draftPickIndex]);
  const calls = offered.map((c) => countered[c.partner] ?? c);
  const upcoming = useMemo(() => {
    const q = draftQueue(save);
    return q.slice(save.draftPickIndex + (onClock ? 1 : 0), save.draftPickIndex + 13).map((p, i) => ({ p, slot: save.draftPickIndex + (onClock ? 2 : 1) + i }));
  }, [save, onClock]);
  const deal = target ? tradeUpPackage(save, target) : undefined;
  const run = (d: PickDeal) =>
    desk((s) => {
      const r = executePickDeal(s, { partner: d.partner, give: d.give.map((p) => p.id), get: d.get.map((p) => p.id) });
      return r.ok ? "Deal done. The picks have moved." : r.reason;
    });
  return (
    <section className="hq-panel space-y-3 p-4" aria-label="Draft-day trades">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xl">Draft-day trades</h3>
        <p className="text-xs text-muted">Picks priced on the trade chart. Moving up costs a premium.</p>
      </div>
      {onClock && (
        <div className="space-y-2">
          <p className="text-xs tracking-[0.25em] text-brass">THE PHONE · TRADE DOWN</p>
          {calls.length ? (
            <ul className="space-y-2">
              {calls.map((c) => (
                <li key={c.partner} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                  <Logo id={c.partner} size={28} year={save.year} />
                  <span className="min-w-0 flex-1 basis-[14rem] text-paper">{c.pitch}</span>
                  <span className="tabular text-xs text-muted">
                    chart {Math.round(c.getValue)} for {Math.round(c.giveValue)}
                  </span>
                  {!asked.includes(c.partner) && (
                    <Btn
                      className="min-h-10 px-3 text-xs"
                      onClick={() => {
                        const r = counterOffer(save, countered[c.partner] ?? c);
                        setAsked((a) => [...a, c.partner]);
                        setReply(r.reply);
                        if (r.deal) setCountered((m) => ({ ...m, [c.partner]: r.deal! }));
                      }}
                    >
                      Ask for more
                    </Btn>
                  )}
                  <Btn kind="primary" className="min-h-10 px-3 text-xs" onClick={() => run(countered[c.partner] ?? c)}>
                    Take it
                  </Btn>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nobody behind you is calling. They think their man will be there.</p>
          )}
          {reply && <p className="text-xs text-brass">{reply}</p>}
        </div>
      )}
      <div className="space-y-2">
        <p className="text-xs tracking-[0.25em] text-brass">MOVE UP</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pick to trade up to"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 text-sm"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              if (e.target.value) paused();
            }}
          >
            <option value="">Choose a pick to move up to</option>
            {upcoming
              .filter(({ p }) => p.owner !== save.userTeamId)
              .map(({ p, slot }) => (
                <option key={p.id} value={p.id}>
                  No. {slot} · {displayName(save.year, p.owner)}
                </option>
              ))}
          </select>
        </div>
        {deal && "error" in deal && <p className="text-sm text-brass">{deal.error}</p>}
        {deal && !("error" in deal) && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
            <Logo id={deal.partner} size={28} year={save.year} />
            <span className="min-w-0 flex-1 text-paper">{deal.pitch}</span>
            <span className="tabular text-xs text-muted">
              chart {Math.round(deal.giveValue)} for {Math.round(deal.getValue)}
            </span>
            <Btn
              kind="primary"
              className="min-h-10 px-3 text-xs"
              onClick={() => {
                run(deal);
                setTarget("");
              }}
            >
              Make the trade
            </Btn>
          </div>
        )}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  );
}

/** Combine (or pro-day) numbers for a prospect, era permitting. */
function CombineLine({ p }: { p: Player }) {
  const c = p.combine;
  if (!c) return null;
  if (c.satOut && !c.proDay) return <p className="text-xs text-muted">Sat out the combine drills.</p>;
  const bits = [
    c.forty ? `40: ${c.forty.toFixed(2)}` : "",
    c.bench ? `Bench: ${c.bench}` : "",
    c.vertical ? `Vert: ${c.vertical}"` : "",
    c.cone ? `3-cone: ${c.cone.toFixed(2)}` : "",
  ].filter(Boolean);
  return (
    <p className="text-xs text-paper">
      <span className="text-muted">{c.proDay ? "Pro day" : "Combine"} · </span>
      {bits.join(" · ")}
    </p>
  );
}

/** The owner's scouting budget and pro-day visits for this draft. */
function ScoutDesk() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const st = scoutState(save);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
      <span className="text-xs tracking-[0.25em] text-brass">SCOUTING</span>
      <label className="flex items-center gap-2 text-xs text-muted">
        Budget
        <select
          aria-label="Scouting budget"
          className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-fg"
          value={st.budget}
          onChange={(e) => desk((s) => setScoutBudget(s, e.target.value as keyof typeof BUDGETS))}
        >
          {(Object.keys(BUDGETS) as (keyof typeof BUDGETS)[]).map((k) => (
            <option key={k} value={k}>
              {BUDGETS[k].label} · {BUDGETS[k].visits} pro days
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-muted">{BUDGETS[st.budget].blurb}</span>
      <span className="text-xs text-muted">
        {visitsLeft(save)} pro-day visit{visitsLeft(save) === 1 ? "" : "s"} left
        {save.year < COMBINE_FROM ? " · no combine yet (it starts in 1982)" : ""}
      </span>
    </div>
  );
}

/** Scheme fit for the owner's club, on one line. */
function FitLine({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const fit = schemeFit(save, save.userTeamId, p);
  const tone = fit.label === "Ideal fit" ? "text-good" : fit.label === "Good fit" ? "text-paper" : fit.label === "Poor fit" ? "text-brick" : "text-muted";
  return (
    <p className="mt-0.5 text-xs">
      <span className={`font-semibold ${tone}`}>{fit.label}</span> <span className="text-subtle">· {fit.why}</span>
    </p>
  );
}

/** The scouts' grade as a range, with how sure they are. */
function ScoutRange({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const r = gradeRange(save, p);
  const fit = schemeFit(save, save.userTeamId, p);
  return (
    <div className="mt-2 space-y-1 text-xs">
      {r.lo !== r.hi && (
        <p>
          <span className="text-muted">Scouts&apos; range </span>
          <span className="tabular text-white">
            {r.lo}–{r.hi}
          </span>{" "}
          <span className={r.confidence === "High" ? "text-good" : r.confidence === "Low" ? "text-brick" : "text-paper"}>· {r.confidence} confidence</span>
        </p>
      )}
      <p>
        <span className="text-muted">Scheme fit </span>
        <span className="text-white">{fit.label}</span> <span className="text-subtle">· {fit.why}</span>
      </p>
    </div>
  );
}
