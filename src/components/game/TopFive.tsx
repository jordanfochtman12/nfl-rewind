import type { CSSProperties } from "react";
import { clubInk, nicknameOf, type PrimetimeShow, type TeamId } from "@/lib/game";
import { Logo } from "./chrome";

/** The week's Top 5 plays, counted down five to one, and the slate's scoreboard. */
export function TopFive({ show }: { show: PrimetimeShow }) {
  const reel = show.reel ?? [];
  if (reel.length < 3) return null;
  const year = show.year;
  return (
    <section className="k5-top5" aria-label={`Top ${reel.length} plays`}>
      <header className="k5-top5-head">
        <p>
          <span>THE COUNTDOWN</span> TOP {reel.length} PLAYS
        </p>
        <small>{show.kind === "playoffs" ? "Postseason weekend" : show.kind === "superBowl" ? "Super Bowl" : `Week ${show.week}`}</small>
      </header>
      <ol>
        {reel
          .slice()
          .reverse()
          .map((m) => {
            const club = m.teamId ?? (m.homeScore >= m.awayScore ? m.homeId : m.awayId);
            const ink = clubInk(club, year);
            return (
              <li key={`${m.gameId}-${m.rank}`} className={`k5-top5-item rank-${m.rank}`} style={{ "--club": ink.primary, "--club2": ink.secondary, animationDelay: `${(5 - m.rank) * 90}ms` } as CSSProperties}>
                <b className="k5-top5-rank">{m.rank}</b>
                <Logo id={club} year={year} size={m.rank === 1 ? 56 : 44} />
                <div className="min-w-0">
                  <p className="k5-top5-kind">
                    <span>{m.kind}</span>
                    {m.when ? ` ${m.when}` : ""}
                  </p>
                  <p className="k5-top5-text">{m.text}</p>
                  <p className="k5-top5-game">
                    {nicknameOf(year, m.awayId as TeamId)} {m.awayScore} <i>@</i> {nicknameOf(year, m.homeId as TeamId)} {m.homeScore}
                  </p>
                </div>
              </li>
            );
          })}
      </ol>
    </section>
  );
}

/** Every final from the slate on one board. */
export function Scoreboard({ show }: { show: PrimetimeShow }) {
  if (show.recaps.length < 2) return null;
  const year = show.year;
  return (
    <section className="k5-board" aria-label="Scoreboard">
      <p className="k5-board-title">
        <span>FINAL</span> AROUND THE LEAGUE
      </p>
      <ul>
        {show.recaps.map((r) => {
          const homeWin = r.homeScore > r.awayScore;
          const awayWin = r.awayScore > r.homeScore;
          return (
            <li key={`${r.awayId}-${r.homeId}`}>
              <span className={awayWin ? "is-win" : ""}>
                <Logo id={r.awayId} year={year} size={22} /> <em>{nicknameOf(year, r.awayId)}</em> <b className="tabular">{r.awayScore}</b>
              </span>
              <span className={homeWin ? "is-win" : ""}>
                <Logo id={r.homeId} year={year} size={22} /> <em>{nicknameOf(year, r.homeId)}</em> <b className="tabular">{r.homeScore}</b>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
