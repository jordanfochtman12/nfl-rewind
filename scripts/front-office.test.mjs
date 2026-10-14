/**
 * Front-office guard: rookie contracts by era, the CPU's trade judgment (no late pick for a
 * star, a package it builds is one it takes), draft-day trades on the pick chart, and the
 * combine. Plays one seeded dynasty to the 1990 draft, with the owner's club on the clock.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import {
  allPicks,
  createNewGame,
  currentDraftTeam,
  draftPickValue,
  draftQueue,
  evaluateTrade,
  executePickDeal,
  rookieContract,
  rosterOf,
  simUntil,
  simUntilUserPick,
  slotValue,
  tradeDownOffers,
  tradeUpPackage,
  whatWouldItTake,
  COMBINE_FROM,
} from "../src/lib/game/index.ts";

let s;
before(() => {
  const s0 = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 11 });
  s0.cpuOnly = true;
  s = simUntil(s0, (x) => x.year === 1990 && x.phase === "draft");
  s.cpuOnly = false;
});

test("rookies are paid by slot, era by era", () => {
  // Before the cap, the top of the draft earns more than the bottom, nothing like a star.
  assert.ok(rookieContract(1975, 1, 1).salary > rookieContract(1975, 200, 8).salary);
  // 1994-2010, no rookie limit: the No. 1 pick takes a big slice of the cap on a long deal.
  const big = rookieContract(2009, 1, 1);
  assert.ok(big.salary > 10_000_000 && big.salary < 13_000_000 && big.years === 6); // Stafford: ~$12M a year
  // 2011 wage scale: flatter at the top, four years for everyone.
  const scale = rookieContract(2011, 1, 1);
  assert.ok(scale.salary > 4_800_000 && scale.salary < 6_000_000); // Newton: ~$5.5M a year
  const caleb = rookieContract(2024, 1, 1).salary;
  assert.ok(caleb > 10_000_000 && caleb < 12_000_000); // Williams: ~$9.9M a year plus bonus proration
  assert.equal(rookieContract(1994, 1, 1).salary > 2_500_000, true); // Wilkinson: ~$2.4M-3M
  assert.equal(rookieContract(2012, 200, 7).years, 4);
});

test("the pick chart falls off through round one", () => {
  assert.ok(slotValue(1) > slotValue(8) && slotValue(8) > slotValue(32) && slotValue(32) > slotValue(100));
  // The Johnson chart's anchors.
  assert.deepEqual([slotValue(1), slotValue(32), slotValue(64), slotValue(100)], [3000, 590, 270, 100]);
});

test("CPU clubs judge trades through their own eyes", () => {
  const club = "dal";
  const star = rosterOf(s, club).sort((a, b) => b.ovr - a.ovr)[0];
  const late = allPicks(s).find((p) => p.owner === "pit" && !p.used && p.round >= 7);
  assert.equal(evaluateTrade(s, club, [{ pickId: late.id }], [{ playerId: star.id }]).accept, false);
  const depth = rosterOf(s, club).sort((a, b) => b.ovr - a.ovr)[10];
  const ask = whatWouldItTake(s, club, [{ playerId: depth.id }]);
  if (ask.pieces) assert.equal(evaluateTrade(s, club, ask.pieces, [{ playerId: depth.id }]).accept, true);
});

test("draft-day trades: move up for later picks, trade down near the chart", () => {
  const t = structuredClone(s);
  const q = draftQueue(t);
  // A club's pick a couple of slots ahead of the owner's first (never more than the owner's
  // picks can buy: from the fourth slot, three ahead is the first overall pick).
  const mine = q.findIndex((p) => p.owner === "pit" && p.year === t.year);
  const target = q.slice(t.draftPickIndex, mine).reverse().find((p, i) => i >= 1 && p.owner !== "pit");
  const up = tradeUpPackage(t, target.id);
  assert.ok(!("error" in up), "error" in up ? up.error : "");
  assert.ok(up.giveValue >= up.getValue);
  assert.equal(executePickDeal(t, { partner: up.partner, give: up.give.map((p) => p.id), get: up.get.map((p) => p.id) }).ok, true);
  assert.equal(allPicks(t).find((p) => p.id === target.id).owner, "pit");
  simUntilUserPick(t);
  assert.equal(currentDraftTeam(t), "pit");
  for (const o of tradeDownOffers(t)) {
    assert.ok(o.getValue >= o.giveValue * 0.9 && o.getValue <= o.giveValue * 1.25, o.pitch);
    assert.ok(o.get.every((p) => draftPickValue(t, p) > 0));
  }
});

test("the combine runs from 1982 and measures the class", () => {
  assert.equal(COMBINE_FROM, 1982);
  const measured = s.draftBoard.map((pr) => s.players[pr.playerId]).filter((p) => p?.combine && !p.combine.satOut);
  assert.ok(measured.length > 100);
  assert.ok(measured.every((p) => p.combine.forty >= 4.21 && p.combine.forty <= 5.9));
});
