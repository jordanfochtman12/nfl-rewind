import type { Pos } from "../types.ts";
import type { CareerArcRow } from "./careerArcs.ts";

type Seed = { f: string; l: string; p: Pos; c?: string; o: number; r?: number };

/**
 * Real players nobody drafted, by the year they came into the league — the draft tables
 * the classes are built from can't know them. They go on the board as round-0 names, so
 * they usually go undrafted again and sign as rookie free agents. Players who came by way
 * of the CFL or USFL are listed in the year they reached the NFL.
 */
export const UNDRAFTED: Record<number, Seed[]> = {
  1966: [{ f: "Emmitt", l: "Thomas", p: "CB", c: "Bishop", o: 88, r: 0 }],
  1967: [{ f: "Larry", l: "Little", p: "RG", c: "Bethune-Cookman", o: 92, r: 0 }],
  1970: [{ f: "Jim", l: "Langer", p: "C", c: "South Dakota State", o: 90, r: 0 }],
  1973: [{ f: "Drew", l: "Pearson", p: "WR", c: "Tulsa", o: 88, r: 0 }],
  1980: [{ f: "Dave", l: "Krieg", p: "QB", c: "Milton", o: 82, r: 0 }],
  1981: [{ f: "Joe", l: "Jacoby", p: "LT", c: "Louisville", o: 88, r: 0 }],
  1986: [{ f: "Sam", l: "Mills", p: "MLB", c: "Montclair State", o: 88, r: 0 }],
  1990: [{ f: "Tony", l: "Siragusa", p: "DT", c: "Pittsburgh", o: 80, r: 0 }],
  1994: [{ f: "Rod", l: "Smith", p: "WR", c: "Missouri Southern", o: 86, r: 0 }],
  1995: [{ f: "Wayne", l: "Chrebet", p: "WR", c: "Hofstra", o: 78, r: 0 }],
  1996: [{ f: "Jon", l: "Kitna", p: "QB", c: "Central Washington", o: 78, r: 0 }],
  1997: [{ f: "Jake", l: "Delhomme", p: "QB", c: "Louisiana-Lafayette", o: 80, r: 0 }],
  1998: [{ f: "Jeff", l: "Saturday", p: "C", c: "North Carolina", o: 88, r: 0 }],
  1999: [
    { f: "Jeff", l: "Garcia", p: "QB", c: "San Jose State", o: 84, r: 0 },
    { f: "Brian", l: "Waters", p: "LG", c: "North Texas", o: 88, r: 0 },
  ],
  2001: [{ f: "Dominic", l: "Rhodes", p: "RB", c: "Midwestern State", o: 76, r: 0 }],
  2002: [
    { f: "James", l: "Harrison", p: "OLB", c: "Kent State", o: 90, r: 0 },
    { f: "Bart", l: "Scott", p: "MLB", c: "Southern Illinois", o: 82, r: 0 },
  ],
  2003: [{ f: "Antonio", l: "Gates", p: "TE", c: "Kent State", o: 90, r: 0 }],
  2004: [{ f: "Willie", l: "Parker", p: "RB", c: "North Carolina", o: 82, r: 0 }],
  2005: [
    { f: "Josh", l: "Cribbs", p: "WR", c: "Kent State", o: 78, r: 0 },
    { f: "Ryan", l: "Grant", p: "RB", c: "Notre Dame", o: 80, r: 0 },
    { f: "Robbie", l: "Gould", p: "K", c: "Penn State", o: 86, r: 0 },
  ],
  2006: [
    { f: "Tramon", l: "Williams", p: "CB", c: "Louisiana Tech", o: 84, r: 0 },
    { f: "Miles", l: "Austin", p: "WR", c: "Monmouth", o: 82, r: 0 },
    { f: "Matt", l: "Prater", p: "K", c: "UCF", o: 86, r: 0 },
  ],
  2007: [
    { f: "Fred", l: "Jackson", p: "RB", c: "Coe", o: 80, r: 0 },
    { f: "Pierre", l: "Thomas", p: "RB", c: "Illinois", o: 78, r: 0 },
  ],
  2008: [
    { f: "Danny", l: "Woodhead", p: "RB", c: "Chadron State", o: 78, r: 0 },
    { f: "Danny", l: "Amendola", p: "WR", c: "Texas Tech", o: 78, r: 0 },
    { f: "Mike", l: "Tolbert", p: "FB", c: "Coastal Carolina", o: 76, r: 0 },
    { f: "Brett", l: "Kern", p: "P", c: "Toledo", o: 84, r: 0 },
  ],
  2009: [
    { f: "Cameron", l: "Wake", p: "DE", c: "Penn State", o: 88, r: 0 },
    { f: "Michael", l: "Bennett", p: "DE", c: "Texas A&M", o: 86, r: 0 },
  ],
  2010: [{ f: "Victor", l: "Cruz", p: "WR", c: "UMass", o: 82, r: 0 }],
  2011: [
    { f: "Doug", l: "Baldwin", p: "WR", c: "Stanford", o: 84, r: 0 },
    { f: "Chris", l: "Harris Jr.", p: "CB", c: "Kansas", o: 88, r: 0 },
    { f: "Dan", l: "Bailey", p: "K", c: "Oklahoma State", o: 84, r: 0 },
  ],
  2012: [
    { f: "Justin", l: "Tucker", p: "K", c: "Texas", o: 92, r: 0 },
    { f: "Johnny", l: "Hekker", p: "P", c: "Oregon State", o: 88, r: 0 },
    { f: "Case", l: "Keenum", p: "QB", c: "Houston", o: 76, r: 0 },
  ],
  2014: [{ f: "Malcolm", l: "Butler", p: "CB", c: "West Alabama", o: 82, r: 0 }],
  2015: [{ f: "Raheem", l: "Mostert", p: "RB", c: "Purdue", o: 78, r: 0 }],
  2017: [{ f: "Austin", l: "Ekeler", p: "RB", c: "Western Colorado", o: 82, r: 0 }],
  2018: [{ f: "Phillip", l: "Lindsay", p: "RB", c: "Colorado", o: 78, r: 0 }],
};

