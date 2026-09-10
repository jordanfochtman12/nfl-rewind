import { displayName, playerName, roman, superBowlNumber, superBowlSite, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";

export function SuperBowlNight() {
  const save = useGameStore((s) => s.save)!;
  const { step } = useGameStore();
  const g = save.superBowl;
  if (!g) return null;
  const site = superBowlSite(save.year);
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const mvp = g.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
  const n = superBowlNumber(save.year);
  return (
    <article className="overflow-hidden rounded-xl border border-brass/40 bg-studio">
      <div
        className="relative border-b border-brass/25 px-6 py-8"
        style={{ background: "linear-gradient(180deg, #0c1610 0%, #0a0a0c 100%)" }}
      >
        <p className="font-display text-xs tracking-[0.45em] text-brass">WORLD CHAMPIONSHIP GAME</p>
        <h1 className="mt-2 font-display text-5xl tracking-wide text-paper sm:text-6xl">
          SUPER BOWL {roman(n)}
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          {site.site} · {site.city}
        </p>
        <p className="mt-1 text-sm text-subtle">{site.flavor}</p>
        {g.attendance ? <p className="mt-2 text-xs tracking-widest text-brass">{g.attendance.toLocaleString()} IN THE HOUSE</p> : null}
      </div>
      <div className="grid gap-6 px-6 py-10 sm:grid-cols-3 sm:items-center">
        <div className="text-center">
          <Logo id={away} size={88} />
          <p className="mt-3 font-display text-2xl">{displayName(save.year, away)}</p>
          {g.played && <p className="tabular font-display text-6xl">{g.awayScore}</p>}
        </div>
        <div className="text-center">
          <p className="font-display text-brass tracking-[0.4em]">VS</p>
          {g.played && g.homeQ && g.awayQ && (
            <table className="mx-auto mt-4 text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  {["", "1", "2", "3", "4", "F"].map((h) => (
                    <th key={h} className="px-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 text-left">{String(away).toUpperCase()}</td>
                  {g.awayQ.map((n, i) => (
                    <td key={i} className="tabular px-2">
                      {n}
                    </td>
                  ))}
                  <td className="tabular px-2">{g.awayScore}</td>
                </tr>
                <tr>
                  <td className="px-2 text-left">{String(home).toUpperCase()}</td>
                  {g.homeQ.map((n, i) => (
                    <td key={i} className="tabular px-2">
                      {n}
                    </td>
                  ))}
                  <td className="tabular px-2">{g.homeScore}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div className="text-center">
          <Logo id={home} size={88} />
          <p className="mt-3 font-display text-2xl">{displayName(save.year, home)}</p>
          {g.played && <p className="tabular font-display text-6xl">{g.homeScore}</p>}
        </div>
      </div>
      <div className="space-y-3 border-t border-brass/20 px-6 py-6">
        {g.played && mvp && (
          <>
            <p className="text-xs tracking-[0.3em] text-brass">MOST VALUABLE PLAYER</p>
            <p className="font-display text-3xl text-paper">
              {playerName(mvp)} · {mvp.pos} · #{mvp.jersey}
            </p>
          </>
        )}
        {g.played && g.highlights?.length ? (
          <ul className="space-y-1 text-sm text-muted">
            {g.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        ) : null}
        {!g.played && (
          <p className="text-muted">
            Coin toss on the hashmark. Halftime is a marching band and a cold night. Kick this thing off.
          </p>
        )}
        <Btn kind="primary" onClick={() => step({})}>
          {g.played ? "Continue to awards" : "Play Super Bowl"}
        </Btn>
      </div>
    </article>
  );
}
