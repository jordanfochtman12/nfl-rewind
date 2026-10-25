/**
 * The owner's chair. You don't call plays — you set ticket prices, pay for stars, and live
 * with the crowd you get. Winning, marquee players and fair prices build support; losing and
 * gouging burn it. Let it collapse for long enough and other cities start calling. And when
 * history says your club leaves town, it's your signature on the lease.
 *
 * Nothing here draws from the save's RNG: owner decisions never reshuffle league results.
 */
import type {
  DynastySave,
  GameResult,
  HomeClimate,
  OwnerState,
  RelocationOffer,
  TeamId,
  TicketTier,
} from "./types.ts";
import { clamp } from "./rng.ts";
import { activeTeamIds, historicLocationOf, locationOf, nicknameOf, setHomeOverride } from "./teams.ts";
import { venueOf } from "./venues.ts";
import { addNews } from "./news.ts";
import { rosterOf } from "./players.ts";
import { relocationsForYear, type RelocationSpec } from "./data/relocations.ts";

export const TICKET_TIERS: { id: TicketTier; label: string; price: number; demand: number; drift: number; blurb: string }[] = [
  { id: "value", label: "Value", price: 0.8, demand: 1.08, drift: 0.35, blurb: "Families in the upper deck. Less at the gate, more goodwill." },
  { id: "standard", label: "Standard", price: 1, demand: 1, drift: 0, blurb: "League-average prices. Nobody writes a letter to the editor." },
  { id: "premium", label: "Premium", price: 1.3, demand: 0.93, drift: -0.3, blurb: "More per seat. Works when you win; noticed when you don't." },
  { id: "gouge", label: "Gouge", price: 1.7, demand: 0.84, drift: -0.8, blurb: "Maximum gate. The columnists will call it what it is." },
];

const tier = (id: TicketTier) => TICKET_TIERS.find((t) => t.id === id) ?? TICKET_TIERS[1]!;

/** Average NFL ticket, nominal dollars. */
const PRICE_ANCHORS: [number, number][] = [
  [1966, 5.5],
  [1970, 7],
  [1980, 11],
  [1990, 25],
  [2000, 48],
  [2010, 76],
  [2020, 101],
  [2030, 125],
];

export function avgTicketPrice(year: number): number {
  for (let i = 1; i < PRICE_ANCHORS.length; i++) {
    const [y1, p1] = PRICE_ANCHORS[i]!;
    const [y0, p0] = PRICE_ANCHORS[i - 1]!;
    if (year <= y1) return p0 + ((p1 - p0) * (Math.max(year, y0) - y0)) / (y1 - y0);
  }
  return PRICE_ANCHORS[PRICE_ANCHORS.length - 1]![1];
}

export function ticketPrice(year: number, t: TicketTier): number {
  return Math.round(avgTicketPrice(year) * tier(t).price * 100) / 100;
}

export function newOwnerState(): OwnerState {
  return { support: 60, ticket: "standard", homeGames: 0, crowdTotal: 0, capacityTotal: 0, gate: 0, threat: 0, ledger: [], moves: [] };
}

export function ownerOf(save: DynastySave): OwnerState {
  if (!save.owner) save.owner = newOwnerState();
  return save.owner;
}

/** Keep the module-level name/venue override in step with whichever save is live. */
export function syncHomeOverride(save: DynastySave): void {
  setHomeOverride(save.owner?.home);
}

export function supportMood(support: number): { label: string; tone: "good" | "ok" | "warn" | "bad" } {
  if (support >= 80) return { label: "Sold out through December", tone: "good" };
  if (support >= 62) return { label: "Loyal and loud", tone: "good" };
  if (support >= 45) return { label: "Waiting to be won over", tone: "ok" };
  if (support >= 32) return { label: "Empty seats on the TV", tone: "warn" };
  return { label: "The city is turning", tone: "bad" };
}

/** Home crowd for the owner's club: the base gate reshaped by support and price. */
export function ownerCrowd(save: DynastySave, game: GameResult, base: number, capacity: number): number {
  const o = ownerOf(save);
  const fill = clamp((base / Math.max(1, capacity)) * (0.62 + o.support / 130) * tier(o.ticket).demand, 0.35, 1);
  return Math.round(capacity * fill);
}

