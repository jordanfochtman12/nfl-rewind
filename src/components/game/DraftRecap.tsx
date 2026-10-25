import { useMemo, type CSSProperties } from "react";
import { clubInk, displayName, draftRecap, sessionOf, type PickBreakdown, type TeamId, posLabel } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerPortrait } from "./Portrait";

const VALUE_TONE: Record<PickBreakdown["value"], string> = {
  STEAL: "#35f29a",
  VALUE: "#3fd2ff",
  "ON THE BOARD": "#c9d6ee",
  REACH: "#ffb547",
  "BIG REACH": "#ff3b55",
};

function PickRow({ b }: { b: PickBreakdown }) {
  const save = useGameStore((s) => s.save)!;
  const openProfile = useGameStore((s) => s.openProfile);
  const p = save.players[b.playerId];
  if (!p) return null;
  return (
    <li>
      <button type="button" className="dr-pick" onClick={() => openProfile(p.id)} aria-label={`${b.name}, pick ${b.overall}`}>
        <PlayerPortrait p={p} year={save.year} size="sm" club={b.teamId} />
        <span className="dr-pick-main">
          <b>{b.name}</b>
          <small>
            Rd {b.round} · #{b.overall} · {posLabel(b)}
            {b.college ? ` · ${b.college}` : ""}
          </small>
        </span>
        <span className="dr-pick-tag" style={{ color: VALUE_TONE[b.value] } as CSSProperties}>
          {b.value}
        </span>
        <span className="dr-pick-grade">{b.grade}</span>
      </button>
    </li>
  );
}

/** The draft in review, the morning after: your class, every club's grade, the steals and the reaches. */
export function DraftRecapView() {
  const save = useGameStore((s) => s.save)!;
  const setTab = useGameStore((s) => s.setTab);
  const recap = useMemo(() => draftRecap(save), [save]);
  if (!recap) return null;
  const league = sessionOf(save) === "afl" ? "AFL" : "NFL";
  const mine = save.sandbox ? undefined : recap.teams.find((t) => t.teamId === save.userTeamId);
  const rank = mine ? recap.teams.indexOf(mine) + 1 : 0;
  const ink = mine ? clubInk(mine.teamId, save.year) : undefined;
  return (
    <section className="dr" aria-label={`The ${save.year} draft in review`} style={ink ? ({ "--club": ink.primary } as CSSProperties) : undefined}>
      <header className="dr-head">
        <div className="min-w-0">
          <p className="dn-open-kicker">THE {save.year} {league} DRAFT · IN THE BOOKS</p>
          <h2 className="dr-title">
            The draft <span>in review</span>
          </h2>
          <p className="dr-sub">
            {recap.picks.length} picks. Graded the morning after, against the board and against every other club's class.
          </p>
        </div>
        {mine && (
          <div className="dr-mygrade" aria-label={`Your class grade ${mine.grade}`}>
            <small>YOUR CLASS</small>
            <b>{mine.grade}</b>
            <small>
              {rank === 1 ? "Best in the league" : `${rank}${rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} of ${recap.teams.length}`}
            </small>
          </div>
        )}
      </header>

      {mine && (
        <div className="dr-panel">
          <p className="dn-open-label">YOUR PICKS · {displayName(save.year, mine.teamId).toUpperCase()}</p>
          <ol className="dr-picks">
            {mine.picks.map((b) => (
              <PickRow key={b.playerId} b={b} />
            ))}
          </ol>
        </div>
      )}

      <div className="dr-two">
        <div className="dr-panel">
          <p className="dn-open-label">THE STEALS</p>
          <ol className="dr-picks">
            {recap.steals.map((b) => (
              <PickRow key={b.playerId} b={b} />
            ))}
          </ol>
        </div>
        <div className="dr-panel">
          <p className="dn-open-label">THE REACHES</p>
          <ol className="dr-picks">
            {recap.reaches.map((b) => (
              <PickRow key={b.playerId} b={b} />
            ))}
          </ol>
        </div>
      </div>

      <div className="dr-panel">
        <p className="dn-open-label">EVERY CLUB'S CLASS</p>
        <ol className="dr-grades">
          {recap.teams.map((t, i) => (
            <li key={t.teamId} className={t.teamId === mine?.teamId ? "is-mine" : ""}>
              <span className="dr-rank tabular">{i + 1}</span>
              <Logo id={t.teamId as TeamId} size={32} year={save.year} />
              <span className="dr-club">
                <b>{displayName(save.year, t.teamId as TeamId)}</b>
                {t.best && <small>Best pick: {t.best.name}, #{t.best.overall}</small>}
              </span>
              <span className="dr-letter">{t.grade}</span>
            </li>
          ))}
        </ol>
      </div>

      {save.phase === "freeAgency" && (
        <button type="button" className="dn-open-start" onClick={() => setTab("office")}>
          ON TO FREE AGENCY <span aria-hidden>▸</span>
        </button>
      )}
    </section>
  );
}
