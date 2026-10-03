import type {
  Coach,
  CoachRole,
  DefScheme,
  DynastySave,
  GmResult,
  OffScheme,
  TeamId,
} from "./types.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { COORDINATORS_1966, LATER_COACHES, type CoachSeed } from "./data/coaches.ts";
import { MORE_COACHES } from "./data/coachesMore.ts";
import { addNews } from "./news.ts";
import { rand, randInt } from "./rng.ts";
import { winPct } from "./standings.ts";
import { eraName } from "./names.ts";
import { assignCoachKit, schemeOfSignature } from "./coachKit.ts";
import { syncDepth } from "./players.ts";
import { applyStaffSchemes, syncRealSchemes } from "./gameplans.ts";
import { playbookFor } from "./data/coachPlans.ts";
import { EXPANSION_SPECS } from "./data/expansions.ts";

const OFF_SCHEMES: OffScheme[] = ["smashmouth", "vertical", "westcoast", "multiple"];
const DEF_SCHEMES: DefScheme[] = ["4-3", "3-4", "wide-9", "cover-2"];

const TEAM_OFF: Partial<Record<TeamId, OffScheme>> = {
  gnb: "smashmouth",
  chi: "smashmouth",
  cle: "smashmouth",
  sdg: "vertical",
  rai: "vertical",
  dal: "multiple",
  kan: "multiple",
  nyj: "vertical",
  clt: "multiple",
};

const TEAM_DEF: Partial<Record<TeamId, DefScheme>> = {
  gnb: "4-3",
  chi: "4-3",
  ram: "cover-2",
  dal: "4-3",
  pit: "4-3",
  min: "4-3",
};

function clampStat(n: number): number {
  return Math.max(40, Math.min(99, Math.round(n)));
}

export function fillCoachFields(c: Coach, year: number): Coach {
  c.role = c.role ?? "HC";
  c.offScheme = c.offScheme ?? "multiple";
  c.defScheme = c.defScheme ?? "4-3";
  c.yearsOnJob = c.yearsOnJob ?? 1;
  c.careerWins = c.careerWins ?? 0;
  c.careerLosses = c.careerLosses ?? 0;
  c.careerTies = c.careerTies ?? 0;
  c.careerTitles = c.careerTitles ?? 0;
  c.careerBowls = c.careerBowls ?? 0;
  c.yearsCoaching = c.yearsCoaching ?? Math.max(1, c.yearsOnJob ?? 1);
  c.firedCount = c.firedCount ?? 0;
  c.leadership = c.leadership ?? 70;
  c.development = c.development ?? 70;
  c.evaluation = c.evaluation ?? 70;
  if (c.born) {
    const raw = year - c.born;
    c.age = c.yearAvail > year ? Math.max(30, c.yearAvail - c.born - 2) : raw;
  } else {
    c.age = c.age ?? (c.role === "HC" ? 48 : 42);
    c.born = year - c.age;
  }
  c.potential = c.potential ?? Math.min(99, Math.max(c.offense, c.defense) + 4);
  c.peakOffense = Math.max(c.peakOffense ?? 0, c.offense);
  c.peakDefense = Math.max(c.peakDefense ?? 0, c.defense);
  c.abilities = c.abilities ?? [];
  c.traits = c.traits ?? [];
  if (!c.abilities.length) {
    const kit = assignCoachKit(c);
    c.abilities = kit.abilities;
    c.traits = kit.traits;
  }
  return c;
}

