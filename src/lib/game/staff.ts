import type { Coach, CoachRole, DefScheme, DynastySave, OffScheme, TeamId } from "./types.ts";
import { activeTeamIds, displayName } from "./teams.ts";
import { COORDINATORS_1966, LATER_COACHES, type CoachSeed } from "./data/coaches.ts";
import { addNews } from "./news.ts";
import { rand, randInt } from "./rng.ts";
import { winPct } from "./standings.ts";

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

function bump(seed: CoachSeed, role: CoachRole, extra?: Partial<Coach>): Coach {
  return {
    id: seed.id,
    name: seed.name,
    teamId: seed.teamId,
    yearAvail: seed.yearAvail,
    offense: seed.offense,
    defense: seed.defense,
    historical: true,
    role,
    offScheme: extra?.offScheme ?? "multiple",
    defScheme: extra?.defScheme ?? "4-3",
    yearsOnJob: extra?.yearsOnJob ?? 1,
    careerWins: extra?.careerWins ?? 0,
    careerLosses: extra?.careerLosses ?? 0,
  };
}

function genCoord(save: DynastySave, teamId: TeamId, role: "OC" | "DC"): Coach {
  const first = ["Bill", "Jim", "Tom", "Dick", "Don", "Ray", "Chuck", "Joe", "Paul", "Ted"];
  const last = ["Walsh", "Ringo", "McCulley", "Austin", "Levy", "Schnellenberger", "Ryan", "Bugel", "Coryell", "LeBeau"];
  save.nextPlayerSeq += 1;
  const id = `c-${role.toLowerCase()}-${teamId}-${save.nextPlayerSeq}`;
  const off = role === "OC" ? randInt(save, 68, 88) : randInt(save, 58, 78);
  const def = role === "DC" ? randInt(save, 68, 88) : randInt(save, 58, 78);
  return {
    id,
    name: `${first[randInt(save, 0, first.length - 1)]} ${last[randInt(save, 0, last.length - 1)]}`,
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
  };
}

export function seedStaff(save: DynastySave): void {
  for (const c of Object.values(save.coaches)) {
    if (!c.role) c.role = "HC";
    c.offScheme = c.offScheme ?? "multiple";
    c.defScheme = c.defScheme ?? "4-3";
    c.yearsOnJob = c.yearsOnJob ?? 2;
    c.careerWins = c.careerWins ?? 0;
    c.careerLosses = c.careerLosses ?? 0;
  }
  for (const seed of COORDINATORS_1966) {
    const role: CoachRole = seed.id.includes("-oc") ? "OC" : "DC";
    const coach = bump(seed, role, {
      offScheme: TEAM_OFF[seed.teamId ?? "gnb"] ?? "multiple",
      defScheme: TEAM_DEF[seed.teamId ?? "gnb"] ?? "4-3",
    });
    save.coaches[coach.id] = coach;
    if (seed.teamId && save.teams[seed.teamId]) {
      if (role === "OC") save.teams[seed.teamId].ocId = coach.id;
      else save.teams[seed.teamId].dcId = coach.id;
    }
  }
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    t.offScheme = TEAM_OFF[id] ?? "multiple";
    t.defScheme = TEAM_DEF[id] ?? "4-3";
    t.draftStyle = draftStyleOf(id);
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

export function runCoachingCarousel(save: DynastySave): void {
  save.carousel = save.carousel ?? [];
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    const hc = t.coachId ? save.coaches[t.coachId] : undefined;
    if (hc) {
      hc.yearsOnJob += 1;
      hc.careerWins += t.wins;
      hc.careerLosses += t.losses;
    }
    const pct = winPct(t);
    const games = t.wins + t.losses + t.ties;
    const bad = games >= 10 && pct < 0.32 && (hc?.yearsOnJob ?? 2) >= 2;
    const stale = games >= 10 && pct < 0.4 && (hc?.yearsOnJob ?? 0) >= 5;
    if ((bad && rand(save) < 0.62) || (stale && rand(save) < 0.4)) {
      const fired = hc?.name;
      if (hc) {
        hc.teamId = null;
        hc.yearsOnJob = 0;
      }
      const hired = hireHeadCoach(save, id);
      save.carousel.push({
        year: save.year,
        teamId: id,
        fired,
        hired: hired.name,
        role: "HC",
        note: fired ? `${displayName(save.year, id)} fire ${fired}; hire ${hired.name}.` : `${displayName(save.year, id)} hire ${hired.name}.`,
      });
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
  }
}

function hireHeadCoach(save: DynastySave, teamId: TeamId): Coach {
  const available = LATER_COACHES.filter((s) => s.yearAvail <= save.year + 1).filter((s) => {
    const existing = save.coaches[s.id];
    return !existing || !existing.teamId;
  });
  let coach: Coach;
  if (available.length && rand(save) < 0.7) {
    const seed = available[randInt(save, 0, available.length - 1)]!;
    coach = save.coaches[seed.id] ?? bump(seed, "HC");
    coach.role = "HC";
    coach.teamId = teamId;
    coach.yearsOnJob = 1;
    save.coaches[coach.id] = coach;
  } else {
    const promote = save.teams[teamId].ocId ? save.coaches[save.teams[teamId].ocId!] : undefined;
    if (promote && rand(save) < 0.5) {
      promote.role = "HC";
      promote.teamId = teamId;
      promote.yearsOnJob = 1;
      coach = promote;
      const oc = genCoord(save, teamId, "OC");
      save.coaches[oc.id] = oc;
      save.teams[teamId].ocId = oc.id;
    } else {
      const g = genCoord(save, teamId, "OC");
      g.role = "HC";
      g.offense = Math.max(g.offense, randInt(save, 72, 90));
      save.coaches[g.id] = g;
      coach = g;
    }
  }
  save.teams[teamId].coachId = coach.id;
  save.teams[teamId].offScheme = coach.offScheme;
  save.teams[teamId].defScheme = coach.defScheme;
  return coach;
}


export function ensureStaff(save: DynastySave): void {
  for (const id of activeTeamIds(save.year)) {
    const t = save.teams[id];
    if (!t) continue;
    t.draftStyle = t.draftStyle ?? draftStyleOf(id);
    t.offScheme = t.offScheme ?? "multiple";
    t.defScheme = t.defScheme ?? "4-3";
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
