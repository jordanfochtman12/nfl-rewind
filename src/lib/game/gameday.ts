/**
 * Game week for the owner's own club: the key matchups the broadcast follows, the scouting
 * report on the next opponent, the one practice focus the staff drills that week, the rules
 * a given season is played under, and the swing plays of a finished game. Regular game only;
 * History mode replays real results and never reads any of this.
 */
import { eraProfile, kickoffRules, otCall, otRules, replayReview, fairCatchKickoff, tenSecondRunoff, xpKickYards } from "./era.ts";
import { originalLeague } from "./teams.ts";
import { playerName, starters } from "./players.ts";
import { planFor } from "./sim.ts";
import type { BoxPlayer, DynastySave, GameResult, Player, PlayLog, TeamId } from "./types.ts";

export type PracticeFocus = "runD" | "passPro" | "ballSecurity" | "redZone";

export const PRACTICE: Record<PracticeFocus, { label: string; blurb: string }> = {
  runD: { label: "Run defense", blurb: "Gap discipline and tackling drills. A little stouter against the run." },
  passPro: { label: "Pass protection", blurb: "Blitz pickups and slide calls. A few fewer sacks." },
  ballSecurity: { label: "Ball security", blurb: "High-and-tight and decision reps. Fewer fumbles and picks." },
  redZone: { label: "Red zone", blurb: "Compressed-field reps. Better finishing inside the 20." },
};

/** The practice focus the owner set for this game, if it's his and he set one. */
export function practiceFor(save: DynastySave, game: GameResult): PracticeFocus | undefined {
  if (save.sandbox || save.realHistory) return undefined;
  if (game.homeId !== save.userTeamId && game.awayId !== save.userTeamId) return undefined;
  return save.practice?.gameId === game.id ? save.practice.focus : undefined;
}

export type MatchupKind = "wr-cb" | "lt-edge" | "rb-lb";

export interface KeyMatchup {
  kind: MatchupKind;
  /** The offense in this matchup. */
  teamId: TeamId;
  offId: string;
  defId: string;
  offGrade: number;
  defGrade: number;
}

export const MATCHUP_LABEL: Record<MatchupKind, string> = {
  "wr-cb": "No. 1 receiver vs. top corner",
  "lt-edge": "Left tackle vs. best edge rusher",
  "rb-lb": "Lead back vs. middle linebacker",
};

const best = (ps: Player[], score: (p: Player) => number) => ps.slice().sort((a, b) => score(b) - score(a))[0];
export const wrGrade = (p: Player) => Math.round((p.ratings.speed + p.ratings.rrt + p.ratings.catch) / 3);
export const cbGrade = (p: Player) => Math.round((p.ratings.cov + p.ratings.speed) / 2);
export const edgeGrade = (p: Player) => Math.round(p.ratings.prs);
export const ltGrade = (p: Player) => Math.round(p.ratings.passBlk);
const rbGrade = (p: Player) => Math.round((p.ratings.btk + p.ratings.elu + p.ratings.speed) / 3);
const lbGrade = (p: Player) => Math.round((p.ratings.tak + p.ratings.pur) / 2);

/** The best edge rusher a defense has: its ends and its edge-rushing outside linebackers. */
export function topEdge(save: DynastySave, teamId: TeamId): Player | undefined {
  const pool = [...starters(save, teamId, "DE", 2), ...starters(save, teamId, "OLB", 2).filter((p) => p.arch === "edge")];
  return best(pool, edgeGrade);
}

