/** Training camp: cuts, battles, and nicks. Engine-only. */
import type { CampReport, DynastySave, Player, Pos, TeamId } from "./types.ts";
import { ROSTER_TARGET } from "./types.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { DEPTH_CHART, fillRoster, movePlayer, playerName, rosterOf, syncDepth } from "./players.ts";
import { signPlayer } from "./gm.ts";
import { rand, randInt } from "./rng.ts";
import { addNews } from "./news.ts";

const CAMP_BUGS = ["ankle", "hamstring", "shoulder", "groin", "knee", "wrist", "foot", "ribs"];

function cpuTrim(save: DynastySave, teamId: TeamId, cap = ROSTER_TARGET): { playerId: string; teamId: TeamId }[] {
  const roster = rosterOf(save, teamId).slice().sort((a, b) => b.ovr - a.ovr);
  if (roster.length <= cap) return [];
  const keep = new Set<string>();
  for (const [pos, need] of DEPTH_CHART) {
    for (const p of roster.filter((x) => x.pos === pos).slice(0, need)) keep.add(p.id);
  }
  for (const p of roster) {
    if (keep.size >= cap) break;
    keep.add(p.id);
  }
  const cuts: { playerId: string; teamId: TeamId }[] = [];
  for (const p of roster) {
    if (keep.has(p.id)) continue;
    movePlayer(save, p.id, "fa");
    cuts.push({ playerId: p.id, teamId });
  }
  syncDepth(save, teamId);
  return cuts;
}

function nickPlayer(save: DynastySave, p: Player, weeks: number, name: string): void {
  p.injuredWeeks = Math.max(p.injuredWeeks, weeks);
  p.injuryName = name;
}

