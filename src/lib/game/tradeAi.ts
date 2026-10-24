/**
 * How a CPU club weighs a trade. Each club values players and picks through its own
 * situation: what it needs (a starter-level hole is worth paying for, a fourth tight end
 * isn't), where it is (contenders pay for proven players now, rebuilders want youth and
 * picks), its cap room, and the length of the contract. It accepts a deal only when it wins
 * it by a little, and says why when it won't. "What would it take" builds the smallest
 * package of the owner's assets the club would take for a player. No React.
 */
import type { DynastySave, Player, Pos, TeamId, TradePiece } from "./types.ts";
import { allPicks } from "./draft.ts";
import { playerName, rosterOf } from "./players.ts";
import { visibleOvr } from "./scout.ts";
import { salaryCapFor, teamPayroll } from "./salary.ts";
import { winPct } from "./standings.ts";

export type ClubWindow = "contend" | "middle" | "rebuild";

/** Roster strength is the prior; season results earn more influence as the sample grows. */
function strength(save: DynastySave, teamId: TeamId): number {
  const t = save.teams[teamId];
  if (!t) return 0.5;
  const top = rosterOf(save, teamId)
    .map((p) => p.ovr)
    .sort((a, b) => b - a)
    .slice(0, 24);
  const rosterStrength = top.length
    ? Math.max(0, Math.min(1, (top.reduce((n, v) => n + v, 0) / top.length - 64) / 18))
    : 0.5;
  const games = t.wins + t.losses + t.ties;
  if (!games) return rosterStrength;
  // Treat an average roster as an eight-game prior: a four-game hot/cold streak matters,
  // but cannot by itself turn an unproven club into a buyer or a proven roster into a seller.
  const resultWeight = games / (games + 8);
  return rosterStrength * (1 - resultWeight) + winPct(t) * resultWeight;
}

export function clubWindow(save: DynastySave, teamId: TeamId): ClubWindow {
  const s = strength(save, teamId);
  return s >= 0.6 ? "contend" : s <= 0.4 ? "rebuild" : "middle";
}

/** Starters a club plays at each spot, for judging whether a player fills a hole. */
const STARTERS: Partial<Record<Pos, number>> = {
  QB: 1, RB: 1, FB: 1, WR: 3, TE: 1, LT: 1, LG: 1, C: 1, RG: 1, RT: 1,
  DE: 2, DT: 2, OLB: 2, MLB: 1, CB: 2, S: 2, K: 1, P: 1,
};

/** 0.6 (wouldn't play) to 1.5 (fills a real hole at a starting spot). */
export function needFor(save: DynastySave, teamId: TeamId, p: Player): number {
  const n = STARTERS[p.pos] ?? 1;
  const mine = rosterOf(save, teamId)
    .filter((x) => x.pos === p.pos && x.id !== p.id && !x.onIR)
    .map((x) => visibleOvr(x))
    .sort((a, b) => b - a);
  const nthStarter = mine[n - 1] ?? 40;
  const ovr = visibleOvr(p);
  if (ovr <= nthStarter - 4) return 0.6;
  if (ovr <= nthStarter) return 0.85;
  return 1 + Math.min(0.5, (ovr - nthStarter) / 24);
}

/** How much a position moves the needle (a franchise QB most, a kicker least). */
const POS_WEIGHT: Partial<Record<Pos, number>> = { QB: 1.5, LT: 1.1, DE: 1.1, CB: 1.05, K: 0.25, P: 0.2, FB: 0.6 };

/** A player's worth on a convex scale, so one star outweighs a pile of depth. */
export function playerWorth(p: Player): number {
  const o = visibleOvr(p);
  const base = Math.pow(Math.max(0, o - 50) / 10, 2) * 8 * (POS_WEIGHT[p.pos] ?? 1);
  const age = p.age >= 33 ? 0.55 : p.age >= 30 ? 0.8 : p.age <= 24 ? 1.12 : 1;
  const upside = Math.max(0, (p.potential ?? o) - o) * 0.6;
  const hurt = p.onIR ? 0.6 : p.injuredWeeks > 0 ? 0.85 : 1;
  return (base + upside) * age * hurt;
}

