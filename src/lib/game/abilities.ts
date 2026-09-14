import type { Player, Pos, Ratings } from "./types.ts";

/** Mechanical kit. Keys are the strings stored on Player.abilities / Player.traits. */
export interface KitDef {
  /** Display blurb. */
  desc: string;
  offPass?: number;
  offRun?: number;
  defPass?: number;
  defRun?: number;
  cmp?: number;
  sack?: number;
  int?: number;
  fum?: number;
  td?: number;
  fg?: number;
  /** Injury chance multiplier. <1 safer. Combined as a product, not a sum. */
  inj?: number;
  recShare?: number;
  rushShare?: number;
  sackShare?: number;
  intShare?: number;
  scramble?: number;
  /** Added when trailing or in the 4th. */
  clutch?: number;
}

export const ABILITY_DEFS: Record<string, KitDef> = {
  Cannon: { desc: "Drives the ball into tight windows downfield.", offPass: 2.4, td: 0.02 },
  "Dead-eye": { desc: "Throws to spots. Completion travels.", offPass: 2.2, cmp: 0.035, int: -0.012 },
  "Field general": { desc: "Checks and cadence. The offense plays on time.", offPass: 1.8, offRun: 0.8, int: -0.01 },
  Scrambler: { desc: "Leaves the pocket and buys a down.", scramble: 14, sack: -0.015, offPass: 0.8 },
  "Broadway Joe": { desc: "Guarantees it. Then throws it anyway.", offPass: 3.2, td: 0.03, int: 0.012, clutch: 2.2 },
  "Quick release": { desc: "The ball is gone before the edge arrives.", sack: -0.012, cmp: 0.01 },
  Touch: { desc: "Drops it in the bucket on the hash.", cmp: 0.02, offPass: 0.8 },
  Checkdown: { desc: "Takes what the defense gives. Lives to play third down.", int: -0.016, td: -0.006, cmp: 0.012 },
  Elusive: { desc: "Makes the first man miss.", offRun: 2.4, fum: -0.008, rushShare: 0.12 },
  "North-south": { desc: "Falls forward. Always.", offRun: 2.6, rushShare: 0.08 },
  "Leg drive": { desc: "Keeps pumping after contact.", offRun: 1.8, fum: -0.01 },
  "Home run": { desc: "One cut and the secondary is chasing air.", offRun: 3.2, td: 0.02, recShare: 0.08 },
  "Kansas Comet": { desc: "Five tools in the backfield. Uncoverable in space.", offRun: 4.2, offPass: 1.2, recShare: 0.18 },
  "Golden Boy": { desc: "Runs, throws, kicks — the offense in one jersey.", offRun: 2.0, offPass: 0.8, fg: 0.04, clutch: 1.5 },
  "Between tackles": { desc: "The dive, the slam, the extra yard.", offRun: 1.4, rushShare: 0.06 },
  "Third-down back": { desc: "The passing-down back. Chip and leak.", recShare: 0.14, offPass: 0.5 },
  "Sure hands": { desc: "The ball sticks.", recShare: 0.16, fum: -0.012, cmp: 0.01 },
  Contested: { desc: "Wins it at the high point.", recShare: 0.12, td: 0.015, offPass: 0.8 },
  Burner: { desc: "Takes the top off a defense.", offPass: 2.0, recShare: 0.14, td: 0.015 },
  Separator: { desc: "Stems and leaves the corner planted.", offPass: 1.6, recShare: 0.12, cmp: 0.012 },
  Bambi: { desc: "Lance. The catch radius of a decade.", offPass: 2.8, recShare: 0.2, cmp: 0.02 },
  "Bullet Bob": { desc: "World's fastest human in pads.", offPass: 2.4, recShare: 0.16, td: 0.02 },
  YAC: { desc: "The play starts after the catch.", recShare: 0.08, offPass: 0.6, offRun: 0.4 },
  "Red zone": { desc: "Finds the paint from the 8.", td: 0.018, recShare: 0.06 },
  "Move TE": { desc: "Flexes out and the linebacker is lost.", recShare: 0.1, offPass: 0.7 },
  "Pocket brick": { desc: "The edge dies on his outside shoulder.", offPass: 2.2, sack: -0.02 },
  Mauler: { desc: "Moves the line of scrimmage backward.", offRun: 2.4 },
  Anchor: { desc: "Does not get walked back.", offPass: 1.4, offRun: 1.2, defRun: 0.6 },
  Puller: { desc: "Gets to the second level on the toss.", offRun: 1.6 },
  "Set the edge": { desc: "Nothing bounces outside.", offRun: 0.8, defRun: 0.5 },
  Edge: { desc: "First step wins the down.", defPass: 2.6, sack: 0.02, sackShare: 0.35 },
  "Two-gap": { desc: "Occupies two blockers and the hole.", defRun: 2.8, sackShare: 0.1 },
  Finisher: { desc: "Closes with violence.", defPass: 1.4, defRun: 1.4, sackShare: 0.2 },
  Bend: { desc: "Turns the corner flat. The tackle is grabbing air.", defPass: 1.4, sackShare: 0.18 },
  "Stack-shed": { desc: "Two-gap, then the ball-carrier.", defRun: 1.8 },
  Motor: { desc: "Chase-down from the backside. Never off the field.", defPass: 0.8, sackShare: 0.1, inj: 0.92 },
  "Quarterback of D": { desc: "Gets them lined up. Then fills.", defPass: 1.8, defRun: 1.6, intShare: 0.1 },
  Thumper: { desc: "The middle of the field is closed.", defRun: 3.0, fum: 0.008 },
  Blitzer: { desc: "A-gap on third down.", sackShare: 0.16, defPass: 0.8 },
  Blanket: { desc: "Stays in the receiver's hip pocket.", defPass: 2.8, intShare: 0.12 },
  Recovery: { desc: "Loses a step and still makes the play.", defPass: 1.6, intShare: 0.08 },
  "Ball hawk": { desc: "The ball comes down with him.", defPass: 2.0, int: 0.018, intShare: 0.28 },
  Zone: { desc: "Reads the quarterback's eyes in the window.", defPass: 1.4, intShare: 0.1 },
  "Box safety": { desc: "The eighth man in the run fit.", defRun: 1.4, intShare: 0.04 },
  Leg: { desc: "Range from the visiting hash.", fg: 0.07 },
  Ice: { desc: "The kick is through before the roar.", fg: 0.08, clutch: 1.2 },
  Directional: { desc: "Pins it inside the 10.", fg: 0.03 },
  Iron: { desc: "Does not leave the game.", inj: 0.55 },
  Durability: { desc: "Carries the workload week after week.", inj: 0.7, rushShare: 0.06 },
  Hands: { desc: "The easy ones are caught.", recShare: 0.07, fum: -0.006, cmp: 0.006 },
};

