import { test } from "node:test";
import assert from "node:assert/strict";
import { teamNetYards } from "../src/lib/game/sim.ts";
import { createNewGame, simGame } from "../src/lib/game/index.ts";

test("team total offense subtracts sack losses from gross passing and rushing yards", () => {
  const box = [
    { playerId: "qb", passYds: 248, sackYdsLost: 18 },
    { playerId: "rb", rushYds: 91 },
  ];
  assert.equal(teamNetYards(box), 321, "net passing (230) plus rushing (91)");
  assert.equal(teamNetYards([{ playerId: "qb", passYds: 248 }]), 248,
    "older box scores without sack-loss detail retain their saved yardage basis");
});

test("simulated team totals reconcile to the box score including sacks", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 2024, cpuOnly: true, seed: 1047 });
  const game = { id: "net-yards-regression", year: 2024, week: 4, phase: "regular",
    homeId: "pit", awayId: "cle", homeScore: 0, awayScore: 0, played: false };
  simGame(save, game);

  assert.ok(game.boxHome && game.boxAway);
  assert.equal(game.homeTot, teamNetYards(game.boxHome));
  assert.equal(game.awayTot, teamNetYards(game.boxAway));
  const sacksLost = game.boxHome.reduce((n, p) => n + (p.sackYdsLost ?? 0), 0)
    + game.boxAway.reduce((n, p) => n + (p.sackYdsLost ?? 0), 0);
  assert.ok(sacksLost > 0, "fixed-seed game exercises at least one recorded sack loss");
});
