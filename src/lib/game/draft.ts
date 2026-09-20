import type { DraftPickAsset, DraftSession, DynastySave, Player, Pos, Prospect, TeamId } from "./types.ts";
import { activeTeamIds, originalLeague } from "./teams.ts";
import { draftSeedsFor, type DraftSeed } from "./data/draftClasses.ts";
import { addToRoster, generatePlayer, makePlayer, playerName, rosterOf, syncDepth } from "./players.ts";
import { eraCollege, jerseyFor } from "./names.ts";
import { lookupCollege } from "./data/colleges.ts";
import { randInt } from "./rng.ts";
import { kitBoost } from "./abilities.ts";
import { addNews, addTx } from "./news.ts";
import { winPct } from "./standings.ts";
import { applyScout, visibleOvr } from "./scout.ts";
import { salaryFor } from "./salary.ts";
import { coachKitBoost } from "./coachKit.ts";
import { schemeFitPos } from "./staff.ts";

function roundsFor(year: number): number {
  if (year <= 1976) return 12;
  if (year <= 1993) return 8;
  return 7;
}

export function sessionOf(save: DynastySave): DraftSession {
  if (save.draftSession) return save.draftSession;
  return save.year === 1966 ? "nfl" : "common";
}

export function sessionTeams(year: number, session: DraftSession): TeamId[] {
  const all = activeTeamIds(year);
  if (session === "nfl") return all.filter((t) => originalLeague(t) === "NFL");
  if (session === "afl") return all.filter((t) => originalLeague(t) === "AFL");
  return all;
}

export function standingOrder(save: DynastySave, teams: TeamId[]): TeamId[] {
  const bornThisYear = teams.filter((t) => {
    const born: Partial<Record<TeamId, number>> = {
      atl: 1966,
      mia: 1966,
      nor: 1967,
      cin: 1968,
      tam: 1976,
      sea: 1976,
      car: 1995,
      jax: 1995,
      rav: 1996,
      cle: 1999,
      htx: 2002,
    };
    return born[t] === save.year;
  });
  const rest = teams
    .filter((t) => !bornThisYear.includes(t))
    .sort((a, b) => {
      const pa = winPct(save.teams[a]!);
      const pb = winPct(save.teams[b]!);
      if (pa !== pb) return pa - pb;
      return save.teams[a]!.pf - save.teams[a]!.pa - (save.teams[b]!.pf - save.teams[b]!.pa);
    });
  if (save.year === 1966 && teams.includes("atl")) {
    return ["atl", ...teams.filter((t) => t !== "atl")];
  }
  return [...bornThisYear, ...rest];
}

export function allPicks(save: DynastySave): DraftPickAsset[] {
  const out: DraftPickAsset[] = [];
  for (const t of Object.values(save.teams)) {
    for (const p of t.picks ?? []) out.push(p);
  }
  return out;
}

export function issuePicks(save: DynastySave, year: number, teamId: TeamId): void {
  const t = save.teams[teamId];
  if (!t) return;
  t.picks = t.picks ?? [];
  const rounds = roundsFor(year);
  const existing = new Set(allPicks(save).map((p) => p.id));
  for (let r = 1; r <= rounds; r++) {
    const id = `${year}-r${r}-${teamId}`;
    if (existing.has(id) || t.picks.some((p) => p.id === id)) continue;
    t.picks.push({ id, year, round: r, orig: teamId, owner: teamId });
  }
}

export function ensureSeasonPicks(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    issuePicks(save, save.year, id);
    issuePicks(save, save.year + 1, id);
    issuePicks(save, save.year + 2, id);
  }
}

export function findPick(save: DynastySave, year: number, round: number, orig: TeamId): DraftPickAsset | undefined {
  for (const t of Object.values(save.teams)) {
    const hit = (t.picks ?? []).find((p) => p.year === year && p.round === round && p.orig === orig && !p.used);
    if (hit) return hit;
  }
  return undefined;
}