/**
 * The real careers of undrafted players, which the draft-table arcs can't carry: the year he
 * came in, then [lastSeason, seasonsAsStarter, games, proBowls, firstTeamAllPros, ageOnArrival].
 * This is what lets Warner, Romo and Gates grow into who they were instead of aging like
 * any other camp body.
 */
export const UNDRAFTED_ARCS: Record<string, { dy: number; row: CareerArcRow }> = {
  // already in the classes
  "kurt|warner": { dy: 1994, row: [2009, 8, 124, 4, 2, 23] },
  "tony|romo": { dy: 2003, row: [2016, 9, 156, 4, 0, 23] },
  "wes|welker": { dy: 2004, row: [2015, 8, 198, 5, 2, 23] },
  "jason|peters": { dy: 2004, row: [2022, 16, 230, 9, 2, 22] },
  "arian|foster": { dy: 2009, row: [2016, 5, 81, 4, 1, 23] },
  "london|fletcher": { dy: 1998, row: [2013, 15, 256, 4, 0, 23] },
  "adam|thielen": { dy: 2013, row: [2024, 8, 170, 2, 0, 22] },
  "priest|holmes": { dy: 1997, row: [2007, 5, 117, 3, 3, 23] },
  "john|randle": { dy: 1990, row: [2003, 12, 219, 7, 6, 22] },
  "cliff|harris": { dy: 1970, row: [1979, 9, 141, 6, 4, 21] },
  "everson|walls": { dy: 1981, row: [1993, 12, 183, 4, 1, 21] },
  "nate|newton": { dy: 1986, row: [1999, 13, 198, 6, 1, 24] },
  "warren|moon": { dy: 1984, row: [2000, 13, 208, 9, 1, 27] },
  "jim|hart": { dy: 1966, row: [1984, 13, 201, 4, 0, 22] },
  "adam|vinatieri": { dy: 1996, row: [2019, 23, 365, 3, 3, 23] },
  // new to the classes
  "emmitt|thomas": { dy: 1966, row: [1978, 11, 181, 5, 1, 23] },
  "larry|little": { dy: 1967, row: [1980, 12, 183, 5, 5, 21] },
  "jim|langer": { dy: 1970, row: [1981, 9, 151, 6, 3, 22] },
  "drew|pearson": { dy: 1973, row: [1983, 10, 156, 3, 3, 22] },
  "dave|krieg": { dy: 1980, row: [1998, 12, 213, 3, 0, 21] },
  "joe|jacoby": { dy: 1981, row: [1993, 12, 170, 4, 1, 22] },
  "sam|mills": { dy: 1986, row: [1997, 12, 181, 5, 0, 27] },
  "tony|siragusa": { dy: 1990, row: [2001, 10, 170, 0, 0, 23] },
  "rod|smith": { dy: 1994, row: [2006, 10, 183, 3, 0, 24] },
  "wayne|chrebet": { dy: 1995, row: [2005, 7, 150, 0, 0, 22] },
  "jon|kitna": { dy: 1996, row: [2013, 8, 141, 0, 0, 24] },
  "jake|delhomme": { dy: 1997, row: [2011, 6, 103, 1, 0, 22] },
  "jeff|saturday": { dy: 1998, row: [2012, 13, 211, 6, 2, 23] },
  "jeff|garcia": { dy: 1999, row: [2009, 8, 125, 4, 0, 29] },
  "brian|waters": { dy: 1999, row: [2013, 12, 208, 6, 2, 22] },
  "dominic|rhodes": { dy: 2001, row: [2010, 2, 100, 0, 0, 22] },
  "james|harrison": { dy: 2002, row: [2017, 9, 177, 5, 2, 24] },
  "bart|scott": { dy: 2002, row: [2012, 7, 170, 1, 0, 22] },
  "antonio|gates": { dy: 2003, row: [2018, 14, 236, 8, 3, 23] },
  "willie|parker": { dy: 2004, row: [2009, 4, 77, 2, 0, 23] },
  "josh|cribbs": { dy: 2005, row: [2014, 1, 130, 3, 0, 22] },
  "ryan|grant": { dy: 2005, row: [2012, 3, 70, 0, 0, 22] },
  "robbie|gould": { dy: 2005, row: [2022, 17, 265, 1, 0, 23] },
  "tramon|williams": { dy: 2006, row: [2020, 11, 199, 1, 0, 23] },
  "miles|austin": { dy: 2006, row: [2015, 4, 109, 2, 0, 22] },
  "matt|prater": { dy: 2006, row: [2025, 17, 250, 2, 0, 22] },
  "fred|jackson": { dy: 2007, row: [2015, 5, 125, 1, 0, 26] },
  "pierre|thomas": { dy: 2007, row: [2015, 3, 111, 0, 0, 22] },
  "danny|woodhead": { dy: 2008, row: [2017, 2, 100, 0, 0, 23] },
  "danny|amendola": { dy: 2008, row: [2020, 3, 140, 0, 0, 22] },
  "mike|tolbert": { dy: 2008, row: [2017, 2, 140, 4, 0, 22] },
  "brett|kern": { dy: 2008, row: [2021, 12, 190, 3, 0, 22] },
  "cameron|wake": { dy: 2009, row: [2020, 9, 167, 5, 1, 27] },
  "michael|bennett": { dy: 2009, row: [2020, 8, 166, 3, 0, 23] },
  "victor|cruz": { dy: 2010, row: [2017, 3, 75, 1, 0, 23] },
  "doug|baldwin": { dy: 2011, row: [2018, 6, 125, 2, 0, 22] },
  "chris|harris jr": { dy: 2011, row: [2021, 9, 160, 4, 1, 22] },
  "dan|bailey": { dy: 2011, row: [2021, 9, 150, 0, 1, 23] },
  "justin|tucker": { dy: 2012, row: [2024, 13, 205, 5, 4, 22] },
  "johnny|hekker": { dy: 2012, row: [2025, 13, 220, 4, 4, 22] },
  "case|keenum": { dy: 2012, row: [2023, 5, 90, 0, 0, 24] },
  "malcolm|butler": { dy: 2014, row: [2021, 7, 115, 1, 0, 24] },
  "raheem|mostert": { dy: 2015, row: [2025, 2, 90, 1, 0, 23] },
  "austin|ekeler": { dy: 2017, row: [2025, 4, 120, 0, 0, 22] },
  "phillip|lindsay": { dy: 2018, row: [2021, 2, 54, 1, 0, 23] },
};
