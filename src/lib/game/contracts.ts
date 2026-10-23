/**
 * Contract talks. When the owner's players reach the end of their deals, their agents come
 * to the table with a number; the owner offers, they accept, counter or walk. The deadline is
 * the opening of free agency. Before 1994 a player without a deal plays out his option; from
 * 1994 he hits the open market, and the franchise tag keeps one of them for a year.
 */
import type { DynastySave, Negotiation, Player, RfaOfferSheet, RfaTender, RfaTenderLevel, TeamId } from "./types.ts";
import { salaryCapFor, salaryFor, teamPayroll, formatMoney } from "./salary.ts";
import { activeRosterOf, carryJersey, movePlayer, playerName, syncDepth } from "./players.ts";
import { addNews, addTx } from "./news.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { allPicks, transferPick } from "./draft.ts";
import { rand } from "./rng.ts";
import { cpuHandles } from "./teamControl.ts";
import { ROSTER_TARGET } from "./types.ts";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** A stable 0-1 number for this player this year, so talks can't be re-rolled. */
const noise = (key: string) => (hash(key) % 10000) / 10000;

const roundPay = (year: number, n: number) => {
  const step = year <= 1969 ? 500 : year <= 1988 ? 1000 : 10_000;
  return Math.max(step, Math.round(n / step) * step);
};

/**
 * Accrued NFL seasons are service years, not starts or games played. The simulator does not
 * retain weekly active-list history, so use distinct player-seasons with six or more games when
 * available and yearsPro only for players whose career ledger is still empty.
 */
export function accruedSeasonsFor(p: Player): number {
  return serviceGamesByYear(p).filter((games) => games >= 6).length;
}

/** Credited service uses three full-pay games, separately from the six-game accrued-season test. */
export function creditedSeasonsFor(p: Player): number {
  return serviceGamesByYear(p).filter((games) => games >= 3).length;
}

function serviceGamesByYear(p: Player): number[] {
  const seasons = new Map<number, number>();
  for (const line of [...Object.values(p.stats ?? {}), ...(p.career ?? [])]) {
    seasons.set(line.year, Math.max(seasons.get(line.year) ?? 0, line.gp ?? 0));
  }
  for (const [year, service] of Object.entries(p.serviceByYear ?? {})) {
    seasons.set(Number(year), Math.max(0, service.fullPayGames ?? 0));
  }
  return seasons.size ? [...seasons.values()] : Array(Math.max(0, p.yearsPro ?? 0)).fill(6);
}

/** Count full-pay game weeks on the active club roster, not just games the player appeared in. */
export function recordServiceGameWeek(save: DynastySave, teamIds: readonly TeamId[]): void {
  if (save.realHistory || save.phase !== "regular") return;
  for (const teamId of new Set(teamIds)) {
    const team = save.teams[teamId];
    if (!team) continue;
    for (const playerId of team.roster) {
      const p = save.players[playerId];
      if (!p || p.teamId !== teamId || p.holdout) continue;
      // Injured-reserve players remain on a club's books and in full-pay status in this model.
      const years = (p.serviceByYear ??= {});
      const entry = (years[save.year] ??= { fullPayGames: 0, weeks: [] });
      if (entry.weeks.includes(save.week)) continue;
      entry.weeks.push(save.week);
      entry.fullPayGames += 1;
    }
  }
}

/** Cap-era ERFA status: fewer than three accrued seasons and an expiring contract. */
export function isExclusiveRightsFreeAgent(save: Pick<DynastySave, "year">, p: Player): boolean {
  return save.year >= 1994 && accruedSeasonsFor(p) < 3;
}

const ERFA_2026_MINIMUMS = [885_000, 1_005_000, 1_075_000, 1_145_000, 1_215_000, 1_215_000, 1_215_000, 1_300_000];

/** League minimum by credited service, scaled to historical cap-era dollars. */
export function erfaMinimumSalary(year: number, creditedSeasons: number): number {
  const cap = salaryCapFor(year);
  const currentCap = salaryCapFor(2026);
  if (year < 1994 || cap == null || currentCap == null) return 0;
  const service = Math.max(0, Math.floor(creditedSeasons));
  const current = ERFA_2026_MINIMUMS[Math.min(service, 7)]!;
  return Math.max(1_000, Math.round((current * cap / currentCap) / 1_000) * 1_000);
}

