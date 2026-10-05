import { useEffect, useState } from "react";
import {
  ARCH_LABEL,
  careerHeadlines,
  careerOf,
  colsForFamily,
  displayName,
  draftLine,
  FAMILY_LABEL,
  familiesAcross,
  familiesOf,
  formatHt,
  formatMoney,
  hasSeasonWork,
  playerName,
  nicknameOf,
  seasonLog,
  teamColors,
  visibleOvr,
  scoutLetter,
  type Player,
  type SeasonStats,
  type StatCol,
  type StatFamily,
  type TeamId,
  honorLines,
  playoffTotals,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { KitChips } from "./KitChips";
import { ProfileExtras } from "./ProfileExtras";

function archLabel(p: Player): string {
  const a = p.arch as keyof typeof ARCH_LABEL | undefined;
  return a && ARCH_LABEL[a] ? ARCH_LABEL[a] : "—";
}

function measLine(p: Player): string {
  const ht = formatHt(p.heightIn);
  const wt = p.weight ? `${p.weight} lbs` : "";
  const fy = p.forty != null ? `${p.forty.toFixed(2)} forty` : "";
  return [ht, wt, fy].filter(Boolean).join(" · ");
}

function Status({ p }: { p: Player }) {
  if (p.teamId === "retired") return <span className="text-muted">Retired {p.retiredYear ?? ""}</span>;
  if (p.teamId === "hof") return <span className="text-brass">Hall of Fame {p.hofYear ?? ""}</span>;
  if (p.teamId === "fa") return <span className="text-muted">Free agent</span>;
  if (p.onIR) {
    return (
      <span className="text-brick">
        Injured reserve{p.injuredWeeks > 0 ? ` · ${p.injuredWeeks}w` : " · ready to activate"}
      </span>
    );
  }
  if (p.injuredWeeks > 0) {
    return (
      <span className="text-brick">
        {p.injuryName ?? "hurt"} · {p.injuredWeeks}w
      </span>
    );
  }
  return <span className="text-good">Active</span>;
}

type StatRow = { label: string; s: SeasonStats; now?: boolean };

/** The club cell: logo and nickname, or "2 teams" for a season split by a trade. */
function ClubCell({ s }: { s: SeasonStats }) {
  const openTeam = useGameStore((st) => st.openTeam);
  const teams = useGameStore((st) => st.save?.teams);
  if (!s.teamId || s.teamId === "two") return <span className="text-muted">{s.teamId === "two" ? "2 teams" : "—"}</span>;
  const id = s.teamId as TeamId;
  return (
    <button type="button" disabled={!teams?.[id]} onClick={() => openTeam(id)} className="flex items-center gap-1.5 whitespace-nowrap text-left hover:text-brass">
      <Logo id={id} size={18} year={s.year} />
      <span className="font-display text-xs font-bold uppercase italic">{nicknameOf(s.year, id)}</span>
    </button>
  );
}

function StatTable({
  title,
  cols,
  rows,
  total,
  clubs,
  empty,
}: {
  title: string;
  cols: StatCol[];
  rows: StatRow[];
  total?: StatRow;
  clubs?: boolean;
  empty: string;
}) {
  if (!rows.length) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">{title}</p>
        <p className="mt-2 text-sm text-muted">{empty}</p>
      </section>
    );
  }
  return (
    <section className="overflow-x-auto rounded-lg border border-line bg-surface">
      <p className="px-4 pt-3 text-xs tracking-[0.25em] text-muted">{title}</p>
      <table className="mt-2 w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs tracking-wider text-muted">
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium">Year</th>
            {clubs && <th className="bg-surface px-3 py-2 font-medium">Team</th>}
            {cols.map((c) => (
              <th key={c.key} className="bg-surface px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.label}-${r.s.teamId}`} className={`border-t border-line ${r.now ? "bg-brass/5" : ""}`}>
              <td className={`sticky left-0 z-10 bg-surface px-3 py-2 tabular ${r.now ? "text-brass" : "text-muted"}`}>{r.label}</td>
              {clubs && (
                <td className="px-3 py-2">
                  <ClubCell s={r.s} />
                </td>
              )}
              {cols.map((c) => (
                <td key={c.key} className="tabular px-3 py-2">
                  {c.of ? c.of(r.s) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t-2 border-brass/50 font-semibold text-white">
              <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-display text-xs font-bold uppercase italic tracking-wider text-brass">Career</td>
              {clubs && <td className="px-3 py-2 text-xs text-muted">{total.label}</td>}
              {cols.map((c) => (
                <td key={c.key} className="tabular px-3 py-2">
                  {c.of ? c.of(total.s) : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

function FamilyBlock({
  title,
  pos,
  families,
  rows,
  total,
  clubs,
  empty,
}: {
  title: string;
  pos: Player["pos"];
  families: StatFamily[];
  rows: StatRow[];
  total?: StatRow;
  clubs?: boolean;
  empty: string;
}) {
  if (!rows.length) {
    return <StatTable title={title} cols={colsForFamily(families[0] ?? "def")} rows={[]} empty={empty} />;
  }
  return (
    <div className="space-y-3">
      {families.map((f) => {
        const used = f === families[0] ? rows : rows.filter((r) => familiesOf(pos, r.s).includes(f));
        if (!used.length) return null;
        return <StatTable key={f} title={`${title} · ${FAMILY_LABEL[f]}`} cols={colsForFamily(f)} rows={used} total={total} clubs={clubs} empty={empty} />;
      })}
    </div>
  );
}

export function PlayerProfile() {
  const save = useGameStore((s) => s.save);
  const profileId = useGameStore((s) => s.profileId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const openTeam = useGameStore((s) => s.openTeam);
  const p = save && profileId ? save.players[profileId] : undefined;
  // History mode shows only the record: no grades, kits, contracts or morale (none are real).
  const real = !!save?.realHistory;
  const [view, setView] = useState<"regular" | "playoffs">("regular");
  useEffect(() => setView("regular"), [profileId]);

  useEffect(() => {
    if (!profileId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProfile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileId, closeProfile]);

  if (!save || !p) return null;

  const teamId = p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? (p.teamId as TeamId) : save.userTeamId;
  const colors = teamColors(teamId, save.year);
  const yearRow = p.stats[save.year];
  const career = careerOf(p);
  const log = seasonLog(p).filter(hasSeasonWork);
  const club =
    p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof"
      ? p.teamId === "hof"
        ? "Hall of Fame"
        : p.teamId === "retired"
          ? "Retired"
          : "Free agent"
      : displayName(save.year, p.teamId);
  const headlines = careerHeadlines(p);
  const honors = honorLines(p);
  const poLog = Object.values(p.playoffStats ?? {})
    .filter(hasSeasonWork)
    .sort((a, b) => a.year - b.year);
  const poCareer = playoffTotals(p);
  const logFamilies = familiesAcross(p.pos, log);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-studio/80 p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close profile" onClick={closeProfile} />
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-name"
        className="relative z-10 flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 border-line bg-bg sm:max-h-[92dvh] sm:rounded-xl sm:border"
      >
        <header className="flex items-start gap-4 border-b border-line bg-surface px-4 py-4 sm:px-5">
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-lg font-display text-3xl tabular text-paper sm:size-20 sm:text-4xl"
            style={{ background: colors.primary, color: colors.secondary }}
          >
            {p.jersey || "—"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.3em] text-brass">
              {real ? p.pos : `${p.pos} · ${archLabel(p)}`}
            </p>
            <h2 id="player-profile-name" className="font-display text-3xl leading-none sm:text-4xl">
              {playerName(p)}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? (
                <button type="button" onClick={() => openTeam(p.teamId as TeamId)} className="inline-flex items-center gap-2 hover:text-brass">
                  <Logo id={p.teamId} size={22} year={save.year} />
                  <span className="underline decoration-white/20 underline-offset-2">{club}</span>
                </button>
              ) : (
                <span>{club}</span>
              )}
              {!real && <span>· {p.revealed ? `${p.ovr} OVR` : `Scout ${visibleOvr(p)} · ${scoutLetter(visibleOvr(p))}`}</span>}
            </p>
          </div>
          <Btn onClick={closeProfile} className="shrink-0">
            Close
          </Btn>
        </header>

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs tracking-[0.25em] text-muted">Vital</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted">College</dt>
                <dd className="font-medium">{p.college || "—"}</dd>
                {!real && (
                  <>
                    <dt className="text-muted">Measurables</dt>
                    <dd>{measLine(p) || "—"}</dd>
                  </>
                )}
                <dt className="text-muted">Age / exp</dt>
                <dd>
                  {p.age} · {p.yearsPro} yr{p.yearsPro === 1 ? "" : "s"}
                </dd>
                <dt className="text-muted">Came from</dt>
                <dd>{draftLine(p)}</dd>
                {!real && (
                  <>
                    <dt className="text-muted">Contract</dt>
                    <dd>
                      {p.contractYears} yr · {formatMoney(p.salary ?? 0, save.year)}
                    </dd>
                    <dt className="text-muted">Potential</dt>
                    <dd className="tabular">{p.revealed ? p.potential : "—"}</dd>
                    <dt className="text-muted">Morale</dt>
                    <dd className="tabular">{p.morale ?? "—"}</dd>
                  </>
                )}
                <dt className="text-muted">Status</dt>
                <dd>
                  <Status p={p} />
                </dd>
              </dl>
            </div>
            {!real && <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs tracking-[0.25em] text-muted">Kit</p>
              <div className="mt-2">
                <KitChips player={p} showDesc />
              </div>
              <p className="mt-3 text-xs text-subtle">
                {p.historical ? "Named historical player." : "Camp / generated body."}{" "}
                {p.revealed
                  ? "Overall is derived from the attribute kit."
                  : "Scouts have a grade. The true kit is sealed until he plays."}
              </p>
            </div>}
          </section>

          {honors.length > 0 && (
            <section className="rounded-lg border border-brass/40 bg-surface p-4">
              <p className="text-xs tracking-[0.25em] text-brass">Honors</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {honors.map((h) => (
                  <li key={h.label} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{h.label}</span>
                    <span className="tabular text-xs text-muted">{h.years.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div role="tablist" aria-label="Stat view" className="flex gap-2">
            {(
              [
                ["regular", "Regular season"],
                ["playoffs", `Playoffs${poLog.length ? ` · ${poLog.length}` : ""}`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={view === k}
                onClick={() => setView(k)}
                className={`min-h-9 rounded-full border px-4 text-xs tracking-[0.15em] ${
                  view === k ? "bx-chip bx-chip-on" : "bx-chip"
                }`}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          {view === "regular" ? (
            <>
              <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {headlines.map((h) => (
                  <div key={h.label} className="rounded-lg border border-line bg-surface px-3 py-3">
                    <p className="text-xs tracking-[0.2em] text-muted">{h.label}</p>
                    <p className="mt-1 font-display text-2xl tabular leading-none">{h.value}</p>
                  </div>
                ))}
              </section>

              <FamilyBlock
                title="Year by year"
                pos={p.pos}
                families={logFamilies}
                clubs
                rows={log.map((s) => ({ label: String(s.year), s, now: s.year === save.year }))}
                total={hasSeasonWork(career) ? { label: `${log.length} season${log.length === 1 ? "" : "s"}`, s: career } : undefined}
                empty={hasSeasonWork(yearRow) ? "The log fills after Sundays." : "No professional stats on the card yet."}
              />
            </>
          ) : (
            <>
              <FamilyBlock
                title="Playoffs year by year"
                pos={p.pos}
                families={familiesAcross(p.pos, poLog)}
                clubs
                rows={poLog.map((s) => ({ label: String(s.year), s }))}
                total={hasSeasonWork(poCareer) ? { label: `${poLog.length} postseason${poLog.length === 1 ? "" : "s"}`, s: poCareer } : undefined}
                empty="Has not played a postseason game."
              />
            </>
          )}

          <ProfileExtras p={p} />
        </div>
      </article>
    </div>
  );
}

export function PlayerLink({
  player,
  className = "",
}: {
  player: Player;
  className?: string;
}) {
  const openProfile = useGameStore((s) => s.openProfile);
  return (
    <button
      type="button"
      onClick={() => openProfile(player.id)}
      className={`min-h-11 text-left hover:text-brass ${className}`}
    >
      {playerName(player)}
    </button>
  );
}
