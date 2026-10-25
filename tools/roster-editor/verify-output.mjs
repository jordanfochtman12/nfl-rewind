import { readFileSync, statSync } from 'node:fs';
const catalog = JSON.parse(readFileSync('tools/roster-editor/catalog.json', 'utf8'));
let rows = 0, missing = 0, invalid = 0, fallback = 0;
for (let year = 1966; year <= 2026; year++) for (const row of catalog[year].roster) {
  rows++;
  if (row[6] == null || row[7] == null) missing++;
  if (row[6] < 1 || row[6] > 99 || row[7] < 1 || row[7] > 99) invalid++;
  if (row[8] !== year) fallback++;
}
const classes = Object.values(catalog).reduce((n, year) => n + year.draft.length, 0);
let parsedScripts = 0;
for (const file of ['rating-review.html', 'standalone.html']) {
  const html = readFileSync(`tools/roster-editor/${file}`, 'utf8');
  for (const part of html.split('<script').slice(1)) {
    const openEnd = part.indexOf('>'), closeAt = part.indexOf('</script>');
    if (openEnd < 0 || closeAt < 0 || part.slice(0, openEnd).includes('application/json')) continue;
    const code = part.slice(openEnd + 1, closeAt).trim();
    if (code) { new Function(code); parsedScripts++; }
  }
}
console.log(JSON.stringify({ rows, missing, invalid, fallback, classes, parsedScripts, reviewBytes: statSync('tools/roster-editor/rating-review.html').size, standaloneBytes: statSync('tools/roster-editor/standalone.html').size }, null, 2));
if (missing || invalid || parsedScripts < 2) process.exitCode = 1;
