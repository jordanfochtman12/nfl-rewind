import type { DraftSeed } from "./draftClasses.ts";

/**
 * Real college players the scouts already know, for the draft classes past the record. Each is
 * placed in the first class he could enter (three seasons out of high school), as of the 2026
 * season; where he goes, and what he becomes, is the dynasty's to find out. The rest of each
 * class is the game's own.
 */
export const FUTURE_PROSPECTS: Record<number, DraftSeed[]> = {
  2027: [
    { f: "Jeremiah", l: "Smith", p: "WR", c: "Ohio State", o: 82 },
    { f: "Arch", l: "Manning", p: "QB", c: "Texas", o: 79 },
    { f: "Ryan", l: "Williams", p: "WR", c: "Alabama", o: 79 },
    { f: "Colin", l: "Simmons", p: "DE", c: "Texas", o: 79 },
    { f: "LaNorris", l: "Sellers", p: "QB", c: "South Carolina", o: 77 },
    { f: "Dante", l: "Moore", p: "QB", c: "Oregon", o: 77 },
    { f: "Dylan", l: "Stewart", p: "DE", c: "South Carolina", o: 77 },
    { f: "Ellis", l: "Robinson IV", p: "CB", c: "Georgia", o: 75 },
    { f: "KJ", l: "Bolden", p: "S", c: "Georgia", o: 75 },
    { f: "Julian", l: "Sayin", p: "QB", c: "Ohio State", o: 75 },
  ],
  2028: [
    { f: "Bryce", l: "Underwood", p: "QB", c: "Michigan", o: 78 },
    { f: "Dakorien", l: "Moore", p: "WR", c: "Oregon", o: 77 },
    { f: "Keelon", l: "Russell", p: "QB", c: "Alabama", o: 76 },
    { f: "Jahkeem", l: "Stewart", p: "DT", c: "USC", o: 76 },
    { f: "Justus", l: "Terry", p: "DT", c: "Texas", o: 75 },
    { f: "Elijah", l: "Griffin", p: "DT", c: "Georgia", o: 75 },
  ],
};
