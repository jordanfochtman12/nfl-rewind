# Developer roster and rating review tools

These files are developer-only and live outside Vite's `public` directory. `standalone.html` is the mobile-friendly roster and draft editor; `rating-review.html` is a separate decision sheet for reviewing model flags. The editor has click-to-sort column headings, year/team/position/search filters, grouping, edited/missing-rating quick views, paging, inline rating edits, and prospect creation. On iPhone, each row becomes a compact player card with rating fields and sourced career accolades visible. Accolades include All-Pro, Pro Bowl, major league awards, and Pro Football Hall of Fame induction. Roster honors are shown through the selected season; historical draft-class players show career honors through 2025. Empty historical records are labeled as unrecorded. Both pages are self-contained and work locally in a browser. They export review/change requests; neither edits game source or franchise saves automatically. This October 21, 2026 refresh uses the current source roster/draft classes and current in-game historical rating pipeline.

The editor changes only a player's base overall and peak potential. The game's new weekly career model adjusts ratings during simulated careers and does not get overridden by this tool. Real History mode remains exact.

Historical roster overall and peak values use the game's real-player rating pipeline for each season. Rows show the exact season used. The rating review sheet starts with all existing owner grades preserved and only exports decisions the developer explicitly changes. It flags draft peak differences of 10 or more points from the engine's career-peak seed and values above the 1–99 rating range.

To regenerate ratings after changing the game engine or historical source data, run these commands from the repository root. The first command rebuilds 1966–2026 season ratings and takes several minutes; the others rebuild the catalog and decision sheet.

```sh
node --experimental-strip-types tools/roster-editor/generate-season-ratings.mjs
node --experimental-strip-types tools/roster-editor/build-catalog.mjs
node --experimental-strip-types tools/roster-editor/build-rating-review.mjs
```

All generated files remain under `tools/roster-editor`.

Run the browser-level editor checks after changing the editor UI:

```sh
node tools/roster-editor/qa-editor-ui.mjs
```
