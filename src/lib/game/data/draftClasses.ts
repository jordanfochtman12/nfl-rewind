import type { Pos, Ratings } from "../types.ts";
import type { Arch } from "../profiles.ts";
import { DRAFT_EXTRA } from "./draftClassesExtra.ts";
import { DRAFT_MORE } from "./draftClassesMore.ts";
import { DRAFT_FILL } from "./draftClassesFill.ts";
import { DRAFT_DEEP } from "./draftClassesDeep.ts";
import { DRAFT_MODERN } from "./draftClassesModern.ts";
import { DRAFT_MODERN_LATE } from "./draftClassesModernLate.ts";
import { DRAFT_2000S } from "./draftClasses2000s.ts";
import { DRAFT_2010S } from "./draftClasses2010s.ts";
import { DRAFT_INGEST } from "./draftClassesIngest.ts";
import { UNDRAFTED } from "./undrafted.ts";
import { STAR_PROFILES } from "./starProfiles.ts";
import { cleanNameParts, historicalNameKey, normalizedName } from "../identity.ts";
import { AUDIT_DRAFTED, AUDIT_FIX, AUDIT_UNDRAFTED } from "./auditPlayers.ts";
import { inferArch, nameVariance, ratingsFromProfile } from "../profiles.ts";
import { primaryKeys } from "../ratings.ts";
import { historicalYear } from "../historicalYears.ts";
import { lookupArc } from "../careerArc.ts";
import { FRIENDS } from "./friends.ts";

export interface DraftSeed {
  f: string;
  l: string;
  p: Pos;
  c?: string;
  o: number;
  /** Historical round if known. */
  r?: number;
  arch?: Arch;
  ht?: number;
  wt?: number;
  fy?: number;
  /** Locked attribute kit. Overall is derived from these, not copied onto every rating. */
  rt?: Partial<Ratings>;
  /** Career-backed overall from real NFL production. Wins merge over round heuristics. */
  src?: "career";
}

