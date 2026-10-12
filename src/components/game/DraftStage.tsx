import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  bestFits,
  clubInk,
  displayName,
  draftVenue,
  formatHt,
  nicknameOf,
  onTheClock,
  pickBreakdown,
  picksMade,
  playerName,
  roundRecap,
  sessionOf,
  teamAbbr,
  teamNeeds,
  type PickBreakdown,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

/*
 * Draft night's on-air package: the club on the clock, THE PICK IS IN, the card for every
 * selection measured against the board, position runs and trades, and the round in review.
 */

const VALUE_TONE: Record<PickBreakdown["value"], string> = {
  STEAL: "#35f29a",
  VALUE: "#3fd2ff",
  "ON THE BOARD": "#e8eefc",
  REACH: "#ffb547",
  "BIG REACH": "#ff3b55",
};

const ink = (id: TeamId, year: number) => clubInk(id, year);

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => setR(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches), []);
  return r;
}

/** The headline strip: the draft, the venue, the round and pick. */
export function DraftMasthead({ round, pickInRound, overall, total }: { round: number; pickInRound: number; overall: number; total: number }) {
  const save = useGameStore((s) => s.save)!;
  const league = sessionOf(save) === "afl" ? "AFL" : "NFL";
  return (
    <header className="dn-mast">
      <div className="min-w-0">
        <p className="dn-mast-show">
          THE {save.year} {league} DRAFT <span aria-hidden>·</span> <span className="dn-mast-venue">{draftVenue(save.year).toUpperCase()}</span>
        </p>
        <h2 className="dn-mast-title">
          ROUND {round}
          <span>PICK {pickInRound}</span>
        </h2>
      </div>
      <div className="dn-mast-count" aria-label={`Overall pick ${Math.min(overall, total)} of ${total}`}>
        <b>{Math.min(overall, total)}</b>
        <small>OF {total}</small>
      </div>
    </header>
  );
}

/** The club on the clock: its colors, the time left, what it needs, who fits. */
export function OnTheClockPlate({ seconds, limit, isUser, needs: mine }: { seconds: number; limit: number; isUser: boolean; needs?: string[] }) {
  const save = useGameStore((s) => s.save)!;
  const now = onTheClock(save);
  const fits = useMemo(() => (now ? bestFits(save, now.teamId, 3) : []), [save, now]);
  const league = useMemo(() => (now ? teamNeeds(save, now.teamId, 3) : []), [save, now]);
  const needs: string[] = mine ?? league;
  if (!now) return null;
  const c = ink(now.teamId, save.year);
  const pct = Math.max(0, Math.min(1, seconds / Math.max(1, limit)));
  const urgent = seconds <= Math.min(10, limit * 0.2);
  return (
    <section className={`dn-clock ${isUser ? "is-user" : ""}`} style={{ "--club": c.primary, "--club2": c.secondary } as CSSProperties} aria-label={`${displayName(save.year, now.teamId)} on the clock`}>
      <div className="dn-clock-team">
        <Logo id={now.teamId} year={save.year} size={84} />
        <div className="min-w-0">
          <p className="dn-chip">{isUser ? "YOUR WAR ROOM · ON THE CLOCK" : "ON THE CLOCK"}</p>
          <p className="dn-clock-name">{displayName(save.year, now.teamId).toUpperCase()}</p>
          <p className="dn-clock-sub">
            PICK {now.overall} · ROUND {now.round}
            {now.from ? ` · VIA ${nicknameOf(save.year, now.from).toUpperCase()}` : ""}
          </p>
        </div>
        <div className={`dn-clock-time ${urgent ? "is-urgent" : ""}`} role="timer" aria-label={`${seconds} seconds left`}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </div>
      </div>
      <div className="dn-clock-bar" aria-hidden>
        <i style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="dn-clock-foot">
        <p>
          <span className="dn-label">NEEDS</span>
          {needs.map((n) => (
            <b key={n} className="dn-need">
              {n}
            </b>
          ))}
        </p>
        {fits.length > 0 && (
          <p className="min-w-0">
            <span className="dn-label">BEST FITS</span>
            {fits.map((f) => {
              const p = save.players[f.playerId]!;
              return (
                <span key={f.playerId} className="dn-fit">
                  {playerName(p)} <small>{p.pos} · #{f.rank}</small>
                </span>
              );
            })}
          </p>
        )}
      </div>
    </section>
  );
}

