export type ScramblePassCall = "short" | "screen" | "med" | "deep" | "pa";

// Normalize the situation split against the modern league baseline: the unnormalized factors
// pulled total QB carries 8.7% below the existing four-seed 2024 regular-season calibration.
export function scrambleSituationVolumeNormalizer(year: number): number {
  return year >= 2020 ? 1.1 : 1;
}

export function isScramblePassCall(call: string): call is ScramblePassCall {
  return call === "short" || call === "screen" || call === "med" || call === "deep" || call === "pa";
}

/**
 * A quarterback is more likely to leave the pocket on a long-developing concept and when
 * the defense has a realistic chance to pressure him. Quick throws and short conversions
 * keep him in the pass-first decision tree; third-and-long gives a mobile QB more reason
 * to turn a broken play into a run. The base chance still carries the player's mobility.
 */
export function scrambleSituationMultiplier(
  call: ScramblePassCall,
  down: number,
  togo: number,
  sackChance: number,
  eraSackRate: number,
  year: number,
): number {
  // This adjustment is calibrated against full modern seasons. Keep earlier-era scramble
  // rates unchanged until the same situation-level evidence exists for those eras.
  if (year < 2020) return 1;
  const concept = call === "screen" ? 0.58 : call === "short" ? 0.82 : call === "deep" ? 1.16 : call === "pa" ? 1.08 : 1;
  const conversion = down >= 3 ? (togo >= 6 ? 1.18 : togo <= 2 ? 0.82 : 1.04) : 1;
  const pressure = clamp(1 + (sackChance - eraSackRate) * 4, 0.85, 1.25);
  return concept * conversion * pressure;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
