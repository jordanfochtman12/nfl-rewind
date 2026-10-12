/**
 * What the booth remembers going into a game: the series and the last meeting, a rivalry
 * running hot, streaks, players facing the club that traded or let them go, who's hurt,
 * the milestones and records within reach today. The sim reads the same list to call the
 * moment live (a revenge touchdown, career yard 10,000, a record falling). No React.
 */
import { careerTotals } from "./leaders.ts";
import { RIVALRY_HOT, rivalryHeat, seriesNote } from "./h2h.ts";
import { PRE_1966_MARKS } from "./records.ts";
import { playerName, rosterOf } from "./players.ts";
import { displayName, nicknameOf } from "./teams.ts";
import { teamStyle } from "./teamStyle.ts";
import type { BoxPlayer, DynastySave, GameResult, Player, SeasonStats, TeamId } from "./types.ts";

export type MemoryKind = "series" | "rivalry" | "streak" | "revenge" | "injury" | "milestone" | "record" | "style" | "trade";

export interface MemoryNote {
  kind: MemoryKind;
  text: string;
  teamId?: TeamId;
  playerId?: string;
}

export const WATCH_STATS = ["passYds", "passTd", "rushYds", "rushTd", "rec", "recYds", "recTd", "sacks", "ints"] as const;
export type WatchStat = (typeof WATCH_STATS)[number];

export const STAT_WORDS: Record<WatchStat, { one: string; many: string }> = {
  passYds: { one: "passing yard", many: "passing yards" },
  passTd: { one: "touchdown pass", many: "touchdown passes" },
  rushYds: { one: "rushing yard", many: "rushing yards" },
  rushTd: { one: "rushing touchdown", many: "rushing touchdowns" },
  rec: { one: "catch", many: "catches" },
  recYds: { one: "receiving yard", many: "receiving yards" },
  recTd: { one: "touchdown catch", many: "touchdown catches" },
  sacks: { one: "sack", many: "sacks" },
  ints: { one: "interception", many: "interceptions" },
};

/** Round career numbers the booth stops for. */
const MILESTONES: Record<WatchStat, number[]> = {
  passYds: [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000],
  passTd: [100, 200, 300, 400, 500, 600],
  rushYds: [5000, 10000, 12000, 15000, 18000],
  rushTd: [50, 100, 125, 150],
  rec: [500, 750, 1000, 1250],
  recYds: [5000, 10000, 12500, 15000],
  recTd: [50, 100, 125, 150],
  sacks: [50, 100, 125, 150, 175, 200],
  ints: [40, 50, 60],
};

/** One player the sim keeps an eye on during the game, with the marks in front of him. */
export interface Watch {
  playerId: string;
  teamId: TeamId;
  career: Partial<Record<WatchStat, number>>;
  season: Partial<Record<WatchStat, number>>;
  /** The opponent he used to play for, and whether they traded him away. */
  formerClub?: { teamId: TeamId; traded: boolean };
}

export interface LeagueMarks {
  /** All-time single-season bests, by stat. */
  season: Partial<Record<WatchStat, number>>;
  /** All-time single-game bests in the league. */
  game: Partial<Record<WatchStat, number>>;
  /** All-time career leader's total, and the runner-up's (the mark a new leader just passed). */
  career: Partial<Record<WatchStat, { value: number; playerId: string; second: number }>>;
}

const val = (s: SeasonStats | BoxPlayer | undefined, k: WatchStat) => ((s as unknown as Record<string, number> | undefined)?.[k] ?? 0) || 0;

const marksCache = new Map<string, LeagueMarks>();
// A retired player's numbers never change; save copies share his object, so total him once.
const settledTotals = new WeakMap<Player, SeasonStats>();

