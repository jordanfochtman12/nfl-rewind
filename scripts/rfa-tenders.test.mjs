import test from "node:test";
import assert from "node:assert/strict";

if (!process.execArgv.some((arg) => arg.includes("strip-types"))) {
  test("RFA tender tests require Node type stripping", { skip: true }, () => {});
} else {
  const { accruedSeasonsFor, advance, compactSave, createNewGame, hydrateSave, isRestrictedFreeAgent, openRfaOfferSheets, pendingRfaOfferSheets, rfaCompensationRound, rfaTenderPrice, resolveRfaOfferSheet, tenderRfa } = await import("../src/lib/game/index.ts");
  const { cpuTenderRfa } = await import("../src/lib/game/contracts.ts");
  const { allPicks, ensureSeasonPicks } = await import("../src/lib/game/draft.ts");
  const { nextRng } = await import("../src/lib/game/rng.ts");

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
    assert.equal(rfaTenderPrice(2026, "first"), 8_107_000);
    assert.equal(rfaTenderPrice(2026, "second"), 5_811_000);
    assert.equal(rfaTenderPrice(2026, "original"), 3_674_000);
    assert.equal(rfaTenderPrice(2026, "rofr"), 3_547_000);
    assert.ok(rfaTenderPrice(2026, "first") > rfaTenderPrice(1994, "first"));
    assert.equal(rfaCompensationRound("original", { draftRound: 3 }), 3);
    assert.equal(rfaCompensationRound("original", { draftRound: undefined }), undefined);
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
    assert.match(result, /One-year/);
    assert.equal(save.talks[0].status, "tendered");
    assert.equal(player.contractYears, 1);
    assert.equal(player.salary, rfaTenderPrice(save.year));
    assert.equal(save.talks[0].rfaTender?.level, "rofr");
    assert.equal(save.rfaTenders[0].level, "rofr");
  });

  test("the original club can match an offer sheet or decline it for the required next-draft pick", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const players = Object.values(save.players).filter((p) => p.teamId === "gnb").slice(0, 2);
    assert.equal(players.length, 2);
    save.salaryCap = 1_000_000_000;
    save.talks = [];
    for (const [index, player] of players.entries()) {
      player.stats = Object.fromEntries([2022, 2023, 2024].map((year) => [year, { year, gp: 16 }]));
      player.career = [];
      player.contractYears = 0;
      player.salary = 1_000_000;
      save.talks.push({ playerId: player.id, year: save.year, ask: 1_000_000, askYears: 2, pitch: "", patience: 3, status: "open", rounds: [], floor: 1_000_000 });
      tenderRfa(save, player.id, "second");
      const offerTeam = index === 0 ? "pit" : "chi";
      save.rfaOfferSheets.push({
        id: `manual-sheet-${index}`, year: save.year, playerId: player.id, originalTeam: "gnb", offerTeam,
        salary: 7_000_000, years: 3, compensationRound: 2, status: "pending",
      });
    }
    ensureSeasonPicks(save);
    const otherPick = allPicks(save).find((pick) => pick.owner === "chi" && pick.year === save.year + 1 && pick.round === 2 && !pick.used);
    assert.ok(otherPick);
    save.rfaOfferSheets[1].compensationPickId = otherPick.id;

    const match = resolveRfaOfferSheet(save, "manual-sheet-0", true);
    assert.match(match, /matched and retained/i);
    assert.equal(players[0].teamId, "gnb");
    assert.equal(players[0].salary, 7_000_000);
    assert.equal(save.rfaOfferSheets[0].status, "matched");

    const decline = resolveRfaOfferSheet(save, "manual-sheet-1", false);
    assert.match(decline, /receives/i);
    assert.equal(players[1].teamId, "chi");
    assert.equal(allPicks(save).find((pick) => pick.id === otherPick.id)?.owner, "gnb");
    assert.equal(save.rfaOfferSheets[1].status, "signed");

    save.phase = "freeAgency";
    save.faOpened = true;
    save.rfaOfferSheets.push({ id: "pending-close", year: save.year, playerId: players[0].id, originalTeam: "gnb", offerTeam: "pit", salary: 8_000_000, years: 2, status: "pending" });
    const held = advance(save, { closeFa: true });
    assert.equal(held.phase, "freeAgency", "market cannot close while the original club owes a decision");

    const roundTrip = hydrateSave(JSON.parse(JSON.stringify(compactSave(save))));
    assert.deepEqual(roundTrip.rfaTenders, save.rfaTenders);
    assert.deepEqual(roundTrip.rfaOfferSheets, save.rfaOfferSheets);
    const legacy = hydrateSave({ ...save, version: 21, rfaTenders: undefined, rfaOfferSheets: undefined });
    assert.deepEqual(legacy.rfaTenders, []);
    assert.deepEqual(legacy.rfaOfferSheets, []);
  });

  test("free-agency opening creates CPU offer sheets only when a rival needs the tendered player", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.pos = "QB";
    player.ovr = 99;
    player.potential = 99;
    player.age = 25;
    player.salary = 1_000_000;
    player.stats = Object.fromEntries([2022, 2023, 2024].map((year) => [year, { year, gp: 16 }]));
    player.career = [];
    player.contractYears = 0;
    save.salaryCap = 1_000_000_000;
    save.talks = [{ playerId: player.id, year: save.year, ask: 1_000_000, askYears: 2, pitch: "", patience: 3, status: "open", rounds: [], floor: 1_000_000 }];
    assert.match(tenderRfa(save, player.id, "first"), /qualifying offer/i);
    for (const team of Object.values(save.teams)) {
      if (team.id === save.userTeamId) continue;
      for (const id of team.roster) if (save.players[id]?.pos === "QB") save.players[id].ovr = 40;
    }
    ensureSeasonPicks(save);
    save.phase = "freeAgency";
    let seed = 0;
    while (nextRng(seed).value >= 0.5) seed++;
    save.rng = seed;

    const offers = openRfaOfferSheets(save);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].playerId, player.id);
    assert.equal(offers[0].compensationRound, 1);
    assert.equal(offers[0].status, "pending");
  });

  test("CPU clubs challenge and resolve offer sheets on CPU-controlled tenders", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const player = Object.values(save.players).find((p) => p.teamId === "pit");
    assert.ok(player);
    player.pos = "QB";
    player.ovr = 99;
    player.potential = 99;
    player.age = 25;
    player.salary = 1_000_000;
    player.stats = Object.fromEntries([2022, 2023, 2024].map((year) => [year, { year, gp: 16 }]));
    player.career = [];
    player.contractYears = 0;
    save.salaryCap = 1_000_000_000;
    for (const team of Object.values(save.teams)) {
      if (team.id === "pit") continue;
      for (const id of team.roster) if (save.players[id]?.pos === "QB") save.players[id].ovr = 40;
    }
    assert.equal(cpuTenderRfa(save, player), true);
    ensureSeasonPicks(save);
    save.phase = "freeAgency";
    let seed = 0;
    while (nextRng(seed).value >= 0.5) seed++;
    save.rng = seed;

    const offers = openRfaOfferSheets(save);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].originalTeam, "pit");
    assert.equal(offers[0].status, "matched", "CPU original club resolves its own offer during market opening");
    assert.equal(player.teamId, "pit");
    assert.equal(pendingRfaOfferSheets(save).length, 0);
  });
}
