/**
 * Draft-day trades. Picks are priced on a value chart (the No. 1 pick is worth about what
 * picks 8 and 9 together are, and value falls off fast through round one, like the charts
 * real war rooms use). The owner can trade up to a club's upcoming pick by sending later
 * picks (this draft's or next year's), and while the owner is on the clock, clubs further
 * down that covet someone on the board call with offers to move up. No React.
 */
import type { DraftPickAsset, DynastySave, TeamId } from "./types.ts";
import { allPicks, bestAvailable, draftQueue, transferPick } from "./draft.ts";
import { addNews, addTx } from "./news.ts";
import { displayName } from "./teams.ts";
import { playerName } from "./players.ts";
import { cheapestCover } from "./tradeAi.ts";

/**
 * The trade value chart Jimmy Johnson's Cowboys built in the early 1990s, which most clubs
 * have worked from since: No. 1 is 3,000 points, No. 32 is 590, No. 100 is 100.
 */
const CHART = [
  3000, 2600, 2200, 1800, 1700, 1600, 1500, 1400, 1350, 1300, 1250, 1200, 1150, 1100, 1050, 1000,
  950, 900, 875, 850, 800, 780, 760, 740, 720, 700, 680, 660, 640, 620, 600, 590,
  580, 560, 550, 540, 530, 520, 510, 500, 490, 480, 470, 460, 450, 440, 430, 420,
  410, 400, 390, 380, 370, 360, 350, 340, 330, 320, 310, 300, 292, 284, 276, 270,
  265, 260, 255, 250, 245, 240, 235, 230, 225, 220, 215, 210, 205, 200, 195, 190,
  185, 180, 175, 170, 165, 160, 155, 150, 145, 140, 136, 132, 128, 124, 120, 116,
  112, 108, 104, 100, 96, 92, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70,
  68, 66, 64, 62, 60, 58, 56, 54, 52, 50, 49, 48, 47, 46, 45, 44,
  43, 42, 41, 40,
];

/** Value of the nth pick of a draft (past the chart's table, it tapers to a point or two). */
export function slotValue(overall: number): number {
  const n = Math.max(1, Math.round(overall));
  if (n <= CHART.length) return CHART[n - 1]!;
  return Math.max(1, 40 - (n - CHART.length) * 0.42);
}

/** Where a pick of this draft sits (1-based), or undefined once it's used. */
function slotOf(save: DynastySave, pick: DraftPickAsset): number | undefined {
  const q = draftQueue(save);
  const i = q.findIndex((p) => p.id === pick.id);
  return i >= 0 && !pick.used ? i + 1 : undefined;
}

/** A pick's chart value: this draft's by its slot, a future one by the middle of its round, discounted. */
export function draftPickValue(save: DynastySave, pick: DraftPickAsset): number {
  if (pick.used) return 0;
  if (pick.year === save.year) {
    const slot = slotOf(save, pick);
    return slot ? slotValue(slot) : 0;
  }
  const teams = Math.max(1, draftQueue(save).length / Math.max(1, Math.max(...draftQueue(save).map((p) => p.round), 1)));
  const mid = (pick.round - 0.5) * teams;
  return slotValue(mid) * Math.pow(0.85, pick.year - save.year);
}

/** Clubs in this draft's session (the 1966 NFL and AFL drafts were separate). */
function sessionClubs(save: DynastySave): Set<TeamId> {
  return new Set(draftQueue(save).map((p) => p.orig));
}

export interface PickDeal {
  partner: TeamId;
  /** Picks the owner sends. */
  give: DraftPickAsset[];
  /** Picks the owner gets. */
  get: DraftPickAsset[];
  /** Chart value each way. */
  giveValue: number;
  getValue: number;
  pitch: string;
}

const label = (save: DynastySave, p: DraftPickAsset) => {
  const slot = p.year === save.year ? slotOf(save, p) : undefined;
  return slot ? `No. ${slot} (round ${p.round})` : `a ${p.year} round-${p.round} pick`;
};

/** The owner's tradeable picks: the rest of this draft and next year's. */
function ownerPicks(save: DynastySave): DraftPickAsset[] {
  return allPicks(save).filter((p) => p.owner === save.userTeamId && !p.used && p.year <= save.year + 1 && draftPickValue(save, p) > 0);
}

/** The set of picks (at most `maxPicks`) that covers `need` for the least chart value. */
function cover(save: DynastySave, pool: DraftPickAsset[], need: number, maxPicks = 3): DraftPickAsset[] | undefined {
  const v = (p: DraftPickAsset) => draftPickValue(save, p);
  return cheapestCover(pool, need, v, v, maxPicks);
}

