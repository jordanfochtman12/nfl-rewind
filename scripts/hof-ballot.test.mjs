/** Honors must matter to a Hall ballot, while future and duplicate entries cannot inflate it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, playerHofScore } from "../src/lib/game/index.ts";
import { coachHofEligible, playerHofEligible } from "../src/lib/game/hof.ts";
import { gatherHof } from "../src/lib/game/events.ts";

test("Hall of Fame scoring recognizes Pro Bowls and major position awards with diminishing returns", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 94 });
  const player = Object.values(save.players).find((p) => p.pos === "RB");
  assert.ok(player);
  player.honors = { proBowl: [], allPro: [], awards: [], rings: [] };
  const noPastHonors = playerHofScore(save, player);

  player.honors.proBowl = [1962, 1963, 1964, 1965, 1966];
  player.honors.awards = [
    { year: 1964, award: "OPOY" },
    { year: 1964, award: "OPOY" },
    { year: 1965, award: "DPOY" },
    { year: 1967, award: "OPOY" },
  ];
  const decorated = playerHofScore(save, player);
  assert.equal(decorated - noPastHonors, 5 * 1.35 + 4 + 5, "duplicate and future honors do not count");
  player.honors.proBowl = Array.from({ length: 30 }, (_, i) => 1936 + i);
  const capDifference = playerHofScore(save, player) - playerHofScore(save, { ...player, honors: { ...player.honors, proBowl: [1966] } });
  assert.ok(Math.abs(capDifference - (16 - 1.35)) < 1e-9, "Pro Bowl credit is capped");
});

test("Hall of Fame ballot evaluates punters on career workload and punt average", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 941 });
  const punter = Object.values(save.players).find((p) => p.pos === "P");
  assert.ok(punter, "the historical opening roster includes a punter");
  const line = (punts, puntYds) => ({ year: 1965, gp: 16, passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, sacksThrown: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tackles: 0, sacks: 0, ints: 0, ff: 0, fgAtt: 0, fgMade: 0, xpAtt: 0, xpMade: 0, twoPtMade: 0, safeties: 0, punts, puntYds, krYds: 0, prYds: 0 });
  const candidate = { ...punter, historical: false, peakOvr: 84, ovr: 84, yearsPro: 12, career: [line(600, 24_000)], stats: {}, honors: { proBowl: [], allPro: [], awards: [], rings: [] } };
  const baseline = playerHofScore(save, { ...candidate, career: [] });
  const volume = playerHofScore(save, candidate);
  const quality = playerHofScore(save, { ...candidate, career: [line(600, 27_000)] });

  assert.ok(Math.abs(volume - baseline - 600 * 0.012) < 1e-9, "punt volume receives capped career production credit");
  assert.equal(quality - volume, 6, "a 45-yard gross average receives the capped quality bonus");
});

test("a retired coach becomes Hall-eligible after one complete season out of football", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 95 });
  const coach = Object.values(save.coaches)[0];
  assert.ok(coach);
  Object.assign(coach, {
    retiredYear: 1967,
    careerWins: 100,
    careerLosses: 20,
    careerTitles: 1,
    yearsCoaching: 20,
    peakOffense: 95,
  });

  assert.equal(coachHofEligible(save, coach), false, "not eligible during his retirement-year ballot");
  save.year = 1967;
  assert.equal(coachHofEligible(save, coach), true, "eligible after that season is complete");
});

test("players need five seasons and a recognized postseason honor before Canton eligibility", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 96 });
  const player = Object.values(save.players).find((p) => p.pos === "RB");
  assert.ok(player);
  Object.assign(player, { historical: true, retiredYear: 1967, yearsPro: 4, peakOvr: 96, ovr: 96 });
  save.year = 1971;
  player.honors = { proBowl: [1972], allPro: [], awards: [], rings: [] };
  assert.equal(playerHofEligible(save, player), false, "four seasons and future honors are not enough");

  player.yearsPro = 5;
  assert.equal(playerHofEligible(save, player), false, "a five-year career still needs a recognized honor");
  player.honors.proBowl = [1966];
  assert.equal(playerHofEligible(save, player), true, "a past Pro Bowl completes the requirements");
});

test("an existing Hall ledger entry cannot consume a player or coach ballot slot", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 97 });
  save.year = 1975;
  const players = Object.values(save.players).slice(0, 6);
  for (const [index, player] of players.entries()) {
    Object.assign(player, {
      historical: true,
      retiredYear: 1969,
      yearsPro: 20,
      peakOvr: 99 - index,
      ovr: 99 - index,
      hofYear: undefined,
      honors: { proBowl: [1970], allPro: [], awards: [], rings: [] },
    });
  }

  const coaches = Object.values(save.coaches).slice(0, 3);
  for (const [index, coach] of coaches.entries()) {
    Object.assign(coach, {
      retiredYear: 1969,
      hofYear: undefined,
      careerWins: 300 - index * 10,
      careerLosses: 100,
      careerTitles: 2,
      careerBowls: 3,
      yearsCoaching: 20,
      peakOffense: 95,
      peakDefense: 95,
    });
  }

  const duplicatePlayer = players[0];
  const duplicateCoach = coaches[0];
  save.history.hof.push(
    { playerId: duplicatePlayer.id, year: 1974, teamId: "pit", blurb: "Already in the ledger.", kind: "player" },
    { coachId: duplicateCoach.id, year: 1974, teamId: "pit", blurb: "Already in the ledger.", kind: "coach" },
  );

  gatherHof(save);
  assert.equal(save.pendingHof.length, 5, "all five open player slots go to eligible players");
  assert.ok(!save.pendingHof.includes(duplicatePlayer.id), "a stale player copy cannot block a new inductee");
  assert.ok(players.slice(1).every((player) => save.pendingHof.includes(player.id)));
  assert.equal(save.pendingCoachHof.length, 2, "both open coach slots go to eligible coaches");
  assert.ok(!save.pendingCoachHof.includes(duplicateCoach.id), "a stale coach copy cannot block a new inductee");
  assert.ok(coaches.slice(1).every((coach) => save.pendingCoachHof.includes(coach.id)));
});