/** A loud building is worth a little on third down. Returns an adjustment to crowd noise. */
export function ownerNoise(save: DynastySave): number {
  const o = save.owner;
  if (!o) return 0;
  return clamp((o.support - 50) / 4000, -0.008, 0.012);
}

function isUserGame(save: DynastySave, g: GameResult): boolean {
  return g.homeId === save.userTeamId || g.awayId === save.userTeamId;
}

/** After every game the owner's club plays: the gate, and what the result did to the city. */
export function ownerAfterGame(save: DynastySave, g: GameResult): void {
  if (g.phase === "preseason" || g.phase === "proBowl" || !isUserGame(save, g)) return;
  const o = ownerOf(save);
  if (g.phase === "regular" && g.week <= 1 && o.offer) o.offer = undefined;
  const home = g.homeId === save.userTeamId;
  const us = home ? g.homeScore : g.awayScore;
  const them = home ? g.awayScore : g.homeScore;
  const playoff = g.phase === "playoffs" || g.phase === "superBowl";
  let d = 0;
  if (us > them) d = g.phase === "superBowl" ? 7 : playoff ? 3 : g.rivalry ? 2.3 : 1.5;
  else if (us < them) d = playoff ? -0.5 : -1.6 - (them - us >= 21 ? 1 : 0) - (g.rivalry ? 0.6 : 0);
  if (home && !g.neutral && g.phase !== "superBowl") {
    d += tier(o.ticket).drift;
    const venue = venueOf(g.year, save.userTeamId);
    const crowd = g.attendance ?? venue.capacity;
    o.homeGames += 1;
    o.crowdTotal += crowd;
    o.capacityTotal += venue.capacity;
    o.gate += Math.round(crowd * ticketPrice(g.year, o.ticket) * (playoff ? 1.5 : 1));
  }
  o.support = clamp(o.support + d, 3, 99);
}

