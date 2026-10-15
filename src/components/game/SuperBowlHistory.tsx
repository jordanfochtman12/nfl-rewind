import { useMemo, useState } from "react";
import { clubInk, displayName, nicknameOf, roman, superBowlBook, teamAbbr, type BowlGame, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

function Mvp({ g }: { g: BowlGame }) {
  const save = useGameStore((s) => s.save)!;
  const p = g.mvpId ? save.players[g.mvpId] : undefined;
  if (p) return <PlayerLink player={p} className="inline min-h-0" />;
  return <>{g.mvpName ?? "—"}</>;
}

/** One game as a ticket stub: number, the two clubs, the score, the site and the MVP. */
function GameCard({ g, mine }: { g: BowlGame; mine: TeamId }) {
  const ink = clubInk(g.winner, g.year);
  const ours = g.winner === mine || g.loser === mine;
  return (
    <li
      className={`relative overflow-hidden rounded-lg border bg-studio p-3 ${ours ? "border-brass/70" : "border-line"}`}
      style={{ boxShadow: `inset 4px 0 0 ${ink.primary}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-lg tracking-wide text-brass">SUPER BOWL {roman(g.number)}</p>
        <p className="tabular text-xs text-muted">{g.year} season</p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Logo id={g.winner} year={g.year} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl">{displayName(g.year, g.winner)}</p>
          <p className="truncate text-sm text-muted">
            def. {displayName(g.year, g.loser)}
          </p>
        </div>
        <p className="tabular font-display text-2xl">
          {g.winScore}
          <span className="text-muted">–{g.loseScore}</span>
        </p>
        <Logo id={g.loser} year={g.year} size={26} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {g.site}
        {g.city ? `, ${g.city}` : ""} · MVP <Mvp g={g} />
      </p>
    </li>
  );
}

/** Every Super Bowl in this league: champions, rings, dynasties, record games, the waiting. */
export function SuperBowlHistory({ compact = false }: { compact?: boolean }) {
  const save = useGameStore((s) => s.save)!;
  const book = useMemo(() => superBowlBook(save), [save]);
  const [order, setOrder] = useState<"new" | "old">("new");
  const [club, setClub] = useState<TeamId | "all">("all");
  if (!book.games.length) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="font-display text-xs tracking-[0.4em] text-brass">SUPER BOWL HISTORY</p>
        <p className="mt-2 text-muted">The almanac is empty. Super Bowl I has not been played.</p>
      </section>
    );
  }
  const last = book.games.at(-1)!;
  const champInk = clubInk(last.winner, last.year);
  const shown = book.games
    .filter((g) => club === "all" || g.winner === club || g.loser === club)
    .slice()
    .sort((a, b) => (order === "new" ? b.year - a.year : a.year - b.year));
  const list = compact ? shown.slice(0, 6) : shown;
  const nick = (id: TeamId) => nicknameOf(save.year, id);
  return (
    <section className="space-y-5" aria-labelledby="sb-history-title">
      {/* The reigning champion. */}
      <div className="relative overflow-hidden rounded-xl border border-brass/40 bg-studio">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 15% 50%, ${champInk.primary}55, transparent 60%)` }} />
        <div className="relative flex flex-wrap items-center gap-5 px-5 py-6">
          <Logo id={last.winner} year={last.year} size={84} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs tracking-[0.4em] text-brass">
              {book.defending && book.defending.streak > 1 ? `CHAMPIONS ${book.defending.streak} YEARS RUNNING` : "REIGNING CHAMPIONS"}
            </p>
            <h3 id="sb-history-title" className="font-display text-3xl sm:text-4xl">
              {displayName(last.year, last.winner)}
            </h3>
            <p className="text-muted">
              Super Bowl {roman(last.number)} · {last.winScore}–{last.loseScore} over the {nicknameOf(last.year, last.loser)} · MVP <Mvp g={last} />
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-3xl">{book.games.length}</p>
              <p className="text-[11px] tracking-[0.2em] text-muted">PLAYED</p>
            </div>
            <div>
              <p className="font-display text-3xl">{book.clubs.filter((c) => c.wins).length}</p>
              <p className="text-[11px] tracking-[0.2em] text-muted">CHAMPIONS</p>
            </div>
            <div>
              <p className="font-display text-3xl">{book.waiting.length}</p>
              <p className="text-[11px] tracking-[0.2em] text-muted">STILL WAITING</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rings. */}
        <div className="min-w-0 rounded-xl border border-line bg-surface p-4 lg:col-span-2">
          <p className="text-xs tracking-[0.25em] text-muted">MOST RINGS</p>
          <ol className="mt-3 space-y-2">
            {book.clubs.slice(0, compact ? 5 : 12).map((c, i) => (
              <li key={c.teamId} className="flex items-center gap-3">
                <span className="tabular w-5 text-right text-sm text-muted">{i + 1}</span>
                <Logo id={c.teamId} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base">{nick(c.teamId)}</span>
                  <span className="block truncate text-xs text-muted">
                    {c.wins}–{c.losses} in Super Bowls{c.years.length ? ` · ${c.years.slice(-4).join(", ")}${c.years.length > 4 ? "…" : ""}` : ""}
                  </span>
                </span>
                <span className="flex gap-0.5" aria-label={`${c.wins} titles`}>
                  {Array.from({ length: Math.min(c.wins, 8) }, (_, k) => (
                    <span key={k} className="inline-block h-4 w-2.5 rounded-sm" style={{ background: clubInk(c.teamId, save.year).primary, boxShadow: "inset 0 0 0 1px #ffffff55" }} />
                  ))}
                  {c.wins > 8 && <span className="text-xs text-muted">+{c.wins - 8}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Dynasties. */}
        <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">DYNASTIES</p>
          {book.dynasties.length ? (
            <ul className="mt-3 space-y-2">
              {book.dynasties.slice(0, 6).map((d) => (
                <li key={`${d.teamId}-${d.from}`} className="flex items-center gap-2">
                  <Logo id={d.teamId} year={d.from} size={24} />
                  <span className="flex-1 text-sm">
                    <span className="font-display text-base">{nicknameOf(d.from, d.teamId)}</span>{" "}
                    <span className="text-muted">
                      {d.from}–{d.to}
                    </span>
                  </span>
                  <span className="text-xs tracking-wider text-brass">{d.label.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No one has won two close together yet.</p>
          )}
          {book.mvpRepeat.length > 0 && (
            <>
              <p className="mt-4 text-xs tracking-[0.25em] text-muted">MULTIPLE MVPs</p>
              <p className="mt-1 text-sm">{book.mvpRepeat.slice(0, 4).map((m) => `${m.name} (${m.count})`).join(", ")}</p>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs tracking-[0.25em] text-muted">RECORD GAMES</p>
            <ul className="mt-3 space-y-2 text-sm">
              {book.records.map((r) => (
                <li key={r.label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-muted">{r.label}</span>
                  <span>
                    SB {roman(r.game.number)}: {teamAbbr(r.game.winner)} {r.game.winScore}, {teamAbbr(r.game.loser)} {r.game.loseScore}{" "}
                    <span className="text-muted">({r.note})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs tracking-[0.25em] text-muted">STILL WAITING FOR A RING</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {book.waiting.map((id) => (
                <li key={id} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm">
                  <Logo id={id} size={20} />
                  {nick(id)}
                  {book.neverBeen.includes(id) && <span className="text-xs text-muted">· never been</span>}
                </li>
              ))}
              {!book.waiting.length && <li className="text-sm text-muted">Every club has a ring.</li>}
            </ul>
            {book.leagueTitles.length > 0 && (
              <>
                <p className="mt-4 text-xs tracking-[0.25em] text-muted">BEFORE THE MERGER</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {book.leagueTitles.map((t) => (
                    <li key={`${t.year}-${t.league}`}>
                      {t.year} {t.league} champion: {displayName(t.year, t.teamId)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* Every game. */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs tracking-[0.25em] text-muted">{compact ? "RECENT CHAMPIONS" : "EVERY SUPER BOWL"}</p>
          {!compact && (
            <div className="flex flex-wrap gap-2 text-sm">
              <select aria-label="Club" className="min-h-11 rounded-md border border-line bg-studio px-2 py-1" value={club} onChange={(e) => setClub(e.target.value as TeamId | "all")}>
                <option value="all">All clubs</option>
                {book.clubs.map((c) => (
                  <option key={c.teamId} value={c.teamId}>
                    {nick(c.teamId)}
                  </option>
                ))}
              </select>
              <select aria-label="Order" className="min-h-11 rounded-md border border-line bg-studio px-2 py-1" value={order} onChange={(e) => setOrder(e.target.value as "new" | "old")}>
                <option value="new">Newest first</option>
                <option value="old">Oldest first</option>
              </select>
            </div>
          )}
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((g) => (
            <GameCard key={g.year} g={g} mine={save.userTeamId} />
          ))}
        </ul>
      </div>
    </section>
  );
}
