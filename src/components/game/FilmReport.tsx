import { teamAbbr, type GameResult, type PlayLog, type TeamId } from "@/lib/game";
import { filmReport } from "@/lib/game/broadcast";

export function FilmReport({
  game,
  log,
  halftime = false,
}: {
  game: GameResult;
  log: PlayLog[];
  halftime?: boolean;
}) {
  const available = log.some((p) => p.snap);
  return (
    <section
      className="film-report p-4 sm:p-5"
      aria-label={halftime ? "Halftime report" : "Postgame analysis"}
    >
      <p className="text-xs uppercase tracking-[.25em] text-brass">
        Rewind studio / {halftime ? "Halftime" : "Postgame"}
      </p>
      <h3 className="mt-1 text-2xl sm:text-3xl">
        {halftime ? "The story through two quarters" : "Inside the result"}
      </h3>
      {!available ? (
        <p className="mt-2 text-sm text-muted">
          Detailed snap analysis starts with newly simulated games. This archived game's box score
          and drive chart remain available.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([game.awayId, game.homeId] as TeamId[]).map((id) => {
              const r = filmReport(log, id),
                sheet = id === game.homeId ? game.callSheets?.home : game.callSheets?.away;
              return (
                <div key={id} className="rounded-lg border border-white/10 bg-black/25 p-4">
                  <h4 className="text-xl">{teamAbbr(id)}</h4>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <strong className="block text-2xl">
                        {r.runs}/{r.passes}
                      </strong>
                      <span className="text-xs text-muted">Runs / throws</span>
                    </div>
                    <div>
                      <strong className="block text-2xl">{r.explosives}</strong>
                      <span className="text-xs text-muted">Explosive plays</span>
                    </div>
                    <div>
                      <strong className="block text-2xl">
                        {r.early ? `${Math.round((r.successful / r.early) * 100)}%` : "—"}
                      </strong>
                      <span className="text-xs text-muted">Early-down success</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-paper">
                    {r.completions}/{r.passes} passing for {r.passYards} yards. {r.sacks} {r.sacks === 1 ? "sack" : "sacks"}{" "}
                    allowed. {r.runs ? (r.rushYards / r.runs).toFixed(1) : "0.0"} yards per rush.
                  </p>
                  {sheet && (
                    <p className="mt-2 text-xs text-muted">
                      Kickoff plan: {sheet.attack} attack ·{" "}
                      {sheet.protection === "maxProtect" ? "max protection" : "balanced protection"}{" "}
                      · {sheet.defensiveFocus ?? "balanced"} defense · {sheet.blitz} blitz.
                    </p>
                  )}
                  <p className="mt-2 text-sm text-brass">
                    {r.recorded === 0
                      ? "No scrimmage sample yet."
                      : r.sacks >= 3
                        ? "Protection deserves a look: pressure ended multiple dropbacks. Extra protection trades receiving options for help up front."
                        : r.early && r.successful / r.early < 0.4
                          ? "Too many early downs fell short. Revisit the run/pass mix before facing another long third down."
                          : r.explosives >= 3
                            ? "Chunk gains supplied the spark. Preserve those opportunities without making the offense predictable."
                            : "The offense had to build drives in smaller pieces. Watch conversion chances and field position."}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Recorded outcomes, not a claim that one setting caused the score. Explosive: 10+ rushing
            / 20+ passing yards. Early-down success: 40% of yards needed on first down, 60% on
            second. Kneels and spikes excluded.
          </p>
        </>
      )}
    </section>
  );
}
