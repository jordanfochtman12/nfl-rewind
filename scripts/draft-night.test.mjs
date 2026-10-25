/** Draft night on television: every pick measured against the board, runs, trades, recaps. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNewGame,
  simUntil,
  makeDraftPick,
  draftQueue,
  pickBreakdown,
  picksMade,
  draftTicker,
  roundRecap,
  bestFits,
  onTheClock,
  draftVenue,
  drafteeCall,
  tradeUpPackage,
  executePickDeal,
  draftRecap,
} from "../src/lib/game/index.ts";

const atDraft = (year, team = "chi") => simUntil(createNewGame({ userTeamId: team, startingYear: year, seed: 7 }), (x) => x.phase === "draft");

test("every pick gets a value, a grade and a desk take built from the board", () => {
  for (const year of [1975, 2005]) {
    const s = atDraft(year);
    const teams = onTheClock(s) && draftQueue(s).filter((q) => q.round === 1).length;
    for (let k = 0; k < teams; k++) makeDraftPick(s);
    const made = picksMade(s);
    assert.equal(made.length, teams);
    const rows = made.map((p) => pickBreakdown(s, p.id, made));
    const kinds = new Map();
    for (const b of rows) {
      assert.ok(b && b.consensus >= 1, "a board rank");
      assert.match(b.grade, /^(A\+|A-?|B[+-]?|C[+-]?|D)$/);
      assert.ok(b.desk.length > 20 && !/undefined|NaN/.test(b.desk), b.desk);
      assert.equal(b.delta, b.overall - b.consensus);
      kinds.set(b.value, (kinds.get(b.value) ?? 0) + 1);
    }
    // A broadcast, not a roast: the first round isn't mostly "big reach".
    assert.ok((kinds.get("BIG REACH") ?? 0) <= teams * 0.35, `${year}: ${JSON.stringify([...kinds])}`);
    const recap = roundRecap(s, 1);
    assert.equal(recap.picks, teams);
    assert.ok(recap.best && recap.line.startsWith("Round 1 is in the books"));
    const t = draftTicker(s, 3);
    assert.ok(t[0].startsWith(`${teams} · `), "newest first");
    const now = onTheClock(s);
    assert.equal(now.overall, teams + 1);
    assert.equal(now.round, 2);
    assert.equal(bestFits(s, now.teamId, 3).length, 3);
  }
});

test("a traded pick says where it came from, and the last pick is Mr. Irrelevant", () => {
  const s = atDraft(2010);
  const q = draftQueue(s);
  // Move up one spot, ahead of the owner's own first pick: always affordable.
  const mineAt = q.findIndex((p) => p.owner === s.userTeamId);
  const target = q.slice(0, mineAt).reverse().find((p) => p.owner !== s.userTeamId);
  const deal = tradeUpPackage(s, target.id);
  assert.ok(!("error" in deal), deal.error);
  {
    const r = executePickDeal(s, { partner: deal.partner, give: deal.give.map((p) => p.id), get: deal.get.map((p) => p.id) });
    assert.ok(r.ok, r.reason);
    const slot = draftQueue(s).findIndex((p) => p.id === target.id);
    while (s.draftPickIndex <= slot) makeDraftPick(s);
    const mine = picksMade(s).find((p) => p.draftPick === slot + 1);
    const b = pickBreakdown(s, mine.id);
    assert.equal(b.teamId, s.userTeamId);
    assert.equal(b.from, target.orig);
    assert.ok(drafteeCall(s, b).length > 20);
  }
  while (makeDraftPick(s));
  const last = picksMade(s).at(-1);
  const b = pickBreakdown(s, last.id);
  assert.ok(b.last, "the final selection");
  assert.match(b.desk, /Mr\. Irrelevant/);
});

test("the venue follows the real draft's home", () => {
  assert.match(draftVenue(1970), /New York/);
  assert.match(draftVenue(1999), /Madison Square Garden/);
  assert.match(draftVenue(2010), /Radio City/);
  assert.match(draftVenue(2020), /virtual/);
  assert.match(draftVenue(2024), /Detroit/);
});

test("the morning after: every club's class graded on the curve, with the steals and reaches", () => {
  const s = atDraft(1985);
  while (makeDraftPick(s));
  const r = draftRecap(s);
  assert.ok(r, "a recap once the board is done");
  assert.equal(r.picks.length, picksMade(s).length);
  assert.equal(r.teams.length, new Set(r.picks.map((b) => b.teamId)).size, "one row per club");
  const letters = new Set(r.teams.map((t) => t.grade[0]));
  assert.ok(letters.has("A") && (letters.has("C") || letters.has("D")), `grades spread out: ${[...letters].join("")}`);
  for (let i = 1; i < r.teams.length; i++) assert.ok(r.teams[i - 1].gpa >= r.teams[i].gpa, "best class first");
  assert.ok(r.steals.every((b) => b.delta > 0) && r.reaches.every((b) => b.delta < 0));
  for (const t of r.teams) assert.ok(t.picks.every((b) => b.teamId === t.teamId));
});