/** Real named classes. Incomplete rounds filled at runtime. */
export const DRAFT_CLASSES: Record<number, DraftSeed[]> = {
  1966: [
    { f: "Tommy", l: "Nobis", p: "MLB", c: "Texas", o: 88, r: 1 },
    { f: "Tom", l: "Mack", p: "LG", c: "Michigan", o: 86, r: 1 },
    { f: "Dick", l: "Leftridge", p: "RB", c: "West Virginia", o: 70, r: 1 },
    { f: "Randy", l: "Beisler", p: "DE", c: "Indiana", o: 72, r: 1 },
    { f: "John", l: "Niland", p: "LG", c: "Iowa", o: 82, r: 1 },
    { f: "Charlie", l: "Gogolak", p: "K", c: "Princeton", o: 70, r: 1 },
    { f: "Jerry", l: "Shay", p: "DT", c: "Purdue", o: 72, r: 1 },
    { f: "Carl", l: "McAdams", p: "MLB", c: "Oklahoma", o: 74, r: 1 },
    { f: "Jim", l: "Grabowski", p: "RB", c: "Illinois", o: 78, r: 1 },
    { f: "Francis", l: "Peay", p: "LT", c: "Missouri", o: 76, r: 1 },
    { f: "Stan", l: "Hindman", p: "DE", c: "Mississippi", o: 76, r: 1 },
    { f: "George", l: "Rice", p: "DT", c: "LSU", o: 72, r: 1 },
    { f: "Gale", l: "Gillingham", p: "LG", c: "Minnesota", o: 84, r: 1 },
    { f: "Milt", l: "Morin", p: "TE", c: "Massachusetts", o: 80, r: 1 },
    { f: "Sam", l: "Ball", p: "RT", c: "Kentucky", o: 76, r: 1 },
    { f: "Randy", l: "Johnson", p: "QB", c: "Texas A&I", o: 70, r: 1 },
    { f: "Rick", l: "Norton", p: "QB", c: "Kentucky", o: 68, r: 1 },
    { f: "Karl", l: "Singer", p: "LT", c: "Purdue", o: 70, r: 1 },
    { f: "Aaron", l: "Brown", p: "DE", c: "Minnesota", o: 76, r: 1 },
    { f: "Don", l: "Davis", p: "DT", c: "Cal State LA", o: 68, r: 1 },
    { f: "Mike", l: "Dennis", p: "RB", c: "Mississippi", o: 70, r: 1 },
    { f: "Bill", l: "Yearby", p: "DT", c: "Michigan", o: 72, r: 1 },
    { f: "Rodger", l: "Bird", p: "S", c: "Kentucky", o: 74, r: 1 },
    { f: "Walt", l: "Garrison", p: "RB", c: "Oklahoma State", o: 78, r: 2 },
    { f: "Fred", l: "Hill", p: "WR", c: "USC", o: 70, r: 2 },
    { f: "Dick", l: "Witcher", p: "WR", c: "UCLA", o: 72, r: 3 },
    { f: "Doug", l: "Buffone", p: "OLB", c: "Louisville", o: 80, r: 4 },
    { f: "Johnny", l: "Roland", p: "RB", c: "Missouri", o: 78, r: 4 },
    { f: "Jack", l: "Clancy", p: "WR", c: "Michigan", o: 74, r: 5 },
    { f: "Emerson", l: "Boozer", p: "RB", c: "Maryland State", o: 80, r: 6 },
    { f: "Pete", l: "Banaszak", p: "RB", c: "Miami", o: 76, r: 5 },
    { f: "Jan", l: "Stenerud", p: "K", c: "Montana State", o: 86, r: 3 },
    { f: "Ken", l: "Reaves", p: "CB", c: "Norfolk State", o: 76, r: 4 },
    { f: "Mike", l: "Garrett", p: "RB", c: "USC", o: 82, r: 2 },
    { f: "Bobby", l: "Leo", p: "RB", c: "Harvard", o: 68, r: 7 },
    { f: "Frank", l: "Emanuel", p: "MLB", c: "Tennessee", o: 72, r: 1 },
    { f: "Bobby", l: "Burnett", p: "RB", c: "Arkansas", o: 74, r: 10 },
  ],
  1967: [
    { f: "Bubba", l: "Smith", p: "DE", c: "Michigan State", o: 88, r: 1 },
    { f: "Clint", l: "Jones", p: "RB", c: "Michigan State", o: 78, r: 1 },
    { f: "Steve", l: "Spurrier", p: "QB", c: "Florida", o: 74, r: 1 },
    { f: "Bob", l: "Griese", p: "QB", c: "Purdue", o: 90, r: 1 },
    { f: "George", l: "Webster", p: "OLB", c: "Michigan State", o: 84, r: 1 },
    { f: "Floyd", l: "Little", p: "RB", c: "Syracuse", o: 88, r: 1 },
    { f: "Mel", l: "Farr", p: "RB", c: "UCLA", o: 82, r: 1 },
    { f: "Gene", l: "Washington", p: "WR", c: "Michigan State", o: 84, r: 1 },
    { f: "Bob", l: "Hyland", p: "C", c: "Boston College", o: 78, r: 1 },
    { f: "Loyd", l: "Phillips", p: "DE", c: "Arkansas", o: 74, r: 1 },
    { f: "Cas", l: "Banaszek", p: "RT", c: "Northwestern", o: 76, r: 1 },
    { f: "Paul", l: "Seiler", p: "LG", c: "Notre Dame", o: 72, r: 1 },
    { f: "Ray", l: "McDonald", p: "RB", c: "Idaho", o: 70, r: 1 },
    { f: "Ron", l: "Billingsley", p: "DT", c: "Wyoming", o: 72, r: 1 },
    { f: "Alan", l: "Page", p: "DT", c: "Notre Dame", o: 94, r: 1 },
    { f: "Dave", l: "Williams", p: "WR", c: "Washington", o: 74, r: 1 },
    { f: "Gene", l: "Upshaw", p: "LG", c: "Texas A&I", o: 92, r: 1 },
    { f: "Bob", l: "Matheson", p: "OLB", c: "Duke", o: 78, r: 1 },
    { f: "Harry", l: "Jones", p: "RB", c: "Arkansas", o: 70, r: 1 },
    { f: "Jim", l: "Detwiler", p: "RB", c: "Michigan", o: 70, r: 1 },
    { f: "John", l: "Charles", p: "S", c: "Purdue", o: 72, r: 1 },
    { f: "John", l: "Pitts", p: "S", c: "Arizona State", o: 72, r: 1 },
    { f: "Tom", l: "Regner", p: "LG", c: "Notre Dame", o: 74, r: 1 },
    { f: "Gene", l: "Trosch", p: "DE", c: "Miami", o: 70, r: 1 },
    { f: "Don", l: "Horn", p: "QB", c: "San Diego State", o: 72, r: 1 },
    { f: "Leslie", l: "Kelley", p: "FB", c: "Alabama", o: 68, r: 1 },
    { f: "Lem", l: "Barney", p: "CB", c: "Jackson State", o: 90, r: 2 },
    { f: "Willie", l: "Lanier", p: "MLB", c: "Morgan State", o: 92, r: 2 },
    { f: "Ken", l: "Houston", p: "S", c: "Prairie View", o: 90, r: 9 },
    { f: "Rayfield", l: "Wright", p: "RT", c: "Fort Valley State", o: 88, r: 7 },
    { f: "John", l: "Bramlett", p: "OLB", c: "Memphis State", o: 70, r: 6 },
    { f: "John", l: "Rowser", p: "CB", c: "Michigan", o: 72, r: 3 },
    { f: "Travis", l: "Williams", p: "RB", c: "Arizona State", o: 76, r: 4 },
  ],
  1968: [
    { f: "Ron", l: "Yary", p: "RT", c: "USC", o: 92, r: 1 },
    { f: "Bob", l: "Johnson", p: "C", c: "Tennessee", o: 82, r: 1 },
    { f: "Claude", l: "Humphrey", p: "DE", c: "Tennessee State", o: 90, r: 1 },
    { f: "Russ", l: "Washington", p: "RT", c: "Missouri", o: 84, r: 1 },
    { f: "Fred", l: "Carr", p: "OLB", c: "Texas-El Paso", o: 82, r: 1 },
    { f: "Dennis", l: "Byrd", p: "DE", c: "North Carolina State", o: 76, r: 1 },
    { f: "Kevin", l: "Hardy", p: "DT", c: "Notre Dame", o: 74, r: 1 },
    { f: "Larry", l: "Csonka", p: "FB", c: "Syracuse", o: 92, r: 1 },
    { f: "Haven", l: "Moses", p: "WR", c: "San Diego State", o: 80, r: 1 },
    { f: "Mike", l: "Taylor", p: "LT", c: "USC", o: 74, r: 1 },
    { f: "Greg", l: "Landry", p: "QB", c: "Massachusetts", o: 80, r: 1 },
    { f: "Jim", l: "Smith", p: "S", c: "Oregon", o: 72, r: 1 },
    { f: "MacArthur", l: "Lane", p: "RB", c: "Utah State", o: 78, r: 1 },
    { f: "Tim", l: "Rossovich", p: "OLB", c: "USC", o: 76, r: 1 },
    { f: "Forrest", l: "Blue", p: "C", c: "Auburn", o: 82, r: 1 },
    { f: "Mike", l: "Hull", p: "RB", c: "USC", o: 70, r: 1 },
    { f: "Lee", l: "White", p: "RB", c: "Weber State", o: 70, r: 1 },
    { f: "Mo", l: "Moorman", p: "RG", c: "Texas A&M", o: 76, r: 1 },
    { f: "Dennis", l: "Homan", p: "WR", c: "Alabama", o: 72, r: 1 },
    { f: "Marvin", l: "Upshaw", p: "DE", c: "Trinity", o: 74, r: 1 },
    { f: "Earl", l: "McCullouch", p: "WR", c: "USC", o: 78, r: 1 },
    { f: "Eldridge", l: "Dickey", p: "QB", c: "Tennessee State", o: 70, r: 1 },
    { f: "Bill", l: "Lueck", p: "LG", c: "Arizona", o: 76, r: 1 },
    { f: "Doug", l: "Crusan", p: "LT", c: "Indiana", o: 76, r: 1 },
    { f: "Curley", l: "Culp", p: "DT", c: "Arizona State", o: 88, r: 2 },
    { f: "Ken", l: "Stabler", p: "QB", c: "Alabama", o: 88, r: 2 },
    { f: "Charlie", l: "Sanders", p: "TE", c: "Minnesota", o: 88, r: 3 },
    { f: "Elvin", l: "Bethea", p: "DE", c: "North Carolina A&T", o: 90, r: 3 },
    { f: "Art", l: "Shell", p: "LT", c: "Maryland Eastern Shore", o: 92, r: 3 },
    { f: "Jim", l: "Kiick", p: "RB", c: "Wyoming", o: 82, r: 5 },
  ],
  1969: [
    { f: "O.J.", l: "Simpson", p: "RB", c: "USC", o: 94, r: 1 },
    { f: "George", l: "Kunz", p: "RT", c: "Notre Dame", o: 84, r: 1 },
    { f: "Leroy", l: "Keyes", p: "RB", c: "Purdue", o: 78, r: 1 },
    { f: "Joe", l: "Greene", p: "DT", c: "North Texas", o: 96, r: 1 },
    { f: "Ted", l: "Kwalick", p: "TE", c: "Penn State", o: 80, r: 1 },
    { f: "Ron", l: "Johnson", p: "RB", c: "Michigan", o: 80, r: 1 },
    { f: "Terry", l: "Hanratty", p: "QB", c: "Notre Dame", o: 72, r: 1 },
    { f: "Bill", l: "Stanfill", p: "DE", c: "Georgia", o: 86, r: 1 },
    { f: "Jerry", l: "LeVias", p: "WR", c: "SMU", o: 76, r: 1 },
    { f: "Calvin", l: "Hill", p: "RB", c: "Yale", o: 86, r: 1 },
    { f: "Roger", l: "Wehrli", p: "CB", c: "Missouri", o: 88, r: 1 },
    { f: "Ted", l: "Hendricks", p: "OLB", c: "Miami", o: 92, r: 2 },
    { f: "Bill", l: "Bergey", p: "MLB", c: "Arkansas State", o: 86, r: 2 },
    { f: "Charlie", l: "Joiner", p: "WR", c: "Grambling", o: 86, r: 4 },
    { f: "Ed", l: "Podolak", p: "RB", c: "Iowa", o: 78, r: 2 },
    { f: "Jim", l: "Marsalis", p: "CB", c: "Kansas State", o: 78, r: 1 },
  ],
  1970: [
    { f: "Terry", l: "Bradshaw", p: "QB", c: "Louisiana Tech", o: 90, r: 1 },
    { f: "Mike", l: "McCoy", p: "DT", c: "Notre Dame", o: 76, r: 1 },
    { f: "Al", l: "Cowlings", p: "DE", c: "USC", o: 72, r: 1 },
    { f: "Phil", l: "Olsen", p: "DT", c: "Utah State", o: 74, r: 1 },
    { f: "Mike", l: "Phipps", p: "QB", c: "Purdue", o: 74, r: 1 },
    { f: "Cedrick", l: "Hardman", p: "DE", c: "North Texas", o: 80, r: 1 },
    { f: "Mel", l: "Blount", p: "CB", c: "Southern", o: 90, r: 3 },
    { f: "Jim", l: "Mandich", p: "TE", c: "Michigan", o: 78, r: 2 },
    { f: "Raymond", l: "Chester", p: "TE", c: "Morgan State", o: 82, r: 1 },
    { f: "Doug", l: "Wilkerson", p: "LG", c: "North Carolina Central", o: 86, r: 1 },
    { f: "Richard", l: "Capp", p: "TE", c: "Boston College", o: 68, r: 2 },
    { f: "Bill", l: "McClard", p: "K", c: "Arkansas", o: 70, r: 3 },
  ],
  1971: [
    { f: "Jim", l: "Plunkett", p: "QB", c: "Stanford", o: 84, r: 1 },
    { f: "Archie", l: "Manning", p: "QB", c: "Ole Miss", o: 86, r: 1 },
    { f: "Dan", l: "Pastorini", p: "QB", c: "Santa Clara", o: 78, r: 1 },
    { f: "J.D.", l: "Hill", p: "WR", c: "Arizona State", o: 76, r: 1 },
    { f: "Richard", l: "Harris", p: "DE", c: "Grambling", o: 74, r: 1 },
    { f: "John", l: "Riggins", p: "RB", c: "Kansas", o: 90, r: 1 },
    { f: "Joe", l: "Theismann", p: "QB", c: "Notre Dame", o: 78, r: 4 },
    { f: "Jack", l: "Tatum", p: "S", c: "Ohio State", o: 90, r: 1 },
    { f: "Jack", l: "Youngblood", p: "DE", c: "Florida", o: 92, r: 1 },
    { f: "Isiah", l: "Robertson", p: "OLB", c: "Southern", o: 84, r: 1 },
    { f: "Phil", l: "Villapiano", p: "OLB", c: "Bowling Green", o: 84, r: 2 },
    { f: "Joe", l: "Ehrmann", p: "DT", c: "Syracuse", o: 78, r: 1 },
    { f: "Elmo", l: "Wright", p: "WR", c: "Houston", o: 74, r: 1 },
    { f: "Marv", l: "Montgomery", p: "LT", c: "USC", o: 74, r: 1 },
  ],
  1972: [
    { f: "Walt", l: "Patulski", p: "DE", c: "Notre Dame", o: 74, r: 1 },
    { f: "Sherman", l: "White", p: "DE", c: "California", o: 74, r: 1 },
    { f: "Franco", l: "Harris", p: "RB", c: "Penn State", o: 92, r: 1 },
    { f: "Jeff", l: "Siemon", p: "MLB", c: "Stanford", o: 84, r: 1 },
    { f: "Mike", l: "Taylor", p: "OLB", c: "Michigan", o: 72, r: 1 },
    { f: "Cliff", l: "Branch", p: "WR", c: "Colorado", o: 88, r: 4 },
    { f: "Greg", l: "Pruitt", p: "RB", c: "Oklahoma", o: 84, r: 2 },
    { f: "Riley", l: "Odoms", p: "TE", c: "Houston", o: 82, r: 1 },
    { f: "Tommy", l: "Casanova", p: "S", c: "LSU", o: 82, r: 2 },
    { f: "John", l: "Mendenhall", p: "DT", c: "Grambling", o: 76, r: 2 },
    { f: "Lydell", l: "Mitchell", p: "RB", c: "Penn State", o: 80, r: 2 },
  ],
  1973: [
    { f: "John", l: "Matuszak", p: "DE", c: "Tampa", o: 80, r: 1 },
    { f: "Bert", l: "Jones", p: "QB", c: "LSU", o: 86, r: 1 },
    { f: "Jerry", l: "Sisemore", p: "RT", c: "Texas", o: 80, r: 1 },
    { f: "John", l: "Hannah", p: "LG", c: "Alabama", o: 94, r: 1 },
    { f: "Dave", l: "Butz", p: "DT", c: "Purdue", o: 84, r: 1 },
    { f: "Charley", l: "Young", p: "RB", c: "NC State", o: 72, r: 1 },
    { f: "Joe", l: "DeLamielleure", p: "RG", c: "Michigan State", o: 90, r: 1 },
    { f: "Isaac", l: "Curtis", p: "WR", c: "San Diego State", o: 84, r: 1 },
    { f: "Ray", l: "Guy", p: "P", c: "Southern Miss", o: 92, r: 1 },
    { f: "Chuck", l: "Foreman", p: "RB", c: "Miami", o: 88, r: 1 },
    { f: "Dan", l: "Fouts", p: "QB", c: "Oregon", o: 86, r: 3 },
    { f: "Sam", l: "Cunningham", p: "RB", c: "USC", o: 82, r: 1 },
    { f: "Charlie", l: "Johnson", p: "DT", c: "Colorado", o: 76, r: 7 },
  ],
  1974: [
    { f: "Ed", l: "Jones", p: "DE", c: "Tennessee State", o: 88, r: 1 },
    { f: "Bo", l: "Matthews", p: "RB", c: "Colorado", o: 72, r: 1 },
    { f: "Rick", l: "Woods", p: "S", c: "Purdue", o: 70, r: 1 },
    { f: "John", l: "Stallworth", p: "WR", c: "Alabama A&M", o: 90, r: 4 },
    { f: "Lynn", l: "Swann", p: "WR", c: "USC", o: 90, r: 1 },
    { f: "Jack", l: "Lambert", p: "MLB", c: "Kent State", o: 94, r: 2 },
    { f: "Mike", l: "Webster", p: "C", c: "Wisconsin", o: 92, r: 5 },
    { f: "Dave", l: "Casper", p: "TE", c: "Notre Dame", o: 88, r: 2 },
    { f: "Danny", l: "White", p: "QB", c: "Arizona State", o: 80, r: 3 },
    { f: "Nat", l: "Moore", p: "WR", c: "Florida", o: 82, r: 3 },
    { f: "Jack", l: "Bowen", p: "OLB", c: "Tennessee", o: 70, r: 2 },
    { f: "Randy", l: "Gradishar", p: "MLB", c: "Ohio State", o: 88, r: 1 },
    { f: "John", l: "Dutton", p: "DE", c: "Nebraska", o: 80, r: 1 },
  ],
  1975: [
    { f: "Steve", l: "Bartkowski", p: "QB", c: "California", o: 80, r: 1 },
    { f: "Randy", l: "White", p: "DT", c: "Maryland", o: 94, r: 1 },
    { f: "Walter", l: "Payton", p: "RB", c: "Jackson State", o: 96, r: 1 },
    { f: "Robert", l: "Brazile", p: "OLB", c: "Jackson State", o: 88, r: 1 },
    { f: "Russ", l: "Francis", p: "TE", c: "Oregon", o: 82, r: 1 },
    { f: "Mike", l: "Hartenstine", p: "DE", c: "Penn State", o: 76, r: 2 },
    { f: "Steve", l: "Grogan", p: "QB", c: "Kansas State", o: 80, r: 5 },
    { f: "Dewey", l: "Selmon", p: "DT", c: "Oklahoma", o: 78, r: 2 },
    { f: "Fred", l: "Dean", p: "DE", c: "Louisiana Tech", o: 88, r: 2 },
    { f: "Louie", l: "Kelcher", p: "DT", c: "SMU", o: 82, r: 2 },
    { f: "Pat", l: "McInally", p: "P", c: "Harvard", o: 78, r: 5 },
  ],
  1976: [
    { f: "Lee Roy", l: "Selmon", p: "DE", c: "Oklahoma", o: 94, r: 1 },
    { f: "Steve", l: "Niehaus", p: "DT", c: "Notre Dame", o: 74, r: 1 },
    { f: "Chuck", l: "Muncie", p: "RB", c: "California", o: 84, r: 1 },
    { f: "Mike", l: "Haynes", p: "CB", c: "Arizona State", o: 90, r: 1 },
    { f: "Ken", l: "Jones", p: "LT", c: "Michigan", o: 72, r: 1 },
    { f: "Richard", l: "Todd", p: "QB", c: "Alabama", o: 76, r: 1 },
    { f: "Mike", l: "Dawson", p: "DT", c: "Arizona", o: 74, r: 1 },
    { f: "Sammy", l: "White", p: "WR", c: "Grambling", o: 80, r: 1 },
    { f: "Kim", l: "Bokamper", p: "OLB", c: "San Jose State", o: 80, r: 1 },
    { f: "James", l: "Hunter", p: "CB", c: "Grambling", o: 76, r: 1 },
    { f: "Larry", l: "Gordon", p: "OLB", c: "Arizona State", o: 76, r: 1 },
    { f: "Steve", l: "Largent", p: "WR", c: "Tulsa", o: 86, r: 4 },
    { f: "Harry", l: "Carson", p: "MLB", c: "South Carolina State", o: 88, r: 4 },
  ],
  1977: [
    { f: "Ricky", l: "Bell", p: "RB", c: "USC", o: 80, r: 1 },
    { f: "Tony", l: "Dorsett", p: "RB", c: "Pitt", o: 92, r: 1 },
    { f: "Bob", l: "Baumhower", p: "DT", c: "Alabama", o: 84, r: 2 },
    { f: "Joe", l: "Klecko", p: "DT", c: "Temple", o: 88, r: 6 },
    { f: "A.J.", l: "Duhe", p: "OLB", c: "LSU", o: 82, r: 1 },
    { f: "Wesley", l: "Walker", p: "WR", c: "California", o: 82, r: 2 },
    { f: "Gary", l: "Jeter", p: "DE", c: "USC", o: 78, r: 1 },
    { f: "Robert", l: "Jackson", p: "OLB", c: "Texas A&M", o: 74, r: 1 },
    { f: "Ted", l: "Albrecht", p: "LT", c: "California", o: 74, r: 1 },
    { f: "Stanley", l: "Morgan", p: "WR", c: "Tennessee", o: 84, r: 1 },
    { f: "Dave", l: "Logan", p: "WR", c: "Colorado", o: 76, r: 3 },
  ],
  1978: [
    { f: "Earl", l: "Campbell", p: "RB", c: "Texas", o: 94, r: 1 },
    { f: "Bob", l: "Cryder", p: "RG", c: "Alabama", o: 72, r: 1 },
    { f: "James", l: "Lofton", p: "WR", c: "Stanford", o: 90, r: 1 },
    { f: "Chris", l: "Ward", p: "LT", c: "Ohio State", o: 74, r: 1 },
    { f: "Terry", l: "Miller", p: "RB", c: "Oklahoma State", o: 74, r: 1 },
    { f: "Ozzie", l: "Newsome", p: "TE", c: "Alabama", o: 90, r: 1 },
    { f: "Al", l: "Baker", p: "DE", c: "Colorado State", o: 84, r: 2 },
    { f: "Doug", l: "Williams", p: "QB", c: "Grambling", o: 82, r: 1 },
    { f: "Wes", l: "Chandler", p: "WR", c: "Florida", o: 84, r: 1 },
    { f: "John", l: "Jefferson", p: "WR", c: "Arizona State", o: 84, r: 1 },
    { f: "Ross", l: "Browner", p: "DE", c: "Notre Dame", o: 80, r: 1 },
    { f: "Art", l: "Still", p: "DE", c: "Kentucky", o: 82, r: 1 },
  ],
  1979: [
    { f: "Tom", l: "Cousineau", p: "MLB", c: "Ohio State", o: 78, r: 1 },
    { f: "Phil", l: "Simms", p: "QB", c: "Morehead State", o: 86, r: 1 },
    { f: "Kellen", l: "Winslow", p: "TE", c: "Missouri", o: 92, r: 1 },
    { f: "Ottis", l: "Anderson", p: "RB", c: "Miami", o: 86, r: 1 },
    { f: "Charles", l: "Alexander", p: "RB", c: "LSU", o: 74, r: 1 },
    { f: "Joe", l: "Montana", p: "QB", c: "Notre Dame", o: 90, r: 3 },
    { f: "Fred", l: "Smerlas", p: "DT", c: "Boston College", o: 82, r: 2 },
    { f: "Jerry", l: "Butler", p: "WR", c: "Clemson", o: 78, r: 1 },
    { f: "Dan", l: "Hampton", p: "DE", c: "Arkansas", o: 88, r: 1 },
    { f: "Marty", l: "Lyons", p: "DT", c: "Alabama", o: 80, r: 1 },
    { f: "Jim", l: "Haslett", p: "OLB", c: "Indiana (PA)", o: 78, r: 2 },
  ],
  1980: [
    { f: "Billy", l: "Sims", p: "RB", c: "Oklahoma", o: 88, r: 1 },
    { f: "Lam", l: "Jones", p: "WR", c: "Texas", o: 74, r: 1 },
    { f: "Anthony", l: "Munoz", p: "LT", c: "USC", o: 96, r: 1 },
    { f: "Bruce", l: "Clark", p: "DT", c: "Penn State", o: 76, r: 1 },
    { f: "Curtis", l: "Dickey", p: "RB", c: "Texas A&M", o: 76, r: 1 },
    { f: "Art", l: "Monk", p: "WR", c: "Syracuse", o: 88, r: 1 },
    { f: "Dwight", l: "Stephenson", p: "C", c: "Alabama", o: 92, r: 2 },
    { f: "Joe", l: "Cribbs", p: "RB", c: "Auburn", o: 80, r: 2 },
    { f: "Ray", l: "Butler", p: "WR", c: "USC", o: 74, r: 4 },
    { f: "Mark", l: "Gastineau", p: "DE", c: "East Central", o: 84, r: 2 },
    { f: "Keena", l: "Turner", p: "OLB", c: "Purdue", o: 80, r: 2 },
  ],
  1981: [
    { f: "George", l: "Rogers", p: "RB", c: "South Carolina", o: 84, r: 1 },
    { f: "Lawrence", l: "Taylor", p: "OLB", c: "North Carolina", o: 98, r: 1 },
    { f: "Ronnie", l: "Lott", p: "S", c: "USC", o: 94, r: 1 },
    { f: "Keith", l: "Van Horne", p: "RT", c: "USC", o: 80, r: 1 },
    { f: "E.J.", l: "Junior", p: "OLB", c: "Alabama", o: 80, r: 1 },
    { f: "Rich", l: "Campbell", p: "QB", c: "California", o: 70, r: 1 },
    { f: "James", l: "Brooks", p: "RB", c: "Auburn", o: 82, r: 1 },
    { f: "Mike", l: "Quick", p: "WR", c: "North Carolina State", o: 82, r: 1 },
    { f: "Howie", l: "Long", p: "DE", c: "Villanova", o: 90, r: 2 },
    { f: "Cris", l: "Collinsworth", p: "WR", c: "Florida", o: 82, r: 2 },
    { f: "Neil", l: "Lomax", p: "QB", c: "Portland State", o: 80, r: 2 },
    { f: "Freeman", l: "McNeil", p: "RB", c: "UCLA", o: 84, r: 1 },
  ],
  1982: [
    { f: "Kenneth", l: "Sims", p: "DT", c: "Texas", o: 76, r: 1 },
    { f: "John", l: "Riehl", p: "DT", c: "Maryland", o: 70, r: 1 },
    { f: "Gerald", l: "Riggs", p: "RB", c: "Arizona State", o: 82, r: 1 },
    { f: "Art", l: "Schlichter", p: "QB", c: "Ohio State", o: 70, r: 1 },
    { f: "Jim", l: "McMahon", p: "QB", c: "BYU", o: 84, r: 1 },
    { f: "Marcus", l: "Allen", p: "RB", c: "USC", o: 92, r: 1 },
    { f: "Darrin", l: "Nelson", p: "RB", c: "Stanford", o: 76, r: 1 },
    { f: "Mike", l: "Munchak", p: "LG", c: "Penn State", o: 90, r: 1 },
    { f: "Andre", l: "Tippett", p: "OLB", c: "Iowa", o: 88, r: 2 },
    { f: "Chip", l: "Banks", p: "OLB", c: "USC", o: 82, r: 1 },
    { f: "Luis", l: "Sharpe", p: "LT", c: "UCLA", o: 82, r: 1 },
    { f: "Gary", l: "Anderson", p: "K", c: "Syracuse", o: 86, r: 7 },
  ],
  1983: [
    { f: "John", l: "Elway", p: "QB", c: "Stanford", o: 94, r: 1 },
    { f: "Eric", l: "Dickerson", p: "RB", c: "SMU", o: 94, r: 1 },
    { f: "Curt", l: "Warner", p: "RB", c: "Penn State", o: 86, r: 1 },
    { f: "Chris", l: "Hinton", p: "LT", c: "Northwestern", o: 84, r: 1 },
    { f: "Billy", l: "Ray Smith", p: "OLB", c: "Arkansas", o: 78, r: 1 },
    { f: "Jim", l: "Kelly", p: "QB", c: "Miami", o: 90, r: 1 },
    { f: "Todd", l: "Blackledge", p: "QB", c: "Penn State", o: 72, r: 1 },
    { f: "Tony", l: "Eason", p: "QB", c: "Illinois", o: 76, r: 1 },
    { f: "Ken", l: "O'Brien", p: "QB", c: "Cal-Davis", o: 80, r: 1 },
    { f: "Terry", l: "Kinard", p: "S", c: "Clemson", o: 80, r: 1 },
    { f: "Bruce", l: "Matthews", p: "RG", c: "USC", o: 92, r: 1 },
    { f: "Jim", l: "Covert", p: "LT", c: "Pitt", o: 86, r: 1 },
    { f: "Dan", l: "Marino", p: "QB", c: "Pitt", o: 94, r: 1 },
    { f: "Darrell", l: "Green", p: "CB", c: "Texas A&I", o: 92, r: 1 },
    { f: "Richard", l: "Dent", p: "DE", c: "Tennessee State", o: 88, r: 8 },
    { f: "Karl", l: "Mecklenburg", p: "OLB", c: "Minnesota", o: 84, r: 12 },
    { f: "Roger", l: "Craig", p: "RB", c: "Nebraska", o: 86, r: 2 },
    { f: "Joey", l: "Browner", p: "S", c: "USC", o: 86, r: 1 },
    { f: "Dave", l: "Duerson", p: "S", c: "Notre Dame", o: 80, r: 3 },
  ],
  1984: [
    { f: "Irving", l: "Fryar", p: "WR", c: "Nebraska", o: 84, r: 1 },
    { f: "Dean", l: "Steinkuhler", p: "RG", c: "Nebraska", o: 76, r: 1 },
    { f: "Carl", l: "Banks", p: "OLB", c: "Michigan State", o: 84, r: 1 },
    { f: "Kenny", l: "Jackson", p: "WR", c: "Penn State", o: 74, r: 1 },
    { f: "Bill", l: "Maas", p: "DT", c: "Pitt", o: 78, r: 1 },
    { f: "Ricky", l: "Sanders", p: "WR", c: "SW Texas State", o: 80, r: 1 },
    { f: "Louis", l: "Lipps", p: "WR", c: "Southern Miss", o: 82, r: 1 },
    { f: "Wilber", l: "Marshall", p: "OLB", c: "Florida", o: 86, r: 1 },
    { f: "Ron", l: "Rivera", p: "MLB", c: "California", o: 78, r: 2 },
    { f: "Boomer", l: "Esiason", p: "QB", c: "Maryland", o: 84, r: 2 },
    { f: "Reggie", l: "White", p: "DE", c: "Tennessee", o: 96, r: 1 },
    { f: "Steve", l: "Young", p: "QB", c: "BYU", o: 92, r: 1 },
    { f: "Gary", l: "Zimmerman", p: "LT", c: "Oregon", o: 90, r: 1 },
  ],
  1985: [
    { f: "Bruce", l: "Smith", p: "DE", c: "Virginia Tech", o: 96, r: 1 },
    { f: "Bill", l: "Fralic", p: "RG", c: "Pitt", o: 84, r: 1 },
    { f: "Ray", l: "Childress", p: "DT", c: "Texas A&M", o: 86, r: 1 },
    { f: "Chris", l: "Doleman", p: "DE", c: "Pitt", o: 88, r: 1 },
    { f: "Lomas", l: "Brown", p: "LT", c: "Florida", o: 86, r: 1 },
    { f: "Jerry", l: "Rice", p: "WR", c: "Mississippi Valley State", o: 98, r: 1 },
    { f: "Al", l: "Toon", p: "WR", c: "Wisconsin", o: 84, r: 1 },
    { f: "Ron", l: "Holmes", p: "DE", c: "Washington", o: 76, r: 1 },
    { f: "Andre", l: "Reed", p: "WR", c: "Kutztown", o: 86, r: 4 },
    { f: "Kevin", l: "Greene", p: "OLB", c: "Auburn", o: 88, r: 5 },
    { f: "Jay", l: "Novacek", p: "TE", c: "Wyoming", o: 84, r: 6 },
    { f: "Jerry", l: "Gray", p: "CB", c: "Texas", o: 82, r: 1 },
    { f: "Steve", l: "Tasker", p: "WR", c: "Northwestern", o: 76, r: 9 },
  ],
  1986: [
    { f: "Bo", l: "Jackson", p: "RB", c: "Auburn", o: 90, r: 1 },
    { f: "Tony", l: "Casillas", p: "DT", c: "Oklahoma", o: 80, r: 1 },
    { f: "Jim", l: "Everett", p: "QB", c: "Purdue", o: 82, r: 1 },
    { f: "Jon", l: "Hand", p: "DE", c: "Alabama", o: 76, r: 1 },
    { f: "Keith", l: "Byars", p: "RB", c: "Ohio State", o: 80, r: 1 },
    { f: "Leslie", l: "O'Neal", p: "DE", c: "Oklahoma State", o: 86, r: 1 },
    { f: "Mike", l: "Haight", p: "LT", c: "Iowa", o: 72, r: 1 },
    { f: "Charles", l: "Haley", p: "OLB", c: "James Madison", o: 88, r: 4 },
    { f: "Randall", l: "Cunningham", p: "QB", c: "UNLV", o: 84, r: 2 },
    { f: "Tim", l: "McDonald", p: "S", c: "USC", o: 82, r: 2 },
    { f: "Pat", l: "Swilling", p: "OLB", c: "Georgia Tech", o: 86, r: 2 },
  ],
  1987: [
    { f: "Vinny", l: "Testaverde", p: "QB", c: "Miami", o: 80, r: 1 },
    { f: "Cornelius", l: "Bennett", p: "OLB", c: "Alabama", o: 88, r: 1 },
    { f: "Alonzo", l: "Highsmith", p: "FB", c: "Miami", o: 76, r: 1 },
    { f: "Brent", l: "Fullwood", p: "RB", c: "Auburn", o: 74, r: 1 },
    { f: "Mike", l: "Junkin", p: "OLB", c: "Duke", o: 70, r: 1 },
    { f: "Rod", l: "Woodson", p: "CB", c: "Purdue", o: 94, r: 1 },
    { f: "Kelly", l: "Stouffer", p: "QB", c: "Colorado State", o: 70, r: 1 },
    { f: "Shane", l: "Conlan", p: "OLB", c: "Penn State", o: 82, r: 1 },
    { f: "Harris", l: "Barton", p: "RT", c: "North Carolina", o: 82, r: 1 },
    { f: "Christian", l: "Okoye", p: "RB", c: "Azusa Pacific", o: 82, r: 2 },
    { f: "Steve", l: "Beuerlein", p: "QB", c: "Notre Dame", o: 76, r: 4 },
    { f: "Haywood", l: "Jeffires", p: "WR", c: "North Carolina State", o: 82, r: 1 },
    { f: "Jerry", l: "Ball", p: "DT", c: "SMU", o: 82, r: 3 },
  ],
  1988: [
    { f: "Aundray", l: "Bruce", p: "OLB", c: "Auburn", o: 74, r: 1 },
    { f: "Neil", l: "Smith", p: "DE", c: "Nebraska", o: 86, r: 1 },
    { f: "Bennie", l: "Blades", p: "S", c: "Miami", o: 82, r: 1 },
    { f: "Sterling", l: "Sharpe", p: "WR", c: "South Carolina", o: 88, r: 1 },
    { f: "Tim", l: "Brown", p: "WR", c: "Notre Dame", o: 88, r: 1 },
    { f: "Michael", l: "Irvin", p: "WR", c: "Miami", o: 90, r: 1 },
    { f: "Randall", l: "McDaniel", p: "LG", c: "Arizona State", o: 90, r: 1 },
    { f: "Thurman", l: "Thomas", p: "RB", c: "Oklahoma State", o: 90, r: 2 },
    { f: "Eric", l: "Allen", p: "CB", c: "Arizona State", o: 86, r: 2 },
    { f: "Ken", l: "Norton", p: "MLB", c: "UCLA", o: 84, r: 2 },
    { f: "Cris", l: "Carter", p: "WR", c: "Ohio State", o: 90, r: 4 },
    { f: "Michael", l: "Dean Perry", p: "DT", c: "Clemson", o: 82, r: 2 },
  ],
  1989: [
    { f: "Troy", l: "Aikman", p: "QB", c: "UCLA", o: 90, r: 1 },
    { f: "Tony", l: "Mandarich", p: "LT", c: "Michigan State", o: 72, r: 1 },
    { f: "Barry", l: "Sanders", p: "RB", c: "Oklahoma State", o: 98, r: 1 },
    { f: "Derrick", l: "Thomas", p: "OLB", c: "Alabama", o: 92, r: 1 },
    { f: "Deion", l: "Sanders", p: "CB", c: "Florida State", o: 92, r: 1 },
    { f: "Broderick", l: "Thomas", p: "OLB", c: "Nebraska", o: 76, r: 1 },
    { f: "Tim", l: "McGee", p: "WR", c: "Tennessee", o: 74, r: 1 },
    { f: "Steve", l: "Atwater", p: "S", c: "Arkansas", o: 88, r: 1 },
    { f: "Andre", l: "Rison", p: "WR", c: "Michigan State", o: 84, r: 1 },
    { f: "Don", l: "Beebe", p: "WR", c: "Chadron State", o: 76, r: 3 },
    { f: "Steve", l: "Wisniewski", p: "LG", c: "Penn State", o: 88, r: 2 },
    { f: "Carnell", l: "Lake", p: "S", c: "UCLA", o: 86, r: 2 },
    { f: "Daryl", l: "Johnston", p: "FB", c: "Syracuse", o: 82, r: 2 },
  ],
  1990: [
    { f: "Jeff", l: "George", p: "QB", c: "Illinois", o: 78, r: 1 },
    { f: "Blair", l: "Thomas", p: "RB", c: "Penn State", o: 74, r: 1 },
    { f: "Cortez", l: "Kennedy", p: "DT", c: "Miami", o: 90, r: 1 },
    { f: "Keith", l: "McCants", p: "OLB", c: "Alabama", o: 72, r: 1 },
    { f: "Junior", l: "Seau", p: "MLB", c: "USC", o: 94, r: 1 },
    { f: "Mark", l: "Carrier", p: "S", c: "USC", o: 80, r: 1 },
    { f: "Emmitt", l: "Smith", p: "RB", c: "Florida", o: 94, r: 1 },
    { f: "Richmond", l: "Webb", p: "LT", c: "Texas A&M", o: 86, r: 1 },
    { f: "Chris", l: "Singletary", p: "MLB", c: "Baylor", o: 70, r: 1 },
    { f: "Shannon", l: "Sharpe", p: "TE", c: "Savannah State", o: 88, r: 7 },
    { f: "LeRoy", l: "Butler", p: "S", c: "Florida State", o: 88, r: 2 },
    { f: "Rob", l: "Moore", p: "WR", c: "Syracuse", o: 82, r: 1 },
  ],
  1991: [
    { f: "Russell", l: "Maryland", p: "DT", c: "Miami", o: 80, r: 1 },
    { f: "Eric", l: "Turner", p: "S", c: "UCLA", o: 84, r: 1 },
    { f: "Bruce", l: "Pickens", p: "CB", c: "Nebraska", o: 70, r: 1 },
    { f: "Mike", l: "Croel", p: "OLB", c: "Nebraska", o: 76, r: 1 },
    { f: "Todd", l: "Marinovich", p: "QB", c: "USC", o: 68, r: 1 },
    { f: "Herman", l: "Moore", p: "WR", c: "Virginia", o: 86, r: 1 },
    { f: "Brett", l: "Favre", p: "QB", c: "Southern Miss", o: 90, r: 2 },
    { f: "Aeneas", l: "Williams", p: "CB", c: "Southern", o: 88, r: 3 },
    { f: "Ricky", l: "Watters", p: "RB", c: "Notre Dame", o: 84, r: 2 },
    { f: "Leonard", l: "Russell", p: "RB", c: "Arizona State", o: 78, r: 1 },
    { f: "Mo", l: "Lewis", p: "OLB", c: "Georgia", o: 82, r: 3 },
  ],
  1992: [
    { f: "Steve", l: "Emtman", p: "DT", c: "Washington", o: 78, r: 1 },
    { f: "Quentin", l: "Coryatt", p: "OLB", c: "Texas A&M", o: 76, r: 1 },
    { f: "Sean", l: "Gilbert", p: "DT", c: "Pitt", o: 78, r: 1 },
    { f: "Desmond", l: "Howard", p: "WR", c: "Michigan", o: 78, r: 1 },
    { f: "Terrell", l: "Buckley", p: "CB", c: "Florida State", o: 76, r: 1 },
    { f: "David", l: "Klingler", p: "QB", c: "Houston", o: 70, r: 1 },
    { f: "Troy", l: "Vincent", p: "CB", c: "Wisconsin", o: 84, r: 1 },
    { f: "Bob", l: "Whitfield", p: "LT", c: "Stanford", o: 82, r: 1 },
    { f: "Tommy", l: "Maddox", p: "QB", c: "UCLA", o: 72, r: 1 },
    { f: "Jimmy", l: "Smith", p: "WR", c: "Jackson State", o: 84, r: 2 },
    { f: "Darren", l: "Woodson", p: "S", c: "Arizona State", o: 86, r: 2 },
    { f: "Marco", l: "Coleman", p: "OLB", c: "Georgia Tech", o: 78, r: 1 },
    { f: "Dale", l: "Carter", p: "CB", c: "Tennessee", o: 82, r: 1 },
  ],
  1993: [
    { f: "Drew", l: "Bledsoe", p: "QB", c: "Washington State", o: 86, r: 1 },
    { f: "Rick", l: "Mirer", p: "QB", c: "Notre Dame", o: 76, r: 1 },
    { f: "Marvin", l: "Jones", p: "MLB", c: "Florida State", o: 78, r: 1 },
    { f: "Willie", l: "Roaf", p: "LT", c: "Louisiana Tech", o: 92, r: 1 },
    { f: "John", l: "Copeland", p: "DE", c: "Alabama", o: 76, r: 1 },
    { f: "Eric", l: "Curry", p: "DE", c: "Alabama", o: 74, r: 1 },
    { f: "Jerome", l: "Bettis", p: "RB", c: "Notre Dame", o: 88, r: 1 },
    { f: "Michael", l: "Strahan", p: "DE", c: "Texas Southern", o: 90, r: 2 },
    { f: "Wayne", l: "Gandy", p: "LT", c: "Auburn", o: 80, r: 1 },
    { f: "Garrison", l: "Hearst", p: "RB", c: "Georgia", o: 82, r: 1 },
    { f: "Will", l: "Shields", p: "RG", c: "Nebraska", o: 90, r: 3 },
    { f: "John", l: "Lynch", p: "S", c: "Stanford", o: 88, r: 3 },
  ],
  1994: [
    { f: "Dan", l: "Wilkinson", p: "DT", c: "Ohio State", o: 80, r: 1 },
    { f: "Marshall", l: "Faulk", p: "RB", c: "San Diego State", o: 92, r: 1 },
    { f: "Heath", l: "Shuler", p: "QB", c: "Tennessee", o: 72, r: 1 },
    { f: "Trev", l: "Alberts", p: "OLB", c: "Nebraska", o: 74, r: 1 },
    { f: "Johnnie", l: "Morton", p: "WR", c: "USC", o: 80, r: 1 },
    { f: "Willie", l: "McGinest", p: "OLB", c: "USC", o: 86, r: 1 },
    { f: "Bryant", l: "Young", p: "DT", c: "Notre Dame", o: 86, r: 1 },
    { f: "Charles", l: "Johnson", p: "WR", c: "Colorado", o: 76, r: 1 },
    { f: "Darnay", l: "Scott", p: "WR", c: "San Diego State", o: 78, r: 2 },
    { f: "Jason", l: "Sehorn", p: "CB", c: "USC", o: 80, r: 2 },
    { f: "Isaac", l: "Bruce", p: "WR", c: "Memphis", o: 88, r: 2 },
    { f: "Larry", l: "Allen", p: "LG", c: "Sonoma State", o: 92, r: 2 },
  ],
  1995: [
    { f: "Ki-Jana", l: "Carter", p: "RB", c: "Penn State", o: 78, r: 1 },
    { f: "Tony", l: "Boselli", p: "LT", c: "USC", o: 90, r: 1 },
    { f: "Steve", l: "McNair", p: "QB", c: "Alcorn State", o: 88, r: 1 },
    { f: "Michael", l: "Westbrook", p: "WR", c: "Colorado", o: 78, r: 1 },
    { f: "Kerry", l: "Collins", p: "QB", c: "Penn State", o: 80, r: 1 },
    { f: "Kevin", l: "Carter", p: "DE", c: "Florida", o: 84, r: 1 },
    { f: "Kyle", l: "Brady", p: "TE", c: "Penn State", o: 76, r: 1 },
    { f: "Joey", l: "Galloway", p: "WR", c: "Ohio State", o: 82, r: 1 },
    { f: "Warren", l: "Sapp", p: "DT", c: "Miami", o: 92, r: 1 },
    { f: "Curtis", l: "Martin", p: "RB", c: "Pitt", o: 88, r: 3 },
    { f: "Terrell", l: "Davis", p: "RB", c: "Georgia", o: 86, r: 6 },
    { f: "Ty", l: "Law", p: "CB", c: "Michigan", o: 90, r: 1 },
    { f: "Lawyer", l: "Milloy", p: "S", c: "Washington", o: 84, r: 2 },
  ],
  1996: [
    { f: "Keyshawn", l: "Johnson", p: "WR", c: "USC", o: 84, r: 1 },
    { f: "Kevin", l: "Hardy", p: "OLB", c: "Illinois", o: 80, r: 1 },
    { f: "Simeon", l: "Rice", p: "DE", c: "Illinois", o: 86, r: 1 },
    { f: "Jonathan", l: "Ogden", p: "LT", c: "UCLA", o: 94, r: 1 },
    { f: "Cedric", l: "Jones", p: "DE", c: "Oklahoma", o: 74, r: 1 },
    { f: "Lawrence", l: "Phillips", p: "RB", c: "Nebraska", o: 72, r: 1 },
    { f: "Terry", l: "Glenn", p: "WR", c: "Ohio State", o: 80, r: 1 },
    { f: "Marvin", l: "Harrison", p: "WR", c: "Syracuse", o: 92, r: 1 },
    { f: "Ray", l: "Lewis", p: "MLB", c: "Miami", o: 96, r: 1 },
    { f: "Eddie", l: "George", p: "RB", c: "Ohio State", o: 86, r: 1 },
    { f: "Terrell", l: "Owens", p: "WR", c: "Chattanooga", o: 90, r: 3 },
    { f: "Zach", l: "Thomas", p: "MLB", c: "Texas Tech", o: 88, r: 5 },
    { f: "Muhsin", l: "Muhammad", p: "WR", c: "Michigan State", o: 82, r: 2 },
  ],
  1997: [
    { f: "Orlando", l: "Pace", p: "LT", c: "Ohio State", o: 92, r: 1 },
    { f: "Darrell", l: "Russell", p: "DT", c: "USC", o: 78, r: 1 },
    { f: "Shawn", l: "Springs", p: "CB", c: "Ohio State", o: 84, r: 1 },
    { f: "Peter", l: "Boulware", p: "OLB", c: "Florida State", o: 84, r: 1 },
    { f: "Warrick", l: "Dunn", p: "RB", c: "Florida State", o: 84, r: 1 },
    { f: "Walter", l: "Jones", p: "LT", c: "Florida State", o: 94, r: 1 },
    { f: "Ike", l: "Hilliard", p: "WR", c: "Florida", o: 78, r: 1 },
    { f: "James", l: "Farrior", p: "OLB", c: "Virginia", o: 82, r: 1 },
    { f: "Tony", l: "Gonzalez", p: "TE", c: "California", o: 92, r: 1 },
    { f: "Jake", l: "Plummer", p: "QB", c: "Arizona State", o: 80, r: 2 },
    { f: "Corey", l: "Dillon", p: "RB", c: "Washington", o: 84, r: 2 },
    { f: "Ronde", l: "Barber", p: "CB", c: "Virginia", o: 86, r: 3 },
    { f: "Jason", l: "Taylor", p: "DE", c: "Akron", o: 88, r: 3 },
  ],
  1998: [
    { f: "Peyton", l: "Manning", p: "QB", c: "Tennessee", o: 96, r: 1 },
    { f: "Ryan", l: "Leaf", p: "QB", c: "Washington State", o: 74, r: 1 },
    { f: "Andre", l: "Wadsworth", p: "DE", c: "Florida State", o: 74, r: 1 },
    { f: "Charles", l: "Woodson", p: "CB", c: "Michigan", o: 90, r: 1 },
    { f: "Curtis", l: "Enis", p: "RB", c: "Penn State", o: 72, r: 1 },
    { f: "Grant", l: "Wistrom", p: "DE", c: "Nebraska", o: 80, r: 1 },
    { f: "Kyle", l: "Turley", p: "RT", c: "San Diego State", o: 80, r: 1 },
    { f: "Randy", l: "Moss", p: "WR", c: "Marshall", o: 96, r: 1 },
    { f: "Fred", l: "Taylor", p: "RB", c: "Florida", o: 86, r: 1 },
    { f: "Alan", l: "Faneca", p: "LG", c: "LSU", o: 90, r: 1 },
    { f: "Takeo", l: "Spikes", p: "OLB", c: "Auburn", o: 84, r: 1 },
    { f: "Hines", l: "Ward", p: "WR", c: "Georgia", o: 86, r: 3 },
    { f: "Matt", l: "Hasselbeck", p: "QB", c: "Boston College", o: 84, r: 6 },
    { f: "Olin", l: "Kreutz", p: "C", c: "Washington", o: 86, r: 3 },
  ],
  1999: [
    { f: "Tim", l: "Couch", p: "QB", c: "Kentucky", o: 74, r: 1 },
    { f: "Donovan", l: "McNabb", p: "QB", c: "Syracuse", o: 88, r: 1 },
    { f: "Akili", l: "Smith", p: "QB", c: "Oregon", o: 70, r: 1 },
    { f: "Edgerrin", l: "James", p: "RB", c: "Miami", o: 90, r: 1 },
    { f: "Ricky", l: "Williams", p: "RB", c: "Texas", o: 86, r: 1 },
    { f: "Torry", l: "Holt", p: "WR", c: "NC State", o: 88, r: 1 },
    { f: "Champ", l: "Bailey", p: "CB", c: "Georgia", o: 92, r: 1 },
    { f: "David", l: "Boston", p: "WR", c: "Ohio State", o: 78, r: 1 },
    { f: "Chris", l: "McAlister", p: "CB", c: "Arizona", o: 84, r: 1 },
    { f: "Jevon", l: "Kearse", p: "DE", c: "Florida", o: 86, r: 1 },
    { f: "Daunte", l: "Culpepper", p: "QB", c: "Central Florida", o: 84, r: 1 },
    { f: "Donald", l: "Driver", p: "WR", c: "Alcorn State", o: 84, r: 7 },
  ],
  2000: [
    { f: "Courtney", l: "Brown", p: "DE", c: "Penn State", o: 76, r: 1 },
    { f: "LaVar", l: "Arrington", p: "OLB", c: "Penn State", o: 82, r: 1 },
    { f: "Chris", l: "Samuels", p: "LT", c: "Alabama", o: 86, r: 1 },
    { f: "Peter", l: "Warrick", p: "WR", c: "Florida State", o: 76, r: 1 },
    { f: "Jamal", l: "Lewis", p: "RB", c: "Tennessee", o: 86, r: 1 },
    { f: "Brian", l: "Urlacher", p: "MLB", c: "New Mexico", o: 92, r: 1 },
    { f: "Plaxico", l: "Burress", p: "WR", c: "Michigan State", o: 84, r: 1 },
    { f: "Shaun", l: "Alexander", p: "RB", c: "Alabama", o: 86, r: 1 },
    { f: "Thomas", l: "Jones", p: "RB", c: "Virginia", o: 80, r: 1 },
    { f: "Tom", l: "Brady", p: "QB", c: "Michigan", o: 80, r: 6 },
    { f: "Chad", l: "Pennington", p: "QB", c: "Marshall", o: 80, r: 1 },
  ],
  2001: [
    { f: "Michael", l: "Vick", p: "QB", c: "Virginia Tech", o: 86, r: 1 },
    { f: "Leonard", l: "Davis", p: "RT", c: "Texas", o: 78, r: 1 },
    { f: "Gerard", l: "Warren", p: "DT", c: "Florida", o: 74, r: 1 },
    { f: "Justin", l: "Smith", p: "DE", c: "Missouri", o: 84, r: 1 },
    { f: "LaDainian", l: "Tomlinson", p: "RB", c: "TCU", o: 94, r: 1 },
    { f: "Richard", l: "Seymour", p: "DT", c: "Georgia", o: 90, r: 1 },
    { f: "Andre", l: "Carter", p: "DE", c: "California", o: 82, r: 1 },
    { f: "David", l: "Terrell", p: "WR", c: "Michigan", o: 74, r: 1 },
    { f: "Steve", l: "Hutchinson", p: "LG", c: "Michigan", o: 90, r: 1 },
    { f: "Drew", l: "Brees", p: "QB", c: "Purdue", o: 90, r: 2 },
    { f: "Santana", l: "Moss", p: "WR", c: "Miami", o: 84, r: 1 },
    { f: "Reggie", l: "Wayne", p: "WR", c: "Miami", o: 88, r: 1 },
  ],
  2002: [
    { f: "David", l: "Carr", p: "QB", c: "Fresno State", o: 76, r: 1 },
    { f: "Julius", l: "Peppers", p: "DE", c: "North Carolina", o: 90, r: 1 },
    { f: "Joey", l: "Harrington", p: "QB", c: "Oregon", o: 74, r: 1 },
    { f: "Mike", l: "Williams", p: "LT", c: "Texas", o: 74, r: 1 },
    { f: "Quentin", l: "Jammer", p: "CB", c: "Texas", o: 80, r: 1 },
    { f: "Albert", l: "Haynesworth", p: "DT", c: "Tennessee", o: 84, r: 1 },
    { f: "Bryant", l: "McKinnie", p: "LT", c: "Miami", o: 82, r: 1 },
    { f: "Roy", l: "Williams", p: "S", c: "Oklahoma", o: 84, r: 1 },
    { f: "Dwight", l: "Freeney", p: "DE", c: "Syracuse", o: 90, r: 1 },
    { f: "Jeremy", l: "Shockey", p: "TE", c: "Miami", o: 84, r: 1 },
    { f: "Ed", l: "Reed", p: "S", c: "Miami", o: 94, r: 1 },
    { f: "Clinton", l: "Portis", p: "RB", c: "Miami", o: 86, r: 2 },
    { f: "Larry", l: "Foote", p: "MLB", c: "Michigan", o: 78, r: 4 },
  ],
  2003: [
    { f: "Carson", l: "Palmer", p: "QB", c: "USC", o: 86, r: 1 },
    { f: "Charles", l: "Rogers", p: "WR", c: "Michigan State", o: 72, r: 1 },
    { f: "Andre", l: "Johnson", p: "WR", c: "Miami", o: 92, r: 1 },
    { f: "Dewayne", l: "Robertson", p: "DT", c: "Kentucky", o: 74, r: 1 },
    { f: "Terence", l: "Newman", p: "CB", c: "Kansas State", o: 82, r: 1 },
    { f: "John", l: "Henderson", p: "DT", c: "Tennessee", o: 82, r: 1 },
    { f: "Byron", l: "Leftwich", p: "QB", c: "Marshall", o: 76, r: 1 },
    { f: "Jordan", l: "Gross", p: "LT", c: "Utah", o: 84, r: 1 },
    { f: "Kevin", l: "Williams", p: "DT", c: "Oklahoma State", o: 86, r: 1 },
    { f: "Terrell", l: "Suggs", p: "OLB", c: "Arizona State", o: 88, r: 1 },
    { f: "Troy", l: "Polamalu", p: "S", c: "USC", o: 94, r: 1 },
    { f: "Willis", l: "McGahee", p: "RB", c: "Miami", o: 84, r: 1 },
    { f: "Anquan", l: "Boldin", p: "WR", c: "Florida State", o: 86, r: 2 },
    { f: "Jason", l: "Witten", p: "TE", c: "Tennessee", o: 88, r: 3 },
  ],
  2004: [
    { f: "Eli", l: "Manning", p: "QB", c: "Ole Miss", o: 88, r: 1 },
    { f: "Robert", l: "Gallery", p: "LT", c: "Iowa", o: 76, r: 1 },
    { f: "Larry", l: "Fitzgerald", p: "WR", c: "Pitt", o: 92, r: 1 },
    { f: "Philip", l: "Rivers", p: "QB", c: "NC State", o: 90, r: 1 },
    { f: "Sean", l: "Taylor", p: "S", c: "Miami", o: 90, r: 1 },
    { f: "Kellen", l: "Winslow", p: "TE", c: "Miami", o: 80, r: 1 },
    { f: "Roy", l: "Williams", p: "WR", c: "Texas", o: 80, r: 1 },
    { f: "DeAngelo", l: "Hall", p: "CB", c: "Virginia Tech", o: 82, r: 1 },
    { f: "Dunta", l: "Robinson", p: "CB", c: "South Carolina", o: 78, r: 1 },
    { f: "Ben", l: "Roethlisberger", p: "QB", c: "Miami (OH)", o: 90, r: 1 },
    { f: "Jonathan", l: "Vilma", p: "MLB", c: "Miami", o: 82, r: 1 },
    { f: "Steven", l: "Jackson", p: "RB", c: "Oregon State", o: 86, r: 1 },
    { f: "Vince", l: "Wilfork", p: "DT", c: "Miami", o: 88, r: 1 },
  ],
  2005: [
    { f: "Alex", l: "Smith", p: "QB", c: "Utah", o: 82, r: 1 },
    { f: "Ronnie", l: "Brown", p: "RB", c: "Auburn", o: 80, r: 1 },
    { f: "Braylon", l: "Edwards", p: "WR", c: "Michigan", o: 80, r: 1 },
    { f: "Cedric", l: "Benson", p: "RB", c: "Texas", o: 78, r: 1 },
    { f: "Cadillac", l: "Williams", p: "RB", c: "Auburn", o: 78, r: 1 },
    { f: "Adam", l: "Jones", p: "CB", c: "West Virginia", o: 80, r: 1 },
    { f: "Troy", l: "Williamson", p: "WR", c: "South Carolina", o: 72, r: 1 },
    { f: "Antrel", l: "Rolle", p: "S", c: "Miami", o: 82, r: 1 },
    { f: "Carlos", l: "Rogers", p: "CB", c: "Auburn", o: 80, r: 1 },
    { f: "DeMarcus", l: "Ware", p: "OLB", c: "Troy", o: 90, r: 1 },
    { f: "Aaron", l: "Rodgers", p: "QB", c: "California", o: 94, r: 1 },
    { f: "Frank", l: "Gore", p: "RB", c: "Miami", o: 88, r: 3 },
    { f: "Justin", l: "Tuck", p: "DE", c: "Notre Dame", o: 86, r: 3 },
  ],
  2006: [
    { f: "Mario", l: "Williams", p: "DE", c: "NC State", o: 86, r: 1 },
    { f: "Reggie", l: "Bush", p: "RB", c: "USC", o: 84, r: 1 },
    { f: "Vince", l: "Young", p: "QB", c: "Texas", o: 80, r: 1 },
    { f: "D'Brickashaw", l: "Ferguson", p: "LT", c: "Virginia", o: 84, r: 1 },
    { f: "A.J.", l: "Hawk", p: "OLB", c: "Ohio State", o: 80, r: 1 },
    { f: "Vernon", l: "Davis", p: "TE", c: "Maryland", o: 84, r: 1 },
    { f: "Michael", l: "Huff", p: "S", c: "Texas", o: 78, r: 1 },
    { f: "Donte", l: "Whitner", p: "S", c: "Ohio State", o: 78, r: 1 },
    { f: "Ernie", l: "Sims", p: "OLB", c: "Florida State", o: 76, r: 1 },
    { f: "Matt", l: "Leinart", p: "QB", c: "USC", o: 76, r: 1 },
    { f: "Jay", l: "Cutler", p: "QB", c: "Vanderbilt", o: 84, r: 1 },
    { f: "Haloti", l: "Ngata", p: "DT", c: "Oregon", o: 90, r: 1 },
    { f: "DeMeco", l: "Ryans", p: "MLB", c: "Alabama", o: 84, r: 2 },
    { f: "Marques", l: "Colston", p: "WR", c: "Hofstra", o: 84, r: 7 },
    { f: "Brandon", l: "Marshall", p: "WR", c: "UCF", o: 86, r: 4 },
  ],
  2007: [
    { f: "JaMarcus", l: "Russell", p: "QB", c: "LSU", o: 72, r: 1 },
    { f: "Calvin", l: "Johnson", p: "WR", c: "Georgia Tech", o: 96, r: 1 },
    { f: "Joe", l: "Thomas", p: "LT", c: "Wisconsin", o: 94, r: 1 },
    { f: "Gaines", l: "Adams", p: "DE", c: "Clemson", o: 74, r: 1 },
    { f: "Levi", l: "Brown", p: "LT", c: "Penn State", o: 74, r: 1 },
    { f: "Patrick", l: "Willis", p: "MLB", c: "Ole Miss", o: 90, r: 1 },
    { f: "Adrian", l: "Peterson", p: "RB", c: "Oklahoma", o: 94, r: 1 },
    { f: "Darrelle", l: "Revis", p: "CB", c: "Pitt", o: 92, r: 1 },
    { f: "Marshawn", l: "Lynch", p: "RB", c: "California", o: 86, r: 1 },
    { f: "Greg", l: "Olsen", p: "TE", c: "Miami", o: 84, r: 1 },
    { f: "Joe", l: "Staley", p: "LT", c: "Central Michigan", o: 86, r: 1 },
    { f: "Eric", l: "Weddle", p: "S", c: "Utah", o: 86, r: 2 },
  ],
  2008: [
    { f: "Jake", l: "Long", p: "LT", c: "Michigan", o: 86, r: 1 },
    { f: "Chris", l: "Long", p: "DE", c: "Virginia", o: 82, r: 1 },
    { f: "Matt", l: "Ryan", p: "QB", c: "Boston College", o: 88, r: 1 },
    { f: "Darren", l: "McFadden", p: "RB", c: "Arkansas", o: 80, r: 1 },
    { f: "Glenn", l: "Dorsey", p: "DT", c: "LSU", o: 76, r: 1 },
    { f: "Vernon", l: "Gholston", p: "OLB", c: "Ohio State", o: 68, r: 1 },
    { f: "Sedrick", l: "Ellis", p: "DT", c: "USC", o: 74, r: 1 },
    { f: "Joe", l: "Flacco", p: "QB", c: "Delaware", o: 86, r: 1 },
    { f: "Keith", l: "Rivers", p: "OLB", c: "USC", o: 76, r: 1 },
    { f: "Jerod", l: "Mayo", p: "MLB", c: "Tennessee", o: 84, r: 1 },
    { f: "DeSean", l: "Jackson", p: "WR", c: "California", o: 84, r: 2 },
    { f: "Jamaal", l: "Charles", p: "RB", c: "Texas", o: 88, r: 3 },
    { f: "Calais", l: "Campbell", p: "DE", c: "Miami", o: 88, r: 2 },
    { f: "Ray", l: "Rice", p: "RB", c: "Rutgers", o: 84, r: 2 },
  ],
  2009: [
    { f: "Matthew", l: "Stafford", p: "QB", c: "Georgia", o: 88, r: 1 },
    { f: "Jason", l: "Smith", p: "LT", c: "Baylor", o: 72, r: 1 },
    { f: "Tyson", l: "Jackson", p: "DE", c: "LSU", o: 74, r: 1 },
    { f: "Aaron", l: "Curry", p: "OLB", c: "Wake Forest", o: 74, r: 1 },
    { f: "Mark", l: "Sanchez", p: "QB", c: "USC", o: 76, r: 1 },
    { f: "Andre", l: "Smith", p: "RT", c: "Alabama", o: 80, r: 1 },
    { f: "Darrius", l: "Heyward-Bey", p: "WR", c: "Maryland", o: 72, r: 1 },
    { f: "Michael", l: "Crabtree", p: "WR", c: "Texas Tech", o: 84, r: 1 },
    { f: "Brian", l: "Cushing", p: "OLB", c: "USC", o: 82, r: 1 },
    { f: "Knowshon", l: "Moreno", p: "RB", c: "Georgia", o: 80, r: 1 },
    { f: "Clay", l: "Matthews", p: "OLB", c: "USC", o: 88, r: 1 },
    { f: "B.J.", l: "Raji", p: "DT", c: "Boston College", o: 80, r: 1 },
    { f: "LeSean", l: "McCoy", p: "RB", c: "Pitt", o: 88, r: 2 },
    { f: "Mike", l: "Wallace", p: "WR", c: "Ole Miss", o: 84, r: 3 },
    { f: "Julian", l: "Edelman", p: "WR", c: "Kent State", o: 82, r: 7 },
  ],
  2010: [
    { f: "Sam", l: "Bradford", p: "QB", c: "Oklahoma", o: 78, r: 1 },
    { f: "Ndamukong", l: "Suh", p: "DT", c: "Nebraska", o: 90, r: 1 },
    { f: "Gerald", l: "McCoy", p: "DT", c: "Oklahoma", o: 86, r: 1 },
    { f: "Trent", l: "Williams", p: "LT", c: "Oklahoma", o: 90, r: 1 },
    { f: "Eric", l: "Berry", p: "S", c: "Tennessee", o: 86, r: 1 },
    { f: "Russell", l: "Okung", p: "LT", c: "Oklahoma State", o: 82, r: 1 },
    { f: "Joe", l: "Haden", p: "CB", c: "Florida", o: 84, r: 1 },
    { f: "Rolando", l: "McClain", p: "MLB", c: "Alabama", o: 76, r: 1 },
    { f: "C.J.", l: "Spiller", p: "RB", c: "Clemson", o: 82, r: 1 },
    { f: "Earl", l: "Thomas", p: "S", c: "Texas", o: 90, r: 1 },
    { f: "Dez", l: "Bryant", p: "WR", c: "Oklahoma State", o: 88, r: 1 },
    { f: "Ryan", l: "Mathews", p: "RB", c: "Fresno State", o: 80, r: 1 },
    { f: "Jason", l: "Pierre-Paul", p: "DE", c: "South Florida", o: 86, r: 1 },
    { f: "Rob", l: "Gronkowski", p: "TE", c: "Arizona", o: 92, r: 2 },
    { f: "Jimmy", l: "Graham", p: "TE", c: "Miami", o: 88, r: 3 },
    { f: "Antonio", l: "Brown", p: "WR", c: "Central Michigan", o: 90, r: 6 },
    { f: "Kam", l: "Chancellor", p: "S", c: "Virginia Tech", o: 86, r: 5 },
  ],
  2011: [
    { f: "Cam", l: "Newton", p: "QB", c: "Auburn", o: 88, r: 1 },
    { f: "Von", l: "Miller", p: "OLB", c: "Texas A&M", o: 94, r: 1 },
    { f: "Marcell", l: "Dareus", p: "DT", c: "Alabama", o: 84, r: 1 },
    { f: "A.J.", l: "Green", p: "WR", c: "Georgia", o: 90, r: 1 },
    { f: "Patrick", l: "Peterson", p: "CB", c: "LSU", o: 90, r: 1 },
    { f: "Julio", l: "Jones", p: "WR", c: "Alabama", o: 92, r: 1 },
    { f: "Aldon", l: "Smith", p: "OLB", c: "Missouri", o: 84, r: 1 },
    { f: "Jake", l: "Locker", p: "QB", c: "Washington", o: 74, r: 1 },
    { f: "Tyron", l: "Smith", p: "LT", c: "USC", o: 92, r: 1 },
    { f: "Blaine", l: "Gabbert", p: "QB", c: "Missouri", o: 70, r: 1 },
    { f: "J.J.", l: "Watt", p: "DE", c: "Wisconsin", o: 96, r: 1 },
    { f: "Andy", l: "Dalton", p: "QB", c: "TCU", o: 82, r: 2 },
    { f: "Richard", l: "Sherman", p: "CB", c: "Stanford", o: 90, r: 5 },
    { f: "Cam", l: "Heyward", p: "DE", c: "Ohio State", o: 88, r: 1 },
  ],
  2012: [
    { f: "Andrew", l: "Luck", p: "QB", c: "Stanford", o: 90, r: 1 },
    { f: "Robert", l: "Griffin", p: "QB", c: "Baylor", o: 82, r: 1 },
    { f: "Trent", l: "Richardson", p: "RB", c: "Alabama", o: 76, r: 1 },
    { f: "Matt", l: "Kalil", p: "LT", c: "USC", o: 78, r: 1 },
    { f: "Justin", l: "Blackmon", p: "WR", c: "Oklahoma State", o: 76, r: 1 },
    { f: "Morris", l: "Claiborne", p: "CB", c: "LSU", o: 76, r: 1 },
    { f: "Mark", l: "Barron", p: "S", c: "Alabama", o: 78, r: 1 },
    { f: "Ryan", l: "Tannehill", p: "QB", c: "Texas A&M", o: 82, r: 1 },
    { f: "Fletcher", l: "Cox", p: "DT", c: "Mississippi State", o: 90, r: 1 },
    { f: "Luke", l: "Kuechly", p: "MLB", c: "Boston College", o: 94, r: 1 },
    { f: "Stephon", l: "Gilmore", p: "CB", c: "South Carolina", o: 88, r: 1 },
    { f: "Dont'a", l: "Hightower", p: "OLB", c: "Alabama", o: 84, r: 1 },
    { f: "Russell", l: "Wilson", p: "QB", c: "Wisconsin", o: 90, r: 3 },
    { f: "Bobby", l: "Wagner", p: "MLB", c: "Utah State", o: 92, r: 2 },
  ],
  2013: [
    { f: "Eric", l: "Fisher", p: "LT", c: "Central Michigan", o: 80, r: 1 },
    { f: "Luke", l: "Joeckel", p: "LT", c: "Texas A&M", o: 76, r: 1 },
    { f: "Dion", l: "Jordan", p: "DE", c: "Oregon", o: 74, r: 1 },
    { f: "Lane", l: "Johnson", p: "RT", c: "Oklahoma", o: 88, r: 1 },
    { f: "Ezekiel", l: "Ansah", p: "DE", c: "BYU", o: 82, r: 1 },
    { f: "Barkevious", l: "Mingo", p: "OLB", c: "LSU", o: 72, r: 1 },
    { f: "Jonathan", l: "Cooper", p: "LG", c: "North Carolina", o: 76, r: 1 },
    { f: "Tavon", l: "Austin", p: "WR", c: "West Virginia", o: 76, r: 1 },
    { f: "Dee", l: "Milliner", p: "CB", c: "Alabama", o: 74, r: 1 },
    { f: "Chance", l: "Warmack", p: "LG", c: "Alabama", o: 80, r: 1 },
    { f: "D.J.", l: "Fluker", p: "RT", c: "Alabama", o: 78, r: 1 },
    { f: "Sheldon", l: "Richardson", p: "DT", c: "Missouri", o: 82, r: 1 },
    { f: "Star", l: "Lotulelei", p: "DT", c: "Utah", o: 80, r: 1 },
    { f: "Kenny", l: "Vaccaro", p: "S", c: "Texas", o: 80, r: 1 },
    { f: "Tyler", l: "Eifert", p: "TE", c: "Notre Dame", o: 82, r: 1 },
    { f: "DeAndre", l: "Hopkins", p: "WR", c: "Clemson", o: 92, r: 1 },
    { f: "Le'Veon", l: "Bell", p: "RB", c: "Michigan State", o: 88, r: 2 },
    { f: "Travis", l: "Kelce", p: "TE", c: "Cincinnati", o: 92, r: 3 },
    { f: "Keenan", l: "Allen", p: "WR", c: "California", o: 88, r: 3 },
  ],
  2014: [
    { f: "Jadeveon", l: "Clowney", p: "DE", c: "South Carolina", o: 86, r: 1 },
    { f: "Greg", l: "Robinson", p: "LT", c: "Auburn", o: 74, r: 1 },
    { f: "Blake", l: "Bortles", p: "QB", c: "UCF", o: 76, r: 1 },
    { f: "Sammy", l: "Watkins", p: "WR", c: "Clemson", o: 84, r: 1 },
    { f: "Khalil", l: "Mack", p: "OLB", c: "Buffalo", o: 94, r: 1 },
    { f: "Jake", l: "Matthews", p: "LT", c: "Texas A&M", o: 86, r: 1 },
    { f: "Mike", l: "Evans", p: "WR", c: "Texas A&M", o: 90, r: 1 },
    { f: "Justin", l: "Gilbert", p: "CB", c: "Oklahoma State", o: 72, r: 1 },
    { f: "Anthony", l: "Barr", p: "OLB", c: "UCLA", o: 84, r: 1 },
    { f: "Eric", l: "Ebron", p: "TE", c: "North Carolina", o: 80, r: 1 },
    { f: "Taylor", l: "Lewan", p: "LT", c: "Michigan", o: 86, r: 1 },
    { f: "Odell", l: "Beckham", p: "WR", c: "LSU", o: 88, r: 1 },
    { f: "Aaron", l: "Donald", p: "DT", c: "Pitt", o: 98, r: 1 },
    { f: "Kyle", l: "Fuller", p: "CB", c: "Virginia Tech", o: 84, r: 1 },
    { f: "Zack", l: "Martin", p: "RG", c: "Notre Dame", o: 92, r: 1 },
    { f: "C.J.", l: "Mosley", p: "MLB", c: "Alabama", o: 86, r: 1 },
    { f: "Derek", l: "Carr", p: "QB", c: "Fresno State", o: 88, r: 2 },
    { f: "Davante", l: "Adams", p: "WR", c: "Fresno State", o: 90, r: 2 },
  ],
  2015: [
    { f: "Jameis", l: "Winston", p: "QB", c: "Florida State", o: 82, r: 1 },
    { f: "Marcus", l: "Mariota", p: "QB", c: "Oregon", o: 82, r: 1 },
    { f: "Dante", l: "Fowler", p: "DE", c: "Florida", o: 78, r: 1 },
    { f: "Amari", l: "Cooper", p: "WR", c: "Alabama", o: 88, r: 1 },
    { f: "Brandon", l: "Scherff", p: "RG", c: "Iowa", o: 86, r: 1 },
    { f: "Leonard", l: "Williams", p: "DE", c: "USC", o: 84, r: 1 },
    { f: "Kevin", l: "White", p: "WR", c: "West Virginia", o: 72, r: 1 },
    { f: "Vic", l: "Beasley", p: "OLB", c: "Clemson", o: 80, r: 1 },
    { f: "Ereck", l: "Flowers", p: "LT", c: "Miami", o: 72, r: 1 },
    { f: "Todd", l: "Gurley", p: "RB", c: "Georgia", o: 86, r: 1 },
    { f: "Trae", l: "Waynes", p: "CB", c: "Michigan State", o: 78, r: 1 },
    { f: "Danny", l: "Shelton", p: "DT", c: "Washington", o: 76, r: 1 },
    { f: "Andrus", l: "Peat", p: "LT", c: "Stanford", o: 80, r: 1 },
    { f: "Melvin", l: "Gordon", p: "RB", c: "Wisconsin", o: 82, r: 1 },
    { f: "Marcus", l: "Peters", p: "CB", c: "Washington", o: 86, r: 1 },
    { f: "Landon", l: "Collins", p: "S", c: "Alabama", o: 84, r: 2 },
    { f: "Stephon", l: "Diggs", p: "WR", c: "Maryland", o: 88, r: 5 },
    { f: "Tyler", l: "Lockett", p: "WR", c: "Kansas State", o: 86, r: 3 },
    { f: "David", l: "Johnson", p: "RB", c: "Northern Iowa", o: 86, r: 3 },
  ],
  2016: [
    { f: "Jared", l: "Goff", p: "QB", c: "California", o: 84, r: 1 },
    { f: "Carson", l: "Wentz", p: "QB", c: "North Dakota State", o: 84, r: 1 },
    { f: "Joey", l: "Bosa", p: "DE", c: "Ohio State", o: 90, r: 1 },
    { f: "Ezekiel", l: "Elliott", p: "RB", c: "Ohio State", o: 88, r: 1 },
    { f: "Jalen", l: "Ramsey", p: "CB", c: "Florida State", o: 90, r: 1 },
    { f: "Ronnie", l: "Stanley", p: "LT", c: "Notre Dame", o: 88, r: 1 },
    { f: "DeForest", l: "Buckner", p: "DT", c: "Oregon", o: 88, r: 1 },
    { f: "Jack", l: "Conklin", p: "RT", c: "Michigan State", o: 84, r: 1 },
    { f: "Leonard", l: "Floyd", p: "OLB", c: "Georgia", o: 80, r: 1 },
    { f: "Eli", l: "Apple", p: "CB", c: "Ohio State", o: 76, r: 1 },
    { f: "Vernon", l: "Hargreaves", p: "CB", c: "Florida", o: 74, r: 1 },
    { f: "Sheldon", l: "Rankins", p: "DT", c: "Louisville", o: 80, r: 1 },
    { f: "Laremy", l: "Tunsil", p: "LT", c: "Ole Miss", o: 88, r: 1 },
    { f: "Corey", l: "Coleman", p: "WR", c: "Baylor", o: 74, r: 1 },
    { f: "Keanu", l: "Neal", p: "S", c: "Florida", o: 80, r: 1 },
    { f: "Ryan", l: "Kelly", p: "C", c: "Alabama", o: 86, r: 1 },
    { f: "Derrick", l: "Henry", p: "RB", c: "Alabama", o: 90, r: 2 },
    { f: "Dak", l: "Prescott", p: "QB", c: "Mississippi State", o: 88, r: 4 },
    { f: "Tyreek", l: "Hill", p: "WR", c: "West Alabama", o: 90, r: 5 },
  ],
  2017: [
    { f: "Myles", l: "Garrett", p: "DE", c: "Texas A&M", o: 92, r: 1 },
    { f: "Mitchell", l: "Trubisky", p: "QB", c: "North Carolina", o: 74, r: 1 },
    { f: "Solomon", l: "Thomas", p: "DE", c: "Stanford", o: 74, r: 1 },
    { f: "Leonard", l: "Fournette", p: "RB", c: "LSU", o: 82, r: 1 },
    { f: "Corey", l: "Davis", p: "WR", c: "Western Michigan", o: 80, r: 1 },
    { f: "Jamal", l: "Adams", p: "S", c: "LSU", o: 86, r: 1 },
    { f: "Mike", l: "Williams", p: "WR", c: "Clemson", o: 82, r: 1 },
    { f: "Christian", l: "McCaffrey", p: "RB", c: "Stanford", o: 90, r: 1 },
    { f: "John", l: "Ross", p: "WR", c: "Washington", o: 74, r: 1 },
    { f: "Patrick", l: "Mahomes", p: "QB", c: "Texas Tech", o: 96, r: 1 },
    { f: "Marshon", l: "Lattimore", p: "CB", c: "Ohio State", o: 86, r: 1 },
    { f: "Deshaun", l: "Watson", p: "QB", c: "Clemson", o: 84, r: 1 },
    { f: "Haason", l: "Reddick", p: "OLB", c: "Temple", o: 84, r: 1 },
    { f: "T.J.", l: "Watt", p: "OLB", c: "Wisconsin", o: 94, r: 1 },
    { f: "Chris", l: "Godwin", p: "WR", c: "Penn State", o: 88, r: 3 },
    { f: "George", l: "Kittle", p: "TE", c: "Iowa", o: 90, r: 5 },
  ],
  2018: [
    { f: "Baker", l: "Mayfield", p: "QB", c: "Oklahoma", o: 80, r: 1 },
    { f: "Saquon", l: "Barkley", p: "RB", c: "Penn State", o: 90, r: 1 },
    { f: "Sam", l: "Darnold", p: "QB", c: "USC", o: 78, r: 1 },
    { f: "Denzel", l: "Ward", p: "CB", c: "Ohio State", o: 86, r: 1 },
    { f: "Bradley", l: "Chubb", p: "OLB", c: "NC State", o: 84, r: 1 },
    { f: "Quenton", l: "Nelson", p: "LG", c: "Notre Dame", o: 92, r: 1 },
    { f: "Josh", l: "Allen", p: "QB", c: "Wyoming", o: 92, r: 1 },
    { f: "Roquan", l: "Smith", p: "MLB", c: "Georgia", o: 88, r: 1 },
    { f: "Lamar", l: "Jackson", p: "QB", c: "Louisville", o: 92, r: 1 },
    { f: "Vita", l: "Vea", p: "DT", c: "Washington", o: 86, r: 1 },
    { f: "Minkah", l: "Fitzpatrick", p: "S", c: "Alabama", o: 88, r: 1 },
    { f: "Derwin", l: "James", p: "S", c: "Florida State", o: 88, r: 1 },
    { f: "Nick", l: "Chubb", p: "RB", c: "Georgia", o: 88, r: 2 },
    { f: "Darius", l: "Leonard", p: "OLB", c: "South Carolina State", o: 88, r: 2 },
  ],
  2019: [
    { f: "Kyler", l: "Murray", p: "QB", c: "Oklahoma", o: 84, r: 1 },
    { f: "Nick", l: "Bosa", p: "DE", c: "Ohio State", o: 94, r: 1 },
    { f: "Quinnen", l: "Williams", p: "DT", c: "Alabama", o: 90, r: 1 },
    { f: "Clelin", l: "Ferrell", p: "DE", c: "Clemson", o: 74, r: 1 },
    { f: "Devin", l: "White", p: "MLB", c: "LSU", o: 86, r: 1 },
    { f: "Daniel", l: "Jones", p: "QB", c: "Duke", o: 80, r: 1 },
    { f: "Josh", l: "Jacobs", p: "RB", c: "Alabama", o: 86, r: 1 },
    { f: "T.J.", l: "Hockenson", p: "TE", c: "Iowa", o: 84, r: 1 },
    { f: "Ed", l: "Oliver", p: "DT", c: "Houston", o: 86, r: 1 },
    { f: "Devin", l: "Bush", p: "MLB", c: "Michigan", o: 80, r: 1 },
    { f: "Jonah", l: "Williams", p: "LT", c: "Alabama", o: 80, r: 1 },
    { f: "Marquise", l: "Brown", p: "WR", c: "Oklahoma", o: 82, r: 1 },
    { f: "D.K.", l: "Metcalf", p: "WR", c: "Ole Miss", o: 90, r: 2 },
    { f: "A.J.", l: "Brown", p: "WR", c: "Ole Miss", o: 90, r: 2 },
    { f: "Deebo", l: "Samuel", p: "WR", c: "South Carolina", o: 88, r: 2 },
    { f: "Diontae", l: "Johnson", p: "WR", c: "Toledo", o: 84, r: 3 },
  ],
  2020: [
    { f: "Joe", l: "Burrow", p: "QB", c: "LSU", o: 92, r: 1 },
    { f: "Chase", l: "Young", p: "DE", c: "Ohio State", o: 84, r: 1 },
    { f: "Jeff", l: "Okudah", p: "CB", c: "Ohio State", o: 76, r: 1 },
    { f: "Andrew", l: "Thomas", p: "LT", c: "Georgia", o: 88, r: 1 },
    { f: "Tua", l: "Tagovailoa", p: "QB", c: "Alabama", o: 84, r: 1 },
    { f: "Justin", l: "Herbert", p: "QB", c: "Oregon", o: 90, r: 1 },
    { f: "Derrick", l: "Brown", p: "DT", c: "Auburn", o: 86, r: 1 },
    { f: "Isaiah", l: "Simmons", p: "OLB", c: "Clemson", o: 80, r: 1 },
    { f: "C.J.", l: "Henderson", p: "CB", c: "Florida", o: 74, r: 1 },
    { f: "Jedrick", l: "Wills", p: "RT", c: "Alabama", o: 80, r: 1 },
    { f: "Mekhi", l: "Becton", p: "LT", c: "Louisville", o: 78, r: 1 },
    { f: "Henry", l: "Ruggs", p: "WR", c: "Alabama", o: 74, r: 1 },
    { f: "CeeDee", l: "Lamb", p: "WR", c: "Oklahoma", o: 90, r: 1 },
    { f: "Jalen", l: "Hurts", p: "QB", c: "Oklahoma", o: 88, r: 2 },
    { f: "Justin", l: "Jefferson", p: "WR", c: "LSU", o: 94, r: 1 },
    { f: "Patrick", l: "Queen", p: "MLB", c: "LSU", o: 82, r: 1 },
  ],
  2021: [
    { f: "Trevor", l: "Lawrence", p: "QB", c: "Clemson", o: 88, r: 1 },
    { f: "Zach", l: "Wilson", p: "QB", c: "BYU", o: 72, r: 1 },
    { f: "Trey", l: "Lance", p: "QB", c: "North Dakota State", o: 72, r: 1 },
    { f: "Kyle", l: "Pitts", p: "TE", c: "Florida", o: 86, r: 1 },
    { f: "Ja'Marr", l: "Chase", p: "WR", c: "LSU", o: 92, r: 1 },
    { f: "Jaylen", l: "Waddle", p: "WR", c: "Alabama", o: 86, r: 1 },
    { f: "Penei", l: "Sewell", p: "RT", c: "Oregon", o: 90, r: 1 },
    { f: "Jaycee", l: "Horn", p: "CB", c: "South Carolina", o: 82, r: 1 },
    { f: "Patrick", l: "Surtain", p: "CB", c: "Alabama", o: 90, r: 1 },
    { f: "DeVonta", l: "Smith", p: "WR", c: "Alabama", o: 86, r: 1 },
    { f: "Justin", l: "Fields", p: "QB", c: "Ohio State", o: 82, r: 1 },
    { f: "Micah", l: "Parsons", p: "OLB", c: "Penn State", o: 94, r: 1 },
    { f: "Mac", l: "Jones", p: "QB", c: "Alabama", o: 76, r: 1 },
    { f: "Rashawn", l: "Slater", p: "LT", c: "Northwestern", o: 88, r: 1 },
    { f: "Amon-Ra", l: "St. Brown", p: "WR", c: "USC", o: 88, r: 4 },
  ],
  2022: [
    { f: "Travon", l: "Walker", p: "DE", c: "Georgia", o: 80, r: 1 },
    { f: "Aidan", l: "Hutchinson", p: "DE", c: "Michigan", o: 88, r: 1 },
    { f: "Derek", l: "Stingley", p: "CB", c: "LSU", o: 86, r: 1 },
    { f: "Kayvon", l: "Thibodeaux", p: "DE", c: "Oregon", o: 84, r: 1 },
    { f: "Ikem", l: "Ekwonu", p: "LT", c: "NC State", o: 84, r: 1 },
    { f: "Evan", l: "Neal", p: "RT", c: "Alabama", o: 78, r: 1 },
    { f: "Drake", l: "London", p: "WR", c: "USC", o: 86, r: 1 },
    { f: "Charles", l: "Cross", p: "LT", c: "Mississippi State", o: 84, r: 1 },
    { f: "Garrett", l: "Wilson", p: "WR", c: "Ohio State", o: 88, r: 1 },
    { f: "Chris", l: "Olave", p: "WR", c: "Ohio State", o: 84, r: 1 },
    { f: "Kyle", l: "Hamilton", p: "S", c: "Notre Dame", o: 86, r: 1 },
    { f: "Jordan", l: "Davis", p: "DT", c: "Georgia", o: 82, r: 1 },
    { f: "George", l: "Karlaftis", p: "DE", c: "Purdue", o: 82, r: 1 },
    { f: "Sauce", l: "Gardner", p: "CB", c: "Cincinnati", o: 90, r: 1 },
  ],
  2023: [
    { f: "Bryce", l: "Young", p: "QB", c: "Alabama", o: 80, r: 1 },
    { f: "C.J.", l: "Stroud", p: "QB", c: "Ohio State", o: 88, r: 1 },
    { f: "Will", l: "Anderson", p: "DE", c: "Alabama", o: 88, r: 1 },
    { f: "Anthony", l: "Richardson", p: "QB", c: "Florida", o: 78, r: 1 },
    { f: "Devon", l: "Witherspoon", p: "CB", c: "Illinois", o: 86, r: 1 },
    { f: "Paris", l: "Johnson", p: "LT", c: "Ohio State", o: 82, r: 1 },
    { f: "Tyree", l: "Wilson", p: "DE", c: "Texas Tech", o: 76, r: 1 },
    { f: "Jalen", l: "Carter", p: "DT", c: "Georgia", o: 90, r: 1 },
    { f: "Jaxon", l: "Smith-Njigba", p: "WR", c: "Ohio State", o: 86, r: 1 },
    { f: "Zay", l: "Flowers", p: "WR", c: "Boston College", o: 84, r: 1 },
    { f: "Bijan", l: "Robinson", p: "RB", c: "Texas", o: 88, r: 1 },
    { f: "Jahmyr", l: "Gibbs", p: "RB", c: "Alabama", o: 86, r: 1 },
    { f: "Lukas", l: "Van Ness", p: "DE", c: "Iowa", o: 78, r: 1 },
    { f: "Broderick", l: "Jones", p: "LT", c: "Georgia", o: 80, r: 1 },
    { f: "Puka", l: "Nacua", p: "WR", c: "BYU", o: 86, r: 5 },
  ],
  2024: [
    { f: "Caleb", l: "Williams", p: "QB", c: "USC", o: 84, r: 1 },
    { f: "Jayden", l: "Daniels", p: "QB", c: "LSU", o: 88, r: 1 },
    { f: "Drake", l: "Maye", p: "QB", c: "North Carolina", o: 84, r: 1 },
    { f: "Marvin", l: "Harrison", p: "WR", c: "Ohio State", o: 86, r: 1 },
    { f: "Joe", l: "Alt", p: "LT", c: "Notre Dame", o: 88, r: 1 },
    { f: "Malik", l: "Nabers", p: "WR", c: "LSU", o: 88, r: 1 },
    { f: "Rome", l: "Odunze", p: "WR", c: "Washington", o: 84, r: 1 },
    { f: "Dallas", l: "Turner", p: "OLB", c: "Alabama", o: 82, r: 1 },
    { f: "Olu", l: "Fashanu", p: "LT", c: "Penn State", o: 82, r: 1 },
    { f: "J.J.", l: "McCarthy", p: "QB", c: "Michigan", o: 80, r: 1 },
    { f: "Brock", l: "Bowers", p: "TE", c: "Georgia", o: 90, r: 1 },
    { f: "Laiatu", l: "Latu", p: "DE", c: "UCLA", o: 82, r: 1 },
    { f: "JC", l: "Latham", p: "RT", c: "Alabama", o: 80, r: 1 },
    { f: "Bo", l: "Nix", p: "QB", c: "Oregon", o: 82, r: 1 },
  ],
  2025: [
    { f: "Cam", l: "Ward", p: "QB", c: "Miami", o: 84, r: 1, arch: "cannon", rt: { throwPow: 90, throwAcc: 84, throwAwr: 82, rel: 86, speed: 68, inj: 78 } },
    { f: "Travis", l: "Hunter", p: "CB", c: "Colorado", o: 88, r: 1, arch: "blanket", rt: { cov: 92, speed: 90, agi: 90, catch: 86, awareness: 86, inj: 80 } },
    { f: "Abdul", l: "Carter", p: "OLB", c: "Penn State", o: 88, r: 1, arch: "edge", rt: { prs: 92, speed: 88, accel: 90, tak: 84, inj: 80 } },
    { f: "Will", l: "Campbell", p: "LT", c: "LSU", o: 82, r: 1, arch: "pass-ol", rt: { passBlk: 88, runBlk: 82, str: 84, awareness: 82, inj: 84 } },
    { f: "Mason", l: "Graham", p: "DT", c: "Michigan", o: 86, r: 1, arch: "finisher", rt: { prs: 88, str: 90, tak: 86, inj: 84 } },
    { f: "Ashton", l: "Jeanty", p: "RB", c: "Boise State", o: 88, r: 1, arch: "home-run", rt: { speed: 92, elu: 90, btk: 90, truck: 86, accel: 92, catch: 78, inj: 80 } },
    { f: "Tyler", l: "Warren", p: "TE", c: "Penn State", o: 84, r: 1, arch: "move-te", rt: { catch: 88, rrt: 86, speed: 82, runBlk: 74, inj: 82 } },
    { f: "Tetairoa", l: "McMillan", p: "WR", c: "Arizona", o: 84, r: 1, arch: "contested", rt: { cit: 90, catch: 86, speed: 86, rrt: 84 } },
    { f: "Shedeur", l: "Sanders", p: "QB", c: "Colorado", o: 78, r: 1, arch: "deadeye", rt: { throwAcc: 88, throwAwr: 84, throwPow: 78, speed: 58, inj: 74 } },
    { f: "Jalen", l: "Milroe", p: "QB", c: "Alabama", o: 76, r: 1, arch: "dual", rt: { throwPow: 86, throwAcc: 72, speed: 88, agi: 84, inj: 76 } },
  ],
  2026: [
    { f: "Fernando", l: "Mendoza", p: "QB", c: "Indiana", o: 88, r: 1, arch: "deadeye", rt: { throwAcc: 92, throwAwr: 88, throwPow: 84, rel: 86, speed: 62, awareness: 86, inj: 80 } },
    { f: "David", l: "Bailey", p: "OLB", c: "Texas Tech", o: 86, r: 1, arch: "edge", rt: { prs: 92, speed: 88, accel: 88, tak: 84, inj: 78 } },
    { f: "Jeremiyah", l: "Love", p: "RB", c: "Notre Dame", o: 88, r: 1, arch: "home-run", rt: { speed: 94, accel: 92, elu: 88, btk: 86, catch: 80, inj: 80 } },
    { f: "Carnell", l: "Tate", p: "WR", c: "Ohio State", o: 86, r: 1, arch: "contested", rt: { cit: 90, catch: 88, speed: 88, rrt: 84, inj: 80 } },
    { f: "Arvell", l: "Reese", p: "MLB", c: "Ohio State", o: 86, r: 1, arch: "thumper", rt: { tak: 92, str: 88, awareness: 86, pur: 88, inj: 82 } },
    { f: "Mansoor", l: "Delane", p: "CB", c: "LSU", o: 84, r: 1, arch: "blanket", rt: { cov: 90, speed: 88, agi: 88, awareness: 84, inj: 82 } },
    { f: "Spencer", l: "Fano", p: "LT", c: "Utah", o: 86, r: 1, arch: "pass-ol", rt: { passBlk: 90, runBlk: 84, str: 88, awareness: 84, inj: 84 } },
    { f: "Caleb", l: "Downs", p: "S", c: "Ohio State", o: 88, r: 1, arch: "hawk", rt: { awareness: 92, cov: 88, tak: 84, speed: 88, catch: 82, inj: 86 } },
    { f: "Ty", l: "Simpson", p: "QB", c: "Alabama", o: 84, r: 1, arch: "cannon", rt: { throwPow: 92, throwAcc: 82, throwAwr: 80, speed: 68, inj: 78 } },
    { f: "Rueben", l: "Bain", p: "DE", c: "Miami", o: 86, r: 1, arch: "edge", rt: { prs: 92, speed: 86, str: 86, tak: 84, inj: 80 } },
    { f: "Peter", l: "Woods", p: "DT", c: "Clemson", o: 84, r: 1, arch: "finisher", rt: { prs: 88, str: 92, tak: 86, inj: 82 } },
    { f: "Kadyn", l: "Proctor", p: "LT", c: "Alabama", o: 84, r: 1, arch: "anchor", rt: { str: 92, passBlk: 84, runBlk: 88, inj: 82 } },
  ],
  2029: [
    // Projected class year based on Heintschel's current eligibility; not a declared NFL entry.
    { f: "Mason", l: "Heintschel", p: "QB", c: "Pittsburgh", o: 82 },
  ],
};

