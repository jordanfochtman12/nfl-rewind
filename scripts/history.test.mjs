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
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  advanceHistory,
  createHistoryGame,
  historyCursor,
  loadHistoryData,
  replayHistory,
  simUntil,
  setHistoryData,
  callsReport,
  franchiseLedger,
  historyRecords,
  seriesBetween,
  HISTORY_LAST,
} from "../src/lib/game/index.ts";

let save;
const records = {};
const midSeason = {};
/** Every "Record:" headline, with the season and week it ran. */
const recordNews = [];

before(async () => {
  setHistoryData(await loadHistoryData());
  save = createHistoryGame();
  // A few calls, made before the results, to check they're graded.
  save.historyCalls = { "sb:1985": "chi", "sb:1986": "den", "mvp:1984": "", "1966-w1-mia-rai": "rai" };
  while (save.phase !== "complete") {
    const { year, phase } = save;
    const top = save.news[0]?.id;
    advanceHistory(save);
    for (const n of save.news) {
      if (n.id === top) break;
      if (n.headline.startsWith("Record:")) recordNews.push({ year, week: n.phase === "regular" ? n.week : 99, headline: n.headline });
    }
    if (phase === "regular" && save.phase === "playoffs")
      records[year] = Object.fromEntries(Object.entries(save.teams).map(([id, t]) => [id, `${t.wins}-${t.losses}-${t.ties}`]));
    if (year === 1990 && phase === "regular" && save.week === 9) midSeason.step = save.historyStep;
    if (year === 2007 && phase === "regular" && save.phase === "playoffs") midSeason.atl2007 = save.teams.atl.coachId;
    if (year === 2010 && phase === "regular" && save.phase === "playoffs") {
      const lynch = Object.values(save.players).find((p) => p.firstName === "Marshawn" && p.lastName === "Lynch");
      midSeason.lynch2010 = lynch?.teamId;
      midSeason.lynchTx = save.transactions.find((t) => t.playerId === lynch?.id && t.kind === "trade");
    }
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
  // The official line from 1999 on, not the play-by-play sum (5,535).
  assert.equal(line("Drew", "Brees", 2011).passYds, 5476);
  assert.equal(line("Marvin", "Harrison", 2002).rec, 143);
  assert.equal(line("T.J.", "Watt", 2021).sacks, 22.5);
  assert.equal(line("LaDainian", "Tomlinson", 2006).rushTd, 28);
  // 1970-91 files repeat column names; receptions must come from the Rec column, not Fumbles.
  assert.equal(line("Art", "Monk", 1984).rec, 106);
  assert.equal(line("Dan", "Marino", 1984).rec, 0);
});

test("a stat the record doesn't keep is unknown, not zero", () => {
  // Tackles and forced fumbles aren't in the record before 1999.
  const blount = one("Mel", "Blount", 1975).stats[1975];
  assert.ok(blount.unknown?.includes("tackles"));
  assert.ok(blount.unknown?.includes("ff"));
  const lewis = one("Ray", "Lewis", 2003).stats[2003];
  assert.ok(lewis.unknown?.includes("pts"), "the historical source does not retain every scoring method");
  assert.ok(lewis.unknown?.includes("defTd"));
  assert.ok(!lewis.unknown?.includes("tackles"), "tackle totals are recorded in this era");
});

test("pre-1999 lines from the team-season archive: 1966-69 offense, defense, kicking, returns", () => {
  const line = (f, l, y) => one(f, l, y).stats[y];
  assert.equal(line("Joe", "Namath", 1967).passYds, 4007);
  assert.equal(line("Bart", "Starr", 1966).passCmp, 156);
  assert.equal(line("Bart", "Starr", 1966).gp, 14);
  assert.equal(line("Jim", "Nance", 1966).rushYds, 1458);
  assert.equal(line("O.J.", "Simpson", 1975).rushYds, 1817);
  assert.equal(line("Mel", "Blount", 1975).ints, 11);
  assert.equal(line("Jan", "Stenerud", 1975).fgMade, 22);
  // Completions for 1992-98 now come from the archive, not left unknown.
  assert.ok(line("Brett", "Favre", 1995).passCmp > 0);
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

test("real head coaches: careers, midseason changes, honors", () => {
  const c = (name) => Object.values(save.coaches).find((x) => x.name === name);
  // Belichick's whole head-coaching career is inside the record: 302-165 in the regular season.
  assert.equal(`${c("Bill Belichick").careerWins}-${c("Bill Belichick").careerLosses}`, "302-165");
  assert.equal(c("Bill Belichick").careerTitles, 6);
  assert.ok(c("Bill Belichick").coyYears.includes(2003));
  // Atlanta, 2007: Bobby Petrino quit in December; Emmitt Thomas finished the season.
  assert.equal(save.coaches[midSeason.atl2007].name, "Emmitt Thomas");
  assert.equal(c("Tom Landry").hofYear, 1990);
  assert.ok(save.history.hof.some((m) => m.coachId === c("Chuck Noll").id && m.year === 1993));
});

test("real trades move players midseason", () => {
  // Marshawn Lynch, traded from Buffalo to Seattle in October 2010.
  assert.equal(midSeason.lynch2010, "sea");
  assert.equal(midSeason.lynchTx?.from, "buf");
  assert.equal(midSeason.lynchTx?.to, "sea");
});

test("History mode stays out of the regular game", () => {
  // The same seeded dynasty, played with and without History mode's tables loaded, must come
  // out identical: nothing History mode adds may reach the regular game's sim.
  const index = fileURLToPath(new URL("../src/lib/game/index.ts", import.meta.url));
  const run = (load) =>
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--input-type=module",
        "-e",
        `const G = await import(${JSON.stringify(pathToFileURL(index).href)});
         if (${load}) G.setHistoryData(await G.loadHistoryData());
         const s0 = G.createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 4242 });
         s0.cpuOnly = true;
         const s = G.simUntil(s0, (x) => x.year >= 1968 && x.phase === "draft");
         if (s.realHistory) throw new Error("a regular game turned into History mode");
         const p = Object.values(s.players).sort((a, b) => a.id.localeCompare(b.id));
         console.log(JSON.stringify({
           teams: Object.entries(s.teams).map(([id, t]) => [id, t.wins, t.losses, t.ties, t.pf, t.pa]),
           bowls: s.history.superBowls, awards: s.history.awards,
           players: p.length, lines: p.slice(0, 400).map((x) => [x.id, x.ovr, JSON.stringify(x.stats)]),
         }));`,
      ],
      { encoding: "utf8", maxBuffer: 1 << 28 },
    );
  const plain = run(false);
  assert.ok(plain.length > 1000);
  assert.equal(run(true), plain);
});

test("the all-time records fell when they really fell", () => {
  const fell = (re) => recordNews.find((n) => re.test(n.headline));
  // Walter Payton passed Jim Brown on October 7, 1984, the sixth week of the season.
  const payton = fell(/Walter Payton passes Jim Brown for the most career rushing yards/);
  assert.equal(payton?.year, 1984);
  assert.equal(payton?.week, 6);
  assert.equal(fell(/Eric Dickerson has the most rushing yards ever in a season/)?.year, 1984);
  assert.equal(fell(/O\.J\. Simpson has the most rushing yards ever in a season/)?.year, 1973);
  assert.equal(fell(/Dan Marino has the most touchdown passes ever in a season/)?.year, 1984);
  assert.equal(fell(/Emmitt Smith passes Walter Payton/)?.year, 2002);
  assert.equal(fell(/Jerry Rice passes/)?.year !== undefined, true);
  // Where the book stands at the end of the record.
  const book = Object.fromEntries(historyRecords(save).map((r) => [`${r.stat}:${r.scope}`, `${r.holder} ${r.value}`]));
  assert.equal(book["rushYds:season"], "Eric Dickerson 2105");
  assert.equal(book["passTd:season"], "Peyton Manning 55");
  assert.equal(book["recTd:season"], "Randy Moss 23");
  assert.equal(book["rushYds:career"], "Emmitt Smith 18355");
  assert.equal(book["recYds:career"], "Jerry Rice 22895");
  assert.equal(book["sacks:career"], "Bruce Smith 200");
  assert.equal(book["ints:career"], "Paul Krause 81");
  assert.equal(book["ints:season"].startsWith('Dick "Night Train" Lane 14'), true);
});

test("franchise ledgers and series run back to 1920", () => {
  const titles = (id) => franchiseLedger(save, id).titles;
  // League championships: the NFL's and AFL's through 1969, the Super Bowl after.
  assert.equal(titles("gnb").length, 13);
  assert.deepEqual(titles("gnb").slice(-4), [1966, 1967, 1996, 2010]);
  assert.equal(titles("chi").length, 9);
  assert.equal(titles("pit").length, 6);
  assert.deepEqual(titles("kan").filter((y) => y < 1970), [1962, 1966, 1969]);
  const s = seriesBetween(save, "gnb", "chi");
  assert.ok(s.wins + s.losses + s.ties > 200, `${s.wins}-${s.losses}-${s.ties}`);
  assert.ok(s.wins > s.losses, "the Packers lead the series");
});

test("calls are graded against what really happened", () => {
  const g = save.historyGraded;
  assert.deepEqual(g["sb:1985"], [1985, 1]);
  assert.deepEqual(g["sb:1986"], [1986, 0]);
  assert.deepEqual(g["1966-w1-mia-rai"], [1966, 1]);
  assert.equal(callsReport(save).made, 3);
});

test("every real game has its box score, and the box score has the real final", async () => {
  const { REAL_SCHEDULES } = await import("../src/lib/game/data/realSchedules.ts");
  const { loadBoxSeason } = await import("../src/lib/game/index.ts");
  let games = 0;
  let missing = 0;
  for (let y = 1966; y <= HISTORY_LAST; y++) {
    const boxes = await loadBoxSeason(y);
    assert.ok(boxes?.length, `no box scores for ${y}`);
    const by = new Map(boxes.map((b) => [`${b.h}|${b.a}|${b.d}`, b]));
    for (const row of REAL_SCHEDULES[y].split("|")) {
      const [, home, away, hs, as, mmdd] = row.split(",");
      if (Number(hs) < 0) continue;
      games += 1;
      const b = by.get(`${home}|${away}|${mmdd}`) ?? by.get(`${away}|${home}|${mmdd}`);
      if (!b) {
        missing += 1;
        continue;
      }
      const [bh, ba] = b.h === home ? [b.f[1], b.f[0]] : [b.f[0], b.f[1]];
      assert.deepEqual([bh, ba], [Number(hs), Number(as)], `${y} ${away} at ${home} ${mmdd}`);
    }
  }
  assert.ok(missing / games < 0.01, `${missing} of ${games} games have no box score`);
});
