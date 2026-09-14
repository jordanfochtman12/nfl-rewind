import { ACTIVE_1966, TEAM_IDS, type TeamId } from "./types.ts";

export interface TeamMeta {
  id: TeamId;
  abbr: string;
  primary: string;
  secondary: string;
  born: number;
}

export const TEAM_META: Record<TeamId, TeamMeta> = {
  atl: { id: "atl", abbr: "ATL", primary: "#a71930", secondary: "#000000", born: 1966 },
  ram: { id: "ram", abbr: "RAM", primary: "#003594", secondary: "#ffd100", born: 1937 },
  pit: { id: "pit", abbr: "PIT", primary: "#101820", secondary: "#ffb612", born: 1933 },
  phi: { id: "phi", abbr: "PHI", primary: "#004c54", secondary: "#a5acaf", born: 1933 },
  dal: { id: "dal", abbr: "DAL", primary: "#041e42", secondary: "#869397", born: 1960 },
  was: { id: "was", abbr: "WAS", primary: "#5a1414", secondary: "#ffb612", born: 1932 },
  min: { id: "min", abbr: "MIN", primary: "#4f2683", secondary: "#ffc62f", born: 1961 },
  crd: { id: "crd", abbr: "CRD", primary: "#97233f", secondary: "#000000", born: 1920 },
  gnb: { id: "gnb", abbr: "GNB", primary: "#203731", secondary: "#ffb612", born: 1921 },
  nyg: { id: "nyg", abbr: "NYG", primary: "#0b2265", secondary: "#a71930", born: 1925 },
  sfo: { id: "sfo", abbr: "SFO", primary: "#aa0000", secondary: "#b3995d", born: 1946 },
  chi: { id: "chi", abbr: "CHI", primary: "#0b162a", secondary: "#c83803", born: 1920 },
  cle: { id: "cle", abbr: "CLE", primary: "#311d00", secondary: "#ff3c00", born: 1946 },
  clt: { id: "clt", abbr: "CLT", primary: "#002c5f", secondary: "#a2aaad", born: 1953 },
  det: { id: "det", abbr: "DET", primary: "#0076b6", secondary: "#b0b7bc", born: 1930 },
  mia: { id: "mia", abbr: "MIA", primary: "#008e97", secondary: "#fc4c02", born: 1966 },
  den: { id: "den", abbr: "DEN", primary: "#fb4f14", secondary: "#002244", born: 1960 },
  oti: { id: "oti", abbr: "OTI", primary: "#0c2340", secondary: "#c8102e", born: 1960 },
  nwe: { id: "nwe", abbr: "NWE", primary: "#002244", secondary: "#c60c30", born: 1960 },
  buf: { id: "buf", abbr: "BUF", primary: "#00338d", secondary: "#c60c30", born: 1960 },
  nyj: { id: "nyj", abbr: "NYJ", primary: "#125740", secondary: "#000000", born: 1960 },
  rai: { id: "rai", abbr: "RAI", primary: "#000000", secondary: "#a5acaf", born: 1960 },
  sdg: { id: "sdg", abbr: "SDG", primary: "#0080c6", secondary: "#ffc20e", born: 1960 },
  kan: { id: "kan", abbr: "KAN", primary: "#e31837", secondary: "#ffb81c", born: 1960 },
  nor: { id: "nor", abbr: "NOR", primary: "#d3bc8d", secondary: "#101820", born: 1967 },
  cin: { id: "cin", abbr: "CIN", primary: "#fb4f14", secondary: "#000000", born: 1968 },
  tam: { id: "tam", abbr: "TAM", primary: "#d50a0a", secondary: "#34302b", born: 1976 },
  sea: { id: "sea", abbr: "SEA", primary: "#002244", secondary: "#69be28", born: 1976 },
  car: { id: "car", abbr: "CAR", primary: "#0085ca", secondary: "#101820", born: 1995 },
  jax: { id: "jax", abbr: "JAX", primary: "#006778", secondary: "#d7a22a", born: 1995 },
  rav: { id: "rav", abbr: "RAV", primary: "#241773", secondary: "#000000", born: 1996 },
  htx: { id: "htx", abbr: "HTX", primary: "#03202f", secondary: "#a71930", born: 2002 },
};

