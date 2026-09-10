# Historical schedules

Schedules are source data, not generated matchups. The engine reads normalized `HistoricalGame` records from `src/lib/game/schedules.ts` and emits `week:away@home` identifiers into the save.

The first catalog slice is the 1966 NFL Week 1 and Week 2 schedule, transcribed from [Pro-Football-Reference](https://www.pro-football-reference.com/years/1966/games.htm). `data/games.csv` is the cached nflverse schedule archive for 1999 onward and is retained as the raw ingest source.

The catalog intentionally exposes coverage through `scheduleCoverage(year)` so incomplete historical years cannot silently masquerade as authentic. Before a season is playable as a historical schedule, ingest every regular-season game, normalize team IDs, validate game counts and home/away uniqueness, then add a QA fixture for that year.

A future ingest script should cache PFR HTML respectfully, parse both NFL and AFL pages for pre-merger seasons, and preserve the source URL per game.
