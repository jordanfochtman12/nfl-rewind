#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (!process.execArgv.some((a) => a.includes("strip-types"))) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

const g = await import("../src/lib/game/index.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

const save = g.createNewGame({ userTeamId: "gnb", startingYear: 1966 });
const active = g.activeTeamIds(save.year);
assert(active.length === 24, `24 teams in 1966 (got ${active.length})`);
assert(!active.includes("rav"), "Ravens are not a 1966 club");
assert(!active.includes("nor"), "Saints are not yet born");

const gamesNeeded = g.gamesInSeason(1966);
assert(gamesNeeded === 14, "14-game season in 1966");
for (const id of active) {
  const n = g.gamesForTeam(save, id).length;
  assert(n === 14, `${id} has 14 scheduled games (got ${n})`);
}

const names = save.draftBoard.map((p) => {
  const pl = save.players[p.playerId];
  return pl ? `${pl.firstName} ${pl.lastName}` : "";
});
assert(
  names.some((n) => /nobis/i.test(n)),
  `1966 draft board has Tommy Nobis (sample: ${names.slice(0, 5).join(", ")})`,
);
assert(
  names.some((n) => /mack|grabowski|anderson/i.test(n)),
  "Nobis-class names on the board",
);
const nobisPl = Object.values(save.players).find((p) => p.lastName === "Nobis");
assert(nobisPl, "Tommy Nobis player exists");
assert(nobisPl.arch === "thumper", `Nobis is a thumper (got ${nobisPl.arch})`);
assert(nobisPl.ratings.tak >= 88, `Nobis tackle is locked high (got ${nobisPl.ratings.tak})`);
assert(nobisPl.ratings.throwAcc < 50, `Nobis does not hug overall on unused skills (throwAcc ${nobisPl.ratings.throwAcc})`);

assert(names.filter(Boolean).length >= 24, `1966 board has 24+ named (got ${names.filter(Boolean).length})`);
assert(
  Object.values(save.players).filter((p) => p.historical).length >= 280,
  `280+ historical named players at 1966 start (got ${Object.values(save.players).filter((p) => p.historical).length})`,
);
for (const y of [1967, 1969, 1971, 1975, 1983, 1985, 1989, 1998, 2000, 2017, 2024]) {
  const cls = g.draftSeedsFor(y);
  assert(cls.length >= 8, `${y} class has 8+ named (got ${cls.length})`);
}
assert(g.draftSeedsFor(1967).some((s) => s.l === "Page"), "1967 has Alan Page");
assert(g.draftSeedsFor(1975).some((s) => s.l === "Payton"), "1975 has Walter Payton");
assert(g.draftSeedsFor(1983).some((s) => s.l === "Marino"), "1983 has Dan Marino");
assert(g.draftSeedsFor(2000).some((s) => s.l === "Brady"), "2000 has Tom Brady");
assert(g.draftSeedsFor(2017).some((s) => s.l === "Mahomes"), "2017 has Patrick Mahomes");
const bradySeed = g.draftSeedsFor(2000).find((s) => s.f === "Tom" && s.l === "Brady");
assert(bradySeed, "Tom Brady seed");
assert(bradySeed.o >= 90, `Brady overall from career (got ${bradySeed.o})`);
assert(bradySeed.arch === "deadeye", `Brady is a deadeye (got ${bradySeed.arch})`);
assert((bradySeed.rt?.throwAcc ?? 0) >= 88, `Brady throwAcc locked from career (got ${bradySeed.rt?.throwAcc})`);
const leftSeed = g.draftSeedsFor(1966).find((s) => /leftridge/i.test(s.l));
assert(leftSeed, "Dick Leftridge seed");
assert(leftSeed.o <= 68, `Leftridge bust overall (got ${leftSeed.o})`);
const mackSeed = g.draftSeedsFor(1966).find((s) => s.f === "Tom" && s.l === "Mack");
assert(mackSeed && mackSeed.o >= 80, `Tom Mack Hall-level ovr (got ${mackSeed?.o})`);
for (let y = 1966; y <= 2025; y++) {
  assert((g.DRAFT_CLASSES[y] || []).length > 0, `named class for ${y}`);
}
assert(g.draftSeedsFor(1966).length >= 200, `1966 named board 200+ (got ${g.draftSeedsFor(1966).length})`);
assert(g.draftSeedsFor(1980).length >= 200, `1980 class 200+ (got ${g.draftSeedsFor(1980).length})`);
assert(g.draftSeedsFor(2025).length >= 150, `2025 class 150+ (got ${g.draftSeedsFor(2025).length})`);
const jeanty = g.draftSeedsFor(2025).find((s) => /jeanty/i.test(s.l));
if (jeanty) assert(jeanty.o >= 80, `Jeanty keeps prospect floor (got ${jeanty.o})`);
assert(
  g.draftSeedsFor(1966).filter((s) => s.arch).length >= 180,
  `1966 named prospects carry archetypes (got ${g.draftSeedsFor(1966).filter((s) => s.arch).length})`,
);

const namath = Object.values(save.players).find((p) => p.lastName === "Namath" && p.firstName === "Joe");
assert(namath, "Joe Namath is on a 1966 roster");
assert(namath.abilities.includes("Broadway Joe"), `Namath has Broadway Joe (got ${namath.abilities.join(", ")})`);
assert(namath.traits.includes("Gunslinger"), `Namath is a Gunslinger (got ${namath.traits.join(", ")})`);
const starr = Object.values(save.players).find((p) => p.lastName === "Starr");
assert(starr?.abilities?.length && starr?.traits?.length, "Starr has abilities and traits");
const sayers = Object.values(save.players).find((p) => p.lastName === "Sayers");
assert(sayers?.abilities?.includes("Kansas Comet"), "Sayers is the Kansas Comet");

assert(starr?.college === "Alabama", `Starr college Alabama (got ${starr?.college})`);
const unitas = Object.values(save.players).find((p) => p.lastName === "Unitas" && p.firstName === "Johnny");
assert(unitas?.college === "Louisville", `Unitas college Louisville (got ${unitas?.college})`);
assert(sayers?.college === "Kansas", `Sayers college Kansas (got ${sayers?.college})`);
assert(namath?.college === "Alabama", `Namath college Alabama (got ${namath?.college})`);
assert(nobisPl.college === "Texas", `Nobis college Texas (got ${nobisPl.college})`);
const starrCareer = g.careerTotals(starr);
assert(starr.career.length >= 8, `Starr prior career seasons (got ${starr.career.length})`);
assert(starrCareer.passYds > 10000, `Starr career pass yds through 1965 (got ${starrCareer.passYds})`);
const starrYds = starr.career.map((s) => s.passYds);
assert(new Set(starrYds).size >= 2, `Starr yearly pass yards are not a flat split (${starrYds.slice(0, 4).join(",")})`);
const starr65 = starr.career.find((s) => s.year === 1965);
assert(starr65, "Starr has a 1965 line");
assert(starr65.passYds >= 1800, `Starr 1965 pass yds (got ${starr65.passYds})`);
const unitasCareer = g.careerTotals(unitas);
assert(unitasCareer.passYds > 20000, `Unitas career pass yds through 1965 (got ${unitasCareer.passYds})`);
const sayersCareer = g.careerTotals(sayers);
assert(sayersCareer.rushYds >= 800, `Sayers 1965 rush yds on the card (got ${sayersCareer.rushYds})`);
const namathCareer = g.careerTotals(namath);
assert(namathCareer.passYds >= 2500, `Namath 1965 pass yds on the card (got ${namathCareer.passYds})`);
assert(!starr.stats[1966] || !g.hasSeasonWork(starr.stats[1966]), "1966 season row is empty at kickoff");
const rosteredHist = Object.values(save.players).filter(
  (p) => p.historical && p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof",
);
const withCollege = rosteredHist.filter((p) => p.college);
assert(
  withCollege.length / rosteredHist.length >= 0.7,
  `70%+ named vets have college (got ${withCollege.length}/${rosteredHist.length})`,
);
const cookie = Object.values(save.players).find((p) => /gilchrist/i.test(p.lastName));
if (cookie) assert(cookie.college === "No college", `Cookie Gilchrist no college (got ${cookie.college})`);

const rostered = Object.values(save.players).filter((p) => p.teamId !== "retired" && p.teamId !== "hof");
const missingKit = rostered.filter((p) => !(p.abilities && p.abilities.length) || !(p.traits && p.traits.length));
assert(missingKit.length === 0, `every player has abilities and traits (missing ${missingKit.length})`);
assert(g.kitBoost(namath, "offPass") > 0, "Broadway Joe / Cannon boost the passing unit");
const iron = rostered.find((p) => (p.abilities ?? []).includes("Iron") || (p.traits ?? []).includes("Iron man"));
assert(iron && g.kitInjMult(iron) < 1, `${iron ? iron.lastName : "Iron"} stays healthier (${iron ? g.kitInjMult(iron) : "none"})`);
const glass = rostered.find((p) => (p.traits ?? []).includes("Glass"));
assert(!glass || g.kitInjMult(glass) > 1, "Glass misses more time");

const after = g.simToSuperBowl(save);
assert(after.superBowl?.played, "Super Bowl I played");
const champs = g.leagueChampions(after);
assert(!!champs.nfl && !!champs.afl, `two league champs then a Super Bowl (nfl=${champs.nfl} afl=${champs.afl})`);
assert(after.superBowl.homeId && after.superBowl.awayId, "SB has two clubs");
assert(after.year === 1966, "still 1966 season when SB is played");
console.log(
  `Super Bowl I: ${after.superBowl.homeId} ${after.superBowl.homeScore} - ${after.superBowl.awayId} ${after.superBowl.awayScore} at ${g.superBowlSite(1966).site}`,
);
console.log("qa-season passed");
