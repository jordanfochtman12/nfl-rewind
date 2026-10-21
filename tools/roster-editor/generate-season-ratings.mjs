import * as G from "../../src/lib/game/index.ts";
import { writeFileSync } from "node:fs";
import { playerFor } from "../../src/lib/game/historyMode.ts";
import { rateReal } from "../../src/lib/game/eraStart.ts";
const history = await G.loadHistoryData();
G.setHistoryData(history);
const out = {};
for (let year=1966; year<=2026; year++) {
  const save = G.createEraGame({userTeamId:"pit", startingYear:year, sandbox:true, seed:42});
  const players = {};
  for (const [team, roster] of history.rosters(year)) for (const {person} of roster) {
    const id = `r-${person.toString(36)}`;
    if (!save.players[id]) rateReal(save, playerFor(save, person, year, team), year);
    const p = save.players[id];
    if (p) players[id] = { o:p.ovr, pot:p.potential, pos:p.pos, ratings:p.ratings };
  }
  out[year] = players;
  console.log(`${year}: ${Object.keys(players).length}`);
}
writeFileSync("tools/roster-editor/generated-season-ratings.json", JSON.stringify(out));
