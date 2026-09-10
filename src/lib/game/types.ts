/** NFL Rewind engine types. No React. */

export const SAVE_VERSION = 2;
export const STARTING_YEAR = 1966;
export const END_YEAR = 2027;
export const ROSTER_TARGET = 45;
export const HOF_WAIT_YEARS = 5;

export const TEAM_IDS = [
  "atl",
  "ram",
  "pit",
  "phi",
  "dal",
  "was",
  "min",
  "crd",
  "gnb",
  "nyg",
  "sfo",
  "chi",
  "cle",
  "clt",
  "det",
  "mia",
  "den",
  "oti",
  "nwe",
  "buf",
  "nyj",
  "rai",
  "sdg",
  "kan",
  "nor",
  "cin",
  "tam",
  "sea",
  "car",
  "jax",
  "rav",
  "htx",
] as const;

export type TeamId = (typeof TEAM_IDS)[number];

export const ACTIVE_1966: readonly TeamId[] = [
  "atl",
  "ram",
  "pit",
  "phi",
  "dal",
  "was",
  "min",
  "crd",
  "gnb",
  "nyg",
  "sfo",
  "chi",
  "cle",
  "clt",
  "det",
  "mia",
  "den",
  "oti",
  "nwe",
  "buf",
  "nyj",
  "rai",
  "sdg",
  "kan",
] as const;

export type Phase =
  | "draft"
  | "freeAgency"
  | "expansion"
  | "preseason"
  | "regular"
  | "playoffs"
  | "superBowl"
  | "awards"
  | "proBowl"
  | "retirement"
  | "hof";

export type Pos =
  | "QB"
  | "RB"
  | "FB"
  | "WR"
  | "TE"
  | "LT"
  | "LG"
  | "C"
  | "RG"
  | "RT"
  | "DE"
  | "DT"
  | "OLB"
  | "MLB"
  | "CB"
  | "S"
  | "K"
  | "P";

export const SKILL_POSITIONS: Pos[] = [
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "DE",
  "DT",
  "OLB",
  "MLB",
  "CB",
  "S",
  "K",
  "P",
];

export const RATING_KEYS = [
  "throwPow",
  "throwAcc",
  "throwAwr",
  "speed",
  "accel",
  "agi",
  "str",
  "truck",
  "elu",
  "btk",
  "catch",
  "cit",
  "rel",
  "rrt",
  "passBlk",
  "runBlk",
  "tak",
  "prs",
  "cov",
  "pur",
  "kickPow",
  "kickAcc",
  "stamina",
  "inj",
  "awareness",
] as const;

export type RatingKey = (typeof RATING_KEYS)[number];

export type Ratings = Record<RatingKey, number>;

export interface SeasonStats {
  year: number;
  teamId: TeamId | "two";
  gp: number;
  passAtt: number;
  passCmp: number;
  passYds: number;
  passTd: number;
  passInt: number;
  sacksThrown: number;
  rushAtt: number;
  rushYds: number;
  rushTd: number;
  rec: number;
  recYds: number;
  recTd: number;
  tackles: number;
  sacks: number;
  ints: number;
  ff: number;
  fgAtt: number;
  fgMade: number;
  xpAtt: number;
  xpMade: number;
  punts: number;
  puntYds: number;
  krYds: number;
  prYds: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  pos: Pos;
  teamId: TeamId | "fa" | "retired" | "hof";
  ratings: Ratings;
  ovr: number;
  age: number;
  yearsPro: number;
  jersey: number;
  college?: string;
  heightIn?: number;
  weight?: number;
  forty?: number;
  historical: boolean;
  generated: boolean;
  draftYear?: number;
  draftRound?: number;
  draftPick?: number;
  retiredYear?: number;
  hofYear?: number;
  userTied: boolean;
  peakOvr: number;
  contractYears: number;
  salary: number;
  abilities: string[];
  injuredWeeks: number;
  injuryName?: string;
  stats: Record<number, SeasonStats>;
  career: SeasonStats[];
}

export type CoachRole = "HC" | "OC" | "DC";
export type OffScheme = "smashmouth" | "vertical" | "westcoast" | "multiple";
export type DefScheme = "4-3" | "3-4" | "wide-9" | "cover-2";
export type DraftStyle = "bpa" | "need" | "speed" | "trench" | "defense" | "qb";

export interface Coach {
  id: string;
  name: string;
  teamId: TeamId | null;
  yearAvail: number;
  offense: number;
  defense: number;
  historical: boolean;
  role: CoachRole;
  offScheme: OffScheme;
  defScheme: DefScheme;
  yearsOnJob: number;
  careerWins: number;
  careerLosses: number;
}

export interface TeamState {
  id: TeamId;
  active: boolean;
  coachId: string | null;
  ocId: string | null;
  dcId: string | null;
  offScheme: OffScheme;
  defScheme: DefScheme;
  draftStyle: DraftStyle;
  payroll: number;
  roster: string[];
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  divWins: number;
  divLosses: number;
  confWins: number;
  confLosses: number;
  streak: string;
}

