/**
 * The studio's graphics package: for each segment of a show, the full-screen graphic the
 * director cuts to while the desk talks. A final score with the quarters and the stars, the
 * tale of the tape before a game, a player card, a leader board, the power rankings, the
 * week's scoreboard, a champion's road. Built from the save at air time, keyed by what the
 * segment is about, so older episodes get graphics too. No React.
 */
import { displayName, nicknameOf } from "./teams.ts";
import { playerName } from "./players.ts";
import type { DynastySave, GameResult, Player, PrimetimeShow, SeasonStats, TeamId } from "./types.ts";

type Episode = NonNullable<PrimetimeShow["episode"]>;
type Chapter = Episode["chapters"][number];

export interface StatCell {
  label: string;
  value: string;
}

export type ShowGraphic =
  | {
      kind: "score";
      title: string;
      awayId: TeamId;
      homeId: TeamId;
      awayScore: number;
      homeScore: number;
      awayQ?: number[];
      homeQ?: number[];
      ot?: boolean;
      stars: { playerId: string; name: string; teamId: TeamId; line: string }[];
    }
  | { kind: "tape"; title: string; awayId: TeamId; homeId: TeamId; rows: { label: string; away: string; home: string; edge?: "away" | "home" }[] }
  | { kind: "player"; title: string; playerId: string; name: string; teamId?: TeamId; pos: string; jersey?: number; age: number; stats: StatCell[]; caption?: string }
  | { kind: "board"; title: string; unit?: string; rows: { rank: number; teamId?: TeamId; name: string; value: string; playerId?: string }[] }
  | { kind: "scores"; title: string; games: { awayId: TeamId; homeId: TeamId; awayScore: number; homeScore: number; ot?: boolean }[] }
  | { kind: "road"; title: string; teamId: TeamId; rows: { label: string; text: string; won: boolean }[] }
  | { kind: "team"; title: string; teamId: TeamId; stats: StatCell[] };

const isTeam = (id: string): id is TeamId => !["afc", "nfc", "afl", "nfl"].includes(id);

function allGames(save: DynastySave): GameResult[] {
  return [...save.schedule, ...(save.playoffGames ?? []), ...(save.superBowl ? [save.superBowl] : [])];
}

function teamSeason(save: DynastySave, year: number, id: TeamId) {
  const games = allGames(save).filter((g) => g.year === year && g.played && g.phase === "regular" && (g.homeId === id || g.awayId === id));
  let w = 0, l = 0, t = 0, pf = 0, pa = 0;
  let streak = 0;
  let last: "W" | "L" | "T" | undefined;
  for (const g of games.slice().sort((a, b) => a.week - b.week)) {
    const us = g.homeId === id ? g.homeScore : g.awayScore;
    const them = g.homeId === id ? g.awayScore : g.homeScore;
    pf += us;
    pa += them;
    const r = us > them ? "W" : us < them ? "L" : "T";
    if (r === "W") w++;
    else if (r === "L") l++;
    else t++;
    streak = r === last ? streak + 1 : 1;
    last = r;
  }
  const gp = Math.max(1, games.length);
  return { w, l, t, pf, pa, gp: games.length, ppg: pf / gp, papg: pa / gp, streak: last ? `${last}${streak}` : "—" };
}

const rec = (s: { w: number; l: number; t: number }) => `${s.w}-${s.l}${s.t ? `-${s.t}` : ""}`;
const n1 = (x: number) => x.toFixed(1);
const num = (x: number) => Math.round(x).toLocaleString("en-US");

/** The handful of numbers a player card shows for his position. */
export function cardStats(p: Player, s: SeasonStats | undefined): StatCell[] {
  if (!s) return [];
  const c = (label: string, v: number | undefined) => ({ label, value: num(v ?? 0) });
  switch (p.pos) {
    case "QB":
      return [{ label: "CMP-ATT", value: `${s.passCmp}-${s.passAtt}` }, c("YDS", s.passYds), c("TD", s.passTd), c("INT", s.passInt), { label: "RATE", value: n1(rating(s)) }];
    case "RB":
    case "FB":
      return [c("CAR", s.rushAtt), c("YDS", s.rushYds), { label: "AVG", value: n1(s.rushAtt ? s.rushYds / s.rushAtt : 0) }, c("TD", s.rushTd), c("REC", s.rec)];
    case "WR":
    case "TE":
      return [c("REC", s.rec), c("YDS", s.recYds), { label: "AVG", value: n1(s.rec ? s.recYds / s.rec : 0) }, c("TD", s.recTd)];
    case "K":
      return [{ label: "FG", value: `${s.fgMade}-${s.fgAtt}` }, c("XP", s.xpMade), c("PTS", s.fgMade * 3 + s.xpMade)];
    case "P":
      return [c("PUNTS", s.punts), { label: "AVG", value: n1(s.punts ? (s.puntYds ?? 0) / s.punts : 0) }];
    default:
      return [c("TKL", s.tackles), { label: "SACKS", value: (s.sacks ?? 0).toFixed(s.sacks % 1 ? 1 : 0) }, c("INT", s.ints), c("FF", s.ff ?? 0)];
  }
}

