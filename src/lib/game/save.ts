import {
  SAVE_VERSION,
  STARTING_YEAR,
  TEAM_IDS,
  type DynastySave,
  type Player,
  type SeasonStats,
  type TeamId,
  type TeamState,
} from "./types.ts";
import { assignKit } from "./abilities.ts";
import { lookupCollege } from "./data/colleges.ts";
import { seedPriorCareer } from "./data/careerPrior.ts";
import { applyScout } from "./scout.ts";
import { SKILL_POSITIONS } from "./types.ts";
import { fillCoachFields, makeCoachFromSeed } from "./staff.ts";
import { MORE_COACHES } from "./data/coachesMore.ts";
import { newOwnerState } from "./owner.ts";
import { backfillHonors } from "./honors.ts";
import { setHomeOverride } from "./teams.ts";
import { normalizeJerseys, reissueJerseysByEra, restoreVeteranNumbers, syncDepth } from "./players.ts";
import { editsAgainst, NEUTRAL_PLAN, syncRealSchemes } from "./gameplans.ts";
import { repairPlayerIdentities } from "./repairIdentities.ts";
import { unpackPlayers } from "./compact.ts";

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
  // Disk saves pack their players (see compact.ts); put them back before anything reads them.
  if (raw && typeof raw === "object") unpackPlayers(raw as Parameters<typeof unpackPlayers>[0]);
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
    t.plan.protection ??= "balanced";
    t.plan.defensiveFocus ??= "balanced";
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
    jerseyEra: r.jerseyEra,
    liveOn: r.liveOn,
    liveResume: r.liveResume,
    calls: r.calls,
    talks: r.talks,
    tagYear: r.tagYear,
    previewPicks: r.previewPicks,
    liveOrders: r.liveOrders,
    progression: r.progression,
    faBids: r.faBids,
    powerRanks: r.powerRanks,
    h2h: r.h2h,
    coachSearch: r.coachSearch,
    realHistory: r.realHistory,
    seasonPlan: r.seasonPlan,
    lastPlan: r.lastPlan,
    achievements: r.achievements,
    carousel: r.carousel ?? [],
    teamGameRecords: r.teamGameRecords ?? {},
    bestSeasonMarks: r.bestSeasonMarks ?? {},
    owner: r.owner ? { ...newOwnerState(), ...r.owner } : newOwnerState(),
    primetime: r.primetime,
    primetimeArchive: (r.primetimeArchive ?? []).slice(-26),
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
  const savedRng = out.rng;
  repairPlayerIdentities(out);
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
  // Coaches added to the real pipeline after this dynasty began join the pool too, as long as
  // they're still young enough to be coaching.
  for (const seed of MORE_COACHES) {
    if (out.coaches[seed.id]) continue;
    if (seed.born && out.year - seed.born > 68) continue;
    out.coaches[seed.id] = makeCoachFromSeed(seed, out.year, { teamId: null, role: seed.role ?? "HC" });
  }
  // Clubs used to store one neutral call sheet each, so nobody ran his coach's game. Keep only
  // what an owner changed by hand; the rest now comes from the staff's own playbooks.
  for (const t of Object.values(out.teams)) {
    if (t.planEdits) continue;
    t.planEdits = t.id === out.userTeamId && t.plan ? editsAgainst(NEUTRAL_PLAN, t.plan) : {};
  }
  syncRealSchemes(out, (id) => {
    out.teams[id].depth = {};
    syncDepth(out, id);
  });
  // One plaque each: older saves could enshrine a player twice. Keep his first class.
  const seenHof = new Set<string>();
  out.history.hof = out.history.hof
    .slice()
    .sort((a, b) => a.year - b.year)
    .filter((h) => {
      const k = h.playerId ? `p:${h.playerId}` : `c:${h.coachId}`;
      if (seenHof.has(k)) return false;
      seenHof.add(k);
      if (h.playerId && out.players[h.playerId]) out.players[h.playerId]!.hofYear = h.year;
      return true;
    });
  for (const h of out.history.hof) {
    h.kind = h.kind ?? (h.coachId ? "coach" : "player");
  }
  for (const r of out.history.retirements) {
    r.kind = r.kind ?? (r.coachId ? "coach" : "player");
  }
  setHomeOverride(out.owner?.home);
  retireDraftTwins(out);
  backfillHonors(out);
  // Older saves numbered every era off one chart (1990s ends in the 80s, no 90s for the front
  // seven); bring rosters in line with the year's numbering rules.
  if (!out.jerseyEra) {
    reissueJerseysByEra(out);
    out.jerseyEra = true;
  } else normalizeJerseys(out);
  restoreVeteranNumbers(out);
  // Loading (including jersey repair) must not change the next simulated play.
  out.rng = savedRng;
  return out;
}

/**
 * Older draft data listed a few prospects twice under different name splits ("Too Tall" Jones
 * and "Too" Tall Jones), so saves from before the fix carry two copies of one real player.
 * Their careers stay in the books; the lesser active copy retires quietly.
 */
