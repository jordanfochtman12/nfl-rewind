/** Preserve a real roster's legal modern #0 through the era-start import path. */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createEraGame, loadHistoryData, setHistoryData } from "../src/lib/game/index.ts";

let history;
before(async () => {
  history = await loadHistoryData();
  setHistoryData(history);
});

test("era start preserves jersey zero from the season roster and opening roster", () => {
  const year = 2024;
  const rosters = history.rosters(year);
  const opening = history.opening(year);
  const drafted = new Set(history.drafts(year).map(({ person }) => person));
  let target;
  let teamId;
  for (const [team, players] of rosters) {
    const openers = new Set((opening.get(team) ?? []).map(({ person }) => person));
    target = players.find(({ person }) => {
      const pos = history.people[person]?.pos;
      return openers.has(person) && !drafted.has(person) && ["QB", "RB", "FB", "WR", "TE", "CB", "S"].includes(pos);
    });
    if (target) {
      teamId = team;
      break;
    }
  }
  assert.ok(target, "fixture has a non-rookie skill player on both season and opening rosters");

  const { person } = target;
  const rosterEntry = rosters.get(teamId).find((entry) => entry.person === person);
  rosterEntry.jersey = 0;
  // The season-wide roster carries the number; the opening-week list supplies the roster spot.
  // createEraGame joins the two records to build the actual save roster.
  const save = createEraGame({ userTeamId: teamId, startingYear: year, seed: 202410 });
  const player = save.players[`r-${person.toString(36)}`];
  assert.ok(player, `${history.people[person].first} ${history.people[person].last} is in the imported roster`);
  assert.equal(player.teamId, teamId);
  assert.equal(player.jersey, 0, `${player.firstName} ${player.lastName} keeps legal #0`);
});
