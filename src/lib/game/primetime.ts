/**
 * Primetime: the league's weekly studio show. Built after every slate from what actually
 * happened on the field: the stories of the week, every recap with its top performers,
 * players of the week from that week's box scores, stat leaders, the injury report, power
 * rankings with movement, the playoff picture and predictions, next week's lines, and in
 * January the postseason, Super Bowl and season-awards specials.
 */
import { rumorMill } from "./market.ts";
import type {
  BoxPlayer,
  DynastySave,
  GameResult,
  Player,
  PrimetimeHonoree,
  PrimetimeInjury,
  PrimetimeLeaderBoard,
  PrimetimeOutlook,
  PrimetimePowerRow,
  PrimetimePreview,
  PrimetimeRecap,
  PrimetimeShow,
  PrimetimeStory,
  SeasonStats,
  TeamId,
  TeamState,
} from "./types.ts";
import { milestoneChases, weeklyStorylines } from "./storylines.ts";
import { seriesNote } from "./h2h.ts";
import {
  activeTeamIds,
  conferenceOf,
  displayName,
  divisionKey,
  gamesInSeason,
  roman,
  superBowlNumber,
  teamAbbr,
} from "./teams.ts";
import { gameDateLabel, gamesInWeek } from "./schedule.ts";
import { depthAt, livingPlayers, playerName, rosterOf } from "./players.ts";
import { conferenceTeams, divisionWinner, playoffField, sortedDivision, winPct } from "./standings.ts";
import { playoffTeamCount } from "./era.ts";
import { leagueChampions, seedPlayoffs } from "./playoffs.ts";
import { calculateAwards } from "./events.ts";
import { produceEpisode } from "./studio.ts";
import { weekReel } from "./weekReel.ts";
import { posLabel } from "./posLabel.ts";

type Kind = NonNullable<PrimetimeShow["kind"]>;

const OPENS = [
  "Hello everybody, and welcome to Primetime. The film is in, the scores are final, and somebody just rewrote a Sunday.",
  "You're looking live at Primetime. Coffee's cold, the clicker's hot, and the league just played a full slate.",
  "Back again. Helmets off, lights up. This is Primetime — every score, every wound, one play you'll argue about at work.",
  "Good evening, football. The booth's warm, the tape is cut, and the league just handed us a show.",
  "Live from the desk — Primetime is on the air. Every score from the slate, one story that outlasts the rest.",
  "We watched every game today so you didn't have to. This is Primetime.",
  "Welcome back. Somewhere out there a coach is already watching Monday's film. We start with today's.",
  "Primetime is on. Grab a seat — this Sunday earned a full rundown.",
  "The stadium lights are still cooling off and we're already rolling tape. Let's get into it.",
];

const rec = (t: TeamState) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
const name = (save: DynastySave, id: TeamId) => displayName(save.year, id);
const clubOf = (p: Player): TeamId | undefined =>
  p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? undefined : p.teamId;
const comma = (n: number) => n.toLocaleString("en-US");

/* ---------- team strength: roster talent blended with what the season has shown ---------- */

function ratingOf(save: DynastySave, id: TeamId, cache: Map<TeamId, number>): number {
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const t = save.teams[id]!;
  const top = rosterOf(save, id)
    .filter((p) => p.injuredWeeks <= 0 && !p.onIR)
    .map((p) => p.ovr)
    .sort((a, b) => b - a)
    .slice(0, 24);
  const talent = top.length ? top.reduce((a, b) => a + b, 0) / top.length : 65;
  const gp = t.wins + t.losses + t.ties;
  const w = gp / (gp + 2);
  const r = (talent - 72) * 0.9 + (gp ? ((t.pf - t.pa) / gp) * 0.35 * w : 0) + (winPct(t) - 0.5) * 12 * w;
  cache.set(id, r);
  return r;
}

const winProb = (spread: number) => 1 / (1 + Math.exp(-spread / 6));

function lineText(home: TeamId, away: TeamId, spread: number): string {
  const s = Math.round(Math.abs(spread) * 2) / 2;
  if (s < 0.5) return "Pick'em";
  return `${teamAbbr(spread > 0 ? home : away)} -${s}`;
}

/* ---------- box-score reading ---------- */

function offGame(b: BoxPlayer): number {
  return (
    (b.passYds ?? 0) * 0.04 +
    (b.passTd ?? 0) * 4 -
    (b.passInt ?? 0) * 2.5 +
    (b.rushYds ?? 0) * 0.1 +
    (b.rushTd ?? 0) * 6 +
    (b.recYds ?? 0) * 0.1 +
    (b.rec ?? 0) * 0.4 +
    (b.recTd ?? 0) * 6
  );
}

function defGame(b: BoxPlayer): number {
  return (
    (b.sacks ?? 0) * 4 +
    (b.ints ?? 0) * 5 +
    (b.ff ?? 0) * 3 +
    (b.fr ?? 0) * 3 +
    (b.tfl ?? 0) * 1 +
    (b.pd ?? 0) * 1 +
    (b.tackles ?? 0) * 0.5
  );
}

function statLine(b: BoxPlayer): string {
  const bits: string[] = [];
  if ((b.passAtt ?? 0) >= 8) {
    bits.push(`${b.passCmp ?? 0}/${b.passAtt}, ${b.passYds ?? 0} yds`);
    if (b.passTd) bits.push(`${b.passTd} TD`);
    if (b.passInt) bits.push(`${b.passInt} INT`);
  }
  if ((b.rushAtt ?? 0) >= 5 && (b.rushYds ?? 0) >= 30) bits.push(`${b.rushAtt}-${b.rushYds} rushing${b.rushTd ? `, ${b.rushTd} TD` : ""}`);
  else if (b.rushTd && !(b.passAtt ?? 0)) bits.push(`${b.rushTd} rush TD`);
  if ((b.rec ?? 0) >= 3) bits.push(`${b.rec}-${b.recYds ?? 0} receiving${b.recTd ? `, ${b.recTd} TD` : ""}`);
  if (b.sacks) bits.push(`${b.sacks} sack${b.sacks === 1 ? "" : "s"}`);
  if (b.ints) bits.push(`${b.ints} INT`);
  if (b.ff) bits.push(`${b.ff} FF`);
  if (!bits.length && b.tackles) bits.push(`${b.tackles} tackles`);
  return bits.join(", ");
}

