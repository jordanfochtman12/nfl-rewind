import type { DynastySave, Player, Pos, Prospect, TeamId } from "./types.ts";
import { activeTeamIds } from "./teams.ts";
import { draftSeedsFor, type DraftSeed } from "./data/draftClasses.ts";
import { addToRoster, generatePlayer, makePlayer, playerName, rosterOf } from "./players.ts";
import { eraCollege, jerseyFor } from "./names.ts";
import { lookupCollege } from "./data/colleges.ts";
import { randInt } from "./rng.ts";
import { kitBoost } from "./abilities.ts";
import { addNews, addTx } from "./news.ts";
import { winPct } from "./standings.ts";

function roundsFor(year: number): number {
  if (year <= 1976) return 12;
  if (year <= 1993) return 8;
  return 7;
}

export function draftOrder(save: DynastySave): TeamId[] {
  const teams = activeTeamIds(save.year);
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
      return (save.teams[a]!.pf - save.teams[a]!.pa) - (save.teams[b]!.pf - save.teams[b]!.pa);
    });
  if (save.year === 1966 && teams.includes("atl")) {
    return ["atl", ...teams.filter((t) => t !== "atl")];
  }
  return [...bornThisYear, ...rest];
}

function seedToPlayer(save: DynastySave, s: DraftSeed, round: number): Player {
  return makePlayer(save, {
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
}

export function buildDraftBoard(save: DynastySave): void {
  const teams = activeTeamIds(save.year);
  const rounds = roundsFor(save.year);
  const total = teams.length * rounds;
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
    board.push({ playerId: p.id, slot, taken: false });
    slot += 1;
  }
  const posCycle: Pos[] = ["QB", "RB", "WR", "TE", "LT", "DE", "DT", "OLB", "MLB", "CB", "S", "G" as Pos];
  const realPos: Pos[] = ["QB", "RB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "DE", "DT", "OLB", "MLB", "CB", "S", "K", "P", "FB"];
  while (board.length < total) {
    const pos = realPos[board.length % realPos.length]!;
    void posCycle;
    const ovr = 78 - Math.floor(board.length / teams.length) * 3 - randInt(save, 0, 8);
    const p = generatePlayer(save, pos, "fa", Math.max(48, ovr), randInt(save, 21, 23));
    p.draftYear = save.year;
    p.historical = false;
    board.push({ playerId: p.id, slot, taken: false });
    slot += 1;
  }
  save.draftBoard = board;
  save.draftPickIndex = 0;
}

function needScore(save: DynastySave, teamId: TeamId, pos: Pos): number {
  const have = rosterOf(save, teamId).filter((p) => p.pos === pos);
  const best = have[0]?.ovr ?? 40;
  return (80 - best) + Math.max(0, 2 - have.length) * 8;
}

export function bestAvailable(save: DynastySave, teamId: TeamId): Prospect | undefined {
  const open = save.draftBoard.filter((p) => !p.taken);
  if (!open.length) return undefined;
  const style = save.teams[teamId]?.draftStyle ?? "need";
  const qb = rosterOf(save, teamId).filter((p) => p.pos === "QB").sort((a, b) => b.ovr - a.ovr)[0];
  let best = open[0]!;
  let bestScore = -1;
  const window = style === "bpa" ? 12 : 28;
  for (const pr of open.slice(0, window)) {
    const pl = save.players[pr.playerId];
    if (!pl) continue;
    const need = needScore(save, teamId, pl.pos);
    let score = pl.ovr + need * (style === "need" ? 0.72 : 0.28);
    if (style === "speed") score += (pl.ratings.speed - 70) * 0.22;
    if (style === "trench" && ["LT", "LG", "C", "RG", "RT", "DE", "DT"].includes(pl.pos)) score += 8;
    if (style === "defense" && ["DE", "DT", "OLB", "MLB", "CB", "S"].includes(pl.pos)) score += 7;
    if (style === "qb" && pl.pos === "QB" && (qb?.ovr ?? 50) < 80) score += 14;
    if (style === "bpa") score = pl.ovr * 1.15 + need * 0.12;
    score += kitBoost(pl, "offPass") + kitBoost(pl, "offRun") + kitBoost(pl, "defPass") + kitBoost(pl, "defRun");
    score += (pl.abilities?.length ?? 0) * 0.35 + (pl.traits?.length ?? 0) * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = pr;
    }
  }
  return best;
}

export function makeDraftPick(save: DynastySave, playerId?: string): boolean {
  const order = draftOrder(save);
  const total = save.draftBoard.length;
  if (save.draftPickIndex >= total) return false;
  const teamId = order[save.draftPickIndex % order.length]!;
  const round = Math.floor(save.draftPickIndex / order.length) + 1;
  let prospect = playerId ? save.draftBoard.find((p) => p.playerId === playerId && !p.taken) : undefined;
  if (!prospect) prospect = bestAvailable(save, teamId);
  if (!prospect) return false;
  prospect.taken = true;
  prospect.takenBy = teamId;
  const p = save.players[prospect.playerId];
  if (p) {
    p.draftYear = save.year;
    p.draftRound = round;
    p.draftPick = save.draftPickIndex + 1;
    p.jersey = jerseyFor(save, p.pos, new Set(rosterOf(save, teamId).map((x) => x.jersey)));
    addToRoster(save, teamId, p.id);
    addTx(save, "draft", p.id, "draft", teamId, `Round ${round} pick ${save.draftPickIndex + 1}`);
    if (round <= 2) {
      addNews(save, {
        kind: "transaction",
        headline: `${teamId.toUpperCase()} selects ${playerName(p)}`,
        body: `Round ${round}: ${p.pos}, ${p.college ?? "campus"}.`,
        teamIds: [teamId],
        playerIds: [p.id],
      });
    }
  }
  save.draftPickIndex += 1;
  return save.draftPickIndex < total;
}

export function autoDraftRest(save: DynastySave): void {
  while (makeDraftPick(save)) {
    /* cpu */
  }
}

export function simUntilUserPick(save: DynastySave): void {
  for (let i = 0; i < 500; i++) {
    const team = currentDraftTeam(save);
    if (!team || team === save.userTeamId) return;
    if (!makeDraftPick(save)) return;
  }
}

export function currentDraftTeam(save: DynastySave): TeamId | undefined {
  const order = draftOrder(save);
  if (save.draftPickIndex >= save.draftBoard.length) return undefined;
  return order[save.draftPickIndex % order.length];
}
