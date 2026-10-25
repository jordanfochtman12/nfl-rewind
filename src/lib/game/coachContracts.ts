/**
 * Coaching contracts. Every man on a staff is signed for so many seasons at a salary scaled to
 * his era (a 1966 head coach made about $50,000, a 2025 one around $12 million; coordinators a
 * fifth of that). A computer club re-signs a winner and lets a loser's deal run out; the owner
 * extends his own staff at the desk or watches them walk when the deal is up. Coaches sit
 * outside the cap, as they do in the league: the money is the owner's, and a fired coach's
 * remaining years are reported, not charged. No React.
 */
import type { Coach, CoachRole, DynastySave, TeamId } from "./types.ts";
import { activeTeamIds } from "./teams.ts";
import { randInt } from "./rng.ts";
import { winPct } from "./standings.ts";
import { formatMoney } from "./salary.ts";

/** A head coach's going rate by season, before his résumé. */
const HC_PAY: [number, number][] = [
  [1966, 50_000],
  [1975, 110_000],
  [1985, 400_000],
  [1995, 1_300_000],
  [2005, 3_500_000],
  [2015, 6_500_000],
  [2025, 12_000_000],
];

function eraRate(year: number): number {
  if (year <= HC_PAY[0]![0]) return HC_PAY[0]![1];
  for (let i = 1; i < HC_PAY.length; i++) {
    const [y1, p1] = HC_PAY[i]!;
    const [y0, p0] = HC_PAY[i - 1]!;
    if (year <= y1) return p0 * Math.pow(p1 / p0, (year - y0) / (y1 - y0));
  }
  const [yl, pl] = HC_PAY.at(-1)!;
  return pl * Math.pow(1.05, year - yl);
}

/** What a coach is paid a season in this job: the era's rate, his grades and his rings. */
export function coachPay(year: number, c: Coach, role: CoachRole): number {
  const grade = Math.max(0, Math.min(1, (Math.max(c.offense, c.defense) - 68) / 26));
  const proven = Math.min(3, c.careerTitles) * 0.12 + (c.careerWins > c.careerLosses + 20 ? 0.1 : 0);
  const share = role === "HC" ? 1 : 0.22;
  const pay = eraRate(year) * share * (0.7 + grade * 0.6 + proven);
  const step = pay >= 1_000_000 ? 50_000 : 5_000;
  return Math.round(pay / step) * step;
}

/** Seasons a club signs him for: four or five for a head coach (fewer past 64), two or three for a coordinator. */
function termFor(save: DynastySave, c: Coach, role: CoachRole): number {
  if (c.interimYear === save.year) return 1;
  if (role !== "HC") return randInt(save, 2, 3);
  if (c.age >= 65) return randInt(save, 2, 3);
  return c.careerWins > c.careerLosses + 20 || c.careerTitles ? 5 : randInt(save, 4, 5);
}

/** From the playoffs to the carousel, this year's season is played (or being finished). */
const SEASON_DONE = new Set(["playoffs", "superBowl", "awards", "proBowl", "retirement", "hof"]);
/** The winter, once the carousel has turned the page: the next season is next year's. */
const WINTER = new Set(["awards", "proBowl", "retirement", "hof", "carousel", "complete"]);

/** The season a contract signed now starts with: a winter hire is for next year's team. */
function firstSeason(save: DynastySave): number {
  return WINTER.has(save.phase) ? save.year + 1 : save.year;
}

/**
 * Give every coach on a staff without a deal for that job one. A league's very first staffs are
 * signed at different points of their deals (otherwise every contract in the league would run
 * out the same winter).
 */
export function ensureContracts(save: DynastySave): void {
  if (save.realHistory) return;
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]);
  const fresh = !ids.some((id) => {
    const t = save.teams[id]!;
    return [t.coachId, t.ocId, t.dcId].some((cid) => cid && save.coaches[cid]?.contract);
  });
  for (const id of ids) {
    const t = save.teams[id]!;
    for (const [role, cid] of [["HC", t.coachId], ["OC", t.ocId], ["DC", t.dcId]] as const) {
      const c = cid ? save.coaches[cid] : undefined;
      if (!c) continue;
      if (c.contract && c.contract.teamId === id && c.contract.role === role) continue;
      const years = termFor(save, c, role);
      c.contract = {
        teamId: id,
        role,
        years: fresh ? randInt(save, 1, years) : years,
        salary: coachPay(save.year, c, role),
        signed: firstSeason(save),
      };
    }
  }
}

