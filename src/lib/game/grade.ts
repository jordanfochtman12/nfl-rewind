/** Franchise report card. No React. */
import type { DynastyGrade, DynastySave, Player, TeamId } from "./types.ts";
import { END_YEAR } from "./types.ts";
import { displayName } from "./teams.ts";
import { playerName, rosterOf } from "./players.ts";

function completedSeasons(save: DynastySave): number {
  const inSeason = ["regular", "deadline", "playoffs", "superBowl", "awards", "proBowl", "retirement", "hof", "complete"].includes(
    save.phase,
  );
  const n = save.year - save.startingYear + (inSeason ? 1 : 0);
  return Math.max(0, n);
}

function letterFor(per: number, rings: number, winningPct: number, seasons: number): string {
  if (seasons <= 0) return "—";
  if (rings >= 4 && per >= 8) return "A+";
  if (rings >= 2 && per >= 6) return "A";
  if (rings >= 1 && per >= 4) return "A-";
  if (per >= 8) return "A";
  if (per >= 6) return "B+";
  if (per >= 4.5 || (winningPct >= 0.6 && seasons >= 3)) return "B";
  if (per >= 3 || winningPct >= 0.5) return "C+";
  if (per >= 2 || winningPct >= 0.4) return "C";
  if (per >= 1) return "D";
  return "F";
}

function draftedByUser(save: DynastySave, p: Player): boolean {
  if (p.draftYear == null) return false;
  if (p.draftYear < save.startingYear) return false;
  return p.userTied || p.teamId === save.userTeamId;
}

export function gradeDynasty(save: DynastySave): DynastyGrade {
  const teamId = save.userTeamId;
  const seasons = completedSeasons(save);
  const final = save.phase === "complete" || (save.year >= END_YEAR && seasons >= END_YEAR - save.startingYear + 1);
  const t = save.teams[teamId];
  const wins = t?.careerWins ?? 0;
  const losses = t?.careerLosses ?? 0;
  const ties = t?.careerTies ?? 0;
  const games = wins + losses + ties;
  const winningPct = games ? (wins + ties * 0.5) / games : 0;

  const rings = save.history.superBowls.filter((b) => {
    const w = b.homeScore >= b.awayScore ? b.homeId : b.awayId;
    return w === teamId;
  }).length;
  const titles = save.history.championships.filter((c) => c.teamId === teamId).length;
  const winningSeasons = Math.round(winningPct * Math.max(1, seasons) * (wins >= losses ? 1 : 0.35));
  const estWinningYears = seasons === 0 ? 0 : Math.round(((wins + ties * 0.5) / Math.max(1, games)) * seasons);

  const honor = (save.history.teamOfHonor[teamId] ?? []).length;
  const hof = save.history.hof.filter((h) => {
    if (h.kind === "coach") {
      return h.teamId === teamId;
    }
    const p = save.players[h.playerId ?? ""];
    return h.teamId === teamId || p?.userTied;
  }).length;


  let draftedStars = 0;
  for (const p of Object.values(save.players) as Player[]) {
    if (!draftedByUser(save, p)) continue;
    if ((p.peakOvr ?? p.ovr) >= 88) draftedStars += 1;
  }

  const lines: DynastyGrade["lines"] = [];
  const add = (label: string, value: string, pts: number) => lines.push({ label, value, pts });

  add("Lombardi trophies", String(rings), rings * 18);
  add("League / conference titles", String(titles), titles * 5);
  add("Regular-season record", `${wins}-${losses}${ties ? `-${ties}` : ""}`, Math.round(winningPct * seasons * 4));
  add("Winning seasons (est.)", String(estWinningYears), estWinningYears * 2);
  add("Hall of Famers you touched", String(hof), hof * 4);
  add("Team of Honor", String(honor), honor * 2);
  add("Stars you drafted", String(draftedStars), draftedStars * 3);

  const now = rosterOf(save, teamId);
  const peakNow = now.slice().sort((a, b) => b.ovr - a.ovr)[0];
  if (peakNow && peakNow.ovr >= 90) add(`Present star · ${playerName(peakNow)}`, `${peakNow.ovr} ovr`, 2);

  const score = lines.reduce((n, l) => n + l.pts, 0);
  const per = seasons > 0 ? score / seasons : 0;
  const letter = letterFor(per, rings, winningPct, seasons);

  let blurb: string;
  const club = displayName(save.year, teamId as TeamId);
  if (seasons <= 0) {
    blurb = `${club} have not kicked off a counting season. The almanac is still blank.`;
  } else if (final) {
    if (rings >= 3) {
      blurb = `${club}, ${save.startingYear}–${save.year}. A rewind people will argue about. ${rings} Super Bowls. Grade ${letter}.`;
    } else if (rings >= 1) {
      blurb = `${club} got over the top ${rings === 1 ? "once" : `${rings} times`} from a ${save.startingYear} start. ${letter} dynasty.`;
    } else {
      blurb = `${seasons} winters, no Lombardi. ${club} rewrote some Sundays and not the ones that count. ${letter}.`;
    }
  } else if (rings >= 1) {
    blurb = `Through ${save.year}: ${club} already have ${rings === 1 ? "a ring" : `${rings} rings`}. The rewind is a ${letter} so far.`;
  } else {
    blurb = `Through ${save.year}, ${club} are ${wins}-${losses}. No trophy. The board still has time. ${letter}.`;
  }

  return {
    year: save.year,
    final,
    letter,
    score,
    seasons,
    rings,
    titles,
    winningSeasons: estWinningYears,
    hof,
    honor,
    draftedStars,
    wins,
    losses,
    ties,
    blurb,
    lines,
  };
}

export function touchGrade(save: DynastySave): DynastyGrade {
  const g = gradeDynasty(save);
  save.history.grade = g;
  return g;
}
