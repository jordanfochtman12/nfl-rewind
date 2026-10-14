import type { DraftPickAsset, DraftSession, DynastySave, Player, Pos, Prospect, TeamId } from "./types.ts";
import { activeTeamIds, originalLeague } from "./teams.ts";
import { draftSeedsFor, type DraftSeed } from "./data/draftClasses.ts";
import { addToRoster, generatePlayer, makePlayer, playerName, rosterOf, syncDepth, touchPlayers, usedJerseys } from "./players.ts";
import { collegeNumber, eraCollege, preferredJersey } from "./names.ts";
import { lookupCollege } from "./data/colleges.ts";
import { rand, randInt } from "./rng.ts";
import { kitBoost } from "./abilities.ts";
import { addNews, addTx } from "./news.ts";
import { winPct } from "./standings.ts";
import { applyScout, visibleOvr } from "./scout.ts";
import { rookieContract } from "./salary.ts";
import { coachKitBoost } from "./coachKit.ts";
import { schemeFitPos } from "./staff.ts";
import { arcTarget, honorsFloor, lookupArc, moveToward } from "./careerArc.ts";
import { historicalNameKey, normalizedName } from "./identity.ts";
import { AUDIT_NUMBERS } from "./data/auditPlayers.ts";
import { friendOf } from "./data/friends.ts";
import { FUTURE_PROSPECTS } from "./data/futureProspects.ts";
import { historicalYear } from "./historicalYears.ts";