/** The league's all-time marks as of this week (cached per week). */
export function leagueMarks(save: DynastySave): LeagueMarks {
  const key = `${save.startingYear}-${save.seed ?? 0}-${save.year}-${save.week}-${save.phase}`;
  const hit = marksCache.get(key);
  if (hit) return hit;
  const season: LeagueMarks["season"] = {};
  const game: LeagueMarks["game"] = {};
  const career: LeagueMarks["career"] = {};
  for (const k of WATCH_STATS) {
    season[k] = Math.max(save.bestSeasonMarks?.[k] ?? 0, PRE_1966_MARKS[k]?.value ?? 0);
  }
  for (const [rk, r] of Object.entries(save.teamGameRecords ?? {})) {
    const k = rk.split(":")[1] as WatchStat;
    if (WATCH_STATS.includes(k) && r.value > (game[k] ?? 0)) game[k] = r.value;
  }
  for (const p of Object.values(save.players)) {
    const settled = p.teamId === "retired" || p.teamId === "hof";
    let c = settled ? settledTotals.get(p) : undefined;
    if (!c) {
      c = careerTotals(p);
      if (settled) settledTotals.set(p, c);
    }
    for (const k of WATCH_STATS) {
      const v = val(c, k);
      const cur = career[k];
      if (!cur || v > cur.value) career[k] = { value: v, playerId: p.id, second: cur?.value ?? 0 };
      else if (v > cur.second) cur.second = v;
    }
    // Seasons already finished count toward the single-season mark too.
    for (const y in p.stats) {
      if (Number(y) >= save.year) continue;
      for (const k of WATCH_STATS) {
        const v = val(p.stats[y], k);
        if (v > (season[k] ?? 0)) season[k] = v;
      }
    }
  }
  const out = { season, game, career };
  if (marksCache.size > 4) marksCache.clear();
  marksCache.set(key, out);
  return out;
}

/** The clubs a player suited up for before, newest first. */
function pastClubs(p: Player, before: number): TeamId[] {
  const seen: TeamId[] = [];
  const years = Object.keys(p.stats).map(Number).filter((y) => y < before).sort((a, b) => b - a);
  for (const y of years) {
    const t = p.stats[y]!.teamId;
    if (t !== "two" && !seen.includes(t)) seen.push(t);
  }
  return seen;
}

/** Who to watch in a game: the starters and stars on both sides, with their marks so far. */
export function gameWatches(save: DynastySave, game: GameResult): Watch[] {
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const out: Watch[] = [];
  for (const [tid, opp] of [
    [home, away],
    [away, home],
  ] as const) {
    for (const p of rosterOf(save, tid)) {
      if (p.injuredWeeks > 0 || p.onIR || p.ovr < 68) continue;
      const c = careerTotals(p);
      const s = p.stats[save.year];
      const w: Watch = { playerId: p.id, teamId: tid, career: {}, season: {} };
      for (const k of WATCH_STATS) {
        w.career[k] = val(c, k);
        w.season[k] = val(s, k);
      }
      const clubs = pastClubs(p, save.year + (p.stats[save.year]?.teamId === tid ? 0 : 1));
      if (clubs.includes(opp) && clubs[0] !== tid) {
        const traded = save.transactions.some((t) => t.playerId === p.id && t.kind === "trade" && t.from === opp);
        w.formerClub = { teamId: opp, traded };
      }
      out.push(w);
    }
  }
  return out;
}

const streakOf = (save: DynastySave, id: TeamId) => {
  const s = save.teams[id]?.streak ?? "";
  const n = Number(s.slice(1));
  return { won: s.startsWith("W"), n: Number.isFinite(n) ? n : 0 };
};

