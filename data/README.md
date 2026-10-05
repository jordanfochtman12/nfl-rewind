# Raw dumps (PFR / nflverse / Wikipedia)

Engine catalogs live in `src/lib/game/data/`.

| Path | Source | Years |
|------|--------|-------|
| `data/drafts/draft_picks.csv` | nflverse PFR draft picks | 1980–2026 |
| `data/drafts/wiki/*.wikitext` | Wikipedia draft pages | 1966–1979 |
| `data/drafts/pfr/*.htm` | PFR draft tables (archive.org) | 1966–1979 |
| `data/drafts/pfr_pre66/*.htm` | PFR draft tables (archive.org), for 1966 veterans | NFL 1936–1965, AFL 1961–1965 |
| `data/schedules/fivethirtyeight_nfl_games.csv` | FiveThirtyEight game file (NFL + AFL) | 1920–2017 (used 1966–1998) |
| `data/schedules/nflverse_games.csv` | nflverse schedules | 1999–2026 |

Rebuild the named-prospect catalog:

```
python3 scripts/ingest-draft-classes.py
```

That writes `src/lib/game/data/draftClassesIngest.ts`. Hand-tuned stars in `draftClasses.ts` / `starProfiles.ts` still win on overall and locked attributes; ingest fills every other historical pick so camp bodies are the exception, not the board.

Rebuild real career arcs (last season, starter years, Pro Bowls, All-Pros, draft age) for
every draftee plus the 1966 veterans:

```
python3 scripts/ingest-career-arcs.py
```

That writes `src/lib/game/data/careerArcs.ts`, which drives development and retirement
(`src/lib/game/careerArc.ts`). The 1960 AFL draft table isn't reachable through the
archive; most of those players were also taken in the 1960 NFL draft.

Rebuild the real regular-season schedules (opponents, home sites, weeks, dates, TV slots,
neutral sites and the real final scores):

```
python3 scripts/ingest-schedules.py
```

That writes `src/lib/game/data/realSchedules.ts`; `rebuildSchedule` uses it for every season
it covers and only generates a schedule for years past the data (2027).

## History mode

| Path | Source | Years |
|------|--------|-------|
| `data/history/rosters/roster_YYYY.csv` | nflverse rosters | 1966–2025 |
| `data/history/stats/stats_player_reg_YYYY.csv` | nflverse regular-season player stats (offense, defense, kicking, returns) | 1999–2025 |
| `data/history/fdp/YYYY.csv` | Pro-Football-Reference season tables (offense), via fantasydatapros/data | 1970–1998 |
| `data/history/wiki/*.wikitext` | Wikipedia award and Hall of Fame pages | 1966–2026 |
| `data/history/trades.csv` | nflverse trades (not used yet) | 2002– |

History mode replays the real league from these (plus the playoff games and drafts above).
Rebuild its tables:

```
python3 scripts/ingest-history.py
```

That writes `src/lib/game/data/history/*.ts`, loaded on demand when History mode opens.
Nothing is estimated: a stat with no source is left out (completions for 1992–98 are marked
unknown, shown as —). Not yet in the record: individual stats for 1966–69, and defense,
kicking and returns before 1999.