/** The catalogs as written, before the player audit (scripts/player-audit.mjs) corrects them. */
export function draftSeedsBase(year: number): DraftSeed[] {
  const rows: DraftSeed[] = [
    ...(DRAFT_CLASSES[year] ?? []),
    ...(DRAFT_EXTRA[year] ?? []),
    ...(DRAFT_MORE[year] ?? []),
    ...(DRAFT_FILL[year] ?? []),
    ...(DRAFT_DEEP[year] ?? []),
    ...(DRAFT_MODERN[year] ?? []),
    ...(DRAFT_MODERN_LATE[year] ?? []),
    ...(DRAFT_2000S[year] ?? []),
    ...(DRAFT_2010S[year] ?? []),
    ...(DRAFT_INGEST[year] ?? []),
    ...(UNDRAFTED[year] ?? []),
  ];
  const by = new Map<string, DraftSeed>();
  for (const raw of rows) {
    const name = cleanNameParts(raw.f, raw.l);
    const s = { ...raw, f: name.firstName, l: name.lastName };
    if (historicalYear(s.f, s.l, year) !== year) continue;
    // Full-name key: sources split "Too Tall Jones" or "Lee Roy Selmon" differently.
    const key = historicalNameKey(s.f, s.l, year);
    const prev = by.get(key);
    if (!prev) {
      by.set(key, { ...s, rt: s.rt ? { ...s.rt } : undefined });
      continue;
    }
    const laterCareer = s.src === "career";
    const keepCareer = prev.src === "career" && !laterCareer;
    by.set(key, {
      f: prev.f,
      l: prev.l,
      p: prev.p,
      c: prev.c || s.c,
      o: laterCareer ? s.o : prev.o,
      r: prev.r && prev.r > 0 ? prev.r : s.r,
      arch: prev.arch ?? s.arch,
      ht: prev.ht ?? s.ht,
      wt: prev.wt ?? s.wt,
      fy: prev.fy ?? s.fy,
      rt: { ...(s.rt ?? {}), ...(prev.rt ?? {}) },
      src: laterCareer || keepCareer ? "career" : prev.src ?? s.src,
    });
  }
  const out = [...by.values()];
  for (const s of out) {
    const star = STAR_PROFILES[`${s.f}|${s.l}`.toLowerCase().replace(/[.'']/g, "")];
    if (!star) continue;
    s.arch = star.arch ?? s.arch;
    s.ht = star.ht ?? s.ht;
    s.wt = star.wt ?? s.wt;
    s.fy = star.fy ?? s.fy;
    s.rt = { ...(s.rt ?? {}), ...(star.rt ?? {}) };
  }
  out.sort((a, b) => {
    const ra = a.r && a.r > 0 ? a.r : 99;
    const rb = b.r && b.r > 0 ? b.r : 99;
    if (ra !== rb) return ra - rb;
    if (b.o !== a.o) return b.o - a.o;
    return a.l.localeCompare(b.l);
  });
  return out;
}


