/**
 * Era starts: a league begun in a later season opens on that season's real rosters, with real
 * ratings for the stars, real history behind it, and plays on like any dynasty to 2040.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, END_YEAR, loadHistoryData, rosterOf, setHistoryData, simUntil } from "../src/lib/game/index.ts";

before(async () => setHistoryData(await loadHistoryData()));

const find = (s, first, last) => Object.values(s.players).find((p) => p.firstName === first && p.lastName === last);

test("1985 opens on the real rosters, real stars rated like stars", () => {
  const s = createEraGame({ userTeamId: "chi", startingYear: 1985 });
  assert.equal(s.year, 1985);
  assert.equal(s.phase, "draft");
  assert.equal(s.startingYear, 1985);
  assert.ok(!s.realHistory && !s.sandbox);
  const montana = find(s, "Joe", "Montana");
  assert.equal(montana?.teamId, "sfo");
  assert.ok(montana.ovr >= 85, `Montana ${montana.ovr}`);
  const payton = find(s, "Walter", "Payton");
  assert.equal(payton?.teamId, "chi");
  assert.ok(payton.ovr >= 85);
  // The real past is on the books: 19 Super Bowls before the 1985 season, real career lines.
  assert.equal(s.history.superBowls.length, 19);
  assert.ok((payton.stats[1984]?.rushYds ?? 0) > 1500, "Payton's real 1984");
  // Every club fields a full roster, mostly real players; this year's real class is on the board.
  for (const id of Object.keys(s.teams)) {
    if (!s.teams[id].active) continue;
    const r = rosterOf(s, id);
    assert.ok(r.length >= 40, `${id} roster ${r.length}`);
    assert.ok(r.filter((p) => p.historical).length / r.length > 0.8, `${id} is mostly real`);
  }
  assert.ok(s.draftBoard.some((pr) => s.players[pr.playerId]?.lastName === "Rice" && s.players[pr.playerId]?.firstName === "Jerry"));
});

test("a 2020 Watch history league plays its first season", () => {
  let s = createEraGame({ userTeamId: "gnb", startingYear: 2020, sandbox: true, seed: 3 });
  assert.equal(find(s, "Patrick", "Mahomes")?.teamId, "kan");
  s = simUntil(s, (x) => x.year === 2021 && x.phase === "draft");
  assert.equal(s.history.superBowls.at(-1)?.year, 2020);
  assert.equal(END_YEAR, 2040);
});

test("the league stays the real league: real players fill the rosters season after season", () => {
  let s = createEraGame({ userTeamId: "chi", startingYear: 1985, sandbox: true, seed: 11 });
  for (const y of [1985, 1986, 1987]) {
    s = simUntil(s, (x) => x.year === y && x.phase === "regular");
    const on = Object.values(s.players).filter((p) => s.teams[p.teamId]?.active);
    const real = on.filter((p) => p.historical).length / on.length;
    assert.ok(real >= 0.96, `${y}: ${(real * 100).toFixed(1)}% real`);
  }
});

test("the owner's own class is in a league that starts after it", () => {
  const s = createEraGame({ userTeamId: "pit", startingYear: 2020, sandbox: true, seed: 5 });
  for (const [f, l] of [["Jordan", "Fochtman"], ["Tommy", "DeArmitt"], ["Austin", "Widner"], ["Tyler", "DeArmitt"]]) {
    const p = find(s, f, l);
    assert.ok(p, `${f} ${l} is in the league`);
    assert.ok(p.historical && p.gem);
  }
  const later = createEraGame({ userTeamId: "pit", startingYear: 2001, seed: 5 });
  assert.equal(find(later, "Jordan", "Fochtman"), undefined, "not before his class");
});
