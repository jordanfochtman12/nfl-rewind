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
| Contracts | Cap-era contracts, player talks, and franchise tags are live. ERFAs (<3 accrued seasons) can receive one-year league-minimum tenders with exclusive negotiating rights; RFAs receive one of four qualifying tenders and signed outside offers can be matched or declined for the corresponding draft pick. 2010 uses its 3–5-year RFA window. Dynasty and Watch modes now track regular-season full-pay game weeks per player; older/imported seasons still fall back to appearance totals. Historical tender amounts scale 2026 CBA values to the game's annual cap; exact year-specific tables remain future work. |
| Saves | **SAVE_VERSION 24.** IndexedDB `nfl-rewind` + compact (strip old film, trim news/tx). localStorage fallback. |
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
  types.ts                SAVE_VERSION=24, TeamId, DynastySave, Coach careers / HOF, CampReport, DeadlineSession, phase complete
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

1. Reconstruct year-specific historical RFA tender schedules; imported careers still lack active/pay-status ledgers.
2. Keep `tsc` + `qa-season` green after every change. `qa-expansions` when a new auto phase is added.
3. Optional: tighten `ram-2020.svg`. More winter copy. Don't rewrite the drive engine.

## Update (exclusive-rights free agents)

- Cap-era players with fewer than three accrued seasons now surface in owner contract talks as ERFAs. The club can offer a one-year league-minimum tender; the player is retained and cannot negotiate with other teams. CPU clubs tender eligible young players when their keep decision succeeds. Tender pay uses credited seasons (3+ games) and the 2026 NFL minimum schedule, scaled to the modeled historical salary cap. RFA offer-sheet logic remains limited to RFAs.
- Save schema is now `SAVE_VERSION 23`; old saves hydrate an empty ERFA tender ledger.
- Validation: `scripts/rfa-tenders.test.mjs` (8 tests), TypeScript, targeted ESLint, `qa-season`, the 1966–2002 `qa-expansions` sweep, and production build pass. Vercel check runs on the follow-up PR.

## Update (weekly accrued and credited service)

- Dynasty and Watch simulations now log regular-season weeks in which a player is on a club's roster and in full-pay status. The ledger is separate from games played: injured reserve still accrues service, a holdout week does not, and a bye does not count as a game. Week keys prevent duplicate accrual on retry; Record mode is excluded.

## Update (RFA offer-sheet frequency)

- CPU clubs now challenge a restricted free agent only when the player is a meaningful roster upgrade, with higher compensation rounds reducing interest. Each tender gets one roll for its best-fit suitor; previously each eligible rival rolled independently, compounding low individual odds into near-certain offers when many teams had a need.
- Validation: the RFA tests include a 120-seed first-round offer-sheet frequency check, focused RFA/service tests, typecheck, targeted ESLint, 1966 season QA, and 1966–2002 expansion QA.

## Update (postgame matchup tracking)

- Postgame one-on-one grades now use events recorded for the featured pair: receiver targets/results, matched-back carries/yards and linebacker stops, and edge pressures/sacks against the left tackle. Small samples are marked inconclusive; older saves without event tracking say tracking is unavailable instead of awarding a result from unrelated full-game totals.
- The tracking is optional data on each game's matchup record, so existing save files hydrate without a schema migration.
- Validation: focused game-day tests, TypeScript, targeted ESLint, 1966 season QA, and production build.
- RFA/ERFA classification now prefers the weekly service ledger (six full-pay games for an accrued season; three for credited service). Older saves seed the current season from recorded appearances when available; imported/prior seasons still fall back to `stats`/`career` totals. Save schema is `SAVE_VERSION 24`.
- Validation: service-ledger tests cover idempotency, injury/IR, holdout, bye, midseason migration, compact round-trip, and Record-mode isolation. TypeScript, targeted lint, and full season/expansion QA plus production build are required before merge.

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

## Update (depth-chart receiver and backup-back targets)

