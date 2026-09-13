import {
  SAVE_VERSION,
  STARTING_YEAR,
  TEAM_IDS,
  type DynastySave,
  type TeamId,
  type TeamState,
} from "./types.ts";
import { assignKit } from "./abilities.ts";

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
  };
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
    },
    draftBoard: [],
    draftPickIndex: 0,
    nextPlayerSeq: 1000,
    nextNewsSeq: 1,
    pendingRetirees: [],
    pendingHof: [],
    lastPow: {},
    salaryCap: null,
    carousel: [],
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
    lastPow: r.lastPow ?? {},
    salaryCap: r.salaryCap ?? null,
    carousel: r.carousel ?? [],
    primetime: r.primetime,
    userTeamId,
    startingYear,
  };
  for (const pl of Object.values(out.players)) {
    pl.salary = pl.salary ?? 0;
    pl.abilities = pl.abilities ?? [];
    pl.traits = pl.traits ?? [];
    pl.career = pl.career ?? [];
    pl.injuredWeeks = pl.injuredWeeks ?? 0;
    if (pl.ratings) {
      const kit = assignKit(pl.pos, pl.ratings, pl.firstName, pl.lastName);
      const ab = new Set([...(pl.abilities ?? []), ...kit.abilities]);
      const tr = new Set([...(pl.traits ?? []), ...kit.traits]);
      pl.abilities = [...ab].slice(0, 4);
      pl.traits = [...tr].slice(0, 3);
    }
  }
  for (const c of Object.values(out.coaches)) {
    c.role = c.role ?? "HC";
    c.offScheme = c.offScheme ?? "multiple";
    c.defScheme = c.defScheme ?? "4-3";
    c.yearsOnJob = c.yearsOnJob ?? 1;
    c.careerWins = c.careerWins ?? 0;
    c.careerLosses = c.careerLosses ?? 0;
  }
  return out;
}

export function cloneSave(save: DynastySave): DynastySave {
  return structuredClone(save);
}