export const TRAIT_DEFS: Record<string, KitDef> = {
  Clutch: { desc: "Bigger in the fourth and when trailing.", clutch: 2.8, fg: 0.03 },
  Gunslinger: { desc: "Throws it anyway. Touchdowns and interceptions.", offPass: 1.6, td: 0.025, int: 0.02, cmp: -0.01 },
  "Game manager": { desc: "Does not beat you. Does not lose it either.", int: -0.02, cmp: 0.015, td: -0.008 },
  Workhorse: { desc: "Thirty carries if the game is honest.", rushShare: 0.22, offRun: 1.2, inj: 1.12 },
  Glass: { desc: "One hit and the training room lights come on.", inj: 1.85 },
  "Iron man": { desc: "Tape and go. Never sits.", inj: 0.5 },
  Nicked: { desc: "Always a little dinged. Plays through it — until he cannot.", inj: 1.28 },
  Fumbler: { desc: "The ball is a loaner.", fum: 0.03 },
  "Sure-handed": { desc: "Protects the football.", fum: -0.018 },
  Leader: { desc: "The huddle is quiet when he talks.", offPass: 0.8, offRun: 0.8, defPass: 0.5, defRun: 0.5 },
  "Pocket statue": { desc: "Will not run. The rush knows it.", scramble: -8, sack: 0.012, offPass: 0.4 },
  "East-west": { desc: "Looks for the sideline before the sticks.", offRun: 0.6, fum: 0.006, recShare: 0.05 },
  "Run stuffer": { desc: "The dive dies at his feet.", defRun: 1.8 },
  "Coverage linebacker": { desc: "Drops and takes away the drag.", defPass: 1.4, intShare: 0.08 },
  "Return man": { desc: "The first man down the sideline after a miss.", recShare: 0.04 },
  "High motor": { desc: "The play is not over until he is on the ground.", sackShare: 0.08, defPass: 0.4, defRun: 0.4 },
  "Film junkie": { desc: "Knows the tendency before the snap.", offPass: 0.5, defPass: 0.5, int: -0.006 },
  "Blue collar": { desc: "Lunch-pail snaps. No headlines. Wins in November.", offRun: 0.7, defRun: 0.7 },
  Competitor: { desc: "The game is personal after the half.", clutch: 1.6 },
  Reliable: { desc: "Does his job. The ball stays with the club.", fum: -0.01, inj: 0.88 },
  Physical: { desc: "Seeks contact. The pile moves his way.", offRun: 0.6, defRun: 0.6, fum: 0.004 },
  Shifty: { desc: "A cut in the hole and the arm tackle is empty.", offRun: 0.9, recShare: 0.04 },
  Possession: { desc: "The chains move. The circus catch can wait.", recShare: 0.08, cmp: 0.01 },
  "Deep threat": { desc: "The safety cannot cheat the run.", offPass: 0.9, recShare: 0.06, td: 0.008 },
  Enforcer: { desc: "The message is sent on the first collision.", defRun: 1.0, fum: 0.01 },
  "Boom-bust": { desc: "Explosive. Also expensive.", td: 0.016, int: 0.01, fum: 0.008 },
  Steady: { desc: "Does not beat himself.", cmp: 0.012, int: -0.01, fum: -0.006 },
};

const ALL_DEFS: Record<string, KitDef> = { ...ABILITY_DEFS, ...TRAIT_DEFS };

export function kitDef(name: string): KitDef | undefined {
  return ALL_DEFS[name];
}

/** Human-readable sim effect for scout cards and tooltips. */
export function kitImpactLine(name: string): string {
  const d = kitDef(name);
  if (!d) return name;
  const fx: string[] = [];
  if (d.offPass) fx.push("boosts the passing unit");
  if (d.offRun) fx.push("boosts the run unit");
  if (d.defPass) fx.push("tightens the pass defense");
  if (d.defRun) fx.push("stuffs the run");
  if (d.cmp) fx.push(d.cmp > 0 ? "higher completion %" : "lower completion %");
  if (d.sack) fx.push(d.sack > 0 ? "more sacks" : "protects the quarterback");
  if (d.int) fx.push(d.int > 0 ? "more interceptions" : "fewer picks");
  if (d.fum) fx.push(d.fum > 0 ? "more fumbles" : "protects the ball");
  if (d.td) fx.push("more touchdowns");
  if (d.fg) fx.push("makes field goals");
  if (d.inj && d.inj < 1) fx.push("stays healthier");
  if (d.inj && d.inj > 1) fx.push("misses more time");
  if (d.recShare) fx.push("sees more targets");
  if (d.rushShare) fx.push("gets more carries");
  if (d.sackShare) fx.push("hunts the quarterback");
  if (d.intShare) fx.push("finds the football");
  if (d.scramble) fx.push(d.scramble > 0 ? "scrambles for yards" : "stays in the pocket");
  if (d.clutch) fx.push("bigger in the fourth");
  return fx.length ? `${d.desc} (${fx.join("; ")})` : d.desc;
}

