import type { DynastySave, Player, Pos } from "./types.ts";
import { rand, randInt } from "./rng.ts";
import { applyAgeDelta } from "./profiles.ts";
import { maybeReveal } from "./scout.ts";

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
  maybeReveal(p, 0);
  if (p.yearsPro >= 2) p.revealed = true;

  const peak = PEAK[p.pos];
  const cliff = CLIFF[p.pos];
  const pot = p.potential ?? p.ovr;
  let delta = 0;
  if (p.age < peak - 1 && p.ovr < pot && starter && rand(save) < 0.55) delta = randInt(save, 1, 2);
  else if (p.age < peak - 1 && p.ovr < 92 && rand(save) < 0.45) delta = randInt(save, 1, 2);
  else if (p.age <= peak && starter && rand(save) < 0.28) delta = 1;
  else if (p.age >= cliff) delta = -randInt(save, 2, 5);
  else if (p.age >= peak + 2 && rand(save) < 0.55) delta = -1;
  if (p.pos === "RB" && p.age >= 29) delta = Math.min(delta, -1);
  if (!starter && p.age < peak && gp < 3 && rand(save) < 0.55) delta = Math.min(delta, 0);
  if (rand(save) < 0.14) delta += randInt(save, -1, 1);
  if ((p.morale ?? 70) < 42 && rand(save) < 0.2) delta = Math.min(delta, 0);
  if (p.ovr + delta > pot && delta > 0 && rand(save) < 0.7) delta = Math.max(0, pot - p.ovr);

  if (delta !== 0) applyAgeDelta(p, delta);
  p.peakOvr = Math.max(p.peakOvr, p.ovr);
  p.morale = starter
    ? Math.min(99, (p.morale ?? 70) + 4)
    : Math.max(32, (p.morale ?? 70) - (gp === 0 ? 5 : 2));
  if (p.revealed) p.scoutOvr = p.ovr;
}

export function shouldRetire(save: DynastySave, p: Player): boolean {
  if (p.age >= 39) return true;
  if (p.pos === "RB" && p.age >= 32 && p.ovr < 76 && rand(save) < 0.45) return true;
  if (p.pos === "QB" && p.age >= 37 && rand(save) < 0.28) return true;
  if (p.age >= 34 && p.ovr < 70 && rand(save) < 0.4) return true;
  if (p.age >= 31 && p.ovr < 64 && rand(save) < 0.22) return true;
  if ((p.morale ?? 70) < 28 && p.age >= 30 && rand(save) < 0.2) return true;
  return false;
}

export function formatHt(inches?: number): string {
  if (!inches) return "—";
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}
