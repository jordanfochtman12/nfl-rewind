import type { SeasonStats } from "./types.ts";

/** Points credited to the player who scores; passing touchdowns credit a passer, not a scorer. */
export function individualScoringPoints(s: SeasonStats): number {
  return (s.rushTd + s.recTd + (s.krTd ?? 0) + (s.prTd ?? 0)) * 6 + s.fgMade * 3 + s.xpMade;
}
