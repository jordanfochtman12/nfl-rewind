/** Text tone for a player grade: brass for the elite, muted below starter level. */
export function gradeTone(ovr: number): string {
  if (ovr >= 90) return "text-brass";
  if (ovr >= 80) return "text-club-2";
  if (ovr >= 65) return "text-fg";
  return "text-muted";
}
