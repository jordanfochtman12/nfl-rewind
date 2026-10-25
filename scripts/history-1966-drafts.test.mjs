import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceHistory, createHistoryGame, loadHistoryData, setHistoryData } from "../src/lib/game/index.ts";

test("1966 Record mode has separate, complete NFL and AFL standard draft boards", async () => {
  const history = await loadHistoryData();
  const picks = history.drafts(1966);
  const nfl = picks.filter((pick) => pick.league === "nfl");
  const afl = picks.filter((pick) => pick.league === "afl");
  const name = (pick) => {
    const person = history.people[pick.person];
    return `${person.first} ${person.last}`;
  };

  assert.equal(nfl.length, 305);
  assert.equal(afl.length, 181);
  for (const [league, board, lastPick] of [["NFL", nfl, 305], ["AFL", afl, 181]]) {
    const pickNumbers = board.map((pick) => pick.pick).sort((a, b) => a - b);
    assert.deepEqual(pickNumbers, Array.from({ length: lastPick }, (_, index) => index + 1), `${league} overall picks are complete and unique`);
  }

  const nflFirst = nfl.find((pick) => pick.pick === 1);
  assert.equal(name(nflFirst), "Tommy Nobis");
  assert.equal(nflFirst.team, "atl");

  const aflFirst = afl.find((pick) => pick.pick === 1);
  assert.equal(name(aflFirst), "Jim Grabowski");
  assert.equal(aflFirst.team, "mia");

  const aflCompensatory = afl.find((pick) => pick.pick === 105);
  assert.equal(aflCompensatory.round, 12);
  assert.equal(name(aflCompensatory), "Bill Wolski");
  assert.equal(aflCompensatory.team, "nyj");
});

test("Record mode applies the real NFL first pick and keeps dual-drafted players singular", async () => {
  setHistoryData(await loadHistoryData());
  const save = createHistoryGame();
  advanceHistory(save);

  const firstPick = (team) => Object.values(save.players).find((player) =>
    player.draftYear === 1966 && player.draftRound === 1 && player.draftPick === 1 && player.draftTeam === team,
  );
  assert.equal(`${firstPick("atl").firstName} ${firstPick("atl").lastName}`, "Tommy Nobis");
  const jimGrabowski = Object.values(save.players).filter((player) => player.firstName === "Jim" && player.lastName === "Grabowski");
  assert.equal(jimGrabowski.length, 1);
  // Miami took him first in the AFL; Green Bay's No. 9 NFL selection is the club he joined.
  assert.equal(jimGrabowski[0].draftTeam, "gnb");
  assert.equal(jimGrabowski[0].draftPick, 9);
});
