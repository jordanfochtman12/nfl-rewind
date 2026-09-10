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
