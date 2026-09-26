import { displayName, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";

const clockText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const fieldText = (spot: number) => (spot === 50 ? "midfield" : spot > 50 ? `the opponent's ${100 - spot}` : `your own ${spot}`);

/** The owner's phone rings from the sideline: a close game, late, and a call to make. */
export function CrunchCall() {
  const save = useGameStore((s) => s.save)!;
  const choose = useGameStore((s) => s.crunchChoose);
  const desk = useGameStore((s) => s.desk);
  const sit = save.crunch?.situation;
  if (!sit) return null;
  const game =
    [...save.schedule, ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])].find((g) => g.id === sit.gameId);
  const us = save.userTeamId;
  const opp = (game ? (game.homeId === us ? game.awayId : game.homeId) : us) as TeamId;
  const diff = sit.us - sit.them;
  const state = diff > 0 ? `up ${diff}` : diff < 0 ? `down ${-diff}` : "tied";
  const period = sit.q > 4 ? "Overtime" : `4th quarter`;
  const title =
    sit.kind === "fourth"
      ? `4th-and-${sit.togo} at ${fieldText(sit.spot)}`
      : sit.kind === "two"
        ? "Touchdown. Kick or go for two?"
        : "Kicking off, and the clock is running out";
  const context =
    sit.kind === "fourth"
      ? `${clockText(sit.clock)} left, ${state}.${sit.fgDist && sit.fgDist <= 58 ? ` The kick would be from ${sit.fgDist} yards.` : ""} Come up short and they take over right there.`
      : sit.kind === "two"
        ? `Now ${state} with ${clockText(sit.clock)} to play. One point is nearly automatic; two is a coin flip.`
        : `${state[0]!.toUpperCase()}${state.slice(1)} with ${clockText(sit.clock)} left. Onside and you might steal a possession, or hand them a short field.`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-studio/85 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="crunch-title">
      <article className="w-full max-w-lg overflow-hidden rounded-none border-0 border-brass/40 bg-bg sm:rounded-xl sm:border">
        <header className="border-b border-brass/25 bg-surface px-5 py-4">
          <p className="font-display text-[11px] tracking-[0.4em] text-brass">CRUNCH TIME · THE OWNER&apos;S CALL</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Logo id={us} size={40} />
              <span className="tabular font-display text-4xl">{sit.us}</span>
            </div>
            <div className="text-center">
              <p className="tabular font-display text-2xl text-brass">{clockText(sit.clock)}</p>
              <p className="text-[10px] tracking-[0.3em] text-muted">{period.toUpperCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular font-display text-4xl">{sit.them}</span>
              <Logo id={opp} size={40} />
            </div>
          </div>
          <p className="mt-1 text-center text-xs text-muted">
            {displayName(save.year, us)} vs {displayName(save.year, opp)}
          </p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div>
            <h2 id="crunch-title" className="font-display text-2xl leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{context}</p>
          </div>
          <div className="grid gap-2">
            {sit.options.map((o, i) => (
              <Btn key={o.id} kind={i === 0 ? "primary" : "ghost"} className="w-full justify-start" onClick={() => choose(o.id)}>
                {o.label}
              </Btn>
            ))}
            <Btn kind="ghost" className="w-full justify-start text-muted" onClick={() => choose("coach")}>
              Let the coach decide
            </Btn>
          </div>
          <button
            type="button"
            className="text-xs text-subtle underline"
            onClick={() => {
              desk((s) => {
                s.crunchOn = false;
                return "Crunch-time calls are off. The coach has the headset. Turn them back on in the Owner's Box.";
              });
              choose("coach");
            }}
          >
            Stop asking me. Let the staff handle crunch time.
          </button>
        </div>
      </article>
    </div>
  );
}
