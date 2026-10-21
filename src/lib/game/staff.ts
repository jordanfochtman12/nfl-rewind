import type {
  Coach,
  CoachRole,
  CoachSearch,
  DefScheme,
  DynastySave,
  GmResult,
  OffScheme,
  TeamId,
} from "./types.ts";
import { activeTeamIds, displayName, gamesInSeason } from "./teams.ts";
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
import { mentorOf } from "./coachingTree.ts";
import { ensureContracts, finalYear, renew, tearUp, tickContracts } from "./coachContracts.ts";
import { cpuHandles } from "./teamControl.ts";

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

/**
 * A real coordinator the record names, made the first time the league needs him: from the
 * coach catalogs (his ratings and playbook) when he's in them, else a staff man with his name.
 * Found again by name after that, so the coordinator who becomes a head coach is the same man.
 */
export function realCoordinator(save: DynastySave, name: string, role: "OC" | "DC", teamId: TeamId): Coach {
  const key = name.toLowerCase();
  const have = Object.values(save.coaches).find((c) => c.name.toLowerCase() === key && !c.retiredYear && !c.hofYear);
  if (have) return have;
  const seed = [...COORDINATORS_1966, ...LATER_COACHES, ...MORE_COACHES].find((x) => x.name.toLowerCase() === key);
  let c: Coach;
  if (seed && !save.coaches[seed.id]) c = bump(seed, role, save.year, { teamId: null });
  else {
    c = genCoord(save, teamId, role);
    c.id = `rc-${key.replace(/[^a-z0-9]+/g, "-")}`;
    c.name = name;
    c.historical = true;
    c.teamId = null;
  }
  save.coaches[c.id] = c;
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
    t.draftStyle = draftStyleOf(id, save.year);
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

/**
 * The real front offices' habits, by era: who drafted the best player left, who bought speed,
 * who built the lines. Only the well-known stretches; every other season the club's usual
 * lean (below) applies, so this colors a war room without scripting it.
 */
const ERA_STYLES: Partial<Record<TeamId, [number, number, import("./types.ts").DraftStyle][]>> = {
  rai: [[1966, 2011, "speed"]], // Al Davis: speed kills
  dal: [[1966, 1988, "bpa"]], // Gil Brandt's computer board
  pit: [[1969, 1983, "defense"]], // Chuck Noll's Steel Curtain drafts
  sfo: [[1979, 1988, "bpa"]], // Bill Walsh
  clt: [[1998, 2011, "bpa"]], // Bill Polian
  rav: [[1996, 2018, "bpa"]], // Ozzie Newsome: stick to the board
  nwe: [[2000, 2023, "bpa"]], // Belichick: value over need
  gnb: [[2005, 2017, "bpa"]], // Ted Thompson
  sea: [[2010, 2023, "defense"]], // the Legion of Boom years
  kan: [[2017, 2040, "speed"]], // Veach and Reid: speed at receiver
  phi: [[2016, 2040, "trench"]], // Roseman builds the lines
  det: [[2021, 2040, "trench"]], // Holmes and Campbell
};

export function draftStyleOf(id: TeamId, year?: number): import("./types.ts").DraftStyle {
  if (year !== undefined) {
    const era = ERA_STYLES[id]?.find(([from, to]) => year >= from && year <= to);
    if (era) return era[2];
  }
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
  const owed = tearUp(save, c);
  if (c) {
    c.firedCount = (c.firedCount ?? 0) + 1;
    vacate(save, c, role, teamId);
  }
  addNews(save, {
    kind: "headline",
    headline: `${displayName(save.year, teamId)} fire ${c?.name ?? "their coach"}`,
    body: `${role} is vacant. The building is loud.${owed}`,
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

const IN_SEASON = new Set<string>(["preseason", "regular", "deadline", "playoffs", "superBowl"]);

/** This winter's hot names with what the owner needs to judge them: their job, their unit, who they've met. */
export function hotNamesBoard(save: DynastySave): { coach: Coach; teamId?: TeamId; role?: "OC" | "DC"; unitRank?: number; met: TeamId[] }[] {
  const search = save.coachSearch?.year === save.year ? save.coachSearch : undefined;
  const ids = search?.hot.length ? search.hot : hotNames(save);
  const teams = activeTeamIds(save.year);
  const played = teams.some((id) => save.teams[id]!.wins + save.teams[id]!.losses + save.teams[id]!.ties > 0);
  const rankBy = (k: "pf" | "pa", id: TeamId) =>
    teams.slice().sort((a, b) => (k === "pf" ? save.teams[b]!.pf - save.teams[a]!.pf : save.teams[a]!.pa - save.teams[b]!.pa)).indexOf(id) + 1;
  return ids
    .map((id) => save.coaches[id])
    .filter((c): c is Coach => !!c && !c.retiredYear && !headCoachOf(save, c))
    .map((c) => {
      const t = c.teamId && sittingOn(save, c) ? c.teamId : undefined;
      const role = t ? (save.teams[t]?.ocId === c.id ? "OC" : "DC") : undefined;
      return {
        coach: c,
        teamId: t,
        role,
        unitRank: played && t && role ? rankBy(role === "OC" ? "pf" : "pa", t) : undefined,
        met: (search?.interviews ?? []).filter((x) => x.coachId === c.id).map((x) => x.teamId),
      };
    });
}

export function hireCoach(save: DynastySave, teamId: TeamId, coachId: string, role: CoachRole): GmResult {
  const t = save.teams[teamId];
  if (!t) return { ok: false, reason: "No club." };
  const c = save.coaches[coachId];
  if (!c) return { ok: false, reason: "That coach is not in the pool." };
  if (c.retiredYear || c.hofYear) return { ok: false, reason: "He is not coming back." };
  // A coordinator elsewhere can be hired away to be a head coach, once his season is over.
  const poach = role === "HC" && !!c.teamId && c.teamId !== teamId && sittingOn(save, c) && !headCoachOf(save, c) ? c.teamId : undefined;
  if (poach && IN_SEASON.has(save.phase)) return { ok: false, reason: `${c.name} is coaching the ${displayName(save.year, poach)} through the season. Ask again in the winter.` };
  if (c.teamId && c.teamId !== teamId && sittingOn(save, c) && !poach) return { ok: false, reason: "He already has a job." };
  // Promoting his own coordinator: the old job opens and someone fills it for now.
  const ownWas = c.teamId === teamId && role === "HC" ? (t.ocId === c.id ? "OC" : t.dcId === c.id ? "DC" : undefined) : undefined;
  // Jobs he leaves are refilled once he holds the new one, so the refill can't pick him again.
  const refill: [TeamId, "OC" | "DC"][] = [];
  if (ownWas) {
    vacate(save, c, ownWas, teamId);
    refill.push([teamId, ownWas]);
  }
  if (poach) {
    const was = save.teams[poach]?.ocId === c.id ? "OC" : "DC";
    vacate(save, c, was, poach);
    refill.push([poach, was]);
  }
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
  for (const [club, r] of refill) {
    const fill = autoHireCoord(save, club, r);
    if (club !== teamId) noteCarousel(save, club, r, c.name, fill.name, `${displayName(save.year, club)} lose ${c.name} to ${displayName(save.year, teamId)}; ${fill.name} is the new ${r}.`);
  }
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
  ensureContracts(save);
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
  return !cpuHandles(save, id, "staff");
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

/**
 * Who a club looks at for a coordinator's job: career assistants who coach that side of the
 * ball. A former head coach out of work takes one now and then (Romeo Crennel, Wade Phillips),
 * but a head coach the record hasn't given a team yet isn't anyone's coordinator in the
 * meantime: the best-graded market was all head coaches, and Jim Harbaugh ran a defense in 2016.
 */
function coordinatorPool(save: DynastySave, role: "OC" | "DC"): Coach[] {
  const side = (c: Coach) => (role === "OC" ? c.offense - c.defense : c.defense - c.offense);
  const assistants: Coach[] = [];
  const formerHeads: Coach[] = [];
  for (const c of availableCoaches(save, role)) {
    if (side(c) < -2) continue;
    if (c.role === role) assistants.push(c);
    else if (c.careerWins + c.careerLosses + (c.careerTies ?? 0) > 0 && c.age <= 64) formerHeads.push(c);
  }
  return formerHeads.length && rand(save) < 0.12 ? formerHeads : assistants;
}

export function autoHireCoord(save: DynastySave, teamId: TeamId, role: "OC" | "DC"): Coach {
  const t = save.teams[teamId];
  const pool = coordinatorPool(save, role);
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
  const search = save.coachSearch?.year === save.year ? save.coachSearch : undefined;
  const headCoached = new Set(Object.values(save.coaches).filter((c) => c.careerWins + c.careerLosses + (c.careerTies ?? 0) > 0).map((c) => c.name));
  const ids = activeTeamIds(save.year);
  let leaguePf = 0;
  let leaguePa = 0;
  for (const id of ids) {
    leaguePf += save.teams[id]!.pf;
    leaguePa += save.teams[id]!.pa;
  }
  const avgPf = ids.length ? leaguePf / ids.length : 250;
  const avgPa = ids.length ? leaguePa / ids.length : 250;
  // Every deal loses the season just played; the ones that ran out are decided below.
  const expired = tickContracts(save);

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
    // A season on a head coach's staff puts a coordinator on his coaching tree, while he's still
    // coming up: a former head coach running someone's defense isn't that man's protégé.
    if (hc)
      for (const coord of [oc, dc])
        if (coord && coord.id !== hc.id && !headCoached.has(coord.name)) (coord.mentors ??= {})[hc.id] = (coord.mentors?.[hc.id] ?? 0) + 1;
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

    const up = expired.filter((e) => e.teamId === id);
    // The owner's staff: a deal he didn't extend runs out, and the man walks.
    if (isUserClub(save, id)) {
      for (const e of up) contractRunsOut(save, id, e.role, e.coach);
      continue;
    }

    // Black Monday already made the call; an older save mid-winter rolls it here.
    const fire = search?.monday ? search.cuts.includes(id) : wantsNewCoach(save, id);
    // A head coach who retired this winter leaves the job open: it's filled now, in the
    // carousel, not quietly in camp (the club went through the draft without one).
    if (fire || !hc) {
      const fired = hc?.name;
      if (hc) {
        hc.firedCount = (hc.firedCount ?? 0) + 1;
        vacate(save, hc, "HC", id);
      }
      const { coach: hired, from } = hireForVacancy(save, id, hc?.id, search);
      noteCarousel(save, id, "HC", fired, hired.name);
      const team = displayName(save.year, id);
      addNews(save, {
        kind: "headline",
        headline: search?.monday ? `${team} hire ${hired.name}` : fired ? `${fired} out in ${team}` : `${hired.name} takes over ${team}`,
        body: from
          ? `The hottest name on the market: ${hired.name} ran the ${from.role === "OC" ? "offense" : "defense"} for the ${displayName(save.year, from.teamId)}.${treeBranch(save, hired)}${fired ? ` He replaces ${fired}.` : ""}`
          : fired
            ? `${search?.monday ? `${fired} is replaced` : `After ${t.wins}-${t.losses}, the club turns the page`}. ${hired.name} (${hired.offScheme} / ${hired.defScheme}) is the new head coach.`
            : `${hired.name} (${hired.offScheme} / ${hired.defScheme}) is the new head coach.`,
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
    // Deals that ran out on a computer club: a head coach still in the job is re-signed (Black
    // Monday already let a loser's lapse); a coordinator is kept when his unit held up.
    for (const e of up) {
      const t3 = save.teams[id];
      const holds = e.role === "HC" ? t3.coachId : e.role === "OC" ? t3.ocId : t3.dcId;
      if (holds !== e.coach.id) continue;
      const good = e.role === "HC" || (e.role === "OC" ? t.pf >= avgPf : t.pa <= avgPa);
      if (e.role === "HC" || rand(save) < (good ? 0.8 : 0.35)) renew(save, e.coach, e.role);
      else contractRunsOut(save, id, e.role, e.coach);
    }
  }
  ensureContracts(save);
}

/** His deal is up and nobody re-signed him: he leaves the staff, and a coordinator's job is filled. */
function contractRunsOut(save: DynastySave, teamId: TeamId, role: CoachRole, c: Coach): void {
  c.contract = undefined;
  vacate(save, c, role, teamId);
  const team = displayName(save.year, teamId);
  if (role !== "HC" && !isUserClub(save, teamId)) {
    const fill = autoHireCoord(save, teamId, role);
    noteCarousel(save, teamId, role, c.name, fill.name, `${team} let ${c.name}'s contract run out; ${fill.name} is the new ${role}.`);
  } else noteCarousel(save, teamId, role, c.name, "vacant", `${c.name}'s contract with the ${team} runs out; the ${role} job is open.`);
  addNews(save, {
    kind: "headline",
    headline: `${c.name}'s deal runs out in ${team}`,
    body: `The ${role === "HC" ? "head coach" : role === "OC" ? "offensive coordinator" : "defensive coordinator"} leaves when his contract is up.`,
    teamIds: [teamId],
    playerIds: [],
  });
}

/**
 * One man, one job. Saves from before the coordinator-hiring fix could carry a coach on two
 * staffs at once; keep his head-coaching post (or his first one) and open the rest.
 */
function repairDoubleJobs(save: DynastySave): void {
  const held = new Map<string, { teamId: TeamId; role: CoachRole }[]>();
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    if (!t) continue;
    for (const [role, cid] of [["HC", t.coachId], ["OC", t.ocId], ["DC", t.dcId]] as const) if (cid) held.set(cid, [...(held.get(cid) ?? []), { teamId: id, role }]);
  }
  for (const [cid, posts] of held) {
    if (posts.length < 2) continue;
    const keep = posts.find((p) => p.role === "HC") ?? posts[0]!;
    for (const p of posts) {
      if (p === keep) continue;
      const t = save.teams[p.teamId];
      if (p.role === "HC" && t.coachId === cid) t.coachId = null;
      if (p.role === "OC" && t.ocId === cid) t.ocId = null;
      if (p.role === "DC" && t.dcId === cid) t.dcId = null;
    }
    const c = save.coaches[cid];
    if (c) {
      c.teamId = keep.teamId;
      c.role = keep.role;
    }
  }
}

export function ensureStaff(save: DynastySave): void {
  repairDoubleJobs(save);
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
  ensureContracts(save);
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

// ---- The coaching cycle: the hot seat, midseason firings, Black Monday, the hot names, interviews.

function searchOf(save: DynastySave): CoachSearch {
  if (save.coachSearch?.year !== save.year) save.coachSearch = { year: save.year, cuts: [], hot: [], interviews: [], midseason: 0 };
  return save.coachSearch;
}

const recordOf = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;

/** The owner's verdict on a full season: a collapse, a bad year on a coach's watch, a stale run. */
function wantsNewCoach(save: DynastySave, id: TeamId): boolean {
  const t = save.teams[id];
  const hc = t.coachId ? save.coaches[t.coachId] : undefined;
  const pct = winPct(t);
  const games = t.wins + t.losses + t.ties;
  // An interim coach keeps the job by winning; otherwise the club starts the search.
  if (hc?.interimYear === save.year && hc.interimFrom) {
    const w = t.wins - hc.interimFrom.w;
    const l = t.losses - hc.interimFrom.l;
    return !(w + l >= 4 && w >= l && pct >= 0.4 && rand(save) < 0.6);
  }
  const bad = games >= 10 && pct < 0.32 && (hc?.yearsOnJob ?? 2) >= 2;
  const stale = games >= 10 && pct < 0.4 && (hc?.yearsOnJob ?? 0) >= 5;
  const collapse = games >= 10 && pct < 0.22 && (hc?.yearsOnJob ?? 0) >= 1;
  return (collapse && rand(save) < 0.75) || (bad && rand(save) < 0.7) || (stale && rand(save) < 0.45);
}

/**
 * Each week of the regular season: losing clubs put their coach on the hot seat, and now and
 * then an owner can't wait for the winter (real leagues average about one midseason firing a
 * year since the late '70s, fewer before) and hands the team to a coordinator.
 */
export function hotSeatWeek(save: DynastySave): void {
  const n = gamesInSeason(save.year);
  const search = searchOf(save);
  for (const id of activeTeamIds(save.year)) {
    if (isUserClub(save, id)) continue;
    const t = save.teams[id];
    const hc = t.coachId ? save.coaches[t.coachId] : undefined;
    if (!hc || hc.interimYear === save.year) continue;
    const games = t.wins + t.losses + t.ties;
    if (games < Math.round(n * 0.4)) continue;
    const pct = winPct(t);
    if (hc.hotSeat !== save.year && pct <= 0.25 && (hc.yearsOnJob >= 2 || pct <= 0.15)) {
      hc.hotSeat = save.year;
      addNews(save, {
        kind: "headline",
        headline: `${hc.name} on the hot seat`,
        body: `${displayName(save.year, id)} are ${recordOf(t)}, and the questions about the head coach get louder every week.`,
        teamIds: [id],
        playerIds: [],
      });
      continue;
    }
    const cap = save.year < 1978 ? 1 : 2;
    if (hc.hotSeat === save.year && search.midseason < cap && games <= n - 3 && pct <= 0.2 && hc.yearsOnJob >= 2 && rand(save) < (save.year < 1978 ? 0.03 : 0.07)) {
      fireMidseason(save, id, hc);
    }
  }
}

function fireMidseason(save: DynastySave, id: TeamId, hc: Coach): void {
  const t = save.teams[id];
  const team = displayName(save.year, id);
  const coords = [t.ocId ? save.coaches[t.ocId] : undefined, t.dcId ? save.coaches[t.dcId] : undefined].filter((c): c is Coach => !!c);
  const pick = coords.sort((a, b) => Math.max(b.offense, b.defense) + b.leadership / 4 - (Math.max(a.offense, a.defense) + a.leadership / 4))[0];
  const owed = tearUp(save, hc, false);
  hc.firedCount = (hc.firedCount ?? 0) + 1;
  vacate(save, hc, "HC", id);
  let interim: Coach;
  let was: "OC" | "DC" | undefined;
  if (pick) {
    was = pick.id === t.ocId ? "OC" : "DC";
    vacate(save, pick, was, id);
    interim = pick;
    // His old job goes to someone new for the rest of the year.
    const fill = genCoord(save, id, was);
    save.coaches[fill.id] = fill;
    if (was === "OC") t.ocId = fill.id;
    else t.dcId = fill.id;
  } else {
    interim = genCoord(save, id, "HC");
    save.coaches[interim.id] = interim;
  }
  interim.role = "HC";
  interim.teamId = id;
  interim.yearsOnJob = 0;
  interim.interimYear = save.year;
  interim.interimFrom = { w: t.wins, l: t.losses };
  t.coachId = interim.id;
  searchOf(save).midseason += 1;
  ensureContracts(save);
  noteCarousel(save, id, "HC", hc.name, interim.name, `${team} fire ${hc.name} at ${recordOf(t)}; ${interim.name} is the interim coach.`);
  addNews(save, {
    kind: "headline",
    headline: `${team} fire ${hc.name}`,
    body: `At ${recordOf(t)}, the club can't wait for the winter. ${interim.name}${was ? `, the ${was === "OC" ? "offensive" : "defensive"} coordinator,` : ""} finishes the year as interim head coach.${owed}`,
    teamIds: [id],
    playerIds: [],
  });
}

/**
 * The day after the regular season: owners make their calls, the papers count the bodies, and
 * the market's hot names (the coordinators behind the best offenses and defenses, the winners
 * out of work) go on every club's list.
 */
export function blackMonday(save: DynastySave): void {
  const search = searchOf(save);
  if (search.monday) return;
  search.monday = true;
  const ids = activeTeamIds(save.year);
  const inPlayoffs = new Set(save.playoffGames.filter((g) => g.year === save.year).flatMap((g) => [g.homeId, g.awayId]));
  for (const id of ids) {
    if (isUserClub(save, id) || inPlayoffs.has(id)) continue;
    const t = save.teams[id];
    const hc = t.coachId ? save.coaches[t.coachId] : undefined;
    if (!hc) continue;
    // The record's carousel (realBlackMonday) already made this club's call.
    if (search.cuts.includes(id) || search.keep?.includes(id)) continue;
    // His deal is up after this season: a club that didn't win lets it run out.
    const lapse = finalYear(hc) && hc.interimYear !== save.year && winPct(t) < 0.4 && rand(save) < 0.6;
    if (lapse) {
      search.cuts.push(id);
      const owed = tearUp(save, hc, true);
      addNews(save, {
        kind: "headline",
        headline: `${hc.name} won't be back in ${displayName(save.year, id)}`,
        body: `His contract is up after ${recordOf(t)}, and the club lets it run out. The search starts today.${owed}`,
        teamIds: [id],
        playerIds: [],
      });
    } else if (wantsNewCoach(save, id)) {
      search.cuts.push(id);
      const owed = tearUp(save, hc, true);
      addNews(save, {
        kind: "headline",
        headline: `${displayName(save.year, id)} fire ${hc.name}`,
        body: hc.interimYear === save.year
          ? `The interim tag comes off the other way: after ${recordOf(t)}, the club opens a full search.`
          : `After ${recordOf(t)}, the club turns the page. The search starts today.${owed}`,
        teamIds: [id],
        playerIds: [],
      });
    } else if (hc.interimYear === save.year) {
      hc.interimYear = undefined;
      hc.interimFrom = undefined;
      addNews(save, {
        kind: "headline",
        headline: `${hc.name} keeps the job`,
        body: `He took over at midseason and won enough to lose the interim tag in ${displayName(save.year, id)}.`,
        teamIds: [id],
        playerIds: [],
      });
    }
  }
  if (search.cuts.length >= 2) {
    addNews(save, {
      kind: "headline",
      headline: `Black Monday: ${search.cuts.length} head coaches out`,
      body: search.cuts.map((id) => displayName(save.year, id)).join(", ") + " are looking for a new head coach.",
      teamIds: [...search.cuts],
      playerIds: [],
    });
  }
  search.hot = hotNames(save);
  if (search.cuts.length && search.hot.length) {
    const names = search.hot.slice(0, 4).map((cid) => {
      const c = save.coaches[cid]!;
      return c.teamId && save.teams[c.teamId] ? `${c.name} (${c.role}, ${displayName(save.year, c.teamId)})` : `${c.name} (out of work)`;
    });
    addNews(save, {
      kind: "headline",
      headline: "The hot names",
      body: `Every search starts with the same list: ${names.join(", ")}.`,
      teamIds: [],
      playerIds: [],
    });
  }
}

/** Coordinators of the league's best units and proven head coaches out of work, best first. */
function hotNames(save: DynastySave): string[] {
  const ids = activeTeamIds(save.year);
  const played = ids.some((id) => save.teams[id]!.wins + save.teams[id]!.losses + save.teams[id]!.ties > 0);
  // Before a down is played the units have no record yet; rank every staff on its coaches' grades.
  const byPf = ids.slice().sort((a, b) => (played ? save.teams[b]!.pf - save.teams[a]!.pf : (save.coaches[save.teams[b]!.ocId ?? ""]?.offense ?? 0) - (save.coaches[save.teams[a]!.ocId ?? ""]?.offense ?? 0)));
  const byPa = ids.slice().sort((a, b) => (played ? save.teams[a]!.pa - save.teams[b]!.pa : (save.coaches[save.teams[b]!.dcId ?? ""]?.defense ?? 0) - (save.coaches[save.teams[a]!.dcId ?? ""]?.defense ?? 0)));
  const out: { id: string; score: number }[] = [];
  const fresh = (c: Coach | undefined): c is Coach => !!c && !c.retiredYear && c.age <= 62 && !otherJob(save, c);
  byPf.slice(0, 6).forEach((id, i) => {
    const oc = save.teams[id]?.ocId ? save.coaches[save.teams[id]!.ocId!] : undefined;
    if (fresh(oc) && oc.offense >= 74) out.push({ id: oc.id, score: oc.offense + (6 - i) * 1.5 + oc.leadership / 10 });
  });
  byPa.slice(0, 6).forEach((id, i) => {
    const dc = save.teams[id]?.dcId ? save.coaches[save.teams[id]!.dcId!] : undefined;
    if (fresh(dc) && dc.defense >= 74) out.push({ id: dc.id, score: dc.defense + (6 - i) * 1.5 + dc.leadership / 10 });
  });
  const firedNow = new Set((save.coachSearch?.cuts ?? []).map((id) => save.teams[id]?.coachId));
  for (const c of availableCoaches(save, "HC")) {
    if (!fresh(c) || firedNow.has(c.id) || c.careerWins < 40 || c.careerWins <= c.careerLosses) continue;
    out.push({ id: c.id, score: Math.max(c.offense, c.defense) + c.careerTitles * 3 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6).map((x) => x.id);
}

/** During the playoffs the clubs with openings talk to the hot names, a couple of meetings a week. */
export function interviewWeek(save: DynastySave): void {
  const search = save.coachSearch?.year === save.year ? save.coachSearch : undefined;
  if (!search?.cuts.length || !search.hot.length) return;
  for (let k = 0; k < 2; k++) {
    const teamId = search.cuts[randInt(save, 0, search.cuts.length - 1)]!;
    const coachId = search.hot[randInt(save, 0, search.hot.length - 1)]!;
    if (search.interviews.some((x) => x.teamId === teamId && x.coachId === coachId)) continue;
    const c = save.coaches[coachId];
    if (!c) continue;
    search.interviews.push({ coachId, teamId });
    const alive = c.teamId && save.playoffGames.some((g) => !g.played && (g.homeId === c.teamId || g.awayId === c.teamId));
    addNews(save, {
      kind: "headline",
      headline: `${displayName(save.year, teamId)} interview ${c.name}`,
      body: alive
        ? `The ${displayName(save.year, c.teamId!)} ${c.role === "OC" ? "offensive" : c.role === "DC" ? "defensive" : ""} coordinator takes the meeting between playoff games.`.replace("  ", " ")
        : `${c.name} sits down with the club about its head-coaching job.`,
      teamIds: [teamId],
      playerIds: [],
    });
  }
}

/**
 * The record's hire for this opening (realBlackMonday): a head coach elsewhere comes over when
 * that club is changing too, a coordinator is hired away, a man out of work just signs.
 */
function realHire(save: DynastySave, teamId: TeamId, search: CoachSearch | undefined): { coach: Coach; from?: { teamId: TeamId; role: "OC" | "DC" } } | undefined {
  const c = search?.real?.[teamId] ? save.coaches[search.real[teamId]!] : undefined;
  if (!c || c.retiredYear || c.hofYear) return undefined;
  const t = save.teams[teamId];
  const at = c.teamId && c.teamId !== teamId ? c.teamId : undefined;
  let from: { teamId: TeamId; role: "OC" | "DC" } | undefined;
  if (at && save.teams[at]?.coachId === c.id) {
    // Andy Reid to Kansas City: only once Philadelphia is making its own change.
    if (!search!.cuts.includes(at)) return undefined;
    vacate(save, c, "HC", at);
  } else if (at) {
    const was = save.teams[at]?.ocId === c.id ? "OC" : "DC";
    vacate(save, c, was, at);
    from = { teamId: at, role: was };
  } else if (t.ocId === c.id || t.dcId === c.id) {
    // His own coordinator promoted (Jerry Burns in Minnesota): that job opens.
    const was = t.ocId === c.id ? "OC" : "DC";
    vacate(save, c, was, teamId);
    from = { teamId, role: was };
  }
  c.role = "HC";
  c.teamId = teamId;
  c.yearsOnJob = 1;
  c.interimYear = undefined;
  c.interimFrom = undefined;
  t.coachId = c.id;
  t.offScheme = c.offScheme;
  t.defScheme = c.defScheme;
  leaveOtherPosts(save, c);
  if (from) {
    const fill = autoHireCoord(save, from.teamId, from.role);
    if (from.teamId !== teamId) noteCarousel(save, from.teamId, from.role, c.name, fill.name, `${displayName(save.year, from.teamId)} lose ${c.name} to ${displayName(save.year, teamId)}; ${fill.name} is the new ${from.role}.`);
  }
  if (search) search.hot = search.hot.filter((id) => id !== c.id);
  return { coach: c, from: from && from.teamId !== teamId ? from : undefined };
}

/** Fill an opening: a hot name the club talked to first, then the usual market. */
function hireForVacancy(
  save: DynastySave,
  teamId: TeamId,
  exclude: string | undefined,
  search: CoachSearch | undefined,
): { coach: Coach; from?: { teamId: TeamId; role: "OC" | "DC" } } {
  const real = realHire(save, teamId, search);
  if (real) return real;
  const talked = new Set((search?.interviews ?? []).filter((x) => x.teamId === teamId).map((x) => x.coachId));
  const options = (search?.hot ?? [])
    .map((id) => save.coaches[id])
    .filter((c): c is Coach => !!c && c.id !== exclude && !c.retiredYear && !headCoachOf(save, c) && !otherJob(save, c))
    .sort((a, b) => Number(talked.has(b.id)) - Number(talked.has(a.id)));
  const pick = options[0];
  if (pick && rand(save) < (talked.has(pick.id) ? 0.7 : 0.4)) {
    const t = save.teams[teamId];
    const was = pick.teamId && save.teams[pick.teamId]?.ocId === pick.id ? "OC" : pick.teamId && save.teams[pick.teamId]?.dcId === pick.id ? "DC" : undefined;
    const fromTeam = pick.teamId;
    if (was && fromTeam) vacate(save, pick, was, fromTeam);
    pick.role = "HC";
    pick.teamId = teamId;
    pick.yearsOnJob = 1;
    pick.interimYear = undefined;
    pick.interimFrom = undefined;
    t.coachId = pick.id;
    t.offScheme = pick.offScheme;
    t.defScheme = pick.defScheme;
    leaveOtherPosts(save, pick);
    // His old club refills the job once he's gone, so the refill can't pick him again.
    if (was && fromTeam) {
      const fill = autoHireCoord(save, fromTeam, was);
      noteCarousel(save, fromTeam, was, pick.name, fill.name, `${displayName(save.year, fromTeam)} lose ${pick.name} to ${displayName(save.year, teamId)}; ${fill.name} is the new ${was}.`);
    }
    if (search) search.hot = search.hot.filter((id) => id !== pick.id);
    return { coach: pick, from: was && fromTeam ? { teamId: fromTeam, role: was } : undefined };
  }
  return { coach: autoHireHeadCoach(save, teamId, exclude) };
}

/** " Another branch of the Walsh tree." when the new man came up under a head coach. */
function treeBranch(save: DynastySave, c: Coach): string {
  const m = mentorOf(save, c.name);
  return m ? ` Another branch of the ${m.name.split(" ").slice(-1)[0]} tree.` : "";
}
