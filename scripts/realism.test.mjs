/**
 * Realism guard. The sim has no hard stat ceilings; leaders and league rates come out of
 * usage tapers and era profiles tuned against the real league. This plays a few seasons in
 * three eras on fixed seeds and fails if a change drifts the league away from real football:
 * scoring, completion, interception and sack rates by era, and league leaders that stay inside
 * the range real seasons have produced (no 45-interception passers, no 30-sack ends).
 *
 * Bands are wide on purpose: a tuning change should move numbers within them, a mistake
 * (a cap removed, a weight inverted) should land well outside.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil, gamesInSeason } from "../src/lib/game/index.ts";

const ERAS = [
  // Real league: points per team-game, completion %, interceptions per attempt, sacks per team-game.
  { start: 1973, seasons: 5, seed: 731, ppg: 19.4, cmp: 0.525, int: 0.048, sacks: null, passYdsFloor: 2400 },
  { start: 1994, seasons: 5, seed: 942, ppg: 20.3, cmp: 0.577, int: 0.031, sacks: 2.5, passYdsFloor: 3500 },
  { start: 2016, seasons: 5, seed: 162, ppg: 22.6, cmp: 0.628, int: 0.025, sacks: 2.4, passYdsFloor: 4100 },
];

/** No real season has gone past these; the sim may brush a record, never blow through it. */
const CEILING = { passYds: 5900, passTd: 58, passInt: 36, rushYds: 2350, rushTd: 31, rec: 162, recYds: 2150, recTd: 25, sacks: 27, ints: 16 };

function seasonLine(save, year) {
  const players = Object.values(save.players);
  const sum = (k) => players.reduce((n, p) => n + (p.stats[year]?.[k] ?? 0), 0);
  const top = (k) => Math.max(0, ...players.map((p) => p.stats[year]?.[k] ?? 0));
  const teams = Object.values(save.teams).filter((t) => t.active !== false && t.wins + t.losses + t.ties > 0);
  const teamGames = teams.reduce((n, t) => n + t.wins + t.losses + t.ties, 0);
  return {
    ppg: teams.reduce((n, t) => n + t.pf, 0) / teamGames,
    cmp: sum("passCmp") / sum("passAtt"),
    int: sum("passInt") / sum("passAtt"),
    sacks: sum("sacks") / teamGames,
    leaders: Object.fromEntries(Object.keys(CEILING).map((k) => [k, top(k)])),
    games: gamesInSeason(year),
  };
}

for (const era of ERAS) {
  test(`realism: ${era.start}-${era.start + era.seasons - 1} plays like the real league`, () => {
    let s = createNewGame({ userTeamId: "pit", startingYear: era.start, cpuOnly: true, seed: era.seed });
    const lines = [];
    for (let y = era.start; y < era.start + era.seasons; y++) {
      s = simUntil(s, (x) => (x.year === y && x.phase === "playoffs") || x.year > y || x.phase === "complete");
      assert.equal(s.year, y, `reached the ${y} playoffs`);
      lines.push({ y, ...seasonLine(s, y) });
      s = simUntil(s, (x) => x.year > y || x.phase === "complete");
    }
    const avg = (k) => lines.reduce((n, l) => n + l[k], 0) / lines.length;
    const report = lines.map((l) => `${l.y}: ${l.ppg.toFixed(1)} ppg, cmp ${l.cmp.toFixed(3)}, int ${l.int.toFixed(3)}, sacks ${l.sacks.toFixed(2)}, leaders ${JSON.stringify(l.leaders)}`).join("\n");

    assert.ok(Math.abs(avg("ppg") - era.ppg) <= 2.5, `points per game ${avg("ppg").toFixed(1)} vs real ${era.ppg}\n${report}`);
    assert.ok(Math.abs(avg("cmp") - era.cmp) <= 0.035, `completion ${avg("cmp").toFixed(3)} vs real ${era.cmp}\n${report}`);
    assert.ok(Math.abs(avg("int") - era.int) <= 0.01, `interception rate ${avg("int").toFixed(3)} vs real ${era.int}\n${report}`);
    if (era.sacks) assert.ok(Math.abs(avg("sacks") - era.sacks) <= 0.7, `sacks per game ${avg("sacks").toFixed(2)} vs real ${era.sacks}\n${report}`);

    for (const l of lines) {
      for (const [k, max] of Object.entries(CEILING)) assert.ok(l.leaders[k] <= max, `${l.y} ${k} leader ${l.leaders[k]} is past anything real (${max})\n${report}`);
      // Leaders shouldn't be flattened either: a too-hard taper reads as a cap.
      assert.ok(l.leaders.passYds >= era.passYdsFloor, `${l.y} passing leader only ${l.leaders.passYds}\n${report}`);
      assert.ok(l.leaders.rushYds >= 1100, `${l.y} rushing leader only ${l.leaders.rushYds}\n${report}`);
      assert.ok(l.leaders.rec >= 60, `${l.y} receptions leader only ${l.leaders.rec}\n${report}`);
      if (l.y >= 1982) assert.ok(l.leaders.sacks >= 12, `${l.y} sack leader only ${l.leaders.sacks}\n${report}`);
    }
  });
}