function retireDraftTwins(save: DynastySave): void {
  const key = (p: Player) => `${p.firstName} ${p.lastName}`.toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ").trim();
  const seen = new Map<string, Player>();
  for (const p of Object.values(save.players)) {
    if (!p.historical || p.draftYear == null) continue;
    const k = `${key(p)}|${p.pos}|${p.draftYear}`;
    const twin = seen.get(k);
    if (!twin) {
      seen.set(k, p);
      continue;
    }
    const active = (x: Player) => !settled(x) && x.teamId !== "fa";
    // Keep the one on a roster, then the better one.
    const [keep, drop] =
      active(twin) !== active(p) ? (active(twin) ? [twin, p] : [p, twin]) : twin.ovr >= p.ovr ? [twin, p] : [p, twin];
    seen.set(k, keep);
    drop.twinOf = keep.id;
    if (settled(drop)) continue;
    const from = drop.teamId;
    if (from !== "fa" && save.teams[from as TeamId]) {
      const t = save.teams[from as TeamId];
      t.roster = t.roster.filter((id) => id !== drop.id);
      if (t.depth) for (const pos of Object.keys(t.depth) as (keyof typeof t.depth)[]) t.depth[pos] = (t.depth[pos] ?? []).filter((id) => id !== drop.id);
    }
    drop.teamId = "retired";
    drop.retiredYear = drop.retiredYear ?? save.year;
  }
}

function outYear(r: Partial<DynastySave>, fallback: number): number {
  return r.year ?? fallback;
}

/** Retired players and Hall of Famers: history, not state. Shared between save copies. */
function settled(p: Player): boolean {
  return p.teamId === "retired" || p.teamId === "hof";
}

let freezeSettled = false;
/** QA only: freeze shared retired players so any write to one throws instead of leaking across copies. */
export function setFreezeSettled(on: boolean): void {
  freezeSettled = on;
}

function deepFreeze(o: unknown): void {
  if (!o || typeof o !== "object" || Object.isFrozen(o)) return;
  Object.freeze(o);
  for (const v of Object.values(o)) deepFreeze(v);
}

/** A season line from a finished year: nothing writes to it again, so copies share it. */
function shareLines(rec: Record<number, SeasonStats>, year: number): Record<number, SeasonStats> {
  const o: Record<number, SeasonStats> = {};
  for (const y in rec) {
    const line = rec[y]!;
    if (+y < year) {
      if (freezeSettled) deepFreeze(line);
      o[y] = line;
    } else o[y] = { ...line };
  }
  return o;
}

/** A living player's copy: his finished seasons are shared, everything else is his own. */
function clonePlayer(p: Player, year: number): Player {
  const q = { ...p } as Record<string, unknown>;
  for (const k in q) {
    const v = q[k];
    if (!v || typeof v !== "object") continue;
    if (k === "stats" || k === "playoffStats") q[k] = shareLines(v as Record<number, SeasonStats>, year);
    else if (k === "career")
      q[k] = (v as SeasonStats[]).map((c) => {
        if (c.year < year) {
          if (freezeSettled) deepFreeze(c);
          return c;
        }
        return { ...c };
      });
    else if (k === "ratings") q[k] = { ...(v as object) };
    else q[k] = structuredClone(v);
  }
  return q as unknown as Player;
}

/**
 * A working copy of the save. By a late dynasty nine players in ten are retired, and copying
 * them was most of the cost of every advance; they're shared by reference instead and only the
 * living part of the league is copied. Code that changes a retired player takes its own copy
 * first with ownPlayer. The rest of the save's history is shared the same way: finished games,
 * used draft picks, the retirement log and every season line from a past year are never
 * written again (finished games are replaced, not edited, when their film is dropped).
 */
export function cloneSave(save: DynastySave): DynastySave {
  const { players, history, teams, schedule, ...rest } = save;
  const out = structuredClone(rest) as DynastySave;
  const { retirements, ...hist } = history;
  out.history = { ...(structuredClone(hist) as typeof hist), retirements: retirements.slice() };
  if (freezeSettled) for (const r of retirements) deepFreeze(r);
  const clubs = {} as DynastySave["teams"];
  for (const id in teams) {
    const { picks, ...t } = teams[id as TeamId];
    clubs[id as TeamId] = {
      ...(structuredClone(t) as typeof t),
      picks: (picks ?? []).map((pk) => {
        if (!pk.used) return { ...pk };
        if (freezeSettled) deepFreeze(pk);
        return pk;
      }),
    } as TeamState;
  }
  out.teams = clubs;
  out.schedule = schedule.map((g) => {
    if (!g.played) return structuredClone(g);
    if (freezeSettled) deepFreeze(g);
    return g;
  });
  const next: Record<string, Player> = {};
  // Same key order as the original: iteration order feeds the deterministic sim.
  for (const id in players) {
    const p = players[id]!;
    if (settled(p)) {
      if (freezeSettled) deepFreeze(p);
      next[id] = p;
    } else next[id] = clonePlayer(p, save.year);
  }
  out.players = next;
  return out;
}

