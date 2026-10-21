/**
 * A market with a pulse: CPU clubs call the owner with trades during the season, stars on the
 * street draw bidding wars the owner can win or lose, and the weeks before the deadline come
 * with a rumor mill.
 */
import type { DynastySave, FaBid, Player, Pos, Rumor, TeamId, TradeCall } from "./types.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { activeRosterOf, playerName, rosterOf } from "./players.ts";
import { canAfford, contendScore, executeTrade, freeAgents, rozelleLock, signPlayer, tradeWindowOpen } from "./gm.ts";
import { deadlineWeek, tryOffer } from "./deadline.ts";
import { rand, randInt } from "./rng.ts";
import { addNews } from "./news.ts";
import { salaryFor, teamPayroll } from "./salary.ts";
import { ROSTER_TARGET } from "./types.ts";
import { cpuHandles } from "./teamControl.ts";

const name = (save: DynastySave, id: TeamId) => displayName(save.year, id);
const recOf = (save: DynastySave, id: TeamId) => {
  const t = save.teams[id];
  return t ? `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}` : "";
};

/* ------------------------------------------------------------------ trade calls */

export function openCalls(save: DynastySave): TradeCall[] {
  return (save.calls ?? []).filter((c) => c.status === "open" && c.year === save.year);
}

function pitchFor(save: DynastySave, c: TradeCall): string {
  const from = c.from;
  const send = c.give.find((x) => x.playerId)?.playerId;
  const want = c.get.find((x) => x.playerId)?.playerId;
  const sp = send ? save.players[send] : undefined;
  const wp = want ? save.players[want] : undefined;
  const t = save.teams[from];
  const played = t ? t.wins + t.losses + t.ties : 0;
  // Buyer or seller only once there's a record to back it up.
  const score = played >= 3 ? contendScore(save, from) : 0.5;
  const club = name(save, from);
  if (!sp || !wp) return `The ${club} are on the line.`;
  if (score >= 0.6) {
    return `The ${club} are ${recOf(save, from)} and think this is their year. They want ${playerName(wp)} and they'll part with ${playerName(sp)} to get him.`;
  }
  if (score <= 0.4) {
    return `The ${club} (${recOf(save, from)}) are thinking about next year. ${playerName(sp)} is available, and they like ${playerName(wp)}'s upside.`;
  }
  if (sp.pos === wp.pos) return `The ${club} want to swap ${sp.pos}s: ${playerName(sp)} for ${playerName(wp)}. Their GM says it's a fit for both sides.`;
  return `The ${club} have depth at ${sp.pos} and a hole at ${wp.pos}. They're offering ${playerName(sp)} for ${playerName(wp)}.`;
}

/**
 * After each regular-season week: yesterday's calls go cold, and now and then a club rings with
 * a fresh one. Quiet once the deadline has passed.
 */
export function phoneRings(save: DynastySave): void {
  if (save.cpuOnly || save.phase !== "regular" || cpuHandles(save, save.userTeamId, "trades")) return;
  save.calls = (save.calls ?? []).filter((c) => c.year === save.year && c.status === "open" && c.week >= save.week);
  if (!tradeWindowOpen(save)) {
    save.calls = [];
    return;
  }
  const dw = deadlineWeek(save.year);
  if (save.week < 2 || save.week >= dw) return;
  if (save.calls.length >= 2 || rand(save) > 0.4) return;
  const clubs = activeTeamIds(save.year).filter((id) => id !== save.userTeamId && cpuHandles(save, id, "trades") && !save.calls!.some((c) => c.from === id));
  for (let tries = 0; tries < 4 && clubs.length; tries++) {
    const from = clubs.splice(randInt(save, 0, clubs.length - 1), 1)[0]!;
    const o = tryOffer(save, from, save.userTeamId);
    if (!o) continue;
    const busy = new Set(save.calls.flatMap((c) => [...c.give, ...c.get]).flatMap((p) => (p.playerId ? [p.playerId] : [])));
    if ([...o.give, ...o.get].some((p) => p.playerId && busy.has(p.playerId))) continue;
    const call: TradeCall = { ...o, id: `call-${save.year}-${save.week}-${from}`, year: save.year, week: save.week, pitch: "" };
    call.pitch = pitchFor(save, call);
    save.calls.push(call);
    addNews(save, {
      kind: "transaction",
      headline: `The ${name(save, from)} are on line one`,
      body: call.pitch,
      teamIds: [from, save.userTeamId],
      playerIds: [...o.give, ...o.get].flatMap((p) => (p.playerId ? [p.playerId] : [])),
    });
    return;
  }
}

