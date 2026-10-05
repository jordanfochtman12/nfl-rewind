/** Session memory of watched broadcasts, and the live win-probability line. No React. */
import type { PlayLog, TeamId } from "@/lib/game";

/** Games already watched this session, so revisiting the film doesn't replay the broadcast. */
const watched = new Set<string>();
export function wasWatched(id: string): boolean {
  if (watched.has(id)) return true;
  try {
    return sessionStorage.getItem(`nfl-rewind:watched:${id}`) === "1";
  } catch {
    return false;
  }
}
export function markWatched(id: string): void {
  watched.add(id);
  try {
    sessionStorage.setItem(`nfl-rewind:watched:${id}`, "1");
  } catch {
    /* private mode */
  }
}

// Standard normal CDF (Abramowitz-Stegun), for the win-probability line.
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Win probability for `us` after a play: score, time left, and who has the ball where. */
export function winProb(l: PlayLog, us: TeamId, home: TeamId, final: boolean): number {
  const ours = us === home ? l.hs : l.as;
  const theirs = us === home ? l.as : l.hs;
  const lead = ours - theirs;
  if (final) return lead > 0 ? 1 : lead < 0 ? 0 : 0.5;
  const left = l.q <= 4 ? ((4 - l.q) * 900 + l.clock) / 3600 : Math.max(0.01, l.clock / 3600);
  const field = ((l.spot - 25) / 15) * (l.poss === us ? 1 : -1);
  return Math.min(0.995, Math.max(0.005, phi((lead + field) / (13.4 * Math.sqrt(Math.max(0.004, left)) + 0.6))));
}