/** In capped league years, three accrued seasons make an RFA; 2010's uncapped CBA year is 3–5. */
export function isRestrictedFreeAgent(save: Pick<DynastySave, "year">, p: Player): boolean {
  if (save.year < 1994) return false;
  const accrued = accruedSeasonsFor(p);
  return save.year === 2010 ? accrued >= 3 && accrued <= 5 : accrued === 3;
}

/**
 * The right-of-first-refusal tender, scaled from the current CBA amount to the game's annual cap.
 * It is a one-year qualifying offer; historical cap years get the era's dollar scale.
 */
/** 2026 NFL Operations tender schedule; past modeled years scale by their salary-cap ratio.
 * Source: https://operations.nfl.com/calendar-events/nfl-free-agency/types-of-free-agents
 */
const RFA_2026_TENDERS: Record<RfaTenderLevel, number> = {
  first: 8_107_000,
  second: 5_811_000,
  original: 3_674_000,
  rofr: 3_547_000,
};

export function rfaCompensationRound(level: RfaTenderLevel, p: Pick<Player, "draftRound">): number | undefined {
  if (level === "first") return 1;
  if (level === "second") return 2;
  if (level === "original" && p.draftRound && p.draftRound >= 1 && p.draftRound <= 7) return p.draftRound;
  return undefined;
}

export function rfaTenderPrice(year: number, level: RfaTenderLevel = "rofr", p?: Player): number {
  const cap = salaryCapFor(year);
  const currentCap = salaryCapFor(2026);
  if (year < 1994 || cap == null || currentCap == null) return 0;
  const scaled = (RFA_2026_TENDERS[level] * cap) / currentCap;
  const priorSalaryFloor = level === "rofr" ? 0 : (p?.salary ?? 0) * 1.1;
  return Math.max(1_000, Math.round(Math.max(scaled, priorSalaryFloor) / 1_000) * 1_000);
}

function applyRfaTender(save: DynastySave, p: Player, level: RfaTenderLevel, salary: number, talk?: Negotiation): void {
  p.salary = salary;
  p.contractYears = 1;
  const tender: RfaTender = {
    year: save.year,
    playerId: p.id,
    teamId: p.teamId as TeamId,
    level,
    salary,
    compensationRound: rfaCompensationRound(level, p),
  };
  save.rfaTenders = (save.rfaTenders ?? []).filter((x) => x.year !== save.year || x.playerId !== p.id).concat(tender);
  const team = save.teams[p.teamId as TeamId];
  if (team) team.payroll = teamPayroll(save, team.id);
  if (talk) {
    talk.status = "tendered";
    talk.rfaTender = { level, salary };
    const comp = tender.compensationRound ? ` and a ${tender.compensationRound}${tender.compensationRound === 1 ? "st" : tender.compensationRound === 2 ? "nd" : tender.compensationRound === 3 ? "rd" : "th"}-round pick` : " with no draft compensation";
    talk.result = `One-year qualifying offer at ${formatMoney(salary, save.year)}; right of first refusal${comp}.`;
  }
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, p.teamId as TeamId)} tenders ${playerName(p)}`,
    body: `One-year ${level === "rofr" ? "right-of-first-refusal" : `${level}-round qualifying`} tender: ${formatMoney(salary, save.year)}${tender.compensationRound ? ` with round ${tender.compensationRound} compensation` : " with no draft compensation"}.`,
    teamIds: [p.teamId as TeamId],
    playerIds: [p.id],
  });
}

/** Owner decision: make the cap-era qualifying tender instead of a multi-year deal or release. */
export function tenderRfa(save: DynastySave, playerId: string, level: RfaTenderLevel = "rofr"): string {
  const talk = talksFor(save, playerId);
  const p = save.players[playerId];
  if (!talk || !p || !isRestrictedFreeAgent(save, p)) return "He does not qualify for a restricted free-agent tender.";
  if (talk.status !== "open" && talk.status !== "walked") return "Those contract talks are over.";
  if (p.teamId !== save.userTeamId) return "He is no longer on your roster.";
  const price = rfaTenderPrice(save.year, level, p);
  if (!price) return "Restricted tenders are not available before the cap era.";
  if (!fitsCap(save, p, price)) return "The tender does not fit under the cap.";
  applyRfaTender(save, p, level, price, talk);
  return talk.result!;
}

/** CPU clubs use the qualifying offer when they decide a three-year veteran is worth retaining. */
export function cpuTenderRfa(save: DynastySave, p: Player): boolean {
  if (!isRestrictedFreeAgent(save, p)) return false;
  const level: RfaTenderLevel = p.ovr >= 84 ? "first" : p.ovr >= 77 ? "second" : p.draftRound ? "original" : "rofr";
  const price = rfaTenderPrice(save.year, level, p);
  if (!price) return false;
  applyRfaTender(save, p, level, price);
  return true;
}

function applyErfaTender(save: DynastySave, p: Player, salary: number, talk?: Negotiation): void {
  const creditedSeasons = creditedSeasonsFor(p);
  p.salary = salary;
  p.contractYears = 1;
  const tender = { year: save.year, playerId: p.id, teamId: p.teamId as TeamId, salary, creditedSeasons };
  save.erfaTenders = (save.erfaTenders ?? []).filter((item) => item.year !== save.year || item.playerId !== p.id).concat(tender);
  const team = save.teams[p.teamId as TeamId];
  if (team) team.payroll = teamPayroll(save, team.id);
  if (talk) {
    talk.status = "tendered";
    talk.erfaTender = { salary, creditedSeasons };
    talk.result = `One-year exclusive-rights tender at the ${formatMoney(salary, save.year)} league minimum; only your club may negotiate.`;
  }
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, p.teamId as TeamId)} tender ${playerName(p)} as an exclusive-rights free agent`,
    body: `One-year contract at the ${formatMoney(salary, save.year)} minimum. Because he has fewer than three accrued seasons, he cannot negotiate with another club.`,
    teamIds: [p.teamId as TeamId],
    playerIds: [p.id],
  });
}

