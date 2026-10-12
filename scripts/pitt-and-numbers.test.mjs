/** Every real Pitt Panther on the board, one entry per player, and rookies in their own numbers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { draftSeedsFor } from "../src/lib/game/data/draftClasses.ts";
import { createNewGame, simUntil, makeDraftPick } from "../src/lib/game/index.ts";
import { jerseyLegal, preferredJersey } from "../src/lib/game/names.ts";

const pitt = (y) => draftSeedsFor(y).filter((s) => /^pitt(sburgh)?$/i.test(s.c ?? ""));

test("real Pitt players are in their classes, undrafted ones too, each once", () => {
  const names = (y) => pitt(y).map((s) => `${s.f} ${s.l}`);
  assert.ok(names(1977).includes("Tony Dorsett"));
  assert.ok(names(1983).includes("Dan Marino"));
  assert.ok(names(2014).includes("Aaron Donald"));
  // Undrafted Panthers who reached a roster, even briefly.
  assert.ok(names(2016).includes("Manasseh Garner"));
  assert.ok(names(2023).some((n) => /Houy/.test(n)));
  assert.ok(names(2020).some((n) => /Jones-Smith/.test(n)));
  let total = 0;
  for (let y = 1966; y <= 2026; y++) total += pitt(y).length;
  assert.ok(total >= 260, `${total} Pitt players`);
  // One player, one entry: Jimbo Covert isn't also "Jim Covert from Pitt".
  assert.equal(draftSeedsFor(1983).filter((s) => s.l === "Covert").length, 1);
  assert.equal(draftSeedsFor(2015).filter((s) => /Diggs/.test(s.l) && s.c === "Maryland").length, 1);
  assert.ok(draftSeedsFor(2015).some((s) => s.f === "Stefon" && s.l === "Diggs"));
  // Brothers stay brothers.
  assert.equal(draftSeedsFor(2018).filter((s) => s.l === "Edmunds").length, 2);
});

test("rookies ask for their number and get it, or the closest legal one", () => {
  const ctx = { rng: 1, year: 1990 };
  assert.equal(preferredJersey(ctx, "QB", 13, new Set()), 13);
  // Taken: same last digit first.
  assert.equal(preferredJersey(ctx, "QB", 13, new Set([13])), 3);
  // A college 7 at linebacker before the 2021 rule change becomes a 57.
  assert.equal(preferredJersey(ctx, "MLB", 7, new Set()), 57);
  const s = simUntil(createNewGame({ userTeamId: "pit", startingYear: 2004, seed: 3 }), (x) => x.phase === "draft");
  for (let k = 0; k < 64; k++) makeDraftPick(s);
  const made = Object.values(s.players).filter((p) => p.draftYear === 2004 && p.draftPick);
  const fitz = made.find((p) => p.lastName === "Fitzgerald" && p.firstName === "Larry");
  assert.equal(fitz.jersey, 11, "Larry Fitzgerald wears 11");
  assert.ok(made.every((p) => p.collegeNo != null));
  assert.ok(made.every((p) => jerseyLegal(p.pos, 2004, p.jersey)), "first two rounds: all legal");
  assert.ok(made.filter((p) => p.jersey === p.collegeNo).length >= made.length * 0.5);
});

test("the Berlin, PA class: on the board, unscouted, undrafted, and better than anyone knows", () => {
  for (const [year, names] of [[2018, ["Tommy DeArmitt"]], [2019, ["Jordan Fochtman", "Austin Widner", "Tyler DeArmitt"]]]) {
    const s = simUntil(createNewGame({ userTeamId: "pit", startingYear: year, seed: 5 }), (x) => x.phase === "draft");
    const mine = Object.values(s.players).filter((p) => names.includes(`${p.firstName} ${p.lastName}`));
    assert.equal(mine.length, names.length);
    for (const p of mine) {
      assert.ok(p.hometown && /PA$/.test(p.hometown));
      assert.ok(p.scoutOvr < 62, `${p.lastName} scouted ${p.scoutOvr}`);
      const want = { Tommy: [73, 93], Jordan: [72, 94], Austin: [70, 90], Tyler: [76, 95] }[p.firstName];
      assert.deepEqual([p.ovr, p.potential], want, `${p.firstName} starts and tops out where he should`);
      assert.ok(p.gem);
      assert.ok(s.draftBoard.some((pr) => pr.playerId === p.id));
    }
    while (makeDraftPick(s));
    for (const p of mine) assert.equal(s.players[p.id].draftPick, undefined, `${p.lastName} goes undrafted`);
  }
});

test("a hidden gem grows fast once he's on a roster", () => {
  let s = simUntil(createNewGame({ userTeamId: "pit", startingYear: 2019, seed: 5 }), (x) => x.phase === "draft");
  const jordan = Object.values(s.players).find((p) => p.firstName === "Jordan" && p.lastName === "Fochtman");
  assert.equal(jordan.arch, "dual", "a dual threat: runs as well as he throws");
  s = simUntil(s, (x) => x.year === 2023 && x.phase === "regular");
  const now = s.players[jordan.id];
  if (now && now.teamId !== "fa") assert.ok(now.ovr >= 78, `Jordan ${now.ovr} by 2023`);
});
