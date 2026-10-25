import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const html = await readFile(resolve("tools/roster-editor/standalone.html"));
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 950 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("nfl-rewind-rating-review-v1", JSON.stringify({ "draft|2007|Tyler|Palko|QB": { choice: "recommend", value: 70 } })));
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => document.getElementById("draftTotal").textContent !== "—");

  await page.locator("#year").selectOption("1966");
  await page.locator("#query").fill("Tommy Nobis");
  assert.equal(await page.locator("tr.player").count(), 1, "search finds a named historical roster player");
  await page.locator("#query").fill("");
  await page.locator("#headRow [data-sort=overall]").click();
  const grades = await page.locator("tr.player input[data-field=overall]").evaluateAll((items) => items.map((i) => Number(i.value)));
  assert.ok(grades[0] >= grades[1], "column heading sorts ratings descending");
  await page.locator("#groupBy").selectOption("position");
  assert.ok(await page.locator("tr.group").count() > 0, "position grouping renders group labels");

  await page.locator("#draftMode").click();
  await page.locator("#year").selectOption("2007");
  await page.locator("#query").fill("Tyler Palko");
  assert.equal(await page.locator("tr.player").count(), 1, "draft search finds Tyler Palko in 2007");
  assert.match(await page.locator("tr.player").innerText(), /UDFA|Undrafted/i, "Palko is labeled undrafted");
  assert.equal(await page.locator("tr.player input[data-field=potential]").inputValue(), "70", "saved rating review choice links into the editor");

  await page.locator("#query").fill("");
  await page.locator("#groupBy").selectOption("none");
  const rating = page.locator("tr.player input[data-field=overall]").first();
  await rating.fill("77");
  await rating.dispatchEvent("change");
  assert.match(await page.locator("tr.player").first().getAttribute("class"), /edited/, "direct edits are marked");
  await page.locator("#statusFilter").selectOption("edited");
  const editedRows = await page.locator("tr.player").evaluateAll((rows) => rows.every((row) => row.classList.contains("edited")));
  assert.ok(await page.locator("tr.player").count() > 0 && editedRows, "edited-only view contains only edited players");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#year").selectOption("1966");
  await page.locator("#statusFilter").selectOption("all");
  const width = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth }));
  assert.ok(width.doc <= width.inner + 1, "mobile layout has no page-level horizontal overflow: " + JSON.stringify(width));
  assert.equal(await page.locator("tr.player").first().evaluate((el) => getComputedStyle(el).display), "grid", "mobile roster rows become touch-friendly cards");
  assert.equal(await page.locator("#sortBy").isVisible(), true, "mobile view exposes a dedicated sort control");
  await page.locator("#sortBy").selectOption("overall");
  await page.locator("#sortOrder").selectOption("desc");
  const mobileGrades = await page.locator("tr.player input[data-field=overall]").evaluateAll((items) => items.map((i) => Number(i.value)));
  assert.ok(mobileGrades[0] >= mobileGrades[1], "iPhone sort controls reorder player cards");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadButton").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /nfl-rewind-player-edits-.*\.json/);
  assert.deepEqual(errors, [], "page has no runtime errors");
  console.log("Editor UI checks passed: search, sortable headers, grouping, draft lookup, direct edit, edit filter, mobile sort/layout, export.");
} finally {
  await browser.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
