/**
 * Franchise legacy: numbers a club puts away for good, its Ring of Honor, and the case each
 * honoree built wearing its colors - the line, the hardware, the best moments.
 */
import type { DynastySave, Player, RetiredNumber, RingOfHonorEntry, SeasonStats, TeamId } from "./types.ts";
import { addNews } from "./news.ts";
import { carryJersey, playerName, rosterOf } from "./players.ts";
import { displayName, roman } from "./teams.ts";
import { AWARD_LABEL } from "./honors.ts";

export function retiredNumbers(save: DynastySave, teamId: TeamId): RetiredNumber[] {
  return save.history.retiredNumbers?.[teamId] ?? [];
}

export function ringOfHonor(save: DynastySave, teamId: TeamId): RingOfHonorEntry[] {
  return save.history.ringOfHonor?.[teamId] ?? [];
}

/** Every season he played for this club, in order. */
export function clubSeasons(p: Player, teamId: TeamId): SeasonStats[] {
  const rows = [...(p.career ?? []), ...Object.values(p.stats)].filter((s) => s.teamId === teamId && s.gp > 0);
  const byYear = new Map<number, SeasonStats>();
  for (const r of rows) byYear.set(r.year, r);
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** The club he's most tied to: the most seasons played there. */
export function signatureClub(p: Player): { teamId: TeamId; seasons: number } | undefined {
  const count = new Map<string, number>();
  for (const s of [...(p.career ?? []), ...Object.values(p.stats)]) {
    if (s.teamId === "two" || !s.gp) continue;
    count.set(s.teamId, (count.get(s.teamId) ?? 0) + 1);
  }
  let best: { teamId: TeamId; seasons: number } | undefined;
  for (const [teamId, seasons] of count) if (!best || seasons > best.seasons) best = { teamId: teamId as TeamId, seasons };
  return best;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** A season line that fits his position: "4,413 pass yds · 32 TD". */
export function seasonLine(p: Player, s: Pick<SeasonStats, keyof SeasonStats>): string {
  const bits: string[] = [];
  if (s.passAtt >= 100) bits.push(`${fmt(s.passYds)} pass yds`, `${s.passTd} TD`, `${s.passInt} INT`);
  if (s.rushAtt >= 60) bits.push(`${fmt(s.rushYds)} rush yds`, `${s.rushTd} rush TD`);
  if (s.rec >= 20) bits.push(`${s.rec} rec`, `${fmt(s.recYds)} yds`, `${s.recTd} rec TD`);
  if (s.sacks >= 3) bits.push(`${Math.round(s.sacks * 10) / 10} sacks`);
  if (s.ints >= 2) bits.push(`${s.ints} INT`);
  if (s.fgAtt >= 10) bits.push(`${s.fgMade}/${s.fgAtt} FG`);
  if (s.punts >= 20) bits.push(`${s.punts} punts, ${(s.puntYds / Math.max(1, s.punts)).toFixed(1)} avg`);
  if (!bits.length && s.tackles >= 20) bits.push(`${s.tackles} tackles`);
  if (!bits.length) bits.push(`${s.gp} games`);
  return bits.slice(0, 4).join(" · ");
}

/** How big a season was, for picking his best one. */
function seasonWeight(p: Player, s: SeasonStats): number {
  switch (p.pos) {
    case "QB":
      return s.passYds + s.passTd * 60 - s.passInt * 45 + s.rushYds;
    case "RB":
    case "FB":
      return s.rushYds + s.recYds * 0.8 + (s.rushTd + s.recTd) * 60;
    case "WR":
    case "TE":
      return s.recYds + s.recTd * 60 + s.rec * 3;
    case "K":
      return s.fgMade * 30 + (s.fgAtt ? (s.fgMade / s.fgAtt) * 400 : 0);
    case "P":
      return s.punts ? s.puntYds / s.punts : 0;
    default:
      return s.sacks * 80 + s.ints * 90 + s.tackles * 4 + s.ff * 40 + s.pd * 10;
  }
}

function sum(rows: SeasonStats[]): SeasonStats {
  const acc: Record<string, unknown> = { ...(rows[0] ?? {}) };
  for (const k of Object.keys(acc)) if (typeof acc[k] === "number") acc[k] = 0;
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) if (k !== "year" && typeof v === "number") acc[k] = ((acc[k] as number) ?? 0) + v;
  }
  return acc as unknown as SeasonStats;
}