export function isActive(id: TeamId, year: number): boolean {
  const meta = TEAM_META[id];
  if (year < meta.born) return false;
  if (id === "cle" && year >= 1996 && year <= 1998) return false;
  return true;
}

export function activeTeamIds(year: number): TeamId[] {
  return TEAM_IDS.filter((id) => isActive(id, year));
}

export function gamesInSeason(year: number): number {
  if (year <= 1977) return 14;
  if (year === 1982) return 9;
  if (year === 1987) return 15;
  if (year <= 2020) return 16;
  return 17;
}

export function confLabel(year: number, conference: string): string {
  if (year < 1970) {
    if (conference === "AFL" || conference === "NFL") return conference;
    if (conference === "AFC") return "AFL";
    if (conference === "NFC") return "NFL";
  }
  return conference;
}

export function locationOf(year: number, id: TeamId): string {
  switch (id) {
    case "nwe":
      return year <= 1970 ? "Boston" : "New England";
    case "rai":
      if (year <= 1981) return "Oakland";
      if (year <= 1994) return "Los Angeles";
      if (year <= 2019) return "Oakland";
      return "Las Vegas";
    case "ram":
      if (year <= 1994) return "Los Angeles";
      if (year <= 2015) return "St. Louis";
      return "Los Angeles";
    case "crd":
      if (year <= 1987) return "St. Louis";
      if (year <= 1993) return "Phoenix";
      return "Arizona";
    case "oti":
      return year <= 1996 ? "Houston" : "Tennessee";
    case "sdg":
      return year <= 2016 ? "San Diego" : "Los Angeles";
    case "clt":
      return year <= 1983 ? "Baltimore" : "Indianapolis";
    case "was":
      return "Washington";
    case "atl":
      return "Atlanta";
    case "pit":
      return "Pittsburgh";
    case "phi":
      return "Philadelphia";
    case "dal":
      return "Dallas";
    case "min":
      return "Minnesota";
    case "gnb":
      return "Green Bay";
    case "nyg":
      return "New York";
    case "sfo":
      return "San Francisco";
    case "chi":
      return "Chicago";
    case "cle":
      return "Cleveland";
    case "det":
      return "Detroit";
    case "mia":
      return "Miami";
    case "den":
      return "Denver";
    case "buf":
      return "Buffalo";
    case "nyj":
      return "New York";
    case "kan":
      return "Kansas City";
    case "nor":
      return "New Orleans";
    case "cin":
      return "Cincinnati";
    case "tam":
      return "Tampa Bay";
    case "sea":
      return "Seattle";
    case "car":
      return "Carolina";
    case "jax":
      return "Jacksonville";
    case "rav":
      return "Baltimore";
    case "htx":
      return "Houston";
    default:
      return id;
  }
}

export function nicknameOf(year: number, id: TeamId): string {
  switch (id) {
    case "atl":
      return "Falcons";
    case "ram":
      return "Rams";
    case "pit":
      return "Steelers";
    case "phi":
      return "Eagles";
    case "dal":
      return "Cowboys";
    case "was":
      if (year <= 2019) return "Redskins";
      if (year <= 2021) return "Football Team";
      return "Commanders";
    case "min":
      return "Vikings";
    case "crd":
      return "Cardinals";
    case "gnb":
      return "Packers";
    case "nyg":
      return "Giants";
    case "sfo":
      return "49ers";
    case "chi":
      return "Bears";
    case "cle":
      return "Browns";
    case "clt":
      return "Colts";
    case "det":
      return "Lions";
    case "mia":
      return "Dolphins";
    case "den":
      return "Broncos";
    case "oti":
      return year <= 1998 ? "Oilers" : "Titans";
    case "nwe":
      return "Patriots";
    case "buf":
      return "Bills";
    case "nyj":
      return "Jets";
    case "rai":
      return "Raiders";
    case "sdg":
      return "Chargers";
    case "kan":
      return "Chiefs";
    case "nor":
      return "Saints";
    case "cin":
      return "Bengals";
    case "tam":
      return "Buccaneers";
    case "sea":
      return "Seahawks";
    case "car":
      return "Panthers";
    case "jax":
      return "Jaguars";
    case "rav":
      return "Ravens";
    case "htx":
      return "Texans";
  }
}

