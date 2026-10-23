# NFL Rewind — game contract

Read this before editing the dynasty engine or UI. Sandbox/platform rules live in `AGENTS.md`. This file is the product source of truth.

Pitch: **Start in 1966. Draft the real classes. Rewrite football history.**

Single-player historical NFL dynasty GM simulator (Front Office Football + history almanac, not Madden). Browser SPA. Dynasty save is JSON the user can export/import. Engine lives in `src/lib/game/` with **no React**. UI lives in `src/components/game/`.

## Constants

- `STARTING_YEAR = 1966` (Super Bowl I era). Configurable, default 1966. Do not start in 1980.
- Play through ~2027 and grade the dynasty.
- `SAVE_VERSION` integer. Every schema change bumps it. `hydrateSave()` fills missing fields. Never break old dynasty JSON silently.

## Season loop

preseason (camp) → regular season weeks (waiver review when claims are available) → **trade deadline week** → playoffs → Super Bowl event → awards night → Pro Bowl night → retirement ceremony → Hall of Fame → **coaching carousel** → **relocation (if that year)** → **expansion (if that year)** → pre-draft special → draft → free agency night → next season.

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

The game engine is a **situational drive sim**, not a box-score blender. Play calling, clock, penalties, turnovers, special teams, and venues must look like the year on the calendar:

- Passing targets honor depth-chart substitutions. A healthy WR4 can enter a three-wide offense's target mix after the top three accumulate work; RB2 shares the existing era-specific running-back target allocation, with a smaller role in early eras. These affect simulated games only; Record mode remains the real box-score replay.
- In 1990+ simulated games, obvious pass situations can use nickel personnel when a healthy CB4 is on the depth chart: the fourth corner replaces one linebacker, chosen from the two best coverage linebackers. Personnel follows down, distance, and offensive tendency before the play call is known. Historical Record mode remains exact.
- The season rushing-pace taper applies across RB1, RB2, RB3, fullback, quarterback, and emergency receiver carries. Do not let a depth role bypass the same season-long usage feedback; keep early-era QB/FB rushing calibration and career-tail realism covered when changing it.
- For standalone audits after 1966, use `createEraGame()` and `setHistoryData()` to load that season's real roster; `createNewGame({ startingYear })` still starts with the 1966 veteran pool. Modern QB run changes need full-season attempt, total-yards, and yards-per-carry comparisons against actual-year rosters, with an earlier-era control.
- Player stamina scales sustainable rushing workload across those roles, including RB2. Keep depth-chart stamina meaningful and covered by a same-seed simulated carry-share test.
- Defensive tackle stats include a second defender on a calibrated share of completed runs/catches. Keep tackle attribution position-weighted, test against historical defensive totals, and use its own deterministic stream so stat bookkeeping does not shift gameplay RNG.
- Field-goal decision range is era-calibrated separately from kicker accuracy; compare attempts and make rates using actual-year rosters from the historical season archive across early, middle, and modern rule eras.
- Era target weights must track historical position volume. When adjusting a position's share, compare complete season receiving totals across affected eras and retain nearby unaffected eras as controls.
- Accumulated career rushing workload gradually shifts carries toward the depth chart after sustained high volume; preserve player agency (no forced retirement or hard career-stat ceiling) and test the long-run rushing tail.

- 1966 is run-first, ~51% completions, ~5.5% INT, wide hashes, bump-and-run, almost never 4th-and-2.
- Clock stops on first downs through 1973; 1978 chuck rule; 1994 two-point (AFL had it); 2015 extra point from 15 yards.
- Fumbles are recovered ~50/50. Kick-return TDs are rare. Holding and DPI extend or kill drives. Half-distance to the goal. DPI is a spot foul from 1974.
- Indoor stadiums kill weather. Denver is thin air (visitors tire). Loud houses (Kingdome, Arrowhead) false-start the visitors.
- Super Bowl is a **neutral site** (SB I = Coliseum, not the “home” club’s yard). No home-field there.
- Call sheet (attack / fourth / tempo / blitz / red zone) is live. Scheme vs scheme matters (vertical/cover-2, smashmouth/3-4).
- Safety is a free kick from the 20. Kickoff out of bounds is the 40. Blocked punt in the end zone is a safety. End-zone INT is a touchback.
- Playoff football tightens. Replay review 1999+. Tight catch rule 2010–17. Tush-push era sneaks 2022+.