export function makeCoachFromSeed(seed: CoachSeed, year: number, extra?: Partial<Coach>): Coach {
  const sig = schemeOfSignature(seed.id, seed.name);
  const book = playbookFor(seed.id, year);
  const c: Coach = {
    id: seed.id,
    name: seed.name,
    teamId: extra?.teamId !== undefined ? extra.teamId : seed.teamId,
    yearAvail: seed.yearAvail,
    offense: seed.offense,
    defense: seed.defense,
    historical: true,
    role: extra?.role ?? "HC",
    offScheme: extra?.offScheme ?? book?.off ?? seed.offScheme ?? sig.off ?? "multiple",
    defScheme: extra?.defScheme ?? book?.def ?? seed.defScheme ?? sig.def ?? "4-3",
    yearsOnJob: extra?.yearsOnJob ?? seed.yearsOnJob ?? 1,
    careerWins: extra?.careerWins ?? seed.careerWins ?? 0,
    careerLosses: extra?.careerLosses ?? seed.careerLosses ?? 0,
    careerTies: extra?.careerTies ?? seed.careerTies ?? 0,
    careerTitles: extra?.careerTitles ?? seed.careerTitles ?? 0,
    careerBowls: extra?.careerBowls ?? 0,
    yearsCoaching: extra?.yearsCoaching ?? seed.yearsOnJob ?? 3,
    age: 0,
    born: seed.born,
    potential: Math.min(99, Math.max(seed.offense, seed.defense) + 3),
    peakOffense: seed.offense,
    peakDefense: seed.defense,
    leadership: extra?.leadership ?? seed.leadership ?? 74,
    development: extra?.development ?? seed.development ?? 74,
    evaluation: extra?.evaluation ?? seed.evaluation ?? 74,
    abilities: extra?.abilities ?? [],
    traits: extra?.traits ?? [],
    firedCount: extra?.firedCount ?? 0,
  };
  return fillCoachFields(c, year);
}

function bump(seed: CoachSeed, role: CoachRole, year: number, extra?: Partial<Coach>): Coach {
  return makeCoachFromSeed(seed, year, { ...extra, role });
}

function genCoord(save: DynastySave, teamId: TeamId, role: "OC" | "DC" | "HC"): Coach {
  const nm = eraName(save);
  save.nextPlayerSeq += 1;
  const id = `c-${role.toLowerCase()}-${teamId}-${save.nextPlayerSeq}`;
  const off = role === "DC" ? randInt(save, 58, 78) : randInt(save, 68, 88);
  const def = role === "OC" ? randInt(save, 58, 78) : randInt(save, 68, 88);
  const age = role === "HC" ? randInt(save, 38, 56) : randInt(save, 32, 52);
  const c: Coach = {
    id,
    name: `${nm.first} ${nm.last}`,
    teamId,
    yearAvail: save.year,
    offense: off,
    defense: def,
    historical: false,
    role,
    offScheme: TEAM_OFF[teamId] ?? OFF_SCHEMES[randInt(save, 0, 3)]!,
    defScheme: TEAM_DEF[teamId] ?? DEF_SCHEMES[randInt(save, 0, 3)]!,
    yearsOnJob: 1,
    careerWins: 0,
    careerLosses: 0,
    careerTies: 0,
    careerTitles: 0,
    careerBowls: 0,
    yearsCoaching: randInt(save, 2, 12),
    age,
    born: save.year - age,
    potential: Math.min(99, Math.max(off, def) + randInt(save, 1, 8)),
    peakOffense: off,
    peakDefense: def,
    leadership: randInt(save, 62, 88),
    development: randInt(save, 62, 88),
    evaluation: randInt(save, 62, 88),
    abilities: [],
    traits: [],
    firedCount: 0,
  };
  const kit = assignCoachKit(c);
  c.abilities = kit.abilities;
  c.traits = kit.traits;
  return c;
}