export function tenderErfa(save: DynastySave, playerId: string): string {
  const talk = talksFor(save, playerId);
  const p = save.players[playerId];
  if (!talk || !p || !isExclusiveRightsFreeAgent(save, p)) return "He does not qualify for an exclusive-rights tender.";
  if (talk.status !== "open" && talk.status !== "walked") return "Those contract talks are over.";
  if (p.teamId !== save.userTeamId) return "He is no longer on your roster.";
  const salary = erfaMinimumSalary(save.year, creditedSeasonsFor(p));
  if (!salary) return "Exclusive-rights tenders are not available before the cap era.";
  if (!fitsCap(save, p, salary)) return "The tender does not fit under the cap.";
  applyErfaTender(save, p, salary, talk);
  return talk.result!;
}

export function cpuTenderErfa(save: DynastySave, p: Player): boolean {
  if (!isExclusiveRightsFreeAgent(save, p)) return false;
  const salary = erfaMinimumSalary(save.year, creditedSeasonsFor(p));
  if (!salary) return false;
  const teamId = p.teamId as TeamId;
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap != null && teamPayroll(save, teamId) - (p.salary ?? 0) + salary > cap) return false;
  applyErfaTender(save, p, salary);
  return true;
}

export function pendingRfaOfferSheets(save: DynastySave): RfaOfferSheet[] {
  return (save.rfaOfferSheets ?? []).filter((offer) => offer.year === save.year && offer.status === "pending");
}

