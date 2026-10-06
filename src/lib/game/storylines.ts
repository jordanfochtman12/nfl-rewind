/**
 * The season's through-lines: what's expected of the owner's club and how it's graded, the
 * dynasty trophy case, and the player arcs that carry across weeks and years - farewell tours
 * for real players in their real final season, holdouts, rookie breakouts and busts, coaches
 * on the hot seat, free-agent splashes, draft steals looked back on, and the milestone chases
 * the booth tracks every week.
 */
import type { Achievement, DynastySave, Player, PrimetimeStory, SeasonGoal, TeamId } from "./types.ts";
import { activeTeamIds, displayName, divisionKey, gamesInSeason } from "./teams.ts";
import { addNews } from "./news.ts";
import { livingPlayers, playerName, rosterOf } from "./players.ts";
import { sortedDivision, winPct } from "./standings.ts";
import { projectWins, strengthRank } from "./primetime.ts";
import { careerRecordBook } from "./records.ts";
import { salaryFor } from "./salary.ts";
import { ARC_DATA_LAST } from "./careerArc.ts";
import { ownerOf } from "./owner.ts";

const clubOf = (p: Player): TeamId | undefined =>
  p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? undefined : p.teamId;
const rec = (w: number, l: number, t: number) => `${w}-${l}${t ? `-${t}` : ""}`;

/* ---------------- season plan: expectations, owner goals, report card ---------------- */

export function buildSeasonPlan(save: DynastySave): void {
  if (save.cpuOnly) return;
  const id = save.userTeamId;
  const year = save.year;
  const total = gamesInSeason(year);
  const proj = projectWins(save, id);
  const n = activeTeamIds(year).length;
  const rank = strengthRank(save, id);
  const outlook =
    rank <= 3
      ? "Title favorite"
      : rank <= Math.round(n * 0.25)
        ? "Contender"
        : rank <= Math.round(n * 0.5)
          ? "Playoff hopeful"
          : rank <= Math.round(n * 0.75)
            ? "Rebuilding year"
            : "Long season ahead";
  const goals: SeasonGoal[] = [];
  const target = Math.max(3, Math.min(total, Math.round(proj)));
  goals.push({ id: "wins", text: `Win at least ${target} games (the preseason line is ${proj.toFixed(1)})`, major: true });
  if (rank <= 2) goals.push({ id: "superBowl", text: "Reach the Super Bowl", major: true });
  else if (rank <= Math.round(n * 0.4)) goals.push({ id: "playoffs", text: "Make the playoffs", major: true });
  if (rank <= Math.round(n * 0.3)) goals.push({ id: "division", text: "Win the division" });
  const o = ownerOf(save);
  if (o.support >= 60) goals.push({ id: "fill95", text: "Keep the house full: 95% average at home" });
  else goals.push({ id: "support55", text: "Win the city back: fan support to 55" });
  // A young player who is actually in line for snaps: top of his position group on this roster.
  const roster = rosterOf(save, id);
  const slots: Partial<Record<string, number>> = { QB: 1, RB: 2, FB: 1, WR: 3, TE: 1, DE: 2, DT: 2, OLB: 2, MLB: 1, CB: 3, S: 2 };
  const inLine = (p: Player) =>
    roster.filter((q) => q.pos === p.pos && q.ovr > p.ovr && q.injuredWeeks <= 0).length < (slots[p.pos] ?? 1);
  const prospect = roster
    .filter((p) => p.age <= 24 && p.ovr >= 62 && p.ovr <= 80 && (p.potential ?? p.ovr) >= p.ovr + 5 && !["K", "P"].includes(p.pos))
    .filter(inLine)
    .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))[0];
  if (prospect) goals.push({ id: `develop:${prospect.id}`, text: `Develop ${playerName(prospect)} (${prospect.pos}): 10+ games of work` });
  save.seasonPlan = { year, projWins: Math.round(proj * 10) / 10, outlook, goals };
  addNews(save, {
    kind: "headline",
    headline: `${outlook}: the ${displayName(year, id)} are projected for ${proj.toFixed(1)} wins`,
    body: `The owner's marching orders: ${goals.map((g) => g.text.toLowerCase()).join("; ")}.`,
    teamIds: [id],
    playerIds: prospect ? [prospect.id] : [],
  });
}

