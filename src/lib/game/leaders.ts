import type { DynastySave, Player, SeasonStats } from "./types.ts";
import { playerName } from "./players.ts";
import { displayName } from "./teams.ts";
import { hasCompleteScoringPoints, individualScoringPoints } from "./statRules.ts";

export interface LeaderRow {
  playerId: string;
  name: string;
  team: string;
  pos: string;
  value: number;
  label: string;
}

function rows(
  save: DynastySave,
  pick: (s: SeasonStats, p: Player) => number,
  label: string,
  n = 8,
  pool: Player[] = Object.values(save.players),
): LeaderRow[] {
  return pool
    .map((p) => {
      const s = p.stats[save.year];
      return { p, s, v: s ? pick(s, p) : 0 };
    })
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => ({
      playerId: x.p.id,
      name: playerName(x.p),
      team: !x.s ? "—" : x.s.teamId === "two" ? "2 teams" : displayName(x.s.year, x.s.teamId),
      pos: x.p.pos,
      value: x.v,
      label,
    }));
}

/** This season's leaders. Late in a dynasty there are tens of thousands of players on file,
 * so only the ones with a line this year are walked. */
export function seasonLeaders(save: DynastySave) {
  const pool = Object.values(save.players).filter((p) => p.stats[save.year]);
  const r = (pick: (s: SeasonStats, p: Player) => number, label: string) => rows(save, pick, label, 8, pool);
  return {
    passYds: r((s) => s.passYds, "Pass yds"),
    passTd: r((s) => s.passTd, "Pass TD"),
    rushYds: r((s) => s.rushYds, "Rush yds"),
    rec: r((s) => s.rec, "Receptions"),
    recYds: r((s) => s.recYds, "Rec yds"),
    sacks: r((s) => s.sacks, "Sacks"),
    ints: r((s) => s.ints, "INT"),
    tfl: r((s) => s.tfl ?? 0, "TFL"),
    pd: r((s) => s.pd ?? 0, "PD"),
    defTd: r((s) => s.unknown?.includes("defTd") ? 0 : s.defTd ?? 0, "Def TD"),
    scoring: r((s) => hasCompleteScoringPoints(s) ? individualScoringPoints(s) : 0, "Pts"),
  };
}

export function careerTotals(p: Player, range?: { fromYear?: number; throughYear?: number }): SeasonStats {
  return sumStats(p, [...Object.values(p.stats), ...(p.career ?? [])].filter(s => s.year >= (range?.fromYear ?? 0) && s.year <= (range?.throughYear ?? Infinity)));
}

/** Career postseason totals. */
export function playoffTotals(p: Player): SeasonStats {
  return sumStats(p, Object.values(p.playoffStats ?? {}));
}

function sumStats(p: Player, lines: SeasonStats[]): SeasonStats {
  const acc = {
    year: 0,
    teamId: p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? "two" : p.teamId,
    gp: 0,
    passAtt: 0,
    passCmp: 0,
    passYds: 0,
    passTd: 0,
    passInt: 0,
    sacksThrown: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTd: 0,
    rec: 0,
    recYds: 0,
    recTd: 0,
    tackles: 0,
    sacks: 0,
    ints: 0,
    ff: 0,
    fgAtt: 0,
    fgMade: 0,
    xpAtt: 0,
    xpMade: 0,
    punts: 0,
    puntYds: 0,
    krYds: 0,
    prYds: 0,
    targets: 0,
    tfl: 0,
    pd: 0,
    qbHits: 0,
    fr: 0,
    defTd: 0,
    krTd: 0,
    prTd: 0,
  } as SeasonStats;
  const seen = new Set<number>();
  for (const s of lines) {
    if (seen.has(s.year)) continue;
    seen.add(s.year);
    acc.gp += s.gp;
    acc.passAtt += s.passAtt;
    // An unknown completion count is in the record as -1: it adds nothing to the total.
    acc.passCmp += Math.max(0, s.passCmp);
    acc.passYds += s.passYds;
    acc.passTd += s.passTd;
    acc.passInt += s.passInt;
    acc.rushAtt += s.rushAtt;
    acc.rushYds += s.rushYds;
    acc.rushTd += s.rushTd;
    acc.rec += s.rec;
    acc.recYds += s.recYds;
    acc.recTd += s.recTd;
    acc.sacks += s.sacks;
    acc.ints += s.ints;
    acc.tackles += s.tackles;
    acc.ff += s.ff ?? 0;
    acc.sacksThrown += s.sacksThrown ?? 0;
    acc.fgAtt += s.fgAtt ?? 0;
    acc.fgMade += s.fgMade;
    acc.xpAtt += s.xpAtt ?? 0;
    acc.xpMade += s.xpMade;
    acc.punts += s.punts ?? 0;
    acc.puntYds += s.puntYds ?? 0;
    acc.krYds += s.krYds ?? 0;
    acc.prYds += s.prYds ?? 0;
    acc.targets += s.targets ?? 0;
    acc.tfl += s.tfl ?? 0;
    acc.pd += s.pd ?? 0;
    acc.qbHits += s.qbHits ?? 0;
    acc.fr += s.fr ?? 0;
    acc.defTd += s.defTd ?? 0;
    acc.krTd += s.krTd ?? 0;
    acc.prTd += s.prTd ?? 0;

  }
  // History mode marks a season whose source kept no completions as -1; a career that
  // includes one has no known completion total either.
  if (lines.some((s) => s.passCmp < 0)) acc.passCmp = -1;
  const unknown = [...new Set(lines.flatMap((s) => s.unknown ?? []))];
  if (unknown.length) acc.unknown = unknown;
  return acc;
}
