/** Franchise moves and identity changes. Not expansions (Saints, Ravens, etc.). */
import type { TeamId } from "../types.ts";

export interface RelocationSpec {
  year: number;
  teamId: TeamId;
  from: string;
  to: string;
  title: string;
  body: string;
}

export const RELOCATION_SPECS: RelocationSpec[] = [
  {
    year: 1971,
    teamId: "nwe",
    from: "Boston Patriots",
    to: "New England Patriots",
    title: "The Patriots leave Boston",
    body: "A new stadium in Foxborough. Same club, new map. The Boston name stays in the record book.",
  },
  {
    year: 1982,
    teamId: "rai",
    from: "Oakland Raiders",
    to: "Los Angeles Raiders",
    title: "The Raiders take Los Angeles",
    body: "Al Davis wins in court and the silver and black load the trucks south. The Coliseum gets a second tenant.",
  },
  {
    year: 1984,
    teamId: "clt",
    from: "Baltimore Colts",
    to: "Indianapolis Colts",
    title: "Mayflower vans in the night",
    body: "The horseshoe leaves Maryland under snow and streetlights. Indianapolis wakes up with an NFL club. Baltimore waits.",
  },
  {
    year: 1988,
    teamId: "crd",
    from: "St. Louis Cardinals",
    to: "Phoenix Cardinals",
    title: "The Cardinals go west",
    body: "Bidwill packs the oldest name in the league and sets it down in the desert. St. Louis is empty again.",
  },
  {
    year: 1994,
    teamId: "crd",
    from: "Phoenix Cardinals",
    to: "Arizona Cardinals",
    title: "Arizona, not Phoenix",
    body: "Same desert, statewide name. The bird stays. The letterhead changes.",
  },
  {
    year: 1995,
    teamId: "ram",
    from: "Los Angeles Rams",
    to: "St. Louis Rams",
    title: "The Rams leave Los Angeles",
    body: "Thirty years in L.A. end with a moving day to the Mississippi. Georgia Frontiere takes the horns to St. Louis.",
  },
  {
    year: 1995,
    teamId: "rai",
    from: "Los Angeles Raiders",
    to: "Oakland Raiders",
    title: "The Raiders come home",
    body: "Davis turns the trucks around. Oakland gets the silver and black back. Los Angeles loses both clubs in one winter.",
  },
  {
    year: 1997,
    teamId: "oti",
    from: "Houston Oilers",
    to: "Tennessee Oilers",
    title: "The Oilers leave Houston",
    body: "Adams takes the derrick to Tennessee. Houston is dark. The name is still Oilers, for now, in a borrowed stadium.",
  },
  {
    year: 1999,
    teamId: "oti",
    from: "Tennessee Oilers",
    to: "Tennessee Titans",
    title: "Oilers no more",
    body: "New building, new name. Titans. The derrick is a museum piece. Nashville is an NFL town.",
  },
  {
    year: 2016,
    teamId: "ram",
    from: "St. Louis Rams",
    to: "Los Angeles Rams",
    title: "The Rams return to Los Angeles",
    body: "Kroenke takes the horns back to the coast. St. Louis is emptied a second time. Inglewood is already on the drawings.",
  },
  {
    year: 2017,
    teamId: "sdg",
    from: "San Diego Chargers",
    to: "Los Angeles Chargers",
    title: "The Chargers leave San Diego",
    body: "Fifty-six years in San Diego end with a stub of a stadium in Carson. Lightning on the same map as the horns.",
  },
  {
    year: 2020,
    teamId: "rai",
    from: "Oakland Raiders",
    to: "Las Vegas Raiders",
    title: "The Raiders in the desert",
    body: "Oakland’s last Sunday is already in the book. A lantern stadium in the valley. The pirate flag over the Strip.",
  },
  {
    year: 2020,
    teamId: "was",
    from: "Washington Redskins",
    to: "Washington Football Team",
    title: "Washington drops the name",
    body: "The old word is retired. For two winters the club is simply the Washington Football Team.",
  },
  {
    year: 2022,
    teamId: "was",
    from: "Washington Football Team",
    to: "Washington Commanders",
    title: "Commanders",
    body: "A new nickname after two holding-pattern seasons. Burgundy and gold stay. The letterhead does not.",
  },
];

export function relocationsForYear(year: number): RelocationSpec[] {
  return RELOCATION_SPECS.filter((s) => s.year === year);
}
