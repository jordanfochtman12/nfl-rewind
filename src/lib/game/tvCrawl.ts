/**
 * The crawl along the bottom of TV mode: finals, the wire, the standings, the leaders, who's
 * hurt. While a slate is on the air (the whip-around, a live game) it holds back everything
 * those games decided - their scores, the news they made, the standings and stat lines they
 * moved - and runs what was known at kickoff, plus what's on now.
 */
import type { DynastySave, GameResult, TeamId } from "./types.ts";
import { activeTeamIds, nicknameOf } from "./teams.ts";
import { allGames } from "./showGraphics.ts";
import { standingRows } from "./standings.ts";
import { seasonLeaders } from "./leaders.ts";
import { playerName } from "./players.ts";
import { posLabel } from "./posLabel.ts";

const NICK = (year: number, id: string) => nicknameOf(year, id as TeamId).toUpperCase();
const finalLine = (year: number, g: GameResult) =>
  `${NICK(year, g.awayId)} ${g.awayScore}, ${NICK(year, g.homeId)} ${g.homeScore}${g.ot ? " (OT)" : ""} · FINAL`;
const isClub = (id: string) => /^[a-z]{3}$/.test(id);

export function tvCrawl(save: DynastySave, opts: { onAir?: GameResult[] } = {}): string[] {
  const year = save.year;
  const live = opts.onAir ?? [];
  const liveIds = new Set(live.map((g) => g.id));
  // The slate on the air: its week (and phase) made the news that has to wait.
  const liveWeek = live[0]?.week;
  const livePhase = live[0]?.phase;
  const out: string[] = [];

  if (live.length) out.push(...live.slice(0, 16).map((g) => `NOW: ${NICK(year, g.awayId)} AT ${NICK(year, g.homeId)}`));

  // The latest finals the viewer has already seen.
  const played = allGames(save).filter((g) => g.year === year && g.played && !liveIds.has(g.id) && isClub(g.homeId) && isClub(g.awayId));
  const lastWeek = Math.max(-1, ...played.filter((g) => !live.length || g.phase !== livePhase || g.week < liveWeek!).map((g) => (g.phase === "regular" ? g.week : 100 + g.week)));
  const finals = played.filter((g) => (g.phase === "regular" ? g.week : 100 + g.week) === lastWeek);
  out.push(...finals.slice(-16).map((g) => finalLine(year, g)));

  // The wire.
  const wire = (save.news ?? [])
    .filter((n) => n.year === year && !(live.length && n.phase === livePhase && n.week >= liveWeek!))
    .filter((n) => !/^(Final cuts|Combine week|Achievement unlocked)/.test(n.headline))
    .slice(0, 10)
    .map((n) => n.headline.toUpperCase());
  out.push(...wire);

  // Standings and leaders move with the games on the air: only between slates.
  if (!live.length && (save.phase === "regular" || save.phase === "playoffs")) {
    for (const r of standingRows(save)) {
      const t = r.teams[0];
      if (!t || t.wins + t.losses + t.ties === 0) continue;
      out.push(`${r.conf.toUpperCase()} ${r.div.toUpperCase()} LEAD: ${NICK(year, t.id)} ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`);
    }
    const L = seasonLeaders(save);
    for (const row of [L.passYds[0], L.rushYds[0], L.recYds[0], L.sacks[0], L.ints[0]]) {
      if (row) out.push(`${row.label.toUpperCase()} LEADER: ${row.name.toUpperCase()} (${row.team.toUpperCase()}) ${row.value.toLocaleString("en-US")}`);
    }
  }

  // Who's hurt: the stars out, as of the last slate the viewer saw.
  if (!live.length && !save.realHistory) {
    const hurt = activeTeamIds(year)
      .flatMap((id) => Object.values(save.players).filter((p) => p.teamId === id && (p.onIR || p.injuredWeeks > 0) && p.injuryName !== "holdout" && p.ovr >= 82))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 6);
    for (const p of hurt) out.push(`INJURY: ${playerName(p).toUpperCase()}, ${posLabel(p)}, ${NICK(year, p.teamId)} · ${p.onIR ? "INJURED RESERVE" : `OUT ${p.injuredWeeks} WK`}`);
  }
  return out;
}
