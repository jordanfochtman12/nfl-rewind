/**
 * Coaching trees: who came up under whom. A coordinator's seasons on a head coach's staff are
 * counted every winter (Coach.mentors); the head coach he spent the most seasons under is his
 * mentor. Real coaches start with the documented roots of their careers (Walsh under Paul
 * Brown, Belichick under Parcells), and the timeline takes over once they've served on a staff
 * here. Coaches with one entry per chapter of a career are one person in the tree. No React.
 */
import type { Coach, DynastySave } from "./types.ts";

/** Real-life mentors, by name: the head coach each spent his formative years under. */
const REAL_MENTOR: Record<string, string> = {
  "Bill Walsh": "Paul Brown",
  "Chuck Noll": "Don Shula",
  "Joe Gibbs": "Don Coryell",
  "Bill Austin": "Vince Lombardi",
  "Phil Bengtson": "Vince Lombardi",
  "Tom Fears": "Vince Lombardi",
  "Norb Hecker": "Vince Lombardi",
  "Dan Reeves": "Tom Landry",
  "Mike Ditka": "Tom Landry",
  "Mike Holmgren": "Bill Walsh",
  "George Seifert": "Bill Walsh",
  "Dennis Green": "Bill Walsh",
  "Sam Wyche": "Bill Walsh",
  "Ray Rhodes": "Bill Walsh",
  "Mike Shanahan": "George Seifert",
  "Andy Reid": "Mike Holmgren",
  "Jon Gruden": "Mike Holmgren",
  "Steve Mariucci": "Mike Holmgren",
  "John Harbaugh": "Andy Reid",
  "Doug Pederson": "Andy Reid",
  "Sean McDermott": "Andy Reid",
  "Tony Dungy": "Chuck Noll",
  "Lovie Smith": "Tony Dungy",
  "Herm Edwards": "Tony Dungy",
  "Mike Tomlin": "Tony Dungy",
  "Bill Cowher": "Marty Schottenheimer",
  "Bill Belichick": "Bill Parcells",
  "Tom Coughlin": "Bill Parcells",
  "Sean Payton": "Bill Parcells",
  "Josh McDaniels": "Bill Belichick",
  "Gary Kubiak": "Mike Shanahan",
  "Kyle Shanahan": "Mike Shanahan",
  "Robert Saleh": "Kyle Shanahan",
  "DeMeco Ryans": "Kyle Shanahan",
  "Sean McVay": "Jon Gruden",
  "Matt LaFleur": "Sean McVay",
  "Kevin O'Connell": "Sean McVay",
};

export interface TreeNode {
  name: string;
  /** The entry with the longest head-coaching record, for profiles and plaques. */
  coachId: string;
  wins: number;
  losses: number;
  ties: number;
  titles: number;
  /** Where the link to his mentor comes from. */
  root?: "timeline" | "real";
  children: TreeNode[];
  /** Head coaches anywhere below him. */
  size: number;
}

interface Person {
  name: string;
  entries: Coach[];
  best: Coach;
  headCoach: boolean;
}

function people(save: DynastySave): Map<string, Person> {
  const by = new Map<string, Person>();
  for (const c of Object.values(save.coaches)) {
    const p = by.get(c.name) ?? { name: c.name, entries: [], best: c, headCoach: false };
    p.entries.push(c);
    const games = (x: Coach) => x.careerWins + x.careerLosses + x.careerTies;
    if (games(c) > games(p.best)) p.best = c;
    // A head coach once he has coached a game, or holds the chair right now.
    if (games(c) > 0 || (c.teamId && save.teams[c.teamId]?.coachId === c.id)) p.headCoach = true;
    by.set(c.name, p);
  }
  return by;
}

/** The head coach a man came up under, and whether this timeline or real history says so. */
export function mentorOf(save: DynastySave, name: string, folks = people(save)): { name: string; source: "timeline" | "real" } | undefined {
  const p = folks.get(name);
  if (!p) return undefined;
  const seasons = new Map<string, number>();
  for (const c of p.entries)
    for (const [id, n] of Object.entries(c.mentors ?? {})) {
      const m = save.coaches[id]?.name;
      if (m && m !== name) seasons.set(m, (seasons.get(m) ?? 0) + n);
    }
  const top = [...seasons.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return { name: top[0], source: "timeline" };
  const real = REAL_MENTOR[name];
  return real && folks.has(real) ? { name: real, source: "real" } : undefined;
}

/** Every head coach's tree, the biggest first; a tree needs at least one head coach under its root. */
export function coachingTrees(save: DynastySave, limit = 6): TreeNode[] {
  const folks = people(save);
  const parent = new Map<string, { name: string; source: "timeline" | "real" }>();
  for (const p of folks.values()) {
    if (!p.headCoach) continue;
    const m = mentorOf(save, p.name, folks);
    if (!m) continue;
    // A mentor link that loops back (each counted seasons under the other) is dropped.
    let at: string | undefined = m.name;
    let loops = false;
    for (let i = 0; at && i < 40; i++) {
      if (at === p.name) {
        loops = true;
        break;
      }
      at = parent.get(at)?.name;
    }
    if (!loops) parent.set(p.name, m);
  }
  const kids = new Map<string, string[]>();
  for (const [child, m] of parent) kids.set(m.name, [...(kids.get(m.name) ?? []), child]);

  const build = (name: string, depth = 0): TreeNode => {
    const p = folks.get(name)!;
    const children = depth > 12 ? [] : (kids.get(name) ?? []).filter((k) => folks.get(k)?.headCoach).map((k) => build(k, depth + 1));
    children.sort((a, b) => b.size - a.size || b.titles - a.titles || b.wins - a.wins);
    return {
      name,
      coachId: p.best.id,
      wins: p.best.careerWins,
      losses: p.best.careerLosses,
      ties: p.best.careerTies,
      titles: Math.max(...p.entries.map((c) => c.careerTitles)),
      root: parent.get(name)?.source,
      children,
      size: children.reduce((n, c) => n + 1 + c.size, 0),
    };
  };
  const roots = [...folks.values()].filter((p) => !parent.has(p.name) && (kids.get(p.name) ?? []).some((k) => folks.get(k)?.headCoach));
  return roots
    .map((p) => build(p.name))
    .filter((t) => t.size > 0)
    .sort((a, b) => b.size - a.size || b.titles - a.titles)
    .slice(0, limit);
}

/** One line for a coach's plaque or profile: who he came up under and who came up under him. */
export function treeLine(save: DynastySave, coach: Coach): string | undefined {
  const folks = people(save);
  const m = mentorOf(save, coach.name, folks);
  const under = [...folks.values()].filter((p) => p.headCoach && mentorOf(save, p.name, folks)?.name === coach.name).map((p) => p.name);
  const parts: string[] = [];
  if (m) parts.push(`Came up under ${m.name}.`);
  if (under.length) parts.push(`Head coaches from his staffs: ${under.slice(0, 6).join(", ")}${under.length > 6 ? ` and ${under.length - 6} more` : ""}.`);
  return parts.length ? parts.join(" ") : undefined;
}
