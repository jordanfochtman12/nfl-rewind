/**
 * Real history vs. your timeline. Every season the league really played is on file - every
 * regular-season score and the whole postseason - so at the end of each simulated season the
 * almanac records where this league went its own way: a different champion, a real dynasty
 * that never happened, a nobody who became a legend.
 */
import type { DynastySave, Player, TeamId, TimelineEntry } from "./types.ts";
import { REAL_SCHEDULES } from "./data/realSchedules.ts";
import { REAL_POSTSEASON } from "./data/realPostseason.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { addNews } from "./news.ts";
import { playerName } from "./players.ts";

export interface RealRecord {
  w: number;
  l: number;
  t: number;
}

const recCache = new Map<number, Map<string, RealRecord>>();

/** Each club's real regular-season record, from the real scores. */
export function realRecords(year: number): Map<string, RealRecord> | undefined {
  const hit = recCache.get(year);
  if (hit) return hit;
  const raw = REAL_SCHEDULES[year];
  if (!raw) return undefined;
  const out = new Map<string, RealRecord>();
  const row = (t: string) => {
    let r = out.get(t);
    if (!r) out.set(t, (r = { w: 0, l: 0, t: 0 }));
    return r;
  };
  for (const g of raw.split("|")) {
    const [, home, away, hs, as] = g.split(",");
    const h = Number(hs);
    const a = Number(as);
    if (!home || !away || h < 0 || a < 0) continue;
    if (h > a) {
      row(home).w++;
      row(away).l++;
    } else if (a > h) {
      row(away).w++;
      row(home).l++;
    } else {
      row(home).t++;
      row(away).t++;
    }
  }
  if (!out.size) return undefined;
  recCache.set(year, out);
  return out;
}

export function realPostseason(year: number) {
  return REAL_POSTSEASON[year];
}

