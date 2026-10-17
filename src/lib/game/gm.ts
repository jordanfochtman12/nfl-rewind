/** Front-office mutations. Engine-only. UI calls these through the store desk. */
import type {
  CoachRole,
  DefScheme,
  DraftStyle,
  DynastySave,
  Gameplan,
  GmResult,
  OffScheme,
  Player,
  Pos,
  TeamId,
  TradePiece,
} from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { activeRosterOf, addToRoster, carryJersey, generatePlayer, leaguePlayer, movePlayer, playerName, rosterOf, syncDepth, DEPTH_CHART } from "./players.ts";
import { addNews, addTx } from "./news.ts";
import { salaryCapFor, salaryFor, teamPayroll } from "./salary.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { allPicks, transferPick, pickValue } from "./draft.ts";
import { fireCoach, hireCoach, setTeamScheme, schemeFitPos } from "./staff.ts";
import { rand, randInt } from "./rng.ts";
import { editsAgainst, staffPlan } from "./gameplans.ts";
import { planFor } from "./sim.ts";
import { visibleOvr } from "./scout.ts";
import { winPct } from "./standings.ts";
import { clubWindow, evaluateTrade, needFor, type ClubWindow } from "./tradeAi.ts";

const LAST_POS: Pos[] = ["QB", "K", "P"];

function fail(reason: string): GmResult {
  return { ok: false, reason };
}

function ok(): GmResult {
  return { ok: true };
}

function onClub(p: Player | undefined, teamId: TeamId): p is Player {
  return !!p && p.teamId === teamId;
}

export function freeAgents(save: DynastySave): Player[] {
  const onBoard = new Set(save.draftBoard.filter((pr) => !pr.taken).map((pr) => pr.playerId));
  return Object.values(save.players).filter(
    (p) => p.teamId === "fa" && !onBoard.has(p.id) && !save.waivers.some((w) => w.playerId === p.id),
  );
}

export function canAfford(save: DynastySave, teamId: TeamId, salary: number): boolean {
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap == null) return true;
  return teamPayroll(save, teamId) + salary <= cap;
}

export function cutPlayer(save: DynastySave, teamId: TeamId, playerId: string, opts?: { waive?: boolean }): GmResult {
  const p = save.players[playerId];
  if (!onClub(p, teamId)) return fail("That player is not on this roster.");
  const samePos = rosterOf(save, teamId).filter((x) => x.pos === p.pos && x.id !== p.id);
  if (LAST_POS.includes(p.pos) && samePos.length === 0) {
    return fail(`You cannot cut your last ${p.pos}.`);
  }
  const inSeason = save.phase === "regular" || save.phase === "playoffs";
  if (opts?.waive || inSeason) {
    movePlayer(save, p.id, "fa");
    save.waivers.push({ playerId: p.id, from: teamId, week: save.week, year: save.year });
    addTx(save, "waive", p.id, teamId, "waivers", `Waived ${playerName(p)}`);
    addNews(save, {
      kind: "transaction",
      headline: `${displayName(save.year, teamId)} waive ${playerName(p)}`,
      body: `${p.pos}, ${p.ovr} true / scout ${p.scoutOvr}.`,
      teamIds: [teamId],
      playerIds: [p.id],
    });
  } else {
    movePlayer(save, p.id, "fa");
    addTx(save, "cut", p.id, teamId, "fa", `Released ${playerName(p)}`);
    addNews(save, {
      kind: "transaction",
      headline: `${displayName(save.year, teamId)} release ${playerName(p)}`,
      body: `${p.pos} hits the street.`,
      teamIds: [teamId],
      playerIds: [p.id],
    });
  }
  syncDepth(save, teamId);
  save.teams[teamId].payroll = teamPayroll(save, teamId);
  return ok();
}

/**
 * Real NFL teams must be cap-compliant by a set date each offseason - nothing in this
 * engine was ever enforcing that. Signings and trades were cap-gated, but drafted
 * rookies added salary with no check at all, and once a roster drifted over the cap
 * nothing ever pulled it back. Must run as the LAST step of the offseason, after the
 * roster has already been topped back up to 45 - running it before that fill meant
 * the fill's replacement players (17+ new salaries in a thin-roster year) added back
 * more payroll than the cuts had just shed, so compliance never actually held.
 */
