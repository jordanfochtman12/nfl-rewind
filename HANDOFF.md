# NFL Rewind — HANDOFF (read this first)

**GitHub (source of truth, do not lose this):** https://github.com/jordanfochtman12/nfl-rewind  
**Clone:** `git clone https://github.com/jordanfochtman12/nfl-rewind.git`  
Private repo under `jordanfochtman12`. Vercel team `jord2`.


This is the working note for the **next AI agent**. **Copy-paste prompt for a new chat:** [`PASTE_NEXT_AGENT.md`](PASTE_NEXT_AGENT.md).

Product contract: [`AGENTS.project.md`](AGENTS.project.md). Sandbox/platform contract: [`AGENTS.md`](AGENTS.md). Era/expansion tables: [`docs/ERA.md`](docs/ERA.md), [`docs/EXPANSIONS.md`](docs/EXPANSIONS.md).

**Pitch:** Start in 1966. Draft the real classes. Rewrite football history.  
**Stack:** TanStack Start + Vite + React 19 + Tailwind v4 + Zustand. Port **8080**. Engine is **plain TypeScript, no React**, in `src/lib/game/`.  
**Do not** start in 1980. Default `STARTING_YEAR = 1966`. **No player photos.**

---

## Status (honest)

| Area | State |
|------|--------|
| Brand (`public/og.jpg`, `x-banner.jpg`, `favicon.svg`, `src/lib/og/site.json`) | **Done.** `x:game`, custom card. |
| Game contract docs | **Done.** `AGENTS.project.md`, `docs/ERA.md`, `docs/EXPANSIONS.md` |
| Engine types / teams / ratings / veterans / draft catalogs / coaches / bowl sites / expansion specs | **Written** |
| Engine loop | **Working.** 1966 season sims to Super Bowl I. Expansions 1967→2002 create clubs with coaches and 45-man rosters. User roster is **not** auto-filled after year one. CPU will not fire/hire the user’s HC. Camp trims CPU only. Sunday stays on the film. Trade deadline is a phase. |
| Expansion night | **Done.** Phase `expansion` is a full event (exposed lists, picks, new roster). CPU auto-picks unless the user *is* the new club. |
| Winter nights | **Done.** Awards, Pro Bowl (rosters), retirement (players + coaches), Canton (players + coaches), coaching carousel, relocations are event screens. Super Bowl stays after the play. |
| Camp / Sunday / deadline | **Done.** Preseason is camp. Regular week stays until Continue. Mid-season `deadline` phase with incoming offers. |
| Franchise book | **Done.** `history.seasons` year-by-year W-L, result, coach, draft class, honors. |
| Dynasty grade | **Done.** `grade.ts` letter A+–F. Career W-L on regular-season only. Locks at `END_YEAR` 2027 (`phase: complete`). |
| Staff / careers | Coaches have attributes, abilities, age, progression, retirement, firing, and HOF. CPU staff + scheme draft + roster management. Player HOF is a production ballot. |
| Contracts | Cap-era contracts, player talks, and franchise tags are live. Three-accrued-season RFAs now receive a one-year right-of-first-refusal tender decision; 2010 uses its 3–5-year RFA window. Eligibility approximates accrued service from distinct seasons with 6+ games because weekly active/inactive roster history is not stored. Historical tender amounts scale the current ROFR tender to the game's annual cap. Offer-sheet matching, alternate tender tiers, and draft compensation remain unmodeled. |
| Saves | **SAVE_VERSION 21.** IndexedDB `nfl-rewind` + compact (strip old film, trim news/tx). localStorage fallback. |
| QA scripts | **Green as of this handoff:** `qa-season` and `qa-expansions` exit 0. `tsc --noEmit` exit 0. |
| UI (title, AFL/NFL team select, office desk, roster, standings, schedule, stats, draft, history, expansion night, grade card) | **Playable** in `src/components/game/` |
| Team SVG logos `public/logos/{id}.svg` | **Emblems evolve by year.** `src/lib/game/data/logos.ts` `LOGO_ERAS` — last matching `from` year, including returns (Chargers powder, Jets football). Desk chrome follows `clubInk` / `teamColors(id, year)` (header ribbon, tabs, nameplate). Stadiums year-correct in `venues.ts`. |
| Git | **Saved:** https://github.com/jordanfochtman12/nfl-rewind |
| `npx tsc --noEmit` | **Green** |
| Preview / `startup.sh` | **Written.** Must listen `0.0.0.0:8080`. |
| Later draft classes 1980–2027 | **Done.** Wikipedia + PFR HTML 1966–79 + nflverse 1980–2026. Full locked kits (no thin clones). Pick-based ovr for unplayed rookies. 2026 named class. Star profiles cover OJ through Mendoza. `scripts/ingest-draft-classes.py` rebuilds `draftClassesIngest.ts`. |
| User GM (cut/sign/trade UI) | **Built** (Market desk). CPU will not paper over user holes. |
| Play-by-play | **Not wanted** — statistical team/player sim only |

