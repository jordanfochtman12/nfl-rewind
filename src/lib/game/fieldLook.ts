/**
 * What the field really looked like: the surface (grass, 1970s AstroTurf, modern FieldTurf),
 * where the hash marks and goal posts stood that year, the end-zone paint and lettering, the
 * midfield logo, a baseball infield on a shared ballpark, wear, snow and night. Pure data; the
 * broadcast draws it (components/game/BroadcastField.tsx). No React.
 */
import { venueOf } from "./venues.ts";
import { conferenceOf, locationOf, nicknameOf, teamColors } from "./teams.ts";
import { logoSrc } from "./data/logos.ts";
import type { GameResult, TeamId } from "./types.ts";

export type Surface = "grass" | "astroturf" | "fieldturf";

export interface EndZoneLook {
  /** "plain": green with lettering; "solid": painted in a club color; "stripes": diagonal stripes. */
  style: "plain" | "solid" | "stripes";
  fill: string;
  stripe?: string;
  text: string;
  textFill: string;
  textStroke: string;
}

export interface FieldLook {
  year: number;
  stadium: string;
  surface: Surface;
  indoor: boolean;
  /** Base and mowing-stripe greens. */
  green: string;
  stripe: string;
  /** Yards from each sideline to the hash marks (NFL 1945-71: 20; AFL: college hashes; 1972 on: 23.58). */
  hashFromSideline: number;
  /** Goal posts on the goal line through 1973, on the end line from 1974. */
  postsAt: "goal" | "end";
  /** H-frame posts until the single-support "slingshot" (NFL 1967). */
  postStyle: "h" | "slingshot";
  postColor: string;
  numbers: boolean;
  arrows: boolean;
  pylons: boolean;
  /** The home club's mark at the 50, or none. */
  midfield?: string;
  left: EndZoneLook;
  right: EndZoneLook;
  /** A baseball infield on a shared ballpark: all dirt on grass, base cut-outs on turf. */
  dirt?: "infield" | "cutouts";
  /** 0..1, worn grass between the hashes and in front of the goal. */
  wear: number;
  snow: boolean;
  rain: boolean;
  night: boolean;
  /** The colored sideline apron some stadiums painted (modern turf), else the field's green. */
  apron: string;
}

type Span = [from: number, to: number];
const within = (y: number, [a, b]: Span) => y >= a && y <= b;

/** Shared ballparks, by club and the seasons baseball was played there too. */
const BALLPARKS: Partial<Record<TeamId, Span[]>> = {
  rai: [[1966, 1981], [1995, 2019]], // Oakland Coliseum (A's)
  sfo: [[1971, 1999]], // Candlestick (Giants)
  nyj: [[1966, 1983]], // Shea Stadium (Mets)
  nyg: [[1966, 1973]], // Yankee Stadium
  min: [[1966, 1981], [1982, 2009]], // Met Stadium, then the Metrodome (Twins)
  cle: [[1966, 1993]], // Cleveland Stadium (Indians)
  clt: [[1966, 1983]], // Memorial Stadium (Orioles)
  det: [[1966, 1974]], // Tiger Stadium
  chi: [[1966, 1970]], // Wrigley Field
  atl: [[1966, 1991]], // Atlanta-Fulton County (Braves)
  kan: [[1966, 1971]], // Municipal Stadium (A's, Royals)
  crd: [[1966, 1987]], // Busch Memorial (Cardinals)
  sdg: [[1967, 2003]], // San Diego Stadium (Padres)
  den: [[1966, 1994]], // Mile High (Bears/Zephyrs, Rockies)
  mia: [[1993, 2011]], // Joe Robbie / Pro Player (Marlins)
  cin: [[1970, 1999]], // Riverfront (Reds)
  pit: [[1970, 2000]], // Three Rivers (Pirates)
  phi: [[1971, 2002]], // Veterans Stadium (Phillies)
  sea: [[1977, 1999]], // Kingdome (Mariners)
  oti: [[1968, 1996]], // Astrodome (Astros)
  buf: [[1966, 1972]], // War Memorial (Bisons)
  ram: [[1980, 1994]], // Anaheim Stadium (Angels)
  nwe: [[1966, 1968]], // Fenway Park
};

/**
 * End zones the record and the film agree on. Anything not here follows the era: plain green
 * with the club's name in its colors, painted end zones from the 1990s.
 */
interface ZoneRule {
  span: Span;
  style: EndZoneLook["style"];
  /** Which club color fills the zone (solid) or the stripes. */
  fill?: "primary" | "secondary";
  stripe?: "primary" | "secondary" | "white";
  text?: "primary" | "secondary" | "white";
}
const ZONES: Partial<Record<TeamId, ZoneRule[]>> = {
  gnb: [{ span: [1966, 2099], style: "plain", text: "secondary" }], // Lambeau never painted its end zones
  dal: [{ span: [1971, 2099], style: "solid", fill: "primary", text: "white" }], // Texas Stadium, AT&T
  kan: [{ span: [1972, 2099], style: "solid", fill: "primary", text: "white" }], // Arrowhead red
  mia: [{ span: [1966, 1986], style: "stripes", fill: "primary", stripe: "secondary", text: "white" }], // the Orange Bowl
  sfo: [{ span: [1971, 2099], style: "solid", fill: "primary", text: "white" }], // Candlestick, Levi's
  min: [{ span: [1982, 2099], style: "solid", fill: "primary", text: "white" }], // Metrodome purple
  sea: [{ span: [1976, 2099], style: "solid", fill: "primary", text: "white" }],
  det: [{ span: [1975, 2099], style: "solid", fill: "primary", text: "white" }], // Silverdome, Ford Field
  oti: [{ span: [1968, 1996], style: "solid", fill: "primary", text: "white" }], // Astrodome
  was: [{ span: [1966, 2099], style: "solid", fill: "primary", text: "secondary" }], // RFK burgundy and gold
  chi: [{ span: [1971, 2099], style: "plain", text: "primary" }],
  pit: [{ span: [1970, 2099], style: "plain", text: "primary" }],
};

