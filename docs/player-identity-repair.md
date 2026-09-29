# Player identity and crunch-time repair

Historical players now resolve by a cleaned name, explicit draft-class aliases, and the existing career-source draft year. Position is no longer part of the identity. The catalog includes explicit short-form and nickname pairs, including Ed / Too Tall Jones, Carnell / Cadillac Williams, and Ahmad / Sauce Gardner. Generated players and distinct namesakes such as the two 2016 Michael / Mike Thomases are not merged by a generic nickname rule.

Misfiled fill rows are excluded when the career sources identify one unambiguous draft year. Pete Lammons is a 1966 tight end, not a second 1967 player. Opening-year draftees are excluded from the veteran pool. NFL and AFL boards share the same identity exclusion.

## Existing dynasties

Save version 16 repairs on import and reload. The user's roster copy wins ownership ties, followed by another active club, established playing history, the catalog position, and a stable ID. Contract, ratings, position and injury state of that surviving player remain intact. Live duplicate statistics are combined; appearances use the larger count and pre-dynasty historical statistics are not doubled. Different clubs' combined season lines use the existing `two` team marker.

Exact player-ID references in roster/depth, picks, news, awards, film, pending events and transactions are redirected. Box-score lines are combined, duplicate board entries are collapsed, and payroll is recalculated. The original player records (including conflicting versions) are retained in `identityRepairs` in exported saves. Narrative text remains historical text. The dynasty's year, week, scores, draft cursor and RNG are not reset; loading no longer consumes game RNG for jersey repairs. This is a repair of duplicate identities, not a replay of already simulated games.

## Name and field display

The importer and runtime strip quoted and unquoted wiki table attributes, including `bgcolor=#FFCC00|` and `align=left`. Existing malformed first/last splits and the legacy `G Webster` import resolve to historical names. Fractional field spots remain available to the simulation; the crunch-time title, context and choices show whole yards, including old saved prompts.

## Verification

- Eight engine regression tests: screenshot artifacts, alias cases and nonmatches, all 61 draft catalogs, opening rosters/AFL redrafting, legacy repair/reference integrity/stat totals, repeat load/export, and fractional display.
- Three Python importer examples pass.
- TypeScript and targeted ESLint pass.
- Mobile 390x844 and desktop 1440x900 checks use synthetic legacy saves, with duplicate Pete Lammons and Ed/Too Tall Jones, corrupted names, and the supplied 32.349999999999994-yard scenario. No console errors; the roster contains single identities and the prompt reads `4th-and-3 at your own 32`.
- Production build and season/expansion QA results are recorded in the PR.
- The full template script suite has 16 pre-existing failures: missing ignored `.grok` skill/app-env files and generic branding tests expecting template titles instead of NFL Rewind. Reproduced on untouched `a3cc1c1` (179/195 pass) and the repair branch (180/196 pass, including the new engine-test wrapper). No failing checks were suppressed. The test command now quotes its glob correctly on Windows; previously Windows silently ran zero script tests.

Historical cross-checks: [Jets on Pete Lammons](https://www.newyorkjets.com/news/pete-lammons-jets-super-bowl-iii-tight-end-dies-suddenly), [Jets on Ahmad / Sauce Gardner](https://www.newyorkjets.com/news/5-things-to-know-about-jets-top-draft-pick-ahmad-sauce-gardner), [Steelers on Evander / Ziggy Hood](https://www.steelers.com/news/steelers-select-dl-evander-ziggy-hood-in-the-first-round-956310).
