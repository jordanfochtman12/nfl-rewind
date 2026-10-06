import { useMemo, useState } from "react";
import {
  activeTeamIds,
  conferenceOf,
  displayName,
  divisionKey,
  formatMoney,
  nicknameOf,
  playerName,
  visibleOvr,
  type Player,
  type Pos,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

const POSITIONS: Pos[] = ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "DE", "DT", "OLB", "MLB", "CB", "S", "K", "P"];
const PAGE = 60;

type Scope = "active" | "fa" | "retired" | "all" | TeamId;
type Sort = "grade" | "age" | "name" | "salary" | "exp";

const isClub = (p: Player) => p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof";

/** Every club and every player in the league, searchable, each one a click from a full profile. */
export function LeagueDirectory() {
  const save = useGameStore((s) => s.save)!;
  const openProfile = useGameStore((s) => s.openProfile);
  const openTeam = useGameStore((s) => s.openTeam);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  const [pos, setPos] = useState<Pos | "">("");
  const [sort, setSort] = useState<Sort>("grade");
  const [shown, setShown] = useState(PAGE);
  const year = save.year;
  const ids = activeTeamIds(year).filter((id) => save.teams[id]);

  const players = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = Object.values(save.players);
    rows = rows.filter((p) =>
      scope === "all"
        ? true
        : scope === "active"
          ? isClub(p) || p.teamId === "fa"
          : scope === "fa"
            ? p.teamId === "fa"
            : scope === "retired"
              ? p.teamId === "retired" || p.teamId === "hof"
              : p.teamId === scope,
    );
    if (pos) rows = rows.filter((p) => p.pos === pos);
    if (needle) rows = rows.filter((p) => `${p.firstName} ${p.lastName} ${p.college ?? ""}`.toLowerCase().includes(needle));
    const by: Record<Sort, (a: Player, b: Player) => number> = {
      grade: (a, b) => (scope === "retired" ? (b.peakOvr ?? b.ovr) - (a.peakOvr ?? a.ovr) : visibleOvr(b) - visibleOvr(a)),
      age: (a, b) => a.age - b.age,
      name: (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
      salary: (a, b) => (b.salary ?? 0) - (a.salary ?? 0),
      exp: (a, b) => b.yearsPro - a.yearsPro,
    };
    return rows.sort(by[sort]);
  }, [save, q, scope, pos, sort]);

  const clubCell = (p: Player) => {
    if (isClub(p))
      return (
        <button type="button" onClick={() => openTeam(p.teamId as TeamId)} className="flex min-h-10 items-center gap-1.5 hover:text-brass">
          <Logo id={p.teamId as TeamId} size={18} year={year} />
          <span className="font-display text-xs font-bold uppercase italic">{nicknameOf(year, p.teamId as TeamId)}</span>
        </button>
      );
    return (
      <span className={`font-display text-[11px] font-bold uppercase italic ${p.teamId === "fa" ? "text-good" : p.teamId === "hof" ? "text-brass" : "text-subtle"}`}>
        {p.teamId === "fa" ? "Free agent" : p.teamId === "hof" ? `Hall of Fame ${p.hofYear ?? ""}` : `Retired ${p.retiredYear ?? ""}`}
      </span>
    );
  };

  const confs = [...new Set(ids.map((id) => conferenceOf(year, id) as string))];
  const started = save.schedule.some((g) => g.year === year && g.played);
  const faCount = Object.values(save.players).filter((p) => p.teamId === "fa").length;

  return (
    <div className="space-y-6">
      <section className="hq-panel p-4">
        <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">{year} League</p>
        <h3 className="text-2xl text-white">Every club</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {confs.map((c) => {
            const divs = [...new Set(ids.filter((id) => conferenceOf(year, id) === c).map((id) => divisionKey(year, id)))].sort();
            return (
              <div key={c} className="space-y-2">
                {divs.map((d) => (
                  <div key={d}>
                    <p className="mb-1 font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">{d}</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {ids
                        .filter((id) => divisionKey(year, id) === d)
                        .map((id) => {
                          const t = save.teams[id]!;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => openTeam(id)}
                              className={`flex min-h-11 items-center gap-2 border px-2 py-1.5 text-left hover:border-brass/60 ${!save.sandbox && id === save.userTeamId ? "border-brass/60 bg-brass/10" : "border-white/10 bg-black/40"}`}
                            >
                              <Logo id={id} size={26} year={year} />
                              <span className="min-w-0">
                                <span className="block truncate font-display text-xs font-bold uppercase italic text-white">{nicknameOf(year, id)}</span>
                                <span className="tabular block text-[11px] text-muted">
                                  {t.wins}-{t.losses}
                                  {t.ties ? `-${t.ties}` : ""}
                                  {started ? "" : ` in ${year - 1}`} · {t.roster.length} players
                                </span>
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <section className="hq-panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">Player directory</p>
            <h3 className="text-2xl text-white">{players.length.toLocaleString("en-US")} players</h3>
            <p className="text-xs text-muted">Every player on a roster, {faCount} free agents, and everyone who ever retired. Tap a name for the full profile.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search by name or college"
            aria-label="Search players"
            className="min-h-11 rounded-sm border border-line bg-black/60 px-3 text-sm text-paper placeholder:text-subtle"
          />
          <select
            aria-label="Club"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setShown(PAGE);
            }}
            className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
          >
            <option value="active">Rostered and free agents</option>
            <option value="fa">Free agents</option>
            <option value="retired">Retired and Hall of Fame</option>
            <option value="all">Everyone, ever</option>
            {ids
              .slice()
              .sort((a, b) => displayName(year, a).localeCompare(displayName(year, b)))
              .map((id) => (
                <option key={id} value={id}>
                  {displayName(year, id)}
                </option>
              ))}
          </select>
          <select
            aria-label="Position"
            value={pos}
            onChange={(e) => {
              setPos(e.target.value as Pos | "");
              setShown(PAGE);
            }}
            className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
          >
            <option value="">All positions</option>
            {POSITIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper">
            <option value="grade">Best first</option>
            <option value="salary">Highest paid</option>
            <option value="age">Youngest</option>
            <option value="exp">Most experienced</option>
            <option value="name">Name</option>
          </select>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">
              <tr>
                <th className="px-2 py-1.5">Player</th>
                <th className="px-2 py-1.5">Pos</th>
                <th className="px-2 py-1.5">Club</th>
                <th className="px-2 py-1.5 text-right">Grade</th>
                <th className="px-2 py-1.5 text-right">Age</th>
                <th className="px-2 py-1.5 text-right">Exp</th>
                <th className="px-2 py-1.5 text-right">Contract</th>
              </tr>
            </thead>
            <tbody>
              {players.slice(0, shown).map((p) => {
                const retired = p.teamId === "retired" || p.teamId === "hof";
                return (
                  <tr key={p.id} className={`border-t border-white/5 ${!save.sandbox && p.teamId === save.userTeamId ? "bg-brass/5" : ""}`}>
                    <td className="px-2 py-1">
                      <button type="button" onClick={() => openProfile(p.id)} className="min-h-10 text-left font-display text-sm font-bold uppercase italic text-white hover:text-brass">
                        {playerName(p)}
                      </button>
                      <span className="block text-[11px] text-subtle">{p.college ?? ""}</span>
                    </td>
                    <td className="px-2 py-1 text-paper">{p.pos}</td>
                    <td className="px-2 py-1">{clubCell(p)}</td>
                    <td className="tabular px-2 py-1 text-right text-white">
                      {save.realHistory ? "—" : retired ? <span title="Career peak">{p.peakOvr ?? p.ovr}</span> : p.revealed ? p.ovr : <span className="text-paper">sc {visibleOvr(p)}</span>}
                    </td>
                    <td className="tabular px-2 py-1 text-right text-paper">{p.age}</td>
                    <td className="tabular px-2 py-1 text-right text-paper">{p.yearsPro}</td>
                    <td className="tabular px-2 py-1 text-right text-muted">
                      {retired || save.realHistory ? "—" : p.teamId === "fa" ? "Available" : `${formatMoney(p.salary ?? 0, year)} · ${p.contractYears ?? 0}y`}
                    </td>
                  </tr>
                );
              })}
              {!players.length && (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-muted">
                    Nobody matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {shown < players.length && (
          <button type="button" onClick={() => setShown((n) => n + PAGE * 2)} className="bx-chip mt-3 min-h-10 px-4 text-xs">
            Show more ({(players.length - shown).toLocaleString("en-US")} left)
          </button>
        )}
      </section>
    </div>
  );
}