**Ship bar from the original spec (do not call it done until these pass):**

```bash
node scripts/qa-season.mjs
node scripts/qa-expansions.mjs
npx tsc --noEmit
```

`qa-season` must: 24 teams, 14 games each, Nobis-class names on the 1966 board, sim Super Bowl I with two league champs then a Super Bowl.  
`qa-expansions` must: 1967 `nor`, 1968 `cin`, 1970 AFC/NFC labels, 1976 `tam`+`sea`, 1995 `car`+`jax`, 1996 `rav` and CLE inactive, 1999 CLE return **not a clone of Ravens ids**, 2002 `htx` 32 teams, SEA NFC West. Every new club roster ≥ 40 with full attribute kits and a coach.

---

## First 15 minutes (do this in order)

1. `read_file` `AGENTS.md` (platform: ports, TanStack Start, no Next.js, no shadcn CLI, brand lock).
2. `read_file` `AGENTS.project.md` (game).
3. Run:

```bash
npx tsc --noEmit
node scripts/qa-season.mjs
```

4. Fix whatever fails. Do **not** rewrite the engine from scratch.
5. Generate `public/logos/{id}.svg` for every `TeamId` from `TEAM_META` (geometric wordmarks, team colors, no photos).
6. `bash startup.sh` or `npm run dev` so preview is on **8080**.
7. Then `node scripts/qa-expansions.mjs` (slow: CPU-sims 1966→2002). If it stalls, debug `simUntil` / `finishOffseason` / expansion order — expansion must run **before** fill/draft of the new year.

---

## File map