/** Generate outside challenges for tendered players across CPU-controlled clubs. */
export function openRfaOfferSheets(save: DynastySave, auto = false): RfaOfferSheet[] {
  if (save.realHistory || save.phase !== "freeAgency") return [];
  save.rfaTenders = (save.rfaTenders ?? []).filter((tender) => tender.year === save.year);
  save.erfaTenders = (save.erfaTenders ?? []).filter((tender) => tender.year === save.year);
  save.rfaOfferSheets = (save.rfaOfferSheets ?? []).filter((offer) => offer.year >= save.year - 2);
  const opened: RfaOfferSheet[] = [];
  for (const tender of save.rfaTenders) {
    const p = save.players[tender.playerId];
    if (!p || p.teamId !== tender.teamId || pendingRfaOfferSheets(save).some((offer) => offer.playerId === p.id)) continue;
    const need = activeTeamIds(save.year)
      .filter((id) => id !== tender.teamId && cpuHandles(save, id, "roster"))
      .map((id) => {
        const team = save.teams[id]!;
        const best = Math.max(0, ...rosterOfTeam(save, id).filter((player) => player.pos === p.pos).map((player) => player.ovr));
        const gap = p.ovr - best;
        const offerSalary = Math.max(roundPay(save.year, tender.salary * 1.12), roundPay(save.year, salaryFor(save.year, p.ovr, p.age, p.pos) * 1.1));
        const cap = save.salaryCap ?? salaryCapFor(save.year);
        const pick = tender.compensationRound
          ? allPicks(save).find((asset) => asset.owner === id && asset.year === save.year + 1 && asset.round === tender.compensationRound && !asset.used)
          : undefined;
        const hasCompensation = !tender.compensationRound || !!pick;
        const reserved = pendingRfaOfferSheets(save).filter((offer) => offer.offerTeam === id);
        const reservedSalary = reserved.reduce((total, offer) => total + offer.salary, 0);
        const reservedPicks = new Set(reserved.map((offer) => offer.compensationPickId).filter(Boolean));
        const canPay = cap == null || teamPayroll(save, id) + reservedSalary + offerSalary <= cap;
        const hasRoom = activeRosterOf(save, id).length + reserved.length < ROSTER_TARGET + 8;
        const hasUnreservedPick = !tender.compensationRound || (!!pick && !reservedPicks.has(pick.id));
        // Outside clubs should need a clear starter-level upgrade before spending a pick and
        // cap room on a restricted free agent. A high-grade player can still draw interest at
        // a smaller gap, while the required compensation makes first-round challenges rarer.
        const compensationCost = tender.compensationRound === 1 ? 0.035
          : tender.compensationRound === 2 ? 0.02
            : tender.compensationRound ? 0.012 : 0;
        const playerPremium = p.ovr >= 90 ? 0.03 : p.ovr >= 84 ? 0.015 : 0;
        const gapInterest = Math.min(20, Math.max(0, gap - 2)) * 0.006;
        const interest = Math.max(0, Math.min(0.16, 0.015 + gapInterest + playerPremium - compensationCost));
        return { id, gap, offerSalary, pick, hasCompensation: hasCompensation && hasUnreservedPick, canPay, hasRoom, interest, score: gap + team.wins * 0.1 };
      })
      .filter((item) => (item.gap >= 5 || (p.ovr >= 88 && item.gap >= 3)) && item.interest > 0 && item.hasCompensation && item.canPay && item.hasRoom)
      .sort((a, b) => b.score - a.score);
    // Make one league-wide challenge decision for the best fit. Rolling separately for every
    // eligible rival compounds individually rare offers into an almost-certain offer when a
    // player has many possible suitors.
    const bestFit = need[0];
    const rival = bestFit && rand(save) < bestFit.interest ? bestFit : undefined;
    if (!rival) continue;
    const offer: RfaOfferSheet = {
      id: `rfa-${save.year}-${p.id}-${rival.id}`,
      year: save.year,
      playerId: p.id,
      originalTeam: tender.teamId,
      offerTeam: rival.id,
      salary: rival.offerSalary,
      years: p.age <= 28 ? 3 : 2,
      compensationRound: tender.compensationRound,
      compensationPickId: rival.pick?.id,
      status: "pending",
    };
    save.rfaOfferSheets.push(offer);
    opened.push(offer);
    addNews(save, {
      kind: "transaction",
      headline: `${displayName(save.year, rival.id)} sign ${playerName(p)} to an offer sheet`,
      body: `A ${offer.years}-year offer worth ${formatMoney(offer.salary, save.year)} per season puts the ${displayName(save.year, tender.teamId)}'s right of first refusal to the test.`,
      teamIds: [tender.teamId, rival.id],
      playerIds: [p.id],
    });
  }
  // In interactive play, CPU-run front offices resolve their own players; only
  // the user's club pauses the market for a decision.
  autoResolveRfaOfferSheets(save, auto ? undefined : (offer) => offer.originalTeam !== save.userTeamId || cpuHandles(save, save.userTeamId, "contracts"));
  return opened;
}

function rosterOfTeam(save: DynastySave, teamId: TeamId): Player[] {
  return (save.teams[teamId]?.roster ?? []).map((id) => save.players[id]).filter((player): player is Player => !!player);
}

