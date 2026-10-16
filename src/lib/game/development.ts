import type { DynastySave, Player, Pos } from "./types.ts";
import { rand, randInt } from "./rng.ts";
import { applyAgeDelta } from "./profiles.ts";
import { maybeReveal } from "./scout.ts";
import { coachKitBoost } from "./coachKit.ts";
import { arcRetiresNow, arcTarget, moveToward } from "./careerArc.ts";

const PEAK: Record<Pos, number> = {
  QB: 30,
  RB: 25,
  FB: 26,
  WR: 27,
  TE: 28,
  LT: 29,
  LG: 28,
  C: 29,
  RG: 28,
  RT: 29,
  DE: 27,
  DT: 28,
  OLB: 27,
  MLB: 28,
  CB: 26,
  S: 28,
  K: 32,
  P: 32,
};

const CLIFF: Record<Pos, number> = {
  QB: 36,
  RB: 30,
  FB: 31,
  WR: 33,
  TE: 34,
  LT: 35,
  LG: 34,
  C: 35,
  RG: 34,
  RT: 35,
  DE: 33,
  DT: 34,
  OLB: 33,
  MLB: 34,
  CB: 32,
  S: 33,
  K: 40,
  P: 40,
};

export function measurables(
  pos: Pos,
  ovr: number,
  speed: number,
  salt = 0,
): { heightIn: number; weight: number; forty: number } {
  const base: Record<Pos, [number, number]> = {
    QB: [75, 215],
    RB: [71, 210],
    FB: [73, 235],
    WR: [73, 195],
    TE: [76, 240],
    LT: [77, 275],
    LG: [75, 265],
    C: [75, 260],
    RG: [75, 268],
    RT: [77, 278],
    DE: [76, 255],
    DT: [75, 280],
    OLB: [74, 230],
    MLB: [74, 235],
    CB: [71, 190],
    S: [72, 200],
    K: [72, 185],
    P: [73, 195],
  };
  const [h, w] = base[pos];
  const heightIn = h + ((salt % 5) - 2) + (ovr >= 90 ? 1 : 0);
  const weight = w + (((salt >>> 3) % 25) - 12) + (ovr >= 88 ? 4 : 0);
  const fortyRaw = 5.18 - speed / 88 - ((salt >>> 8) % 7) * 0.01;
  const forty = Math.round(Math.max(4.26, Math.min(5.28, fortyRaw)) * 100) / 100;
  return { heightIn, weight, forty };
}