export function displayName(year: number, id: TeamId): string {
  return `${locationOf(year, id)} ${nicknameOf(year, id)}`;
}

export type Conference = "NFL" | "AFL" | "AFC" | "NFC";

export function conferenceOf(year: number, id: TeamId): Conference {
  if (year < 1970) {
    const afl: TeamId[] = ["mia", "den", "oti", "nwe", "buf", "nyj", "rai", "sdg", "kan", "cin"];
    return afl.includes(id) ? "AFL" : "NFL";
  }
  const afc: TeamId[] = [
    "buf",
    "mia",
    "nwe",
    "nyj",
    "cin",
    "cle",
    "oti",
    "pit",
    "den",
    "kan",
    "rai",
    "sdg",
    "clt",
    "jax",
    "rav",
    "htx",
  ];
  // 1976 Bucs one year in AFC
  if (id === "tam") return year === 1976 ? "AFC" : "NFC";
  if (id === "sea") {
    if (year === 1976) return "NFC";
    if (year >= 2002) return "NFC";
    return "AFC";
  }
  return afc.includes(id) ? "AFC" : "NFC";
}

export function divisionOf(year: number, id: TeamId): string {
  if (year < 1967) {
    const nflEast: TeamId[] = ["atl", "cle", "crd", "dal", "nyg", "phi", "pit", "was"];
    const nflWest: TeamId[] = ["chi", "clt", "det", "gnb", "min", "ram", "sfo"];
    const aflEast: TeamId[] = ["buf", "mia", "nwe", "nyj", "oti"];
    if (nflEast.includes(id)) return "East";
    if (nflWest.includes(id)) return "West";
    if (aflEast.includes(id)) return "East";
    return "West";
  }
  if (year < 1970) {
    const capitol: TeamId[] = ["dal", "nyg", "phi", "was"];
    const century: TeamId[] = ["cle", "crd", "nor", "pit"];
    const coastal: TeamId[] = ["atl", "clt", "ram", "sfo"];
    const central: TeamId[] = ["chi", "det", "gnb", "min"];
    const aflEast: TeamId[] = ["buf", "mia", "nwe", "nyj", "oti"];
    if (capitol.includes(id)) return "Capitol";
    if (century.includes(id)) return "Century";
    if (coastal.includes(id)) return "Coastal";
    if (central.includes(id)) return "Central";
    if (aflEast.includes(id)) return "East";
    return "West";
  }
  if (year >= 2002) {
    const map: Record<string, TeamId[]> = {
      "AFC East": ["buf", "mia", "nwe", "nyj"],
      "AFC North": ["rav", "cin", "cle", "pit"],
      "AFC South": ["htx", "clt", "jax", "oti"],
      "AFC West": ["den", "kan", "rai", "sdg"],
      "NFC East": ["dal", "nyg", "phi", "was"],
      "NFC North": ["chi", "det", "gnb", "min"],
      "NFC South": ["atl", "car", "nor", "tam"],
      "NFC West": ["crd", "ram", "sfo", "sea"],
    };
    for (const [div, ids] of Object.entries(map)) {
      if (ids.includes(id)) return div.split(" ")[1]!;
    }
    return "East";
  }
  // 1970–2001
  if (id === "tam") {
    if (year === 1976) return "West";
    return "Central";
  }
  if (id === "sea") {
    if (year === 1976) return "West";
    return "West";
  }
  if (id === "car") return "West";
  if (id === "jax") return "Central";
  if (id === "rav") return "Central";

  const afcEast: TeamId[] = ["buf", "clt", "mia", "nwe", "nyj"];
  const afcCentral: TeamId[] = ["cin", "cle", "oti", "pit"];
  const afcWest: TeamId[] = ["den", "kan", "rai", "sdg"];
  const nfcEast: TeamId[] = ["crd", "dal", "nyg", "phi", "was"];
  const nfcCentral: TeamId[] = ["chi", "det", "gnb", "min"];
  const nfcWest: TeamId[] = ["atl", "nor", "ram", "sfo"];
  if (afcEast.includes(id) || nfcEast.includes(id)) return "East";
  if (afcCentral.includes(id) || nfcCentral.includes(id)) return "Central";
  if (afcWest.includes(id) || nfcWest.includes(id)) return "West";
  return "East";
}

