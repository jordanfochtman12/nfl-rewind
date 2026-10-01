import { test } from "node:test";
import assert from "node:assert/strict";
import { footballSpeech } from "../src/lib/game/footballSpeech.ts";
import { TEAM_META, locationOf, setHomeOverride } from "../src/lib/game/teams.ts";

const speak = (text, year = 1966) => footballSpeech(text, year);
test("team and position are spoken naturally without changing the player's name", () => {
  assert.equal(speak("PIT QB Bill Nelsen"), "Pittsburgh quarterback Bill Nelsen");
  assert.equal(
    speak("Bill Nelsen (PIT QB) — 22/31, 280 yds, 2 TD, 1 INT"),
    "Bill Nelsen, Pittsburgh quarterback, 22 completions on 31 attempts, 280 yards, 2 touchdowns, 1 interception",
  );
  for (const t of Object.values(TEAM_META))
    assert.equal(speak(`${t.abbr} QB`), `${locationOf(1966, t.id)} quarterback`);
});
test("archived commentary uses the episode's era and honors relocated clubs", () => {
  assert.equal(speak("CLT QB and NWE WR"), "Baltimore quarterback and Boston wide receiver");
  assert.equal(
    speak("CLT QB and NWE WR", 2024),
    "Indianapolis quarterback and New England wide receiver",
  );
  assert.equal(speak("RAI K", 1985), "Los Angeles kicker");
  assert.equal(speak("RAI K", 2024), "Las Vegas kicker");
  setHomeOverride({ teamId: "pit", from: 2020, city: "Portland" });
  try {
    assert.equal(speak("PIT QB", 2024), "Portland quarterback");
  } finally {
    setHomeOverride(undefined);
  }
});
test("rushing, receiving, and cumulative career totals use football language", () => {
  assert.equal(
    speak("12-85 rushing, 1 rush TD; 5-90 receiving, 2 TD"),
    "12 carries for 85 rushing yards, 1 rushing touchdown; 5 receptions for 90 receiving yards, 2 touchdowns",
  );
  assert.equal(
    speak("15,420 rush yds · 101 TD · 421 rec"),
    "15,420 rushing yards, 101 touchdowns, 421 receptions",
  );
  assert.equal(speak("3--2 receiving"), "3 receptions for -2 receiving yards");
});
test("defense, kicking, and punting statistics are expanded", () => {
  assert.equal(
    speak("1 INT, 2 FF, 1 FR, 3 TFL, 2 PD, 4 SK, 10 TKL"),
    "1 interception, 2 forced fumbles, 1 fumble recovery, 3 tackles for loss, 2 passes defended, 4 sacks, 10 tackles",
  );
  assert.equal(
    speak("FG 24/30 · XP 38/39 · 110 pts"),
    "24 of 30 field goals, 38 of 39 extra points, 110 points",
  );
  assert.equal(
    speak("44.3 AVG, 39.1 NET, 4 TB, 10 IN20"),
    "44.3 average, 39.1 net yards, 4 touchbacks, 10 punts inside the twenty",
  );
});
test("labels, percentages and efficiency stats are readable", () => {
  assert.equal(
    speak("CMP/ATT 22/31, YDS: 280, TD 2, INT 0"),
    "22 completions on 31 attempts, 280 yards, 2 touchdowns, 0 interceptions",
  );
  assert.equal(
    speak("67.5%, 4.2 YPC, 8.1 YPA, 12.6 YPR, 98.4 RTG"),
    "67.5 percent, 4.2 yards per carry, 8.1 yards per attempt, 12.6 yards per reception, 98.4 passer rating",
  );
});
test("ordinary words, names, records and dates survive normalization", () => {
  const text =
    "J. P. Smith and C. J. Stroud face Pittsburgh. No turnovers. A 10-2 record in 2024. 9/30. OT begins.";
  assert.equal(speak(text), text);
  assert.equal(
    speak("Q4: 1 yd, 0 yds, 1 TD, 0 INT"),
    "fourth quarter: 1 yard, 0 yards, 1 touchdown, 0 interceptions",
  );
  assert.equal(speak(speak("PIT QB: 22/31, 280 yds, 2 TD")), speak("PIT QB: 22/31, 280 yds, 2 TD"));
});

test("kicking percentages are not confused with made field goals and plural labels expand", () => {
  assert.equal(
    speak("FG% 80.0, XP 97.5%, CMP% 67.5"),
    "field goal percentage, 80.0 percent, extra point percentage, 97.5 percent, completion percentage, 67.5 percent",
  );
  assert.equal(speak("2 TDs, 3 INTs, 4 FGs"), "2 touchdowns, 3 interceptions, 4 field goals");
});
