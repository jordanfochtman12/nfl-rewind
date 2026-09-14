import type { TeamId } from "./types.ts";
import { locationOf, nicknameOf } from "./teams.ts";

export type Climate = "north" | "midwest" | "south" | "pacific" | "mountain" | "florida";

export interface VenueInfo {
  climate: Climate;
  indoor: boolean;
  altitude: number;
  turf: boolean;
  capacity: number;
  stadium: string;
}

const CLIMATE: Record<TeamId, Climate> = {
  atl: "south",
  ram: "pacific",
  pit: "midwest",
  phi: "north",
  dal: "south",
  was: "south",
  min: "north",
  crd: "south",
  gnb: "north",
  nyg: "north",
  sfo: "pacific",
  chi: "midwest",
  cle: "midwest",
  clt: "midwest",
  det: "midwest",
  mia: "florida",
  den: "mountain",
  oti: "south",
  nwe: "north",
  buf: "north",
  nyj: "north",
  rai: "pacific",
  sdg: "pacific",
  kan: "midwest",
  nor: "south",
  cin: "midwest",
  tam: "florida",
  sea: "pacific",
  car: "south",
  jax: "florida",
  rav: "south",
  htx: "south",
};

function indoorAt(id: TeamId, year: number): boolean {
  switch (id) {
    case "oti":
      return year >= 1968 && year <= 1996;
    case "nor":
      return year >= 1975;
    case "det":
      return year >= 1975;
    case "sea":
      return year >= 1976 && year <= 1999;
    case "min":
      return year >= 1982 && year !== 2014 && year !== 2015;
    case "clt":
      return year >= 1984 && year <= 2007;
    case "atl":
      return year >= 1992;
    case "ram":
      return year >= 1995 && year <= 2015;
    case "htx":
      return year >= 2002;
    case "dal":
      return year >= 2009;
    case "crd":
      return year >= 2006;
    case "rai":
      return year >= 2020;
    default:
      return false;
  }
}

function turfAt(id: TeamId, year: number): boolean {
  if (indoorAt(id, year)) return true;
  if (year < 1970) return false;
  if (id === "phi" && year >= 1971 && year <= 2000) return true;
  if (id === "pit" && year >= 1970 && year <= 2002) return true;
  if (id === "cin" && year >= 1970 && year <= 1999) return true;
  if (id === "kan" && year >= 1970 && year <= 1993) return true;
  if (id === "buf" && year >= 1973 && year <= 2010) return true;
  if (id === "sea" && year >= 2000) return true;
  if (id === "det" && year >= 1975) return true;
  if (id === "nwe" && year >= 2006 && year <= 2019) return true;
  if (id === "nyj" && year >= 2003) return true;
  if (id === "nyg" && year >= 2003) return true;
  if (id === "dal" && year >= 2009) return true;
  if (id === "atl" && year >= 1992) return true;
  if (id === "min" && year >= 1982) return true;
  if (id === "clt" && year >= 1984) return true;
  if (id === "htx") return true;
  if (id === "rai" && year >= 2020) return true;
  if (id === "ram" && year >= 1995 && year <= 2015) return true;
  return false;
}

