import { useDraftAnnouncer } from "./DraftAnnouncer";
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
  rosterOf,
  SCOUT_KEYS,
  sessionLabel,
  visibleOvr,
  visibleRatings,
  scoutLetter,
  type Player,
  type Pos,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { KitChips } from "./KitChips";
import { PlayerLink } from "./PlayerProfile";

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

function Clock({ seconds }: { seconds: number }) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return (
    <div className="tabular font-display text-4xl text-brass">
      {m}:{String(s).padStart(2, "0")}
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

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export function DraftNight() {
  const announcer = useDraftAnnouncer();
  const save = useGameStore((s) => s.save)!;
  const step = useGameStore((s) => s.step);
  const setTab = useGameStore((s) => s.setTab);
  const openProfile = useGameStore((s) => s.openProfile);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(8);
  const [scoutId, setScoutId] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<Pos | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(40);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const compared = compareIds.map(id => save.players[id]).filter((p): p is Player => !!p);

  const order = useMemo(() => draftOrder(save), [save.year, save.draftPickIndex, save.phase]);
  const teamsN = order.length || 24;
  const onClock = currentDraftTeam(save);
  const rnd = Math.floor(save.draftPickIndex / teamsN) + 1;
  const pickInRound = (save.draftPickIndex % teamsN) + 1;
  const overall = save.draftPickIndex + 1;
  const totalPicks = useMemo(() => draftQueue(save).length, [save.year, save.draftSession, save.phase]);
  const openAll = save.draftBoard.filter((p) => !p.taken);
  const taken = save.draftBoard.filter((p) => p.taken);
  // draftBoard order is big-board rank, not pick order — find the actual most recent
  // pick via Player.draftPick (set authoritatively in makeDraftPick), not array position.
  let last: (typeof taken)[number] | undefined;
  let lastPlayer: Player | undefined;
  for (const pr of taken) {
    const pl = save.players[pr.playerId];
    if (pl?.draftPick != null && (!lastPlayer || (lastPlayer.draftPick ?? -1) < pl.draftPick)) {
      last = pr;
      lastPlayer = pl;
    }
  }
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
  const isUser = save.phase === "draft" && onClock === save.userTeamId;
  const myPicksLeft = draftQueue(save).slice(save.draftPickIndex).some((p) => p.owner === save.userTeamId);
  const cpuUp = save.phase === "draft" && !!onClock && onClock !== save.userTeamId;
  const done = save.phase !== "draft" || !onClock;
  const needs = onClock
    ? [...new Set(rosterOf(save, onClock).sort((a, b) => a.ovr - b.ovr).slice(0, 5).map((p) => p.pos))].join(" · ")
    : "";

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
      {announcer.controls}
      <section className="hq-panel p-4" aria-label="Prospect comparison">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl">Your draft room</h3><p className="mt-1 text-xs text-muted">Compare up to three prospects. Grades reflect scouting uncertainty.</p></div>{compared.length > 0 && <Btn onClick={() => setCompareIds([])}>Clear comparison</Btn>}</div>
        {compared.length === 0 ? <p className="mt-3 text-sm text-muted">Use Compare on any prospect to build your decision board.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{compared.map(p => <article className="rounded-lg border border-line bg-surface-2 p-4" key={p.id}><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-brass">{p.pos} · {p.age} years old</p><h4 className="mt-1 text-xl">{playerName(p)}</h4></div><button className="min-h-9 min-w-9 text-muted" aria-label={`Remove ${playerName(p)} from comparison`} onClick={() => setCompareIds(ids => ids.filter(id => id !== p.id))}>×</button></div><p className="mt-2 text-sm text-muted">{p.college ?? 'Campus'} · {archLabel(p)}</p><p className="mt-2 font-display text-3xl text-brass">{visibleOvr(p)} <span className="text-sm text-muted">{p.revealed ? 'Overall' : 'Scout grade'}</span></p><div className="mt-3 space-y-3">{scoutKeys(p).slice(0, 5).map(k => <Meter key={k.key} label={k.label} value={visibleRatings(p)[k.key]}/>)}</div><p className="mt-3 text-xs text-muted">{openAll.some(pr => pr.playerId === p.id) ? 'Available on the board' : 'Already selected'}</p></article>)}</div>}
      </section>
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="draft" veil="full" />
        <div className="relative space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} {sessionLabel(save).toUpperCase()}</p>
              <h2 className="font-display text-4xl sm:text-5xl">
                Round {rnd}
                <span className="ml-3 text-brass">Pick {pickInRound}</span>
              </h2>
              <p className="text-sm text-muted">
                Overall {Math.min(overall, totalPicks)} of {totalPicks} · {namedLeft} named
                still on the board
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

          <div className="-mx-1 overflow-x-auto pb-1">
            <p className="mb-2 text-[11px] tracking-[0.35em] text-brass">ROUND {rnd} · THE BOARD</p>
            <ol className="flex gap-2">
              {order.map((id, i) => {
                const overallPickNo = (rnd - 1) * teamsN + i + 1;
                const takenPick = taken.find((pr) => save.players[pr.playerId]?.draftPick === overallPickNo);
                const takenPlayer = takenPick ? save.players[takenPick.playerId] : undefined;
                const mine = id === save.userTeamId;
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

          {last && lastPlayer && (
            <div className="rounded-lg border border-brass/25 bg-black/55 px-4 py-4">
              <p className="text-[11px] tracking-[0.4em] text-brass">THE PICK IS IN</p>
              <p className="mt-1 font-display text-lg text-paper">
                With the {ordinal(lastPlayer.draftPick ?? last.slot)} selection, the {last.takenBy ? displayName(save.year, last.takenBy) : "club"} select
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {last.takenBy && <Logo id={last.takenBy} size={48} year={save.year} />}
                <div>
                  <p className="font-display text-3xl">
                    <PlayerLink player={lastPlayer} className="inline min-h-0 font-display text-3xl" />
                  </p>
                  <p className="text-sm text-muted">
                    {lastPlayer.pos} · {archLabel(lastPlayer)} · {lastPlayer.college} · {measLine(lastPlayer)} ·{" "}
                    {lastPlayer.revealed ? `${lastPlayer.ovr} OVR` : `Scout ${visibleOvr(lastPlayer)}`}
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
              <p className="mt-1 font-display text-2xl">You are on the clock. Open a card and read the kit.</p>
            </div>
          )}

          {cpuUp && !myPicksLeft && (
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
                    {p.pos} · {archLabel(p)} · {p.college ?? "campus"} · {p.revealed ? `${p.ovr} OVR` : `Scout ${visibleOvr(p)} · ${scoutLetter(visibleOvr(p))}`} · Rd {p.draftRound ?? "—"} ·{" "}
                    {measLine(p)}
                  </p>
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
                {scout.pos} · {archLabel(scout)} · {scout.college ?? "campus"}
              </p>
              <p className="mt-1 font-display text-3xl tabular text-brass">{visibleOvr(scout)}</p>
              <p className="text-xs tracking-widest text-muted">
                {scout.revealed ? "OVERALL — derived from the kit" : `SCOUT GRADE · ${scoutLetter(visibleOvr(scout))} — true kit sealed`}
              </p>
              <p className="mt-2 text-sm text-muted">{measLine(scout)}</p>
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
  );
}