export function seedStaff(save: DynastySave): void {
  for (const c of Object.values(save.coaches)) fillCoachFields(c, save.year);
  for (const seed of COORDINATORS_1966) {
    const role: CoachRole = seed.id.includes("-oc") ? "OC" : "DC";
    const coach = bump(seed, role, save.year, {
      offScheme: playbookFor(seed.id, save.year)?.off ?? seed.offScheme ?? TEAM_OFF[seed.teamId ?? "gnb"] ?? "multiple",
      defScheme: playbookFor(seed.id, save.year)?.def ?? seed.defScheme ?? TEAM_DEF[seed.teamId ?? "gnb"] ?? "4-3",
      teamId: seed.teamId,
    });
    save.coaches[coach.id] = coach;
    if (seed.teamId && save.teams[seed.teamId]) {
      if (role === "OC") save.teams[seed.teamId].ocId = coach.id;
      else save.teams[seed.teamId].dcId = coach.id;
    }
  }
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    t.offScheme = TEAM_OFF[id] ?? t.offScheme ?? "multiple";
    t.defScheme = TEAM_DEF[id] ?? t.defScheme ?? "4-3";
    t.draftStyle = draftStyleOf(id);
    const hc = t.coachId ? save.coaches[t.coachId] : undefined;
    if (hc) {
      t.offScheme = hc.offScheme;
      t.defScheme = hc.defScheme;
    }
    if (!t.ocId) {
      const oc = genCoord(save, id, "OC");
      save.coaches[oc.id] = oc;
      t.ocId = oc.id;
    }
    if (!t.dcId) {
      const dc = genCoord(save, id, "DC");
      save.coaches[dc.id] = dc;
      t.dcId = dc.id;
    }
  }
}

export function draftStyleOf(id: TeamId): import("./types.ts").DraftStyle {
  const map: Partial<Record<TeamId, import("./types.ts").DraftStyle>> = {
    gnb: "bpa",
    dal: "need",
    chi: "trench",
    ram: "defense",
    pit: "defense",
    rai: "speed",
    sdg: "qb",
    kan: "need",
    nyj: "need",
    clt: "bpa",
    cle: "trench",
    min: "defense",
    sfo: "bpa",
    nwe: "need",
    mia: "speed",
    den: "need",
    buf: "trench",
    oti: "speed",
    det: "bpa",
    phi: "need",
    nyg: "need",
    was: "need",
    crd: "bpa",
    atl: "need",
  };
  return map[id] ?? "need";
}

/** Is this real coach already a head coach under another of his career entries (Shula's Colts and Dolphins)? */
function otherJob(save: DynastySave, c: Coach): boolean {
  return c.historical && Object.values(save.coaches).some((o) => o.id !== c.id && o.historical && o.name === c.name && headCoachOf(save, o));
}

function headCoachOf(save: DynastySave, c: Coach): boolean {
  return !!c.teamId && save.teams[c.teamId]?.coachId === c.id;
}

/** A man takes one job at a time: hiring him under one entry clears any post he held under another. */
function leaveOtherPosts(save: DynastySave, c: Coach): void {
  if (!c.historical) return;
  for (const o of Object.values(save.coaches)) {
    if (o.id === c.id || !o.historical || o.name !== c.name || !o.teamId) continue;
    const t = save.teams[o.teamId];
    if (t?.coachId === o.id) vacate(save, o, "HC", o.teamId);
    else if (t?.ocId === o.id) vacate(save, o, "OC", o.teamId);
    else if (t?.dcId === o.id) vacate(save, o, "DC", o.teamId);
  }
}

function sittingOn(save: DynastySave, c: Coach): boolean {
  if (!c.teamId) return false;
  const t = save.teams[c.teamId];
  if (!t) return false;
  return t.coachId === c.id || t.ocId === c.id || t.dcId === c.id;
}

export function availableCoaches(save: DynastySave, role?: CoachRole): Coach[] {
  // Some real coaches have one entry per chapter of their career (Shula's Colts and Dolphins);
  // a man already holding a job under one of them isn't on the market under another.
  // A coordinator can still be lured to a head job; a sitting head coach can't be hired twice.
  const working = new Set(
    Object.values(save.coaches)
      .filter((c) => c.historical && (role && role !== "HC" ? sittingOn(save, c) : headCoachOf(save, c)))
      .map((c) => c.name),
  );
  return Object.values(save.coaches)
    .filter((c) => {
      if (c.retiredYear || c.hofYear) return false;
      if (c.yearAvail > save.year + 1) return false;
      if (sittingOn(save, c)) return false;
      if (c.historical && working.has(c.name)) return false;
      // Paul Brown is the Bengals' first coach, not a free agent the winter before.
      if (EXPANSION_SPECS.some((x) => x.year >= save.year && x.clubs.some((k) => k.coachId === c.id))) return false;
      if (role && c.role !== role && c.role !== "HC") return false;
      return true;
    })
    .sort((a, b) => Math.max(b.offense, b.defense) - Math.max(a.offense, a.defense));
}

