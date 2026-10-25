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

type Band = [lo: number, hi: number, weight: number];

/**
 * Jersey bands by position and era, most common first. Before 1973 numbers were convention,
 * not rule (flankers in the 20s-40s, ends and linebackers in the 60s-80s). The 1973 system
 * fixed them by position; the 90s opened to the front seven in 1984, receivers got 10-19 in
 * 2004, linebackers 40-49 in 2015, and 2021 (0 from 2023) let skill spots and DBs go to 1-49.
 */
export function jerseyBands(pos: string, year: number): Band[] {
  if (year < 1973) {
    const pre: Record<string, Band[]> = {
      QB: [[10, 19, 9], [1, 9, 1]],
      RB: [[20, 49, 10]],
      FB: [[30, 49, 8], [20, 29, 2]],
      WR: [[80, 89, 7], [20, 49, 2], [10, 19, 1]],
      TE: [[80, 89, 9], [30, 49, 1]],
      LT: [[70, 79, 8], [60, 69, 2]],
      LG: [[60, 69, 8], [50, 59, 1], [70, 79, 1]],
      C: [[50, 59, 9], [60, 69, 1]],
      RG: [[60, 69, 8], [50, 59, 1], [70, 79, 1]],
      RT: [[70, 79, 8], [60, 69, 2]],
      DE: [[80, 89, 5], [70, 79, 4], [60, 69, 1]],
      DT: [[70, 79, 6], [60, 69, 4]],
      OLB: [[50, 59, 5], [60, 69, 3], [30, 39, 2]],
      MLB: [[50, 59, 6], [60, 69, 4]],
      CB: [[20, 49, 10]],
      S: [[20, 49, 10]],
      K: [[1, 19, 7], [30, 49, 1]],
      P: [[1, 19, 7], [20, 49, 1]],
    };
    return pre[pos] ?? [[1, 99, 1]];
  }
  const nineties = year >= 1984;
  const zero = year >= 2023 ? 0 : 1;
  const open2021 = year >= 2021;
  const skill: Band[] = open2021 ? [[zero, 19, 3], [20, 49, 4]] : [];
  const bands: Record<string, Band[]> = {
    QB: [[10, 19, 8], [1, 9, 3]],
    K: [[1, 9, 6], [10, 19, 4]],
    P: [[1, 9, 6], [10, 19, 4]],
    RB: open2021 ? [[20, 39, 6], [zero, 9, 3], [40, 49, 1]] : [[20, 49, 10]],
    FB: open2021 ? [[30, 49, 7], [20, 29, 2], [80, 89, 1]] : [[30, 49, 8], [20, 29, 2]],
    WR: open2021 ? [[zero, 19, 7], [80, 89, 4], [20, 49, 1]] : year >= 2004 ? [[80, 89, 6], [10, 19, 4]] : [[80, 89, 10]],
    TE: open2021 ? [[80, 89, 7], [zero, 19, 1], [40, 49, 2]] : [[80, 89, 10]],
    LT: [[70, 79, 8], [60, 69, 2]],
    LG: [[60, 69, 8], [70, 79, 2]],
    C: [[50, 59, 6], [60, 69, 3], [70, 79, 1]],
    RG: [[60, 69, 8], [70, 79, 2]],
    RT: [[70, 79, 8], [60, 69, 2]],
    DE: nineties ? [[90, 99, 6], [70, 79, 3], [50, 59, open2021 ? 1 : 0]] : [[70, 79, 7], [60, 69, 3]],
    DT: nineties ? [[90, 99, 6], [70, 79, 3], [60, 69, 1]] : [[70, 79, 6], [60, 69, 4]],
    OLB: [
      [50, 59, 6],
      ...(nineties ? ([[90, 99, 3]] as Band[]) : []),
      ...(year >= 2015 ? ([[40, 49, 1]] as Band[]) : []),
      ...(open2021 ? ([[zero, 19, 2]] as Band[]) : []),
    ],
    MLB: [
      [50, 59, 8],
      ...(nineties ? ([[90, 99, 1]] as Band[]) : []),
      ...(year >= 2015 ? ([[40, 49, 1]] as Band[]) : []),
      ...(open2021 ? ([[zero, 19, 1]] as Band[]) : []),
    ],
    CB: open2021 ? [[20, 39, 6], ...skill.slice(0, 1)] : [[20, 49, 10]],
    S: open2021 ? [[20, 49, 7], [zero, 9, 2]] : [[20, 49, 10]],
  };
  return (bands[pos] ?? [[1, 99, 1]]).filter((b) => b[2] > 0);
}