/** What it costs the owner to move up to `pickId` (a club's upcoming pick in this draft). */
export function tradeUpPackage(save: DynastySave, pickId: string): PickDeal | { error: string } {
  const target = allPicks(save).find((p) => p.id === pickId);
  if (!target || target.used || target.year !== save.year) return { error: "That pick isn't on the board." };
  if (target.owner === save.userTeamId) return { error: "That pick is already yours." };
  if (!sessionClubs(save).has(target.owner)) return { error: "That club isn't in this draft." };
  const targetSlot = slotOf(save, target)!;
  if (targetSlot <= save.draftPickIndex) return { error: "That pick is already in." };
  // Moving up costs a premium over the chart; the club on the clock wants a little more.
  const premium = targetSlot === save.draftPickIndex + 1 ? 1.12 : 1.06;
  const need = draftPickValue(save, target) * premium;
  // Picks after the target only: you can't send a pick that comes before the one you're getting.
  const pool = ownerPicks(save).filter((p) => p.year > save.year || (slotOf(save, p) ?? 0) > targetSlot);
  const give = cover(save, pool, need);
  if (!give) return { error: "You don't have enough picks to get there." };
  return {
    partner: target.owner,
    give,
    get: [target],
    giveValue: give.reduce((n, p) => n + draftPickValue(save, p), 0),
    getValue: draftPickValue(save, target),
    pitch: `The ${displayName(save.year, target.owner)} will move ${label(save, target)} for ${give.map((p) => label(save, p)).join(" and ")}.`,
  };
}

/**
 * While the owner is on the clock: clubs within the next picks whose favourite prospect is
 * still on the board call to move up, sending their pick plus enough to match the chart.
 */
export function tradeDownOffers(save: DynastySave, max = 3): PickDeal[] {
  const q = draftQueue(save);
  const mine = q[save.draftPickIndex];
  if (!mine || mine.owner !== save.userTeamId) return [];
  const myValue = draftPickValue(save, mine);
  const offers: PickDeal[] = [];
  const seen = new Set<TeamId>([save.userTeamId]);
  for (let i = save.draftPickIndex + 1; i < Math.min(q.length, save.draftPickIndex + 16) && offers.length < max; i++) {
    const theirs = q[i]!;
    const club = theirs.owner;
    if (seen.has(club)) continue;
    seen.add(club);
    // Would they get their man at their own pick? If the player they'd take now is one of the
    // top few left, he likely won't last, so they call.
    const want = bestAvailable(save, club, mine.round);
    const open = save.draftBoard.filter((p) => !p.taken);
    const rank = want ? open.indexOf(want) : 99;
    if (rank < 0 || rank > 2 + Math.floor((i - save.draftPickIndex) / 3)) continue;
    // They pay a touch under the chart: the owner is selling.
    const need = myValue * 0.97 - draftPickValue(save, theirs);
    const extras = allPicks(save).filter((p) => p.owner === club && !p.used && p.id !== theirs.id && p.year <= save.year + 1 && draftPickValue(save, p) > 0);
    const add = need > 0 ? cover(save, extras, need, 3) : [];
    if (!add) continue;
    const get = [theirs, ...add];
    // A club won't overpay badly just because its spare picks come in big pieces.
    if (get.reduce((n, p) => n + draftPickValue(save, p), 0) > myValue * 1.25) continue;
    const wanted = want ? save.players[want.playerId] : undefined;
    offers.push({
      partner: club,
      give: [mine],
      get,
      giveValue: myValue,
      getValue: get.reduce((n, p) => n + draftPickValue(save, p), 0),
      pitch: `The ${displayName(save.year, club)} are calling${wanted ? ` (they're after ${playerName(wanted)})` : ""}: ${get.map((p) => label(save, p)).join(" and ")} for ${label(save, mine)}.`,
    });
  }
  return offers;
}

/** Swap the picks (still checking they're where the deal says). */
export function executePickDeal(save: DynastySave, deal: { partner: TeamId; give: string[]; get: string[] }): { ok: boolean; reason?: string } {
  const picks = allPicks(save);
  const give = deal.give.map((id) => picks.find((p) => p.id === id));
  const get = deal.get.map((id) => picks.find((p) => p.id === id));
  if (give.some((p) => !p || p.used || p.owner !== save.userTeamId)) return { ok: false, reason: "One of your picks in that deal is gone." };
  if (get.some((p) => !p || p.used || p.owner !== deal.partner)) return { ok: false, reason: "They no longer have that pick." };
  const words = { give: give.map((p) => label(save, p!)), get: get.map((p) => label(save, p!)) };
  for (const p of give) transferPick(save, p!.id, deal.partner);
  for (const p of get) transferPick(save, p!.id, save.userTeamId);
  const detail = `Draft trade with the ${displayName(save.year, deal.partner)}: sent ${words.give.join(", ")}; got ${words.get.join(", ")}.`;
  addTx(save, "trade", "pick", save.userTeamId, deal.partner, detail);
  addNews(save, {
    kind: "transaction",
    headline: `Draft-day deal: the ${displayName(save.year, save.userTeamId)} and ${displayName(save.year, deal.partner)} swap picks`,
    body: detail,
    teamIds: [save.userTeamId, deal.partner],
    playerIds: [],
  });
  return { ok: true };
}
