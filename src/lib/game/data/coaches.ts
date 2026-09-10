import type { TeamId } from "../types.ts";

export interface CoachSeed {
  id: string;
  name: string;
  teamId: TeamId | null;
  yearAvail: number;
  offense: number;
  defense: number;
}

export const COACHES_1966: CoachSeed[] = [
  { id: "lombardi", name: "Vince Lombardi", teamId: "gnb", yearAvail: 1959, offense: 92, defense: 90 },
  { id: "shula-clt", name: "Don Shula", teamId: "clt", yearAvail: 1963, offense: 88, defense: 90 },
  { id: "landry", name: "Tom Landry", teamId: "dal", yearAvail: 1960, offense: 86, defense: 92 },
  { id: "halas", name: "George Halas", teamId: "chi", yearAvail: 1920, offense: 80, defense: 86 },
  { id: "collier", name: "Blanton Collier", teamId: "cle", yearAvail: 1963, offense: 84, defense: 80 },
  { id: "allen-ram", name: "George Allen", teamId: "ram", yearAvail: 1966, offense: 78, defense: 90 },
  { id: "vanbrocklin", name: "Norm Van Brocklin", teamId: "min", yearAvail: 1961, offense: 80, defense: 76 },
  { id: "christiansen", name: "Jack Christiansen", teamId: "sfo", yearAvail: 1963, offense: 76, defense: 78 },
  { id: "hecker", name: "Norb Hecker", teamId: "atl", yearAvail: 1966, offense: 70, defense: 70 },
  { id: "sherman", name: "Allie Sherman", teamId: "nyg", yearAvail: 1961, offense: 74, defense: 70 },
  { id: "kuharich", name: "Joe Kuharich", teamId: "phi", yearAvail: 1964, offense: 70, defense: 70 },
  { id: "austin", name: "Bill Austin", teamId: "pit", yearAvail: 1966, offense: 68, defense: 72 },
  { id: "graham", name: "Otto Graham", teamId: "was", yearAvail: 1966, offense: 76, defense: 70 },
  { id: "winner", name: "Charley Winner", teamId: "crd", yearAvail: 1966, offense: 74, defense: 74 },
  { id: "gilmer", name: "Harry Gilmer", teamId: "det", yearAvail: 1965, offense: 70, defense: 72 },
  { id: "stram", name: "Hank Stram", teamId: "kan", yearAvail: 1960, offense: 90, defense: 86 },
  { id: "ewbank", name: "Weeb Ewbank", teamId: "nyj", yearAvail: 1963, offense: 84, defense: 82 },
  { id: "gillman", name: "Sid Gillman", teamId: "sdg", yearAvail: 1960, offense: 92, defense: 80 },
  { id: "rauch", name: "John Rauch", teamId: "rai", yearAvail: 1966, offense: 82, defense: 80 },
  { id: "holovak", name: "Mike Holovak", teamId: "nwe", yearAvail: 1961, offense: 78, defense: 74 },
  { id: "collier-buf", name: "Joe Collier", teamId: "buf", yearAvail: 1966, offense: 76, defense: 80 },
  { id: "lemm", name: "Wally Lemm", teamId: "oti", yearAvail: 1966, offense: 76, defense: 74 },
  { id: "speedie", name: "Mac Speedie", teamId: "den", yearAvail: 1966, offense: 70, defense: 68 },
  { id: "wilson-mia", name: "George Wilson", teamId: "mia", yearAvail: 1966, offense: 72, defense: 70 },
];

export const EXPANSION_COACHES: CoachSeed[] = [
  { id: "fears", name: "Tom Fears", teamId: "nor", yearAvail: 1967, offense: 76, defense: 72 },
  { id: "pbrown", name: "Paul Brown", teamId: "cin", yearAvail: 1968, offense: 88, defense: 86 },
  { id: "mckay", name: "John McKay", teamId: "tam", yearAvail: 1976, offense: 80, defense: 74 },
  { id: "patera", name: "Jack Patera", teamId: "sea", yearAvail: 1976, offense: 74, defense: 78 },
  { id: "capers-car", name: "Dom Capers", teamId: "car", yearAvail: 1995, offense: 76, defense: 84 },
  { id: "coughlin", name: "Tom Coughlin", teamId: "jax", yearAvail: 1995, offense: 80, defense: 80 },
  { id: "marchibroda-rav", name: "Ted Marchibroda", teamId: "rav", yearAvail: 1996, offense: 78, defense: 74 },
  { id: "palmer-cle", name: "Chris Palmer", teamId: "cle", yearAvail: 1999, offense: 74, defense: 70 },
  { id: "capers-htx", name: "Dom Capers", teamId: "htx", yearAvail: 2002, offense: 74, defense: 82 },
];

