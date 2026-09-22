import type { BoxPlayer, DynastySave, GameRecordEntry, GameResult, Player, Pos, SeasonStats, TeamId } from "./types.ts";
import { playerName } from "./players.ts";
import { displayName } from "./teams.ts";
import { careerTotals } from "./leaders.ts";
import { addNews } from "./news.ts";
import { lastTeamOf } from "./hof.ts";

export interface RecordRow {
  playerId: string;
  name: string;
  team: string;
  pos: Pos;
  value: number;
  year: number;
}

export interface RecordCategory {
  id: string;
  label: string;
  rows: RecordRow[];
}

interface Cat {
  id: string;
  label: string;
  of: (s: SeasonStats) => number;
}

const CATS: Cat[] = [
  { id: "passYds", label: "Passing yards", of: (s) => s.passYds },
  { id: "passTd", label: "Passing TDs", of: (s) => s.passTd },
  { id: "rushYds", label: "Rushing yards", of: (s) => s.rushYds },
  { id: "rushTd", label: "Rushing TDs", of: (s) => s.rushTd },
  { id: "rec", label: "Receptions", of: (s) => s.rec },
  { id: "recYds", label: "Receiving yards", of: (s) => s.recYds },
  { id: "recTd", label: "Receiving TDs", of: (s) => s.recTd },
  { id: "sacks", label: "Sacks", of: (s) => s.sacks },
  { id: "ints", label: "Interceptions", of: (s) => s.ints },
];

function teamLabel(save: DynastySave, p: Player): string {
  return p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? "—" : displayName(save.year, p.teamId as TeamId);
}

/** Top single-season performances of all time, across every year simulated so far. Pass teamId to scope to one franchise. */
export function seasonRecordBook(save: DynastySave, topN = 5, teamId?: TeamId): RecordCategory[] {
  return CATS.map((cat) => {
    const rows: RecordRow[] = [];
    for (const p of Object.values(save.players)) {
      for (const [yearStr, s] of Object.entries(p.stats)) {
        if (teamId && s.teamId !== teamId) continue;
        const v = cat.of(s);
        if (v <= 0) continue;
        rows.push({ playerId: p.id, name: playerName(p), team: teamLabel(save, p), pos: p.pos, value: v, year: Number(yearStr) });
      }
    }
    rows.sort((a, b) => b.value - a.value);
    return { id: cat.id, label: cat.label, rows: rows.slice(0, topN) };
  });
}

/** Sum of one category across only the years a player's team on record matches teamId (dedupes by year like careerTotals). */
function teamCareerValue(p: Player, teamId: TeamId, cat: Cat): number {
  const seen = new Set<number>();
  let n = 0;
  for (const s of [...Object.values(p.stats), ...(p.career ?? [])]) {
    if (s.teamId !== teamId || seen.has(s.year)) continue;
    seen.add(s.year);
    n += cat.of(s);
  }
  return n;
}