/** The three one-on-ones each way that decide most games, as they line up this week. */
export function keyMatchups(save: DynastySave, homeId: TeamId, awayId: TeamId): KeyMatchup[] {
  const out: KeyMatchup[] = [];
  for (const [o, d] of [
    [awayId, homeId],
    [homeId, awayId],
  ] as const) {
    const wr = best(starters(save, o, "WR", 3), wrGrade);
    const cb = best(starters(save, d, "CB", 2), cbGrade);
    if (wr && cb) out.push({ kind: "wr-cb", teamId: o, offId: wr.id, defId: cb.id, offGrade: wrGrade(wr), defGrade: cbGrade(cb) });
    const lt = starters(save, o, "LT", 1)[0];
    const edge = topEdge(save, d);
    if (lt && edge) out.push({ kind: "lt-edge", teamId: o, offId: lt.id, defId: edge.id, offGrade: ltGrade(lt), defGrade: edgeGrade(edge) });
    const rb = starters(save, o, "RB", 1)[0];
    const lb = starters(save, d, "MLB", 1)[0] ?? starters(save, d, "OLB", 1)[0];
    if (rb && lb) out.push({ kind: "rb-lb", teamId: o, offId: rb.id, defId: lb.id, offGrade: rbGrade(rb), defGrade: lbGrade(lb) });
  }
  return out;
}

/** Who has the edge before kickoff, in a word the booth would use. */
export function matchupEdge(m: KeyMatchup): "offense" | "defense" | "even" {
  const gap = m.offGrade - m.defGrade;
  return gap >= 5 ? "offense" : gap <= -5 ? "defense" : "even";
}

export interface MatchupResult {
  m: KeyMatchup;
  line: string;
  winner: "offense" | "defense" | "even";
}

/** How each key matchup actually went, from the box score. */
export function matchupReport(save: DynastySave, game: GameResult): MatchupResult[] {
  const boxFor = (id: TeamId) => (id === game.homeId ? game.boxHome : game.boxAway) ?? [];
  const row = (box: BoxPlayer[], id: string) => box.find((b) => b.playerId === id);
  const name = (id: string) => (save.players[id] ? playerName(save.players[id]!) : "—");
  return (game.matchups ?? []).map((m) => {
    const defTeam = (m.teamId === game.homeId ? game.awayId : game.homeId) as TeamId;
    const o = row(boxFor(m.teamId), m.offId);
    const d = row(boxFor(defTeam), m.defId);
    if (m.kind === "wr-cb") {
      const yds = o?.recYds ?? 0;
      const td = o?.recTd ?? 0;
      const picks = d?.ints ?? 0;
      const winner = picks > 0 || (yds < 45 && !td) ? "defense" : yds >= 85 || td >= 1 ? "offense" : "even";
      return { m, winner, line: `${name(m.offId)}: ${o?.rec ?? 0} catches, ${yds} yards${td ? `, ${td} TD` : ""}. ${name(m.defId)}: ${picks ? `${picks} INT` : `${d?.pd ?? 0} ${(d?.pd ?? 0) === 1 ? "pass" : "passes"} defended`}.` };
    }
    if (m.kind === "lt-edge") {
      const sacks = d?.sacks ?? 0;
      const hits = d?.qbHits ?? 0;
      const winner = sacks >= 1 || hits >= 3 ? "defense" : hits === 0 ? "offense" : "even";
      return { m, winner, line: `${name(m.defId)}: ${sacks} ${sacks === 1 ? "sack" : "sacks"}, ${hits} QB ${hits === 1 ? "hit" : "hits"} against ${name(m.offId)}.` };
    }
    const yds = o?.rushYds ?? 0;
    const att = o?.rushAtt ?? 0;
    const ypc = att ? yds / att : 0;
    const winner = att >= 8 && ypc >= 4.6 ? "offense" : att >= 8 && ypc < 3.3 ? "defense" : "even";
    return { m, winner, line: `${name(m.offId)}: ${att} carries, ${yds} yards. ${name(m.defId)}: ${d?.tackles ?? 0} tackles.` };
  });
}

export interface ScoutingReport {
  games: number;
  lines: string[];
  suggest: PracticeFocus;
  why: string;
}