function rating(s: SeasonStats): number {
  if (!s.passAtt) return 0;
  const clamp = (x: number) => Math.max(0, Math.min(2.375, x));
  const a = clamp((s.passCmp / s.passAtt - 0.3) * 5);
  const b = clamp((s.passYds / s.passAtt - 3) * 0.25);
  const c = clamp((s.passTd / s.passAtt) * 20);
  const d = clamp(2.375 - (s.passInt / s.passAtt) * 25);
  return ((a + b + c + d) / 6) * 100;
}

function playerCard(save: DynastySave, year: number, id: string, title: string, caption?: string): ShowGraphic | undefined {
  const p = save.players[id];
  if (!p) return undefined;
  const s = p.stats[year];
  const team = (s?.teamId && isTeam(s.teamId) ? s.teamId : p.teamId) as TeamId;
  return { kind: "player", title, playerId: p.id, name: playerName(p), teamId: save.teams[team] ? team : undefined, pos: p.pos, jersey: p.jersey, age: p.age, stats: cardStats(p, s), caption };
}

function stars(save: DynastySave, g: GameResult) {
  const out: { playerId: string; name: string; teamId: TeamId; line: string; w: number }[] = [];
  for (const [box, teamId] of [[g.boxHome, g.homeId], [g.boxAway, g.awayId]] as const) {
    for (const b of box ?? []) {
      const p = save.players[b.playerId];
      if (!p || !isTeam(teamId)) continue;
      const bits: string[] = [];
      let w = 0;
      if (b.passAtt) { bits.push(`${b.passCmp}/${b.passAtt}, ${b.passYds} yds${b.passTd ? `, ${b.passTd} TD` : ""}`); w += (b.passYds ?? 0) / 25 + (b.passTd ?? 0) * 4 - (b.passInt ?? 0) * 3; }
      if (b.rushAtt && (b.rushYds ?? 0) >= 40) { bits.push(`${b.rushAtt} car, ${b.rushYds} yds${b.rushTd ? `, ${b.rushTd} TD` : ""}`); w += (b.rushYds ?? 0) / 10 + (b.rushTd ?? 0) * 6; }
      if (b.rec && (b.recYds ?? 0) >= 40) { bits.push(`${b.rec} rec, ${b.recYds} yds${b.recTd ? `, ${b.recTd} TD` : ""}`); w += (b.recYds ?? 0) / 10 + (b.recTd ?? 0) * 6; }
      if (b.sacks) { bits.push(`${b.sacks} sack${b.sacks === 1 ? "" : "s"}`); w += b.sacks * 5; }
      if (b.ints) { bits.push(`${b.ints} INT`); w += b.ints * 7; }
      if (bits.length && w > 6) out.push({ playerId: p.id, name: playerName(p), teamId: teamId as TeamId, line: bits.join(" · "), w });
    }
  }
  return out.sort((a, b) => b.w - a.w).slice(0, 3).map(({ w: _w, ...r }) => r);
}

function scoreOf(save: DynastySave, g: GameResult, title: string): ShowGraphic | undefined {
  if (!g.played || !isTeam(g.homeId) || !isTeam(g.awayId)) return undefined;
  return { kind: "score", title, awayId: g.awayId, homeId: g.homeId, awayScore: g.awayScore, homeScore: g.homeScore, awayQ: g.awayQ, homeQ: g.homeQ, ot: g.ot, stars: stars(save, g) };
}

