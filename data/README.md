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
