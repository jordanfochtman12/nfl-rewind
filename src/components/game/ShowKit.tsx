import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { showOpened } from "./openingSeen";
import { clubInk, displayName, nicknameOf, teamAbbr, type ShowGraphic, type TeamId, posLabel } from "@/lib/game";
import { Logo } from "./chrome";

/*
 * The studio's on-air package, shared by every show: the full-screen graphic the director
 * cuts to, the lower-third naming whoever is talking, the crawl along the bottom, and the
 * show open. Pure presentation; the data comes from lib/game/showGraphics.ts.
 */

const ink = (id: TeamId | undefined, year: number) => (id ? clubInk(id, year) : { primary: "#2b3a52", secondary: "#c9a24f", onPrimary: "#fff", onSecondary: "#000" });

function TeamPlate({ id, year, score, won, align }: { id: TeamId; year: number; score?: number; won?: boolean; align: "left" | "right" }) {
  const c = ink(id, year);
  return (
    <div className={`sg-plate ${align === "right" ? "sg-plate-r" : ""} ${won === false ? "is-loser" : ""}`} style={{ "--club": c.primary, "--club2": c.secondary } as CSSProperties}>
      <Logo id={id} year={year} size={64} />
      <div className="sg-plate-name">
        <small>{displayName(year, id).replace(` ${nicknameOf(year, id)}`, "").toUpperCase()}</small>
        <strong>{nicknameOf(year, id).toUpperCase()}</strong>
      </div>
      {score !== undefined && <b className="sg-plate-score">{score}</b>}
    </div>
  );
}

