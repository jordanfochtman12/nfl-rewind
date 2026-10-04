import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame } from "../src/lib/game/createGame.ts";
import { makeDraftPick, draftQueue, transferPick } from "../src/lib/game/draft.ts";
import {
  draftAudioSnapshot,
  draftAnnouncement,
  draftAnnouncementParts,
  announceDraftPick,
  draftCrowdReaction,
  draftDeskTake,
  draftOnClock,
} from "../src/lib/game/draftAnnouncement.ts";
import { footballSpeech, footballPosition } from "../src/lib/game/footballSpeech.ts";
import { draftScoreStep, DRAFT_BPM } from "../src/components/game/draftScore.ts";
import { SKILL_POSITIONS } from "../src/lib/game/types.ts";

const game = () => createNewGame({ userTeamId: "atl", startingYear: 1966, seed: 79 });
const selection = (id, pick, extra = {}) => ({
  id,
  name: "Test Prospect",
  pos: "QB",
  college: "Pittsburgh",
  team: "pit",
  pick,
  round: 1,
  session: "nfl",
  ...extra,
});
const snapshot = (extra = {}) => ({
  year: 1966,
  session: "nfl",
  drafting: true,
  onClock: "pit",
  nextPick: 1,
  selections: [],
  prospects: [],
  starters: {},
  ...extra,
});

test("a real pick announces its actual slot, full position, college, and next club", () => {
  const s = game();
  const rng = s.rng;
  const before = draftAudioSnapshot(s);
  const chosen = before.prospects.toSorted((a, b) => b.grade - a.grade)[0];
  assert.equal(before.selections.length, 0);
  assert.equal(s.rng, rng);
  makeDraftPick(s, chosen.id);
  const after = draftAudioSnapshot(s),
    line = draftAnnouncement(before, after);
  assert.match(
    line,
    /With the 1st pick in the 1966 NFL draft, the Atlanta Falcons select Tom Mack, left guard, from Michigan/,
  );
  assert.match(line, /Los Angeles Rams/);
  assert.equal(footballSpeech(line, 1966), line);
  assert.equal(draftCrowdReaction(before, after).kind, "applause");
});
test("traded picks name the actual owner rather than the original team", () => {
  const s = game();
  transferPick(s, draftQueue(s)[0].id, "pit");
  const before = draftAudioSnapshot(s);
  makeDraftPick(s, before.prospects[0].id);
  assert.match(draftAnnouncement(before, draftAudioSnapshot(s)), /Pittsburgh Steelers select/);
});
test("board rank never becomes pick number and a clear reach draws boos", () => {
  const s = game(),
    before = draftAudioSnapshot(s);
  const worst = before.prospects.toSorted((a, b) => a.grade - b.grade)[0];
  makeDraftPick(s, worst.id);
  const after = draftAudioSnapshot(s);
  assert.match(draftAnnouncement(before, after), /With the 1st pick/);
  assert.equal(draftCrowdReaction(before, after).kind, "boos");
});
test("all draft positions are full words, including single-letter roles", () => {
  for (const pos of SKILL_POSITIONS) {
    assert.notEqual(footballPosition(pos), pos);
    assert.ok(announceDraftPick(selection("x", 21, { pos }), 1966).includes(footballPosition(pos)));
  }
  assert.match(
    announceDraftPick(selection("x", 11, { college: undefined, pos: "K" }), 1966),
    /11th pick/,
  );
  assert.doesNotMatch(
    announceDraftPick(selection("x", 11, { college: undefined }), 1966),
    /undefined|from Campus/,
  );
});
test("unchanged saves and a new year do not replay a selection", () => {
  const s = snapshot({ selections: [selection("one", 1)] });
  assert.equal(draftAnnouncement(s, s), null);
  assert.equal(draftCrowdReaction(s, s), null);
  assert.equal(draftAnnouncement(s, { ...s, year: 1967 }), null);
});
test("fast-forward summarizes the batch and finishes the draft without queuing every pick", () => {
  const before = snapshot(),
    after = snapshot({
      drafting: false,
      onClock: undefined,
      selections: [selection("one", 1), selection("two", 2)],
    });
  const line = draftAnnouncement(before, after);
  assert.match(line, /Catching up after 2 selections/);
  assert.equal((line.match(/select Test Prospect/g) ?? []).length, 1);
  assert.match(line, /With the 2nd pick/);
  assert.match(line, /That concludes the 1966 NFL draft/);
  assert.equal(draftCrowdReaction(before, after).kind, "murmur");
});
test("1966 NFL and AFL pick numbers remain separate at the transition", () => {
  const before = snapshot({ nextPick: 300 });
  const after = snapshot({
    session: "afl",
    onClock: "mia",
    selections: [selection("last-nfl", 300, { round: 20 })],
  });
  const line = draftAnnouncement(before, after);
  assert.match(line, /300th pick in the 1966 NFL draft/);
  assert.match(line, /We now move to the AFL draft/);
  assert.match(line, /Miami Dolphins are on the clock with pick number 1/);
  const batch = {
    ...after,
    selections: [...after.selections, selection("afl-first", 1, { session: "afl", team: "mia" })],
    nextPick: 2,
  };
  assert.match(draftAnnouncement(before, batch), /1st pick in the 1966 AFL draft/);
});
test("crowd opinion uses pre-pick scouting and positional need, not hidden future ratings", () => {
  const base = snapshot({
    prospects: [
      { id: "best", grade: 86, pos: "QB" },
      { id: "pick", grade: 80, pos: "QB" },
    ],
    starters: { pit: { QB: 90 } },
  });
  const after = snapshot({ selections: [selection("pick", 1)] });
  assert.equal(draftCrowdReaction(base, after).kind, "murmur");
  assert.equal(
    draftCrowdReaction({ ...base, starters: { pit: { QB: 60 } } }, after).kind,
    "applause",
  );
  const s = game(),
    candidate = s.players[s.draftBoard[0].playerId];
  candidate.revealed = false;
  candidate.scoutOvr = 75;
  candidate.ovr = 99;
  candidate.potential = 99;
  const a = draftAudioSnapshot(s).prospects.find((p) => p.id === candidate.id);
  candidate.ovr = 40;
  candidate.potential = 40;
  const b = draftAudioSnapshot(s).prospects.find((p) => p.id === candidate.id);
  assert.deepEqual(a, b);
});

