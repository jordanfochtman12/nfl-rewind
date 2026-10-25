import type { DynastySave, Player, SeasonStats } from "./types.ts";
import { draftSeedsFor } from "./data/draftClasses.ts";
import { HISTORICAL_ALIASES } from "./data/playerAliases.ts";
import { cleanNameParts, historicalNameKey, normalizedName } from "./identity.ts";
import { historicalYear } from "./historicalYears.ts";
import { touchPlayers } from "./players.ts";

let yearsByName: Map<string, Set<number>> | undefined;
function catalogYears(): Map<string, Set<number>> {
  if (yearsByName) return yearsByName;
  const result = new Map<string, Set<number>>();
  const add = (name: string, year: number) => {
    const years = result.get(name) ?? new Set<number>();
    years.add(year);
    result.set(name, years);
  };
  for (let year = 1966; year <= 2026; year++) {
    for (const s of draftSeedsFor(year)) add(normalizedName(s.f, s.l), year);
  }
  for (const [year, ...names] of HISTORICAL_ALIASES) {
    for (const name of names) add(normalizedName(name), year);
  }
  yearsByName = result;
  return result;
}

function identity(p: Player): string {
  const years = catalogYears().get(normalizedName(p.firstName, p.lastName));
  // An explicit class protects legitimate namesakes in different generations.
  const year = historicalYear(
    p.firstName,
    p.lastName,
    p.arc?.dy ?? p.draftYear ?? (years?.size === 1 ? [...years][0] : undefined),
  );
  return year == null
    ? `unresolved:${p.id}`
    : `${year}:${historicalNameKey(p.firstName, p.lastName, year)}`;
}

/** Two live copies accumulated separate plays. Preserve those contributions without
 * doubling appearances or longest-play records. Pre-dynasty real stats are copies. */
function mergeLine(a: SeasonStats, b: SeasonStats): SeasonStats {
  const out = { ...a } as unknown as Record<string, unknown>;
  if (a.teamId && b.teamId && a.teamId !== b.teamId) out.teamId = "two";
  for (const [key, value] of Object.entries(b)) {
    if (typeof value !== "number" || key === "year") continue;
    const before = typeof out[key] === "number" ? (out[key] as number) : 0;
    out[key] = /^(games|gamesStarted|gs|gp)$|long/i.test(key)
      ? Math.max(before, value)
      : before + value;
  }
  return out as unknown as SeasonStats;
}

function mergePlayer(keep: Player, other: Player, start: number): void {
  keep.career ??= [];
  for (const field of ["stats", "playoffStats"] as const) {
    const target = keep[field] ?? {};
    for (const [year, line] of Object.entries(other[field] ?? {})) {
      const y = Number(year);
      target[y] = target[y] && y >= start ? mergeLine(target[y]!, line) : (target[y] ?? line);
    }
    if (Object.keys(target).length) keep[field] = target;
  }
  for (const line of other.career ?? []) {
    const i = keep.career.findIndex((s) => s.year === line.year);
    if (i < 0) keep.career.push(line);
    else if (line.year >= start) keep.career[i] = mergeLine(keep.career[i]!, line);
  }
  keep.userTied ||= other.userTied;
  keep.snaps = (keep.snaps ?? 0) + (other.snaps ?? 0);
  if (other.honors) {
    keep.honors ??= { proBowl: [], allPro: [], awards: [], rings: [] };
    for (const field of ["proBowl", "allPro", "rings"] as const) {
      keep.honors[field] = [...new Set([...keep.honors[field], ...other.honors[field]])];
    }
    for (const award of other.honors.awards) {
      if (!keep.honors.awards.some((a) => a.year === award.year && a.award === award.award))
        keep.honors.awards.push(award);
    }
  }
}

/** Repair once on load/import. Original player records are retained in the export.
 * Never fuzzy-match generated names; never reset the dynasty or its RNG. */
