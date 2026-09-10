import type { AwardsResult, DynastySave, Player, TeamId } from "./types.ts";
import { HOF_WAIT_YEARS } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName, roman, superBowlNumber } from "./teams.ts";
import { proBowlSite, superBowlSite } from "./data/bowlSites.ts";
import { generatePlayer, playerName, rosterOf } from "./players.ts";
import { simGame } from "./sim.ts";
import { addNews } from "./news.ts";
import { rand, randInt } from "./rng.ts";
import { shouldRetire } from "./development.ts";
import { careerTotals } from "./leaders.ts";

function seasonList(save: DynastySave): Player[] {
  return Object.values(save.players).filter((p) => p.teamId !== "retired" && p.teamId !== "hof" && p.stats[save.year]);
}

function offScore(p: Player, year: number): number {
  const s = p.stats[year];
  if (!s) return 0;
  return (
    s.passYds * 0.04 +
    s.passTd * 4 +
    s.rushYds * 0.1 +
    s.rushTd * 6 +
    s.rec * 0.5 +
    s.recYds * 0.1 +
    s.recTd * 6 -
    s.passInt * 2
  );
}

function defScore(p: Player, year: number): number {
  const s = p.stats[year];
  if (!s) return 0;
  return s.sacks * 4 + s.ints * 5 + s.tackles * 0.4 + p.ovr * 0.15;
}

export function resolveAwards(save: DynastySave): AwardsResult {
  const year = save.year;
  const players = seasonList(save);
  const off = players.slice().sort((a, b) => offScore(b, year) - offScore(a, year));
  const def = players.slice().sort((a, b) => defScore(b, year) - defScore(a, year));
  const rookies = players.filter((p) => p.draftYear === year);
  const awards: AwardsResult = {
    year,
    mvp: off[0]?.id,
    offPoy: off[0]?.id,
    defPoy: def[0]?.id,
    oroy: rookies.sort((a, b) => offScore(b, year) + defScore(b, year) - (offScore(a, year) + defScore(a, year)))[0]
      ?.id,
    droy: rookies.sort((a, b) => defScore(b, year) - defScore(a, year))[0]?.id,
    cpoty: players.filter((p) => p.pos === "QB").sort((a, b) => offScore(b, year) - offScore(a, year))[1]?.id,
    allPro: [...off.slice(0, 8), ...def.slice(0, 8)].map((p) => p.id),
  };
  save.awards = awards;
  save.history.awards.push(awards);
  const mvp = awards.mvp ? save.players[awards.mvp] : undefined;
  if (mvp) {
    addNews(save, {
      kind: "award",
      headline: `${playerName(mvp)} named ${year} MVP`,
      body: `The writers land on ${playerName(mvp)} (${mvp.pos}, ${String(mvp.teamId).toUpperCase()}).`,
      teamIds: mvp.teamId !== "fa" && mvp.teamId !== "retired" && mvp.teamId !== "hof" ? [mvp.teamId] : [],
      playerIds: [mvp.id],
    });
  }
  return awards;
}

export function resolveProBowl(save: DynastySave): void {
  const year = save.year;
  const confA: TeamId[] = [];
  const confB: TeamId[] = [];
  const labelA = year < 1970 ? "NFL" : "NFC";
  const labelB = year < 1970 ? "AFL" : "AFC";
  for (const id of activeTeamIds(year)) {
    const c = conferenceOf(year, id);
    if (c === "NFL" || c === "NFC") confA.push(id);
    else confB.push(id);
  }
  const pool = (ids: TeamId[]) =>
    ids
      .flatMap((id) => rosterOf(save, id))
      .sort(
        (a, b) =>
          offScore(b, year) + defScore(b, year) + b.ovr - (offScore(a, year) + defScore(a, year) + a.ovr),
      )
      .slice(0, 22);
  const a = pool(confA);
  const b = pool(confB);
  const site = proBowlSite(year);
  const aScore = 14 + randInt(save, 0, 21);
  const bScore = 14 + randInt(save, 0, 21);
  const mvp = (aScore >= bScore ? a : b)[0];
  save.proBowl = {
    id: `${year}-pb`,
    year,
    week: 1,
    phase: "proBowl",
    round: `${year} Pro Bowl`,
    homeId: year < 1970 ? "nfl" : "nfc",
    awayId: year < 1970 ? "afl" : "afc",
    homeScore: aScore,
    awayScore: bScore,
    played: true,
    mvpPlayerId: mvp?.id,
  };
  addNews(save, {
    kind: "headline",
    headline: `${labelA} ${aScore}, ${labelB} ${bScore} at ${site.site}`,
    body: `${site.flavor} MVP: ${mvp ? playerName(mvp) : "shared"}.`,
    teamIds: [],
    playerIds: mvp ? [mvp.id] : [],
  });
}