Three-wide offenses can bring a healthy WR4 into the target mix after the starting receivers absorb a meaningful workload. The reserve share is capped at 10% from 1990 onward, 5% in 1978–1989, and disabled before 1978. Passing targets also divide the existing RB target weight between RB1 and the healthy depth-chart RB2 (18% through 1977, 25% through 2009, 32% from 2010 onward), so the passing-back role no longer belongs to RB1 alone. Follow-up career testing found RB2, RB3, fullback and QB carries bypassed the season rushing-pace taper; every rushing role now gets the same era leader-pace usage response. The DPOY edge scale was adjusted from 1.00 to 1.12 so the 1966–2020 ballot distribution retains a realistic edge-rusher share after the sim update. No save schema or History mode data changed. The 1966 service-ledger QA now bounds accrued weeks by the actual 16-week calendar rather than the 14-game season; a traded player can appear on a 15th distinct game week when clubs have staggered byes.

Validation: `scripts/substitution-rotation.test.mjs` (7 tests, including a multi-game box-score sample), `scripts/qb-rushing-calibration.test.mjs`, `scripts/rushing-realism.test.mjs`, the full `scripts/realism.test.mjs` (career/game rushing tails, era stat windows, awards and staff), `npm run typecheck`, targeted ESLint, `node scripts/qa-season.mjs`, and `node scripts/qa-expansions.mjs` pass. `git diff --check` passes.

## Update (stamina-aware rush rotation)

Rushing workload selection now applies one shared stamina factor to RB1/RB2/RB3, fullback, quarterback, and emergency receiver carries. This closes a ratings inconsistency where reserve backs and non-RB rushers could receive their share without stamina affecting sustainable usage. The factor is clamped to keep extreme roster edits from erasing or overwhelming a role; it adds no save fields and leaves historical Record mode untouched.

Validation: `scripts/substitution-rotation.test.mjs` (8 tests, including a same-seed 20-game comparison confirming higher RB2 stamina increases its rushing share), `scripts/rushing-realism.test.mjs`, `scripts/qb-rushing-calibration.test.mjs`, `npm run typecheck`, targeted ESLint, `node scripts/qa-season.mjs`, and `npm run build` pass. The build retains its existing large-chunk warning; database migration skips locally because `DATABASE_URL` is unset.

## Update (solo and assisted tackle attribution)

Completed run and catch plays can now credit a second, position-weighted defender on 20% of tackled plays, improving league tackle totals without inflating any one position's share. The 1999 fixed-seed audit compares the sim against historical defender tackle totals and position shares. Assist chance and helper selection use an independent per-game stream, so this stats correction leaves the saved gameplay RNG and seeded score/yardage unchanged. No save fields or Record mode data changed.

Validation: `scripts/tackle-realism.test.mjs` checks historical 1999 tackle totals and six defensive-position shares, plus a fixed-game RNG/score/yardage sentinel; all six `scripts/realism.test.mjs` checks pass across 1966–2020; `npm run typecheck`, targeted ESLint, and `npm run build` pass. The build retains its existing large-chunk warning; local migration skips because `DATABASE_URL` is unset. Earlier-era tackle assist rates still need separate historical calibration.

## Update (era receiving shares and cumulative rushing load)

Fixed-seed full-season audits found tight-end receiving yards too high in 1994 and 1999 (about 1.5x historical totals), moderately high in 1985 and 2019, and close in 2009 and 2024. `eraTargetWeights()` now trims the TE share in 1978–89, 1990–99, and 2010–19 only; six-season tests retain 1985/1994/1999/2009/2019/2024 as checks, with a second seed for 1999. The first 1990s adjustment exposed a 24,375-yard career rushing leader on the long realism seed. Rush selection now gradually shifts workload off a player after 10,000 career rushing yards, reaching a 68% minimum share at very high volume; no one is cut, retired, or hard-capped. Historical records, saves, and exact Record-mode results are unchanged.

Validation: `scripts/receiving-realism.test.mjs` (six seasons, seven samples) and `scripts/substitution-rotation.test.mjs` (nine tests) pass; all six `scripts/realism.test.mjs` checks pass through 2020; `node scripts/qa-season.mjs`, `node scripts/qa-expansions.mjs`, `npm run typecheck`, targeted ESLint, `npm run build`, and `git diff --check` pass. The build retains the existing large-chunk warning; database migration skips locally because `DATABASE_URL` is unset. The receiving test allows a 25% per-season tolerance to accommodate fixed-seed variance; other eras and individual-team target distributions remain candidates for further calibration.

## Update (modern linebacker tackle-share calibration)