export function abilitiesFrom(pos: Pos, r: Ratings): string[] {
  const out: string[] = [];
  if (pos === "QB") {
    if (r.throwPow >= 88) out.push("Cannon");
    else if (r.throwPow >= 78) out.push("Quick release");
    if (r.throwAcc >= 88) out.push("Dead-eye");
    else if (r.throwAcc >= 78) out.push("Touch");
    if (r.throwAwr >= 86) out.push("Field general");
    else if (r.throwAwr >= 76) out.push("Checkdown");
    if (r.agi >= 84) out.push("Scrambler");
  }
  if (pos === "RB" || pos === "FB") {
    if (r.elu >= 86) out.push("Elusive");
    if (r.truck >= 86) out.push("North-south");
    if (r.btk >= 86) out.push("Leg drive");
    if (r.speed >= 88) out.push("Home run");
    if (r.catch >= 78) out.push("Third-down back");
    if (!out.length && r.truck + r.btk >= 140) out.push("Between tackles");
  }
  if (pos === "WR" || pos === "TE") {
    if (r.catch >= 88) out.push("Sure hands");
    else if (r.catch >= 78) out.push("Hands");
    if (r.cit >= 86) out.push("Contested");
    if (r.speed >= 88) out.push("Burner");
    if (r.rrt >= 86) out.push("Separator");
    if (r.elu >= 80 || r.speed >= 82) out.push("YAC");
    if (r.cit >= 80) out.push("Red zone");
    if (pos === "TE" && r.rrt >= 76) out.push("Move TE");
  }
  if (["LT", "LG", "C", "RG", "RT"].includes(pos)) {
    if (r.passBlk >= 86) out.push("Pocket brick");
    if (r.runBlk >= 86) out.push("Mauler");
    if (r.str >= 88) out.push("Anchor");
    if (r.agi >= 74 && r.runBlk >= 76) out.push("Puller");
    if ((pos === "LT" || pos === "RT") && r.runBlk >= 74) out.push("Set the edge");
  }
  if (["DE", "DT", "OLB"].includes(pos)) {
    if (r.prs >= 88) out.push("Edge");
    else if (r.prs >= 78) out.push("Bend");
    if (r.str >= 86) out.push("Two-gap");
    if (r.tak >= 86) out.push("Finisher");
    if (r.str >= 80 && pos === "DT") out.push("Stack-shed");
    if (r.stamina >= 80) out.push("Motor");
  }
  if (["MLB", "OLB"].includes(pos)) {
    if (r.awareness >= 86) out.push("Quarterback of D");
    if (r.tak >= 88) out.push("Thumper");
    if (r.prs >= 76) out.push("Blitzer");
  }
  if (pos === "CB" || pos === "S") {
    if (r.cov >= 88) out.push("Blanket");
    if (r.speed >= 86) out.push("Recovery");
    if (r.awareness >= 84) out.push("Ball hawk");
    else if (r.awareness >= 74) out.push("Zone");
    if (pos === "S" && r.tak >= 76) out.push("Box safety");
  }
  if (pos === "K" || pos === "P") {
    if (r.kickPow >= 86) out.push("Leg");
    if (r.kickAcc >= 86) out.push("Ice");
    else if (r.kickAcc >= 74) out.push("Directional");
  }
  if (r.inj >= 90) out.push("Iron");
  if (r.stamina >= 88) out.push("Durability");
  return unique(out).slice(0, 3);
}

export function traitsFrom(pos: Pos, r: Ratings): string[] {
  const out: string[] = [];
  if (r.inj >= 92) out.push("Iron man");
  else if (r.inj <= 54) out.push("Glass");
  else if (r.inj <= 70) out.push("Nicked");
  if (pos === "QB") {
    if (r.throwPow >= 82 && r.throwAcc <= 80) out.push("Gunslinger");
    else if (r.throwAcc >= 82 && r.throwPow <= 80) out.push("Game manager");
    else if (r.throwPow >= r.throwAcc + 4) out.push("Boom-bust");
    else out.push("Steady");
    if (r.agi <= 64 && r.throwAwr >= 76) out.push("Pocket statue");
    if (r.awareness >= 88) out.push("Leader");
    if (r.awareness >= 84 && r.throwAwr >= 82) out.push("Clutch");
    else if (r.awareness >= 80) out.push("Film junkie");
  }
  if (pos === "RB" || pos === "FB") {
    if (r.stamina >= 84) out.push("Workhorse");
    if (r.btk <= 68) out.push("Fumbler");
    else if (r.btk >= 84) out.push("Sure-handed");
    if (r.elu >= 82 && r.truck <= 74) out.push("East-west");
    else if (r.elu >= 78) out.push("Shifty");
    else out.push("Physical");
  }
  if (pos === "WR" || pos === "TE") {
    if (r.catch >= 86) out.push("Sure-handed");
    if (r.speed >= 86) out.push("Deep threat");
    else if (r.catch >= 78) out.push("Possession");
    if (r.awareness >= 82) out.push("Film junkie");
  }
  if (pos === "MLB" || pos === "DT") {
    if (r.str >= 82 && r.tak >= 80) out.push("Run stuffer");
    else out.push("Physical");
  }
  if (pos === "OLB" || pos === "MLB") {
    if (r.cov >= 76 && r.awareness >= 78) out.push("Coverage linebacker");
    if (r.tak >= 82) out.push("Enforcer");
  }
  if (["LT", "LG", "C", "RG", "RT"].includes(pos)) {
    out.push(r.awareness >= 80 ? "Film junkie" : "Blue collar");
    if (r.stamina >= 82) out.push("Reliable");
  }
  if (["DE", "DT"].includes(pos)) {
    out.push(r.stamina >= 80 ? "High motor" : "Physical");
  }
  if (pos === "CB" || pos === "S") {
    if (r.speed >= 86 && r.agi >= 80) out.push("Return man");
    if (r.awareness >= 80) out.push("Film junkie");
    else out.push("Competitor");
  }
  if (pos === "K" || pos === "P") {
    out.push(r.kickAcc >= 80 ? "Clutch" : "Steady");
  }
  if ((pos === "WR" || pos === "CB" || pos === "RB") && r.speed >= 88 && r.agi >= 82) {
    if (!out.includes("Return man")) out.push("Return man");
  }
  if (r.awareness >= 90 && !out.includes("Leader")) out.push("Leader");
  if (r.awareness >= 84 && !out.includes("Competitor") && !out.includes("Clutch")) out.push("Competitor");
  return unique(out).slice(0, 2);
}

