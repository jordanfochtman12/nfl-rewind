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
    scoring: rows(save, (s) => s.passTd * 6 + s.rushTd * 6 + s.recTd * 6 + s.fgMade * 3 + s.xpMade, "Pts"),
  };
}

export function careerTotals(p: Player): SeasonStats {
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
  } as SeasonStats;
  const years = Object.values(p.stats);
  const extra = p.career ?? [];
  const seen = new Set<number>();
  for (const s of [...years, ...extra]) {
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
    acc.fgMade += s.fgMade;
    acc.xpMade += s.xpMade;
  }
  return acc;
}
