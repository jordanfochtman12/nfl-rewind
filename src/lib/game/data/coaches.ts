import type { DefScheme, OffScheme, TeamId } from "../types.ts";

export interface CoachSeed {
  id: string;
  name: string;
  teamId: TeamId | null;
  yearAvail: number;
  offense: number;
  defense: number;
  born?: number;
  offScheme?: OffScheme;
  defScheme?: DefScheme;
  leadership?: number;
  development?: number;
  evaluation?: number;
  careerWins?: number;
  careerLosses?: number;
  careerTies?: number;
  careerTitles?: number;
  yearsOnJob?: number;
}

export const COACHES_1966: CoachSeed[] = [
  { id: "lombardi", name: "Vince Lombardi", teamId: "gnb", yearAvail: 1959, offense: 92, defense: 90, born: 1913, offScheme: "smashmouth", defScheme: "4-3", leadership: 96, development: 88, evaluation: 86, careerWins: 89, careerLosses: 29, careerTies: 4, careerTitles: 3, yearsOnJob: 7 },
  { id: "shula-clt", name: "Don Shula", teamId: "clt", yearAvail: 1963, offense: 88, defense: 90, born: 1930, offScheme: "multiple", defScheme: "4-3", leadership: 92, development: 84, evaluation: 88, careerWins: 31, careerLosses: 10, careerTies: 3, careerTitles: 1, yearsOnJob: 3 },
  { id: "landry", name: "Tom Landry", teamId: "dal", yearAvail: 1960, offense: 86, defense: 92, born: 1924, offScheme: "multiple", defScheme: "4-3", leadership: 86, development: 82, evaluation: 90, careerWins: 25, careerLosses: 46, careerTies: 3, yearsOnJob: 6 },
  { id: "halas", name: "George Halas", teamId: "chi", yearAvail: 1920, offense: 80, defense: 86, born: 1895, offScheme: "smashmouth", defScheme: "4-3", leadership: 90, development: 78, evaluation: 84, careerWins: 310, careerLosses: 148, careerTies: 31, careerTitles: 6, yearsOnJob: 40 },
  { id: "collier", name: "Blanton Collier", teamId: "cle", yearAvail: 1963, offense: 84, defense: 80, born: 1906, offScheme: "multiple", defScheme: "4-3", leadership: 82, development: 86, evaluation: 80, careerWins: 33, careerLosses: 16, careerTies: 3, careerTitles: 1, yearsOnJob: 3 },
  { id: "allen-ram", name: "George Allen", teamId: "ram", yearAvail: 1966, offense: 78, defense: 90, born: 1918, offScheme: "multiple", defScheme: "cover-2", leadership: 84, development: 70, evaluation: 92, careerWins: 0, careerLosses: 0, yearsOnJob: 1 },
  { id: "vanbrocklin", name: "Norm Van Brocklin", teamId: "min", yearAvail: 1961, offense: 80, defense: 76, born: 1926, offScheme: "vertical", defScheme: "4-3", leadership: 70, development: 74, evaluation: 76, careerWins: 29, careerLosses: 38, careerTies: 4, yearsOnJob: 5 },
  { id: "christiansen", name: "Jack Christiansen", teamId: "sfo", yearAvail: 1963, offense: 76, defense: 78, born: 1928, offScheme: "multiple", defScheme: "4-3", leadership: 74, development: 72, evaluation: 74, careerWins: 15, careerLosses: 26, careerTies: 1, yearsOnJob: 3 },
  { id: "hecker", name: "Norb Hecker", teamId: "atl", yearAvail: 1966, offense: 70, defense: 70, born: 1927, offScheme: "multiple", defScheme: "4-3", leadership: 68, development: 70, evaluation: 68, yearsOnJob: 1 },
  { id: "sherman", name: "Allie Sherman", teamId: "nyg", yearAvail: 1961, offense: 74, defense: 70, born: 1923, offScheme: "multiple", defScheme: "4-3", leadership: 72, development: 70, evaluation: 72, careerWins: 37, careerLosses: 31, careerTies: 4, yearsOnJob: 5 },
  { id: "kuharich", name: "Joe Kuharich", teamId: "phi", yearAvail: 1964, offense: 70, defense: 70, born: 1917, offScheme: "multiple", defScheme: "4-3", leadership: 66, development: 68, evaluation: 66, careerWins: 18, careerLosses: 24, careerTies: 1, yearsOnJob: 2 },
  { id: "austin", name: "Bill Austin", teamId: "pit", yearAvail: 1966, offense: 68, defense: 72, born: 1928, offScheme: "smashmouth", defScheme: "4-3", leadership: 70, development: 72, evaluation: 70, yearsOnJob: 1 },
  { id: "graham", name: "Otto Graham", teamId: "was", yearAvail: 1966, offense: 76, defense: 70, born: 1921, offScheme: "multiple", defScheme: "4-3", leadership: 78, development: 74, evaluation: 72, yearsOnJob: 1 },
  { id: "winner", name: "Charley Winner", teamId: "crd", yearAvail: 1966, offense: 74, defense: 74, born: 1924, offScheme: "multiple", defScheme: "4-3", leadership: 72, development: 74, evaluation: 72, yearsOnJob: 1 },
  { id: "gilmer", name: "Harry Gilmer", teamId: "det", yearAvail: 1965, offense: 70, defense: 72, born: 1926, offScheme: "multiple", defScheme: "4-3", leadership: 68, development: 70, evaluation: 70, careerWins: 6, careerLosses: 7, careerTies: 1, yearsOnJob: 1 },
  { id: "stram", name: "Hank Stram", teamId: "kan", yearAvail: 1960, offense: 90, defense: 86, born: 1923, offScheme: "multiple", defScheme: "4-3", leadership: 88, development: 84, evaluation: 82, careerWins: 49, careerLosses: 33, careerTies: 5, careerTitles: 1, yearsOnJob: 6 },
  { id: "ewbank", name: "Weeb Ewbank", teamId: "nyj", yearAvail: 1963, offense: 84, defense: 82, born: 1907, offScheme: "vertical", defScheme: "4-3", leadership: 84, development: 88, evaluation: 80, careerWins: 78, careerLosses: 52, careerTies: 6, careerTitles: 2, yearsOnJob: 3 },
  { id: "gillman", name: "Sid Gillman", teamId: "sdg", yearAvail: 1960, offense: 92, defense: 80, born: 1911, offScheme: "vertical", defScheme: "4-3", leadership: 82, development: 90, evaluation: 84, careerWins: 82, careerLosses: 61, careerTies: 6, yearsOnJob: 6 },
  { id: "rauch", name: "John Rauch", teamId: "rai", yearAvail: 1966, offense: 82, defense: 80, born: 1927, offScheme: "vertical", defScheme: "4-3", leadership: 74, development: 76, evaluation: 76, yearsOnJob: 1 },
  { id: "holovak", name: "Mike Holovak", teamId: "nwe", yearAvail: 1961, offense: 78, defense: 74, born: 1919, offScheme: "multiple", defScheme: "4-3", leadership: 76, development: 74, evaluation: 74, careerWins: 36, careerLosses: 32, careerTies: 2, yearsOnJob: 5 },
  { id: "collier-buf", name: "Joe Collier", teamId: "buf", yearAvail: 1966, offense: 76, defense: 80, born: 1932, offScheme: "multiple", defScheme: "4-3", leadership: 74, development: 76, evaluation: 78, yearsOnJob: 1 },
  { id: "lemm", name: "Wally Lemm", teamId: "oti", yearAvail: 1966, offense: 76, defense: 74, born: 1919, offScheme: "multiple", defScheme: "4-3", leadership: 72, development: 72, evaluation: 72, careerWins: 33, careerLosses: 26, careerTies: 3, yearsOnJob: 1 },
  { id: "speedie", name: "Mac Speedie", teamId: "den", yearAvail: 1966, offense: 70, defense: 68, born: 1920, offScheme: "vertical", defScheme: "4-3", leadership: 66, development: 68, evaluation: 66, yearsOnJob: 1 },
  { id: "wilson-mia", name: "George Wilson", teamId: "mia", yearAvail: 1966, offense: 72, defense: 70, born: 1914, offScheme: "multiple", defScheme: "4-3", leadership: 70, development: 70, evaluation: 70, yearsOnJob: 1 },
];