export function enforceCapCompliance(save: DynastySave): void {
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap == null) return;
  const lastYearIds = new Set(activeTeamIds(save.year - 1));
  for (const id of activeTeamIds(save.year)) {
    if (id === save.userTeamId && !save.cpuOnly) continue;
    if (!save.teams[id]) continue;
    // A team new to the league this year (expansion, or a franchise returning
    // from a relocation gap) gets real roster protection, same as it would in
    // real life - everyone else has had years to plan around the cap and can
    // be cut deep enough to actually reach compliance.
    const floor = lastYearIds.has(id) ? 0 : 40;
    let guard = 0;
    while (teamPayroll(save, id) > cap && guard++ < 60) {
      const roster = rosterOf(save, id);
      if (roster.length <= floor) break;
      const cuttable = roster.filter((p) => roster.filter((x) => x.pos === p.pos).length > 1);
      if (!cuttable.length) break;
      // Real teams almost never just release their starting QB for cap reasons -
      // they restructure the deal instead. A natural age-related ovr dip against
      // an unchanged multi-year salary makes a QB1 look like the biggest "surplus"
      // even when he's still clearly a team's best option, and without this he was
      // getting cut and backfilled with a fresh, mediocre generated replacement far
      // more often than a real front office would ever let happen.
      const qb1 = roster.filter((p) => p.pos === "QB").sort((a, b) => b.ovr - a.ovr)[0];
      const pool = qb1 ? cuttable.filter((p) => p.id !== qb1.id) : cuttable;
      const candidates = pool.length ? pool : cuttable;
      // ovr/salary alone picks the highest earner almost every time regardless of
      // whether he's actually good - salary swings by 100x across the roster while
      // ovr swings by maybe 2x, so it drowned out skill entirely and was gutting
      // franchise QBs and other properly-paid stars instead of bad contracts.
      // Cut whoever is furthest above what their ovr/age would actually cost at
      // market rate - the real "cap casualty" candidate, not just the best player.
      const worst = candidates.sort(
        (a, b) =>
          b.salary - salaryFor(save.year, b.ovr, b.age, b.pos) - (a.salary - salaryFor(save.year, a.ovr, a.age, a.pos)),
      )[0]!;
      cutPlayer(save, id, worst.id);
    }
  }
}

export function placeOnIR(save: DynastySave, teamId: TeamId, playerId: string): GmResult {
  const p = save.players[playerId];
  if (!onClub(p, teamId)) return fail("That player is not on this roster.");
  if (p.injuredWeeks <= 0) return fail("He is healthy — nothing to put on IR.");
  if (p.onIR) return fail("Already on IR.");
  p.onIR = true;
  addTx(save, "ir", p.id, teamId, teamId, `Placed ${playerName(p)} on injured reserve`);
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} place ${playerName(p)} on IR`,
    body: `${p.pos}, ${p.injuryName ?? "hurt"} · ${p.injuredWeeks}w. Opens a roster spot.`,
    teamIds: [teamId],
    playerIds: [p.id],
  });
  return ok();
}

/** 2012+: NFL/NFLPA first allowed a player to return from IR mid-season. Before that, IR was season-ending. */
export function canReturnFromIR(year: number): boolean {
  return year >= 2012;
}

export function activateFromIR(save: DynastySave, teamId: TeamId, playerId: string): GmResult {
  const p = save.players[playerId];
  if (!onClub(p, teamId)) return fail("That player is not on this roster.");
  if (!p.onIR) return fail("He is not on IR.");
  if (!canReturnFromIR(save.year)) return fail("IR is season-ending in this era — he's done for the year.");
  if (p.injuredWeeks > 0) return fail("Still hurt — not eligible to activate yet.");
  if (activeRosterOf(save, teamId).length >= ROSTER_TARGET + 8) {
    return fail("Roster's full. Cut someone before you activate him.");
  }
  p.onIR = false;
  addTx(save, "activate", p.id, teamId, teamId, `Activated ${playerName(p)} off IR`);
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} activate ${playerName(p)} off IR`,
    body: `${p.pos} is back on the 53.`,
    teamIds: [teamId],
    playerIds: [p.id],
  });
  return ok();
}

/** What a free agent asks before he signs: his salary at today's market, and a term by age. */
export function faAsk(save: DynastySave, p: Player): { salary: number; years: number } {
  return { salary: salaryFor(save.year, p.ovr, p.age, p.pos), years: p.age <= 26 ? 3 : p.age <= 30 ? 2 : 1 };
}

