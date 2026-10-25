import type { CSSProperties } from "react";
import { clubInk, nicknameOf, type GameResult, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

/*
 * The postseason package: the bracket as it stands, each finalist's road to the big game,
 * and the championship banners that hang in a club's rafters for good.
 */

const won = (g: GameResult) => (g.homeScore >= g.awayScore ? (g.homeId as TeamId) : (g.awayId as TeamId));

/** A club's road through this postseason: who it beat, round by round. */
export function RoadHere({ teamId, year }: { teamId: TeamId; year: number }) {
  const save = useGameStore((s) => s.save)!;
  const games = save.playoffGames.filter((g) => g.played && (g.homeId === teamId || g.awayId === teamId));
  const t = save.teams[teamId];
  const ink = clubInk(teamId, year);
  return (
    <div className="k5-road" style={{ "--club": ink.primary } as CSSProperties}>
      <p className="k5-road-head">
        <Logo id={teamId} year={year} size={30} /> <span>{nicknameOf(year, teamId).toUpperCase()}</span>
        {t && <small>{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</small>}
      </p>
      <ol>
        {games.map((g) => {
          const opp = (g.homeId === teamId ? g.awayId : g.homeId) as TeamId;
          const us = g.homeId === teamId ? g.homeScore : g.awayScore;
          const them = g.homeId === teamId ? g.awayScore : g.homeScore;
          return (
            <li key={g.id} className={won(g) === teamId ? "is-win" : "is-loss"}>
              <span className="k5-road-round">{(g.round ?? "Playoffs").replace(/ Playoff$/, "").toUpperCase()}</span>
              <Logo id={opp} year={year} size={22} />
              <span className="min-w-0 truncate">{nicknameOf(year, opp)}</span>
              <b className="tabular">
                {us}-{them}
              </b>
            </li>
          );
        })}
        {!games.length && <li className="is-bye">Straight to the title game</li>}
      </ol>
    </div>
  );
}

/** This year's bracket so far, round by round, the winners lit. */
export function PlayoffBracket() {
  const save = useGameStore((s) => s.save)!;
  const year = save.year;
  const rounds: { round: string; games: GameResult[] }[] = [];
  for (const g of save.playoffGames) {
    const r = g.round ?? "Playoffs";
    let slot = rounds.find((x) => x.round === r);
    if (!slot) rounds.push((slot = { round: r, games: [] }));
    slot.games.push(g);
  }
  if (!rounds.length) return null;
  return (
    <section className="k5-bracket" aria-label={`${year} playoff bracket`}>
      <p className="k5-bracket-title">
        <span>THE ROAD TO THE SUPER BOWL</span> {year} POSTSEASON
      </p>
      <div className="k5-bracket-rounds">
        {rounds.map((r) => (
          <div key={r.round} className="k5-bracket-round">
            <p>{r.round.toUpperCase()}</p>
            {r.games.map((g) => {
              const w = g.played ? won(g) : undefined;
              return (
                <div key={g.id} className={`k5-bracket-game ${g.played ? "" : "is-next"}`}>
                  {[g.awayId, g.homeId].map((id) => {
                    const club = id as TeamId;
                    const score = club === g.homeId ? g.homeScore : g.awayScore;
                    return (
                      <span key={club} className={w === club ? "is-win" : w ? "is-out" : ""} style={{ "--club": clubInk(club, year).primary } as CSSProperties}>
                        <Logo id={club} year={year} size={22} />
                        <em>{nicknameOf(year, club)}</em>
                        <b className="tabular">{g.played ? score : ""}</b>
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The rafters: one banner for every Super Bowl a club has won in this dynasty and before it. */
export function ChampionBanners({ teamId, titles }: { teamId: TeamId; titles: { year: number; title: string }[] }) {
  const sb = titles.filter((t) => t.title.startsWith("Super Bowl"));
  if (!sb.length) return null;
  return (
    <div className="k5-banners" aria-label={`${sb.length} Super Bowl banner${sb.length === 1 ? "" : "s"}`}>
      {sb.map((t) => {
        const ink = clubInk(teamId, t.year);
        return (
          <figure key={t.year} className="k5-banner" style={{ "--club": ink.primary, "--club2": ink.secondary } as CSSProperties}>
            <Logo id={teamId} year={t.year} size={34} />
            <figcaption>
              <small>WORLD CHAMPIONS</small>
              <b>{t.year}</b>
              <span>{t.title.replace("Super Bowl ", "SB ")}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