function goalMet(save: DynastySave, g: SeasonGoal): boolean {
  const id = save.userTeamId;
  const t = save.teams[id]!;
  const inPlayoffs = save.playoffGames.some((x) => x.homeId === id || x.awayId === id);
  const sb = save.superBowl;
  const o = ownerOf(save);
  if (g.id === "wins") return t.wins >= Number(g.text.match(/(\d+) games/)?.[1] ?? 99);
  if (g.id === "playoffs") return inPlayoffs;
  if (g.id === "superBowl") return !!sb && (sb.homeId === id || sb.awayId === id);
  if (g.id === "division") return sortedDivision(save, divisionKey(save.year, id))[0]?.id === id;
  if (g.id === "fill95") return o.capacityTotal > 0 && o.crowdTotal / o.capacityTotal >= 0.95;
  if (g.id === "support55") return o.support >= 55;
  if (g.id.startsWith("develop:")) return (save.players[g.id.slice(8)]?.stats[save.year]?.gp ?? 0) >= 10;
  return false;
}

/** Live read on a goal during the season, for the Office. */
export function goalProgress(save: DynastySave, g: SeasonGoal): string {
  const id = save.userTeamId;
  const t = save.teams[id]!;
  if (g.id === "wins") return `${rec(t.wins, t.losses, t.ties)} · projected ${projectWins(save, id).toFixed(1)}`;
  if (g.id === "fill95") {
    const o = ownerOf(save);
    return o.capacityTotal ? `${Math.round((100 * o.crowdTotal) / o.capacityTotal)}% so far` : "no home games yet";
  }
  if (g.id === "support55") return `support ${Math.round(ownerOf(save).support)}`;
  if (g.id.startsWith("develop:")) return `${save.players[g.id.slice(8)]?.stats[save.year]?.gp ?? 0} games`;
  if (g.id === "division") {
    const div = sortedDivision(save, divisionKey(save.year, id));
    const pos = div.findIndex((x) => x.id === id) + 1;
    return pos === 1 ? "leading the division" : `${pos}${pos === 2 ? "nd" : pos === 3 ? "rd" : "th"} in the division`;
  }
  return "";
}

export function gradeSeasonPlan(save: DynastySave): void {
  const plan = save.seasonPlan;
  if (!plan || plan.year !== save.year || plan.graded) return;
  let got = 0;
  let max = 0;
  let delta = 0;
  const t = save.teams[save.userTeamId]!;
  for (const g of plan.goals) {
    g.met = goalMet(save, g);
    const w = g.major ? 2 : 1;
    max += w;
    // One win short of the line is close, not a failure: half credit and no penalty.
    const near = g.id === "wins" && !g.met && t.wins + 1 >= Number(g.text.match(/(\d+) games/)?.[1] ?? 99);
    if (g.met) {
      got += w;
      delta += g.major ? 2 : 1;
    } else if (near) got += w / 2;
    else if (g.major) delta -= 2;
  }
  const pct = max ? got / max : 0;
  const grade = pct >= 0.95 ? "A+" : pct >= 0.8 ? "A" : pct >= 0.6 ? "B" : pct >= 0.4 ? "C" : pct >= 0.2 ? "D" : "F";
  plan.graded = true;
  plan.grade = grade;
  plan.verdict =
    pct >= 0.8
      ? "Every box that mattered, checked. The owner's box is a happy place tonight."
      : pct >= 0.4
        ? "A season you can sell, with a few things left on the list."
        : pct >= 0.2
          ? "Short of the bar. Patience in the building is getting thinner."
          : "A lost year by the owner's own standard. Changes are coming.";
  const o = ownerOf(save);
  o.support = Math.max(3, Math.min(99, o.support + delta));
  save.lastPlan = plan;
  save.seasonPlan = undefined;
  addNews(save, {
    kind: "headline",
    headline: `Owner's report card: ${grade}`,
    body: `${plan.goals.filter((g) => g.met).length} of ${plan.goals.length} goals met. ${plan.verdict}`,
    teamIds: [save.userTeamId],
    playerIds: [],
  });
}

/* ---------------- dynasty trophy case ---------------- */

function unlock(save: DynastySave, id: string, title: string, body: string): void {
  save.achievements = save.achievements ?? [];
  if (save.achievements.some((a) => a.id === id)) return;
  const a: Achievement = { id, year: save.year, title, body };
  save.achievements.push(a);
  addNews(save, { kind: "award", headline: `Achievement unlocked: ${title}`, body, teamIds: [save.userTeamId], playerIds: [] });
}

