# NFL Rewind — game contract

Read this before editing the dynasty engine or UI. Sandbox/platform rules live in `AGENTS.md`. This file is the product source of truth.

Pitch: **Start in 1966. Draft the real classes. Rewrite football history.**

Single-player historical NFL dynasty GM simulator (Front Office Football + history almanac, not Madden). Browser SPA. Dynasty save is JSON the user can export/import. Engine lives in `src/lib/game/` with **no React**. UI lives in `src/components/game/`.

## Constants

- `STARTING_YEAR = 1966` (Super Bowl I era). Configurable, default 1966. Do not start in 1980.
- Play through ~2027 and grade the dynasty.
- `SAVE_VERSION` integer. Every schema change bumps it. `hydrateSave()` fills missing fields. Never break old dynasty JSON silently.

## Season loop

preseason → regular season weeks → playoffs → Super Bowl event → awards → Pro Bowl → retirement ceremony → Hall of Fame / Team of Honor → **expansion (if that year)** → draft → free agency → next season.

Expansion runs **before** the college draft so new clubs exist for that year’s board (Saints 1967 allocation, then 1967 draft).

## Teams / identity

PFR-style ids: `atl ram pit phi dal was min crd gnb nyg sfo chi cle clt det mia den oti nwe buf nyj rai sdg kan nor cin tam sea car jax rav htx`

1966 active (24):

- NFL: atl ram pit phi dal was min crd gnb nyg sfo chi cle clt det
- AFL: mia den oti nwe buf nyj rai sdg kan

Helpers in `src/lib/game/teams.ts`:

- `conferenceOf(year, id)` / `divisionOf(year, id)` / `confLabel(year)`
  - Pre-1970: conferences are AFL and NFL (UI says AFL / NFL, not AFC / NFC).
  - 1966 NFL: East / West. 1967 NFL four-division split (Capitol / Century / Coastal / Central) with Atlanta already in and Saints in Century.
  - 1970 merger: AFC / NFC, realignment.
  - 2002: 8 divisions of 4, Seattle to NFC West.
- `locationOf(year, id)` / `nicknameOf(year, id)` / `displayName(year, id)`
  - nwe is Boston Patriots through 1970, New England after.
  - rai Oakland until LA years then Oakland then Las Vegas by historical year.
  - ram Los Angeles / St. Louis / LA by year.
  - crd St. Louis / Phoenix / Arizona by year.
  - oti Houston Oilers → Tennessee Oilers → Titans by year.
  - cle stays Cleveland; rav is a new 1996 club (Modell move). Never start the Ravens in Cleveland as the 1966 Browns.
- `gamesInSeason(year)`: 14 through 1977, 16 from 1978–2020 (9 in 1982, 15 in 1987 strike), 17 in 2021+.
- `activeTeamIds(year)` — CLE inactive 1996–1998.

## Playoffs / Super Bowl / Pro Bowl

- Pre-1970: league championship games only (no wild card). Then Super Bowl I (1966 season) onward.
- 1967–1969 NFL: four division winners, conference championships, NFL Championship, Super Bowl. AFL East vs West (1969 AFL four-team).
- 1970–1977: 8-team (divisional + conference + SB).
- 1978–1989: 10-team (wild card).
- 1990–2019: 12-team.
- 2020+: 14-team.

Super Bowl is a full **event screen** (site, MVPs, atmosphere), not just a box score. Sites must be era-correct (SB I Los Angeles Memorial Coliseum, etc.). Almanac is empty at a 1966 start and fills as they play.

Pro Bowl after awards, before retirement:

- AFC vs NFC rosters (AFL/NFL labels pre-1970).
- Grade by pos + season stats + ovr; user stars eligible.
- Exhibition score + MVP + site (Honolulu / Aloha 1980–2009; earlier sites historical).
- Then retirement screen.

Hall of Fame: 5-year wait after retirement. Team of Honor for user-tied stars. History tab lists bowls, HOF classes, Team of Honor.

## Players / ratings / sim

Named historical players whenever data exists. Do not generate “John Smith QB” for stars.

Ratings are ATTRIBUTES that all feed the sim. `ovr` is derived.

```
throwPow throwAcc throwAwr speed accel agi str truck elu btk
catch cit rel rrt passBlk runBlk tak prs cov pur
kickPow kickAcc stamina inj awareness
```

Every rating must change play results. Do not hug overall.

Era caps (1966–70 especially):

- Passing volume and completion % much lower than 2020s.
- Sacks, INTs, rush TDs, TE catches must look like that decade.
- Forbidden shapes: 40 sacks, 17 INTs, 28 rush TDs, 111-catch TEs — even in 1980, especially 1966.

