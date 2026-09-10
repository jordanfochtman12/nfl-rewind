import type { DynastySave } from "./types.ts";
import { pick, randInt } from "./rng.ts";

const FIRST = [
  "Jack", "Bob", "Jim", "Tom", "Bill", "Joe", "Dick", "Don", "Gene", "Ray",
  "Paul", "Frank", "Chuck", "Gary", "Larry", "Ron", "Jerry", "Dave", "Ken", "Mike",
  "Steve", "Pete", "Wayne", "Carl", "Al", "Ed", "Fred", "Harvey", "Cecil", "Otis",
  "Willie", "Charlie", "Sammy", "Art", "Len", "Floyd", "Calvin", "Mel", "Curtis", "Leroy",
  "Hank", "Buddy", "Sonny", "Walt", "Nate", "Clyde", "Ernie", "Roy", "Pat", "Ted",
  "Vince", "Glenn", "Norman", "Howard", "Ralph", "Earl", "Cliff", "Duane", "Rex", "Archie",
  "Greg", "Tim", "Craig", "Keith", "Randy", "Doug", "Bruce", "Jeff", "Scott", "Mark",
  "Tony", "Ricky", "Darryl", "Andre", "Tyrone", "Reggie", "Jerome", "Marcus", "Derrick", "Corey",
  "Jamal", "Deion", "Terrell", "LaDainian", "Peyton", "Eli", "Cam", "Russell", "Patrick", "Josh",
];

const LAST = [
  "Johnson", "Williams", "Smith", "Brown", "Jones", "Davis", "Miller", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Robinson", "Clark", "Lewis",
  "Walker", "Hall", "Allen", "Young", "King", "Wright", "Hill", "Scott", "Green", "Adams",
  "Baker", "Nelson", "Carter", "Mitchell", "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans",
  "Edwards", "Collins", "Stewart", "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy",
  "Bailey", "Cooper", "Richardson", "Cox", "Howard", "Ward", "Peterson", "Gray", "James", "Watson",
  "Brooks", "Kelly", "Sanders", "Price", "Bennett", "Wood", "Barnes", "Ross", "Henderson", "Coleman",
  "Jenkins", "Perry", "Powell", "Long", "Patterson", "Hughes", "Butler", "Simmons", "Foster", "Bryant",
  "Alexander", "Russell", "Griffin", "Hayes", "Myers", "Ford", "Hamilton", "Graham", "Sullivan", "Wallace",
  "Woods", "Cole", "West", "Jordan", "Owens", "Reynolds", "Fisher", "Ellis", "Harrison", "Gibson",
  "McDonald", "Marshall", "Murray", "Freeman", "Wells", "Webb", "Simpson", "Stevens", "Tucker", "Porter",
  "Hunter", "Hicks", "Crawford", "Henry", "Boyd", "Mason", "Kennedy", "Warren", "Dixon", "Burns",
  "Gordon", "Shaw", "Holmes", "Rice", "Robertson", "Hunt", "Black", "Daniels", "Palmer", "Mills",
  "Nichols", "Grant", "Knight", "Ferguson", "Rose", "Stone", "Hawkins", "Dunn", "Perkins", "Hudson",
  "Spencer", "Gardner", "Stephens", "Payne", "Pierce", "Berry", "Matthews", "Arnold", "Wagner", "Willis",
  "Ray", "Watkins", "Olson", "Carroll", "Duncan", "Snyder", "Hart", "Cunningham", "Bradley", "Lane",
  "Andrews", "Harper", "Fox", "Riley", "Armstrong", "Carpenter", "Weaver", "Greene", "Lawrence", "Elliott",
  "Sims", "Austin", "Peters", "Kelley", "Franklin", "Lawson", "Horton", "Starr", "Nitschke", "Kramer",
];

const COLLEGES = [
  "Ohio State", "Michigan", "Notre Dame", "Alabama", "USC", "Texas", "Oklahoma", "Nebraska",
  "Penn State", "UCLA", "Tennessee", "Georgia", "Florida", "LSU", "Auburn", "Miami",
  "Michigan State", "Iowa", "Wisconsin", "Minnesota", "Purdue", "Illinois", "Stanford", "Cal",
  "Washington", "Oregon", "Colorado", "Arkansas", "Ole Miss", "Mississippi State", "Kentucky",
  "Clemson", "North Carolina", "Duke", "Maryland", "Syracuse", "Pitt", "West Virginia",
  "Texas A&M", "Baylor", "SMU", "TCU", "Houston", "Tulsa", "Grambling", "Jackson State",
  "Southern", "Florida A&M", "Prairie View", "Utah State", "BYU", "Arizona State", "Arizona",
  "Boston College", "Holy Cross", "Villanova", "Navy", "Army", "Air Force",
];

export function eraName(save: Pick<DynastySave, "rng" | "year">): { first: string; last: string } {
  const year = "year" in save ? save.year : 1966;
  const firstPool = year < 1980 ? FIRST.slice(0, 56) : year < 2000 ? FIRST.slice(20, 80) : FIRST.slice(40);
  return { first: pick(save, firstPool), last: pick(save, LAST) };
}

export function eraCollege(save: Pick<DynastySave, "rng">): string {
  return pick(save, COLLEGES);
}

export function jerseyFor(save: Pick<DynastySave, "rng">, pos: string, used: Set<number>): number {
  const ranges: Record<string, [number, number]> = {
    QB: [12, 19],
    RB: [20, 39],
    FB: [30, 39],
    WR: [80, 89],
    TE: [80, 89],
    LT: [70, 79],
    LG: [60, 69],
    C: [50, 59],
    RG: [60, 69],
    RT: [70, 79],
    DE: [70, 89],
    DT: [60, 79],
    OLB: [50, 59],
    MLB: [50, 59],
    CB: [20, 49],
    S: [20, 49],
    K: [1, 9],
    P: [1, 9],
  };
  const [lo, hi] = ranges[pos] ?? [1, 99];
  for (let i = 0; i < 30; i++) {
    const n = randInt(save, lo, hi);
    if (!used.has(n)) return n;
  }
  for (let n = 1; n <= 99; n++) if (!used.has(n)) return n;
  return randInt(save, 1, 99);
}