export interface LegacyCase {
  teamId: TeamId;
  seasons: number;
  span: string;
  line: string;
  honors: string[];
  moments: string[];
  titles: number;
}

/** What he did in this club's colors: the line, the hardware, the nights people remember. */
export function legacyCase(save: DynastySave, p: Player, teamId: TeamId): LegacyCase | undefined {
  const rows = clubSeasons(p, teamId);
  if (!rows.length) return undefined;
  const years = new Set(rows.map((r) => r.year));
  const first = rows[0]!.year;
  const last = rows[rows.length - 1]!.year;
  const line = seasonLine(p, sum(rows));
  const honors: string[] = [];
  const moments: string[] = [];
  const pb = (p.honors?.proBowl ?? []).filter((y) => years.has(y)).length;
  const ap = (p.honors?.allPro ?? []).filter((y) => years.has(y)).length;
  if (pb) honors.push(pb > 1 ? `${pb}× Pro Bowl` : "Pro Bowl");
  if (ap) honors.push(ap > 1 ? `${ap}× All-Pro` : "All-Pro");
  const awards = (p.honors?.awards ?? []).filter((a) => years.has(a.year));
  const byAward = new Map<string, number[]>();
  for (const a of awards) byAward.set(a.award, [...(byAward.get(a.award) ?? []), a.year]);
  for (const [award, ys] of byAward) {
    const label = AWARD_LABEL[award as keyof typeof AWARD_LABEL] ?? award;
    honors.push(ys.length > 1 ? `${ys.length}× ${label}` : `${label} ${ys[0]}`);
  }
  let titles = 0;
  for (const b of save.history.superBowls ?? []) {
    if (!years.has(b.year)) continue;
    const won = b.homeScore >= b.awayScore ? b.homeId : b.awayId;
    const lost = won === b.homeId ? b.awayId : b.homeId;
    const score = `${Math.max(b.homeScore, b.awayScore)}-${Math.min(b.homeScore, b.awayScore)}`;
    if (won === teamId) {
      titles += 1;
      moments.push(
        b.mvpId === p.id
          ? `Super Bowl ${roman(b.number)} MVP: beat the ${displayName(b.year, lost)} ${score}.`
          : `Won Super Bowl ${roman(b.number)} over the ${displayName(b.year, lost)}, ${score}.`,
      );
    } else if (lost === teamId && b.mvpId === p.id) {
      moments.push(`Super Bowl ${roman(b.number)} MVP in a loss to the ${displayName(b.year, won)}.`);
    }
  }
  if (titles) honors.unshift(titles > 1 ? `${titles}× champion` : "Champion");
  for (const a of awards.filter((x) => x.award === "MVP")) moments.push(`League MVP in ${a.year}.`);
  const best = rows.slice().sort((a, b) => seasonWeight(p, b) - seasonWeight(p, a))[0];
  if (best && rows.length > 1) moments.push(`Best year: ${best.year}, ${seasonLine(p, best)}.`);
  const playoffs = Object.values(p.playoffStats ?? {}).filter((s) => s.teamId === teamId && s.gp > 0);
  const pg = playoffs.reduce((n, s) => n + s.gp, 0);
  if (pg >= 4) moments.push(`${pg} playoff games in these colors.`);
  return {
    teamId,
    seasons: rows.length,
    span: first === last ? `${first}` : `${first}-${last}`,
    line,
    honors,
    moments: moments.slice(0, 5),
    titles,
  };
}

function reissueWearers(save: DynastySave, teamId: TeamId, n: number, honoree: string): void {
  for (const p of rosterOf(save, teamId)) {
    if (p.id === honoree || p.jersey !== n) continue;
    const was = p.jersey;
    p.jersey = carryJersey(save, p, teamId);
    if (teamId === save.userTeamId) {
      addNews(save, {
        kind: "transaction",
        headline: `${playerName(p)} gives up #${was}`,
        body: `The number goes to the rafters. He'll wear #${p.jersey}.`,
        teamIds: [teamId],
        playerIds: [p.id],
      });
    }
  }
}

