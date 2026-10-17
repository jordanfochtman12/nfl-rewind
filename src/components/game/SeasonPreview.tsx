import { useMemo, useState, type ReactNode } from "react";
import {
  buildSeasonPreview,
  clubInk,
  displayName,
  gamesInSeason,
  nicknameOf,
  oddsOf,
  roman,
  superBowlNumber,
  teamAbbr,
  type PreviewTeam,
  type SeasonPreview,
  type TeamId,
  posLabel,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { FilmStill } from "./Art";
import { StudioEpisode } from "./StudioEpisode";

/* ------------------------------------------------------------------ small pieces */

function Who({ id, sub }: { id?: string; sub?: string }) {
  const save = useGameStore((s) => s.save)!;
  const open = useGameStore((s) => s.openProfile);
  const p = id ? save.players[id] : undefined;
  if (!p) return <span className="text-muted">—</span>;
  return (
    <span className="min-w-0">
      <button type="button" onClick={() => open(p.id)} className="text-left font-display text-base font-bold uppercase italic leading-tight text-white hover:text-brass">
        {p.firstName} {p.lastName}
      </button>
      <span className="ml-1.5 text-xs text-muted">
        {posLabel(p)}
        {sub ? ` · ${sub}` : ""}
      </span>
    </span>
  );
}

const pctText = (x: number) => (x >= 0.995 ? ">99%" : x > 0 && x < 0.005 ? "<1%" : `${Math.round(x * 100)}%`);

function Pct({ v, tone = "brass", label }: { v: number; tone?: "brass" | "red" | "white"; label?: number }) {
  const bar = tone === "brass" ? "bg-brass" : tone === "red" ? "bg-red" : "bg-white/80";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative h-2 w-full min-w-10 overflow-hidden bg-white/10 [transform:skewX(-14deg)]">
        <span className={`absolute inset-y-0 left-0 ${bar}`} style={{ width: `${Math.max(2, v * 100)}%` }} />
      </span>
      <span className="tabular w-11 shrink-0 text-right text-xs text-paper">{pctText(label ?? v)}</span>
    </span>
  );
}

const GRADE_TONE = (g: string) =>
  g.startsWith("A") ? "bg-brass text-[#140f00]" : g.startsWith("B") ? "bg-white text-black" : g.startsWith("C") ? "bg-chrome-2 text-white" : "bg-red text-white";

function GradeChip({ label, grade }: { label: string; grade: string }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className={`inline-flex min-w-10 justify-center px-1.5 py-0.5 font-display text-base font-extrabold italic [transform:skewX(-12deg)] ${GRADE_TONE(grade)}`}>
        <span className="[transform:skewX(12deg)]">{grade}</span>
      </span>
      <span className="font-display text-[10px] font-bold uppercase italic tracking-wider text-subtle">{label}</span>
    </span>
  );
}

const TIER_TONE: Record<PreviewTeam["tier"], string> = {
  Contender: "bg-brass text-[#140f00]",
  "Playoff hopeful": "bg-white text-black",
  "In the mix": "bg-chrome-2 text-white",
  "Long shot": "bg-white/15 text-paper",
  Rebuilding: "bg-red-deep text-white",
};

function Tier({ t }: { t: PreviewTeam["tier"] }) {
  return (
    <span className={`inline-flex whitespace-nowrap px-2 py-0.5 font-display text-[10px] font-extrabold uppercase italic tracking-wider [transform:skewX(-12deg)] ${TIER_TONE[t]}`}>
      <span className="[transform:skewX(12deg)]">{t}</span>
    </span>
  );
}

/** Win range: the shaded band is the 10th-to-90th, the bar the projection. */
function Range({ t, games }: { t: PreviewTeam; games: number }) {
  const x = (n: number) => `${(n / games) * 100}%`;
  return (
    <span className="relative block h-3 w-full min-w-24 bg-white/5" aria-label={`${t.range[0]} to ${t.range[1]} wins`}>
      <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" aria-hidden />
      <span className="absolute inset-y-0.5 bg-white/25" style={{ left: x(t.range[0]), width: `calc(${x(t.range[1] - t.range[0])} + 2px)` }} />
      <span className="absolute -inset-y-0.5 w-[3px] bg-brass shadow-[0_0_6px_#ffc629]" style={{ left: x(t.projW) }} />
    </span>
  );
}