```
AGENTS.md                 sandbox — do not replace with the game contract
AGENTS.project.md         game source of truth
HANDOFF.md                this file
docs/ERA.md               season length, divisions, playoff formats, stat caps, SB sites
docs/EXPANSIONS.md        how each expansion MUST mutate rosters
src/lib/game/             ENGINE (no React). Imports use `.ts` extensions for Node QA.
  types.ts                SAVE_VERSION=21, TeamId, DynastySave, Coach careers / HOF, CampReport, DeadlineSession, phase complete
  coachKit.ts             coach abilities / traits that feed the sim
  hof.ts                  player + coach Hall of Fame ballot
  staff.ts                seed / fire / hire / carousel / progression / retirement / CPU staff
  grade.ts                gradeDynasty / touchGrade
  compact.ts              compactSave / compactSaveInPlace (strip old film)
  expansion.ts            applyYearExpansion, userExpansionPick, expansion night
  gm.ts                   deskHoles, cpuSignNeeds — user roster is not CPU-filled
  season.ts               fillCpuRosters skips user; expansion phase; camp; sunday stay; deadline; END_YEAR complete
  save.ts                 hydrate career W-L + coach fields + history.grade
  teams.ts                conferenceOf, divisionOf, locationOf, nicknameOf, activeTeamIds, teamColors, clubInk
  era.ts                  eraProfile (1966 passing volume ≠ 2020)
  ratings.ts              deriveOvr, ratingsFromOvr, hasFullKit
  players.ts              seedVeterans, fillRoster, generatePlayer, hasKit
  createGame.ts           createNewGame({ userTeamId, startingYear, seed, cpuOnly })
  schedule.ts             rebuildSchedule — 14 games/team in 1966, AFL/NFL split
  sim.ts                  statistical game; attributes feed results; era clamps; coach kits
  standings.ts            standingRows, winPct
  playoffs.ts             1966 two championships + SB; later brackets
  draft.ts                buildDraftBoard, makeDraftPick, autoDraftRest (scheme + evaluator)
  events.ts               awards, Pro Bowl, retirement, HOF, primetime, CPU moves
  news.ts                 addNews
  data/veterans1966.ts    named 1966 vets (no 1966 draftees)
  data/draftClasses.ts    1966+ named classes; incomplete years generated
  data/coaches.ts         1966 + expansion + later coaches with born years and prior W-L
  data/bowlSites.ts       SB I Coliseum, Pro Bowl Honolulu 1980–2009
  data/expansions.ts      specs 1967/68/76/95/96/99/2002
  index.ts                public API
src/lib/save-idb.ts       IndexedDB blob store for 60-year files
src/lib/game-store.ts     Zustand persist via IDB, compact on write
src/components/game/GameApp.tsx   office desk, grade, title save line, Staff tab
src/components/game/WinterNights.tsx  awards, retirement, Canton, carousel
src/components/game/ExpansionNight.tsx  allocation event
src/components/game/GradeCard.tsx report card
src/routes/__root.tsx     title NFL Rewind, fonts, preview bridge
src/routes/index.tsx      <GameApp />
src/router.tsx            getRouter()
scripts/qa-season.mjs     re-execs with --experimental-strip-types
scripts/qa-expansions.mjs same
public/og.jpg             custom share card (done)
```

Engine modules import each other **with `.ts` extensions** so `node --experimental-strip-types scripts/qa-*.mjs` can load them. UI may import `@/lib/game`. Keep both working.

---

## Engine API (stable)

```ts
createNewGame({ userTeamId: "gnb", startingYear: 1966, cpuOnly?: boolean, seed?: number })
advance(save, { auto?: boolean, userPickPlayerId?: string })
simUntil(save, pred, maxSteps?)
simToSuperBowl(save)          // until save.superBowl.played && same year
fastForwardToYear(save, year) // land on that calendar year in draft/FA/preseason/regular
hydrateSave(json)
```

Season phases: `draft → freeAgency → preseason (camp) → regular → deadline (mid-season) → playoffs → superBowl → awards → proBowl → retirement → hof` then year++, **expansion (if any)**, then draft.

Expansion is applied in `finishOffseason` **after** `year += 1` and **before** `fillRoster` / `buildDraftBoard`, so Saints exist for the 1967 college draft.

1966 UI conferences are **AFL / NFL**, never AFC/NFC. `conferenceOf(1966, "gnb") === "NFL"`. 1970+ AFC/NFC. CLE inactive 1996–98. `rav` is a 1996 club, not the 1966 Browns relabeled.

---

## Known landmines

