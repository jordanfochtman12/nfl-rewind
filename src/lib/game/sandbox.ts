/**
 * Watch mode: the computer runs every club and the owner just watches the league. One game a
 * week is the featured broadcast — the best matchup on the slate by record and power ranking,
 * with a nudge for prime time — and that game gets the live play-by-play call.
 */
import type { DynastySave, GameResult, TeamId } from "./types.ts";

function strength(save: DynastySave, id: TeamId): number {
  const t = save.teams[id];
  const played = t ? t.wins + t.losses + t.ties : 0;
  const pct = played ? (t!.wins + t!.ties / 2) / played : 0.5;
  const ranks = save.powerRanks ?? {};
  const n = Math.max(1, Object.keys(ranks).length);
  const rank = ranks[id];
  const ranked = rank ? 1 - (rank - 1) / n : 0.5;
  // Early in a season the power ranking (carried from last year) matters most; by December
  // the record does.
  return (pct * played + ranked * 3) / (played + 3);
}

export function featuredScore(save: DynastySave, g: Pick<GameResult, "homeId" | "awayId" | "night" | "phase" | "rivalry">): number {
  const a = strength(save, g.homeId as TeamId);
  const b = strength(save, g.awayId as TeamId);
  return a + b - Math.abs(a - b) * 0.5 + (g.night ? 0.12 : 0) + (g.rivalry ? 0.08 : 0) + (g.phase !== "regular" ? 0.05 : 0);
}

/**
 * Picks this week's featured game in a sandbox (no-op otherwise). No randomness consumed.
 * Every sandbox game is logged so the whip-around can show the whole slate; before a new week
 * kicks off, last week's non-featured logs are dropped so the save stays small.
 */
export function pickFeaturedGame(save: DynastySave, games: GameResult[]): void {
  if (!save.sandbox) return;
  const open = games.filter((g) => !g.played);
  if (!open.length) return;
  // Played games are shared between save copies, so drop the film by replacing the game.
  const drop = (g: GameResult) => (g.played && g.log && !g.featured ? { ...g, log: undefined } : g);
  save.schedule = save.schedule.map(drop);
  save.playoffGames = save.playoffGames.map(drop);
  const best = open
    .map((g) => ({ g, s: featuredScore(save, g) }))
    .sort((x, y) => y.s - x.s || x.g.id.localeCompare(y.g.id))[0]!.g;
  save.featuredGameId = best.id;
  best.featured = true;
}

/** The featured game of the slate just played, if the sandbox broadcast one. */
export function featuredOf(save: DynastySave, games: GameResult[]): GameResult | undefined {
  return save.sandbox ? games.find((g) => g.id === save.featuredGameId) : undefined;
}

/** The owner's club, or undefined in a sandbox where nobody's club is "yours". */
export function ownerClub(save: Pick<DynastySave, "sandbox" | "userTeamId">): TeamId | undefined {
  return save.sandbox ? undefined : save.userTeamId;
}