/** The advance scout's report on a club: what they do, from their games this season. */
export function scoutingReport(save: DynastySave, teamId: TeamId): ScoutingReport {
  const played = [...save.schedule, ...save.playoffGames].filter((g) => g.played && (g.homeId === teamId || g.awayId === teamId));
  const plan = planFor(save, teamId);
  const sum = (pick: (g: GameResult, home: boolean) => number | undefined) =>
    played.reduce((n, g) => n + (pick(g, g.homeId === teamId) ?? 0), 0);
  const boxSum = (g: GameResult, own: boolean, k: keyof BoxPlayer) =>
    ((own === (g.homeId === teamId) ? g.boxHome : g.boxAway) ?? []).reduce((n, b) => n + ((b[k] as number | undefined) ?? 0), 0);
  const att = played.reduce((n, g) => n + boxSum(g, true, "passAtt"), 0);
  const rush = played.reduce((n, g) => n + boxSum(g, true, "rushAtt"), 0);
  const sacks = played.reduce((n, g) => n + boxSum(g, true, "sacks"), 0);
  const takeaways = sum((g, h) => (h ? g.awayTo : g.homeTo));
  const rz = sum((g, h) => (h ? g.homeRz : g.awayRz));
  const rzAtt = sum((g, h) => (h ? g.homeRzAtt : g.awayRzAtt));
  const oppRz = sum((g, h) => (h ? g.awayRz : g.homeRz));
  const oppRzAtt = sum((g, h) => (h ? g.awayRzAtt : g.homeRzAtt));
  const n = played.length;
  const era = eraProfile(save.year);
  const leaguePass = era.passAtt / (era.passAtt + era.rushAtt);
  const passShare = att + rush ? att / (att + rush) : leaguePass;
  const lines: string[] = [];
  const blitz = plan.blitz === "heavy" ? "They bring pressure early and often." : plan.blitz === "rare" ? "They sit back in coverage and rush four." : "They mix pressure with coverage.";
  const fourth = plan.fourth === "aggressive" ? "They go for it on fourth down more than most." : plan.fourth === "conservative" ? "They punt and play field position." : "Normal fourth-down nerve.";
  if (n === 0) {
    lines.push(`No film yet this season. The staff's read on their coaches: they lean ${plan.attack === "pass" ? "pass" : plan.attack === "run" ? "run" : "balanced"}.`, blitz, fourth);
  } else {
    const lean = passShare - leaguePass;
    lines.push(
      `Over ${n} ${n === 1 ? "game" : "games"} they throw on ${Math.round(passShare * 100)}% of snaps${Math.abs(lean) >= 0.03 ? ` (league ${Math.round(leaguePass * 100)}%)` : ""}.`,
      `${(sacks / n).toFixed(1)} sacks and ${(takeaways / n).toFixed(1)} takeaways a game.`,
      blitz,
      rzAtt ? `Red zone: ${rz}/${rzAtt} touchdowns on offense; they allow ${oppRz}/${oppRzAtt || 0} on defense.` : fourth,
    );
    if (rzAtt) lines.push(fourth);
  }
  // The scout's recommendation is whatever their tape says hurts most.
  const options: { f: PracticeFocus; score: number; why: string }[] = [
    { f: "runD", score: (leaguePass - passShare) * 10 + (plan.attack === "run" ? 0.6 : 0), why: "They want to run it down your throat." },
    { f: "passPro", score: (n ? sacks / n - era.sackRate * era.passAtt : 0) * 0.8 + (plan.blitz === "heavy" ? 0.7 : 0), why: "Their pass rush and blitz package are the threat." },
    { f: "ballSecurity", score: (n ? takeaways / n - 1.6 : 0) * 0.9, why: "They take the ball away." },
    { f: "redZone", score: oppRzAtt ? (0.55 - oppRz / oppRzAtt) * 3 : 0, why: "They tighten up inside the 20." },
  ];
  const top = options.sort((a, b) => b.score - a.score)[0]!;
  return { games: n, lines, suggest: top.f, why: top.why };
}

/** Whether a focus answers what the opponent actually does. Matching the scout's read is worth more. */
export function focusMatchesReport(save: DynastySave, oppId: TeamId, focus: PracticeFocus): boolean {
  return scoutingReport(save, oppId).suggest === focus;
}

export interface RuleInPlay {
  title: string;
  detail: string;
}

