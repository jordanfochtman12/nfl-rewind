/**
 * The owner's calls during his live broadcast. The broadcast plays back a game that has
 * already been simulated, so a call rewinds to the save as it stood before the game, adds the
 * order, and plays the week again: the sim is deterministic, so every snap before the call
 * is the same one the owner already watched.
 */
import type { DynastySave, GameResult, Gameplan, LiveOrder } from "./types.ts";
import { cloneSave } from "./save.ts";

export function findGame(save: DynastySave, id: string): GameResult | undefined {
  if (save.superBowl?.id === id) return save.superBowl;
  return save.schedule.find((g) => g.id === id) ?? save.playoffGames.find((g) => g.id === id);
}

const mine = (save: DynastySave, g: GameResult) => !save.sandbox && (g.homeId === save.userTeamId || g.awayId === save.userTeamId);

/** The owner's game that this step played, if any (the one a call could rewind). */
export function ownerGameJustPlayed(prev: DynastySave, next: DynastySave): string | undefined {
  const games = [...next.schedule.filter((g) => g.year === next.year), ...next.playoffGames, ...(next.superBowl ? [next.superBowl] : [])];
  for (const g of games) {
    if (!g.played || !g.log?.length || !mine(next, g)) continue;
    const before = findGame(prev, g.id);
    if (before && !before.played) return g.id;
  }
  return undefined;
}

/** The owner's plan as of a given snap, from the orders already sent down. */
export function ordersUpTo(save: DynastySave, gameId: string, at: number): { plan: Partial<Gameplan>; benched: number } {
  let plan: Partial<Gameplan> = {};
  let benched = 0;
  for (const o of save.liveOrders ?? []) {
    if (o.gameId !== gameId || o.at > at) continue;
    if (o.kind === "plan" && o.plan) plan = { ...plan, ...o.plan };
    if (o.kind === "benchQb") benched += 1;
  }
  return { plan, benched };
}

/**
 * The base to replay from, with the new order in: orders and crunch-time answers from before
 * the call stand; anything after it is wiped, since the game from there is a new one.
 */
export function withOrder(pre: DynastySave, order: LiveOrder): DynastySave {
  const base = cloneSave(pre);
  base.liveOrders = [...(base.liveOrders ?? []).filter((o) => o.gameId === order.gameId && o.at < order.at), order];
  const c = base.crunch;
  if (c && c.gameId === order.gameId) {
    const at = c.at ?? [];
    const keep = c.choices.map((_, i) => i).filter((i) => (at[i] ?? Infinity) < order.at);
    c.choices = keep.map((i) => c.choices[i]!);
    c.at = keep.map((i) => at[i]!);
    c.situation = undefined;
  }
  return base;
}