export const EXPANSION_COACHES: CoachSeed[] = [
  { id: "fears", name: "Tom Fears", teamId: "nor", yearAvail: 1967, offense: 76, defense: 72, born: 1922, offScheme: "vertical", defScheme: "4-3", leadership: 74, development: 76, evaluation: 74 },
  { id: "pbrown", name: "Paul Brown", teamId: "cin", yearAvail: 1968, offense: 88, defense: 86, born: 1908, offScheme: "multiple", defScheme: "4-3", leadership: 90, development: 94, evaluation: 88, careerWins: 158, careerLosses: 48, careerTies: 8, careerTitles: 7 },
  { id: "mckay", name: "John McKay", teamId: "tam", yearAvail: 1976, offense: 80, defense: 74, born: 1923, offScheme: "smashmouth", defScheme: "4-3", leadership: 80, development: 78, evaluation: 76 },
  { id: "patera", name: "Jack Patera", teamId: "sea", yearAvail: 1976, offense: 74, defense: 78, born: 1933, offScheme: "multiple", defScheme: "4-3", leadership: 72, development: 74, evaluation: 74 },
  { id: "capers-car", name: "Dom Capers", teamId: "car", yearAvail: 1995, offense: 76, defense: 84, born: 1950, offScheme: "multiple", defScheme: "cover-2", leadership: 76, development: 78, evaluation: 80 },
  { id: "coughlin", name: "Tom Coughlin", teamId: "jax", yearAvail: 1995, offense: 80, defense: 80, born: 1946, offScheme: "multiple", defScheme: "4-3", leadership: 82, development: 80, evaluation: 80 },
  { id: "marchibroda-rav", name: "Ted Marchibroda", teamId: "rav", yearAvail: 1996, offense: 78, defense: 74, born: 1931, offScheme: "multiple", defScheme: "4-3", leadership: 74, development: 76, evaluation: 74, careerWins: 44, careerLosses: 52 },
  { id: "palmer-cle", name: "Chris Palmer", teamId: "cle", yearAvail: 1999, offense: 74, defense: 70, born: 1949, offScheme: "multiple", defScheme: "4-3", leadership: 70, development: 74, evaluation: 72 },
  { id: "capers-htx", name: "Dom Capers", teamId: "htx", yearAvail: 2002, offense: 74, defense: 82, born: 1950, offScheme: "multiple", defScheme: "cover-2", leadership: 74, development: 76, evaluation: 78 },
];

