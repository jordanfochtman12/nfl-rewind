import { test } from "node:test";
import assert from "node:assert/strict";
import { MORE_COACHES } from "../src/lib/game/data/coachesMore.ts";
import { COACHES_1966, COORDINATORS_1966, EXPANSION_COACHES, LATER_COACHES } from "../src/lib/game/data/coaches.ts";
import { PLAYBOOKS } from "../src/lib/game/data/coachPlans.ts";
import { createNewGame, defaultPlan, planFor, playbookOf, staffSystems } from "../src/lib/game/index.ts";
import { makeCoachFromSeed, seedStaff } from "../src/lib/game/staff.ts";
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
  "alex-webster",
  "charlie-waller",
  "bob-hollway",
  "harland-svare",
  "dan-devine",
  "j-d-roberts",
  "john-north",
  "dick-macpherson",
  "monte-clark",
  "neill-armstrong",
  "ron-erhardt",
  "john-mcvay",
  "hank-bullough",
  "kay-stephenson",
  "rich-brooks",
  "frank-kush",
  "gene-stallings",
  "rich-williamson",
  "mike-white",
  "ray-handley",
  "john-mackovic",
  "marty-mornhinweg",
  "dave-mcginnis",
  "joe-vitt",
  "mike-tice",
  "mike-mccoy",
  "mike-pettine",
  "frank-gansz",
  "brian-schottenheimer-hc",
  "bud-wilkinson",
  "dan-henning",
  "howard-schnellenberger",
  "harvey-johnson",
  "jerry-williams",
  "eddie-khayat",
  "jerry-smith-hc",
  "bill-peterson",
  "ernie-zampese",
  "kevin-gilbride-oc",
  "al-groh",
  "ed-biles",
  "emmitt-thomas",
  "greg-schiano",
  "gunther-cunningham",
  "hugh-campbell",
  "ken-meyer",
  "larry-wilson",
  "les-steckel",
  "lou-holtz",
  "rich-bisaccia",
  "rick-forzano",
  "rob-chudzinski",
  "rod-rust",
  "vince-tobin",
  "giff-smith",
  "chris-tabor",
  "jim-ringo",
  "jim-shofner",
  "joe-thomas-hc",
  "john-sandusky-hc",
  "johnny-mazur-hc",
  "ken-shipp-hc",
  "perry-fewell",
  "pete-mcculley",
  "ron-waller",
  "tommy-hudspeth",
  "jeff-saturday-hc",
  "eric-studesville",
  "tom-moore-oc",
  "al-saunders-oc",
  "charlie-weis-oc",
  "mike-heimerdinger-oc",
  "paul-hackett-oc",
  "darrell-bevell-oc",
  "pep-hamilton-oc",
  "greg-roman-oc",
  "dean-pees-dc",
  "george-edwards-dc",
  "joe-barry-dc",
  "paul-guenther-dc",
  "todd-grantham-dc",
  "mike-caldwell-dc",
  "steve-fairchild-oc",
  "alex-van-pelt-oc",
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
    if (![
      "joe-schmidt-det", "abe-gibron", "john-ralston", "nick-saban", "joe-bugel",
      "chan-gailey", "mike-munchak-hc", "dan-quinn", "vic-fangio", "matt-eberflus",
    ].includes(id)) {
      assert.ok(playbook.philosophy?.length > 30, `${id} should have a readable coaching philosophy`);
    }
    const atEntry = makeCoachFromSeed(coach, coach.yearAvail);
    assert.equal(atEntry.careerWins, 0, `${id} must not start with wins from seasons after his arrival`);
    assert.equal(atEntry.careerLosses, 0, `${id} must not start with losses from seasons after his arrival`);
    assert.equal(atEntry.careerTies, 0, `${id} must not start with ties from seasons after his arrival`);
  }
});

