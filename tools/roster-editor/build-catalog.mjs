import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { draftSeedsFor } from "../../src/lib/game/data/draftClasses.ts";
import { OWNER_GRADES } from "../../src/lib/game/data/ownerGrades.ts";
import { loadHistoryData } from "../../src/lib/game/historyData.ts";

const history = await loadHistoryData();
const seasonRatings = JSON.parse(readFileSync(resolve("tools/roster-editor/generated-season-ratings.json"), "utf8"));
const nearestRating = (year, id) => {
  const exact = seasonRatings[year]?.[id];
  if (exact) return { ...exact, year: Number(year) };
  const candidates = Object.keys(seasonRatings).filter((y) => seasonRatings[y][id]).sort((a, b) => Math.abs(Number(a) - year) - Math.abs(Number(b) - year));
  const y = candidates[0];
  return y ? { ...seasonRatings[y][id], year: Number(y) } : undefined;
};
const catalog = {};
for (let year = 1966; year <= 2040; year++) {
  const draft = draftSeedsFor(year).map((p) => {
    const grade = OWNER_GRADES[`${year}|${p.f}|${p.l}`];
    return [p.f, p.l, p.p, p.c ?? "", grade?.d ?? p.o, grade?.p ?? p.o, p.r ?? null];
  });
  const roster = [];
  if (year <= 2026) {
    const positions = new Map();
    for (const players of history.opening(year).values()) for (const entry of players) positions.set(entry.person, entry.pos);
    const seen = new Set();
    for (const [team, players] of history.rosters(year)) for (const { person } of players) {
      if (seen.has(person)) continue;
      seen.add(person);
      const player = history.people[person];
      if (!player) continue;
      const pos = positions.get(person) ?? history.seasonPos(year).get(person) ?? player.pos;
      const id = `r-${person.toString(36)}`;
      const rated = nearestRating(year, id);
      roster.push([id, player.first, player.last, pos, team, player.college ?? "", rated?.o ?? null, rated?.pot == null ? null : Math.min(99, rated.pot), rated?.year ?? null]);
    }
  }
  catalog[year] = { roster, draft };
}

writeFileSync(resolve("tools/roster-editor/catalog.json"), JSON.stringify(catalog));
const page = readFileSync(resolve("tools/roster-editor/index.html"), "utf8").replace(/\r\n/g, "\n");
const marker = "  <script>\n  (() => {";
const fetchBlock = `    fetch("catalog.json").then(r=>{if(!r.ok)throw new Error("The catalog file could not be loaded.");return r.json()}).then(data=>{catalog=data;const linked=syncSavedReviewChoices();$("loadStatus").textContent=linked?"Base data ready · linked "+linked+" saved rating decision"+(linked===1?"":"s"):Object.keys(reviewOverrides).length?"Base data ready · "+Object.keys(reviewOverrides).length+" imported rating decisions":"Base roster and draft data ready · 1966–2040";render()}).catch(()=>{$("loadStatus").textContent="Catalog failed to load. Rebuild the local developer catalog with the repository script.";render()});`;
if (!page.includes(marker) || !page.includes(fetchBlock)) throw new Error("Roster editor source changed; standalone build markers need updating.");
const embedded = JSON.stringify(catalog).replace(/</g, "\\u003c");
const standalone = page.replace(marker, `  <script id="embeddedCatalog" type="application/json">${embedded}</script>\n${marker}`)
  .replace(fetchBlock, `    catalog=JSON.parse(document.getElementById("embeddedCatalog").textContent);const linked=syncSavedReviewChoices();$("loadStatus").textContent=linked?"Base data ready · linked "+linked+" saved rating decision"+(linked===1?"":"s"):Object.keys(reviewOverrides).length?"Base data ready · "+Object.keys(reviewOverrides).length+" imported rating decisions":"Base roster and draft data ready · 1966–2040";render();`);
writeFileSync(resolve("tools/roster-editor/standalone.html"), standalone);
const drafts = Object.values(catalog).reduce((n, y) => n + y.draft.length, 0);
const rosters = Object.values(catalog).reduce((n, y) => n + y.roster.length, 0);
console.log(`Wrote ${rosters} historical roster entries and ${drafts} draft prospects.`);
