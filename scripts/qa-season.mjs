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
for (let y = 1966; y <= 2025; y++) {
  assert((g.DRAFT_CLASSES[y] || []).length > 0, `named class for ${y}`);
}
assert(g.draftSeedsFor(1966).length >= 50, `1966 named board 50+ (got ${g.draftSeedsFor(1966).length})`);
assert(g.draftSeedsFor(1980).length >= 18, `1980 class 18+ (got ${g.draftSeedsFor(1980).length})`);
assert(g.draftSeedsFor(2025).length >= 18, `2025 class 18+ (got ${g.draftSeedsFor(2025).length})`);

const namath = Object.values(save.players).find((p) => p.lastName === "Namath" && p.firstName === "Joe");
assert(namath, "Joe Namath is on a 1966 roster");
assert(namath.abilities.includes("Broadway Joe"), `Namath has Broadway Joe (got ${namath.abilities.join(", ")})`);
assert(namath.traits.includes("Gunslinger"), `Namath is a Gunslinger (got ${namath.traits.join(", ")})`);
const starr = Object.values(save.players).find((p) => p.lastName === "Starr");
assert(starr?.abilities?.length && starr?.traits?.length, "Starr has abilities and traits");
const sayers = Object.values(save.players).find((p) => p.lastName === "Sayers");
assert(sayers?.abilities?.includes("Kansas Comet"), "Sayers is the Kansas Comet");

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
