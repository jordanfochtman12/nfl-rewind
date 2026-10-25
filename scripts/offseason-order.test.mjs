import { test } from "node:test";
import assert from "node:assert/strict";

const game = await import("../src/lib/game/index.ts");

test("later offseason markets open before the pre-draft show and draft", () => {
  let save = game.createNewGame({ userTeamId: "pit", startingYear: 2003, seed: 903 });
  save.phase = "carousel";

  save = game.advance(save);
  assert.equal(save.year, 2004);
  assert.equal(save.phase, "freeAgency");
  assert.equal(save.marketBeforeDraft, true);
  assert.equal(save.faOpened, true);

  save = game.advance(save, { closeFa: true });
  assert.equal(save.phase, "preDraft");
  save = game.advance(save);
  assert.equal(save.phase, "draft");
  save = game.advance(save, { auto: true });
  assert.equal(save.phase, "preseason");
});

test("first-year draft-first flow remains intact for new and legacy saves", () => {
  let save = game.createNewGame({ userTeamId: "pit", startingYear: 2003, seed: 904 });
  save.phase = "draft";
  save.marketBeforeDraft = false;
  save = game.advance(save, { auto: true });
  assert.equal(save.phase, "freeAgency");
  save = game.advance(save, { closeFa: true });
  assert.equal(save.phase, "preseason");
});
