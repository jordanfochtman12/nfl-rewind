import type { DynastySave, GameResult, TeamId } from "./types.ts";
import { playoffTeamCount } from "./era.ts";
import { displayName, roman, superBowlNumber, type Conference } from "./teams.ts";
import { superBowlSite } from "./data/bowlSites.ts";
import { simGame } from "./sim.ts";
import { compareTeams, conferenceTeams, divisionWinner, playoffField } from "./standings.ts";
import { addNews } from "./news.ts";
import { pickFeaturedGame } from "./sandbox.ts";
import { developCareerWeek, snapshotCareerWeek } from "./careerDevelopment.ts";

function gid(save: DynastySave, round: string, a: string, b: string): string {
  return `${save.year}-${round}-${a}-${b}`;
}

function mkGame(
  save: DynastySave,
  round: string,
  home: TeamId,
  away: TeamId,
  week: number,
): GameResult {
  return {
    id: gid(save, round, home, away),
    year: save.year,
    week,
    phase: "playoffs",
    round,
    homeId: home,
    awayId: away,
    homeScore: 0,
    awayScore: 0,
    played: false,
  };
}

function winnerOf(g: GameResult): TeamId {
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  return g.homeScore >= g.awayScore ? home : away;
}

export function seedPlayoffs(save: DynastySave): void {
  save.playoffGames = [];
  const year = save.year;
  if (year < 1970) {
    if (year === 1966) {
      const nflE = divisionWinner(save, "NFL East");
      const nflW = divisionWinner(save, "NFL West");
      const aflE = divisionWinner(save, "AFL East");
      const aflW = divisionWinner(save, "AFL West");
      if (nflE && nflW) save.playoffGames.push(mkGame(save, "NFL Championship", nflE, nflW, 1));
      if (aflE && aflW) save.playoffGames.push(mkGame(save, "AFL Championship", aflE, aflW, 1));
      return;
    }
    const cap = divisionWinner(save, "NFL Capitol");
    const cen = divisionWinner(save, "NFL Century");
    const coa = divisionWinner(save, "NFL Coastal");
    const ctl = divisionWinner(save, "NFL Central");
    if (cap && cen) save.playoffGames.push(mkGame(save, "NFL Eastern Championship", cap, cen, 1));
    if (coa && ctl) save.playoffGames.push(mkGame(save, "NFL Western Championship", coa, ctl, 1));
    const aflE = divisionWinner(save, "AFL East");
    const aflW = divisionWinner(save, "AFL West");
    if (year === 1969) {
      const afl = conferenceTeams(save, "AFL");
      const extra = afl.filter((t) => t.id !== aflE && t.id !== aflW).slice(0, 2);
      if (aflE && extra[0]) save.playoffGames.push(mkGame(save, "AFL First Round", aflE, extra[0].id, 1));
      if (aflW && extra[1]) save.playoffGames.push(mkGame(save, "AFL First Round", aflW, extra[1].id, 1));
    } else if (aflE && aflW) {
      save.playoffGames.push(mkGame(save, "AFL Championship", aflE, aflW, 2));
    }
    return;
  }
  const n = playoffTeamCount(year).perConf;
  for (const conf of ["AFC", "NFC"] as Conference[]) {
    const field = playoffField(save, conf, n).map((t) => t.id);
    if (field.length < 2) continue;
    // Byes for the top seeds. 4: two divisional games. 5: one WC. 6+: WC pairings.
    if (n <= 4) {
      for (let i = 0; i < Math.floor(field.length / 2); i++) {
        save.playoffGames.push(mkGame(save, `${conf} Divisional`, field[i]!, field[field.length - 1 - i]!, 1));
      }
    } else {
      const byes = n === 5 ? 3 : n === 6 ? 2 : 1;
      const playing = field.slice(byes);
      for (let i = 0; i < Math.floor(playing.length / 2); i++) {
        const home = playing[i]!;
        const away = playing[playing.length - 1 - i]!;
        save.playoffGames.push(mkGame(save, `${conf} Wild Card`, home, away, 1));
      }
    }
  }
}

function unfinished(save: DynastySave): GameResult[] {
  return save.playoffGames.filter((g) => !g.played);
}