export function transferPick(save: DynastySave, pickId: string, to: TeamId): boolean {
  const dest = save.teams[to];
  if (!dest) return false;
  dest.picks = dest.picks ?? [];
  for (const t of Object.values(save.teams)) {
    const i = (t.picks ?? []).findIndex((p) => p.id === pickId && !p.used);
    if (i < 0) continue;
    const [asset] = t.picks.splice(i, 1);
    if (!asset) return false;
    asset.owner = to;
    dest.picks.push(asset);
    return true;
  }
  return false;
}

export function pickValue(save: DynastySave, pickId: string): number {
  const asset = allPicks(save).find((p) => p.id === pickId);
  if (!asset) return 0;
  const roundVal = [0, 38, 22, 14, 9, 6, 4, 3, 2, 1.5, 1.2, 1, 0.8][asset.round] ?? 0.6;
  const yearTax = asset.year > save.year ? 0.82 : 1;
  return roundVal * yearTax * 2.2;
}

export function draftQueue(save: DynastySave): DraftPickAsset[] {
  ensureSeasonPicks(save);
  const session = sessionOf(save);
  const teams = sessionTeams(save.year, session);
  const order = standingOrder(save, teams);
  const rounds = roundsFor(save.year);
  const q: DraftPickAsset[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (const orig of order) {
      const asset = findPick(save, save.year, r, orig);
      if (asset) q.push(asset);
    }
  }
  return q;
}

/** Team order for the current session (round 1 orig clubs). Used by UI. */
export function draftOrder(save: DynastySave): TeamId[] {
  return standingOrder(save, sessionTeams(save.year, sessionOf(save)));
}

function seedToPlayer(save: DynastySave, s: DraftSeed, round: number): Player {
  const p = makePlayer(save, {
    firstName: s.f,
    lastName: s.l,
    pos: s.p,
    teamId: "fa",
    ovr: s.o,
    age: randInt(save, 21, 23),
    historical: true,
    generated: false,
    college: s.c ?? lookupCollege(s.f, s.l) ?? eraCollege(save),
    draftYear: save.year,
    draftRound: s.r ?? round,
    arch: s.arch,
    heightIn: s.ht,
    weight: s.wt,
    forty: s.fy,
    rt: s.rt,
  });
  return p;
}

/**
 * save.players only ever grew - by a dynasty's end year that's 50k+ entries and an
 * 80+MB save, degrading every autosave (JSON.stringify runs on the whole thing each
 * time). Two sources of permanent dead weight, cleared once a year:
 *
 * - A drafted-fodder prospect who never got picked is never referenced again by
 *   anything - draft picks/news only ever get written for players who WERE selected
 *   (see makeDraftPick below) - so once his class's board is about to be replaced by
 *   next year's, there's no reason to keep him.
 * - fillRoster's generated depth fillers are the bigger leak. Once one gets cut he
 *   lands in free agency, and if nobody signs him he just sits there forever:
 *   cpuSignNeeds only offers 1-2 slots a team a year and always prefers the best
 *   available player, so an aging, unremarkable generated FA realistically never
 *   gets picked up again.
 *
 * Real historical players are kept regardless in both cases - someone may look one
 * up by name even if this particular sim never drafted or signed him.
 */
export function pruneUndraftedProspects(save: DynastySave): void {
  for (const pr of save.draftBoard) {
    if (pr.taken) continue;
    const p = save.players[pr.playerId];
    if (p && !p.historical) delete save.players[pr.playerId];
  }
  for (const [id, p] of Object.entries(save.players)) {
    if (!p.historical && p.teamId === "fa" && p.age >= 30) delete save.players[id];
  }
}