export function isNumberRetired(save: DynastySave, teamId: TeamId, n: number): boolean {
  return retiredNumbers(save, teamId).some((r) => r.n === n);
}

export function canRetireNumber(save: DynastySave, p: Player, teamId: TeamId): boolean {
  if (!(p.jersey > 0) && !(p.jersey === 0 && save.year >= 2023)) return false;
  if (isNumberRetired(save, teamId, p.jersey)) return false;
  if (retiredNumbers(save, teamId).some((r) => r.playerId === p.id)) return false;
  return clubSeasons(p, teamId).length >= 3;
}

/** Put his number away. Anyone else on the roster wearing it takes a new one. */
export function retireNumber(save: DynastySave, playerId: string, teamId: TeamId = save.userTeamId, quiet = false): string | undefined {
  const p = save.players[playerId];
  if (!p || !canRetireNumber(save, p, teamId)) return undefined;
  const all = (save.history.retiredNumbers ??= {});
  const list = (all[teamId] ??= []);
  list.push({ n: p.jersey, playerId, year: save.year });
  list.sort((a, b) => a.n - b.n);
  reissueWearers(save, teamId, p.jersey, playerId);
  if (!quiet) {
    addNews(save, {
      kind: "headline",
      headline: `The ${displayName(save.year, teamId)} retire #${p.jersey}`,
      body: `Nobody wears ${playerName(p)}'s number again.`,
      teamIds: [teamId],
      playerIds: [playerId],
    });
  }
  return `#${p.jersey} goes to the rafters. Nobody wears it again.`;
}

export function inRing(save: DynastySave, teamId: TeamId, playerId: string): boolean {
  return ringOfHonor(save, teamId).some((r) => r.playerId === playerId);
}

export function canInductRing(save: DynastySave, p: Player, teamId: TeamId): boolean {
  return !inRing(save, teamId, p.id) && clubSeasons(p, teamId).length >= 3;
}

export function inductRing(save: DynastySave, playerId: string, teamId: TeamId = save.userTeamId, quiet = false): string | undefined {
  const p = save.players[playerId];
  if (!p || !canInductRing(save, p, teamId)) return undefined;
  const all = (save.history.ringOfHonor ??= {});
  (all[teamId] ??= []).push({ playerId, year: save.year });
  if (!quiet) {
    addNews(save, {
      kind: "headline",
      headline: `${playerName(p)} goes into the ${displayName(save.year, teamId)} Ring of Honor`,
      body: "His name goes up on the stadium facade for good.",
      teamIds: [teamId],
      playerIds: [playerId],
    });
  }
  return `${playerName(p)} goes up in the Ring of Honor.`;
}

/** Legends the owner's club could still honor: retired, three seasons or more, a real case. */
export function legacyCandidates(save: DynastySave): Player[] {
  const u = save.userTeamId;
  return Object.values(save.players)
    .filter((p) => (p.teamId === "retired" || p.teamId === "hof") && p.userTied)
    .filter((p) => canInductRing(save, p, u) || canRetireNumber(save, p, u))
    .map((p) => ({ p, c: legacyCase(save, p, u)! }))
    .filter(({ p, c }) => c && (c.seasons >= 5 || c.honors.length > 0) && (p.peakOvr >= 80 || c.honors.length >= 2 || !!p.hofYear))
    .sort((a, b) => Number(!!b.p.hofYear) - Number(!!a.p.hofYear) || b.c.honors.length - a.c.honors.length || b.p.peakOvr - a.p.peakOvr)
    .map((x) => x.p)
    .slice(0, 12);
}

/**
 * On induction day the rest of the league honors its own: a club where a new Hall of Famer
 * spent six years or more retires his number, and four or more puts him in its Ring. The
 * owner's club makes its own call.
 */
export function honorInductees(save: DynastySave, playerIds: string[]): void {
  for (const id of playerIds) {
    const p = save.players[id];
    if (!p) continue;
    const club = signatureClub(p);
    if (!club || club.teamId === save.userTeamId || !save.teams[club.teamId]) continue;
    if (club.seasons >= 4) inductRing(save, id, club.teamId, true);
    if (club.seasons >= 6) retireNumber(save, id, club.teamId, true);
  }
}