1. **`originalLeague` must be exported** from `src/lib/game/index.ts` (GameApp imports it). If typecheck fails on that, add it to the `teams.ts` re-export list.
2. **`simUntil` stall detector** throws if year/phase/week/draftPickIndex/SB-played do not change. Event phases that no-op will hang QA. Keep `auto: true` actually advancing.
3. **`createSuperBowl` then `advance` into awards:** `simToSuperBowl` keys off `superBowl.played`, not `phase === "superBowl"`. Do not “play SB and skip to awards in the same step” *before* setting `played`, or QA will miss it. Current `advance` plays then sets phase to awards — `played` is true, so `simToSuperBowl` should still match.
4. **1996 Modell move:** deactivate CLE, create `rav`, **move player ids** (same ids). 1999 CLE return is an expansion draft — new generated ids, not a copy of `rav.roster`.
5. **Odd-sized leagues (1966 NFL has 15)** need byes. QA asserts **14 games per club**, not 14 calendar weeks.
6. **Duplicate veteran names** in `veterans1966.ts` (Blanda QB+K, Cappelletti WR+K). `seedVeterans` skips `team:first:last` duplicates — kickers who were also skill players may lack K ratings. Acceptable short-term; split dual-pos later.
7. **Zustand persist** of a full dynasty may blow localStorage. If the UI hangs on Continue, partialize or compress. Export/import JSON is the real save.
8. **Do not replace `AGENTS.md`.** Game rules live in `AGENTS.project.md`.
9. **Brand lock (updated):** the old muted-almanac palette (ink `#0c0d0b`, cream `#ebe4d4`, field `#3f6b4e`) is retired by owner request in favor of a bold broadcast-package look — deep navy/carbon `#05070c` base, hot orange/gold accents (`#ff5a1f` / `#ffc93c`), glossy chrome-bevel buttons and nav (`.chrome-bevel`, `.chrome-bar`, `.broadcast-panel` utilities in `styles.css`), condensed italic display type. Still **no player headshots** — that rule stands. Original artwork only: never embed real ESPN/2K trademarked logos, wordmarks, or UI chrome verbatim — the "cinematic broadcast" reference is a style/genre, not assets to copy.
10. **Node QA import:** `scripts/qa-*.mjs` re-spawn with `--experimental-strip-types` then `import("../src/lib/game/index.ts")`. Do not convert the engine to a React package.
11. **CPU will not fire/hire the user’s HC** unless `cpuOnly`. Coordinators still auto-fill if vacant. User HC retirement (age) is allowed — the chair stays empty until they hire.
12. **Do not add playerHof / coach retirement as a new auto phase** — they already run inside retirement / hof. A new phase stalls `qa-expansions`.

---

## Next work (priority order)

1. Complete RFA offer-sheet matching and draft-pick compensation, then add exclusive-rights tenders. One-year RFA qualifying tenders are implemented; the waiver-claim phase is already in `season.ts` / `WaiverNight.tsx` and covered by `scripts/waiver-phase.test.mjs`.
2. Keep `tsc` + `qa-season` green after every change. `qa-expansions` when a new auto phase is added.
3. Optional: tighten `ram-2020.svg`. More winter copy. Don't rewrite the drive engine.

## Update (more real players and attributes)

