/** Display precision only: retain fractional simulation spots (e.g. half-distance penalties). */
export function displayYards(value: number): number {
  return Math.max(1, Math.round(value));
}

export function fieldText(spot: number): string {
  spot = Math.round(spot);
  if (spot === 50) return "midfield";
  return spot > 50
    ? `the opponent's ${displayYards(100 - spot)}`
    : `your own ${displayYards(spot)}`;
}