export function acceptCall(save: DynastySave, callId: string): { ok: boolean; reason?: string } {
  const c = (save.calls ?? []).find((x) => x.id === callId);
  if (cpuHandles(save, save.userTeamId, "trades")) return { ok: false, reason: "The CPU front office is handling this club's trades." };
  if (!c || c.status !== "open") return { ok: false, reason: "That call went cold." };
  const r = executeTrade(save, c.from, save.userTeamId, c.give, c.get, { force: true });
  if (!r.ok) return r;
  c.status = "accepted";
  const moved = new Set([...c.give, ...c.get].flatMap((p) => (p.playerId ? [p.playerId] : [p.pickId ?? ""])));
  save.calls = (save.calls ?? []).filter(
    (x) => x.id === c.id || ![...x.give, ...x.get].some((p) => moved.has(p.playerId ?? p.pickId ?? "")),
  );
  return { ok: true };
}

export function declineCall(save: DynastySave, callId: string): void {
  const c = (save.calls ?? []).find((x) => x.id === callId);
  if (c && c.status === "open") c.status = "declined";
}

/* ------------------------------------------------------------------ bidding wars */

export const BID_TIERS = [
  { label: "Market", mult: 1 },
  { label: "Strong", mult: 1.15 },
  { label: "Blow him away", mult: 1.3 },
] as const;

/** A name on the street big enough that other clubs will fight for him. */
export function bidEligible(save: DynastySave, p: Player): boolean {
  return !save.cpuOnly && save.phase === "freeAgency" && !cpuHandles(save, save.userTeamId, "roster") && p.teamId === "fa" && p.ovr >= 76;
}

export function askingPrice(save: DynastySave, p: Player): number {
  return salaryFor(save.year, p.ovr, p.age, p.pos);
}

export function bidFor(save: DynastySave, playerId: string): FaBid | undefined {
  return (save.faBids ?? []).find((b) => b.playerId === playerId && b.year === save.year);
}

function bestAt(save: DynastySave, teamId: TeamId, pos: Pos): number {
  return Math.max(0, ...rosterOf(save, teamId).filter((x) => x.pos === pos).map((x) => x.ovr));
}

/** Why a player would pick a club: winning, and a clear path to start. */
function appeal(save: DynastySave, teamId: TeamId, p: Player): number {
  const t = save.teams[teamId];
  const g = t ? t.wins + t.losses + t.ties : 0;
  const pct = t && g ? (t.wins + t.ties * 0.5) / g : 0.5;
  const starts = bestAt(save, teamId, p.pos) < p.ovr;
  return pct * 14 + (starts ? 6 : -3);
}

function score(save: DynastySave, teamId: TeamId, tier: number, p: Player): number {
  return tier * 12 + appeal(save, teamId, p);
}

function pickRivals(save: DynastySave, p: Player): FaBid["rivals"] {
  const ask = askingPrice(save, p);
  const interested = activeTeamIds(save.year)
    .filter((id) => id !== save.userTeamId && cpuHandles(save, id, "roster") && save.teams[id])
    .filter((id) => bestAt(save, id, p.pos) < p.ovr - 1 && canAfford(save, id, ask))
    .filter((id) => activeRosterOf(save, id).length < ROSTER_TARGET + 8)
    .map((id) => ({ id, s: contendScore(save, id) * 10 + (p.ovr - bestAt(save, id, p.pos)) * 0.4 + rand(save) * 6 }))
    .sort((a, b) => b.s - a.s);
  const n = save.year < 1994 ? (rand(save) < 0.5 ? 1 : 0) : 1 + (p.ovr >= 82 ? 1 : 0) + (p.ovr >= 88 ? 1 : 0);
  return interested.slice(0, n).map(({ id }) => {
    const c = contendScore(save, id);
    const tier = rand(save) < 0.15 + c * 0.35 ? (rand(save) < 0.3 ? 2 : 1) : 0;
    return { teamId: id, tier };
  });
}