function Segment({ n, title, kicker, children, id }: { n: number; title: string; kicker?: string; children: ReactNode; id: string }) {
  return (
    <section id={`sp-${id}`} className="scroll-mt-32 border-t border-white/10">
      <div className="flex items-stretch bg-gradient-to-b from-[#161b26] to-[#07090e]">
        <span className="bx-primary flex items-center px-4 font-display text-lg font-extrabold italic">{n}</span>
        <div className="flex min-w-0 flex-col justify-center px-4 py-2">
          {kicker && <span className="font-display text-[10px] font-bold uppercase italic tracking-[0.25em] text-brass">{kicker}</span>}
          <h3 className="text-lg leading-tight text-white sm:text-xl">{title}</h3>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-5">{children}</div>
    </section>
  );
}

const rec = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ""}`;

/* ------------------------------------------------------------------ the club card */

function ClubCard({ t, pv, open, onToggle }: { t: PreviewTeam; pv: SeasonPreview; open: boolean; onToggle: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const year = save.year;
  const ink = clubInk(t.id, year);
  const mine = !save.sandbox && t.id === save.userTeamId;
  const games = gamesInSeason(year);
  const div = pv.divisions.find((d) => d.key === t.division);
  const place = div ? div.order.indexOf(t.id) + 1 : 0;
  return (
    <li id={`club-${t.id}`} className={`scroll-mt-32 overflow-hidden border ${mine ? "border-brass/70" : "border-white/10"} bg-black/40`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5 text-left"
        style={{ background: `linear-gradient(180deg, #ffffff22, transparent 48%, #0000 52%, #0004), linear-gradient(105deg, ${ink.primary} 0%, color-mix(in srgb, ${ink.primary} 45%, #07090e) 55%, #07090e 100%)`, color: ink.onPrimary }}
      >
        <span className="bug-num w-9 text-center text-2xl">{t.rank}</span>
        <span className="flex min-w-0 items-center gap-3">
          <Logo id={t.id} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-extrabold uppercase italic leading-tight">{displayName(year, t.id)}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs opacity-90">
              <Tier t={t.tier} />
              <span>
                {t.division} · {place ? `picked ${place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`}` : ""}
              </span>
              {mine && <span className="bg-brass px-1 font-display text-[10px] font-extrabold italic text-black">YOUR CLUB</span>}
            </span>
          </span>
        </span>
        <span className="text-right">
          <span className="bug-num block text-2xl text-white">{t.projW.toFixed(1)}</span>
          <span className="block font-display text-[10px] font-bold uppercase italic tracking-wider text-white/70">proj. wins {open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && (
        <div className="grid gap-5 p-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-paper">{t.outlook}</p>
            <div className="flex flex-wrap justify-between gap-3 border-y border-white/10 py-3">
              {t.grades.map((g) => (
                <GradeChip key={g.key} label={g.key} grade={g.grade} />
              ))}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">Under center</dt>
                <dd className="mt-1">
                  <Who id={t.qbId} sub={t.qbId ? `${save.players[t.qbId]?.age}` : undefined} />
                </dd>
              </div>
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">Head coach</dt>
                <dd className="mt-1 font-display text-base font-bold uppercase italic text-white">
                  {t.coach ?? "—"} {t.newCoach && <span className="ml-1 bg-red px-1 align-middle text-[10px] not-italic">NEW</span>}
                </dd>
              </div>
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">The stars</dt>
                <dd className="mt-1 space-y-1">
                  {t.stars.map((id) => (
                    <div key={id}>
                      <Who id={id} sub={`${save.players[id]?.ovr}`} />
                    </div>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">X-factor</dt>
                <dd className="mt-1">
                  {t.xFactorId ? (
                    <>
                      <Who id={t.xFactorId} sub={`age ${save.players[t.xFactorId]?.age}`} />
                      <p className="text-xs text-muted">The ceiling is higher than the rating. If he hits, the projection is low.</p>
                    </>
                  ) : (
                    <span className="text-muted">No obvious riser. What you see is what you get.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-good">Arrivals</dt>
                <dd className="mt-1 space-y-1">
                  {t.newcomers.length ? t.newcomers.map((id) => <div key={id}><Who id={id} sub={save.players[id]?.draftYear === year ? "rookie" : "added"} /></div>) : <span className="text-muted">Same roster as last year.</span>}
                </dd>
              </div>
              <div>
                <dt className="font-display text-[11px] font-bold uppercase italic tracking-wider text-red">Departures</dt>
                <dd className="mt-1 space-y-1">
                  {t.departures.length ? t.departures.map((id) => <div key={id}><Who id={id} sub={save.players[id]?.teamId === "retired" || save.players[id]?.teamId === "hof" ? "retired" : save.players[id]?.teamId === "fa" ? "unsigned" : `to ${teamAbbr(save.players[id]!.teamId as TeamId)}`} /></div>) : <span className="text-muted">Nobody important left.</span>}
                </dd>
              </div>
            </dl>
          </div>
          <div className="space-y-4">
            <div className="border border-white/10 bg-black/50 p-3">
              <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-muted">2,000 simulated seasons</p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="bug-num text-4xl text-white">
                  {Math.round(t.projW)}-{Math.round(t.projL)}
                </span>
                <span className="text-right text-xs text-muted">
                  range {t.range[0]}–{t.range[1]} wins
                  <br />
                  last year {rec(t.lastYear.w, t.lastYear.l, t.lastYear.t)}
                  {t.lastYear.playoffs ? " · playoffs" : ""}
                </span>
              </div>
              <div className="mt-2">
                <Range t={t} games={games} />
              </div>
              <div className="mt-3 grid grid-cols-[6.5rem_1fr] items-center gap-x-2 gap-y-1.5 text-xs text-muted">
                <span>Playoffs</span>
                <Pct v={t.playoffPct} />
                <span>Win division</span>
                <Pct v={t.divisionPct} tone="white" />
                <span>Win conference</span>
                <Pct v={t.confPct} tone="white" />
                <span>Win Super Bowl</span>
                <Pct v={t.titlePct} tone="red" />
              </div>
              <p className="mt-2 text-right text-[11px] text-subtle">Title odds {oddsOf(t.titlePct)}</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">Schedule</p>
              <p className="text-paper">
                {t.opener ? `${t.opener} in week one. ` : ""}Strength of schedule ranks {t.sosRank === 1 ? "as the toughest" : `${t.sosRank} of ${pv.teams.length}`}.
              </p>
              {t.toughStretch && <p className="text-xs text-muted">Toughest stretch · {t.toughStretch}</p>}
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <p className="border-l-2 border-good pl-3 text-paper">
                <span className="block font-display text-[11px] font-bold uppercase italic tracking-wider text-good">Best case</span>
                {t.bestCase}
              </p>
              <p className="border-l-2 border-red pl-3 text-paper">
                <span className="block font-display text-[11px] font-bold uppercase italic tracking-wider text-red">Worst case</span>
                {t.worstCase}
              </p>
            </div>
            <blockquote className="bx-primary px-3 py-2 font-display text-base font-bold italic text-white">“{t.verdict}”</blockquote>
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ the show */

export function SeasonPreviewShow() {
  const save = useGameStore((s) => s.save)!;
  // Recomputed when the save changes (a camp cut moves the numbers); pure, so it never touches the season.
  const pv = useMemo(() => buildSeasonPreview(save), [save]);
  const year = save.year;
  const games = gamesInSeason(year);
  // A sandbox has no club of its own: nothing is highlighted and the owner's box doesn't air.
  const u = save.sandbox ? pv.yours.teamId : save.userTeamId;
  const hl = save.sandbox ? undefined : u;
  const T = new Map(pv.teams.map((t) => [t.id, t]));
  const [openIds, setOpenIds] = useState<Set<TeamId>>(() => new Set([u]));
  const [filter, setFilter] = useState<string>("all");
  const toggle = (id: TeamId) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const confs = [...new Set(pv.divisions.map((d) => d.conf))];
  const shown = pv.teams.filter((t) => filter === "all" || pv.divisions.find((d) => d.key === t.division)?.conf === filter || t.division === filter);
  const segs: { id: string; title: string; kicker?: string; node: ReactNode }[] = [];

  segs.push({
    id: "board",
    kicker: "Power rankings",
    title: `The big board: all ${pv.teams.length} teams`,
    node: (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Club</th>
              <th className="px-2 py-1.5">Proj.</th>
              <th className="w-40 px-2 py-1.5">Range</th>
              <th className="w-36 px-2 py-1.5">Playoffs</th>
              <th className="px-2 py-1.5 text-right">Title</th>
            </tr>
          </thead>
          <tbody>
            {pv.teams.map((t, i) => {
              const newTier = i === 0 || pv.teams[i - 1]!.tier !== t.tier;
              const delta = t.projW - t.lastYear.w;
              return [
                newTier ? (
                  <tr key={`tier-${t.tier}`}>
                    <td colSpan={6} className="pt-3">
                      <Tier t={t.tier} />
                    </td>
                  </tr>
                ) : null,
                <tr key={t.id} className={`border-t border-white/5 ${t.id === hl ? "bg-brass/10" : ""}`}>
                  <td className="bug-num px-2 py-1.5 text-lg text-white">{t.rank}</td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => { setOpenIds((s) => new Set(s).add(t.id)); document.getElementById(`club-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="flex items-center gap-2 text-left hover:text-brass">
                      <Logo id={t.id} size={24} />
                      <span className="font-display font-bold uppercase italic">{nicknameOf(year, t.id)}</span>
                      {Math.abs(delta) >= 2 && t.lastYear.w + t.lastYear.l > 0 && (
                        <span className={`text-[11px] ${delta > 0 ? "text-good" : "text-red"}`}>{delta > 0 ? "▲" : "▼"}{Math.abs(Math.round(delta))}</span>
                      )}
                    </button>
                  </td>
                  <td className="tabular px-2 py-1.5 text-white">
                    {t.projW.toFixed(1)}
                    <span className="text-subtle">-{t.projL.toFixed(1)}</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Range t={t} games={games} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Pct v={t.playoffPct} />
                  </td>
                  <td className="tabular px-2 py-1.5 text-right text-paper">{oddsOf(t.titlePct)}</td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-subtle">The bar is the projection; the band covers eight seasons in ten. Arrows compare with last year's record.</p>
      </div>
    ),
  });

  segs.push({
    id: "divisions",
    kicker: "Predicted order of finish",
    title: "Division by division",
    node: (
      <div className="grid gap-3 md:grid-cols-2">
        {pv.divisions.map((d) => (
          <div key={d.key} className="border border-white/10 bg-black/40">
            <p className="flex items-center justify-between bg-gradient-to-b from-[#161b26] to-[#0b0e15] px-3 py-1.5 font-display text-sm font-extrabold uppercase italic tracking-wide text-white">
              {d.key}
              <span className="text-[10px] text-subtle">win division</span>
            </p>
            <ol className="divide-y divide-white/5">
              {d.order.map((id, i) => {
                const t = T.get(id)!;
                return (
                  <li key={id} className={`grid grid-cols-[1.25rem_auto_1fr_3.5rem_6.5rem] items-center gap-2 px-3 py-1.5 text-sm ${id === hl ? "bg-brass/10" : ""}`}>
                    <span className="bug-num text-white/70">{i + 1}</span>
                    <Logo id={id} size={22} />
                    <span className="truncate font-display font-bold uppercase italic">{nicknameOf(year, id)}</span>
                    <span className="tabular text-right text-paper">{rec(Math.round(t.projW), Math.round(t.projL))}</span>
                    <Pct v={t.divisionPct} tone={i === 0 ? "brass" : "white"} />
                  </li>
                );
              })}
            </ol>
            <p className="border-t border-white/5 px-3 py-2 text-xs text-muted">{d.note}</p>
          </div>
        ))}
      </div>
    ),
  });

  segs.push({
    id: "clubs",
    kicker: `${pv.teams.length} teams in ${pv.teams.length} breakdowns`,
    title: "Team by team",
    node: (
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {["all", ...confs, ...(save.sandbox ? [] : [T.get(u)!.division])].map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`bx-chip min-h-8 px-3 text-[11px] ${filter === f ? "bx-chip-on" : ""}`}>
              {f === "all" ? "Every club" : f}
            </button>
          ))}
          <button type="button" onClick={() => setOpenIds(new Set(shown.map((t) => t.id)))} className="bx-chip min-h-8 px-3 text-[11px]">
            Open all
          </button>
          <button type="button" onClick={() => setOpenIds(new Set())} className="bx-chip min-h-8 px-3 text-[11px]">
            Close all
          </button>
        </div>
        <ul className="space-y-2">
          {shown.map((t) => (
            <ClubCard key={t.id} t={t} pv={pv} open={openIds.has(t.id)} onToggle={() => toggle(t.id)} />
          ))}
        </ul>
      </div>
    ),
  });

  const mine = T.get(u)!;
  segs.push({
    id: "yours",
    kicker: "The owner's box",
    title: pv.yours.headline,
    node: (
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-2 text-[15px] text-paper">
          {pv.yours.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-l-2 border-good pl-3 text-sm">
            <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-good">What you can lean on</p>
            {pv.yours.keys.map((k) => (
              <p key={k} className="mt-1 text-paper">{k}</p>
            ))}
          </div>
          <div className="border-l-2 border-red pl-3 text-sm">
            <p className="font-display text-[11px] font-bold uppercase italic tracking-wider text-red">What keeps you up</p>
            {pv.yours.concerns.map((k) => (
              <p key={k} className="mt-1 text-paper">{k}</p>
            ))}
          </div>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-[7rem_1fr] items-center gap-x-2 gap-y-1.5 text-xs text-muted">
              <span>Playoffs</span>
              <Pct v={mine.playoffPct} />
              <span>Division</span>
              <Pct v={mine.divisionPct} tone="white" />
              <span>Super Bowl</span>
              <Pct v={mine.titlePct} tone="red" />
            </div>
          </div>
        </div>
      </div>
    ),
  });

  if (pv.receipts) {
    const rc = pv.receipts;
    segs.push({
      id: "receipts",
      kicker: "Holding ourselves accountable",
      title: rc.headline,
      node: (
        <ul className="space-y-1.5 text-[15px]">
          {rc.lines.map((l) => (
            <li key={l} className="border-l-2 border-brass/60 pl-3 text-paper">{l}</li>
          ))}
        </ul>
      ),
    });
  }

  for (const f of pv.features) {
    segs.push({
      id: `f-${f.id}`,
      kicker: f.kicker,
      title: f.title,
      node: (
        <div>
          <p className="mb-3 text-sm text-muted">{f.intro}</p>
          <ol className="grid gap-2 md:grid-cols-2">
            {f.rows.map((r, i) => (
              <li key={`${r.label}-${i}`} className="grid grid-cols-[auto_auto_1fr] items-center gap-3 border border-white/10 bg-black/40 px-3 py-2">
                <span className="bug-num min-w-8 text-center text-lg text-brass">{r.label.length <= 3 ? r.label : ""}</span>
                {r.teamId ? <Logo id={r.teamId} size={26} /> : <span />}
                <span className="min-w-0">
                  {r.label.length > 3 && <span className="block font-display text-[10px] font-bold uppercase italic tracking-wider text-subtle">{r.label}</span>}
                  {r.playerId ? <Who id={r.playerId} sub={r.value} /> : <span className="font-display text-sm font-bold uppercase italic text-white">{r.value}</span>}
                  {r.note && <span className="block text-xs text-muted">{r.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (pv.storylines.length) {
    segs.push({
      id: "stories",
      kicker: "What everyone will be talking about",
      title: "Storylines",
      node: (
        <div className="grid gap-3 md:grid-cols-2">
          {pv.storylines.map((s) => (
            <article key={s.id} className="border border-white/10 bg-black/40 p-3">
              <p className="flex items-center gap-2 font-display text-[11px] font-bold uppercase italic tracking-[0.2em] text-brass">
                {s.teamIds.slice(0, 3).map((id) => (
                  <Logo key={id} id={id} size={20} />
                ))}
                {s.kicker}
              </p>
              <h4 className="mt-1 font-display text-lg font-extrabold uppercase italic leading-tight text-white">{s.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-paper">{s.body}</p>
            </article>
          ))}
        </div>
      ),
    });
  }

  segs.push({
    id: "awards",
    kicker: "The odds board",
    title: "Awards watch",
    node: (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pv.awards.map((a) => (
          <div key={a.label} className="border border-white/10 bg-black/40">
            <p className="bg-gradient-to-b from-[#161b26] to-[#0b0e15] px-3 py-1.5 font-display text-sm font-extrabold uppercase italic tracking-wide text-white">{a.label}</p>
            <ol className="divide-y divide-white/5">
              {a.picks.map((p, i) => (
                <li key={p.playerId ?? p.coachId} className={`px-3 py-2 ${i === 0 ? "bg-brass/10" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Logo id={p.teamId} size={20} />
                      {p.playerId ? (
                        <Who id={p.playerId} />
                      ) : (
                        <span className="font-display text-base font-bold uppercase italic text-white">{save.coaches[p.coachId!]?.name}</span>
                      )}
                    </span>
                    <span className={`bug-num shrink-0 text-lg ${i === 0 ? "text-brass" : "text-white"}`}>{p.odds}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{p.note}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    ),
  });

  if (pv.bold.length) {
    segs.push({
      id: "bold",
      kicker: "Hold us to it",
      title: "Bold predictions",
      node: (
        <ol className="space-y-2">
          {pv.bold.map((b, i) => (
            <li key={b.text} className="grid grid-cols-[2.5rem_auto_1fr] items-center gap-3 border border-white/10 bg-black/40 px-3 py-2.5">
              <span className="bug-num text-3xl text-red">{i + 1}</span>
              {b.teamIds[0] ? <Logo id={b.teamIds[0]} size={32} /> : <span />}
              <p className="text-[15px] text-white">{b.text}</p>
            </li>
          ))}
        </ol>
      ),
    });
  }

  const watch = (title: string, rows: { playerId?: string; coachId?: string; teamId: TeamId; note: string }[], tone: string) =>
    rows.length ? (
      <div>
        <p className={`mb-2 font-display text-sm font-bold uppercase italic tracking-wide ${tone}`}>{title}</p>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.playerId ?? r.coachId}-${title}-${i}`} className="flex items-start gap-2 border-l-2 border-white/15 pl-3">
              <Logo id={r.teamId} size={20} />
              <span className="min-w-0">
                {r.playerId ? <Who id={r.playerId} /> : <span className="font-display text-base font-bold uppercase italic text-white">{save.coaches[r.coachId!]?.name}</span>}
                <span className="block text-xs text-muted">{r.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  segs.push({
    id: "watch",
    kicker: "Names you'll hear",
    title: "Players to watch",
    node: (
      <div className="grid gap-6 md:grid-cols-2">
        {watch("Rookies who'll play", pv.rookies, "text-brass")}
        {watch("Breakout candidates", pv.breakouts, "text-good")}
        {watch("One more ride", pv.lastRide, "text-white")}
        {watch("Milestones in reach", pv.milestones, "text-brass")}
        {watch("The hot seat", pv.hotSeat, "text-red")}
      </div>
    ),
  });

  if (pv.mustWatch.length) {
    segs.push({
      id: "games",
      kicker: "Circle the dates",
      title: "Must-watch games",
      node: (
        <ul className="grid gap-2 md:grid-cols-2">
          {pv.mustWatch.map((g) => (
            <li key={g.gameId} className="grid grid-cols-[3.25rem_1fr] items-center gap-3 border border-white/10 bg-black/40 px-3 py-2">
              <span className="text-center">
                <span className="block font-display text-[10px] font-bold uppercase italic text-subtle">Week</span>
                <span className="bug-num text-2xl text-white">{g.week}</span>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-display text-sm font-bold uppercase italic text-white">
                  <Logo id={g.awayId} size={22} /> {teamAbbr(g.awayId)} <span className="text-subtle">at</span> <Logo id={g.homeId} size={22} /> {teamAbbr(g.homeId)}
                  <span className="ml-auto text-xs not-italic text-brass">{g.line}</span>
                </span>
                <span className="block text-xs text-muted">{g.note}</span>
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  const contenders = pv.teams.slice().sort((a, b) => b.titlePct - a.titlePct).slice(0, 10);
  segs.push({
    id: "sb",
    kicker: "The road to the Super Bowl",
    title: `The pick: Super Bowl ${roman(superBowlNumber(year))}`,
    node: (
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden border border-brass/40 bg-gradient-to-br from-brass/15 via-black/60 to-black/80 p-4">
          <p className="font-display text-[11px] font-bold uppercase italic tracking-[0.25em] text-brass">The desk's champion</p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <span className="flex flex-col items-center gap-2">
              <Logo id={pv.superBowl.winner} size={72} />
              <span className="font-display text-lg font-extrabold uppercase italic leading-tight text-white">{nicknameOf(year, pv.superBowl.winner)}</span>
            </span>
            <span className="bug-num text-3xl text-brass sm:text-4xl">{pv.superBowl.score}</span>
            <span className="flex flex-col items-center gap-2 opacity-80">
              <Logo id={pv.superBowl.loser} size={56} />
              <span className="font-display text-base font-bold uppercase italic leading-tight text-paper">{nicknameOf(year, pv.superBowl.loser)}</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-paper">{pv.superBowl.note} They win it in {pctText(pv.superBowl.confidence)} of our simulations, the best number in the league. Which also means the field beats them most years.</p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {pv.confChamps.map((c) => (
              <li key={c.conf} className="flex items-center gap-2">
                <Logo id={c.teamId} size={18} /> <span className="font-display font-bold uppercase italic text-white">{c.conf} champion:</span> {displayName(year, c.teamId)} · {c.note.split(". ")[0]}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-display text-sm font-bold uppercase italic tracking-wide text-brass">Title odds · top ten</p>
          <ol className="space-y-1.5">
            {contenders.map((t) => (
              <li key={t.id} className="grid grid-cols-[auto_1fr_6rem_3.5rem] items-center gap-2 text-sm">
                <Logo id={t.id} size={20} />
                <span className="truncate font-display font-bold uppercase italic">{nicknameOf(year, t.id)}</span>
                <Pct v={t.titlePct / Math.max(0.01, contenders[0]!.titlePct)} tone="red" label={t.titlePct} />
                <span className="tabular text-right text-paper">{oddsOf(t.titlePct)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    ),
  });

  if (pv.history || pv.rules) {
    segs.push({
      id: "history",
      kicker: "Before we go",
      title: "The rulebook and the history books",
      node: (
        <div className="grid gap-3 md:grid-cols-2">
          {pv.rules && (
            <p className="border-l-2 border-brass pl-3 text-sm text-paper">
              <span className="block font-display text-[11px] font-bold uppercase italic tracking-wider text-brass">New this year</span>
              {pv.rules}
            </p>
          )}
          {pv.history && (
            <p className="border-l-2 border-white/30 pl-3 text-sm text-paper">
              <span className="block font-display text-[11px] font-bold uppercase italic tracking-wider text-muted">How it really went in {year}</span>
              {pv.history}
            </p>
          )}
        </div>
      ),
    });
  }

  return (
    <article className="relative overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_30px_80px_-30px_#000]">
      <FilmStill still="primetime" veil="bottom" className="h-[460px]" />
      <div className="relative">
        <header className="sheen border-b border-white/10 px-5 pb-6 pt-8 sm:px-8 sm:pt-12">
          <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">The Rewind Network · kickoff special</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h2 className="bg-gradient-to-b from-white via-[#e9edf3] to-[#9aa4b4] bg-clip-text pr-2 text-5xl font-black leading-[0.85] text-transparent sm:text-7xl">Season Preview</h2>
            <span className="bx-primary mb-1 inline-flex px-3 py-1 font-display text-sm font-extrabold uppercase italic tracking-wider [transform:skewX(-12deg)]">
              <span className="[transform:skewX(12deg)]">
                {year} · {pv.teams.length} teams · {games} games
              </span>
            </span>
          </div>
          <ul className="mt-4 max-w-3xl space-y-1.5 text-[15px] text-paper">
            {pv.storylines.slice(0, 4).map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="mt-2 h-2 w-2 shrink-0 bg-red [transform:skewX(-18deg)]" aria-hidden />
                {s.title}
              </li>
            ))}
          </ul>
          <ul className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-3" aria-label="On the desk">
            {(["HOST", "ANALYST", "REPORTER"] as const).map((k) => {
              const c = pv.cast[k];
              const initials = c.name.replace(/“.*”/, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
              return (
                <li key={k} className="flex items-center gap-3 border border-white/10 bg-black/50 px-3 py-2">
                  <span className="bx-primary flex h-10 w-10 shrink-0 items-center justify-center font-display text-base font-extrabold italic">{initials}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-extrabold uppercase italic text-white">{c.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {c.role} · {c.tenure === 1 ? "first year on the desk" : `${c.tenure}th year`.replace(/^(\d*1)th/, "$1st").replace(/^(\d*2)th/, "$1nd").replace(/^(\d*3)th/, "$1rd").replace(/^(1[123])(st|nd|rd)/, "$1th")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {!save.sandbox && <button type="button" onClick={() => document.getElementById("sp-yours")?.scrollIntoView({ behavior: "smooth" })} className="mt-4 flex items-center gap-2 text-left text-sm text-paper hover:text-brass">
            <Logo id={u} size={26} />
            <span>
              <span className="font-display font-bold uppercase italic text-brass">Your club:</span> {pv.yours.headline}. Projected {mine.projW.toFixed(1)} wins, ranked {mine.rank}.
            </span>
          </button>}
        </header>
        <StudioEpisode key={pv.episode.id} episode={pv.episode} year={year} />
        <nav aria-label="Show rundown" className="flex flex-wrap gap-2 px-5 py-3">
          {segs.filter((x) => !(save.sandbox && x.id === "yours")).map((s) => (
            <a key={s.id} href={`#sp-${s.id}`} className="bx-chip px-3 py-1.5 text-[12px]">
              {s.title.toUpperCase()}
            </a>
          ))}
        </nav>
        {segs.filter((x) => !(save.sandbox && x.id === "yours")).map((s, i) => (
          <Segment key={s.id} id={s.id} n={i + 1} title={s.title} kicker={s.kicker}>
            {s.node}
          </Segment>
        ))}
        <footer className="border-t border-white/10 bg-gradient-to-r from-red-deep/60 to-black/60 px-5 py-5">
          <p className="font-display text-base font-semibold italic text-white">
            That's the preview. {displayName(year, pv.superBowl.winner)} are the pick. Kickoff is close. See you Sunday.
          </p>
        </footer>
      </div>
    </article>
  );
}
