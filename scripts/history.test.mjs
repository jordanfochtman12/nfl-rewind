/**
 * History mode accuracy guard. History mode lays the real league into the save step by step
 * (see src/lib/game/historyMode.ts); this replays the whole record, 1966 to the last season
 * in the tables, and fails if anything it shows drifts from what really happened: champions,
 * famous records, stat lines, award winners (co-winners included), draft picks and Hall of
 * Fame classes. It also checks that a saved History game, which is stored as a step count,
 * replays to the same league.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceHistory,
  createHistoryGame,
  historyCursor,
  loadHistoryData,
  replayHistory,
  simUntil,
  setHistoryData,
  HISTORY_LAST,
} from "../src/lib/game/index.ts";

let save;
const records = {};
const midSeason = {};

before(async () => {
  setHistoryData(await loadHistoryData());
  save = createHistoryGame();
  while (save.phase !== "complete") {
    const { year, phase } = save;
    advanceHistory(save);
    if (phase === "regular" && save.phase === "playoffs")
      records[year] = Object.fromEntries(Object.entries(save.teams).map(([id, t]) => [id, `${t.wins}-${t.losses}-${t.ties}`]));
    if (year === 1990 && phase === "regular" && save.week === 9) midSeason.step = save.historyStep;
  }
});

const person = (first, last, year) =>
  Object.values(save.players).filter((p) => p.firstName === first && p.lastName === last && (!year || p.stats[year] || p.draftYear === year));
const one = (first, last, year) => {
  const list = person(first, last, year);
  assert.equal(list.length, 1, `${first} ${last} (${year ?? "any"}): ${list.length} matches`);
  return list[0];
};
const champ = (year) => {
  const b = save.history.superBowls.find((x) => x.year === year);
  return b && (b.homeScore >= b.awayScore ? b.homeId : b.awayId);
};

test("every season reaches the end of the record", () => {
  assert.equal(save.phase, "complete");
  assert.equal(save.history.superBowls.length, HISTORY_LAST - 1966 + 1);
  assert.equal(save.history.awards.length, HISTORY_LAST - 1966 + 1);
});

test("Super Bowl champions", () => {
  const real = { 1966: "gnb", 1967: "gnb", 1968: "nyj", 1969: "kan", 1970: "clt", 1972: "mia", 1976: "rai", 1985: "chi", 1989: "sfo", 1998: "den", 2001: "nwe", 2007: "nyg", 2016: "nwe", 2019: "kan", 2023: "kan", 2024: "phi" };
  for (const [y, id] of Object.entries(real)) assert.equal(champ(Number(y)), id, `${y} champion`);
  const sb59 = save.history.superBowls.find((b) => b.year === 2024);
  assert.deepEqual([Math.max(sb59.homeScore, sb59.awayScore), Math.min(sb59.homeScore, sb59.awayScore)], [40, 22]);
});

test("famous regular seasons", () => {
  assert.equal(records[1972].mia, "14-0-0");
  assert.equal(records[1976].tam, "0-14-0");
  assert.equal(records[1985].chi, "15-1-0");
  assert.equal(records[2007].nwe, "16-0-0");
  assert.equal(records[2008].det, "0-16-0");
  assert.equal(records[2017].cle, "0-16-0");
  assert.equal(records[1982].was, "8-1-0"); // the strike year
});

test("real stat lines", () => {
  const line = (f, l, y) => one(f, l, y).stats[y];
  assert.equal(line("Dan", "Marino", 1984).passYds, 5084);
  assert.equal(line("Dan", "Marino", 1984).passTd, 48);
  assert.equal(line("Eric", "Dickerson", 1984).rushYds, 2105);
  assert.equal(line("Tom", "Brady", 2007).passTd, 50);
  assert.equal(line("Peyton", "Manning", 2013).passYds, 5477);
  assert.equal(line("Calvin", "Johnson", 2012).recYds, 1964);
  assert.equal(line("Marvin", "Harrison", 2002).rec, 143);
  assert.equal(line("T.J.", "Watt", 2021).sacks, 22.5);
  assert.equal(line("LaDainian", "Tomlinson", 2006).rushTd, 28);
  // 1970-91 files repeat column names; receptions must come from the Rec column, not Fumbles.
  assert.equal(line("Art", "Monk", 1984).rec, 106);
  assert.equal(line("Dan", "Marino", 1984).rec, 0);
});

test("a stat the record doesn't keep is unknown, not zero", () => {
  // The 1992-98 passing tables carry no completions.
  assert.equal(one("Brett", "Favre", 1995).stats[1995].passCmp, -1);
  assert.ok(one("Brett", "Favre", 2005).stats[2005].passCmp > 0);
});

test("awards, co-winners included", () => {
  const a = (y) => save.history.awards.find((x) => x.year === y);
  const nm = (id) => `${save.players[id].firstName} ${save.players[id].lastName}`;
  assert.equal(nm(a(1984).mvp), "Dan Marino");
  assert.deepEqual([a(1997).mvp, ...(a(1997).co?.mvp ?? [])].map(nm).sort(), ["Barry Sanders", "Brett Favre"]);
  assert.deepEqual([a(2003).mvp, ...(a(2003).co?.mvp ?? [])].map(nm).sort(), ["Peyton Manning", "Steve McNair"]);
  assert.equal(nm(a(2023).mvp), "Lamar Jackson");
  assert.equal(a(1984).coyName, "Chuck Knox");
  const sb = (y) => save.history.superBowls.find((b) => b.year === y);
  assert.equal(sb(1984).mvpName, "Joe Montana");
  assert.equal(sb(1985).mvpName, "Richard Dent");
});

test("draft picks", () => {
  const first = (y) =>
    Object.values(save.players).find((p) => p.draftYear === y && p.draftRound === 1 && p.draftPick === 1 && (y !== 1966 || p.draftTeam === "atl"));
  const nm = (p) => `${p.firstName} ${p.lastName}`;
  assert.equal(nm(first(1983)), "John Elway");
  assert.equal(first(1983).draftTeam, "clt"); // the Baltimore Colts
  assert.equal(nm(first(1998)), "Peyton Manning");
  assert.equal(nm(first(2020)), "Joe Burrow");
  assert.equal(nm(first(1966)), "Tommy Nobis");
});

test("Hall of Fame classes", () => {
  const cls = (y) => save.history.hof.filter((m) => m.year === y).map((m) => (m.playerId ? `${save.players[m.playerId].firstName} ${save.players[m.playerId].lastName}` : m.name));
  for (const n of ["Jerry Rice", "Emmitt Smith"]) assert.ok(cls(2010).includes(n), `${n} in the class of 2010`);
  assert.ok(cls(1993).includes("Walter Payton"));
  assert.ok(cls(2016).includes("Brett Favre"));
});

test("a saved History game replays to the same league", () => {
  const at = midSeason.step;
  assert.ok(at > 0);
  const back = replayHistory(at);
  assert.equal(back.year, 1990);
  assert.deepEqual(historyCursor(back), { realHistory: true, historyStep: at });
  const fresh = replayHistory(at);
  assert.deepEqual(
    Object.fromEntries(Object.entries(back.teams).map(([id, t]) => [id, [t.wins, t.losses, t.ties, t.pf, t.pa]])),
    Object.fromEntries(Object.entries(fresh.teams).map(([id, t]) => [id, [t.wins, t.losses, t.ties, t.pf, t.pa]])),
  );
});

test("the watch bar's skips run through History mode", () => {
  const s = simUntil(createHistoryGame(), (x) => x.year > 1966 && x.phase === "draft");
  assert.equal(s.year, 1967);
  assert.equal(s.history.superBowls.length, 1);
});