export type Leaning = { kind: "you" | "them" | "tossup"; teamId?: TeamId; why?: string };

/** What his agent says about the owner's pitch. */
function pitchNotes(save: DynastySave, p: Player): string {
  const u = save.userTeamId;
  const t = save.teams[u];
  const g = t ? t.wins + t.losses + t.ties : 0;
  const pct = t && g ? (t.wins + t.ties * 0.5) / g : 0.5;
  const bits: string[] = [];
  if (bestAt(save, u, p.pos) >= p.ovr) bits.push("he'd be a backup here");
  else bits.push("he'd start for you");
  if (g && pct <= 0.35) bits.push(`the ${t!.wins}-${t!.losses} record scares him`);
  else if (g && pct >= 0.65) bits.push("he wants a ring and you win");
  return bits.join("; ");
}

/** The honest read on where he's leaning - everything but the part nobody can know. */
export function leaning(save: DynastySave, b: FaBid): Leaning {
  const p = save.players[b.playerId];
  if (!p || !b.rivals.length) return { kind: "you" };
  const mine = score(save, save.userTeamId, b.tier, p);
  const top = b.rivals.map((r) => ({ r, s: score(save, r.teamId, r.tier, p) })).sort((a, b2) => b2.s - a.s)[0]!;
  const why = pitchNotes(save, p);
  if (mine - top.s > 8) return { kind: "you", why };
  if (top.s - mine > 8) return { kind: "them", teamId: top.r.teamId, why };
  return { kind: "tossup", teamId: top.r.teamId, why };
}

function signAt(save: DynastySave, teamId: TeamId, p: Player, salary: number, years: number): boolean {
  if (!canAfford(save, teamId, salary)) return false;
  const r = signPlayer(save, teamId, p.id, years);
  if (!r.ok) return false;
  p.salary = salary;
  save.teams[teamId].payroll = teamPayroll(save, teamId);
  return true;
}

/**
 * The owner makes (or raises) an offer. With nobody else in on him he signs on the spot;
 * otherwise it's a bidding war that he settles when he's ready, or when the market closes.
 */
export function placeBid(save: DynastySave, playerId: string, tier: number): string {
  const p = save.players[playerId];
  if (!p || p.teamId !== "fa") return "He's off the market.";
  const u = save.userTeamId;
  const salary = Math.round(askingPrice(save, p) * BID_TIERS[tier]!.mult);
  if (!canAfford(save, u, salary)) return "That offer doesn't fit under the cap.";
  if (activeRosterOf(save, u).length >= ROSTER_TARGET + 8) return "Roster is full.";
  let b = bidFor(save, playerId);
  if (b && b.status !== "open") return b.status === "won" ? "He's already yours." : "He already signed elsewhere.";
  if (b && tier <= b.tier) return "Raise the offer or let it ride.";
  if (!b) {
    const rivals = pickRivals(save, p);
    const years = p.age >= 31 ? randInt(save, 1, 2) : randInt(save, 2, 4);
    if (!rivals.length) {
      if (!signAt(save, u, p, salary, years)) return "The deal fell through.";
      return `Nobody else was in on ${playerName(p)}. He signs, ${years} year${years === 1 ? "" : "s"}.`;
    }
    b = { year: save.year, playerId, tier, salary, years, rivals, luck: [rand(save) * 18 - 9, ...rivals.map(() => rand(save) * 18 - 9)], status: "open" };
    save.faBids = (save.faBids ?? []).filter((x) => x.year === save.year).concat(b);
    addNews(save, {
      kind: "transaction",
      headline: `Bidding war for ${playerName(p)}`,
      body: `The ${name(save, u)} are in, and so are the ${b.rivals.map((r) => name(save, r.teamId)).join(" and the ")}.`,
      teamIds: [u, ...b.rivals.map((r) => r.teamId)],
      playerIds: [p.id],
    });
    return `Offer in. The ${b.rivals.map((r) => name(save, r.teamId)).join(" and the ")} are in on him too.`;
  }
  b.tier = tier;
  b.salary = salary;
  // A raise draws a response now and then.
  for (const r of b.rivals) if (r.tier < 2 && rand(save) < 0.2) r.tier += 1;
  return `Raised to ${BID_TIERS[tier]!.label.toLowerCase()}. His agent is taking it back to the other clubs.`;
}

