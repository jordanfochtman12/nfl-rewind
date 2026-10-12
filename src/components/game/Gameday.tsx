/**
 * Game week and game day for the owner's club: the prep screen before kickoff (scouting
 * report, practice focus, key matchups, rules in play), the cues and momentum meter on the
 * live broadcast, and the postgame game-flow chart with its swing plays replayed in the booth's
 * own voice. Regular game only.
 */
import { useMemo, useState } from "react";
import { clubInk, displayName, nicknameOf, teamAbbr, type GameResult, type PlayLog, type TeamId } from "@/lib/game";
import { boothCall } from "@/lib/game/commentary";
import { boothFor, firstName } from "@/lib/game/broadcastCrew";
import {
  MATCHUP_LABEL,
  PRACTICE,
  keyMatchups,
  matchupEdge,
  matchupReport,
  rulesInPlay,
  scoutingReport,
  swingPlays,
  wpSeries,
  type PracticeFocus,
} from "@/lib/game/gameday";
import { pregameMemory } from "@/lib/game/boothMemory";
import { teamStyle } from "@/lib/game/teamStyle";
import { halftimeReport, postgameInterviews } from "@/lib/game/presentation";
import { useGameStore } from "@/lib/game-store";
import { BroadcastField } from "./BroadcastField";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

type Save = NonNullable<ReturnType<typeof useGameStore.getState>["save"]>;

const CUE: Record<NonNullable<PlayLog["cue"]>, { label: string; cls: string }> = {
  inj: { label: "INJURY", cls: "bg-red text-white" },
  momentum: { label: "MOMENTUM", cls: "bg-[#22d3ee] text-black" },
  crowd: { label: "CROWD", cls: "bg-white text-black" },
  rule: { label: "RULE", cls: "bg-[#a78bfa] text-black" },
  matchup: { label: "MATCHUP", cls: "bg-brass text-[#140f00]" },
  story: { label: "STORYLINE", cls: "bg-[#f0abfc] text-black" },
  record: { label: "RECORD WATCH", cls: "bg-gradient-to-r from-brass to-[#fff3b0] text-[#140f00]" },
  drive: { label: "DRIVE", cls: "bg-[#94a3b8] text-black" },
};

/** A broadcast cue chip for a play (injury, momentum, crowd, rule, matchup). */
export function CueChip({ cue }: { cue?: PlayLog["cue"] }) {
  if (!cue) return null;
  const c = CUE[cue];
  return <span className={`ml-2 px-1.5 py-px not-italic ${c.cls}`}>{c.label}</span>;
}

