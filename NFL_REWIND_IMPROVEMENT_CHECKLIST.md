# NFL Rewind improvement checklist

This is the acceptance tracker for Jordan's NFL Rewind notes. A box is checked only after the behavior has been inspected, implemented where needed, and verified. Existing features stay open until their quality has been reviewed against the request.

## Gameplay and authenticity

- [x] Make modern quarterback rushing and scrambling depend on mobility, style, and historical era; keep ordinary handoffs assigned to backs. `scripts/qb-rushing-calibration.test.mjs` checks 2016 simulated QB carry volume and efficiency against the archived league after a modern-only scramble adjustment.
- [x] Reconcile early-era positional rushing shares: tune 1966–68 fullback and quarterback run-selection weights to archived league distributions while preserving team carry volume and efficiency. `scripts/rushing-realism.test.mjs` passes the 1966 volume/efficiency window and 1967–69 positional-share transition checks.
- [x] Rotate a healthy RB3 into the run game after RB1/RB2 carry a substantial workload, honoring the depth chart and keeping passing-down work with trusted protectors. Typecheck, depth/workload tests, and full historical season calibration pass after this change.
- [x] Calibrate fatigue by unit group and review career rushing totals plus single-game/career rushing tails against historical records. Validated by side-isolation/late-game unit tests, 1966 season QA, and full fixed-seed 1966–2020 realism windows and tail bounds.
- [ ] Audit team and player statistics end to end: definitions, aggregation, era rules, season/career/playoff totals, leaders, and records.
- [ ] Validate the complete simulation as a system: play outcomes, player attributes, traits, coaches, schemes, and strategy must interact coherently and stay within historical distributions.
- [ ] Make players act on accurate individual traits, morale, role, career situation, and team context; verify that agency produces sensible outcomes.
- [ ] Make CPU roster, free-agency, trade, draft, and depth decisions fit each club's history, roster, scheme, budget, and decision-making traits.
- [ ] Improve player progression/regression and career arcs without forcing real-life outcomes; check ordinary and mid/lower-roster players as well as stars.
- [x] Audit jersey numbers and legal era/position rules across initial rosters and generated players; eliminate duplicate/conflicting assignments. Verified every active club at 1966, 1972, 1973, 1984, 2004, 2021, 2023, and 2040; pre-1973 players are correctly grandfathered.
- [ ] Add more future draft prospects only with accurate, sourced player, position, college, and class information; check existing classes for duplicates and misclassified positions.

## Coaches, front office, and calendar

- [ ] Review historical and generated coaches: authentic offensive/defensive schemes, ratings, tendencies, and career paths.
- [ ] Verify HC/OC/DC ratings, playbooks, and traits each affect the correct parts of simulation and coaching decisions without double-counting.
- [ ] Add realistic team budgets, coach salaries, contract terms, hiring costs, and consequences that remain balanced over long dynasties.
- [ ] Improve the coaching carousel and full offseason flow, including plausible hiring, firing, contract, and staff continuity decisions.

## Shows, broadcast, and presentation

- [x] Give The Record its own documentary-style Primetime package built only from exact historical finals, sourced box scores, standings, awards, and archived historical news; exclude dynasty predictions, ratings-based power rankings, and generated injuries. Focused historical episode tests pass.
- [x] Make Record-mode TV air the real previous-week recap before advancing to the next schedule, and present the real draft, season/rule context, weekly slate, playoff bracket, Super Bowl result, awards, and Hall class as connected historical segments. Exact-history replay suite and focused Primetime tests pass; live TV interaction review remains part of the broader UI audit.
- [x] Give Super Bowl coach podium lines outcome-aware variation for comebacks, overtime, close finishes, blowouts, turnovers, rushing control, and defensive pressure; tested for distinct, repeatable champion and runner-up quotes.
- [ ] Continue expanding broadcaster lines and ensure calls are varied, football-literate, era-aware, and grounded in the game log.
- [ ] Make weekly, playoff, championship, and end-of-season shows feel distinct, connected to prior weeks, and free of repetitive story beats.
- [ ] Improve season preview, pre-draft show, and draft-night coverage with factual stakes, prospect context, team needs, and varied presentation.
- [x] Upgrade Pro Bowl presentation so every rostered player is shown with his current club, jersey number, and portrait; expose the full conference roster in a scrollable broadcast card. Verified the 2024 selections all have unique entries, active clubs, and jersey numbers.
- [ ] Rework Hall of Fame eligibility/selection and Canton presentation; verify selections, clubs, careers, and coach candidates.
- [ ] Improve the whole PC presentation to a polished futuristic football broadcast standard, including responsive layouts, motion, legibility, and performance.

## Interface and information design

