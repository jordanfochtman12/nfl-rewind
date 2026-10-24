import type { SeasonStats } from "./types.ts";

/** Points credited to the player who scores; passing touchdowns credit a passer, not a scorer. */
export function individualScoringPoints(s: SeasonStats): number {
  return (s.rushTd + s.recTd + (s.krTd ?? 0) + (s.prTd ?? 0) + (s.defTd ?? 0)) * 6 + s.fgMade * 3 + s.xpMade + (s.twoPtMade ?? 0) * 2 + (s.safeties ?? 0) * 2;
}

/** A combined points total must be hidden if any touchdown channel was not recorded. */
export function hasCompleteScoringPoints(s: SeasonStats): boolean {
  return !s.unknown?.some((field) => field === "pts" || field === "defTd" || field === "krTd" || field === "prTd" || field === "twoPtMade" || field === "safeties");
}
