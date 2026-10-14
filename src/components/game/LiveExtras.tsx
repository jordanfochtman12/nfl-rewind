import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { clubInk, displayName, nicknameOf, playerName, starters, type GameResult, type Player, type PlayLog, type Pos, type TeamId } from "@/lib/game";
import { PlayerPortrait } from "./Portrait";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { rollingLine } from "./liveStats";

/** The win-probability meter under the score bug, split in the clubs' colors. */
export function WinMeter({ wp, us, home, away, year }: { wp: number; us: TeamId; home: TeamId; away: TeamId; year: number }) {
  const homeWp = us === home ? wp : 1 - wp;
  const awayPct = Math.round((1 - homeWp) * 100);
  return (
    <div className="k5-wp" style={{ "--away": clubInk(away, year).primary, "--home": clubInk(home, year).primary, "--split": `${awayPct}%` } as CSSProperties} aria-label={`Win probability: ${nicknameOf(year, away)} ${awayPct}%, ${nicknameOf(year, home)} ${100 - awayPct}%`}>
      <span className="k5-wp-side">{awayPct}%</span>
      <span className="k5-wp-bar" aria-hidden>
        <i />
      </span>
      <span className="k5-wp-side">{100 - awayPct}%</span>
      <small>WIN PROBABILITY</small>
    </div>
  );
}

/** "Rushing yards today: 112": a stat graphic when a player is rolling on this snap. */
export function StatPop({ log, i, year }: { log: PlayLog[]; i: number; year: number }) {
  const pop = useMemo(() => rollingLine(log, i), [log, i]);
  if (!pop) return null;
  const ink = clubInk(pop.teamId, year);
  return (
    <div key={`${i}-${pop.name}`} className="k5-statpop" style={{ "--club": ink.primary, "--club2": ink.secondary } as CSSProperties} role="status">
      <Logo id={pop.teamId} year={year} size={34} />
      <div className="min-w-0">
        <p className="k5-statpop-kicker">{pop.kicker}</p>
        <p className="k5-statpop-name">{pop.name.toUpperCase()}</p>
      </div>
      <b className="k5-statpop-value">{pop.value}</b>
      <small className="k5-statpop-line">{pop.line}</small>
    </div>
  );
}

const LINEUP: { pos: Pos; label: string }[] = [
  { pos: "QB", label: "QB" },
  { pos: "RB", label: "RB" },
  { pos: "WR", label: "WR" },
];

/**
 * Before kickoff: the stadium shot with the weather and the crowd, each club out of the
 * tunnel, and the starting lineups. Tapping skips it; it runs once a broadcast.
 */
export function PregameIntro({ game, onDone }: { game: GameResult; onDone: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const year = game.year;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const [stage, setStage] = useState(0);
  const stages = 4;
  useEffect(() => {
    if (stage >= stages) {
      onDone();
      return;
    }
    const t = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 3200 : stage === 3 ? 5200 : 2800);
    return () => clearTimeout(t);
  }, [stage, onDone]);
  const lineup = (id: TeamId) => {
    const out: { label: string; name: string; jersey?: number; ovr: number; p: Player }[] = [];
    for (const l of LINEUP) {
      const n = l.pos === "WR" ? 2 : 1;
      for (const p of starters(save, id, l.pos, n)) out.push({ label: l.label, name: playerName(p), jersey: p.jersey, ovr: p.ovr, p });
    }
    const d = (["DE", "DT", "OLB", "MLB", "CB", "S"] as Pos[])
      .flatMap((pos) => starters(save, id, pos, pos === "CB" || pos === "DE" || pos === "DT" || pos === "OLB" || pos === "S" ? 2 : 1))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 2);
    for (const p of d) out.push({ label: p.pos, name: playerName(p), jersey: p.jersey, ovr: p.ovr, p });
    return out;
  };
  const weather = game.indoor ? "Indoors" : game.weather && game.weather !== "clear" ? game.weather[0]!.toUpperCase() + game.weather.slice(1) : "Clear skies";
  const tunnel = (id: TeamId, side: "away" | "home") => {
    const ink = clubInk(id, year);
    return (
      <div className="k5-intro-tunnel" style={{ "--club": ink.primary, "--club2": ink.secondary } as CSSProperties}>
        <span className="k5-intro-smoke" aria-hidden />
        <Logo id={id} year={year} size={120} />
        <p className="k5-intro-kicker">{side === "home" ? "THE HOME TEAM" : "THE VISITORS"} · TAKING THE FIELD</p>
        <p className="k5-intro-name">{displayName(year, id).toUpperCase()}</p>
      </div>
    );
  };
  return (
    <div className="k5-intro" role="dialog" aria-label="Pregame" onClick={() => setStage((s) => s + 1)}>
      {stage === 0 && (
        <div className="k5-intro-stadium">
          <div className="k5-intro-stadium-bg" aria-hidden />
          <p className="k5-intro-kicker">LIVE FROM</p>
          <p className="k5-intro-name">{(game.stadium ?? "The stadium").toUpperCase()}</p>
          <p className="k5-intro-facts">
            <span>{weather}</span>
            {game.attendance ? <span>{game.attendance.toLocaleString()} in the house</span> : null}
            {game.night ? <span>Under the lights</span> : null}
          </p>
          <p className="k5-intro-match">
            <Logo id={away} year={year} size={44} /> <i>AT</i> <Logo id={home} year={year} size={44} />
          </p>
        </div>
      )}
      {stage === 1 && tunnel(away, "away")}
      {stage === 2 && tunnel(home, "home")}
      {stage === 3 && (
        <div className="k5-intro-lineups">
          <p className="k5-intro-kicker">TONIGHT&apos;S STARTERS</p>
          <div className="k5-intro-cols">
            {[away, home].map((id) => {
              const ink = clubInk(id, year);
              return (
                <div key={id} className="k5-intro-col" style={{ "--club": ink.primary, "--club2": ink.secondary } as CSSProperties}>
                  <p className="k5-intro-col-head">
                    <Logo id={id} year={year} size={30} /> {nicknameOf(year, id).toUpperCase()}
                  </p>
                  <ol>
                    {lineup(id).map((r, k) => (
                      <li key={`${r.name}-${k}`} style={{ "--i": k } as CSSProperties}>
                        <PlayerPortrait p={r.p} year={year} size="sm" club={id} className="k5-intro-face" />
                        <span>
                          {r.name}
                          <small>{r.label}</small>
                        </span>
                        <em>{r.ovr}</em>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button type="button" className="k5-intro-skip" onClick={(e) => (e.stopPropagation(), onDone())}>
        Skip to kickoff ▸
      </button>
    </div>
  );
}
