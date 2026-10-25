import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { clamp, rand, randInt } from "./rng.ts";
import { maybeReveal } from "./scout.ts";
import { coachKitBoost } from "./coachKit.ts";
import { coachDevelopmentFactor, developmentCoordinator } from "./coachDevelopment.ts";
import { arcRetiresNow, moveToward } from "./careerArc.ts";
import { ageBody } from "./body.ts";
import { deriveOvr } from "./ratings.ts";

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
  // A year older: the legs, the strength and the wear move on their own clock first.
  const beforeBody = p.ovr;
  ageBody(p, p.age);
  p.ovr = deriveOvr(p.pos, p.ratings);
  const bodyMove = p.ovr - beforeBody;

  const peak = PEAK[p.pos];
  const cliff = CLIFF[p.pos];
  const pot = p.potential ?? p.ovr;
  const team = p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? save.teams[p.teamId] : undefined;
  const hc = team?.coachId ? save.coaches[team.coachId] : undefined;
  const coordinator = team ? developmentCoordinator(save, p.teamId as TeamId, p) : undefined;
  const devBump = coachDevelopmentFactor(hc, coordinator) - 1;
  if (!p.arc) {
  // Players without a historical trajectory use the offseason age/potential development path.
  let delta = 0;
  // A young player grows by how far he still has to go, the way a real draftee climbs his arc:
  // a raw first-rounder with a big ceiling makes most of the jump in his first three or four
  // years. A point or two a year left the scouts' classes well short of their ceilings at 28.
  const room = pot - p.ovr;
  const climbing = p.age < peak && room >= 3 && p.teamId !== "fa";
  if (climbing && rand(save) < 0.85 + devBump) {
    // Practice develops a prospect too: benched behind veterans, the first scouts-built classes
    // took five years to make a star and the league went through a lean stretch after 2026.
    // A blue-chip ceiling gets reached: at a third of the gap a year a 92 prospect topped out
    // near 88 by the time he peaked, and once the record ran out the league had four 90s.
    // Everyone else climbs at the usual pace (all of them faster crowded the league with 80s).
    const chip = pot >= 88 ? 1.3 : 1;
    const pace = (starter ? 0.38 : gp >= 3 ? 0.35 : 0.31) * chip * (0.6 + rand(save) * 0.8);
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
  // The year's change is the whole of it: what the body already gave or took comes off the
  // skills' share, so aging isn't counted twice.
  delta -= bodyMove;

  // The year's change lands in full: skills carry it now that the body ages on its own (a
  // single skill step moved a speed position's overall about half as far, and the scouts'
  // 90-plus prospects stalled in the mid-80s).
  if (delta !== 0) moveToward(p, p.ovr + delta);
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
    if (p.age >= 48) return true;
    if (p.age >= 44 && p.ovr < 85 && rand(save) < 0.45) return true;
    if (p.age >= 41 && p.ovr < 78 && rand(save) < 0.35) return true;
    if (p.age >= 37 && p.ovr < 72 && rand(save) < 0.4) return true;
    return false;
  }
  if (p.pos === "RB" && p.age >= 31) {
    // A productive back can outlast his real career, but age and accumulated carry load still
    // matter. The old rule only exposed low-rated backs to retirement risk, allowing an elite
    // runner to stay productive into his 40s and build runaway career totals. Exceptional
    // overall creates a modest grace period rather than immunity from the age curve.
    const lastCarries = p.stats[save.year - 1]?.rushAtt ?? 0;
    const careerCarries = Object.values(p.stats).reduce((total, season) => total + (season.rushAtt ?? 0), 0);
    const ageRisk = Math.min(0.9, 0.18 + (p.age - 31) * 0.16);
    const workloadWear = clamp((lastCarries - 200) / 2000, 0, 0.1);
    const careerWear = clamp((careerCarries - 3000) / 8000, 0, 0.18);
    const performanceGrace = p.ovr >= 90 ? 0.1 : p.ovr >= 82 ? 0.05 : 0;
    if (rand(save) < clamp(ageRisk + workloadWear + careerWear - performanceGrace, 0.03, 0.95)) return true;
  }
  if (p.age >= 44) return true;
  // Aging changes the odds; sustained high-level play can keep a veteran in the league longer.
  if (p.age >= 41 && p.ovr < 88 && rand(save) < 0.5) return true;
  if (p.age >= CLIFF[p.pos] + 1 && p.ovr < 84 && rand(save) < 0.45) return true;
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
