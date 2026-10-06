/**
 * Franchise history and the Hall of Fame: what a club has won, how every season went, who
 * hangs in its rafters, and the jersey and story each Hall of Famer is remembered by.
 * No React.
 */
import type { Coach, DynastySave, Player, SeasonChapter, TeamId } from "./types.ts";
import { HOF_WAIT_YEARS } from "./types.ts";
import { TEAM_META, displayName, roman, teamColors } from "./teams.ts";
import { careerTotals } from "./leaders.ts";
import { playerName } from "./players.ts";
import { AWARD_LABEL } from "./honors.ts";
import { retiredNumbers, ringOfHonor, signatureClub } from "./legacy.ts";
import { playbookFor } from "./data/coachPlans.ts";

/** League championships won before the dynasty began, by the franchise that carries them today. */
const HERITAGE: Partial<Record<TeamId, { year: number; title: string }[]>> = {
  gnb: [1929, 1930, 1931, 1936, 1939, 1944, 1961, 1962, 1965].map((year) => ({ year, title: "NFL champions" })),
  chi: [1921, 1932, 1933, 1940, 1941, 1943, 1946, 1963].map((year) => ({ year, title: "NFL champions" })),
  nyg: [1927, 1934, 1938, 1956].map((year) => ({ year, title: "NFL champions" })),
  det: [1935, 1952, 1953, 1957].map((year) => ({ year, title: "NFL champions" })),
  was: [1937, 1942].map((year) => ({ year, title: "NFL champions" })),
  crd: [1925, 1947].map((year) => ({ year, title: "NFL champions" })),
  ram: [1945, 1951].map((year) => ({ year, title: "NFL champions" })),
  phi: [1948, 1949, 1960].map((year) => ({ year, title: "NFL champions" })),
  cle: [
    ...[1946, 1947, 1948, 1949].map((year) => ({ year, title: "AAFC champions" })),
    ...[1950, 1954, 1955, 1964].map((year) => ({ year, title: "NFL champions" })),
  ],
  clt: [1958, 1959].map((year) => ({ year, title: "NFL champions" })),
  oti: [1960, 1961].map((year) => ({ year, title: "AFL champions" })),
  kan: [{ year: 1962, title: "AFL champions" }],
  sdg: [{ year: 1963, title: "AFL champions" }],
  buf: [1964, 1965].map((year) => ({ year, title: "AFL champions" })),
};

export interface Trophy {
  year: number;
  title: string;
  /** "beat the Raiders 33-14" for a game we have the score of. */
  detail?: string;
}

/** Every championship the franchise owns: the pre-1966 heritage, then what it won in this dynasty. */
export function franchiseTrophies(save: DynastySave, teamId: TeamId): Trophy[] {
  const out: Trophy[] = (HERITAGE[teamId] ?? []).filter((t) => t.year < save.startingYear).map((t) => ({ ...t }));
  for (const b of save.history.superBowls ?? []) {
    const won = b.homeScore >= b.awayScore ? b.homeId : b.awayId;
    if (won !== teamId) continue;
    const lost = won === b.homeId ? b.awayId : b.homeId;
    out.push({
      year: b.year,
      title: `Super Bowl ${roman(b.number)}`,
      detail: `beat the ${displayName(b.year, lost)} ${Math.max(b.homeScore, b.awayScore)}-${Math.min(b.homeScore, b.awayScore)}${b.mvpName ? ` · MVP ${b.mvpName}` : ""}`,
    });
  }
  return out.sort((a, b) => a.year - b.year);
}

export function franchiseSeasons(save: DynastySave, teamId: TeamId): SeasonChapter[] {
  return (save.history.seasons ?? []).filter((c) => c.teamId === teamId).sort((a, b) => a.year - b.year);
}

export interface FranchiseSummary {
  born: number;
  wins: number;
  losses: number;
  ties: number;
  seasons: SeasonChapter[];
  playoffYears: number;
  superBowlTrips: number;
  best?: SeasonChapter;
  /** Head coaches in order, from the season books. */
  coaches: { name: string; from: number; to: number; wins: number; losses: number; ties: number }[];
}