function gameBoxes(g: GameResult): { teamId: TeamId; b: BoxPlayer }[] {
  return [
    ...(g.boxHome ?? []).map((b) => ({ teamId: g.homeId as TeamId, b })),
    ...(g.boxAway ?? []).map((b) => ({ teamId: g.awayId as TeamId, b })),
  ];
}

function performers(save: DynastySave, g: GameResult): string[] {
  return gameBoxes(g)
    .map(({ teamId, b }) => ({ teamId, b, p: save.players[b.playerId], s: Math.max(offGame(b), defGame(b) * 1.2) }))
    .filter((r) => !!r.p && r.s > 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((r) => `${playerName(r.p!)} (${teamAbbr(r.teamId)} ${posLabel(r.p!)}) — ${statLine(r.b)}`);
}

/* ---------- segments ---------- */

function recapOf(save: DynastySave, g: GameResult): PrimetimeRecap {
  const home = name(save, g.homeId as TeamId);
  const away = name(save, g.awayId as TeamId);
  const hs = g.homeScore;
  const as = g.awayScore;
  const hi = Math.max(hs, as);
  const lo = Math.min(hs, as);
  const margin = hi - lo;
  const winner = hs >= as ? home : away;
  const loser = hs >= as ? away : home;
  const wx = g.weather && g.weather !== "clear" ? ` ${g.weather[0]!.toUpperCase()}${g.weather.slice(1)} on the ground.` : "";
  let line: string;
  if (g.phase === "superBowl") line = `${winner} are champions of football, ${hi}-${lo} over ${loser}.`;
  else if (g.round) line = `${g.round}: ${winner} ${margin <= 3 ? "survive" : "advance past"} ${loser}, ${hi}-${lo}.${wx}`;
  else if (margin === 0) line = `${away} and ${home} play to a ${as}-${hs} deadlock.${wx}`;
  else if (g.ot) line = `Overtime! ${winner} outlast ${loser}, ${hi}-${lo}.${wx}`;
  else if (g.slot === "M" && g.night) line = `Monday night: ${winner} ${hi}-${lo} over ${loser}.${wx}`;
  else if (g.rivalry && margin <= 7) line = `Rivalry game — ${winner} edge ${loser}, ${hi}-${lo}.${wx}`;
  else if (margin <= 3) line = `Down to the wire — ${winner} steal it ${hi}-${lo}.${wx}`;
  else if (margin >= 21) line = `${winner} roll ${loser}, ${hi}-${lo}.${wx}`;
  else line = `${winner} handle ${loser}, ${hi}-${lo}.${wx}`;
  const note =
    g.highlights?.[0] ??
    (g.mvpPlayerId && save.players[g.mvpPlayerId] ? `${playerName(save.players[g.mvpPlayerId]!)} runs the tape.` : "Blue-collar football.");
  return {
    homeId: g.homeId as TeamId,
    awayId: g.awayId as TeamId,
    homeScore: hs,
    awayScore: as,
    line,
    note,
    round: g.round,
    performers: performers(save, g),
  };
}

function drama(g: GameResult): number {
  const margin = Math.abs(g.homeScore - g.awayScore);
  const total = g.homeScore + g.awayScore;
  return total * 1.2 - margin * 4 + (margin === 0 ? 20 : 0) + (g.rivalry ? 12 : 0) + (g.night ? 8 : 0) + (g.ot ? 15 : 0);
}

function honoree(p: Player, teamId: TeamId, line: string): PrimetimeHonoree {
  return { playerId: p.id, name: playerName(p), pos: p.pos, teamId, line };
}

function playersOfWeek(save: DynastySave, games: GameResult[]): PrimetimeShow["potw"] {
  const confs = save.year < 1970 ? ["NFL", "AFL"] : ["AFC", "NFC"];
  return confs.map((conf) => {
    let off: { p: Player; b: BoxPlayer; t: TeamId; s: number } | undefined;
    let def: { p: Player; b: BoxPlayer; t: TeamId; s: number } | undefined;
    for (const g of games) {
      const winner = g.homeScore >= g.awayScore ? g.homeId : g.awayId;
      for (const { teamId, b } of gameBoxes(g)) {
        if (conferenceOf(save.year, teamId) !== conf) continue;
        const p = save.players[b.playerId];
        if (!p) continue;
        const bonus = teamId === winner ? 3 : 0;
        const o = offGame(b) + bonus;
        const d = defGame(b) + bonus;
        if (!off || o > off.s) off = { p, b, t: teamId, s: o };
        if (!def || d > def.s) def = { p, b, t: teamId, s: d };
      }
    }
    return {
      conf,
      off: off && off.s > 8 ? honoree(off.p, off.t, statLine(off.b)) : undefined,
      def: def && def.s > 5 ? honoree(def.p, def.t, statLine(def.b)) : undefined,
    };
  });
}

function seasonLine(p: Player, s: SeasonStats | undefined): string {
  if (!s) return "";
  if (p.pos === "QB") return `${comma(s.passYds)} yds · ${s.passTd} TD · ${s.passInt} INT`;
  if (p.pos === "RB" || p.pos === "FB") return `${comma(s.rushYds)} rush yds · ${s.rushTd + s.recTd} TD · ${s.rec} rec`;
  if (p.pos === "WR" || p.pos === "TE") return `${s.rec} rec · ${comma(s.recYds)} yds · ${s.recTd} TD`;
  if (p.pos === "K") return `FG ${s.fgMade}/${s.fgAtt} · ${s.fgMade * 3 + s.xpMade} pts`;
  if (p.pos === "P") return `${s.punts} punts · ${s.punts ? (s.puntYds / s.punts).toFixed(1) : "—"} avg`;
  if (["LT", "LG", "C", "RG", "RT"].includes(p.pos)) return `${s.gp} games up front`;
  const bits = [`${s.tackles} tkl`];
  if (s.sacks) bits.push(`${s.sacks} sacks`);
  if (s.ints) bits.push(`${s.ints} INT`);
  if (s.ff) bits.push(`${s.ff} FF`);
  return bits.join(" · ");
}

function statLeaders(save: DynastySave): PrimetimeLeaderBoard[] {
  const year = save.year;
  const pool = livingPlayers(save).filter((p) => p.stats[year] && clubOf(p));
  const board = (label: string, of: (s: SeasonStats) => number): PrimetimeLeaderBoard => ({
    label,
    rows: pool
      .map((p) => ({ p, v: of(p.stats[year]!) }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((x) => ({ playerId: x.p.id, name: playerName(x.p), teamId: clubOf(x.p)!, value: x.v })),
  });
  return [
    board("Passing yards", (s) => s.passYds),
    board("Passing TD", (s) => s.passTd),
    board("Rushing yards", (s) => s.rushYds),
    board("Receiving yards", (s) => s.recYds),
    board("Sacks", (s) => s.sacks),
    board("Interceptions", (s) => s.ints),
  ].filter((b) => b.rows.length);
}

function injuryReport(save: DynastySave, fresh: (p: Player) => boolean): PrimetimeInjury[] {
  return livingPlayers(save)
    .filter((p) => clubOf(p) && (p.injuredWeeks > 0 || p.onIR) && p.injuryName)
    .filter((p) => p.ovr >= 74 || p.teamId === save.userTeamId)
    .sort((a, b) => Number(fresh(b)) - Number(fresh(a)) || b.ovr - a.ovr)
    .slice(0, 12)
    .map((p) => ({
      playerId: p.id,
      name: playerName(p),
      pos: p.pos,
      teamId: clubOf(p)!,
      injury: p.injuryName ?? "injury",
      weeks: p.injuredWeeks,
      ir: p.onIR,
      fresh: fresh(p),
    }));
}

function powerRankings(save: DynastySave, cache: Map<TeamId, number>): PrimetimePowerRow[] {
  const ranked = activeTeamIds(save.year)
    .map((id) => ({ id, t: save.teams[id]!, r: ratingOf(save, id, cache) }))
    .sort((a, b) => b.r - a.r);
  const prev = save.powerRanks ?? {};
  const next: Record<string, number> = {};
  ranked.forEach((x, i) => (next[x.id] = i + 1));
  const rows = ranked.slice(0, 10).map((x, i) => {
    const t = x.t;
    const gp = t.wins + t.losses + t.ties;
    const pd = t.pf - t.pa;
    const n = t.streak ? Number(t.streak.slice(1)) : 0;
    const streak = n >= 3 ? (t.streak.startsWith("W") ? `won ${n} straight` : `lost ${n} straight`) : "";
    const bits = [streak, gp ? `${pd >= 0 ? "+" : ""}${pd} point differential` : "the roster talks for them"].filter(Boolean);
    return { teamId: x.id, rank: i + 1, prev: prev[x.id], record: rec(t), blurb: bits.join(" · ") };
  });
  save.powerRanks = next;
  return rows;
}

function gamesBack(lead: TeamState, t: TeamState): number {
  return (lead.wins - t.wins + (t.losses - lead.losses)) / 2;
}

function playoffOutlook(save: DynastySave): PrimetimeOutlook[] {
  const year = save.year;
  if (year < 1970) {
    const divs = [...new Set(activeTeamIds(year).map((id) => divisionKey(year, id)))];
    return divs.map((d) => {
      const teams = sortedDivision(save, d);
      const lead = teams[0]!;
      return {
        conf: d,
        seeds: [{ seed: 1, teamId: lead.id, record: rec(lead), tag: "division leader" }],
        bubble: teams.slice(1, 3).map((t) => ({ teamId: t.id, record: rec(t), back: gamesBack(lead, t) })),
      };
    });
  }
  const n = playoffTeamCount(year).perConf;
  return (["AFC", "NFC"] as const).map((conf) => {
    const teams = conferenceTeams(save, conf);
    const field = playoffField(save, conf, n);
    const lastIn = field[field.length - 1]!;
    const leaders = new Set(
      [...new Set(teams.map((t) => divisionKey(year, t.id)))].map((d) => sortedDivision(save, d)[0]?.id),
    );
    return {
      conf,
      seeds: field.map((t, i) => ({
        seed: i + 1,
        teamId: t.id,
        record: rec(t),
        tag: leaders.has(t.id) ? "division leader" : "wild card",
      })),
      bubble: teams.slice(n, n + 3).map((t) => ({ teamId: t.id, record: rec(t), back: gamesBack(lastIn, t) })),
    };
  });
}

function projectedWins(save: DynastySave, id: TeamId, cache: Map<TeamId, number>): number {
  const t = save.teams[id]!;
  let w = t.wins + t.ties * 0.5;
  for (const g of save.schedule) {
    if (g.played || g.phase !== "regular" || (g.homeId !== id && g.awayId !== id)) continue;
    const home = g.homeId === id;
    const opp = (home ? g.awayId : g.homeId) as TeamId;
    const spread = ratingOf(save, id, cache) - ratingOf(save, opp, cache) + (g.site ? 0 : home ? 2.5 : -2.5);
    w += winProb(spread);
  }
  return w;
}

function predictions(
  save: DynastySave,
  cache: Map<TeamId, number>,
  alive?: Set<TeamId>,
): { preds: NonNullable<PrimetimeShow["predictions"]>; sb?: PrimetimeShow["superBowlPick"] } {
  const year = save.year;
  const confs = year < 1970 ? ["NFL", "AFL"] : ["AFC", "NFC"];
  const preds = confs
    .map((conf) => {
      const ids = activeTeamIds(year).filter((id) => conferenceOf(year, id) === conf && (!alive || alive.has(id)));
      const scored = ids
        .map((id) => ({ id, w: projectedWins(save, id, cache), r: ratingOf(save, id, cache) }))
        .map((x) => ({ ...x, s: x.w * 0.6 + x.r * 0.8 }))
        .sort((a, b) => b.s - a.s);
      const pick = scored[0];
      if (!pick) return undefined;
      const note = alive
        ? `The desk rides with ${name(save, pick.id)} to come out of the ${conf}.`
        : `Projected ${pick.w.toFixed(1)} wins.${scored[1] ? ` The ${name(save, scored[1].id)} are the team that can stop them.` : ""}`;
      return { conf, teamId: pick.id, note };
    })
    .filter((x): x is { conf: string; teamId: TeamId; note: string } => !!x);
  let sb: PrimetimeShow["superBowlPick"];
  if (preds.length === 2) {
    const ra = ratingOf(save, preds[0]!.teamId, cache);
    const rb = ratingOf(save, preds[1]!.teamId, cache);
    const winner = ra >= rb ? preds[0]!.teamId : preds[1]!.teamId;
    const loser = winner === preds[0]!.teamId ? preds[1]!.teamId : preds[0]!.teamId;
    const edge = Math.abs(ra - rb);
    const ws = 20 + Math.round(edge * 0.8) + (edge > 3 ? 7 : 3);
    const ls = Math.max(3, ws - Math.max(3, Math.round(edge)));
    sb = {
      winner,
      loser,
      score: `${ws}-${ls}`,
      note: `Super Bowl ${roman(superBowlNumber(year))} pick: ${name(save, winner)} over ${name(save, loser)}.`,
    };
  }
  return { preds, sb };
}

function previews(save: DynastySave, games: GameResult[], cache: Map<TeamId, number>): PrimetimePreview[] {
  const rows = games.map((g) => {
    const home = g.homeId as TeamId;
    const away = g.awayId as TeamId;
    const neutral = !!g.site || g.phase === "superBowl";
    const spread = ratingOf(save, home, cache) - ratingOf(save, away, cache) + (neutral ? 0 : 2.5);
    const ht = save.teams[home]!;
    const at = save.teams[away]!;
    const notes: string[] = [];
    const h2h = seriesNote(save, home, away);
    if (h2h?.revenge) notes.push(h2h.revenge);
    if (g.rivalry) notes.push("Rivalry game.");
    if (g.site) notes.push(`At ${g.site}.`);
    for (const [id, t] of [
      [home, ht],
      [away, at],
    ] as const) {
      const n = t.streak ? Number(t.streak.slice(1)) : 0;
      if (n >= 3) notes.push(`${name(save, id)} have ${t.streak.startsWith("W") ? "won" : "lost"} ${n} straight.`);
    }
    const qb = (id: TeamId) => depthAt(save, id, "QB").find((p) => p.injuredWeeks <= 0 && !p.onIR);
    const hq = qb(home);
    const aq = qb(away);
    if (hq && aq) notes.push(`${playerName(aq)} vs. ${playerName(hq)} under center.`);
    const slot = g.slot === "M" ? "Monday night" : g.slot === "T" ? "Thursday" : g.slot === "N" ? "Sunday night" : g.slot === "S" ? "Saturday" : "";
    const when = g.round ?? ([gameDateLabel(g), slot].filter(Boolean).join(" · ") || `Week ${g.week}`);
    const weight = winPct(ht) + winPct(at) - Math.abs(spread) / 20 + (g.rivalry ? 0.15 : 0) + (g.night ? 0.1 : 0);
    return {
      homeId: home,
      awayId: away,
      homeRecord: rec(ht),
      awayRecord: rec(at),
      line: lineText(home, away, spread),
      pick: spread >= 0 ? home : away,
      note: notes.slice(0, 2).join(" "),
      series: h2h?.series,
      last: h2h?.last,
      when,
      weight,
    };
  });
  return rows
    .sort((a, b) => b.weight - a.weight)
    .map(({ weight: _w, ...r }, i) => ({ ...r, featured: i === 0 }));
}

/* ---------- stories ---------- */

function storyHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A big game, said the way a reporter would say it. */
function spokenBig(b: BoxPlayer): string {
  const n = (x?: number) => x ?? 0;
  const w = (k: number) => (k <= 10 ? ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][k]! : String(k));
  if (n(b.passAtt) >= 10) return `${n(b.passCmp)} of ${n(b.passAtt)} for ${comma(n(b.passYds))} yards and ${w(n(b.passTd))} touchdown${n(b.passTd) === 1 ? "" : "s"}${n(b.passInt) ? `, with ${w(n(b.passInt))} pick${n(b.passInt) === 1 ? "" : "s"}` : ""}`;
  if (n(b.rushYds) >= 100) return `${n(b.rushAtt)} carries for ${n(b.rushYds)} yards${n(b.rushTd) ? ` and ${w(n(b.rushTd))} touchdown${n(b.rushTd) === 1 ? "" : "s"}` : ""}`;
  if (n(b.recYds) >= 100) return `${n(b.rec)} catches for ${n(b.recYds)} yards${n(b.recTd) ? ` and ${w(n(b.recTd))} touchdown${n(b.recTd) === 1 ? "" : "s"}` : ""}`;
  if (n(b.sacks) >= 2) return `${n(b.sacks)} sacks`;
  return `${w(n(b.ints))} interceptions`;
}

function stories(save: DynastySave, games: GameResult[], kind: Kind, injuries: PrimetimeInjury[]): PrimetimeStory[] {
  const out: (PrimetimeStory & { score: number })[] = [];
  const year = save.year;
  const covered = new Set<TeamId>();
  // Each kind of story has a few ways of being told, rotating week to week.
  const tell = (key: string, list: string[]) => list[storyHash(`${key}|${year}|${save.week}`) % list.length]!;

  for (const g of games) {
    const hw = g.homeScore > g.awayScore;
    const aw = g.awayScore > g.homeScore;
    if (!hw && !aw) continue;
    const w = (hw ? g.homeId : g.awayId) as TeamId;
    const l = (hw ? g.awayId : g.homeId) as TeamId;
    const wt = save.teams[w]!;
    const lt = save.teams[l]!;
    // Records before this game: back the result just played out of each.
    const wPre = (wt.wins - 1) / Math.max(1, wt.wins + wt.losses + wt.ties - 1);
    const lPre = lt.wins / Math.max(1, lt.wins + lt.losses + lt.ties - 1);
    const gpPre = lt.wins + lt.losses + lt.ties - 1;
    if (kind === "regular" && gpPre >= 3 && lPre - wPre >= 0.3) {
      out.push({
        tag: "Upset",
        headline: `${name(save, w)} stun ${name(save, l)}`,
        body: (() => {
          const before = `${wt.wins - 1}-${wt.losses}${wt.ties ? `-${wt.ties}` : ""}`;
          const sc = `${Math.max(g.homeScore, g.awayScore)}-${Math.min(g.homeScore, g.awayScore)}`;
          return tell(`up${w}`, [
            `Nobody gave the ${name(save, w)} much of a chance. They were ${before}, the ${name(save, l)} were ${rec(lt)}, and the ${name(save, w)} won it ${sc}.`,
            `The ${name(save, w)} came in ${before} and knocked off the ${rec(lt)} ${name(save, l)}, ${sc}.`,
            `${sc}, and it's the underdog. The ${name(save, w)} were ${before} going in. The ${name(save, l)} are left with a lot of questions.`,
            `File this one under surprises: the ${name(save, w)}, ${before} before kickoff, beat the ${rec(lt)} ${name(save, l)} ${sc}.`,
            `The ${name(save, l)} were ${rec(lt)} and rolling. The ${name(save, w)} didn't care, and won ${sc}.`,
            `Upset alert, and it held: the ${name(save, w)} over the ${name(save, l)}, ${sc}.`,
          ]);
        })(),
        teamIds: [w, l],
        playerIds: g.mvpPlayerId ? [g.mvpPlayerId] : [],
        score: 60 + (lPre - wPre) * 50,
      });
      covered.add(w);
    }
    for (const { teamId, b } of gameBoxes(g)) {
      const p = save.players[b.playerId];
      if (!p) continue;
      let big = "";
      let sc = 0;
      if ((b.passYds ?? 0) >= 400) [big, sc] = [`${b.passYds} passing yards`, 45 + ((b.passYds ?? 0) - 400) / 10];
      else if ((b.passTd ?? 0) >= 5) [big, sc] = [`${b.passTd} touchdown passes`, 50 + (b.passTd ?? 0)];
      else if ((b.rushYds ?? 0) >= 175) [big, sc] = [`${b.rushYds} rushing yards`, 45 + ((b.rushYds ?? 0) - 175) / 5];
      else if ((b.recYds ?? 0) >= 170) [big, sc] = [`${b.recYds} receiving yards`, 44 + ((b.recYds ?? 0) - 170) / 5];
      else if ((b.sacks ?? 0) >= 3) [big, sc] = [`${b.sacks} sacks`, 44 + (b.sacks ?? 0) * 2];
      else if ((b.ints ?? 0) >= 3) [big, sc] = [`${b.ints} interceptions`, 48];
      if (big) {
        out.push({
          tag: "Big day",
          headline: `${playerName(p)} goes off for ${big}`,
          body: tell(`big${p.id}`, [
            `${playerName(p)} was unstoppable: ${spokenBig(b)} for the ${name(save, teamId)}${g.round ? ` in the ${g.round}` : ""}.`,
            `Take a look at this line from ${playerName(p)}: ${spokenBig(b)}${g.round ? ` in the ${g.round}` : ""}. The ${name(save, teamId)} rode him all day.`,
            `${spokenBig(b)[0]!.toUpperCase()}${spokenBig(b).slice(1)}. That's ${playerName(p)}'s day for the ${name(save, teamId)}${g.round ? ` in the ${g.round}` : ""}, and it's one of the best performances we've seen this year.`,
          ]),
          teamIds: [teamId],
          playerIds: [p.id],
          score: sc,
        });
      }
    }
  }

  if (kind === "regular") {
    const teams = activeTeamIds(year).map((id) => save.teams[id]!);
    for (const t of teams) {
      const n = t.streak ? Number(t.streak.slice(1)) : 0;
      if (t.losses === 0 && t.ties === 0 && t.wins >= 4) {
        out.push({
          tag: "Perfect",
          headline: `Still perfect: ${name(save, t.id)} ${t.wins}-0`,
          body: tell(`perf${t.id}`, [
            `Nobody has solved them yet. They've outscored people by ${t.pf - t.pa} points.`,
            `${t.wins} games, ${t.wins} wins, and a ${t.pf - t.pa}-point scoring margin. Everybody's chasing them.`,
            `Still unbeaten. The question around the league is who even has a chance against them.`,
          ]),
          teamIds: [t.id],
          playerIds: [],
          score: 52 + t.wins,
        });
        covered.add(t.id);
      } else if (t.wins === 0 && t.losses >= 5) {
        out.push({
          tag: "Winless",
          headline: `${name(save, t.id)} still looking for a win`,
          body: tell(`winless${t.id}`, [
            `0-${t.losses}${t.ties ? `-${t.ties}` : ""}. The questions in the building are getting louder.`,
            `Still searching for that first win. At 0-${t.losses}, the pressure on the coaching staff is real.`,
            `0-${t.losses}${t.ties ? `-${t.ties}` : ""}, and it isn't getting easier. People around the team are frustrated.`,
          ]),
          teamIds: [t.id],
          playerIds: [],
          score: 32 + t.losses,
        });
      } else if (!covered.has(t.id) && n >= 5) {
        const won = t.streak.startsWith("W");
        out.push({
          tag: won ? "Hot" : "Skid",
          headline: won ? `${name(save, t.id)} have won ${n} straight` : `${name(save, t.id)} have dropped ${n} in a row`,
          body: won
            ? tell(`hot${t.id}`, [`${rec(t)} and climbing.`, `${n} in a row, and they're ${rec(t)}. Nobody wants to play them right now.`, `They're ${rec(t)} and playing as well as anybody in the league.`])
            : tell(`skid${t.id}`, [`${rec(t)}. The season is slipping away.`, `${n} straight losses, and at ${rec(t)} they're running out of time.`, `They're ${rec(t)}, and it's getting ugly.`]),
          teamIds: [t.id],
          playerIds: [],
          score: 30 + n * 3,
        });
      }
    }
    const total = gamesInSeason(year);
    const played = Math.max(...teams.map((t) => t.wins + t.losses + t.ties));
    if (year >= 1970 && played >= total - 4) {
      const n = playoffTeamCount(year).perConf;
      for (const conf of ["AFC", "NFC"] as const) {
        const ct = conferenceTeams(save, conf);
        const cut = ct[n];
        const lastIn = ct[n - 1];
        if (!cut || !lastIn) continue;
        const left = (t: TeamState) => total - (t.wins + t.losses + t.ties);
        for (const t of ct.slice(0, n)) {
          if (t.wins > cut.wins + left(cut)) {
            out.push({
              tag: "Clinched",
              headline: `${name(save, t.id)} clinch a playoff spot`,
              body: tell(`clinch${t.id}`, [`${rec(t)} with ${left(t)} to play. January football is booked.`, `They're in. ${rec(t)}, and now it's about seeding.`, `Clinched, with ${left(t)} game${left(t) === 1 ? "" : "s"} still to go.`]),
              teamIds: [t.id],
              playerIds: [],
              score: 56,
            });
          }
        }
        for (const t of ct.slice(n)) {
          if (t.wins + left(t) < lastIn.wins) {
            out.push({
              tag: "Eliminated",
              headline: `${name(save, t.id)} eliminated`,
              body: tell(`elim${t.id}`, [`${rec(t)}. The math ran out.`, `At ${rec(t)}, they're officially out of it.`, `That's it for them. ${rec(t)}, no postseason this year.`]),
              teamIds: [t.id],
              playerIds: [],
              score: 40,
            });
          }
        }
      }
    }
  }

  for (const inj of injuries.filter((i) => i.fresh && (i.weeks >= 3 || i.ir))) {
    const p = save.players[inj.playerId];
    if (!p || p.ovr < 82) continue;
    out.push({
      tag: "Injury",
      headline: `${inj.name} goes down`,
      body: `${name(save, inj.teamId)} ${inj.pos}, ${inj.injury}. ${inj.ir ? "Headed to injured reserve." : `Out ${inj.weeks} week${inj.weeks === 1 ? "" : "s"}.`}`,
      teamIds: [inj.teamId],
      playerIds: [inj.playerId],
      score: 48 + (p.ovr - 82),
    });
  }

  for (const n of save.weekNews.filter((x) => x.year === year && /record|milestone|all-time/i.test(`${x.headline} ${x.body}`))) {
    out.push({ tag: "Record", headline: n.headline, body: n.body, teamIds: n.teamIds, playerIds: n.playerIds, score: 54 });
  }

  if (kind === "regular") out.push(...weeklyStorylines(save));

  const seen = new Set<string>();
  const perTag = new Map<string, number>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((s) => (seen.has(s.headline) ? false : (seen.add(s.headline), true)))
    .filter((s) => {
      const n = perTag.get(s.tag) ?? 0;
      perTag.set(s.tag, n + 1);
      return n < 2;
    })
    .slice(0, 6)
    .map(({ score: _s, ...rest }) => rest);
}

function yourClub(save: DynastySave, games: GameResult[], nextGame?: GameResult): PrimetimeStory | undefined {
  const id = save.userTeamId;
  const t = save.teams[id];
  if (!t) return undefined;
  const g = games.find((x) => x.homeId === id || x.awayId === id);
  let body: string;
  if (!g) body = "A week off in the building. Film, rest, and next week's plan.";
  else {
    const home = g.homeId === id;
    const us = home ? g.homeScore : g.awayScore;
    const them = home ? g.awayScore : g.homeScore;
    const opp = (home ? g.awayId : g.homeId) as TeamId;
    body = `${us > them ? "Win" : us < them ? "Loss" : "Tie"}, ${us}-${them} ${home ? "vs" : "at"} ${name(save, opp)}. ${
      us > them ? "The building exhales." : us < them ? "Long flight home. The film's already loaded." : "Nobody sleeps easy on a tie."
    }`;
  }
  if (nextGame) {
    const opp = (nextGame.homeId === id ? nextGame.awayId : nextGame.homeId) as TeamId;
    body += ` Next: ${nextGame.homeId === id ? "vs" : "at"} ${name(save, opp)} (${rec(save.teams[opp]!)}).`;
  }
  return { tag: "Your club", headline: `${name(save, id)}: ${rec(t)}`, body, teamIds: [id], playerIds: [] };
}

/* ---------- the show ---------- */

export function buildPrimetime(save: DynastySave, kindArg?: Kind): void {
  const kind: Kind = kindArg ?? (save.phase === "playoffs" ? "playoffs" : "regular");
  const year = save.year;
  const cache = new Map<TeamId, number>();
  const regularGames = save.schedule.filter(g => g.year === year && g.phase === "regular");
  const finale = kind === "regular" && regularGames.length > 0 && regularGames.every(g => g.played);
  let games: GameResult[];
  if (kind === "regular") games = gamesInWeek(save, save.week).filter((g) => g.played);
  else if (kind === "playoffs") {
    const played = save.playoffGames.filter((g) => g.played);
    const lastWeek = Math.max(0, ...played.map((g) => g.week));
    games = played.filter((g) => g.week === lastWeek);
  } else games = save.superBowl?.played ? [save.superBowl] : [];

  const sorted = games.slice().sort((a, b) => drama(b) - drama(a));
  const recaps = sorted.map((g) => recapOf(save, g));
  const fresh = (p: Player) =>
    !!p.injuredOn && p.injuredOn.year === year && p.injuredOn.week === save.week && p.injuredOn.phase === save.phase;
  const injuries = kind === "awards" ? [] : injuryReport(save, fresh);

  let upcoming: GameResult[] = [];
  if (kind === "regular") upcoming = gamesInWeek(save, save.week + 1).filter((g) => !g.played);
  else if (kind === "playoffs") {
    upcoming = save.playoffGames.filter((g) => !g.played);
    if (!upcoming.length) {
      const c = leagueChampions(save);
      const a = c.afc ?? c.afl;
      const b = c.nfc ?? c.nfl;
      if (a && b) {
        upcoming = [
          {
            id: "sb-preview",
            year,
            week: 0,
            phase: "superBowl",
            round: `Super Bowl ${roman(superBowlNumber(year))}`,
            homeId: b,
            awayId: a,
            homeScore: 0,
            awayScore: 0,
            played: false,
          },
        ];
      }
    }
  }
  if (finale) {
    // Seeding only writes playoffGames. Preview the real bracket without advancing the calendar.
    const bracket = { ...save, playoffGames: [] };
    seedPlayoffs(bracket);
    upcoming = bracket.playoffGames;
  }
  const userNext = upcoming.find((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId);
  const userPlayed = games.some((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId);

  const storyList = kind === "awards" ? [] : stories(save, games, kind, injuries);
  if (!save.sandbox && (kind === "regular" || (kind === "playoffs" && (userPlayed || userNext)))) {
    const mine = yourClub(save, games, userNext);
    if (mine) storyList.push(mine);
  }

  let outlook: PrimetimeOutlook[] | undefined;
  let preds: PrimetimeShow["predictions"];
  let sbPick: PrimetimeShow["superBowlPick"];
  if (kind === "regular") {
    outlook = playoffOutlook(save);
    const p = predictions(save, cache);
    preds = p.preds;
    sbPick = p.sb;
  } else if (kind === "playoffs") {
    const lost = new Set<TeamId>();
    for (const g of save.playoffGames.filter((x) => x.played)) lost.add((g.homeScore >= g.awayScore ? g.awayId : g.homeId) as TeamId);
    const inField = new Set<TeamId>(save.playoffGames.flatMap((g) => [g.homeId as TeamId, g.awayId as TeamId]));
    const p = predictions(save, cache, new Set([...inField].filter((id) => !lost.has(id))));
    preds = p.preds;
    sbPick = p.sb;
  }

  const head = sorted[0];
  const playOfNight = head?.highlights?.[0] ?? "No single play rose above the rest.";

  const title =
    kind === "regular"
      ? `Week ${save.week}`
      : kind === "playoffs"
        ? (games[0]?.round ?? "The Playoffs").replace(/^(AFC|NFC|AFL|NFL) /, "")
        : kind === "superBowl"
          ? `Super Bowl ${roman(superBowlNumber(year))}`
          : "Awards Special";

  const open =
    kind === "regular"
      ? OPENS[save.week % OPENS.length]!
      : kind === "playoffs"
        ? `Welcome to the postseason edition of Primetime. ${title}: win and play on, lose and clean out the locker.`
        : kind === "superBowl"
          ? `The confetti's still coming down. This is Primetime from Super Bowl ${roman(superBowlNumber(year))}.`
          : `Black tie tonight. The ${year} season is in the books, and Primetime is handing out the hardware.`;

  const user = save.teams[save.userTeamId];
  const close =
    kind === "awards"
      ? `That's a wrap on ${year}. The draft is next, and every club gets a clean sheet. See you in the fall.`
      : save.sandbox
        ? `${title} is in the can. That's Primetime.`
        : `${name(save, save.userTeamId)} sit ${user ? rec(user) : "—"}. ${title} is in the can. That's Primetime.`;

  const show: PrimetimeShow = {
    v: 2,
    year,
    week: save.week,
    kind,
    title,
    open,
    stories: storyList,
    recaps,
    playOfNight,
    potw: kind === "awards" || !games.length ? undefined : playersOfWeek(save, games),
    leaders: statLeaders(save),
    injuries,
    power: kind === "regular" ? powerRankings(save, cache) : undefined,
    outlook,
    predictions: preds,
    superBowlPick: sbPick,
    previews: previews(save, upcoming, cache),
    chases: kind === "regular" && save.week >= 4 ? milestoneChases(save) : undefined,
    rumors: kind === "regular" ? rumorMill(save) : undefined,
    pow: "",
    powerPoll: "",
    wire: save.weekNews.filter((n) => n.year === year).map((n) => n.headline).slice(0, 6),
    close,
  };

  if ((kind === "awards" && save.awards) || finale) {
    const a = finale ? calculateAwards(save) : save.awards!;
    const award = (label: string, id?: string) => {
      const p = id ? save.players[id] : undefined;
      if (!p) return undefined;
      const team = clubOf(p) ?? (p.stats[year]?.teamId as TeamId);
      return { label, honoree: honoree(p, team, seasonLine(p, p.stats[year])) };
    };
    show.awards = [
      award("Most Valuable Player", a.mvp),
      award("Offensive Player of the Year", a.offPoy),
      award("Defensive Player of the Year", a.defPoy),
      award(year < 1967 ? "Rookie of the Year" : "Offensive Rookie of the Year", a.oroy),
      award("Defensive Rookie of the Year", a.droy),
      award("Comeback Player of the Year", a.cpoty),
    ].filter((x): x is NonNullable<typeof x> => !!x);
    if (save.lastPlan?.year === year) show.reportCard = save.lastPlan;
    const tl = save.history.timeline?.find((e) => e.year === year);
    if (tl) show.timeline = tl;
    const dg = deskGrade(save);
    if (dg) show.deskGrade = dg;
    const won = (save.achievements ?? []).filter((x) => x.year === year);
    if (won.length) show.achievements = won;
    show.allPro = a.allPro
      .map((id) => save.players[id])
      .filter((p): p is Player => !!p)
      .map((p) => honoree(p, clubOf(p) ?? (p.stats[year]?.teamId as TeamId), seasonLine(p, p.stats[year])));
    const sb = save.superBowl;
    if (sb?.played) {
      const w = (sb.homeScore >= sb.awayScore ? sb.homeId : sb.awayId) as TeamId;
      const mvp = sb.mvpPlayerId ? save.players[sb.mvpPlayerId] : undefined;
      show.recaps = [recapOf(save, sb)];
      show.stories = [
        {
          tag: "Champions",
          headline: `${name(save, w)} win Super Bowl ${roman(superBowlNumber(year))}`,
          body: `${Math.max(sb.homeScore, sb.awayScore)}-${Math.min(sb.homeScore, sb.awayScore)}.${mvp ? ` ${playerName(mvp)} took home MVP.` : ""}`,
          teamIds: [w],
          playerIds: mvp ? [mvp.id] : [],
        },
      ];
    }
  }

  if (finale) show.title = "Regular-season finale";
  if (show.kind !== "awards") show.reel = weekReel(save, sorted);
  show.episode = produceEpisode(save, show, sorted, upcoming, finale);
  show.open = show.episode.chapters[0]!.lines.map(l => l.text).join(" ");
  show.close = show.episode.chapters.at(-1)!.lines[0]!.text;
  const archive = [...(save.primetimeArchive ?? []), ...(save.primetime ? [save.primetime] : [])]
    .filter(s => s.year === year && s.episode && s.episode.id !== show.episode!.id);
  save.primetimeArchive = [...new Map(archive.map(s => [s.episode!.id,s])).values()].slice(-26);
  save.primetime = show;
}

/** How the season preview's calls held up. */
function deskGrade(save: DynastySave): PrimetimeShow["deskGrade"] {
  const pk = save.previewPicks;
  const year = save.year;
  if (!pk || pk.year !== year) return undefined;
  const hits: string[] = [];
  const misses: string[] = [];
  const sb = save.superBowl;
  const champ = sb?.played ? ((sb.homeScore >= sb.awayScore ? sb.homeId : sb.awayId) as TeamId) : undefined;
  let score = 0;
  if (champ) {
    if (champ === pk.superBowl.winner) {
      hits.push(`Called it: the ${name(save, champ)} won the Super Bowl, just like we said in August.`);
      score += 4;
    } else if (sb && [sb.homeId, sb.awayId].includes(pk.superBowl.winner)) {
      misses.push(`So close: our champion, the ${name(save, pk.superBowl.winner)}, made the Super Bowl and lost it.`);
      score += 2;
    } else misses.push(`Our Super Bowl pick, the ${name(save, pk.superBowl.winner)}, never got there. The ${name(save, champ)} did.`);
  }
  let divHit = 0;
  for (const d of pk.divisions) {
    const actual = divisionWinner(save, d.key);
    if (actual === d.teamId) divHit += 1;
  }
  score += divHit;
  (divHit >= pk.divisions.length / 2 ? hits : misses).push(`${divHit} of ${pk.divisions.length} division winners right.`);
  const a = save.awards;
  const actualAward: Record<string, string | undefined> = {
    "Most Valuable Player": a?.mvp,
    "Offensive Player of the Year": a?.offPoy,
    "Defensive Player of the Year": a?.defPoy,
    "Offensive Rookie of the Year": a?.oroy,
    "Rookie of the Year": a?.oroy,
    "Defensive Rookie of the Year": a?.droy,
  };
  for (const w of pk.awards) {
    const won = actualAward[w.label];
    if (!won || !w.playerId) continue;
    const p = save.players[w.playerId];
    if (won === w.playerId) {
      hits.push(`${w.label}: we had ${p ? playerName(p) : "him"} at the top of the board in August.`);
      score += 2;
    }
  }
  const diffs = activeTeamIds(year)
    .filter((id) => pk.projW[id] !== undefined && save.teams[id])
    .map((id) => ({ id, d: save.teams[id]!.wins + save.teams[id]!.ties * 0.5 - pk.projW[id]! }));
  if (diffs.length) {
    const mae = diffs.reduce((n, x) => n + Math.abs(x.d), 0) / diffs.length;
    (mae <= 2 ? hits : misses).push(`Our win projections missed by ${mae.toFixed(1)} games a team on average.`);
    if (mae <= 2) score += 2;
    const over = diffs.slice().sort((x, y) => y.d - x.d)[0]!;
    const under = diffs.slice().sort((x, y) => x.d - y.d)[0]!;
    if (over.d >= 3) misses.push(`We sold the ${name(save, over.id)} short: ${pk.projW[over.id]!.toFixed(1)} projected, ${rec(save.teams[over.id]!)} actual.`);
    if (under.d <= -3) misses.push(`We bought the ${name(save, under.id)}: ${pk.projW[under.id]!.toFixed(1)} projected, ${rec(save.teams[under.id]!)} actual.`);
  }
  const grade = score >= 12 ? "A" : score >= 9 ? "B" : score >= 6 ? "C" : score >= 3 ? "D" : "F";
  return {
    headline: grade <= "B" ? "The desk had a good year" : grade === "C" ? "Some hits, some misses" : "The desk would like a mulligan",
    grade,
    hits,
    misses,
  };
}

export function depthChart(save: DynastySave, teamId: TeamId) {
  const groups: { label: string; pos: import("./types.ts").Pos[] }[] = [
    { label: "Offense", pos: ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT"] },
    { label: "Defense", pos: ["DE", "DT", "OLB", "MLB", "CB", "S"] },
    { label: "Specialists", pos: ["K", "P"] },
  ];
  return groups.map((g) => ({
    label: g.label,
    rows: g.pos.map((pos) => ({
      pos,
      players: depthAt(save, teamId, pos).slice(0, 4),
    })),
  }));
}

/** Projected final wins for a club (current record + remaining schedule by team strength). */
export function projectWins(save: DynastySave, id: TeamId): number {
  return projectedWins(save, id, new Map());
}

/** The desk's line and pick for one game. */
export function previewGame(save: DynastySave, g: GameResult): PrimetimePreview | undefined {
  return previews(save, [g], new Map())[0];
}

/** League rank (1 = best) of a club by the desk's power rating. */
export function strengthRank(save: DynastySave, id: TeamId): number {
  const cache = new Map<TeamId, number>();
  const order = activeTeamIds(save.year)
    .map((t) => ({ t, r: ratingOf(save, t, cache) }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.t);
  return order.indexOf(id) + 1;
}