function vacate(save: DynastySave, c: Coach | undefined, role: CoachRole, teamId: TeamId): void {
  if (!c) return;
  c.teamId = null;
  c.yearsOnJob = 0;
  const t = save.teams[teamId];
  if (!t) return;
  if (role === "HC" && t.coachId === c.id) t.coachId = null;
  if (role === "OC" && t.ocId === c.id) t.ocId = null;
  if (role === "DC" && t.dcId === c.id) t.dcId = null;
}

export function fireCoach(save: DynastySave, teamId: TeamId, role: CoachRole): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  const id = role === "HC" ? t.coachId : role === "OC" ? t.ocId : t.dcId;
  if (!id) return { ok: false, reason: "The chair is already empty." };
  const c = save.coaches[id];
  if (c) {
    c.firedCount = (c.firedCount ?? 0) + 1;
    vacate(save, c, role, teamId);
  }
  addNews(save, {
    kind: "headline",
    headline: `${displayName(save.year, teamId)} fire ${c?.name ?? "their coach"}`,
    body: `${role} is vacant. The building is loud.`,
    teamIds: [teamId],
    playerIds: [],
  });
  save.carousel = save.carousel ?? [];
  save.carousel.push({
    year: save.year,
    teamId,
    fired: c?.name,
    hired: "vacant",
    role,
    note: `${displayName(save.year, teamId)} fire ${c?.name ?? role}.`,
  });
  return { ok: true };
}

export function hireCoach(save: DynastySave, teamId: TeamId, coachId: string, role: CoachRole): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  const c = save.coaches[coachId];
  if (!c) return { ok: false, reason: "That coach is not in the pool." };
  if (c.retiredYear || c.hofYear) return { ok: false, reason: "He is not coming back." };
  if (c.teamId && c.teamId !== teamId && sittingOn(save, c)) return { ok: false, reason: "He already has a job." };
  const prevId = role === "HC" ? t.coachId : role === "OC" ? t.ocId : t.dcId;
  if (prevId && prevId !== coachId) {
    const prev = save.coaches[prevId];
    vacate(save, prev, role, teamId);
  }
  leaveOtherPosts(save, c);
  c.role = role;
  c.teamId = teamId;
  c.yearsOnJob = 1;
  if (role === "HC") {
    t.coachId = c.id;
    t.offScheme = c.offScheme;
    t.defScheme = c.defScheme;
  } else if (role === "OC") t.ocId = c.id;
  else t.dcId = c.id;
  // A new play-caller brings his own system with him.
  applyStaffSchemes(save, teamId, (id) => {
    save.teams[id].depth = {};
    syncDepth(save, id);
  });
  addNews(save, {
    kind: "headline",
    headline: `${c.name} hired as ${role} in ${displayName(save.year, teamId)}`,
    body: `${c.offScheme} / ${c.defScheme}. Offense ${c.offense}, defense ${c.defense}. ${c.abilities?.slice(0, 2).join(" · ") ?? ""}`.trim(),
    teamIds: [teamId],
    playerIds: [],
  });
  save.carousel = save.carousel ?? [];
  save.carousel.push({
    year: save.year,
    teamId,
    hired: c.name,
    role,
    note: `${displayName(save.year, teamId)} hire ${c.name} (${role}).`,
  });
  return { ok: true };
}