export function agePlayer(save: DynastySave, p: Player): void {
  const lastYear = save.year - 1;
  const gp = p.stats[lastYear]?.gp ?? 0;
  const starter = gp >= 8;
  p.age += 1;
  p.yearsPro += 1;
  p.injuredWeeks = 0;
  p.injuryName = undefined;
  // A new season starts everyone off injured reserve (nothing ever took them off before).
  p.onIR = false;
  maybeReveal(p, 0);
  if (p.yearsPro >= 2) p.revealed = true;

  const peak = PEAK[p.pos];
  const cliff = CLIFF[p.pos];
  const pot = p.potential ?? p.ovr;
  const team = p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? save.teams[p.teamId] : undefined;
  const hc = team?.coachId ? save.coaches[team.coachId] : undefined;
  const devBump = hc ? coachKitBoost(hc, "dev") + ((hc.development ?? 70) - 70) / 180 : 0;
  if (p.arc) {
    // Real draftee: follow the career he actually had, with a little week-to-week noise
    // and a small nudge from a good developmental staff - never past his real peak.
    let target = arcTarget(p, save.year - p.arc.dy);
    if (rand(save) < 0.3) target += randInt(save, -1, 1);
    if (devBump > 0 && rand(save) < devBump) target += 1;
    moveToward(p, Math.min(target, pot + 1));
  } else {
  let delta = 0;
  // A young player grows by how far he still has to go, the way a real draftee climbs his arc:
  // a raw first-rounder with a big ceiling makes most of the jump in his first three or four
  // years. A point or two a year left the scouts' classes well short of their ceilings at 28.
  const room = pot - p.ovr;
  const climbing = p.age < peak && room >= 3 && p.teamId !== "fa";
  if (climbing && rand(save) < 0.85 + devBump) {
    // Practice develops a prospect too: benched behind veterans, the first scouts-built classes
    // took five years to make a star and the league went through a lean stretch after 2026.
    const pace = (starter ? 0.38 : gp >= 3 ? 0.35 : 0.31) * (0.6 + rand(save) * 0.8);
    delta = Math.max(1, Math.round(room * pace));
  } else if (p.age < peak - 1 && p.ovr < pot && starter && rand(save) < 0.55 + devBump) delta = randInt(save, 1, 2);
  else if (p.age < peak - 1 && p.ovr < 92 && rand(save) < 0.45 + devBump * 0.5) delta = randInt(save, 1, 2);
  else if (p.age <= peak && starter && rand(save) < 0.28 + devBump * 0.4) delta = 1;
  else if (p.age >= cliff) delta = -randInt(save, 2, 5);
  else if (p.age >= peak + 2 && rand(save) < 0.65) delta = -randInt(save, 1, p.age >= cliff - 2 ? 3 : 2);
  if (p.pos === "RB" && p.age >= 29) delta = Math.min(delta, -1);
  if (!starter && !climbing && p.age < peak && gp < 3 && rand(save) < 0.55) delta = Math.min(delta, 0);
  if (rand(save) < 0.14) delta += randInt(save, -1, 1);
  if ((p.morale ?? 70) < 42 && rand(save) < 0.2) delta = Math.min(delta, 0);
  // A hidden gem climbs fast once he's in a building: two to four a year until he hits it.
  if (p.gem && p.ovr < pot && p.age <= peak + 1 && p.teamId !== "fa") delta = Math.max(delta, starter ? randInt(save, 3, 4) : randInt(save, 2, 3));
  if (p.ovr + delta > pot && delta > 0 && (p.gem || rand(save) < 0.7)) delta = Math.max(0, pot - p.ovr);

  if (delta !== 0) applyAgeDelta(p, delta);
  }
  p.peakOvr = Math.max(p.peakOvr, p.ovr);
  const lead = hc ? ((hc.leadership ?? 70) - 70) / 20 + coachKitBoost(hc, "clutch") * 0.15 : 0;
  p.morale = starter
    ? Math.min(99, (p.morale ?? 70) + 4 + (lead > 0 ? 1 : 0))
    : Math.max(32, (p.morale ?? 70) - (gp === 0 ? 5 : 2));
  if (p.revealed) p.scoutOvr = p.ovr;
}

export function shouldRetire(save: DynastySave, p: Player): boolean {
  // A real player nobody has signed for two straight seasons is done - he stays in the
  // league's history as retired instead of sitting in the free-agent pool forever.
  if ((p.historical || p.classOf) && p.teamId === "fa" && p.yearsPro >= 1 && !p.stats[save.year] && !p.stats[save.year - 1]) return true;
  const real = arcRetiresNow(p, save.year);
  if (real !== undefined) return real;
  if (p.pos === "K" || p.pos === "P") {
    if (p.age >= 48) return true;
    if (p.age >= 42 && p.ovr < 68 && rand(save) < 0.4) return true;
    if (p.age >= 38 && p.ovr < 60) return true;
    return false;
  }
  if (p.pos === "QB") {
    if (p.age >= 44) return true;
    if (p.age >= 39 && p.ovr < 78 && rand(save) < 0.35) return true;
    if (p.age >= 37 && p.ovr < 72 && rand(save) < 0.4) return true;
    return false;
  }
  if (p.age >= 39) return true;
  // Past his position's cliff only a star hangs on: real careers rarely run to 34.
  if (p.age >= CLIFF[p.pos] + 1 && p.ovr < 84 && rand(save) < 0.45) return true;
  if (p.pos === "RB" && p.age >= 32 && p.ovr < 76 && rand(save) < 0.45) return true;
  if (p.age >= 34 && p.ovr < 70 && rand(save) < 0.4) return true;
  if (p.age >= 31 && p.ovr < 64 && rand(save) < 0.22) return true;
  if ((p.morale ?? 70) < 28 && p.age >= 30 && rand(save) < 0.2) return true;
  if (p.teamId === "fa" && p.age >= 32 && p.ovr < 68 && rand(save) < 0.25) return true;
  return false;
}


export function formatHt(inches?: number): string {
  if (!inches) return "—";
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}
