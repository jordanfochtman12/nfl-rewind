/**
 * A player's trophy case: Pro Bowl selections, first-team All-Pros, the annual awards and
 * Super Bowl rings, stamped the moment each one happens.
 */
import type { AwardKey, AwardsResult, DynastySave, Player, PlayerHonors, TeamId } from "./types.ts";

export const AWARD_LABEL: Record<AwardKey, string> = {
  MVP: "MVP",
  OPOY: "Offensive Player of the Year",
  DPOY: "Defensive Player of the Year",
  OROY: "Offensive Rookie of the Year",
  DROY: "Defensive Rookie of the Year",
  CPOY: "Comeback Player of the Year",
  SBMVP: "Super Bowl MVP",
};

export function honorsOf(p: Player): PlayerHonors {
  if (!p.honors) p.honors = { proBowl: [], allPro: [], awards: [], rings: [] };
  return p.honors;
}

function addYear(list: number[], year: number): void {
  if (!list.includes(year)) {
    list.push(year);
    list.sort((a, b) => a - b);
  }
}

export function recordProBowl(p: Player, year: number): void {
  addYear(honorsOf(p).proBowl, year);
}

export function recordAllPro(p: Player, year: number): void {
  addYear(honorsOf(p).allPro, year);
}

export function recordRing(p: Player, year: number): void {
  addYear(honorsOf(p).rings, year);
}

export function recordAward(p: Player, year: number, award: AwardKey): void {
  const h = honorsOf(p);
  if (!h.awards.some((a) => a.year === year && a.award === award)) {
    h.awards.push({ year, award });
    h.awards.sort((a, b) => a.year - b.year);
  }
}

/** Stamp one season's award ballot onto the players it names. */
export function recordAwards(save: DynastySave, a: AwardsResult): void {
  const give = (id: string | undefined, award: AwardKey) => {
    const p = id ? save.players[id] : undefined;
    if (p) recordAward(p, a.year, award);
  };
  give(a.mvp, "MVP");
  give(a.offPoy, "OPOY");
  give(a.defPoy, "DPOY");
  give(a.oroy, "OROY");
  give(a.droy, "DROY");
  give(a.cpoty, "CPOY");
  for (const id of a.allPro) {
    const p = save.players[id];
    if (p) recordAllPro(p, a.year);
  }
}

/** Every player who suited up for the champion that year gets the ring. */
export function recordRings(save: DynastySave, year: number, winner: TeamId): void {
  const team = save.teams[winner];
  const ids = new Set(team?.roster ?? []);
  for (const p of Object.values(save.players)) {
    const played = p.stats[year]?.teamId === winner || p.playoffStats?.[year]?.teamId === winner;
    if (ids.has(p.id) || played) recordRing(p, year);
  }
}

/**
 * Older saves never stamped honors on players. Rebuild what the history can prove: every
 * award ballot, every All-Pro team, Super Bowl MVPs and rings (from who played for the
 * champion). Pro Bowl rosters were never kept, so those start from the next Pro Bowl.
 */
export function backfillHonors(save: DynastySave): void {
  if (save.honorsBackfilled) return;
  for (const a of save.history.awards ?? []) recordAwards(save, a);
  for (const sb of save.history.superBowls ?? []) {
    const winner = sb.homeScore >= sb.awayScore ? sb.homeId : sb.awayId;
    for (const p of Object.values(save.players)) {
      const line = p.stats[sb.year] ?? p.career?.find((c) => c.year === sb.year);
      if (line?.teamId === winner) recordRing(p, sb.year);
    }
    const mvp = sb.mvpId ? save.players[sb.mvpId] : undefined;
    if (mvp) recordAward(mvp, sb.year, "SBMVP");
  }
  save.honorsBackfilled = true;
}

/** Short trophy-case lines, most prestigious first: "3× MVP", "9× Pro Bowl", ... */
export function honorLines(p: Player): { label: string; years: number[] }[] {
  const h = p.honors;
  if (!h) return [];
  const out: { label: string; years: number[] }[] = [];
  const byAward = (k: AwardKey) => h.awards.filter((a) => a.award === k).map((a) => a.year);
  const push = (label: string, years: number[]) => {
    if (years.length) out.push({ label: `${years.length > 1 ? `${years.length}× ` : ""}${label}`, years });
  };
  push("MVP", byAward("MVP"));
  push("Super Bowl champion", h.rings);
  push("Super Bowl MVP", byAward("SBMVP"));
  push("First-team All-Pro", h.allPro);
  push("Pro Bowl", h.proBowl);
  push("Offensive Player of the Year", byAward("OPOY"));
  push("Defensive Player of the Year", byAward("DPOY"));
  push("Offensive Rookie of the Year", byAward("OROY"));
  push("Defensive Rookie of the Year", byAward("DROY"));
  push("Comeback Player of the Year", byAward("CPOY"));
  return out;
}