Seed 1966 veterans from real 1966 rosters (Starr, Unitas, Namath, Sayers, Butkus, Dawson, Alworth, Nitschke, etc.). Exclude 1966 draftees from the veteran file so they appear on the draft board.

Draft catalogs: real 1966–2026 classes ingested from Wikipedia (1966–1979) and nflverse/PFR (1980–2026). Rebuild with `python3 scripts/ingest-draft-classes.py`. Hand-tuned stars in `draftClasses.ts` / `starProfiles.ts` win on overall and locked attributes. Fill leftover slots with generated prospects that still have full attribute kits.

**No player photographs.**

## Expansions (must work, not labels)

Each event must: create the club that week, assign a coach, run an allocation/expansion draft that **moves real players off existing rosters**, fill remaining spots with leftover draft + era UDFA each with **full attributes**, rebuild schedule for the new team count, update standings / playoff seeds / UI the same week.

| Year | Event |
|------|--------|
| 1967 | New Orleans Saints. NFL allocation draft. Coach Tom Fears. NFL 16 teams. |
| 1968 | Cincinnati Bengals. AFL allocation draft. Coach Paul Brown. |
| 1970 | Merger (not expansion): AFL + NFL become AFC / NFC. Labels and playoff format change. |
| 1976 | Tampa Bay Buccaneers + Seattle Seahawks. Two-club expansion draft. McKay / Patera. |
| 1995 | Carolina Panthers + Jacksonville Jaguars. |
| 1996 | Cleveland Browns deactivate as CLE; Baltimore Ravens (`rav`) begin. CLE name, colors, history stay in Cleveland. |
| 1999 | Cleveland Browns return via expansion draft. Not a copy of the Ravens ids. |
| 2002 | Houston Texans. 32 teams. Realign 8×4. Seattle to NFC West. |

Also handle identity moves (not expansions): Rams/Raiders/Chargers/Colts/Oilers relocations by year.

CPU clubs make transactions during the year (not only the user).

## Coaches

1966 starters must be historical: Lombardi GB, Stram KC, Shula Baltimore Colts, Ewbank NYJ, Gillman SD, Landry DAL, Halas CHI, etc. Expansion coaches as above. Later hires historical when `yearAvail` hits, else generated.

## UI

- Title: 1966–2027 (or STARTING_YEAR–end).
- Team select grouped by AFL / NFL in 1966 (not AFC/NFC).
- Standings use `confLabel(year)` and era divisions.
- Stats UI: filter by team, sortable columns.
- Primetime: sportscast with rotating segments — AFL/NFL (or AFC/NFC) offensive player of the week, transactions, injuries, headlines. Do not repeat the same three lines every week.
- Super Bowl and Pro Bowl are event screens with site, score, MVP, flavor.
- Retirement ceremony and HOF induction are event screens, then written into History.
- Expansion week: show exposed lists, pick cap per club, new club’s building roster.
- Week label must match phase (do not show “Playoffs” on Pro Bowl).
- Title-screen buttons: Export dynasty JSON, Import dynasty JSON.

## QA — do not ship without this

`scripts/qa-season.mjs`

- `createNewGame(team=gnb, year=1966)`
- assert 24 teams, 14 games each, 1966 draft board has Tommy Nobis-class names (first overall may be auto-picked if user is not Atlanta).
- sim to Super Bowl I. Assert two league champs then a Super Bowl. No crash.

`scripts/qa-expansions.mjs`

Fast-forward a CPU-only dynasty and ASSERT:

- 1967 nor exists, roster >= 40 with attributes, coach set, schedule includes nor
- 1968 cin same
- 1970 labels are AFC/NFC
- 1976 tam and sea same
- 1995 car and jax same
- 1996 rav exists; cle is inactive that year
- 1999 cle exists again and is not a clone of rav ids
- 2002 htx exists, 32 teams, sea in NFC West

Print roster counts and a few named players per new club.

`npx tsc --noEmit` must pass. (`npm run typecheck`)

## Data

Prefer nflverse / PFR (cache HTML, respect rate limits). If you cannot fetch, generate catalogs from well-known historical lists and mark `TODO_INGEST`, but stars of 1966–1979 must be named.

Raw dumps go in `data/`. Engine catalogs in `src/lib/game/data/`.

## Git / repo

Repo name: `nfl-rewind`. Commit often with searchable messages:

```
feat(expansion): 1967 Saints allocation draft
```

Never commit secrets. No old-man player headshots.

## What not to do

- Do not start in 1980 unless STARTING_YEAR is configurable and default is 1966.
- Do not hug overall on every attribute.
- Do not use modern passing stat shape in 1966.
- Do not leave expansion clubs with 15 generated bodies.
- Do not put the Ravens in Cleveland in 1966.
- Do not add player photos of old men.
- Do not hide source only in a minified index.html zip.
- Do not use chat as the source of truth after the first commit.