const auditKits = new Map<string, Pick<DraftSeed, "arch" | "rt">>();
/**
 * A locked kit for a player the audit added or moved to his real position: the game's own
 * rating model at his position and overall, his archetype from his name, so he plays like
 * every other catalog player at that grade.
 */
function auditKit(s: DraftSeed): Pick<DraftSeed, "arch" | "rt"> {
  const key = `${s.f}|${s.l}|${s.p}|${s.o}`;
  const hit = auditKits.get(key);
  if (hit) return hit;
  const arch = inferArch(s.p, s.f, s.l);
  const r = ratingsFromProfile(s.p, s.o, arch, undefined, nameVariance(s.f, s.l, 3));
  const rt: Partial<Ratings> = {};
  for (const k of [...primaryKeys(s.p), "speed", "awareness", "inj", "stamina"] as const) rt[k] = r[k];
  const kit = { arch, rt };
  auditKits.set(key, kit);
  return kit;
}

/** Short forms the catalogs use for a school, to the name the rest of the game uses. */
const SCHOOL_NAMES: Record<string, string> = { Pitt: "Pittsburgh" };

const SIDE: Partial<Record<Pos, string>> = {
  QB: "qb", RB: "rb", FB: "rb", WR: "rec", TE: "rec",
  LT: "ol", LG: "ol", C: "ol", RG: "ol", RT: "ol",
  DE: "dl", DT: "dl", OLB: "lb", MLB: "lb", CB: "db", S: "db", K: "k", P: "k",
};
const schoolKey = (c?: string) => (SCHOOL_NAMES[c ?? ""] ?? c ?? "").toLowerCase().replace(/^university of /, "").replace(/[^a-z]/g, "").slice(0, 4);

