import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { clamp, rand, randInt } from "./rng.ts";

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

export function salaryCapFor(year: number): number | null {
  if (year < 1994) return null;
  if (year <= 1994) return 34_600_000;
  if (year <= 1999) return 57_000_000;
  if (year <= 2005) return 85_500_000;
  if (year <= 2010) return 128_000_000;
  if (year <= 2015) return 143_000_000;
  if (year <= 2020) return 198_000_000;
  return 255_000_000;
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
function expireContract(save: DynastySave, p: Player): void {
  if (p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") return;
  const from = p.teamId;
  if (save.year < 1994) {
    const leave = p.ovr < 74 ? rand(save) < 0.18 : rand(save) < 0.06;
    if (!leave) {
      resignInPlace(save, p);
      return;
    }
  } else if (rand(save) < clamp(0.3 + (p.ovr - 65) * 0.01, 0.1, 0.75)) {
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
      if (p.contractYears <= 0) expireContract(save, p);
    }
  }
  for (const t of Object.values(save.teams)) {
    t.payroll = teamPayroll(save, t.id);
  }
}