- **1966 rosters deepened.** `veterans1966.ts` — added ~200+ real named veterans across 10 of 24 franchises that were thin (phi, atl, mia, crd, was, sdg, den, oti, nwe, nyg), each sourced from Wikipedia team-season articles and cross-checked against the file's own "no 1966 draftees here" rule. Named-veteran share of full 1966 rosters rose meaningfully; exact count varies as rosters regenerate but the qa-season 70%+ college-coverage gate is now met with real margin.
- **College data**: `colleges.ts` and inline `c:` overrides in `veterans1966.ts` grew from careful WebSearch-verified lookups only — mid-task I caught myself adding a handful of guessed colleges and reverted every one of them before they landed. **Lesson for future agents: never add a college (or any factual historical attribute) without a verified source. A wrong guess presented as fact is worse than a missing field.** A few pre-existing wrong values were corrected via inline override (Dave Lloyd → Georgia not Maryland, Nate Ramsey → Indiana not Indiana State, John Meyers → Washington).
- **Star profiles (`starProfiles.ts`)**: audited for gaps against recent draft classes. Coverage was already very strong (466 entries, every obvious HOF/superstar era-by-era) — added 15 genuinely missing current stars (Trevor Lawrence, Tua, Kyler Murray, Bryce Young, Will Levis, De'Von Achane, Puka Nacua, Drake London, Garrett Wilson, Penei Sewell, Quinnen Williams, Roquan Smith, Fred Warner, Derwin James, Kayvon Thibodeaux) with reasonable `rt` kits matching neighboring archetypes; ratings are gameplay balance numbers, not claimed historical fact, so no verification gate applied there the way it did for colleges.
- **Draft classes**: re-confirmed already strong (250-475 named per class, ~100% attribute coverage across sampled years 1966-2025) from an earlier audit this session — no changes needed.
- Verified green after every batch: `tsc --noEmit`, `qa-season.mjs`, `qa-expansions.mjs` (full 1966→2002+ CPU expansion sim), `npm run build`.

## Update (broadcast UI pass 3 — presentation upgrade)

- **`GameNight.tsx` scorebug rebuild.** The game-result screen (the actual "gameplay" screen) had a plain score readout. Replaced with a real broadcast scorebug: each side gets a `clubInk`-derived gradient block (team primary → black, contrast-safe `onPrimary` text) with logo + score, a center chrome divider carrying the quarter-by-quarter mini-table and FINAL/UPCOMING chip, and a `PRIMETIME` badge next to the week label when `game.night` is true. Team-stat comparisons (total yards, time of possession, first downs, turnovers) are now paired `StatBar` components — a two-color proportional bar, team-colored, instead of a plain "12 / 9" text pair. MVP got its own spotlight row instead of living inside the stat grid.
- **`GradeCard.tsx` rebuild.** The letter grade is now a glowing chrome-bevel badge (color + text-shadow keyed to the letter: brass for A, green for B, chrome for C, brick below) with a `chrome-bar` header strip, instead of a plain oversized letter. Stat lines moved from a bare list to individual bordered rows.
- **`SuperBowlNight.tsx`**: team identity now flows through — winner's score gets a colored glow, the "World champions" line gets a chrome-bevel chip with a team-color text-shadow (kept the text itself on `--color-fg` after finding Packers-green-as-direct-fill was too low-contrast against black — glow only, never fill, for readability against a photo backdrop).
- **Real bug found and fixed**: `SuperBowlNight.tsx` was the only `FilmStill`-backed event screen structured as multiple sibling content blocks instead of one wrapping div. `FilmStill` is `position: absolute`, so CSS paints positioned elements after static ones regardless of DOM order — the score grid and the champions/MVP/highlights section (both missing `relative`) were rendering **visually behind the stadium photo**, effectively invisible past the title block. Fixed by adding `relative` to both. Every other `FilmStill` screen already wraps its content in one `relative` div and was unaffected — audited all of them to confirm.
- Reviewed `PrimetimeShow.tsx` (ticker/sportscast) and `WinterNights.tsx` (awards/Pro Bowl/retirement/HOF/carousel/relocation) — both already read as strong broadcast presentations (ticker crawl, ranked packages, freeze-frame closer, brass-highlighted "yours" cards on cinematic photo backdrops) from earlier passes; left as-is rather than churn working screens.

## Update (broadcast UI pass 2 — global table/card treatment)

Rather than hand-editing every screen, extended the broadcast look via compound CSS selectors in `styles.css` that target the class combos already used everywhere: `.border.border-line` (the flat card-wrapper pattern used ~26 places) gets a gradient panel + chrome rim, `table thead` gets a dark chrome gradient with a club-color underline glow, and `table tbody tr:hover` gets a highlight. These sit outside any `@layer` block so they win over Tailwind's utility layer regardless of specificity (same trick `.chrome-bevel`/`.chrome-bar` already used) — no JSX touched, and it reaches every table and card screen at once (Roster, Standings, Stats, Draft board, Depth chart, Schedule, MarketDesk, TeamRoster, FranchiseBook). Verified visually across Draft Night, Roster, Standings, Depth, Stats, and Retirement Night (generated a mid-sim save via the engine directly + imported it, to check event screens without clicking through a full season).

## Update (real trade logic)

`executeTrade` (`gm.ts`) previously only checked value fairness (receiving side ≥82% of value, bypassable with `force`). Added three hard gates that `force` does **not** bypass:

- **Roster limit** — `fitsRosterAfterTrade`: neither side can end up over the 53-man active count (IR-parked players excluded, matching the IR desk-decision work). Fails with "would be over the 53-man limit."
- **Salary cap** — `fitsCapAfterTrade`: 1994+, neither side's post-trade payroll can exceed the cap (same 1.02 grace `canAfford` uses). No cap pre-1994, matches `salaryCapFor`.
- **Rozelle-rule lock** — `rozelleLock(save, p)` (moved here from `deadline.ts`, which now imports it): pre-1994, a historical player with 4+ years pro and 84+ ovr can't be in *any* trade, not just CPU-offered ones. Previously this was only enforced inside the deadline-night offer generator; the always-on Market tab had no such check.

**Trade window**: `tradeWindowOpen(save)` returns false once `save.deadline.resolved` is true for the current year (set by `closeDeadline`), true again once the year rolls over (`save.deadline` is cleared each offseason). `executeTrade` rejects any trade — user or CPU — once the window is closed. `season.ts`'s weekly random CPU-CPU trade roll (`cpuTrades`, ~8%/week) now also checks `tradeWindowOpen` before firing, so CPU-CPU deals stop after the deadline too, not just user ones. `MarketDesk.tsx`'s trade desk is visually disabled (`pointer-events-none opacity-40` on the club picker, panels hidden) with a banner once the window closes.

**Smarter CPU trade AI**: `cpuTrades` now rolls a 60% chance to try `dealerTrade` first — a buyer/seller model. `contendScore` reads current-season win% once there's a sample (3+ games), else roster average `ovr` as a proxy (so it works during the offseason/deadline-week CPU rounds too). Contenders (score ≥0.58) send a future 2nd–4th round pick (`tradeablePick`, next year's, not this year's already-drafted one) for a proven vet (68+ ovr, healthy, not Rozelle-locked) at a real roster hole (`deskHoles`) from a rebuilding club (score ≤0.42) — the seller keeps at least one body left at that position. Falls back to the old simple value/scheme-fit 1-for-1 swap when no buyer/seller pairing works, for variety.

## Update (every player has a card, everywhere)

Player cards (`PlayerLink` → `PlayerProfile` modal) were missing in two spots and there was no way to browse another club's full roster. Fixed:

- `MarketDesk.tsx` trade desk: the "You send"/"You receive" checkbox lists now use `PlayerLink` (wrapped in a `<span onClick={(e) => e.preventDefault()}>` so clicking the name opens the card instead of also toggling the trade checkbox — nesting a button inside a `<label>` forwards clicks to the checkbox by default).
- `GameApp.tsx` History → Awards section: MVP/OPOY/DPOY/CPOTY now render via `PlayerLink` instead of a plain name string.
- New `TeamRoster.tsx` (`TeamRosterModal`): click any club in Standings (`openTeam(id)` in `game-store.ts`, new `viewTeamId` state) to open a read-only full-roster modal for that club, sorted by grade, every row clickable into `PlayerProfile`. Mounted once in `PlayShell` alongside `<PlayerProfile />`.

## Update (injured reserve, SAVE_VERSION 15)

Injured reserve is now a desk decision, not just the injury report. `Player.onIR` (default `false`) parks a hurt player off the 53-man count (`activeRosterOf` vs `rosterOf`) so the desk can sign or claim a replacement while he heals — `signPlayer`'s cap check, `deskHoles`, and `starters()`/`DepthField` all treat an IR player as unavailable for gameday. `gm.ts`: `placeOnIR` (requires `injuredWeeks > 0`, not already on IR) and `activateFromIR` (requires healed + roster room). **Era-gated to match real history**: IR was season-ending before 2012 — `canReturnFromIR(year)` returns `false` pre-2012, so `activateFromIR` fails with "season-ending in this era" and the UI hides the Activate button, only showing "out for the year." Wired into `InjuryReport` and the `Roster` table in `GameApp.tsx`, plus `PlayerProfile`'s status line.

Also fixed two stale `qa-season.mjs` assertions unrelated to IR (were failing before this change): the "Bo Jackson does not hug overall on unused skills" check was reading the raw star-profile override (which correctly omits `throwAcc` since it's not a locked attribute) instead of the derived `Ratings` — now built via `g.ratingsFromProfile`, matching the Nobis assertion's pattern. And the hardcoded `SAVE_VERSION === 14` assertion is now `=== 15`.

---

## Update (franchise features, October 2026)

Shipped on `main` (engine in `src/lib/game/`, UI in `src/components/game/`):

- **Season preview special** (`seasonPreview.ts`, `previewVoice.ts`, `SeasonPreview.tsx`): airs on Primetime during camp week. 2,000 simulated seasons on the sim's own unit strength (about 2 wins of error per team), every club broken down, division picks, award odds, bold predictions, must-watch games, Super Bowl pick. The desk changes by era; features rotate yearly; last year's picks get graded in "the receipts" and again on awards night (`previewPicks`, `deskGrade`). Pure: reads the real schedule and its own seeded generator, never the save's RNG.
- **Contract talks** (`contracts.ts`, `ContractTalks.tsx`): the owner's expiring players (66+) negotiate before free agency: ask, counter, insult, patience, franchise tag from 1994. Untouched talks fall back to the old staff logic.
- **Owner's box** (`liveCalls.ts`): change the plan or bench the QB during the live broadcast; the game replays from the pre-game save with every earlier snap unchanged.
- **Market life** (`market.ts`): CPU trade calls, free-agent bidding wars, deadline rumor mill.
- **Franchise legacy** (`legacy.ts`): retired numbers, Ring of Honor, Hall of Fame induction cards for every club.
- **Timeline** (`timeline.ts`): real history vs. this league, every season.
- **Speed:** `cloneSave` shares retired players between copies (`ownPlayer` before changing one); late-dynasty weeks ~2.5x faster.

Deploys: ship through a pull request merged on GitHub. Direct pushes to `main` from an agent identity were not picked up by Vercel.

## Commands

```bash
npm install          # already installed in this sandbox
npm run dev          # 0.0.0.0:8080
npx tsc --noEmit
node scripts/qa-season.mjs
node scripts/qa-expansions.mjs
node scripts/brand-check.mjs --game
```

Local clone later: `npm i && npm run dev` plus the two QA scripts.

---

## What not to do

- Do not start the dynasty in 1980.
- Do not put Ravens in Cleveland in 1966.
- Do not hug overall on every attribute; sim must use the kit.
- Do not use 2020 passing shapes in 1966.
- Do not leave expansion clubs with 15 generated bodies.
- Do not add photos of old men.
- Do not hide source in a minified zip.
- Do not treat chat as source of truth — update `AGENTS.project.md` / this HANDOFF when behavior changes.


## Do not hand this to Gemini

Gemini / ChatGPT / phone chatbots **cannot see `/workspace`**. The copy-paste file is for a new **Grok Build** (or Cursor/Claude Code) session with the filesystem. If you paste it into Gemini it will ask you to dump error logs and source — that is expected and not useful.


## Update (coaching + careers)

SAVE_VERSION 14. Coaches now have age, leadership / development / evaluation, abilities and traits that feed the sim, progression, regression, retirement, firing, and a Canton ballot. CPU clubs fire coordinators, hire historical names when they come available, draft to scheme, and cut/sign to fit. Players retire with era-true age cliffs (kickers and quarterbacks last; street veterans can walk away). Hall of Fame is a production ballot, not peak-ovr-only. CPU will not fire or hire the user’s HC.

### 2026-10-22: modern quarterback rushing calibration

2016 historical QB rush volume was being overshot by roughly 44% in the fixed-seed league sim. The scramble base in `sim.ts` now uses a lower factor for 2010+; `scripts/qb-rushing-calibration.test.mjs` compares simulated 2016 QB carries and yards per carry with archived historical totals. A follow-up calibrated 1966–68 fullback and QB run-selection weights against historical positional shares; `scripts/rushing-realism.test.mjs` now passes both its 1966 volume/efficiency window and 1967–69 positional-share transitions. Preserve year-specific values and rerun both calibrations when changing this model.

QA: `qa-season` asserts Lombardi kit + age, Halas is old, every 1966 club has HC/OC/DC with abilities, user HC is not auto-fired through Super Bowl I.

## Update (The Record documentary broadcast)

The Record has a dedicated factual Primetime builder (`src/lib/game/historyPrimetime.ts`) and TV rundown (`src/components/game/WatchTV.tsx`). It uses the exact replay results, available historical box scores, real standings, recorded awards, and historical news. It must not use dynasty projections, ratings-based power rankings, generated injuries, or invented outcomes. TV airs the previous week's real recap before advancing to the next slate, then connects the season's real draft, rule context, schedule, postseason, championship, honors, and Hall class. `scripts/history-primetime.test.mjs` covers source fidelity, tie language, archive stability, and episode differentiation; `scripts/history.test.mjs` covers exact replay behavior. The running Record TV flow still needs hands-on interaction review.

## Update (scheme-matched offensive personnel)

The regular-game simulation now builds receiver/fullback personnel from `starterCount()` and the club's offensive scheme: vertical uses three WRs and no FB, smashmouth uses one WR, up to two TEs and a FB, and the other schemes follow their configured counts. When a second TE is on the field he shares the era TE target allocation and is included in fatigue, coach-kit, matchup, and injury/on-field accounting. Rotating backs count as one shared role in unit fatigue instead of being treated as simultaneous starters. `scripts/substitution-rotation.test.mjs` checks personnel membership and a seeded game confirms the second TE receives targets. History mode remains an exact-record replay and does not run this simulation path.

Validation: focused substitution/fatigue tests, `npm run typecheck`, `npm run qa:season`, `npm run qa:expansions`, all six `scripts/realism.test.mjs` tests, and production `npm run build` pass. The build still reports oversized JavaScript chunks elsewhere in the app.

## Update (hurry-up substitutions and 1966 run balance)

Defensive-line relief now respects a hurry-up offense: scheduled DE/DT relief is held until the offense gives the defense a substitution window, and an already-rotated lineman stays in during the no-huddle stretch. The 1966 base run/pass call mix also leans one percentage point toward passes; fixed-seed calibration had the league about 4.6% high in rushing attempts. These changes apply only to simulated games; Record mode remains an exact replay.

Validation: `scripts/substitution-rotation.test.mjs` (4 tests), `scripts/rushing-realism.test.mjs` plus `scripts/qb-rushing-calibration.test.mjs` (3 tests), TypeScript, targeted ESLint, and production build pass. Build continues to report the existing large-chunk warning; local database migration skips without `DATABASE_URL`.

## Update (weekly waiver review)

When user-controlled regular-season games have finished and the waiver wire has eligible players, the calendar now pauses on a Waiver Wire review before the next week. The new screen shows player, position, grade, age, and waived-from club, and allows direct claims; continuing then runs CPU claims and advances the calendar. Auto-simulation and CPU-only seasons process waivers without an interactive stop, while Record mode keeps exact-history advancement untouched. `scripts/waiver-phase.test.mjs` covers the user pause and CPU-only no-pause paths.

Validation: waiver phase tests cover the user claim window, roster-cap rejection, and CPU-only no-pause path. `npm run typecheck`, targeted ESLint, `git diff --check`, `npm run qa:season`, `npm run qa:expansions`, and production `npm run build` pass. The build still warns about pre-existing oversized JavaScript bundles; database migration skipped locally because `DATABASE_URL` is unset (the PGLite fallback self-migrates).

## Update (pre-draft broadcast special)

Every simulated dynasty now enters a `preDraft` show after the class board is prepared and before the first pick, including the first year of a new save and later offseasons. The existing draft special is promoted to this event: mock first round, team needs/war rooms, prospect grades and position rankings, combine standouts, and sleepers appear before the draft room opens. Continuing into the room leaves the pick index and prepared board unchanged. The draft-opening card no longer repeats the full special. Real History mode stays on its exact recorded draft path; TV mode gets a short preview bulletin and continues automatically.

Validation: `scripts/pre-draft.test.mjs` and `scripts/draft-night.test.mjs` pass (6 tests); `npm run typecheck`, targeted ESLint, `git diff --check`, `npm run qa:season`, and production `npm run build` pass. The build reports the repository's existing large-bundle warning; local database migration skips because `DATABASE_URL` is unset. The full expansion sweep is running. A separate history/era test run passed 25 of 26: its existing 2007 team-stat expectation differs on `unknown` fields, outside this change.