export function setTeamScheme(
  save: DynastySave,
  teamId: TeamId,
  patch: { offScheme?: OffScheme; defScheme?: DefScheme; draftStyle?: import("./types.ts").DraftStyle },
): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  const schemeChanged = (patch.offScheme && patch.offScheme !== t.offScheme) || (patch.defScheme && patch.defScheme !== t.defScheme);
  if (patch.offScheme) t.offScheme = patch.offScheme;
  if (patch.defScheme) t.defScheme = patch.defScheme;
  if (patch.draftStyle) t.draftStyle = patch.draftStyle;
  const hc = t.coachId ? save.coaches[t.coachId] : undefined;
  // The owner's schemes stick: lock in both sides as the club lines up now, not just the one he changed.
  if (hc && (patch.offScheme || patch.defScheme)) {
    hc.offScheme = t.offScheme;
    hc.defScheme = t.defScheme;
    hc.schemeLocked = true;
  }
  // A real coach installing a new scheme re-evaluates who fits it, not just where
  // to slot the next new arrival - drop the existing order so it gets rebuilt
  // scheme-aware from scratch instead of carrying over the old staff's ranking.
  if (schemeChanged) {
    t.depth = {};
    syncDepth(save, teamId);
  }
  return { ok: true };
}

export function ageStaff(save: DynastySave): void {
  for (const c of Object.values(save.coaches)) {
    if (c.retiredYear || c.hofYear) continue;
    if (c.born) {
      const raw = save.year - c.born;
      c.age = c.yearAvail > save.year ? Math.max(30, c.yearAvail - c.born - 2) : raw;
    } else c.age = (c.age ?? 48) + 1;
    if (sittingOn(save, c)) c.yearsCoaching = (c.yearsCoaching ?? 0) + 1;
  }
}

export function progressCoach(save: DynastySave, c: Coach, teamId: TeamId | null): void {
  if (c.retiredYear || c.hofYear) return;
  const t = teamId ? save.teams[teamId] : undefined;
  const pct = t ? winPct(t) : 0.4;
  const games = t ? t.wins + t.losses + t.ties : 0;
  const winning = games >= 8 && pct >= 0.55;
  const losing = games >= 8 && pct < 0.35;
  const pot = c.potential ?? 88;
  let dOff = 0;
  let dDef = 0;
  if (c.age < 48 && sittingOn(save, c) && rand(save) < 0.45) {
    dOff = c.offense < pot && (c.role !== "DC") ? randInt(save, 0, 2) : 0;
    dDef = c.defense < pot && (c.role !== "OC") ? randInt(save, 0, 2) : 0;
  } else if (c.age <= 58 && winning && rand(save) < 0.4) {
    dOff = c.role === "DC" ? 0 : 1;
    dDef = c.role === "OC" ? 0 : 1;
  }
  if (c.age >= 64) {
    dOff -= randInt(save, 1, 2);
    dDef -= randInt(save, 1, 2);
  } else if (c.age >= 60 && rand(save) < 0.45) {
    dOff -= 1;
    dDef -= 1;
  }
  if (losing && rand(save) < 0.28) {
    dOff = Math.min(dOff, 0);
    dDef = Math.min(dDef, 0);
  }
  if (t && (t.wins >= 12 || pct >= 0.75) && rand(save) < 0.5) {
    c.leadership = clampStat((c.leadership ?? 70) + 1);
  }
  if (losing && rand(save) < 0.3) c.leadership = clampStat((c.leadership ?? 70) - 1);
  c.offense = clampStat(c.offense + dOff);
  c.defense = clampStat(c.defense + dDef);
  if (c.offense > pot && dOff > 0 && rand(save) < 0.65) c.offense = pot;
  if (c.defense > pot && dDef > 0 && rand(save) < 0.65) c.defense = pot;
  c.peakOffense = Math.max(c.peakOffense ?? c.offense, c.offense);
  c.peakDefense = Math.max(c.peakDefense ?? c.defense, c.defense);
  if (c.abilities.length < 2) {
    const kit = assignCoachKit(c);
    c.abilities = uniqueAb([...c.abilities, ...kit.abilities]).slice(0, 4);
    c.traits = uniqueAb([...c.traits, ...kit.traits]).slice(0, 3);
  }
}

