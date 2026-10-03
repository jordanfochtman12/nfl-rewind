/**
 * Casting the broadcast: every on-air person gets a voice of their own that matches them.
 * Browsers only tell us a voice's name and language, so gender comes from the names the big
 * platforms use (Microsoft, Apple, Google, Amazon); quality from the "Natural"/"Neural"/
 * "Premium" markers. When a device has fewer matching voices than people on the set, the
 * same voice is reused with a different pitch and pace so the desk still sounds like a crew.
 */

export type Gender = "m" | "f";

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

export interface Persona {
  /** Stable key for this person, e.g. their name. */
  key: string;
  gender: Gender;
  /** Small nudges that make a voice sound like this one person (1 = the voice's own). */
  pitch?: number;
  rate?: number;
}

export interface Casting<V extends VoiceLike = VoiceLike> {
  voice?: V;
  pitch: number;
  rate: number;
}

const FEMALE =
  /\b(female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|michelle|ava|allison|susan|serena|kate|nicky|emma|sonia|libby|natasha|joanna|salli|kimberly|ivy|kendra|amy|olivia|ruth|clara|catherine|hazel|heera|linda|heather|elizabeth|sara|nancy|jane|ashley|cora|monica|aditi|veena|lekha|kathy|vicki|agnes|shelley|flo|sandy|martha|emily|isabella|maisie|mia|molly|abbie|bella|joelle|noelle|zoe|nora|ana|jessa|aurora|lily|ellie|ruby|anna|alice|amelie|amber|ashley|michelle|nova)\b/i;
const MALE =
  /\b(male|guy|davis|tony|jason|andrew|brian|christopher|eric|roger|steffan|ryan|thomas|george|daniel|alex|fred|tom|aaron|arthur|evan|nathan|reed|rocko|eddy|ralph|bruce|oliver|gordon|lee|rishi|james|william|liam|mark|david|richard|matthew|joey|justin|kevin|russell|geraint|brandon|ethan|noah|jacob|connor|elliot|harry|alfie|jack|oscar|sam|ollie|dan|grandpa|stephen|gregory|kai|luke|mitchell|neil|william|wayne|tim|duncan|prabhat|ravi)\b/i;
/** Novelty voices nobody wants calling a football game. */
const NOVELTY =
  /\b(bahh|bells|boing|bubbles|cellos|wobble|whisper|zarvox|trinoids|organ|jester|hysterical|good news|bad news|superstar|deranged|pipe organ|albert)\b/i;

export function voiceGender(v: VoiceLike): Gender | undefined {
  // "Google UK English Male/Female" spell it out; Google's plain US English voice is a woman.
  if (/\bfemale\b/i.test(v.name)) return "f";
  if (/\bmale\b/i.test(v.name)) return "m";
  if (/^Google US English$/i.test(v.name.trim())) return "f";
  const f = FEMALE.test(v.name);
  const m = MALE.test(v.name);
  if (f && !m) return "f";
  if (m && !f) return "m";
  return undefined;
}

function quality(v: VoiceLike): number {
  let q = 0;
  if (/natural|neural|premium|enhanced|online/i.test(v.name)) q += 6;
  if (/google/i.test(v.name)) q += 3;
  if (/^en[-_]US/i.test(v.lang)) q += 4;
  else if (/^en[-_](CA)/i.test(v.lang)) q += 2;
  else if (/^en[-_](GB|AU|IE|NZ)/i.test(v.lang)) q += 1;
  return q;
}

/**
 * One voice per persona, in order (put the host first). A user's chosen voice, when given,
 * goes to the first persona.
 */
export function castVoices<V extends VoiceLike>(all: V[], personas: Persona[], preferred?: string): Map<string, Casting<V>> {
  const english = all.filter((v) => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name));
  const ranked = english.slice().sort((a, b) => quality(b) - quality(a));
  const used = new Map<string, number>();
  const out = new Map<string, Casting<V>>();
  personas.forEach((p, i) => {
    let voice: V | undefined;
    if (i === 0 && preferred) voice = english.find((v) => v.name === preferred);
    const matches = ranked.filter((v) => voiceGender(v) === p.gender);
    const unknown = ranked.filter((v) => voiceGender(v) === undefined);
    voice ??=
      matches.find((v) => !used.has(v.name)) ??
      unknown.find((v) => !used.has(v.name)) ??
      matches[0] ??
      unknown[0] ??
      ranked.find((v) => voiceGender(v) !== (p.gender === "m" ? "f" : "m")) ??
      ranked[0];
    const reuse = voice ? used.get(voice.name) ?? 0 : 0;
    if (voice) used.set(voice.name, reuse + 1);
    const g = voice ? voiceGender(voice) : undefined;
    // A shared or ungendered voice gets pushed toward the person: lower for men, higher for
    // women, and a step apart for every extra person on the same voice.
    let pitch = p.pitch ?? 1;
    if (g !== p.gender) pitch *= p.gender === "m" ? 0.82 : 1.18;
    if (reuse) pitch *= reuse % 2 ? 0.9 : 1.1;
    const rate = (p.rate ?? 1) * (reuse ? (reuse % 2 ? 1.06 : 0.94) : 1);
    out.set(p.key, { voice, pitch: Math.max(0.5, Math.min(1.6, pitch)), rate });
  });
  return out;
}