function bestAbility(pos: Pos, r: Ratings): string {
  const pick = (...pairs: [number, string][]): string => {
    let best = pairs[0]!;
    for (const p of pairs) if (p[0] > best[0]) best = p;
    return best[1];
  };
  if (pos === "QB") return pick([r.throwPow, r.throwPow >= 84 ? "Cannon" : "Quick release"], [r.throwAcc, r.throwAcc >= 84 ? "Dead-eye" : "Touch"], [r.throwAwr, "Field general"], [r.agi, "Scrambler"]);
  if (pos === "RB" || pos === "FB") return pick([r.elu, "Elusive"], [r.truck, "North-south"], [r.speed, "Home run"], [r.btk, "Leg drive"], [r.catch, "Third-down back"]);
  if (pos === "WR") return pick([r.speed, "Burner"], [r.catch, "Sure hands"], [r.cit, "Contested"], [r.rrt, "Separator"]);
  if (pos === "TE") return pick([r.catch, "Sure hands"], [r.cit, "Contested"], [r.rrt, "Move TE"], [r.str, "Red zone"]);
  if (["LT", "LG", "C", "RG", "RT"].includes(pos)) return pick([r.passBlk, "Pocket brick"], [r.runBlk, "Mauler"], [r.str, "Anchor"]);
  if (pos === "DE" || pos === "OLB") return pick([r.prs, "Edge"], [r.tak, "Finisher"], [r.str, "Two-gap"], [r.stamina, "Motor"]);
  if (pos === "DT") return pick([r.str, "Two-gap"], [r.prs, "Stack-shed"], [r.tak, "Finisher"]);
  if (pos === "MLB") return pick([r.tak, "Thumper"], [r.awareness, "Quarterback of D"], [r.prs, "Blitzer"]);
  if (pos === "CB") return pick([r.cov, "Blanket"], [r.speed, "Recovery"], [r.awareness, "Ball hawk"]);
  if (pos === "S") return pick([r.awareness, "Ball hawk"], [r.cov, "Zone"], [r.tak, "Box safety"]);
  if (pos === "K" || pos === "P") return pick([r.kickPow, "Leg"], [r.kickAcc, "Ice"]);
  return "Motor";
}

function bestTrait(pos: Pos, r: Ratings): string {
  if (r.inj <= 54) return "Glass";
  if (r.inj >= 92) return "Iron man";
  if (pos === "QB") {
    if (r.throwPow > r.throwAcc + 3) return "Gunslinger";
    if (r.agi <= 64) return "Pocket statue";
    if (r.awareness >= 84) return "Leader";
    return "Game manager";
  }
  if (pos === "RB" || pos === "FB") return r.stamina >= 80 ? "Workhorse" : r.elu >= r.truck ? "East-west" : "Physical";
  if (pos === "WR" || pos === "TE") return r.speed >= 84 ? "Deep threat" : "Possession";
  if (["LT", "LG", "C", "RG", "RT"].includes(pos)) return r.awareness >= 78 ? "Film junkie" : "Blue collar";
  if (pos === "DE" || pos === "DT") return r.stamina >= 78 ? "High motor" : "Run stuffer";
  if (pos === "MLB" || pos === "OLB") return r.cov >= 74 ? "Coverage linebacker" : "Enforcer";
  if (pos === "CB" || pos === "S") return r.speed >= 84 ? "Return man" : "Film junkie";
  if (pos === "K" || pos === "P") return r.kickAcc >= 80 ? "Clutch" : "Steady";
  return r.awareness >= 80 ? "Competitor" : "Blue collar";
}

type Sig = { abilities?: string[]; traits?: string[] };