export function checkAchievements(save: DynastySave): void {
  if (save.cpuOnly) return;
  const id = save.userTeamId;
  const year = save.year;
  const t = save.teams[id]!;
  const sb = save.superBowl;
  const champ = sb?.played ? (sb.homeScore >= sb.awayScore ? sb.homeId : sb.awayId) : undefined;
  const titles = save.history.championships.filter((c) => c.teamId === id).map((c) => c.year);
  const inPlayoffs = save.playoffGames.some((x) => x.homeId === id || x.awayId === id);
  const divWin = sortedDivision(save, divisionKey(year, id))[0]?.id === id;
  const prev = save.history.seasons.find((c) => c.year === year - 1 && c.teamId === id);

  if (inPlayoffs) unlock(save, "playoffs", "Playoff football", `The ${year} club made the postseason.`);
  if (divWin) unlock(save, "division", "Division champions", `${year}: first division title of the dynasty.`);
  if (champ === id) unlock(save, "title", "World champions", `Won the ${year} title.`);
  if (titles.includes(year) && titles.includes(year - 1)) unlock(save, "repeat", "Back to back", `Champions in ${year - 1} and ${year}.`);
  if (titles.includes(year) && titles.includes(year - 1) && titles.includes(year - 2)) unlock(save, "threepeat", "Three-peat", `Three straight titles, ${year - 2}-${year}.`);
  if (titles.filter((y) => y > year - 5).length >= 3) unlock(save, "dynasty", "Dynasty", "Three championships inside five seasons.");
  if (new Set(titles.map((y) => Math.floor(y / 10))).size >= 3) unlock(save, "eras", "Across the eras", "Titles in three different decades.");
  if (t.losses === 0 && t.ties === 0) unlock(save, "perfect-reg", "Unbeaten", `A perfect ${t.wins}-0 regular season.`);
  if (t.losses === 0 && t.ties === 0 && champ === id) unlock(save, "perfect", "The perfect season", `${t.wins}-0 and champions. Nobody touched them.`);
  if (prev && prev.wins < prev.losses && inPlayoffs) unlock(save, "turnaround", "Turnaround", `From ${rec(prev.wins, prev.losses, prev.ties)} to the playoffs.`);
  if (prev && prev.wins <= 4 && divWin) unlock(save, "worst-first", "Worst to first", `${prev.wins} wins last year, division champions this year.`);
  const last5 = save.history.seasons.filter((c) => c.teamId === id && c.year > year - 5 && c.year < year);
  if (last5.length === 4 && last5.every((c) => c.wins >= 10) && t.wins >= 10) unlock(save, "sustained", "Sustained excellence", "Five straight seasons of 10+ wins.");
  if ((t.careerWins ?? 0) >= 100) unlock(save, "wins100", "Century club", "100 regular-season wins in the dynasty.");
  if ((t.careerWins ?? 0) >= 250) unlock(save, "wins250", "Standard bearer", "250 regular-season wins in the dynasty.");
  const a = save.awards;
  if (a?.mvp && clubOf(save.players[a.mvp]!) === id) unlock(save, "mvp", "MVP in the building", `${playerName(save.players[a.mvp]!)} won MVP in ${year}.`);
  const ap = (a?.allPro ?? []).filter((pid) => save.players[pid] && clubOf(save.players[pid]!) === id);
  if (ap.length >= 5) unlock(save, "allpro5", "All-Pro factory", `${ap.length} first-team All-Pros in ${year}.`);
  const gem = ap.map((pid) => save.players[pid]!).find((p) => p.draftTeam === id && (p.draftRound ?? 0) >= 5);
  if (gem) unlock(save, "gem", "Found a gem", `${playerName(gem)}, a round-${gem.draftRound} pick, is a first-team All-Pro.`);
  const o = ownerOf(save);
  if (o.capacityTotal && o.crowdTotal / o.capacityTotal >= 0.99) unlock(save, "sellout", "Sold out", "Every seat, every home game.");
  if (o.support >= 90) unlock(save, "beloved", "Beloved", "Fan support hit 90.");
}

/* ---------------- player arcs ---------------- */