function uniqueAb(xs: string[]): string[] {
  const s = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (!x || s.has(x)) continue;
    s.add(x);
    out.push(x);
  }
  return out;
}

export function shouldRetireCoach(save: DynastySave, c: Coach): boolean {
  if (c.retiredYear || c.hofYear) return false;
  if (c.age >= 74) return true;
  if (c.age >= 70 && rand(save) < 0.55) return true;
  if (c.age >= 66 && !sittingOn(save, c) && (c.firedCount ?? 0) >= 1 && rand(save) < 0.4) return true;
  if (c.age >= 64 && (c.firedCount ?? 0) >= 2 && rand(save) < 0.5) return true;
  if (c.age >= 62 && !sittingOn(save, c) && (c.firedCount ?? 0) >= 3) return true;
  if (c.historical && c.age >= 68 && rand(save) < 0.35) return true;
  return false;
}

export function retireCoach(save: DynastySave, c: Coach): void {
  if (c.retiredYear) return;
  const lastTeam = c.teamId;
  if (lastTeam && sittingOn(save, c)) {
    const t = save.teams[lastTeam];
    if (t.coachId === c.id) t.coachId = null;
    if (t.ocId === c.id) t.ocId = null;
    if (t.dcId === c.id) t.dcId = null;
  }
  c.teamId = null;
  c.yearsOnJob = 0;
  c.retiredYear = save.year + 1;
  const rec = `${c.careerWins}-${c.careerLosses}${c.careerTies ? `-${c.careerTies}` : ""}`;
  const teamId = (lastTeam && lastTeam !== null ? lastTeam : save.userTeamId) as TeamId;
  save.history.retirements.push({
    coachId: c.id,
    year: save.year,
    teamId,
    seasons: Math.max(1, c.yearsCoaching ?? c.yearsOnJob ?? 1),
    blurb: `${c.name} leaves the sideline. Career ${rec}${c.careerTitles ? ` · ${c.careerTitles} titles` : ""}.`,
    kind: "coach",
  });
  addNews(save, {
    kind: "retire",
    headline: `${c.name} retires`,
    body: `${c.role} hangs up the whistle. ${rec} as a head coach.`,
    teamIds: lastTeam ? [lastTeam] : [],
    playerIds: [],
  });
}

function isUserClub(save: DynastySave, id: TeamId): boolean {
  return id === save.userTeamId && !save.cpuOnly;
}

function noteCarousel(save: DynastySave, teamId: TeamId, role: CoachRole, fired: string | undefined, hired: string, extra?: string): void {
  save.carousel = save.carousel ?? [];
  const note =
    extra ??
    (fired
      ? `${displayName(save.year, teamId)} fire ${fired}; hire ${hired}.`
      : `${displayName(save.year, teamId)} hire ${hired}.`);
  save.carousel.push({ year: save.year, teamId, fired, hired, role, note });
}

