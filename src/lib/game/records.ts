import type { DynastySave, Player, Pos, SeasonStats, TeamId } from "./types.ts";
import { playerName } from "./players.ts";
import { displayName } from "./teams.ts";
import { careerTotals } from "./leaders.ts";
import { addNews } from "./news.ts";

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

/** Top single-season performances of all time, across every year simulated so far. */
export function seasonRecordBook(save: DynastySave, topN = 5): RecordCategory[] {
  return CATS.map((cat) => {
    const rows: RecordRow[] = [];
    for (const p of Object.values(save.players)) {
      for (const [yearStr, s] of Object.entries(p.stats)) {
        const v = cat.of(s);
        if (v <= 0) continue;
        rows.push({ playerId: p.id, name: playerName(p), team: teamLabel(save, p), pos: p.pos, value: v, year: Number(yearStr) });
      }
    }
    rows.sort((a, b) => b.value - a.value);
    return { id: cat.id, label: cat.label, rows: rows.slice(0, topN) };
  });
}

/** Career leaders across everyone who has ever taken a snap in this dynasty. */
export function careerRecordBook(save: DynastySave, topN = 5): RecordCategory[] {
  const totals = Object.values(save.players).map((p) => {
    const years = [...Object.keys(p.stats).map(Number), ...(p.career ?? []).map((s) => s.year)];
    const lastYear = years.length ? Math.max(...years) : 0;
    return { p, totals: careerTotals(p), lastYear };
  });
  return CATS.map((cat) => {
    const rows = totals
      .map(({ p, totals: t, lastYear }) => ({
        playerId: p.id,
        name: playerName(p),
        team: teamLabel(save, p),
        pos: p.pos,
        value: cat.of(t),
        year: lastYear,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
    return { id: cat.id, label: cat.label, rows };
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
