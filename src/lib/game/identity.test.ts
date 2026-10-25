import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanNameParts, historicalNameKey, normalizedName } from "./identity.ts";
import { fieldText, displayYards } from "./fieldText.ts";
import { draftSeedsFor } from "./data/draftClasses.ts";
import { createNewGame } from "./createGame.ts";
import { buildDraftBoard } from "./draft.ts";
import { hydrateSave } from "./save.ts";
import { addToRoster } from "./players.ts";
import { compactSave } from "./compact.ts";
import { historicalYear } from "./historicalYears.ts";
import type { Player, SeasonStats } from "./types.ts";

test("all screenshot name artifacts are stripped without damaging normal names", () => {
  assert.deepEqual(cleanNameParts("bgcolor=#FFCC00|Floyd", "Little"), {
    firstName: "Floyd",
    lastName: "Little",
  });
  assert.deepEqual(cleanNameParts("bgcolor=lightsteelblue|G", "Webster"), {
    firstName: "G",
    lastName: "Webster",
  });
  assert.deepEqual(cleanNameParts("align=left", "Ted Hendricks"), {
    firstName: "Ted",
    lastName: "Hendricks",
  });
  assert.deepEqual(cleanNameParts('style="background: red" | Gene', "Upshaw"), {
    firstName: "Gene",
    lastName: "Upshaw",
  });
  assert.deepEqual(cleanNameParts("D'Andre", "O'Neal-Smith"), {
    firstName: "D'Andre",
    lastName: "O'Neal-Smith",
  });
  assert.equal(normalizedName("L. C.", "Greenwood"), normalizedName("L.C.", "Greenwood"));
});

test("nickname aliases resolve, but siblings and different cohorts do not", () => {
  assert.notEqual(historicalNameKey("Michael", "Thomas", 2016), historicalNameKey("Mike", "Thomas", 2016));
  for (const [year, a, b, last] of [
    [1974, "Too Tall", "Ed", "Jones"],
    [2005, "Carnell", "Cadillac", "Williams"],
    [2022, "Sauce", "Ahmad", "Gardner"],
    [1966, "Walt", "Walter", "Barnes"],
  ] as const) {
    assert.equal(historicalNameKey(a, last, year), historicalNameKey(b, last, year));
    const hits = draftSeedsFor(year).filter(
      (p) => historicalNameKey(p.f, p.l, year) === historicalNameKey(a, last, year),
    );
    assert.equal(hits.length, 1, `${year}: ${last}`);
  }
  assert.notEqual(historicalNameKey("Ron", "Saul", 1970), historicalNameKey("Rich", "Saul", 1970));
  assert.notEqual(
    historicalNameKey("Tiki", "Barber", 1997),
    historicalNameKey("Ronde", "Barber", 1997),
  );
  assert.notEqual(
    historicalNameKey("Walt", "Barnes", 2000),
    historicalNameKey("Walter", "Barnes", 2000),
  );
});

test("every draft class has clean, unique identities", () => {
  for (let year = 1966; year <= 2026; year++) {
    const rows = draftSeedsFor(year);
    assert.equal(new Set(rows.map((p) => historicalNameKey(p.f, p.l, year))).size, rows.length);
    assert.ok(rows.every((p) => !/bgcolor|align=|style=|\|/.test(`${p.f} ${p.l}`)));
  }
  assert.equal(draftSeedsFor(1969).filter((p) => p.l === "Hendricks" && p.f === "Ted").length, 1);
  assert.equal(draftSeedsFor(1967).filter((p) => p.l === "Lammons").length, 0);
  assert.equal(historicalYear("Pete", "Lammons", 1967), 1966);
  assert.equal(historicalYear("Aaron", "Brown", 1966), 1966);
  assert.equal(historicalYear("Aaron", "Brown", 1986), 1986);
});

test("1966 rookies are on the draft board once, not duplicated as veterans", () => {
  const save = createNewGame("pit");
  const pete = Object.values(save.players).filter(
    (p) => p.firstName === "Pete" && p.lastName === "Lammons",
  );
  assert.equal(pete.length, 1);
  assert.equal(pete[0]!.pos, "TE");
  assert.equal(pete[0]!.teamId, "fa");
  assert.ok(save.draftBoard.some((p) => p.playerId === pete[0]!.id));
  // The second (AFL) draft cannot issue the same person at a different position.
  pete[0]!.pos = "WR";
  save.draftSession = "afl";
  buildDraftBoard(save);
  assert.equal(
    Object.values(save.players).filter((p) => p.firstName === "Pete" && p.lastName === "Lammons")
      .length,
    1,
  );
});

