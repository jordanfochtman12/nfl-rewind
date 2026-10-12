import { clubInk, displayName, roman, superBowlNumber, superBowlSite, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { FilmStill } from "./Art";
import { PlayerLink } from "./PlayerProfile";
import {LiveBroadcast } from "./LiveBroadcast";
import { wasWatched } from "./liveWatch";
import { SuperBowlHistory } from "./SuperBowlHistory";
import { useRef, useState } from "react";

export function SuperBowlNight() {
  const save = useGameStore((s) => s.save)!;
  const { step } = useGameStore();
  const g = save.superBowl;
  // The owner's Super Bowl airs live the first time it's shown after kickoff.
  const seenAtKickoff = useRef<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const rewindId = useGameStore((s) => s.rewind?.gameId);
  if (g?.played && seenAtKickoff.current === null) seenAtKickoff.current = wasWatched(g.id);
  if (!g) return null;
  if (g.played && g.log?.length && save.liveOn !== false && !seenAtKickoff.current && !dismissed) {
    return (
      <LiveBroadcast
        key={`${g.id}-${(save.liveOrders ?? []).filter((o) => o.gameId === g.id).length}`}
        game={g}
        log={g.log}
        startAt={save.liveResume?.gameId === g.id ? save.liveResume.index : 0}
        onDone={() => setDismissed(true)}
        canCall={rewindId === g.id}
      />
    );
  }
  const site = superBowlSite(save.year);
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const mvp = g.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
  const n = superBowlNumber(save.year);
  const winner = g.played ? (g.homeScore >= g.awayScore ? home : away) : undefined;
  const awayInk = clubInk(away, save.year);
  const homeInk = clubInk(home, save.year);
  const winnerInk = winner === home ? homeInk : awayInk;
  return (
    <article className="relative overflow-hidden rounded-xl border border-brass/40 bg-studio">
      <FilmStill still="superbowl" veil="bottom" />
      <div className="relative border-b border-brass/25 px-6 py-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(196,165,116,0.14),transparent_60%)]" />
        <div className="relative">
          <p className="font-display text-xs tracking-[0.5em] text-brass">WORLD CHAMPIONSHIP GAME</p>
          <h1 className="mt-2 font-display text-5xl tracking-wide text-paper sm:text-7xl">SUPER BOWL {roman(n)}</h1>
          <p className="mt-3 text-lg text-muted">
            {site.site} · {site.city}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-subtle">{site.flavor}</p>
          {g.attendance ? (
            <p className="mt-3 text-xs tracking-[0.35em] text-brass">{g.attendance.toLocaleString()} IN THE HOUSE</p>
          ) : null}
        </div>
      </div>

      <div className="relative grid gap-6 px-6 py-10 sm:grid-cols-3 sm:items-center">
        <div className="text-center">
          <Logo id={away} size={96} />
          <p className="mt-3 font-display text-2xl">{displayName(save.year, away)}</p>
          {g.played && (
            <p
              className="stat-glow tabular font-display text-7xl"
              style={
                winner === away
                  ? { textShadow: `0 0 26px color-mix(in srgb, ${awayInk.primary} 65%, transparent)` }
                  : undefined
              }
            >
              {g.awayScore}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="font-display tracking-[0.5em] text-brass">VS</p>
          {!g.played && <p className="mt-3 text-sm text-muted">Coin toss on the hashmark. Marching band waiting in the tunnel.</p>}
          {g.played && g.homeQ && g.awayQ && (
            <table className="mx-auto mt-4 text-sm">
              <thead className="text-xs tracking-widest text-muted">
                <tr>
                  {["", "1", "2", "3", "4", "F"].map((h) => (
                    <th key={h} className="px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 text-left">{String(away).toUpperCase()}</td>
                  {g.awayQ.map((q, i) => (
                    <td key={i} className="tabular px-2">
                      {q}
                    </td>
                  ))}
                  <td className="tabular px-2 font-display">{g.awayScore}</td>
                </tr>
                <tr>
                  <td className="px-2 text-left">{String(home).toUpperCase()}</td>
                  {g.homeQ.map((q, i) => (
                    <td key={i} className="tabular px-2">
                      {q}
                    </td>
                  ))}
                  <td className="tabular px-2 font-display">{g.homeScore}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div className="text-center">
          <Logo id={home} size={96} />
          <p className="mt-3 font-display text-2xl">{displayName(save.year, home)}</p>
          {g.played && (
            <p
              className="stat-glow tabular font-display text-7xl"
              style={
                winner === home
                  ? { textShadow: `0 0 26px color-mix(in srgb, ${homeInk.primary} 65%, transparent)` }
                  : undefined
              }
            >
              {g.homeScore}
            </p>
          )}
        </div>
      </div>

      <div className="relative space-y-4 border-t border-brass/20 px-6 py-6">
        {g.played && winner && (
          <p
            className="chrome-bevel inline-block rounded-md bg-black/40 px-4 py-2 font-display text-2xl text-fg"
            style={{ textShadow: `0 0 20px color-mix(in srgb, ${winnerInk.primary} 70%, transparent)` }}
          >
            World champions — {displayName(save.year, winner)}
          </p>
        )}
        {g.played && mvp && (
          <div>
            <p className="text-[11px] tracking-[0.35em] text-brass">VINCE LOMBARDI TROPHY · MOST VALUABLE PLAYER</p>
            <p className="mt-1 font-display text-3xl text-paper">
              {mvp ? (
                <>
                  <PlayerLink player={mvp} className="inline min-h-0 font-display text-3xl text-paper" /> · {mvp.pos} · #
                  {mvp.jersey}
                </>
              ) : (
                "MVP"
              )}
            </p>
          </div>
        )}
        {g.played && g.highlights?.length ? (
          <ul className="space-y-1.5 text-sm text-muted">
            {g.highlights.map((h) => (
              <li key={h}>— {h}</li>
            ))}
          </ul>
        ) : null}
        {!g.played && (
          <p className="text-muted">
            Halftime is a college band and a cold night. Kick this thing off. History starts when the ball is in the air.
          </p>
        )}
        {g.weather && g.weather !== "clear" ? (
          <p className="text-xs tracking-widest text-brass">WEATHER · {g.weather.toUpperCase()}</p>
        ) : null}
        <Btn kind="primary" onClick={() => step({})}>
          {g.played ? "Continue to awards" : "Play Super Bowl"}
        </Btn>
      </div>
      {save.history.superBowls.length > 0 && (
        <div className="relative border-t border-brass/25 px-6 py-8">
          <p className="mb-3 font-display text-xs tracking-[0.5em] text-brass">THE ROLL OF CHAMPIONS</p>
          <SuperBowlHistory compact />
        </div>
      )}
    </article>
  );
}