/** Season kickoff: farewell tours and holdouts. */
export function seasonArcs(save: DynastySave, rng: () => number): void {
  const year = save.year;
  const farewell = Object.values(save.players)
    .filter((p) => clubOf(p) && p.arc && p.arc.to === year && p.arc.to < ARC_DATA_LAST && (p.ovr >= 80 || p.arc.pb >= 3))
    .sort((a, b) => b.ovr - a.ovr);
  for (const p of farewell) p.finalSeason = year;
  for (const p of farewell.filter((p, i) => i < 3 || p.teamId === save.userTeamId).slice(0, 5)) {
    addNews(save, {
      kind: "headline",
      headline: `Farewell tour: ${playerName(p)} says ${year} is his last`,
      body: `${p.yearsPro} seasons in. The ${displayName(year, p.teamId as TeamId)} ${p.pos} will hang it up when this one is over.`,
      teamIds: [p.teamId as TeamId],
      playerIds: [p.id],
    });
  }
  if (save.cpuOnly || year === save.startingYear) return;
  // A star on the owner's club in the last year of his deal may stay home, and he's far likelier
  // to if he has outplayed the contract.
  const star = rosterOf(save, save.userTeamId)
    .filter((p) => p.ovr >= 84 && p.age >= 24 && p.age <= 31 && (p.contractYears ?? 1) <= 1 && !p.finalSeason)
    .sort((a, b) => b.ovr - a.ovr)[0];
  const underpaid = !!star && star.salary < salaryFor(year, star.ovr, star.age, star.pos) * 0.9;
  if (star && rng() < (underpaid ? 0.45 : 0.12)) {
    star.holdout = true;
    star.injuredWeeks = Math.max(star.injuredWeeks, 2 + Math.floor(rng() * 3));
    star.injuryName = "holdout";
    addNews(save, {
      kind: "headline",
      headline: `${playerName(star)} holds out`,
      body: `He wants to be paid like the player he is. Until the owner calls his agent, he isn't coming to work.`,
      teamIds: [save.userTeamId],
      playerIds: [star.id],
    });
  }
}

/** What the holdout's agent is asking for: market value plus 15%. */
export function holdoutAsk(save: DynastySave, p: Player): number {
  return Math.round(salaryFor(save.year, p.ovr, p.age, p.pos) * 1.15);
}

/** The owner pays the holdout: a market deal plus a raise, and he's back on the field. */
export function endHoldout(save: DynastySave, playerId: string): string {
  const p = save.players[playerId];
  if (!p?.holdout) return "No holdout to settle.";
  p.salary = holdoutAsk(save, p);
  p.contractYears = (p.contractYears ?? 1) + 3;
  p.holdout = false;
  p.injuredWeeks = 0;
  p.injuryName = undefined;
  p.morale = Math.min(99, (p.morale ?? 70) + 8);
  addNews(save, {
    kind: "transaction",
    headline: `${playerName(p)} signs an extension and ends his holdout`,
    body: `The owner made the call. He's back in the building.`,
    teamIds: [save.userTeamId],
    playerIds: [p.id],
  });
  return `${playerName(p)} is paid and back at practice.`;
}

/** A holdout that simply runs its course: he reports, unhappy. */
export function holdoutReported(save: DynastySave, p: Player): void {
  p.holdout = false;
  p.morale = Math.max(20, (p.morale ?? 70) - 12);
  addNews(save, {
    kind: "headline",
    headline: `${playerName(p)} ends his holdout without a new deal`,
    body: "He's back, and nobody in the building thinks this is over.",
    teamIds: clubOf(p) ? [clubOf(p)!] : [],
    playerIds: [p.id],
  });
}

/** Five and ten years on: the steals history would never have allowed. */
export function draftRetrospective(save: DynastySave): void {
  const year = save.year;
  const rows = Object.values(save.players)
    .filter((p) => p.draftTeam && p.realRound && p.draftYear && (year - p.draftYear === 5 || year - p.draftYear === 10))
    .filter((p) => (p.draftRound ?? 0) - (p.realRound ?? 0) >= 2 && (p.honors?.proBowl.length ?? 0) + (p.honors?.allPro.length ?? 0) >= 2)
    .sort((a, b) => (b.honors?.proBowl.length ?? 0) - (a.honors?.proBowl.length ?? 0))
    .slice(0, 3);
  for (const p of rows) {
    addNews(save, {
      kind: "headline",
      headline: `${year - p.draftYear!} years later: ${playerName(p)} was the steal of the ${p.draftYear} draft`,
      body: `The ${displayName(year, p.draftTeam!)} got him in round ${p.draftRound}. History had him going in round ${p.realRound}. ${p.honors?.proBowl.length ?? 0} Pro Bowls since.`,
      teamIds: [p.draftTeam!],
      playerIds: [p.id],
    });
  }
}

