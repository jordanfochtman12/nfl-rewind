/** Front-office mutations. Engine-only. UI calls these through the store desk. */
import type {
  CoachRole,
  DefScheme,
  DraftStyle,
  DynastySave,
  GmResult,
  OffScheme,
  Player,
  Pos,
  TeamId,
  TradePiece,
} from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { addToRoster, movePlayer, playerName, rosterOf, syncDepth } from "./players.ts";
import { addNews, addTx } from "./news.ts";
import { salaryCapFor, salaryFor, teamPayroll } from "./salary.ts";
import { displayName } from "./teams.ts";
import { jerseyFor } from "./names.ts";
import { transferPick, pickValue } from "./draft.ts";
import { fireCoach, hireCoach, setTeamScheme } from "./staff.ts";
import { randInt } from "./rng.ts";
import { visibleOvr } from "./scout.ts";

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
  return teamPayroll(save, teamId) + salary <= cap * 1.02;
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

export function signPlayer(save: DynastySave, teamId: TeamId, playerId: string, years?: number): GmResult {
  const p = save.players[playerId];
  if (!p) return fail("No such player.");
  if (p.teamId !== "fa") return fail("He is already under contract.");
  if (save.waivers.some((w) => w.playerId === playerId)) {
    return fail("He is on waivers — claim him instead.");
  }
  if (rosterOf(save, teamId).length >= ROSTER_TARGET + 8) return fail("Roster is full.");
  const salary = salaryFor(save.year, p.ovr, p.age);
  if (!canAfford(save, teamId, salary)) return fail("Over the cap.");
  if (save.year < 1994 && p.historical && p.yearsPro >= 4 && p.ovr >= 84) {
    // Rozelle-rule era: stars rarely move. User can still try; CPU almost never will.
  }
  p.salary = salary;
  p.contractYears = years ?? randInt(save, 1, 3);
  p.jersey = jerseyFor(save, p.pos, new Set(rosterOf(save, teamId).map((x) => x.jersey)));
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
  const salary = salaryFor(save.year, p.ovr, p.age);
  if (!canAfford(save, teamId, salary)) return fail("Over the cap.");
  const wire = save.waivers[idx]!;
  save.waivers.splice(idx, 1);
  p.salary = salary;
  p.contractYears = Math.max(1, p.contractYears || 1);
  p.jersey = jerseyFor(save, p.pos, new Set(rosterOf(save, teamId).map((x) => x.jersey)));
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
  const valA = give.reduce((n, x) => n + tradeValue(save, x), 0);
  const valB = get.reduce((n, x) => n + tradeValue(save, x), 0);
  if (!opts?.force && valB < valA * 0.82) {
    return fail("The other club hung up. Offer more.");
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
    p.jersey = jerseyFor(save, p.pos, new Set(rosterOf(save, to).map((x) => x.jersey)));
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

export function cpuTrades(save: DynastySave): void {
  const teams = Object.values(save.teams).filter((t) => t.active && t.id !== save.userTeamId);
  if (teams.length < 2) return;
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
  executeTrade(save, a.id, b.id, [{ playerId: cheap.id }], [{ playerId: target.id }], { force: true });
}