test("added coordinator profiles have coordinator roles and credible job-entry ages", () => {
  const coordinatorIds = [
    "buddy-ryan", "wade-phillips", "norv-turner", "gregg-williams", "ernie-zampese", "kevin-gilbride-oc",
    "tom-moore-oc", "al-saunders-oc", "charlie-weis-oc", "mike-heimerdinger-oc", "paul-hackett-oc",
    "darrell-bevell-oc", "pep-hamilton-oc", "greg-roman-oc", "dean-pees-dc", "george-edwards-dc",
    "joe-barry-dc", "paul-guenther-dc", "todd-grantham-dc", "mike-caldwell-dc", "steve-fairchild-oc", "alex-van-pelt-oc",
    "wannstedt", "billick", "haslett", "mlewis", "lovie", "kubiak", "rex-ryan", "jschwartz", "mcdaniels",
    "zimmer", "bowles", "kshanahan", "mcdermott", "saleh", "daboll", "dryans", "ben-johnson",
    "joe-bugel", "chan-gailey", "dan-quinn", "vic-fangio",
  ];
  for (const id of coordinatorIds) {
    const seed = MORE_COACHES.find((coach) => coach.id === id);
    assert.ok(seed, `${id} has a coordinator profile`);
    assert.ok(seed.role === "OC" || seed.role === "DC", `${id} is tagged to the correct staff side`);
    const coach = makeCoachFromSeed(seed, seed.yearAvail);
    assert.ok(coach.age >= 24 && coach.age <= 65, `${id} has a realistic age at first availability`);
    assert.ok(playbookOf(coach, seed.yearAvail)?.philosophy, `${id} philosophy is available to the staff screen`);
  }
});

test("every catalogued coach with a playbook has a readable philosophy", () => {
  const catalog = [...COACHES_1966, ...COORDINATORS_1966, ...EXPANSION_COACHES, ...LATER_COACHES, ...MORE_COACHES];
  for (const coach of catalog) {
    const book = playbookOf(makeCoachFromSeed(coach, coach.yearAvail), coach.yearAvail);
    assert.ok(book, `${coach.id} should have a playbook`);
    assert.ok(book.philosophy?.length > 30, `${coach.id} should expose its call-sheet philosophy`);
  }
});

test("1966 opening staffs place the real coaches with the correct clubs and eras", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed: 1966 });
  const staffer = (teamId, role) => {
    const team = save.teams[teamId];
    const id = role === "OC" ? team.ocId : team.dcId;
    return id ? save.coaches[id] : undefined;
  };

  assert.equal(staffer("dal", "DC")?.name, "Dick Nolan", "Nolan led the Dallas defense, not Ermal Allen");
  assert.equal(staffer("dal", "OC")?.name, "Ermal Allen", "Ermal Allen remains a single Dallas offensive assistant");
  assert.equal(staffer("chi", "DC")?.name, "Jim Dooley", "Dooley took over Chicago's defense in 1966");
  assert.equal(staffer("clt", "DC")?.name, "Chuck Noll", "Noll moved to Baltimore for the 1966 season");
  assert.equal(staffer("sdg", "DC")?.name, "Tom Bass", "Bass replaced Noll in San Diego in 1966");
  assert.equal(staffer("pit", "DC")?.name, "LaVern Torgeson", "Torgeson was responsible for Pittsburgh's full defense");
  assert.equal(staffer("rai", "OC")?.name, "Bill Walsh", "Walsh joined Oakland in 1966, not Kansas City");
  assert.notEqual(staffer("kan", "OC")?.name, "Bill Walsh");
});

test("staff seeding does not install an assistant before his first available season", () => {
  const save = createNewGame({ userTeamId: "gnb", startingYear: 1966, cpuOnly: true, seed: 1966 });
  const futureStaff = {
    id: "future-assistant-regression", name: "Future Assistant", teamId: "gnb", yearAvail: 1967,
    offense: 60, defense: 80, born: 1940, role: "DC",
  };
  COORDINATORS_1966.push(futureStaff);
  try {
    seedStaff(save);
    assert.notEqual(save.coaches["future-assistant-regression"]?.teamId, "gnb");
    assert.notEqual(save.teams.gnb.dcId, "future-assistant-regression");
  } finally {
    COORDINATORS_1966.pop();
  }
});

test("real coordinator playbooks set the offense, defense, and weekly call sheet", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 720 });
  const team = save.teams.pit;
  const ocSeed = MORE_COACHES.find((coach) => coach.id === "norv-turner");
  const dcSeed = MORE_COACHES.find((coach) => coach.id === "buddy-ryan");
  const oc = makeCoachFromSeed(ocSeed, save.year, { teamId: "pit" });
  const dc = makeCoachFromSeed(dcSeed, save.year, { teamId: "pit" });
  save.coaches[oc.id] = oc;
  save.coaches[dc.id] = dc;
  team.coachId = null;
  team.ocId = oc.id;
  team.dcId = dc.id;

  const systems = staffSystems(save, "pit");
  const calls = planFor(save, "pit");
  assert.equal(systems.offBy, "Norv Turner");
  assert.equal(systems.defBy, "Buddy Ryan");
  assert.equal(systems.offense, "Air Coryell");
  assert.equal(systems.defense, "46 pressure");
  assert.equal(calls.attack, "pass");
  assert.equal(calls.blitz, "heavy");
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