export const COORDINATORS_1966: CoachSeed[] = [
  { id: "bengtson-dc", name: "Phil Bengtson", teamId: "gnb", yearAvail: 1959, offense: 70, defense: 90, born: 1913, defScheme: "4-3", leadership: 78, development: 80, evaluation: 78 },
  { id: "dooley-oc", name: "Jim Dooley", teamId: "chi", yearAvail: 1966, offense: 78, defense: 68, born: 1930, offScheme: "smashmouth", leadership: 72, development: 74, evaluation: 72 },
  { id: "allen-dc-dal", name: "Ermal Allen", teamId: "dal", yearAvail: 1962, offense: 72, defense: 86, born: 1920, defScheme: "4-3", leadership: 74, development: 72, evaluation: 76 },
  { id: "mccafferty-oc", name: "Don McCafferty", teamId: "clt", yearAvail: 1963, offense: 82, defense: 70, born: 1921, offScheme: "multiple", leadership: 76, development: 78, evaluation: 74 },
  { id: "madro-oc", name: "Joe Madro", teamId: "sdg", yearAvail: 1960, offense: 86, defense: 70, born: 1913, offScheme: "vertical", leadership: 74, development: 80, evaluation: 74 },
  { id: "bettis-dc", name: "Tom Bettis", teamId: "kan", yearAvail: 1966, offense: 68, defense: 82, born: 1933, defScheme: "4-3", leadership: 72, development: 72, evaluation: 74 },
  { id: "rush-oc", name: "Clive Rush", teamId: "nyj", yearAvail: 1963, offense: 80, defense: 70, born: 1931, offScheme: "vertical", leadership: 70, development: 74, evaluation: 72 },
  { id: "patera-dc", name: "Jack Patera", teamId: "ram", yearAvail: 1966, offense: 66, defense: 84, born: 1933, defScheme: "4-3", leadership: 72, development: 74, evaluation: 74 },
  { id: "skorich-oc", name: "Nick Skorich", teamId: "cle", yearAvail: 1964, offense: 80, defense: 70, born: 1921, offScheme: "multiple", leadership: 74, development: 76, evaluation: 72 },
  { id: "gillman-dc", name: "Chuck Noll", teamId: "sdg", yearAvail: 1966, offense: 70, defense: 88, born: 1932, defScheme: "4-3", leadership: 86, development: 90, evaluation: 88 },
  { id: "stram-oc", name: "Bill Walsh", teamId: "kan", yearAvail: 1966, offense: 84, defense: 66, born: 1931, offScheme: "westcoast", leadership: 82, development: 92, evaluation: 86 },
  { id: "lombardi-oc", name: "Bob Schnelker", teamId: "gnb", yearAvail: 1964, offense: 82, defense: 64, born: 1928, offScheme: "smashmouth", leadership: 74, development: 76, evaluation: 74 },
  { id: "halas-dc", name: "George Allen", teamId: "chi", yearAvail: 1962, offense: 68, defense: 90, born: 1918, defScheme: "cover-2", leadership: 82, development: 70, evaluation: 90 },
  { id: "landry-oc", name: "Ermal Allen", teamId: "dal", yearAvail: 1962, offense: 80, defense: 74, born: 1920, offScheme: "multiple", leadership: 74, development: 74, evaluation: 74 },
  { id: "shula-dc", name: "Bill Arnsparger", teamId: "clt", yearAvail: 1964, offense: 66, defense: 88, born: 1926, defScheme: "4-3", leadership: 80, development: 84, evaluation: 82 },
  { id: "rauch-oc", name: "John Madden", teamId: "rai", yearAvail: 1967, offense: 82, defense: 74, born: 1936, offScheme: "vertical", leadership: 90, development: 80, evaluation: 78 },
  { id: "austin-dc", name: "Bud Carson", teamId: "pit", yearAvail: 1966, offense: 64, defense: 80, born: 1931, defScheme: "cover-2", leadership: 74, development: 76, evaluation: 78 },
];

