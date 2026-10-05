/**
 * Realism guard. The sim has no hard stat ceilings; leaders and league rates come out of usage
 * tapers and era profiles tuned against the real league, and the award ballots weigh each
 * position against its peers. This plays one dynasty from 1966 (the only way the game starts:
 * real rosters and real draft classes) through 2020 on a fixed seed, then fails if a change
 * drifts the league away from real football:
 *
 * - scoring, completion, interception and sack rates in three windows (1973-77, 1994-98,
 *   2016-20), and league leaders inside the range real seasons have produced;
 * - MVP going to quarterbacks and backs, and Defensive Player of the Year looking like the
 *   real award (mostly pass rushers, linebackers and defensive backs winning their share).
 *
 * Bands are wide on purpose: a tuning change should move numbers within them, a mistake (a
 * cap removed, a weight inverted) should land well outside.
 */
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createNewGame, simUntil } from "../src/lib/game/index.ts";

const LAST = 2020;
const WINDOWS = [
  // Real league: points per team-game, completion %, interceptions per attempt, sacks per team-game.
  { from: 1973, to: 1977, ppg: 19.4, cmp: 0.525, int: 0.048, sacks: null, passYdsFloor: 2400 },
  { from: 1994, to: 1998, ppg: 20.3, cmp: 0.577, int: 0.031, sacks: 2.5, passYdsFloor: 3500 },
  { from: 2016, to: 2020, ppg: 22.6, cmp: 0.628, int: 0.025, sacks: 2.4, passYdsFloor: 4100 },
];
/** No real season has gone past these; the sim may brush a record, never blow through it. */
const CEILING = { passYds: 5900, passTd: 58, passInt: 36, rushYds: 2350, rushTd: 31, rec: 162, recYds: 2150, recTd: 25, sacks: 27, ints: 16 };
const OFFENSE = new Set(["QB", "RB", "FB", "WR", "TE"]);

/** One season's league line, taken when the regular season ends. */
function seasonLine(save, year) {
  const players = Object.values(save.players);
  const sum = (k) => players.reduce((n, p) => n + (p.stats[year]?.[k] ?? 0), 0);
  const top = (k) => Math.max(0, ...players.map((p) => p.stats[year]?.[k] ?? 0));
  const teams = Object.values(save.teams).filter((t) => t.active !== false && t.wins + t.losses + t.ties > 0);
  const teamGames = teams.reduce((n, t) => n + t.wins + t.losses + t.ties, 0);
  return {
    y: year,
    ppg: teams.reduce((n, t) => n + t.pf, 0) / teamGames,
    cmp: sum("passCmp") / sum("passAtt"),
    int: sum("passInt") / sum("passAtt"),
    sacks: sum("sacks") / teamGames,
    leaders: Object.fromEntries(Object.keys(CEILING).map((k) => [k, top(k)])),
  };
}

const lines = [];
const ballots = [];
const doubleJobs = [];

/** Coaches holding more than one post (head coach or coordinator, any club) right now. */
function doubledUp(save) {
  const seen = new Map();
  for (const [id, t] of Object.entries(save.teams)) {
    if (t.active === false) continue;
    for (const [role, c] of [["HC", t.coachId], ["OC", t.ocId], ["DC", t.dcId]]) if (c) seen.set(c, [...(seen.get(c) ?? []), `${id} ${role}`]);
  }
  return [...seen.entries()].filter(([, posts]) => posts.length > 1).map(([c, posts]) => `${save.coaches[c]?.name ?? c}: ${posts.join(", ")}`);
}

before(() => {
  let s = createNewGame({ userTeamId: "pit", startingYear: 1966, cpuOnly: true, seed: 4242 });
  for (let y = 1966; y <= LAST; y++) {
    s = simUntil(s, (x) => (x.year === y && x.phase === "playoffs") || x.year > y || x.phase === "complete");
    if (WINDOWS.some((w) => y >= w.from && y <= w.to)) lines.push(seasonLine(s, y));
    s = simUntil(s, (x) => (x.year === y && x.phase === "awards") || x.year > y || x.phase === "complete");
    const a = s.awards?.year === y ? s.awards : undefined;
    const who = (id) => {
      const p = id ? s.players[id] : undefined;
      return p ? { pos: p.pos, sacks: p.stats[y]?.sacks ?? 0, name: `${p.firstName} ${p.lastName}` } : undefined;
    };
    if (a) ballots.push({ y, mvp: who(a.mvp), dpoy: who(a.defPoy) });
    s = simUntil(s, (x) => x.year > y || x.phase === "complete");
    for (const d of doubledUp(s)) doubleJobs.push(`${y}: ${d}`);
  }
});

