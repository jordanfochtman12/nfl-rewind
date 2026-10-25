/** Fatigue must follow the personnel group actually on the field. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, teamUnits } from "../src/lib/game/index.ts";
import { unitFatigueMultiplier } from "../src/lib/game/sim.ts";

test("offensive and defensive stamina affect only their own late-game unit", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 1917 });
  const units = teamUnits(save, "pit");
  const offensive = [units.qb, units.rb, units.rb2, units.rb3, units.fb, ...units.wr, units.te, ...units.ol]
    .filter((p) => p !== undefined);
  const defensive = [...units.dl, ...units.lb, ...units.db];
  for (const p of [...offensive, ...defensive]) p.ratings.stamina = 80;

  const baselineOffense = unitFatigueMultiplier(units, "offense", true);
  const baselineDefense = unitFatigueMultiplier(units, "defense", true);
  assert.ok(baselineOffense < 1, "lower stamina should reduce late-game performance");
  assert.ok(baselineDefense < 1, "lower stamina should reduce late-game performance");

  for (const p of offensive) p.ratings.stamina = 40;
  assert.ok(unitFatigueMultiplier(units, "offense", true) < baselineOffense);
  assert.equal(unitFatigueMultiplier(units, "defense", true), baselineDefense,
    "offensive stamina cannot tire the defense");

  for (const p of offensive) p.ratings.stamina = 80;
  for (const p of defensive) p.ratings.stamina = 40;
  assert.equal(unitFatigueMultiplier(units, "offense", true), baselineOffense,
    "defensive stamina cannot tire the offense");
  assert.ok(unitFatigueMultiplier(units, "defense", true) < baselineDefense);
});

test("fatigue deepens late, and the altitude penalty applies to the affected visitor", () => {
  const save = createNewGame({ userTeamId: "den", startingYear: 2024, cpuOnly: true, seed: 733 });
  const units = teamUnits(save, "den");
  const players = [units.qb, units.rb, units.rb2, units.rb3, units.fb, ...units.wr, units.te, ...units.ol,
    ...units.dl, ...units.lb, ...units.db].filter((p) => p !== undefined);
  for (const p of players) p.ratings.stamina = 70;

  const early = unitFatigueMultiplier(units, "offense", false);
  const late = unitFatigueMultiplier(units, "offense", true);
  assert.ok(late < early, "fourth-quarter fatigue is stronger than early-game fatigue");
  assert.equal(unitFatigueMultiplier(units, "offense", true, true), late * 0.93);
});

test("a rotating RB2 contributes to offensive fatigue", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 241 });
  const units = teamUnits(save, "pit");
  assert.ok(units.rb2, "the roster has a second back to rotate in");
  for (const p of [units.qb, units.rb, units.rb2, units.rb3, units.fb, ...units.wr, units.te, ...units.ol]) {
    if (p) p.ratings.stamina = 80;
  }
  const rested = unitFatigueMultiplier(units, "offense", true);
  units.rb2.ratings.stamina = 40;
  assert.ok(unitFatigueMultiplier(units, "offense", true) < rested,
    "a lower-stamina RB2 lowers the offensive unit's late-game performance");
});

test("rotating backs count as one active fatigue role, not three simultaneous players", () => {
  const player = (stamina) => ({ ratings: { stamina } });
  const units = {
    qb: player(50),
    rb: player(100),
    rb2: player(100),
    rb3: player(100),
    wr: [],
    ol: [],
    dl: [],
    lb: [],
    db: [],
  };
  const expectedStamina = (50 + 100) / 2;
  const expectedLateMultiplier = 1 - ((100 - expectedStamina) / 420) * 1.5;
  assert.equal(unitFatigueMultiplier(units, "offense", true), expectedLateMultiplier,
    "a three-back depth chart contributes one active running-back slot to the unit average");
});
