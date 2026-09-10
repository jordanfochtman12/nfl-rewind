import type { DynastySave, Player, TeamId } from "./types.ts";

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

export function salaryFor(year: number, ovr: number, age: number): number {
  const star = starScale(year);
  const scale = Math.max(0.12, Math.min(1, (ovr - 42) / 56));
  const ageTax = age >= 33 ? 0.82 : age <= 23 ? 0.7 : 1;
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

export function refreshContracts(save: DynastySave): void {
  save.salaryCap = salaryCapFor(save.year);
  for (const p of Object.values(save.players) as Player[]) {
    if (p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") continue;
    p.salary = salaryFor(save.year, p.ovr, p.age);
    p.contractYears = Math.max(1, p.contractYears ?? 1);
  }
  for (const t of Object.values(save.teams)) {
    t.payroll = teamPayroll(save, t.id);
  }
}