/** He makes his call. */
export function resolveBid(save: DynastySave, playerId: string): string {
  const b = bidFor(save, playerId);
  const p = save.players[playerId];
  if (!b || b.status !== "open" || !p) return "No open offer.";
  const u = save.userTeamId;
  if (p.teamId !== "fa") {
    b.status = "lost";
    b.note = "He signed before he heard back.";
    return b.note;
  }
  const field = [
    { teamId: u, tier: b.tier, s: score(save, u, b.tier, p) + b.luck[0]! },
    ...b.rivals.map((r, i) => ({ teamId: r.teamId, tier: r.tier, s: score(save, r.teamId, r.tier, p) + (b.luck[i + 1] ?? 0) })),
  ].sort((a, c) => c.s - a.s);
  for (const f of field) {
    const salary = f.teamId === u ? b.salary : Math.round(askingPrice(save, p) * BID_TIERS[f.tier]!.mult);
    if (!signAt(save, f.teamId, p, salary, b.years)) continue;
    b.winner = f.teamId;
    b.status = f.teamId === u ? "won" : "lost";
    const others = field.filter((x) => x.teamId !== f.teamId).map((x) => name(save, x.teamId));
    b.note =
      f.teamId === u
        ? `${playerName(p)} picks the ${name(save, u)} over the ${others.join(" and the ")}.`
        : `${playerName(p)} signs with the ${name(save, f.teamId)}.${f.tier > b.tier ? " They outbid you." : " Same money, and he liked them better."}`;
    addNews(save, {
      kind: "headline",
      headline: f.teamId === u ? `${playerName(p)} chooses the ${name(save, u)}` : `${playerName(p)} spurns the ${name(save, u)}`,
      body: b.note,
      teamIds: field.map((x) => x.teamId),
      playerIds: [p.id],
    });
    return b.note;
  }
  b.status = "lost";
  b.note = `${playerName(p)} stays on the market. Nobody could make the numbers work.`;
  return b.note;
}

/** Closing the market: every open war gets its answer before the clubs fill out their camps. */
export function resolveAllBids(save: DynastySave): void {
  for (const b of save.faBids ?? []) if (b.status === "open" && b.year === save.year) resolveBid(save, b.playerId);
}

/** The biggest names still out there, for the owner's board. */
export function hotFreeAgents(save: DynastySave): Player[] {
  return freeAgents(save).filter((p) => p.ovr >= 76);
}

/* ------------------------------------------------------------------ rumor mill */

const NEED_POS: Pos[] = ["QB", "RB", "WR", "TE", "LT", "DE", "DT", "OLB", "MLB", "CB", "S"];

function holeOf(save: DynastySave, teamId: TeamId): Pos | undefined {
  const roster = rosterOf(save, teamId);
  if (!roster.length) return undefined;
  let worst: { pos: Pos; gap: number } | undefined;
  for (const pos of NEED_POS) {
    const best = Math.max(0, ...roster.filter((p) => p.pos === pos && p.injuredWeeks <= 0).map((p) => p.ovr));
    const league = 74;
    const gap = league - best;
    if (!worst || gap > worst.gap) worst = { pos, gap };
  }
  return worst && worst.gap > 0 ? worst.pos : undefined;
}

