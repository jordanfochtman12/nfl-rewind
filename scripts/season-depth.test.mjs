/**
 * Season depth: the systems around the games. Morale and chemistry, the booth's memory and
 * its live milestone calls, the season's storylines in the studio, careers ranked and
 * compared, the draft room (fit, ranges, counter-offers, was the crowd right), and the
 * postgame podium. Regular game only; History mode never runs any of it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil, simGame } from "../src/lib/game/index.ts";
import { chemistryEdge, chemistryOf, moraleLabel, moraleTarget, updateMorale } from "../src/lib/game/morale.ts";
import { gameWatches, leagueMarks, liveMarkCall, pregameMemory } from "../src/lib/game/boothMemory.ts";
import { teamStyle } from "../src/lib/game/teamStyle.ts";
import { seasonArcList } from "../src/lib/game/arcs.ts";
import { careerRanks, comparePlayers } from "../src/lib/game/careerBook.ts";
import { counterOffer, crowdVerdicts, gradeRange, positionalNeeds, schemeFit } from "../src/lib/game/draftFit.ts";
import { halftimeReport, postgameInterviews } from "../src/lib/game/presentation.ts";
import { draftPickValue } from "../src/lib/game/draftTrades.ts";
import { allPicks } from "../src/lib/game/draft.ts";
import { rosterOf } from "../src/lib/game/players.ts";

const fresh = () => createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 77 });

test("morale drifts toward a player's situation and chemistry stays a small, bounded edge", () => {
  const s = simUntil(fresh(), (x) => x.phase === "regular" && x.week >= 6);
  for (let k = 0; k < 3; k++) updateMorale(s);
  for (const id of ["pit", "gnb", "nyg"]) {
    const c = chemistryOf(s, id);
    assert.ok(c.value >= 0 && c.value <= 100);
    assert.ok(Math.abs(chemistryEdge(s, id)) <= 1.2);
    for (const p of rosterOf(s, id)) assert.ok(p.morale >= 0 && p.morale <= 100, `${p.id} morale ${p.morale}`);
  }
  const p = rosterOf(s, "pit")[0];
  const { target, reasons } = moraleTarget(s, p);
  assert.ok(target >= 5 && target <= 98);
  assert.ok(Array.isArray(reasons));
  assert.equal(moraleLabel(20).label, "Wants out");
  assert.equal(moraleLabel(90).label, "Fired up");
});

test("the booth remembers: series, identities, and a live call when a career milestone falls", () => {
  const s = simUntil(fresh(), (x) => x.phase === "regular" && x.week >= 5);
  const g = s.schedule.find((x) => x.week === s.week && (x.homeId === "pit" || x.awayId === "pit")) ?? s.schedule.find((x) => x.week === s.week);
  const notes = pregameMemory(s, g);
  assert.ok(Array.isArray(notes));
  for (const n of notes) assert.ok(n.text.length > 10);
  const style = teamStyle(s, g.homeId);
  assert.ok(style.offense && style.defense && style.line);
  // A made-up watch: 9,955 career rushing yards coming in, 40 so far today.
  const w = { playerId: rosterOf(s, "pit")[0].id, teamId: "pit", career: { rushYds: 9955 }, season: { rushYds: 300 } };
  const marks = { season: { rushYds: 99999 }, game: { rushYds: 9999 }, career: { rushYds: { value: 99999, playerId: "nobody", second: 0 } } };
  const call = liveMarkCall(s, w, "rushYds", 40, 48, marks);
  assert.equal(call?.kind, "milestone");
  assert.match(call.text, /10,000 career rushing yards/);
  assert.equal(liveMarkCall(s, w, "rushYds", 40, 44, marks), undefined);
  assert.ok(gameWatches(s, g).length > 20);
  assert.ok(Object.keys(leagueMarks(s).season).length >= 9);
});

test("the owner's broadcast carries storylines, drive summaries and a podium grounded in the box score", () => {
  const s = simUntil(fresh(), (x) => x.phase === "regular" && x.week >= 3);
  const g = s.schedule.find((x) => x.week === s.week && (x.homeId === "pit" || x.awayId === "pit"));
  if (!g) return; // a bye week: nothing to broadcast
  simGame(s, g);
  assert.ok(g.log.some((l) => l.cue === "story" || l.cue === "drive"), "no storyline or drive cue on the broadcast");
  const drives = g.log.filter((l) => /That drive: \d+ plays, -?\d+ yards, \d+:\d\d/.test(l.text));
  assert.ok(drives.length >= 1);
  const ht = halftimeReport(g, g.log);
  assert.ok(ht && ht.score && ht.secondHalf);
  const pod = postgameInterviews(s, g);
  assert.ok(pod.length >= 2);
  for (const x of pod) assert.ok(x.quote.length > 10 && x.who);
});

test("the studio follows season-long storylines and they carry their history", () => {
  let s = fresh();
  s = simUntil(s, (x) => x.week >= 12 || x.phase === "playoffs");
  const arcs = seasonArcList(s);
  assert.ok(arcs.length >= 1, "no season storylines opened by week 12");
  for (const a of arcs) {
    assert.ok(a.beats.length >= 1 && a.opened >= 3);
    for (const b of a.beats) assert.ok(b.text && b.short);
  }
});

test("careers rank and compare, regular season and playoffs apart", () => {
  const s = simUntil(fresh(), (x) => x.year >= 1968);
  const qbs = Object.values(s.players).filter((p) => p.pos === "QB" && (p.stats[1967]?.passYds ?? 0) > 1500).slice(0, 2);
  assert.equal(qbs.length, 2);
  const ranks = careerRanks(s, qbs[0]);
  for (const r of ranks) assert.ok(r.rank >= 1 && r.rank <= 50 && r.value > 0);
  const cmp = comparePlayers(s, qbs[0], qbs[1]);
  const titles = cmp.sections.map((x) => x.title);
  assert.ok(titles.includes("Career") && titles.includes("Honors"));
  const pass = cmp.sections[0].rows.find((r) => r.label === "Passing yards");
  assert.ok(pass && pass.a > 0 && pass.b > 0);
});

test("the draft room: fit, a grade range, real needs, a counter that never breaks the chart, the crowd remembered", () => {
  const s = simUntil(fresh(), (x) => x.phase === "draft" && x.year === 1967);
  const prospect = s.players[s.draftBoard.find((p) => !p.taken).playerId];
  const fit = schemeFit(s, "pit", prospect);
  assert.ok(["Ideal fit", "Good fit", "Neutral", "Poor fit"].includes(fit.label));
  const r = gradeRange(s, prospect);
  assert.ok(r.lo <= r.grade && r.grade <= r.hi);
  assert.ok(positionalNeeds(s, "pit").length >= 1);
  // A deal for a pick: a counter can only add value up to 12% over what the owner gives.
  const mine = allPicks(s).find((p) => p.owner === "pit" && !p.used && p.year === s.year);
  const theirs = allPicks(s).find((p) => p.owner === "gnb" && !p.used && p.year === s.year);
  const give = draftPickValue(s, mine);
  const deal = { partner: "gnb", give: [mine], get: [theirs], giveValue: give, getValue: draftPickValue(s, theirs), pitch: "test" };
  const c = counterOffer(s, deal);
  if (c.deal) assert.ok(c.deal.getValue <= give * 1.12 + 1e-6);
  else assert.match(c.reply, /won't go any higher/);
  // Picks carry the room's reaction; verdicts read it against a re-draft.
  const s2 = simUntil(s, (x) => x.phase !== "draft");
  const early = Object.values(s2.players).filter((p) => p.draftYear === 1967 && p.draftRound === 1);
  assert.ok(early.every((p) => p.draftBuzz), "first-round picks should carry the room's reaction");
  const v = crowdVerdicts(s2, early.map((p) => ({ playerId: p.id, pick: p.draftPick, reRank: 100 })));
  for (const x of v) assert.ok(x.text.length > 10);
});