/** Career leaders across everyone who has ever taken a snap in this dynasty. Pass teamId for that franchise's career totals only. */
export function careerRecordBook(save: DynastySave, topN = 5, teamId?: TeamId): RecordCategory[] {
  const totals = Object.values(save.players).map((p) => {
    const years = [...Object.keys(p.stats).map(Number), ...(p.career ?? []).map((s) => s.year)];
    const lastYear = years.length ? Math.max(...years) : 0;
    return { p, totals: teamId ? undefined : careerTotals(p), lastYear };
  });
  return CATS.map((cat) => {
    const rows = totals
      .map(({ p, totals: t, lastYear }) => ({
        playerId: p.id,
        name: playerName(p),
        team: teamLabel(save, p),
        pos: p.pos,
        value: teamId ? teamCareerValue(p, teamId, cat) : cat.of(t!),
        year: lastYear,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
    return { id: cat.id, label: cat.label, rows };
  });
}

function boxValue(b: BoxPlayer, cat: Cat): number {
  return cat.of(b as unknown as SeasonStats) || 0;
}

/** Best single-game performance, all-time. Pass teamId to scope to one franchise's own record; omit for the league-wide mark. */
export function gameRecordBook(save: DynastySave, teamId?: TeamId): RecordCategory[] {
  const teamIds = teamId ? [teamId] : (Object.keys(save.teams) as TeamId[]);
  return CATS.map((cat) => {
    let best: GameRecordEntry | undefined;
    let bestTeam: TeamId | undefined;
    for (const tid of teamIds) {
      const e = save.teamGameRecords[`${tid}:${cat.id}`];
      if (e && (!best || e.value > best.value)) {
        best = e;
        bestTeam = tid;
      }
    }
    if (!best || !bestTeam) return { id: cat.id, label: cat.label, rows: [] };
    const p = save.players[best.playerId];
    return {
      id: cat.id,
      label: cat.label,
      rows: [
        {
          playerId: best.playerId,
          name: p ? playerName(p) : best.playerId,
          team: displayName(Math.min(best.year, save.year), bestTeam),
          pos: p?.pos ?? "QB",
          value: best.value,
          year: best.year,
        },
      ],
    };
  });
}

/** Called right after a game's box scores are finalized (before compaction can strip them). */
export function checkGameRecords(save: DynastySave, game: GameResult): void {
  if (game.phase === "proBowl") return;
  if (!game.boxHome || !game.boxAway) return;
  const sides: [string, string, BoxPlayer[]][] = [
    [game.homeId, game.awayId, game.boxHome],
    [game.awayId, game.homeId, game.boxAway],
  ];
  for (const [teamId, oppId, box] of sides) {
    if (!save.teams[teamId as TeamId]) continue;
    for (const b of box) {
      for (const cat of CATS) {
        const v = boxValue(b, cat);
        if (v <= 0) continue;
        const key = `${teamId}:${cat.id}`;
        const prev = save.teamGameRecords[key];
        if (!prev || v > prev.value) {
          save.teamGameRecords[key] = { playerId: b.playerId, value: v, year: save.year, week: save.week, opponent: oppId as TeamId };
        }
      }
    }
  }
}

const DECADE_SLOTS: [Pos, number][] = [
  ["QB", 1],
  ["RB", 2],
  ["WR", 2],
  ["TE", 1],
  ["LT", 1],
  ["LG", 1],
  ["C", 1],
  ["RG", 1],
  ["RT", 1],
  ["DE", 2],
  ["DT", 2],
  ["OLB", 2],
  ["MLB", 1],
  ["CB", 2],
  ["S", 2],
  ["K", 1],
];

function decadeScore(p: Player, years: number[]): number {
  let n = (p.peakOvr ?? p.ovr) * 0.5;
  for (const y of years) {
    const s = p.stats[y];
    if (!s) continue;
    n += s.passYds * 0.04 + s.passTd * 4 - s.passInt * 2;
    n += s.rushYds * 0.1 + s.rushTd * 6;
    n += s.rec * 0.5 + s.recYds * 0.1 + s.recTd * 6;
    n += s.sacks * 4 + s.ints * 5 + s.tackles * 0.4;
  }
  return n;
}

// The sim never credits offensive linemen with a per-play box-score line, so `p.stats[year]`
// is never created for them — fall back to their active-year range (draft to retirement)
// instead of requiring a stat entry, scored on talent + tenure rather than counting stats.
const OL_POS = new Set<Pos>(["LT", "LG", "C", "RG", "RT"]);

export interface DecadeTeamSlot {
  pos: Pos;
  players: { playerId: string; name: string; team: string; years: number }[];
}

/** Decade start years (1960, 1970, ...) that have at least one season played so far. */
export function availableDecades(save: DynastySave): number[] {
  const out = new Set<number>();
  for (let y = save.startingYear; y <= save.year; y++) out.add(Math.floor(y / 10) * 10);
  return [...out].sort((a, b) => a - b);
}

/** Best XI-ish squad for a decade, scored on aggregate production + peak talent across every year played in it. */
export function allDecadeTeam(save: DynastySave, decadeStart: number): DecadeTeamSlot[] {
  const years = Array.from({ length: 10 }, (_, i) => decadeStart + i);
  return DECADE_SLOTS.map(([pos, n]) => {
    const pool = Object.values(save.players)
      .filter((p) => p.pos === pos)
      .map((p) => {
        if (OL_POS.has(pos)) {
          const start = p.draftYear ?? save.startingYear;
          const end = p.retiredYear != null ? p.retiredYear - 1 : save.year;
          const activeYears = years.filter((y) => y >= start && y <= end);
          if (!activeYears.length) return null;
          const teamId = lastTeamOf(save, p);
          return {
            p,
            score: (p.peakOvr ?? p.ovr) * 0.5 + activeYears.length * 2,
            years: activeYears.length,
            team: displayName(Math.min(decadeStart + 9, save.year), teamId),
          };
        }
        const playedYears = years.filter((y) => p.stats[y]);
        if (!playedYears.length) return null;
        const lastY = playedYears[playedYears.length - 1]!;
        const teamId = p.stats[lastY]?.teamId;
        return {
          p,
          score: decadeScore(p, years),
          years: playedYears.length,
          team: teamId && teamId !== "two" ? displayName(Math.min(lastY, save.year), teamId) : "—",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
    return {
      pos,
      players: pool.map((x) => ({ playerId: x.p.id, name: playerName(x.p), team: x.team, years: x.years })),
    };
  });
}

/** Called once a season, right after awards resolve: announces any single-season record broken this year. */
export function checkSeasonMilestones(save: DynastySave): void {
  const priorBest = new Map<string, number>();
  for (const p of Object.values(save.players)) {
    for (const [yearStr, s] of Object.entries(p.stats)) {
      if (Number(yearStr) >= save.year) continue;
      for (const cat of CATS) {
        const v = cat.of(s);
        if (v > (priorBest.get(cat.id) ?? 0)) priorBest.set(cat.id, v);
      }
    }
  }
  for (const p of Object.values(save.players)) {
    const s = p.stats[save.year];
    if (!s) continue;
    for (const cat of CATS) {
      const v = cat.of(s);
      const prior = priorBest.get(cat.id) ?? 0;
      if (v > prior && v > 0) {
        addNews(save, {
          kind: "award",
          headline: `${playerName(p)} sets the all-time single-season ${cat.label.toLowerCase()} record`,
          body: `${v} in ${save.year}${prior > 0 ? `, breaking the old mark of ${prior}.` : "."}`,
          teamIds: p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? [p.teamId as TeamId] : [],
          playerIds: [p.id],
        });
        priorBest.set(cat.id, v);
      }
    }
  }
}