/** The graphic itself. */
export function ShowGraphicView({ g, year }: { g: ShowGraphic; year: number }) {
  switch (g.kind) {
    case "score": {
      const homeWon = g.homeScore > g.awayScore;
      const tie = g.homeScore === g.awayScore;
      const qs = Math.max(g.awayQ?.length ?? 0, g.homeQ?.length ?? 0);
      return (
        <figure className="sg sg-score" aria-label={`${g.title}: ${teamAbbr(g.awayId)} ${g.awayScore}, ${teamAbbr(g.homeId)} ${g.homeScore}`}>
          <figcaption className="sg-title">{g.title}{g.ot ? " · OT" : ""}</figcaption>
          <div className="sg-score-row">
            <TeamPlate id={g.awayId} year={year} score={g.awayScore} won={tie ? undefined : !homeWon} align="left" />
            <TeamPlate id={g.homeId} year={year} score={g.homeScore} won={tie ? undefined : homeWon} align="right" />
          </div>
          {qs > 0 && (
            <table className="sg-quarters">
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: qs }, (_, i) => (
                    <th key={i}>{i < 4 ? i + 1 : "OT"}</th>
                  ))}
                  <th>T</th>
                </tr>
              </thead>
              <tbody>
                {([[g.awayId, g.awayQ, g.awayScore], [g.homeId, g.homeQ, g.homeScore]] as const).map(([id, q, t]) => (
                  <tr key={id}>
                    <th>{teamAbbr(id)}</th>
                    {Array.from({ length: qs }, (_, i) => (
                      <td key={i}>{q?.[i] ?? 0}</td>
                    ))}
                    <td className="sg-total">{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {g.stars.length > 0 && (
            <ul className="sg-stars">
              {g.stars.map((s) => (
                <li key={s.playerId} style={{ "--club": ink(s.teamId, year).primary } as CSSProperties}>
                  <strong>{s.name}</strong>
                  <span>{s.line}</span>
                </li>
              ))}
            </ul>
          )}
        </figure>
      );
    }
    case "tape":
      return (
        <figure className="sg sg-tape">
          <figcaption className="sg-title">{g.title}</figcaption>
          <div className="sg-score-row">
            <TeamPlate id={g.awayId} year={year} align="left" />
            <span className="sg-vs">VS</span>
            <TeamPlate id={g.homeId} year={year} align="right" />
          </div>
          <table className="sg-tape-table">
            <tbody>
              {g.rows.map((r, i) => {
                // Comparison bars: each side's share of the two numbers, drawn out from the label.
                const a = parseFloat(r.away.replace(/[^\d.-]/g, ""));
                const h = parseFloat(r.home.replace(/[^\d.-]/g, ""));
                const ok = Number.isFinite(a) && Number.isFinite(h) && a >= 0 && h >= 0 && a + h > 0;
                const sa = ok ? a / (a + h) : 0;
                return (
                  <tr key={r.label} style={{ "--i": i, "--a": sa, "--h": ok ? 1 - sa : 0 } as CSSProperties}>
                    <td className={r.edge === "away" ? "is-edge" : ""}>
                      {ok && <span className="sg-cmp sg-cmp-away" aria-hidden />}
                      <span className="sg-cmp-val">{r.away}</span>
                    </td>
                    <th>{r.label}</th>
                    <td className={r.edge === "home" ? "is-edge" : ""}>
                      {ok && <span className="sg-cmp sg-cmp-home" aria-hidden />}
                      <span className="sg-cmp-val">{r.home}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </figure>
      );
    case "player": {
      const c = ink(g.teamId, year);
      return (
        <figure className="sg sg-player" style={{ "--club": c.primary, "--club2": c.secondary } as CSSProperties}>
          <figcaption className="sg-title">{g.title}</figcaption>
          <div className="sg-player-head">
            <span className="sg-jersey" aria-hidden>
              {g.jersey ?? ""}
            </span>
            <div>
              <strong>{g.name.toUpperCase()}</strong>
              <small>
                {posLabel(g)} · AGE {g.age}
                {g.teamId ? ` · ${displayName(year, g.teamId).toUpperCase()}` : ""}
              </small>
            </div>
            {g.teamId && <Logo id={g.teamId} year={year} size={56} />}
          </div>
          {g.stats.length > 0 && (
            <dl className="sg-statline">
              {g.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {g.caption && <p className="sg-caption">{g.caption}</p>}
        </figure>
      );
    }
    case "board": {
      const n = g.rows.length;
      return (
        <figure className={`sg sg-board ${g.style ? `is-${g.style}` : ""}`}>
          <figcaption className="sg-title">{g.title}</figcaption>
          <ol>
            {g.rows.map((r, i) => (
              <li
                key={`${r.rank}-${r.name}`}
                style={
                  {
                    "--club": ink(r.teamId, year).primary,
                    // A countdown reveals the bottom of the board first and the top last.
                    "--i": g.style === "reveal" ? n - 1 - i : i,
                    "--share": r.share ?? 0,
                  } as CSSProperties
                }
              >
                <span className="sg-rank">{r.rank}</span>
                {r.teamId ? <Logo id={r.teamId} year={year} size={30} /> : <span />}
                <strong>{r.name}</strong>
                {r.move !== undefined && (
                  <i className={`sg-move ${r.move > 0 ? "is-up" : r.move < 0 ? "is-down" : ""}`} aria-label={r.move ? `${r.move > 0 ? "up" : "down"} ${Math.abs(r.move)}` : "no change"}>
                    {r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : "—"}
                  </i>
                )}
                <b>{r.value}</b>
                {g.style === "race" && <span className="sg-bar" aria-hidden />}
              </li>
            ))}
          </ol>
        </figure>
      );
    }
    case "scores":
      return (
        <figure className="sg sg-scores">
          <figcaption className="sg-title">{g.title}</figcaption>
          <ul>
            {g.games.map((x) => (
              <li key={`${x.awayId}-${x.homeId}`}>
                {([[x.awayId, x.awayScore, x.awayScore > x.homeScore], [x.homeId, x.homeScore, x.homeScore > x.awayScore]] as const).map(([id, s, w]) => (
                  <span key={id} className={w ? "is-winner" : ""}>
                    <Logo id={id} year={year} size={20} />
                    <em>{teamAbbr(id)}</em>
                    <b>{s}</b>
                  </span>
                ))}
                {x.ot && <small>OT</small>}
              </li>
            ))}
          </ul>
        </figure>
      );
    case "road":
      return (
        <figure className="sg sg-road" style={{ "--club": ink(g.teamId, year).primary } as CSSProperties}>
          <figcaption className="sg-title">{g.title}</figcaption>
          <div className="sg-road-head">
            <Logo id={g.teamId} year={year} size={56} />
            <strong>{displayName(year, g.teamId).toUpperCase()}</strong>
          </div>
          <ol>
            {g.rows.map((r) => (
              <li key={r.label} className={r.won ? "is-won" : "is-lost"}>
                <small>{r.label.toUpperCase()}</small>
                <span>{r.text}</span>
              </li>
            ))}
          </ol>
        </figure>
      );
    case "team": {
      const c = ink(g.teamId, year);
      return (
        <figure className="sg sg-team" style={{ "--club": c.primary, "--club2": c.secondary } as CSSProperties}>
          <figcaption className="sg-title">{g.title}</figcaption>
          <div className="sg-player-head">
            <Logo id={g.teamId} year={year} size={64} />
            <div>
              <strong>{displayName(year, g.teamId).toUpperCase()}</strong>
              <small>{year} SEASON</small>
            </div>
          </div>
          <dl className="sg-statline">
            {g.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </figure>
      );
    }
  }
}

/** Who's talking: name, role, a monogram. */
export function LowerThird({ name, role, accent }: { name: string; role: string; accent?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div key={name} className="sk-lower" style={accent ? ({ "--accent": accent } as CSSProperties) : undefined} aria-hidden>
      <span className="sk-lower-mono">{initials}</span>
      <span className="sk-lower-text">
        <strong>{name.toUpperCase()}</strong>
        <small>{role.toUpperCase()}</small>
      </span>
    </div>
  );
}

/** The crawl. Items scroll right to left; the list doubles so the loop is seamless. */
export function ShowTicker({ items, label = "AROUND THE LEAGUE" }: { items: string[]; label?: string }) {
  if (!items.length) return null;
  const secs = Math.max(30, items.join(" ").length / 7);
  return (
    <div className="sk-ticker" role="marquee" aria-label={`${label}: ${items.join(". ")}`}>
      <span className="sk-ticker-label">{label}</span>
      <div className="sk-ticker-track">
        <div className="sk-ticker-run" style={{ animationDuration: `${secs}s` }} aria-hidden>
          {[...items, ...items].map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The show open: a few seconds of title card before the desk comes up. */
export function ShowOpen({ show, title, sub, teamIds = [], year, onDone }: { show: string; title: string; sub?: string; teamIds?: TeamId[]; year: number; onDone: () => void }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t1 = window.setTimeout(() => setOut(true), reduce ? 600 : 2600);
    const t2 = window.setTimeout(onDone, reduce ? 800 : 3200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);
  return (
    <div className={`sk-open ${out ? "is-out" : ""}`} role="presentation" onClick={onDone}>
      <div className="sk-open-sweep" aria-hidden />
      <div className="sk-open-card">
        <p className="sk-open-show">{show}</p>
        <h2>{title}</h2>
        {sub && <p className="sk-open-sub">{sub}</p>}
        {teamIds.length > 0 && (
          <div className="sk-open-logos" aria-hidden>
            {teamIds.slice(0, 2).map((id) => (
              <Logo key={id} id={id} year={year} size={72} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const opened = showOpened;

/**
 * A night of television around any screen: the show open the first time it airs this session,
 * the crawl along the bottom. The content stays the screen's own.
 */
export function NightShow({ id, show, title, sub, year, teamIds, ticker, tickerLabel, children, showOpen = true }: { id: string; show: string; title: string; sub?: string; year: number; teamIds?: TeamId[]; ticker?: string[]; tickerLabel?: string; children: React.ReactNode; showOpen?: boolean }) {
  const [open, setOpen] = useState(() => showOpen && !opened.has(id));
  const done = useCallback(() => {
    opened.add(id);
    setOpen(false);
  }, [id]);
  return (
    <div className="sk-night relative">
      {open && <ShowOpen show={show} title={title} sub={sub} year={year} teamIds={teamIds} onDone={done} />}
      {children}
      {ticker && ticker.length > 0 && <ShowTicker items={ticker} label={tickerLabel} />}
    </div>
  );
}