/** Match the offer sheet or decline it and take the tender's associated next-draft pick. */
export function resolveRfaOfferSheet(save: DynastySave, offerId: string, match: boolean, automated = false): string {
  const offer = (save.rfaOfferSheets ?? []).find((item) => item.id === offerId && item.year === save.year && item.status === "pending");
  if (!offer) return "That offer sheet is no longer open.";
  if (!automated && (offer.originalTeam !== save.userTeamId || cpuHandles(save, save.userTeamId, "contracts"))) return "The CPU front office controls this tender decision.";
  const p = save.players[offer.playerId];
  if (!p || p.teamId !== offer.originalTeam) return "The player is no longer on your roster.";
  const t = talksFor(save, p.id);
  if (match) {
    if (!fitsCap(save, p, offer.salary, offer.originalTeam)) return "That match does not fit under the cap.";
    p.salary = offer.salary;
    p.contractYears = offer.years;
    save.teams[offer.originalTeam].payroll = teamPayroll(save, offer.originalTeam);
    if (t) {
      t.status = "signed";
      t.result = `Matched ${displayName(save.year, offer.offerTeam)}'s ${offer.years}-year offer sheet.`;
    }
    offer.status = "matched";
    offer.result = `${displayName(save.year, offer.originalTeam)} matched and retained ${playerName(p)}.`;
    addNews(save, { kind: "transaction", headline: `${displayName(save.year, offer.originalTeam)} match the ${displayName(save.year, offer.offerTeam)} offer sheet`, body: `${playerName(p)} stays on a ${offer.years}-year deal at ${formatMoney(offer.salary, save.year)} per season.`, teamIds: [offer.originalTeam, offer.offerTeam], playerIds: [p.id] });
    return offer.result;
  }
  if (activeRosterOf(save, offer.offerTeam).length >= ROSTER_TARGET + 8) return "The signing club's roster is full; the offer cannot be completed.";
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap != null && teamPayroll(save, offer.offerTeam) + offer.salary > cap) return "The signing club no longer has cap room for the offer sheet.";
  let compLabel = "no draft-pick compensation";
  if (offer.compensationRound) {
    const pick = allPicks(save).find((asset) => asset.id === offer.compensationPickId && asset.owner === offer.offerTeam && !asset.used);
    if (!pick || pick.year !== save.year + 1 || pick.round !== offer.compensationRound) return "The signing club no longer has the required compensation pick.";
    if (!transferPick(save, pick.id, offer.originalTeam)) return "The compensation pick could not be transferred.";
    compLabel = `the signing club's ${offer.compensationRound}${offer.compensationRound === 1 ? "st" : offer.compensationRound === 2 ? "nd" : offer.compensationRound === 3 ? "rd" : "th"}-round pick in the ${pick.year} draft`;
  }
  const from = offer.originalTeam;
  p.salary = offer.salary;
  p.contractYears = offer.years;
  p.jersey = carryJersey(save, p, offer.offerTeam);
  movePlayer(save, p.id, offer.offerTeam);
  save.teams[from].payroll = teamPayroll(save, from);
  save.teams[offer.offerTeam].payroll = teamPayroll(save, offer.offerTeam);
  syncDepth(save, from);
  syncDepth(save, offer.offerTeam);
  if (t) {
    t.status = "gone";
    t.result = `${playerName(p)} signed with ${displayName(save.year, offer.offerTeam)}; your club receives ${compLabel}.`;
  }
  offer.status = "signed";
  offer.result = `${playerName(p)} joins ${displayName(save.year, offer.offerTeam)}; ${displayName(save.year, from)} receives ${compLabel}.`;
  addTx(save, "sign", p.id, from, offer.offerTeam, `Signed RFA offer sheet · ${offer.years} yr · ${formatMoney(offer.salary, save.year)}/yr`);
  addNews(save, { kind: "transaction", headline: `${displayName(save.year, offer.offerTeam)} sign ${playerName(p)}`, body: `${offer.result}`, teamIds: [from, offer.offerTeam], playerIds: [p.id] });
  return offer.result;
}