/** THE PICK IS IN, then the card. Round one and your own picks get the full sting. */
export function PickReveal() {
  const save = useGameStore((s) => s.save)!;
  const made = useMemo(() => picksMade(save), [save]);
  const last = made.at(-1);
  const b = useMemo(() => (last ? pickBreakdown(save, last.id, made) : undefined), [save, last, made]);
  const reduce = useReducedMotion();
  const mine = !!b && !save.sandbox && b.teamId === save.userTeamId;
  // The full sting is for the moments: the first pick, your own picks, and the last one.
  const big = !!b && (b.overall === 1 || mine || b.last);
  const [sting, setSting] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!b) return;
    // Your pick goes up on the big board: bring it into view from wherever you drafted him.
    if (mine) wrap.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    if (!big || reduce) return;
    setSting(true);
    const t = setTimeout(() => setSting(false), 1100);
    return () => clearTimeout(t);
  }, [b?.overall, big, mine, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!b || !last) return null;
  const c = ink(b.teamId, save.year);
  const tone = VALUE_TONE[b.value];
  const meas = [formatHt(last.heightIn), last.weight ? `${last.weight} LBS` : "", (last.combine?.forty ?? last.forty) ? `${(last.combine?.forty ?? last.forty)!.toFixed(2)} FORTY` : ""].filter(Boolean);
  return (
    <div ref={wrap} className="dn-reveal-wrap" aria-live="polite">
      {sting && (
        <div className="dn-sting" aria-hidden>
          <span>THE PICK</span>
          <span>IS IN</span>
        </div>
      )}
      <article key={b.overall} className="dn-card" style={{ "--club": c.primary, "--club2": c.secondary, "--tone": tone } as CSSProperties}>
        <div className="dn-card-top">
          <p className="dn-chip">{b.last ? "MR. IRRELEVANT" : "THE PICK IS IN"}</p>
          <p className="dn-card-slot">
            ROUND {b.round} · PICK {b.pickInRound} · NO. {b.overall}
            {b.from ? ` · VIA ${teamAbbr(b.from)}` : ""}
          </p>
        </div>
        <div className="dn-card-body">
          <div className="dn-card-team">
            <Logo id={b.teamId} year={save.year} size={92} />
            {last.jersey != null && <span className="dn-jersey">{last.jersey}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="dn-card-club">THE {displayName(save.year, b.teamId).toUpperCase()} SELECT</p>
            <h3 className="dn-card-name">
              <PlayerLink player={last} className="inline min-h-0" />
            </h3>
            <p className="dn-card-meta">
              {b.pos}
              {b.college && b.college !== "Campus" ? ` · ${b.college.toUpperCase()}` : ""}
              {meas.length ? ` · ${meas.join(" · ")}` : ""}
            </p>
          </div>
          <div className="dn-card-grade" aria-label={`Desk grade ${b.grade}`}>
            <b>{b.grade}</b>
            <small>DESK GRADE</small>
          </div>
        </div>
        <div className="dn-card-foot">
          <span className="dn-value">{b.value}</span>
          <span className="dn-stat">
            BOARD <b>#{b.consensus}</b>
          </span>
          <span className="dn-stat">
            {b.delta >= 0 ? "VALUE" : "EARLY"} <b>{b.delta >= 0 ? `+${b.delta}` : b.delta}</b>
          </span>
          {b.need && <span className="dn-stat is-need">FILLS A NEED</span>}
          {b.run && <span className="dn-stat is-run">{b.run.group} RUN · {b.run.count} IN {b.run.window}</span>}
        </div>
        <p className="dn-card-desk">{b.desk}</p>
      </article>
    </div>
  );
}

/** When a round closes: its best value, its reach, what went, and the owner's picks. */
export function RoundRecapCard() {
  const save = useGameStore((s) => s.save)!;
  const made = useMemo(() => picksMade(save), [save]);
  const last = made.at(-1);
  const b = useMemo(() => (last ? pickBreakdown(save, last.id, made) : undefined), [save, last, made]);
  // The round just closed when the next pick belongs to another round (or there is none).
  const now = onTheClock(save);
  const closes = !!b && (!now || now.round !== b.round);
  const recap = useMemo(() => (b && closes ? roundRecap(save, b.round) : undefined), [save, b, closes]);
  if (!recap || !b) return null;
  return (
    <section className="dn-recap" aria-label={`Round ${recap.round} in review`}>
      <p className="dn-chip">ROUND {recap.round} · IN THE BOOKS</p>
      <p className="dn-recap-line">{recap.line}</p>
      <div className="dn-recap-grid">
        {recap.best && (
          <div>
            <span className="dn-label">BEST VALUE</span>
            <p>
              <Logo id={recap.best.teamId} year={save.year} size={22} /> {recap.best.name} <small>No. {recap.best.overall} · board #{recap.best.consensus}</small>
            </p>
          </div>
        )}
        {recap.reach && recap.reach.delta < 0 && (
          <div>
            <span className="dn-label">BIGGEST REACH</span>
            <p>
              <Logo id={recap.reach.teamId} year={save.year} size={22} /> {recap.reach.name} <small>No. {recap.reach.overall} · board #{recap.reach.consensus}</small>
            </p>
          </div>
        )}
        <div>
          <span className="dn-label">BY POSITION</span>
          <p className="flex flex-wrap gap-1">
            {recap.groups.map((g) => (
              <b key={g.group} className="dn-need">
                {g.group} {g.n}
              </b>
            ))}
          </p>
        </div>
        {recap.mine.length > 0 && (
          <div>
            <span className="dn-label">YOUR PICKS</span>
            {recap.mine.map((m) => (
              <p key={m.playerId}>
                {m.name} <small>{m.pos} · No. {m.overall}</small> <b className="dn-grade-sm">{m.grade}</b>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
