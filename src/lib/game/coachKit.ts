/** Coach abilities / traits. Feed the sim the same way player kits do. */
import type { Coach, CoachRole, DefScheme, OffScheme } from "./types.ts";

export interface CoachKitDef {
  desc: string;
  offPass?: number;
  offRun?: number;
  defPass?: number;
  defRun?: number;
  clutch?: number;
  /** Penalty-rate multiplier delta. Negative = cleaner football. */
  pen?: number;
  /** Extra chance a young starter gains a point. */
  dev?: number;
  /** Blend toward true ovr on draft day. 0–1. */
  eval?: number;
}

export const COACH_ABILITY_DEFS: Record<string, CoachKitDef> = {
  Genius: { desc: "The board is a week ahead of the league.", offPass: 2.2, offRun: 1.2, defPass: 1.0 },
  "Play-caller": { desc: "The play is in before the defense sets.", offPass: 2.8, clutch: 0.6 },
  "Ground game": { desc: "They will run it until you stop it.", offRun: 3.2 },
  Vertical: { desc: "Takes the top off and lives with the incompletions.", offPass: 3.0 },
  "West coast": { desc: "Timing, spacing, the ball comes out on the third step.", offPass: 2.2, offRun: 0.6 },
  "Defensive genius": { desc: "The front is a riddle. The coverage is the answer.", defPass: 3.0, defRun: 1.6 },
  "Run stuffer": { desc: "First down dies at the line.", defRun: 2.8 },
  "Blitz artist": { desc: "Five and six. The quarterback is uncomfortable.", defPass: 1.8 },
  "Cover-2 mind": { desc: "Two deep. Tackle well. Take away the big play.", defPass: 2.2 },
  Motivator: { desc: "The room plays bigger than the board.", clutch: 2.2, offRun: 0.6, defRun: 0.6 },
  Disciplinarian: { desc: "False starts get you a seat. The flags stay in the pocket.", pen: -0.22 },
  Developer: { desc: "Kids leave camp better than they arrived.", dev: 0.18 },
  Evaluator: { desc: "Sees the player, not the workout.", eval: 0.35 },
  Innovator: { desc: "The league copies him two years late.", offPass: 1.4, defPass: 1.0 },
  Situational: { desc: "Fourth down, two-minute, the weather — he has the card.", clutch: 1.8 },
  "Clock manager": { desc: "Does not beat himself with the timeout.", clutch: 0.8 },
  "Old school": { desc: "Three yards and a cloud of dust. November is the point.", offRun: 1.6, defRun: 1.2, pen: -0.08 },
  "Players' coach": { desc: "The veterans run through a wall for him.", clutch: 1.4, offPass: 0.4, offRun: 0.4 },
};

export const COACH_TRAIT_DEFS: Record<string, CoachKitDef> = {
  Conservative: { desc: "Punts from the plus-40. Lives to play defense.", clutch: -0.4 },
  Aggressive: { desc: "Goes for it. The room loves it until it doesn't.", clutch: 0.8, offPass: 0.4 },
  Loyal: { desc: "Keeps his coordinators. The building is quiet.", dev: 0.06 },
  "Sideline rage": { desc: "The officials hear about it. Sometimes the flags do too.", pen: 0.08, clutch: 0.6 },
  "Film junkie": { desc: "Tendency is a language.", defPass: 0.6, offPass: 0.6 },
  Teacher: { desc: "The backups know the call.", dev: 0.1 },
  "Talent hawk": { desc: "Will take the best player even if the board says otherwise.", eval: 0.2 },
  Stubborn: { desc: "His scheme. His way. The personnel can catch up.", offRun: 0.4, defRun: 0.4 },
  Adaptive: { desc: "Changes the call sheet when the film says so.", clutch: 0.6 },
};

const ALL: Record<string, CoachKitDef> = { ...COACH_ABILITY_DEFS, ...COACH_TRAIT_DEFS };

export function coachKitDef(name: string): CoachKitDef | undefined {
  return ALL[name];
}