function colorOf(c: { primary: string; secondary: string }, k: "primary" | "secondary" | "white" | undefined, fallback: string): string {
  if (k === "white") return "#ffffff";
  if (k === "primary") return c.primary;
  if (k === "secondary") return c.secondary;
  return fallback;
}

/** Light enough to read on grass? Otherwise lettering gets a white edge. */
function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.replace(/(.)/g, "$1$1") : m.slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function endZone(year: number, team: TeamId, text: string, surface: Surface, green: string, neutral: boolean): EndZoneLook {
  const c = teamColors(team, year);
  const rule = neutral ? undefined : ZONES[team]?.find((r) => within(year, r.span));
  const edge = (fill: string, ink: string) => (Math.abs(luminance(fill) - luminance(ink)) < 0.25 ? "#ffffff" : luminance(ink) > 0.6 ? "#0b1a10" : "#ffffff");
  if (rule) {
    const fill = rule.style === "plain" ? green : colorOf(c, rule.fill, c.primary);
    const ink = colorOf(c, rule.text, rule.style === "plain" ? c.primary : "#ffffff");
    return { style: rule.style, fill, stripe: rule.stripe ? colorOf(c, rule.stripe, "#ffffff") : undefined, text, textFill: ink, textStroke: edge(fill, ink) };
  }
  // Super Bowls and neutral sites: each end zone painted for one of the two clubs.
  if (neutral || year >= 1993 || (surface !== "grass" && year >= 1985))
    return { style: "solid", fill: c.primary, text, textFill: "#ffffff", textStroke: c.secondary };
  // The AFL's fields wore diagonal stripes in the club's colors.
  if (conferenceOf(year, team) === "AFL") return { style: "stripes", fill: green, stripe: c.primary, text, textFill: "#ffffff", textStroke: c.primary };
  return { style: "plain", fill: green, text, textFill: c.primary, textStroke: edge(green, c.primary) };
}

/** The field for one game, as it really looked that year. */
export function fieldLook(year: number, home: TeamId, away: TeamId, game?: Partial<GameResult>): FieldLook {
  const v = venueOf(year, home);
  const neutral = !!game?.neutral || !!game?.site;
  const indoor = game?.indoor ?? v.indoor;
  const turf = game?.surface ? game.surface === "turf" : v.turf;
  // AstroTurf arrived in 1966 in the Astrodome; the slit-film "FieldTurf" generation in the 2000s.
  const surface: Surface = !turf ? "grass" : year >= 2002 ? "fieldturf" : "astroturf";
  const green = surface === "grass" ? "#3f7a2f" : surface === "astroturf" ? "#2f8a3e" : "#2e6e33";
  const stripe = surface === "grass" ? "#4a8a37" : surface === "astroturf" ? "#2f8a3e" : "#347a38";
  const afl = year <= 1969 && conferenceOf(year, home) === "AFL";
  const hashFromSideline = year >= 1972 ? 70.75 / 3 : afl ? 53.33 / 3 : 20;
  const parks = BALLPARKS[home] ?? [];
  const ballpark = !neutral && parks.some((s) => within(year, s));
  const week = game?.week ?? 1;
  const cold = !indoor && surface === "grass" && ["north", "midwest", "mountain"].includes(v.climate);
  // Grass took a beating between the hashes, worst in the old northern bowls late in the year.
  const wear = surface !== "grass" ? 0 : Math.min(1, (cold ? 0.35 : 0.15) + Math.max(0, week - 8) * 0.06 + (year < 1985 ? 0.2 : 0) + (game?.weather === "rain" || game?.weather === "snow" ? 0.25 : 0));
  const homeC = teamColors(home, year);
  const leftTeam = neutral ? away : home;
  const left = endZone(year, leftTeam, (neutral ? nicknameOf(year, away) : locationOf(year, home)).toUpperCase(), surface, green, neutral);
  const right = endZone(year, home, nicknameOf(year, home).toUpperCase(), surface, green, neutral);
  return {
    year,
    stadium: game?.stadium ?? v.stadium,
    surface,
    indoor,
    green,
    stripe,
    hashFromSideline,
    postsAt: year >= 1974 ? "end" : "goal",
    postStyle: year >= 1967 ? "slingshot" : "h",
    postColor: year >= 1967 ? "#f2d027" : "#f4f4f0",
    numbers: true,
    arrows: year >= 1978,
    pylons: year >= 1970,
    // The painted mark: the logo without its tile (public/logos/field, scripts/field-logos.mjs).
    midfield: neutral ? undefined : year >= 1972 ? logoSrc(year, home).replace("/logos/", "/logos/field/") : undefined,
    left,
    right,
    dirt: ballpark ? (surface === "grass" ? "infield" : "cutouts") : undefined,
    wear,
    snow: game?.weather === "snow" && !indoor,
    rain: game?.weather === "rain" && !indoor,
    night: !!game?.night || indoor,
    apron: surface === "fieldturf" && !neutral ? homeC.primary : surface === "astroturf" ? "#2a7a37" : green,
  };
}
