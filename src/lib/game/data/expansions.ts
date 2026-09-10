import type { TeamId } from "../types.ts";

export interface ExpansionClub {
  id: TeamId;
  coachId: string;
  coachName: string;
  pool: "NFL" | "AFL" | "all";
}

export interface ExpansionSpec {
  id: string;
  year: number;
  kind: "allocation" | "expansion" | "relocate" | "return";
  title: string;
  clubs: ExpansionClub[];
  exposedPerClub: number;
  picksPerClub: number;
}

export const EXPANSION_SPECS: ExpansionSpec[] = [
  {
    id: "1967-nor",
    year: 1967,
    kind: "allocation",
    title: "1967 Saints allocation draft",
    clubs: [{ id: "nor", coachId: "fears", coachName: "Tom Fears", pool: "NFL" }],
    exposedPerClub: 8,
    picksPerClub: 32,
  },
  {
    id: "1968-cin",
    year: 1968,
    kind: "allocation",
    title: "1968 Bengals allocation draft",
    clubs: [{ id: "cin", coachId: "pbrown", coachName: "Paul Brown", pool: "AFL" }],
    exposedPerClub: 8,
    picksPerClub: 32,
  },
  {
    id: "1976-tam-sea",
    year: 1976,
    kind: "expansion",
    title: "1976 Buccaneers and Seahawks expansion draft",
    clubs: [
      { id: "tam", coachId: "mckay", coachName: "John McKay", pool: "all" },
      { id: "sea", coachId: "patera", coachName: "Jack Patera", pool: "all" },
    ],
    exposedPerClub: 6,
    picksPerClub: 36,
  },
  {
    id: "1995-car-jax",
    year: 1995,
    kind: "expansion",
    title: "1995 Panthers and Jaguars expansion draft",
    clubs: [
      { id: "car", coachId: "capers-car", coachName: "Dom Capers", pool: "all" },
      { id: "jax", coachId: "coughlin", coachName: "Tom Coughlin", pool: "all" },
    ],
    exposedPerClub: 6,
    picksPerClub: 36,
  },
  {
    id: "1996-rav",
    year: 1996,
    kind: "relocate",
    title: "1996 Browns deactivate; Ravens begin",
    clubs: [{ id: "rav", coachId: "marchibroda-rav", coachName: "Ted Marchibroda", pool: "all" }],
    exposedPerClub: 0,
    picksPerClub: 0,
  },
  {
    id: "1999-cle",
    year: 1999,
    kind: "return",
    title: "1999 Browns return expansion draft",
    clubs: [{ id: "cle", coachId: "palmer-cle", coachName: "Chris Palmer", pool: "all" }],
    exposedPerClub: 6,
    picksPerClub: 38,
  },
  {
    id: "2002-htx",
    year: 2002,
    kind: "expansion",
    title: "2002 Texans expansion draft",
    clubs: [{ id: "htx", coachId: "capers-htx", coachName: "Dom Capers", pool: "all" }],
    exposedPerClub: 5,
    picksPerClub: 40,
  },
];

export function expansionForYear(year: number): ExpansionSpec | undefined {
  return EXPANSION_SPECS.find((s) => s.year === year);
}