/** A pick by round, on the same scale: a first is worth about a 79-80 player in his prime. */
export function pickWorth(save: DynastySave, pickId: string): number {
  const pk = allPicks(save).find((p) => p.id === pickId);
  if (!pk) return 0;
  const byRound = [0, 70, 34, 18, 10, 6, 4, 3, 2, 1.5, 1.2, 1, 0.8][pk.round] ?? 0.6;
  // A first from a bad club is worth more; next year's picks a little less (unknown slot).
  const orig = save.teams[pk.orig];
  const slot = pk.year === save.year && orig ? 1 + (0.5 - winPct(orig)) * 0.6 : 1;
  const later = pk.year > save.year ? Math.pow(0.88, pk.year - save.year) : 1;
  return byRound * slot * later;
}

/** What a piece is worth to this club, receiving it (or giving it up). */
export function clubValue(save: DynastySave, clubId: TeamId, piece: TradePiece, receiving: boolean): number {
  const w = clubWindow(save, clubId);
  if (piece.pickId) {
    const v = pickWorth(save, piece.pickId);
    return v * (w === "rebuild" ? 1.25 : w === "contend" ? 0.85 : 1);
  }
  const p = piece.playerId ? save.players[piece.playerId] : undefined;
  if (!p) return 0;
  let v = playerWorth(p);
  if (w === "contend") v *= p.age <= 30 ? 1.1 : 1;
  if (w === "rebuild") v *= p.age >= 29 ? 0.6 : p.age <= 25 ? 1.15 : 0.9;
  if (receiving) {
    v *= needFor(save, clubId, p);
    if ((p.contractYears ?? 1) <= 1 && w === "rebuild") v *= 0.7;
  } else {
    // A club values its own starters a bit above the market.
    v *= needFor(save, clubId, p) >= 1 ? 1.15 : 1;
  }
  return v;
}

export interface TradeVerdict {
  accept: boolean;
  /** What the club gets and gives, in its own eyes. */
  gets: number;
  gives: number;
  reason: string;
}

const MARGIN = 1.05;

/** Would this CPU club take the deal? */
export function evaluateTrade(save: DynastySave, clubId: TeamId, clubGets: TradePiece[], clubGives: TradePiece[]): TradeVerdict {
  const gets = clubGets.reduce((n, x) => n + clubValue(save, clubId, x, true), 0);
  const gives = clubGives.reduce((n, x) => n + clubValue(save, clubId, x, false), 0);
  const name = (x: TradePiece) => (x.playerId && save.players[x.playerId] ? playerName(save.players[x.playerId]!) : "");
  // Cap: a club won't take on salary it can't carry.
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap != null) {
    const inPay = clubGets.reduce((n, x) => n + (x.playerId ? save.players[x.playerId]?.salary ?? 0 : 0), 0);
    const outPay = clubGives.reduce((n, x) => n + (x.playerId ? save.players[x.playerId]?.salary ?? 0 : 0), 0);
    if (teamPayroll(save, clubId) + inPay - outPay > cap)
      return { accept: false, gets, gives, reason: "They can't fit that salary under the cap." };
  }
  if (gets >= gives * MARGIN) return { accept: true, gets, gives, reason: "They'll do it." };
  const w = clubWindow(save, clubId);
  const old = clubGets.filter((x) => x.playerId && (save.players[x.playerId]?.age ?? 0) >= 29);
  if (w === "rebuild" && old.length) return { accept: false, gets, gives, reason: `They're rebuilding. ${name(old[0]!)} doesn't help them; they want picks and young players.` };
  const extras = clubGets.filter((x) => x.playerId && needFor(save, clubId, save.players[x.playerId]!) < 0.9);
  if (extras.length && extras.length === clubGets.filter((x) => x.playerId).length)
    return { accept: false, gets, gives, reason: `They don't need ${name(extras[0]!)}; he wouldn't start for them.` };
  const short = Math.round((1 - gets / Math.max(1, gives * MARGIN)) * 100);
  return { accept: false, gets, gives, reason: short >= 50 ? "Not close. They hung up." : `Close, but not enough. They want about ${short}% more.` };
}