export const LATER_COACHES: CoachSeed[] = [
  { id: "noll", name: "Chuck Noll", teamId: null, yearAvail: 1969, offense: 86, defense: 94, born: 1932, offScheme: "multiple", defScheme: "4-3", leadership: 88, development: 94, evaluation: 92 },
  { id: "shula-mia", name: "Don Shula", teamId: null, yearAvail: 1970, offense: 90, defense: 92, born: 1930, offScheme: "multiple", defScheme: "4-3", leadership: 94, development: 86, evaluation: 90 },
  { id: "maddden", name: "John Madden", teamId: null, yearAvail: 1969, offense: 90, defense: 86, born: 1936, offScheme: "vertical", defScheme: "4-3", leadership: 92, development: 82, evaluation: 80 },
  { id: "grant", name: "Bud Grant", teamId: null, yearAvail: 1967, offense: 82, defense: 90, born: 1927, offScheme: "smashmouth", defScheme: "4-3", leadership: 88, development: 80, evaluation: 82 },
  { id: "knox", name: "Chuck Knox", teamId: null, yearAvail: 1973, offense: 84, defense: 84, born: 1932, offScheme: "smashmouth", defScheme: "4-3", leadership: 82, development: 80, evaluation: 80 },
  { id: "walsh", name: "Bill Walsh", teamId: null, yearAvail: 1979, offense: 96, defense: 82, born: 1931, offScheme: "westcoast", defScheme: "4-3", leadership: 88, development: 96, evaluation: 90 },
  { id: "gibbs", name: "Joe Gibbs", teamId: null, yearAvail: 1981, offense: 92, defense: 86, born: 1940, offScheme: "multiple", defScheme: "4-3", leadership: 90, development: 84, evaluation: 84 },
  { id: "parcells", name: "Bill Parcells", teamId: null, yearAvail: 1983, offense: 84, defense: 92, born: 1941, offScheme: "multiple", defScheme: "3-4", leadership: 92, development: 86, evaluation: 88 },
  { id: "johnson-dal", name: "Jimmy Johnson", teamId: null, yearAvail: 1989, offense: 88, defense: 88, born: 1943, offScheme: "multiple", defScheme: "4-3", leadership: 88, development: 84, evaluation: 94 },
  { id: "belichick", name: "Bill Belichick", teamId: null, yearAvail: 1991, offense: 88, defense: 96, born: 1952, offScheme: "multiple", defScheme: "3-4", leadership: 86, development: 88, evaluation: 96 },
  { id: "dunn", name: "Tony Dungy", teamId: null, yearAvail: 1996, offense: 84, defense: 90, born: 1955, offScheme: "multiple", defScheme: "cover-2", leadership: 90, development: 90, evaluation: 86 },
  { id: "reid", name: "Andy Reid", teamId: null, yearAvail: 1999, offense: 92, defense: 82, born: 1958, offScheme: "westcoast", defScheme: "4-3", leadership: 90, development: 92, evaluation: 88 },
  { id: "ditka", name: "Mike Ditka", teamId: null, yearAvail: 1982, offense: 86, defense: 80, born: 1939, offScheme: "smashmouth", defScheme: "4-3", leadership: 88, development: 76, evaluation: 78 },
  { id: "seifert", name: "George Seifert", teamId: null, yearAvail: 1989, offense: 86, defense: 88, born: 1940, offScheme: "westcoast", defScheme: "4-3", leadership: 80, development: 82, evaluation: 82 },
  { id: "holmgren", name: "Mike Holmgren", teamId: null, yearAvail: 1992, offense: 92, defense: 80, born: 1948, offScheme: "westcoast", defScheme: "4-3", leadership: 86, development: 88, evaluation: 84 },
  { id: "cowher", name: "Bill Cowher", teamId: null, yearAvail: 1992, offense: 84, defense: 90, born: 1957, offScheme: "multiple", defScheme: "3-4", leadership: 90, development: 82, evaluation: 82 },
  { id: "vermeil", name: "Dick Vermeil", teamId: null, yearAvail: 1976, offense: 86, defense: 78, born: 1936, offScheme: "vertical", defScheme: "4-3", leadership: 88, development: 84, evaluation: 80 },
  { id: "gruden", name: "Jon Gruden", teamId: null, yearAvail: 1998, offense: 90, defense: 80, born: 1963, offScheme: "vertical", defScheme: "4-3", leadership: 82, development: 84, evaluation: 82 },
  { id: "coryell", name: "Don Coryell", teamId: null, yearAvail: 1973, offense: 94, defense: 76, born: 1924, offScheme: "vertical", defScheme: "4-3", leadership: 84, development: 86, evaluation: 80 },
  { id: "levy", name: "Marv Levy", teamId: null, yearAvail: 1978, offense: 84, defense: 86, born: 1925, offScheme: "multiple", defScheme: "3-4", leadership: 90, development: 84, evaluation: 82 },
  { id: "flores", name: "Tom Flores", teamId: null, yearAvail: 1979, offense: 86, defense: 82, born: 1937, offScheme: "vertical", defScheme: "4-3", leadership: 84, development: 80, evaluation: 80 },
  { id: "shanahan", name: "Mike Shanahan", teamId: null, yearAvail: 1988, offense: 90, defense: 80, born: 1952, offScheme: "westcoast", defScheme: "4-3", leadership: 82, development: 86, evaluation: 84 },
  { id: "carroll", name: "Pete Carroll", teamId: null, yearAvail: 1994, offense: 84, defense: 88, born: 1951, offScheme: "multiple", defScheme: "4-3", leadership: 92, development: 86, evaluation: 84 },
  { id: "payton", name: "Sean Payton", teamId: null, yearAvail: 2006, offense: 92, defense: 78, born: 1963, offScheme: "multiple", defScheme: "4-3", leadership: 86, development: 84, evaluation: 84 },
  { id: "tomlin", name: "Mike Tomlin", teamId: null, yearAvail: 2007, offense: 84, defense: 88, born: 1972, offScheme: "multiple", defScheme: "3-4", leadership: 90, development: 84, evaluation: 82 },
  { id: "harbaugh", name: "John Harbaugh", teamId: null, yearAvail: 2008, offense: 82, defense: 88, born: 1962, offScheme: "multiple", defScheme: "3-4", leadership: 88, development: 82, evaluation: 84 },
  { id: "mcvay", name: "Sean McVay", teamId: null, yearAvail: 2017, offense: 94, defense: 80, born: 1986, offScheme: "westcoast", defScheme: "3-4", leadership: 86, development: 88, evaluation: 86 },
];