/**
 * One player listed twice under two spellings (Stephon and Stefon Diggs, Jim and Jimbo Covert):
 * same class, same last name, same school and round, same first initial, same side of the ball.
 * The spelling with a real career on record stays; brothers and namesakes at other positions
 * or in other rounds are left alone.
 */
function dedupeSpellings(year: number, out: DraftSeed[]): void {
  const groups = new Map<string, DraftSeed[]>();
  for (const s of out) {
    const k = `${normalizedName("", s.l).replace(/[^a-z]/g, "")}|${schoolKey(s.c)}|${s.r ?? -1}|${s.f.replace(/[^A-Za-z]/g, "")[0]?.toLowerCase()}|${SIDE[s.p] ?? s.p}`;
    const g = groups.get(k);
    if (g) g.push(s);
    else groups.set(k, [s]);
  }
  const drop = new Set<DraftSeed>();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const real = g.filter((s) => !!lookupArc(year, s.f, s.l));
    const keep = (real.length ? real : g).slice().sort((a, b) => Number(b.src === "career") - Number(a.src === "career") || b.o - a.o)[0]!;
    for (const s of g) if (s !== keep) drop.add(s);
  }
  if (!drop.size) return;
  const kept = out.filter((s) => !drop.has(s));
  out.length = 0;
  out.push(...kept);
}