export function franchiseSummary(save: DynastySave, teamId: TeamId): FranchiseSummary {
  const t = save.teams[teamId];
  const seasons = franchiseSeasons(save, teamId);
  const coaches: FranchiseSummary["coaches"] = [];
  for (const s of seasons) {
    const name = s.coach ?? "—";
    const last = coaches[coaches.length - 1];
    if (last && last.name === name && s.year - last.to <= 1) {
      last.to = s.year;
      last.wins += s.wins;
      last.losses += s.losses;
      last.ties += s.ties;
    } else coaches.push({ name, from: s.year, to: s.year, wins: s.wins, losses: s.losses, ties: s.ties });
  }
  const pct = (s: SeasonChapter) => (s.wins + s.ties / 2) / Math.max(1, s.wins + s.losses + s.ties);
  const made = (s: SeasonChapter) => !/^Missed/.test(s.result);
  return {
    born: TEAM_META[teamId]?.born ?? save.startingYear,
    wins: t?.careerWins ?? 0,
    losses: t?.careerLosses ?? 0,
    ties: t?.careerTies ?? 0,
    seasons,
    playoffYears: seasons.filter(made).length,
    superBowlTrips: (save.history.superBowls ?? []).filter((b) => b.homeId === teamId || b.awayId === teamId).length,
    best: seasons.slice().sort((a, b) => pct(b) - pct(a) || b.pf - b.pa - (a.pf - a.pa))[0],
    coaches: coaches.reverse(),
  };
}

/** The jersey a player is remembered in: his club's colors in his years there, and his number. */
export interface JerseyLook {
  teamId: TeamId;
  year: number;
  number: number;
  name: string;
  primary: string;
  secondary: string;
}

export function jerseyFor(save: DynastySave, p: Player, teamId?: TeamId): JerseyLook {
  const club = teamId ?? signatureClub(p)?.teamId ?? (p.draftTeam as TeamId | undefined) ?? save.userTeamId;
  const years = [...(p.career ?? []), ...Object.values(p.stats)].filter((s) => s.teamId === club && s.gp > 0).map((s) => s.year);
  // The middle of his run there: Tampa's orange creamsicle for Selmon, the pewter for Brooks.
  const year = years.length ? years.sort((a, b) => a - b)[Math.floor((years.length - 1) / 2)]! : p.retiredYear ?? save.year;
  const retired = retiredNumbers(save, club).find((r) => r.playerId === p.id);
  const c = teamColors(club, year);
  return { teamId: club, year, number: retired?.n ?? p.jersey, name: p.lastName, primary: c.primary, secondary: c.secondary };
}