/** A deal that runs through the season just played (he's in its last year). */
export function finalYear(c: Coach | undefined): boolean {
  return !!c?.contract && c.contract.years <= 1;
}

/**
 * Fired with years left: his remaining money, said once, and the deal torn up. Returns the
 * sentence for the news ("" when nothing was left on it).
 */
export function tearUp(save: DynastySave, c: Coach | undefined, seasonOver = SEASON_DONE.has(save.phase)): string {
  const k = c?.contract;
  if (!c || !k) return "";
  c.contract = undefined;
  // A deal signed for a season not yet played is all still owed. Fired once the season is over,
  // the one just played is paid; fired during it, it's still owed too.
  const left = k.signed > save.year ? k.years : k.years - (seasonOver ? 1 : 0);
  if (left <= 0) return "";
  return ` He's owed ${formatMoney(k.salary * left, save.year)} for the ${left === 1 ? "last year" : `last ${left} years`} of his deal.`;
}

/** The owner's extension: years on top of what's left, at his going rate (more for a winner). */
export function extensionTerms(save: DynastySave, teamId: TeamId, c: Coach, role: CoachRole): { salary: number } {
  const t = save.teams[teamId];
  const won = t && t.wins + t.losses + t.ties >= 4 ? winPct(t) : 0.5;
  const raise = won >= 0.65 ? 1.2 : won >= 0.5 ? 1.08 : 1;
  const salary = Math.max(c.contract?.salary ?? 0, coachPay(save.year, c, role) * raise);
  const step = salary >= 1_000_000 ? 50_000 : 5_000;
  return { salary: Math.round(salary / step) * step };
}

/** The owner extends a man on his staff. A deal can run six seasons at most. */
export function extendCoach(save: DynastySave, teamId: TeamId, role: CoachRole, years: number): { ok: boolean; reason?: string } {
  const t = save.teams[teamId];
  const cid = role === "HC" ? t?.coachId : role === "OC" ? t?.ocId : t?.dcId;
  const c = cid ? save.coaches[cid] : undefined;
  if (!t || !c) return { ok: false, reason: "Nobody in that job." };
  if (!c.contract || c.contract.teamId !== teamId) ensureContracts(save);
  const k = c.contract;
  if (!k) return { ok: false, reason: "No deal on file." };
  if (c.age >= 72) return { ok: false, reason: `${c.name} isn't signing on for more years at ${c.age}.` };
  const total = Math.min(6, k.years + years);
  if (total <= k.years) return { ok: false, reason: "His deal already runs six seasons." };
  k.salary = extensionTerms(save, teamId, c, role).salary;
  k.years = total;
  return { ok: true };
}

/**
 * The winter's turn of the page: every deal loses the season just played. Returns the coaches
 * whose deals ran out (still on the staff; the carousel decides who stays).
 */
export function tickContracts(save: DynastySave): { teamId: TeamId; role: CoachRole; coach: Coach }[] {
  if (save.realHistory) return [];
  const out: { teamId: TeamId; role: CoachRole; coach: Coach }[] = [];
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    if (!t) continue;
    for (const [role, cid] of [["HC", t.coachId], ["OC", t.ocId], ["DC", t.dcId]] as const) {
      const c = cid ? save.coaches[cid] : undefined;
      const k = c?.contract;
      if (!c || !k || k.teamId !== id || k.signed > save.year) continue;
      k.years -= 1;
      if (k.years <= 0) out.push({ teamId: id, role, coach: c });
    }
  }
  return out;
}

/** A computer club re-signs a man whose deal is up: what it pays him for the next one. */
export function renew(save: DynastySave, c: Coach, role: CoachRole): void {
  c.contract = {
    teamId: c.contract?.teamId ?? (c.teamId as TeamId),
    role,
    years: termFor(save, c, role),
    salary: Math.max(c.contract?.salary ?? 0, coachPay(save.year, c, role)),
    signed: save.year + 1,
  };
}