function stadiumName(year: number, id: TeamId): string {
  switch (id) {
    case "gnb":
      return "Lambeau Field";
    case "chi":
      if (year <= 1970) return "Wrigley Field";
      if (year === 2002) return "Memorial Stadium (Champaign)";
      return "Soldier Field";
    case "cle":
      return year <= 1995 ? "Cleveland Stadium" : "Cleveland Browns Stadium";
    case "pit":
      if (year <= 1969) return "Pitt Stadium";
      if (year <= 2000) return "Three Rivers Stadium";
      return "Heinz Field";
    case "phi":
      if (year <= 1970) return "Franklin Field";
      if (year <= 2002) return "Veterans Stadium";
      return "Lincoln Financial Field";
    case "nyg":
      if (year <= 1972) return "Yankee Stadium";
      if (year <= 1974) return "Yale Bowl";
      if (year === 1975) return "Shea Stadium";
      if (year <= 2009) return "Giants Stadium";
      return "MetLife Stadium";
    case "nyj":
      if (year <= 1983) return "Shea Stadium";
      if (year <= 2009) return "Giants Stadium";
      return "MetLife Stadium";
    case "was":
      return year <= 1996 ? "RFK Stadium" : "FedExField";
    case "dal":
      if (year <= 1970) return "Cotton Bowl";
      if (year <= 2008) return "Texas Stadium";
      return "AT&T Stadium";
    case "sfo":
      if (year <= 1970) return "Kezar Stadium";
      if (year <= 2013) return "Candlestick Park";
      return "Levi's Stadium";
    case "ram":
      if (year >= 1995 && year <= 2015) return "The Dome at America's Center";
      if (year >= 1980 && year <= 1994) return "Anaheim Stadium";
      if (year >= 2020) return "SoFi Stadium";
      return "Los Angeles Memorial Coliseum";
    case "det":
      if (year <= 1974) return "Tiger Stadium";
      if (year <= 2001) return "Pontiac Silverdome";
      return "Ford Field";
    case "min":
      if (year <= 1981) return "Metropolitan Stadium";
      if (year <= 2013) return "Hubert H. Humphrey Metrodome";
      if (year <= 2015) return "TCF Bank Stadium";
      return "U.S. Bank Stadium";
    case "clt":
      if (year <= 1983) return "Memorial Stadium";
      if (year <= 2007) return "RCA Dome";
      return "Lucas Oil Stadium";
    case "atl":
      if (year <= 1991) return "Atlanta-Fulton County Stadium";
      if (year <= 2016) return "Georgia Dome";
      return "Mercedes-Benz Stadium";
    case "nwe":
      if (year <= 1968) return "Fenway Park";
      if (year === 1969) return "Alumni Stadium";
      if (year === 1970) return "Harvard Stadium";
      if (year <= 2001) return "Foxboro Stadium";
      return "Gillette Stadium";
    case "buf":
      if (year <= 1972) return "War Memorial Stadium";
      if (year <= 1997) return "Rich Stadium";
      if (year <= 2015) return "Ralph Wilson Stadium";
      return "Highmark Stadium";
    case "mia":
      if (year <= 1986) return "Orange Bowl";
      if (year <= 2015) return "Joe Robbie Stadium";
      return "Hard Rock Stadium";
    case "oti":
      if (year <= 1967) return "Rice Stadium";
      if (year <= 1996) return "Astrodome";
      if (year <= 1998) return "Vanderbilt / Liberty Bowl";
      return "Nissan Stadium";
    case "den":
      if (year <= 2000) return "Mile High Stadium";
      if (year <= 2010) return "INVESCO Field at Mile High";
      return "Empower Field at Mile High";
    case "kan":
      return year <= 1971 ? "Municipal Stadium" : "Arrowhead Stadium";
    case "rai":
      if (year >= 2020) return "Allegiant Stadium";
      if (year >= 1982 && year <= 1994) return "Los Angeles Memorial Coliseum";
      return "Oakland Coliseum";
    case "sdg":
      if (year <= 1966) return "Balboa Stadium";
      if (year <= 2016) return "San Diego Stadium";
      if (year <= 2019) return "Dignity Health Sports Park";
      return "SoFi Stadium";
    case "nor":
      return year <= 1974 ? "Tulane Stadium" : "Louisiana Superdome";
    case "cin":
      if (year <= 1969) return "Nippert Stadium";
      if (year <= 1999) return "Riverfront Stadium";
      if (year <= 2021) return "Paul Brown Stadium";
      return "Paycor Stadium";
    case "tam":
      return year <= 1997 ? "Tampa Stadium" : "Raymond James Stadium";
    case "sea":
      if (year <= 1999) return "Kingdome";
      if (year <= 2001) return "Husky Stadium";
      return "Lumen Field";
    case "car":
      return year <= 1995 ? "Memorial Stadium (Clemson)" : "Bank of America Stadium";
    case "jax":
      return year <= 2009 ? "Jacksonville Municipal Stadium" : "EverBank Stadium";
    case "rav":
      return year <= 1997 ? "Memorial Stadium" : "M&T Bank Stadium";
    case "htx":
      return year <= 2013 ? "Reliant Stadium" : "NRG Stadium";
    case "crd":
      if (year <= 1987) return "Busch Stadium";
      if (year <= 2005) return "Sun Devil Stadium";
      return "State Farm Stadium";
    default:
      return `${locationOf(year, id)} ${nicknameOf(year, id)}`;
  }
}

function capacityOf(id: TeamId, year: number): number {
  if (year <= 1969) return 52_000;
  if (year <= 1979) return 60_000;
  if (year <= 1994) return 68_000;
  if (year <= 2009) return 72_000;
  if (id === "gnb") return 81_441;
  if (id === "dal" && year >= 2009) return 80_000;
  return 69_000;
}

