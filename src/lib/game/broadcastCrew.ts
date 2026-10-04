/**
 * Who's on the air for a live game and at the draft podium, by era. The game booth is a
 * play-by-play voice and a color analyst; the draft is read by the commissioner of the day.
 */
import type { Gender } from "../voiceCast.ts";

export interface BoothMember {
  name: string;
  gender: Gender;
  /** "former defensive end" — what the color man brings to the call. */
  background: string;
}

export interface Booth {
  pbp: BoothMember;
  color: BoothMember;
}

const BOOTHS: { from: number; to: number; booth: Booth }[] = [
  {
    from: 1966,
    to: 1977,
    booth: {
      pbp: { name: "Lindsey Hale", gender: "m", background: "play-by-play" },
      color: { name: "Pat Ruddock", gender: "m", background: "former defensive end" },
    },
  },
  {
    from: 1978,
    to: 1993,
    booth: {
      pbp: { name: "Dick Morrow", gender: "m", background: "play-by-play" },
      color: { name: "Jim Talley", gender: "m", background: "former quarterback" },
    },
  },
  {
    from: 1994,
    to: 2009,
    booth: {
      pbp: { name: "Al Brennan", gender: "m", background: "play-by-play" },
      color: { name: "Cris Mayhew", gender: "m", background: "former receiver" },
    },
  },
  {
    from: 2010,
    to: 9999,
    booth: {
      pbp: { name: "Joe Castillo", gender: "m", background: "play-by-play" },
      color: { name: "Greg Halvorsen", gender: "m", background: "former tight end" },
    },
  },
];

export function boothFor(year: number): Booth {
  return (BOOTHS.find((b) => year >= b.from && year <= b.to) ?? BOOTHS[BOOTHS.length - 1]!).booth;
}

/** The commissioner reading the picks at that year's draft. */
export function commissionerFor(year: number): { name: string; gender: Gender } {
  if (year <= 1989) return { name: "Pete Rozelle", gender: "m" };
  if (year <= 2006) return { name: "Paul Tagliabue", gender: "m" };
  return { name: "Roger Goodell", gender: "m" };
}

export const firstName = (n: string) => n.replace(/ “.*”/, "").split(" ")[0]!;

/**
 * Past the first round the commissioner hands the podium to a league official, the way the
 * real draft does, so day two has a voice of its own.
 */
export function pickReaderFor(year: number, round: number): { key: string; name: string; gender: Gender } {
  if (round <= 1) return { key: "COMM", ...commissionerFor(year) };
  return { key: "DEPUTY", name: year < 1990 ? "Ed Carrow" : "Mike Ansel", gender: "m" };
}

/** The draft-night desk analyst who reacts to every pick. */
export function draftAnalystFor(year: number): BoothMember {
  if (year <= 1979) return { name: "Walt Brody", gender: "m", background: "personnel man" };
  if (year <= 1995) return { name: "Ron Kessel", gender: "m", background: "former scout" };
  if (year <= 2011) return { name: "Mark Delacroix", gender: "m", background: "draft analyst" };
  return { name: "Dana Ruiz", gender: "f", background: "draft analyst" };
}