/** Simulated decisions keep bulk and CPU-only seasons moving without bypassing the offer-sheet rules. */
export function autoResolveRfaOfferSheets(save: DynastySave, shouldResolve?: (offer: RfaOfferSheet) => boolean): void {
  for (const offer of pendingRfaOfferSheets(save)) {
    if (shouldResolve && !shouldResolve(offer)) continue;
    const p = save.players[offer.playerId];
    const hasRoom = p && fitsCap(save, p, offer.salary, offer.originalTeam);
    const match = !!p && hasRoom && (p.ovr >= 78 || p.potential >= 88);
    resolveRfaOfferSheet(save, offer.id, match, true);
  }
}

export function openTalks(save: DynastySave): Negotiation[] {
  return (save.talks ?? []).filter((t) => t.year === save.year && t.status === "open");
}

export function talksFor(save: DynastySave, playerId: string): Negotiation | undefined {
  return (save.talks ?? []).find((t) => t.year === save.year && t.playerId === playerId);
}

/** Seasons he's spent with the owner's club. */
function yearsWithClub(save: DynastySave, p: Player): number {
  const u = save.userTeamId;
  const rows = [...(p.career ?? []), ...Object.values(p.stats)].filter((s) => s.teamId === u);
  return new Set(rows.map((r) => r.year)).size;
}

/** What his agent asks, and why. */
function askFor(save: DynastySave, p: Player): { ask: number; askYears: number; pitch: string; floor: number } {
  const y = save.year;
  const market = salaryFor(y, p.ovr, p.age, p.pos);
  const bits: string[] = [];
  let m = 1;
  const pb = (p.honors?.proBowl ?? []).includes(y - 1);
  const ap = (p.honors?.allPro ?? []).includes(y - 1);
  const award = (p.honors?.awards ?? []).some((a) => a.year === y - 1);
  if (ap) {
    m += 0.2;
    bits.push("he's coming off an All-Pro season");
  } else if (pb) {
    m += 0.1;
    bits.push("he made the Pro Bowl");
  }
  if (award) {
    m += 0.1;
    bits.push("he has the hardware to prove it");
  }
  if (p.age <= 26 && p.potential - p.ovr >= 4) {
    m += 0.06;
    bits.push("his best football is ahead of him");
  }
  if (p.age >= 31) {
    m -= 0.06;
    bits.push("he knows the clock is running");
  }
  const t = save.teams[save.userTeamId]!;
  const gp = t.wins + t.losses + t.ties;
  const winning = gp && t.wins / gp >= 0.6;
  const loyal = yearsWithClub(save, p) >= 5;
  const mood = p.morale ?? 70;
  const discount: string[] = [];
  if (winning) {
    m -= 0.05;
    discount.push("he wants to stay on a winner");
  }
  if (loyal) {
    m -= 0.04;
    discount.push(`${yearsWithClub(save, p)} seasons in this uniform count for something`);
  }
  if (mood >= 80) {
    m -= 0.04;
    discount.push("he's happy here");
  } else if (mood < 50) {
    m += 0.08;
    bits.push("he hasn't been happy and it'll cost you");
  }
  const ask = roundPay(y, market * m);
  const askYears = p.age <= 25 ? 5 : p.age <= 28 ? 4 : p.age <= 30 ? 3 : p.age <= 32 ? 2 : 1;
  const pitch =
    `His agent wants ${formatMoney(ask, y)} a year for ${askYears} year${askYears === 1 ? "" : "s"}` +
    (bits.length ? `: ${bits.join(", ")}.` : ".") +
    (discount.length ? ` There's a hometown discount in there: ${discount.join("; ")}.` : "");
  // He'll take a bit less than the ask; how much less is his own business.
  const floor = ask * (0.88 + noise(`${p.id}-${y}-floor`) * 0.09);
  return { ask, askYears, pitch, floor };
}

/**
 * At the turn of the league year: the owner's expiring players come to the table instead of
 * leaving or re-signing on their own. Called from refreshContracts for the owner's club.
 */
export function startTalks(save: DynastySave, p: Player): void {
  const a = askFor(save, p);
  p.contractYears = 0;
  save.talks = (save.talks ?? []).filter((t) => t.year >= save.year - 1 && t.playerId !== p.id);
  save.talks.push({
    playerId: p.id,
    year: save.year,
    ask: a.ask,
    askYears: a.askYears,
    pitch: a.pitch,
    // A happy player gives the owner one more round at the table.
    patience: (p.morale ?? 70) >= 75 ? 4 : 3,
    status: "open",
    rounds: [],
    floor: a.floor,
    accruedSeasons: accruedSeasonsFor(p),
  });
}

