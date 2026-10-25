export type ScramblePassCall = "short" | "screen" | "med" | "deep" | "pa";

// Year-by-year calibration against regular-season QB rushing records. The 2024 baseline needs
// 1.10x; 2020–21 overproduced at that setting. Excluding the fictional Friends class brings
// 2022+ near baseline again, so later unmeasured years retain the 2024 modern setting.
export function scrambleSituationVolumeNormalizer(year: number): number {
  // Real-roster audits show a QB carry-volume gap from 2017–19. Restrict this adjustment to
  // broken pass plays, keeping designed runs and other seasons on their separately measured curves.
  if (year === 2017) return 1.1;
  if (year === 2018 || year === 2019) return 1.25;
  if (year < 2020) return 1;
  if (year <= 2021) return 1;
  return 1.1;
}

/** Season-level correction for non-sack scramble gains, calibrated to recorded QB YPC. */
export function scrambleYardsAdjustment(year: number): number {
  if (year === 2017) return 0.55;
  if (year === 2018) return 0.45;
  if (year === 2019) return 0.15;
  if (year === 2020) return -0.05;
  if (year === 2021) return -0.25;
  if (year === 2022) return -0.15;
  if (year === 2023) return -0.55;
  return 0;
}

/** Season-specific gain for designed QB runs, separate from halfback and sneak formulas. */
export function designedQbRunYardsAdjustment(year: number): number {
  if (year === 2017) return 0.55;
  if (year === 2018) return 0.45;
  if (year === 2019) return 0.15;
  if (year === 2022) return 0.1;
  return 0;
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