Era caps (1966–70 especially):

- Passing volume and completion % much lower than 2020s.
- Sacks, INTs, rush TDs, TE catches must look like that decade.
- Forbidden shapes: 40 sacks, 17 INTs, 28 rush TDs, 111-catch TEs — even in 1980, especially 1966.

Seed 1966 veterans from real 1966 rosters (Starr, Unitas, Namath, Sayers, Butkus, Dawson, Alworth, Nitschke, etc.). Exclude 1966 draftees from the veteran file so they appear on the draft board.

Draft catalogs: real 1966–2026 classes ingested from Wikipedia (1966–1979) and nflverse/PFR (1980–2026). Rebuild with `python3 scripts/ingest-draft-classes.py`. Hand-tuned stars in `draftClasses.ts` / `starProfiles.ts` win on overall and locked attributes. Fill leftover slots with generated prospects that still have full attribute kits.

Career arcs are historical priors, not scripts: they inform entry talent and initial potential, but never impose a real-life final season or fixed rating path in the dynasty or Watch simulation. Progression and regression resolve after each simulated regular-season and playoff week from age, position, workload, opportunity, coaching and that week's production relative to peers in the same season. Sustained breakouts can revise a player's ceiling; age changes the odds and rate of decline, while exceptional active players may keep playing past ordinary position-age thresholds. Real History mode remains an exact record and never runs the development model.

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

Coaches have attributes (offense, defense, leadership, development, evaluation), abilities/traits that feed the sim, age, progression/regression, retirement, and a Hall of Fame ballot (3-year wait after they leave the sideline). CPU clubs fire/hire HC/OC/DC, draft to scheme, and manage roster holes. CPU will not fire or hire the user’s head coach. Players retire (kickers and quarterbacks last longer) and wait 5 years for Canton; the ballot is career production, not only peak overall.

## UI

- Title: 1966–2027 (or STARTING_YEAR–end).
- Team select grouped by AFL / NFL in 1966 (not AFC/NFC). Club emblems follow the real switch years in `logoSrc` / `LOGO_ERAS` (Pat Patriot → 1993 Elvis → 2000 flip; Oilers derrick until 1999; Chargers powder/navy including the 2007 and 2020 returns; Jets jet → football → NY → football again in 2019).
- Desk chrome follows `teamColors(id, year)` / `clubInk`: header ribbon, active tab, office nameplate, standings hash. 1966 Packers are green and gold; 1966 Patriots are red; Chargers powder vs navy; Rams navy in St. Louis. Title screen stays field green until a club is chosen.
- Stadiums are year-correct (Wrigley then Soldier, War Memorial then Rich, Kezar then Candlestick, Balboa then San Diego Stadium, Anaheim then SoFi).
- Standings use `confLabel(year)` and era divisions.
- Stats UI: filter by team, sortable columns.
- Primetime: sportscast with rotating segments — AFL/NFL (or AFC/NFC) offensive player of the week, transactions, injuries, headlines. Do not repeat the same three lines every week.
- Super Bowl and Pro Bowl are event screens with site, score, MVP, flavor.
- Retirement ceremony and HOF induction are event screens (players and coaches), then written into History.
- Expansion week: show exposed lists, pick cap per club, new club’s building roster.
- Week label must match phase (do not show “Playoffs” on Pro Bowl).
- Title-screen buttons: Export dynasty JSON, Import dynasty JSON.