/** The club a coach is most tied to: the most seasons on its staff, head-coach years counting double. */
export function coachHome(save: DynastySave, c: Coach, fallback?: TeamId): TeamId {
  let best: TeamId | undefined;
  let n = 0;
  for (const [id, v] of Object.entries(c.tenure ?? {})) if (v > n) [best, n] = [id as TeamId, v];
  if (best) return best;
  const fromBooks = new Map<string, number>();
  for (const s of save.history.seasons ?? []) if (s.coach === c.name) fromBooks.set(s.teamId, (fromBooks.get(s.teamId) ?? 0) + 1);
  // Older saves only booked the owner's club; a few seasons there shouldn't outweigh a whole
  // career elsewhere, so the books only decide it with enough of them.
  for (const [id, v] of fromBooks) if (v > n && v >= 5) [best, n] = [id as TeamId, v];
  if (best) return best;
  // No staff record (older saves): the club the Hall lists him with, then where he finished.
  const listed = save.history.hof.find((m) => m.coachId === c.id)?.teamId;
  const lastClub = save.history.retirements.find((r) => r.coachId === c.id)?.teamId;
  return fallback ?? listed ?? lastClub ?? (c.teamId as TeamId | null) ?? save.userTeamId;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The production sentence that fits his position. */
function careerSentence(p: Player): string {
  const c = careerTotals(p);
  switch (p.pos) {
    case "QB":
      return `He threw for ${fmt(c.passYds)} yards and ${c.passTd} touchdowns${c.rushYds >= 2000 ? `, and ran for ${fmt(c.rushYds)} more` : ""}`;
    case "RB":
    case "FB":
      return `He ran for ${fmt(c.rushYds)} yards and ${c.rushTd} touchdowns${c.rec >= 150 ? `, and caught ${c.rec} passes for ${fmt(c.recYds)} yards` : ""}`;
    case "WR":
    case "TE":
      return `He caught ${fmt(c.rec)} passes for ${fmt(c.recYds)} yards and ${c.recTd} touchdowns`;
    case "K":
      return `He made ${c.fgMade} of ${c.fgAtt} field goals and ${c.xpMade} extra points`;
    case "P":
      return `He punted ${fmt(c.punts)} times for a ${(c.puntYds / Math.max(1, c.punts)).toFixed(1)}-yard average`;
    case "LT":
    case "LG":
    case "C":
    case "RG":
    case "RT":
      return `He anchored the line across ${c.gp} games`;
    case "CB":
    case "S":
      return `He picked off ${c.ints} passes and made ${fmt(c.tackles)} tackles`;
    default:
      return `He piled up ${Math.round(c.sacks * 10) / 10} sacks and ${fmt(c.tackles)} tackles${c.ints ? `, with ${plural(c.ints, "interception")}` : ""}`;
  }
}

/** A short plaque-style write-up of a player's career. */
export function hofWriteUp(save: DynastySave, p: Player): string {
  const rows = [...(p.career ?? []), ...Object.values(p.stats)].filter((s) => s.gp > 0);
  const years = [...new Set(rows.map((s) => s.year))].sort((a, b) => a - b);
  const home = signatureClub(p);
  const clubs = new Set(rows.map((s) => s.teamId).filter((t) => t !== "two"));
  const span = years.length ? `${years[0]}–${years[years.length - 1]}` : "";
  const homeName = home ? displayName(years[Math.floor(years.length / 2)] ?? save.year, home.teamId) : undefined;
  const parts: string[] = [];
  parts.push(
    `${playerName(p)} played ${plural(years.length, "season")}${span ? ` (${span})` : ""}${
      homeName ? (clubs.size <= 1 ? `, all of them with the ${homeName}` : `, ${home!.seasons} of them with the ${homeName}`) : ""
    }.`,
  );
  parts.push(`${careerSentence(p)}.`);
  const h = p.honors;
  const hon: string[] = [];
  if (h?.proBowl.length) hon.push(`${plural(h.proBowl.length, "Pro Bowl")}`);
  if (h?.allPro.length) hon.push(`${h.allPro.length} first-team All-Pro ${h.allPro.length === 1 ? "selection" : "selections"}`);
  const awards = new Map<string, number[]>();
  for (const a of h?.awards ?? []) awards.set(a.award, [...(awards.get(a.award) ?? []), a.year]);
  for (const [k, ys] of awards) {
    const label = AWARD_LABEL[k as keyof typeof AWARD_LABEL] ?? k;
    hon.push(ys.length > 1 ? `${ys.length} ${label} awards` : `the ${ys[0]} ${label} award`);
  }
  if (hon.length) parts.push(`He earned ${hon.length > 1 ? `${hon.slice(0, -1).join(", ")} and ${hon[hon.length - 1]}` : hon[0]}.`);
  const rings = (save.history.superBowls ?? []).filter((b) => {
    const won = b.homeScore >= b.awayScore ? b.homeId : b.awayId;
    return rows.some((s) => s.year === b.year && s.teamId === won);
  });
  if (rings.length) parts.push(`He won ${rings.length > 1 ? `${rings.length} Super Bowls` : `Super Bowl ${roman(rings[0]!.number)}`}${rings.some((b) => b.mvpId === p.id) ? ", and was the game's MVP" : ""}.`);
  if (p.hofYear) {
    const first = p.retiredYear != null && p.hofYear - p.retiredYear <= HOF_WAIT_YEARS;
    parts.push(`Enshrined in Canton in ${p.hofYear}${first ? ", on the first ballot" : ""}.`);
  }
  return parts.join(" ");
}

/** The coaching version: record, titles, the system he's remembered for, and where. */
export function coachWriteUp(save: DynastySave, c: Coach, homeClub?: TeamId): string {
  const home = homeClub ?? coachHome(save, c);
  const book = playbookFor(c.id, c.retiredYear ?? save.year);
  const rec = `${c.careerWins}-${c.careerLosses}${c.careerTies ? `-${c.careerTies}` : ""}`;
  const parts = [
    c.recordFrom
      ? `From ${c.recordFrom} on, ${c.name} coached ${plural(c.yearsCoaching || 1, "season")}, most memorably with the ${displayName(c.retiredYear ?? save.year, home)}, and went ${rec} as a head coach.`
      : `${c.name} coached ${plural(c.yearsCoaching || 1, "season")}, most memorably with the ${displayName(c.retiredYear ?? save.year, home)}, and went ${rec} as a head coach.`,
  ];
  if (c.careerTitles) parts.push(`His clubs won ${plural(c.careerTitles, "championship")}.`);
  if (book) parts.push(`His teams ran the ${book.offense} on offense and the ${book.defense} on defense.`);
  if (c.hofYear) parts.push(`Enshrined in Canton in ${c.hofYear}.`);
  return parts.join(" ");
}

/** The club's own Hall of Famers: players most tied to it and coaches who were. */
export function franchiseHallOfFamers(save: DynastySave, teamId: TeamId): { players: Player[]; coaches: Coach[] } {
  const players: Player[] = [];
  const coaches: Coach[] = [];
  for (const m of save.history.hof ?? []) {
    if (m.playerId) {
      const p = save.players[m.playerId];
      if (p && (signatureClub(p)?.teamId ?? m.teamId) === teamId) players.push(p);
    } else if (m.coachId) {
      const c = save.coaches[m.coachId];
      if (c && coachHome(save, c, m.teamId) === teamId) coaches.push(c);
    }
  }
  return { players, coaches };
}

/** Everyone the club has honored, for a quick count. */
export function honoredCount(save: DynastySave, teamId: TeamId): number {
  return retiredNumbers(save, teamId).length + ringOfHonor(save, teamId).length;
}
