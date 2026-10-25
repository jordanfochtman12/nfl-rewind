/** NFL Rewind engine types. No React. */

export const SAVE_VERSION = 28;
export const STARTING_YEAR = 1966;
export const END_YEAR = 2040;
export const ROSTER_TARGET = 45;
export const HOF_WAIT_YEARS = 5;
export const COACH_HOF_WAIT_YEARS = 1;

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
  | "preDraft"
  | "freeAgency"
  | "expansion"
  | "preseason"
  | "regular"
  | "waivers"
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
  /** History mode: stats the record didn't keep that season (shown as —, never as 0). */
  unknown?: string[];
  /** History mode: a running total from this season's box scores, replaced by the official line at season's end. */
  live?: boolean;
  /** His overall at the end of this season (kept from the first season the game rated him). */
  ovr?: number;
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
  /** Successful two-point conversions scored by this player. */
  twoPtMade: number;
  /** Individual safeties credited by the official scoring rules. */
  safeties: number;
  punts: number;
  puntYds: number;
  krYds: number;
  prYds: number;
  targets: number;
  tfl: number;
  pd: number;
  qbHits: number;
  fr: number;
  /** Defensive touchdowns credited on an interception, fumble, or blocked-kick return. */
  defTd: number;
  krTd: number;
  prTd: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  pos: Pos;
  /** A safety's job, free or strong, where the record names it (shown, not played: see posLabel). */
  role?: "FS" | "SS";
  teamId: TeamId | "fa" | "retired" | "hof";
  ratings: Ratings;
  ovr: number;
  /** Noisy pre-draft / unrevealed grade. Sim always uses `ovr`. */
  scoutOvr: number;
  /** Developmental ceiling. */
  potential: number;
  /** Mood, 0-100: drifts weekly toward the player's situation (see morale.ts). */
  morale: number;
  /** True kit is hidden until snaps / years. */
  revealed: boolean;
  /** Games with a box-score line. */
  snaps: number;
  age: number;
  yearsPro: number;
  jersey: number;
  /** The number he wants: what he wore coming out of school (real rookies: the one he really took). */
  collegeNo?: number;
  /**
   * The number the record has him wearing (a season's real roster, his real rookie number, the
   * 1966 roster). It stands even where the year's position bands say otherwise: long snappers in
   * the 40s, a kicker in 2021's new numbers, a tackle listed at tight end still in his 71.
   */
  recordNo?: number;
  college?: string;
  hometown?: string;
  /** A sleeper who grows fast toward his ceiling (the owner's own class). */
  gem?: boolean;
  heightIn?: number;
  weight?: number;
  forty?: number;
  /** Combine (or pro-day) numbers; satOut when he skipped the drills. */
  /** How the draft room reacted when he was picked: by the board then, not by what he became. */
  draftBuzz?: "cheered" | "booed" | "mixed";
  combine?: { forty?: number; bench?: number; vertical?: number; cone?: number; satOut?: boolean; proDay?: boolean };
  historical: boolean;
  generated: boolean;
  /**
   * Out of a scouts-built draft class past the real record. Made up, but one of the league's
   * own players from then on: the market treats him like a real player, not a camp body.
   */
  classOf?: boolean;
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
  /** The club that last released him, and when (a computer club doesn't bring back a man it just cut). */
  releasedBy?: { year: number; teamId: TeamId };
  /** The season a computer club's staff benched him for his play (he has to win the job back). */
  benchedYear?: number;
  /** When the current injury happened (for the weekly injury report). */
  injuredOn?: { year: number; week: number; phase: Phase };
  /** Parked off the 53-man count by a desk decision; frees a roster spot while hurt. */
  onIR: boolean;
  /**
   * Historical career evidence used as the initial talent/development prior. Dynasty and Watch
   * simulations may diverge; this does not force a rating path or retirement.
   */
  arc?: { dy: number; to: number; st: number; g: number; pb: number; ap: number; age: number };
  /** Dynasty-only, persistent evidence about this player's simulated development path. */
  careerDevelopment?: {
    growth: number;
    regression: number;
    breakoutEvidence: number;
    breakoutWeeks: number;
    workload: number;
    weeks: number;
    keyCursor: number;
    lastTick?: string;
  };
  stats: Record<number, SeasonStats>;
  career: SeasonStats[];
  /** Exact dynasty/Watch full-pay service by season; absent on older and real-history saves. */
  serviceByYear?: Record<number, PlayerServiceYear>;
  /** The round history actually took him in (real draftees), for draft retrospectives. */
  realRound?: number;
  /** The owner graded him (scripts/qb-grades.json): how far below his peak he arrives on draft day. */
  arcGap?: number;
  /** The club that drafted him in this dynasty. */
  draftTeam?: TeamId;
  /** History mode's recorded final season; dynasty retirement is not forced by this date. */
  finalSeason?: number;
  /** Holding out for a new contract; misses games until the owner pays him. */
  holdout?: boolean;
  /** The season he asked his club for a trade. */
  tradeRequest?: number;
  /** Weeks in a row a star has been miserable. */
  moraleLow?: number;
  /** A mood the owner's call left him with (ownerDesk.ts), held until `until` (year*100+week). */
  moodNote?: { text: string; delta: number; until: number };
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

