/** NFL Rewind engine types. No React. */

export const SAVE_VERSION = 18;
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
  /** When the current injury happened (for the weekly injury report). */
  injuredOn?: { year: number; week: number; phase: Phase };
  /** Parked off the 53-man count by a desk decision; frees a roster spot while hurt. */
  onIR: boolean;
  /**
   * Real career shape for a real draftee: draft year, last NFL season (0 = never played),
   * seasons as a starter, games, Pro Bowls, first-team All-Pros, age at draft. Drives
   * development and retirement so his ratings follow the arc he actually had.
   */
  arc?: { dy: number; to: number; st: number; g: number; pb: number; ap: number; age: number };
  stats: Record<number, SeasonStats>;
  career: SeasonStats[];
  /** The round history actually took him in (real draftees), for draft retrospectives. */
  realRound?: number;
  /** The club that drafted him in this dynasty. */
  draftTeam?: TeamId;
  /** Announced final season (a real player's farewell tour). */
  finalSeason?: number;
  /** Holding out for a new contract; misses games until the owner pays him. */
  holdout?: boolean;
  /** Postseason lines (playoffs + Super Bowl), kept apart from the regular-season record. */
  playoffStats?: Record<number, SeasonStats>;
  /** Pro Bowls, All-Pros, awards and rings, by year. */
  honors?: PlayerHonors;
  /** A duplicate record of another player from older draft data; kept for the books only. */
  twinOf?: string;
}

export type AwardKey = "MVP" | "OPOY" | "DPOY" | "OROY" | "DROY" | "CPOY" | "SBMVP";

export interface PlayerHonors {
  proBowl: number[];
  allPro: number[];
  awards: { year: number; award: AwardKey }[];
  /** Super Bowl wins. */
  rings: number[];
}

export type AttackDial = "run" | "balanced" | "pass";
export type FourthDial = "conservative" | "normal" | "aggressive";
export type TempoDial = "chew" | "standard" | "hurry";
export type BlitzDial = "rare" | "normal" | "heavy";
export type RedZoneDial = "power" | "balanced" | "spread";

export interface Gameplan {
  protection?: "balanced" | "maxProtect";
  defensiveFocus?: "balanced" | "run" | "pass";
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
  /** [home, away] once the drive (and any try after it) is over. */
  after?: [number, number];
}

export interface GameResult {
  /** Call sheets at kickoff, preserved independently of subsequent coaching edits. */
  callSheets?: { home: Gameplan; away: Gameplan };
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
  /** The owner's crunch-time calls in this game. */
  crunchCalls?: string[];
  /** Play-by-play for the owner's games (current season only). */
  log?: PlayLog[];
  /** Real regular-season neutral site (London, Mexico City, ...). */
  site?: string;
  /** Real calendar date, MMDD. */
  date?: string;
  /** Real TV slot: M Monday night, T Thursday, S Saturday, F Friday, N Sunday night. */
  slot?: string;
  /** What really happened in this game (history's final), when it's on the real schedule. */
  realHome?: number;
  realAway?: number;
}

/** One snap of the owner's game, for the live broadcast. */
export interface PlayLog {
  /** Actual stat events, absent in film recorded before version 17. */
  snap?: { call: string; kind: "pass" | "run" | "sack" | "kick" | "other"; yards: number; complete?: boolean };
  homeTimeouts?: number;
  awayTimeouts?: number;
  q: number;
  clock: number;
  poss: TeamId;
  down: number;
  togo: number;
  /** Yards from the offense's own goal line before the snap. */
  spot: number;
  text: string;
  /** Score after the play. */
  hs: number;
  as: number;
  tag?: "td" | "to" | "big" | "fg" | "call" | "safety";
}

/** A call the owner sends down to the sideline during his live game, from play `at` on. */
export interface LiveOrder {
  gameId: string;
  /** Play-by-play index the order takes effect at. */
  at: number;
  kind: "plan" | "benchQb";
  plan?: Partial<Gameplan>;
}

export interface CrunchSituation {
  /** The game so far, up to the moment of the call. */
  log?: PlayLog[];
  gameId: string;
  index: number;
  kind: "fourth" | "two" | "onside";
  q: number;
  clock: number;
  us: number;
  them: number;
  down: number;
  togo: number;
  /** Yards from the owner's own goal line. */
  spot: number;
  fgDist?: number;
  options: { id: string; label: string }[];
}

export interface HeadToHead {
  a: TeamId;
  b: TeamId;
  aWins: number;
  bWins: number;
  ties: number;
  last?: { year: number; label: string; winner?: TeamId; score: string; playoff: boolean };
  lastPlayoff?: { year: number; label: string; winner: TeamId; score: string };
}

export interface SeasonGoal {
  id: string;
  text: string;
  met?: boolean;
  /** Counts double on the report card. */
  major?: boolean;
}

export interface SeasonPlan {
  year: number;
  projWins: number;
  outlook: string;
  goals: SeasonGoal[];
  graded?: boolean;
  grade?: string;
  verdict?: string;
}