/* ---------------- weekly storylines + milestone chases for Primetime ---------------- */

export function weeklyStorylines(save: DynastySave): (PrimetimeStory & { score: number })[] {
  const out: (PrimetimeStory & { score: number })[] = [];
  const year = save.year;
  const week = save.week;
  if (week === 1) {
    for (const p of Object.values(save.players).filter((x) => x.finalSeason === year && clubOf(x)).sort((a, b) => b.ovr - a.ovr).slice(0, 2)) {
      out.push({ tag: "Farewell tour", headline: `${playerName(p)}'s final season is underway`, body: `Every stadium on the schedule gets one last look.`, teamIds: [clubOf(p)!], playerIds: [p.id], score: 47 });
    }
    const splash = save.transactions
      .filter((t) => t.year === year && t.kind === "sign")
      .map((t) => ({ t, p: save.players[t.playerId] }))
      .filter((x) => x.p && x.p.ovr >= 84 && clubOf(x.p))
      .sort((a, b) => b.p!.ovr - a.p!.ovr)[0];
    if (splash) {
      out.push({ tag: "Big splash", headline: `${playerName(splash.p!)} debuts for the ${displayName(year, clubOf(splash.p!)!)}`, body: `The offseason's biggest signing gets his first Sunday in new colors.`, teamIds: [clubOf(splash.p!)!], playerIds: [splash.p!.id], score: 44 });
    }
  }
  for (const t of save.transactions.filter((t) => t.year === year && t.week === week && t.kind === "trade")) {
    const p = save.players[t.playerId];
    if (p && p.ovr >= 80 && clubOf(p)) {
      out.push({ tag: "Blockbuster", headline: `${playerName(p)} traded to the ${displayName(year, clubOf(p)!)}`, body: t.detail, teamIds: [clubOf(p)!], playerIds: [p.id], score: 50 });
    }
  }
  if (week >= 4 && week % 3 === 1) {
    const rookie = Object.values(save.players)
      .filter((p) => p.draftYear === year && clubOf(p) && p.stats[year])
      .map((p) => {
        const s = p.stats[year]!;
        return { p, s, v: s.passYds * 0.04 + s.passTd * 4 + s.rushYds * 0.1 + s.rushTd * 6 + s.recYds * 0.1 + s.recTd * 6 + s.sacks * 4 + s.ints * 5 };
      })
      .sort((a, b) => b.v - a.v)[0];
    if (rookie && rookie.v > 25) {
      const s = rookie.s;
      const line = rookie.p.pos === "QB" ? `${s.passYds} yds, ${s.passTd} TD` : ["RB", "FB"].includes(rookie.p.pos) ? `${s.rushYds} rush yds, ${s.rushTd} TD` : ["WR", "TE"].includes(rookie.p.pos) ? `${s.rec} catches, ${s.recYds} yds` : `${s.sacks} sacks, ${s.ints} INT`;
      out.push({ tag: "Rookie watch", headline: `${playerName(rookie.p)} is the rookie of the year so far`, body: `${line} through ${s.gp} games for the ${displayName(year, clubOf(rookie.p)!)}.`, teamIds: [clubOf(rookie.p)!], playerIds: [rookie.p.id], score: 41 });
    }
  }
  if (week === 9) {
    const bust = Object.values(save.players)
      .filter((p) => p.draftRound === 1 && p.draftYear && year - p.draftYear >= 1 && year - p.draftYear <= 2 && clubOf(p) && p.ovr < 66)
      .sort((a, b) => a.ovr - b.ovr)[0];
    if (bust) out.push({ tag: "Bust watch", headline: `Where is ${playerName(bust)}?`, body: `A first-round pick in ${bust.draftYear}, still waiting for the breakout with the ${displayName(year, clubOf(bust)!)}.`, teamIds: [clubOf(bust)!], playerIds: [bust.id], score: 30 });
  }
  if (week >= 8) {
    const hot = activeTeamIds(year)
      .map((id) => save.teams[id]!)
      .filter((t) => t.wins + t.losses >= 7 && winPct(t) <= 0.25 && t.coachId && save.coaches[t.coachId])
      .sort((a, b) => winPct(a) - winPct(b))[0];
    if (hot) {
      const coach = save.coaches[hot.coachId!]!;
      out.push({ tag: "Hot seat", headline: `The seat is getting warm under ${coach.name}`, body: `The ${displayName(year, hot.id)} are ${rec(hot.wins, hot.losses, hot.ties)}. Ownership is watching.`, teamIds: [hot.id], playerIds: [], score: 36 });
    }
  }
  return out;
}