- [ ] Audit every major screen and page for clear navigation, hierarchy, consistency, and useful information density.
- [ ] Redesign the statistics screen for readable categories, persistent sorting, filters, and easy comparison on desktop and mobile.
- [ ] Remove ticker/overlay collisions, clipping, sticky-control conflicts, and other scroll/focus problems across screen sizes.
- [x] Restore mobile draft-room access to the draft preview and section navigation; remove the timed show-open layer that obscured draft controls. Focused tests and production mobile-viewport checks pass; a physical iPhone check remains open.
- [ ] Review front-end and back-end architecture for maintainability, save compatibility, responsive performance, and accessible interactions.

## Validation and release

- [x] Run the appropriate focused tests for each change and the full regression suite after the final integration pass. `npm test` passed 293 tests (291 passed, 2 skipped because the optional `.grok/skills/og` checkout is absent), including the full 1966–2020 realism simulation; `npm run typecheck`, ESLint, `git diff --check`, and `npm run build:dev` also passed.
- [ ] Inspect the finished game in the running PC and mobile interfaces; report deployment status separately from local implementation.

### Current pass

- Super Bowl podium uniqueness: implemented in `src/lib/game/presentation.ts`; `scripts/broadcast-desk.test.mjs` passes.
- RB3 workload rotation: implemented in `src/lib/game/sim.ts`; `scripts/substitution-rotation.test.mjs` and the historical rushing calibration pass.
- Stats-board headers now sort every column, reverse on a second tap, announce sort state accessibly, and keep independent order per category; needs PC/mobile interaction review.
- Stats search, roster-status, position, and club filters now run before cumulative season totals are aggregated, avoiding career/postseason summations for players excluded from the visible rows. This improves the late-dynasty filter path; interactive performance measurement remains part of the PC/mobile UI audit.
- Pro Bowl cards now show every selection with a portrait, number, position, and current club; the existing full roster is scrollable on mobile and desktop.
- Draft night now suppresses the generic timed show-open overlay that dimmed and blocked its controls. The full-screen draft opener remains in the room, the pre-draft show is explicitly reachable from the phone dock after the draft starts, and the phone dock retains a route to the other game sections. The general screen-by-screen overlay audit remains open.

## Update (mobile draft access and draft-room legibility)

Draft night no longer mounts the generic timed overlay over the active draft controls. The existing photographic draft opener stays inside the room, while a persistent phone-dock action returns to the draft preview after the draft begins; the same dock keeps the other sections accessible. The title-screen hero now uses a photographic stadium still rather than the earlier geometric artwork. The general visual pass is still open: inspect other screens, overlay collisions, and phone/desktop layouts in a running build.

