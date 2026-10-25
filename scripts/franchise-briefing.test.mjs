import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/lib/game/createGame.ts';
import { unitReport, seasonForm, nextMatchup } from '../src/lib/game/briefing.ts';
import { importDynasty } from '../src/lib/game/importSave.ts';
import { compactSave } from '../src/lib/game/compact.ts';
import { weekPrimetime } from '../src/lib/game/events.ts';
import { finalPossessionCall } from '../src/lib/game/sim.ts';

test('final possession pursues the score needed instead of wasting the clock', () => {
  for (const clock of [1, 8, 20, 30]) {
    for (const down of [1, 2, 3, 4]) {
      assert.equal(finalPossessionCall(4, clock, down, 40, 4, 50), 'deep');
      assert.equal(finalPossessionCall(4, clock, down, 90, 4, 50), 'short');
    }
  }
  assert.equal(finalPossessionCall(4, 8, 1, 70, 3, 50), 'fg');
  assert.equal(finalPossessionCall(4, 20, 4, 70, 1, 50), 'fg');
  assert.equal(finalPossessionCall(4, 8, 1, 70, 3, 44), 'med');
  assert.equal(finalPossessionCall(4, 20, 1, 70, 3, 50), 'med');
  assert.equal(finalPossessionCall(4, 31, 4, 40, 4, 50), undefined);
  // End of the half: one snap left in range, take the points; out of range, the staff's call.
  assert.equal(finalPossessionCall(2, 8, 1, 70, 3, 50), 'fg');
  assert.equal(finalPossessionCall(2, 8, 1, 40, 3, 50), undefined);
  assert.equal(finalPossessionCall(4, 8, 1, 70, -3, 50), undefined);
  // Tied in range with one snap left: kick it and win. Tied out of range: the staff's call.
  assert.equal(finalPossessionCall(4, 8, 1, 70, 0, 50), 'fg');
  assert.equal(finalPossessionCall(5, 6, 2, 72, 0, 50), 'fg');
  assert.equal(finalPossessionCall(4, 8, 1, 40, 0, 50), undefined);
  // Before 1974 the posts were on the goal line: the same spot is ten yards shorter.
  assert.equal(finalPossessionCall(4, 8, 1, 60, 3, 50, 7), 'fg');
  assert.equal(finalPossessionCall(4, 8, 1, 60, 3, 50), 'deep');
});

const create = () => createNewGame({ userTeamId: 'gnb', startingYear: 1966, seed: 1966 });
test('scouting report is deterministic and never mutates dynasty RNG or data', () => {
  const save = create(); const before = JSON.stringify(save);
  const a = unitReport(save, 'gnb');
  assert.equal(a.length, 7); assert.deepEqual(a, unitReport(save, 'gnb'));
  assert.equal(JSON.stringify(save), before);
  assert.ok(a.every(u => u.grade >= 0 && u.grade <= 99 && u.available <= u.slots));
});
test('scouting respects depth order, hidden grades and unavailable starters', () => {
  const save = create(); const qbs = save.teams.gnb.roster.map(id => save.players[id]).filter(p => p.pos === 'QB');
  const qb = qbs[0]; save.teams.gnb.depth.QB = qbs.map(p => p.id);
  qb.revealed = false; qb.scoutOvr = 55; qb.ovr = 99;
  assert.equal(unitReport(save, 'gnb')[0].grade, 55);
  qbs.forEach(p => { p.injuredWeeks = 1; });
  assert.equal(unitReport(save, 'gnb')[0].grade, 0);
  assert.equal(unitReport(save, 'gnb')[0].available, 0);
});
test('form excludes unplayed games, old seasons and live spoilers', () => {
  const save = create(); const games = save.schedule.filter(g => g.homeId === 'gnb' || g.awayId === 'gnb');
  games[0].played = true; games[0].homeScore = 10; games[0].awayScore = 10;
  games[1].played = true;
  assert.equal(seasonForm(save, 'gnb', games[1].id).length, 1);
  assert.equal(seasonForm(save, 'gnb', games[1].id)[0].result, 'T');
  save.phase = 'regular'; assert.equal(nextMatchup(save)?.id, games[2].id);
  save.phase = 'awards'; assert.equal(nextMatchup(save), undefined);
});
test('import rejects unrelated, malformed and future save files', () => {
  for (const raw of ['{}', 'null', '[]', '{broken']) assert.throws(() => importDynasty(raw));
  const save = create(); save.version = 999;
  assert.throws(() => importDynasty(JSON.stringify(compactSave(save))), /newer version/);
});
test('valid dynasty roundtrip preserves identity, roster and schedule', () => {
  const save = create(); const restored = importDynasty(JSON.stringify(compactSave(save)));
  assert.equal(restored.userTeamId, save.userTeamId);
  assert.equal(restored.year, save.year);
  assert.deepEqual(restored.teams.gnb.roster, save.teams.gnb.roster);
  assert.equal(JSON.stringify(restored.schedule), JSON.stringify(save.schedule));
});
test('weekly awards use current box scores and skip idle conferences', () => {
  const save = create(); save.week = 1;
  const game = save.schedule.find(g => g.week === 1);
  const qbs = Object.values(save.players).filter(p => p.pos === 'QB' && (p.teamId === game.homeId || p.teamId === game.awayId));
  const home = qbs.find(p => p.teamId === game.homeId);
  const away = qbs.find(p => p.teamId === game.awayId);
  game.played = true;
  game.boxHome = [{playerId:home.id,passAtt:20,passYds:300,passTd:3}];
  game.boxAway = [{playerId:away.id,passAtt:20,passYds:80,passTd:0}];
  away.stats[1966] = {...(away.stats[1966] ?? {}),passYds:9999,passTd:99};
  save.lastPow.nfc = 'stale-award';
  weekPrimetime(save);
  assert.equal(save.lastPow.afc, home.id);
  assert.equal(save.lastPow.nfc, undefined);
  assert.equal(save.weekNews.filter(n => n.kind === 'pow').length, 1);
  assert.ok(save.weekNews.find(n => n.kind === 'pow').headline.startsWith('AFL'));
});