export function divisionKey(year: number, id: TeamId): string {
  const conf = conferenceOf(year, id);
  const div = divisionOf(year, id);
  return `${conf} ${div}`;
}

export function originalLeague(id: TeamId): "NFL" | "AFL" | "later" {
  if ((ACTIVE_1966 as readonly string[]).includes(id)) {
    const afl: TeamId[] = ["mia", "den", "oti", "nwe", "buf", "nyj", "rai", "sdg", "kan"];
    return afl.includes(id) ? "AFL" : "NFL";
  }
  if (id === "nor") return "NFL";
  if (id === "cin") return "AFL";
  return "later";
}

export function teamAbbr(id: TeamId): string {
  return TEAM_META[id].abbr;
}

export function teamColors(id: TeamId, year?: number): { primary: string; secondary: string } {
  const m = TEAM_META[id];
  const y = year ?? 2027;
  if (id === "sdg") {
    const navy = (y >= 1988 && y <= 2006) || (y >= 2017 && y <= 2019);
    return navy
      ? { primary: "#002244", secondary: "#ffc20e" }
      : { primary: "#0080c6", secondary: "#ffc20e" };
  }
  if (id === "tam") {
    return y >= 1997
      ? { primary: "#34302b", secondary: "#d50a0a" }
      : { primary: "#d50a0a", secondary: "#ff7f00" };
  }
  if (id === "oti") {
    return y < 1999
      ? { primary: "#0072ce", secondary: "#c8102e" }
      : { primary: "#0c2340", secondary: "#4b92db" };
  }
  if (id === "nwe" && y < 1993) {
    return { primary: "#c60c30", secondary: "#ffffff" };
  }
  if (id === "sea" && y < 2002) {
    return { primary: "#002244", secondary: "#a5acaf" };
  }
  if (id === "cin" && y >= 2004) {
    return { primary: "#fb4f14", secondary: "#000000" };
  }
  if (id === "ram" && y >= 2000 && y <= 2019) {
    return { primary: "#002244", secondary: "#c4aa76" };
  }
  return { primary: m.primary, secondary: m.secondary };
}

/** Relative luminance 0–1 for a #rrggbb (or #rgb) hex. */
export function hexLum(hex: string): number {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return 0;
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = chan((n >> 16) & 255);
  const g = chan((n >> 8) & 255);
  const b = chan(n & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ink that sits on a club fill — cream on dark, field ink on gold/white. */
export function onClubColor(hex: string): string {
  return hexLum(hex) > 0.45 ? "#090a08" : "#f0e8d6";
}

export interface ClubInk {
  primary: string;
  secondary: string;
  onPrimary: string;
  onSecondary: string;
}

export function clubInk(id: TeamId, year?: number): ClubInk {
  const c = teamColors(id, year);
  return {
    ...c,
    onPrimary: onClubColor(c.primary),
    onSecondary: onClubColor(c.secondary),
  };
}

export function superBowlNumber(seasonYear: number): number {
  return seasonYear - 1965;
}

export function roman(n: number): string {
  if (n <= 0) return String(n);
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let x = n;
  let out = "";
  for (const [v, s] of map) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return out;
}

export { logoSrc } from "./data/logos.ts";
