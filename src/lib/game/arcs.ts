/**
 * Storylines that run all season. Each week the league is read for stories worth following:
 * a rookie's rise, a preseason favorite's collapse, a team nobody picked, a division race
 * going to the wire, the MVP race changing hands. A story opens when the numbers say so,
 * picks up a new beat each week it moves, and closes when it resolves, so the studio can
 * say "we first told you about him in Week 3" and the analysts can own a bad August call.
 * No React.
 */
import { playerName } from "./players.ts";
import { activeTeamIds, displayName, divisionKey, gamesInSeason, nicknameOf } from "./teams.ts";
import { winPct } from "./standings.ts";
import { awardRaces } from "./leagueStories.ts";
import type { DynastySave, Player, SeasonStats, StoryArc, TeamId } from "./types.ts";

const rec = (save: DynastySave, id: TeamId) => {
  const t = save.teams[id]!;
  return `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
};

function rookieScore(s: SeasonStats | undefined): number {
  if (!s) return 0;
  return s.passYds * 0.04 + s.passTd * 4 - s.passInt * 2 + s.rushYds * 0.1 + s.rushTd * 6 + s.recYds * 0.1 + s.recTd * 6 + s.sacks * 4 + s.ints * 5;
}

function rookieLine(p: Player, s: SeasonStats): string {
  if (s.passAtt >= 60) return `${s.passYds.toLocaleString()} passing yards and ${s.passTd} touchdowns`;
  if (s.rushAtt >= 30) return `${s.rushYds.toLocaleString()} rushing yards and ${s.rushTd} touchdowns`;
  if (s.rec >= 12) return `${s.rec} catches for ${s.recYds.toLocaleString()} yards and ${s.recTd} touchdowns`;
  if (s.sacks >= 2) return `${s.sacks} sacks`;
  if (s.ints >= 2) return `${s.ints} interceptions`;
  return `a starter's role at ${p.pos}`;
}

/** The arcs of the current season (cleared when a new season starts). */
export function seasonArcList(save: DynastySave): StoryArc[] {
  return (save.arcs ?? []).filter((a) => a.year === save.year);
}

function upsert(save: DynastySave, arc: Omit<StoryArc, "beats" | "opened" | "year">, beat: { text: string; short: string; metric: number }): void {
  save.arcs = (save.arcs ?? []).filter((a) => a.year === save.year);
  let a = save.arcs.find((x) => x.id === arc.id);
  if (!a) {
    a = { ...arc, year: save.year, opened: save.week, beats: [] };
    save.arcs.push(a);
  }
  if (a.closed) return;
  const last = a.beats.at(-1);
  if (last && last.week === save.week) return;
  // A beat only when the story moved.
  if (last && Math.abs(last.metric - beat.metric) < 0.01) return;
  a.title = arc.title;
  a.beats.push({ week: save.week, text: beat.text, short: beat.short, metric: beat.metric });
  if (a.beats.length > 12) a.beats.splice(1, 1);
}

function close(save: DynastySave, id: string, text: string): void {
  const a = (save.arcs ?? []).find((x) => x.id === id && x.year === save.year);
  if (!a || a.closed) return;
  a.closed = true;
  a.beats.push({ week: save.week, text, short: text, metric: a.beats.at(-1)?.metric ?? 0 });
}