function battlesFor(save: DynastySave, teamId: TeamId): CampReport["battles"] {
  const out: CampReport["battles"] = [];
  for (const [pos] of DEPTH_CHART) {
    const pool = rosterOf(save, teamId)
      .filter((p) => p.pos === pos && p.injuredWeeks <= 0)
      .sort((a, b) => b.ovr - a.ovr);
    if (pool.length < 2) continue;
    const a = pool[0]!;
    const b = pool[1]!;
    if (a.ovr - b.ovr > 4) continue;
    const note =
      a.ovr === b.ovr
        ? `${playerName(a)} and ${playerName(b)} are even. The first snap in September is unclaimed.`
        : `${playerName(b)} is close enough that ${pos} is a fight, not a listing.`;
    out.push({ pos: pos as Pos, starterId: a.id, backupId: b.id, note });
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * The owner's safety net: nobody opens a season short-handed. If the roster is under the
 * minimum after free agency, the staff signs the best free agents at the empty spots first,
 * then the best available overall, and only calls up camp bodies if the market is dry.
 */
function staffFill(save: DynastySave, teamId: TeamId): void {
  const start = rosterOf(save, teamId).length;
  if (start >= ROSTER_TARGET) return;
  const signed: string[] = [];
  const fas = () =>
    Object.values(save.players)
      .filter((p) => p.teamId === "fa" && !save.waivers.some((w) => w.playerId === p.id))
      .sort((a, b) => b.ovr - a.ovr);
  for (const [pos, need] of DEPTH_CHART) {
    let have = rosterOf(save, teamId).filter((p) => p.pos === pos).length;
    for (const p of fas().filter((x) => x.pos === pos)) {
      if (have >= need) break;
      if (signPlayer(save, teamId, p.id, 1).ok) {
        signed.push(p.id);
        have += 1;
      }
    }
  }
  for (const p of fas()) {
    if (rosterOf(save, teamId).length >= ROSTER_TARGET) break;
    if (signPlayer(save, teamId, p.id, 1).ok) signed.push(p.id);
  }
  const before = rosterOf(save, teamId).length;
  if (before < ROSTER_TARGET) fillRoster(save, teamId);
  const called = rosterOf(save, teamId).length - before;
  syncDepth(save, teamId);
  if (!signed.length && called <= 0) return;
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} fill out the roster`,
    body: `The club reported to camp with ${start}. The staff signed ${signed.length} free agent${signed.length === 1 ? "" : "s"}${
      signed.length
        ? ` (${signed
            .slice(0, 5)
            .map((id) => playerName(save.players[id]!))
            .join(", ")}${signed.length > 5 ? " and more" : ""})`
        : ""
    }${called > 0 ? ` and brought in ${called} camp bodies` : ""} on one-year deals to get to ${rosterOf(save, teamId).length}.`,
    teamIds: [teamId],
    playerIds: signed,
  });
}

export function resolveCamp(save: DynastySave): CampReport {
  if (save.camp?.year === save.year) return save.camp;
  const cuts: CampReport["cuts"] = [];
  const injuries: CampReport["injuries"] = [];
  for (const id of activeTeamIds(save.year)) {
    if (id === save.userTeamId && !save.cpuOnly) {
      // The owner sets his own 45, but nobody carries more than the active limit into the
      // season: anything past it goes, lowest grades first, depth-chart starters protected.
      const limit = ROSTER_TARGET + 8;
      staffFill(save, id);
      const mine = cpuTrim(save, id, limit);
      if (mine.length) {
        cuts.push(...mine);
        addNews(save, {
          kind: "transaction",
          headline: `Final cuts: ${displayName(save.year, id)} trim to ${limit}`,
          body: `The staff released ${mine.length} to get under the limit: ${mine
            .slice(0, 6)
            .map((c) => playerName(save.players[c.playerId]!))
            .join(", ")}${mine.length > 6 ? " and more" : ""}.`,
          teamIds: [id],
          playerIds: mine.map((c) => c.playerId),
        });
      }
      continue;
    }
    cuts.push(...cpuTrim(save, id));
  }
  const pool = Object.values(save.players).filter(
    (p) =>
      p.teamId !== "fa" &&
      p.teamId !== "retired" &&
      p.teamId !== "hof" &&
      p.injuredWeeks <= 0 &&
      p.ratings.inj < 86,
  );
  const nicks = 2 + randInt(save, 0, 3);
  for (let i = 0; i < nicks && pool.length; i++) {
    const idx = randInt(save, 0, pool.length - 1);
    const p = pool.splice(idx, 1)[0];
    if (!p || p.teamId === "fa") continue;
    const weeks = rand(save) < 0.25 ? randInt(save, 3, 6) : randInt(save, 1, 3);
    const name = CAMP_BUGS[randInt(save, 0, CAMP_BUGS.length - 1)]!;
    nickPlayer(save, p, weeks, name);
    injuries.push({ playerId: p.id, teamId: p.teamId as TeamId, weeks, name });
  }
  const battles = battlesFor(save, save.userTeamId);
  const camp: CampReport = { year: save.year, cuts: cuts.slice(0, 18), injuries, battles };
  save.camp = camp;
  const ours = save.sandbox ? [] : injuries.filter((x) => x.teamId === save.userTeamId);
  addNews(save, {
    kind: "headline",
    headline: `${save.year} camp opens`,
    body: ours.length
      ? `${displayName(save.year, save.userTeamId)} already have names in the training room.`
      : "Cuts, nicks, and one job per jersey. September is a count, not a feeling.",
    teamIds: save.sandbox ? [] : [save.userTeamId],
    playerIds: ours.map((x) => x.playerId),
  });
  return camp;
}

export function campBubble(save: DynastySave, teamId: TeamId): Player[] {
  const roster = rosterOf(save, teamId).slice().sort((a, b) => a.ovr - b.ovr);
  const n = roster.length;
  if (n <= ROSTER_TARGET) return roster.slice(0, 6);
  return roster.slice(0, Math.min(12, n - ROSTER_TARGET + 4));
}