export function coachKitLine(name: string): string {
  const d = ALL[name];
  if (!d) return name;
  const fx: string[] = [];
  if (d.offPass) fx.push("boosts the passing unit");
  if (d.offRun) fx.push("boosts the run");
  if (d.defPass) fx.push("tightens coverage");
  if (d.defRun) fx.push("stuffs the run");
  if (d.clutch) fx.push(d.clutch > 0 ? "bigger in the fourth" : "plays not to lose");
  if (d.pen && d.pen < 0) fx.push("fewer flags");
  if (d.pen && d.pen > 0) fx.push("more flags");
  if (d.dev) fx.push("develops young players");
  if (d.eval) fx.push("grades the board");
  return fx.length ? `${d.desc} (${fx.join("; ")})` : d.desc;
}

export function coachKitBoost(c: Coach | undefined, key: keyof CoachKitDef): number {
  if (!c) return 0;
  let n = 0;
  for (const name of [...(c.abilities ?? []), ...(c.traits ?? [])]) {
    const v = ALL[name]?.[key];
    if (typeof v === "number") n += v;
  }
  if (c.role === "OC" && (key === "defPass" || key === "defRun")) n *= 0.2;
  if (c.role === "DC" && (key === "offPass" || key === "offRun")) n *= 0.2;
  if (c.role === "OC" && (key === "offPass" || key === "offRun")) n *= 1.15;
  if (c.role === "DC" && (key === "defPass" || key === "defRun")) n *= 1.15;
  return n;
}

