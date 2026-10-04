/**
 * Every club calls the game its staff would actually call. A real coach brings his own
 * playbook (the system and the tendencies he had in real life); a made-up coach falls
 * back on what his scheme suggests. The head coach sets fourth-down nerve; the side of the
 * ball he came up on, he calls himself, and the other side goes to his coordinator when
 * that coordinator is a real coach with a playbook of his own.
 */
import type { Coach, DefScheme, DynastySave, Gameplan, OffScheme, TeamId } from "./types.ts";
import { PLAYBOOKS, playbookFor, type Playbook } from "./data/coachPlans.ts";

const NEUTRAL: Gameplan = { attack: "balanced", fourth: "normal", tempo: "standard", blitz: "normal", redZone: "balanced", protection: "balanced", defensiveFocus: "balanced" };

export function defaultPlan(offScheme?: string): Gameplan {
  if (offScheme === "smashmouth") return { ...NEUTRAL, attack: "run", fourth: "conservative", tempo: "chew", blitz: "rare", redZone: "power" };
  // Vertical means stretching the field (Air Coryell, the Bombs Away teams), not a no-huddle:
  // only the coaches who really ran one game-long (their playbooks say so) get the hurry-up.
  if (offScheme === "vertical") return { ...NEUTRAL, attack: "pass", redZone: "spread" };
  if (offScheme === "westcoast") return { ...NEUTRAL, attack: "pass" };
  return { ...NEUTRAL };
}

export function playbookOf(c: Coach | undefined, year: number): Playbook | undefined {
  return c && c.historical ? playbookFor(c.id, year) : undefined;
}

type Caller = { coach: Coach; book?: Playbook };

/** Who calls each side of the ball for this club, and from which playbook. */
export function playCallers(save: DynastySave, teamId: TeamId): { off?: Caller; def?: Caller; hc?: Caller } {
  const t = save.teams[teamId];
  if (!t) return {};
  const y = save.year;
  const get = (id: string | null | undefined): Caller | undefined => {
    const c = id ? save.coaches[id] : undefined;
    return c ? { coach: c, book: playbookOf(c, y) } : undefined;
  };
  const hc = get(t.coachId);
  const oc = get(t.ocId);
  const dc = get(t.dcId);
  const offMind = !!hc && hc.coach.offense >= hc.coach.defense;
  const both = !!hc?.book?.callsBoth;
  const off = hc?.book && (offMind || both) ? hc : oc?.book ? oc : hc ?? oc;
  const def = hc?.book && (!offMind || both) ? hc : dc?.book ? dc : hc ?? dc;
  return { off, def, hc };
}

/** The call sheet this club's staff brings into a game. */
export function staffPlan(save: DynastySave, teamId: TeamId): Gameplan {
  const t = save.teams[teamId];
  const base = defaultPlan(t?.offScheme);
  if (!t) return base;
  const { off, def, hc } = playCallers(save, teamId);
  const o = off?.book?.plan ?? {};
  const d = def?.book?.plan ?? {};
  return {
    attack: o.attack ?? base.attack,
    tempo: o.tempo ?? base.tempo,
    redZone: o.redZone ?? base.redZone,
    protection: o.protection ?? base.protection,
    blitz: d.blitz ?? base.blitz,
    defensiveFocus: d.defensiveFocus ?? base.defensiveFocus,
    fourth: hc?.book?.plan.fourth ?? base.fourth,
  };
}

const OFF_NAME: Record<string, string> = { smashmouth: "Power run game", vertical: "Vertical passing game", westcoast: "West Coast offense", multiple: "Multiple pro set" };
const DEF_NAME: Record<string, string> = { "4-3": "4-3", "3-4": "3-4", "wide-9": "Wide-9 4-3", "cover-2": "Cover 2" };

/**
 * The schemes a club lines up in: whoever calls each side brings his own, so a real
 * coordinator under a made-up head coach installs his system. An owner who set the
 * schemes himself at the desk keeps them.
 */
export function staffSchemes(save: DynastySave, teamId: TeamId): { off: OffScheme; def: DefScheme } | undefined {
  const { off, def, hc } = playCallers(save, teamId);
  if (!hc) return undefined;
  if (hc.coach.schemeLocked) return { off: hc.coach.offScheme, def: hc.coach.defScheme };
  return { off: off?.book?.off ?? hc.coach.offScheme, def: def?.book?.def ?? hc.coach.defScheme };
}

/** The named systems on each side of the ball, for the booth and the front office. */
export function staffSystems(save: DynastySave, teamId: TeamId): { offense: string; defense: string; offBy?: string; defBy?: string } {
  const t = save.teams[teamId];
  const { off, def } = playCallers(save, teamId);
  return {
    offense: off?.book?.offense ?? OFF_NAME[t?.offScheme ?? "multiple"] ?? "Multiple pro set",
    defense: def?.book?.defense ?? DEF_NAME[t?.defScheme ?? "4-3"] ?? "4-3",
    offBy: off?.book ? off.coach.name : undefined,
    defBy: def?.book ? def.coach.name : undefined,
  };
}

/**
 * Keep every real coach on the scheme he actually ran that season (Noll goes vertical in
 * 1978, Shula in 1983), and every club on its head coach's scheme. An owner who rewrote his
 * coach's scheme at the desk keeps his version.
 */
export function syncRealSchemes(save: DynastySave, onChange?: (teamId: TeamId) => void): void {
  for (const c of Object.values(save.coaches)) {
    if (!c.historical || c.schemeLocked || !PLAYBOOKS[c.id]) continue;
    const b = playbookFor(c.id, save.year)!;
    c.offScheme = b.off;
    c.defScheme = b.def;
  }
  for (const t of Object.values(save.teams)) applyStaffSchemes(save, t.id, onChange);
}

/** Line a club up in its staff's schemes; reports a change so the depth chart can be rebuilt. */
export function applyStaffSchemes(save: DynastySave, teamId: TeamId, onChange?: (teamId: TeamId) => void): void {
  const t = save.teams[teamId];
  const s = t && staffSchemes(save, teamId);
  if (!t || !s || (t.offScheme === s.off && t.defScheme === s.def)) return;
  t.offScheme = s.off;
  t.defScheme = s.def;
  onChange?.(teamId);
}

/** The owner's own changes to the staff's call sheet, as the fields that differ. */
export function editsAgainst(staff: Gameplan, plan: Partial<Gameplan>): Partial<Gameplan> {
  const out: Partial<Gameplan> = {};
  for (const k of Object.keys(plan) as (keyof Gameplan)[]) {
    if (plan[k] !== undefined && plan[k] !== staff[k]) (out as Record<string, unknown>)[k] = plan[k];
  }
  return out;
}

export const NEUTRAL_PLAN = NEUTRAL;
