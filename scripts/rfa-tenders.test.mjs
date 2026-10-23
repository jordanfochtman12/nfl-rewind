import test from "node:test";
import assert from "node:assert/strict";

if (!process.execArgv.some((arg) => arg.includes("strip-types"))) {
  test("RFA tender tests require Node type stripping", { skip: true }, () => {});
} else {
  const { accruedSeasonsFor, advance, compactSave, createNewGame, creditedSeasonsFor, erfaMinimumSalary, hydrateSave, isExclusiveRightsFreeAgent, isRestrictedFreeAgent, openRfaOfferSheets, pendingRfaOfferSheets, recordServiceGameWeek, rfaCompensationRound, rfaTenderPrice, resolveRfaOfferSheet, tenderErfa, tenderRfa } = await import("../src/lib/game/index.ts");
  const { cpuTenderErfa, cpuTenderRfa } = await import("../src/lib/game/contracts.ts");
  const { emptyStats } = await import("../src/lib/game/players.ts");
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
    const legacy = hydrateSave({ ...save, version: 23, rfaTenders: undefined, rfaOfferSheets: undefined, erfaTenders: undefined });
    assert.deepEqual(legacy.rfaTenders, []);
    assert.deepEqual(legacy.rfaOfferSheets, []);
    assert.deepEqual(legacy.erfaTenders, []);
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
    while (nextRng(seed).value >= 0.13) seed++;
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
    while (nextRng(seed).value >= 0.13) seed++;
    save.rng = seed;

    const offers = openRfaOfferSheets(save);
    assert.equal(offers.length, 1);
    assert.equal(offers[0].originalTeam, "pit");
    assert.equal(offers[0].status, "matched", "CPU original club resolves its own offer during market opening");
    assert.equal(player.teamId, "pit");
    assert.equal(pendingRfaOfferSheets(save).length, 0);
  });

  test("outside offer sheets stay uncommon and reflect the cost of a first-round tender", () => {
    const base = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const player = Object.values(base.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.pos = "QB";
    player.ovr = 99;
    player.potential = 99;
    player.age = 25;
    player.salary = 1_000_000;
    player.stats = Object.fromEntries([2022, 2023, 2024].map((year) => [year, { year, gp: 16 }]));
    player.career = [];
    player.contractYears = 0;
    base.salaryCap = 1_000_000_000;
    base.talks = [{ playerId: player.id, year: base.year, ask: 1_000_000, askYears: 2, pitch: "", patience: 3, status: "open", rounds: [], floor: 1_000_000 }];
    assert.match(tenderRfa(base, player.id, "first"), /qualifying offer/i);
    for (const team of Object.values(base.teams)) {
      if (team.id === base.userTeamId) continue;
      for (const id of team.roster) if (base.players[id]?.pos === "QB") base.players[id].ovr = 40;
    }
    ensureSeasonPicks(base);
    base.phase = "freeAgency";

    let offers = 0;
    const trials = 120;
    for (let seed = 1; seed <= trials; seed++) {
      const save = structuredClone(base);
      save.rng = seed;
      if (openRfaOfferSheets(save).length) offers++;
    }
    const rate = offers / trials;
    assert.ok(rate >= 0.05 && rate <= 0.23, `first-round offer-sheet rate was ${(rate * 100).toFixed(1)}% (${offers}/${trials})`);
  });

  test("ERFA status uses accrued service while tender pay uses credited service minimums", () => {
    const young = playerWithYears({ 2023: 3, 2024: 16 });
    young.career = [];
    assert.equal(accruedSeasonsFor(young), 1);
    assert.equal(creditedSeasonsFor(young), 2);
    assert.equal(isExclusiveRightsFreeAgent({ year: 2025 }, young), true);
    assert.equal(isRestrictedFreeAgent({ year: 2025 }, young), false);
    assert.equal(isExclusiveRightsFreeAgent({ year: 1993 }, young), false);
    assert.equal(erfaMinimumSalary(2026, 0), 885_000);
    assert.equal(erfaMinimumSalary(2026, 2), 1_075_000);
    assert.equal(erfaMinimumSalary(2026, 7), 1_300_000);

    const save = createNewGame({ userTeamId: "gnb", startingYear: 2026 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.stats = { 2024: { year: 2024, gp: 3 }, 2025: { year: 2025, gp: 16 } };
    player.career = [];
    player.contractYears = 0;
    save.salaryCap = 1_000_000_000;
    save.talks = [{ playerId: player.id, year: save.year, ask: 2_000_000, askYears: 2, pitch: "", patience: 3, status: "open", rounds: [], floor: 1_000_000 }];
    assert.match(tenderErfa(save, player.id), /exclusive-rights tender/i);
    assert.equal(player.contractYears, 1);
    assert.equal(player.salary, 1_075_000);
    assert.equal(save.talks[0].erfaTender?.creditedSeasons, 2);
    assert.equal(save.erfaTenders[0].teamId, "gnb");

    const cpu = Object.values(save.players).find((p) => p.teamId === "pit");
    assert.ok(cpu);
    cpu.stats = { 2024: { year: 2024, gp: 4 }, 2025: { year: 2025, gp: 16 } };
    cpu.career = [];
    cpu.contractYears = 0;
    assert.equal(cpuTenderErfa(save, cpu), true);
    assert.equal(save.erfaTenders.some((tender) => tender.playerId === cpu.id && tender.teamId === "pit"), true);
  });

  test("weekly full-pay service counts roster weeks, not appearances, and is idempotent", () => {
    const save = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const player = Object.values(save.players).find((p) => p.teamId === "gnb");
    assert.ok(player);
    player.stats = { 2025: { year: 2025, gp: 17 } };
    player.career = [];
    player.serviceByYear = undefined;
    save.phase = "regular";

    for (let week = 1; week <= 5; week++) {
      save.week = week;
      if (week === 2) {
        player.injuredWeeks = 3;
        player.onIR = true;
      }
      recordServiceGameWeek(save, ["gnb"]);
      if (week === 1) recordServiceGameWeek(save, ["gnb"]);
    }
    assert.equal(player.serviceByYear[2025].fullPayGames, 5);
    assert.equal(creditedSeasonsFor(player), 1);
    assert.equal(accruedSeasonsFor(player), 0, "the exact weekly ledger overrides season appearance totals");

    save.week = 6;
    recordServiceGameWeek(save, ["gnb"]);
    assert.equal(accruedSeasonsFor(player), 1);
    save.week = 7;
    player.holdout = true;
    recordServiceGameWeek(save, ["gnb"]);
    assert.equal(player.serviceByYear[2025].fullPayGames, 6, "a holdout week is not full-pay service");
    save.week = 8;
    player.holdout = false;
    recordServiceGameWeek(save, []);
    assert.equal(player.serviceByYear[2025].fullPayGames, 6, "a bye week has no scheduled game to accrue");

    save.realHistory = true;
    save.week = 9;
    recordServiceGameWeek(save, ["gnb"]);
    assert.equal(player.serviceByYear[2025].fullPayGames, 6, "Record mode never receives simulated service history");

    const legacy = createNewGame({ userTeamId: "gnb", startingYear: 2025 });
    const legacyPlayer = Object.values(legacy.players).find((p) => p.teamId === "gnb");
    assert.ok(legacyPlayer);
    legacyPlayer.stats = { 2025: { ...emptyStats(2025, "gnb"), gp: 4 } };
    legacy.phase = "regular";
    legacy.week = 5;
    legacy.version = 23;
    const migrated = hydrateSave(JSON.parse(JSON.stringify(legacy)));
    assert.equal(migrated.players[legacyPlayer.id].serviceByYear[2025].fullPayGames, 4, "old midseason saves seed a lower-bound service baseline from appearances");
    recordServiceGameWeek(migrated, ["gnb"]);
    assert.equal(migrated.players[legacyPlayer.id].serviceByYear[2025].fullPayGames, 5);

    const roundTrip = hydrateSave(JSON.parse(JSON.stringify(compactSave(save))));
    assert.deepEqual(roundTrip.players[player.id].serviceByYear, player.serviceByYear, "weekly service history survives compact save round-trip");
  });
}