export function signPlayer(save: DynastySave, teamId: TeamId, playerId: string, years?: number): GmResult {
  const p = save.players[playerId];
  if (!p) return fail("No such player.");
  if (p.teamId !== "fa") return fail("He is already under contract.");
  if (save.waivers.some((w) => w.playerId === playerId)) {
    return fail("He is on waivers — claim him instead.");
  }
  if (activeRosterOf(save, teamId).length >= ROSTER_TARGET + 8) return fail("Roster is full.");
  const salary = salaryFor(save.year, p.ovr, p.age, p.pos);
  if (!canAfford(save, teamId, salary)) return fail("Over the cap.");
  if (save.year < 1994 && p.historical && p.yearsPro >= 4 && p.ovr >= 84) {
    // Rozelle-rule era: stars rarely move. User can still try; CPU almost never will.
  }
  p.salary = salary;
  p.contractYears = years ?? randInt(save, 1, 3);
  p.jersey = carryJersey(save, p, teamId);
  p.morale = Math.min(99, (p.morale ?? 70) + 6);
  addToRoster(save, teamId, p.id);
  syncDepth(save, teamId);
  save.teams[teamId].payroll = teamPayroll(save, teamId);
  addTx(save, "sign", p.id, "fa", teamId, `Signed ${playerName(p)}, ${p.contractYears} yr`);
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} sign ${playerName(p)}`,
    body: `${p.pos} · ${p.contractYears} year${p.contractYears === 1 ? "" : "s"} · camp body or veteran, depending who you asked.`,
    teamIds: [teamId],
    playerIds: [p.id],
  });
  return ok();
}

export function claimWaiver(save: DynastySave, teamId: TeamId, playerId: string): GmResult {
  const idx = save.waivers.findIndex((w) => w.playerId === playerId);
  if (idx < 0) return fail("He is not on the wire.");
  const p = save.players[playerId];
  if (!p || p.teamId !== "fa") return fail("Waiver expired.");
  const salary = salaryFor(save.year, p.ovr, p.age, p.pos);
  if (!canAfford(save, teamId, salary)) return fail("Over the cap.");
  const wire = save.waivers[idx]!;
  save.waivers.splice(idx, 1);
  p.salary = salary;
  p.contractYears = Math.max(1, p.contractYears || 1);
  p.jersey = carryJersey(save, p, teamId);
  addToRoster(save, teamId, p.id);
  syncDepth(save, teamId);
  save.teams[teamId].payroll = teamPayroll(save, teamId);
  addTx(save, "claim", p.id, wire.from, teamId, `Claimed ${playerName(p)} off waivers`);
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} claim ${playerName(p)}`,
    body: `Off waivers from ${displayName(save.year, wire.from)}.`,
    teamIds: [teamId, wire.from],
    playerIds: [p.id],
  });
  return ok();
}

export function processWaivers(save: DynastySave): void {
  if (!save.waivers.length) return;
  const order = save.waiverOrder.length ? save.waiverOrder : Object.keys(save.teams) as TeamId[];
  const leftover: typeof save.waivers = [];
  for (const w of save.waivers) {
    const p = save.players[w.playerId];
    if (!p || p.teamId !== "fa") continue;
    let claimed = false;
    for (const id of order) {
      if (id === w.from) continue;
      if (!save.teams[id]?.active) continue;
      const need = rosterOf(save, id).filter((x) => x.pos === p.pos);
      const best = need.sort((a, b) => b.ovr - a.ovr)[0];
      const want = !best || best.ovr < p.ovr - 2 || need.length < 2;
      if (!want) continue;
      if (id === save.userTeamId && !save.cpuOnly) continue;
      if (claimWaiver(save, id, p.id).ok) {
        claimed = true;
        break;
      }
    }
    if (!claimed) leftover.push(w);
  }
  save.waivers = leftover.filter((w) => w.week >= save.week - 1);
}

export function playerValue(p: Player): number {
  const o = visibleOvr(p);
  const ageTax = p.age >= 32 ? 0.72 : p.age <= 24 ? 1.08 : 1;
  const inj = p.injuredWeeks > 0 ? 0.7 : 1;
  return o * ageTax * inj + (p.potential - o) * 0.15;
}