/** The booth's notes going in, most interesting first. */
export function pregameMemory(save: DynastySave, game: GameResult, watches = gameWatches(save, game)): MemoryNote[] {
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const nick = (id: TeamId) => nicknameOf(save.year, id);
  const notes: MemoryNote[] = [];
  const series = seriesNote(save, home, away);
  if (series?.revenge) notes.push({ kind: "series", text: series.revenge });
  const heat = rivalryHeat(save, home, away);
  if (heat >= RIVALRY_HOT) notes.push({ kind: "rivalry", text: `This one has become a real rivalry: close games and a playoff history have these two circling the date.` });
  if (series) notes.push({ kind: "series", text: `${series.series}.${series.last ? ` ${series.last}.` : ""}` });

  for (const w of watches.filter((x) => x.formerClub)) {
    const p = save.players[w.playerId];
    if (!p || p.ovr < 74) continue;
    const f = w.formerClub!;
    notes.push({
      kind: "revenge",
      playerId: p.id,
      teamId: w.teamId,
      text: f.traded
        ? `${playerName(p)} faces the ${nick(f.teamId)}, the team that traded him. You know he's had this one circled.`
        : `${playerName(p)} lines up against his old club, the ${nick(f.teamId)}.`,
    });
  }
  // A trade within the last month: his first games with the new club.
  for (const t of save.transactions.filter((x) => x.kind === "trade" && x.year === save.year && save.week - x.week <= 3)) {
    const p = save.players[t.playerId];
    if (!p || p.ovr < 76 || (p.teamId !== home && p.teamId !== away)) continue;
    if (notes.some((n) => n.playerId === p.id)) continue;
    notes.push({ kind: "trade", playerId: p.id, teamId: p.teamId as TeamId, text: `${playerName(p)} is still learning the playbook: this is one of his first games since the trade.` });
  }
  for (const id of [home, away]) {
    const s = streakOf(save, id);
    if (s.n >= 3) notes.push({ kind: "streak", teamId: id, text: s.won ? `The ${nick(id)} have won ${s.n} straight.` : `The ${nick(id)} have lost ${s.n} in a row and need this one badly.` });
    const hurt = rosterOf(save, id)
      .filter((p) => (p.injuredWeeks > 0 || p.onIR) && p.ovr >= 80 && p.injuryName !== "holdout")
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (hurt) notes.push({ kind: "injury", teamId: id, playerId: hurt.id, text: `The ${nick(id)} are without ${playerName(hurt)}${hurt.injuryName ? ` (${hurt.injuryName === "ribs" ? "ribs" : hurt.injuryName})` : ""}.` });
    const style = teamStyle(save, id);
    if (style.games >= 3) notes.push({ kind: "style", teamId: id, text: `${displayName(save.year, id)}: ${style.line}` });
    if (style.missing[0]) notes.push({ kind: "style", teamId: id, text: style.missing[0] });
  }
  const marks = leagueMarks(save);
  for (const w of watches) {
    const p = save.players[w.playerId];
    if (!p) continue;
    for (const k of WATCH_STATS) {
      const c = w.career[k] ?? 0;
      const next = MILESTONES[k].find((m) => m > c);
      const words = STAT_WORDS[k];
      if (next && next - c <= Math.max(1, Math.round(next * (k.endsWith("Yds") ? 0.012 : 0.02)))) {
        notes.push({ kind: "milestone", playerId: p.id, teamId: w.teamId, text: `${playerName(p)} is ${next - c} ${next - c === 1 ? words.one : words.many} from ${next.toLocaleString()} for his career.` });
      }
      const lead = marks.career[k];
      if (lead && lead.playerId !== p.id && c > 0 && lead.value - c > 0 && lead.value - c <= Math.max(2, lead.value * 0.012)) {
        notes.push({ kind: "record", playerId: p.id, teamId: w.teamId, text: `${playerName(p)} is ${lead.value - c} ${STAT_WORDS[k].many} shy of the all-time career record.` });
      }
      const sRec = marks.season[k] ?? 0;
      const sNow = w.season[k] ?? 0;
      if (sRec > 0 && sNow > 0 && sRec - sNow > 0 && sRec - sNow <= Math.max(2, sRec * 0.06)) {
        notes.push({ kind: "record", playerId: p.id, teamId: w.teamId, text: `${playerName(p)} needs ${sRec - sNow} ${STAT_WORDS[k].many} to tie the single-season record of ${sRec.toLocaleString()}.` });
      }
    }
  }
  const rank: Record<MemoryKind, number> = { record: 0, revenge: 1, series: 2, rivalry: 3, milestone: 4, streak: 5, trade: 6, injury: 7, style: 8 };
  return notes.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 10);
}

/** A live call for a crossing during the game: a career milestone or a record, or undefined. */
export function liveMarkCall(
  save: DynastySave,
  w: Watch,
  k: WatchStat,
  before: number,
  after: number,
  marks: LeagueMarks,
): { text: string; kind: "milestone" | "record" } | undefined {
  if (after <= before) return undefined;
  const p = save.players[w.playerId];
  if (!p) return undefined;
  const name = playerName(p);
  const words = STAT_WORDS[k];
  const c0 = (w.career[k] ?? 0) + before;
  const c1 = (w.career[k] ?? 0) + after;
  const lead = marks.career[k];
  if (lead && lead.playerId !== p.id && c0 <= lead.value && c1 > lead.value)
    return { kind: "record", text: `History. ${name} passes ${lead.playerId && save.players[lead.playerId] ? playerName(save.players[lead.playerId]!) : "the old mark"} for the most career ${words.many} the game has ever seen.` };
  const s0 = (w.season[k] ?? 0) + before;
  const s1 = (w.season[k] ?? 0) + after;
  const sRec = marks.season[k] ?? 0;
  if (sRec > 0 && s0 <= sRec && s1 > sRec) return { kind: "record", text: `There it is: ${name} has the single-season record for ${words.many}. ${s1.toLocaleString()} and counting.` };
  const gRec = marks.game[k] ?? 0;
  if (gRec > 0 && before <= gRec && after > gRec) return { kind: "record", text: `${name} now owns the single-game record: ${after} ${words.many} today.` };
  const m = MILESTONES[k].find((x) => c0 < x && c1 >= x);
  if (m) return { kind: "milestone", text: `That's ${m.toLocaleString()} career ${words.many} for ${name}. Take a bow.` };
  return undefined;
}