From 2019–24, total simulated tackle volume was near historical totals but the position mix drifted: middle linebackers were under-credited while off-ball outside linebackers were over-credited. For simulated seasons from 2010 onward, tackle selection now raises MLB weight and lowers non-edge OLB weight; edge OLBs retain their prior role weighting. Earlier eras are unchanged. A four-season regression (1999, 2009, 2019, 2024) checks total volume within 10% and six-position share within 6 percentage points, and a fixed-game sentinel verifies assist attribution does not alter gameplay RNG or outcomes. No save schema or Record-mode history changed. Historical tackle data is unavailable in the local archive before 1999, so this calibration does not claim earlier-era tackle accuracy.

Validation: `scripts/tackle-realism.test.mjs` passes both checks; all six `scripts/realism.test.mjs` checks pass across the 1966–2020 dynasty, including career rushing, era stat windows, award positions, and the coaching carousel. `npm run typecheck`, targeted ESLint, `npm run build`, and `git diff --check` pass. The build retains the existing large-chunk warning; local database migration skips because `DATABASE_URL` is unset.

## Update (rotating defensive-line relief across starters)

Defensive-line relief now cycles through every starting slot at the relieved position and lasts two snaps. Previously each DE or DT relief event benched only the first depth-chart starter for one snap, leaving the second starter without scheduled relief. The selected starter still comes from the saved depth chart, the next healthy player replaces him, a missing backup keeps the starter in, and hurry-up continues to hold new substitutions while extending an active relief window. No save fields or Record-mode data changed.

Validation: `scripts/substitution-rotation.test.mjs` passes all 9 tests, including two-snap windows, DE/DT round-robin selection, and actual depth-chart replacement. `scripts/tackle-realism.test.mjs` passes both checks with a refreshed deterministic fixture for the changed on-field personnel. All six `scripts/realism.test.mjs` checks pass across the 1966–2020 dynasty. `node scripts/qa-season.mjs`, `node scripts/qa-expansions.mjs`, `npm run typecheck`, targeted ESLint, `npm run build`, and `git diff --check` pass. The build retains the existing large-bundle warning; local database migration skips because `DATABASE_URL` is unset.

## Update (scramble yards in defensive game-plan feedback)

Quarterback scrambles now update the same live team rushing total as designed quarterback runs and running-back carries. Those totals inform the defense's run/pass response, so previously the box score reflected scramble yards while the opposing defense's play-calling did not. Negative scramble yards remain excluded from this positive rushing-volume signal, consistent with other rushing plays. This changes no save fields or recorded history.

Validation: `scripts/substitution-rotation.test.mjs` passes all 9 tests; `scripts/tackle-realism.test.mjs` and `scripts/receiving-realism.test.mjs` pass all 8 historical simulation checks; `npm run typecheck` and `git diff --check` pass. The longer full-season checks took about 103 seconds. Full build and season/expansion QA were not rerun for this two-line accounting fix.

## Update (era-calibrated field-goal decisions)

The first calibration audit was invalid: it used `createNewGame({ startingYear })`, which seeds the 1966 veteran roster even when the requested year is later. Those measurements and the resulting thresholds were discarded. The corrected test uses `createEraGame()` and `setHistoryData()` for each actual-year roster. Simulated coach decision ranges now receive these adjustments: 1966–69 +3 yards, 1978–99 +3, 2000–19 unchanged, and 2020 onward +1. The adjustment is used for fourth-down kick/punt/go choices and user fourth-down options; kicker ratings and make probability remain unchanged. The corrected five-era fixed-seed test passes within its attempt-volume and make-rate tolerances. Record mode and save/history data remain unchanged.

Validation: `scripts/kicking-realism.test.mjs` passes for 1966, 1985, 2009, 2019, and 2024 with actual-year rosters. The corrected audit is included in the current full build/typecheck verification below.

## Update (modern quarterback scramble and rushing calibration)

From the 2020 season onward, quarterbacks have a higher scramble tendency and a separate speed/agility-based yardage gain on live QB carries. The pre-2020 tendency and yardage curve are unchanged. A 2024 four-seed audit starts from the real recorded rosters (not the 1966 veteran pool) and now constrains attempts and total yards to within 15% of historical totals, in addition to a yards-per-carry check. The scramble tendency was eased after the first passing run showed total QB rushing yards about 18% high even though attempts and YPC individually passed. No save fields, player history, or Record-mode results changed.

