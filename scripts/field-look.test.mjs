/** The broadcast field as it really looked: surface, hashes, posts, end zones, ballparks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldLook } from "../src/lib/game/fieldLook.ts";

test("rule-book geometry follows the year", () => {
  assert.equal(fieldLook(1967, "gnb", "dal").hashFromSideline, 20); // NFL hashes before 1972
  assert.ok(Math.abs(fieldLook(1969, "kan", "rai").hashFromSideline - 17.78) < 0.01); // AFL: college hashes
  assert.ok(fieldLook(1972, "gnb", "chi").hashFromSideline > 23.5); // goal-post width from 1972
  assert.equal(fieldLook(1973, "gnb", "chi").postsAt, "goal");
  assert.equal(fieldLook(1974, "gnb", "chi").postsAt, "end");
  assert.equal(fieldLook(1966, "gnb", "chi").postStyle, "h");
  assert.equal(fieldLook(1967, "gnb", "chi").postStyle, "slingshot");
});

test("surfaces and shared ballparks are the real ones", () => {
  assert.equal(fieldLook(1967, "gnb", "dal").surface, "grass");
  assert.equal(fieldLook(1975, "pit", "oti").surface, "astroturf");
  assert.equal(fieldLook(1975, "pit", "oti").dirt, "cutouts");
  assert.equal(fieldLook(1994, "dal", "sfo").surface, "astroturf"); // Texas Stadium
  assert.equal(fieldLook(1985, "chi", "nyg").surface, "astroturf"); // Soldier Field 1971-87
  assert.equal(fieldLook(1990, "chi", "nyg").surface, "grass");
  assert.equal(fieldLook(2010, "htx", "dal").surface, "grass"); // NRG's grass trays
  assert.equal(fieldLook(2007, "nwe", "clt").surface, "fieldturf");
  assert.equal(fieldLook(1975, "rai", "kan").dirt, "infield"); // the Coliseum
  assert.equal(fieldLook(1985, "rai", "kan").dirt, undefined); // the Raiders were in L.A.
});

test("end zones and the midfield mark", () => {
  const ice = fieldLook(1967, "gnb", "dal");
  assert.equal(ice.left.text, "GREEN BAY");
  assert.equal(ice.right.text, "PACKERS");
  assert.equal(ice.right.style, "plain");
  assert.equal(ice.midfield, undefined);
  assert.equal(fieldLook(1972, "mia", "nyj").right.style, "stripes"); // the Orange Bowl
  assert.equal(fieldLook(1994, "dal", "sfo").right.style, "solid");
  assert.match(fieldLook(2019, "kan", "rav").midfield, /^\/logos\/field\//);
  const sb = fieldLook(2019, "kan", "sfo", { neutral: true });
  assert.equal(sb.left.text, "49ERS");
  assert.equal(sb.midfield, undefined);
  assert.equal(fieldLook(1967, "gnb", "dal", { weather: "snow", week: 15 }).snow, true);
  assert.equal(fieldLook(1980, "det", "gnb", { weather: "snow" }).snow, false); // under the Silverdome roof
});