/** Regular-season full-pay game weeks with a club; stored separately from games played. */
export interface PlayerServiceYear {
  fullPayGames: number;
  /** Week numbers make weekly season advancement idempotent across reload/retry paths. */
  weeks: number[];
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
export type ScoutBudget = "low" | "standard" | "high";
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
  /** Seasons he was named Coach of the Year. */
  coyYears?: number[];
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
  /** Seasons on each club's staff (head-coach seasons count double), for the club he's most tied to. */
  tenure?: Record<string, number>;
  /** The owner rewrote this coach's scheme at the desk; keep it over his real one. */
  schemeLocked?: boolean;
  retiredYear?: number;
  hofYear?: number;
  /** Seasons on each head coach's staff, by that coach's id (the coaching tree). */
  mentors?: Record<string, number>;
  /** History mode: his record here only counts from this season (he was coaching before 1966). */
  recordFrom?: number;
  /** The season the papers put him on the hot seat. */
  hotSeat?: number;
  /** Interim head coach this season, and the club's record when he took over. */
  interimYear?: number;
  interimFrom?: { w: number; l: number };
  /** His deal with the club he coaches for (coachContracts.ts): seasons left counting the one it's in. */
  contract?: { teamId: TeamId; role: CoachRole; years: number; salary: number; signed: number };
}