function autoHireHeadCoach(save: DynastySave, teamId: TeamId, exclude?: string): Coach {
  const t = save.teams[teamId];
  // The man the club just fired is out of work, but he isn't a candidate for his old job.
  const open = new Set(availableCoaches(save, "HC").map((c) => c.id));
  const historical = [...LATER_COACHES, ...MORE_COACHES]
    .filter((s) => (s.role ?? "HC") === "HC" && s.yearAvail <= save.year + 1 && s.id !== exclude)
    .filter((s) => {
      const existing = save.coaches[s.id];
      return existing ? open.has(existing.id) : true;
    });
  let coach: Coach;
  if (historical.length && rand(save) < 0.62) {
    const seed = historical[randInt(save, 0, historical.length - 1)]!;
    coach = save.coaches[seed.id] ?? bump(seed, "HC", save.year);
    coach.role = "HC";
    coach.teamId = teamId;
    coach.yearsOnJob = 1;
    fillCoachFields(coach, save.year);
    save.coaches[coach.id] = coach;
  } else {
    const promote = t.ocId ? save.coaches[t.ocId] : undefined;
    if (promote && !promote.retiredYear && promote.offense >= 76 && !otherJob(save, promote) && rand(save) < 0.55) {
      promote.role = "HC";
      promote.teamId = teamId;
      promote.yearsOnJob = 1;
      coach = promote;
      const oc = genCoord(save, teamId, "OC");
      save.coaches[oc.id] = oc;
      t.ocId = oc.id;
    } else {
      const pool = availableCoaches(save, "HC").filter((c) => Math.max(c.offense, c.defense) >= 74);
      if (pool.length && rand(save) < 0.5) {
        coach = pool[0]!;
        coach.role = "HC";
        coach.teamId = teamId;
        coach.yearsOnJob = 1;
      } else {
        const g = genCoord(save, teamId, "HC");
        g.offense = Math.max(g.offense, randInt(save, 72, 90));
        save.coaches[g.id] = g;
        coach = g;
      }
    }
  }
  t.coachId = coach.id;
  t.offScheme = coach.offScheme;
  t.defScheme = coach.defScheme;
  leaveOtherPosts(save, coach);
  return coach;
}

function autoHireCoord(save: DynastySave, teamId: TeamId, role: "OC" | "DC"): Coach {
  const t = save.teams[teamId];
  const pool = availableCoaches(save, role);
  let coach: Coach;
  if (pool.length && rand(save) < 0.55) {
    coach = pool[randInt(save, 0, Math.min(6, pool.length - 1))]!;
    coach.role = role;
    coach.teamId = teamId;
    coach.yearsOnJob = 1;
  } else {
    coach = genCoord(save, teamId, role);
    save.coaches[coach.id] = coach;
  }
  if (role === "OC") t.ocId = coach.id;
  else t.dcId = coach.id;
  leaveOtherPosts(save, coach);
  return coach;
}

function creditTenure(c: Coach, teamId: TeamId, weight: number): void {
  c.tenure = c.tenure ?? {};
  c.tenure[teamId] = (c.tenure[teamId] ?? 0) + weight;
}

