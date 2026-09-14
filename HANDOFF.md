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
| Staff / careers | **SAVE_VERSION 14.** Coaches have attributes, abilities, age, progression, retirement, firing, HOF. CPU staff + scheme draft + roster management. Player HOF is a production ballot. |
| Saves | **SAVE_VERSION 14.** IndexedDB `nfl-rewind` + compact (strip old film, trim news/tx). localStorage fallback. |
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
  types.ts                SAVE_VERSION=14, TeamId, DynastySave, Coach careers / HOF, CampReport, DeadlineSession, phase complete
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
9. **Brand lock:** ink `#0c0d0b`, cream `#ebe4d4`, field `#3f6b4e`, brick `#8f3d32`. No gold/purple gradients, no neon Madden, no player headshots.
10. **Node QA import:** `scripts/qa-*.mjs` re-spawn with `--experimental-strip-types` then `import("../src/lib/game/index.ts")`. Do not convert the engine to a React package.
11. **CPU will not fire/hire the user’s HC** unless `cpuOnly`. Coordinators still auto-fill if vacant. User HC retirement (age) is allowed — the chair stays empty until they hire.
12. **Do not add playerHof / coach retirement as a new auto phase** — they already run inside retirement / hof. A new phase stalls `qa-expansions`.

---

## Next work (priority order)

1. Injured reserve as a desk decision (not only a report). Waiver morning as a phase. Contract year / tenders once the cap exists (1994+).
2. Keep `tsc` + `qa-season` green after every change. `qa-expansions` when a new auto phase is added.
3. Optional: tighten `ram-2020.svg`. More winter copy. Don't rewrite the drive engine.

---

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

QA: `qa-season` asserts Lombardi kit + age, Halas is old, every 1966 club has HC/OC/DC with abilities, user HC is not auto-fired through Super Bowl I.
