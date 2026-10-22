# NFL Rewind improvement checklist

This is the acceptance tracker for Jordan's NFL Rewind notes. A box is checked only after the behavior has been inspected, implemented where needed, and verified. Existing features stay open until their quality has been reviewed against the request.

## Gameplay and authenticity

- [x] Make quarterback rushing and scrambling depend on player mobility, style, and historical era; keep ordinary handoffs assigned to backs. Validated against historical positional rushing shares and the league's 2016–2020 realism window.
- [x] Rotate a healthy RB3 into the run game after RB1/RB2 carry a substantial workload, honoring the depth chart and keeping passing-down work with trusted protectors. Typecheck and depth/workload test pass; historical full-season calibration is being rerun after this change.
- [ ] Finish the broader review of fatigue, career rushing totals, and single-game/career tails against historical records.
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
- [ ] Review front-end and back-end architecture for maintainability, save compatibility, responsive performance, and accessible interactions.

## Validation and release

- [ ] Run the appropriate focused tests for each change and the full regression suite after the final integration pass.
- [ ] Inspect the finished game in the running PC and mobile interfaces; report deployment status separately from local implementation.

### Current pass

- Super Bowl podium uniqueness: implemented in `src/lib/game/presentation.ts`; `scripts/broadcast-desk.test.mjs` passes.
- RB3 workload rotation: implemented in `src/lib/game/sim.ts`; `scripts/substitution-rotation.test.mjs` and the historical rushing calibration pass.
- Stats-board headers now sort every column, reverse on a second tap, announce sort state accessibly, and keep independent order per category; needs PC/mobile interaction review.
- Pro Bowl cards now show every selection with a portrait, number, position, and current club; the existing full roster is scrollable on mobile and desktop.
- Jersey integrity audit passes across eight league-wide historical and future checkpoints, including duplicate detection and pre-1973 grandfathering.
- Hall ballot scoring now credits Pro Bowl seasons and major player awards, with capped/diminishing returns and protection from duplicate/future honor entries; selection logic and Canton presentation still need a full review.
- QB/era rushing model: `scripts/rushing-realism.test.mjs` passes after the RB3 extension.
- The Record now uses a separate factual Primetime builder and TV rundown; see `src/lib/game/historyPrimetime.ts` and `src/components/game/WatchTV.tsx`. Record mode remains an exact replay, not a second simulation.
- Career record rankings now verify the frozen retired-player snapshot before reusing a cache entry; franchise and single-season records identify the club attached to the recorded line after a player changes teams. `scripts/record-book-cache.test.mjs` covers these regressions.
- Development bundle builds and typecheck passes. Build output still warns about oversized stats/routes chunks; performance work remains open.
- Full `build:dev` completed after the current UI and Hall changes; focused broadcast, substitution, Pro Bowl, Hall, jersey, and rushing tests pass. Build still reports a 3.0 MB stats chunk and 7.9 MB client / 13.1 MB SSR routes chunks, so performance is a concrete remaining target.