Validation: `scripts/qb-rushing-modern.test.mjs` passes across four full 2024 seasons: 9,665 attempts (1.03x historical), 47,869 yards (1.09x), and 4.95 YPC vs 4.68. `scripts/qb-rushing-calibration.test.mjs` passes the 2016 control; the corrected five-era field-goal audit passes; `scripts/substitution-rotation.test.mjs` passes all 10 rotation/personnel checks. `node scripts/qa-season.mjs` passes through Super Bowl I and the 1967 expansion. `npm run typecheck`, targeted ESLint, `npm run build`, and `git diff --check` pass. Build retains the existing large-chunk warning; local database migration skips because `DATABASE_URL` is unset.

## Update (situational nickel personnel from the saved depth chart)

In simulated games from 1990 onward, third-and-medium/long, fourth-and-medium/long, second-and-long, and pass-oriented modern first downs now use nickel personnel if a healthy fourth corner is available. CB4 enters from the saved depth chart and the two best coverage linebackers remain on the field; the defense chooses this package from down, distance, and offensive tendency before the specific play call is known. Historical-era games and teams without a healthy CB4 retain their existing personnel. Tackle attribution was rebalanced after historical checks exposed a corner-heavy result, then verified against four seasons. No save schema or Record-mode history changed.

Validation: `scripts/substitution-rotation.test.mjs` passes all 10 tests, including package selection and CB4 depth-chart placement; `scripts/tackle-realism.test.mjs` passes both checks across 1999, 2009, 2019, and 2024; `scripts/receiving-realism.test.mjs` passes all six era checks; `scripts/qb-rushing-calibration.test.mjs` passes 2016; `node scripts/qa-season.mjs` and `node scripts/qa-expansions.mjs` pass; `npm run build`, targeted ESLint, and `git diff --check` pass. The full typecheck is being rerun after the final lint fix. Build retains the repository's large-chunk warning; database migration skips locally because `DATABASE_URL` is unset. The broader 1966–2020 `scripts/realism.test.mjs` run was stopped after more than ten minutes without completion, so that full sweep remains unverified for this change.

## Update (modern halfback yards-per-carry calibration)

A phase-matched four-seed 2024 audit found RB carry volume within 1% of recorded regular-season volume, but simulated RB efficiency averaged 4.55 YPC versus 4.37 historically. A candidate substitution change increased yardage without improving the lead-back carry distribution, so it was discarded. The accepted correction reduces expected gain by 0.18 yards only for RBs in 2020 and later; QB rushing and all earlier eras retain their own curves. The 2024 regular-season test reads completed regular-game box scores before playoffs begin, preventing postseason data from contaminating the historical comparison. No save fields, player history, or Record-mode results changed.

Validation: `scripts/rb-rushing-modern.test.mjs` passes across four 2024 regular seasons: 11,966 RB attempts per season (1.01x historical), 52,664 yards, and 4.40 YPC vs historical 4.37. `scripts/substitution-rotation.test.mjs` passes all 10 checks; `npm run typecheck`, targeted ESLint, `git diff --check`, and `npm run build` pass. The build retains the existing large-chunk warning; local migration skips because `DATABASE_URL` is unset. This calibration is validated for 2024 only; other modern seasons and individual back distributions remain for follow-up.

## Update (complete optional offline archive)

The full-offline manifest omitted 60 lazy historical season chunks (45.5 MB uncompressed), so the service worker could report a complete download while Record mode lacked historical box scores on a fresh offline device. The manifest now includes all JavaScript chunks as optional-download files while retaining the static-dependency graph as the startup precache. This adds no startup downloads; the full offline library reports the larger archive size and downloads it only when requested. No game saves or historical source data changed.

Validation: `scripts/offline-manifest.test.mjs` verifies year chunks are downloadable but absent from startup precache; `scripts/offline-service-worker.test.mjs` passes the full download/retry flow. Production build confirms 60 historical year chunks (45,508,403 bytes) are included among 121 optional files, none in the 16-file / 899,785-byte startup precache. `npm run build`, targeted ESLint, and `git diff --check` pass. The build retains the existing large-chunk warning; local migration skips because `DATABASE_URL` is unset. Offline storage quota varies by browser/device; interrupted or failed asset downloads leave the library incomplete and retryable.

