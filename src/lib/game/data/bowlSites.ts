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
      flavor: "A January afternoon in the Coliseum, two leagues sharing a field for the first time. Packing crates of AFL bravado against NFL pedigree.",
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
    1971: { site: "Tulane Stadium", city: "New Orleans", flavor: "Winter in the Big Easy, wishbone still a college word." },
    1972: {
      site: "Los Angeles Memorial Coliseum",
      city: "Los Angeles",
      flavor: "Back to the Coliseum. Perfect-season ghosts already forming.",
    },
    1973: { site: "Rice Stadium", city: "Houston", flavor: "A college stadium in Houston, Astrodome lights across town." },
    1974: { site: "Tulane Stadium", city: "New Orleans", flavor: "Steel curtain arriving. The horseshoe creaks." },
    1975: { site: "Miami Orange Bowl", city: "Miami", flavor: "Tropical night, dynasties colliding." },
    1976: { site: "Rose Bowl", city: "Pasadena", flavor: "New Year's palace, January football instead of roses." },
    1977: { site: "Louisiana Superdome", city: "New Orleans", flavor: "The roof goes on. Indoor Super Bowl, indoor roar." },
    1978: { site: "Miami Orange Bowl", city: "Miami", flavor: "Last of the Orange Bowl classics." },
    1979: { site: "Rose Bowl", city: "Pasadena", flavor: "Pasadena in January, steel and grit on a bowl of grass." },
  };
  if (table[seasonYear]) return table[seasonYear]!;
  const cycle: BowlSite[] = [
    { site: "Rose Bowl", city: "Pasadena", flavor: "The granddaddy stadium, rented out for January." },
    { site: "Louisiana Superdome", city: "New Orleans", flavor: "Indoor thunder, beads still in the rafters." },
    { site: "Joe Robbie Stadium", city: "Miami", flavor: "South Florida winter, a roof of sky." },
    { site: "Jack Murphy Stadium", city: "San Diego", flavor: "Pacific air, late-afternoon shadows." },
    { site: "Tampa Stadium", city: "Tampa", flavor: "Gulf Coast, pirate flags, January humidity." },
    { site: "Metrodome", city: "Minneapolis", flavor: "Teflon sky, frozen breath at the doors." },
    { site: "Georgia Dome", city: "Atlanta", flavor: "Peachtree winter, indoor fireworks." },
    { site: "Reliant Stadium", city: "Houston", flavor: "Retractable roof, oil-town spectacle." },
    { site: "University of Phoenix Stadium", city: "Glendale", flavor: "Desert night, rolling field." },
    { site: "Lucas Oil Stadium", city: "Indianapolis", flavor: "Midwest indoor, marching-band loud." },
    { site: "MetLife Stadium", city: "East Rutherford", flavor: "Meadowlands cold, two-team town." },
    { site: "Allegiant Stadium", city: "Las Vegas", flavor: "A lantern in the desert, fireworks on command." },
  ];
  return cycle[(seasonYear - 1980) % cycle.length]!;
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
    return { site: "Sun Life Stadium", city: "Miami", flavor: "A mainland Pro Bowl, still in vacation weather." };
  }
  if (year >= 2011 && year <= 2014) {
    return { site: "Aloha Stadium", city: "Honolulu", flavor: "Back to Hawaii. The last leis of the Aloha era." };
  }
  if (year >= 2022) {
    return { site: "Allegiant Stadium", city: "Las Vegas", flavor: "Skills show and a flag-football coda under a lantern roof." };
  }
  return { site: "Camping World Stadium", city: "Orlando", flavor: "Florida winter, a showcase more than a war." };
}
