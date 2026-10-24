import { test } from "node:test";
import assert from "node:assert/strict";
import { MORE_COACHES } from "../src/lib/game/data/coachesMore.ts";
import { PLAYBOOKS } from "../src/lib/game/data/coachPlans.ts";
import { createNewGame, defaultPlan, planFor, playbookOf, staffSystems } from "../src/lib/game/index.ts";
import { makeCoachFromSeed } from "../src/lib/game/staff.ts";
import { syncRealSchemes } from "../src/lib/game/gameplans.ts";

const addedCoachIds = [
  "joe-schmidt-det",
  "abe-gibron",
  "john-ralston",
  "nick-saban",
  "joe-bugel",
  "chan-gailey",
  "mike-munchak-hc",
  "dan-quinn",
  "vic-fangio",
  "matt-eberflus",
];

test("added historical head coaches have unique dated profiles and simulation playbooks", () => {
  const allIds = new Set();
  for (const coach of MORE_COACHES) {
    assert.equal(allIds.has(coach.id), false, `duplicate coach id: ${coach.id}`);
    allIds.add(coach.id);
  }

  for (const id of addedCoachIds) {
    const matches = MORE_COACHES.filter((coach) => coach.id === id);
    assert.equal(matches.length, 1, `${id} should have exactly one coach profile`);

    const [coach] = matches;
    const playbook = PLAYBOOKS[id];
    assert.ok(coach.name && coach.yearAvail >= 1966, `${id} needs a real name and availability year`);
    assert.ok(coach.offense >= 0 && coach.defense >= 0, `${id} needs distinct unit ratings`);
    assert.ok(playbook, `${id} needs a scheme and philosophy`);
    assert.ok(playbook.off && playbook.def && playbook.plan, `${id} playbook must affect simulation planning`);
    const atEntry = makeCoachFromSeed(coach, coach.yearAvail);
    assert.equal(atEntry.careerWins, 0, `${id} must not start with wins from seasons after his arrival`);
    assert.equal(atEntry.careerLosses, 0, `${id} must not start with losses from seasons after his arrival`);
    assert.equal(atEntry.careerTies, 0, `${id} must not start with ties from seasons after his arrival`);
  }
});

test("added coaches' philosophies reach the team's scheme and live call sheet", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 719 });
  const team = save.teams.pit;

  for (const id of addedCoachIds) {
    const seed = MORE_COACHES.find((coach) => coach.id === id);
    const coach = makeCoachFromSeed(seed, save.year, { teamId: "pit" });
    save.coaches[id] = coach;
    team.coachId = id;
    team.ocId = null;
    team.dcId = null;

    syncRealSchemes(save);

    const book = playbookOf(coach, save.year);
    const plan = planFor(save, "pit");
    const systems = staffSystems(save, "pit");
    const base = defaultPlan(book.off);
    assert.equal(team.offScheme, book.off, `${id} installs its offense`);
    assert.equal(team.defScheme, book.def, `${id} installs its defense`);
    assert.equal(systems.offense, book.offense, `${id} is identified with his offensive system`);
    assert.equal(systems.defense, book.defense, `${id} is identified with his defensive system`);
    assert.equal(plan.attack, book.plan.attack ?? base.attack, `${id} controls the live offensive tendency`);
    assert.equal(plan.blitz, book.plan.blitz ?? base.blitz, `${id} controls the live defensive tendency`);
  }
});