## Update (preserve modern jersey zero in era starts)

Historical era import treated jersey `0` as absent twice: while joining season-wide numbers to opening-week rosters, and while assigning the number to the player. Both checks now distinguish a missing number from valid zero. Added a record-backed era-start regression that injects #0 into a 2024 skill player's season roster record and confirms the saved roster retains it. The shipped history currently has no source roster entries numbered zero, so this test exercises the valid source-data case through the real importer without altering historical data or save format.

Validation at the time: `scripts/jersey-zero-era.test.mjs`, `npm run typecheck`, targeted ESLint, and `git diff --check` passed. Follow-up corrected `scripts/jersey-integrity.test.mjs` to use actual historical era starts instead of repeating the 1966 default roster path. It now audits every active team's unique numbers and legal position bands in 1966, 1972, 1973, 2002, 2015, 2021, 2023, 2024, and 2026. The sample spans the grandfathering baseline, major rule changes, modern zero eligibility, and the latest archived season; years between those checkpoints and generated post-archive seasons are not covered by this integrity sweep.

Follow-up validation: `scripts/jersey-integrity.test.mjs`, `scripts/jersey-zero-era.test.mjs`, and `scripts/era-start.test.mjs` pass (10 tests); `npm run typecheck`, targeted ESLint, `git diff --check`, and production `npm run build` pass. The sampled historical roster sweep takes about 40 seconds on this machine because each checkpoint builds a real era save. Build retains the existing large-chunk warning; local database migration skips because `DATABASE_URL` is unset.

## Update (modern lead-back carry share calibration)

The 2024 four-seed rushing audit now checks each team's lead-back share, top-two share, and count of backs with 50+ attempts, in addition to league attempts and YPC. It showed that aggregate volume was accurate while the lead back averaged only 52.0% of team RB attempts versus 61.0% in the record. The 2020+ lead-back selection weight is now 0.65 (from 0.54); the full-season audit measures 58.3% lead-back share and 89.5% top-two share, with team rushing volume at 1.01x and 4.33 YPC versus 4.37 historically. A proposed RB4 split was rejected after it worsened the number of 50+ carry backs and YPC. No career stats, historical records, or save fields changed.

Validation: `scripts/rb-rushing-modern.test.mjs` now gates workload distribution as well as total attempts and efficiency; it passes across four 2024 seasons (11,942 RB attempts and 51,732 RB yards per season). `scripts/substitution-rotation.test.mjs` passes all 10 tests; TypeScript, targeted ESLint, `git diff --check`, and production build pass. Remaining gap: the lead-back share is still 2.7 points below the historical 61.0%, and the simulation averages 2.94 backs per team with 50+ attempts versus 2.19 historically. This calibration has only been measured for 2024; other modern seasons need separate checks before broadening it.

Follow-up workload audit split carry share by rank. In the current four-seed 2024 sample, RB1/RB2/RB3/RB4+ receive 58.3%/31.2%/8.6%/1.7% of team RB carries, versus 61.0%/25.2%/9.7%/3.3% in the record. The 50+ carry rates by rank are 1.00/1.00/0.81/0.13 per team, versus 1.00/0.94/0.25/0.00. This shows the concentration error is chiefly too much RB2 work and too many teams giving RB3 a 50-carry season; league totals alone hid it. The test diagnostic now reports these ranked splits. No further simulation weight was changed in this follow-up; use the rank-level reference before adjusting the rotation again.

Next calibration step: increased the 2020+ RB1 selection weight from 0.65 to 0.71 after the rank report showed RB1 underused and RB2 overused. In the same four-seed 2024 test, ranked carries shifted to RB1/RB2/RB3/RB4+ = 62.0%/28.9%/7.4%/1.6%; historical remains 61.0%/25.2%/9.7%/3.3%. Team RB attempts remain 1.01x actual and YPC is 4.42 vs 4.37. This better matches RB1 but does not solve overconcentrated RB2/RB3+ distribution; RB3 has 50+ attempts on 0.75 teams per team-season vs 0.25 historically. Validation: four-seed `scripts/rb-rushing-modern.test.mjs` passes, as do `npm run typecheck`, targeted ESLint, `git diff --check`, and production build. Build retains the large-chunk warning; local database migration skips because `DATABASE_URL` is unset. Broader 2020+ seasons remain unmeasured.