function maybeAdvanceBracket(save: DynastySave): void {
  const year = save.year;
  const un = unfinished(save);
  if (un.length) return;

  if (year < 1970) {
    const east = save.playoffGames.find((g) => g.round === "NFL Eastern Championship" && g.played);
    const west = save.playoffGames.find((g) => g.round === "NFL Western Championship" && g.played);
    if (east && west && !save.playoffGames.some((g) => g.round === "NFL Championship")) {
      save.playoffGames.push(mkGame(save, "NFL Championship", winnerOf(east), winnerOf(west), 2));
    }
    const afl1 = save.playoffGames.filter((g) => g.round === "AFL First Round" && g.played);
    if (afl1.length === 2 && !save.playoffGames.some((g) => g.round === "AFL Championship")) {
      save.playoffGames.push(mkGame(save, "AFL Championship", winnerOf(afl1[0]!), winnerOf(afl1[1]!), 2));
    }
    return;
  }

  const n = playoffTeamCount(year).perConf;
  const lost = new Set<TeamId>();
  for (const g of save.playoffGames) {
    if (!g.played) continue;
    lost.add((g.homeScore >= g.awayScore ? g.awayId : g.homeId) as TeamId);
  }
  const latestWeek = save.playoffGames.reduce((m, g) => Math.max(m, g.week), 0);
  for (const conf of ["AFC", "NFC"] as Conference[]) {
    const field = playoffField(save, conf, n).map((t) => t.id);
    const alive = field.filter((id) => !lost.has(id));
    if (alive.length <= 1) continue;
    const hasDiv = save.playoffGames.some((g) => g.round === `${conf} Divisional`);
    let round: string;
    if (alive.length === 2) round = `${conf} Championship`;
    else if (!hasDiv) round = `${conf} Divisional`;
    else round = `${conf} Championship`;
    if (save.playoffGames.some((g) => g.round === round)) continue;
    if (alive.length === 2) {
      save.playoffGames.push(mkGame(save, round, alive[0]!, alive[1]!, latestWeek + 1));
      continue;
    }
    // Pair lowest remaining seeds; odd man out has a bye.
    const ranked = alive.slice().sort((a, b) => field.indexOf(a) - field.indexOf(b));
    const bye = ranked.length % 2 === 1 ? 1 : 0;
    const playing = ranked.slice(bye);
    for (let i = 0; i < Math.floor(playing.length / 2); i++) {
      save.playoffGames.push(
        mkGame(save, round, playing[i]!, playing[playing.length - 1 - i]!, latestWeek + 1),
      );
    }
  }
}

export function playoffReadyForSuperBowl(save: DynastySave): boolean {
  if (unfinished(save).length) return false;
  maybeAdvanceBracket(save);
  if (unfinished(save).length) return false;
  if (save.year < 1970) {
    const nfl = save.playoffGames.find((g) => g.round === "NFL Championship" && g.played);
    const afl = save.playoffGames.find((g) => g.round === "AFL Championship" && g.played);
    return !!(nfl && afl);
  }
  const afc = save.playoffGames.find((g) => g.round === "AFC Championship" && g.played);
  const nfc = save.playoffGames.find((g) => g.round === "NFC Championship" && g.played);
  return !!(afc && nfc);
}

export function leagueChampions(save: DynastySave): { nfl?: TeamId; afl?: TeamId; afc?: TeamId; nfc?: TeamId } {
  const find = (round: string) => save.playoffGames.find((g) => g.round === round && g.played);
  const out: { nfl?: TeamId; afl?: TeamId; afc?: TeamId; nfc?: TeamId } = {};
  const nfl = find("NFL Championship");
  const afl = find("AFL Championship");
  const afc = find("AFC Championship");
  const nfc = find("NFC Championship");
  if (nfl) out.nfl = winnerOf(nfl);
  if (afl) out.afl = winnerOf(afl);
  if (afc) out.afc = winnerOf(afc);
  if (nfc) out.nfc = winnerOf(nfc);
  return out;
}

export function createSuperBowl(save: DynastySave): void {
  const ch = leagueChampions(save);
  const home = (ch.nfl ?? ch.nfc)!;
  const away = (ch.afl ?? ch.afc)!;
  const site = superBowlSite(save.year);
  save.superBowl = {
    id: `${save.year}-sb`,
    year: save.year,
    week: 1,
    phase: "superBowl",
    round: `Super Bowl ${roman(superBowlNumber(save.year))}`,
    homeId: home,
    awayId: away,
    homeScore: 0,
    awayScore: 0,
    played: false,
    stadium: site.site,
    neutral: true,
  };
  addNews(save, {
    kind: "headline",
    headline: `${displayName(save.year, home)} vs ${displayName(save.year, away)}`,
    body: `${site.site}, ${site.city}. ${site.flavor}`,
    teamIds: [home, away],
    playerIds: [],
  });
}

export function simPlayoffWeek(save: DynastySave): void {
  maybeAdvanceBracket(save);
  const un = unfinished(save);
  if (!un.length) {
    maybeAdvanceBracket(save);
    return;
  }
  const w = Math.min(...un.map((g) => g.week));
  pickFeaturedGame(save, un.filter((g) => g.week === w));
  const careerBefore = snapshotCareerWeek(save, true);
  for (const g of un.filter((g) => g.week === w)) simGame(save, g);
  developCareerWeek(save, careerBefore, "playoffs");
  maybeAdvanceBracket(save);
}

export function playoffWeekLabel(save: DynastySave): string {
  const u = unfinished(save);
  // The NFL and AFL title games of 1966-69 share a weekend: name both, not whichever is first.
  const titles = [...new Set(u.map((g) => g.round).filter((r): r is string => !!r && /^(NFL|AFL) Championship$/.test(r)))];
  if (titles.length === 2) return "NFL & AFL Championships";
  if (u[0]?.round) return u[0].round;
  const last = save.playoffGames[save.playoffGames.length - 1];
  return last?.round ?? "Playoffs";
}

export { compareTeams };
