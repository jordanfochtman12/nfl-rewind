**SOURCE OF TRUTH:** https://github.com/jordanfochtman12/nfl-rewind
Clone that repo first. Do not rebuild from chat.

# COPY EVERYTHING BELOW THIS LINE INTO A NEW AGENT CHAT

**Where to paste this:** a new **Grok Build** (or Cursor / Claude Code) session that has the `/workspace` filesystem. Do **not** paste this into Gemini, ChatGPT, or any phone chatbot — they cannot read the repo or run `npx tsc`.

You are continuing **NFL Rewind** inside an existing Grok Build / app-builder sandbox (`/workspace`). Do not scaffold a new app from scratch. Do not switch to Next.js. Do not start the dynasty in 1980.

## Read first (in this order)

1. `/workspace/AGENTS.md` — platform (TanStack Start, Vite, port **8080**, `startup.sh`, brand lock, no shadcn CLI).
2. `/workspace/AGENTS.project.md` — **game contract** (1966 start, expansions that actually move players, QA scripts, AFL/NFL labels).
3. `/workspace/HANDOFF.md` — honest status, file map, landmines, next work.
4. `/workspace/docs/ERA.md` and `/workspace/docs/EXPANSIONS.md`.

## What this is

Single-player historical NFL **dynasty GM** sim. Pitch: **Start in 1966. Draft the real classes. Rewrite football history.** Engine is React-free TypeScript in `src/lib/game/` (imports use `.ts` extensions so Node QA can load it). UI is `src/components/game/GameApp.tsx` + Zustand `src/lib/game-store.ts`. Brand assets already exist (`public/og.jpg`, `x-banner.jpg`, `favicon.svg`, `src/lib/og/site.json` type `x:game`).

## Current truth

Playable GM sim. SAVE_VERSION **13**. Drive engine is era-shaped and QA-green. Winter nights, franchise book, FA week, camp, Sunday film that stays, trade deadline, desk holes, expansion night, IndexedDB + compact, letter grade through 2027.

`npx tsc --noEmit`, `node scripts/qa-season.mjs`, `node scripts/qa-expansions.mjs` must stay green. Do not rewrite the drive engine. Auth/db stay OFF.

Your job: play the product, polish, and only then add new systems. Do not rewrite the architecture.

## First commands

```bash
npx tsc --noEmit
node scripts/qa-season.mjs
```

Fix failures at the source (`src/lib/game/**`). Known likely issues:

- `originalLeague` used by GameApp but maybe not re-exported from `src/lib/game/index.ts`
- missing `public/logos/{id}.svg` (generate from `TEAM_META` in `teams.ts`)
- `simUntil` stall if a phase doesn’t advance under `{ auto: true }`
- expansion order: year++, apply expansion, **then** fillRoster + college draft
- QA scripts re-exec with `node --experimental-strip-types` and `import("../src/lib/game/index.ts")`

Then:

```bash
node scripts/qa-expansions.mjs   # CPU-sims 1966→2002; must actually create clubs
ls public/og.jpg public/favicon.svg
# start preview on 8080 (see AGENTS.md: bash startup.sh or npm run dev)
```

## Hard product rules (do not violate)

- Default start **1966**, 24 clubs (15 NFL + 9 AFL). No Ravens in 1966. CLE stays Cleveland; `rav` is a **1996** club.
- Expansions **move real players**, assign historical coaches, fill ≥40 bodies with **full attribute kits**, rebuild schedule the same offseason: 1967 NOR (Tom Fears), 1968 CIN (Paul Brown), 1970 merger labels AFC/NFC, 1976 TAM+SEA, 1995 CAR+JAX, 1996 CLE inactive + RAV, 1999 CLE return ≠ clone of RAV ids, 2002 HTX 32 teams and SEA NFC West.
- Ratings are attributes that feed the sim. `ovr` is derived. 1966 passing volume/INT rates must look like the 1960s. No 111-catch TEs, no 40-sack seasons in 1966.
- Super Bowl is an event (SB I = Los Angeles Memorial Coliseum). Pro Bowl after awards, before retirement. Week label must match phase (never “Playoffs” on Pro Bowl).
- Title screen: Export / Import dynasty JSON. Team select grouped **AFL / NFL** in 1966.
- No player photographs. Palette: ink `#0c0d0b`, cream `#ebe4d4`, field `#3f6b4e`, brick `#8f3d32`.

## When you change behavior

Update `AGENTS.project.md` and `HANDOFF.md`. Commit often as `feat(expansion): 1967 Saints allocation draft`. Repo name `nfl-rewind`. Never commit secrets.

## Done means

- Title → pick Green Bay → 1966 draft board with Nobis-class names → sim at least one regular-season week without crash
- `node scripts/qa-season.mjs` and `node scripts/qa-expansions.mjs` exit 0
- `npx tsc --noEmit` exit 0
- Preview on port 8080
