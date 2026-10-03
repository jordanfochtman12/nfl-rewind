import type { DefScheme, Gameplan, OffScheme } from "../types.ts";

/**
 * How each real coach actually called a game: the system he ran on each side of the
 * ball and the tendencies behind it (run/pass lean, fourth-down nerve, tempo, how often
 * he sent pressure, how he attacked the red zone). Some changed with the times — Noll
 * after the 1978 passing rules, Shula once Marino arrived — so a playbook can carry
 * later chapters that take over from a given season.
 */
export interface Playbook {
  /** The offense he ran, as the broadcast names it. */
  offense: string;
  /** The defense he ran. */
  defense: string;
  off: OffScheme;
  def: DefScheme;
  plan: Partial<Gameplan>;
  /** Called both sides himself, whatever his ratings lean toward. */
  callsBoth?: boolean;
  /** Later chapters: from that season on, these replace the fields above. */
  eras?: { from: number; offense?: string; defense?: string; off?: OffScheme; def?: DefScheme; plan?: Partial<Gameplan> }[];
}

const run = (p: Partial<Gameplan> = {}): Partial<Gameplan> => ({ attack: "run", ...p });
const pass = (p: Partial<Gameplan> = {}): Partial<Gameplan> => ({ attack: "pass", ...p });
const even = (p: Partial<Gameplan> = {}): Partial<Gameplan> => ({ attack: "balanced", ...p });

