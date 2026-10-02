import {
  ROSTER_TARGET,
  campBubble,
  cutPlayer,
  deskHoles,
  displayName,
  playerName,
  rosterOf,
  visibleOvr,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import { KitChips } from "./KitChips";

export function CampNight() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const step = useGameStore((s) => s.step);
  const lastDeskNote = useGameStore((s) => s.lastDeskNote);
  const camp = save.camp;
  const roster = rosterOf(save, save.userTeamId);
  const n = roster.length;
  const holes = deskHoles(save, save.userTeamId);
  const bubble = campBubble(save, save.userTeamId);
  const oursHurt = (camp?.injuries ?? []).filter((x) => x.teamId === save.userTeamId);
  const fat = n > ROSTER_TARGET;
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-xl border border-brass/30 bg-studio">
        <FilmStill still="office" veil="full" />
        <div className="relative space-y-4 px-5 py-6">
          <p className="font-display text-xs tracking-[0.4em] text-brass">{save.year} TRAINING CAMP</p>
          <h2 className="font-display text-4xl sm:text-5xl">Cut-down week</h2>
          <p className="max-w-xl text-paper">
            {fat
              ? `You are carrying ${n}. The club is ${ROSTER_TARGET}. September does not wait on a maybe.`
              : `Roster ${n}. The CPU already trimmed its own camps. Yours stays a hole if you cut and do not sign.`}
          </p>
          <p className="text-sm text-muted">
            {displayName(save.year, save.userTeamId)} · {holes.length ? `${holes.length} hole${holes.length === 1 ? "" : "s"}` : "depth covered"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" onClick={() => step({})}>
              Kick off the regular season
            </Btn>
          </div>
          {lastDeskNote && <p className="text-sm text-brick">{lastDeskNote}</p>}
        </div>
      </section>

      <PreviewTeaser />

      <ProgressionCard />

      {camp?.battles && camp.battles.length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">CAMP BATTLES</p>
          <ul className="mt-3 space-y-3">
            {camp.battles.map((b) => (
              <li key={b.pos} className="rounded-lg border border-line bg-bg/40 px-3 py-3">
                <p className="text-xs tracking-[0.2em] text-brass">{b.pos}</p>
                <p className="mt-1 text-sm text-paper">{b.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {oursHurt.length > 0 && (
        <section className="rounded-xl border border-brick/40 bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">TRAINING ROOM</p>
          <ul className="mt-2 space-y-1 text-sm">
            {oursHurt.map((x) => {
              const p = save.players[x.playerId];
              return (
                <li key={x.playerId} className="flex justify-between gap-3">
                  <span>
                    {p ? <PlayerLink player={p} className="inline min-h-0" /> : x.playerId}{" "}
                    <span className="text-muted">{p?.pos}</span>
                  </span>
                  <span className="tabular text-brick">
                    {x.name} · {x.weeks}w
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">BUBBLE</p>
        <p className="mt-1 text-sm text-muted">The names at the bottom. Cut them here or carry them into Week 1.</p>
        <ul className="mt-3 divide-y divide-line">
          {bubble.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <PlayerLink player={p} className="font-display text-base" />
                <p className="text-sm text-muted">
                  {p.pos} · scout {visibleOvr(p)} · {p.age} yrs
                </p>
                <KitChips player={p} compact />
              </div>
              <Btn
                kind="brick"
                className="min-h-9 px-3 text-xs"
                onClick={() =>
                  desk((s) => {
                    const r = cutPlayer(s, s.userTeamId, p.id);
                    return r.ok ? `Cut ${playerName(p)}.` : r.reason;
                  })
                }
              >
                Cut
              </Btn>
            </li>
          ))}
        </ul>
      </section>

      {(camp?.cuts ?? []).length > 0 && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">AROUND THE LEAGUE</p>
          <ul className="mt-2 space-y-1 text-sm">
            {camp!.cuts.slice(0, 12).map((c) => {
              const p = save.players[c.playerId];
              return (
                <li key={`${c.teamId}-${c.playerId}`}>
                  {displayName(save.year, c.teamId)} cut {p ? <PlayerLink player={p} className="inline min-h-0" /> : c.playerId}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Who came back from the offseason better, and who came back slower. */
function ProgressionCard() {
  const save = useGameStore((s) => s.save)!;
  const rep = save.progression;
  if (!rep || rep.year !== save.year) return null;
  const rows = rep.rows
    .map((r) => ({ ...r, p: save.players[r.playerId], d: r.to - r.from }))
    .filter((r) => r.p && r.p.teamId === save.userTeamId);
  const up = rows.filter((r) => r.d >= 2).sort((a, b) => b.d - a.d).slice(0, 6);
  const down = rows.filter((r) => r.d <= -2).sort((a, b) => a.d - b.d).slice(0, 4);
  if (!up.length && !down.length) return null;
  const tag = (p: NonNullable<(typeof rows)[number]["p"]>) =>
    p.draftYear && p.draftRound
      ? `${p.draftYear} ${ordinal(p.draftRound)}-rounder`
      : p.draftYear
        ? `${p.draftYear} free agent`
        : `${p.yearsPro}-yr vet`;
  const headline = up[0] && up[0].d >= 5 ? `${up[0].p!.pos === "QB" ? "Your quarterback" : `Your ${tag(up[0].p!)}`} jumped +${up[0].d}` : "Progression report";
  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <li className="flex items-center gap-3 py-2">
      <span className={`w-12 shrink-0 text-center font-display text-xl ${r.d > 0 ? "text-brass" : "text-brick"}`}>
        {r.d > 0 ? `+${r.d}` : r.d}
      </span>
      <span className="min-w-0 flex-1">
        <PlayerLink player={r.p!} className="inline min-h-0" />{" "}
        <span className="text-sm text-muted">
          {r.p!.pos} · {r.p!.age} · {tag(r.p!)}
        </span>
      </span>
      <span className="tabular shrink-0 text-sm text-muted">
        {r.from} → <span className="text-paper">{r.to}</span>
      </span>
    </li>
  );
  return (
    <section className="rounded-xl border border-brass/40 bg-surface p-4">
      <p className="text-xs tracking-[0.25em] text-brass">CAMP REPORT · WHO CAME BACK DIFFERENT</p>
      <h3 className="mt-1 font-display text-2xl">{headline}</h3>
      {up.length > 0 && <ul className="mt-2 divide-y divide-line">{up.map((r) => <Row key={r.playerId} r={r} />)}</ul>}
      {down.length > 0 && (
        <>
          <p className="mt-3 text-xs tracking-[0.25em] text-muted">LOST A STEP</p>
          <ul className="divide-y divide-line">{down.map((r) => <Row key={r.playerId} r={r} />)}</ul>
        </>
      )}
    </section>
  );
}

/** Camp week is when the network airs its season preview. */
function PreviewTeaser() {
  const setTab = useGameStore((s) => s.setTab);
  const year = useGameStore((s) => s.save!.year);
  return (
    <button
      type="button"
      onClick={() => setTab("primetime")}
      className="sheen group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-red/50 bg-gradient-to-r from-red-deep/70 via-black/80 to-black px-5 py-4 text-left"
    >
      <span className="bx-primary px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] [transform:skewX(-12deg)]">
        <span className="inline-block [transform:skewX(12deg)]">ON AIR</span>
      </span>
      <span className="min-w-0">
        <span className="block font-display text-2xl font-extrabold uppercase italic leading-tight text-white">The {year} Season Preview</span>
        <span className="block text-sm text-paper">Every club, team by team. Projections, award odds, bold predictions and the Super Bowl pick.</span>
      </span>
      <span className="ml-auto shrink-0 font-display text-sm font-bold uppercase italic text-brass group-hover:text-white">Watch on Primetime ▸</span>
    </button>
  );
}