Validation: the focused draft-night, draft-announcer, pre-draft, and 1966-draft suites pass (19 tests); TypeScript and ESLint report no diagnostics; `git diff --check` passes. At a 390px viewport in an isolated fresh 2025 franchise, both the local production preview and the deployed Vercel app showed the draft opening without the timed overlay; the dock preview button opened Draft Preview, Stats navigation worked, every section appeared in the Sections menu, and there was no page-wide overflow or browser errors. The full Vercel build passed after adding the optional `NFL_REWIND_BUILD_OUTPUT` developer override and writing output to D:; the normal Vercel output path is unchanged. Commit `5a2c743` was pushed to `origin/main`; Vercel now serves the new stadium asset and the updated mobile flow.
- Jersey integrity audit passes across eight league-wide historical and future checkpoints, including duplicate detection and pre-1973 grandfathering.
- Hall ballot scoring now credits Pro Bowl seasons and major player awards, with capped/diminishing returns and protection from duplicate/future honor entries; selection logic and Canton presentation still need a full review.
- Quarterback/backfield rushing calibration: `scripts/qb-rushing-calibration.test.mjs` passes against archived 2016 totals, and `scripts/rushing-realism.test.mjs` now passes the 1966 volume/efficiency and 1967–69 positional-share windows after year-specific early-era FB/QB tuning.
- The Record now uses a separate factual Primetime builder and TV rundown; see `src/lib/game/historyPrimetime.ts` and `src/components/game/WatchTV.tsx`. Record mode remains an exact replay, not a second simulation.
- Career record rankings now verify the frozen retired-player snapshot before reusing a cache entry; franchise and single-season records identify the club attached to the recorded line after a player changes teams. `scripts/record-book-cache.test.mjs` covers these regressions.
- Stats tables now show a recorded zero as `0` and keep `—` for intentionally unrecorded historical categories; `scripts/stats-view.test.mjs` covers both cases. The full statistics audit remains open.
- Multi-team season stats now change their club attribution to `two` on a player's first appearance for a second club, and league leader labels read from that season line instead of current roster. `scripts/stat-ledger.test.mjs` covers both the ledger helper and an end-to-end traded-player simulation; the broader statistics audit remains open.
- Simulated team total offense now uses net passing yards by deducting sack losses from gross passing plus rushing yards. New game boxes retain sack-loss yardage for reconciliation; existing saves and historical records are left untouched. `scripts/net-yards.test.mjs` covers the arithmetic and a fixed-seed simulated box score.
- Defensive tackle attribution now follows a recorded run, completion, or sack instead of adding random postgame tackles to a fixed linebacker/safety group; interceptions no longer automatically give the interceptor a tackle, and both credited split-sack defenders get the tackle associated with their sack. Legacy random draws are still consumed to preserve deterministic save trajectories. `scripts/tackle-attribution.test.mjs` reconciles box-score tackles to contact events; the broad stats audit remains open.
- Individual scoring totals no longer give quarterbacks six points for passing touchdowns; rushing, receiving, return touchdowns, credited interception/fumble-return touchdowns, field goals, extra points, two-point conversions, and newly modeled safeties count for the player credited with scoring when the play identifies one. Defensive touchdowns and safeties carry through box, season, career, and profile stats, and older saves default new counters safely. Historical scoring totals remain unknown when the source lacks the required scoring channels. Safety credit and statistics are covered in `scripts/individual-scoring.test.mjs`, `scripts/stats-view.test.mjs`, and `scripts/history.test.mjs`.
- Successful simulated two-point conversions now credit one eligible offensive scorer, accumulate through regular-season, postseason, and career totals, appear in sortable player stat tables, and count toward individual points. Blocked field-goal return touchdowns credit a selected defender, while blocked punts through the end zone credit a safety to a modeled blocker; penalty-created safeties remain team-only when an individual cannot be identified. Historical individual scoring stays unknown where the source lacks scorer data; older saves hydrate new counters safely. The broader scoring/statistics audit remains open for other attribution and presentation gaps.
- Full 1966–2020 calibration now passes career and single-game rushing-tail bounds and league rushing-volume bands for 1973–77, 1994–98, and 2016–20. The fixed-seed regression also passes scoring, passing-rate, award, and staff checks. RB retirement responds to age plus recent and career carries. Offensive and defensive fatigue now use their own players’ stamina, and heavier RB3 rotation reins in excessive top-back career totals while retaining the historical passing, scoring, award, coaching, and rushing-volume bands. `scripts/fatigue.test.mjs` and `scripts/substitution-rotation.test.mjs` pass; `scripts/realism.test.mjs` passes all six fixed-seed historical checks.
- Hall audit now enforces five pro seasons and a recognized postseason honor for players, preserves historical All-Pro/Pro Bowl selections into dynasty saves, and corrects the coach wait to one full season out. The Canton screen explains those rules; ballot selection balance and the full presentation review remain open.
- Weekly Primetime now remembers the prior episode's story subjects as well as exact headlines, so a continuing streak, hot seat, or player story cannot occupy the same feature slot two weeks in a row just because its headline changed. `scripts/primetime-studio.test.mjs` verifies subject-level continuity; broader show variety and production review remain open.
- Large broadcast and reference screens now load on demand, with an accessible Suspense status instead of shipping all screen code on first load. The production-shaped build emits separate chunks for WatchTV (34 KB), Primetime (53 KB), Draft Night (34 KB), Hall (22 KB), and game film (14 KB). The shared client chunks are still oversized (7.16 MB and 3.04 MB), so the performance audit stays open.
- Offline caching now installs only the app shell and stores optional assets as they are used; the full offline library download is an explicit Settings action with file/byte progress. This removes the prior automatic background download of roughly 14 MiB of deferred assets on first visit while keeping complete offline preparation available on demand.
- Historical draft seeds now use compact positional rows. All 19,627 prospects across 61 classes round-trip field-for-field against the prior catalog; the production client engine chunk fell from 5,745,908 to 5,125,475 bytes (620,433 bytes / 10.8%). The broader PC performance audit remains open.
- Development bundle builds and typecheck passes. Build output still warns about oversized stats/routes chunks; performance work remains open.
- Full `build:dev` completed after the current UI and Hall changes; focused broadcast, substitution, Pro Bowl, Hall, jersey, and rushing tests pass. Build still reports a 3.0 MB stats chunk and 7.9 MB client / 13.1 MB SSR routes chunks, so performance is a concrete remaining target.
- The game store now requests the simulation module when the player enters mode selection, waits for it before creating or restoring a dynasty, and exposes loading state while it is fetched. Draft report-card UI is also split out. Desktop Chrome smoke check reached the 1966 franchise selector and Pittsburgh draft board without page errors. This is an incremental loading-path refactor, not a measured bundle-size win: the build still has oversized shared chunks, so the PC performance audit remains open.
