/** The voiced desk segments and the booth's scoreboard calls, read off real game film. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil, nicknameOf } from "../src/lib/game/index.ts";
import { halftimeScript, podiumScript, postgameInterviews } from "../src/lib/game/presentation.ts";
import { boothCall, scoreboard } from "../src/lib/game/commentary.ts";

const save = simUntil(createNewGame({ userTeamId: "chi", startingYear: 1985, seed: 12 }), (x) => x.phase === "regular" && x.week >= 5);
const films = save.schedule.filter((g) => g.played && g.log && g.log.length > 40);

test("the halftime desk reads the real half: score, scoring plays, a hand-off to the analyst", () => {
  assert.ok(films.length > 0, "games with film");
  for (const g of films.slice(0, 4)) {
    const script = halftimeScript(g, g.log);
    assert.ok(script.length >= 3);
    assert.equal(script[0].speaker, "HOST");
    assert.ok(script.some((l) => l.speaker === "ANALYST"));
    const half = g.log.filter((l) => l.q <= 2).at(-1);
    const opener = script[0].text;
    assert.ok(opener.includes(String(half.hs)) && opener.includes(String(half.as)), opener);
    for (const l of script) assert.ok(!/undefined|NaN/.test(l.text), l.text);
  }
});

test("the podium script introduces each guest, then lets him answer in his own words", () => {
  const g = films[0];
  const list = postgameInterviews(save, g);
  const script = podiumScript(save, g);
  assert.equal(script.length, list.length * 2);
  list.forEach((x, k) => {
    assert.equal(script[2 * k].speaker, "REPORTER");
    assert.equal(script[2 * k + 1].speaker, "GUEST");
    assert.equal(script[2 * k + 1].guest, x.who);
    assert.equal(script[2 * k + 1].text, x.quote);
  });
});

test("Super Bowl coaches speak to the title game's story instead of repeating the regular postgame line", () => {
  const base = films[0];
  const scenario = (id, homeScore, awayScore, homeQ, awayQ, homeTo = 0, awayTo = 0) => {
    const g = structuredClone(base);
    Object.assign(g, {
      id,
      phase: "superBowl",
      homeScore,
      awayScore,
      homeQ,
      awayQ,
      homeTo,
      awayTo,
      ot: false,
    });
    return g;
  };
  const games = [
    scenario("sb-close", 27, 24, [7, 7, 7, 6], [3, 10, 7, 4]),
    scenario("sb-comeback", 27, 24, [0, 7, 13, 7], [10, 7, 7, 0]),
    scenario("sb-dominant", 41, 13, [10, 14, 10, 7], [3, 3, 0, 7]),
    scenario("sb-takeaways", 27, 17, [7, 10, 3, 7], [7, 3, 0, 7], 0, 3),
  ];
  const winnerQuotes = games.map((g) => postgameInterviews(save, g)[0].quote);
  const runnerUpQuotes = games.map((g) => postgameInterviews(save, g).at(-1).quote);
  assert.equal(new Set(winnerQuotes).size, games.length, winnerQuotes.join("\n"));
  assert.equal(new Set(runnerUpQuotes).size, games.length, runnerUpQuotes.join("\n"));
  assert.equal(postgameInterviews(save, games[0])[0].quote, winnerQuotes[0], "the same saved game keeps a stable quote");
  assert.match(winnerQuotes[0], /game|clock|yards|championship|play|possession/i);
  assert.match(runnerUpQuotes[1], /behind|deficit|lead|half|adjustments/i);
});

test("after every score the booth gives the scoreboard, and it is right", () => {
  let calls = 0;
  for (const g of films) {
    const ctx = { nick: (id) => nicknameOf(g.year, id), homeId: g.homeId, awayId: g.awayId, pbpFirst: "Al", colorFirst: "John", colorBackground: "former coach" };
    g.log.forEach((p, k) => {
      const prev = g.log[k - 1];
      if (!prev || (prev.hs === p.hs && prev.as === p.as)) return;
      const tag = scoreboard(p, k, { ...ctx, prev });
      assert.ok(tag, `a scoreboard line after ${p.text}`);
      calls += 1;
      if (p.hs === p.as) assert.match(tag, new RegExp(String(p.hs)));
      else if (/\d+ to \d+/.test(tag)) assert.ok(tag.includes(`${Math.max(p.hs, p.as)} to ${Math.min(p.hs, p.as)}`), tag);
      const lines = boothCall(p, k, { ...ctx, prev });
      assert.ok(lines.some((l) => l.speaker === "PBP" && l.text.includes(tag)), "the play-by-play carries it");
    });
  }
  assert.ok(calls > 5, `${calls} scoring calls`);
});
