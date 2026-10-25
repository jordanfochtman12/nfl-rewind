import { useMemo, useState } from "react";
import {
  activeTeamIds,
  displayName,
  gamesInSeason,
  nicknameOf,
  transactionWire,
  wireSeasons,
  wireWhen,
  type TeamId,
  type WireKind,
  type WireRow,
  posLabel,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

const KINDS: { id: WireKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "trade", label: "Trades" },
  { id: "sign", label: "Signings" },
  { id: "release", label: "Releases" },
  { id: "draft", label: "Draft" },
  { id: "injury", label: "Injured reserve" },
  { id: "coaching", label: "Coaching" },
];

const CHIP: Record<WireKind, string> = {
  trade: "Trade",
  sign: "Signed",
  release: "Released",
  draft: "Drafted",
  injury: "IR",
  coaching: "Coaching",
  other: "Move",
};

const PAGE = 80;

/** The league's transaction wire: every move this season, the big ones of seasons past. */
export function Transactions() {
  const save = useGameStore((s) => s.save)!;
  const openProfile = useGameStore((s) => s.openProfile);
  const openTeam = useGameStore((s) => s.openTeam);
  const seasons = useMemo(() => wireSeasons(save), [save]);
  const [year, setYear] = useState(save.year);
  const [kind, setKind] = useState<WireKind | "all">("all");
  const [club, setClub] = useState<TeamId | "">("");
  const [shown, setShown] = useState(PAGE);
  const ids = activeTeamIds(year).filter((id) => save.teams[id]);
  const past = year < save.year;

  const rows = useMemo(() => {
    let r = transactionWire(save, year);
    if (kind !== "all") r = r.filter((x) => x.kind === kind);
    if (club) r = r.filter((x) => x.teamId === club || x.otherId === club);
    return r;
  }, [save, year, kind, club]);

  const regular = useMemo(() => {
    const weeks = save.schedule.filter((g) => g.year === year).map((g) => g.week);
    return weeks.length ? Math.max(...weeks) : gamesInSeason(year) + 1;
  }, [save, year]);

  // Grouped by when in the year, in the order the log has them (newest first).
  const groups: { when: string; rows: WireRow[] }[] = [];
  for (const r of rows.slice(0, shown)) {
    const when = wireWhen(r, regular);
    const g = groups.at(-1);
    if (g && g.when === when) g.rows.push(r);
    else groups.push({ when, rows: [r] });
  }

  const clubTag = (id: TeamId | undefined) =>
    id ? (
      <button type="button" onClick={() => openTeam(id)} className="flex min-h-10 shrink-0 items-center gap-1.5 hover:text-brass">
        <Logo id={id} size={20} year={year} />
        <span className="font-display text-xs font-bold uppercase italic">{nicknameOf(year, id)}</span>
      </button>
    ) : (
      <span className="font-display text-xs font-bold uppercase italic text-subtle">League</span>
    );

  return (
    <div className="space-y-4">
      <section className="hq-panel p-4">
        <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">{year} Transactions</p>
        <h3 className="text-2xl text-white">The wire</h3>
        <p className="text-xs text-muted">
          {past
            ? "A past season: its trades and the moves of players who mattered, and the coaching carousel."
            : "Every trade, signing, release, draft pick and IR move this season, and the coaching carousel."}{" "}
          Tap a club or a player.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
          <select
            aria-label="Season"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setShown(PAGE);
            }}
            className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
          >
            {seasons.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            aria-label="Club"
            value={club}
            onChange={(e) => {
              setClub(e.target.value as TeamId | "");
              setShown(PAGE);
            }}
            className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
          >
            <option value="">Every club</option>
            {ids
              .slice()
              .sort((a, b) => displayName(year, a).localeCompare(displayName(year, b)))
              .map((id) => (
                <option key={id} value={id}>
                  {displayName(year, id)}
                </option>
              ))}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Kind of move">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => {
                setKind(k.id);
                setShown(PAGE);
              }}
              className="bx-chip min-h-9 px-3"
            >
              {k.label}
            </button>
          ))}
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="hq-panel p-4">
          <p className="text-sm text-muted">Nothing on the wire{club ? ` for the ${nicknameOf(year, club)}` : ""} yet.</p>
        </section>
      ) : (
        groups.map((g, gi) => (
          <section key={`${g.when}-${gi}`} className="hq-panel p-4">
            <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">{g.when}</p>
            <ul className="mt-2 divide-y divide-line">
              {g.rows.map((r) => {
                const p = r.playerId ? save.players[r.playerId] : undefined;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                    <span className="w-20 shrink-0 font-display text-[11px] font-bold uppercase italic text-brass">{CHIP[r.kind]}</span>
                    {clubTag(r.teamId)}
                    {r.otherId && (
                      <>
                        <span aria-hidden className="text-subtle">
                          ⇄
                        </span>
                        {clubTag(r.otherId)}
                      </>
                    )}
                    <span className="min-w-0 flex-1 text-paper">
                      {p && r.kind !== "trade" ? (
                        <button type="button" onClick={() => openProfile(p.id)} className="min-h-10 text-left hover:text-brass">
                          {r.text}
                          <span className="text-muted">
                            {" "}
                            · {posLabel(p)}
                          </span>
                        </button>
                      ) : (
                        r.text
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="bx-chip min-h-11 w-full px-3">
          Show more ({rows.length - shown} left)
        </button>
      )}
    </div>
  );
}
