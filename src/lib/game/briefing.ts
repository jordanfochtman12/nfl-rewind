/** Read-only scouting: never consumes RNG or exposes a prospect's true overall. */
import type { DynastySave, TeamId, Pos } from './types.ts';
import { rosterOf, starterCount } from './players.ts';
import { visibleOvr } from './scout.ts';

export const UNIT_POSITIONS: { name: string; positions: Pos[] }[] = [
  { name: 'Quarterback', positions: ['QB'] },
  { name: 'Backfield', positions: ['RB', 'FB'] },
  { name: 'Receivers', positions: ['WR', 'TE'] },
  { name: 'Offensive line', positions: ['LT', 'LG', 'C', 'RG', 'RT'] },
  { name: 'Defensive front', positions: ['DE', 'DT', 'OLB', 'MLB'] },
  { name: 'Secondary', positions: ['CB', 'S'] },
  { name: 'Special teams', positions: ['K', 'P'] },
];

export function unitReport(save: DynastySave, id: TeamId) {
  const team = save.teams[id];
  const roster = rosterOf(save, id);
  return UNIT_POSITIONS.map(({ name, positions }) => {
    let total = 0, slots = 0, available = 0;
    for (const pos of positions) {
      const n = starterCount(pos, team.offScheme, team.defScheme);
      const order = team.depth?.[pos] ?? [];
      const healthy = roster.filter(p => p.pos === pos && p.injuredWeeks <= 0 && !p.onIR && !p.holdout)
        .sort((a, b) => {
          const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
          return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || visibleOvr(b) - visibleOvr(a);
        }).slice(0, n);
      slots += n;
      available += healthy.length;
      total += healthy.reduce((sum, p) => sum + visibleOvr(p), 0);
    }
    return { name, grade: slots ? Math.round(total / slots) : 0, available, slots };
  });
}

export function seasonForm(save: DynastySave, id: TeamId, excludedGameId?: string | null) {
  return save.schedule.filter(g => g.year === save.year && g.phase === 'regular' && g.played &&
    g.id !== excludedGameId && (g.homeId === id || g.awayId === id))
    .sort((a, b) => a.week - b.week).map(g => {
      const home = g.homeId === id;
      const scored = home ? g.homeScore : g.awayScore;
      const allowed = home ? g.awayScore : g.homeScore;
      return { id: g.id, week: g.week, opponent: (home ? g.awayId : g.homeId) as TeamId,
        home, scored, allowed, result: scored > allowed ? 'W' : scored < allowed ? 'L' : 'T' };
    });
}

export function nextMatchup(save: DynastySave) {
  const games = save.phase === 'superBowl' ? (save.superBowl ? [save.superBowl] : []) :
    save.phase === 'playoffs' ? save.playoffGames :
    ['regular', 'deadline', 'preseason'].includes(save.phase) ? save.schedule : [];
  return games.find(g => !g.played && (g.homeId === save.userTeamId || g.awayId === save.userTeamId));
}