/** Read the league after the week's games and move every season-long story along. */
export function updateArcs(save: DynastySave): void {
  if (save.cpuOnly && !save.sandbox) return;
  if (save.realHistory || save.phase !== "regular" || save.week < 3) return;
  const year = save.year;
  const ids = activeTeamIds(year).filter((id) => save.teams[id]);
  const season = gamesInSeason(year);
  const pk = save.previewPicks?.year === year ? save.previewPicks : undefined;

  /* The rookie who won't stop. */
  const rookies = Object.values(save.players)
    .filter((p) => p.draftYear === year && ids.includes(p.teamId as TeamId) && p.stats[year])
    .map((p) => ({ p, s: p.stats[year]!, v: rookieScore(p.stats[year]) }))
    .sort((a, b) => b.v - a.v);
  const top = rookies[0];
  if (top && top.v >= save.week * 9) {
    upsert(
      save,
      { id: `rookie-${top.p.id}`, kind: "rookie", title: `The rise of ${playerName(top.p)}`, playerId: top.p.id, teamId: top.p.teamId as TeamId },
      { text: `${rookieLine(top.p, top.s)} through Week ${save.week} for the ${nicknameOf(year, top.p.teamId as TeamId)} rookie, the best of his class.`, short: `he had ${rookieLine(top.p, top.s)}`, metric: Math.round(top.v) },
    );
  }

  /* Preseason favorites falling apart, and teams nobody picked. */
  if (pk && save.week >= 5) {
    for (const id of ids) {
      const t = save.teams[id]!;
      const played = t.wins + t.losses + t.ties;
      const proj = pk.projW[id];
      if (proj === undefined || played < 4) continue;
      const pace = (proj / season) * played;
      const actual = t.wins + t.ties / 2;
      const gap = actual - pace;
      if (proj >= season * 0.6 && gap <= -2.5)
        upsert(
          save,
          { id: `collapse-${id}`, kind: "collapse", title: `What happened to the ${nicknameOf(year, id)}?`, teamId: id, projW: proj },
          { text: `${rec(save, id)} after Week ${save.week}. Projected for ${proj.toFixed(1)} wins in August; on pace for ${((actual / played) * season).toFixed(1)}.`, short: `they were ${rec(save, id)}`, metric: actual },
        );
      else if (proj <= season * 0.45 && gap >= 2.5)
        upsert(
          save,
          { id: `surprise-${id}`, kind: "surprise", title: `Nobody saw the ${nicknameOf(year, id)} coming`, teamId: id, projW: proj },
          { text: `${rec(save, id)} after Week ${save.week}. The preseason number was ${proj.toFixed(1)} wins.`, short: `they were ${rec(save, id)}`, metric: actual },
        );
      const open = (save.arcs ?? []).find((a) => a.year === year && !a.closed && (a.id === `collapse-${id}` || a.id === `surprise-${id}`));
      if (open && Math.abs(gap) <= 0.8) close(save, open.id, `Back to ${rec(save, id)}, right where August had them. Story over.`);
    }
  }

  /* Division races going to the wire. */
  if (save.week >= 8) {
    const keys = [...new Set(ids.map((id) => divisionKey(year, id)))];
    for (const key of keys) {
      const div = ids.filter((id) => divisionKey(year, id) === key).sort((a, b) => winPct(save.teams[b]!) - winPct(save.teams[a]!));
      if (div.length < 2) continue;
      const [a, b] = [save.teams[div[0]!]!, save.teams[div[1]!]!];
      const gb = (a.wins - b.wins + (b.losses - a.losses)) / 2;
      const id = `race-${key}`;
      if (gb <= 1)
        upsert(
          save,
          { id, kind: "race", title: `The race for the ${key}`, teamIds: div.slice(0, 3) },
          { text: `After Week ${save.week}: ${div.slice(0, 3).map((x) => `${nicknameOf(year, x)} ${rec(save, x)}`).join(", ")}.`, short: `it was ${div.slice(0, 2).map((x) => `${nicknameOf(year, x)} ${rec(save, x)}`).join(" and ")}`, metric: gb + div.slice(0, 3).reduce((n, x) => n + save.teams[x]!.wins * 0.01, 0) },
        );
      else if (gb >= 3) close(save, id, `The ${nicknameOf(year, div[0]!)} have pulled away, ${gb} games up.`);
    }
  }

  /* The MVP race changing hands. */
  if (save.week >= 6) {
    const mvp = awardRaces(save, 2).find((l) => l.key === "mvp");
    const lead = mvp?.rows?.[0];
    if (lead?.id && save.players[lead.id]) {
      const arc = (save.arcs ?? []).find((a) => a.id === "mvp" && a.year === year);
      if (!arc || arc.playerId !== lead.id) {
        const p = save.players[lead.id];
        if (p) {
          upsert(
            save,
            { id: "mvp", kind: "mvp", title: "The MVP race", playerId: p.id, teamId: p.teamId as TeamId },
            { text: `${playerName(p)} of the ${nicknameOf(year, p.teamId as TeamId)} ${arc ? "takes over the top spot" : "leads the MVP race"} after Week ${save.week}.`, short: `${playerName(p)} was out front`, metric: save.week },
          );
          const a2 = (save.arcs ?? []).find((a) => a.id === "mvp" && a.year === year);
          if (a2) a2.playerId = p.id;
        }
      }
    }
  }
}

/** For the studio: the stories that moved this week, the longest-running first. */
export function arcsThisWeek(save: DynastySave, week = save.week): StoryArc[] {
  // A story airs when it moved this week and hasn't been on in the last two shows; a fresh
  // turn (its second beat, a new MVP leader, a close) always gets on.
  return seasonArcList(save)
    .filter((a) => a.beats.at(-1)?.week === week && a.beats.length >= 2)
    .filter((a) => a.closed || a.beats.length === 2 || a.kind === "mvp" || a.aired === undefined || week - a.aired >= 3)
    .sort((a, b) => (a.aired ?? 0) - (b.aired ?? 0) || b.beats.length - a.beats.length);
}

/** August's division pick against the standings now: the desk owning a miss. */
export function divisionPickMisses(save: DynastySave): { teamId: TeamId; leader: TeamId; back: number; key: string }[] {
  const pk = save.previewPicks;
  if (!pk || pk.year !== save.year || save.week < 8) return [];
  const ids = activeTeamIds(save.year).filter((id) => save.teams[id]);
  const out: { teamId: TeamId; leader: TeamId; back: number; key: string }[] = [];
  for (const d of pk.divisions) {
    const div = ids.filter((id) => divisionKey(save.year, id) === d.key).sort((a, b) => winPct(save.teams[b]!) - winPct(save.teams[a]!));
    const leader = div[0];
    const pick = save.teams[d.teamId];
    if (!leader || !pick || leader === d.teamId) continue;
    const l = save.teams[leader]!;
    const back = (l.wins - pick.wins + (pick.losses - l.losses)) / 2;
    if (back >= 3) out.push({ teamId: d.teamId, leader, back, key: d.key });
  }
  return out.sort((a, b) => b.back - a.back);
}

export const arcTeamName = (save: DynastySave, id: TeamId) => displayName(save.year, id);