export function tradeValue(save: DynastySave, piece: TradePiece): number {
  if (piece.playerId) {
    const p = save.players[piece.playerId];
    return p ? playerValue(p) : 0;
  }
  if (piece.pickId) return pickValue(save, piece.pickId);
  return 0;
}

/** Pre-1994: no true free agency, and clubs don't deal away proven stars. Real trades in this era are role players. */
export function rozelleLock(save: DynastySave, p: Player): boolean {
  return save.year < 1994 && p.historical && p.yearsPro >= 4 && p.ovr >= 84;
}

/** Deadline week closes the book on trades league-wide until the next league year opens. */
export function tradeWindowOpen(save: DynastySave): boolean {
  return !(save.deadline?.year === save.year && save.deadline.resolved);
}

function tradePlayers(save: DynastySave, pieces: TradePiece[]): Player[] {
  return pieces
    .filter((x) => x.playerId)
    .map((x) => save.players[x.playerId!])
    .filter((p): p is Player => !!p);
}

function fitsRosterAfterTrade(save: DynastySave, teamId: TeamId, outIds: string[], inCount: number): boolean {
  const current = activeRosterOf(save, teamId).length;
  return current - outIds.length + inCount <= ROSTER_TARGET + 8;
}

function fitsCapAfterTrade(save: DynastySave, teamId: TeamId, outgoing: Player[], incoming: Player[]): boolean {
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap == null) return true;
  const outSalary = outgoing.reduce((n, p) => n + (p.salary ?? 0), 0);
  const inSalary = incoming.reduce((n, p) => n + (p.salary ?? 0), 0);
  const newPayroll = teamPayroll(save, teamId) - outSalary + inSalary;
  return newPayroll <= cap;
}