export interface Achievement {
  id: string;
  year: number;
  title: string;
  body: string;
}

export interface GameRecordEntry {
  playerId: string;
  value: number;
  year: number;
  week: number;
  opponent: TeamId;
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

/** How the owner's players came out of the offseason: rating before and after. */
export interface ProgressionReport {
  year: number;
  rows: { playerId: string; from: number; to: number }[];
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

/** A CPU club on the phone mid-season with a trade. Good until the next week kicks off. */
export interface TradeCall extends TradeOffer {
  year: number;
  week: number;
  pitch: string;
}

/** The owner's offer to a free agent other clubs want too. */
export interface FaBid {
  year: number;
  playerId: string;
  /** 0 market, 1 strong, 2 blow him away. */
  tier: number;
  salary: number;
  years: number;
  rivals: { teamId: TeamId; tier: number }[];
  /** Fixed at the first offer so raising the bid is the only lever. */
  luck: number[];
  status: "open" | "won" | "lost";
  winner?: TeamId;
  note?: string;
}

export interface Rumor {
  text: string;
  teamIds: TeamId[];
  playerId?: string;
}

export interface DeadlineSession {
  year: number;
  week: number;
  offers: TradeOffer[];
  cpuMoves: string[];
  resolved: boolean;
}

/** One season of real history vs. this league. */
export interface TimelineEntry {
  year: number;
  realChamp?: TeamId;
  realRunnerUp?: TeamId;
  realScore?: string;
  simChamp: TeamId;
  simRunnerUp: TeamId;
  simScore: string;
  user: {
    sim: { w: number; l: number; t: number };
    real?: { w: number; l: number; t: number };
    simPlayoffs: boolean;
    realPlayoffs?: boolean;
  };
  notes: string[];
}

/** A number the club put away for good. */
export interface RetiredNumber {
  n: number;
  playerId: string;
  year: number;
}

export interface RingOfHonorEntry {
  playerId: string;
  year: number;
}

export interface Almanac {
  timeline?: TimelineEntry[];
  /** By club: numbers nobody on that club can wear again. */
  retiredNumbers?: Record<string, RetiredNumber[]>;
  /** By club: its Ring of Honor. */
  ringOfHonor?: Record<string, RingOfHonorEntry[]>;
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
  /** Original records retained when repairing historical duplicate identities. */
  identityRepairs?: { keptId: string; originals: Player[] }[];
  /** The owner's offseason progression, shown at camp. */
  progression?: ProgressionReport;
  /** CPU clubs on the owner's line with trade offers. */
  calls?: TradeCall[];
  /** Free-agent bidding wars this offseason. */
  faBids?: FaBid[];
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
  primetimeArchive?: PrimetimeShow[];
  /** Last show's power ranks, for the week-to-week movement arrows. */
  powerRanks?: Record<string, number>;
  salaryCap: number | null;
  carousel: CarouselMove[];
  waiverOrder: TeamId[];
  waivers: WaiverWire[];
  faOpened: boolean;
  /** Regular / playoff week just simmed; stay on the film until Continue. */
  weekFilm?: boolean;
  camp?: CampReport;
  deadline?: DeadlineSession;
  /** Best single-game performance per team per stat category. Keyed "teamId:catId" — box scores don't survive compaction, so this is the only record of a game after its season ends. */
  teamGameRecords: Record<string, GameRecordEntry>;
  /** All-time single-season best per stat category, through last year. Lets the yearly milestone check compare against one cached number instead of rescanning every player's whole history every season. */
  bestSeasonMarks: Record<string, number>;
  /** The owner's side of the club: the crowd, the gate, and whether the city still wants you. */
  owner?: OwnerState;
  /** 2 = cap-era contracts priced off the cap (see salaryFor). */
  salaryModel?: number;
  /** All-time head-to-head between every pair of clubs, keyed "a|b" (sorted). */
  h2h?: Record<string, HeadToHead>;
  /** This season's expectations and the owner's goals; graded when the season ends. */
  seasonPlan?: SeasonPlan;
  /** Last season's graded plan (the report card). */
  lastPlan?: SeasonPlan;
  /** Dynasty trophy case. */
  achievements?: Achievement[];
  /** A crunch-time decision the owner owes before this week's game can finish. */
  crunch?: { gameId: string; choices: string[]; situation?: CrunchSituation; /** Play index of each answered call. */ at?: number[] };
  /** Owner setting: pause for crunch-time calls in close games (default on). */
  crunchOn?: boolean;
  /** The owner's sideline orders for this week's game (cleared when the week is done). */
  liveOrders?: LiveOrder[];
  /** Where the live broadcast picks back up after a crunch-time call. */
  liveResume?: { gameId: string; index: number };
  /** Owner preference: watch his games play out live. */
  liveOn?: boolean;
  /** Set once rosters carry era-accurate jersey numbers (older saves are reissued on load). */
  jerseyEra?: boolean;
  /** Set once player honors have been rebuilt from the award history (older saves). */
  honorsBackfilled?: boolean;
}

export type TicketTier = "value" | "standard" | "premium" | "gouge";
export type HomeClimate = "north" | "midwest" | "south" | "pacific" | "mountain" | "florida";

export interface OwnerLedgerYear {
  year: number;
  wins: number;
  losses: number;
  ties: number;
  support: number;
  avgCrowd: number;
  fill: number;
  gate: number;
  ticket: TicketTier;
}

/** Where the club plays when the owner has changed history: stayed put, or moved somewhere new. */
export interface HomeOverride {
  teamId: TeamId;
  from: number;
  city: string;
  nickname?: string;
  stadium: string;
  capacity: number;
  climate: HomeClimate;
  indoor: boolean;
  turf: boolean;
}

export interface RelocationOffer {
  year: number;
  city: string;
  stadium: string;
  capacity: number;
  climate: HomeClimate;
  indoor: boolean;
  pitch: string;
}

export interface OwnerState {
  /** 0-100. Wins, stars and fair prices build it; losing and gouging burn it. */
  support: number;
  ticket: TicketTier;
  /** This season's home gates so far. */
  homeGames: number;
  crowdTotal: number;
  capacityTotal: number;
  gate: number;
  /** Consecutive seasons with support in the danger zone. */
  threat: number;
  ledger: OwnerLedgerYear[];
  offer?: RelocationOffer;
  /** A real move of your own club is on the calendar; the owner decides. */
  historic?: { year: number; from: string; to: string };
  home?: HomeOverride;
  moves: { year: number; from: string; to: string }[];
}

export interface PrimetimeRecap {
  homeId: TeamId;
  awayId: TeamId;
  homeScore: number;
  awayScore: number;
  line: string;
  note: string;
  /** Round name in the postseason. */
  round?: string;
  /** "J. Unitas 22/31, 288 yds, 3 TD" style lines for the game's top performers. */
  performers?: string[];
}

export interface PrimetimeStory {
  headline: string;
  body: string;
  teamIds: TeamId[];
  playerIds: string[];
  tag: string;
}

export interface PrimetimeHonoree {
  playerId: string;
  name: string;
  pos: Pos;
  teamId: TeamId;
  line: string;
}

export interface PrimetimeLeaderBoard {
  label: string;
  rows: { playerId: string; name: string; teamId: TeamId; value: number }[];
}

export interface PrimetimeInjury {
  playerId: string;
  name: string;
  pos: Pos;
  teamId: TeamId;
  injury: string;
  weeks: number;
  ir: boolean;
  fresh: boolean;
}

export interface PrimetimePowerRow {
  teamId: TeamId;
  rank: number;
  prev?: number;
  record: string;
  blurb: string;
}

export interface PrimetimeOutlook {
  conf: string;
  seeds: { seed: number; teamId: TeamId; record: string; tag: string }[];
  bubble: { teamId: TeamId; record: string; back: number }[];
}

export interface PrimetimePreview {
  homeId: TeamId;
  awayId: TeamId;
  homeRecord: string;
  awayRecord: string;
  line: string;
  pick: TeamId;
  note: string;
  /** All-time series and last meeting, from the head-to-head book. */
  series?: string;
  last?: string;
  when: string;
  featured: boolean;
}

export interface PrimetimeShow {
  /** Frozen editorial rundown: never reads future results while replaying an episode. */
  episode?: {
    id: string;
    edition: "weekly" | "seasonFinale" | "playoffs" | "championship" | "superBowl" | "awards";
    headline: string;
    subtitle: string;
    chapters: { id: string; kicker: string; title: string; teamIds: TeamId[]; lines: { speaker: "HOST" | "ANALYST" | "REPORTER"; text: string }[] }[];
    focusIds: string[];
  };
  /** 2 = the full broadcast (older saves carry the one-card version). */
  v?: number;
  year: number;
  week: number;
  kind?: "regular" | "playoffs" | "superBowl" | "awards";
  title?: string;
  open: string;
  stories?: PrimetimeStory[];
  recaps: PrimetimeRecap[];
  playOfNight: string;
  potw?: { conf: string; off?: PrimetimeHonoree; def?: PrimetimeHonoree }[];
  leaders?: PrimetimeLeaderBoard[];
  injuries?: PrimetimeInjury[];
  power?: PrimetimePowerRow[];
  outlook?: PrimetimeOutlook[];
  predictions?: { conf: string; teamId: TeamId; note: string }[];
  superBowlPick?: { winner: TeamId; loser: TeamId; score: string; note: string };
  previews?: PrimetimePreview[];
  awards?: { label: string; honoree: PrimetimeHonoree }[];
  allPro?: PrimetimeHonoree[];
  /** Records and career marks within reach. */
  chases?: { playerId: string; name: string; teamId: TeamId; text: string }[];
  /** Awards night: the owner's report card and this year's trophy-case entries. */
  reportCard?: SeasonPlan;
  /** Awards night: this season against real history. */
  timeline?: TimelineEntry;
  /** Trade-deadline weeks: who's buying, who's selling, who wants out. */
  rumors?: Rumor[];
  achievements?: Achievement[];
  pow: string;
  powerPoll: string;
  wire: string[];
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
