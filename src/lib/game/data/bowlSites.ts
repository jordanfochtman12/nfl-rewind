export interface BowlSite {
  site: string;
  city: string;
  flavor: string;
}

/** Super Bowl sites by season year (1966 = I). */
export function superBowlSite(seasonYear: number): BowlSite {
  const table: Record<number, BowlSite> = {
    1966: {
      site: "Los Angeles Memorial Coliseum",
      city: "Los Angeles",
      flavor:
        "A January afternoon in the Coliseum, two leagues sharing a field for the first time. Packing crates of AFL bravado against NFL pedigree.",
    },
    1967: {
      site: "Miami Orange Bowl",
      city: "Miami",
      flavor: "Night game, Orange Bowl humidity, and a still-skeptical sporting press.",
    },
    1968: {
      site: "Miami Orange Bowl",
      city: "Miami",
      flavor: "Broadway Joe's stage. The Orange Bowl holds its breath for the guarantee.",
    },
    1969: {
      site: "Tulane Stadium",
      city: "New Orleans",
      flavor: "A college horseshoe in New Orleans, brass bands, and the last AFL-NFL argument.",
    },
    1970: {
      site: "Miami Orange Bowl",
      city: "Miami",
      flavor: "First Super Bowl of the merged league. Double-knit, still mud-caked.",
    },
    1971: {
      site: "Tulane Stadium",
      city: "New Orleans",
      flavor: "Winter in the Big Easy, wishbone still a college word.",
    },
    1972: {
      site: "Los Angeles Memorial Coliseum",
      city: "Los Angeles",
      flavor: "Back to the Coliseum. Perfect-season ghosts already forming.",
    },
    1973: {
      site: "Rice Stadium",
      city: "Houston",
      flavor: "A college stadium in Houston, Astrodome lights across town.",
    },
    1974: {
      site: "Tulane Stadium",
      city: "New Orleans",
      flavor: "Steel curtain arriving. The horseshoe creaks.",
    },
    1975: {
      site: "Miami Orange Bowl",
      city: "Miami",
      flavor: "Tropical night, dynasties colliding.",
    },
    1976: {
      site: "Rose Bowl",
      city: "Pasadena",
      flavor: "New Year's palace, January football instead of roses.",
    },
    1977: {
      site: "Louisiana Superdome",
      city: "New Orleans",
      flavor: "The roof goes on. Indoor Super Bowl, indoor roar.",
    },
    1978: { site: "Miami Orange Bowl", city: "Miami", flavor: "Last of the Orange Bowl classics." },
    1979: {
      site: "Rose Bowl",
      city: "Pasadena",
      flavor: "Pasadena in January, steel and grit on a bowl of grass.",
    },
  };
  if (table[seasonYear]) return table[seasonYear]!;
  // Season-year host sites, not game calendar years. Historical venue names retained.
  // Sources: https://en.wikipedia.org/wiki/List_of_Super_Bowl_champions
  // https://www.nfl.com/news/los-angeles-to-host-super-bowl-lxi-in-2027
  // https://www.nfl.com/news/mercedes-benz-stadium-in-atlanta-to-host-super-bowl-lxii-in-2028
  const hosts: Record<number, [string, string]> = {
    1980: ["Louisiana Superdome", "New Orleans"],
    1981: ["Pontiac Silverdome", "Pontiac"],
    1982: ["Rose Bowl", "Pasadena"],
    1983: ["Tampa Stadium", "Tampa"],
    1984: ["Stanford Stadium", "Stanford"],
    1985: ["Louisiana Superdome", "New Orleans"],
    1986: ["Rose Bowl", "Pasadena"],
    1987: ["Jack Murphy Stadium", "San Diego"],
    1988: ["Joe Robbie Stadium", "Miami"],
    1989: ["Louisiana Superdome", "New Orleans"],
    1990: ["Tampa Stadium", "Tampa"],
    1991: ["Metrodome", "Minneapolis"],
    1992: ["Rose Bowl", "Pasadena"],
    1993: ["Georgia Dome", "Atlanta"],
    1994: ["Joe Robbie Stadium", "Miami"],
    1995: ["Sun Devil Stadium", "Tempe"],
    1996: ["Louisiana Superdome", "New Orleans"],
    1997: ["Qualcomm Stadium", "San Diego"],
    1998: ["Pro Player Stadium", "Miami"],
    1999: ["Georgia Dome", "Atlanta"],
    2000: ["Raymond James Stadium", "Tampa"],
    2001: ["Louisiana Superdome", "New Orleans"],
    2002: ["Qualcomm Stadium", "San Diego"],
    2003: ["Reliant Stadium", "Houston"],
    2004: ["Alltel Stadium", "Jacksonville"],
    2005: ["Ford Field", "Detroit"],
    2006: ["Dolphin Stadium", "Miami Gardens"],
    2007: ["University of Phoenix Stadium", "Glendale"],
    2008: ["Raymond James Stadium", "Tampa"],
    2009: ["Sun Life Stadium", "Miami Gardens"],
    2010: ["Cowboys Stadium", "Arlington"],
    2011: ["Lucas Oil Stadium", "Indianapolis"],
    2012: ["Mercedes-Benz Superdome", "New Orleans"],
    2013: ["MetLife Stadium", "East Rutherford"],
    2014: ["University of Phoenix Stadium", "Glendale"],
    2015: ["Levi's Stadium", "Santa Clara"],
    2016: ["NRG Stadium", "Houston"],
    2017: ["U.S. Bank Stadium", "Minneapolis"],
    2018: ["Mercedes-Benz Stadium", "Atlanta"],
    2019: ["Hard Rock Stadium", "Miami Gardens"],
    2020: ["Raymond James Stadium", "Tampa"],
    2021: ["SoFi Stadium", "Inglewood"],
    2022: ["State Farm Stadium", "Glendale"],
    2023: ["Allegiant Stadium", "Las Vegas"],
    2024: ["Caesars Superdome", "New Orleans"],
    2025: ["Levi's Stadium", "Santa Clara"],
    2026: ["SoFi Stadium", "Inglewood"],
    2027: ["Mercedes-Benz Stadium", "Atlanta"],
  };
  const host = hosts[seasonYear];
  if (!host)
    return {
      site: "Host to be announced",
      city: "TBD",
      flavor: "The championship host has not been assigned.",
    };
  return {
    site: host[0],
    city: host[1],
    flavor: `Championship week in ${host[1]}. ${host[0]} is the stage; these finalists write their own ending.`,
  };
}

export function proBowlSite(year: number): BowlSite {
  if (year < 1970) {
    return {
      site: "Los Angeles Memorial Coliseum",
      city: "Los Angeles",
      flavor: "The old all-star game in the Coliseum, NFL vs AFL still a living argument.",
    };
  }
  if (year >= 1980 && year <= 2009) {
    return {
      site: "Aloha Stadium",
      city: "Honolulu",
      flavor: "Trade winds, leis on the sideline, a game that always feels like Tuesday.",
    };
  }
  if (year === 2010) {
    return {
      site: "Sun Life Stadium",
      city: "Miami",
      flavor: "A mainland Pro Bowl, still in vacation weather.",
    };
  }
  if (year >= 2011 && year <= 2014) {
    return {
      site: "Aloha Stadium",
      city: "Honolulu",
      flavor: "Back to Hawaii. The last leis of the Aloha era.",
    };
  }
  if (year >= 2022) {
    return {
      site: "Allegiant Stadium",
      city: "Las Vegas",
      flavor: "Skills show and a flag-football coda under a lantern roof.",
    };
  }
  return {
    site: "Camping World Stadium",
    city: "Orlando",
    flavor: "Florida winter, a showcase more than a war.",
  };
}