/**
 * A draft class as the game uses it: the catalogs, corrected against the real record by the
 * player audit (position, college, round, height, weight), plus the real players the
 * catalogs never had (draft picks who played, and undrafted players who stuck).
 */
/**
 * One man, one draft class. The sources list some players in two or three classes: a pick who
 * didn't sign and went back in (Erickson, Bo Jackson), a supplemental pick (Cris Carter, Steve
 * Young), or a row filed under the wrong year. He stays in the class he signed out of.
 * Fathers and sons from the same school (the Matthewses, the Runyans) are two people and stay.
 */
const EXTRA_CLASS = new Set([
  "1966|Randy|Matson",
  "1967|John|Robinson",
  "1967|Clarence|Spencer",
  "1969|Willie|Davenport",
  "1970|Brownie|Wheless",
  "1970|Chris|Myers",
  "1971|Steve|Booras",
  "1973|Charlie|Hall",
  "1973|Charlie|Johnson",
  "1978|Reggie|Williams",
  "1980|Mike|Davis",
  "1980|Johnny|Robinson",
  "1984|Sean|Landeta",
  "1984|Ron|Holmes",
  "1984|Keith|Jackson",
  "1985|Gary|Clark",
  "1985|Matt|Darwin",
  "1986|Bo|Jackson",
  "1988|Cris|Carter",
  "1989|Cris|Carter",
  "1989|Mel|Bratton",
  "1991|Craig|Erickson",
  "1992|Keith|Jackson",
  "2002|David|Martin",
  "2003|John|Henderson",
  "2005|Josh|Brown",
]);