/** Whether a number is legal for the position in that year (anything went before 1973). */
export function jerseyLegal(pos: string, year: number, n: number): boolean {
  if (year < 1973) return n >= 0 && n <= 99;
  return jerseyBands(pos, year).some(([lo, hi]) => n >= lo && n <= hi);
}

export function jerseyFor(save: Pick<DynastySave, "rng"> & { year?: number }, pos: string, used: Set<number>): number {
  const bands = jerseyBands(pos, save.year ?? 1966);
  const total = bands.reduce((a, b) => a + b[2], 0);
  for (let i = 0; i < 40; i++) {
    let r = randInt(save, 1, Math.max(1, total));
    let band = bands[0]!;
    for (const b of bands) {
      r -= b[2];
      if (r <= 0) {
        band = b;
        break;
      }
    }
    const n = randInt(save, band[0], band[1]);
    if (!used.has(n)) return n;
  }
  for (const [lo, hi] of bands) for (let n = lo; n <= hi; n++) if (!used.has(n)) return n;
  for (let n = 1; n <= 99; n++) if (!used.has(n)) return n;
  return randInt(save, 1, 99);
}

/** A college number for a made-up prospect, stable by id: the shapes college rosters really take. */
export function collegeNumber(pos: string, id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const r = (h >>> 0) / 4294967296;
  const span = (lo: number, hi: number) => lo + Math.floor(r * (hi - lo + 1));
  const two = (a: [number, number], b: [number, number], pa: number) => {
    const rr = ((h >>> 8) % 1000) / 1000;
    return rr < pa ? span(a[0], a[1]) : span(b[0], b[1]);
  };
  switch (pos) {
    case "QB":
      return two([1, 19], [1, 9], 0.7);
    case "RB":
    case "FB":
      return two([1, 9], [20, 49], 0.45);
    case "WR":
      return two([1, 19], [80, 89], 0.75);
    case "TE":
      return two([80, 89], [1, 49], 0.6);
    case "LT":
    case "LG":
    case "C":
    case "RG":
    case "RT":
      return span(50, 79);
    case "DE":
    case "DT":
      return two([90, 99], [1, 59], 0.6);
    case "OLB":
    case "MLB":
      return two([1, 59], [1, 19], 0.7);
    case "CB":
    case "S":
      return two([1, 9], [10, 49], 0.4);
    default:
      return two([1, 49], [90, 99], 0.8);
  }
}

/**
 * The number a player gets when he wants one: his own if it's legal and free, else the closest
 * he can have. Same last digit counts as close (a college 7 becomes 17, or 57 for a linebacker
 * before 2021), then the nearest number up or down.
 */
export function preferredJersey(save: Pick<DynastySave, "rng"> & { year?: number }, pos: string, want: number | undefined, used: Set<number>): number {
  if (want === undefined || want < 0 || want > 99) return jerseyFor(save, pos, used);
  const year = save.year ?? 1966;
  const ok = (n: number) => !used.has(n) && (n > 0 || year >= 2023) && jerseyLegal(pos, year, n);
  if (ok(want)) return want;
  let best = -1;
  let bestScore = Infinity;
  for (let n = 0; n <= 99; n++) {
    if (!ok(n)) continue;
    const score = n % 10 === want % 10 ? 1 + Math.abs(n - want) / 20 : 2 + Math.abs(n - want) / 10;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best >= 0 ? best : jerseyFor(save, pos, used);
}