export function executeTrade(
  save: DynastySave,
  sideA: TeamId,
  sideB: TeamId,
  give: TradePiece[],
  get: TradePiece[],
  opts?: { force?: boolean },
): GmResult {
  if (sideA === sideB) return fail("Cannot trade with yourself.");
  if (!give.length || !get.length) return fail("Both sides must send something.");
  if (!tradeWindowOpen(save)) return fail("The trade deadline has passed. No deals until next league year.");
  const givePlayers = tradePlayers(save, give);
  const getPlayers = tradePlayers(save, get);
  for (const p of [...givePlayers, ...getPlayers]) {
    if (rozelleLock(save, p)) {
      return fail(`${playerName(p)} is a Rozelle-rule era star — clubs don't move players like that.`);
    }
  }
  // The other club weighs the deal through its own needs, window, cap and contracts (see
  // tradeAi.ts). (This used to compare raw values the wrong way round: it turned down deals
  // the owner overpaid for and waved through a late pick for a star.)
  if (!opts?.force) {
    const verdict = evaluateTrade(save, sideB, give, get);
    if (!verdict.accept) return fail(verdict.reason);
  }
  if (!fitsRosterAfterTrade(save, sideA, givePlayers.map((p) => p.id), getPlayers.length)) {
    return fail(`${displayName(save.year, sideA)} would be over the 53-man limit. Cut someone first.`);
  }
  if (!fitsRosterAfterTrade(save, sideB, getPlayers.map((p) => p.id), givePlayers.length)) {
    return fail(`${displayName(save.year, sideB)} would be over the 53-man limit.`);
  }
  if (!fitsCapAfterTrade(save, sideA, givePlayers, getPlayers)) {
    return fail(`${displayName(save.year, sideA)} can't fit that under the cap.`);
  }
  if (!fitsCapAfterTrade(save, sideB, getPlayers, givePlayers)) {
    return fail(`${displayName(save.year, sideB)} can't fit that under the cap.`);
  }
  for (const piece of give) {
    const r = movePiece(save, sideA, sideB, piece);
    if (!r.ok) return r;
  }
  for (const piece of get) {
    const r = movePiece(save, sideB, sideA, piece);
    if (!r.ok) return r;
  }
  const names = [...give, ...get]
    .map((x) => (x.playerId ? playerName(save.players[x.playerId]!) : x.pickId))
    .filter(Boolean)
    .join(", ");
  addTx(save, "trade", give[0]?.playerId ?? get[0]?.playerId ?? "pick", sideA, sideB, `Trade: ${names}`);
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, sideA)} deal with ${displayName(save.year, sideB)}`,
    body: names,
    teamIds: [sideA, sideB],
    playerIds: [...give, ...get].map((x) => x.playerId).filter((id): id is string => !!id),
  });
  syncDepth(save, sideA);
  syncDepth(save, sideB);
  save.teams[sideA].payroll = teamPayroll(save, sideA);
  save.teams[sideB].payroll = teamPayroll(save, sideB);
  return ok();
}

function movePiece(save: DynastySave, from: TeamId, to: TeamId, piece: TradePiece): GmResult {
  if (piece.playerId) {
    const p = save.players[piece.playerId];
    if (!onClub(p, from)) return fail("A player in the deal is not on that roster.");
    p.jersey = carryJersey(save, p, to);
    p.morale = Math.max(35, (p.morale ?? 70) - 4);
    movePlayer(save, p.id, to);
    return ok();
  }
  if (piece.pickId) {
    if (!transferPick(save, piece.pickId, to)) return fail("That pick is not available.");
    return ok();
  }
  return fail("Empty trade piece.");
}

export function setDepthOrder(save: DynastySave, teamId: TeamId, pos: Pos, orderedIds: string[]): GmResult {
  const t = save.teams[teamId];
  if (!t) return fail("No club.");
  const roster = new Set(t.roster);
  t.depth = t.depth ?? {};
  t.depth[pos] = orderedIds.filter((id) => roster.has(id) && save.players[id]?.pos === pos);
  syncDepth(save, teamId);
  return ok();
}

export function moveDepth(save: DynastySave, teamId: TeamId, pos: Pos, playerId: string, dir: -1 | 1): GmResult {
  const t = save.teams[teamId];
  if (!t?.depth) syncDepth(save, teamId);
  const list = (save.teams[teamId].depth[pos] ?? []).slice();
  const i = list.indexOf(playerId);
  if (i < 0) return fail("Not on that depth chart.");
  const j = i + dir;
  if (j < 0 || j >= list.length) return ok();
  const tmp = list[i]!;
  list[i] = list[j]!;
  list[j] = tmp;
  return setDepthOrder(save, teamId, pos, list);
}

export function deskHire(save: DynastySave, teamId: TeamId, coachId: string, role: CoachRole): GmResult {
  return hireCoach(save, teamId, coachId, role);
}

export function deskFire(save: DynastySave, teamId: TeamId, role: CoachRole): GmResult {
  return fireCoach(save, teamId, role);
}

export function deskScheme(
  save: DynastySave,
  teamId: TeamId,
  patch: { offScheme?: OffScheme; defScheme?: DefScheme; draftStyle?: DraftStyle },
): GmResult {
  return setTeamScheme(save, teamId, patch);
}

export function deskPlan(save: DynastySave, teamId: TeamId, patch: Partial<Gameplan>): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  // Store only what differs from the staff's own call, so the rest keeps following the coaches.
  t.planEdits = editsAgainst(staffPlan(save, teamId), { ...t.planEdits, ...patch });
  t.plan = planFor(save, teamId);
  return { ok: true };
}

/** Hand the call sheet back to the coaching staff. */
export function deskResetPlan(save: DynastySave, teamId: TeamId): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  t.planEdits = {};
  t.plan = planFor(save, teamId);
  return { ok: true };
}

export function deskHoles(
  save: DynastySave,
  teamId: TeamId,
): { pos: Pos; need: number; have: number; healthy: number }[] {
  const roster = rosterOf(save, teamId);
  const out: { pos: Pos; need: number; have: number; healthy: number }[] = [];
  for (const [pos, need] of DEPTH_CHART) {
    const have = roster.filter((p) => p.pos === pos);
    const healthy = have.filter((p) => p.injuredWeeks <= 0 && !p.onIR);
    if (healthy.length < need || have.length < need) {
      out.push({ pos, need, have: have.length, healthy: healthy.length });
    }
  }
  return out;
}

/** Win% once there's a real sample; early in a season (or in the offseason) roster talent stands in for it. */
export function contendScore(save: DynastySave, teamId: TeamId): number {
  const t = save.teams[teamId];
  if (!t) return 0.5;
  const g = t.wins + t.losses + t.ties;
  if (g >= 3) return winPct(t);
  const roster = rosterOf(save, teamId);
  if (!roster.length) return 0.5;
  const avgOvr = roster.reduce((n, p) => n + p.ovr, 0) / roster.length;
  return Math.max(0, Math.min(1, (avgOvr - 60) / 25));
}

/**
 * A future pick a buyer parts with: day two (rounds 2-4) for a rental veteran, a first or
 * second for a star still in his prime.
 */
function tradeablePick(save: DynastySave, teamId: TeamId, rounds: [number, number] = [2, 4]): string | undefined {
  const picks = allPicks(save).filter(
    (p) => p.owner === teamId && !p.used && p.round >= rounds[0] && p.round <= rounds[1] && p.year > save.year,
  );
  picks.sort((a, b) => b.round - a.round || a.year - b.year);
  return picks[0]?.id;
}

/** A seller's young core: a rebuilding club keeps the men it is rebuilding around. */
function keeper(p: Player): boolean {
  return p.age <= 25 && p.potential >= p.ovr + 3;
}

/** The price of a man: a prime-age star costs a first or second, anyone else a day-two pick. */
function priceFor(save: DynastySave, buyer: TeamId, p: Player): string | undefined {
  if (p.ovr >= 82 && p.age <= 30) return tradeablePick(save, buyer, [1, 2]);
  return tradeablePick(save, buyer);
}

/** Contenders send picks for a proven vet at a real hole; rebuilders sell surplus vets for picks. Real deadline dynamics. */
function dealerTrade(save: DynastySave, ids: TeamId[]): boolean {
  const ranked = ids.map((id) => ({ id, score: contendScore(save, id) }));
  const buyers = ranked.filter((r) => r.score >= 0.58).map((r) => r.id);
  const sellers = ranked.filter((r) => r.score <= 0.42).map((r) => r.id);
  if (!buyers.length || !sellers.length) return false;
  const buyer = buyers[randInt(save, 0, buyers.length - 1)]!;
  const sellerPool = sellers.filter((id) => id !== buyer);
  if (!sellerPool.length) return false;
  const seller = sellerPool[randInt(save, 0, sellerPool.length - 1)]!;

  const holes = deskHoles(save, buyer).map((h) => h.pos);
  if (!holes.length) return false;
  // A seller moves its veterans first, and never the young men it is building around.
  const target = holes
    .flatMap((pos) =>
      rosterOf(save, seller).filter(
        (p) => p.pos === pos && p.injuredWeeks <= 0 && p.ovr >= 68 && !rozelleLock(save, p) && !keeper(p),
      ),
    )
    .sort((a, b) => b.ovr + (b.age >= 29 ? 6 : 0) - (a.ovr + (a.age >= 29 ? 6 : 0)))[0];
  if (!target) return false;
  // The seller keeps at least one body at that spot — this is a sale, not a fire sale.
  const remaining = rosterOf(save, seller).filter((p) => p.pos === target.pos && p.id !== target.id);
  if (!remaining.length) return false;

  const pickId = priceFor(save, buyer, target);
  if (!pickId) return false;
  return executeTrade(save, buyer, seller, [{ pickId }], [{ playerId: target.id }], { force: true }).ok;
}

/**
 * The winter market: a rebuilding club sells a veteran it won't be good again in time for to a
 * contender with a real hole at his spot, for a pick, before free agency opens. Real clubs
 * moved a dozen-odd veterans a year this way; the computer's never did, so a 3-14 club kept
 * its 31-year-old Pro Bowler until he retired.
 */
export function cpuOffseasonDeals(save: DynastySave): void {
  if (!tradeWindowOpen(save)) return;
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]?.active && (id !== save.userTeamId || save.cpuOnly));
  const by = (w: ClubWindow) => ids.filter((id) => clubWindow(save, id) === w);
  const sellers = by("rebuild");
  const buyers = by("contend");
  if (!sellers.length || !buyers.length) return;
  let deals = 0;
  const most = Math.max(1, Math.round(ids.length / 5));
  for (const seller of sellers) {
    if (deals >= most) break;
    if (rand(save) > 0.5) continue;
    const vets = rosterOf(save, seller)
      .filter((p) => p.age >= 29 && p.ovr >= 74 && p.injuredWeeks <= 0 && !rozelleLock(save, p))
      .sort((a, b) => b.ovr - a.ovr);
    for (const vet of vets) {
      // The contender he'd help most, at a starting spot.
      const buyer = buyers
        .map((id) => ({ id, need: needFor(save, id, vet) }))
        .filter((b) => b.need >= 1.05)
        .sort((a, b) => b.need - a.need)[0]?.id;
      if (!buyer) continue;
      const pickId = tradeablePick(save, buyer);
      if (pickId && executeTrade(save, buyer, seller, [{ pickId }], [{ playerId: vet.id }], { force: true }).ok) {
        deals += 1;
        break;
      }
    }
  }
}

export function cpuTrades(save: DynastySave): void {
  const teams = Object.values(save.teams).filter((t) => t.active && t.id !== save.userTeamId);
  if (teams.length < 2) return;
  if (rand(save) < 0.6 && dealerTrade(save, teams.map((t) => t.id))) return;
  const a = teams[randInt(save, 0, teams.length - 1)]!;
  let b = teams[randInt(save, 0, teams.length - 1)]!;
  if (a.id === b.id) b = teams.find((t) => t.id !== a.id) ?? b;
  const cheap = rosterOf(save, a.id)
    .filter((p) => p.ovr < 70 && p.age >= 28)
    .sort((x, y) => x.ovr - y.ovr)[0];
  const needPos = cheap?.pos;
  const target = needPos
    ? rosterOf(save, b.id)
        .filter((p) => p.pos === needPos && p.ovr >= (cheap?.ovr ?? 50) + 2 && p.ovr < 82)
        .sort((x, y) => x.ovr - y.ovr)[0]
    : undefined;
  if (!cheap || !target) return;
  const fit = schemeFitPos(target.pos, a.offScheme, a.defScheme);
  if (fit < 0 && rand(save) < 0.5) return;
  executeTrade(save, a.id, b.id, [{ playerId: cheap.id }], [{ playerId: target.id }], { force: true });
}

export function cpuManageRoster(save: DynastySave, teamId: TeamId): void {
  if (teamId === save.userTeamId && !save.cpuOnly) return;
  const t = save.teams[teamId];
  if (!t?.active) return;
  const roster = rosterOf(save, teamId);
  if (roster.length > ROSTER_TARGET) {
    const extras = roster
      .filter((p) => !LAST_POS.includes(p.pos) || roster.filter((x) => x.pos === p.pos).length > 1)
      .sort((a, b) => {
        const fitA = a.ovr + schemeFitPos(a.pos, t.offScheme, t.defScheme) - (a.age >= 30 ? 4 : 0);
        const fitB = b.ovr + schemeFitPos(b.pos, t.offScheme, t.defScheme) - (b.age >= 30 ? 4 : 0);
        return fitA - fitB;
      });
    const cutN = Math.min(roster.length - ROSTER_TARGET, extras.length);
    for (let i = 0; i < cutN; i++) {
      const p = extras[i];
      if (p) cutPlayer(save, teamId, p.id);
    }
  }
}

/** Healthy men a club needs at each spot to play a Sunday. */
const GAME_DAY: Partial<Record<Pos, number>> = {
  QB: 2, RB: 2, WR: 4, TE: 2, LT: 1, LG: 1, C: 1, RG: 1, RT: 1, DE: 2, DT: 2, OLB: 2, MLB: 1, CB: 3, S: 2, K: 1, P: 1,
};

/**
 * A computer club covers its injuries during the season, like a real one: a man out a month
 * or more goes on IR, and a spot without enough healthy bodies for Sunday gets a free agent
 * signed. Nobody did this, so a club whose backups got hurt played the year short: Carolina's
 * one healthy back carried 593 times in 1998.
 */
export function cpuCoverInjuries(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    if (id === save.userTeamId && !save.cpuOnly) continue;
    if (!save.teams[id]?.active) continue;
    // From 2012 a man can come back from IR: a healed one rejoins the active roster.
    if (canReturnFromIR(save.year)) for (const p of rosterOf(save, id)) if (p.onIR && p.injuredWeeks <= 0) p.onIR = false;
    // Before then IR ended a season, so only a long injury went on it.
    const irWeeks = canReturnFromIR(save.year) ? 4 : 8;
    let signed = 0;
    for (const [pos, need] of Object.entries(GAME_DAY) as [Pos, number][]) {
      if (signed >= 2) break;
      const group = rosterOf(save, id).filter((p) => p.pos === pos);
      const healthy = group.filter((p) => p.injuredWeeks <= 0 && !p.onIR).length;
      if (healthy >= need) continue;
      for (const p of group) if (p.injuredWeeks >= irWeeks && !p.onIR) placeOnIR(save, id, p.id);
      const pool = Object.values(save.players)
        .filter((p) => p.teamId === "fa" && p.pos === pos && p.injuredWeeks <= 0 && !save.waivers.some((w) => w.playerId === p.id))
        .sort((a, b) => Number(leaguePlayer(b)) - Number(leaguePlayer(a)) || b.ovr - a.ovr);
      let got = false;
      for (const p of pool.slice(0, 12)) {
        if (signPlayer(save, id, p.id, 1).ok) {
          got = true;
          break;
        }
      }
      if (!got && activeRosterOf(save, id).length < ROSTER_TARGET + 8) {
        const body = generatePlayer(save, pos, id, randInt(save, 50, 60));
        const cap = save.salaryCap ?? salaryCapFor(save.year);
        if (cap != null) body.salary = Math.min(body.salary, Math.round((cap * 0.0028) / 10_000) * 10_000);
        body.contractYears = 1;
        syncDepth(save, id);
        got = true;
      }
      if (got) signed += 1;
    }
  }
}

/**
 * The order clubs work the market in: worst record first, like the waiver wire, with a
 * fresh shuffle each year to break ties. (Going through the clubs in league order gave the
 * same few - Atlanta, the Rams, Pittsburgh, Philadelphia - first look at every real free
 * agent every winter, and they won a third of the Super Bowls between them.)
 */
export function marketOrder(save: DynastySave): TeamId[] {
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]);
  // A brand-new league's first market fills the opening rosters the era start built; the
  // order only matters once there's a record to go by.
  if (!ids.some((id) => save.teams[id]!.wins + save.teams[id]!.losses + save.teams[id]!.ties > 0)) return ids;
  const tie = (id: string) => {
    let h = 2166136261 ^ save.year;
    for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return (h >>> 0) / 4294967296;
  };
  return ids.sort((a, b) => winPct(save.teams[a]!) - winPct(save.teams[b]!) || tie(a) - tie(b));
}

/**
 * How a club's window bends its free-agent board: a rebuilder wants men who'll still be good
 * when it is, a contender will pay a proven veteran for one more run.
 */
function windowLean(win: ClubWindow, p: Player): number {
  if (win === "rebuild") return -Math.max(0, p.age - 27) * 1.5 + (p.age <= 25 ? 2 : 0);
  if (win === "contend") return p.age >= 29 && p.ovr >= 75 ? 1.5 : 0;
  return -Math.max(0, p.age - 30);
}

export function cpuSignNeeds(save: DynastySave): void {
  const pool = freeAgents(save).slice().sort((a, b) => b.ovr - a.ovr);
  for (const id of marketOrder(save)) {
    if (id === save.userTeamId && !save.cpuOnly) continue;
    const t = save.teams[id];
    const n = rosterOf(save, id).length;
    // A full 45-man roster still turns over real players every year (post-1994
    // expiring contracts alone can be a dozen-plus a team) - signing only 0-1
    // free agents most years left way more of that churn unaddressed than a real
    // front office would tolerate, especially at a position a team carries just
    // one of (like QB).
    const want = n < 44 ? 3 + (n < 40 ? 3 : 0) : rand(save) < 0.55 ? 2 : 1;
    let signed = 0;
    const win = clubWindow(save, id);
    const ranked = pool
      .map((p) => ({ p, s: p.ovr + schemeFitPos(p.pos, t.offScheme, t.defScheme) + windowLean(win, p) }))
      .sort((a, b) => b.s - a.s);
    for (const { p } of ranked) {
      if (signed >= want) break;
      if (p.teamId !== "fa") continue;
      const have = rosterOf(save, id).filter((x) => x.pos === p.pos);
      const best = have.sort((a, b) => b.ovr - a.ovr)[0];
      if (best && best.ovr >= p.ovr - 1 && have.length >= 2) continue;
      // A rebuilding club doesn't spend on a man past 30 unless it has nobody at all there.
      if (win === "rebuild" && p.age >= 31 && have.length > 0) continue;
      if (save.year < 1994 && p.ovr >= 84 && p.yearsPro >= 5 && rand(save) > 0.08) continue;
      if (signPlayer(save, id, p.id).ok) signed += 1;
    }
    cpuManageRoster(save, id);
  }
}