export function repairPlayerIdentities(save: DynastySave): void {
  const groups = new Map<string, Player[]>();
  const originalNames = new Map<string, { firstName: string; lastName: string }>();
  for (const p of Object.values(save.players)) {
    originalNames.set(p.id, { firstName: p.firstName, lastName: p.lastName });
    Object.assign(p, cleanNameParts(p.firstName, p.lastName));
    if (!p.historical) continue;
    // A record player is one real person by construction (his id is his person in the record):
    // two Ron Smiths, two Willie Davises, are two men.
    if (p.id.startsWith("r-")) continue;
    const key = identity(p);
    const original = originalNames.get(p.id)!;
    if (original.firstName !== p.firstName || original.lastName !== p.lastName) {
      const year = Number(key.split(":")[0]);
      const canonical = draftSeedsFor(year).find(
        (s) => `${year}:${historicalNameKey(s.f, s.l, year)}` === key,
      );
      if (canonical) {
        p.firstName = canonical.f;
        p.lastName = canonical.l;
      }
    }
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  const redirects = new Map<string, string>();
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const year = Number(key.split(":")[0]);
    const knownPos = draftSeedsFor(year).find(
      (p) => `${year}:${historicalNameKey(p.f, p.l, year)}` === key,
    )?.p;
    // Keep the user's ownership/contract/ratings, then an active club, then the
    // established career. Stable ID is the final deterministic tie-breaker.
    const score = (p: Player) =>
      (p.teamId === save.userTeamId ? 1e12 : 0) +
      (save.teams[p.teamId as keyof typeof save.teams] ? 1e10 : 0) +
      (p.snaps ?? 0) * 1000 +
      (p.career?.length ?? 0) * 10 +
      (p.pos === knownPos ? 2 : 0) +
      (p.draftPick ? 1 : 0);
    group.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
    const keep = group[0]!;
    save.identityRepairs ??= [];
    save.identityRepairs.push({
      keptId: keep.id,
      originals: structuredClone(group.map((p) => ({ ...p, ...originalNames.get(p.id) }))),
    });
    for (const other of group.slice(1)) {
      mergePlayer(keep, other, save.startingYear);
      redirects.set(other.id, keep.id);
      delete save.players[other.id]; touchPlayers();
    }
  }
  if (!redirects.size) return;

  // IDs appear in news, picks, awards, trade offers, box-score keys and film.
  // Redirect exact ID strings only; leave names and narrative history intact.
  function remap(value: unknown): unknown {
    if (typeof value === "string") return redirects.get(value) ?? value;
    if (Array.isArray(value)) {
      const seen = new Set<string>();
      return value.map(remap).filter((v) => {
        if (typeof v !== "string" || !save.players[v]) return true;
        if (seen.has(v)) return false;
        seen.add(v);
        return true;
      });
    }
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const dest = redirects.get(key) ?? key;
      const next = remap(v);
      if (dest in out && typeof next === "object" && next && out[dest]) {
        out[dest] = mergeLine(out[dest] as SeasonStats, next as SeasonStats);
      } else if (!(dest in out)) out[dest] = next;
    }
    return out;
  }
  for (const key of Object.keys(save) as (keyof DynastySave)[]) {
    if (key === "identityRepairs" || key === "players") continue;
    (save as unknown as Record<string, unknown>)[key] = remap(save[key]);
  }
  const board = new Map<string, DynastySave["draftBoard"][number]>();
  for (const row of save.draftBoard) {
    const prev = board.get(row.playerId);
    if (!prev || row.taken) board.set(row.playerId, row);
  }
  save.draftBoard = [...board.values()];
  for (const game of [...save.schedule, ...save.playoffGames, save.superBowl, save.proBowl]) {
    if (!game) continue;
    for (const field of ["boxHome", "boxAway"] as const) {
      if (!game[field]) continue;
      const lines = new Map<string, NonNullable<typeof game.boxHome>[number]>();
      for (const line of game[field]) {
        const prev = lines.get(line.playerId);
        lines.set(
          line.playerId,
          prev
            ? (mergeLine(
                prev as unknown as SeasonStats,
                line as unknown as SeasonStats,
              ) as unknown as typeof line)
            : line,
        );
      }
      game[field] = [...lines.values()];
    }
  }
  for (const team of Object.values(save.teams)) {
    team.roster = team.roster.filter((id) => save.players[id]?.teamId === team.id);
    for (const pos of Object.keys(team.depth) as Player["pos"][]) {
      team.depth[pos] = team.depth[pos]?.filter(
        (id) => team.roster.includes(id) && save.players[id]?.pos === pos,
      );
    }
    team.payroll = team.roster.reduce((total, id) => total + (save.players[id]?.salary ?? 0), 0);
  }
}