/** Momentum as a tug-of-war bar between the two clubs, from the latest play's reading. */
export function MomentumMeter({ log, i, home, away }: { log: PlayLog[]; i: number; home: TeamId; away: TeamId }) {
  const save = useGameStore((s) => s.save)!;
  const mo = log[i]?.mo ?? 0;
  const pct = 50 + (mo / 3) * 50;
  const leader = mo >= 1 ? home : mo <= -1 ? away : null;
  return (
    <div className="mt-3" aria-label="Momentum">
      <p className="flex items-baseline justify-between font-display text-xs font-bold uppercase italic tracking-wide text-muted">
        <span>{teamAbbr(away)}</span>
        <span>{leader ? `Momentum · ${nicknameOf(save.year, leader)}` : "Momentum · even"}</span>
        <span>{teamAbbr(home)}</span>
      </p>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-black/50">
        <div className="absolute inset-y-0 left-0 transition-all duration-700" style={{ width: `${100 - pct}%`, background: clubInk(away, save.year).primary }} />
        <div className="absolute inset-y-0 right-0 transition-all duration-700" style={{ width: `${pct}%`, background: clubInk(home, save.year).primary }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
      </div>
    </div>
  );
}

const nameOf = (save: Save, id: string) => {
  const p = save.players[id];
  return p ? <PlayerLink player={p} className="inline min-h-0" /> : <span>—</span>;
};

/** The one-on-ones the broadcast will follow, pregame (from today's depth chart) or as played. */
export function KeyMatchups({ game, compact = false }: { game: GameResult; compact?: boolean }) {
  const save = useGameStore((s) => s.save)!;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const list = useMemo(() => game.matchups ?? keyMatchups(save, home, away), [save, game.matchups, home, away]);
  const us = save.userTeamId;
  const ordered = [...list].sort((a, b) => (a.teamId === us ? -1 : 1) - (b.teamId === us ? -1 : 1));
  const shown = compact ? ordered.filter((m) => m.kind !== "rb-lb") : ordered;
  if (!shown.length) return null;
  return (
    <div>
      <p className="text-xs tracking-[0.25em] text-brass">KEY MATCHUPS</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {shown.map((m) => {
          const edge = matchupEdge(m);
          const defTeam = (m.teamId === home ? away : home) as TeamId;
          return (
            <li key={`${m.kind}-${m.teamId}`} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
              <p className="text-[11px] tracking-widest text-muted">
                {MATCHUP_LABEL[m.kind]} · {teamAbbr(m.teamId)} ball
              </p>
              <p className="mt-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Logo id={m.teamId} size={18} />
                  {nameOf(save, m.offId)} <span className="tabular text-muted">{m.offGrade}</span>
                </span>
                <span className="text-xs text-subtle">vs</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="tabular text-muted">{m.defGrade}</span> {nameOf(save, m.defId)}
                  <Logo id={defTeam} size={18} />
                </span>
              </p>
              <p className={`mt-1 text-xs ${edge === "even" ? "text-muted" : "text-brass"}`}>
                {edge === "offense" ? `Edge ${teamAbbr(m.teamId)}: the offense has the better man.` : edge === "defense" ? `Edge ${teamAbbr(defTeam)}: a tough draw for the offense.` : "Dead even. Whoever wins this wins a lot of snaps."}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The rules the game is played under this season. */
export function RulesInPlay({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  const rules = rulesInPlay(save.year, game.phase, save.userTeamId);
  return (
    <details className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs tracking-[0.25em] text-muted">RULES IN PLAY · {save.year}</summary>
      <ul className="mt-2 space-y-1.5">
        {rules.map((r) => (
          <li key={r.title}>
            <span className="font-medium text-white">{r.title}.</span> <span className="text-paper">{r.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Game-week prep: the advance scout's report and the one thing to drill this week. */
export function GameWeekPrep({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const us = save.userTeamId;
  const opp = (game.homeId === us ? game.awayId : game.homeId) as TeamId;
  const report = useMemo(() => scoutingReport(save, opp), [save, opp]);
  const picked = save.practice?.gameId === game.id ? save.practice.focus : undefined;
  const set = (f: PracticeFocus) =>
    desk((s) => {
      s.practice = { gameId: game.id, focus: f };
      return `Practice this week: ${PRACTICE[f].label.toLowerCase()}.`;
    });
  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs tracking-[0.25em] text-brass">ADVANCE SCOUT · {displayName(save.year, opp).toUpperCase()}</p>
        <ul className="mt-2 space-y-1 text-sm text-paper">
          {report.lines.map((l) => (
            <li key={l} className="border-l-2 border-white/15 pl-3">
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <span className="text-xs tracking-widest text-muted">SCOUT&apos;S CALL </span>
          {PRACTICE[report.suggest].label}. <span className="text-muted">{report.why}</span>
        </p>
      </div>
      <div>
        <p className="text-xs tracking-[0.25em] text-muted">PRACTICE FOCUS · PICK ONE</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(PRACTICE) as PracticeFocus[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={picked === f}
              onClick={() => set(f)}
              className={`rounded-md border px-3 py-2 text-left text-sm ${picked === f ? "border-brass bg-brass/10" : "border-line bg-surface-2 hover:border-white/30"}`}
            >
              <span className="flex items-center justify-between gap-2 font-medium text-white">
                {PRACTICE[f].label}
                {f === report.suggest && <span className="text-[10px] tracking-widest text-brass">SCOUT&apos;S CALL</span>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{PRACTICE[f].blurb}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">
          {picked
            ? `The staff is drilling ${PRACTICE[picked].label.toLowerCase()}. A focus that answers what the scout saw is worth half again as much.`
            : "No focus set: the staff runs a normal week. It's a small edge, never a sure thing."}
        </p>
      </div>
      <KeyMatchups game={game} />
      <RulesInPlay game={game} />
    </div>
  );
}

const W = 600;
const H = 150;

/**
 * Postgame game flow: the whole win-probability line with each possession shaded under it,
 * the swing plays marked, and the biggest moments replayed with the booth's call.
 */
export function GameFlow({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  const log = useMemo(() => game.log ?? [], [game.log]);
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const us = !save.sandbox && (home === save.userTeamId || away === save.userTeamId) ? save.userTeamId : home;
  const [open, setOpen] = useState<number | null>(null);
  const wp = useMemo(() => wpSeries(log, us, home), [log, us, home]);
  const swings = useMemo(() => swingPlays(log, us, home, 4), [log, us, home]);
  const results = useMemo(() => matchupReport(save, game), [save, game]);
  if (log.length < 10) return null;
  const xOf = (k: number) => (k / Math.max(1, log.length - 1)) * W;
  const yOf = (v: number) => (1 - v) * H;
  const path = wp.map((v, k) => `${xOf(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  // Possession bands along the bottom: who had the ball, snap by snap.
  const bands: { from: number; to: number; team: TeamId }[] = [];
  log.forEach((l, k) => {
    const last = bands[bands.length - 1];
    if (last && last.team === l.poss) last.to = k;
    else bands.push({ from: k, to: k, team: l.poss });
  });
  const quarters = [2, 3, 4, 5].map((q) => log.findIndex((l) => l.q >= q)).filter((k) => k > 0);
  const booth = boothFor(game.year);
  const ctx = {
    nick: (id: string) => nicknameOf(game.year, id as TeamId),
    homeId: home,
    awayId: away,
    pbpFirst: firstName(booth.pbp.name),
    colorFirst: firstName(booth.color.name),
    colorBackground: booth.color.background,
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <section aria-label="Game flow" className="space-y-3">
      <h4 className="text-xs tracking-[0.2em] text-muted">Game flow · {teamAbbr(us)} win probability</h4>
      <div className="rounded-md border border-line bg-[#0b0e15] p-2">
        <svg viewBox={`0 0 ${W} ${H + 12}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="Win probability through the game">
          {[0.25, 0.5, 0.75].map((y) => (
            <line key={y} x1="0" x2={W} y1={H * y} y2={H * y} stroke="#fff" strokeOpacity={y === 0.5 ? 0.25 : 0.08} strokeDasharray={y === 0.5 ? "4 4" : undefined} />
          ))}
          {quarters.map((k) => (
            <line key={k} x1={xOf(k)} x2={xOf(k)} y1="0" y2={H} stroke="#fff" strokeOpacity="0.12" />
          ))}
          {bands.map((b, k) => (
            <rect key={k} x={xOf(b.from)} width={Math.max(1, xOf(b.to + 1) - xOf(b.from))} y={H + 3} height="8" fill={clubInk(b.team, game.year).primary} />
          ))}
          <polyline points={path} fill="none" stroke="#ffc629" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {swings.map((s, k) => (
            <g key={s.index}>
              <circle cx={xOf(s.index)} cy={yOf(s.after)} r="7" fill="#e11d2e" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <text x={xOf(s.index)} y={yOf(s.after) + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
                {k + 1}
              </text>
            </g>
          ))}
        </svg>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>Bar under the line: who had the ball.</span>
          {[away, home].map((id) => (
            <span key={id} className="flex items-center gap-1">
              <i className="inline-block h-2 w-3" style={{ background: clubInk(id, game.year).primary }} /> {teamAbbr(id)}
            </span>
          ))}
        </p>
      </div>

      <div>
        <p className="text-xs tracking-[0.25em] text-brass">THE SWING PLAYS</p>
        <ol className="mt-2 space-y-2">
          {swings.map((s, k) => {
            const lines = open === s.index ? boothCall(s.play, s.index, { ...ctx, prev: log[s.index - 1] }) : [];
            return (
              <li key={s.index} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="mr-2 inline-block h-5 w-5 rounded-full bg-red text-center text-xs font-bold leading-5 text-white">{k + 1}</span>
                    <span className="text-xs text-muted">
                      {s.play.q > 4 ? "OT" : `Q${s.play.q}`} · {teamAbbr(s.play.poss)} ball ·{" "}
                    </span>
                    {s.play.text}
                  </span>
                  <span className="tabular text-xs">
                    {pct(s.before)} → <b className={s.after >= s.before ? "text-good" : "text-brick"}>{pct(s.after)}</b>
                  </span>
                </div>
                <button type="button" className="mt-1 text-xs text-subtle underline" onClick={() => setOpen(open === s.index ? null : s.index)}>
                  {open === s.index ? "Close the replay" : `Replay it with ${booth.pbp.name}`}
                </button>
                {open === s.index && (
                  <div className="mt-2 space-y-2">
                    <BroadcastField
                      play={s.play}
                      home={home}
                      away={away}
                      homeColor={clubInk(home, game.year).primary}
                      awayColor={clubInk(away, game.year).primary}
                      playing
                      index={s.index}
                      year={game.year}
                      game={game}
                    />
                    {lines.map((c) => (
                      <p key={c.text} className={c.speaker === "PBP" ? "text-[15px] text-white" : "text-sm italic text-paper"}>
                        <span className="not-italic font-display text-[11px] font-bold uppercase tracking-wide text-brass">
                          {c.speaker === "PBP" ? booth.pbp.name : booth.color.name}:{" "}
                        </span>
                        {c.text}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {results.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.25em] text-muted">HOW THE MATCHUPS WENT</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {results.map((r) => {
              const defTeam = (r.m.teamId === home ? away : home) as TeamId;
              const won = r.winner === "offense" ? r.m.teamId : r.winner === "defense" ? defTeam : null;
              return (
                <li key={`${r.m.kind}-${r.m.teamId}`} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
                  <p className="flex items-center justify-between gap-2 text-[11px] tracking-widest text-muted">
                    <span>
                      {MATCHUP_LABEL[r.m.kind]} · {teamAbbr(r.m.teamId)} ball
                    </span>
                    <span className={won ? "text-brass" : ""}>{won ? `${teamAbbr(won)} WON IT` : "A DRAW"}</span>
                  </p>
                  <p className="mt-1 text-paper">{r.line}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {game.practice && (
        <p className="text-xs text-muted">
          Practice focus this week: <span className="text-white">{PRACTICE[game.practice].label}</span>.
        </p>
      )}
    </section>
  );
}

/** What the booth will be talking about tonight: series, streaks, old teams, milestones, records. */
export function TonightsStorylines({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  // Identities have their own cards above; the booth list is everything else it remembers.
  const notes = useMemo(() => pregameMemory(save, game).filter((n) => n.kind !== "style"), [save, game]);
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const styles = useMemo(() => [away, home].map((id) => ({ id, s: teamStyle(save, id) })), [save, away, home]);
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs tracking-[0.25em] text-brass">TEAM IDENTITIES</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {styles.map(({ id, s }) => (
            <li key={id} className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm">
              <p className="flex items-center gap-2 font-medium text-white">
                <Logo id={id} size={20} /> {s.offense} · {s.defense}
              </p>
              <p className="mt-1 text-xs text-muted">{s.line}</p>
              {s.missing.map((m) => (
                <p key={m} className="mt-1 text-xs text-brick">
                  {m}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </div>
      {notes.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.25em] text-brass">TONIGHT IN THE BOOTH</p>
          <ul className="mt-2 space-y-1 text-sm text-paper">
            {notes.slice(0, 6).map((n) => (
              <li key={n.text} className="border-l-2 border-brass/50 pl-3">
                <span className="mr-1 text-[10px] tracking-widest text-muted">{n.kind.toUpperCase()}</span> {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The halftime report: the half's scoring, who's carrying each side, and what comes next. */
export function HalftimeDesk({ game, log }: { game: GameResult; log: PlayLog[] }) {
  const r = useMemo(() => halftimeReport(game, log), [game, log]);
  if (!r) return null;
  return (
    <div className="space-y-2 px-4 pt-4 text-sm sm:px-5">
      <p className="text-xs tracking-[0.25em] text-brass">HALFTIME · {r.score.toUpperCase()}</p>
      {r.scoring.length > 0 ? (
        <ol className="space-y-1 text-paper">
          {r.scoring.map((x) => (
            <li key={x} className="border-l-2 border-white/15 pl-3">
              {x}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">Scoreless at the half. The defenses have owned it.</p>
      )}
      {r.leaders.length > 0 && <p className="text-paper">Leaders: {r.leaders.join(" · ")}</p>}
      {r.turning && <p className="text-brick">{r.turning}</p>}
      <p className="text-muted">{r.secondHalf}</p>
    </div>
  );
}

/** The postgame podium: both coaches and the player of the game, quoting the real result. */
export function PostgameInterviews({ game }: { game: GameResult }) {
  const save = useGameStore((s) => s.save)!;
  const list = useMemo(() => postgameInterviews(save, game), [save, game]);
  if (!list.length) return null;
  return (
    <section aria-label="Postgame interviews">
      <h4 className="mb-2 text-xs tracking-[0.2em] text-muted">At the podium</h4>
      <ul className="grid gap-2 sm:grid-cols-3">
        {list.map((x) => (
          <li key={x.who + x.role} className="rounded-md border border-line bg-surface-2 p-3 text-sm">
            <p className="flex items-center gap-2 font-display text-xs font-bold uppercase italic tracking-wide text-brass">
              <Logo id={x.teamId} size={18} /> {x.who}
            </p>
            <p className="text-[11px] text-muted">{x.role}</p>
            <p className="mt-2 text-paper">&ldquo;{x.quote}&rdquo;</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