function fitsCap(save: DynastySave, p: Player, salary: number, teamId: TeamId = save.userTeamId): boolean {
  const cap = save.salaryCap ?? salaryCapFor(save.year);
  if (cap == null) return true;
  return teamPayroll(save, teamId) - (p.teamId === teamId ? p.salary ?? 0 : 0) + salary <= cap;
}

function sign(save: DynastySave, t: Negotiation, p: Player, salary: number, years: number, how: string): void {
  p.salary = salary;
  p.contractYears = years;
  t.status = "signed";
  t.result = how;
  save.teams[save.userTeamId]!.payroll = teamPayroll(save, save.userTeamId);
  addNews(save, {
    kind: "transaction",
    headline: `${playerName(p)} re-signs with the ${displayName(save.year, save.userTeamId)}`,
    body: `${years} year${years === 1 ? "" : "s"}, ${formatMoney(salary, save.year)} a year. ${how}`,
    teamIds: [save.userTeamId],
    playerIds: [p.id],
  });
}

/** The owner's offer. Returns what the agent says. */
export function makeOffer(save: DynastySave, playerId: string, salary: number, years: number): string {
  const t = talksFor(save, playerId);
  const p = save.players[playerId];
  if (!t || !p || t.status !== "open") return "Those talks are over.";
  const y = save.year;
  salary = roundPay(y, salary);
  years = Math.max(1, Math.min(5, Math.round(years)));
  if (!fitsCap(save, p, salary)) return "That deal doesn't fit under the cap.";
  const value = salary * (1 - 0.035 * Math.abs(years - t.askYears));
  const r = (reply: string, tone: Negotiation["rounds"][number]["tone"]) => {
    t.rounds.push({ salary, years, reply, tone });
    return reply;
  };
  if (value >= t.floor) {
    const over = salary >= t.ask;
    p.morale = Math.min(99, (p.morale ?? 70) + (over ? 8 : 4));
    sign(save, t, p, salary, years, over ? "He got his number." : "Both sides gave a little.");
    return r(over ? `Done. ${playerName(p)} is thrilled.` : `You have a deal. ${playerName(p)} signs for ${years} year${years === 1 ? "" : "s"}.`, "yes");
  }
  if (value >= t.floor * 0.9) {
    t.patience -= 1;
    const cSalary = roundPay(y, (Math.max(t.ask * 0.97, salary) + t.ask) / 2);
    t.counter = { salary: cSalary, years: t.askYears };
    if (t.patience <= 0) return walk(save, t, p, r);
    return r(`Close. They'll come down to ${formatMoney(cSalary, y)} a year for ${t.askYears} year${t.askYears === 1 ? "" : "s"}.`, "counter");
  }
  t.patience -= 2;
  p.morale = Math.max(25, (p.morale ?? 70) - 6);
  if (t.patience <= 0) return walk(save, t, p, r);
  return r(years !== t.askYears && salary >= t.floor * 0.95 ? "The money's close; the years aren't. He wants security." : "That's not a serious offer. His agent hung up.", "insult");
}

/** Take the agent's last counter. */
export function acceptCounter(save: DynastySave, playerId: string): string {
  const t = talksFor(save, playerId);
  if (!t?.counter) return "There's no counteroffer on the table.";
  return makeOffer(save, playerId, Math.max(t.counter.salary, t.floor), t.counter.years);
}

function walk(save: DynastySave, t: Negotiation, p: Player, r: (reply: string, tone: "no") => string): string {
  t.status = "walked";
  t.counter = undefined;
  t.result = save.year < 1994 ? "No deal. He'll play out his option." : "No deal. He's going to test the market.";
  addNews(save, {
    kind: "transaction",
    headline: `Talks break down between ${playerName(p)} and the ${displayName(save.year, save.userTeamId)}`,
    body: t.result,
    teamIds: [save.userTeamId],
    playerIds: [p.id],
  });
  return r(t.result, "no");
}

/** The owner ends talks himself. */
export function letWalk(save: DynastySave, playerId: string): string {
  const t = talksFor(save, playerId);
  const p = save.players[playerId];
  if (!t || !p || t.status !== "open") return "Those talks are over.";
  return walk(save, t, p, (x) => x);
}