for (const w of WINDOWS) {
  test(`realism: ${w.from}-${w.to} plays like the real league`, () => {
    const ls = lines.filter((l) => l.y >= w.from && l.y <= w.to);
    assert.equal(ls.length, w.to - w.from + 1, "every season in the window was played");
    const avg = (k) => ls.reduce((n, l) => n + l[k], 0) / ls.length;
    const report = ls.map((l) => `${l.y}: ${l.ppg.toFixed(1)} ppg, cmp ${l.cmp.toFixed(3)}, int ${l.int.toFixed(3)}, sacks ${l.sacks.toFixed(2)}, leaders ${JSON.stringify(l.leaders)}`).join("\n");

    assert.ok(Math.abs(avg("ppg") - w.ppg) <= 2.5, `points per game ${avg("ppg").toFixed(1)} vs real ${w.ppg}\n${report}`);
    assert.ok(Math.abs(avg("cmp") - w.cmp) <= 0.035, `completion ${avg("cmp").toFixed(3)} vs real ${w.cmp}\n${report}`);
    assert.ok(Math.abs(avg("int") - w.int) <= 0.01, `interception rate ${avg("int").toFixed(3)} vs real ${w.int}\n${report}`);
    if (w.sacks) assert.ok(Math.abs(avg("sacks") - w.sacks) <= 0.7, `sacks per game ${avg("sacks").toFixed(2)} vs real ${w.sacks}\n${report}`);

    for (const l of ls) {
      for (const [k, max] of Object.entries(CEILING)) assert.ok(l.leaders[k] <= max, `${l.y} ${k} leader ${l.leaders[k]} is past anything real (${max})\n${report}`);
      // Leaders shouldn't be flattened either: a too-hard taper reads as a cap.
      assert.ok(l.leaders.passYds >= w.passYdsFloor, `${l.y} passing leader only ${l.leaders.passYds}\n${report}`);
      assert.ok(l.leaders.rushYds >= 1100, `${l.y} rushing leader only ${l.leaders.rushYds}\n${report}`);
      assert.ok(l.leaders.rec >= 60, `${l.y} receptions leader only ${l.leaders.rec}\n${report}`);
      if (l.y >= 1982) assert.ok(l.leaders.sacks >= 12, `${l.y} sack leader only ${l.leaders.sacks}\n${report}`);
    }
  });
}

test("awards: MVP and Defensive Player of the Year go to the positions the real votes favor", () => {
  const report = ballots.map((r) => `${r.y}: MVP ${r.mvp?.name} ${r.mvp?.pos} · DPOY ${r.dpoy?.name ?? "-"} ${r.dpoy?.pos ?? ""} (${r.dpoy?.sacks ?? 0} sacks)`).join("\n");
  const mvps = ballots.filter((r) => r.mvp);
  assert.ok(mvps.length >= LAST - 1966, `an MVP every season\n${report}`);
  const backfield = mvps.filter((r) => ["QB", "RB", "FB"].includes(r.mvp.pos)).length;
  const defense = mvps.filter((r) => !OFFENSE.has(r.mvp.pos)).length;
  assert.ok(backfield >= Math.ceil(mvps.length * 0.85), `MVP went to a quarterback or back ${backfield}/${mvps.length}\n${report}`);
  assert.ok(defense <= 3, `defensive MVPs ${defense}/${mvps.length} (two in the real award's history)\n${report}`);

  // The AP's Defensive Player of the Year starts in 1971.
  const dpoy = ballots.filter((r) => r.y >= 1971).map((r) => r.dpoy);
  assert.ok(dpoy.every(Boolean), `a DPOY every season from 1971\n${report}`);
  const n = dpoy.length;
  // An edge rusher is an end, or an outside linebacker winning it on sacks. The real award:
  // about half to edge rushers, a fifth each to off-ball linebackers and defensive backs.
  const edge = dpoy.filter((d) => d.pos === "DE" || (d.pos === "OLB" && d.sacks >= 8)).length;
  const tackle = dpoy.filter((d) => d.pos === "DT").length;
  const offBallOrDb = dpoy.filter((d) => ["MLB", "CB", "S"].includes(d.pos) || (d.pos === "OLB" && d.sacks < 8)).length;
  assert.ok(edge >= Math.round(n * 0.3) && edge <= Math.round(n * 0.75), `edge rushers won ${edge}/${n} DPOYs\n${report}`);
  assert.ok(offBallOrDb >= Math.round(n * 0.15), `linebackers and defensive backs won ${offBallOrDb}/${n}\n${report}`);
  assert.ok(tackle <= Math.round(n * 0.25), `defensive tackles won ${tackle}/${n}\n${report}`);
});

test("staffs: through every coaching carousel, each coach holds one job", () => {
  assert.deepEqual(doubleJobs, []);
});
