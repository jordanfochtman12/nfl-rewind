import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, buildHistoryPrimetime, createHistoryGame, createNewGame, displayName, loadHistoryData, setBoxSeason, setHistoryData } from "../src/lib/game/index.ts";

const game = (id, awayId, homeId, awayScore, homeScore) => ({
  id, year: 1966, week: 1, phase: "regular", awayId, homeId, awayScore, homeScore, played: true,
});

test("Record Primetime is built from real finals and sourced box lines, without dynasty projections", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 4 });
  save.realHistory = true;
  save.week = 1;
  const close = game("real-close", "chi", "gnb", 7, 10);
  const other = game("real-other", "nyg", "pit", 3, 24);
  save.schedule = [close, other, { ...game("future-game", "min", "det", 0, 0), week: 2, played: false }];
  save.teams.gnb.wins = 1;
  save.teams.chi.losses = 1;
  save.teams.pit.wins = 1;
  save.teams.nyg.losses = 1;
  setBoxSeason(1966, [{
    d: "0911", a: "chi", h: "gnb", q: [[7, 0, 0, 0], [3, 0, 0, 7]], f: [7, 10], s: [], t: [{}, {}],
    p: [[0, "Johnny Unitas", { pa: 20, pc: 15, py: 180, pt: 2 }]],
  }]);

  buildHistoryPrimetime(save, "regular");
  const show = save.primetime;
  assert.ok(show?.episode);
  assert.equal(show.recaps.length, 2);
  assert.match(show.episode.headline, /1966, Week 1/);
  assert.ok(show.episode.chapters.some((c) => c.lines.some((l) => l.text.includes("Johnny Unitas") && l.text.includes("180 yards"))));
  assert.ok(show.episode.chapters.some((c) => c.lines.some((l) => l.text.includes("10-point finish") || l.text.includes("3-point finish"))));
  assert.equal(show.predictions, undefined);
  assert.equal(show.power, undefined);
  assert.equal(show.outlook, undefined);
  assert.equal(show.injuries, undefined);

  const id = show.episode.id;
  buildHistoryPrimetime(save, "regular");
  assert.equal(save.primetime.episode.id, id, "rebuilding the same historical week is stable");
  assert.equal(save.primetimeArchive?.length ?? 0, 0, "the same episode is not archived twice");
});

test("Record Primetime reports ties as ties and makes a distinct episode for the next week", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 5 });
  save.realHistory = true;
  save.schedule = [game("tie-game", "nyg", "phi", 14, 14), { ...game("future-game", "min", "det", 0, 0), week: 2, played: false }];
  save.week = 1;
  buildHistoryPrimetime(save, "regular");
  assert.ok(save.primetime.episode.chapters.some((c) => c.lines.some((l) => l.text.includes("ends level"))));

  save.week = 2;
  save.schedule = [game("week-two", "dal", "was", 21, 13), { ...game("future-game", "min", "det", 0, 0), week: 3, played: false }];
  buildHistoryPrimetime(save, "regular");
  assert.notEqual(save.primetime.episode.id, "1966-record-weekly-1-tie-game");
  assert.ok(save.primetimeArchive?.some((s) => s.episode?.id.includes("tie-game")));
  assert.match(save.primetime.episode.headline, /Week 2/);
});

test("Record standings identify the best win percentage, even with uneven games played", () => {
  const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 8 });
  save.realHistory = true;
  save.week = 3;
  for (const team of Object.values(save.teams)) {
    team.wins = 0;
    team.losses = 0;
    team.ties = 0;
  }
  save.teams.pit.wins = 1;
  save.teams.gnb.wins = 2;
  save.teams.gnb.losses = 1;
  save.schedule = [{ ...game("week-three-final", "pit", "gnb", 14, 10), week: 3 }];

  buildHistoryPrimetime(save, "regular");

  const standings = save.primetime.episode.chapters.find((c) => c.id === "week-context");
  assert.ok(standings);
  assert.ok(standings.lines.some((line) => /Pittsburgh.*1-0 after Week 3/.test(line.text)));
  assert.ok(!standings.lines.some((line) => /Green Bay.*set the pace/.test(line.text)));
});

test("the Record regular-season finale previews the exact playoff field without future scores", async () => {
  const history = await loadHistoryData();
  setHistoryData(history);
  let save = createHistoryGame();
  for (let step = 0; step < 32 && save.phase !== "playoffs"; step++) save = advance(save);

  assert.equal(save.phase, "playoffs", "the historical replay has completed the regular season");
  const episode = save.primetime?.episode;
  assert.equal(episode?.edition, "seasonFinale");
  const field = episode?.chapters.find((item) => item.id === "postseason-field");
  assert.ok(field, "the season finale includes its postseason preview");
  assert.equal(field.teamIds.length, 4, "the 1966 AFL and NFL fields each contain their two real qualifiers");
  const lines = field.lines.map((line) => line.text).join(" ");
  for (const id of field.teamIds) {
    const team = save.teams[id];
    const tieLine = team.ties ? `-${team.ties}` : "";
    assert.ok(lines.includes(`${displayName(save.year, id)} (${team.wins}-${team.losses}${tieLine})`), `${id} is shown with its completed regular-season record`);
  }
  assert.match(lines, /AFL field:/);
  assert.match(lines, /NFL field:/);
  assert.match(lines, /No future score is revealed/);
  assert.doesNotMatch(lines, /31-7|34-27|35-10/, "the preview does not disclose recorded postseason scores");
});
