/** Depth-chart backs receive a realistic workload split as the game wears on. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eraRb1Share } from "../src/lib/game/era.ts";
import {
  createNewGame,
  simGame,
  teamUnits,
  thirdBackRotationShare,
  fourthBackRotationShare,
  backfieldRotationShares,
  fourthReceiverRotationShare,
  backupBackTargetShare,
  staminaWorkloadFactor,
  careerRushWorkloadFactor,
  runningBackYardsAdjustment,
  defensiveLineReliefPosition,
  defensiveLineReliefStarterIndex,
  nextDefensiveRotationSnap,
  canChangeDefensePersonnel,
  adaptiveDefensiveFocus,
  usesNickelPersonnel,
  usesDimePersonnel,
  defensivePersonnelForSituation,
  hasNickelPersonnel,
} from "../src/lib/game/index.ts";

test("base and nickel fronts use 11 defenders across 4-3 and 3-4 schemes", () => {
  assert.equal(usesNickelPersonnel(2024, 3, 5, "balanced", true), true);
  assert.equal(usesNickelPersonnel(2024, 2, 7, "balanced", true), true);
  assert.equal(usesNickelPersonnel(2024, 1, 10, "pass", true), true);
  assert.equal(usesNickelPersonnel(2024, 1, 10, "balanced", true), false, "avoid nickel on a balanced early down by default");
  assert.equal(usesNickelPersonnel(2024, 2, 3, "pass", true), false, "stay in base personnel on a short yardage down");
  assert.equal(usesNickelPersonnel(2024, 3, 5, "balanced", false), false, "no third healthy corner means stay in base personnel");
  assert.equal(usesNickelPersonnel(1985, 3, 5, "balanced", true), false, "keep modern nickel substitutions out of older eras");

  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const base = teamUnits(save, "pit");
  const nickel = teamUnits(save, "pit", undefined, true);
  assert.equal(hasNickelPersonnel(base), false, "the two-corner base package does not receive nickel tackle calibration");
  assert.equal(hasNickelPersonnel(nickel), true, "the three-corner nickel package enables nickel tackle calibration");
  assert.equal(base.db.length, 4);
  assert.equal(base.dl.length + base.lb.length + base.db.length, 11);
  assert.equal(base.lb.length, 3);
  assert.equal(nickel.db.length, 5, "nickel adds a third corner while retaining both safeties");
  assert.equal(nickel.db[2]?.id, save.teams.pit.depth.CB[2], "the saved third corner takes the nickel snap");
  assert.equal(nickel.dl.length + nickel.lb.length + nickel.db.length, 11);
  assert.equal(nickel.lb.length, 2, "one linebacker leaves for the extra defensive back");
  assert.ok(nickel.lb.every((player) => base.lb.some((starter) => starter.id === player.id)), "the package keeps two actual base linebackers");

  save.teams.pit.defScheme = "3-4";
  const base34 = teamUnits(save, "pit");
  const nickel34 = teamUnits(save, "pit", undefined, true);
  assert.equal(base34.dl.length, 3);
  assert.equal(base34.lb.length, 4);
  assert.equal(base34.db.length, 4);
  assert.equal(base34.dl.length + base34.lb.length + base34.db.length, 11);
  assert.equal(nickel34.dl.length, 3);
  assert.equal(nickel34.lb.length, 3);
  assert.equal(nickel34.db.length, 5);
  assert.equal(nickel34.dl.length + nickel34.lb.length + nickel34.db.length, 11);
  assert.equal(hasNickelPersonnel(nickel34), true, "nickel tackle calibration follows the same package in a 3-4 front");
});

test("dime only enters modern long-yardage situations and keeps 11 defenders", () => {
  assert.equal(usesDimePersonnel(2024, 3, 10, true), true);
  assert.equal(usesDimePersonnel(2024, 4, 12, true), true);
  assert.equal(usesDimePersonnel(2024, 2, 14, true), true);
  assert.equal(usesDimePersonnel(2024, 3, 9, true), false, "stay in nickel below obvious passing distance");
  assert.equal(usesDimePersonnel(2024, 2, 13, true), false, "avoid dime before a true second-and-long");
  assert.equal(usesDimePersonnel(2024, 3, 12, false), false, "do not request dime without a healthy fourth corner");
  assert.equal(usesDimePersonnel(1999, 3, 12, true), false, "keep the dime package out of pre-2000 simulation");
  assert.equal(defensivePersonnelForSituation(2024, 3, 10, "balanced", true, true), "dime");
  assert.equal(defensivePersonnelForSituation(2024, 3, 9, "balanced", true, true), "nickel");
  assert.equal(defensivePersonnelForSituation(2024, 3, 10, "balanced", true, false), "nickel");

  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const dime = teamUnits(save, "pit", undefined, "dime");
  assert.equal(dime.db.filter((player) => player.pos === "CB").length, 4);
  assert.equal(dime.db.length, 6, "dime has six defensive backs");
  assert.equal(dime.dl.length + dime.lb.length + dime.db.length, 11);
  assert.equal(dime.lb.length, 1, "4-3 dime replaces two linebackers with the fifth and sixth defensive backs");

  save.teams.pit.defScheme = "3-4";
  const dime34 = teamUnits(save, "pit", undefined, "dime");
  assert.equal(dime34.dl.length, 3);
  assert.equal(dime34.lb.length, 2);
  assert.equal(dime34.db.length, 6);
  assert.equal(dime34.dl.length + dime34.lb.length + dime34.db.length, 11);
});

test("hurry-up snaps trap defensive personnel and pause rotation cadence", () => {
  assert.equal(nextDefensiveRotationSnap(3, true), 4, "a substitution window advances the relief cadence");
  assert.equal(nextDefensiveRotationSnap(3, false), 3, "hurry-up snaps do not consume a relief opportunity");
  assert.equal(nextDefensiveRotationSnap(4, false), 4, "a hurry-up extends an active relief window");
  assert.equal(canChangeDefensePersonnel(false, true, false), false, "base defense cannot change to nickel during hurry-up");
  assert.equal(canChangeDefensePersonnel(true, false, false), false, "nickel defense cannot leave the field during hurry-up");
  assert.equal(canChangeDefensePersonnel(false, true, true), true, "an open substitution window allows nickel to enter");
  assert.equal(canChangeDefensePersonnel(true, false, true), true, "an open substitution window allows nickel to leave");
  assert.equal(canChangeDefensePersonnel(true, true, true), false, "unchanged personnel does not trigger a rebuild");
  assert.equal(canChangeDefensePersonnel("nickel", "dime", false), false, "hurry-up holds nickel on the field");
  assert.equal(canChangeDefensePersonnel("nickel", "dime", true), true, "the sixth DB enters at a legal substitution window");
  assert.equal(canChangeDefensePersonnel("dime", "base", true), true, "dime leaves when the situation no longer calls for it");
});
test("defensive-line relief gives two snaps to alternating edge and interior units", () => {
  assert.equal(defensiveLineReliefPosition(0), undefined);
  assert.equal(defensiveLineReliefPosition(1), undefined);
  assert.equal(defensiveLineReliefPosition(3), undefined);
  assert.equal(defensiveLineReliefPosition(4), "DE");
  assert.equal(defensiveLineReliefPosition(4, false), undefined, "hurry-up keeps the defense from rotating at a scheduled relief snap");
  assert.equal(defensiveLineReliefPosition(5), "DE", "the same edge starter gets a second relief snap");
  assert.equal(defensiveLineReliefPosition(6), undefined, "the edge starter returns after two relief snaps");
  assert.equal(defensiveLineReliefPosition(8), "DT");
  assert.equal(defensiveLineReliefPosition(9), "DT", "the same interior starter gets a second relief snap");
  assert.equal(defensiveLineReliefPosition(10), undefined, "the interior starter returns after two relief snaps");
  assert.equal(defensiveLineReliefPosition(12), "DE");
  assert.equal(defensiveLineReliefStarterIndex(4, "DE", 2), 0);
  assert.equal(defensiveLineReliefStarterIndex(5, "DE", 2), 0, "both relief snaps keep the same starter out");
  assert.equal(defensiveLineReliefStarterIndex(12, "DE", 2), 1, "the next edge relief goes to the second starter");
  assert.equal(defensiveLineReliefStarterIndex(20, "DE", 2), 0, "the edge rotation returns to the first starter");
  assert.equal(defensiveLineReliefStarterIndex(8, "DT", 2), 0);
  assert.equal(defensiveLineReliefStarterIndex(9, "DT", 2), 0, "both relief snaps keep the same starter out");
  assert.equal(defensiveLineReliefStarterIndex(16, "DT", 2), 1, "the next interior relief goes to the second starter");
  assert.equal(defensiveLineReliefStarterIndex(16, "DT", 1), 0, "a one-starter front rotates its only starter");
  assert.equal(defensiveLineReliefStarterIndex(12, "DT", 2), -1, "only the designated position receives relief on a given snap");
});

test("a relief snap uses the next healthy depth-chart lineman", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const team = save.teams.pit;
  const starters = teamUnits(save, "pit").dl;
  for (const [pos, snap] of [["DE", 4], ["DE", 5], ["DE", 12], ["DE", 13], ["DT", 8], ["DT", 9], ["DT", 16], ["DT", 17]]) {
    const group = starters.filter((player) => player.pos === pos);
    assert.equal(group.length, 2, `${pos} has its two configured starters`);
    const index = defensiveLineReliefStarterIndex(snap, pos, group.length);
    const rested = group[index];
    const depth = team.depth[pos];
    const next = depth.map((id) => save.players[id]).find((player) =>
      player && player.pos === pos && !group.some((starter) => starter.id === player.id) && player.injuredWeeks <= 0 && !player.onIR,
    );
    assert.ok(next, `${pos} has a healthy relief option`);
    const reliefUnits = teamUnits(save, "pit", new Set([rested.id]));
    assert.ok(!reliefUnits.dl.some((player) => player.id === rested.id), `${rested.id} remains out on relief snap ${snap}`);
    assert.ok(reliefUnits.dl.some((player) => player.id === next.id), `${next.id} replaces him from the saved depth chart`);
  }
});

test("a healthy third back joins the rotation only after the top two carry a heavy load", () => {
  let save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const team = save.teams.pit;
  assert.ok(team.depth.RB.length >= 3, "the test roster needs three healthy backs");
  const expectedThird = team.depth.RB[2];
  assert.equal(teamUnits(save, "pit").rb3?.id, expectedThird, "RB3 follows the saved depth chart");

  assert.equal(thirdBackRotationShare(0, true), 0);
  assert.equal(thirdBackRotationShare(10, true), 0, "the top two keep the opening workload");
  assert.ok(Math.abs(thirdBackRotationShare(16, true) - 0.144) < 1e-9, "modern RB3 gets a modest relief share before late-game overuse");
  assert.equal(thirdBackRotationShare(26, true), 0.34, "modern RB3 earns more of the workload as the top two backs tire");
  assert.equal(thirdBackRotationShare(100, true), 0.34, "modern third-back share remains capped");
  assert.equal(thirdBackRotationShare(16, true, 2019), 0, "pre-2020 rotation waits for the established workload threshold");
  assert.equal(thirdBackRotationShare(26, true, 2019), 0.2, "pre-2020 backfield rotation stays on the historical curve");
  assert.equal(thirdBackRotationShare(100, false), 0, "an empty depth chart never invents a substitute");

  team.depth.RB = [team.depth.RB[1], team.depth.RB[2], team.depth.RB[0], ...team.depth.RB.slice(3)];
  assert.equal(teamUnits(save, "pit").rb3?.id, team.depth.RB[2], "RB3 selection updates with owner depth-chart edits");
});

test("defensive coordinator rating governs recognition of repeated run/pass tendencies", () => {
  const runHeavy = ["run", "run", "run", "run", "run", "run", "pass", "pass", "run"];
  assert.equal(adaptiveDefensiveFocus("balanced", runHeavy.slice(0, 8), 99), "balanced", "wait for a useful sample and clear tendency");
  assert.equal(adaptiveDefensiveFocus("balanced", runHeavy, 99), "run", "a strong coordinator catches a clear early rushing pattern");
  assert.equal(adaptiveDefensiveFocus("balanced", runHeavy, 50), "balanced", "a weaker coordinator needs a stronger pattern");
  assert.equal(adaptiveDefensiveFocus("balanced", ["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass"], 99), "pass");
  assert.equal(adaptiveDefensiveFocus("run", ["pass", "pass", "pass", "pass", "pass", "pass", "pass", "pass"], 99), "run", "an explicit coach or owner focus remains in force");
});
test("a fourth back enters only as modern late-game relief from the saved depth chart", () => {
  assert.equal(fourthBackRotationShare(30, true, 2019), 0, "historical backfields keep their existing rotation");
  assert.equal(fourthBackRotationShare(18, true, 2020), 0.18, "committee-era fourth backs enter earlier and have a modestly larger ceiling");
  assert.equal(fourthBackRotationShare(30, false, 2024), 0, "no healthy fourth back means no invented relief");
  assert.equal(fourthBackRotationShare(11, true, 2024), 0, "the top two keep opening work");
  assert.equal(fourthBackRotationShare(30, true, 2024), 0.16, "a fourth back earns a meaningful modern relief share");
  assert.equal(fourthBackRotationShare(50, true, 2024), 0.16, "the fourth-back share stays capped");
  assert.equal(thirdBackRotationShare(20, true, 2020), 0.36, "2020–22 committee seasons bring RB3 in earlier");
  assert.equal(thirdBackRotationShare(20, true, 2023), 0.24, "the 2023–24 rotation curve stays calibrated separately");
  assert.equal(eraRb1Share(2020), 0.67, "2020–21 RB1 selection reflects the historical committee split");
  assert.equal(eraRb1Share(2021), 0.67);
  assert.equal(eraRb1Share(2022), 0.69);
  assert.equal(eraRb1Share(2023), 0.69);
  assert.equal(eraRb1Share(2024), 0.71, "2024's measured lead-back weight is unchanged");

  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const team = save.teams.pit;
  assert.ok(team.depth.RB.length >= 4, "the test roster has a fourth back");
  assert.equal(teamUnits(save, "pit").rb4?.id, team.depth.RB[3], "RB4 follows the saved depth chart");
});

test("third- and fourth-back substitutions divide one conserved carry pool", () => {
  const rotation = backfieldRotationShares(0.71, 0.2, 0.1);
  for (const [role, expected] of Object.entries({ rb1: 0.497, rb2: 0.203, rb3: 0.2, rb4: 0.1 })) {
    assert.ok(Math.abs(rotation[role] - expected) < 1e-12, `${role} receives its mutually exclusive share`);
  }
  assert.ok(Math.abs(Object.values(rotation).reduce((sum, share) => sum + share, 0) - 1) < 1e-12, "all four depth roles share one carry pool");

  const withoutFourthBack = backfieldRotationShares(0.6, 0.2, 0);
  for (const [role, expected] of Object.entries({ rb1: 0.48, rb2: 0.32, rb3: 0.2, rb4: 0 })) {
    assert.ok(Math.abs(withoutFourthBack[role] - expected) < 1e-12, `without RB4, ${role} keeps the former share`);
  }

  const bounded = backfieldRotationShares(0.7, 0.8, 0.8);
  assert.equal(bounded.rb3, 0.8);
  assert.ok(Math.abs(bounded.rb4 - 0.2) < 1e-12, "fourth-back share cannot double-count the remaining carry pool");
  assert.equal(Object.values(bounded).reduce((sum, share) => sum + share, 0), 1);
});

test("a healthy WR4 joins a modern three-wide target rotation after the starters absorb volume", () => {
  assert.equal(fourthReceiverRotationShare(30, false, 2024), 0, "no healthy reserve means no invented targets");
  assert.equal(fourthReceiverRotationShare(10, true, 2024), 0, "the starters own the early-game target share");
  assert.equal(fourthReceiverRotationShare(15, true, 2024), 0.05, "the fourth receiver joins as starters accumulate targets");
  assert.equal(fourthReceiverRotationShare(40, true, 2024), 0.1, "modern rotation remains capped");
  assert.equal(fourthReceiverRotationShare(40, true, 1985), 0.05, "older offenses rotate less often");
  assert.equal(fourthReceiverRotationShare(40, true, 1966), 0, "do not apply modern substitution habits to the 1960s");

  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  const team = save.teams.pit;
  team.offScheme = "vertical";
  const fourWide = teamUnits(save, "pit");
  assert.equal(fourWide.wr.length, 3, "the scheme keeps its three starting wideouts");
  assert.equal(fourWide.wr4?.id, team.depth.WR[3], "the reserve comes from the saved depth chart");

  team.offScheme = "smashmouth";
  assert.equal(teamUnits(save, "pit").wr4, undefined, "a one-wide offense does not inject an extra receiver");
});

test("passing-down target allocation includes the RB2 without inflating the RB target package", () => {
  assert.equal(backupBackTargetShare(1966, false), 0, "a missing backup does not create a target recipient");
  assert.equal(backupBackTargetShare(1966, true), 0.18, "early-era backups receive a smaller share");
  assert.equal(backupBackTargetShare(2000, true), 0.25, "the backup role grows with modern passing offenses");
  assert.equal(backupBackTargetShare(2024, true), 0.32, "modern passing backs receive the largest share");
});

test("stamina changes sustainable rush workload for every depth-chart role", () => {
  assert.equal(staminaWorkloadFactor(40), 0.5);
  assert.equal(staminaWorkloadFactor(80), 1);
  assert.equal(staminaWorkloadFactor(120), 1.25);

  const runSample = (stamina, seed) => {
    const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed });
    const backup = teamUnits(save, "pit").rb2;
    assert.ok(backup, "the sample team has a healthy RB2");
    backup.ratings.stamina = stamina;
    let carries = 0;
    let teamBackCarries = 0;
    for (let week = 1; week <= 20; week += 1) {
      const game = {
        id: `rb2-stamina-${stamina}-${week}`,
        year: 2024,
        week,
        phase: "regular",
        homeId: "pit",
        awayId: "cle",
        homeScore: 0,
        awayScore: 0,
        played: false,
      };
      simGame(save, game);
      const rows = [...(game.boxHome ?? []), ...(game.boxAway ?? [])];
      const row = rows.find((entry) => entry.playerId === backup.id);
      carries += row?.rushAtt ?? 0;
      teamBackCarries += rows.reduce((total, entry) => total + (save.players[entry.playerId]?.pos === "RB" ? entry.rushAtt ?? 0 : 0), 0);
    }
    return { carries, teamBackCarries };
  };

  const seeds = [917, 1201, 2503, 4421, 6619, 8081, 9337, 12011];
  const lowStamina = seeds.reduce((total, seed) => {
    const sample = runSample(40, seed);
    return { carries: total.carries + sample.carries, teamBackCarries: total.teamBackCarries + sample.teamBackCarries };
  }, { carries: 0, teamBackCarries: 0 });
  const highStamina = seeds.reduce((total, seed) => {
    const sample = runSample(120, seed);
    return { carries: total.carries + sample.carries, teamBackCarries: total.teamBackCarries + sample.teamBackCarries };
  }, { carries: 0, teamBackCarries: 0 });
  const lowShare = lowStamina.carries / lowStamina.teamBackCarries;
  const highShare = highStamina.carries / highStamina.teamBackCarries;
  assert.ok(highShare > lowShare, `a more durable RB2 should own a larger share of his team's RB carries (${highShare.toFixed(3)} vs ${lowShare.toFixed(3)}; ${highStamina.carries}/${highStamina.teamBackCarries} vs ${lowStamina.carries}/${lowStamina.teamBackCarries})`);
});

test("cumulative career rushing workload gradually shifts carries toward the depth chart", () => {
  const player = {
    stats: {
      2019: { rushYds: 6_000 },
      2020: { rushYds: 4_000 },
      2021: { rushYds: 8_000 },
      2022: { rushYds: 4_000 },
      2023: { rushYds: 4_000 },
    },
  };
  assert.equal(careerRushWorkloadFactor(player, 2019), 1, "normal workload does not penalize an emerging runner");
  assert.ok(Math.abs(careerRushWorkloadFactor(player, 2020) - 0.9428571429) < 0.0001, "the taper begins after 8,000 career rushing yards");
  assert.ok(Math.abs(careerRushWorkloadFactor(player, 2021) - 0.7142857143) < 0.0001, "the taper responds gradually to career use");
  assert.equal(careerRushWorkloadFactor(player, 2022), 0.62, "the taper continues through high career totals");
  assert.equal(careerRushWorkloadFactor(player, 2023), 0.62, "the minimum still preserves a role for an extreme career workload");
  assert.equal(careerRushWorkloadFactor(undefined, 2024), 1, "missing players do not change workload selection");
});

test("modern running-back yardage adjustments remain season-specific", () => {
  assert.equal(runningBackYardsAdjustment(2019), 0, "pre-modern run curves remain unchanged");
  assert.equal(runningBackYardsAdjustment(2020), 0.18);
  assert.equal(runningBackYardsAdjustment(2021), 0.18);
  assert.equal(runningBackYardsAdjustment(2022), 0.18);
  assert.equal(runningBackYardsAdjustment(2023), 0.48, "the four-seed 2023 audit gets its measured correction");
  assert.equal(runningBackYardsAdjustment(2024), 0.18, "the established 2024 calibration is preserved");
  assert.equal(runningBackYardsAdjustment(2027), 0.18, "future simulation stays on the modern default");
});

test("depth-chart wideout and backup-back substitutions enter the target pool in a game sample", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 812 });
  save.teams.pit.offScheme = "vertical";
  const reserveId = teamUnits(save, "pit").wr4?.id;
  assert.ok(reserveId, "the depth chart has a fourth healthy wideout");
  const backupBackId = teamUnits(save, "pit").rb2?.id;
  assert.ok(backupBackId, "the depth chart has a healthy second back");
  const startingIds = new Set(teamUnits(save, "pit").wr.map((player) => player.id));

  let reserveTargets = 0;
  let backupBackTargets = 0;
  let starterTargets = 0;
  for (let week = 1; week <= 12; week += 1) {
    const game = {
      id: `wr4-rotation-${week}`,
      year: 2024,
      week,
      phase: "regular",
      homeId: "pit",
      awayId: "cle",
      homeScore: 0,
      awayScore: 0,
      played: false,
    };
    simGame(save, game);
    const box = [...(game.boxHome ?? []), ...(game.boxAway ?? [])];
    reserveTargets += box
      .find((row) => row.playerId === reserveId)?.targets ?? 0;
    backupBackTargets += box.find((row) => row.playerId === backupBackId)?.targets ?? 0;
    starterTargets += box.filter((row) => startingIds.has(row.playerId)).reduce((sum, row) => sum + row.targets, 0);
  }
  assert.ok(reserveTargets > 0, `the workload-driven fourth receiver enters the actual target pool (got ${reserveTargets} from ${starterTargets} starter targets)`);
  assert.ok(backupBackTargets > 0, `the depth-chart RB2 receives a pass target over the sample (got ${backupBackTargets})`);
});

test("offensive scheme selects the intended receiver personnel and uses both tight ends", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 624 });
  const team = save.teams.pit;

  team.offScheme = "vertical";
  const vertical = teamUnits(save, "pit");
  assert.equal(vertical.wr.length, 3, "vertical personnel use three wide receivers");
  assert.equal(vertical.te2, undefined, "vertical personnel use one tight end");
  assert.equal(vertical.fb, undefined, "vertical personnel remove the fullback");

  team.offScheme = "smashmouth";
  const smashmouth = teamUnits(save, "pit");
  assert.equal(smashmouth.wr.length, 1, "smashmouth personnel use one wide receiver");
  assert.ok(smashmouth.te && smashmouth.te2, "smashmouth personnel can include two tight ends");
  assert.ok(smashmouth.fb, "smashmouth keeps its fullback available");

  const secondTightEnd = smashmouth.te2.id;
  const game = { id: "smashmouth-te-rotation", year: save.year, week: 2, phase: "regular", homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  simGame(save, game);
  const box = [...(game.boxHome ?? []), ...(game.boxAway ?? [])].find((row) => row.playerId === secondTightEnd);
  assert.ok(box?.targets > 0, "the second tight end participates in the passing game");
});
