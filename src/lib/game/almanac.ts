/** Franchise book. No React. */
import type { DynastySave, Pos, SeasonChapter, TeamId } from "./types.ts";
import { displayName, roman, superBowlNumber } from "./teams.ts";
import { playerName } from "./players.ts";

export function seasonResultLine(save: DynastySave, teamId: TeamId): string {
  const bowl = save.superBowl?.played
    ? save.superBowl
    : save.history.superBowls.find((b) => b.year === save.year);
  if (bowl && (bowl.homeId === teamId || bowl.awayId === teamId)) {
    const winner = bowl.homeScore >= bowl.awayScore ? bowl.homeId : bowl.awayId;
    const n = roman(superBowlNumber(save.year));
    return winner === teamId ? `Won Super Bowl ${n}` : `Lost Super Bowl ${n}`;
  }
  const games = save.playoffGames.filter(
    (g) => g.played && (g.homeId === teamId || g.awayId === teamId),
  );
  if (!games.length) {
    return save.year < 1970 ? "Missed the championship" : "Missed the playoffs";
  }
  const last = games[games.length - 1]!;
  const winner = last.homeScore >= last.awayScore ? last.homeId : last.awayId;
  const round = last.round ?? "playoffs";
  return winner === teamId ? `Won ${round}` : `Lost ${round}`;
}

function draftedClass(save: DynastySave, teamId: TeamId): SeasonChapter["drafted"] {
  const out: SeasonChapter["drafted"] = [];
  const seen = new Set<string>();
  for (const tx of save.transactions) {
    if (tx.kind !== "draft" || tx.to !== teamId || tx.year !== save.year) continue;
    if (seen.has(tx.playerId)) continue;
    const p = save.players[tx.playerId];
    if (!p) continue;
    seen.add(p.id);
    out.push({
      playerId: p.id,
      name: playerName(p),
      pos: p.pos,
      round: p.draftRound,
    });
  }
  return out;
}

function honorsFor(save: DynastySave, teamId: TeamId): string[] {
  const a = save.awards ?? save.history.awards.find((x) => x.year === save.year);
  if (!a) return [];
  const lines: string[] = [];
  const add = (label: string, id?: string) => {
    if (!id) return;
    const p = save.players[id];
    if (!p || p.teamId !== teamId) return;
    lines.push(`${label} ${playerName(p)}`);
  };
  add("MVP", a.mvp);
  add("OPOY", a.offPoy);
  add("DPOY", a.defPoy);
  add("OROY", a.oroy);
  add("DROY", a.droy);
  add("Comeback", a.cpoty);
  for (const id of a.allPro ?? []) {
    const p = save.players[id];
    if (p && p.teamId === teamId) lines.push(`All-Pro ${playerName(p)}`);
  }
  return lines;
}

/** Snapshot the user’s just-finished season into the almanac. Idempotent for a year. */
export function writeSeasonChapter(save: DynastySave): SeasonChapter {
  const teamId = save.userTeamId;
  const t = save.teams[teamId];
  const hc = t?.coachId ? save.coaches[t.coachId] : undefined;
  const prior = (save.history.seasons ?? []).filter((c) => c.year < save.year && c.teamId === teamId);
  const pw = prior.reduce((n, c) => n + c.wins, 0);
  const pl = prior.reduce((n, c) => n + c.losses, 0);
  const pt = prior.reduce((n, c) => n + c.ties, 0);
  // Team pf/pa only count the regular season (playoff games live in the bracket).
  const pf = t?.pf ?? 0;
  const pa = t?.pa ?? 0;
  const chapter: SeasonChapter = {
    year: save.year,
    teamId,
    wins: (t?.careerWins ?? 0) - pw,
    losses: (t?.careerLosses ?? 0) - pl,
    ties: (t?.careerTies ?? 0) - pt,
    pf: Math.max(0, pf),
    pa: Math.max(0, pa),
    coach: hc?.name,
    result: seasonResultLine(save, teamId),
    drafted: draftedClass(save, teamId),
    honors: honorsFor(save, teamId),
  };
  save.history.seasons = save.history.seasons ?? [];
  const idx = save.history.seasons.findIndex((c) => c.year === save.year && c.teamId === teamId);
  if (idx >= 0) save.history.seasons[idx] = chapter;
  else save.history.seasons.push(chapter);
  return chapter;
}

export function chapterLine(ch: SeasonChapter): string {
  const rec = `${ch.wins}-${ch.losses}${ch.ties ? `-${ch.ties}` : ""}`;
  return `${ch.year} ${rec} · ${ch.result}`;
}

export function clubBookTitle(save: DynastySave): string {
  return `${displayName(save.year, save.userTeamId)} ${save.startingYear}–${save.year}`;
}
