import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { clamp, rand, randInt } from "./rng.ts";
import { startTalks } from "./contracts.ts";

/** Era star-scale annual salary in then-year dollars. */
export function starScale(year: number): number {
  if (year <= 1969) return 50_000;
  if (year <= 1974) return 120_000;
  if (year <= 1981) return 400_000;
  if (year <= 1988) return 1_200_000;
  if (year <= 1993) return 3_000_000;
  if (year <= 1999) return 6_500_000;
  if (year <= 2005) return 12_000_000;
  if (year <= 2011) return 18_000_000;
  if (year <= 2017) return 25_000_000;
  return 45_000_000;
}

/**
 * The league's salary cap, year by year as it was set (1994 on). 2010 was the uncapped year;
 * the game keeps the 2009 figure as a ceiling that season so contracts still have a frame.
 * Past 2025 it grows about 6% a year, close to the recent pace.
 */
const CAP_BY_YEAR: Record<number, number> = {
  1994: 34_608_000, 1995: 37_100_000, 1996: 40_753_000, 1997: 41_454_000, 1998: 52_388_000,
  1999: 57_288_000, 2000: 62_172_000, 2001: 67_405_000, 2002: 71_101_000, 2003: 75_007_000,
  2004: 80_582_000, 2005: 85_500_000, 2006: 102_000_000, 2007: 109_000_000, 2008: 116_000_000,
  2009: 123_000_000, 2010: 123_000_000, 2011: 120_000_000, 2012: 120_600_000, 2013: 123_000_000,
  2014: 133_000_000, 2015: 143_280_000, 2016: 155_270_000, 2017: 167_000_000, 2018: 177_200_000,
  2019: 188_200_000, 2020: 198_200_000, 2021: 182_500_000, 2022: 208_200_000, 2023: 224_800_000,
  2024: 255_400_000, 2025: 279_200_000,
};

export function salaryCapFor(year: number): number | null {
  if (year < 1994) return null;
  const known = CAP_BY_YEAR[year];
  if (known) return known;
  return Math.round((279_200_000 * Math.pow(1.06, year - 2025)) / 100_000) * 100_000;
}

export function salaryFor(year: number, ovr: number, age: number, pos?: Pos): number {
  const ageTax = age >= 33 ? 0.82 : age <= 23 ? 0.7 : 1;
  const cap = salaryCapFor(year);
  if (cap != null) {
    // Cap-era pay is priced off the cap itself and steeply skewed, like the real thing:
    // a 95 takes ~10% of the cap, a 70 a little over 1%, the back of the roster sits
    // near the minimum. The old flat star-scale made a 45-man roster cost ~2x the cap,
    // so every club was permanently over it, compliance gutted rosters to ~20 players,
    // and nobody could afford the real free agents sitting on the market.
    const f = Math.pow(clamp((ovr - 48) / 50, 0, 1), 3.3);
    const posMult = pos === "QB" ? 1.35 : pos === "K" || pos === "P" ? 0.6 : 1;
    const raw = cap * (0.004 + 0.12 * f * posMult) * ageTax;
    return Math.round(raw / 10_000) * 10_000;
  }
  const star = starScale(year);
  const scale = Math.max(0.12, Math.min(1, (ovr - 42) / 56));
  const raw = star * scale * ageTax;
  if (year <= 1969) return Math.round(raw / 500) * 500;
  if (year <= 1988) return Math.round(raw / 1000) * 1000;
  return Math.round(raw / 10_000) * 10_000;
}

/**
 * A drafted rookie's deal, priced by where he went, not how good he is (that's how the league
 * has always paid rookies). Three eras:
 * - before the cap: top picks earned like good veterans, the late rounds near the bottom;
 * - 1994-2010: the cap with no rookie limit, so the top of round one got huge guarantees
 *   (the first pick took a bigger slice of the cap than most stars);
 * - 2011 on: the rookie wage scale - slotted pay, much flatter at the top, four years for all.
 */
export function rookieContract(year: number, overall: number, round: number): { salary: number; years: number } {
  const n = Math.max(1, overall);
  const cap = salaryCapFor(year);
  if (cap == null) {
    // e.g. 1989: Troy Aikman, No. 1, about $1.9M a year on a six-year deal, near the top QB pay.
    const star = starScale(year);
    const raw = star * (0.05 + 0.55 * Math.exp(-(n - 1) / 24));
    const step = year <= 1969 ? 500 : year <= 1988 ? 1000 : 10_000;
    return { salary: Math.round(raw / step) * step, years: round === 1 ? 4 : round <= 3 ? 3 : 2 };
  }
  if (year <= 2010) {
    // Fitted to real deals: No. 1 near 9-10% of the cap (Stafford 2009, $12M a year on $123M),
    // No. 10 about 4%, No. 32 about 1.2%, the late rounds near the minimum. After the 2006
    // agreement, picks 1-16 could sign for six years and the rest of round one for five.
    const raw = cap * (0.003 + 0.085 * Math.exp(-(n - 1) / 12) + 0.006 * Math.exp(-(n - 1) / 60));
    const years = round === 1 ? (n <= 16 ? 6 : 5) : round === 2 ? 4 : 3;
    return { salary: Math.round(raw / 10_000) * 10_000, years };
  }
  // Rookie wage scale: No. 1 about 4.4% of the cap (Newton 2011, Williams 2024), No. 32 about
  // 1.2%, seventh-rounders just over the minimum. Four years for all (round one has a fifth-year option).
  const raw = cap * (0.0035 + 0.025 * Math.exp(-(n - 1) / 9) + 0.013 * Math.exp(-(n - 1) / 60));
  return { salary: Math.round(raw / 10_000) * 10_000, years: 4 };
}