export interface Chase {
  playerId: string;
  name: string;
  teamId: TeamId;
  text: string;
}

const CHASE_CATS: { id: string; label: string; one?: string; of: (s: import("./types.ts").SeasonStats) => number }[] = [
  { id: "passYds", label: "passing yards", one: "passing yard", of: (s) => s.passYds },
  { id: "passTd", label: "TD passes", one: "TD pass", of: (s) => s.passTd },
  { id: "rushYds", label: "rushing yards", one: "rushing yard", of: (s) => s.rushYds },
  { id: "rushTd", label: "rushing TDs", one: "rushing TD", of: (s) => s.rushTd },
  { id: "rec", label: "catches", one: "catch", of: (s) => s.rec },
  { id: "recYds", label: "receiving yards", one: "receiving yard", of: (s) => s.recYds },
  { id: "recTd", label: "receiving TDs", one: "receiving TD", of: (s) => s.recTd },
  { id: "sacks", label: "sacks", one: "sack", of: (s) => s.sacks },
  { id: "ints", label: "interceptions", one: "interception", of: (s) => s.ints },
];

// Best single season per category, real pre-dynasty seasons included. A retired player's
// bests never change and save copies share his object, so they're worked out once.
const settledBest = new WeakMap<Player, Record<string, number>>();
function playerBests(p: Player): Record<string, number> {
  const settled = p.teamId === "retired" || p.teamId === "hof";
  const hit = settled ? settledBest.get(p) : undefined;
  if (hit) return hit;
  const best: Record<string, number> = {};
  for (const row of p.career ?? []) {
    for (const cat of CHASE_CATS) {
      const v = cat.of(row as import("./types.ts").SeasonStats) || 0;
      if (v > (best[cat.id] ?? 0)) best[cat.id] = v;
    }
  }
  if (settled) settledBest.set(p, best);
  return best;
}
function seasonBests(save: DynastySave): Record<string, number> {
  const best: Record<string, number> = { ...(save.bestSeasonMarks ?? {}) };
  for (const p of Object.values(save.players)) {
    const b = playerBests(p);
    for (const k in b) if (b[k]! > (best[k] ?? 0)) best[k] = b[k]!;
  }
  return best;
}

/** Single-season paces and career marks within reach. */
export function milestoneChases(save: DynastySave, limit = 6): Chase[] {
  const year = save.year;
  const total = gamesInSeason(year);
  const out: (Chase & { score: number })[] = [];
  const active = livingPlayers(save).filter((p) => clubOf(p));
  const bests = seasonBests(save);
  for (const cat of CHASE_CATS) {
    const record = bests[cat.id] ?? 0;
    if (!record) continue;
    for (const p of active) {
      const s = p.stats[year];
      if (!s || s.gp < Math.ceil(total * 0.4) || s.gp >= total) continue;
      const v = cat.of(s);
      const pace = Math.round((v / s.gp) * total);
      if (pace > record && v >= record * 0.5) {
        out.push({
          playerId: p.id,
          name: playerName(p),
          teamId: clubOf(p)!,
          text: `On pace for ${pace.toLocaleString("en-US")} ${cat.label}, which would break the single-season record of ${record.toLocaleString("en-US")}`,
          score: 60 + (pace / record - 1) * 100,
        });
      }
    }
  }
  const books = careerRecordBook(save, 10);
  for (const book of books) {
    const cat = CHASE_CATS.find((c) => c.id === book.id);
    if (!cat) continue;
    book.rows.forEach((row, i) => {
      const p = save.players[row.playerId];
      if (!p || !clubOf(p) || i === 0) return;
      const ahead = book.rows[i - 1]!;
      const gap = ahead.value - row.value;
      if (gap > 0 && gap <= Math.max(3, ahead.value * 0.06)) {
        out.push({
          playerId: p.id,
          name: playerName(p),
          teamId: clubOf(p)!,
          text: `${gap.toLocaleString("en-US")} ${gap === 1 ? cat.one : cat.label} from passing ${ahead.name} for No. ${i} all-time`,
          score: 50 + (10 - i) * 2,
        });
      }
    });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((c) => (seen.has(c.playerId) ? false : (seen.add(c.playerId), true)))
    .slice(0, limit)
    .map(({ score: _s, ...c }) => c);
}
