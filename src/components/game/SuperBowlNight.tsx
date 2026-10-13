import type { CSSProperties } from "react";
import { clubInk, displayName, nicknameOf, roman, superBowlNumber, superBowlSite, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";
import { LiveBroadcast } from "./LiveBroadcast";
import { wasWatched } from "./liveWatch";
import { SuperBowlHistory } from "./SuperBowlHistory";
import { RoadHere } from "./BigNight";
import { clockLabel, finalLine, halftimeAct, reelFrom, trophyName } from "./bigNightText";
import { useRef, useState } from "react";

/**
 * Super Bowl night. Before kickoff: the open, the two clubs and their roads here, the
 * halftime bill. After: the live telecast the first time, then the trophy presentation in
 * the champion's colors, the MVP, the box and the reel, and the roll of champions.
 */
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
  const year = save.year;
  const site = superBowlSite(year);
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const mvp = g.mvpPlayerId ? save.players[g.mvpPlayerId] : undefined;
  const n = superBowlNumber(year);
  const winner = g.played ? (g.homeScore >= g.awayScore ? home : away) : undefined;
  const awayInk = clubInk(away, year);
  const homeInk = clubInk(home, year);
  const champ = winner ? clubInk(winner, year) : undefined;
  const mine = !save.sandbox && (home === save.userTeamId || away === save.userTeamId);
  const reel = g.played ? reelFrom(g) : [];
  const city = (id: TeamId) => displayName(year, id).replace(nicknameOf(year, id), "").trim();
  return (
    <article
      className={`k5-sb ${g.played ? "is-final" : ""}`}
      style={{ "--away": awayInk.primary, "--home": homeInk.primary, "--champ": champ?.primary ?? "#ffc629", "--champ2": champ?.secondary ?? "#ffffff" } as CSSProperties}
    >
      <header className="k5-sb-open">
        <div className="k5-sb-bg" aria-hidden />
        <p className="k5-sb-kicker">
          <span>{g.played ? "FINAL" : "TONIGHT"}</span> THE WORLD CHAMPIONSHIP GAME
        </p>
        <h1 className="k5-sb-title">
          SUPER BOWL <b>{roman(n)}</b>
        </h1>
        <p className="k5-sb-site">
          {site.site.toUpperCase()} · {site.city.toUpperCase()}
          {g.attendance ? ` · ${g.attendance.toLocaleString()} IN THE HOUSE` : ""}
        </p>
      </header>

      <section className="k5-sb-match" aria-label="The matchup">
        {[away, home].map((id) => {
          const score = id === home ? g.homeScore : g.awayScore;
          return (
            <div key={id} className={`k5-sb-side ${winner === id ? "is-win" : winner ? "is-loss" : ""}`} style={{ "--club": clubInk(id, year).primary } as CSSProperties}>
              <Logo id={id} year={year} size={96} />
              {city(id) && <p className="k5-sb-city">{city(id).toUpperCase()}</p>}
              <p className="k5-sb-nick">{nicknameOf(year, id).toUpperCase()}</p>
              {g.played && <p className="k5-sb-score tabular">{score}</p>}
            </div>
          );
        })}
        <span className="k5-sb-vs" aria-hidden>
          {g.played ? "FINAL" : "VS"}
        </span>
      </section>

      {!g.played && (
        <>
          <section className="k5-sb-roads" aria-label="The road here">
            <RoadHere teamId={away} year={year} />
            <RoadHere teamId={home} year={year} />
          </section>
          <section className="k5-sb-bill">
            <p>
              <span>PREGAME</span> {site.flavor}
            </p>
            <p>
              <span>HALFTIME</span> {halftimeAct(year)}
            </p>
            <p>
              <span>ON THE LINE</span> {trophyName(year)}
            </p>
            {g.weather && g.weather !== "clear" ? (
              <p>
                <span>WEATHER</span> {g.weather}
              </p>
            ) : null}
          </section>
          <div className="k5-sb-go">
            <Btn kind="primary" className="min-h-12 px-6" onClick={() => step({})}>
              {mine ? "Kick off the Super Bowl ▸" : "Play the Super Bowl ▸"}
            </Btn>
          </div>
        </>
      )}

      {g.played && winner && (
        <>
          <section className="k5-sb-trophy" aria-label="The trophy presentation">
            <div className="k5-sb-confetti" aria-hidden>
              {Array.from({ length: 28 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `-${((i * 0.41) % 6).toFixed(2)}s`,
                    animationDuration: `${4.5 + (i % 5) * 0.6}s`,
                  }}
                />
              ))}
            </div>
            <svg className="k5-sb-cup" viewBox="0 0 100 180" aria-hidden>
              <defs>
                <linearGradient id="sb-cup" x1="0" x2="1">
                  <stop stopColor="#f4f7fb" />
                  <stop offset=".45" stopColor="#9aa6b8" />
                  <stop offset=".55" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#b9c4d6" />
                </linearGradient>
              </defs>
              <path d="M34 68 24 146h52L65 68ZM20 148h60v18H20z" fill="url(#sb-cup)" />
              <ellipse cx="50" cy="40" rx="25" ry="39" transform="rotate(30 50 40)" fill="url(#sb-cup)" />
              <path d="m35 58 30-40M41 49l12 8M46 41l12 8M51 33l12 8" stroke="#56627a" strokeWidth="2" />
            </svg>
            <p className="k5-sb-label">{trophyName(year).toUpperCase()}</p>
            <div className="k5-sb-champ">
              <Logo id={winner} year={year} size={112} />
              <div className="min-w-0">
                <p className="k5-sb-champ-small">
                  {year} WORLD CHAMPIONS{mine && winner === save.userTeamId ? " · YOUR CLUB" : ""}
                </p>
                <h2 className="k5-sb-champ-name">{displayName(year, winner).toUpperCase()}</h2>
                <p className="k5-sb-champ-line">{finalLine(g, year)}</p>
              </div>
            </div>
          </section>

          {mvp && (
            <section className="k5-sb-mvp">
              <p className="k5-sb-label">SUPER BOWL {roman(n)} MOST VALUABLE PLAYER</p>
              <p className="k5-sb-mvp-name">
                <PlayerLink player={mvp} className="inline min-h-0" />
              </p>
              <p className="k5-sb-mvp-meta">
                {mvp.pos} · #{mvp.jersey}
              </p>
            </section>
          )}

          {g.homeQ && g.awayQ && (
            <section className="k5-sb-box" aria-label="Score by quarter">
              <table>
                <thead>
                  <tr>
                    <th />
                    {g.homeQ.map((_, i) => (
                      <th key={i}>{i < 4 ? i + 1 : "OT"}</th>
                    ))}
                    <th>F</th>
                  </tr>
                </thead>
                <tbody>
                  {[away, home].map((id) => (
                    <tr key={id} className={winner === id ? "is-win" : ""}>
                      <td>
                        <span>
                          <Logo id={id} year={year} size={22} /> {nicknameOf(year, id).toUpperCase()}
                        </span>
                      </td>
                      {(id === home ? g.homeQ! : g.awayQ!).map((q, i) => (
                        <td key={i} className="tabular">
                          {q}
                        </td>
                      ))}
                      <td className="tabular">{id === home ? g.homeScore : g.awayScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {reel.length ? (
            <section className="k5-sb-reel" aria-label="The reel">
              <p className="k5-sb-label">THE REEL · EVERY SCORE AND TAKEAWAY</p>
              <ol>
                {reel.map((r, i) => (
                  <li key={i} className={`is-${r.tag}`}>
                    <span className="k5-sb-reel-when">
                      <b>{r.tag === "to" ? "TAKEAWAY" : r.tag === "fg" ? "FIELD GOAL" : r.tag === "safety" ? "SAFETY" : "TOUCHDOWN"}</b>
                      <small>
                        {r.q > 4 ? "OT" : `Q${r.q}`} {clockLabel(r.clock)}
                      </small>
                    </span>
                    <Logo id={r.teamId} year={year} size={26} />
                    <span className="min-w-0">
                      {r.text}
                      {r.tag !== "to" && (
                        <small className="k5-sb-reel-score">
                          {nicknameOf(year, away)} {r.as}, {nicknameOf(year, home)} {r.hs}
                        </small>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : g.highlights?.length ? (
            <section className="k5-sb-reel" aria-label="The highlights">
              <p className="k5-sb-label">THE REEL</p>
              <ol>
                {g.highlights.map((h) => (
                  <li key={h}>
                    <span className="min-w-0">{h}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="k5-sb-go">
            <Btn kind="primary" className="min-h-12 px-6" onClick={() => step({})}>
              Continue to awards ▸
            </Btn>
          </div>
        </>
      )}

      {save.history.superBowls.length > 0 && (
        <section className="k5-sb-roll">
          <p className="k5-sb-label">THE ROLL OF CHAMPIONS</p>
          <SuperBowlHistory compact />
        </section>
      )}
    </article>
  );
}
