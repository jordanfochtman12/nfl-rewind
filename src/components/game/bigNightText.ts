import { cleanPlay, displayName, type GameResult, type TeamId } from "@/lib/game";

const won = (g: GameResult) => (g.homeScore >= g.awayScore ? (g.homeId as TeamId) : (g.awayId as TeamId));

/** What the trophy was called that year. */
export function trophyName(year: number): string {
  // Renamed for Vince Lombardi after his death in 1970, first presented at Super Bowl V.
  return year >= 1970 ? "The Vince Lombardi Trophy" : "The World Championship Game Trophy";
}

/** The halftime show, as the era put it on. */
export function halftimeAct(year: number): string {
  if (year < 1972) return "Two university marching bands and a card stunt in the stands";
  if (year < 1987) return "A Hollywood-style revue with a drill team and a salute to the host city";
  if (year < 1993) return "A full stage revue, fireworks and a flyover";
  if (year < 2005) return "A pop headliner on a stage built in seven minutes, and fireworks off the roof";
  return "A headline act, a light show from every seat, and a stage that rolls on and off in minutes";
}

export function finalLine(g: GameResult, year: number): string {
  const w = won(g);
  const l = (w === g.homeId ? g.awayId : g.homeId) as TeamId;
  return `${displayName(year, w)} ${Math.max(g.homeScore, g.awayScore)}, ${displayName(year, l)} ${Math.min(g.homeScore, g.awayScore)}`;
}


export interface ReelPlay {
  q: number;
  clock: number;
  teamId: TeamId;
  text: string;
  tag: "td" | "fg" | "to" | "safety";
  hs: number;
  as: number;
}

/** The game's reel from its film: every score and every takeaway, in order. */
export function reelFrom(g: GameResult): ReelPlay[] {
  const out: ReelPlay[] = [];
  for (const p of g.log ?? []) {
    if (p.tag !== "td" && p.tag !== "fg" && p.tag !== "to" && p.tag !== "safety") continue;
    // The play itself, not the drive summary or the era notes the booth hangs on it.
    const text = cleanPlay(p.text);
    // A takeaway (and a defensive score) belongs to the defense that made it.
    const defense = p.tag === "to" || (p.tag === "td" && /intercepted by|pick-six|the other way|scoop|fumble return/i.test(p.text));
    const teamId = defense ? ((p.poss === g.homeId ? g.awayId : g.homeId) as TeamId) : p.poss;
    out.push({ q: p.q, clock: p.clock, teamId, text, tag: p.tag, hs: p.hs, as: p.as });
  }
  return out;
}

export const clockLabel = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