export function gatherRetirees(save: DynastySave): string[] {
  const out: string[] = [];
  for (const p of Object.values(save.players)) {
    if (p.teamId === "retired" || p.teamId === "hof" || p.teamId === "fa") continue;
    if (shouldRetire(save, p)) out.push(p.id);
  }
  save.pendingRetirees = out.slice(0, 18);
  return save.pendingRetirees;
}

export function resolveRetirement(save: DynastySave): void {
  for (const id of save.pendingRetirees) {
    const p = save.players[id];
    if (!p) continue;
    const teamId = p.teamId;
    if (teamId !== "fa" && teamId !== "retired" && teamId !== "hof") {
      save.teams[teamId].roster = save.teams[teamId].roster.filter((x) => x !== id);
    }
    p.teamId = "retired";
    p.retiredYear = save.year + 1;
    const seasons = Math.max(1, p.yearsPro);
    const rec = {
      playerId: p.id,
      year: save.year,
      teamId: (teamId === "fa" || teamId === "retired" || teamId === "hof" ? save.userTeamId : teamId) as TeamId,
      seasons,
      blurb: (() => { const c = careerTotals(p); return `${playerName(p)} hangs them up after ${seasons} seasons. Peak ${p.peakOvr}. Career: ${c.passYds? c.passYds+" pass yds":""} ${c.rushYds? c.rushYds+" rush":""} ${c.rec? c.rec+" rec":""}`.replace(/ +/g," ").trim(); })(),
    };
    save.history.retirements.push(rec);
    if (p.historical || p.peakOvr >= 84 || p.userTied) {
      addNews(save, {
        kind: "retire",
        headline: `${playerName(p)} retires`,
        body: rec.blurb,
        teamIds: [rec.teamId],
        playerIds: [p.id],
      });
    }
  }
}

export function gatherHof(save: DynastySave): string[] {
  const year = save.year;
  const eligible = Object.values(save.players).filter((p) => {
    if (p.hofYear) return false;
    if (!p.retiredYear) return false;
    if (year + 1 < p.retiredYear + HOF_WAIT_YEARS) return false;
    return p.peakOvr >= 86 || p.historical;
  });
  eligible.sort((a, b) => b.peakOvr - a.peakOvr);
  save.pendingHof = eligible.slice(0, 5).map((p) => p.id);
  return save.pendingHof;
}

export function resolveHof(save: DynastySave): void {
  const classYear = save.year + 1;
  for (const id of save.pendingHof) {
    const p = save.players[id];
    if (!p) continue;
    p.hofYear = classYear;
    p.teamId = "hof";
    const teamId = save.userTeamId;
    const blurb = `${playerName(p)}, ${p.pos}. Canton opens the door for a peak ${p.peakOvr} talent.`;
    save.history.hof.push({ playerId: p.id, year: classYear, teamId, blurb });
    if (p.userTied) {
      const list = save.history.teamOfHonor[save.userTeamId] ?? [];
      if (!list.includes(p.id)) list.push(p.id);
      save.history.teamOfHonor[save.userTeamId] = list;
    }
    addNews(save, {
      kind: "hof",
      headline: `Hall of Fame: ${playerName(p)}`,
      body: blurb,
      teamIds: [teamId],
      playerIds: [p.id],
    });
  }
}

export function resolveSuperBowl(save: DynastySave): void {
  const g = save.superBowl;
  if (!g) return;
  if (!g.played) simGame(save, g);
  const site = superBowlSite(save.year);
  const home = g.homeId as TeamId;
  const away = g.awayId as TeamId;
  const winner = g.homeScore >= g.awayScore ? home : away;
  const mvpId = g.mvpPlayerId;
  const mvp = mvpId ? save.players[mvpId] : undefined;
  save.history.superBowls.push({
    year: save.year,
    number: superBowlNumber(save.year),
    site: site.site,
    city: site.city,
    homeId: home,
    awayId: away,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    mvpId,
    mvpName: mvp ? playerName(mvp) : undefined,
    atmosphere: site.flavor,
  });
  save.history.championships.push({
    year: save.year,
    league: save.year < 1970 ? "Super Bowl" : "NFL",
    teamId: winner,
  });
  addNews(save, {
    kind: "headline",
    headline: `${displayName(save.year, winner)} win Super Bowl ${roman(superBowlNumber(save.year))}`,
    body: `${g.homeScore}–${g.awayScore} at ${site.site}. ${mvp ? `MVP: ${playerName(mvp)}.` : ""} ${site.flavor}`,
    teamIds: [home, away],
    playerIds: mvp ? [mvp.id] : [],
  });
}

