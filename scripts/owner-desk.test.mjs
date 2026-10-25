/**
 * Owner's desk guard: in an owner's season, calls land between Sundays (never more than one
 * open), every choice resolves into news and a lasting mood, a call left on the desk takes its
 * quiet option, and sandboxes and CPU-only seasons never see one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, createNewGame, decide, openDecisions, simUntil } from "../src/lib/game/index.ts";
import { moraleTarget } from "../src/lib/game/morale.ts";

test("an owner's season puts calls on the desk and every answer sticks", () => {
  let s = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 7 });
  s = simUntil(s, (x) => x.phase === "regular");
  s.crunchOn = false;
  let seen = 0;
  let answered = 0;
  for (let guard = 0; guard < 60 && ["regular", "deadline", "waivers"].includes(s.phase); guard++) {
    s = advance(s, {});
    if (s.phase !== "regular" || !s.weekFilm) continue;
    const open = openDecisions(s);
    assert.ok(open.length <= 1, "one call on the desk at a time");
    for (const d of open) {
      seen += 1;
      assert.ok(d.options.length >= 2 && d.title && d.body);
      // Answer every other one; leave the rest to take the quiet option.
      if (seen % 2) {
        const msg = decide(s, d.id, d.options[0].id);
        answered += 1;
        assert.equal(d.status, "done");
        assert.ok(msg.length > 10);
        for (const pid of d.playerIds) {
          const p = s.players[pid];
          if (p?.moodNote) assert.ok(moraleTarget(s, p).reasons.some((r) => r.text === p.moodNote.text), "the call shows up in his mood");
        }
      }
    }
  }
  assert.ok(seen >= 2, `calls landed this season (${seen})`);
  assert.ok(answered >= 1);
  const done = (s.decisions ?? []).filter((d) => d.year === 1966);
  assert.ok(done.every((d) => d.status === "done" || d.week >= 13), "nothing left hanging from early weeks");
  assert.ok(done.some((d) => d.outcome?.startsWith("Left on the desk")), "an unanswered call took its quiet option");
});

test("no calls in a CPU-only season", () => {
  const s0 = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 3 });
  s0.cpuOnly = true;
  const s = simUntil(s0, (x) => x.phase === "playoffs");
  assert.equal((s.decisions ?? []).length, 0);
});
