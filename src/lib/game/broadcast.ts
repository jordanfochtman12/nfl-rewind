import type { PlayLog, TeamId } from "./types.ts";

/** Report only the supplied film prefix, never unseen final-game totals. */
export function filmReport(log: PlayLog[], team: TeamId) {
  const snaps = log.filter(
    (p) => p.poss === team && p.snap && !["kneel", "spike"].includes(p.snap.call),
  );
  const runs = snaps.filter((p) => p.snap!.kind === "run");
  const passes = snaps.filter((p) => p.snap!.kind === "pass");
  const sacks = snaps.filter((p) => p.snap!.kind === "sack").length;
  const scrimmage = [...runs, ...passes, ...snaps.filter((p) => p.snap!.kind === "sack")];
  const early = scrimmage.filter((p) => p.down <= 2);
  const successful = early.filter(
    (p) =>
      p.tag !== "to" &&
      p.snap!.kind !== "sack" &&
      p.snap!.yards >= p.togo * (p.down === 1 ? 0.4 : 0.6),
  ).length;
  return {
    runs: runs.length,
    passes: passes.length,
    sacks,
    rushYards: runs.reduce((n, p) => n + Math.round(p.snap!.yards), 0),
    passYards: passes.reduce((n, p) => n + Math.round(p.snap!.yards), 0),
    completions: passes.filter((p) => p.snap!.complete).length,
    explosives: scrimmage.filter((p) => p.snap!.yards >= (p.snap!.kind === "run" ? 10 : 20)).length,
    early: early.length,
    successful,
    recorded: scrimmage.length,
  };
}

/** Centered pressure adjustment keeps the standard dial's existing era calibration. */
export function pressureAdjustment(blitz: "rare" | "normal" | "heavy") {
  return blitz === "heavy" ? 0.018 : blitz === "rare" ? -0.012 : 0;
}
