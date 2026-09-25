import type { DefScheme, DynastySave, OffScheme, Player, Pos, Ratings, SeasonStats, TeamId } from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { deriveOvr, hasFullKit } from "./ratings.ts";
import { eraCollege, eraName, jerseyFor } from "./names.ts";
import { jitter, randInt } from "./rng.ts";
import { VETERANS_1966, type VetSeed } from "./data/veterans1966.ts";
import { assignKit } from "./abilities.ts";
import { lookupProfile, nameKey, nameSalt, nameVariance, ratingsFromProfile, type Arch } from "./profiles.ts";
import { STAR_PROFILES } from "./data/starProfiles.ts";
import { lookupCollege } from "./data/colleges.ts";
import { seedPriorCareer } from "./data/careerPrior.ts";
import { salaryFor } from "./salary.ts";
import { measurables } from "./development.ts";
import { applyScout } from "./scout.ts";
import { calibrateVetPeak, lookupVetArc } from "./careerArc.ts";

export const DEPTH_CHART: [Pos, number][] = [
  ["QB", 3],
  ["RB", 4],
  ["FB", 1],
  ["WR", 4],
  ["TE", 2],
  ["LT", 2],
  ["LG", 2],
  ["C", 2],
  ["RG", 2],
  ["RT", 2],
  ["DE", 4],
  ["DT", 3],
  ["OLB", 3],
  ["MLB", 2],
  ["CB", 4],
  ["S", 3],
  ["K", 1],
  ["P", 1],
];

