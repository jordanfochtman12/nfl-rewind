/** The free-agency recap and the Super Bowl book. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil } from "../src/lib/game/index.ts";
import { faHeadlines, faRecap } from "../src/lib/game/faRecap.ts";
import { superBowlBook } from "../src/lib/game/superBowlBook.ts";

test("free agency: a live recap while the market is open, filed when it closes", () => {
  let s = createNewGame({ userTeamId: "dal", startingYear: 1995, seed: 21 });
  s = simUntil(s, (x) => x.phase === "freeAgency" && x.year === 1996);
  const live = faRecap(s);
  assert.ok(live && !live.final);
  assert.ok(live.signings.length > 0, "CPU clubs signed someone");
  for (let i = 1; i < live.signings.length; i++) assert.ok(live.signings[i - 1].ovr >= live.signings[i].ovr);
  assert.equal(live.teams.length, 30);
  assert.ok(live.teams.every((t) => /^[A-DF][+-]?$/.test(t.grade)));
  assert.ok(faHeadlines(s, live).length >= 2);
  s = simUntil(s, (x) => x.phase !== "freeAgency");
  const filed = s.faRecaps?.[1996];
  assert.ok(filed && filed.final, "filed when the market closed");
  assert.deepEqual(faRecap(s, 1996), filed);
  // Moves are real: the club he signed with is where he plays now (or he has moved on since).
  const top = filed.signings[0];
  if (top) assert.ok(s.players[top.playerId]);
});

test("the Super Bowl book: champions, rings, dynasties, records", () => {
  const s = simUntil(createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed: 9 }), (x) => x.year >= 1980);
  const b = superBowlBook(s);
  assert.equal(b.games.length, s.history.superBowls.length);
  assert.ok(b.games.length >= 13);
  assert.equal(b.clubs.reduce((n, c) => n + c.wins, 0), b.games.length);
  for (let i = 1; i < b.clubs.length; i++) assert.ok(b.clubs[i - 1].wins >= b.clubs[i].wins);
  for (const g of b.games) assert.ok(g.winScore >= g.loseScore && g.winner !== g.loser);
  assert.equal(b.records.length, 5);
  assert.ok(b.defending && b.defending.teamId === b.games.at(-1).winner);
  for (const d of b.dynasties) assert.ok(d.wins >= 2 && d.to > d.from);
  assert.ok(b.waiting.every((id) => !b.clubs.find((c) => c.teamId === id)?.wins));
});
