/** Primetime for The Record: every line is derived from the real replay or sourced box scores. */
import type { DynastySave, GameResult, Player, PrimetimeShow, TeamId } from "./types.ts";
import { boxFor, boxPlayerId, type BoxGame, type BoxLine } from "./historyExtras.ts";
import { displayName, nicknameOf, activeTeamIds, conferenceOf, confLabel } from "./teams.ts";
import { playerName } from "./players.ts";
import { winPct } from "./standings.ts";
import { hasHistoryData, historyData } from "./historyMode.ts";

type Kind = NonNullable<PrimetimeShow["kind"]>;
type Episode = NonNullable<PrimetimeShow["episode"]>;
type Chapter = Episode["chapters"][number];

const record = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
const teamName = (year: number, id: string) => displayName(year, id as TeamId);
const finalLine = (year: number, g: GameResult) => `${teamName(year, g.awayId)} ${g.awayScore}, ${teamName(year, g.homeId)} ${g.homeScore}${g.ot ? " in overtime" : ""}`;
const winnerOf = (g: GameResult): TeamId | undefined => g.homeScore === g.awayScore ? undefined : (g.homeScore > g.awayScore ? g.homeId : g.awayId) as TeamId;
const marginOf = (g: GameResult) => Math.abs(g.homeScore - g.awayScore);

function chapter(id: string, kicker: string, title: string, teamIds: TeamId[], lines: Chapter["lines"]): Chapter {
  return { id, kicker, title, teamIds, lines };
}

function nameInBox(save: DynastySave, who: string): string {
  const id = boxPlayerId(who);
  const p = id ? save.players[id] : undefined;
  return p ? playerName(p) : who.startsWith("#") ? "a player in the official record" : who;
}

function notableLine(l: BoxLine): { score: number; text: string } | undefined {
  const bits: string[] = [];
  let score = 0;
  if (l.pa) { bits.push(`${l.pc ?? 0} of ${l.pa} passing for ${l.py ?? 0} yards${l.pt ? ` and ${l.pt} touchdowns` : ""}${l.pi ? `, ${l.pi} interception${l.pi === 1 ? "" : "s"}` : ""}`); score += (l.py ?? 0) / 30 + (l.pt ?? 0) * 5 + (l.pi ?? 0); }
  if (l.ra) { bits.push(`${l.ra} carries for ${l.ry ?? 0} yards${l.rt ? ` and ${l.rt} touchdowns` : ""}`); score += (l.ry ?? 0) / 12 + (l.rt ?? 0) * 5; }
  if (l.re) { bits.push(`${l.re} catches for ${l.ey ?? 0} yards${l.et ? ` and ${l.et} touchdowns` : ""}`); score += (l.ey ?? 0) / 12 + (l.et ?? 0) * 5; }
  if (l.sa) { bits.push(`${l.sa} sack${l.sa === 1 ? "" : "s"}`); score += l.sa * 5; }
  if (l.in) { bits.push(`${l.in} interception${l.in === 1 ? "" : "s"}`); score += l.in * 5; }
  return bits.length && score > 0 ? { score, text: bits.join("; ") } : undefined;
}

function bestPerformance(save: DynastySave, g: GameResult, box?: BoxGame): string | undefined {
  if (!box) return undefined;
  const rows = box.p
    .map(([, who, line]) => ({ who, ...notableLine(line) }))
    .filter((x): x is { who: string; score: number; text: string } => !!x.score && !!x.text)
    .sort((a, b) => b.score - a.score || a.who.localeCompare(b.who));
  const top = rows[0];
  if (!top) return undefined;
  const side = box.p.find(([, who]) => who === top.who)?.[0];
  const club = side === 0 ? box.a : side === 1 ? box.h : undefined;
  return `${nameInBox(save, top.who)}${club ? ` of the ${nicknameOf(save.year, club)}` : ""}: ${top.text}.`;
}

