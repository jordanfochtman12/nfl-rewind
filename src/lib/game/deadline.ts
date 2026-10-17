/** Mid-season trade deadline. Engine-only. */
import type { DeadlineSession, DynastySave, Player, TeamId, TradeOffer, TradePiece } from "./types.ts";
import { activeTeamIds, displayName, gamesInSeason } from "./teams.ts";
import { playerName, rosterOf } from "./players.ts";
import { cpuTrades, executeTrade, playerValue, rozelleLock, tradeValue } from "./gm.ts";
import { evaluateTrade } from "./tradeAi.ts";
import { allPicks } from "./draft.ts";
import { randInt } from "./rng.ts";
import { addNews } from "./news.ts";
import { posLabel } from "./posLabel.ts";

export function deadlineWeek(year: number): number {
  const n = gamesInSeason(year);
  return Math.max(4, Math.round(n * 0.5));
}

function pieceName(save: DynastySave, piece: TradePiece): string {
  if (piece.playerId) {
    const p = save.players[piece.playerId];
    return p ? `${playerName(p)} (${posLabel(p)})` : "a player";
  }
  if (piece.pickId) {
    const pk = allPicks(save).find((x) => x.id === piece.pickId);
    return pk ? `${pk.year} R${pk.round}` : "a pick";
  }
  return "—";
}

export function offerLine(save: DynastySave, o: TradeOffer): string {
  const give = o.give.map((x) => pieceName(save, x)).join(", ");
  const get = o.get.map((x) => pieceName(save, x)).join(", ");
  return `${displayName(save.year, o.from)} send ${give} for ${get}`;
}

function extraAt(save: DynastySave, teamId: TeamId): Player[] {
  return rosterOf(save, teamId)
    .filter((p) => p.injuredWeeks <= 0 && p.pos !== "K" && p.pos !== "P" && !rozelleLock(save, p))
    .slice()
    .sort((a, b) => a.ovr - b.ovr);
}

function needFor(save: DynastySave, teamId: TeamId, pos: Player["pos"]): Player[] {
  return rosterOf(save, teamId)
    .filter((p) => p.pos === pos && p.injuredWeeks <= 0 && !rozelleLock(save, p))
    .sort((a, b) => b.ovr - a.ovr);
}

function shuffle<T>(save: DynastySave, arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(save, 0, i);
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

function futurePick(save: DynastySave, teamId: TeamId): string | undefined {
  const picks = allPicks(save).filter((p) => p.owner === teamId && !p.used && p.round >= 2 && p.round <= 4);
  picks.sort((a, b) => a.round - b.round || a.year - b.year);
  return picks[0]?.id;
}

export function tryOffer(save: DynastySave, from: TeamId, user: TeamId): TradeOffer | undefined {
  const their = extraAt(save, from).filter((p) => p.ovr >= 62 && p.ovr <= 84);
  const ours = extraAt(save, user).filter((p) => p.ovr >= 58 && p.ovr <= 86);
  if (!their.length || !ours.length) return undefined;
  const send = their[randInt(save, 0, Math.min(their.length, 6) - 1)]!;
  const wantPos = send.pos;
  const matches = ours.filter((p) => p.pos === wantPos || Math.abs(playerValue(p) - playerValue(send)) < 8);
  const want = matches[0] ?? ours[0];
  if (!want || want.id === send.id) return undefined;
  const give: TradePiece[] = [{ playerId: send.id }];
  const get: TradePiece[] = [{ playerId: want.id }];
  if (tradeValue(save, get[0]!) > tradeValue(save, give[0]!) * 1.15) {
    const pk = futurePick(save, from);
    if (pk) give.push({ pickId: pk });
  } else if (tradeValue(save, give[0]!) > tradeValue(save, get[0]!) * 1.15) {
    const pk = futurePick(save, user);
    if (pk) get.push({ pickId: pk });
  }
  const va = give.reduce((n, x) => n + tradeValue(save, x), 0);
  const vb = get.reduce((n, x) => n + tradeValue(save, x), 0);
  if (vb < va * 0.8 || va < vb * 0.8) return undefined;
  if (needFor(save, from, want.pos).length <= 1 && want.ovr >= 78) return undefined;
  // A club only calls with a deal it wants, through its own needs and window.
  if (!evaluateTrade(save, from, get, give).accept) return undefined;
  return {
    id: `off-${save.year}-${save.week}-${from}-${send.id}`,
    from,
    give,
    get,
    status: "open",
  };
}

export function openDeadline(save: DynastySave): DeadlineSession {
  if (save.deadline?.year === save.year && save.deadline.week === save.week && !save.deadline.resolved) {
    return save.deadline;
  }
  // The deadline's own offers replace whatever was still on hold.
  save.calls = [];
  const before = save.transactions.length;
  const rounds = 2 + randInt(save, 0, 2);
  for (let i = 0; i < rounds; i++) cpuTrades(save);
  const cpuMoves = save.transactions
    .slice(before)
    .filter((t) => t.kind === "trade")
    .map((t) => t.detail);
  const offers: TradeOffer[] = [];
  const clubs = activeTeamIds(save.year).filter((id) => id !== save.userTeamId);
  const shuffled = shuffle(save, clubs);
  for (const id of save.cpuOnly ? [] : shuffled) {
    if (offers.length >= 3) break;
    const o = tryOffer(save, id, save.userTeamId);
    if (!o) continue;
    if (offers.some((x) => x.from === o.from)) continue;
    const ids = new Set(
      [...o.give, ...o.get].flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    if (offers.some((x) => [...x.give, ...x.get].some((p) => p.playerId && ids.has(p.playerId)))) continue;
    offers.push(o);
  }
  const session: DeadlineSession = {
    year: save.year,
    week: save.week,
    offers,
    cpuMoves,
    resolved: false,
  };
  save.deadline = session;
  addNews(save, {
    kind: "headline",
    headline: save.year < 1994 ? `${save.year} trading week` : `${save.year} trade deadline`,
    body: save.sandbox
      ? cpuMoves.length
        ? `The phones are busy around the league. ${cpuMoves.length === 1 ? "One deal" : `${cpuMoves.length} deals`} so far.`
        : "The phones are quiet around the league. Nobody wants to blink first."
      : save.year < 1994
        ? "Rozelle-rule winter still hangs over stars. Role players move. The phone works if you pick it up."
        : "The window is a day. After this, the roster you have is the roster you take to January.",
    teamIds: save.sandbox ? [] : [save.userTeamId],
    playerIds: [],
  });
  return session;
}

export function acceptDeadlineOffer(save: DynastySave, offerId: string) {
  const session = save.deadline;
  if (!session || session.resolved) return { ok: false, reason: "The window is closed." };
  const o = session.offers.find((x) => x.id === offerId);
  if (!o || o.status !== "open") return { ok: false, reason: "That offer is gone." };
  const r = executeTrade(save, o.from, save.userTeamId, o.give, o.get, { force: true });
  if (!r.ok) return r;
  o.status = "accepted";
  return r;
}

export function declineDeadlineOffer(save: DynastySave, offerId: string) {
  const session = save.deadline;
  if (!session) return { ok: false, reason: "No deadline session." };
  const o = session.offers.find((x) => x.id === offerId);
  if (!o || o.status !== "open") return { ok: false, reason: "That offer is gone." };
  o.status = "declined";
  return { ok: true };
}

export function closeDeadline(save: DynastySave): void {
  if (save.deadline) save.deadline.resolved = true;
  save.phase = "regular";
  save.week += 1;
  save.weekFilm = false;
}
