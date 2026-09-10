# NFL REWIND

Single-player historical NFL dynasty GM simulator: start in 1966, draft real classes, and rewrite football history.

## Run

```bash
npm i
npm run dev
npm run typecheck
npm run qa:season
npm run qa:expansions
```

The SPA currently includes the title screen, team selection, persistent Zustand save, JSON import/export, a playable weekly sportscast, era/team helpers, named 1966 veterans, draft board, expansion specs, and QA scripts. Super Bowl, Pro Bowl, retirement, HOF, deeper schedules, and complete draft catalogs remain staged for subsequent slices.

## GitHub

```bash
git init
git add .
git commit -m "feat: scaffold NFL REWIND dynasty simulator"
gh repo create nfl-rewind --public --source=. --remote=origin --push
```

No secrets belong in this repository. Use GitHub as the source of truth, then import the repo into Vercel for durable previews.