export function formatMoney(n: number, year: number): string {
  if (year <= 1977) return `$${n.toLocaleString("en-US")}`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function teamPayroll(save: DynastySave, teamId: TeamId): number {
  const ids = save.teams[teamId]?.roster ?? [];
  return ids.reduce((s, id) => s + (save.players[id]?.salary ?? 0), 0);
}

function resignInPlace(save: DynastySave, p: Player): void {
  p.salary = salaryFor(save.year, p.ovr, p.age, p.pos);
  p.contractYears = p.age >= 33 ? 1 : randInt(save, 1, 3);
}

/** Rozelle-rule era: stars stay put. 1994+ true UFA, but a team still gets a real shot
 * at keeping its own player before he ever hits the open market - same as real free
 * agency, where most departing starters get re-signed by someone, often their own
 * club, rather than every expiring contract instantly becoming a league-wide free-
 * for-all. Without this, cpuSignNeeds' open-market pass (0-2 new signings a team a
 * year) couldn't come close to absorbing the full post-1994 churn, and good veterans
 * - QBs especially, since a team only carries one - just fell into permanent
 * unsigned limbo while their old team backfilled with a fresh, weak generated player. */
/**
 * How likely a club is to keep its own man when his deal runs out (cap era). Real front offices
 * extend or tag their stars and young starters and let the aging and the replaceable walk; the
 * old flat odds (a 90 kept barely half the time) sent eight to twelve young stars a year to the
 * market (Steven Jackson at 23, Vince Wilfork at 26).
 */
function keepChance(p: Player): number {
  const base = p.ovr >= 88 ? 0.92 : p.ovr >= 82 ? 0.8 : p.ovr >= 75 ? 0.62 : p.ovr >= 68 ? 0.42 : 0.22;
  const age = p.age >= 33 ? 0.6 : p.age >= 30 ? 0.85 : 1;
  return clamp(base * age, 0.1, 0.95);
}

export function expireContract(save: DynastySave, p: Player): void {
  if (p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") return;
  const from = p.teamId;
  if (save.year < 1994) {
    const leave = p.ovr < 74 ? rand(save) < 0.18 : rand(save) < 0.06;
    if (!leave) {
      resignInPlace(save, p);
      return;
    }
  } else if (rand(save) < keepChance(p)) {
    // Not cap-gated here: enforceCapCompliance runs at the end of every offseason
    // and already knows how to shed a bad contract rather than a fairly-priced one,
    // so a team is better off retaining a good player and letting that later sweep
    // clean up the payroll than losing him here because the roster happens to be
    // tight this exact moment.
    resignInPlace(save, p);
    return;
  }
  const team = save.teams[from];
  if (team) {
    team.roster = team.roster.filter((id) => id !== p.id);
    if (team.depth) {
      for (const pos of Object.keys(team.depth) as (keyof typeof team.depth)[]) {
        team.depth[pos] = (team.depth[pos] ?? []).filter((id) => id !== p.id);
      }
    }
  }
  p.teamId = "fa";
}

export function refreshContracts(save: DynastySave, opts?: { init?: boolean }): void {
  save.salaryCap = salaryCapFor(save.year);
  if (opts?.init) {
    for (const p of Object.values(save.players) as Player[]) {
      if (p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") continue;
      p.salary = salaryFor(save.year, p.ovr, p.age, p.pos);
      p.contractYears = Math.max(1, p.contractYears ?? randInt(save, 1, 4));
    }
  } else {
    // The 1993 CBA reset every deal under the new cap; do the same the first cap-era
    // offseason a save sees (also re-prices older saves priced on the pre-cap scale).
    const reprice = save.salaryCap != null && (save.salaryModel ?? 1) < 2;
    if (save.salaryCap != null) save.salaryModel = 2;
    for (const p of Object.values(save.players) as Player[]) {
      if (p.teamId === "retired" || p.teamId === "hof") continue;
      if (p.teamId === "fa") continue;
      if (reprice) p.salary = salaryFor(save.year, p.ovr, p.age, p.pos);
      p.contractYears = (p.contractYears ?? 1) - 1;
      // The owner's own players come to the table; everyone else expires the usual way.
      // (the back of the roster is left to the staff, so the table holds players who matter).
      if (p.contractYears <= 0 && p.teamId === save.userTeamId && !save.cpuOnly && p.ovr >= 66) startTalks(save, p);
      else if (p.contractYears <= 0) expireContract(save, p);
    }
  }
  for (const t of Object.values(save.teams)) {
    t.payroll = teamPayroll(save, t.id);
  }
}