export interface BoxPlayer {
  playerId: string;
  passAtt?: number;
  passCmp?: number;
  passYds?: number;
  passTd?: number;
  passInt?: number;
  rushAtt?: number;
  rushYds?: number;
  rushTd?: number;
  rec?: number;
  recYds?: number;
  recTd?: number;
  sacks?: number;
  ints?: number;
  tackles?: number;
  fgMade?: number;
  fgAtt?: number;
  xpMade?: number;
  xpAtt?: number;
  punts?: number;
  puntYds?: number;
  sacksThrown?: number;
  ff?: number;
}

export interface GameResult {
  id: string;
  year: number;
  week: number;
  phase: "preseason" | "regular" | "playoffs" | "superBowl" | "proBowl";
  round?: string;
  homeId: TeamId | "afc" | "nfc" | "afl" | "nfl";
  awayId: TeamId | "afc" | "nfc" | "afl" | "nfl";
  homeScore: number;
  awayScore: number;
  played: boolean;
  mvpPlayerId?: string;
  boxHome?: BoxPlayer[];
  boxAway?: BoxPlayer[];
  weather?: "clear" | "rain" | "wind" | "cold" | "snow";
  highlights?: string[];
  homeQ?: [number, number, number, number];
  awayQ?: [number, number, number, number];
  attendance?: number;
}

export interface NewsItem {
  id: string;
  year: number;
  week: number;
  phase: Phase;
  kind: "headline" | "pow" | "transaction" | "injury" | "award" | "expansion" | "hof" | "retire";
  headline: string;
  body: string;
  teamIds: TeamId[];
  playerIds: string[];
}

export interface Transaction {
  id: string;
  year: number;
  week: number;
  kind: "draft" | "cut" | "sign" | "expansion" | "trade" | "retire";
  playerId: string;
  from: string;
  to: string;
  detail: string;
}

export interface Prospect {
  playerId: string;
  slot: number;
  taken: boolean;
  takenBy?: TeamId;
}

export interface ExpansionPickState {
  specId: string;
  newTeamIds: TeamId[];
  exposed: Record<TeamId, string[]>;
  picksMade: string[];
  pickCap: number;
  pickingIndex: number;
  done: boolean;
}

export interface AwardsResult {
  year: number;
  mvp?: string;
  offPoy?: string;
  defPoy?: string;
  oroy?: string;
  droy?: string;
  cpoty?: string;
  allPro: string[];
}

export interface BowlAlmanacEntry {
  year: number;
  number: number;
  site: string;
  city: string;
  homeId: TeamId;
  awayId: TeamId;
  homeScore: number;
  awayScore: number;
  mvpId?: string;
  mvpName?: string;
  atmosphere: string;
}

export interface HofMember {
  playerId: string;
  year: number;
  teamId: TeamId;
  blurb: string;
}

export interface RetireeEvent {
  playerId: string;
  year: number;
  teamId: TeamId;
  seasons: number;
  blurb: string;
}

export interface Almanac {
  superBowls: BowlAlmanacEntry[];
  championships: { year: number; league: string; teamId: TeamId }[];
  hof: HofMember[];
  teamOfHonor: Record<string, string[]>;
  awards: AwardsResult[];
  retirements: RetireeEvent[];
}

export interface DynastySave {
  version: number;
  startingYear: number;
  year: number;
  week: number;
  phase: Phase;
  weekLabel: string;
  userTeamId: TeamId;
  seed: number;
  rng: number;
  cpuOnly: boolean;
  players: Record<string, Player>;
  teams: Record<TeamId, TeamState>;
  coaches: Record<string, Coach>;
  schedule: GameResult[];
  playoffGames: GameResult[];
  superBowl?: GameResult;
  proBowl?: GameResult;
  awards?: AwardsResult;
  news: NewsItem[];
  weekNews: NewsItem[];
  transactions: Transaction[];
  history: Almanac;
  draftBoard: Prospect[];
  draftPickIndex: number;
  expansion?: ExpansionPickState;
  nextPlayerSeq: number;
  nextNewsSeq: number;
  pendingRetirees: string[];
  pendingHof: string[];
  lastPow: { aflNfl?: string; afc?: string; nfc?: string };
  primetime?: PrimetimeShow;
  salaryCap: number | null;
  carousel: CarouselMove[];
}

export interface PrimetimeRecap {
  homeId: TeamId;
  awayId: TeamId;
  homeScore: number;
  awayScore: number;
  line: string;
  note: string;
}

export interface PrimetimeShow {
  year: number;
  week: number;
  open: string;
  recaps: PrimetimeRecap[];
  playOfNight: string;
  pow: string;
  close: string;
}

export interface CarouselMove {
  year: number;
  teamId: TeamId;
  fired?: string;
  hired: string;
  role: CoachRole;
  note: string;
}

export interface CreateGameOpts {
  userTeamId: TeamId;
  startingYear?: number;
  seed?: number;
  cpuOnly?: boolean;
}

export interface AdvanceOpts {
  auto?: boolean;
  userPickPlayerId?: string;
}
