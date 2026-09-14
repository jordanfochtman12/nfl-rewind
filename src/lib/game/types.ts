/** NFL Rewind engine types. No React. */

export const SAVE_VERSION = 15;
export const STARTING_YEAR = 1966;
export const END_YEAR = 2027;
export const ROSTER_TARGET = 45;
export const HOF_WAIT_YEARS = 5;
export const COACH_HOF_WAIT_YEARS = 3;

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
  | "deadline"
  | "playoffs"
  | "superBowl"
  | "awards"
  | "proBowl"
  | "retirement"
  | "hof"
  | "carousel"
  | "relocation"
  | "complete";

export type DraftSession = "nfl" | "afl" | "common";

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
  targets: number;
  tfl: number;
  pd: number;
  qbHits: number;
  fr: number;
  krTd: number;
  prTd: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  pos: Pos;
  teamId: TeamId | "fa" | "retired" | "hof";
  ratings: Ratings;
  ovr: number;
  /** Noisy pre-draft / unrevealed grade. Sim always uses `ovr`. */
  scoutOvr: number;
  /** Developmental ceiling. */
  potential: number;
  morale: number;
  /** True kit is hidden until snaps / years. */
  revealed: boolean;
  /** Games with a box-score line. */
  snaps: number;
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
  /** Style flags that change the sim (Clutch, Gunslinger, Glass, …). */
  traits: string[];
  /** Build prototype (cannon, thumper, burner…). Overall is derived from ratings. */
  arch?: string;
  injuredWeeks: number;
  injuryName?: string;
  /** Parked off the 53-man count by a desk decision; frees a roster spot while hurt. */
  onIR: boolean;
  stats: Record<number, SeasonStats>;
  career: SeasonStats[];
}

export type AttackDial = "run" | "balanced" | "pass";
export type FourthDial = "conservative" | "normal" | "aggressive";
export type TempoDial = "chew" | "standard" | "hurry";
export type BlitzDial = "rare" | "normal" | "heavy";
export type RedZoneDial = "power" | "balanced" | "spread";

export interface Gameplan {
  attack: AttackDial;
  fourth: FourthDial;
  tempo: TempoDial;
  blitz: BlitzDial;
  redZone: RedZoneDial;
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
  careerTies: number;
  careerTitles: number;
  careerBowls: number;
  yearsCoaching: number;
  age: number;
  born?: number;
  potential: number;
  peakOffense: number;
  peakDefense: number;
  leadership: number;
  development: number;
  evaluation: number;
  abilities: string[];
  traits: string[];
  firedCount: number;
  retiredYear?: number;
  hofYear?: number;
}


export interface DraftPickAsset {
  id: string;
  year: number;
  round: number;
  orig: TeamId;
  owner: TeamId;
  used?: boolean;
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
  /** Ordered player ids per position. Sim reads this, not raw ovr sort. */
  depth: Partial<Record<Pos, string[]>>;
  picks: DraftPickAsset[];
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
  /** Regular-season record across the dynasty. Not reset in training camp. */
  careerWins: number;
  careerLosses: number;
  careerTies: number;
  /** Sunday call sheet. CPU derives from scheme if unset. */
  plan?: Gameplan;
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
  krYds?: number;
  prYds?: number;
  targets?: number;
  tfl?: number;
  pd?: number;
  qbHits?: number;
  fr?: number;
  krTd?: number;
  prTd?: number;
}

export type DriveResult =
  | "td"
  | "fg"
  | "punt"
  | "int"
  | "fumble"
  | "miss"
  | "downs"
  | "end"
  | "safety"
  | "ko-td";