/** One winter's coaching cycle: who was cut on Black Monday, the hot names, who talked to whom. */
export interface CoachSearch {
  year: number;
  /** Black Monday has been decided. */
  monday?: boolean;
  /** Clubs that fired their head coach on Black Monday. */
  cuts: TeamId[];
  /** The coaches everyone wants to talk to, best first. */
  hot: string[];
  interviews: { coachId: string; teamId: TeamId }[];
  /** Head coaches fired during the season. */
  midseason: number;
  /** A league begun from the record: the coach each club really hired this winter (eraStart.ts). */
  real?: Partial<Record<TeamId, string>>;
  /** A league begun from the record: clubs whose coach the record kept, safe from Black Monday. */
  keep?: TeamId[];
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
  /** Locker-room chemistry, 0-100, updated weekly (see morale.ts). */
  chemistry?: number;
  /** A tone the owner set for the whole room (ownerDesk.ts), held until `until` (year*100+week). */
  roomNote?: { text: string; delta: number; until: number };
  /** Regular-season record across the dynasty. Not reset in training camp. */
  careerWins: number;
  careerLosses: number;
  careerTies: number;
  /** Legacy stored call sheet; the live one comes from the staff (see planFor). */
  plan?: Gameplan;
  /** The owner's own changes to his staff's call sheet (owner's club only). */
  planEdits?: Partial<Gameplan>;
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
  twoPtMade?: number;
  safeties?: number;
  punts?: number;
  puntYds?: number;
  sacksThrown?: number;
  /** Yards lost on sacks; used to calculate net passing yards for the team. */
  sackYdsLost?: number;
  /** Game-box detail: kneels count as rush attempts but do not credit a defensive tackle. */
  kneels?: number;
  ff?: number;
  krYds?: number;
  prYds?: number;
  targets?: number;
  tfl?: number;
  pd?: number;
  qbHits?: number;
  fr?: number;
  defTd?: number;
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
  /** Watch mode: this was the week's featured broadcast, so its play-by-play is kept. */
  featured?: boolean;
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
  /** The owner's game: the one-on-ones the broadcast followed (see gameday.ts). */
  matchups?: {
    kind: "wr-cb" | "lt-edge" | "rb-lb";
    teamId: TeamId;
    offId: string;
    defId: string;
    offGrade: number;
    defGrade: number;
    /** Actual sim events involving this featured pair; absent on older saves. */
    result?: {
      targets?: number;
      receptions?: number;
      receivingYards?: number;
      receivingTds?: number;
      interceptions?: number;
      dropbacks?: number;
      pressures?: number;
      sacks?: number;
      carries?: number;
      rushingYards?: number;
      stops?: number;
    };
  }[];
  /** The owner's practice focus that week, when he set one. */
  practice?: "runD" | "passPro" | "ballSecurity" | "redZone";
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
  /** A broadcast cue on top of the play: an injury, a momentum swing, the crowd, a rule, a matchup. */
  cue?: "inj" | "momentum" | "crowd" | "rule" | "matchup" | "story" | "record" | "drive";
  /** Momentum after the play, from the home side, -3 to 3. */
  mo?: number;
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
  /** How hot the series is, as of heatYear: close games and playoff meetings build it, time cools it. */
  heat?: number;
  heatYear?: number;
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
  /** Coach of the Year (a coach id). */
  coy?: string;
  allPro: string[];
  /** History mode: co-winners beyond the first, by award field (1997 MVP: Favre and Sanders). */
  co?: Record<string, string[]>;
  /** History mode: the real Coach of the Year, by name. */
  coyName?: string;
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
  /** History mode: a coach, contributor or pre-1966 player known by name only. */
  name?: string;
  year: number;
  teamId: TeamId;
  blurb: string;
  kind?: "player" | "coach" | "contributor";
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

export type RfaTenderLevel = "firstAndThird" | "first" | "second" | "original" | "rofr";

/** A qualifying offer and the draft compensation it secures if the club declines to match. */
export interface RfaTender {
  year: number;
  playerId: string;
  teamId: TeamId;
  level: RfaTenderLevel;
  salary: number;
  compensationRound?: number;
  /** Multi-round compensation was added in v27; old saves keep using compensationRound. */
  compensationRounds?: number[];
}

/** Exclusive-rights minimum-salary offer that retains a player with fewer than three accrued seasons. */
export interface ErfaTender {
  year: number;
  playerId: string;
  teamId: TeamId;
  salary: number;
  creditedSeasons: number;
}

/** A signed outside offer sheet awaiting the original club's right-of-first-refusal decision. */
export interface RfaOfferSheet {
  id: string;
  year: number;
  playerId: string;
  originalTeam: TeamId;
  offerTeam: TeamId;
  salary: number;
  years: number;
  compensationRound?: number;
  compensationPickId?: string;
  /** Multi-round compensation was added in v27; old saves keep using the singular fields. */
  compensationRounds?: number[];
  compensationPickIds?: string[];
  status: "pending" | "matched" | "signed";
  result?: string;
}

/** Talks with one of the owner's expiring players, open until free agency starts. */
export interface Negotiation {
  playerId: string;
  year: number;
  /** The agent's asking price per year, and how long he wants. */
  ask: number;
  askYears: number;
  /** What the agent says about the number. */
  pitch: string;
  /** Rounds of talks left before he decides to test the market. */
  patience: number;
  status: "open" | "signed" | "walked" | "tagged" | "tendered" | "option" | "staff" | "gone";
  /** Cap-era RFA eligibility at the league-year deadline. */
  accruedSeasons?: number;
  /** One-year qualifying offer placed by the original club. */
  rfaTender?: { level: RfaTenderLevel; salary: number };
  /** ERFA tender removes the player's ability to negotiate with another club. */
  erfaTender?: { salary: number; creditedSeasons: number };
  rounds: { salary: number; years: number; reply: string; tone: "yes" | "counter" | "no" | "insult" }[];
  counter?: { salary: number; years: number };
  /** Private: the least he'll take, before years are weighed in. */
  floor: number;
  result?: string;
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
  /** Free-agency recaps, filed when each winter's market closes (last dozen kept). */
  faRecaps?: Record<number, import("./faRecap.ts").FaRecap>;
  /** Original records retained when repairing historical duplicate identities. */
  identityRepairs?: { keptId: string; originals: Player[] }[];
  /** The owner's contract talks this offseason. */
  talks?: Negotiation[];
  /** The league year the owner last used the franchise tag. */
  tagYear?: number;
  /** The desk's preseason calls, frozen at kickoff. */
  previewPicks?: PreviewPicks;
  /** Season-long storylines the studio follows week to week (see arcs.ts). */
  arcs?: StoryArc[];
  /** The owner's offseason progression, shown at camp. */
  progression?: ProgressionReport;
  /** CPU clubs on the owner's line with trade offers. */
  calls?: TradeCall[];
  /** The owner's in-season calls: dilemmas on the desk and how they were answered. */
  decisions?: OwnerDecision[];
  /** Free-agent bidding wars this offseason. */
  faBids?: FaBid[];
  /** Restricted free-agent tenders and signed outside offers awaiting the original club's call. */
  rfaTenders?: RfaTender[];
  rfaOfferSheets?: RfaOfferSheet[];
  erfaTenders?: ErfaTender[];
  version: number;
  startingYear: number;
  /** A league begun from the record (eraStart.ts): each winter it signs that season's real free agents from it. */
  realPool?: boolean;
  /**
   * A league begun from the record: who really opened that first season with each club
   * (player id -> club). Through that season's cuts they keep their spots unless a cut can't be
   * avoided; the rookies the club really kept are in it too, for when the draft hands them over.
   */
  openingRoster?: { year: number; keep: Record<string, TeamId> };
  /** Loaded from disk without its record players' real seasons before this year: they come back from the record (restoreRecordLines). */
  recordLinesBefore?: number;
  year: number;
  week: number;
  phase: Phase;
  weekLabel: string;
  userTeamId: TeamId;
  /** League Architect: select a club at a time while controlling any front office in the league. */
  leagueSandbox?: boolean;
  /** Per-club CPU assignments. True means the computer handles that responsibility. */
  leagueControl?: Partial<Record<TeamId, Partial<Record<TeamManagementJob, boolean>>>>;
  seed: number;
  rng: number;
  cpuOnly: boolean;
  /**
   * Watch mode: no club of the owner's, the computer runs all of them, and the broadcast
   * follows the whole league (one featured game a week gets the live call).
   */
  sandbox?: boolean;
  /** The owner's scouting department this draft season (see scouting.ts). */
  scouting?: { year: number; budget: ScoutBudget; visits: string[] };
  /** History mode: the real league, replayed from the record (see historyMode.ts). */
  realHistory?: boolean;
  /** History mode: steps taken from the 1966 draft. The record replays to here on load. */
  historyStep?: number;
  /** History mode: each franchise's all-time ledger (from 1920): wins, losses, ties, playoff wins, playoff losses, titles. */
  historyLedger?: Record<string, [number, number, number, number, number, number[]]>;
  /** History mode: the clubs and players the viewer follows. */
  historyFollow?: { teams: TeamId[]; players: string[] };
  /** History mode: the viewer's calls before the results: game id -> winner, "sb:YYYY" -> club, "mvp:YYYY" -> player id. */
  historyCalls?: Record<string, string>;
  /** History mode: graded calls, id -> [season, right (1) or wrong (0)], in calendar order. Rebuilt on replay. */
  historyGraded?: Record<string, [number, 0 | 1]>;
  /** Sandbox: the game of the week that gets the play-by-play call. */
  featuredGameId?: string;
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
  /** Past seasons' notable moves, kept when the live transaction log is trimmed (transactions.ts). */
  txArchive?: Record<number, Transaction[]>;
  waiverOrder: TeamId[];
  waivers: WaiverWire[];
  faOpened: boolean;
  /** New offseason markets open before the draft; absent legacy saves retain their current order. */
  marketBeforeDraft?: boolean;
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
  coachSearch?: CoachSearch;
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
  /** Game week: the one thing the owner's staff drills for his next game. */
  practice?: { gameId: string; focus: "runD" | "passPro" | "ballSecurity" | "redZone" };
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

export type OwnerDecisionKind = "extension" | "rift" | "curfew" | "hurt" | "fans" | "community";

/** A dilemma on the owner's desk between Sundays (ownerDesk.ts). */
export interface OwnerDecision {
  id: string;
  year: number;
  week: number;
  kind: OwnerDecisionKind;
  title: string;
  body: string;
  teamIds: TeamId[];
  playerIds: string[];
  /** The last option is the quiet one, taken if the call is left on the desk. */
  options: { id: string; label: string; hint: string }[];
  status: "open" | "done";
  chosen?: string;
  outcome?: string;
  /** An extension's asking salary. */
  ask?: number;
  /** A star who played hurt and is going to pay for it after the game. */
  later?: { playerId: string; weeks: number };
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

/** One club in the season preview: the projection, the grades, the case for and against. */
export interface PreviewTeam {
  id: TeamId;
  rank: number;
  tier: "Contender" | "Playoff hopeful" | "In the mix" | "Long shot" | "Rebuilding";
  projW: number;
  projL: number;
  /** 10th to 90th percentile of simulated wins. */
  range: [number, number];
  playoffPct: number;
  divisionPct: number;
  titlePct: number;
  confPct: number;
  division: string;
  divFinish: number;
  lastYear: { w: number; l: number; t: number; playoffs?: boolean };
  grades: { key: "QB" | "Skill" | "Line" | "Front" | "Secondary" | "Coaching"; grade: string; pct: number }[];
  qbId?: string;
  coach?: string;
  newCoach?: boolean;
  stars: string[];
  xFactorId?: string;
  newcomers: string[];
  departures: string[];
  sosRank: number;
  toughStretch?: string;
  opener?: string;
  outlook: string;
  bestCase: string;
  worstCase: string;
  verdict: string;
}

export interface PreviewPick {
  playerId?: string;
  coachId?: string;
  teamId: TeamId;
  odds: string;
  note: string;
}

/** The preseason special: the whole league, club by club, and every call the desk makes. */
export interface SeasonPreview {
  year: number;
  teams: PreviewTeam[];
  divisions: { key: string; conf: string; order: TeamId[]; note: string }[];
  awards: { label: string; picks: PreviewPick[] }[];
  superBowl: { winner: TeamId; loser: TeamId; score: string; note: string; confidence: number };
  confChamps: { conf: string; teamId: TeamId; note: string }[];
  storylines: { id: string; kicker: string; title: string; body: string; teamIds: TeamId[]; playerIds: string[] }[];
  bold: { text: string; teamIds: TeamId[] }[];
  mustWatch: { gameId: string; week: number; homeId: TeamId; awayId: TeamId; line: string; note: string }[];
  rookies: { playerId: string; teamId: TeamId; note: string }[];
  breakouts: { playerId: string; teamId: TeamId; note: string }[];
  lastRide: { playerId: string; teamId: TeamId; note: string }[];
  hotSeat: { coachId: string; teamId: TeamId; note: string }[];
  milestones: { playerId: string; teamId: TeamId; note: string }[];
  rules?: string;
  history?: string;
  yours: { teamId: TeamId; headline: string; lines: string[]; keys: string[]; concerns: string[] };
  /** This year's desk: it changes with the decades. */
  cast: Record<"HOST" | "ANALYST" | "REPORTER", { name: string; role: string; tenure: number; gender?: "m" | "f" }>;
  /** Rotating features: a different handful every season. */
  features: {
    id: string;
    kicker: string;
    title: string;
    intro: string;
    rows: { teamId?: TeamId; playerId?: string; label: string; value?: string; note?: string }[];
  }[];
  /** Last year's picks, held up to the light. */
  receipts?: { headline: string; lines: string[] };
  episode: NonNullable<PrimetimeShow["episode"]>;
}

/** Frozen at kickoff so the awards show can grade the desk's preseason calls. */
export interface StoryArc {
  id: string;
  year: number;
  kind: "rookie" | "collapse" | "surprise" | "race" | "mvp";
  title: string;
  opened: number;
  playerId?: string;
  teamId?: TeamId;
  teamIds?: TeamId[];
  /** The preseason projection a collapse or a surprise is measured against. */
  projW?: number;
  beats: { week: number; text: string; short: string; metric: number }[];
  closed?: boolean;
  /** The last week the studio aired it, so a story isn't on every single show. */
  aired?: number;
}

export interface PreviewPicks {
  year: number;
  superBowl: { winner: TeamId; loser: TeamId };
  divisions: { key: string; teamId: TeamId }[];
  awards: { label: string; playerId?: string; coachId?: string }[];
  projW: Record<string, number>;
}

export interface PrimetimeShow {
  /** Frozen editorial rundown: never reads future results while replaying an episode. */
  episode?: {
    id: string;
    edition: "weekly" | "seasonFinale" | "playoffs" | "championship" | "superBowl" | "awards" | "seasonPreview";
    /** Named crew for this edition (the season preview has one). */
    cast?: Partial<Record<"HOST" | "ANALYST" | "REPORTER", { name: string; role: string; gender?: "m" | "f" }>>;
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
  /** The week's Top 5 plays, best first (weekReel.ts). */
  reel?: import("./weekReel.ts").ReelMoment[];
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
  /** Awards night: how the preseason picks held up. */
  deskGrade?: { headline: string; grade: string; hits: string[]; misses: string[] };
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
  /** Watch mode: implies cpuOnly, keeps the broadcast and steps one moment at a time. */
  sandbox?: boolean;
  /** League Architect: a playable league with per-team CPU delegation. */
  leagueSandbox?: boolean;
}

export type TeamManagementJob = "roster" | "contracts" | "trades" | "staff" | "depthChart" | "gameplan" | "draft";

export interface AdvanceOpts {
  auto?: boolean;
  userPickPlayerId?: string;
  /** CPU picks until the user is on the clock (or the draft ends). */
  simToUser?: boolean;
  /** Close the free-agent market and advance to the pre-draft show or camp. */
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
