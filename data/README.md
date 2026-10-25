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
| `data/history/pfa/YYYY.csv` | Pro Football Archives team-season stat tables (rosters with games played, offense, interceptions, sacks from 1970, fumbles, kicking, punting, returns; from 1999 tackles, passes defensed, QB hits, tackles for loss, forced fumbles and targets too), extracted by `scripts/fetch-pfa.py` | 1920–2025 |
| `data/history/pfa_ids.csv` | Archive player id → History person, written by `ingest-history.py` | 1966–2025 |
| `data/history/pfa_box_links.txt` | Every 1966–1998 box-score page the cached team pages link to | 1966–1998 |
| `data/history/wiki/*.wikitext` | Wikipedia award and Hall of Fame pages | 1966–2026 |
| `data/history/trades.csv` | nflverse trades (players and picks, by date) | 2002–2025 |

History mode replays the real league from these (plus the playoff games and drafts above).
Head coaches come from the archive's team pages through 1998 (with each coach's games when a
club changed midseason) and from the nflverse game file's sideline coaches from 1999.
Rebuild its tables:

```
python3 scripts/ingest-history.py
```

That writes `src/lib/game/data/history/*.ts`, loaded on demand when History mode opens.
Nothing is estimated: a stat with no source is left out and shows as —. Before 1999 there
are no tackles or forced fumbles, and before 1970 no sacks; sacks before 1982 are
researchers' film counts (the league made them official in 1982). Where PFR's tables and
the archive both have a passing, rushing or receiving number, PFR's is used.

Refresh the archive tables (polite: one request at a time, raw pages cached in the
git-ignored `data/history/pfa_html/`):

```
python3 scripts/fetch-pfa.py 1920 2025
```

From 1999 the archive's official season lines replace nflverse's play-by-play totals, which
drift a little (Drew Brees's 2011: 5,535 against the official 5,476); nflverse fills only what
the archive lacks. Seasons before 1966 are read only for the careers and records standing when
the record starts.

### Box scores, records and ledgers

```
python3 scripts/fetch-pfa-box.py 1966 2025   # every game's box score page, cached gzipped in data/history/pfa_box/ (git-ignored)
python3 scripts/ingest-boxscores.py          # -> src/lib/game/data/history/box/YYYY.ts, one module per season, loaded when that season is on screen
python3 scripts/ingest-record-moments.py     # -> recordMoments.ts: when each all-time record fell (needs the box scores)
python3 scripts/ingest-before-1966.py        # -> before1966.ts: every franchise's record and every series, 1920-1965 (FiveThirtyEight game file)
```

A box score is the game as the archive has it: date, venue, attendance, weather, the score by
quarter, every scoring play, the starting lineups, team stats and every player's line. History
mode sums them into running season lines while a season is on, and the official season line
replaces the sum when the regular season closes.
