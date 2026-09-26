import type { ReactNode } from "react";
import { displayName, teamAbbr, type PrimetimeHonoree, type PrimetimeShow as Show, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { FilmStill } from "./Art";
import { ReportCard } from "./Storylines";
import { DraftPreviewShow } from "./DraftPreview";

function Name({ id, name }: { id: string; name: string }) {
  const save = useGameStore((s) => s.save)!;
  const open = useGameStore((s) => s.openProfile);
  if (!save.players[id]) return <span>{name}</span>;
  return (
    <button type="button" onClick={() => open(id)} className="text-left font-medium hover:text-brass">
      {name}
    </button>
  );
}

function Segment({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={`pt-${id}`} className="scroll-mt-32 border-t border-white/10">
      <div className="flex items-stretch bg-gradient-to-b from-[#161b26] to-[#07090e]">
        <span className="bx-primary flex items-center px-4 font-display text-lg font-extrabold italic">{n}</span>
        <h3 className="flex items-center px-4 py-2.5 text-lg text-white sm:text-xl">{title}</h3>
        <span className="ml-auto w-24 bg-gradient-to-r from-transparent to-red/40 [clip-path:polygon(24px_0,100%_0,100%_100%,0_100%)]" aria-hidden />
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function Honoree({ h, label }: { h: PrimetimeHonoree; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-brass/25 bg-black/40 p-3">
      <Logo id={h.teamId} size={36} />
      <div className="min-w-0">
        <p className="text-[10px] tracking-[0.3em] text-brass">{label.toUpperCase()}</p>
        <p className="font-display text-lg leading-tight">
          <Name id={h.playerId} name={h.name} /> <span className="text-sm text-muted">{h.pos}</span>
        </p>
        <p className="text-sm text-muted">{h.line}</p>
      </div>
    </div>
  );
}

/** Office teaser: the headline and a way into the full show. */
export function PrimetimeTeaser() {
  const save = useGameStore((s) => s.save)!;
  const setTab = useGameStore((s) => s.setTab);
  const show = save.primetime;
  const lead = show?.v === 2 ? (show.stories?.[0]?.headline ?? show.recaps[0]?.line) : undefined;
  return (
    <button
      type="button"
      onClick={() => setTab("primetime")}
      className="sheen group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-studio p-5 text-left transition hover:border-red/60 sm:p-6"
    >
      <FilmStill still="primetime" veil="left" />
      <div className="relative">
        <p className="font-display text-[11px] tracking-[0.4em] text-brass">
          {show?.v === 2 ? `${show.year} · ${show.title?.toUpperCase()}` : "THE WEEK IN REVIEW"}
        </p>
        <p className="bg-gradient-to-b from-white to-[#9aa4b4] bg-clip-text font-display text-5xl font-black uppercase italic leading-none text-transparent">
          Primetime
        </p>
        <p className="mt-2 max-w-xl text-paper">{lead ?? "Sim a Sunday and the show goes on the air."}</p>
        <span className="bx-btn bx-primary mt-4 inline-flex min-h-9 items-center px-4 text-[13px]">
          <span className="bx-in">Watch the full show ▸</span>
        </span>
      </div>
    </button>
  );
}

export function PrimetimeShow() {
  const save = useGameStore((s) => s.save)!;
  if (save.phase === "draft" && save.draftBoard.some((p) => !p.taken)) return <DraftPreviewShow />;
  return <WeeklyShow />;
}

function WeeklyShow() {
  const save = useGameStore((s) => s.save)!;
  const show = save.primetime as Show | undefined;
  if (!show || show.v !== 2) {
    return (
      <section className="relative overflow-hidden rounded-xl border border-brass/25 bg-studio p-6">
        <FilmStill still="primetime" veil="full" />
        <div className="relative">
          <p className="font-display text-xs tracking-[0.4em] text-brass">NFL · THE WEEK IN REVIEW</p>
          <h2 className="mt-2 font-display text-4xl tracking-[0.14em] text-brass">PRIMETIME</h2>
          <p className="mt-3 max-w-xl text-muted">
            Sim a Sunday and the show goes on the air: the stories, every score, players of the week, the injury
            report, power rankings, the playoff picture and next week&apos;s lines.
          </p>
        </div>
      </section>
    );
  }

  const segs: { id: string; title: string; node: ReactNode }[] = [];

  if (show.awards?.length) {
    segs.push({
      id: "awards",
      title: "The awards",
      node: (
        <div className="grid gap-3 sm:grid-cols-2">
          {show.awards.map((a) => (
            <Honoree key={a.label} h={a.honoree} label={a.label} />
          ))}
        </div>
      ),
    });
  }

  if (show.reportCard) {
    segs.push({
      id: "report",
      title: `The owner's report card`,
      node: (
        <div className="space-y-4">
          <ReportCard plan={show.reportCard} />
          {show.achievements?.length ? (
            <div>
              <p className="text-[10px] tracking-[0.3em] text-brass">NEW IN THE TROPHY CASE</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {show.achievements.map((a) => (
                  <li key={a.id} className="rounded-lg border border-brass/30 bg-black/35 p-3">
                    <p className="font-display text-lg leading-tight">{a.title}</p>
                    <p className="text-sm text-muted">{a.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  if (show.stories?.length) {
    segs.push({
      id: "stories",
      title: show.kind === "awards" ? "The season's story" : "Top stories",
      node: (
        <ol className="space-y-3">
          {show.stories.map((st, i) => (
            <li key={`${i}-${st.headline}`} className="flex gap-3 rounded-lg border border-brass/15 bg-black/35 p-3">
              <div className="shrink-0">{st.teamIds[0] ? <Logo id={st.teamIds[0]} size={34} /> : null}</div>
              <div className="min-w-0">
                <p className="text-[10px] tracking-[0.3em] text-brass">{st.tag.toUpperCase()}</p>
                <p className="font-display text-lg leading-snug">{st.headline}</p>
                <p className="text-sm text-muted">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      ),
    });
  }

  if (show.recaps.length) {
    const [feature, ...rest] = show.recaps;
    segs.push({
      id: "recaps",
      title: show.kind === "regular" ? "Around the league" : "The recap",
      node: (
        <div className="space-y-4">
          {feature && (
            <div className="rounded-lg border border-brass/30 bg-black/45 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Logo id={feature.awayId} size={44} />
                <span className="tabular font-display text-4xl">{feature.awayScore}</span>
                <span className="text-brass">@</span>
                <span className="tabular font-display text-4xl">{feature.homeScore}</span>
                <Logo id={feature.homeId} size={44} />
              </div>
              <p className="mt-2 font-display text-xl leading-snug">{feature.line}</p>
              <p className="text-sm text-muted">{feature.note}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-paper">
                {feature.performers?.map((x) => <li key={x}>· {x}</li>)}
              </ul>
            </div>
          )}
          {rest.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {rest.map((r) => (
                <li key={`${r.homeId}-${r.awayId}`} className="rounded-lg border border-brass/10 bg-black/30 p-3">
                  <div className="flex items-center gap-2">
                    <Logo id={r.awayId} size={24} />
                    <span className="tabular">{r.awayScore}</span>
                    <span className="text-subtle">@</span>
                    <span className="tabular">{r.homeScore}</span>
                    <Logo id={r.homeId} size={24} />
                    <span className="ml-auto text-[10px] tracking-widest text-subtle">
                      {teamAbbr(r.awayId)} @ {teamAbbr(r.homeId)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug">{r.line}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted">
                    {r.performers?.slice(0, 2).map((x) => <li key={x}>· {x}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="rounded-lg border border-brass/20 bg-black/40 p-3 text-sm">
            <span className="mr-2 text-[10px] tracking-[0.3em] text-brass">PLAY OF THE NIGHT</span>
            {show.playOfNight}
          </p>
        </div>
      ),
    });
  }

  if (show.potw?.some((p) => p.off || p.def)) {
    segs.push({
      id: "potw",
      title: "Players of the week",
      node: (
        <div className="grid gap-3 sm:grid-cols-2">
          {show.potw.flatMap((p) => [
            p.off ? <Honoree key={`${p.conf}-o`} h={p.off} label={`${p.conf} offensive player of the week`} /> : null,
            p.def ? <Honoree key={`${p.conf}-d`} h={p.def} label={`${p.conf} defensive player of the week`} /> : null,
          ])}
        </div>
      ),
    });
  }

  if (show.allPro?.length) {
    segs.push({
      id: "allpro",
      title: "All-Pro team",
      node: (
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {show.allPro.map((h) => (
            <li key={h.playerId} className="flex min-w-0 items-center gap-2">
              <span className="w-9 shrink-0 text-xs text-brass">{h.pos}</span>
              <Logo id={h.teamId} size={20} />
              <Name id={h.playerId} name={h.name} />
              <span className="ml-auto truncate text-xs text-muted">{h.line}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (show.leaders?.length) {
    segs.push({
      id: "leaders",
      title: show.kind === "awards" ? "Final stat leaders" : "Stat leaders",
      node: (
        <div className="grid gap-3 sm:grid-cols-3">
          {show.leaders.map((b) => (
            <div key={b.label} className="min-w-0 rounded-lg border border-brass/15 bg-black/35 p-3">
              <p className="text-[10px] tracking-[0.3em] text-brass">{b.label.toUpperCase()}</p>
              <ol className="mt-1.5 space-y-1 text-sm">
                {b.rows.map((r, i) => (
                  <li key={r.playerId} className="flex items-center gap-2">
                    <span className="w-3 text-subtle">{i + 1}</span>
                    <Logo id={r.teamId} size={18} />
                    <span className="min-w-0 truncate">
                      <Name id={r.playerId} name={r.name} />
                    </span>
                    <span className="tabular ml-auto">{r.value.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ),
    });
  }

  if (show.chases?.length) {
    segs.push({
      id: "chases",
      title: "Chasing history",
      node: (
        <ul className="space-y-2 text-sm">
          {show.chases.map((c) => (
            <li key={c.playerId + c.text} className="flex min-w-0 items-center gap-2">
              <Logo id={c.teamId} size={20} />
              <span className="min-w-0">
                <Name id={c.playerId} name={c.name} />
                <span className="text-muted"> · {c.text}</span>
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (show.injuries?.length) {
    segs.push({
      id: "injuries",
      title: "Injury report",
      node: (
        <ul className="divide-y divide-brass/10 text-sm">
          {show.injuries.map((i) => (
            <li key={i.playerId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2">
              <Logo id={i.teamId} size={20} />
              <Name id={i.playerId} name={i.name} />
              <span className="text-xs text-muted">{i.pos}</span>
              {i.fresh ? <span className="rounded bg-brick/30 px-1.5 text-[10px] tracking-widest text-brick">NEW</span> : null}
              <span className="ml-auto text-xs text-muted">
                {i.injury} · {i.ir ? "injured reserve" : `out ${i.weeks} wk${i.weeks === 1 ? "" : "s"}`}
              </span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (show.power?.length) {
    segs.push({
      id: "power",
      title: "Power rankings",
      node: (
        <ol className="space-y-1.5">
          {show.power.map((r) => {
            const move = r.prev ? r.prev - r.rank : 0;
            return (
              <li key={r.teamId} className="flex items-center gap-3 rounded-md bg-black/30 px-3 py-2">
                <span className="w-6 font-display text-xl text-brass">{r.rank}</span>
                <span
                  className={`w-8 text-xs tabular ${move > 0 ? "text-good" : move < 0 ? "text-brick" : "text-subtle"}`}
                  aria-label={move ? `${move > 0 ? "up" : "down"} ${Math.abs(move)}` : "no change"}
                >
                  {move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : r.prev ? "—" : "new"}
                </span>
                <Logo id={r.teamId} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{displayName(save.year, r.teamId)}</span>
                  <span className="block truncate text-xs text-muted">{r.blurb}</span>
                </span>
                <span className="tabular text-sm">{r.record}</span>
              </li>
            );
          })}
        </ol>
      ),
    });
  }

  if (show.outlook?.length) {
    segs.push({
      id: "outlook",
      title: "Playoff outlook",
      node: (
        <div className="grid gap-4 sm:grid-cols-2">
          {show.outlook.map((o) => (
            <div key={o.conf} className="min-w-0 rounded-lg border border-brass/15 bg-black/35 p-3">
              <p className="text-[10px] tracking-[0.3em] text-brass">{o.conf.toUpperCase()}</p>
              <ol className="mt-1.5 space-y-1 text-sm">
                {o.seeds.map((x) => (
                  <li key={x.teamId} className="flex items-center gap-2">
                    <span className="w-4 text-brass">{x.seed}</span>
                    <Logo id={x.teamId} size={18} />
                    <span className="min-w-0 truncate">{displayName(save.year, x.teamId)}</span>
                    <span className="ml-auto hidden text-xs text-muted sm:inline">{x.tag}</span>
                    <span className="tabular w-12 shrink-0 text-right">{x.record}</span>
                  </li>
                ))}
              </ol>
              {o.bubble.length > 0 && (
                <>
                  <p className="mt-2 text-[10px] tracking-[0.3em] text-subtle">IN THE HUNT</p>
                  <ul className="mt-1 space-y-1 text-sm text-muted">
                    {o.bubble.map((b) => (
                      <li key={b.teamId} className="flex items-center gap-2">
                        <Logo id={b.teamId} size={16} />
                        <span className="min-w-0 truncate">{displayName(save.year, b.teamId)}</span>
                        <span className="ml-auto shrink-0 text-xs">{b.back > 0 ? `${b.back} GB` : "tied"}</span>
                        <span className="tabular w-12 shrink-0 text-right">{b.record}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (show.predictions?.length || show.superBowlPick) {
    segs.push({
      id: "picks",
      title: "Playoff predictions",
      node: (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {show.predictions?.map((p) => (
              <div key={p.conf} className="flex items-start gap-3 rounded-lg border border-brass/15 bg-black/35 p-3">
                <Logo id={p.teamId} size={36} />
                <div className="min-w-0">
                  <p className="text-[10px] tracking-[0.3em] text-brass">{p.conf} CHAMPION PICK</p>
                  <p className="font-display text-lg">{displayName(save.year, p.teamId)}</p>
                  <p className="text-sm text-muted">{p.note}</p>
                </div>
              </div>
            ))}
          </div>
          {show.superBowlPick && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brass/40 bg-black/50 p-4">
              <Logo id={show.superBowlPick.winner} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] tracking-[0.3em] text-brass">THE DESK&apos;S SUPER BOWL PICK</p>
                <p className="font-display text-xl">
                  {displayName(save.year, show.superBowlPick.winner)} {show.superBowlPick.score}
                </p>
                <p className="text-sm text-muted">{show.superBowlPick.note}</p>
              </div>
              <Logo id={show.superBowlPick.loser} size={30} />
            </div>
          )}
        </div>
      ),
    });
  }

  if (show.previews?.length) {
    segs.push({
      id: "previews",
      title: show.kind === "regular" ? `Next week · week ${show.week + 1}` : "Up next",
      node: (
        <ul className="grid gap-3 sm:grid-cols-2">
          {show.previews.map((p) => (
            <li
              key={`${p.awayId}-${p.homeId}`}
              className={`min-w-0 rounded-lg border p-3 ${p.featured ? "border-brass/60 bg-brass/10 sm:col-span-2" : "border-brass/15 bg-black/30"}`}
            >
              {p.featured && <p className="mb-1 text-[10px] tracking-[0.3em] text-brass">GAME OF THE WEEK</p>}
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Logo id={p.awayId} size={p.featured ? 32 : 22} />
                <span className="min-w-0">
                  {displayName(save.year, p.awayId)} <span className="text-muted">({p.awayRecord})</span>
                </span>
                <span className="text-subtle">@</span>
                <Logo id={p.homeId} size={p.featured ? 32 : 22} />
                <span className="min-w-0">
                  {displayName(save.year, p.homeId)} <span className="text-muted">({p.homeRecord})</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {p.when} · line <span className="tabular text-paper">{p.line}</span> · pick{" "}
                <span className="text-paper">{teamAbbr(p.pick as TeamId)}</span>
              </p>
              {p.note ? <p className="mt-1 text-xs text-subtle">{p.note}</p> : null}
              {p.featured && p.series ? (
                <p className="mt-1 text-xs text-subtle">
                  {p.series}
                  {p.last ? ` · ${p.last}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <article className="relative overflow-hidden rounded-xl border border-white/10 bg-studio shadow-[0_30px_80px_-30px_#000]">
      <FilmStill still="primetime" veil="bottom" className="h-[440px]" />
      <div className="relative">
        <header className="sheen border-b border-white/10 px-5 pb-6 pt-8 sm:px-8 sm:pt-12">
          <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">Hello everybody · welcome to</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            <h2 className="bg-gradient-to-b from-white via-[#e9edf3] to-[#9aa4b4] bg-clip-text pr-2 text-6xl font-black leading-[0.85] text-transparent sm:text-8xl">
              Primetime
            </h2>
            <span className="bx-primary mb-1 inline-flex px-3 py-1 font-display text-sm font-extrabold uppercase italic tracking-wider [transform:skewX(-12deg)]">
              <span className="[transform:skewX(12deg)]">
                {show.year} · {show.title}
              </span>
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-paper">{show.open}</p>
        </header>

        {show.recaps.length > 1 && (
          <div className="overflow-hidden border-b border-white/10 bg-black/70 py-2.5">
            <div className="ticker flex w-max gap-6 px-5">
              {show.recaps.concat(show.recaps).map((r, i) => (
                <div key={`${r.awayId}-${r.homeId}-tick-${i}`} className="flex shrink-0 items-center gap-2 text-xs">
                  <Logo id={r.awayId} size={18} />
                  <span className="tabular text-paper">{r.awayScore}</span>
                  <span className="text-subtle">@</span>
                  <span className="tabular text-paper">{r.homeScore}</span>
                  <Logo id={r.homeId} size={18} />
                </div>
              ))}
            </div>
          </div>
        )}

        <nav aria-label="Show rundown" className="flex flex-wrap gap-2 px-5 py-3">
          {segs.map((s) => (
            <a
              key={s.id}
              href={`#pt-${s.id}`}
              className="bx-chip px-3 py-1.5 text-[12px]"
            >
              {s.title.toUpperCase()}
            </a>
          ))}
        </nav>

        {segs.map((s, i) => (
          <Segment key={s.id} id={s.id} n={i + 1} title={s.title}>
            {s.node}
          </Segment>
        ))}

        <footer className="border-t border-white/10 bg-gradient-to-r from-red-deep/60 to-black/60 px-5 py-5">
          <p className="font-display text-base font-semibold italic text-white">{show.close}</p>
        </footer>
      </div>
    </article>
  );
}