/** The two weeks before the deadline, and deadline week: who's buying, who's selling. */
export function rumorMill(save: DynastySave): Rumor[] | undefined {
  if (save.phase !== "regular" || !tradeWindowOpen(save)) return undefined;
  const dw = deadlineWeek(save.year);
  if (save.week < dw - 2 || save.week > dw) return undefined;
  const u = save.userTeamId;
  const ids = activeTeamIds(save.year).filter((id) => id !== u && save.teams[id]);
  const ranked = ids.map((id) => ({ id, s: contendScore(save, id) }));
  const sellers = ranked.filter((r) => r.s <= 0.4).sort((a, b) => a.s - b.s);
  const buyers = ranked.filter((r) => r.s >= 0.6).sort((a, b) => b.s - a.s);
  const sell: Rumor[] = [];
  const buy: Rumor[] = [];
  const mood: Rumor[] = [];
  const you: Rumor[] = [];
  for (const s of sellers) {
    if (sell.length >= 2) break;
    const vet = rosterOf(save, s.id)
      .filter((p) => p.age >= 28 && p.ovr >= 76 && p.pos !== "K" && p.pos !== "P" && !rozelleLock(save, p))
      .sort((a, b) => b.ovr - a.ovr)[0];
    if (vet) {
      sell.push({
        text: `Sources: the ${name(save, s.id)} (${recOf(save, s.id)}) are taking calls on ${playerName(vet)}. The ${vet.pos} is ${vet.age}, and their window has closed.`,
        teamIds: [s.id],
        playerId: vet.id,
      });
    }
  }
  for (const b of buyers) {
    if (buy.length >= 2) break;
    const pos = holeOf(save, b.id);
    if (!pos) continue;
    buy.push({ text: `The ${name(save, b.id)} are ${recOf(save, b.id)} and hunting for a ${pos}. They'll move a pick for the right one.`, teamIds: [b.id] });
    const mine = rosterOf(save, u)
      .filter((p) => p.pos === pos && !rozelleLock(save, p))
      .sort((a, b2) => b2.ovr - a.ovr);
    const spare = mine[1];
    if (spare && spare.ovr >= Math.max(0, ...rosterOf(save, b.id).filter((p) => p.pos === pos).map((p) => p.ovr)) && you.length < 1) {
      you.push({ text: `Word is the ${name(save, b.id)} like your backup ${pos}, ${playerName(spare)}.`, teamIds: [b.id, u], playerId: spare.id });
    }
  }
  const unhappy = Object.values(save.players)
    .filter((p) => p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" && p.teamId !== u)
    .filter((p) => p.ovr >= 74 && ((p.morale ?? 70) < 40 || p.holdout))
    .sort((a, b) => b.ovr - a.ovr);
  for (const p of unhappy.slice(0, 1)) {
    mood.push({
      text: `${playerName(p)} wants out of ${name(save, p.teamId as TeamId).startsWith("the ") ? "" : "the "}${name(save, p.teamId as TeamId)}. His camp isn't hiding it.`,
      teamIds: [p.teamId as TeamId],
      playerId: p.id,
    });
  }
  for (const c of openCalls(save).slice(0, 1)) {
    you.push({ text: `The ${name(save, c.from)} have already been on the phone with the ${name(save, u)}.`, teamIds: [c.from, u] });
  }
  if (contendScore(save, u) <= 0.35) {
    you.push({ text: `Around the league, clubs are watching to see whether the ${name(save, u)} sell.`, teamIds: [u] });
  }
  const out: Rumor[] = [];
  for (let i = 0; out.length < 6 && i < 3; i++) {
    for (const list of [sell, buy, you, mood]) if (list[i] && out.length < 6) out.push(list[i]!);
  }
  if (save.week === dw) out.unshift({ text: "The window closes after this week. Every call from here is the last call.", teamIds: [] });
  return out.length ? out : undefined;
}
