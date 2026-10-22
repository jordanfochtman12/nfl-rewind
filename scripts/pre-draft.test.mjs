import test from "node:test";
import assert from "node:assert/strict";

if (!process.execArgv.some((arg) => arg.includes("strip-types"))) {
  test("pre-draft tests require Node type stripping", { skip: true }, () => {});
} else {
  const { advance, createNewGame } = await import("../src/lib/game/index.ts");

  test("new dynasties open with the pre-draft show before the first pick", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 17 });
    assert.equal(save.phase, "preDraft");
    assert.match(save.weekLabel, /pre-draft/i);
    assert.ok(save.draftBoard.length > 0);

    const board = save.draftBoard.map((slot) => slot.playerId);
    const room = advance(save);
    assert.equal(room.phase, "draft");
    assert.equal(room.draftPickIndex, 0);
    assert.deepEqual(room.draftBoard.map((slot) => slot.playerId), board);
  });

  test("auto play moves through the show without changing the draft board", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 23 });
    const names = save.draftBoard.slice(0, 10).map((slot) => save.players[slot.playerId]?.firstName);
    const room = advance(save, { auto: true });
    assert.equal(room.phase, "draft");
    assert.deepEqual(room.draftBoard.slice(0, 10).map((slot) => room.players[slot.playerId]?.firstName), names);
  });
}