export function buildDraftBoard(save: DynastySave): void {
  const session = sessionOf(save);
  save.draftSession = session;
  ensureSeasonPicks(save);
  const queue = draftQueue(save);
  const total = queue.length;
  const named = draftSeedsFor(save.year);
  const used = new Set<string>();
  for (const pl of Object.values(save.players)) {
    if (pl.historical) used.add(`${pl.firstName}|${pl.lastName}|${pl.pos}`);
  }
  const board: Prospect[] = [];
  let slot = 1;
  for (const s of named) {
    if (board.length >= total) break;
    const key = `${s.f}|${s.l}|${s.p}`;
    if (used.has(key)) continue;
    used.add(key);
    const p = seedToPlayer(save, s, s.r ?? 1);
    board.push({ playerId: p.id, slot, taken: false, league: session });
    slot += 1;
  }
  const realPos: Pos[] = [
    "QB",
    "RB",
    "WR",
    "TE",
    "LT",
    "LG",
    "C",
    "RG",
    "RT",
    "DE",
    "DT",
    "OLB",
    "MLB",
    "CB",
    "S",
    "K",
    "P",
    "FB",
  ];
  const teamsN = Math.max(1, sessionTeams(save.year, session).length);
  while (board.length < total) {
    const pos = realPos[board.length % realPos.length]!;
    const roundGuess = Math.floor(board.length / teamsN) + 1;
    const ovr = 78 - Math.floor(board.length / teamsN) * 3 - randInt(save, 0, 8);
    const p = generatePlayer(save, pos, "fa", Math.max(48, ovr), randInt(save, 21, 23));
    p.draftYear = save.year;
    p.draftRound = roundGuess;
    p.historical = false;
    p.yearsPro = 0;
    applyScout(save, p);
    board.push({ playerId: p.id, slot, taken: false, league: session });
    slot += 1;
  }
  save.draftBoard = board;
  save.draftPickIndex = 0;
}

function needScore(save: DynastySave, teamId: TeamId, pos: Pos): number {
  const have = rosterOf(save, teamId).filter((p) => p.pos === pos);
  const best = have[0]?.ovr ?? 40;
  return 80 - best + Math.max(0, 2 - have.length) * 8;
}

export function bestAvailable(save: DynastySave, teamId: TeamId, round = 99): Prospect | undefined {
  const open = save.draftBoard.filter((p) => !p.taken);
  if (!open.length) return undefined;
  const style = save.teams[teamId]?.draftStyle ?? "need";
  const club = save.teams[teamId];
  const hc = club?.coachId ? save.coaches[club.coachId] : undefined;
  const evalN = (hc?.evaluation ?? 70) + coachKitBoost(hc, "eval") * 80;
  const qb = rosterOf(save, teamId)
    .filter((p) => p.pos === "QB")
    .sort((a, b) => b.ovr - a.ovr)[0];
  let best = open[0]!;
  let bestScore = -1;
  const window = style === "bpa" ? 12 : 28;
  for (const pr of open.slice(0, window)) {
    const pl = save.players[pr.playerId];
    if (!pl) continue;
    const scout = visibleOvr(pl);
    const blend = Math.max(0, Math.min(0.7, (evalN - 60) / 80));
    const grade = scout * (1 - blend) + pl.ovr * blend;
    // A team with a weak kicker/punter isn't "in need" the way it would be at a
    // real starter spot - that slot is trivially filled off the street after the
    // draft, so raw urgency shouldn't drive up a specialist's pick value.
    const isSpecialist = pl.pos === "K" || pl.pos === "P";
    const need = needScore(save, teamId, pl.pos) * (isSpecialist ? 0.15 : 1);
    let score = grade + need * (style === "need" ? 0.72 : 0.28);
    if (style === "speed") score += ((pl.revealed ? pl.ratings.speed : grade) - 70) * 0.22;
    if (style === "trench" && ["LT", "LG", "C", "RG", "RT", "DE", "DT"].includes(pl.pos)) score += 8;
    if (style === "defense" && ["DE", "DT", "OLB", "MLB", "CB", "S"].includes(pl.pos)) score += 7;
    if (style === "qb" && pl.pos === "QB" && (qb?.ovr ?? 50) < 80) score += 14;
    if (style === "bpa") score = grade * 1.15 + need * 0.12;
    score += schemeFitPos(pl.pos, club?.offScheme, club?.defScheme) * 0.35;
    // Real front offices almost never spend an early pick on a kicker or punter -
    // the gap between a good and great one is tiny and the position is deep in
    // free agency every year. Without this, a specialist with a hot grade and a
    // team's "need" score behind him could out-score every other prospect.
    if (pl.pos === "K" || pl.pos === "P") score -= Math.max(0, 20 - round * 2.5);
    if (pl.revealed) {
      score += kitBoost(pl, "offPass") + kitBoost(pl, "offRun") + kitBoost(pl, "defPass") + kitBoost(pl, "defRun");
      score += (pl.abilities?.length ?? 0) * 0.35 + (pl.traits?.length ?? 0) * 0.25;
    }
    if (score > bestScore) {
      bestScore = score;
      best = pr;
    }
  }
  return best;
}