const SIGNATURES: Record<string, Sig> = {
  "bart|starr": { abilities: ["Field general", "Dead-eye"], traits: ["Clutch", "Leader"] },
  "johnny|unitas": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch", "Leader"] },
  "joe|namath": { abilities: ["Broadway Joe", "Cannon"], traits: ["Gunslinger", "Clutch"] },
  "gale|sayers": { abilities: ["Kansas Comet", "Home run", "Elusive"], traits: ["East-west"] },
  "dick|butkus": { abilities: ["Thumper", "Quarterback of D"], traits: ["Run stuffer", "Leader"] },
  "ray|nitschke": { abilities: ["Thumper"], traits: ["Run stuffer", "Leader"] },
  "paul|hornung": { abilities: ["Golden Boy"], traits: ["Clutch"] },
  "jim|taylor": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Sure-handed"] },
  "forrest|gregg": { abilities: ["Pocket brick", "Mauler"], traits: ["Iron man"] },
  "jerry|kramer": { abilities: ["Mauler"], traits: ["Leader"] },
  "willie|davis": { abilities: ["Edge", "Finisher"], traits: [] },
  "herb|adderley": { abilities: ["Blanket", "Ball hawk"], traits: [] },
  "willie|wood": { abilities: ["Ball hawk"], traits: ["Leader"] },
  "len|dawson": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch", "Game manager"] },
  "lance|alworth": { abilities: ["Bambi", "Burner", "Separator"], traits: [] },
  "bob|hayes": { abilities: ["Bullet Bob", "Burner"], traits: ["Return man"] },
  "deacon|jones": { abilities: ["Edge", "Finisher"], traits: [] },
  "merlin|olsen": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "bob|lilly": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "john|mackey": { abilities: ["Contested", "Sure hands"], traits: ["Sure-handed"] },
  "mike|ditka": { abilities: ["Contested"], traits: ["Leader"] },
  "paul|warfield": { abilities: ["Separator", "Burner"], traits: [] },
  "leroy|kelly": { abilities: ["Home run", "Elusive"], traits: ["Workhorse"] },
  "sonny|jurgensen": { abilities: ["Cannon", "Dead-eye"], traits: ["Gunslinger"] },
  "charley|taylor": { abilities: ["Separator", "Sure hands"], traits: [] },
  "bobby|mitchell": { abilities: ["Burner"], traits: ["Return man"] },
  "sam|huff": { abilities: ["Thumper"], traits: ["Leader"] },
  "paul|krause": { abilities: ["Ball hawk"], traits: [] },
  "larry|wilson": { abilities: ["Ball hawk"], traits: ["Leader"] },
  "fran|tarkenton": { abilities: ["Scrambler", "Field general"], traits: [] },
  "don|meredith": { abilities: ["Cannon"], traits: ["Gunslinger"] },
  "chuck|howley": { abilities: ["Recovery", "Finisher"], traits: ["Coverage linebacker"] },
  "mel|renfro": { abilities: ["Ball hawk", "Recovery"], traits: ["Return man"] },
  "roman|gabriel": { abilities: ["Cannon"], traits: ["Pocket statue"] },
  "john|brodie": { abilities: ["Dead-eye"], traits: ["Game manager"] },
  "alex|karras": { abilities: ["Two-gap"], traits: ["Run stuffer"] },
  "dick|lebeau": { abilities: ["Ball hawk"], traits: ["Coverage linebacker"] },
  "doug|atkins": { abilities: ["Edge"], traits: ["Iron man"] },
  "george|blanda": { abilities: ["Leg", "Ice"], traits: ["Iron man", "Clutch"] },
  "gino|cappelletti": { abilities: ["Leg", "Ice"], traits: [] },
  "jim|nance": { abilities: ["North-south"], traits: ["Workhorse"] },
  "nick|buoniconti": { abilities: ["Thumper", "Quarterback of D"], traits: ["Leader"] },
  "ron|mix": { abilities: ["Pocket brick"], traits: ["Iron man"] },
  "ernie|ladd": { abilities: ["Anchor", "Two-gap"], traits: [] },
  "jim|otto": { abilities: ["Anchor", "Mauler"], traits: ["Iron man", "Leader"] },
  "fred|biletnikoff": { abilities: ["Sure hands", "Separator"], traits: ["Sure-handed"] },
  "billy|shaw": { abilities: ["Mauler"], traits: ["Leader"] },
  "tom|sestak": { abilities: ["Two-gap"], traits: ["Run stuffer"] },
  "bobby|bell": { abilities: ["Edge", "Finisher"], traits: [] },
  "buck|buchanan": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "otis|taylor": { abilities: ["Contested", "Burner"], traits: [] },
  "don|maynard": { abilities: ["Burner", "Separator"], traits: [] },
  "gerry|philbin": { abilities: ["Edge"], traits: [] },
  "tommy|nobis": { abilities: ["Thumper", "Quarterback of D"], traits: ["Leader"] },
  "bob|griese": { abilities: ["Dead-eye", "Field general"], traits: ["Game manager", "Clutch"] },
  "alan|page": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "gene|upshaw": { abilities: ["Mauler", "Puller"], traits: ["Leader", "Iron man"] },
  "floyd|little": { abilities: ["Home run", "Elusive"], traits: ["Workhorse"] },
  "bubba|smith": { abilities: ["Edge", "Anchor"], traits: ["Enforcer"] },
  "joe|greene": { abilities: ["Two-gap", "Thumper"], traits: ["Run stuffer", "Leader"] },
  "terry|bradshaw": { abilities: ["Cannon"], traits: ["Gunslinger", "Clutch"] },
  "lynn|swann": { abilities: ["Contested", "Separator"], traits: [] },
  "john|stallworth": { abilities: ["Sure hands", "Separator"], traits: ["Clutch"] },
  "jack|lambert": { abilities: ["Thumper", "Quarterback of D"], traits: ["Leader"] },
  "jack|ham": { abilities: ["Ball hawk"], traits: ["Coverage linebacker"] },
  "mel|blount": { abilities: ["Blanket"], traits: [] },
  "franco|harris": { abilities: ["North-south", "Sure hands"], traits: ["Workhorse", "Clutch"] },
  "mean joe|greene": { abilities: ["Two-gap"], traits: [] },
  "walter|payton": { abilities: ["Home run", "Elusive", "Leg drive"], traits: ["Workhorse", "Iron man"] },
  "steve|largent": { abilities: ["Sure hands", "Separator"], traits: ["Sure-handed"] },
  "earl|campbell": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Physical"] },
  "tony|dorsett": { abilities: ["Home run", "Elusive"], traits: ["East-west"] },
  "kellen|winslow": { abilities: ["Move TE", "Sure hands"], traits: ["Possession"] },
  "anthony|munoz": { abilities: ["Pocket brick", "Mauler"], traits: ["Iron man"] },
  "art|monk": { abilities: ["Sure hands", "Contested"], traits: ["Sure-handed"] },
  "dwight|stephenson": { abilities: ["Anchor", "Mauler"], traits: ["Leader"] },
  "lawrence|taylor": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "ronnie|lott": { abilities: ["Ball hawk", "Thumper"], traits: ["Enforcer", "Leader"] },
  "howie|long": { abilities: ["Edge", "Anchor"], traits: [] },
  "mike|singletary": { abilities: ["Thumper", "Quarterback of D"], traits: ["Leader"] },
  "marcus|allen": { abilities: ["Elusive", "Third-down back"], traits: ["Clutch"] },
  "jim|mcmahon": { abilities: ["Scrambler"], traits: ["Gunslinger", "Clutch"] },
  "mike|munchak": { abilities: ["Mauler", "Puller"], traits: ["Iron man"] },
  "andre|tippett": { abilities: ["Edge", "Bend"], traits: [] },
  "jerry|rice": { abilities: ["Separator", "Sure hands", "Burner"], traits: ["Iron man", "Leader"] },
  "joe|montana": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch", "Leader"] },
  "dan|marino": { abilities: ["Cannon", "Dead-eye"], traits: ["Gunslinger"] },
  "john|elway": { abilities: ["Cannon", "Scrambler"], traits: ["Clutch"] },
  "steve|young": { abilities: ["Scrambler", "Dead-eye"], traits: ["Clutch"] },
  "bruce|smith": { abilities: ["Edge", "Finisher"], traits: [] },
  "reggie|white": { abilities: ["Edge", "Anchor"], traits: [] },
  "charles|haley": { abilities: ["Edge", "Finisher"], traits: [] },
  "rod|woodson": { abilities: ["Blanket", "Ball hawk"], traits: ["Return man"] },
  "barry|sanders": { abilities: ["Elusive", "Home run"], traits: ["East-west"] },
  "emmitt|smith": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Sure-handed"] },
  "deion|sanders": { abilities: ["Blanket", "Burner"], traits: ["Return man"] },
  "troy|aikman": { abilities: ["Dead-eye", "Field general"], traits: ["Leader"] },
  "junior|seau": { abilities: ["Thumper", "Finisher"], traits: ["Leader"] },
  "derrick|thomas": { abilities: ["Edge", "Bend"], traits: [] },
  "shannon|sharpe": { abilities: ["Move TE", "Sure hands"], traits: [] },
  "brett|favre": { abilities: ["Cannon", "Quick release"], traits: ["Gunslinger", "Iron man"] },
  "marshall|faulk": { abilities: ["Elusive", "Third-down back"], traits: ["Workhorse"] },
  "michael|strahan": { abilities: ["Edge", "Finisher"], traits: [] },
  "terrell|davis": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse"] },
  "curtis|martin": { abilities: ["Between tackles", "Elusive"], traits: ["Workhorse", "Sure-handed"] },
  "ray|lewis": { abilities: ["Thumper", "Quarterback of D"], traits: ["Leader"] },
  "eddie|george": { abilities: ["North-south"], traits: ["Workhorse"] },
  "terrell|owens": { abilities: ["Contested", "Burner"], traits: ["Boom-bust"] },
  "marvin|harrison": { abilities: ["Separator", "Sure hands"], traits: ["Sure-handed"] },
  "randy|moss": { abilities: ["Burner", "Contested"], traits: ["Deep threat"] },
  "peyton|manning": { abilities: ["Field general", "Dead-eye"], traits: ["Leader", "Clutch"] },
  "tony|gonzalez": { abilities: ["Sure hands", "Red zone"], traits: ["Sure-handed"] },
  "charles|woodson": { abilities: ["Ball hawk", "Blanket"], traits: ["Return man"] },
  "edgerrin|james": { abilities: ["North-south", "Third-down back"], traits: ["Workhorse"] },
  "tom|brady": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch", "Leader"] },
  "brian|urlacher": { abilities: ["Thumper", "Coverage linebacker"], traits: ["Leader"] },
  "ladainian|tomlinson": { abilities: ["Home run", "Third-down back"], traits: ["Workhorse"] },
  "drew|brees": { abilities: ["Dead-eye", "Touch"], traits: ["Leader"] },
  "ed|reed": { abilities: ["Ball hawk"], traits: ["Film junkie"] },
  "troy|polamalu": { abilities: ["Ball hawk", "Finisher"], traits: [] },
  "andre|johnson": { abilities: ["Contested", "Sure hands"], traits: [] },
  "larry|fitzgerald": { abilities: ["Contested", "Sure hands"], traits: ["Sure-handed"] },
  "ben|roethlisberger": { abilities: ["Cannon", "Scrambler"], traits: ["Clutch"] },
  "aaron|rodgers": { abilities: ["Dead-eye", "Cannon"], traits: ["Clutch"] },
  "adrian|peterson": { abilities: ["Home run", "North-south"], traits: ["Workhorse"] },
  "calvin|johnson": { abilities: ["Contested", "Burner"], traits: [] },
  "jj|watt": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "j.j.|watt": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "rob|gronkowski": { abilities: ["Red zone", "Contested"], traits: ["Physical"] },
  "luke|kuechly": { abilities: ["Quarterback of D", "Thumper"], traits: ["Film junkie"] },
  "richard|sherman": { abilities: ["Blanket"], traits: ["Leader"] },
  "dez|bryant": { abilities: ["Contested", "Red zone"], traits: [] },
  "cam|newton": { abilities: ["Scrambler", "Cannon"], traits: ["Physical"] },
  "von|miller": { abilities: ["Edge", "Bend"], traits: [] },
  "russell|wilson": { abilities: ["Scrambler", "Dead-eye"], traits: ["Clutch"] },
  "bobby|wagner": { abilities: ["Quarterback of D", "Thumper"], traits: ["Leader"] },
  "travis|kelce": { abilities: ["Move TE", "Sure hands"], traits: ["Clutch"] },
  "aaron|donald": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "odell|beckham": { abilities: ["YAC", "Contested"], traits: ["Boom-bust"] },
  "mike|evans": { abilities: ["Contested", "Red zone"], traits: [] },
  "khalil|mack": { abilities: ["Edge", "Finisher"], traits: [] },
  "derek|carr": { abilities: ["Touch", "Quick release"], traits: ["Game manager"] },
  "davante|adams": { abilities: ["Separator", "Sure hands"], traits: [] },
  "derrick|henry": { abilities: ["North-south", "Home run"], traits: ["Workhorse"] },
  "dak|prescott": { abilities: ["Scrambler", "Field general"], traits: ["Clutch"] },
  "tyreek|hill": { abilities: ["Burner", "Home run"], traits: ["Deep threat"] },
  "patrick|mahomes": { abilities: ["Cannon", "Scrambler"], traits: ["Clutch", "Gunslinger"] },
  "christian|mccaffrey": { abilities: ["Third-down back", "Elusive"], traits: ["Workhorse"] },
  "t.j.|watt": { abilities: ["Edge", "Finisher"], traits: [] },
  "george|kittle": { abilities: ["YAC", "Move TE"], traits: ["Physical"] },
  "saquon|barkley": { abilities: ["Home run", "Elusive"], traits: [] },
  "josh|allen": { abilities: ["Cannon", "Scrambler"], traits: ["Clutch"] },
  "lamar|jackson": { abilities: ["Scrambler", "Home run"], traits: ["Clutch"] },
  "joe|burrow": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch"] },
  "justin|jefferson": { abilities: ["Separator", "Contested"], traits: [] },
  "ja'marr|chase": { abilities: ["YAC", "Contested"], traits: [] },
  "jamarr|chase": { abilities: ["YAC", "Contested"], traits: [] },
  "micah|parsons": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "justin|herbert": { abilities: ["Cannon", "Dead-eye"], traits: [] },
  "ceeDee|lamb": { abilities: ["YAC", "Separator"], traits: [] },
  "ceedee|lamb": { abilities: ["YAC", "Separator"], traits: [] },
  "jalen|hurts": { abilities: ["Scrambler"], traits: ["Clutch", "Leader"] },
  "sauce|gardner": { abilities: ["Blanket"], traits: [] },
  "bijan|robinson": { abilities: ["Elusive", "Home run"], traits: [] },
  "puka|nacua": { abilities: ["Sure hands", "YAC"], traits: ["Sure-handed"] },
  "jayden|daniels": { abilities: ["Scrambler", "Touch"], traits: [] },
  "ashton|jeanty": { abilities: ["North-south", "Elusive"], traits: ["Workhorse"] },
  "oj|simpson": { abilities: ["Home run", "Elusive"], traits: ["East-west"] },
  "ron|yary": { abilities: ["Pocket brick", "Mauler"], traits: ["Iron man"] },
  "larry|csonka": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Physical"] },
  "ted|hendricks": { abilities: ["Edge", "Coverage linebacker"], traits: ["Iron man"] },
  "jack|youngblood": { abilities: ["Edge", "Finisher"], traits: ["Iron man"] },
  "jack|tatum": { abilities: ["Thumper", "Finisher"], traits: ["Enforcer"] },
  "ken|houston": { abilities: ["Ball hawk"], traits: ["Leader"] },
  "rayfield|wright": { abilities: ["Mauler", "Pocket brick"], traits: ["Iron man"] },
  "claude|humphrey": { abilities: ["Edge", "Finisher"], traits: [] },
  "curley|culp": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "roger|wehrli": { abilities: ["Blanket", "Ball hawk"], traits: [] },
  "charlie|joiner": { abilities: ["Sure hands", "Separator"], traits: ["Sure-handed"] },
  "john|riggins": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Physical"] },
  "cliff|branch": { abilities: ["Burner"], traits: ["Deep threat"] },
  "jalen|ramsey": { abilities: ["Blanket"], traits: ["Leader"] },
  "myles|garrett": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "nick|bosa": { abilities: ["Edge", "Finisher"], traits: [] },
  "joey|bosa": { abilities: ["Edge", "Bend"], traits: [] },
  "will|anderson": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "cj|stroud": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch"] },
  "c.j.|stroud": { abilities: ["Dead-eye", "Field general"], traits: ["Clutch"] },
  "caleb|williams": { abilities: ["Scrambler", "Cannon"], traits: ["Gunslinger"] },
  "drake|maye": { abilities: ["Cannon"], traits: ["Gunslinger"] },
  "rome|odunze": { abilities: ["Contested", "Sure hands"], traits: [] },
  "cam|ward": { abilities: ["Cannon", "Quick release"], traits: [] },
  "travis|hunter": { abilities: ["Blanket", "Sure hands"], traits: [] },
  "abdul|carter": { abilities: ["Edge", "Bend"], traits: ["High motor"] },
  "brock|bowers": { abilities: ["Move TE", "Sure hands"], traits: [] },
  "malik|nabers": { abilities: ["Contested", "YAC"], traits: [] },
  "fernando|mendoza": { abilities: ["Dead-eye", "Field general"], traits: ["Game manager"] },
  "jeremiyah|love": { abilities: ["Home run", "Elusive"], traits: ["Workhorse"] },
  "caleb|downs": { abilities: ["Ball hawk"], traits: ["Film junkie"] },
  "carnell|tate": { abilities: ["Contested", "Sure hands"], traits: [] },
  "david|bailey": { abilities: ["Edge", "Bend"], traits: [] },
  "billy|sims": { abilities: ["Home run", "Elusive"], traits: ["Workhorse"] },
  "mark|gastineau": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "mike|quick": { abilities: ["Burner", "Separator"], traits: ["Deep threat"] },
  "cris|collinsworth": { abilities: ["Sure hands", "Separator"], traits: ["Possession"] },
  "james|brooks": { abilities: ["Elusive", "Third-down back"], traits: ["Shifty"] },
  "freeman|mcneil": { abilities: ["Elusive"], traits: ["East-west"] },
  "bruce|matthews": { abilities: ["Anchor", "Mauler"], traits: ["Iron man", "Leader"] },
  "jim|covert": { abilities: ["Pocket brick", "Mauler"], traits: ["Iron man"] },
  "richard|dent": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "karl|mecklenburg": { abilities: ["Finisher", "Quarterback of D"], traits: ["Film junkie"] },
  "roger|craig": { abilities: ["Third-down back", "Elusive"], traits: ["Workhorse"] },
  "joey|browner": { abilities: ["Thumper", "Box safety"], traits: ["Enforcer"] },
  "boomer|esiason": { abilities: ["Cannon", "Field general"], traits: ["Gunslinger"] },
  "wilber|marshall": { abilities: ["Finisher", "Thumper"], traits: ["Enforcer"] },
  "chris|doleman": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "andre|reed": { abilities: ["Sure hands", "Separator"], traits: ["Sure-handed", "Clutch"] },
  "kevin|greene": { abilities: ["Edge", "Bend"], traits: ["High motor"] },
  "al|toon": { abilities: ["Contested", "Sure hands"], traits: ["Possession"] },
  "lomas|brown": { abilities: ["Pocket brick"], traits: ["Iron man"] },
  "ray|childress": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "jay|novacek": { abilities: ["Move TE", "Sure hands"], traits: ["Possession"] },
  "bo|jackson": { abilities: ["Home run", "North-south"], traits: ["Physical"] },
  "randall|cunningham": { abilities: ["Scrambler", "Cannon"], traits: ["Clutch"] },
  "leslie|oneal": { abilities: ["Edge", "Bend"], traits: [] },
  "christian|okoye": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Physical"] },
  "sterling|sharpe": { abilities: ["Sure hands", "Separator", "Contested"], traits: ["Sure-handed"] },
  "tim|brown": { abilities: ["Sure hands", "Separator"], traits: ["Return man", "Sure-handed"] },
  "randall|mcdaniel": { abilities: ["Mauler", "Puller"], traits: ["Iron man"] },
  "thurman|thomas": { abilities: ["Elusive", "Third-down back"], traits: ["Workhorse", "Clutch"] },
  "eric|allen": { abilities: ["Blanket", "Ball hawk"], traits: ["Film junkie"] },
  "cris|carter": { abilities: ["Sure hands", "Contested", "Red zone"], traits: ["Sure-handed"] },
  "steve|atwater": { abilities: ["Thumper", "Box safety"], traits: ["Enforcer", "Leader"] },
  "steve|wisniewski": { abilities: ["Mauler"], traits: ["Physical"] },
  "cortez|kennedy": { abilities: ["Two-gap", "Anchor"], traits: ["Run stuffer"] },
  "leroy|butler": { abilities: ["Ball hawk", "Box safety"], traits: ["Leader"] },
  "aeneas|williams": { abilities: ["Blanket", "Ball hawk"], traits: ["Film junkie"] },
  "herman|moore": { abilities: ["Contested", "Sure hands"], traits: [] },
  "ricky|watters": { abilities: ["Elusive", "Third-down back"], traits: ["Workhorse"] },
  "darren|woodson": { abilities: ["Box safety", "Thumper"], traits: ["Enforcer"] },
  "jimmy|smith": { abilities: ["Separator", "Sure hands"], traits: [] },
  "willie|roaf": { abilities: ["Pocket brick", "Mauler"], traits: ["Iron man"] },
  "jerome|bettis": { abilities: ["North-south", "Leg drive"], traits: ["Workhorse", "Physical"] },
  "drew|bledsoe": { abilities: ["Cannon"], traits: ["Gunslinger"] },
  "will|shields": { abilities: ["Mauler", "Anchor"], traits: ["Iron man"] },
  "john|lynch": { abilities: ["Thumper", "Box safety"], traits: ["Enforcer", "Leader"] },
  "isaac|bruce": { abilities: ["Separator", "Sure hands"], traits: [] },
  "larry|allen": { abilities: ["Mauler", "Anchor"], traits: ["Iron man", "Physical"] },
  "tony|boselli": { abilities: ["Pocket brick", "Mauler"], traits: ["Leader"] },
  "steve|mcnair": { abilities: ["Scrambler", "Cannon"], traits: ["Clutch", "Leader"] },
  "warren|sapp": { abilities: ["Edge", "Finisher"], traits: ["Leader"] },
  "ty|law": { abilities: ["Blanket", "Ball hawk"], traits: [] },
  "zach|thomas": { abilities: ["Thumper", "Quarterback of D"], traits: ["Film junkie"] },
  "simeon|rice": { abilities: ["Edge", "Bend"], traits: [] },
  "orlando|pace": { abilities: ["Pocket brick"], traits: ["Iron man"] },
  "warrick|dunn": { abilities: ["Elusive", "Home run"], traits: ["East-west"] },
  "ronde|barber": { abilities: ["Ball hawk", "Blanket"], traits: ["Film junkie"] },
  "fred|taylor": { abilities: ["Home run", "Elusive"], traits: [] },
  "alan|faneca": { abilities: ["Mauler", "Puller"], traits: ["Iron man"] },
  "hines|ward": { abilities: ["Contested", "Sure hands"], traits: ["Physical"] },
  "donovan|mcnabb": { abilities: ["Scrambler", "Field general"], traits: ["Leader"] },
  "ricky|williams": { abilities: ["North-south", "Elusive"], traits: ["Workhorse"] },
  "torry|holt": { abilities: ["Separator", "Sure hands"], traits: ["Sure-handed"] },
  "champ|bailey": { abilities: ["Blanket", "Recovery"], traits: ["Film junkie"] },
  "jevon|kearse": { abilities: ["Edge", "Bend"], traits: ["High motor"] },
  "daunte|culpepper": { abilities: ["Cannon", "Scrambler"], traits: ["Physical"] },
  "donald|driver": { abilities: ["Sure hands", "Separator"], traits: ["Sure-handed"] },
  "jason|taylor": { abilities: ["Edge", "Finisher"], traits: ["High motor"] },
  "olin|kreutz": { abilities: ["Anchor"], traits: ["Leader"] },
  "gary|zimmerman": { abilities: ["Pocket brick"], traits: ["Iron man"] },
  "gary|anderson": { abilities: ["Ice", "Leg"], traits: ["Clutch"] },
  "pat|swilling": { abilities: ["Edge", "Bend"], traits: [] },
};

