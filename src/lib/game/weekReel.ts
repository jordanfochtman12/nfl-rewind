/**
 * The week's Top 5: the plays the desk counts down on Primetime. Built from what every game
 * kept on film (the featured broadcast's play-by-play, every other game's highlight reel and
 * drive chart): touchdowns, takeaways, long kicks, blocked kicks and the drive that won it,
 * weighted up for a close finish and the fourth quarter. One play a game unless the slate is
 * small, so the countdown goes around the league.
 */
import { rosterOf } from "./players.ts";
import type { DynastySave, GameResult, TeamId } from "./types.ts";

export type ReelKind = "TOUCHDOWN" | "TAKEAWAY" | "GAME-WINNER" | "SPECIAL TEAMS" | "BIG PLAY" | "LONG FIELD GOAL";

export interface ReelMoment {
  rank: number;
  kind: ReelKind;
  text: string;
  /** The club that made the play, when the film says. */
  teamId?: TeamId;
  gameId: string;
  homeId: TeamId;
  awayId: TeamId;
  homeScore: number;
  awayScore: number;
  /** "Q4 2:06" when the film has the clock. */
  when?: string;
  weight: number;
}

/** A play's call without the booth's asides: the snap, then how it ended. */
export function cleanPlay(text: string): string {
  const cut = text.split(/ That drive:| The kick is| The goalposts| Two-point/)[0]!.trim();
  const parts = cut.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= 2) return cut;
  const ending = /touchdown|pick-six|the distance|freeze-frame|jumps it|coughs it up|the other way|it's good|intercepted|safety|blocked/i;
  const ends = parts.slice(1).filter((x) => ending.test(x) && !/fresh legs|spells|carried it/i.test(x));
  return [parts[0]!, ...ends.slice(-2)].join(" ");
}

/** A score the defense made: the other club gets the credit. */
const defenseScored = (text: string) => /intercepted by|pick-six|the other way|scoop|fumble return/i.test(text);

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Who a highlight is about: the first player named in it on either club's roster. */
function clubFor(save: DynastySave, g: GameResult, text: string, cache: Map<string, Map<string, TeamId>>): TeamId | undefined {
  let names = cache.get(g.id);
  if (!names) {
    names = new Map();
    for (const club of [g.homeId as TeamId, g.awayId as TeamId]) {
      for (const p of rosterOf(save, club)) names.set(`${p.firstName} ${p.lastName}`, club);
    }
    cache.set(g.id, names);
  }
  let best: { at: number; club: TeamId } | undefined;
  for (const [n, club] of names) {
    const at = text.indexOf(n);
    if (at >= 0 && (!best || at < best.at)) best = { at, club };
  }
  return best?.club;
}

function fromHighlight(text: string): { kind: ReelKind; weight: number; lost?: boolean } | undefined {
  if (/two-minute warning|pass interference|out of bounds|penalty|timeout/i.test(text)) return;
  if (/blocked (punt|kick|field goal)/i.test(text)) return { kind: "SPECIAL TEAMS", weight: 3.2 };
  if (/(punt|kick(off)?) return|returns? it/i.test(text) && /distance|touchdown|six/i.test(text)) return { kind: "SPECIAL TEAMS", weight: 3.6 };
  if (/takes it the distance|freeze-frame, six|touchdown|scores/i.test(text)) return { kind: "TOUCHDOWN", weight: 3 };
  // "X coughs it up" names the man who lost it; "Y jumps it" names the man who took it.
  if (/coughs it up|fumble/i.test(text)) return { kind: "TAKEAWAY", weight: 2.5, lost: true };
  if (/jumps it|intercept|picked off|strip/i.test(text)) return { kind: "TAKEAWAY", weight: 2.6 };
  const fg = text.match(/from (\d{2})\b.*good/i);
  if (fg && Number(fg[1]) >= 50) return { kind: "LONG FIELD GOAL", weight: 2.4 + (Number(fg[1]) - 50) * 0.1 };
  if (/sack/i.test(text)) return { kind: "BIG PLAY", weight: 1.6 };
  return;
}

