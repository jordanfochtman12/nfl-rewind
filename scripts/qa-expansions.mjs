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

function namedSample(save, teamId, n = 4) {
  return g
    .rosterOf(save, teamId)
    .filter((p) => p.historical)
    .slice(0, n)
    .map((p) => g.playerName(p));
}

function checkClub(save, id, year) {
  const t = save.teams[id];
  assert(!!t && t.active, `${year}: ${id} exists and is active`);
  const roster = g.rosterOf(save, id);
  assert(roster.length >= 40, `${year}: ${id} roster ${roster.length} >= 40`);
  assert(roster.length <= 70, `${year}: ${id} roster ${roster.length} <= 70 (not a dump of retirees)`);
  assert(
    roster.every((p) => g.hasKit(p)),
    `${year}: ${id} every player has full attribute kit`,
  );
  assert(!!t.coachId && !!save.coaches[t.coachId], `${year}: ${id} coach set (${save.coaches[t.coachId]?.name})`);
  const onSched = save.schedule.some((gm) => gm.homeId === id || gm.awayId === id);
  assert(onSched, `${year}: schedule includes ${id}`);
  console.log(`   ${id} n=${roster.length} coach=${save.coaches[t.coachId]?.name} names=${namedSample(save, id).join(", ") || "(generated depth)"}`);
}

console.log("CPU-only dynasty fast-forward…");
let s = g.createNewGame({ userTeamId: "gnb", startingYear: 1966, cpuOnly: true, seed: 1966 });

s = g.fastForwardToYear(s, 1967);
assert(s.year === 1967, `year is 1967 (got ${s.year} ${s.phase})`);
checkClub(s, "nor", 1967);

s = g.fastForwardToYear(s, 1968);
checkClub(s, "cin", 1968);

s = g.fastForwardToYear(s, 1970);
assert(g.conferenceOf(1970, "gnb") === "NFC", "1970 Packers are NFC");
assert(g.conferenceOf(1970, "kan") === "AFC", "1970 Chiefs are AFC");
assert(g.confLabel(1970, "AFC") === "AFC", "labels are AFC/NFC");
console.log("ok: 1970 merger labels AFC/NFC");

s = g.fastForwardToYear(s, 1976);
checkClub(s, "tam", 1976);
checkClub(s, "sea", 1976);

s = g.fastForwardToYear(s, 1995);
checkClub(s, "car", 1995);
checkClub(s, "jax", 1995);

s = g.fastForwardToYear(s, 1996);
assert(s.teams.rav?.active, "1996 rav exists");
assert(!g.isActive("cle", 1996), "cle inactive in 1996");
assert(!g.activeTeamIds(1996).includes("cle"), "cle omitted from 1996 active list");
checkClub(s, "rav", 1996);

s = g.fastForwardToYear(s, 1999);
assert(s.teams.cle?.active, "1999 cle exists again");
checkClub(s, "cle", 1999);
const cleIds = new Set(s.teams.cle.roster);
const ravIds = new Set(s.teams.rav.roster);
const overlap = [...cleIds].filter((id) => ravIds.has(id));
assert(overlap.length < cleIds.size, "1999 Browns are not a clone of Ravens ids");
assert(cleIds.size > 0 && [...cleIds].some((id) => !ravIds.has(id)), "Browns have ids that are not the Ravens roster");

s = g.fastForwardToYear(s, 2002);
checkClub(s, "htx", 2002);
assert(g.activeTeamIds(2002).length === 32, `32 teams in 2002 (got ${g.activeTeamIds(2002).length})`);
assert(g.conferenceOf(2002, "sea") === "NFC", "Seattle is NFC in 2002");
assert(g.divisionOf(2002, "sea") === "West", "Seattle in NFC West");
console.log("qa-expansions passed");