export function venueOf(year: number, id: TeamId): VenueInfo {
  const climate = id === "crd" && year >= 1988 ? "south" : id === "ram" && year >= 1995 && year <= 2015 ? "midwest" : CLIMATE[id];
  const indoor = indoorAt(id, year);
  const altitude = id === "den" ? 5280 : 0;
  let climateAdj = climate;
  if (id === "rai" && year >= 1982 && year <= 1994) climateAdj = "pacific";
  if (id === "rai" && year >= 2020) climateAdj = "south";
  if (id === "clt" && year >= 1984) climateAdj = "midwest";
  if (id === "oti" && year >= 1997) climateAdj = "south";
  if (id === "sdg" && year >= 2017) climateAdj = "pacific";
  return {
    climate: climateAdj,
    indoor,
    altitude,
    turf: turfAt(id, year),
    capacity: capacityOf(id, year),
    stadium: stadiumName(year, id),
  };
}

export type Wx = "clear" | "rain" | "wind" | "cold" | "snow";

export function pickWeather(year: number, week: number, locClimate: Climate, indoor: boolean, rng: () => number): Wx {
  if (indoor) return "clear";
  const late = week >= 10;
  const r = rng();
  if (locClimate === "florida" || locClimate === "south") {
    if (r < 0.14) return "rain";
    if (r < 0.18) return "wind";
    return "clear";
  }
  if (locClimate === "pacific") {
    if (late && r < 0.16) return "rain";
    if (r < 0.08) return "wind";
    return "clear";
  }
  if (locClimate === "mountain") {
    if (late && r < 0.14) return "snow";
    if (late && r < 0.32) return "cold";
    if (r < 0.18) return "wind";
    return "clear";
  }
  if (late && r < 0.18) return "snow";
  if (late && r < 0.38) return "cold";
  if (r < 0.12) return "rain";
  if (r < 0.2) return "wind";
  return "clear";
}

export function attendanceFor(
  year: number,
  venue: VenueInfo,
  homeWins: number,
  rivalry: boolean,
  night: boolean,
  rng: () => number,
): number {
  const fill = 0.72 + Math.min(0.18, homeWins * 0.02) + (rivalry ? 0.08 : 0) + (night ? 0.03 : 0) + (rng() - 0.5) * 0.08;
  const eraFill = year <= 1969 ? 0.92 : 1;
  return Math.round(venue.capacity * Math.max(0.48, Math.min(1, fill * eraFill)));
}

/** Neutral-site Super Bowl / Pro Bowl. Climate from the stadium, not the “home” club. */
export function bowlVenue(site: string, year: number): VenueInfo {
  const s = site.toLowerCase();
  const indoor =
    /superdome|metrodome|silverdome|rca dome|georgia dome|nrg|ford field|lucas oil|at&t|sofi|allegiant|mercedes|u\.s\. bank|state farm|caesars|roof/.test(s);
  let climate: Climate = "south";
  if (/coliseum|rose bowl|sofi|levis|candlestick|oakland/.test(s)) climate = "pacific";
  else if (/orange bowl|hard rock|miami|joe robbie|sun life|pro player|camping world|orlando|tampa|raymond/.test(s)) climate = "florida";
  else if (/aloha|honolulu/.test(s)) climate = "pacific";
  else if (/pontiac|minneapolis|detroit|ford field/.test(s)) climate = "north";
  else if (/houston|rice|nrg|new orleans|tulane|superdome|atlanta|georgia|mercedes/.test(s)) climate = "south";
  else if (/denver|mile high/.test(s)) climate = "mountain";
  const altitude = /denver|mile high/.test(s) ? 5280 : 0;
  return {
    climate,
    indoor,
    altitude,
    turf: indoor || year >= 2009,
    capacity: /coliseum|rose bowl/.test(s) ? 90_000 : indoor ? 72_000 : 75_000,
    stadium: site,
  };
}

export function crowdNoise(id: TeamId, venue: VenueInfo, night: boolean, year: number): number {
  let n = 0;
  if (venue.indoor) n += 0.01;
  if (id === "sea" || id === "kan" || id === "den" || id === "nwe" || id === "phi" || id === "rai") n += 0.01;
  if (night) n += 0.005;
  if (year >= 2000) n += 0.003;
  return n;
}
