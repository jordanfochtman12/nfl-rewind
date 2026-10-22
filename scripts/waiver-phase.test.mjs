import test from "node:test";
import assert from "node:assert/strict";

if (!process.execArgv.some((arg) => arg.includes("strip-types"))) {
  test("waiver phase tests require Node type stripping", { skip: true }, () => {});
} else {
  const { activeRosterOf, advance, claimWaiver, createNewGame, ROSTER_TARGET } = await import("../src/lib/game/index.ts");
  const { generatePlayer } = await import("../src/lib/game/players.ts");

  test("user-controlled regular seasons pause for waiver claims before the next week", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 1966 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player, "seed roster has a claimable player for the fixture");

    player.teamId = "fa";
    save.phase = "regular";
    save.week = 1;
    save.weekFilm = true;
    for (const game of save.schedule.filter((g) => g.year === save.year && g.phase === "regular" && g.week === save.week)) {
      game.played = true;
    }
    save.waivers = [{ playerId: player.id, from: "gnb", week: 1, year: save.year }];

    const review = advance(save);
    assert.equal(review.phase, "waivers");
    assert.equal(review.week, 1);
    assert.equal(review.waivers.length, 1);
    const claim = claimWaiver(review, review.userTeamId, player.id);
    assert.equal(claim.ok, true, claim.reason);
    assert.equal(review.players[player.id]?.teamId, review.userTeamId);

    const reclaimed = review.players[player.id];
    assert.ok(reclaimed);
    reclaimed.teamId = "fa";
    review.waivers.push({ playerId: player.id, from: "gnb", week: 1, year: review.year });
    while (activeRosterOf(review, review.userTeamId).length < ROSTER_TARGET) {
      generatePlayer(review, "QB", review.userTeamId, 55, 26);
    }
    const fullRosterClaim = claimWaiver(review, review.userTeamId, player.id);
    assert.equal(fullRosterClaim.ok, false);
    assert.match(fullRosterClaim.reason ?? "", /roster is full/i);

    const next = advance(review);
    assert.equal(next.phase, "regular");
    assert.equal(next.week, 2);
  });

  test("CPU-only seasons process waiver claims without pausing the simulation", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 1966 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.teamId = "fa";
    save.cpuOnly = true;
    save.phase = "regular";
    save.week = 1;
    save.weekFilm = true;
    for (const game of save.schedule.filter((g) => g.year === save.year && g.phase === "regular" && g.week === save.week)) {
      game.played = true;
    }
    save.waivers = [{ playerId: player.id, from: "gnb", week: 1, year: save.year }];

    const next = advance(save);
    assert.equal(next.phase, "regular");
    assert.equal(next.week, 2);
    assert.equal(next.waivers.some((wire) => wire.playerId === player.id), true, "unclaimed waiver remains live for its claim window");
  });
}
