# Raw dumps (PFR / nflverse / Wikipedia)

Engine catalogs live in `src/lib/game/data/`.

| Path | Source | Years |
|------|--------|-------|
| `data/drafts/draft_picks.csv` | nflverse PFR draft picks | 1980–2026 |
| `data/drafts/wiki/*.wikitext` | Wikipedia draft pages | 1966–1979 |

Rebuild the named-prospect catalog:

```
python3 scripts/ingest-draft-classes.py
```

That writes `src/lib/game/data/draftClassesIngest.ts`. Hand-tuned stars in `draftClasses.ts` / `starProfiles.ts` still win on overall and locked attributes; ingest fills every other historical pick so camp bodies are the exception, not the board.