export function emptyStats(year: number, teamId: TeamId | "two"): SeasonStats {
  return {
    year,
    teamId,
    gp: 0,
    passAtt: 0,
    passCmp: 0,
    passYds: 0,
    passTd: 0,
    passInt: 0,
    sacksThrown: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTd: 0,
    rec: 0,
    recYds: 0,
    recTd: 0,
    tackles: 0,
    sacks: 0,
    ints: 0,
    ff: 0,
    fgAtt: 0,
    fgMade: 0,
    xpAtt: 0,
    xpMade: 0,
    punts: 0,
    puntYds: 0,
    krYds: 0,
    prYds: 0,
    targets: 0,
    tfl: 0,
    pd: 0,
    qbHits: 0,
    fr: 0,
    krTd: 0,
    prTd: 0,
  };
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function playerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function nextPlayerId(save: DynastySave, prefix: string): string {
  save.nextPlayerSeq += 1;
  return `${prefix}-${save.nextPlayerSeq}`;
}

export function makePlayer(
  save: DynastySave,
  opts: {
    firstName: string;
    lastName: string;
    pos: Pos;
    teamId: Player["teamId"];
    ovr: number;
    age: number;
    historical: boolean;
    generated: boolean;
    college?: string;
    jersey?: number;
    draftYear?: number;
    draftRound?: number;
    id?: string;
    arch?: Arch;
    heightIn?: number;
    weight?: number;
    forty?: number;
    rt?: Partial<Ratings>;
  },
): Player {
  const prof = lookupProfile(opts.pos, opts.firstName, opts.lastName);
  const star = STAR_PROFILES[nameKey(opts.firstName, opts.lastName)];
  const arch = star?.arch ?? opts.arch ?? prof.arch;
  const extra = { ...opts.rt, ...prof.rt };
  const hasLock = Object.keys(extra).length > 0;
  const jitterFn = opts.historical
    ? nameVariance(opts.firstName, opts.lastName, hasLock ? 1 : 2)
    : (n: number) => jitter(save, n, hasLock ? 1 : 2);
  const ratings = ratingsFromProfile(opts.pos, opts.ovr, arch, extra, jitterFn);
  const ovr = deriveOvr(opts.pos, ratings);
  const kit = assignKit(opts.pos, ratings, opts.firstName, opts.lastName);
  const id =
    opts.id ??
    (opts.historical
      ? `h-${slug(opts.lastName)}-${slug(opts.firstName)}-${opts.pos}`
      : nextPlayerId(save, "g"));
  let finalId = id;
  if (save.players[finalId]) finalId = nextPlayerId(save, opts.historical ? "h" : "g");
  const salt = nameSalt(opts.firstName, opts.lastName);
  const p: Player = {
    id: finalId,
    firstName: opts.firstName,
    lastName: opts.lastName,
    pos: opts.pos,
    teamId: opts.teamId,
    ratings,
    ovr,
    scoutOvr: ovr,
    potential: ovr,
    morale: 72,
    revealed: true,
    snaps: 0,
    age: opts.age,
    yearsPro: opts.draftYear === save.year ? 0 : Math.max(0, opts.age - 22),
    jersey: opts.jersey ?? 0,
    college: opts.college ?? lookupCollege(opts.firstName, opts.lastName),
    historical: opts.historical,
    generated: opts.generated,
    draftYear: opts.draftYear,
    draftRound: opts.draftRound,
    userTied: opts.teamId === save.userTeamId,
    peakOvr: ovr,
    contractYears: randInt(save, 1, 4),
    salary: salaryFor(save.year, ovr, opts.age, opts.pos),
    abilities: kit.abilities,
    traits: kit.traits,
    arch,
    injuredWeeks: 0,
    onIR: false,
    stats: {},
    career: [],
    ...measurables(opts.pos, ovr, ratings.speed, salt),
    ...(star?.ht || opts.heightIn || prof.ht ? { heightIn: star?.ht ?? opts.heightIn ?? prof.ht } : {}),
    ...(star?.wt || opts.weight || prof.wt ? { weight: star?.wt ?? opts.weight ?? prof.wt } : {}),
    ...(star?.fy || opts.forty || prof.fy ? { forty: star?.fy ?? opts.forty ?? prof.fy } : {}),
  };
  applyScout(save, p);
  save.players[p.id] = p;
  return p;
}

export function addToRoster(save: DynastySave, teamId: TeamId, playerId: string): void {
  const team = save.teams[teamId];
  if (!team) return;
  if (!team.roster.includes(playerId)) team.roster.push(playerId);
  const p = save.players[playerId];
  if (p) {
    p.teamId = teamId;
    if (teamId === save.userTeamId) p.userTied = true;
  }
  syncDepth(save, teamId);
}

export function removeFromRoster(save: DynastySave, teamId: TeamId, playerId: string): void {
  const team = save.teams[teamId];
  if (!team) return;
  team.roster = team.roster.filter((id) => id !== playerId);
  if (team.depth) {
    for (const pos of Object.keys(team.depth) as Pos[]) {
      team.depth[pos] = (team.depth[pos] ?? []).filter((id) => id !== playerId);
    }
  }
}

export function movePlayer(save: DynastySave, playerId: string, to: TeamId | "fa"): void {
  const p = save.players[playerId];
  if (!p) return;
  const from = p.teamId;
  if (p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof") {
    removeFromRoster(save, p.teamId, playerId);
  }
  if (to === "fa") {
    p.teamId = "fa";
  } else {
    addToRoster(save, to, playerId);
  }
  if (from !== "fa" && from !== "retired" && from !== "hof") syncDepth(save, from);
}

export function pruneRoster(save: DynastySave, teamId: TeamId): void {
  const team = save.teams[teamId];
  if (!team) return;
  team.roster = team.roster.filter((id) => {
    const p = save.players[id];
    return !!p && p.teamId === teamId;
  });
}

export function rosterOf(save: DynastySave, teamId: TeamId): Player[] {
  const team = save.teams[teamId];
  if (!team) return [];
  return team.roster
    .map((id) => save.players[id])
    .filter((p): p is Player => !!p && p.teamId === teamId);
}

/** Roster minus anyone parked on IR — this is what counts against the 53-man cap. */
export function activeRosterOf(save: DynastySave, teamId: TeamId): Player[] {
  return rosterOf(save, teamId).filter((p) => !p.onIR);
}

/** Depth-aware starters. Injured skip. Empty depth falls back to ovr. */
export function starters(save: DynastySave, teamId: TeamId, pos: Pos, n = 1): Player[] {
  if (n <= 0) return [];
  const team = save.teams[teamId];
  const roster = rosterOf(save, teamId).filter((p) => p.pos === pos);
  const healthy = roster.filter((p) => p.injuredWeeks <= 0 && !p.onIR);
  const order = team?.depth?.[pos] ?? [];
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const id of order) {
    const p = healthy.find((x) => x.id === id);
    if (p && !seen.has(p.id)) {
      out.push(p);
      seen.add(p.id);
    }
    if (out.length >= n) return out;
  }
  const rest = healthy.filter((p) => !seen.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  for (const p of rest) {
    out.push(p);
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

export function depthAt(save: DynastySave, teamId: TeamId, pos: Pos): Player[] {
  const team = save.teams[teamId];
  const roster = rosterOf(save, teamId).filter((p) => p.pos === pos);
  const order = team?.depth?.[pos] ?? [];
  const seen = new Set<string>();
  const out: Player[] = [];
  for (const id of order) {
    const p = roster.find((x) => x.id === id);
    if (p && !seen.has(p.id)) {
      out.push(p);
      seen.add(p.id);
    }
  }
  for (const p of roster.sort((a, b) => b.ovr - a.ovr)) {
    if (!seen.has(p.id)) out.push(p);
  }
  return out;
}

/**
 * A flat ovr sort picked your best pure athlete regardless of whether he actually
 * fits what the coach calls - a possession-route TE would rank ahead of a better
 * blocking one even under a smashmouth staff that needs him in-line. This nudges
 * the ranking toward the trait each scheme actually leans on, without swamping ovr:
 * it only matters as a tiebreaker between players who are otherwise close.
 */
function schemeDepthScore(p: Player, off?: OffScheme, def?: DefScheme): number {
  const r = p.ratings;
  let bonus = 0;
  if (off === "vertical" && (p.pos === "WR" || p.pos === "TE")) bonus += (r.speed - 75) * 0.15;
  if (off === "westcoast" && (p.pos === "WR" || p.pos === "TE")) bonus += (r.catch + r.rrt - 150) * 0.08;
  if (off === "smashmouth" && p.pos === "RB") bonus += (r.truck - 75) * 0.15;
  if (off === "smashmouth" && ["LT", "LG", "C", "RG", "RT", "FB"].includes(p.pos)) bonus += (r.runBlk - 75) * 0.15;
  if (def === "cover-2" && (p.pos === "CB" || p.pos === "S")) bonus += (r.cov - 75) * 0.15;
  if (def === "3-4" && (p.pos === "OLB" || p.pos === "DE")) bonus += (r.pur - 75) * 0.15;
  if (def === "wide-9" && (p.pos === "DE" || p.pos === "OLB")) bonus += (r.prs - 75) * 0.15;
  return bonus;
}

/**
 * How many players actually take the field at a position under the team's current
 * scheme, so "starter" highlighting matches the personnel grouping that scheme runs
 * (e.g. vertical goes 3-WR/no-FB, 3-4 goes 3-DL/4-LB) instead of a flat top-1 guess.
 */
export function starterCount(pos: Pos, off?: OffScheme, def?: DefScheme): number {
  if (pos === "WR") return off === "vertical" ? 3 : off === "smashmouth" ? 1 : 2;
  if (pos === "TE") return off === "smashmouth" ? 2 : 1;
  if (pos === "FB") return off === "vertical" ? 0 : 1;
  if (pos === "DT") return def === "3-4" ? 1 : 2;
  if (pos === "MLB") return def === "3-4" ? 2 : 1;
  if (pos === "DE" || pos === "OLB" || pos === "CB" || pos === "S") return 2;
  return 1;
}

/** Whether p is in the group of players who actually take the field at his position under his team's current scheme. */
export function isStarter(save: DynastySave, p: Player): boolean {
  const team = save.teams[p.teamId as TeamId];
  if (!team) return false;
  const n = starterCount(p.pos, team.offScheme, team.defScheme);
  return starters(save, p.teamId as TeamId, p.pos, n).some((x) => x.id === p.id);
}

export function syncDepth(save: DynastySave, teamId: TeamId): void {
  const team = save.teams[teamId];
  if (!team) return;
  team.depth = team.depth ?? {};
  const roster = rosterOf(save, teamId);
  // The owner's own depth chart is theirs to set; new arrivals just join the bottom. CPU
  // staffs re-rank on merit every time, with a small nod to the incumbent - otherwise a raw
  // rookie slotted behind a journeyman stays there for good after he's become the better player.
  const cpu = teamId !== save.userTeamId || save.cpuOnly;
  for (const [pos] of DEPTH_CHART) {
    const prevOrder = team.depth[pos] ?? [];
    const score = (p: Player) =>
      p.ovr + schemeDepthScore(p, team.offScheme, team.defScheme) + (cpu && prevOrder[0] === p.id ? 2 : 0);
    const have = roster.filter((p) => p.pos === pos).sort((a, b) => score(b) - score(a));
    if (cpu) {
      team.depth[pos] = have.map((p) => p.id);
      continue;
    }
    const prev = prevOrder.filter((id) => have.some((p) => p.id === id));
    const missing = have.filter((p) => !prev.includes(p.id)).map((p) => p.id);
    team.depth[pos] = [...prev, ...missing];
  }
}

export function usedJerseys(save: DynastySave, teamId: TeamId): Set<number> {
  return new Set(rosterOf(save, teamId).map((p) => p.jersey));
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

/** Same first name plus a near-identical last name (e.g. "Nelson" vs "Nelsen") reads as
 * the same guy twice on a depth chart, so a freshly generated filler must not land on it. */
function namesTooClose(existing: Player, candidate: { first: string; last: string }): boolean {
  if (existing.firstName !== candidate.first) return false;
  return levenshtein(existing.lastName, candidate.last) <= 2;
}

export function generatePlayer(
  save: DynastySave,
  pos: Pos,
  teamId: Player["teamId"],
  ovr: number,
  age?: number,
): Player {
  const teammates =
    teamId !== "fa" && teamId !== "retired" && teamId !== "hof" ? rosterOf(save, teamId) : [];
  let name = eraName(save);
  for (let tries = 0; tries < 8 && teammates.some((t) => namesTooClose(t, name)); tries++) {
    name = eraName(save);
  }
  const used = teamId !== "fa" && teamId !== "retired" && teamId !== "hof" ? usedJerseys(save, teamId) : new Set<number>();
  const p = makePlayer(save, {
    firstName: name.first,
    lastName: name.last,
    pos,
    teamId,
    ovr,
    age: age ?? randInt(save, 22, 30),
    historical: false,
    generated: true,
    college: eraCollege(save),
    jersey: jerseyFor(save, pos, used),
  });
  if (teamId !== "fa" && teamId !== "retired" && teamId !== "hof") addToRoster(save, teamId, p.id);
  return p;
}

export function seedVeterans(save: DynastySave): void {
  const seen = new Set<string>();
  for (const v of VETERANS_1966 as VetSeed[]) {
    const key = `${v.t}:${v.f}:${v.l}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const used = usedJerseys(save, v.t);
    const jersey = v.n && !used.has(v.n) ? v.n : jerseyFor(save, v.p, used);
    const p = makePlayer(save, {
      firstName: v.f,
      lastName: v.l,
      pos: v.p,
      teamId: v.t,
      ovr: v.o,
      age: v.a,
      historical: true,
      generated: false,
      college: v.c ?? lookupCollege(v.f, v.l),
      jersey,
    });
    if (p.yearsPro > 0) p.career = seedPriorCareer(p, save.year - 1);
    const arc = lookupVetArc(v.f, v.l, v.p);
    if (arc) {
      p.arc = arc;
      calibrateVetPeak(p, save.year);
    }
    addToRoster(save, v.t, p.id);
  }
}

export function fillRoster(save: DynastySave, teamId: TeamId): void {
  pruneRoster(save, teamId);
  for (const [pos, need] of DEPTH_CHART) {
    let have = rosterOf(save, teamId).filter((p) => p.pos === pos).length;
    let slot = have;
    while (have < need) {
      const ovr =
        slot === 0 ? randInt(save, 68, 78) : slot === 1 ? randInt(save, 58, 70) : randInt(save, 48, 62);
      generatePlayer(save, pos, teamId, ovr);
      have += 1;
      slot += 1;
    }
  }
  let guard = 0;
  while (rosterOf(save, teamId).length < ROSTER_TARGET && guard++ < 80) {
    const pos = DEPTH_CHART[randInt(save, 0, DEPTH_CHART.length - 1)]![0];
    generatePlayer(save, pos, teamId, randInt(save, 48, 64));
  }
  trimRoster(save, teamId);
  guard = 0;
  while (rosterOf(save, teamId).length < ROSTER_TARGET && guard++ < 40) {
    const pos = DEPTH_CHART[randInt(save, 0, DEPTH_CHART.length - 1)]![0];
    generatePlayer(save, pos, teamId, randInt(save, 48, 64));
  }
  syncDepth(save, teamId);
}

export function trimRoster(save: DynastySave, teamId: TeamId, cap = ROSTER_TARGET): void {
  pruneRoster(save, teamId);
  const roster = rosterOf(save, teamId).slice().sort((a, b) => b.ovr - a.ovr);
  if (roster.length <= cap) return;
  const keep = new Set<string>();
  for (const [pos, need] of DEPTH_CHART) {
    for (const p of roster.filter((x) => x.pos === pos).slice(0, need)) keep.add(p.id);
  }
  for (const p of roster) {
    if (keep.size >= cap) break;
    keep.add(p.id);
  }
  for (const p of roster) {
    if (!keep.has(p.id)) movePlayer(save, p.id, "fa");
  }
  syncDepth(save, teamId);
}

export function yearStats(p: Player, year: number, teamId: TeamId): SeasonStats {
  const existing = p.stats[year];
  if (existing) return existing;
  const s = emptyStats(year, teamId);
  p.stats[year] = s;
  return s;
}

export function allPlayers(save: DynastySave): Player[] {
  return Object.values(save.players);
}

export function hasKit(p: Player): boolean {
  return hasFullKit(p.ratings);
}
