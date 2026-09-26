import {
  SAVE_VERSION,
  STARTING_YEAR,
  TEAM_IDS,
  type DynastySave,
  type SeasonStats,
  type TeamId,
  type TeamState,
} from "./types.ts";
import { assignKit } from "./abilities.ts";
import { lookupCollege } from "./data/colleges.ts";
import { seedPriorCareer } from "./data/careerPrior.ts";
import { applyScout } from "./scout.ts";
import { SKILL_POSITIONS } from "./types.ts";
import { fillCoachFields } from "./staff.ts";
import { newOwnerState } from "./owner.ts";
import { backfillHonors } from "./honors.ts";
import { setHomeOverride } from "./teams.ts";

export function emptyTeam(id: TeamId, active: boolean): TeamState {
  return {
    id,
    active,
    coachId: null,
    ocId: null,
    dcId: null,
    offScheme: "multiple",
    defScheme: "4-3",
    draftStyle: "need",
    payroll: 0,
    roster: [],
    depth: {},
    picks: [],
    wins: 0,
    losses: 0,
    ties: 0,
    pf: 0,
    pa: 0,
    divWins: 0,
    divLosses: 0,
    confWins: 0,
    confLosses: 0,
    streak: "",
    careerWins: 0,
    careerLosses: 0,
    careerTies: 0,
    plan: { attack: "balanced", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced" },
  };
}

function fillStatFields(s: SeasonStats): void {
  s.targets = s.targets ?? 0;
  s.tfl = s.tfl ?? 0;
  s.pd = s.pd ?? 0;
  s.qbHits = s.qbHits ?? 0;
  s.fr = s.fr ?? 0;
  s.krTd = s.krTd ?? 0;
  s.prTd = s.prTd ?? 0;
}

export function resetSeasonRecord(t: TeamState): void {
  t.wins = 0;
  t.losses = 0;
  t.ties = 0;
  t.pf = 0;
  t.pa = 0;
  t.divWins = 0;
  t.divLosses = 0;
  t.confWins = 0;
  t.confLosses = 0;
  t.streak = "";
}

export function blankState(userTeamId: TeamId, startingYear = STARTING_YEAR, seed = 1966): DynastySave {
  const teams = {} as DynastySave["teams"];
  for (const id of TEAM_IDS) {
    teams[id] = emptyTeam(id, false);
  }
  setHomeOverride(undefined);
  return {
    version: SAVE_VERSION,
    startingYear,
    year: startingYear,
    week: 0,
    phase: "draft",
    weekLabel: `${startingYear} Draft`,
    userTeamId,
    seed,
    rng: seed >>> 0,
    cpuOnly: false,
    players: {},
    teams,
    coaches: {},
    schedule: [],
    playoffGames: [],
    news: [],
    weekNews: [],
    transactions: [],
    history: {
      superBowls: [],
      championships: [],
      hof: [],
      teamOfHonor: {},
      awards: [],
      retirements: [],
      seasons: [],
    },
    draftBoard: [],
    draftPickIndex: 0,
    draftSession: startingYear === 1966 ? "nfl" : "common",
    nextPlayerSeq: 1000,
    nextNewsSeq: 1,
    pendingRetirees: [],
    pendingHof: [],
    pendingCoachRetirees: [],
    pendingCoachHof: [],
    lastPow: {},
    salaryCap: null,
    carousel: [],
    waiverOrder: [],
    waivers: [],
    faOpened: false,
    teamGameRecords: {},
    bestSeasonMarks: {},
    owner: newOwnerState(),
    honorsBackfilled: true,
  };
}

export function hydrateSave(raw: unknown): DynastySave {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DynastySave>;
  const userTeamId = (r.userTeamId as TeamId) || "gnb";
  const startingYear = r.startingYear ?? STARTING_YEAR;
  const base = blankState(userTeamId, startingYear, r.seed ?? 1966);
  const teams = { ...base.teams, ...(r.teams ?? {}) };
  for (const id of TEAM_IDS) {
    if (!teams[id]) teams[id] = emptyTeam(id, false);
    const t = teams[id];
    t.roster = t.roster ?? [];
    t.depth = t.depth ?? {};
    t.picks = t.picks ?? [];
    t.wins = t.wins ?? 0;
    t.losses = t.losses ?? 0;
    t.ties = t.ties ?? 0;
    t.pf = t.pf ?? 0;
    t.pa = t.pa ?? 0;
    t.divWins = t.divWins ?? 0;
    t.divLosses = t.divLosses ?? 0;
    t.confWins = t.confWins ?? 0;
    t.confLosses = t.confLosses ?? 0;
    t.streak = t.streak ?? "";
    t.careerWins = t.careerWins ?? 0;
    t.careerLosses = t.careerLosses ?? 0;
    t.careerTies = t.careerTies ?? 0;
    t.plan = t.plan ?? { attack: "balanced", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced" };
    t.plan.blitz = t.plan.blitz ?? "normal";
    t.plan.redZone = t.plan.redZone ?? "balanced";
    t.active = t.active ?? false;
    t.ocId = t.ocId ?? null;
    t.dcId = t.dcId ?? null;
    t.offScheme = t.offScheme ?? "multiple";
    t.defScheme = t.defScheme ?? "4-3";
    t.draftStyle = t.draftStyle ?? "need";
    t.payroll = t.payroll ?? 0;
  }
  const history = {
    ...base.history,
    ...(r.history ?? {}),
    superBowls: r.history?.superBowls ?? [],
    championships: r.history?.championships ?? [],
    hof: r.history?.hof ?? [],
    teamOfHonor: r.history?.teamOfHonor ?? {},
    awards: r.history?.awards ?? [],
    retirements: r.history?.retirements ?? [],
    seasons: r.history?.seasons ?? [],
    grade: r.history?.grade,
  };
  const out: DynastySave = {
    ...base,
    ...r,
    version: SAVE_VERSION,
    teams,
    players: r.players ?? {},
    coaches: r.coaches ?? {},
    schedule: r.schedule ?? [],
    playoffGames: r.playoffGames ?? [],
    news: r.news ?? [],
    weekNews: r.weekNews ?? [],
    transactions: r.transactions ?? [],
    history,
    draftBoard: r.draftBoard ?? [],
    pendingRetirees: r.pendingRetirees ?? [],
    pendingHof: r.pendingHof ?? [],
    pendingCoachRetirees: r.pendingCoachRetirees ?? [],
    pendingCoachHof: r.pendingCoachHof ?? [],
    lastPow: r.lastPow ?? {},
    salaryCap: r.salaryCap ?? null,
    salaryModel: r.salaryModel,
    honorsBackfilled: r.honorsBackfilled,
    crunch: r.crunch,
    crunchOn: r.crunchOn,
    powerRanks: r.powerRanks,
    h2h: r.h2h,
    seasonPlan: r.seasonPlan,
    lastPlan: r.lastPlan,
    achievements: r.achievements,
    carousel: r.carousel ?? [],
    teamGameRecords: r.teamGameRecords ?? {},
    bestSeasonMarks: r.bestSeasonMarks ?? {},
    owner: r.owner ? { ...newOwnerState(), ...r.owner } : newOwnerState(),
    primetime: r.primetime,
    userTeamId,
    startingYear,
    draftSession: r.draftSession ?? (outYear(r, startingYear) === 1966 ? "nfl" : "common"),
    waiverOrder: r.waiverOrder ?? [],
    waivers: r.waivers ?? [],
    faOpened: r.faOpened ?? false,
    weekFilm: r.weekFilm ?? false,
    camp: r.camp,
    deadline: r.deadline,
  };
  for (const pl of Object.values(out.players)) {
    pl.salary = pl.salary ?? 0;
    pl.abilities = pl.abilities ?? [];
    pl.traits = pl.traits ?? [];
    pl.career = pl.career ?? [];
    pl.injuredWeeks = pl.injuredWeeks ?? 0;
    pl.onIR = pl.onIR ?? false;
    pl.snaps = pl.snaps ?? 0;
    pl.morale = pl.morale ?? 70;
    pl.potential = pl.potential ?? Math.min(99, (pl.ovr ?? 60) + 2);
    pl.scoutOvr = pl.scoutOvr ?? pl.ovr;
    if (pl.stats) {
      for (const s of Object.values(pl.stats)) fillStatFields(s);
    }
    if (pl.career) {
      for (const s of pl.career) fillStatFields(s);
    }
    if (pl.revealed == null) {
      const prospect = pl.draftYear === out.year && pl.yearsPro <= 0 && out.phase === "draft";
      pl.revealed = !prospect;
    }
    if (!pl.college) pl.college = lookupCollege(pl.firstName, pl.lastName);
    if (pl.historical && pl.yearsPro > 0) {
      const start = out.startingYear ?? STARTING_YEAR;
      const through = start - 1;
      // yearsPro keeps counting through the dynasty (+1 every offseason when the year turns),
      // so it can't date a veteran's debut on a later load: every reload used to invent more
      // pre-1966 seasons (a 1964 rookie grew a "career" back to 1957). Back out the offseasons
      // he has aged through since the start: one per year for active players; a retiree stops
      // aging the offseason he retires. Prior rows are rebuilt on every load, so this also
      // repairs saves that already picked up phantom seasons.
      const retired = pl.teamId === "retired" || pl.teamId === "hof";
      const agings = retired && pl.retiredYear != null ? pl.retiredYear - start - 1 : out.year - start;
      const priorPro = Math.max(0, pl.yearsPro - Math.max(0, agings));
      const debut = pl.draftYear ?? start - priorPro;
      if (priorPro === 0 && pl.career.some((c) => c.year < start)) {
        pl.career = pl.career.filter((c) => c.year >= start);
      } else if (priorPro > 0 && debut <= through) {
        const prior = seedPriorCareer({ ...pl, yearsPro: priorPro }, through);
        if (prior.length) {
          const sim = pl.career.filter((s) => s.year >= (out.startingYear ?? STARTING_YEAR));
          pl.career = [...prior, ...sim];
        }
      }
    }
    if (pl.career) {
      for (const s of pl.career) fillStatFields(s);
    }
    if (pl.ratings) {
      const kit = assignKit(pl.pos, pl.ratings, pl.firstName, pl.lastName);
      const ab = new Set([...(pl.abilities ?? []), ...kit.abilities]);
      const tr = new Set([...(pl.traits ?? []), ...kit.traits]);
      pl.abilities = [...ab].slice(0, 4);
      pl.traits = [...tr].slice(0, 3);
    }
    if (pl.scoutOvr == null || pl.potential == null) applyScout(out, pl);
  }
  for (const t of Object.values(out.teams)) {
    if (!t.depth || !Object.keys(t.depth).length) {
      t.depth = {};
      for (const pos of SKILL_POSITIONS) {
        const ids = t.roster
          .map((id) => out.players[id])
          .filter((p) => p && p.pos === pos)
          .sort((a, b) => (b?.ovr ?? 0) - (a?.ovr ?? 0))
          .map((p) => p!.id);
        if (ids.length) t.depth[pos] = ids;
      }
    }
    t.picks = t.picks ?? [];
  }
  for (const c of Object.values(out.coaches)) {
    fillCoachFields(c, out.year);
  }
  for (const h of out.history.hof) {
    h.kind = h.kind ?? (h.coachId ? "coach" : "player");
  }
  for (const r of out.history.retirements) {
    r.kind = r.kind ?? (r.coachId ? "coach" : "player");
  }
  setHomeOverride(out.owner?.home);
  backfillHonors(out);
  return out;
}

function outYear(r: Partial<DynastySave>, fallback: number): number {
  return r.year ?? fallback;
}

export function cloneSave(save: DynastySave): DynastySave {
  return structuredClone(save);
}