export const PLAYBOOKS: Record<string, Playbook> = {
  // ---- 1966 head coaches ----
  lombardi: { offense: "Power sweep", defense: "4-3 (Bengtson)", off: "smashmouth", def: "4-3", plan: run({ tempo: "chew", fourth: "conservative", redZone: "power", blitz: "rare" }) },
  "shula-clt": { offense: "Unitas pro-style", defense: "4-3", off: "multiple", def: "4-3", plan: even({ redZone: "balanced" }) },
  landry: { offense: "Multiple-motion (later shotgun)", defense: "Flex 4-3", off: "multiple", def: "4-3", callsBoth: true, plan: even({ blitz: "rare", defensiveFocus: "run" }), eras: [{ from: 1975, offense: "Shotgun multiple", plan: pass({ blitz: "rare", defensiveFocus: "run" }) }] },
  halas: { offense: "T formation", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ tempo: "chew", fourth: "conservative", redZone: "power" }) },
  collier: { offense: "Brown-and-Kelly ground game", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ redZone: "power" }) },
  "allen-ram": { offense: "Ball control", defense: "Fearsome Foursome 4-3 / nickel", off: "multiple", def: "4-3", plan: run({ tempo: "chew", fourth: "conservative", blitz: "normal" }) },
  vanbrocklin: { offense: "Dropback vertical", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  christiansen: { offense: "Brodie dropback", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  hecker: { offense: "Expansion pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even({ fourth: "conservative" }) },
  sherman: { offense: "Pro set passing", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  kuharich: { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even({ fourth: "conservative" }) },
  austin: { offense: "Lombardi power sweep", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ tempo: "chew", redZone: "power" }) },
  graham: { offense: "Jurgensen dropback", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  winner: { offense: "Pro set passing", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  gilmer: { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even() },
  stram: { offense: "Moving pocket / I-formation", defense: "Stack 4-3", off: "multiple", def: "4-3", plan: even({ blitz: "normal", redZone: "balanced" }) },
  ewbank: { offense: "Namath dropback", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  gillman: { offense: "Vertical stretch (Gillman)", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ fourth: "aggressive", redZone: "spread" }) },
  rauch: { offense: "Raiders vertical game", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread", blitz: "heavy" }) },
  holovak: { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even({ blitz: "heavy" }) },
  "collier-buf": { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even({ defensiveFocus: "run" }) },
  lemm: { offense: "Pro set passing", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  speedie: { offense: "Dropback vertical", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  "wilson-mia": { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: even() },

  // ---- expansion head coaches ----
  fears: { offense: "Rams-style passing", defense: "4-3", off: "vertical", def: "4-3", plan: pass() },
  pbrown: { offense: "Paul Brown system", defense: "4-3", off: "multiple", def: "4-3", callsBoth: true, plan: even({ fourth: "conservative", tempo: "standard" }) },
  mckay: { offense: "I-formation (Student Body Right)", defense: "3-4", off: "smashmouth", def: "3-4", plan: run({ tempo: "chew", redZone: "power" }) },
  patera: { offense: "Pro set with trick plays", defense: "4-3", off: "multiple", def: "4-3", plan: even({ fourth: "aggressive" }) },
  "capers-car": { offense: "Pro set", defense: "3-4 zone blitz", off: "multiple", def: "3-4", plan: run({ blitz: "heavy", fourth: "conservative" }) },
  coughlin: { offense: "Power run / play-action", defense: "4-3", off: "multiple", def: "4-3", plan: even({ fourth: "conservative", redZone: "power" }) },
  "marchibroda-rav": { offense: "No-huddle", defense: "4-3", off: "multiple", def: "4-3", plan: pass({ tempo: "hurry" }) },
  "palmer-cle": { offense: "Erhardt-Perkins passing", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  "capers-htx": { offense: "Pro set", defense: "3-4 zone blitz", off: "multiple", def: "3-4", plan: run({ blitz: "heavy", fourth: "conservative" }) },

  // ---- 1966 coordinators ----
  "bengtson-dc": { offense: "Pro set", defense: "4-3 (Lombardi Packers)", off: "multiple", def: "4-3", plan: { blitz: "rare", defensiveFocus: "balanced" } },
  "dooley-oc": { offense: "Sayers ground game", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ redZone: "power" }) },
  "allen-dc-dal": { offense: "Pro set", defense: "Flex 4-3", off: "multiple", def: "4-3", plan: { blitz: "rare", defensiveFocus: "run" } },
  "mccafferty-oc": { offense: "Unitas pro-style", defense: "4-3", off: "multiple", def: "4-3", plan: pass() },
  "madro-oc": { offense: "Vertical stretch (Gillman)", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  "bettis-dc": { offense: "Pro set", defense: "Stack 4-3", off: "multiple", def: "4-3", plan: { blitz: "normal" } },
  "rush-oc": { offense: "Namath dropback", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  "patera-dc": { offense: "Pro set", defense: "Fearsome Foursome front", off: "multiple", def: "4-3", plan: { blitz: "rare", defensiveFocus: "pass" } },
  "skorich-oc": { offense: "Brown-and-Kelly ground game", defense: "4-3", off: "smashmouth", def: "4-3", plan: run() },
  "gillman-dc": { offense: "Pro set", defense: "4-3", off: "multiple", def: "4-3", plan: { blitz: "normal" } },
  "stram-oc": { offense: "West Coast (Walsh)", defense: "4-3", off: "westcoast", def: "4-3", plan: pass({ redZone: "balanced" }) },
  "lombardi-oc": { offense: "Power sweep", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ redZone: "power" }) },
  "halas-dc": { offense: "Pro set", defense: "Allen 4-3 pressure", off: "multiple", def: "4-3", plan: { blitz: "heavy" } },
  "landry-oc": { offense: "Multiple-motion", defense: "Flex 4-3", off: "multiple", def: "4-3", plan: even() },
  "shula-dc": { offense: "Pro set", defense: "4-3 (later the 53)", off: "multiple", def: "4-3", plan: { blitz: "normal", defensiveFocus: "balanced" } },
  "rauch-oc": { offense: "Raiders vertical game", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  "austin-dc": { offense: "Pro set", defense: "Cover 2 (Steel Curtain)", off: "multiple", def: "cover-2", plan: { blitz: "rare", defensiveFocus: "pass" } },

  // ---- the pipeline: coaches who arrive later ----
  noll: {
    offense: "Power run (Harris and Bleier)",
    defense: "Steel Curtain 4-3 (stunt)",
    off: "smashmouth",
    def: "4-3",
    plan: run({ tempo: "chew", redZone: "power", blitz: "normal" }),
    eras: [{ from: 1978, offense: "Bradshaw vertical passing", off: "vertical", plan: pass({ tempo: "standard", redZone: "balanced", blitz: "normal" }) }],
  },
  "shula-mia": {
    offense: "Ball control (Csonka, Kiick, Morris)",
    defense: "53 defense (No-Name)",
    off: "smashmouth",
    def: "3-4",
    plan: run({ tempo: "chew", redZone: "power", fourth: "conservative" }),
    eras: [{ from: 1983, offense: "Marino quick-release passing", off: "vertical", defense: "3-4 (Killer B's)", plan: pass({ tempo: "standard", redZone: "spread", fourth: "normal" }) }],
  },
  maddden: { offense: "Raiders vertical game, power left", defense: "3-4", off: "vertical", def: "3-4", plan: even({ redZone: "power", blitz: "normal" }) },
  grant: { offense: "Tarkenton short passing", defense: "Purple People Eaters 4-3", off: "multiple", def: "4-3", plan: even({ fourth: "conservative", blitz: "rare", defensiveFocus: "pass" }) },
  knox: { offense: "Ground Chuck", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ tempo: "chew", fourth: "conservative", redZone: "power" }) },
  walsh: { offense: "West Coast offense", defense: "4-3", off: "westcoast", def: "4-3", plan: pass({ redZone: "balanced" }) },
  gibbs: { offense: "One-back counter trey (the Hogs)", defense: "4-3", off: "smashmouth", def: "4-3", plan: run({ redZone: "power" }) },
  parcells: { offense: "Erhardt-Perkins power", defense: "3-4 (Big Blue)", off: "multiple", def: "3-4", plan: run({ tempo: "chew", fourth: "conservative", redZone: "power" }) },
  "johnson-dal": { offense: "Pro set (Aikman to Irvin, Emmitt)", defense: "Speed 4-3", off: "multiple", def: "4-3", plan: even({ redZone: "power", blitz: "normal" }) },
  belichick: {
    offense: "Erhardt-Perkins",
    defense: "Multiple 3-4",
    off: "multiple",
    def: "3-4",
    plan: even({ fourth: "normal" }),
    eras: [{ from: 2007, offense: "Erhardt-Perkins spread", plan: pass({ fourth: "aggressive", redZone: "spread" }) }],
  },
  dunn: { offense: "Run-first pro set", defense: "Tampa 2", off: "multiple", def: "cover-2", plan: even({ fourth: "conservative", blitz: "rare", defensiveFocus: "pass" }) },
  reid: { offense: "West Coast offense", defense: "4-3 pressure", off: "westcoast", def: "4-3", plan: pass({ blitz: "heavy" }) },
  ditka: { offense: "Power I (Payton)", defense: "46 defense", off: "smashmouth", def: "4-3", plan: run({ tempo: "chew", redZone: "power", blitz: "heavy", defensiveFocus: "run" }) },
  seifert: { offense: "West Coast offense", defense: "4-3", off: "westcoast", def: "4-3", plan: pass({ redZone: "balanced" }) },
  holmgren: { offense: "West Coast offense", defense: "4-3", off: "westcoast", def: "4-3", plan: pass({ redZone: "balanced" }) },
  cowher: { offense: "Power run (Bettis)", defense: "3-4 zone blitz (Blitzburgh)", off: "smashmouth", def: "3-4", plan: run({ redZone: "power", blitz: "heavy" }) },
  vermeil: { offense: "Air Coryell (Martz)", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ redZone: "spread" }) },
  gruden: { offense: "Gruden West Coast", defense: "4-3", off: "westcoast", def: "4-3", plan: pass({ redZone: "balanced" }) },
  coryell: { offense: "Air Coryell", defense: "4-3", off: "vertical", def: "4-3", plan: pass({ fourth: "aggressive", redZone: "spread" }) },
  levy: { offense: "K-Gun no-huddle", defense: "3-4", off: "multiple", def: "3-4", plan: pass({ tempo: "hurry" }) },
  flores: { offense: "Raiders vertical game", defense: "3-4", off: "vertical", def: "3-4", plan: pass({ redZone: "balanced", blitz: "normal" }) },
  shanahan: { offense: "West Coast with zone running", defense: "4-3", off: "westcoast", def: "4-3", plan: even({ redZone: "balanced" }) },
  carroll: { offense: "Run-first play-action", defense: "4-3 under, Cover 3", off: "multiple", def: "4-3", plan: run({ fourth: "aggressive", redZone: "power" }) },
  payton: { offense: "Payton passing attack", defense: "4-3", off: "multiple", def: "4-3", plan: pass({ fourth: "aggressive", redZone: "spread" }) },
  tomlin: { offense: "Pro set", defense: "3-4 zone blitz (LeBeau)", off: "multiple", def: "3-4", plan: even({ blitz: "heavy" }) },
  harbaugh: { offense: "Power run", defense: "3-4 pressure", off: "smashmouth", def: "3-4", plan: run({ fourth: "aggressive", redZone: "power", blitz: "heavy" }) },
  mcvay: { offense: "Outside zone / play-action", defense: "3-4", off: "westcoast", def: "3-4", plan: pass({ redZone: "balanced" }) },
};

/** The playbook a coach runs in a given season, with any later chapter applied. */
export function playbookFor(id: string, year: number): Playbook | undefined {
  const b = PLAYBOOKS[id];
  if (!b?.eras) return b;
  let out: Playbook = b;
  for (const e of b.eras) {
    if (year < e.from) continue;
    out = { ...out, ...e, plan: { ...out.plan, ...e.plan }, eras: undefined } as Playbook;
  }
  return out;
}
