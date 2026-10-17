/**
 * The body ages on its own clock, whatever the overall does. Speed, burst and agility hold
 * through the late twenties and fade from about 29, a point a year and then faster past 32
 * (about a tenth off the forty from 23 to 33); strength keeps building to the late twenties
 * and goes last; stamina and durability wear from about 30. Some men age a year early, some a year late. The overall still follows a
 * player's arc: as the legs go, the reads and the technique carry more of it.
 */
import type { Player, RatingKey } from "./types.ts";

/** What a man is, not how well he plays: these move with age, not with the overall. */
export const BODY: readonly RatingKey[] = ["speed", "accel", "agi", "str", "stamina", "inj"];
export const isBody = (k: RatingKey) => (BODY as readonly string[]).includes(k);

/** Change in each physical rating the year a man turns `age`. */
function yearOf(age: number): Partial<Record<RatingKey, number>> {
  return {
    // About a tenth off the forty from 23 to 33 (seven points), then it goes faster.
    speed: age >= 34 ? -3 : age >= 32 ? -2 : age >= 29 ? -1 : 0,
    accel: age >= 34 ? -3 : age >= 32 ? -2 : age >= 28 ? -1 : 0,
    agi: age >= 33 ? -2 : age >= 29 ? -1 : 0,
    str: age >= 35 ? -2 : age >= 32 ? -1 : age <= 27 ? 1 : 0,
    stamina: age >= 33 ? -2 : age >= 30 ? -1 : age <= 24 ? 1 : 0,
    inj: age >= 32 ? -2 : age >= 29 ? -1 : 0,
  };
}

/** A man's own clock: -1 ages early, +1 late (fixed per player, so a career reads the same every time). */
function clockOf(p: Player): number {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  return (((h % 3) + 3) % 3) - 1;
}

/** Age the body one year, to `age`. */
export function ageBody(p: Player, age: number): void {
  const d = yearOf(age - clockOf(p));
  for (const k of BODY) {
    const v = d[k] ?? 0;
    if (v) p.ratings[k] = Math.max(25, Math.min(99, p.ratings[k] + v));
  }
}

/** Age the body through every birthday after `from`, up to `to`. */
export function ageBodyBetween(p: Player, from: number, to: number): void {
  for (let a = from + 1; a <= to; a++) ageBody(p, a);
}