export function weekPrimetime(save: DynastySave): void {
  save.weekNews = [];
  const weekGames = save.schedule.filter((g) => g.week === save.week && g.played);
  if (!weekGames.length) return;
  const blow = [...weekGames].sort(
    (a, b) => Math.abs(b.homeScore - b.awayScore) - Math.abs(a.homeScore - a.awayScore),
  )[0];
  if (blow) {
    const w = blow.homeScore >= blow.awayScore ? blow.homeId : blow.awayId;
    const l = w === blow.homeId ? blow.awayId : blow.homeId;
    addNews(save, {
      kind: "headline",
      headline: `${displayName(save.year, w as TeamId)} ${Math.max(blow.homeScore, blow.awayScore)}, ${displayName(save.year, l as TeamId)} ${Math.min(blow.homeScore, blow.awayScore)}`,
      body:
        Math.abs(blow.homeScore - blow.awayScore) >= 17
          ? "A rout that will sit in the Monday papers."
          : "One-possession theater until the last two minutes.",
      teamIds: [w as TeamId, l as TeamId],
      playerIds: blow.mvpPlayerId ? [blow.mvpPlayerId] : [],
    });
  }
  const confs = save.year < 1970 ? (["NFL", "AFL"] as const) : (["AFC", "NFC"] as const);
  for (const conf of confs) {
    const ids = activeTeamIds(save.year).filter((id) => conferenceOf(save.year, id) === conf);
    let best: Player | undefined;
    let bestN = -1;
    for (const id of ids) {
      for (const p of rosterOf(save, id)) {
        const n = offScore(p, save.year);
        if (n > bestN) {
          bestN = n;
          best = p;
        }
      }
    }
    if (best) {
      addNews(save, {
        kind: "pow",
        headline: `${conf} Offensive Player of the Week: ${playerName(best)}`,
        body: `${best.pos} for ${displayName(save.year, best.teamId as TeamId)}.`,
        teamIds: best.teamId !== "fa" && best.teamId !== "retired" && best.teamId !== "hof" ? [best.teamId] : [],
        playerIds: [best.id],
      });
      if (conf === "NFL" || conf === "NFC") save.lastPow.nfc = best.id;
      else save.lastPow.afc = best.id;
    }
  }
  const injured = Object.values(save.players).find((p) => p.injuredWeeks > 0 && p.teamId === save.userTeamId);
  if (injured) {
    addNews(save, {
      kind: "injury",
      headline: `${playerName(injured)} week-to-week`,
      body: `The ${displayName(save.year, save.userTeamId)} list him with a ${injured.pos} injury.`,
      teamIds: [save.userTeamId],
      playerIds: [injured.id],
    });
  } else {
    const tx = save.transactions.find((t) => t.year === save.year);
    if (tx) {
      const p = save.players[tx.playerId];
      addNews(save, {
        kind: "transaction",
        headline: tx.detail,
        body: p ? `${playerName(p)} (${p.pos}).` : tx.kind,
        teamIds: [],
        playerIds: [tx.playerId],
      });
    }
  }
}

export function cpuInSeasonMoves(save: DynastySave): void {
  if (rand(save) > 0.12) return;
  const teams = activeTeamIds(save.year).filter((t) => t !== save.userTeamId);
  if (!teams.length) return;
  const teamId = teams[randInt(save, 0, teams.length - 1)]!;
  const roster = rosterOf(save, teamId).sort((a, b) => a.ovr - b.ovr);
  const cut = roster[0];
  if (!cut || cut.ovr > 62) return;
  save.teams[teamId].roster = save.teams[teamId].roster.filter((id) => id !== cut.id);
  cut.teamId = "fa";
  generatePlayer(save, cut.pos, teamId, randInt(save, 54, 66));
  addNews(save, {
    kind: "transaction",
    headline: `${displayName(save.year, teamId)} churn the bottom of the roster`,
    body: `${playerName(cut)} is released.`,
    teamIds: [teamId],
    playerIds: [cut.id],
  });
}