export function draftSeedsFor(year: number): DraftSeed[] {
  const out = draftSeedsBase(year);
  for (const s of out) {
    const f = AUDIT_FIX[`${year}|${normalizedName(s.f, s.l)}`];
    if (!f) continue;
    if (f.p && f.p !== s.p) {
      s.p = f.p;
      Object.assign(s, auditKit(s));
    }
    if (f.c) s.c = f.c;
    if (f.r !== undefined) s.r = f.r;
    if (f.ht) s.ht = f.ht;
    if (f.wt) s.wt = f.wt;
  }
  const have = new Set(out.map((s) => historicalNameKey(s.f, s.l, year)));
  let added = false;
  for (const raw of [...(AUDIT_DRAFTED[year] ?? []), ...(AUDIT_UNDRAFTED[year] ?? [])]) {
    const name = cleanNameParts(raw.f, raw.l);
    const base: DraftSeed = { ...raw, f: name.firstName, l: name.lastName, src: "career" };
    const s: DraftSeed = { ...base, ...auditKit(base) };
    const key = historicalNameKey(s.f, s.l, year);
    if (have.has(key)) continue;
    have.add(key);
    out.push(s);
    added = true;
  }
  for (const fr of FRIENDS[year] ?? []) out.push({ ...fr });
  dedupeSpellings(year, out);
  for (let i = out.length - 1; i >= 0; i--) if (EXTRA_CLASS.has(`${year}|${out[i].f}|${out[i].l}`)) out.splice(i, 1);
  for (const x of out) if (x.c && SCHOOL_NAMES[x.c]) x.c = SCHOOL_NAMES[x.c];
  if (added)
    out.sort((a, b) => {
      const ra = a.r && a.r > 0 ? a.r : 99;
      const rb = b.r && b.r > 0 ? b.r : 99;
      if (ra !== rb) return ra - rb;
      if (b.o !== a.o) return b.o - a.o;
      return a.l.localeCompare(b.l);
    });
  return out;
}