const recText = (r: { w: number; l: number; t: number }) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ""}`;

/** Written at the end of each season, once the champion is crowned. */
export function recordTimeline(save: DynastySave): TimelineEntry | undefined {
  const year = save.year;
  const real = realRecords(year);
  const post = realPostseason(year);
  const sb = save.superBowl;
  if (!sb?.played) return undefined;
  const simChamp = (sb.homeScore >= sb.awayScore ? sb.homeId : sb.awayId) as TeamId;
  const simRunner = (sb.homeScore >= sb.awayScore ? sb.awayId : sb.homeId) as TeamId;
  const simField = new Set<string>(save.playoffGames.flatMap((g) => [g.homeId, g.awayId]).concat([sb.homeId, sb.awayId]));
  const name = (id: string) => displayName(year, id as TeamId);
  const u = save.userTeamId;
  const ut = save.teams[u]!;
  const notes: string[] = [];

  if (post && real) {
    if (post.champ === simChamp) {
      notes.push(`History held: the ${name(simChamp)} won it all, just as they really did.`);
    } else {
      const rc = real.get(post.champ);
      const champNow = save.teams[post.champ as TeamId];
      if (!simField.has(post.champ) && champNow) {
        notes.push(
          `In real life the ${name(post.champ)} won the title${rc ? ` after a ${recText(rc)} season` : ""}. Here they went ${recText({ w: champNow.wins, l: champNow.losses, t: champNow.ties })} and missed the playoffs.`,
        );
      } else {
        notes.push(`The real champions, the ${name(post.champ)}, fell short this time. The ${name(simChamp)} took the title instead.`);
      }
      if (!post.field.includes(simChamp)) notes.push(`The ${name(simChamp)} never saw January in real life. In your league they're champions.`);
    }
    // Biggest swings against the real standings.
    const swings = activeTeamIds(year)
      .map((id) => {
        const r = real.get(id);
        const t = save.teams[id];
        return r && t ? { id, diff: t.wins - r.w, r, sim: { w: t.wins, l: t.losses, t: t.ties } } : undefined;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    for (const s of swings.slice(0, 2)) {
      if (Math.abs(s.diff) < 4) break;
      notes.push(
        s.diff > 0
          ? `The ${name(s.id)} went ${recText(s.sim)}, ${s.diff} wins better than their real ${recText(s.r)}.`
          : `The ${name(s.id)} fell to ${recText(s.sim)}. In real life they went ${recText(s.r)}.`,
      );
    }
    // Real unbeaten or near-unbeaten seasons that didn't happen here.
    for (const [id, r] of real) {
      const t = save.teams[id as TeamId];
      if (t && r.l === 0 && r.w >= 12 && t.losses > 0) notes.push(`The real ${year} ${name(id)} never lost a regular-season game. These ones lost ${t.losses}.`);
    }
  }

  // Players whose careers are running off the script.
  const allPro = (save.awards?.allPro ?? []).map((id) => save.players[id]).filter((p): p is Player => !!p);
  const newLegend = allPro.find((p) => p.arc && p.arc.pb === 0 && p.arc.ap === 0 && p.arc.to > 0);
  if (newLegend) {
    notes.push(`A new legend: ${playerName(newLegend)} never made a Pro Bowl in real life. In your league he's a first-team All-Pro.`);
  }
  const lost = Object.values(save.players).find(
    (p) =>
      p.arc &&
      p.arc.pb >= 7 &&
      p.teamId !== "retired" &&
      p.teamId !== "hof" &&
      year - p.arc.dy >= 4 &&
      year - p.arc.dy <= 7 &&
      p.ovr < 76 &&
      !(p.honors?.proBowl ?? []).length,
  );
  if (lost) notes.push(`A legend lost: ${playerName(lost)} made ${lost.arc!.pb} Pro Bowls in real life. In your league he's still waiting on his first.`);

  const realUser = real?.get(u);
  const entry: TimelineEntry = {
    year,
    realChamp: post?.champ as TeamId | undefined,
    realRunnerUp: post?.runnerUp as TeamId | undefined,
    realScore: post?.score,
    simChamp,
    simRunnerUp: simRunner,
    simScore: `${Math.max(sb.homeScore, sb.awayScore)}-${Math.min(sb.homeScore, sb.awayScore)}`,
    user: { sim: { w: ut.wins, l: ut.losses, t: ut.ties }, real: realUser, simPlayoffs: simField.has(u), realPlayoffs: post ? post.field.includes(u) : undefined },
    notes: notes.slice(0, 6),
  };
  save.history.timeline = (save.history.timeline ?? []).filter((e) => e.year !== year).concat(entry);

  if (post && post.champ !== simChamp) {
    addNews(save, {
      kind: "headline",
      headline: `History rewritten: the ${name(simChamp)} are ${year} champions`,
      body: `In the real ${year} season the ${name(post.champ)} beat the ${name(post.runnerUp)} ${post.score}. ${notes[1] ?? ""}`.trim(),
      teamIds: [simChamp, post.champ as TeamId],
      playerIds: [],
    });
  }
  if (newLegend) {
    addNews(save, {
      kind: "headline",
      headline: `History changed: ${playerName(newLegend)} is a first-team All-Pro`,
      body: "He never made a Pro Bowl in the real league. In this one he's among the best at his position.",
      teamIds: [],
      playerIds: [newLegend.id],
    });
  }
  return entry;
}

/** This week in real history, for the owner's game: "In real life, GB 24, BAL 3." */
export function realLine(save: DynastySave, g: { homeId: string; awayId: string; realHome?: number; realAway?: number }): string | undefined {
  if (g.realHome === undefined || g.realAway === undefined || g.realHome < 0) return undefined;
  const us = save.userTeamId;
  const home = g.homeId === us;
  const ours = home ? g.realHome : g.realAway;
  const theirs = home ? g.realAway : g.realHome;
  const opp = displayName(save.year, (home ? g.awayId : g.homeId) as TeamId);
  const verb = ours > theirs ? "beat" : ours < theirs ? "lost to" : "tied";
  return `In real life, the ${displayName(save.year, us)} ${verb} the ${opp} ${Math.max(ours, theirs)}-${Math.min(ours, theirs)}.`;
}