/** Real NFL draft lengths: 20 rounds through 1966, 17 in 1967-76, 12 in 1977-92, 8 in 1993, 7 since. */
function roundsFor(year: number): number {
  if (year <= 1966) return 20;
  if (year <= 1976) return 17;
  if (year <= 1992) return 12;
  if (year === 1993) return 8;
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

/**
 * Gives a club its picks for a year. `existing` is every pick id already issued; pass one set
 * when issuing in bulk, since every used pick of every past draft stays on the books and
 * rebuilding the set per club per year made each selection of a late draft cost seconds.
 */
export function issuePicks(save: DynastySave, year: number, teamId: TeamId, existing?: Set<string>): void {
  const t = save.teams[teamId];
  if (!t) return;
  t.picks = t.picks ?? [];
  const rounds = roundsFor(year);
  const ids = existing ?? new Set(allPicks(save).map((p) => p.id));
  for (let r = 1; r <= rounds; r++) {
    const id = `${year}-r${r}-${teamId}`;
    if (ids.has(id)) continue;
    t.picks.push({ id, year, round: r, orig: teamId, owner: teamId });
    ids.add(id);
  }
}

export function ensureSeasonPicks(save: DynastySave): void {
  const ids = new Set(allPicks(save).map((p) => p.id));
  for (const id of activeTeamIds(save.year)) {
    issuePicks(save, save.year, id, ids);
    issuePicks(save, save.year + 1, id, ids);
    issuePicks(save, save.year + 2, id, ids);
  }
}

export function findPick(
  save: DynastySave,
  year: number,
  round: number,
  orig: TeamId,
  includeUsed = false,
): DraftPickAsset | undefined {
  for (const t of Object.values(save.teams)) {
    const hit = (t.picks ?? []).find(
      (p) => p.year === year && p.round === round && p.orig === orig && (includeUsed || !p.used),
    );
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

/** Drafts that are done: their picks are spent history nothing reads again. Keeps saves and every advance lighter. */
export function prunePastPicks(save: DynastySave): void {
  for (const t of Object.values(save.teams)) {
    if (t.picks?.some((p) => p.year < save.year)) t.picks = t.picks.filter((p) => p.year >= save.year);
  }
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
  // One pass over the books for this year's picks instead of a full scan per slot.
  const slot = new Map<string, DraftPickAsset>();
  for (const t of Object.values(save.teams))
    for (const p of t.picks ?? []) if (p.year === save.year && !slot.has(`${p.round}|${p.orig}`)) slot.set(`${p.round}|${p.orig}`, p);
  const q: DraftPickAsset[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (const orig of order) {
      // The order is fixed for the whole draft: picks already made stay in their slots.
      // (Dropping used picks here shifted the queue under draftPickIndex, so every other
      // selection in the draft was skipped.)
      const asset = slot.get(`${r}|${orig}`);
      if (asset) q.push(asset);
    }
  }
  return q;
}

/** Team order for the current session (round 1 orig clubs). Used by UI. */
export function draftOrder(save: DynastySave): TeamId[] {
  return standingOrder(save, sessionTeams(save.year, sessionOf(save)));
}

/**
 * Players whose Pro Bowls came on special teams or at fullback. The imported classes rate every
 * prospect from his career honors, which turned return men and gunners into star receivers and
 * backs (Matthew Slater was a 91 WR, Kyle Juszczyk a 91 RB). These get a rating for what they
 * actually did from scrimmage, and their honors no longer lift them.
 */
const ROLE_PLAYERS: Record<string, { o: number; p?: Pos }> = {
  "Matthew|Slater": { o: 56 },
  "Kyle|Juszczyk": { o: 76, p: "FB" },
  "Brian|Mitchell": { o: 62 },
  "Devin|Hester": { o: 70, p: "WR" },
  "Dante|Hall": { o: 62 },
  "Mel|Gray": { o: 58 },
  "Michael|Bates": { o: 56 },
  "Cordarrelle|Patterson": { o: 72 },
  "Lorenzo|Neal": { o: 72 },
  "Steve|Tasker": { o: 58 },
  "Jakeem|Grant": { o: 64 },
  "Jacoby|Jones": { o: 68 },
  "Leon|Washington": { o: 68 },
  "Allen|Rossum": { o: 60 },
  "Desmond|Howard": { o: 64 },
  "Rick|Upchurch": { o: 74 },
  "Billy|Johnson": { o: 70 },
  "Vai|Sikahema": { o: 56 },
  "Mike|Alstott": { o: 80, p: "FB" },
  "Daryl|Johnston": { o: 72, p: "FB" },
  "Tom|Rathman": { o: 74, p: "FB" },
  "Sam|Gash": { o: 68 },
  "Bill|Bates": { o: 66, p: "S" },
  // His 1985-2005 span includes eight CFL seasons (1990-97) the arc can't tell apart from NFL
  // years; as a steady starter for all of it he passed for 62,000 yards (real NFL: 14,715).
  "Doug|Flutie": { o: 70 },
};

const rookieNumbers = new Map<number, Map<string, number>>();
/** The number a real rookie actually took, read from the record by draft (or first) year. */
function realRookieNumber(year: number, first: string, last: string): number | undefined {
  let m = rookieNumbers.get(year);
  if (!m) {
    m = new Map();
    for (const e of (AUDIT_NUMBERS[year] ?? "").split(",")) {
      const i = e.lastIndexOf(":");
      if (i > 0) m.set(e.slice(0, i), Number(e.slice(i + 1)));
    }
    rookieNumbers.set(year, m);
  }
  return m.get(normalizedName(first, last).replace(/[^a-z]/g, ""));
}

/** A real draftee as the draft room would have made him that year: ratings kit, arc, peak. */
export function realDraftee(save: DynastySave, seed: DraftSeed, year: number): Player {
  const was = save.year;
  save.year = year;
  try {
    return seedToPlayer(save, seed, seed.r ?? 1);
  } finally {
    save.year = was;
  }
}

function seedToPlayer(save: DynastySave, seed: DraftSeed, round: number): Player {
  const role = ROLE_PLAYERS[`${seed.f}|${seed.l}`];
  const s: DraftSeed = role ? { ...seed, o: role.o, p: role.p ?? seed.p, rt: undefined, arch: undefined, src: undefined } : seed;
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
  if (s.r) p.realRound = s.r;
  const friend = friendOf(s.f, s.l);
  // An undrafted sleeper the scouts all missed (named, so he stays in the league unsigned).
  if (friend) {
    p.hometown = friend.hometown;
    moveToward(p, friend.start);
    p.potential = friend.ceiling;
    p.peakOvr = p.ovr;
    p.gem = true;
  }
  p.collegeNo = friend?.n ?? realRookieNumber(save.year, s.f, s.l) ?? collegeNumber(p.pos, p.id);
  p.jersey = p.collegeNo;
  const found = lookupArc(save.year, s.f, s.l);
  // A role player keeps his real career span, but his Pro Bowls don't set his rating.
  const arc = found && role ? { ...found, pb: 0, ap: 0, st: Math.min(found.st, 2) } : found;
  if (arc) {
    // Seed overall is his real career peak - he arrives short of it and grows into it.
    p.arc = arc;
    if (arc.age >= 20 && arc.age <= 30) p.age = arc.age;
    const floor = honorsFloor(arc);
    if (p.ovr < floor) moveToward(p, floor);
    p.potential = p.ovr;
    moveToward(p, arcTarget(p, 0));
    p.peakOvr = p.ovr;
    p.scoutOvr = p.ovr;
  }
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
/**
 * Anyone already on record in the History tab - HOF, a franchise's single-game mark - is
 * never a deletion candidate. (A season/career leaderboard re-scan would catch more, but
 * doing that every single year is exactly the O(players x every past year) cost that made
 * a long dynasty get slower every season; the peakOvr/retirement-age floor below is the
 * actual gate keeping this safe without needing that rescan.)
 */
function recordProtectedIds(save: DynastySave): Set<string> {
  const ids = new Set<string>();
  for (const h of save.history.hof) if (h.playerId) ids.add(h.playerId);
  for (const key of Object.keys(save.teamGameRecords)) ids.add(save.teamGameRecords[key]!.playerId);
  return ids;
}

export function pruneUndraftedProspects(save: DynastySave): void {
  for (const pr of save.draftBoard) {
    if (pr.taken) continue;
    const p = save.players[pr.playerId];
    if (p && !p.historical) delete save.players[pr.playerId]; touchPlayers();
  }
  const protectedIds = recordProtectedIds(save);
  for (const [id, p] of Object.entries(save.players)) {
    if (protectedIds.has(id)) continue;
    // cpuSignNeeds only offers a couple slots a team a year and always takes the best
    // player on the wire, so a generated FA nobody signed by the next draft realistically
    // never gets picked up - no age gate needed, this was the dominant source of growth.
    if (!p.historical && p.teamId === "fa") {
      delete save.players[id]; touchPlayers();
      continue;
    }
    // Retired filler with no shot at ever ranking in a leaderboard or HOF ballot (peak
    // well under the ~64-score HOF floor) - keeps the dynasty from growing thousands of
    // dead-weight player records a 40+ year save will never look up again.
    if (
      !p.historical &&
      p.teamId === "retired" &&
      (p.peakOvr ?? p.ovr) < 65 &&
      p.retiredYear != null &&
      save.year - p.retiredYear >= 3
    ) {
      delete save.players[id]; touchPlayers();
    }
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
    const debut = historicalYear(pl.firstName, pl.lastName, pl.arc?.dy ?? pl.draftYear);
    if (pl.historical && (debut == null || debut === save.year)) {
      used.add(historicalNameKey(pl.firstName, pl.lastName, save.year));
    }
  }
  const board: Prospect[] = [];
  let slot = 1;
  // Every real draftee gets onto the board, even past the last pick - the leftovers go
  // undrafted and stay in the league as real (historical) free agents instead of being
  // thrown away. 1966 is the exception: the NFL board stops at its pick count so the AFL
  // draft that follows still has real names to take.
  const capAtPicks = session === "nfl";
  for (const s of named) {
    if (capAtPicks && board.length >= total) break;
    const key = historicalNameKey(s.f, s.l, save.year);
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
  // Past the record (no real class at all), the scouts build a whole class of their own:
  // positions drafted the way the league drafts them, a few blue-chippers up top, sleepers
  // with real ceilings late, and a deeper undrafted pool behind the picks.
  const fictional = named.length === 0;
  const want = fictional ? total + Math.round(teamsN * 1.5) : total;
  // The real college players already known for this class come first; the scouts make the rest.
  if (fictional) {
    for (const seed of FUTURE_PROSPECTS[save.year] ?? []) {
      const p = seedToPlayer(save, seed, 1);
      // A projection, not a record: the ceiling is his to reach.
      p.arc = undefined;
      p.potential = Math.min(97, p.ovr + randInt(save, 6, 14));
      board.push({ playerId: p.id, slot, taken: false, league: session });
      slot += 1;
    }
  }
  while (board.length < want) {
    const roundGuess = Math.floor(board.length / teamsN) + 1;
    const pos = fictional ? classPosition(save) : realPos[board.length % realPos.length]!;
    const ovr = fictional
      ? Math.round(Math.max(46, Math.min(84, 74 - (roundGuess - 1) * 2.6 + randInt(save, -6, 6) + (board.length < 6 ? 5 : 0))))
      : 78 - Math.floor(board.length / teamsN) * 3 - randInt(save, 0, 8);
    const p = generatePlayer(save, pos, "fa", Math.max(48, ovr), randInt(save, 21, 23));
    p.draftYear = save.year;
    p.draftRound = roundGuess;
    p.historical = false;
    p.yearsPro = 0;
    applyScout(save, p);
    if (fictional) {
      // Ceilings: everyone has one, the top of the class has the highest, and one in twenty
      // late picks turns out to be the steal of the draft.
      const sleeper = roundGuess >= 3 && rand(save) < 0.05;
      const lift = randInt(save, 3, 12) + (roundGuess <= 1 ? randInt(save, 2, 6) : 0) + (sleeper ? randInt(save, 8, 14) : 0);
      p.potential = Math.min(97, p.ovr + lift);
      if (sleeper) p.gem = true;
    }
    p.collegeNo = collegeNumber(p.pos, p.id);
    p.jersey = p.collegeNo;
    board.push({ playerId: p.id, slot, taken: false, league: session });
    slot += 1;
  }
  save.draftBoard = board;
  save.draftPickIndex = 0;
}

/** Positions in a draft class as the league really takes them (per 100 picks). */
const CLASS_MIX: [Pos, number][] = [
  ["QB", 5], ["RB", 7], ["FB", 1], ["WR", 13], ["TE", 6], ["LT", 5], ["LG", 4], ["C", 3], ["RG", 4], ["RT", 5],
  ["DE", 9], ["DT", 8], ["OLB", 8], ["MLB", 4], ["CB", 11], ["S", 7], ["K", 1], ["P", 1],
];
const MIX_TOTAL = CLASS_MIX.reduce((n, [, w]) => n + w, 0);

function classPosition(save: DynastySave): Pos {
  let r = rand(save) * MIX_TOTAL;
  for (const [pos, w] of CLASS_MIX) {
    r -= w;
    if (r < 0) return pos;
  }
  return "WR";
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
  // How the room took it, by the consensus board at that moment (never by how he turns out).
  const consensusRank = save.draftBoard.filter((x) => !x.taken).indexOf(prospect);
  const buzz: Player["draftBuzz"] =
    round > 3 ? undefined : consensusRank >= 12 + save.draftPickIndex * 0.15 ? "booed" : consensusRank <= 1 ? "cheered" : "mixed";
  prospect.taken = true;
  prospect.takenBy = teamId;
  slot.used = true;
  const p = save.players[prospect.playerId];
  if (p) {
    p.draftYear = save.year;
    p.draftRound = round;
    p.draftPick = save.draftPickIndex + 1;
    p.draftTeam = teamId;
    if (buzz) p.draftBuzz = buzz;
    // He asks for his college number; the closest open one if a veteran has it.
    p.jersey = preferredJersey(save, p.pos, p.collegeNo ?? p.jersey, usedJerseys(save, teamId));
    // Rookies are paid by slot (see rookieContract), not by grade.
    const deal = rookieContract(save.year, save.draftPickIndex + 1, round);
    p.salary = deal.salary;
    p.contractYears = deal.years;
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
