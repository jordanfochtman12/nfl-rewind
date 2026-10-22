import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame } from "../src/lib/game/createGame.ts";
import { buildPrimetime } from "../src/lib/game/primetime.ts";
import { produceEpisode } from "../src/lib/game/studio.ts";
import { calculateAwards } from "../src/lib/game/events.ts";
import { hydrateSave } from "../src/lib/game/save.ts";
import { scoreStep, NETWORK_BPM } from "../src/components/game/studioScore.ts";
import { advance } from "../src/lib/game/season.ts";
import { superBowlSite } from "../src/lib/game/data/bowlSites.ts";

test("Super Bowl host sites use the season year and never cycle through future stadiums", () => {
  assert.equal(superBowlSite(1981).site, "Pontiac Silverdome");
  assert.equal(superBowlSite(2005).site, "Ford Field");
  assert.equal(superBowlSite(2024).site, "Caesars Superdome");
  assert.equal(superBowlSite(2026).site, "SoFi Stadium");
  assert.equal(superBowlSite(2027).city, "Atlanta");
  for (let year = 1966; year <= 2027; year++) assert.notEqual(superBowlSite(year).city, "TBD");
});

test("a complete season produces a finale, each playoff show, a factual Super Bowl preview and celebration", () => {
  let s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 39 });
  s.cpuOnly = true;
  for (let i = 0; i < 80 && s.phase !== "awards"; i++) s = advance(s, { auto: true });
  assert.equal(s.phase, "awards");
  const all = [...(s.primetimeArchive ?? []), s.primetime];
  const finale = all.find((x) => x.episode?.edition === "seasonFinale");
  assert.ok(finale, "regular-season finale exists");
  // 1966 had an MVP and a single Rookie of the Year; the position awards came in 1971-72.
  const labels = finale.awards.map((a) => a.label);
  assert.ok(labels.includes("Most Valuable Player"), labels.join(", "));
  assert.ok(labels.includes("Rookie of the Year"), labels.join(", "));
  assert.ok(!labels.includes("Offensive Player of the Year") && !labels.includes("Defensive Player of the Year"), labels.join(", "));
  assert.ok(finale.previews.length >= 2);
  assert.match(finale.episode.chapters.map((c) => c.title).join(" "), /Most Valuable Player/);
  const championship = all.find((x) => x.episode?.edition === "championship");
  assert.ok(championship);
  const script = championship.episode.chapters.flatMap((c) => c.lines.map((l) => l.text)).join(" ");
  assert.match(script, /Los Angeles Memorial Coliseum/);
  assert.match(script, /Neutral field/);
  assert.ok(championship.episode.chapters.some((c) => c.id === "sb-verdict"));
  assert.equal(championship.episode.chapters.filter((c) => c.id.startsWith("road-")).length, 2);
  assert.ok(!script.includes("AFC Championship"));
  const celebration = all.find((x) => x.episode?.edition === "superBowl");
  assert.ok(celebration);
  assert.ok(celebration.episode.chapters.some((c) => c.id === "champions"));
  assert.ok(celebration.episode.chapters.some((c) => c.id === "legacy"));
  const frozen = JSON.stringify(finale);
  s = advance(s, { auto: true });
  assert.equal(
    JSON.stringify(s.primetimeArchive.find((x) => x.episode?.id === finale.episode.id)),
    frozen,
  );
  assert.equal(new Set(all.map((x) => x.episode.id)).size, all.length);
  assert.equal(
    new Set(all.map((x) => x.open)).size,
    all.length,
    "openers reflect different recorded slates",
  );
});

test("editorial production and awards ballots do not consume RNG or mutate the game", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 19 });
  const before = JSON.stringify(s);
  const show = {
    year: 1966,
    week: 1,
    kind: "regular",
    title: "Week 1",
    recaps: [],
    stories: [],
    previews: [],
  };
  const first = produceEpisode(s, show, [], [], false);
  assert.deepEqual(produceEpisode(s, show, [], [], false), first);
  calculateAwards(s);
  assert.equal(JSON.stringify(s), before);
});

test("pick accountability uses the actual winner and never fabricates a comeback or overtime", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 7 });
  s.primetime = {
    year: 1966,
    week: 1,
    previews: [{ homeId: "gnb", awayId: "chi", pick: "gnb" }],
    episode: { id: "previous", focusIds: [] },
  };
  const g = {
    id: "actual",
    year: 1966,
    week: 2,
    phase: "regular",
    homeId: "gnb",
    awayId: "chi",
    homeScore: 7,
    awayScore: 21,
    played: true,
    homeTo: 3,
    awayTo: 0,
  };
  const show = { year: 1966, week: 2, kind: "regular", title: "Week 2", recaps: [], stories: [] };
  const e = produceEpisode(s, show, [g], [], false);
  const segment = e.chapters.find((c) => c.id === "accountability");
  // The desk owns the miss and credits the team that actually won.
  const said = segment.lines.map((l) => l.text).join(" ");
  assert.match(said, /whiffed|miss|wrong/i);
  assert.match(said, /CHI 21, GNB 7/);
  const script = JSON.stringify(e);
  assert.ok(!script.includes("in overtime"));
  // The turnover story comes from the recorded count: three by the loser.
  assert.match(script, /gave it away three times|Three turnovers|turnover battle by three/);
});

test("weekly editorial avoids repeating the same subject when its headline changes", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 13 });
  const firstStory = {
    tag: "Hot",
    headline: "Green Bay has won five straight",
    body: "The Packers are surging.",
    teamIds: ["gnb"],
    playerIds: [],
  };
  const first = produceEpisode(
    s,
    { year: 1966, week: 5, kind: "regular", title: "Week 5", recaps: [], stories: [firstStory] },
    [],
    [],
    false,
  );
  s.primetime = { year: 1966, week: 5, episode: first, stories: [firstStory], recaps: [], previews: [] };

  const second = produceEpisode(
    s,
    {
      year: 1966,
      week: 6,
      kind: "regular",
      title: "Week 6",
      recaps: [],
      stories: [{ ...firstStory, headline: "Green Bay's streak reaches six" }],
    },
    [],
    [],
    false,
  );
  assert.ok(!second.chapters.some((chapter) => chapter.title === "Green Bay's streak reaches six"));
});

test("episode archive is bounded, deduplicated on rebuild, and migrates version 17", () => {
  const s = createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 3 });
  s.phase = "regular";
  for (let week = 1; week <= 30; week++) {
    s.week = week;
    buildPrimetime(s);
  }
  assert.equal(s.primetimeArchive.length, 26);
  const id = s.primetime.episode.id;
  buildPrimetime(s);
  assert.equal(s.primetime.episode.id, id);
  assert.equal(s.primetimeArchive.length, 26);
  const old = { ...s, version: 17, primetimeArchive: undefined };
  const loaded = hydrateSave(old);
  assert.equal(loaded.version, 20);
  assert.deepEqual(loaded.primetimeArchive, []);
});

test("network score has four contrasting sections and a coherent 32-bar repeat", () => {
  assert.equal(NETWORK_BPM, 124);
  const sections = new Set(Array.from({ length: 256 }, (_, i) => scoreStep(i).section));
  assert.equal(sections.size, 4);
  assert.deepEqual(scoreStep(0), scoreStep(256));
  assert.notDeepEqual(scoreStep(0), scoreStep(64));
  assert.equal(scoreStep(63).fill, true);
});
