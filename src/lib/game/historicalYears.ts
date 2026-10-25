import { CAREER_ARCS, VET_ARCS } from "./data/careerArcs.ts";
import { HISTORICAL_ALIASES } from "./data/playerAliases.ts";
import { UNDRAFTED_ARCS } from "./data/undrafted.ts";
import { normalizedName } from "./identity.ts";
import { AUDIT_ARCS, AUDIT_VET_ARCS } from "./data/auditPlayers.ts";

const years = new Map<string, Set<number>>();
const ENTRY_YEAR_OVERRIDES = new Map([[normalizedName("Tyler Palko"), 2007]]);
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
// Undrafted players keep their own year even when a drafted namesake exists (two Michael Bennetts).
for (const [name, { dy }] of Object.entries(UNDRAFTED_ARCS)) add(name.replace(/\|/g, " "), dy);
// Players the audit added from the real record, under their real first year.
for (const [name, { dy }] of Object.entries(AUDIT_ARCS)) add(name.replace(/\|/g, " "), dy);
for (const [name, rows] of Object.entries(AUDIT_VET_ARCS)) for (const row of rows) add(name.replace(/\|/g, " "), row[0]);
for (const [year, ...names] of HISTORICAL_ALIASES) {
  for (const name of names) add(name, year);
}

/** A unique career-source class overrides misfiled fill rows (Lammons: 1967 ->
 * 1966). Known namesakes with multiple classes always retain their own year. */
export function historicalYear(first: string, last: string, fallback?: number): number | undefined {
  const entryYear = ENTRY_YEAR_OVERRIDES.get(normalizedName(first, last));
  if (entryYear !== undefined) return entryYear;
  const found = years.get(normalizedName(first, last));
  return found?.size === 1 ? [...found][0] : fallback;
}
