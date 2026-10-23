import test from "node:test";
import assert from "node:assert/strict";

if (!process.execArgv.some((arg) => arg.includes("strip-types"))) {
  test("RFA tender tests require Node type stripping", { skip: true }, () => {});
} else {
  const { accruedSeasonsFor, createNewGame, isRestrictedFreeAgent, rfaTenderPrice, tenderRfa } = await import("../src/lib/game/index.ts");

  function playerWithYears(gamesByYear) {
    return {
      id: "rfa-test", name: "Test Player", pos: "WR", teamId: "gnb", age: 25, yearsPro: 3,
      ovr: 70, potential: 75, salary: 1_000_000, contractYears: 0, stats: Object.fromEntries(
        Object.entries(gamesByYear).map(([year, gp]) => [year, { year: Number(year), gp }]),
      ), career: [],
    };
  }

  test("accrued seasons count distinct years with six games and avoid duplicate career rows", () => {
    const player = playerWithYears({ 2022: 16, 2023: 5, 2024: 8 });
    player.career = [{ year: 2022, gp: 16 }, { year: 2023, gp: 5 }, { year: 2024, gp: 8 }];
    assert.equal(accruedSeasonsFor(player), 2);
  });

  test("RFA eligibility is cap-era only, with the special three-to-five window in 2010", () => {
    const three = playerWithYears({ 2022: 16, 2023: 16, 2024: 16 });
    assert.equal(isRestrictedFreeAgent({ year: 1993 }, three), false);
    assert.equal(isRestrictedFreeAgent({ year: 2025 }, three), true);
    const five = playerWithYears({ 2005: 16, 2006: 16, 2007: 16, 2008: 16, 2009: 16 });
    assert.equal(isRestrictedFreeAgent({ year: 2010 }, five), true);
    const six = playerWithYears({ 2004: 16, 2005: 16, 2006: 16, 2007: 16, 2008: 16, 2009: 16 });
    assert.equal(isRestrictedFreeAgent({ year: 2010 }, six), false);
  });

  test("one-year RFA tender is available only in cap years and scales with the league cap", () => {
    assert.equal(rfaTenderPrice(1993), 0);
    assert.ok(rfaTenderPrice(2026) > rfaTenderPrice(1994));
    assert.ok(rfaTenderPrice(2026) > 3_000_000);
  });

  test("owner can tender an eligible expiring player and the decision updates the contract", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.stats = Object.fromEntries([2022, 2023, 2024].map((year) => [year, { year, gp: 16 }]));
    player.career = [];
    player.salary = 1_000_000;
    save.salaryCap = 1_000_000_000;
    player.contractYears = 0;
    save.players[player.id] = player;
    save.talks = [{ playerId: player.id, year: save.year, ask: 1_000_000, askYears: 2, pitch: "", patience: 3, status: "open", rounds: [], floor: 1_000_000 }];

    const result = tenderRfa(save, player.id);
    assert.match(result, /One year/);
    assert.equal(save.talks[0].status, "tendered");
    assert.equal(player.contractYears, 1);
    assert.equal(player.salary, rfaTenderPrice(save.year));
    assert.equal(save.talks[0].rfaTender?.level, "rofr");
  });
}
