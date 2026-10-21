/**
 * The player audit (scripts/player-audit.mjs): the regular game's named players, checked
 * against the real record. These pin a handful of known facts and the audit tables' shape;
 * regenerate with `node --experimental-strip-types scripts/player-audit.mjs`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { draftSeedsBase, draftSeedsFor } from "../src/lib/game/data/draftClasses.ts";
import { veterans1966 } from "../src/lib/game/data/veterans1966.ts";
import { AUDIT_FIX, AUDIT_UNDRAFTED, AUDIT_VETS } from "../src/lib/game/data/auditPlayers.ts";
import { historicalNameKey, normalizedName } from "../src/lib/game/identity.ts";
import { lookupArc, lookupVetArc } from "../src/lib/game/careerArc.ts";
import { createNewGame } from "../src/lib/game/index.ts";

const POS = new Set(["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "DE", "DT", "OLB", "MLB", "CB", "S", "K", "P"]);
const seed = (year, f, l) => draftSeedsFor(year).find((s) => s.f === f && s.l === l);

test("draft classes carry the real round, position and school", () => {
  assert.equal(seed(2025, "Shedeur", "Sanders")?.r, 5);
  assert.equal(seed(1969, "Jerry", "LeVias")?.r, 2);
  assert.equal(seed(1967, "Preston", "Pearson")?.p, "RB");
  assert.equal(seed(1995, "Hugh", "Douglas")?.c, "Central State (Ohio)");
  // Namesakes in one class are never merged: two Alex Smiths went in 2005.
  assert.equal(seed(2005, "Alex", "Smith")?.r, 1);
  assert.equal(seed(2005, "Alex", "Smith")?.p, "QB");
});

test("every playable draft class has unique identities and valid audited positions", () => {
  for (let year = 1966; year <= 2026; year++) {
    const rows = draftSeedsFor(year);
    const identities = new Set();
    for (const player of rows) {
      const identity = historicalNameKey(player.f, player.l, year);
      assert.ok(identity, `${year}: blank player identity`);
      assert.ok(!identities.has(identity), `${year}: duplicate player ${player.f} ${player.l}`);
      identities.add(identity);
      assert.ok(POS.has(player.p), `${year}: ${player.f} ${player.l} has invalid position ${player.p}`);
      assert.ok(Number.isInteger(player.o) && player.o >= 0 && player.o <= 99, `${year}: ${player.f} ${player.l} has invalid grade ${player.o}`);
      assert.ok(player.r === undefined || (Number.isInteger(player.r) && player.r >= 0 && player.r <= 30), `${year}: ${player.f} ${player.l} has invalid draft round ${player.r}`);
    }
  }
});

test("1996 Zach Thomas is one linebacker on the class and the draft board", () => {
  const classRows = draftSeedsFor(1996).filter((player) => normalizedName(player.f, player.l) === "zachthomas");
  assert.equal(classRows.length, 1, "duplicate entries from the overlapping class sources must collapse");
  assert.equal(classRows[0].p, "MLB");
  const save = createNewGame({ userTeamId: "mia", startingYear: 1996, seed: 3 });
  const players = Object.values(save.players).filter((player) => normalizedName(player.firstName, player.lastName) === "zachthomas");
  const board = save.draftBoard.filter((pick) => save.players[pick.playerId] && normalizedName(save.players[pick.playerId].firstName, save.players[pick.playerId].lastName) === "zachthomas");
  assert.equal(players.length, 1, "franchise initialization must not make a second Zach Thomas");
  assert.equal(players[0].pos, "MLB");
  assert.equal(board.length, 1, "the player must occupy one draft-board slot");
});

test("every correction points at a real catalog entry", () => {
  const byYear = new Map();
  for (const k of Object.keys(AUDIT_FIX)) {
    const [y, name] = k.split("|");
    if (!byYear.has(y)) byYear.set(y, new Set(draftSeedsBase(Number(y)).map((s) => normalizedName(s.f, s.l))));
    assert.ok(byYear.get(y).has(name), `fix for ${k} matches nobody`);
    const f = AUDIT_FIX[k];
    if (f.p) assert.ok(POS.has(f.p));
    if (f.ht) assert.ok(f.ht >= 64 && f.ht <= 85, `${k} height ${f.ht}`);
    if (f.wt) assert.ok(f.wt >= 140 && f.wt <= 390, `${k} weight ${f.wt}`);
  }
});

test("missing real players are added once, with real careers", () => {
  const kapp = seed(1967, "Joe", "Kapp");
  assert.ok(kapp && kapp.r === 0 && kapp.p === "QB");
  assert.equal(lookupArc(1967, "Joe", "Kapp")?.to, 1970);
  assert.ok(seed(2015, "Joe", "Cardona"), "long snappers were missing");
  assert.ok(seed(2007, "Tyler", "Palko")?.r === 0, "Tyler Palko signed as a 2007 UDFA despite his 2010 statistical debut");
  assert.equal(seed(2010, "Tyler", "Palko"), undefined, "Tyler Palko must not be listed in the 2010 class");
  assert.equal(seed(2007, "H.B.", "Blades")?.p, "MLB");
  assert.equal(seed(2011, "Greg", "Romeus")?.p, "DE");
  for (const [year, first, last] of [[1997, "Geroy", "Simon"], [2001, "John", "Turman"], [2004, "Rod", "Rutherford"], [2010, "Bill", "Stull"], [2013, "Marco", "Pecora"], [2013, "Tino", "Sunseri"]])
    assert.equal(seed(year, first, last)?.r, 0, `${first} ${last} belongs in the ${year} undrafted prospect pool`);
  assert.equal(seed(2029, "Mason", "Heintschel")?.p, "QB", "Mason Heintschel is a projected 2029 QB prospect");
  for (const [y, list] of Object.entries(AUDIT_UNDRAFTED))
    for (const s of list) {
      assert.ok(POS.has(s.p), `${s.f} ${s.l} ${s.p}`);
      assert.ok(s.o >= 50 && s.o <= 90);
      assert.equal(draftSeedsFor(Number(y)).filter((x) => x.f === s.f && x.l === s.l).length <= 1, true);
    }
});

test("1966 veterans are on their real clubs, and only men who played that year", () => {
  const vets = veterans1966();
  const by = (f, l) => vets.find((v) => v.f === f && v.l === l);
  assert.equal(by("Ernie", "Ladd")?.t, "oti");
  assert.equal(by("Dave", "Costa")?.t, "buf");
  assert.equal(by("Randy", "Rasmussen"), undefined);
  assert.equal(by("Garo", "Yepremian")?.t, "det");
  assert.equal(lookupVetArc("Willie", "Wood", "S")?.to, 1971);
  const keys = vets.map((v) => normalizedName(v.f, v.l) + v.t + v.p);
  assert.equal(new Set(keys).size, keys.length, "a veteran listed twice on one club");
  assert.ok(AUDIT_VETS.length > 200);
  const s = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 3 });
  for (const t of ["gnb", "atl", "nyj"]) {
    const real = Object.values(s.players).filter((p) => p.teamId === t && p.historical).length;
    assert.ok(real >= 30, `${t} has only ${real} real players`);
  }
});
