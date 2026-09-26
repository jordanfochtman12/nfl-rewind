import {
  displayName,
  goalProgress,
  milestoneChases,
  previewGame,
  seriesNote,
  type GameResult,
  type SeasonPlan,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

const gradeColor = (g?: string) => (!g ? "text-muted" : g.startsWith("A") ? "text-good" : g === "B" ? "text-brass" : g === "C" ? "text-fg" : "text-brick");

function ReportCard({ plan }: { plan: SeasonPlan }) {
  return (
    <div className="flex items-start gap-4">
      <p className={`font-display text-5xl leading-none ${gradeColor(plan.grade)}`}>{plan.grade}</p>
      <div className="min-w-0">
        <p className="text-sm">{plan.verdict}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {plan.goals.map((g) => (
            <li key={g.id} className="flex gap-2">
              <span className={g.met ? "text-good" : "text-brick"}>{g.met ? "✓" : "✗"}</span>
              <span className={g.met ? "" : "text-muted"}>
                {g.text}
                {g.major && <span className="ml-1 text-[10px] tracking-widest text-subtle">MAJOR</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The owner's expectations for this season, tracked live, and last season's grade. */
export function SeasonPlanCard() {
  const save = useGameStore((s) => s.save)!;
  const plan = save.seasonPlan?.year === save.year ? save.seasonPlan : undefined;
  const last = save.lastPlan;
  if (!plan && !last) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      {plan ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs tracking-[0.25em] text-muted">{save.year} EXPECTATIONS</p>
            <p className="text-xs text-subtle">
              {plan.outlook} · preseason line {plan.projWins.toFixed(1)} wins
            </p>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.goals.map((g) => (
              <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  {g.text}
                  {g.major && <span className="ml-1 text-[10px] tracking-widest text-brass">MAJOR</span>}
                </span>
                <span className="tabular text-xs text-muted">{goalProgress(save, g)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-subtle">
            Graded on awards night. Hitting the major goals wins the city over. Missing them costs you fan support.
          </p>
        </>
      ) : null}
      {last && (!plan || last.year === save.year - 1) && (
        <div className={plan ? "mt-4 border-t border-line pt-4" : ""}>
          <p className="mb-2 text-xs tracking-[0.25em] text-muted">{last.year} REPORT CARD</p>
          <ReportCard plan={last} />
        </div>
      )}
    </section>
  );
}

export { ReportCard };

/** Pregame notes for the owner's next game: line, series, the last meeting, and what's on the line. */
export function MatchupNotes({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  const us = save.userTeamId;
  const opp = (game.homeId === us ? game.awayId : game.homeId) as TeamId;
  const pv = previewGame(save, game);
  const h2h = seriesNote(save, us, opp);
  const watch = milestoneChases(save, 12).filter((c) => c.teamId === us || c.teamId === opp).slice(0, 3);
  return (
    <div className="mt-3 space-y-2 text-sm">
      {pv && (
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="text-xs tracking-widest text-muted">LINE </span>
            <span className="tabular">{pv.line}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-xs tracking-widest text-muted">BOOTH PICK </span>
            <Logo id={pv.pick} size={18} /> {displayName(save.year, pv.pick)}
          </span>
        </p>
      )}
      {h2h ? (
        <p className="text-muted">
          {h2h.series}
          {h2h.last ? ` · ${h2h.last}` : ""}
        </p>
      ) : (
        <p className="text-muted">First meeting of the dynasty.</p>
      )}
      {h2h?.revenge && <p className="rounded-md border border-brick/40 bg-brick/10 px-3 py-2 text-brick">{h2h.revenge}</p>}
      {watch.length > 0 && (
        <div>
          <p className="text-xs tracking-widest text-muted">MILESTONE WATCH</p>
          <ul className="mt-1 space-y-1">
            {watch.map((c) => (
              <li key={c.playerId + c.text}>
                {save.players[c.playerId] ? <PlayerLink player={save.players[c.playerId]!} className="inline min-h-0" /> : c.name}
                <span className="text-muted">: {c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Every dynasty achievement unlocked, newest first. */
export function TrophyCase() {
  const save = useGameStore((s) => s.save)!;
  const list = (save.achievements ?? []).slice().reverse();
  return (
    <section>
      <h3 className="mb-2 text-sm tracking-[0.2em] text-muted">Trophy case</h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Empty for now. Playoff trips, titles and milestones land here.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-lg border border-brass/30 bg-surface p-3">
              <p className="text-[10px] tracking-[0.3em] text-brass">{a.year}</p>
              <p className="font-display text-lg leading-tight">{a.title}</p>
              <p className="text-sm text-muted">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
