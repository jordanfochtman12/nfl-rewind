/**
 * Draft classes revisited: a few years on, every pick is measured by what he became (honors,
 * awards, durable years in the lineup, how good he got) and the class is re-drafted in that
 * order. A pick's surplus is his value against the value of the man the re-draft puts in his
 * slot; a club's grade is its picks' surplus against the rest of the league. No React.
 */
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { playerName } from "./players.ts";
import { displayName } from "./teams.ts";
import { addNews } from "./news.ts";

export interface ClassPick {
  playerId: string;
  name: string;
  pos: Pos;
  teamId: TeamId;
  pick: number;
  round: number;
  value: number;
  /** Where he goes when the class is re-drafted by what he became. */
  reRank: number;
  proBowls: number;
}

export interface ClassReport {
  year: number;
  /** Seasons since the draft. */
  seasons: number;
  picks: ClassPick[];
  redraft: ClassPick[];
  steals: ClassPick[];
  busts: ClassPick[];
  teams: { teamId: TeamId; grade: string; surplus: number; best?: ClassPick }[];
}

const MAJOR = new Set(["MVP", "OPOY", "DPOY"]);

/** What a pick became, as one number: honors first, then years in the lineup and peak grade. */
export function careerValue(p: Player, through: number): number {
  const h = p.honors;
  const inRange = (y: number) => y >= (p.draftYear ?? 0) && y <= through;
  const proBowls = (h?.proBowl ?? []).filter(inRange).length;
  const allPros = (h?.allPro ?? []).filter(inRange).length;
  const awards = (h?.awards ?? []).filter((a) => inRange(a.year));
  const major = awards.filter((a) => MAJOR.has(a.award)).length;
  const rookie = awards.some((a) => a.award === "OROY" || a.award === "DROY") ? 1 : 0;
  let durable = 0;
  for (let y = p.draftYear ?? through; y <= through; y++) if ((p.stats[y]?.gp ?? 0) >= 10) durable += 1;
  return proBowls * 6 + allPros * 10 + major * 15 + rookie * 4 + durable * 2 + Math.max(0, (p.peakOvr ?? p.ovr) - 68) * 1.2;
}

const LETTERS: [number, string][] = [
  [1.5, "A+"],
  [1, "A"],
  [0.6, "A-"],
  [0.3, "B+"],
  [0, "B"],
  [-0.3, "B-"],
  [-0.6, "C+"],
  [-1, "C"],
  [-1.5, "D"],
];
const letter = (z: number) => LETTERS.find(([min]) => z >= min)?.[1] ?? "F";

/** The class of `year`, graded as of the current season; undefined until it has a season in. */
export function draftClassReport(save: DynastySave, year: number): ClassReport | undefined {
  const through = Math.min(save.year, save.phase === "draft" ? save.year - 1 : save.year);
  if (through <= year) return undefined;
  const drafted = Object.values(save.players).filter((p) => p.draftYear === year && p.draftPick && p.draftTeam && !p.twinOf);
  if (drafted.length < 20) return undefined;
  const scored = drafted.map((p) => ({ p, value: careerValue(p, through) }));
  const byValue = scored.slice().sort((a, b) => b.value - a.value || (a.p.draftPick ?? 0) - (b.p.draftPick ?? 0));
  const reRank = new Map(byValue.map((x, i) => [x.p.id, i + 1]));
  const slotValue = byValue.map((x) => x.value);
  const toPick = ({ p, value }: { p: Player; value: number }): ClassPick => ({
    playerId: p.id,
    name: playerName(p),
    pos: p.pos,
    teamId: p.draftTeam!,
    pick: p.draftPick!,
    round: p.draftRound ?? 0,
    value: Math.round(value),
    reRank: reRank.get(p.id)!,
    proBowls: (p.honors?.proBowl ?? []).filter((y) => y <= through).length,
  });
  const picks = scored.map(toPick).sort((a, b) => a.pick - b.pick);
  const redraft = byValue.map(toPick);
  // A steal is how far he fell times what he became: a Hall of Famer from round three beats a
  // solid starter from round ten. A bust is a top-20 pick the re-draft leaves out of round two.
  const steals = picks
    .filter((x) => x.pick > 32 && x.reRank <= 32)
    .sort((a, b) => (b.pick / b.reRank) * b.value - (a.pick / a.reRank) * a.value)
    .slice(0, 3);
  const busts = picks
    .filter((x) => x.pick <= 20 && x.reRank > Math.max(48, x.pick * 3))
    .slice(0, 3);

  // A club's surplus: each pick's value against the value the re-draft puts in that slot.
  const surplus = new Map<TeamId, { total: number; best?: ClassPick }>();
  for (const x of picks) {
    const expected = slotValue[Math.min(slotValue.length - 1, x.pick - 1)] ?? 0;
    const e = surplus.get(x.teamId) ?? { total: 0 };
    e.total += x.value - expected;
    if (!e.best || x.value > e.best.value) e.best = x;
    surplus.set(x.teamId, e);
  }
  const totals = [...surplus.values()].map((e) => e.total);
  const mean = totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length);
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, totals.length)) || 1;
  const teams = [...surplus.entries()]
    .map(([teamId, e]) => ({ teamId, grade: letter((e.total - mean) / sd), surplus: Math.round(e.total), best: e.best }))
    .sort((a, b) => b.surplus - a.surplus);
  return { year, seasons: through - year + 1, picks, redraft, steals, busts, teams };
}

/** Classes old enough to judge (three seasons in), newest first. */
export function gradableClasses(save: DynastySave): number[] {
  const years = new Set<number>();
  for (const p of Object.values(save.players)) if (p.draftYear && p.draftPick && p.draftTeam) years.add(p.draftYear);
  return [...years].filter((y) => save.year - y >= 3).sort((a, b) => b - a);
}

/** Draft week: the class from three years ago gets its early returns, five years ago its final grades. */
export function regradeClasses(save: DynastySave): void {
  for (const back of [3, 5]) {
    const r = draftClassReport(save, save.year - back);
    if (!r) continue;
    const top = r.redraft[0];
    if (!top) continue;
    const best = r.teams[0];
    const parts = [
      top.pick === 1 ? `${top.name} went first and still would.` : `Re-draft it and ${top.name} (${top.pos}) goes first; he went No. ${top.pick}.`,
      r.steals[0] ? `Steal: ${r.steals[0].name} at No. ${r.steals[0].pick}.` : "",
      r.busts[0] ? `Bust: ${r.busts[0].name} at No. ${r.busts[0].pick}.` : "",
      best ? `Best haul: the ${displayName(save.year, best.teamId)} (${best.grade}).` : "",
    ].filter(Boolean);
    addNews(save, {
      kind: "headline",
      headline: back === 3 ? `The ${r.year} draft, three years in` : `Final grades: the ${r.year} draft`,
      body: parts.join(" "),
      teamIds: best ? [best.teamId] : [],
      playerIds: [top.playerId, ...(r.steals[0] ? [r.steals[0].playerId] : []), ...(r.busts[0] ? [r.busts[0].playerId] : [])],
    });
  }
}