Follow-up tested a 2020+ RB3 share scaled by the RB3-to-RB2 running-skill gap, intending to concentrate third-back work on teams with a capable reserve. It was discarded: in the same four-seed 2024 audit, RB3 share moved farther from history (6.8% vs 9.7%), YPC rose to 4.45 vs 4.37, and the 50+ carry frequency improved only from 0.75 to 0.69 teams per team-season (historical 0.25). The experiment did not touch history data or save fields. Retain the validated 0.71 RB1 weight and existing three-back rotation until a stronger model explains the large rank-level concentration gap.

## Update (situational quarterback scrambles)

In 2020+ simulated games, a quarterback's non-sack scramble chance now responds to pass concept depth, third-down distance, and estimated sack pressure. Screens and quick concepts reduce the chance; deeper concepts and third-and-long raise it. The player's mobility still sets the base rate, and pressure's situational multiplier stays bounded. A 1.10 volume normalizer preserves the 2024 league calibration. Pre-2020 chance and volume multipliers return 1.0 because the current data only supports the modern situational calibration. No save schema, historical source data, or Record-mode behavior changed.

Validation: the four-seed 2024 QB audit passes at 9,452 carries and 44,163 yards per season (1.00x actual for both), with 4.67 YPC vs 4.68. The 2016 QB control, 1967–69 rushing-share transition, situational helper tests, `npm run typecheck`, targeted ESLint, `npm run qa:season`, `npm run qa:expansions`, and `npm run build` pass. The 1966 volume test reports 10,585 attempts vs 10,157 (4.2% high, just outside its 4% bound) on this branch and returns the exact same result on clean `origin/main`; this pre-existing control failure is not caused by the modern-only multiplier. Full modern player-by-player scramble rates and other 2020+ seasons remain uncalibrated.

A simpler 1.3× multiplier on the existing 2020+ third-back workload share was also tested and discarded. It produced 62.5%/27.8%/7.6%/1.9% ranked carry shares and 4.43 YPC: it shifted volume away from RB2 but raised RB1 share further and barely changed RB3 share. The simulation's full-season feedback does not follow the isolated selection-weight arithmetic, so do not extrapolate from raw pick weights; re-run the four-seed season calibration for future candidates.

## Update (modern fourth-back relief substitution)

Added a fourth running back from the saved depth chart to the simulation's substitution pool. In 2020+ seasons, on non-passing downs only, RB4 can take a small share from RB2 once the top two have combined for more than 22 carries; the share tops out at 6%. Earlier eras and teams without a healthy fourth back are unchanged. Updated the unit stamina and player-effect pools to include this alternate runner. No save fields, career records, or Record-mode results changed.

Validation: `scripts/substitution-rotation.test.mjs` passes all 11 tests, including depth order, era gate, workload threshold, and share cap. TypeScript, targeted ESLint, and `git diff --check` pass. Four-seed 2024 regular-season audit passes with 12,131 RB attempts (1.03x historical), 4.47 YPC vs 4.37, and ranked carry shares 62.5%/27.6%/7.7%/1.9% vs 61.0%/25.2%/9.7%/3.3%; 50+ carry backs by rank are 1.00/1.00/0.72/0.13 vs 1.00/0.94/0.25/0.00. This modestly improves RB2/RB3/RB4+ ranked shares but pushes RB1 slightly high and does not close the RB4+ or 50-carry gaps. A stronger 12% RB4 setting was rejected after it lowered RB3 share to 6.9%, raised the team average to 3.00 backs with 50+ carries, and did not improve RB4+ share. The retained change is a limited substitution improvement, not a full rushing-distribution fix. Only 2024 has been measured; other modern seasons remain unverified.

## Update (hurry-up substitution-window enforcement)

Defensive personnel changes now wait for a legal substitution opportunity. A hurry-up snap keeps the defense in its current package, so a base defense cannot switch into nickel and a nickel defense cannot be swapped out mid-hurry-up. Hurry-up snaps no longer consume the defensive-line relief cadence; they also preserve an already active two-snap relief window until the next substitution opportunity. This corrects the previous mismatch where the cadence counted every snap while actual personnel changes were paused. No save schema or recorded-history data changed.