/** The franchise tag: from the cap era on, one a year, the top-five average at his position. */
export function tagPrice(save: DynastySave, p: Player): number {
  const top = Object.values(save.players)
    .filter((x) => x.pos === p.pos && x.teamId !== "fa" && x.teamId !== "retired" && x.teamId !== "hof")
    .map((x) => x.salary ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 5);
  const avg = top.length ? top.reduce((a, b) => a + b, 0) / top.length : salaryFor(save.year, 90, 28, p.pos);
  return roundPay(save.year, Math.max(avg, (p.salary ?? 0) * 1.2));
}

export function canTag(save: DynastySave): boolean {
  return save.year >= 1994 && save.tagYear !== save.year;
}

export function franchiseTag(save: DynastySave, playerId: string): string {
  const t = talksFor(save, playerId);
  const p = save.players[playerId];
  if (!t || !p || (t.status !== "open" && t.status !== "walked")) return "He isn't available to tag.";
  if (!canTag(save)) return save.year < 1994 ? "There's no franchise tag before the 1993 agreement takes effect." : "You've already used the tag this year.";
  const price = tagPrice(save, p);
  if (!fitsCap(save, p, price)) return "The tag doesn't fit under the cap.";
  save.tagYear = save.year;
  p.salary = price;
  p.contractYears = 1;
  p.morale = Math.max(25, (p.morale ?? 70) - 10);
  t.status = "tagged";
  t.counter = undefined;
  t.result = `Franchise tag: one year, ${formatMoney(price, save.year)}. He isn't happy about it.`;
  save.teams[save.userTeamId]!.payroll = teamPayroll(save, save.userTeamId);
  addNews(save, {
    kind: "transaction",
    headline: `The ${displayName(save.year, save.userTeamId)} franchise-tag ${playerName(p)}`,
    body: t.result,
    teamIds: [save.userTeamId],
    playerIds: [p.id],
  });
  return t.result;
}

/**
 * Free agency opens: the deadline. Talks the owner never touched are handled by the staff the
 * way they always were; players who walked leave (cap era) or play out the option (before).
 */
export function closeTalks(save: DynastySave, staff: (p: Player) => void): void {
  for (const t of save.talks ?? []) {
    if (t.year !== save.year) continue;
    const p = save.players[t.playerId];
    if (!p) continue;
    const onClub = p.teamId === save.userTeamId;
    if (t.status === "open" && !t.rounds.length) {
      t.status = "staff";
      if (onClub) staff(p);
      t.result = p.teamId === save.userTeamId ? "The front office got a deal done." : "The front office let him go.";
      continue;
    }
    if (t.status !== "open" && t.status !== "walked") continue;
    if (!onClub) {
      t.status = "gone";
      continue;
    }
    if (save.year < 1994) {
      p.salary = roundPay(save.year, (p.salary ?? salaryFor(save.year, p.ovr, p.age, p.pos)) * 1.1);
      p.contractYears = 1;
      p.morale = Math.max(25, (p.morale ?? 70) - 12);
      t.status = "option";
      t.result = "Plays out his option: one more year at a 10% raise, and not happy about it.";
    } else {
      leaveClub(save, p);
      t.status = "gone";
      t.result = "He's on the open market.";
      addNews(save, {
        kind: "transaction",
        headline: `${playerName(p)} hits free agency`,
        body: `No deal with the ${displayName(save.year, save.userTeamId)}. Every club can make him an offer now.`,
        teamIds: [save.userTeamId],
        playerIds: [p.id],
      });
    }
  }
}

function leaveClub(save: DynastySave, p: Player): void {
  const id = p.teamId as TeamId;
  const team = save.teams[id];
  if (team) {
    team.roster = team.roster.filter((x) => x !== p.id);
    if (team.depth) for (const pos of Object.keys(team.depth) as (keyof typeof team.depth)[]) team.depth[pos] = (team.depth[pos] ?? []).filter((x) => x !== p.id);
    syncDepth(save, id);
  }
  p.teamId = "fa";
  p.contractYears = 0;
}

/** Expiring players on the owner's roster still at the table, for the Office reminder. */
export function talksSummary(save: DynastySave): { open: number; total: number } {
  const mine = (save.talks ?? []).filter((t) => t.year === save.year);
  return { open: mine.filter((t) => t.status === "open").length, total: mine.length };
}

