# Expansions and franchise events

Every expansion **creates the club, assigns a coach, moves real players, fills to a full roster with complete attributes, rebuilds the schedule, and updates standings/playoff math the same offseason.** Labels in the UI are not enough.

Engine: `src/lib/game/expansion.ts` + specs in `src/lib/game/data/expansions.ts`.  
QA: `node scripts/qa-expansions.mjs`.

Timing: after Hall of Fame of year Y, calendar becomes Y+1; if Y+1 is an expansion year the allocation/expansion draft runs **before** the college draft so the new club can pick rookies.

## 1967 — New Orleans Saints (`nor`)

- NFL allocation draft. Coach **Tom Fears**.
- League: 16 NFL + 9 AFL.
- Saints placed in the NFL **Century** Division.
- Each existing NFL club exposes a list; New Orleans picks until the roster is viable, then UDFA/depth fill to ≥40.

## 1968 — Cincinnati Bengals (`cin`)

- AFL allocation draft. Coach **Paul Brown**.
- Bengals in AFL West.
- Same move-and-fill rules on AFL rosters.

## 1970 — Merger (not an expansion)

- AFL + NFL become AFC / NFC. `confLabel(1970) === "AFC" | "NFC"`.
- Colts, Browns, Steelers to AFC. Playoff field becomes 8.
- No new club, no allocation draft. Primetime and standings switch labels the same week.

## 1976 — Tampa Bay Buccaneers (`tam`) + Seattle Seahawks (`sea`)

- Two-club expansion draft. Coaches **John McKay** / **Jack Patera**.
- 1976 placement: tam AFC West, sea NFC West.
- 1977+ : tam NFC Central, sea AFC West (`divisionOf` handles the flip).

## 1995 — Carolina Panthers (`car`) + Jacksonville Jaguars (`jax`)

- Coaches **Dom Capers** / **Tom Coughlin**.
- car NFC West (1995–2001), jax AFC Central.
- 2002 realignment moves car to NFC South, jax to AFC South.

## 1996 — Cleveland Browns deactivate; Baltimore Ravens (`rav`) begin

- Modell move: **CLE history, name, colors stay in Cleveland**.
- `cle` is **inactive** 1996–1998 (`activeTeamIds` omits them; standings and schedule omit them).
- `rav` is a **new 1996 club**, not the 1966 Browns relabeled.
- Roster/staff: players under contract move to Baltimore (same player ids, `teamId` becomes `rav`). Browns franchise record book in History remains under `cle`.
- Coach: Ted Marchibroda (Ravens). Do **not** spawn rav in 1966.

## 1999 — Cleveland Browns return (`cle`)

- Expansion draft. Coach **Chris Palmer**.
- New club, new generated depth ids. Picked veterans keep their existing ids because they moved off *other* rosters.
- Assert: CLE roster player-id set is **not** equal to RAV roster player-id set.

## 2002 — Houston Texans (`htx`)

- 32 teams. Coach **Dom Capers**.
- Realign to 8×4. **Seattle to NFC West.**
- Expansion draft + UDFA fill ≥40.

## Identity relocations (not expansions)

Handled by `locationOf` / `nicknameOf` / `cityOf`, not by creating clubs:

| Year | Id | Change |
|------|----|--------|
| 1971 | nwe | Boston → New England |
| 1982 | rai | Oakland → Los Angeles |
| 1984 | clt | Baltimore → Indianapolis |
| 1988 | crd | St. Louis → Phoenix |
| 1994 | crd | Phoenix → Arizona (name) |
| 1995 | ram | Los Angeles → St. Louis |
| 1995 | rai | Los Angeles → Oakland |
| 1997 | oti | Houston Oilers → Tennessee Oilers |
| 1999 | oti | Titans name |
| 2016 | ram | St. Louis → Los Angeles |
| 2017 | sdg | San Diego → Los Angeles |
| 2020 | rai | Oakland → Las Vegas |
| 2020 | was | Redskins → Football Team |
| 2022 | was | Commanders |

## Allocation / expansion draft rules (engine)

1. Identify the source pool: NFL clubs for Saints; AFL for Bengals; all active for later two-club drafts; all active except the new club for Texans/Browns return.
2. Each source club **exposes** `exposedPerClub` players (worst remaining starter-ish by a protected-star rule: never expose the top-3 OVR on the roster).
3. New club(s) pick in snake order up to `picksPerClub`, **moving** `player.teamId`.
4. Fill to `ROSTER_TARGET` (45) with leftover draft-board prospects and era UDFAs. Every body has the full attribute kit.
5. `rebuildSchedule(state)` for the new team count.
6. News item + expansion UI state (exposed lists, pick cap, building roster).

CPU dynasties auto-pick BPA by need. User dynasties pause on `phase === "expansion"` unless `cpuOnly`.