function tapeOf(save: DynastySave, year: number, g: GameResult): ShowGraphic | undefined {
  if (!isTeam(g.homeId) || !isTeam(g.awayId)) return undefined;
  const a = teamSeason(save, year, g.awayId);
  const h = teamSeason(save, year, g.homeId);
  const edge = (x: number, y: number, more = true): "away" | "home" | undefined => (x === y ? undefined : (x > y) === more ? "away" : "home");
  const pct = (s: typeof a) => (s.w + s.t / 2) / Math.max(1, s.w + s.l + s.t);
  const rows: { label: string; away: string; home: string; edge?: "away" | "home" }[] = [
    { label: "Record", away: rec(a), home: rec(h), edge: edge(pct(a), pct(h)) },
    { label: "Points a game", away: n1(a.ppg), home: n1(h.ppg), edge: edge(a.ppg, h.ppg) },
    { label: "Allowed a game", away: n1(a.papg), home: n1(h.papg), edge: edge(a.papg, h.papg, false) },
    { label: "Point differential", away: signed(a.pf - a.pa), home: signed(h.pf - h.pa), edge: edge(a.pf - a.pa, h.pf - h.pa) },
    { label: "Streak", away: a.streak, home: h.streak },
  ];
  const qb = (id: TeamId) =>
    Object.values(save.players)
      .filter((p) => p.pos === "QB" && p.stats[year]?.teamId === id)
      .sort((x, y) => (y.stats[year]?.passYds ?? 0) - (x.stats[year]?.passYds ?? 0))[0];
  const qa = qb(g.awayId);
  const qh = qb(g.homeId);
  if (qa && qh && (qa.stats[year]?.passAtt ?? 0) + (qh.stats[year]?.passAtt ?? 0) > 0)
    rows.push({ label: "Quarterback", away: `${qa.lastName} ${num(qa.stats[year]?.passYds ?? 0)}`, home: `${qh.lastName} ${num(qh.stats[year]?.passYds ?? 0)}` });
  return { kind: "tape", title: g.phase === "superBowl" ? "TALE OF THE TAPE · SUPER BOWL" : "TALE OF THE TAPE", awayId: g.awayId, homeId: g.homeId, rows };
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** The graphic for one segment of a show, or none (the desk on camera). */
export function showGraphic(save: DynastySave, year: number, ep: Episode, ch: Chapter, show?: PrimetimeShow): ShowGraphic | undefined {
  const games = allGames(save);
  const byId = (id: string) => games.find((g) => g.id === id);
  const id = ch.id;
  const after = (prefix: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : undefined);
  let k: string | undefined;

  if ((k = after("film-"))) {
    const g = byId(k);
    return g ? scoreOf(save, g, g.round ? `FINAL · ${g.round.toUpperCase()}` : "FINAL") : undefined;
  }
  if ((k = after("preview-"))) {
    const g = byId(k);
    return g ? tapeOf(save, year, g) : undefined;
  }
  if ((k = after("chase-"))) return playerCard(save, year, k, "RECORD WATCH", show?.chases?.find((c) => c.playerId === k)?.text);
  if ((k = after("medical-"))) {
    const i = show?.injuries?.find((x) => x.playerId === k);
    return playerCard(save, year, k, "INJURY REPORT", i ? `${i.injury}${i.ir ? " · injured reserve" : i.weeks ? ` · out ${i.weeks} wk` : ""}` : undefined);
  }
  if ((k = after("award-"))) {
    const a = show?.awards?.find((x) => x.label === k);
    return a ? playerCard(save, year, a.honoree.playerId, k.toUpperCase(), a.honoree.line) : undefined;
  }
  if ((k = after("leader-"))) {
    const b = show?.leaders?.find((x) => x.label === k);
    if (b) return { kind: "board", title: `LEAGUE LEADERS · ${k.toUpperCase()}`, rows: b.rows.slice(0, 5).map((r, i) => ({ rank: i + 1, teamId: r.teamId, name: r.name, value: num(r.value), playerId: r.playerId })) };
  }
  if ((k = after("history-"))) {
    const n = (save.news ?? []).find((x) => x.id === k);
    const pid = n?.playerIds?.[0];
    if (pid) return playerCard(save, year, pid, "HISTORY MADE", n?.headline);
  }
  if ((k = after("arc-"))) {
    const a = (save.arcs ?? []).find((x) => x.id === k);
    if (a?.playerId) return playerCard(save, year, a.playerId, "STORYLINE", a.beats.at(-1)?.short);
  }
  if (id === "contender" && show?.power?.length)
    return { kind: "board", title: "POWER RANKINGS", rows: show.power.slice(0, 6).map((p, i) => ({ rank: i + 1, teamId: p.teamId, name: displayName(year, p.teamId), value: p.record })) };
  if ((k = after("road-"))) {
    const tid = k as TeamId;
    const rows = games
      .filter((g) => g.year === year && g.played && g.phase === "playoffs" && (g.homeId === tid || g.awayId === tid))
      .map((g) => {
        const us = g.homeId === tid ? g.homeScore : g.awayScore;
        const them = g.homeId === tid ? g.awayScore : g.homeScore;
        const opp = (g.homeId === tid ? g.awayId : g.homeId) as TeamId;
        return { label: g.round ?? "Playoffs", text: `${us > them ? "def." : "lost to"} ${nicknameOf(year, opp)} ${us}-${them}`, won: us > them };
      });
    const s = teamSeason(save, year, tid);
    return { kind: "road", title: "THE ROAD HERE", teamId: tid, rows: [{ label: "Regular season", text: rec(s), won: s.w >= s.l }, ...rows] };
  }
  if (id === "champions" || id === "sb-verdict") {
    const sb = save.superBowl?.year === year ? save.superBowl : games.find((g) => g.year === year && g.phase === "superBowl");
    if (sb?.played) return scoreOf(save, sb, "SUPER BOWL · FINAL");
    if (sb) return tapeOf(save, year, sb);
  }
  if (id === "opening" && ep.edition !== "seasonPreview") {
    const week = show?.week;
    const list = games.filter((g) => g.year === year && g.played && (week === undefined || g.week === week) && isTeam(g.homeId) && isTeam(g.awayId) && g.phase === (show?.kind === "playoffs" ? "playoffs" : g.phase));
    const shown = (show?.kind === "playoffs" ? list.filter((g) => g.phase === "playoffs") : list.filter((g) => g.phase === "regular")).slice(0, 16);
    if (shown.length > 1)
      return { kind: "scores", title: show?.kind === "playoffs" ? "PLAYOFF SCOREBOARD" : `WEEK ${week} · AROUND THE LEAGUE`, games: shown.map((g) => ({ awayId: g.awayId as TeamId, homeId: g.homeId as TeamId, awayScore: g.awayScore, homeScore: g.homeScore, ot: g.ot })) };
  }
  // A segment about one club: its season on a card.
  const one = ch.teamIds.filter((t) => save.teams[t]);
  if (one.length === 1 && ep.edition !== "seasonPreview") {
    const s = teamSeason(save, year, one[0]!);
    if (s.gp)
      return {
        kind: "team",
        title: nicknameOf(year, one[0]!).toUpperCase(),
        teamId: one[0]!,
        stats: [
          { label: "RECORD", value: rec(s) },
          { label: "PTS/G", value: n1(s.ppg) },
          { label: "OPP/G", value: n1(s.papg) },
          { label: "DIFF", value: signed(s.pf - s.pa) },
          { label: "STREAK", value: s.streak },
        ],
      };
  }
  return undefined;
}

/** The crawl along the bottom of the screen: this week's finals and the wire. */
export function showTicker(save: DynastySave, year: number, week?: number): string[] {
  const games = allGames(save).filter((g) => g.year === year && g.played && isTeam(g.homeId) && isTeam(g.awayId));
  const latest = week ?? Math.max(0, ...games.filter((g) => g.phase === "regular").map((g) => g.week));
  const finals = games
    .filter((g) => (g.phase === "regular" ? g.week === latest : save.phase === "playoffs" || save.phase === "superBowl"))
    .slice(-16)
    .map((g) => `${nicknameOf(year, g.awayId as TeamId).toUpperCase()} ${g.awayScore}, ${nicknameOf(year, g.homeId as TeamId).toUpperCase()} ${g.homeScore}${g.ot ? " (OT)" : ""} · FINAL`);
  const wire = (save.news ?? []).filter((n) => n.year === year).slice(0, 8).map((n) => n.headline.toUpperCase());
  return [...finals, ...wire];
}

/** A player card for any show: his season (or the given year) on one graphic. */
export function playerGraphic(save: DynastySave, year: number, playerId: string, title: string, caption?: string): ShowGraphic | undefined {
  return playerCard(save, year, playerId, title, caption);
}

/** A final for any show (the Pro Bowl, a replay): score, quarters, stars. */
export function gameGraphic(save: DynastySave, g: GameResult, title: string): ShowGraphic | undefined {
  return scoreOf(save, g, title);
}