Validation: `scripts/substitution-rotation.test.mjs` passes all 12 checks, including personnel lockout and paused/resumed rotation cadence. `node scripts/qa-season.mjs`, `npm run typecheck`, targeted ESLint, and `git diff --check` pass. Production build remains to be rerun after this simulation change; historical matchups and real-game substitution timing are not separately calibrated in the current tests.

## Update (defensive tendency recognition by coordinator)

A defense whose call sheet is balanced now tracks the opponent's last 12 designed run/pass calls during a simulated game. After at least eight calls, it can tilt run or pass focus when one tendency clears a recognition threshold set by the defensive play-caller's rating. Higher-rated callers recognize a pattern at a lower threshold. The automatic adjustment applies half the normal focus edge, avoiding a full-strength counter after a brief sample. An explicit run/pass focus from the coach or owner is preserved. This applies only to simulated games; Record mode remains exact. No save fields or historical source data changed.

Validation: all 13 `scripts/substitution-rotation.test.mjs` tests pass, including coach-rating recognition, explicit-focus preservation, and eight-seed stamina share comparisons. The four-seed 2024 RB season audit passes at 12,083 RB attempts (1.02x historical), 4.48 YPC vs 4.37, and 2.91 teams with a 50+ carry back vs 2.19 historical. Ranked shares remain imperfect at 63.2%/27.7%/7.5%/1.4% versus 61.0%/25.2%/9.7%/3.3%. An earlier, lower recognition threshold raised the 50+ back rate to 2.97 and failed its tolerance; the more conservative threshold is retained. `node scripts/qa-season.mjs`, `npm run typecheck`, targeted ESLint, and `git diff --check` pass. Production build is the remaining check for this change. The tendency thresholds are calibrated only against the current 2024 regression and still need multi-era validation.

## Update (modern quarterback scramble yardage)

Reduced the open-field scramble mean for 2020+ quarterbacks from `era.ypc + 1 + speed/20 + agility/40` to `era.ypc + 0.7 + speed/25 + agility/50`. This preserves the mobility advantage while lowering the average scramble gain to better match archived QB efficiency. Designed runs, carry frequency, pre-2020 behavior, saves, and Record mode are unchanged. Four-seed 2024 regular-season testing produced 9,699 QB carries (1.03x historical), 45,647 yards (1.04x), and 4.71 yards per carry versus 4.68 historical. `scripts/qb-rushing-modern.test.mjs`, typecheck, targeted ESLint, `git diff --check`, and `npm run build` pass. QB efficiency has been calibrated against the 2024 league aggregate; player-level scramble style and other modern seasons still need separate validation.

Follow-up tested moving the modern RB3 activation threshold from 16 to 12 combined RB1/RB2 carries, leaving earlier eras unchanged. With the current QB scramble tuning, the four-seed 2024 baseline is 7.6% RB3 share, 2.84 teams with a 50+ carry back, and RB3 itself reaching 50+ carries on 0.69 teams per team-season. The earlier threshold raised RB3 share to 8.4% (historical 9.7%) but also raised those counts to 3.13 and 0.91 (historical 2.19 and 0.25), failing the workload-shape tolerance. The candidate was reverted; no RB simulation changes from this experiment remain. Rotation tests pass and the current-baseline four-seed RB audit passes its existing gates. Next tuning should explain why RB3 workload is concentrated across teams before changing its activation threshold again.

## Update (branded recovery for failed game screens)

Wrapped the routed game UI in a React error boundary. If a lazy-loaded presentation screen or another route render fails after the automatic stale-chunk recovery, the game now shows an accessible, branded reload screen with a clear explanation and save-preservation reassurance instead of the host's generic module error view. The reload action clears only the one-shot session recovery throttle before retrying; it does not touch dynasty storage or alter save/history data.

Validation: `scripts/app-error-boundary.test.mjs`, targeted ESLint, `npm run typecheck`, `npm run qa:season`, and `npm run build` pass. The test verifies React's error-to-fallback state and the save-safe recovery copy. The production build preview returned HTTP 200 on desktop and mobile with no browser errors or horizontal overflow. A forced lazy-chunk failure was not exercised through the full game interaction flow. The expansion QA and multi-season UI routes remain unrerun for this UI-only change.