export function runCoachingCarousel(save: DynastySave): void {
  save.carousel = save.carousel ?? [];
  const ids = activeTeamIds(save.year);
  let leaguePf = 0;
  let leaguePa = 0;
  for (const id of ids) {
    leaguePf += save.teams[id]!.pf;
    leaguePa += save.teams[id]!.pa;
  }
  const avgPf = ids.length ? leaguePf / ids.length : 250;
  const avgPa = ids.length ? leaguePa / ids.length : 250;

  for (const id of ids) {
    const t = save.teams[id];
    const hc = t.coachId ? save.coaches[t.coachId] : undefined;
    const oc = t.ocId ? save.coaches[t.ocId] : undefined;
    const dc = t.dcId ? save.coaches[t.dcId] : undefined;
    if (hc) {
      hc.yearsOnJob += 1;
      creditTenure(hc, id, 2);
      progressCoach(save, hc, id);
    }
    if (oc) {
      oc.yearsOnJob += 1;
      creditTenure(oc, id, 1);
      progressCoach(save, oc, id);
    }
    if (dc) {
      dc.yearsOnJob += 1;
      creditTenure(dc, id, 1);
      progressCoach(save, dc, id);
    }

    if (isUserClub(save, id)) continue;

    const pct = winPct(t);
    const games = t.wins + t.losses + t.ties;
    const bad = games >= 10 && pct < 0.32 && (hc?.yearsOnJob ?? 2) >= 2;
    const stale = games >= 10 && pct < 0.4 && (hc?.yearsOnJob ?? 0) >= 5;
    const collapse = games >= 10 && pct < 0.22 && (hc?.yearsOnJob ?? 0) >= 1;
    if ((collapse && rand(save) < 0.7) || (bad && rand(save) < 0.62) || (stale && rand(save) < 0.4)) {
      const fired = hc?.name;
      if (hc) {
        hc.firedCount = (hc.firedCount ?? 0) + 1;
        vacate(save, hc, "HC", id);
      }
      const hired = autoHireHeadCoach(save, id, hc?.id);
      noteCarousel(save, id, "HC", fired, hired.name);
      addNews(save, {
        kind: "headline",
        headline: fired ? `${fired} out in ${displayName(save.year, id)}` : `${hired.name} takes over ${displayName(save.year, id)}`,
        body: fired
          ? `After ${t.wins}-${t.losses}, the club turns the page. ${hired.name} (${hired.offScheme} / ${hired.defScheme}) is the new head coach.`
          : `${hired.name} is in.`,
        teamIds: [id],
        playerIds: [],
      });
    }

    const t2 = save.teams[id];
    const oc2 = t2.ocId ? save.coaches[t2.ocId] : undefined;
    const dc2 = t2.dcId ? save.coaches[t2.dcId] : undefined;
    if (oc2 && (oc2.yearsOnJob ?? 0) >= 2 && t.pf < avgPf * 0.78 && oc2.offense < 80 && rand(save) < 0.4) {
      const fired = oc2.name;
      oc2.firedCount = (oc2.firedCount ?? 0) + 1;
      vacate(save, oc2, "OC", id);
      const hired = autoHireCoord(save, id, "OC");
      noteCarousel(save, id, "OC", fired, hired.name);
    }
    if (dc2 && (dc2.yearsOnJob ?? 0) >= 2 && t.pa > avgPa * 1.22 && dc2.defense < 80 && rand(save) < 0.4) {
      const fired = dc2.name;
      dc2.firedCount = (dc2.firedCount ?? 0) + 1;
      vacate(save, dc2, "DC", id);
      const hired = autoHireCoord(save, id, "DC");
      noteCarousel(save, id, "DC", fired, hired.name);
    }
  }
}

export function ensureStaff(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    if (!t) continue;
    t.draftStyle = t.draftStyle ?? draftStyleOf(id);
    t.offScheme = t.offScheme ?? "multiple";
    t.defScheme = t.defScheme ?? "4-3";
    const user = isUserClub(save, id);
    if (!t.ocId) autoHireCoord(save, id, "OC");
    if (!t.dcId) autoHireCoord(save, id, "DC");
    if (!t.coachId && !user) autoHireHeadCoach(save, id);
  }
  // Every club lines up in its staff's schemes, and real coaches move with their own careers:
  // Noll to the vertical game in 1978, Shula once Marino arrives in 1983.
  syncRealSchemes(save, (id) => {
    save.teams[id].depth = {};
    syncDepth(save, id);
  });
}

export function staffOf(save: DynastySave, teamId: TeamId): { hc?: Coach; oc?: Coach; dc?: Coach } {
  const t = save.teams[teamId];
  if (!t) return {};
  return {
    hc: t.coachId ? save.coaches[t.coachId] : undefined,
    oc: t.ocId ? save.coaches[t.ocId] : undefined,
    dc: t.dcId ? save.coaches[t.dcId] : undefined,
  };
}

export function schemeFitPos(pos: string, off?: OffScheme, def?: DefScheme): number {
  let n = 0;
  if (off === "smashmouth" && ["RB", "FB", "LT", "LG", "C", "RG", "RT", "TE"].includes(pos)) n += 8;
  if (off === "vertical" && ["WR", "QB", "TE"].includes(pos)) n += 8;
  if (off === "westcoast" && ["WR", "QB", "TE", "RB"].includes(pos)) n += 6;
  if (def === "3-4" && ["OLB", "DE"].includes(pos)) n += 7;
  if (def === "4-3" && ["DT", "MLB"].includes(pos)) n += 5;
  if (def === "cover-2" && ["S", "CB", "MLB"].includes(pos)) n += 6;
  if (def === "wide-9" && ["DE", "OLB"].includes(pos)) n += 7;
  return n;
}