export interface DriveSummary {
  teamId: TeamId;
  q: number;
  plays: number;
  yards: number;
  result: DriveResult;
  startSpot: number;
  label: string;
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
  homeQ?: number[];
  awayQ?: number[];
  attendance?: number;
  rivalry?: boolean;
  night?: boolean;
  /** Time of possession, seconds. */
  homePoss?: number;
  awayPoss?: number;
  homeFd?: number;
  awayFd?: number;
  homeTot?: number;
  awayTot?: number;
  ot?: boolean;
  drives?: DriveSummary[];
  homePen?: number;
  awayPen?: number;
  homePenYds?: number;
  awayPenYds?: number;
  home3rd?: number;
  home3rdAtt?: number;
  away3rd?: number;
  away3rdAtt?: number;
  homeRz?: number;
  homeRzAtt?: number;
  awayRz?: number;
  awayRzAtt?: number;
  /** Pro Bowl / all-star rosters. */
  homeRoster?: string[];
  awayRoster?: string[];
  stadium?: string;
  surface?: "grass" | "turf";
  indoor?: boolean;
  /** Turnovers committed (INT + lost fumbles). */
  homeTo?: number;
  awayTo?: number;
  homeSafeties?: number;
  awaySafeties?: number;
  /** One-line scouting note: crowd, site, matchup. */
  filmNote?: string;
  /** Super Bowl / Pro Bowl — no home crowd. */
  neutral?: boolean;
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

export type TxKind = "draft" | "cut" | "sign" | "expansion" | "trade" | "retire" | "waive" | "claim" | "ir" | "activate";

export interface Transaction {
  id: string;
  year: number;
  week: number;
  kind: TxKind;
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
  league?: DraftSession;
}

export interface WaiverWire {
  playerId: string;
  from: TeamId;
  week: number;
  year: number;
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
  playerId?: string;
  coachId?: string;
  year: number;
  teamId: TeamId;
  blurb: string;
  kind?: "player" | "coach";
}

export interface RetireeEvent {
  playerId?: string;
  coachId?: string;
  year: number;
  teamId: TeamId;
  seasons: number;
  blurb: string;
  kind?: "player" | "coach";
}


export interface DynastyGrade {
  year: number;
  final: boolean;
  letter: string;
  score: number;
  seasons: number;
  rings: number;
  titles: number;
  winningSeasons: number;
  hof: number;
  honor: number;
  draftedStars: number;
  wins: number;
  losses: number;
  ties: number;
  blurb: string;
  lines: { label: string; value: string; pts: number }[];
}

export interface SeasonChapter {
  year: number;
  teamId: TeamId;
  wins: number;
  losses: number;
  ties: number;
  pf: number;
  pa: number;
  coach?: string;
  result: string;
  drafted: { playerId: string; name: string; pos: Pos; round?: number }[];
  honors: string[];
}

export interface CampBattle {
  pos: Pos;
  starterId: string;
  backupId: string;
  note: string;
}

export interface CampCut {
  playerId: string;
  teamId: TeamId;
}

export interface CampInjury {
  playerId: string;
  teamId: TeamId;
  weeks: number;
  name: string;
}

export interface CampReport {
  year: number;
  cuts: CampCut[];
  injuries: CampInjury[];
  battles: CampBattle[];
}

export interface TradeOffer {
  id: string;
  from: TeamId;
  give: TradePiece[];
  get: TradePiece[];
  status: "open" | "accepted" | "declined";
}

export interface DeadlineSession {
  year: number;
  week: number;
  offers: TradeOffer[];
  cpuMoves: string[];
  resolved: boolean;
}

export interface Almanac {
  superBowls: BowlAlmanacEntry[];
  championships: { year: number; league: string; teamId: TeamId }[];
  hof: HofMember[];
  teamOfHonor: Record<string, string[]>;
  awards: AwardsResult[];
  retirements: RetireeEvent[];
  seasons: SeasonChapter[];
  grade?: DynastyGrade;
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
  draftSession: DraftSession;
  expansion?: ExpansionPickState;
  nextPlayerSeq: number;
  nextNewsSeq: number;
  pendingRetirees: string[];
  pendingHof: string[];
  pendingCoachRetirees: string[];
  pendingCoachHof: string[];
  lastPow: { aflNfl?: string; afc?: string; nfc?: string };
  primetime?: PrimetimeShow;
  salaryCap: number | null;
  carousel: CarouselMove[];
  waiverOrder: TeamId[];
  waivers: WaiverWire[];
  faOpened: boolean;
  /** Regular / playoff week just simmed; stay on the film until Continue. */
  weekFilm?: boolean;
  camp?: CampReport;
  deadline?: DeadlineSession;
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
  /** CPU picks until the user is on the clock (or the draft ends). */
  simToUser?: boolean;
  /** Close the FA market and kick off the season. */
  closeFa?: boolean;
}

export interface TradePiece {
  playerId?: string;
  pickId?: string;
}

export interface GmResult {
  ok: boolean;
  reason?: string;
}