export function currentDraftTeam(save: DynastySave): TeamId | undefined {
  const queue = draftQueue(save);
  if (save.draftPickIndex >= queue.length) return undefined;
  return queue[save.draftPickIndex]?.owner;
}

export function makeDraftPick(save: DynastySave, playerId?: string): boolean {
  const queue = draftQueue(save);
  const total = Math.min(save.draftBoard.length, queue.length);
  if (save.draftPickIndex >= total) return false;
  const slot = queue[save.draftPickIndex]!;
  const teamId = slot.owner;
  const round = slot.round;
  let prospect = playerId ? save.draftBoard.find((p) => p.playerId === playerId && !p.taken) : undefined;
  if (!prospect) prospect = bestAvailable(save, teamId, round);
  if (!prospect) return false;
  prospect.taken = true;
  prospect.takenBy = teamId;
  slot.used = true;
  const p = save.players[prospect.playerId];
  if (p) {
    p.draftYear = save.year;
    p.draftRound = round;
    p.draftPick = save.draftPickIndex + 1;
    p.jersey = jerseyFor(save, p.pos, new Set(rosterOf(save, teamId).map((x) => x.jersey)));
    p.salary = salaryFor(save.year, p.ovr, p.age);
    p.contractYears = round <= 2 ? 4 : round <= 4 ? 3 : 2;
    addToRoster(save, teamId, p.id);
    syncDepth(save, teamId);
    addTx(save, "draft", p.id, "draft", teamId, `Round ${round} pick ${save.draftPickIndex + 1}`);
    if (round <= 2) {
      addNews(save, {
        kind: "transaction",
        headline: `${teamId.toUpperCase()} selects ${playerName(p)}`,
        body: `Round ${round}: ${p.pos}, ${p.college ?? "campus"}. Scout grade ${visibleOvr(p)}.`,
        teamIds: [teamId],
        playerIds: [p.id],
      });
    }
  }
  save.draftPickIndex += 1;
  return save.draftPickIndex < total;
}

export function maybeStartAflDraft(save: DynastySave): boolean {
  if (save.year !== 1966) return false;
  if (sessionOf(save) !== "nfl") return false;
  const queue = draftQueue(save);
  if (save.draftPickIndex < Math.min(save.draftBoard.length, queue.length) && currentDraftTeam(save)) return false;
  pruneUndraftedProspects(save);
  save.draftSession = "afl";
  buildDraftBoard(save);
  save.draftPickIndex = 0;
  return true;
}

export function autoDraftRest(save: DynastySave): void {
  for (let guard = 0; guard < 1200; guard++) {
    if (makeDraftPick(save)) continue;
    if (maybeStartAflDraft(save)) continue;
    break;
  }
}

export function simUntilUserPick(save: DynastySave): void {
  for (let i = 0; i < 800; i++) {
    const team = currentDraftTeam(save);
    if (!team) {
      if (maybeStartAflDraft(save)) continue;
      return;
    }
    if (team === save.userTeamId) return;
    if (!makeDraftPick(save)) {
      if (maybeStartAflDraft(save)) continue;
      return;
    }
  }
}

export function sessionLabel(save: DynastySave): string {
  const s = sessionOf(save);
  if (s === "nfl") return "NFL Draft";
  if (s === "afl") return "AFL Draft";
  return "Common Draft";
}
