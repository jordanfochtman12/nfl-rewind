// Apply a roster-editor base-data export to the owner draft-grade source.
// The export is treated only as data; every edit is matched to a source draft seed before writing.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node scripts/apply-player-edits.mjs <export.json>");
const input = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
if (
  input?.format !== "nfl-rewind-base-data-edit-request" ||
  input?.version !== 2 ||
  !Array.isArray(input.edits) ||
  input.count !== input.edits.length
) {
  throw new Error("Unsupported or incomplete roster-editor export.");
}
if (input.edits.some((edit) => edit.scope !== "draft")) {
  throw new Error("This importer accepts draft-class edits only.");
}

const { draftSeedsFor } = await import(
  pathToFileURL(resolve("src/lib/game/data/draftClasses.ts")).href
);
const norm = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const validRating = (value) => Number.isInteger(value) && value >= 1 && value <= 99;
const boardPath = resolve("scripts/board-grades.json");
const qbPath = resolve("scripts/qb-grades.json");
const board = JSON.parse(readFileSync(boardPath, "utf8"));
const qb = JSON.parse(readFileSync(qbPath, "utf8"));
const seen = new Set();
const updates = [];

for (const edit of input.edits) {
  const { year, firstName, lastName, position, college, draftRound, overall, peakPotential } = edit;
  if (!Number.isInteger(year) || !firstName || !lastName || !position || !college || (draftRound !== undefined && !Number.isInteger(draftRound))) {
    throw new Error(`Incomplete player identity in export: ${JSON.stringify(edit)}`);
  }
  if (overall !== undefined && !validRating(overall)) throw new Error(`Invalid overall for ${firstName} ${lastName}`);
  if (peakPotential !== undefined && !validRating(peakPotential)) throw new Error(`Invalid peak for ${firstName} ${lastName}`);
  if (overall === undefined && peakPotential === undefined) throw new Error(`No rating supplied for ${firstName} ${lastName}`);

  const matches = draftSeedsFor(year).filter((seed) =>
    norm(seed.f) === norm(firstName) &&
    norm(seed.l) === norm(lastName) &&
    seed.p === position &&
    norm(seed.c) === norm(college) &&
    (draftRound === undefined || (seed.r ?? 99) === draftRound)
  );
  if (matches.length !== 1) throw new Error(`Expected one source match for ${year} ${firstName} ${lastName}; found ${matches.length}`);

  const key = `${year}|${firstName}|${lastName}`;
  if (seen.has(key)) throw new Error(`Duplicate export key: ${key}`);
  seen.add(key);
  const previous = board[key] ?? qb[key] ?? {};
  const draftOvr = overall ?? previous.draftOvr ?? matches[0].o;
  const peak = Math.max(peakPotential ?? previous.peak ?? matches[0].o, draftOvr);
  updates.push([key, { pos: position, draftOvr, peak }]);
}

for (const [key, value] of updates) board[key] = value;
const sorted = Object.fromEntries(Object.entries(board).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(boardPath, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Applied ${updates.length} draft player edits to scripts/board-grades.json.`);
