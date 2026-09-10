# NFL Rewind

**Start in 1966. Draft the real classes. Rewrite football history.**

Single-player historical NFL dynasty GM simulator. Browser SPA. JSON save export/import.

## For humans

```bash
npm i
npm run dev
```

Then:

```bash
node scripts/qa-season.mjs
node scripts/qa-expansions.mjs
```

This sandbox serves the preview on **port 8080**. Title screen: New dynasty, Continue, Export/Import JSON.

## For the next AI

Copy [`PASTE_NEXT_AGENT.md`](PASTE_NEXT_AGENT.md) into a new chat **in full**. Then read:

1. [`AGENTS.md`](AGENTS.md) — sandbox/platform (do not overwrite with the game contract)
2. [`AGENTS.project.md`](AGENTS.project.md) — game source of truth
3. [`HANDOFF.md`](HANDOFF.md) — status, landmines, next work
4. [`docs/ERA.md`](docs/ERA.md) and [`docs/EXPANSIONS.md`](docs/EXPANSIONS.md)

Engine: `src/lib/game/` (no React). UI: `src/components/game/`.