/** The rules a game is played under, for the pregame "rules in play" card. */
export function rulesInPlay(year: number, phase: GameResult["phase"], teamId?: TeamId): RuleInPlay[] {
  const ko = kickoffRules(year);
  const ot = otRules(year, phase);
  const out: RuleInPlay[] = [];
  out.push({
    title: year >= 2024 ? "Dynamic kickoff" : `Kickoffs from the ${ko.from}`,
    detail:
      year >= 2024
        ? `Coverage lines up at the opponent's 40; touchbacks come out to the ${ko.tb}.`
        : `Touchbacks at the ${ko.tb}.${fairCatchKickoff(year) ? " A fair catch inside the 25 is a touchback." : ""}`,
  });
  const afl = teamId ? originalLeague(teamId) === "AFL" && year <= 1969 : false;
  out.push(
    year >= 1994
      ? { title: "Two-point conversion", detail: year >= 2015 ? `Snapped from the 2. Kicks are from the 15 (${xpKickYards(year)}-yard try).` : "Snapped from the 2, or kick from the 2." }
      : afl
        ? { title: "AFL two-point try", detail: "The AFL lets you run or pass it in from the 2 for two." }
        : { title: "No two-point try", detail: "The NFL won't allow the two-point conversion until 1994. Kick it and take one." },
  );
  out.push({
    title: year < 1974 ? "Goalposts on the goal line" : "Goalposts on the end line",
    detail: year < 1974 ? "Field goals are 7 yards plus the line of scrimmage, and a miss comes out to the 20." : "Field goals are 17 yards plus the line of scrimmage; a miss goes back to the spot.",
  });
  out.push({ title: ot.kind === "none" ? "No overtime" : "Overtime", detail: ot.kind === "none" ? "A tie after four quarters stands." : otCall(ot.kind, year).replace(/^Overtime[.:]? ?/, "") });
  if (year >= 1978) out.push({ title: "Five-yard contact rule", detail: "Defenders can't touch a receiver past five yards. Throwing is easier than it used to be." });
  else out.push({ title: "Bump and run", detail: "Corners can hit receivers all the way down the field." });
  if (replayReview(year)) out.push({ title: "Instant replay", detail: "Challenges and booth reviews can overturn a call." });
  if (tenSecondRunoff(year)) out.push({ title: "Ten-second runoff", detail: "Some fouls in the last minute of a half cost ten seconds." });
  return out;
}

// Standard normal CDF (Abramowitz-Stegun), for the win-probability line.
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Win probability for `us` after a play: score, time left, and who has the ball where. */
export function winProb(l: PlayLog, us: TeamId, home: TeamId, final: boolean): number {
  const ours = us === home ? l.hs : l.as;
  const theirs = us === home ? l.as : l.hs;
  const lead = ours - theirs;
  if (final) return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  const left = l.q <= 4 ? ((4 - l.q) * 900 + l.clock) / 3600 : Math.max(0.01, l.clock / 3600);
  const field = ((l.spot - 25) / 15) * (l.poss === us ? 1 : -1);
  return Math.min(0.995, Math.max(0.005, phi((lead + field) / (13.4 * Math.sqrt(Math.max(0.004, left)) + 0.6))));
}

/**
 * The win-probability line through a game, each value read after its play: the next snap's
 * situation (down, field position, clock, who has it) with the score that play left.
 */
export function wpSeries(log: PlayLog[], us: TeamId, home: TeamId, final = true): number[] {
  return log.map((l, k) => {
    const next = log[k + 1];
    if (!next) return winProb(l, us, home, final);
    return winProb({ ...next, hs: l.hs, as: l.as }, us, home, false);
  });
}

export interface SwingPlay {
  index: number;
  before: number;
  after: number;
  play: PlayLog;
}

/** The plays that moved the win probability most, biggest first. */
export function swingPlays(log: PlayLog[], us: TeamId, home: TeamId, n = 3): SwingPlay[] {
  const wp = wpSeries(log, us, home);
  const out: SwingPlay[] = [];
  for (let k = 1; k < log.length; k++) out.push({ index: k, before: wp[k - 1]!, after: wp[k]!, play: log[k]! });
  // The final whistle snaps the line to 0 or 1; that isn't a play anyone made.
  return out
    .filter((s) => s.index < log.length - 1 || log[s.index]!.tag)
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, n);
}
