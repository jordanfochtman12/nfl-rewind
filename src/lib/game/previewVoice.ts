/**
 * The voice of the season preview. The desk changes with the decades the way a real network's
 * does, every phrase comes from a pool large enough to go years without repeating, and the
 * picker never makes the same choice two seasons running.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A phrase for this slot this year. Stepping the index by the year (with a stride coprime to
 * the pool size) guarantees a different choice from last season's in the same slot.
 */
export function vary<T>(key: string, year: number, list: readonly T[]): T {
  const n = list.length;
  if (n <= 1) return list[0]!;
  let stride = (hash(key + "s") % (n - 1)) + 1;
  while (gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  return list[(hash(key) + year * stride) % n]!;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/* ------------------------------------------------------------------ the desk */

export interface CrewMember {
  name: string;
  role: string;
  /** Who's on the air, so the broadcast casts a voice that matches. */
  gender: "m" | "f";
  /** Short spoken tics that make him or her sound like one person. */
  tics: string[];
  since: number;
}

export interface Crew {
  HOST: CrewMember;
  ANALYST: CrewMember;
  REPORTER: CrewMember;
  signoff: string[];
}

const HOSTS: (CrewMember & { until: number; signoff: string[] })[] = [
  {
    name: "Walt Prescott", gender: "m",
    role: "Host",
    since: 1966,
    until: 1979,
    tics: ["Gentlemen,", "Now then.", "Let's have a look.", "Mark it down."],
    signoff: ["That's our preview. Good night, and good football.", "So ends the preview. The games begin Sunday. Good night.", "We'll see you from the stadium. Good night, everybody."],
  },
  {
    name: "Rich Delaney", gender: "m",
    role: "Host",
    since: 1980,
    until: 1999,
    tics: ["Here's the thing.", "Let's get to it.", "Stay with me here.", "Big picture:"],
    signoff: ["That's the preview. Enjoy the season, everybody.", "That's our show. Kickoff is close. We'll see you Sunday.", "The picks are in. Now let's go play. See you on Sunday.", "Buckle up. It's going to be a ride. Good night."],
  },
  {
    name: "Kara Lindqvist", gender: "f",
    role: "Host",
    since: 2000,
    until: 2014,
    tics: ["Okay.", "Let's be honest.", "Real quick:", "Here's where it gets interesting."],
    signoff: ["That's the season preview. We're back Sunday morning, live.", "Save the picks. We'll grade them in February. Good night.", "The season starts now. Thanks for watching."],
  },
  {
    name: "Jalen Reyes", gender: "m",
    role: "Host",
    since: 2015,
    until: 9999,
    tics: ["Let's run it.", "Quick reset:", "Real talk:", "I'll say this:"],
    signoff: ["That's the preview. Week one, let's go.", "Lock in. We'll see you on Sunday.", "Screenshot the picks. We'll see who was right."],
  },
];

const ANALYSTS: (CrewMember & { until: number })[] = [
  { name: "Hank “Bull” Mullins", gender: "m", role: "Analyst · 12 seasons, guard", since: 1966, until: 1975, tics: ["In my day,", "Football's a simple game.", "Block and tackle, Walt.", "I'll tell you plainly:"] },
  { name: "Marcus “Hammer” Boyd", gender: "m", role: "Analyst · 11 seasons, linebacker", since: 1976, until: 1990, tics: ["Hold onto something.", "I've been in that huddle.", "That's grown-man football.", "Put it on film."] },
  { name: "Tony Vance", gender: "m", role: "Analyst · 14 seasons, quarterback", since: 1991, until: 2005, tics: ["From the pocket, here's what I see:", "Quarterbacks win in this league.", "Read the coverage, Rich.", "I'll take my chances with that."] },
  { name: "Darius Cole", gender: "m", role: "Analyst · 10 seasons, cornerback", since: 2006, until: 2016, tics: ["On an island, you learn things.", "That's a matchup problem.", "Trust the tape.", "I'm not buying it."] },
  { name: "Brooke Hensley", gender: "f", role: "Analyst · former personnel director", since: 2017, until: 9999, tics: ["I've graded these players.", "The tape says otherwise.", "Value over name.", "Process over results."] },
];

const REPORTERS: (CrewMember & { until: number })[] = [
  { name: "Bob Kessler", gender: "m", role: "Wire service, league beat", since: 1966, until: 1984, tics: ["From the press box,", "A man in the front office tells me", "Word on the wire is", "My notebook says"] },
  { name: "Dana Whitfield", gender: "f", role: "League insider", since: 1985, until: 2009, tics: ["I'm told", "People around the club tell me", "Talking to the staff this week,", "Sources say"] },
  { name: "Sam Ortiz", gender: "m", role: "National insider", since: 2010, until: 9999, tics: ["Per league sources,", "I'm hearing", "Two people in the building told me", "From my reporting,"] },
];

/** Everyone who has worked the desk, for looking a name back up (older saves stored names only). */
export function crewGender(name: string): "m" | "f" | undefined {
  return [...HOSTS, ...ANALYSTS, ...REPORTERS].find((c) => c.name === name)?.gender;
}

const onDesk = <T extends { since: number; until: number }>(list: T[], year: number) => list.find((c) => year >= c.since && year <= c.until) ?? list[list.length - 1]!;

export function crewFor(year: number): Crew {
  const h = onDesk(HOSTS, year);
  return { HOST: h, ANALYST: onDesk(ANALYSTS, year), REPORTER: onDesk(REPORTERS, year), signoff: h.signoff };
}

/** "my twelfth preview on this desk" */
export function tenure(m: CrewMember, year: number): number {
  return year - m.since + 1;
}

export const ORD_WORDS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];

/* ------------------------------------------------------------------ the decade */

/** A line of era color for the open: how the game looks this decade. */
export function eraColor(year: number): string[] {
  if (year < 1970)
    return [
      "Two leagues, one championship game, and a whole lot of pride on the line.",
      "The AFL says it belongs. The NFL says prove it.",
      "Ground and pound, play-action on second down, and hope the weather holds.",
    ];
  if (year < 1978)
    return [
      "Defense rules this decade. Points are expensive.",
      "Fourteen games, short passes, and the best defenses the sport has ever seen.",
      "Grind it out. Field position wins in this era.",
    ];
  if (year < 1990)
    return [
      "The rules opened up the passing game, and the quarterbacks noticed.",
      "Sixteen games and offenses that finally get to throw it around.",
      "The air show is here. Defenses are still figuring it out.",
    ];
  if (year < 2002)
    return [
      "The salary cap and free agency mean nobody stays the same for long.",
      "Rosters turn over every spring now. Chemistry is a skill.",
      "West Coast passing, zone blitzes, and a league with real parity.",
    ];
  if (year < 2014)
    return [
      "Thirty-two teams, eight divisions, and a passing game that never sleeps.",
      "Quarterbacks are throwing for numbers we used to call impossible.",
      "Spread it out, protect the passer, and score in bunches.",
    ];
  return [
    "Analytics on the sideline, fourth downs are for going for, and the ball is in the air.",
    "Every snap is charted, every decision second-guessed.",
    "The modern game: tempo, space, and quarterbacks who can do everything.",
  ];
}

/* ------------------------------------------------------------------ phrase pools */

export const P = {
  hello: [
    "Good morning, everybody, and welcome in.",
    "Welcome in, everybody. Pull up a chair.",
    "Hello again, everybody, and welcome to the season.",
    "It's that time. Welcome, everybody.",
    "Here we go, everybody. Welcome in.",
    "The wait is over. Welcome to the show.",
    "Good evening, and welcome to the one night a year we get to be right about everything.",
    "Welcome back, everybody. The offseason is officially over.",
  ],
  promise: [
    "We've watched the film, we've run the numbers two thousand times, and we're putting our picks on the record.",
    "Two thousand simulated seasons, a summer of film and three opinions that don't always agree. Let's go.",
    "We'll go division by division, name names and make picks we'll have to live with in February.",
    "Every club, every division, and a Super Bowl pick before we sign off.",
    "Projections, predictions and a few arguments. That's the plan.",
    "We crunched the numbers so you don't have to, and then we ignored some of them.",
  ],
  firstTake: [
    "I've been waiting all summer for this.",
    "I've got some takes today.",
    "Camp's over. Now it counts.",
    "I came to argue.",
    "Let me start with the obvious.",
    "Everybody's undefeated in August.",
    "I've seen enough camp tape to fill a library.",
    "This is my favorite day of the year.",
  ],
  favorite: [
    "The favorite on paper is the {T}: {P} to win it all.",
    "Start at the top. The {T} win the whole thing {P} of the time in our simulations.",
    "If you're asking who the team to beat is, it's the {T}. {P} to win the title.",
    "The {T} are the favorite, {P}, and it isn't especially close.",
    "Nobody's better on paper than the {T}. {P} to raise the trophy.",
  ],
  favoriteWide: ["But that also means the field wins it most years.", "Which is another way of saying anybody can get hot in January.", "Wide open. I love it.", "That's not a dynasty. That's a favorite."],
  favoriteNarrow: ["That's a team that knows exactly what it is.", "That's as big a favorite as you'll see in this league.", "Everyone else is playing for second.", "I don't see a weakness. Find me one."],
  storyReply: [
    "I'll tell you what I'm watching: the first three weeks. You find out who you are early.",
    "Talk is cheap in August. Show me in October.",
    "Momentum from last year doesn't carry over. You build it again from scratch.",
    "This is the storyline that'll define the first half of the season.",
    "That locker room will tell you everything by week four.",
    "Everybody wants to talk about it now. Let's talk about it in December.",
    "I don't care what the roster says. I care how they handle the first loss.",
    "Pressure is a privilege. Let's see who wants it.",
    "That's the one I'd be nervous about if I were in that building.",
    "You can't fake it in this league for seventeen weeks. Somebody gets exposed.",
  ],
  divOpen: ["{D}.", "On to the {D}.", "The {D}.", "Next up, the {D}.", "Let's do the {D}.", "Over to the {D}."],
  divTight: ["Too close to call.", "A two-horse race.", "This one goes down to December.", "Flip a coin.", "Neck and neck.", "This is the best race in football."],
  divClear: ["Not a lock, but the clear favorite.", "The favorite, and it isn't close.", "Everyone else is chasing.", "The class of the division."],
  divLock: ["The rest are playing for a wild card.", "Book the home playoff game.", "Pencil it in. In pen.", "The division title is theirs to lose."],
  disagree: [
    "I'm going the other way.",
    "Not so fast.",
    "Respectfully, no.",
    "I'll give you the numbers. I won't give you the pick.",
    "I'm going to be the contrarian on this one.",
  ],
  agree: ["No argument here.", "Same pick.", "Can't fight it.", "I'm with you.", "The numbers and the tape agree."],
  reporterCamp: [
    "{P} has been the story of camp for the {T}.",
    "the {T} can't stop talking about {P}.",
    "{P} has opened eyes for the {T} all month.",
    "the {T} think {P} is ready for a bigger role.",
    "{P} won the camp battle the {T} cared most about.",
  ],
  awardOpen: ["{A}.", "On the awards board: {A}.", "{A}. The odds.", "Let's talk {A}."],
  awardValue: ["Value is value.", "That's where the money is.", "Remember I said it.", "Write it down.", "That's my sleeper.", "Don't say I didn't tell you."],
  boldIntro: ["Bold predictions. On the record.", "Time to get ourselves in trouble.", "Hot takes, served cold in February.", "Five calls we may regret."],
  sbIntro: ["All right. The pick.", "The big one.", "Here it is.", "Moment of truth.", "Let's settle it."],
  sbBack: ["That's my champion.", "Book it.", "I'll stand on it.", "Print it.", "That's the call."],
  odds: [
    "For what it's worth, our two thousand simulations agree: the {T} win it {P} of the time.",
    "The computer is with us. The {T} win it in {P} of the runs.",
    "Our model has the {T} at {P} to win it all. The best number on the board.",
  ],
  upset: ["Which means most of the time, somebody proves us wrong.", "So the field is still the favorite. That's football.", "Respect the chaos."],
  receiptsGood: ["We'll take a bow on that one.", "Not bad for a bunch of people in suits.", "We'll be insufferable about it."],
  receiptsBad: ["Let's not dwell on it.", "We've been worse. Not much worse.", "Humbling. We're back anyway.", "That one still stings."],
  outlookStart: ["It starts with", "Everything here runs through", "The case begins with", "Start with", "The foundation is", "Build the case around", "This team leans on", "The strength is"],
  outlookUp: [
    "Our simulations see a jump of a few wins.",
    "The talent caught up with the expectations.",
    "Healthy, deeper and better, they should climb.",
    "Two thousand simulations say this club takes a real step forward.",
    "The numbers like this team a lot more than last year's record does.",
    "Last year's record undersells this roster.",
    "Better than you think. A lot better.",
    "The arrow is pointing straight up.",
    "This is the year it comes together.",
  ],
  outlookDown: [
    "The roster got thinner while the record stayed shiny.",
    "Expect a few more losses this time around.",
    "The simulations aren't buying a repeat of that record.",
    "Last year's record looks like the ceiling, not the floor.",
    "Some of last year's wins were borrowed. Payment comes due.",
    "Regression is coming, and it doesn't knock.",
    "Close games went their way last year. That rarely lasts.",
    "Don't fall for last year's record.",
    "Something has to give, and it's the win total.",
  ],
  outlookFlat: [
    "Expect something close to last year.",
    "This is who they are, give or take a bounce.",
    "Steady, if not spectacular.",
    "Same team, same range.",
    "Consistent, for better or worse.",
    "There's no reason to expect a big change.",
    "Last year's record is about right for this roster.",
    "The numbers say they'll land about where they did.",
    "A carbon copy of last season looks likely.",
    "Running it back, and the results should look familiar.",
    "No leap, no collapse: more of the same.",
    "Their identity hasn't changed and neither should the win total.",
  ],
  contender: [
    "A Super Bowl or bust kind of year.",
    "Anything short of January is a failure.",
    "The roster is built to win now. So win now.",
    "The window is open. Climb through it.",
    "They know what they are. Champions or bust.",
    "Talent isn't the question. Health might be.",
    "This is a team with nothing left to prove except everything.",
  ],
  hopeful: [
    "Good enough to play in January. Is it good enough to stay?",
    "A playoff team on paper. Paper doesn't tackle.",
    "Should be in the mix in December.",
    "One piece away. Maybe that piece is already on the roster.",
    "A wild card, at worst. A division title, maybe.",
    "Expect meaningful football in December.",
  ],
  mix: [
    "A coin flip for the playoffs. The schedule decides it.",
    "One break either way swings this whole season.",
    "They'll be in it into November. Then we'll find out.",
    "Nine wins or seven, and I can't tell you which.",
    "The definition of the middle of the pack.",
    "Their season is decided in one-score games.",
  ],
  longShot: [
    "Needs a lot to go right.",
    "A few upsets away from being interesting.",
    "Spoiler material. Circle the date if you're a contender.",
    "Respectable is the goal. Anything more is a bonus.",
    "They'll beat somebody they shouldn't. Probably twice.",
    "A long shot, but long shots come in.",
  ],
  rebuilding: [
    "It's a development year. Judge the young players, not the record.",
    "Top-five pick territory, and that's not the worst thing.",
    "Patience. The building knows it's a long road.",
    "The record won't be pretty. The future might be.",
    "Every snap for the kids is an investment.",
    "This is year one of a plan, or the last year of one.",
  ],
  breakout: ["The staff can't stop talking about him.", "This is the year it clicks.", "The tools were always there. Now the reps are too.", "Camp's best story.", "Ready for a starring role.", "He looks like a different player."],
  lastRide: ["How many Sundays are left?", "He says he's got one more in him.", "Enjoy it while it lasts.", "Father Time is undefeated. He's still trying.", "Every game could be the last one in that uniform.", "The legs are older. The mind is sharper than ever."],
  hotSeat: ["Ownership's patience has a number on it.", "Needs a fast start.", "The rumors start by October if this goes wrong.", "A losing September and the questions get loud.", "Win or the clock runs out."],
  watchRivalry: ["Throw out the records.", "Bad blood, good football.", "The one both cities circle first.", "Nobody needs a reason to get up for this one.", "Ask the old-timers about this one."],
  watchTitans: ["Could be a January preview.", "Two contenders, one tiebreaker.", "Seeding implications in pencil.", "Heavyweights.", "Clear your Sunday."],
  watchMisc: ["Styles make fights.", "Prove-it game.", "Somebody's statement game.", "Trap game written all over it.", "Upset alert."],
};

/** Fill {T}, {P}, {D}, {A} slots. */
export function fill(s: string, v: Record<string, string>): string {
  return s.replace(/\{(\w)\}/g, (_, k: string) => v[k] ?? "");
}

/**
 * A sentence built from parts, each part chosen on its own stride, so a few short lists
 * multiply into hundreds of distinct sentences and next year's never matches this year's.
 */
export function compose(key: string, year: number, parts: readonly (readonly string[])[], v: Record<string, string> = {}): string {
  return fill(parts.map((list, i) => vary(`${key}#${i}`, year + i * 7, list)).join(""), v);
}
