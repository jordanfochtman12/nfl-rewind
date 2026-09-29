import { CAREER_ARCS, VET_ARCS } from "./data/careerArcs.ts";
import { HISTORICAL_ALIASES } from "./data/playerAliases.ts";
import { normalizedName } from "./identity.ts";

const years = new Map<string, Set<number>>();
function add(name: string, year: number): void {
  const key = normalizedName(name);
  const found = years.get(key) ?? new Set<number>();
  found.add(year);
  years.set(key, found);
}
for (const [year, rows] of Object.entries(CAREER_ARCS)) {
  for (const name of Object.keys(rows)) add(name.replace(/\|/g, " "), Number(year));
}
for (const [name, rows] of Object.entries(VET_ARCS)) {
  for (const row of rows) add(name.replace(/\|/g, " "), row[0]);
}
for (const [year, ...names] of HISTORICAL_ALIASES) {
  for (const name of names) add(name, year);
}

/** A unique career-source class overrides misfiled fill rows (Lammons: 1967 ->
 * 1966). Known namesakes with multiple classes always retain their own year. */
export function historicalYear(first: string, last: string, fallback?: number): number | undefined {
  const found = years.get(normalizedName(first, last));
  return found?.size === 1 ? [...found][0] : fallback;
}
