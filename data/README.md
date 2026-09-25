# Raw dumps (PFR / nflverse / Wikipedia)

Engine catalogs live in `src/lib/game/data/`.

| Path | Source | Years |
|------|--------|-------|
| `data/drafts/draft_picks.csv` | nflverse PFR draft picks | 1980–2026 |
| `data/drafts/wiki/*.wikitext` | Wikipedia draft pages | 1966–1979 |
| `data/drafts/pfr/*.htm` | PFR draft tables (archive.org) | 1966–1979 |
| `data/drafts/pfr_pre66/*.htm` | PFR draft tables (archive.org), for 1966 veterans | NFL 1936–1965, AFL 1961–1965 |

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
