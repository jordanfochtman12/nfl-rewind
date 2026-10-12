/** The studio graphics package: each segment of a real show gets a graphic built from the save. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil } from "../src/lib/game/index.ts";
import { gameGraphic, playerGraphic, showGraphic, showTicker } from "../src/lib/game/showGraphics.ts";

test("weekly shows cut to scores, tapes, cards and boards that match the box scores", () => {
  let s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 31 });
  s = simUntil(s, (x) => x.phase === "regular" && x.week >= 6);
  const show = s.primetime;
  assert.ok(show?.episode, "a show aired");
  const kinds = new Set();
  let graphics = 0;
  for (const ch of show.episode.chapters) {
    const g = showGraphic(s, show.year, show.episode, ch, show);
    if (!g) continue;
    graphics += 1;
    kinds.add(g.kind);
    if (g.kind === "score") {
      const game = [...s.schedule].find((x) => ch.id === `film-${x.id}`);
      assert.ok(game, "a score graphic is a real game");
      assert.equal(g.homeScore, game.homeScore);
      assert.equal(g.awayScore, game.awayScore);
      if (g.homeQ) assert.equal(g.homeQ.reduce((a, b) => a + b, 0), g.homeScore);
    }
    if (g.kind === "tape") assert.ok(g.rows.length >= 4 && g.rows[0].label === "Record");
    if (g.kind === "board") assert.ok(g.rows.length >= 1 && g.rows.every((r, i) => r.rank === i + 1));
  }
  assert.ok(graphics >= Math.ceil(show.episode.chapters.length / 3), `${graphics} graphics for ${show.episode.chapters.length} segments`);
  assert.ok(kinds.has("score"), "game recaps carry the final");
  const ticker = showTicker(s, show.year, show.week);
  assert.ok(ticker.some((t) => / · FINAL$/.test(t)));
});

test("player cards and finals for the nights around the season", () => {
  const s = simUntil(createNewGame({ userTeamId: "dal", startingYear: 1966, seed: 4 }), (x) => x.phase === "regular" && x.week >= 4);
  const qb = Object.values(s.players).filter((p) => p.pos === "QB" && (p.stats[s.year]?.passAtt ?? 0) > 50)[0];
  const card = playerGraphic(s, s.year, qb.id, "TEST");
  assert.equal(card.kind, "player");
  assert.ok(card.stats.find((x) => x.label === "YDS")?.value === qb.stats[s.year].passYds.toLocaleString("en-US"));
  const game = s.schedule.find((g) => g.played);
  const fin = gameGraphic(s, game, "FINAL");
  assert.equal(fin.homeScore, game.homeScore);
});