/** The week's top plays, best first, ranked 1..n (n ≤ 5). */
export function weekReel(save: DynastySave, games: GameResult[], n = 5): ReelMoment[] {
  const cache = new Map<string, Map<string, TeamId>>();
  const all: ReelMoment[] = [];
  for (const g of games) {
    if (!g.played) continue;
    const homeId = g.homeId as TeamId;
    const awayId = g.awayId as TeamId;
    const margin = Math.abs(g.homeScore - g.awayScore);
    const close = margin <= 7 ? 1.4 : margin <= 14 ? 0.5 : 0;
    const stage = (g.phase === "playoffs" ? 0.8 : 0) + (g.phase === "superBowl" ? 1.5 : 0) + (g.rivalry ? 0.3 : 0) + (g.ot ? 0.8 : 0);
    const base = { gameId: g.id, homeId, awayId, homeScore: g.homeScore, awayScore: g.awayScore };
    // The drive that won it: the last lead change, late.
    const drives = g.drives ?? [];
    const winner = g.homeScore > g.awayScore ? homeId : g.awayScore > g.homeScore ? awayId : undefined;
    if (winner && margin <= 8) {
      for (let i = drives.length - 1; i >= 0; i--) {
        const d = drives[i]!;
        if (!d.after || (d.result !== "td" && d.result !== "fg")) continue;
        const [h, a] = d.after;
        const lead = d.teamId === homeId ? h - a : a - h;
        const before = i > 0 && drives[i - 1]!.after ? drives[i - 1]!.after! : [0, 0];
        const was = d.teamId === homeId ? before[0] - before[1] : before[1] - before[0];
        if (d.teamId === winner && lead > 0 && was <= 0 && d.q >= 4 && d.yards >= 20) {
          const [mm, ss] = (d.label.split(" ")[1] ?? "").split(":").map(Number);
          const left = (mm ?? 9) * 60 + (ss ?? 0);
          const down = -was;
          const how = d.result === "td" ? "the touchdown" : "the field goal";
          all.push({
            ...base,
            rank: 0,
            kind: "GAME-WINNER",
            teamId: d.teamId,
            text: `${down > 0 ? `Down ${down}` : "Tied"}, ${d.plays} plays and ${d.yards} yards, and ${how} that won it${d.q > 4 ? " in overtime" : left === 0 ? " as time ran out" : left <= 180 ? ` with ${clock(left)} left` : ""}.`,
            when: d.label,
            weight: 2.8 + close + stage + (d.q > 4 ? 1 : 0) + (left <= 120 ? 1.2 : 0),
          });
        }
        if (d.teamId === winner) break;
      }
    }
    if (g.log?.length) {
      for (const p of g.log) {
        if (p.tag !== "td" && p.tag !== "to" && p.tag !== "big") continue;
        const text = cleanPlay(p.text);
        const late = p.q >= 4 && Math.abs(p.hs - p.as) <= 8 ? 1 : 0;
        const defense = p.tag === "to" || (p.tag === "td" && defenseScored(p.text));
        const kind: ReelKind = p.tag === "td" ? (defense ? "TAKEAWAY" : "TOUCHDOWN") : p.tag === "to" ? "TAKEAWAY" : "BIG PLAY";
        const teamId = defense ? (p.poss === homeId ? awayId : homeId) : p.poss;
        all.push({ ...base, rank: 0, kind, text, teamId, when: `${p.q > 4 ? "OT" : `Q${p.q}`} ${clock(p.clock)}`, weight: (p.tag === "td" ? (defense ? 3.6 : 3) : p.tag === "to" ? 2.6 : 1.8) + late + close * 0.6 + stage });
      }
    } else {
      for (const h of g.highlights ?? []) {
        const c = fromHighlight(h);
        if (!c) continue;
        const named = clubFor(save, g, h, cache);
        const teamId = c.lost && named ? (named === homeId ? awayId : homeId) : named;
        all.push({ ...base, rank: 0, kind: c.kind, text: h, teamId, weight: c.weight + close * 0.6 + stage });
      }
    }
  }
  all.sort((a, b) => b.weight - a.weight);
  const perGame = games.length >= n ? 1 : 2;
  const out: ReelMoment[] = [];
  const count = new Map<string, number>();
  const seen = new Set<string>();
  for (const m of all) {
    if (out.length >= n) break;
    if ((count.get(m.gameId) ?? 0) >= perGame || seen.has(m.text)) continue;
    // Two drives at most: the countdown is about plays.
    if (m.kind === "GAME-WINNER" && out.filter((x) => x.kind === "GAME-WINNER").length >= 2) continue;
    count.set(m.gameId, (count.get(m.gameId) ?? 0) + 1);
    seen.add(m.text);
    out.push(m);
  }
  return out.map((m, i) => ({ ...m, rank: i + 1 }));
}