function hash(n: number): number {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

interface Suitor {
  city: string;
  stadium: (year: number) => string;
  climate: HomeClimate;
  indoor: (year: number) => boolean;
  bonus: number;
  since?: number;
}

const SUITORS: Suitor[] = [
  { city: "Los Angeles", stadium: () => "Los Angeles Memorial Coliseum", climate: "pacific", indoor: () => false, bonus: 18_000 },
  { city: "Baltimore", stadium: () => "Memorial Stadium", climate: "north", indoor: () => false, bonus: 0 },
  { city: "St. Louis", stadium: (y) => (y >= 1995 ? "the Trans World Dome" : "Busch Memorial Stadium"), climate: "midwest", indoor: (y) => y >= 1995, bonus: 0 },
  { city: "Houston", stadium: (y) => (y >= 2002 ? "Reliant Stadium" : "the Astrodome"), climate: "south", indoor: () => true, bonus: 0 },
  { city: "Phoenix", stadium: () => "Sun Devil Stadium", climate: "south", indoor: () => false, bonus: 2_000 },
  { city: "Memphis", stadium: () => "Liberty Bowl Memorial Stadium", climate: "south", indoor: () => false, bonus: -4_000 },
  { city: "Birmingham", stadium: () => "Legion Field", climate: "south", indoor: () => false, bonus: 0 },
  { city: "San Antonio", stadium: (y) => (y >= 1993 ? "the Alamodome" : "Alamo Stadium"), climate: "south", indoor: (y) => y >= 1993, bonus: -2_000 },
  { city: "Portland", stadium: () => "Civic Stadium", climate: "pacific", indoor: () => false, bonus: -8_000 },
  { city: "Toronto", stadium: (y) => (y >= 1989 ? "the SkyDome" : "Exhibition Stadium"), climate: "north", indoor: (y) => y >= 1989, bonus: -6_000 },
  { city: "Orlando", stadium: () => "the Citrus Bowl", climate: "florida", indoor: () => false, bonus: 0 },
  { city: "Sacramento", stadium: () => "Hughes Stadium", climate: "pacific", indoor: () => false, bonus: -10_000 },
  { city: "Salt Lake City", stadium: () => "Rice Stadium", climate: "mountain", indoor: () => false, bonus: -12_000 },
  { city: "Oklahoma City", stadium: () => "Taft Stadium", climate: "midwest", indoor: () => false, bonus: -8_000 },
  { city: "Las Vegas", stadium: () => "Sam Boyd Stadium", climate: "south", indoor: () => false, bonus: -8_000, since: 1971 },
  { city: "London", stadium: () => "Wembley Stadium", climate: "north", indoor: () => false, bonus: 14_000, since: 2007 },
];

function eraCapacity(year: number): number {
  return year <= 1969 ? 52_000 : year <= 1979 ? 60_000 : year <= 1994 ? 68_000 : 70_000;
}

function openMarkets(save: DynastySave): Suitor[] {
  const taken = new Set(activeTeamIds(save.year).map((id) => locationOf(save.year, id)));
  return SUITORS.filter((s) => !taken.has(s.city) && (s.since ?? 0) <= save.year);
}

function makeOffer(save: DynastySave): RelocationOffer | undefined {
  const open = openMarkets(save);
  if (!open.length) return undefined;
  const s = open[hash(save.year * 31 + save.seed) % open.length]!;
  const capacity = Math.max(45_000, eraCapacity(save.year) + s.bonus);
  const indoor = s.indoor(save.year);
  return {
    year: save.year,
    city: s.city,
    stadium: s.stadium(save.year),
    capacity,
    climate: s.climate,
    indoor,
    pitch: `${s.city} has a lease ready at ${s.stadium(save.year)} — ${capacity.toLocaleString()} seats${indoor ? " under a roof" : ""}, a parade down the main drag, and no memory of the last few years.`,
  };
}

/** Close the owner's books on the season just played (runs before the calendar turns). */
export function closeOwnerSeason(save: DynastySave): void {
  const o = ownerOf(save);
  const t = save.teams[save.userTeamId];
  if (!t) return;
  const stars = rosterOf(save, save.userTeamId).filter((p) => p.ovr >= 88).length;
  const playoffs = save.playoffGames.some((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId);
  let d = stars ? Math.min(3, stars) : -2;
  if (playoffs) d += 3;
  if (t.wins < t.losses) {
    d -= 3;
    const prior = o.ledger.slice(-2);
    if (prior.length === 2 && prior.every((l) => l.wins < l.losses)) d -= 2;
  }
  o.support = clamp(o.support + d, 3, 99);
  o.support = Math.round((o.support + (55 - o.support) * 0.12) * 10) / 10;
  o.ledger.push({
    year: save.year,
    wins: t.wins,
    losses: t.losses,
    ties: t.ties,
    support: Math.round(o.support),
    avgCrowd: o.homeGames ? Math.round(o.crowdTotal / o.homeGames) : 0,
    fill: o.capacityTotal ? Math.round((1000 * o.crowdTotal) / o.capacityTotal) / 10 : 0,
    gate: o.gate,
    ticket: o.ticket,
  });
  if (o.ledger.length > 80) o.ledger.shift();
  o.homeGames = 0;
  o.crowdTotal = 0;
  o.capacityTotal = 0;
  o.gate = 0;

  const name = locationOf(save.year, save.userTeamId);
  if (o.support < 32) o.threat += 1;
  else if (o.support >= 45) o.threat = 0;
  if (o.threat === 1) {
    addNews(save, {
      kind: "headline",
      headline: `Empty seats in ${name}`,
      body: "The upper deck is a tarp and the columnists have started counting. Nobody's saying the word yet.",
      teamIds: [save.userTeamId],
      playerIds: [],
    });
  } else if (o.threat >= 2 && !save.cpuOnly) {
    o.offer = makeOffer(save);
    if (o.offer) {
      addNews(save, {
        kind: "headline",
        headline: `${o.offer.city} comes calling`,
        body: `With the crowds in ${name} gone, ${o.offer.city} makes its pitch to the owner. City hall is suddenly asking what it would take to keep the club.`,
        teamIds: [save.userTeamId],
        playerIds: [],
      });
    }
  }
}

export function setTicketTier(save: DynastySave, t: TicketTier): string {
  const o = ownerOf(save);
  if (o.ticket === t) return `Tickets already at ${tier(t).label.toLowerCase()} prices.`;
  o.ticket = t;
  return `Ticket prices set to ${tier(t).label.toLowerCase()}: ${formatPrice(ticketPrice(save.year, t))} a seat.`;
}

export function formatPrice(n: number): string {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

function overrideFrom(save: DynastySave, from: number, city: string, stadium: string, capacity: number, climate: HomeClimate, indoor: boolean, turf: boolean) {
  return {
    teamId: save.userTeamId,
    from,
    city,
    nickname: nicknameOf(from - 1, save.userTeamId),
    stadium,
    capacity,
    climate,
    indoor,
    turf,
  };
}

export function acceptRelocation(save: DynastySave): string {
  const o = ownerOf(save);
  const offer = o.offer;
  if (!offer) return "No offer on the table.";
  const oldName = `${locationOf(save.year, save.userTeamId)} ${nicknameOf(save.year, save.userTeamId)}`;
  o.home = overrideFrom(save, save.year, offer.city, offer.stadium, offer.capacity, offer.climate, offer.indoor, false);
  syncHomeOverride(save);
  const newName = `${offer.city} ${nicknameOf(save.year, save.userTeamId)}`;
  o.moves.push({ year: save.year, from: oldName, to: newName });
  o.offer = undefined;
  o.threat = 0;
  o.support = 72;
  addNews(save, {
    kind: "headline",
    headline: `The ${oldName} are moving to ${offer.city}`,
    body: `The owner signs the lease. The trucks go this spring. ${offer.city} gets a club; the old town gets the record book and an empty stadium.`,
    teamIds: [save.userTeamId],
    playerIds: [],
  });
  return `You moved the club. Welcome to ${offer.city}.`;
}

export function declineRelocation(save: DynastySave): string {
  const o = ownerOf(save);
  if (!o.offer) return "No offer on the table.";
  const city = o.offer.city;
  o.offer = undefined;
  o.support = clamp(o.support + 6, 3, 99);
  addNews(save, {
    kind: "headline",
    headline: `Owner says no to ${city}`,
    body: `"This club stays home." The fans who were left buy a few more season tickets. Now win something.`,
    teamIds: [save.userTeamId],
    playerIds: [],
  });
  return `You turned down ${city}. The city noticed.`;
}

/** Real moves still on the calendar, minus the ones the owner has overridden. */
export function relocationsFor(save: DynastySave, year: number): RelocationSpec[] {
  const home = save.owner?.home;
  return relocationsForYear(year).filter((m) => !(home && home.teamId === m.teamId && year >= home.from));
}

/** Only a real change of city is the owner's call; a statewide rename just happens. */
export function isCityMove(m: RelocationSpec): boolean {
  const before = historicLocationOf(m.year - 1, m.teamId);
  const after = historicLocationOf(m.year, m.teamId);
  return before !== after && !(before === "Phoenix" && after === "Arizona");
}

export function postRelocationNews(save: DynastySave, m: RelocationSpec): void {
  addNews(save, {
    kind: "headline",
    headline: m.title,
    body: `${m.from} are now the ${m.to}. ${m.body}`,
    teamIds: [m.teamId],
    playerIds: [],
  });
}

export function followHistory(save: DynastySave): string {
  const o = ownerOf(save);
  const h = o.historic;
  if (!h) return "Nothing to sign.";
  const m = relocationsForYear(h.year).find((r) => r.teamId === save.userTeamId);
  if (m) postRelocationNews(save, m);
  o.moves.push({ year: h.year, from: h.from, to: h.to });
  o.historic = undefined;
  o.support = 70;
  o.threat = 0;
  return `You signed the lease. The ${h.to} it is.`;
}

export function stayHome(save: DynastySave): string {
  const o = ownerOf(save);
  const h = o.historic;
  if (!h) return "Nothing to sign.";
  const id: TeamId = save.userTeamId;
  const prev = venueOf(h.year - 1, id);
  o.home = overrideFrom(save, h.year, locationOf(h.year - 1, id), prev.stadium, prev.capacity, prev.climate, prev.indoor, prev.turf);
  syncHomeOverride(save);
  o.historic = undefined;
  o.support = clamp(o.support + 12, 3, 99);
  o.threat = 0;
  addNews(save, {
    kind: "headline",
    headline: `The ${h.from} stay home`,
    body: `History had the trucks booked. The owner tore up the lease. ${o.home.city} keeps its club, and the ${h.to} never happen.`,
    teamIds: [id],
    playerIds: [],
  });
  return `The ${h.from} stay put. History just changed.`;
}
