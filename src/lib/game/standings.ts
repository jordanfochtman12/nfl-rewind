import type { DynastySave, TeamId, TeamState } from "./types.ts";
import { activeTeamIds, conferenceOf, divisionKey, type Conference } from "./teams.ts";

export function winPct(t: TeamState): number {
  const g = t.wins + t.losses + t.ties;
  if (g === 0) return 0;
  return (t.wins + t.ties * 0.5) / g;
}

export function compareTeams(a: TeamState, b: TeamState): number {
  const p = winPct(b) - winPct(a);
  if (Math.abs(p) > 0.0001) return p;
  const dw = b.divWins - a.divWins;
  if (dw) return dw;
  const cw = b.confWins - a.confWins;
  if (cw) return cw;
  return b.pf - b.pa - (a.pf - a.pa);
}

export function sortedDivision(save: DynastySave, key: string): TeamState[] {
  return activeTeamIds(save.year)
    .filter((id) => divisionKey(save.year, id) === key)
    .map((id) => save.teams[id]!)
    .sort(compareTeams);
}

export function divisionWinner(save: DynastySave, key: string): TeamId | undefined {
  return sortedDivision(save, key)[0]?.id;
}

export function conferenceTeams(save: DynastySave, conf: Conference): TeamState[] {
  return activeTeamIds(save.year)
    .filter((id) => conferenceOf(save.year, id) === conf)
    .map((id) => save.teams[id]!)
    .sort(compareTeams);
}

/**
 * A conference's playoff field, in seed order: every division winner first (they're in no
 * matter their record), then the best of the rest as wild cards.
 */
export function playoffField(save: DynastySave, conf: Conference, n: number): TeamState[] {
  const teams = conferenceTeams(save, conf);
  const winners = new Set([...new Set(teams.map((t) => divisionKey(save.year, t.id)))].map((d) => sortedDivision(save, d)[0]?.id));
  return [...teams.filter((t) => winners.has(t.id)), ...teams.filter((t) => !winners.has(t.id))].slice(0, n);
}

export function standingRows(save: DynastySave): { key: string; conf: string; div: string; teams: TeamState[] }[] {
  const year = save.year;
  const groups = new Map<string, TeamId[]>();
  for (const id of activeTeamIds(year)) {
    const key = divisionKey(year, id);
    const arr = groups.get(key) ?? [];
    arr.push(id);
    groups.set(key, arr);
  }
  const rows = [...groups.entries()].map(([key, ids]) => {
    const parts = key.split(" ");
    const conf = parts[0]!;
    const div = parts.slice(1).join(" ");
    const teams = ids.map((id) => save.teams[id]!).sort(compareTeams);
    return { key, conf, div, teams };
  });
  const confOrder = year < 1970 ? ["NFL", "AFL"] : ["AFC", "NFC"];
  const divOrder = ["East", "North", "South", "West", "Central", "Capitol", "Century", "Coastal"];
  rows.sort((a, b) => {
    const ci = confOrder.indexOf(a.conf) - confOrder.indexOf(b.conf);
    if (ci) return ci;
    return divOrder.indexOf(a.div) - divOrder.indexOf(b.div);
  });
  return rows;
}