function weeklyStories(save: DynastySave, games: GameResult[]): NonNullable<PrimetimeShow["stories"]> {
  const year = save.year;
  if (!games.length) return [];
  const sorted = games.slice().sort((a, b) => marginOf(a) - marginOf(b) || (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore));
  const close = sorted[0]!;
  const broad = games.slice().sort((a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0]!;
  const big = games.slice().sort((a, b) => marginOf(b) - marginOf(a) || (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore))[0]!;
  const seen = new Set<string>();
  const out: NonNullable<PrimetimeShow["stories"]> = [];
  const add = (tag: string, headline: string, body: string, ids: TeamId[]) => {
    const key = `${headline}|${body}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ tag, headline, body, teamIds: ids, playerIds: [] });
  };
  add("The finish", winnerOf(close) ? `${teamName(year, winnerOf(close)!)} win the closest game` : "The closest game ends level", `${finalLine(year, close)}. ${marginOf(close) ? `The margin was ${marginOf(close)} point${marginOf(close) === 1 ? "" : "s"}.` : "Neither club left with a win."}`, [close.awayId as TeamId, close.homeId as TeamId]);
  if (broad.id !== close.id) add("Points on the board", `${teamName(year, broad.awayId)} and ${teamName(year, broad.homeId)} trade scores`, `${finalLine(year, broad)}. The teams combined for ${broad.homeScore + broad.awayScore} points, the most on this week's recorded slate.`, [broad.awayId as TeamId, broad.homeId as TeamId]);
  if (big.id !== close.id && big.id !== broad.id && marginOf(big) >= 17 && winnerOf(big)) add("The statement", `${teamName(year, winnerOf(big)!)} create separation`, `${finalLine(year, big)}. The final margin was ${marginOf(big)} points.`, [big.awayId as TeamId, big.homeId as TeamId]);

  const standings = activeTeamIds(year).map((id) => ({ id, team: save.teams[id] })).filter((x): x is { id: TeamId; team: NonNullable<typeof x.team> } => !!x.team)
    .sort((a, b) => winPct(b.team) - winPct(a.team) || b.team.wins - a.team.wins || a.team.losses - b.team.losses || a.id.localeCompare(b.id));
  const leader = standings[0];
  const leaderPct = leader ? winPct(leader.team) : undefined;
  const tied = leaderPct === undefined ? [] : standings.filter((x) => Math.abs(winPct(x.team) - leaderPct) < 0.0001);
  if (leader) add("The standings", tied.length > 1 ? `${tied.length} clubs share the league's best record` : `${teamName(year, leader.id)} set the pace`, `${tied.map((x) => teamName(year, x.id)).join(" and ")} ${tied.length > 1 ? "are" : "is"} ${record(leader.team)} after Week ${save.week}.`, tied.map((x) => x.id));
  return out;
}

function postseasonFieldChapter(save: DynastySave): Chapter | undefined {
  if (!hasHistoryData()) return undefined;
  const field = [...new Set(historyData().playoffs(save.year)
    .filter((g) => g.round !== "Super Bowl")
    .flatMap((g) => [g.away, g.home]))] as TeamId[];
  if (!field.length) return undefined;

  const conferences = save.year < 1970 ? ["AFL", "NFL"] : ["AFC", "NFC"];
  const lines: Chapter["lines"] = [{
    speaker: "HOST",
    text: `The regular season is complete. ${field.length} clubs have reached the real ${save.year < 1970 ? "postseason" : "playoff"} field.`,
  }];
  for (const conference of conferences) {
    const clubs = field
      .filter((id) => confLabel(save.year, conferenceOf(save.year, id)) === conference)
      .sort((a, b) => {
        const ta = save.teams[a];
        const tb = save.teams[b];
        return winPct(tb) - winPct(ta) || tb.wins - ta.wins || ta.losses - tb.losses || a.localeCompare(b);
      });
    if (!clubs.length) continue;
    lines.push({
      speaker: "ANALYST",
      text: `${conference} field: ${clubs.map((id) => `${teamName(save.year, id)} (${record(save.teams[id]!)})`).join("; ")}.`,
    });
  }
  lines.push({
    speaker: "REPORTER",
    text: "The clubs and records come from the completed regular season; the postseason matchups and results will enter the replay in their actual order. No future score is revealed here.",
  });
  return chapter("postseason-field", `${save.year} · THE PLAYOFF PICTURE`, "The field is set", field, lines);
}

function gameChapters(save: DynastySave, games: GameResult[], edition: Episode["edition"]): Chapter[] {
  const year = save.year;
  const sorted = games.slice().sort((a, b) => marginOf(a) - marginOf(b) || (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore));
  const first = sorted[0];
  const chapters: Chapter[] = [];
  if (first) {
    const close = marginOf(first);
    const opener = edition === "superBowl"
      ? `One real result decides the championship: ${finalLine(year, first)}. ${first.mvpPlayerId && save.players[first.mvpPlayerId] ? `${playerName(save.players[first.mvpPlayerId]!)} was named Super Bowl Most Valuable Player.` : "The final is recorded here exactly as it happened."}`
      : edition === "playoffs" || edition === "championship"
        ? `${games.length} postseason ${games.length === 1 ? "game" : "games"} are in the books. ${finalLine(year, first)}${close === 0 ? "; the clubs finish tied." : close <= 3 ? `, decided by ${close} point${close === 1 ? "" : "s"},` : ""}${close ? " is the tightest finish in this round." : ""}`
        : `The record has ${games.length} finals from Week ${save.week} of ${year}. ${close === 0 ? `The closest game, ${finalLine(year, first)}, ends level.` : `The closest was ${finalLine(year, first)}, a ${close}-point finish.`}`;
    chapters.push(chapter(`film-${first.id}`, edition === "superBowl" ? "THE CHAMPIONSHIP" : edition === "playoffs" || edition === "championship" ? "WIN OR GO HOME" : `WEEK ${save.week} · THE LEAD STORY`, edition === "superBowl" ? "One game for the title" : edition === "playoffs" || edition === "championship" ? "The postseason narrows" : "The game that came down to the wire", [first.awayId as TeamId, first.homeId as TeamId], [{ speaker: "HOST", text: opener }]));
    const performance = bestPerformance(save, first, boxFor(first));
    if (performance) chapters.push(chapter(`performance-${first.id}`, "FROM THE OFFICIAL BOX", "A performance in the record", [first.awayId as TeamId, first.homeId as TeamId], [{ speaker: "ANALYST", text: performance }]));
  }
  const remaining = sorted.filter((g) => g.id !== first?.id);
  if (remaining.length) {
    const lines = remaining.map((g) => ({ speaker: "REPORTER" as const, text: `${finalLine(year, g)}. ${winnerOf(g) ? `${teamName(year, winnerOf(g)!)} take the win.` : "The clubs finish tied."}` }));
    chapters.push(chapter("full-slate", "THE REST OF THE FINALS", "Around the league", [...new Set(remaining.flatMap((g) => [g.awayId as TeamId, g.homeId as TeamId]))], lines));
  }
  if (edition === "weekly" || edition === "seasonFinale") {
    const notes = weeklyStories(save, games).slice(1, 4).map((s) => ({ speaker: "ANALYST" as const, text: `${s.headline}. ${s.body}` }));
    if (notes.length) chapters.push(chapter("week-context", `WEEK ${save.week} · THE WIDER PICTURE`, "What the scores mean", [...new Set(weeklyStories(save, games).slice(1, 4).flatMap((s) => s.teamIds))], notes));
    const news = save.news.filter((n) => n.year === save.year && n.week === save.week && ["award", "transaction", "injury", "expansion"].includes(n.kind)).slice(0, 4);
    if (news.length) chapters.push(chapter("record-book", `WEEK ${save.week} · OUTSIDE THE SCOREBOARD`, "History kept moving", [...new Set(news.flatMap((n) => n.teamIds))], news.map((n) => ({ speaker: "REPORTER" as const, text: `${n.headline}. ${n.body}` }))));
    if (edition === "seasonFinale") {
      const field = postseasonFieldChapter(save);
      if (field) chapters.push(field);
    }
  }
  if (edition === "superBowl" && first) {
    const champion = winnerOf(first);
    if (champion) {
      const t = save.teams[champion];
      const road = [...save.playoffGames, first].filter((g) => g.homeId === champion || g.awayId === champion);
      const lines: Chapter["lines"] = [];
      if (t) lines.push({ speaker: "ANALYST", text: `The ${nicknameOf(year, champion)} entered the postseason after a ${record(t)} regular season.` });
      for (const g of road) lines.push({ speaker: "REPORTER", text: `${g.round ?? "Postseason"}: ${finalLine(year, g)}.` });
      const earlier = save.history.superBowls.filter((b) => b.year < year && (b.homeId === champion || b.awayId === champion)).at(-1);
      if (earlier) lines.push({ speaker: "HOST", text: `The club's previous recorded Super Bowl appearance came in ${earlier.year}.` });
      if (lines.length) chapters.push(chapter("champions-road", "THE ROAD TO THE TITLE", `${nicknameOf(year, champion)}'s championship season`, [champion], lines));
    }
  }
  return chapters;
}

function awardChapters(save: DynastySave): Chapter[] {
  const a = save.awards;
  if (!a) return [];
  const named: [string, string | undefined][] = [
    ["Most Valuable Player", a.mvp], ["Offensive Player of the Year", a.offPoy], ["Defensive Player of the Year", a.defPoy],
    [save.year < 1967 ? "Rookie of the Year" : "Offensive Rookie of the Year", a.oroy], ["Defensive Rookie of the Year", a.droy], ["Comeback Player of the Year", a.cpoty],
  ];
  const lines: Chapter["lines"] = named.filter((x): x is [string, string] => !!x[1]).map(([label, id]) => ({ speaker: "HOST", text: `${label}: ${save.players[id] ? playerName(save.players[id]!) : id}.` }));
  if (a.coyName) lines.push({ speaker: "ANALYST", text: `Coach of the Year: ${a.coyName}.` });
  const allPro = a.allPro.map((id) => save.players[id]).filter((p): p is Player => !!p);
  if (allPro.length) lines.push({ speaker: "REPORTER", text: `The first-team All-Pro list names ${allPro.slice(0, 6).map(playerName).join(", ")}${allPro.length > 6 ? `, and ${allPro.length - 6} more players` : ""}.` });
  return [chapter("honors", `${save.year} · THE OFFICIAL HONORS`, "The names on the record", [], lines)];
}

function buildEpisode(save: DynastySave, kind: Kind, games: GameResult[], finale: boolean): Episode {
  const year = save.year;
  const edition: Episode["edition"] = kind === "awards" ? "awards" : kind === "superBowl" ? "superBowl" : kind === "playoffs" ? (games.some((g) => g.round?.includes("Championship")) ? "championship" : "playoffs") : finale ? "seasonFinale" : "weekly";
  const gameIds = games.map((g) => g.id).sort().join("_");
  const id = `${year}-record-${edition}-${save.week}-${gameIds || "honors"}`;
  const stories = kind === "regular" ? weeklyStories(save, games) : [];
  const chapters = kind === "awards" ? awardChapters(save) : gameChapters(save, games, edition);
  if (!chapters.length) chapters.push(chapter("record-close", `${year} · THE RECORD`, "History, as it happened", [], [{ speaker: "HOST", text: `The documented results and honors from ${year} are preserved in The Record. Nothing is projected or simulated here.` }]));
  const headline = kind === "awards" ? `${year}: the awards, as they were given` : kind === "superBowl" ? `The championship of ${year}` : finale ? `${year}: the regular season closes` : kind === "playoffs" ? `${year}: the road to the title` : `${year}, Week ${save.week}: the Sunday record`;
  const subtitle = stories[0]?.headline ?? (kind === "awards" ? "The real winners and first-team selections" : `${games.length} documented final${games.length === 1 ? "" : "s"} · sourced to the historical record`);
  return { id, edition, headline, subtitle, chapters, focusIds: [...new Set(chapters.flatMap((c) => c.teamIds))] };
}

/** Same archive contract as Primetime, but omits projections, generated player awards and invented play-by-play. */
export function buildHistoryPrimetime(save: DynastySave, kind: Kind): void {
  const year = save.year;
  const regular = save.schedule.filter((g) => g.year === year && g.phase === "regular");
  const finale = kind === "regular" && regular.length > 0 && regular.every((g) => g.played);
  let games: GameResult[] = [];
  if (kind === "regular") games = regular.filter((g) => g.week === save.week && g.played);
  else if (kind === "playoffs") {
    const played = save.playoffGames.filter((g) => g.played);
    const week = Math.max(0, ...played.map((g) => g.week));
    games = played.filter((g) => g.week === week);
  } else if (kind === "superBowl" && save.superBowl?.played) games = [save.superBowl];

  const episode = buildEpisode(save, kind, games, finale);
  const stories = kind === "regular" ? weeklyStories(save, games) : [];
  const recap = (g: GameResult) => ({
    homeId: g.homeId as TeamId,
    awayId: g.awayId as TeamId,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    line: finalLine(year, g),
    note: g.round ?? `Week ${g.week}`,
    round: g.round,
  });
  const show: PrimetimeShow = {
    v: 2,
    year,
    week: save.week,
    kind,
    title: kind === "awards" ? "The Year in Review" : kind === "superBowl" ? `The Championship · ${year}` : kind === "playoffs" ? games[0]?.round ?? "The Playoffs" : finale ? "Regular-season finale" : `Week ${save.week}`,
    open: episode.chapters[0]!.lines.map((l) => l.text).join(" "),
    stories,
    recaps: games.map(recap),
    playOfNight: games[0] ? finalLine(year, games[0]) : "No game result is recorded for this studio edition.",
    pow: "",
    powerPoll: "",
    wire: [],
    close: episode.chapters.at(-1)!.lines.at(-1)!.text,
    episode,
  };
  const archive = [...(save.primetimeArchive ?? []), ...(save.primetime ? [save.primetime] : [])]
    .filter((s) => s.year === year && s.episode && s.episode.id !== episode.id);
  save.primetimeArchive = [...new Map(archive.map((s) => [s.episode!.id, s])).values()].slice(-26);
  save.primetime = show;
}