export const COORDINATORS_1966: CoachSeed[] = [
  { id: "bengtson-dc", name: "Phil Bengtson", teamId: "gnb", yearAvail: 1959, offense: 70, defense: 90 },
  { id: "dooley-oc", name: "Jim Dooley", teamId: "chi", yearAvail: 1966, offense: 78, defense: 68 },
  { id: "allen-dc-dal", name: "Ermal Allen", teamId: "dal", yearAvail: 1962, offense: 72, defense: 86 },
  { id: "mccafferty-oc", name: "Don McCafferty", teamId: "clt", yearAvail: 1963, offense: 82, defense: 70 },
  { id: "madro-oc", name: "Joe Madro", teamId: "sdg", yearAvail: 1960, offense: 86, defense: 70 },
  { id: "bettis-dc", name: "Tom Bettis", teamId: "kan", yearAvail: 1966, offense: 68, defense: 82 },
  { id: "rush-oc", name: "Clive Rush", teamId: "nyj", yearAvail: 1963, offense: 80, defense: 70 },
  { id: "patera-dc", name: "Jack Patera", teamId: "ram", yearAvail: 1966, offense: 66, defense: 84 },
  { id: "skorich-oc", name: "Nick Skorich", teamId: "cle", yearAvail: 1964, offense: 80, defense: 70 },
];

export const LATER_COACHES: CoachSeed[] = [
  { id: "noll", name: "Chuck Noll", teamId: null, yearAvail: 1969, offense: 86, defense: 94 },
  { id: "shula-mia", name: "Don Shula", teamId: null, yearAvail: 1970, offense: 90, defense: 92 },
  { id: "maddden", name: "John Madden", teamId: null, yearAvail: 1969, offense: 90, defense: 86 },
  { id: "grant", name: "Bud Grant", teamId: null, yearAvail: 1967, offense: 82, defense: 90 },
  { id: "knox", name: "Chuck Knox", teamId: null, yearAvail: 1973, offense: 84, defense: 84 },
  { id: "walsh", name: "Bill Walsh", teamId: null, yearAvail: 1979, offense: 96, defense: 82 },
  { id: "gibbs", name: "Joe Gibbs", teamId: null, yearAvail: 1981, offense: 92, defense: 86 },
  { id: "parcells", name: "Bill Parcells", teamId: null, yearAvail: 1983, offense: 84, defense: 92 },
  { id: "johnson-dal", name: "Jimmy Johnson", teamId: null, yearAvail: 1989, offense: 88, defense: 88 },
  { id: "belichick", name: "Bill Belichick", teamId: null, yearAvail: 1991, offense: 88, defense: 96 },
  { id: "dunn", name: "Tony Dungy", teamId: null, yearAvail: 1996, offense: 84, defense: 90 },
  { id: "reid", name: "Andy Reid", teamId: null, yearAvail: 1999, offense: 92, defense: 82 },
  { id: "ditka", name: "Mike Ditka", teamId: null, yearAvail: 1982, offense: 86, defense: 80 },
  { id: "seifert", name: "George Seifert", teamId: null, yearAvail: 1989, offense: 86, defense: 88 },
  { id: "holmgren", name: "Mike Holmgren", teamId: null, yearAvail: 1992, offense: 92, defense: 80 },
  { id: "cowher", name: "Bill Cowher", teamId: null, yearAvail: 1992, offense: 84, defense: 90 },
  { id: "vermeil", name: "Dick Vermeil", teamId: null, yearAvail: 1976, offense: 86, defense: 78 },
  { id: "gruden", name: "Jon Gruden", teamId: null, yearAvail: 1998, offense: 90, defense: 80 },
];
