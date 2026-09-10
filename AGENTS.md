# NFL REWIND Agent Contract

Read this file before editing. NFL REWIND is a Vite + React + TypeScript single-player historical NFL dynasty GM simulator. The source of truth is GitHub, not chat or localStorage.

- Keep game rules and simulation in `src/lib/game/`; React belongs in `src/components/game/` and `src/App.tsx`.
- Persist saves through Zustand, but support JSON export/import. `SAVE_VERSION` is an integer; every schema change bumps it and `hydrateSave()` fills missing fields without silently breaking old JSON.
- Default `STARTING_YEAR` is 1966. Preserve historical team IDs and named players. Never add old-player photos.
- Expansions must move real players, assign coaches, fill rosters with full attributes, and update schedules/standings/UI.
- Keep era-aware rules: 14 games through 1977, historical conferences/divisions, playoff formats, and era-appropriate stat shape.
- Run `pnpm exec tsc --noEmit`, `node scripts/qa-season.mjs`, and `node scripts/qa-expansions.mjs` before shipping.
- Never commit secrets. Use searchable commits such as `feat(expansion): 1967 Saints allocation draft`.
