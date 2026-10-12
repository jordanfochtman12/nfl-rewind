import type { DraftSeed } from "./draftClasses.ts";

/**
 * The owner's own class: four small-school players from Somerset County, Pennsylvania, who go
 * undrafted and can turn out to be a lot better than anyone graded them. Their scout grades sit
 * in the low 50s (nobody drafts them); underneath they arrive a solid backup's kit with a
 * starter's ceiling, and grow into it.
 */
export interface FriendSeed extends DraftSeed {
  hometown: string;
  /** The number he wore in college. */
  n: number;
}

export const FRIENDS: Record<number, FriendSeed[]> = {
  2018: [
    {
      f: "Tommy", l: "DeArmitt", p: "WR", c: "IUP", o: 76, r: 0, arch: "slot", ht: 66, wt: 165, fy: 4.45, hometown: "Berlin, PA", n: 11,
      rt: { catch: 81, cit: 73, rrt: 75, rel: 71, speed: 82, accel: 83, agi: 81, awareness: 79, str: 52, stamina: 77, inj: 73 },
    },
  ],
  2019: [
    {
      f: "Jordan", l: "Fochtman", p: "QB", c: "Cal U (PA)", o: 77, r: 0, arch: "scrambler", ht: 69, wt: 185, fy: 4.49, hometown: "Berlin, PA", n: 7,
      rt: { throwAcc: 79, throwPow: 69, throwAwr: 71, rel: 77, speed: 79, accel: 79, agi: 80, elu: 75, awareness: 73, stamina: 75, inj: 71 },
    },
    {
      f: "Austin", l: "Widner", p: "QB", c: "Kutztown", o: 74, r: 0, arch: "manager", ht: 70, wt: 170, fy: 4.81, hometown: "Somerset, PA", n: 12,
      rt: { throwAcc: 80, throwPow: 63, throwAwr: 79, rel: 73, awareness: 81, speed: 66, accel: 63, agi: 63, stamina: 73, inj: 73 },
    },
    {
      f: "Tyler", l: "DeArmitt", p: "RB", c: "IUP", o: 75, r: 0, arch: "receiving-back", ht: 69, wt: 195, fy: 4.44, hometown: "Berlin, PA", n: 22,
      rt: { speed: 82, accel: 81, agi: 77, elu: 73, btk: 69, truck: 63, catch: 75, rrt: 69, awareness: 77, str: 68, stamina: 77, inj: 73 },
    },
  ],
};

export const friendKey = (f: string, l: string) => `${f}|${l}`;
const BY_NAME = new Map<string, FriendSeed>();
for (const list of Object.values(FRIENDS)) for (const s of list) BY_NAME.set(friendKey(s.f, s.l), s);
export const friendOf = (f: string, l: string): FriendSeed | undefined => BY_NAME.get(friendKey(f, l));
