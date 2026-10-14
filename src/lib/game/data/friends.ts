import type { DraftSeed } from "./draftClasses.ts";

/**
 * The owner's own class: four small-school players from Somerset County, Pennsylvania, who go
 * undrafted and can turn out to be a lot better than anyone graded them. Their scout grades sit
 * in the low 50s (nobody drafts them); underneath they arrive at the rating set here and can
 * grow all the way to the ceiling. Jordan is a dual threat: a game manager who runs as well as
 * he throws.
 */
export interface FriendSeed extends DraftSeed {
  hometown: string;
  /** The number he wore in college. */
  n: number;
  /** Rating the day he walks in, and how good he can become. */
  start: number;
  ceiling: number;
}

export const FRIENDS: Record<number, FriendSeed[]> = {
  2018: [
    {
      f: "Tommy", l: "DeArmitt", p: "WR", c: "IUP", o: 76, r: 0, arch: "slot", ht: 66, wt: 165, fy: 4.45, hometown: "Berlin, PA", n: 11, start: 73, ceiling: 93,
      rt: { catch: 81, cit: 73, rrt: 75, rel: 71, speed: 82, accel: 83, agi: 81, awareness: 79, str: 52, stamina: 77, inj: 73 },
    },
  ],
  2019: [
    {
      f: "Jordan", l: "Fochtman", p: "QB", c: "Cal U (PA)", o: 77, r: 0, arch: "dual", ht: 69, wt: 185, fy: 4.49, hometown: "Berlin, PA", n: 7, start: 72, ceiling: 94,
      rt: { throwAcc: 82, throwPow: 74, throwAwr: 82, rel: 80, awareness: 82, speed: 82, accel: 82, agi: 82, elu: 82, btk: 74, truck: 66, stamina: 78, inj: 74 },
    },
    {
      f: "Austin", l: "Widner", p: "QB", c: "Kutztown", o: 74, r: 0, arch: "manager", ht: 70, wt: 170, fy: 4.81, hometown: "Somerset, PA", n: 12, start: 70, ceiling: 90,
      rt: { throwAcc: 80, throwPow: 63, throwAwr: 79, rel: 73, awareness: 81, speed: 66, accel: 63, agi: 63, stamina: 73, inj: 73 },
    },
    {
      f: "Tyler", l: "DeArmitt", p: "RB", c: "IUP", o: 75, r: 0, arch: "receiving-back", ht: 69, wt: 195, fy: 4.44, hometown: "Berlin, PA", n: 22, start: 76, ceiling: 95,
      rt: { speed: 82, accel: 81, agi: 77, elu: 73, btk: 69, truck: 63, catch: 75, rrt: 69, awareness: 77, str: 68, stamina: 77, inj: 73 },
    },
  ],
};

export const friendKey = (f: string, l: string) => `${f}|${l}`;
const BY_NAME = new Map<string, FriendSeed>();
for (const list of Object.values(FRIENDS)) for (const s of list) BY_NAME.set(friendKey(s.f, s.l), s);
export const friendOf = (f: string, l: string): FriendSeed | undefined => BY_NAME.get(friendKey(f, l));

export const isFriend = (p: { firstName: string; lastName: string; historical?: boolean }): boolean =>
  !!p.historical && BY_NAME.has(friendKey(p.firstName, p.lastName));

/**
 * One roll per dynasty for each of them, fixed by the save's seed: a one-in-four shot he
 * becomes the player his ceiling says. Otherwise he's what an undrafted small-school player
 * usually is - a few points better than the day he walked in, a backup who sticks.
 */
export function friendBreaksOut(saveSeed: number, f: FriendSeed): boolean {
  let h = 2166136261 ^ saveSeed;
  for (const ch of `${f.f}|${f.l}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) % 4 === 0;
}

/** How good he can get in this dynasty. */
export const friendCeiling = (saveSeed: number, f: FriendSeed): number =>
  friendBreaksOut(saveSeed, f) ? f.ceiling : Math.min(f.ceiling, f.start + 6);