export function signatureKit(first: string, last: string, _pos?: Pos): { abilities: string[]; traits: string[] } {
  const key = `${first}|${last}`.toLowerCase().replace(/\./g, "");
  const hit =
    SIGNATURES[key] ??
    SIGNATURES[`${first.split(" ").pop() ?? first}|${last}`.toLowerCase()] ??
    Object.entries(SIGNATURES).find(([k]) => key.includes(k) || k === key)?.[1];
  return { abilities: hit?.abilities ?? [], traits: hit?.traits ?? [] };
}

export function assignKit(pos: Pos, ratings: Ratings, first: string, last: string): { abilities: string[]; traits: string[] } {
  const sig = signatureKit(first, last, pos);
  const abilities = unique([...sig.abilities, ...abilitiesFrom(pos, ratings)]);
  const traits = unique([...sig.traits, ...traitsFrom(pos, ratings)]);
  if (!abilities.length) abilities.push(bestAbility(pos, ratings));
  if (!traits.length) traits.push(bestTrait(pos, ratings));
  return {
    abilities: abilities.slice(0, 4),
    traits: traits.slice(0, 3),
  };
}

export function abilityLine(p: Player): string {
  const bits = [...(p.abilities ?? []), ...(p.traits ?? [])];
  return bits.length ? bits.join(" · ") : "—";
}

export function kitBoost(p: Player | undefined, key: keyof KitDef): number {
  if (!p) return 0;
  let n = 0;
  for (const name of [...(p.abilities ?? []), ...(p.traits ?? [])]) {
    const d = ALL_DEFS[name];
    const v = d?.[key];
    if (typeof v === "number" && key !== "inj") n += v;
  }
  return n;
}

/** Injury multipliers stack as a product (Iron 0.55 × Glass 1.85), never a sum. */
export function kitInjMult(p: Player): number {
  let m = 1;
  for (const name of [...(p.abilities ?? []), ...(p.traits ?? [])]) {
    const v = ALL_DEFS[name]?.inj;
    if (typeof v === "number" && v > 0) m *= v;
  }
  if (m < 0.3) return 0.3;
  if (m > 2.2) return 2.2;
  return m;
}

export function kitShare(p: Player, key: "recShare" | "rushShare" | "sackShare" | "intShare"): number {
  return 1 + kitBoost(p, key);
}

function unique(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}
