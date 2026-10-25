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
  /** iOS gives Premium/Enhanced voices the same name as the compact one; only this tells them apart. */
  voiceURI?: string;
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
  /\b(bahh|bells|boing|bubbles|cellos|wobble|whisper|zarvox|trinoids|organ|jester|hysterical|good news|bad news|superstar|deranged|pipe organ|albert|fred|junior|kathy|ralph)\b/i;

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

/** 2 = Premium, 1 = Enhanced/Natural/Neural, 0 = the standard compact voice. */
export function voiceTier(v: VoiceLike): number {
  const id = `${v.name} ${v.voiceURI ?? ""}`;
  if (/premium/i.test(id)) return 2;
  if (/enhanced|natural|neural|online/i.test(id)) return 1;
  return 0;
}

/**
 * The menu choice that leaves the lead voice to the phone itself: no voice is set on the line,
 * so iOS can read it in the voice picked under Spoken Content, which Safari won't hand to pages.
 */
export const PHONE_VOICE = "phone";

/** The key a chosen voice is saved under: the voiceURI where the browser gives one. */
export const voiceKey = (v: VoiceLike) => v.voiceURI || v.name;

const REGION: Record<string, string> = { US: "US", GB: "UK", AU: "Australia", IE: "Ireland", IN: "India", ZA: "South Africa", CA: "Canada", NZ: "New Zealand" };

/** What the voice menu shows, e.g. "Nathan · Enhanced · US". */
export function voiceLabel(v: VoiceLike): string {
  const tier = voiceTier(v);
  const name = v.name.replace(/\s*\((premium|enhanced)\)\s*/i, " ").trim();
  const region = REGION[(v.lang.split(/[-_]/)[1] ?? "").toUpperCase()];
  return [name, tier === 2 ? "Premium" : tier === 1 && !/natural|neural|online/i.test(v.name) ? "Enhanced" : "", region].filter(Boolean).join(" · ");
}

/** English voices fit for a broadcast, best first, one entry per voice, no novelty voices. */
export function voiceChoices<V extends VoiceLike>(all: V[]): V[] {
  const seen = new Set<string>();
  return all
    .filter((v) => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name))
    // iOS lists some voices twice under different IDs; one entry per voice a person can hear.
    .filter((v) => {
      const k = [voiceKey(v), voiceLabel(v)].find((x) => seen.has(x));
      if (k) return false;
      seen.add(voiceKey(v));
      seen.add(voiceLabel(v));
      return true;
    })
    .sort((a, b) => voiceTier(b) - voiceTier(a) || voiceLabel(a).localeCompare(voiceLabel(b)));
}

/** A saved choice (voiceURI, or a name from older saves) back to the voice, best tier first. */
export function findVoice<V extends VoiceLike>(all: V[], chosen: string | undefined): V | undefined {
  if (!chosen) return undefined;
  return all.find((v) => v.voiceURI === chosen) ?? all.filter((v) => v.name === chosen).sort((a, b) => voiceTier(b) - voiceTier(a))[0];
}

function quality(v: VoiceLike): number {
  let q = 0;
  q += voiceTier(v) * 4;
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
export function castVoices<V extends VoiceLike>(all: V[], personas: Persona[], preferred?: string | Partial<Record<string, string>>): Map<string, Casting<V>> {
  const english = all.filter((v) => /^en([-_]|$)/i.test(v.lang) && !NOVELTY.test(v.name));
  const ranked = english.slice().sort((a, b) => quality(b) - quality(a));
  const used = new Map<string, number>();
  const out = new Map<string, Casting<V>>();
  personas.forEach((p, i) => {
    const selected = typeof preferred === "string" ? (i === 0 ? preferred : undefined) : preferred?.[p.key];
    let voice: V | undefined;
    if (selected === PHONE_VOICE) {
      out.set(p.key, { pitch: p.pitch ?? 1, rate: p.rate ?? 1 });
      return;
    }
    if (selected) voice = findVoice(english, selected);
    const matches = ranked.filter((v) => voiceGender(v) === p.gender);
    const unknown = ranked.filter((v) => voiceGender(v) === undefined);
    voice ??=
      matches.find((v) => !used.has(voiceKey(v))) ??
      unknown.find((v) => !used.has(voiceKey(v))) ??
      matches[0] ??
      unknown[0] ??
      ranked.find((v) => voiceGender(v) !== (p.gender === "m" ? "f" : "m")) ??
      ranked[0];
    const reuse = voice ? used.get(voiceKey(voice)) ?? 0 : 0;
    if (voice) used.set(voiceKey(voice), reuse + 1);
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