## Desk, saves, grade

- CPU clubs fill their own holes. **The user roster is not auto-filled after year one.** Cuts and skipped FA stay empty. The office desk reports holes. CPU will not fire or hire your head coach.
- Expansion is a real event screen (exposed lists, pick cap, building roster), then the college draft.
- Awards, Pro Bowl, retirement, Canton, the coaching carousel, and franchise relocations are winter **nights**, not captions.
- Training camp is a cut-down week (CPU trims; the user roster is not auto-cut).
- Sim this Sunday **stays** on the film until Continue — same as the Super Bowl.
- Mid-season trade deadline is a week on the calendar (Rozelle-era copy before 1994). Trades (`executeTrade`) enforce: the 53-man limit on both sides, salary-cap fit on both sides (1994+), and the Rozelle-rule lock (pre-1994 real stars — historical, 4+ years pro, 84+ ovr — don't move) on every player in the deal, not just CPU-generated offers. The window itself closes league-wide once that year's deadline resolves (`tradeWindowOpen`) — the Market tab's trade desk is disabled and CPU-CPU trades stop firing until the next league year. CPU trade AI (`cpuTrades`) mostly runs a buyer/seller model first: contenders (by win% once there's a sample, else roster talent) send a future day-two pick for a proven vet at a real roster hole from a rebuilding club, falling back to a simple value/scheme-fit swap otherwise.
- History is the franchise book: year-by-year W-L, result, coach, draft class, honors — plus the letter grade.
- History is the franchise book: year-by-year W-L, result, coach, draft class, honors — plus the letter grade.
- Free agency is a week with holes and a street list, not only a spreadsheet.
- Waiver claims get a short front-office review after the completed Sunday and before the next week. In auto/CPU-only play, process them without an interactive stop; Record mode must remain an exact replay.
- Injured reserve is a desk decision: placing a hurt player on IR opens his roster spot so you can sign/claim a replacement. Activating him back mid-season only works **2012+** (`canReturnFromIR`) — before that, real NFL IR was season-ending, so he's out for the year once placed.
- Dynasty JSON lives in IndexedDB (`nfl-rewind`) with a localStorage fallback. `compactSave` strips prior-year film and trims the wire so a 1966–2027 file still loads.
- Play through `END_YEAR` (2027). `gradeDynasty` writes a letter (A+–F) from rings, titles, career W-L, HOF, Team of Honor, drafted stars. History shows it live; it locks on phase `complete`.

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

## History mode is its own game

History mode (`save.realHistory`, `src/lib/game/historyMode.ts`, `historyData.ts`, `historyExtras.ts`, the
`data/history/` tables) is a separate game from the dynasty and Watch history. Always treat
the two apart:

- The regular game (dynasty, owner mode, Watch history) never reads History mode's data or
  logic. Don't feed the real record (`loadHistoryData`, `data/history/*`) into the sim,
  ratings, carousel, drafts, awards or UI of the regular game unless the user asks for that
  by name.
- History mode never simulates. Everything it shows is the real record; where the record has
  no number, show — (never a generated or estimated value), and never show the regular
  game's fictions there (grades, kits, contracts, morale, schemes, sim broadcasts).
- A change made for one mode must not change the other. Shared code (stats views, Hall of
  Fame, rosters, profiles) branches on `save.realHistory` or on fields only History mode
  sets (`SeasonStats.unknown`, `Coach.recordFrom`, name-only `HofMember`), so the regular
  game's behavior stays exactly as it was.
- Each mode keeps its own tests: `scripts/realism.test.mjs` and the QA scripts for the
  regular game, `scripts/history.test.mjs` for History mode. The separation test in
  `history.test.mjs` fails if loading History mode's data changes a regular game.
- Ideas and work for one mode are proposed and shipped for that mode alone.

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
- Do not mix History mode (the real record) into the regular game, or the regular game's sim into History mode.