const SIGNATURES: Record<string, { abilities: string[]; traits: string[]; off?: OffScheme; def?: DefScheme }> = {
  lombardi: { abilities: ["Motivator", "Ground game", "Disciplinarian"], traits: ["Old school", "Stubborn"], off: "smashmouth", def: "4-3" },
  "shula-clt": { abilities: ["Genius", "Disciplinarian", "Clock manager"], traits: ["Film junkie"], off: "multiple", def: "4-3" },
  "shula-mia": { abilities: ["Genius", "Disciplinarian", "Clock manager"], traits: ["Film junkie"], off: "multiple", def: "4-3" },
  landry: { abilities: ["Defensive genius", "Innovator", "Situational"], traits: ["Film junkie", "Conservative"], off: "multiple", def: "4-3" },
  halas: { abilities: ["Old school", "Motivator", "Ground game"], traits: ["Stubborn", "Loyal"], off: "smashmouth", def: "4-3" },
  collier: { abilities: ["Play-caller", "Developer"], traits: ["Teacher"], off: "multiple", def: "4-3" },
  "allen-ram": { abilities: ["Defensive genius", "Evaluator"], traits: ["Talent hawk", "Conservative"], off: "multiple", def: "cover-2" },
  vanbrocklin: { abilities: ["Play-caller"], traits: ["Sideline rage"], off: "vertical", def: "4-3" },
  gillman: { abilities: ["Vertical", "Innovator", "Play-caller"], traits: ["Film junkie"], off: "vertical", def: "4-3" },
  stram: { abilities: ["Innovator", "Play-caller"], traits: ["Adaptive"], off: "multiple", def: "4-3" },
  ewbank: { abilities: ["Developer", "Play-caller"], traits: ["Teacher", "Loyal"], off: "vertical", def: "4-3" },
  noll: { abilities: ["Developer", "Defensive genius", "Evaluator"], traits: ["Teacher", "Loyal"], off: "multiple", def: "4-3" },
  maddden: { abilities: ["Motivator", "Vertical"], traits: ["Players' coach", "Sideline rage"], off: "vertical", def: "4-3" },
  grant: { abilities: ["Disciplinarian", "Defensive genius"], traits: ["Conservative", "Old school"], off: "smashmouth", def: "4-3" },
  walsh: { abilities: ["West coast", "Play-caller", "Developer"], traits: ["Teacher", "Film junkie"], off: "westcoast", def: "4-3" },
  gibbs: { abilities: ["Play-caller", "Motivator", "Situational"], traits: ["Adaptive"], off: "multiple", def: "4-3" },
  parcells: { abilities: ["Motivator", "Defensive genius"], traits: ["Sideline rage", "Players' coach"], off: "multiple", def: "3-4" },
  belichick: { abilities: ["Defensive genius", "Evaluator", "Situational"], traits: ["Film junkie", "Adaptive"], off: "multiple", def: "3-4" },
  "johnson-dal": { abilities: ["Evaluator", "Motivator"], traits: ["Talent hawk", "Aggressive"], off: "multiple", def: "4-3" },
  dunn: { abilities: ["Cover-2 mind", "Developer"], traits: ["Teacher", "Loyal"], off: "multiple", def: "cover-2" },
  reid: { abilities: ["Play-caller", "Developer", "West coast"], traits: ["Players' coach"], off: "westcoast", def: "4-3" },
  ditka: { abilities: ["Motivator", "Ground game"], traits: ["Sideline rage", "Old school"], off: "smashmouth", def: "4-3" },
  cowher: { abilities: ["Motivator", "Defensive genius"], traits: ["Sideline rage", "Players' coach"], off: "multiple", def: "3-4" },
  holmgren: { abilities: ["West coast", "Play-caller"], traits: ["Teacher"], off: "westcoast", def: "4-3" },
  seifert: { abilities: ["Defensive genius", "West coast"], traits: ["Loyal"], off: "westcoast", def: "4-3" },
  knox: { abilities: ["Ground game", "Run stuffer"], traits: ["Old school", "Conservative"], off: "smashmouth", def: "4-3" },
  vermeil: { abilities: ["Motivator", "Play-caller"], traits: ["Players' coach"], off: "vertical", def: "4-3" },
  gruden: { abilities: ["Play-caller", "Vertical"], traits: ["Film junkie", "Sideline rage"], off: "vertical", def: "4-3" },
  pbrown: { abilities: ["Genius", "Developer", "Disciplinarian"], traits: ["Teacher", "Stubborn"], off: "multiple", def: "4-3" },
  fears: { abilities: ["Play-caller"], traits: ["Teacher"], off: "vertical", def: "4-3" },
  mckay: { abilities: ["Ground game"], traits: ["Old school"], off: "smashmouth", def: "4-3" },
  patera: { abilities: ["Defensive genius"], traits: ["Stubborn"], off: "multiple", def: "4-3" },
  coughlin: { abilities: ["Disciplinarian", "Situational"], traits: ["Stubborn"], off: "multiple", def: "4-3" },
  "capers-car": { abilities: ["Defensive genius", "Cover-2 mind"], traits: ["Film junkie"], off: "multiple", def: "cover-2" },
  "capers-htx": { abilities: ["Defensive genius"], traits: ["Film junkie"], off: "multiple", def: "cover-2" },
  "marchibroda-rav": { abilities: ["Play-caller"], traits: ["Teacher"], off: "multiple", def: "4-3" },
  "gillman-dc": { abilities: ["Defensive genius", "Developer"], traits: ["Teacher"], def: "4-3" },
  "stram-oc": { abilities: ["West coast", "Play-caller"], traits: ["Teacher"], off: "westcoast" },
  "bengtson-dc": { abilities: ["Defensive genius"], traits: ["Loyal"], def: "4-3" },
  "shula-dc": { abilities: ["Defensive genius"], traits: ["Film junkie"], def: "4-3" },
  "halas-dc": { abilities: ["Defensive genius", "Evaluator"], traits: ["Talent hawk"], def: "cover-2" },
  "rauch-oc": { abilities: ["Motivator", "Play-caller"], traits: ["Players' coach"], off: "vertical" },
  coryell: { abilities: ["Vertical", "Play-caller"], traits: ["Aggressive"], off: "vertical", def: "4-3" },
  levy: { abilities: ["Motivator", "Disciplinarian"], traits: ["Teacher"], off: "multiple", def: "3-4" },
  flores: { abilities: ["Play-caller", "Motivator"], traits: ["Adaptive"], off: "vertical", def: "4-3" },
  shanahan: { abilities: ["Play-caller", "Ground game", "West coast"], traits: ["Film junkie"], off: "westcoast", def: "4-3" },
  carroll: { abilities: ["Motivator", "Defensive genius"], traits: ["Players' coach", "Aggressive"], off: "multiple", def: "4-3" },
  tomlin: { abilities: ["Motivator", "Situational"], traits: ["Players' coach"], off: "multiple", def: "3-4" },
  harbaugh: { abilities: ["Disciplinarian", "Situational"], traits: ["Stubborn"], off: "multiple", def: "3-4" },
  mcvay: { abilities: ["Play-caller", "Innovator"], traits: ["Film junkie", "Aggressive"], off: "westcoast", def: "3-4" },
  payton: { abilities: ["Defensive genius", "Motivator"], traits: ["Players' coach"], off: "multiple", def: "4-3" },
  reidandy: { abilities: ["Play-caller"], traits: ["Players' coach"] },
};

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