test("legacy duplicates repair references, preserve ownership and totals, and reload idempotently", () => {
  const save = createNewGame("pit");
  save.year = 1969;
  const keep = Object.values(save.players).find(
    (p) => p.firstName === "Pete" && p.lastName === "Lammons",
  )!;
  addToRoster(save, "pit", keep.id);
  keep.stats = { 1968: { year: 1968, teamId: "pit", gp: 14, rec: 20, recYds: 200 } as SeasonStats };
  keep.career = [structuredClone(keep.stats[1968]!)];
  const other: Player = structuredClone(keep);
  other.id = "h-duplicate-lammons-WR";
  other.pos = "WR";
  other.draftYear = undefined; // old veteran copy
  other.arc = undefined;
  other.stats[1968]!.rec = 10;
  other.stats[1968]!.recYds = 100;
  other.career = [structuredClone(other.stats[1968]!)];
  save.players[other.id] = other;
  save.teams.pit.roster.push(other.id);
  save.teams.pit.depth.WR = [other.id];
  save.schedule[0]!.boxHome = [
    { playerId: other.id, rec: 2 },
    { playerId: keep.id, rec: 3 },
  ];
  save.pendingHof = [other.id];
  save.news[0]!.playerIds = [other.id];
  save.draftBoard.push({ playerId: other.id, slot: 500, taken: true, league: "nfl" });
  const before = {
    rng: save.rng,
    year: save.year,
    week: save.week,
    picks: save.draftPickIndex,
    ratings: structuredClone(keep.ratings),
    salary: keep.salary,
  };
  const repaired = hydrateSave(structuredClone(save));
  const p = repaired.players[keep.id]!;
  assert.ok(p);
  assert.equal(repaired.players[other.id], undefined);
  assert.equal(p.teamId, "pit");
  assert.equal(p.stats[1968]!.recYds, 300);
  assert.equal(p.stats[1968]!.gp, 14);
  assert.equal(p.career.find((s) => s.year === 1968)!.recYds, 300);
  assert.deepEqual(p.ratings, before.ratings);
  assert.equal(p.salary, before.salary);
  assert.equal(repaired.rng, before.rng);
  assert.equal(repaired.year, before.year);
  assert.equal(repaired.week, before.week);
  assert.equal(repaired.draftPickIndex, before.picks);
  assert.deepEqual(repaired.pendingHof, [keep.id]);
  assert.deepEqual(repaired.news[0]!.playerIds, [keep.id]);
  assert.deepEqual(repaired.schedule[0]!.boxHome, [{ playerId: keep.id, rec: 5 }]);
  assert.ok(!repaired.teams.pit.depth.WR?.includes(keep.id));
  assert.equal(repaired.teams.pit.roster.filter((id) => id === keep.id).length, 1);
  assert.equal(repaired.draftBoard.filter((row) => row.playerId === keep.id).length, 1);
  assert.ok(repaired.draftBoard.find((row) => row.playerId === keep.id)!.taken);
  assert.deepEqual(
    repaired.identityRepairs![0]!.originals.find((p) => p.id === other.id),
    other,
  );
  const twice = hydrateSave(JSON.parse(JSON.stringify(compactSave(repaired))));
  assert.deepEqual(
    JSON.parse(JSON.stringify(twice.players)),
    JSON.parse(JSON.stringify(repaired.players)),
  );
  assert.deepEqual(twice.identityRepairs, JSON.parse(JSON.stringify(repaired.identityRepairs)));
});

test("save repair catches aliases but preserves generated namesakes", () => {
  const save = createNewGame("pit");
  const template = Object.values(save.players)[0]!;
  const make = (id: string, firstName: string, historical = true) => ({
    ...structuredClone(template),
    id,
    firstName,
    lastName: "Jones",
    draftYear: 1974,
    arc: undefined,
    historical,
    teamId: "fa" as const,
  });
  save.players.a = make("a", "Too Tall");
  save.players.b = make("b", "Ed");
  save.players.c = make("c", "Ed", false);
  const repaired = hydrateSave(save);
  assert.ok(repaired.players.a);
  assert.equal(repaired.players.b, undefined);
  assert.ok(repaired.players.c);
});

test("fractional yard lines remain readable on both sides and at the goal line", () => {
  assert.equal(fieldText(32.349999999999994), "your own 32");
  assert.equal(fieldText(67.65), "the opponent's 32");
  assert.equal(fieldText(50), "midfield");
  assert.equal(fieldText(49.999999999999), "midfield");
  assert.equal(fieldText(99.75), "the opponent's 1");
  assert.equal(displayYards(3.2499999999), 3);
});

test("legacy markup and shortened Webster name hydrate to the correct historical name", () => {
  const save = createNewGame("pit");
  const template = Object.values(save.players)[0]!;
  save.players.webster = {
    ...structuredClone(template),
    id: "webster",
    firstName: "bgcolor=lightsteelblue|G",
    lastName: "Webster",
    historical: true,
    draftYear: 1967,
    arc: undefined,
    teamId: "fa",
  };
  const repaired = hydrateSave(save);
  assert.equal(repaired.players.webster!.firstName, "George");
  assert.equal(repaired.players.webster!.lastName, "Webster");
});
