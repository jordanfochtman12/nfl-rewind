import type { DynastySave, Player, SeasonStats } from "./types.ts";
import { playerName } from "./players.ts";
import { displayName } from "./teams.ts";

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
): LeaderRow[] {
  return Object.values(save.players)
    .map((p) => {
      const s = p.stats[save.year];
      return { p, v: s ? pick(s, p) : 0 };
    })
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => ({
      playerId: x.p.id,
      name: playerName(x.p),
      team: x.p.teamId === "fa" || x.p.teamId === "retired" || x.p.teamId === "hof" ? "—" : displayName(save.year, x.p.teamId),
      pos: x.p.pos,
      value: x.v,
      label,
    }));
}

export function seasonLeaders(save: DynastySave) {
  return {
    passYds: rows(save, (s) => s.passYds, "Pass yds"),
    passTd: rows(save, (s) => s.passTd, "Pass TD"),
    rushYds: rows(save, (s) => s.rushYds, "Rush yds"),
    rec: rows(save, (s) => s.rec, "Receptions"),
    recYds: rows(save, (s) => s.recYds, "Rec yds"),
    sacks: rows(save, (s) => s.sacks, "Sacks"),
    ints: rows(save, (s) => s.ints, "INT"),
    tfl: rows(save, (s) => s.tfl ?? 0, "TFL"),
    pd: rows(save, (s) => s.pd ?? 0, "PD"),
    scoring: rows(save, (s) => s.passTd * 6 + s.rushTd * 6 + s.recTd * 6 + s.fgMade * 3 + s.xpMade, "Pts"),
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
    krTd: 0,
    prTd: 0,
  } as SeasonStats;
  const seen = new Set<number>();
  for (const s of lines) {
    if (seen.has(s.year)) continue;
    seen.add(s.year);
    acc.gp += s.gp;
    acc.passAtt += s.passAtt;
    acc.passCmp += s.passCmp;
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
    acc.krTd += s.krTd ?? 0;
    acc.prTd += s.prTd ?? 0;

  }
  return acc;
}