export function signatureCoach(id: string, name: string): { abilities: string[]; traits: string[]; off?: OffScheme; def?: DefScheme } | undefined {
  const byId = SIGNATURES[id];
  if (byId) return byId;
  const last = name.split(" ").pop()?.toLowerCase() ?? "";
  return SIGNATURES[last];
}

export function abilitiesFromCoach(c: Pick<Coach, "offense" | "defense" | "leadership" | "development" | "evaluation" | "offScheme" | "defScheme" | "role">): string[] {
  const out: string[] = [];
  if (c.role === "OC" || c.offense >= c.defense) {
    if (c.offScheme === "smashmouth" && c.offense >= 74) out.push("Ground game");
    else if (c.offScheme === "vertical" && c.offense >= 74) out.push("Vertical");
    else if (c.offScheme === "westcoast" && c.offense >= 74) out.push("West coast");
    else if (c.offense >= 88) out.push("Play-caller");
    else if (c.offense >= 80) out.push("Genius");
  }
  if (c.role === "DC" || c.defense >= c.offense) {
    if (c.defScheme === "cover-2" && c.defense >= 74) out.push("Cover-2 mind");
    else if (c.defense >= 90) out.push("Defensive genius");
    else if (c.defScheme === "3-4") out.push("Blitz artist");
    else if (c.defense >= 80) out.push("Run stuffer");
  }
  if (c.leadership >= 86) out.push("Motivator");
  else if (c.leadership >= 80) out.push("Players' coach");
  if (c.development >= 84) out.push("Developer");
  if (c.evaluation >= 84) out.push("Evaluator");
  if (c.leadership >= 82 && c.offense >= 78) out.push("Disciplinarian");
  if (c.offense >= 86 && c.defense >= 82) out.push("Situational");
  return unique(out).slice(0, 3);
}

export function traitsFromCoach(c: Pick<Coach, "leadership" | "development" | "evaluation" | "offense" | "age">): string[] {
  const out: string[] = [];
  if (c.age >= 62) out.push("Old school");
  if (c.evaluation >= 80) out.push("Talent hawk");
  if (c.development >= 78) out.push("Teacher");
  if (c.leadership >= 84) out.push("Players' coach");
  if (c.offense >= 82 && c.leadership < 70) out.push("Film junkie");
  else if (c.leadership < 62) out.push("Sideline rage");
  if (c.leadership >= 78 && c.evaluation < 70) out.push("Loyal");
  if (out.length < 2) out.push(c.offense >= 80 ? "Adaptive" : "Conservative");
  return unique(out).slice(0, 2);
}

export function assignCoachKit(c: Coach): { abilities: string[]; traits: string[] } {
  const sig = signatureCoach(c.id, c.name);
  const abilities = unique([...(sig?.abilities ?? []), ...abilitiesFromCoach(c)]);
  const traits = unique([...(sig?.traits ?? []), ...traitsFromCoach(c)]);
  if (!abilities.length) abilities.push(c.offense >= c.defense ? "Play-caller" : "Defensive genius");
  if (!traits.length) traits.push("Film junkie");
  return { abilities: abilities.slice(0, 4), traits: traits.slice(0, 3) };
}

export function coachAbilityLine(c: Coach): string {
  const bits = [...(c.abilities ?? []), ...(c.traits ?? [])];
  return bits.length ? bits.join(" · ") : "—";
}

export function schemeOfSignature(id: string, name: string): { off?: OffScheme; def?: DefScheme } {
  const s = signatureCoach(id, name);
  return { off: s?.off, def: s?.def };
}

export function roleLabel(role: CoachRole): string {
  if (role === "HC") return "Head coach";
  if (role === "OC") return "Offensive coordinator";
  return "Defensive coordinator";
}
