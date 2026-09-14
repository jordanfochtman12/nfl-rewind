import { useEffect } from "react";
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
  SCOUT_KEYS,
  seasonLabel,
  seasonLog,
  teamColors,
  visibleOvr,
  visibleRatings,
  scoutLetter,
  type Player,
  type SeasonStats,
  type StatCol,
  type StatFamily,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { KitChips } from "./KitChips";

function Meter({ label, value }: { label: string; value: number }) {
  const tone = value >= 90 ? "bg-brass" : value >= 80 ? "bg-accent" : value >= 70 ? "bg-paper" : "bg-muted";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs tracking-wider text-muted">
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
  if (p.injuredWeeks > 0) {
    return (
      <span className="text-brick">
        {p.injuryName ?? "hurt"} · {p.injuredWeeks}w
      </span>
    );
  }
  return <span className="text-accent">Active</span>;
}

function StatTable({
  title,
  cols,
  rows,
  empty,
}: {
  title: string;
  cols: StatCol[];
  rows: { label: string; s: SeasonStats }[];
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
      <table className="mt-2 w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs tracking-wider text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Year</th>
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="px-3 py-2 text-muted">{r.label}</td>
              {cols.map((c) => (
                <td key={c.key} className="tabular px-3 py-2">
                  {c.of ? c.of(r.s) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FamilyBlock({
  title,
  pos,
  families,
  rows,
  empty,
}: {
  title: string;
  pos: Player["pos"];
  families: StatFamily[];
  rows: { label: string; s: SeasonStats }[];
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
        return <StatTable key={f} title={`${title} · ${FAMILY_LABEL[f]}`} cols={colsForFamily(f)} rows={used} empty={empty} />;
      })}
    </div>
  );
}

export function PlayerProfile() {
  const save = useGameStore((s) => s.save);
  const profileId = useGameStore((s) => s.profileId);
  const closeProfile = useGameStore((s) => s.closeProfile);
  const p = save && profileId ? save.players[profileId] : undefined;

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
  const keys = SCOUT_KEYS[p.pos] ?? SCOUT_KEYS.WR;
  const shown = visibleRatings(p);
  const shownOvr = visibleOvr(p);
  const club =
    p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof"
      ? p.teamId === "hof"
        ? "Hall of Fame"
        : p.teamId === "retired"
          ? "Retired"
          : "Free agent"
      : displayName(save.year, p.teamId);
  const headlines = careerHeadlines(p);
  const yearFamilies = familiesOf(p.pos, yearRow);
  const careerFamilies = familiesOf(p.pos, career);
  const logFamilies = familiesAcross(p.pos, log);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-studio/80 p-0 sm:items-center sm:p-4">
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
              {p.pos} · {archLabel(p)}
            </p>
            <h2 id="player-profile-name" className="font-display text-3xl leading-none sm:text-4xl">
              {playerName(p)}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" && (
                <Logo id={p.teamId} size={22} year={save.year} />
              )}
              <span>{club}</span>
              <span>· {p.revealed ? `${p.ovr} OVR` : `Scout ${visibleOvr(p)} · ${scoutLetter(visibleOvr(p))}`}</span>
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
                <dt className="text-muted">Measurables</dt>
                <dd>{measLine(p) || "—"}</dd>
                <dt className="text-muted">Age / exp</dt>
                <dd>
                  {p.age} · {p.yearsPro} yr{p.yearsPro === 1 ? "" : "s"}
                </dd>
                <dt className="text-muted">Came from</dt>
                <dd>{draftLine(p)}</dd>
                <dt className="text-muted">Contract</dt>
                <dd>
                  {p.contractYears} yr · {formatMoney(p.salary ?? 0, save.year)}
                </dd>
                <dt className="text-muted">Potential</dt>
                <dd className="tabular">{p.revealed ? p.potential : "—"}</dd>
                <dt className="text-muted">Morale</dt>
                <dd className="tabular">{p.morale ?? "—"}</dd>
                <dt className="text-muted">Status</dt>
                <dd>
                  <Status p={p} />
                </dd>
              </dl>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
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
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {headlines.map((h) => (
              <div key={h.label} className="rounded-lg border border-line bg-surface px-3 py-3">
                <p className="text-xs tracking-[0.2em] text-muted">{h.label}</p>
                <p className="mt-1 font-display text-2xl tabular leading-none">{h.value}</p>
              </div>
            ))}
          </section>

          <FamilyBlock
            title={`${save.year} season`}
            pos={p.pos}
            families={yearFamilies}
            rows={hasSeasonWork(yearRow) ? [{ label: String(save.year), s: yearRow! }] : []}
            empty="Has not taken a snap this season."
          />

          <FamilyBlock
            title="Career"
            pos={p.pos}
            families={careerFamilies}
            rows={hasSeasonWork(career) ? [{ label: `${log[0]?.year ?? "—"}–${log[log.length - 1]?.year ?? "—"}`, s: career }] : []}
            empty="No professional stats on the card yet."
          />

          <FamilyBlock
            title="Season log"
            pos={p.pos}
            families={logFamilies}
            rows={log.map((s) => ({ label: seasonLabel(s), s }))}
            empty="The log fills after Sundays."
          />

          <section className="rounded-lg border border-brass/30 bg-surface p-4">
            <p className="mb-3 text-xs tracking-[0.25em] text-brass">
              {p.revealed
                ? `Attributes — derived overall ${p.ovr}`
                : `Scout attributes — grade ${shownOvr} · ${scoutLetter(shownOvr)}`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {keys.map((k) => (
                <Meter key={k.key} label={k.label} value={shown[k.key]} />
              ))}
            </div>
          </section>
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
