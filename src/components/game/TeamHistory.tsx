import { useState, type ReactNode } from "react";
import { ChampionBanners } from "./BigNight";
import {
  activeTeamIds,
  displayName,
  franchiseHallOfFamers,
  franchiseSummary,
  franchiseTrophies,
  legacyCandidates,
  legacyCase,
  retiredNumbers,
  ringOfHonor,
  type TeamId,
  posLabel,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { CoachBanner, HangingJersey, HofPlaque, type PlaqueTarget } from "./HallOfFame";
import { HonorButtons } from "./Legacy";
import { PlayerLink } from "./PlayerProfile";

function Rafter({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative px-2 pb-4 pt-7">
      <div className="absolute inset-x-3 top-4 h-1.5 rounded-full bg-gradient-to-r from-[#4b5058] via-[#c4c9d0] to-[#4b5058]" aria-hidden />
      <p className="absolute left-4 top-0 font-display text-[10px] font-bold uppercase italic tracking-[0.3em] text-subtle">{label}</p>
      <div className="relative flex flex-wrap justify-center gap-x-2 gap-y-5 sm:justify-start">{children}</div>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface/70">
      <div className="border-b border-white/10 px-4 py-2.5">
        <p className="font-display text-[11px] font-bold uppercase italic tracking-[0.3em] text-brass">{eyebrow}</p>
        <h3 className="font-display text-xl font-bold uppercase italic text-white">{title}</h3>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

/** One club's whole story: the rafters, the Ring, its Hall of Famers, the trophies and every season. */
export function TeamHistory({ records }: { records: (teamId: TeamId) => ReactNode }) {
  const save = useGameStore((s) => s.save)!;
  const [club, setClub] = useState<TeamId>(save.userTeamId);
  const [plaque, setPlaque] = useState<PlaqueTarget | null>(null);
  const [allSeasons, setAllSeasons] = useState(false);
  const year = save.year;
  const sum = franchiseSummary(save, club);
  const trophies = franchiseTrophies(save, club);
  const nums = retiredNumbers(save, club);
  const ring = ringOfHonor(save, club);
  const hof = franchiseHallOfFamers(save, club);
  const waiting = !save.sandbox && club === save.userTeamId ? legacyCandidates(save) : [];
  const seasons = sum.seasons.slice().reverse();
  const firstBook = sum.seasons[0]?.year;
  const clubs = activeTeamIds(year)
    .slice()
    .sort((a, b) => Number(b === save.userTeamId) - Number(a === save.userTeamId) || displayName(year, a).localeCompare(displayName(year, b)));
  const rec = `${sum.wins}-${sum.losses}${sum.ties ? `-${sum.ties}` : ""}`;
  const sbWins = trophies.filter((t) => t.title.startsWith("Super Bowl")).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-brass/40 bg-gradient-to-br from-brass/15 via-black/60 to-black/85">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <Logo id={club} size={84} year={year} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xs font-bold uppercase italic tracking-[0.4em] text-brass">Team history · since {sum.born}</p>
            <h2 className="font-display text-3xl font-bold uppercase italic leading-tight text-white sm:text-4xl">{displayName(year, club)}</h2>
          </div>
          <label className="text-xs tracking-[0.2em] text-muted">
            CLUB{" "}
            <select
              aria-label="Club"
              className="ml-1 min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
              value={club}
              onChange={(e) => {
                setClub(e.target.value as TeamId);
                setAllSeasons(false);
              }}
            >
              {clubs.map((id) => (
                <option key={id} value={id}>
                  {displayName(year, id)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <dl className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-5">
          {[
            ["Championships", String(trophies.length)],
            ["Super Bowl wins", String(sbWins)],
            ["Super Bowl trips", String(sum.superBowlTrips)],
            [`Record since ${save.startingYear}`, rec],
            ["Retired · Ring · HOF", `${nums.length} · ${ring.length} · ${hof.players.length + hof.coaches.length}`],
          ].map(([k, v]) => (
            <div key={k} className="border-r border-white/10 px-4 py-3 last:border-r-0">
              <dt className="text-[11px] tracking-[0.2em] text-muted">{k.toUpperCase()}</dt>
              <dd className="bug-num text-2xl text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section eyebrow="In the rafters" title="Retired numbers">
        {nums.length ? (
          <Rafter label="Nobody wears these again">
            {nums.map((r) => {
              const p = save.players[r.playerId];
              return p ? <HangingJersey key={r.n} player={p} teamId={club} caption={`#${r.n} · retired ${r.year}`} width={116} onOpen={() => setPlaque({ kind: "player", id: p.id })} /> : null;
            })}
          </Rafter>
        ) : (
          <p className="text-sm text-muted">No numbers retired yet. The rafters are empty.</p>
        )}
      </Section>

      <Section eyebrow="Around the stadium" title="Ring of Honor">
        {ring.length ? (
          <Rafter label="The Ring">
            {ring.map((r) => {
              const p = save.players[r.playerId];
              if (!p) return null;
              const c = legacyCase(save, p, club);
              return <HangingJersey key={r.playerId} player={p} teamId={club} width={88} caption={`${posLabel(p)} · ${c?.span ?? ""} · in ${r.year}`} onOpen={() => setPlaque({ kind: "player", id: p.id })} />;
            })}
          </Rafter>
        ) : (
          <p className="text-sm text-muted">No one in the Ring of Honor yet.</p>
        )}
        {waiting.length > 0 && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-xs tracking-[0.3em] text-muted">STILL WAITING ON THE CLUB</p>
            <ul className="mt-2 space-y-2">
              {waiting.map((p) => (
                <li key={p.id} className="rounded-md border border-line bg-black/50 px-3 py-2">
                  <p className="text-sm">
                    <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{posLabel(p)} · #{p.jersey} · {legacyCase(save, p, club)?.span}</span>
                  </p>
                  <HonorButtons player={p} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section eyebrow="Canton" title="The club's Hall of Famers">
        {hof.players.length + hof.coaches.length ? (
          <Rafter label="Enshrined">
            {hof.players.map((p) => (
              <HangingJersey key={p.id} player={p} teamId={club} caption={`${posLabel(p)} · Class of ${p.hofYear ?? ""}`} onOpen={() => setPlaque({ kind: "player", id: p.id })} />
            ))}
            {hof.coaches.map((c) => (
              <CoachBanner key={c.id} coach={c} teamId={club} caption={`Coach · Class of ${c.hofYear ?? ""}`} onOpen={() => setPlaque({ kind: "coach", id: c.id, teamId: club })} />
            ))}
          </Rafter>
        ) : (
          <p className="text-sm text-muted">No Hall of Famer from this club yet.</p>
        )}
      </Section>

      <Section eyebrow="The trophy case" title="Championships">
        <ChampionBanners teamId={club} titles={trophies} />
        {trophies.length ? (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {trophies
              .slice()
              .reverse()
              .map((t) => (
                <li key={`${t.year}-${t.title}`} className="flex items-baseline gap-3 rounded-md border border-brass/30 bg-brass/5 px-3 py-2">
                  <span className="bug-num text-xl text-brass">{t.year}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold uppercase italic text-white">{t.title}</span>
                    {t.detail && <span className="block text-xs text-muted">{t.detail}</span>}
                  </span>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">The trophy case is still empty.</p>
        )}
      </Section>

      <Section eyebrow="Year by year" title="Season by season">
        {seasons.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="font-display text-[11px] font-bold uppercase italic tracking-wider text-subtle">
                  <tr>
                    <th className="px-2 py-1.5">Year</th>
                    <th className="px-2 py-1.5">Record</th>
                    <th className="px-2 py-1.5 text-right">PF</th>
                    <th className="px-2 py-1.5 text-right">PA</th>
                    <th className="px-2 py-1.5">Head coach</th>
                    <th className="px-2 py-1.5">Finish</th>
                  </tr>
                </thead>
                <tbody>
                  {(allSeasons ? seasons : seasons.slice(0, 15)).map((s) => (
                    <tr key={s.year} className={`border-t border-white/5 ${/^Won Super Bowl/.test(s.result) ? "bg-brass/10" : ""}`}>
                      <td className="tabular px-2 py-1.5 text-muted">{s.year}</td>
                      <td className="tabular px-2 py-1.5 text-white">
                        {s.wins}-{s.losses}
                        {s.ties ? `-${s.ties}` : ""}
                      </td>
                      <td className="tabular px-2 py-1.5 text-right text-paper">{s.pf}</td>
                      <td className="tabular px-2 py-1.5 text-right text-paper">{s.pa}</td>
                      <td className="px-2 py-1.5 text-paper">{s.coach ?? "—"}</td>
                      <td className={`px-2 py-1.5 ${/^Won/.test(s.result) ? "text-brass" : /^Missed/.test(s.result) ? "text-muted" : "text-paper"}`}>{s.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {seasons.length > 15 && (
              <button type="button" onClick={() => setAllSeasons((v) => !v)} className="bx-chip mt-3 min-h-10 px-4 text-xs">
                {allSeasons ? "Show the last 15" : `Every season (${seasons.length})`}
              </button>
            )}
            {firstBook && firstBook > save.startingYear && (
              <p className="mt-2 text-xs text-muted">This club's season books begin in {firstBook}; earlier seasons weren't kept for clubs other than yours.</p>
            )}
            {sum.best && (
              <p className="mt-2 text-xs text-muted">
                Best season: {sum.best.year}, {sum.best.wins}-{sum.best.losses}
                {sum.best.ties ? `-${sum.best.ties}` : ""} · {sum.best.result}.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">This club's season books begin with the {year} season; every finished season from here on is kept.</p>
        )}
      </Section>

      {sum.coaches.length > 0 && (
        <Section eyebrow="On the sideline" title="Head coaches">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {sum.coaches.map((c) => (
              <li key={`${c.name}-${c.from}`} className="flex items-baseline justify-between gap-3 rounded-md border border-line bg-black/40 px-3 py-2">
                <span className="font-display text-sm font-bold uppercase italic text-white">{c.name}</span>
                <span className="tabular text-xs text-muted">
                  {c.from === c.to ? c.from : `${c.from}–${c.to}`} · {c.wins}-{c.losses}
                  {c.ties ? `-${c.ties}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {records(club)}
      <HofPlaque target={plaque} onClose={() => setPlaque(null)} />
    </div>
  );
}