test("the podium and next-team call are separate so the crowd fits between them", () => {
  const before = snapshot(),
    after = snapshot({ selections: [selection("one", 1)], onClock: "ram", nextPick: 2 });
  const parts = draftAnnouncementParts(before, after);
  assert.match(parts.podium, /Pittsburgh Steelers select Test Prospect, quarterback/);
  assert.doesNotMatch(parts.podium, /on the clock/);
  assert.match(parts.onClock, /Los Angeles Rams/);
  assert.match(parts.onClock, /clock|up next/);
  assert.ok(parts.desk && parts.desk.length > 10);
  assert.equal(draftAnnouncement(before, after), parts.podium + " " + parts.onClock);
});
test("the draft music has four sections and a seamless bounded score", () => {
  assert.ok(DRAFT_BPM >= 90 && DRAFT_BPM <= 120);
  const steps = Array.from({ length: 256 }, (_, i) => draftScoreStep(i));
  assert.equal(new Set(steps.map((s) => s.section)).size, 4);
  assert.deepEqual(draftScoreStep(256), draftScoreStep(0));
  for (const s of steps) {
    assert.ok(s.chord.every((n) => Number.isFinite(n) && n >= 24 && n <= 96));
    assert.ok(s.melody === null || (Number.isFinite(s.melody) && s.melody >= 48 && s.melody <= 96));
  }
  assert.notDeepEqual(
    steps.slice(0, 16).map((s) => s.melody),
    steps.slice(192, 208).map((s) => s.melody),
  );
});

test("round one keeps the commissioner's formula; later rounds and the desk don't repeat back to back", () => {
  const first = announceDraftPick(selection("x", 5), 1980);
  assert.match(first, /^With the 5th pick in the 1980 NFL draft, the .+ select Test Prospect/);
  assert.doesNotMatch(first, /Round 1, pick number/);
  const later = Array.from({ length: 12 }, (_, i) => announceDraftPick(selection(`p${i}`, 60 + i, { round: 3 }), 1980).replace(/\d+(st|nd|rd|th)?/g, "#").split(" ").slice(0, 3).join(" "));
  for (let i = 1; i < later.length; i++) assert.notEqual(later[i], later[i - 1]);
  const takes = Array.from({ length: 6 }, (_, i) => draftDeskTake(selection(`d${i}`, 10 + i), { kind: "murmur", label: "", reason: "" }, 1980));
  assert.equal(new Set(takes).size, takes.length);
  const clocks = Array.from({ length: 5 }, (_, i) => draftOnClock(snapshot({ onClock: "ram", nextPick: 30 + i })).replace(/\d+/g, "#"));
  assert.equal(new Set(clocks).size, 5);
});
