import { clubInk, displayName, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { LiveBroadcast } from "./LiveBroadcast";
import { useState } from "react";

const clockText = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
import { fieldText, displayYards } from "../../lib/game/fieldText.ts";

/** The owner's phone rings from the sideline: a close game, late, and a call to make. */
export function CrunchCall() {
  const save = useGameStore((s) => s.save)!;
  const choose = useGameStore((s) => s.crunchChoose);
  const desk = useGameStore((s) => s.desk);
  const sit = save.crunch?.situation;
  const [reachedKey, setReachedKey] = useState<string | null>(null);
  if (!sit) return null;
  const key = `${sit.gameId}:${sit.index}`;
  const reached = reachedKey === key || !sit.log?.length;
  const game =
    [...save.schedule, ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])].find((g) => g.id === sit.gameId);
  const us = save.userTeamId;
  const opp = (game ? (game.homeId === us ? game.awayId : game.homeId) : us) as TeamId;
  const diff = sit.us - sit.them;
  const state = diff > 0 ? `up ${diff}` : diff < 0 ? `down ${-diff}` : "tied";
  const period = sit.q > 4 ? "Overtime" : `4th quarter`;
  const title =
    sit.kind === "fourth"
      ? `4th-and-${displayYards(sit.togo)} at ${fieldText(sit.spot)}`
      : sit.kind === "two"
        ? "Touchdown. Kick or go for two?"
        : "Kicking off, and the clock is running out";
  const context =
    sit.kind === "fourth"
      ? `${clockText(sit.clock)} left, ${state}.${sit.fgDist && sit.fgDist <= 58 ? ` The kick would be from ${displayYards(sit.fgDist)} yards.` : ""} Come up short and they take over right there.`
      : sit.kind === "two"
        ? `Now ${state} with ${clockText(sit.clock)} to play. One point is nearly automatic; two is a coin flip.`
        : `${state[0]!.toUpperCase()}${state.slice(1)} with ${clockText(sit.clock)} left. Onside and you might steal a possession, or hand them a short field.`;

  if (!reached && game && sit.log) {
    const resume = save.liveResume?.gameId === sit.gameId ? save.liveResume.index : 0;
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-studio/85 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Your game, live">
        <article className="w-full max-w-2xl overflow-hidden rounded-none border-0 border-white/15 bg-bg shadow-[0_30px_90px_-20px_#000] sm:rounded-xl sm:border">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-b from-[#161b26] to-[#07090e] px-4 py-2.5">
            <p className="bx-primary px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] [transform:skewX(-12deg)]">
              <span className="inline-block [transform:skewX(12deg)]">LIVE · YOUR GAME</span>
            </p>
            <p className="font-display text-xs font-bold uppercase italic tracking-wider text-brass">A big call is coming</p>
          </div>
          <LiveBroadcast game={game} log={sit.log} startAt={resume} compact final={false} onReachEnd={() => setReachedKey(key)} />
          <div className="px-4 py-3">
            <Btn onClick={() => setReachedKey(key)}>Skip to the call</Btn>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-studio/85 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="crunch-title">
      <article className="w-full max-w-lg overflow-hidden rounded-none border-0 border-white/15 bg-bg shadow-[0_30px_90px_-20px_#000] sm:rounded-xl sm:border">
        <header className="border-b border-white/10 bg-gradient-to-b from-[#161b26] to-[#07090e]">
          <div className="flex items-center justify-between px-5 pt-4">
            <p className="bx-primary px-2 py-0.5 font-display text-xs font-extrabold italic tracking-[0.2em] [transform:skewX(-12deg)]">
              <span className="inline-block [transform:skewX(12deg)]">CRUNCH TIME</span>
            </p>
            <p className="font-display text-xs font-bold uppercase italic tracking-[0.2em] text-brass">The owner&apos;s call</p>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch">
            {([us, opp] as TeamId[]).map((id, i) => {
              const ink = clubInk(id, save.year);
              const score = i === 0 ? sit.us : sit.them;
              const slab = (
                <div
                  key={id}
                  className={`flex items-center gap-3 px-4 py-3 ${i === 1 ? "flex-row-reverse text-right" : ""}`}
                  style={{
                    background: `linear-gradient(180deg, #ffffff2e, transparent 46%, #0000 54%, #0005), linear-gradient(${i === 0 ? 115 : 245}deg, ${ink.primary}, color-mix(in srgb, ${ink.primary} 40%, black) 90%)`,
                    color: ink.onPrimary,
                  }}
                >
                  <Logo id={id} size={40} />
                  <span className="bug-num text-5xl">{score}</span>
                </div>
              );
              return i === 0 ? (
                slab
              ) : (
                <div key="wrap" className="contents">
                  <div className="flex flex-col items-center justify-center bg-black px-4">
                    <p className="bug-num text-3xl text-brass">{clockText(sit.clock)}</p>
                    <p className="font-display text-[11px] font-bold italic tracking-[0.25em] text-muted">{period.toUpperCase()}</p>
                  </div>
                  {slab}
                </div>
              );
            })}
          </div>
          <p className="py-2 text-center font-display text-xs font-semibold uppercase italic tracking-wider text-muted">
            {displayName(save.year, us)} vs {displayName(save.year, opp)}
          </p>
        </header>
        <div className="space-y-4 px-5 py-5">
          <div>
            <h2 id="crunch-title" className="text-3xl leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{context}</p>
          </div>
          <div className="grid gap-2">
            {sit.options.map((o, i) => (
              <Btn key={o.id} kind={i === 0 ? "primary" : "ghost"} className="w-full justify-start" onClick={() => choose(o.id)}>
                {sit.kind === "fourth" && o.id === "go" ? `Go for it on 4th-and-${displayYards(sit.togo)}`
                  : sit.kind === "fourth" && o.id === "fg" && sit.fgDist ? `Kick the ${displayYards(sit.fgDist)}-yard field goal` : o.label}
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