/** A player a club won't move: its best player, young, while it's contending (or its starting QB). */
export function untouchable(save: DynastySave, clubId: TeamId, p: Player): boolean {
  const roster = rosterOf(save, clubId);
  const best = roster.slice().sort((a, b) => visibleOvr(b) - visibleOvr(a))[0];
  if (best?.id === p.id && p.age <= 29 && clubWindow(save, clubId) !== "rebuild") return true;
  if (p.pos === "QB" && visibleOvr(p) >= 80 && p.age <= 31 && needFor(save, clubId, p) >= 1) return true;
  return false;
}

/**
 * The smallest package of the owner's assets this club would take for what's asked, or why
 * not. Picks and players who don't start for the owner go first; the owner's starting QB never.
 */
export function whatWouldItTake(
  save: DynastySave,
  clubId: TeamId,
  ask: TradePiece[],
): { pieces: TradePiece[]; reason: string } | { pieces: null; reason: string } {
  const user = save.userTeamId;
  for (const x of ask) {
    const p = x.playerId ? save.players[x.playerId] : undefined;
    if (p && untouchable(save, clubId, p)) return { pieces: null, reason: `${playerName(p)} isn't available. He's the heart of their club.` };
  }
  const target = ask.reduce((n, x) => n + clubValue(save, clubId, x, false), 0) * MARGIN;
  const mine = rosterOf(save, user).filter((p) => !(p.pos === "QB" && needFor(save, user, p) >= 1));
  const candidates: { piece: TradePiece; v: number; cost: number }[] = [
    ...allPicks(save)
      .filter((pk) => pk.owner === user && !pk.used && pk.year <= save.year + 2)
      .map((pk) => ({ piece: { pickId: pk.id }, v: clubValue(save, clubId, { pickId: pk.id }, true), cost: pickWorth(save, pk.id) })),
    ...mine.map((p) => ({
      piece: { playerId: p.id },
      v: clubValue(save, clubId, { playerId: p.id }, true),
      // What he's worth to the owner: a starter costs more to give up than he's worth to them.
      cost: playerWorth(p) * (needFor(save, user, p) >= 1 ? 1.4 : 0.8),
    })),
  ].filter((c) => c.v > 0.5);
  // The package that clears their price for the least it costs the owner.
  const chosen = cheapestCover(candidates, target, (c) => c.v, (c) => c.cost, 3);
  if (!chosen) return { pieces: null, reason: "You don't have enough they want for that." };
  const out = chosen.map((c) => c.piece);
  const verdict = evaluateTrade(save, clubId, out, ask);
  if (!verdict.accept) return { pieces: null, reason: verdict.reason };
  return { pieces: out, reason: "They'd take this." };
}

/**
 * The subset of up to `maxK` items (from the most valuable dozen) whose value reaches `need`
 * at the lowest cost, fewer items breaking ties. Small enough to search outright.
 */
export function cheapestCover<T>(items: T[], need: number, value: (t: T) => number, cost: (t: T) => number, maxK = 3): T[] | undefined {
  const pool = items.slice().sort((a, b) => value(b) - value(a)).slice(0, 14);
  let best: { set: T[]; cost: number } | undefined;
  const walk = (start: number, set: T[], v: number, c: number) => {
    if (v >= need) {
      if (!best || c < best.cost - 1e-9 || (Math.abs(c - best.cost) < 1e-9 && set.length < best.set.length)) best = { set: set.slice(), cost: c };
      return;
    }
    if (set.length >= maxK) return;
    for (let i = start; i < pool.length; i++) {
      const it = pool[i]!;
      set.push(it);
      walk(i + 1, set, v + value(it), c + cost(it));
      set.pop();
    }
  };
  walk(0, [], 0, 0);
  return best?.set;
}
