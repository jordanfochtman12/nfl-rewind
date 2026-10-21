import test from "node:test";
import assert from "node:assert/strict";
import { blankState, hydrateSave } from "./save.ts";
import { cpuHandles } from "./teamControl.ts";

test("existing franchise mode still assigns only the selected club to the user", () => {
  const save = blankState("pit");
  assert.equal(cpuHandles(save, "pit", "roster"), false);
  assert.equal(cpuHandles(save, "gnb", "roster"), true);
});

test("League Architect defaults the active club to the user and other clubs to CPU", () => {
  const save = blankState("pit");
  save.leagueSandbox = true;
  save.leagueControl = {};
  assert.equal(cpuHandles(save, "pit", "contracts"), false);
  assert.equal(cpuHandles(save, "gnb", "contracts"), true);
});

test("per-club job assignments remain independent when the active club changes", () => {
  const save = blankState("pit");
  save.leagueSandbox = true;
  save.leagueControl = {
    pit: { roster: true, contracts: false },
    gnb: { roster: false },
  };
  assert.equal(cpuHandles(save, "pit", "roster"), true);
  assert.equal(cpuHandles(save, "pit", "contracts"), false);
  assert.equal(cpuHandles(save, "pit", "draft"), false);
  save.userTeamId = "gnb";
  assert.equal(cpuHandles(save, "gnb", "roster"), false);
  assert.equal(cpuHandles(save, "gnb", "contracts"), false);
  assert.equal(cpuHandles(save, "pit", "roster"), true);
});

test("League Architect assignments survive save hydration", () => {
  const save = blankState("pit");
  save.leagueSandbox = true;
  save.leagueControl = { pit: { roster: true, draft: false }, gnb: { contracts: false } };
  const loaded = hydrateSave(JSON.parse(JSON.stringify(save)));
  assert.equal(loaded.leagueSandbox, true);
  assert.deepEqual(loaded.leagueControl, save.leagueControl);
});
