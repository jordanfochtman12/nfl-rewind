/**
 * The free-agency recap: who went where and for how much, what each club added and lost, a
 * grade for every club's winter, the winners and losers, and the best names still unsigned.
 * Built live while the market is open and filed on the save when it closes, so past winters
 * stay readable after the transaction log rolls over. No React.
 */
import { freeAgents } from "./gm.ts";
import { activeTeamIds, displayName, nicknameOf } from "./teams.ts";
import { formatMoney } from "./salary.ts";
import { playerName } from "./players.ts";
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";

export interface FaSigning {
  playerId: string;
  name: string;
  pos: Pos;
  age: number;
  ovr: number;
  to: TeamId;
  /** The club he played for last season, when it wasn't his new one. */
  from?: TeamId;
  salary: number;
  years: number;
}

export interface FaTeamLine {
  teamId: TeamId;
  added: number;
  lost: number;
  addValue: number;
  lostValue: number;
  spent: number;
  /** The best man he brought in. */
  bestAdd?: string;
  /** The best man who left. */
  bestLoss?: string;
  score: number;
  grade: string;
}

export interface FaRecap {
  year: number;
  signings: FaSigning[];
  teams: FaTeamLine[];
  /** The best players nobody signed. */
  unsigned: { playerId: string; name: string; pos: Pos; age: number; ovr: number }[];
  /** True once the market has closed and the recap is filed. */
  final: boolean;
}

/** What a signing is worth to a roster: a starter counts, a camp body barely does. */
const worth = (ovr: number) => Math.pow(Math.max(0, ovr - 58), 1.5);

const GRADES: [number, string][] = [
  [0.9, "A+"], [0.78, "A"], [0.66, "A-"], [0.56, "B+"], [0.46, "B"], [0.38, "B-"],
  [0.3, "C+"], [0.22, "C"], [0.15, "C-"], [0.08, "D"], [0, "F"],
];

function lastClub(p: Player, year: number): TeamId | undefined {
  const t = p.stats[year - 1]?.teamId;
  // "two": he split last season between clubs.
  return t && t !== "two" ? (t as TeamId) : undefined;
}

/** This year's free-agent signings, best first. */
function signingsOf(save: DynastySave, year: number): FaSigning[] {
  const seen = new Set<string>();
  const out: FaSigning[] = [];
  for (const t of save.transactions) {
    if (t.kind !== "sign" || t.year !== year || t.week > 0 || seen.has(t.playerId)) continue;
    const p = save.players[t.playerId];
    if (!p) continue;
    seen.add(t.playerId);
    const to = t.to as TeamId;
    const from = lastClub(p, year);
    out.push({ playerId: p.id, name: playerName(p), pos: p.pos, age: p.age, ovr: p.ovr, to, from: from && from !== to ? from : undefined, salary: p.salary, years: p.contractYears });
  }
  return out.sort((a, b) => b.ovr - a.ovr || b.salary - a.salary);
}

/** The winter so far, or as filed when the market closed. */
export function faRecap(save: DynastySave, year = save.year): FaRecap | undefined {
  const filed = save.faRecaps?.[year];
  if (filed) return filed;
  if (year !== save.year) return undefined;
  const signings = signingsOf(save, year);
  const ids = activeTeamIds(year);
  const lines = new Map<TeamId, FaTeamLine>(ids.map((id) => [id, { teamId: id, added: 0, lost: 0, addValue: 0, lostValue: 0, spent: 0, score: 0, grade: "C" }]));
  for (const s of signings) {
    const to = lines.get(s.to);
    if (to) {
      to.added += 1;
      to.addValue += worth(s.ovr);
      to.spent += s.salary;
      to.bestAdd ??= s.name;
    }
    const from = s.from ? lines.get(s.from) : undefined;
    if (from) {
      from.lost += 1;
      from.lostValue += worth(s.ovr);
      from.bestLoss ??= s.name;
    }
  }
  // Graded on the curve among the clubs that moved: net value against the rest of the market
  // this winter. A club that came out ahead never grades below C+, one that came out behind
  // never above C-, and a club that stood pat (nobody in, nobody out) gets a C.
  const teams = [...lines.values()];
  for (const t of teams) t.score = t.addValue - t.lostValue * 0.75;
  const ranked = teams.slice().sort((a, b) => b.score - a.score);
  const movers = ranked.filter((t) => t.added || t.lost);
  const rank = (cut: number) => GRADES.findIndex(([c]) => c === cut);
  for (const t of ranked) {
    if (!t.added && !t.lost) {
      t.grade = "C";
      continue;
    }
    const i = movers.indexOf(t);
    const pct = movers.length > 1 ? 1 - i / (movers.length - 1) : 0.5;
    let g = GRADES.findIndex(([cut]) => pct >= cut);
    if (t.score > 0) g = Math.min(g, rank(0.3));
    else if (t.score < 0) g = Math.max(g, rank(0.15));
    else g = rank(0.22);
    t.grade = GRADES[g]![1];
  }
  const unsigned = freeAgents(save)
    .filter((p) => p.ovr >= 60)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 6)
    .map((p) => ({ playerId: p.id, name: playerName(p), pos: p.pos, age: p.age, ovr: p.ovr }));
  return { year, signings: signings.slice(0, 40), teams: ranked, unsigned, final: save.phase !== "freeAgency" };
}

/** File the winter when the market closes; keep the last dozen. */
export function fileFaRecap(save: DynastySave): void {
  const r = faRecap(save);
  if (!r) return;
  save.faRecaps = { ...(save.faRecaps ?? {}), [save.year]: { ...r, final: true } };
  const years = Object.keys(save.faRecaps).map(Number).sort((a, b) => b - a);
  for (const y of years.slice(12)) delete save.faRecaps[y];
}

/** The headlines a desk would lead with. */
export function faHeadlines(save: DynastySave, r: FaRecap): string[] {
  const out: string[] = [];
  const nick = (id: TeamId) => nicknameOf(r.year, id);
  const top = r.signings[0];
  if (top) {
    const money = formatMoney(top.salary, r.year);
    out.push(`${top.name} is the prize of the winter: ${top.pos}, ${top.ovr} overall, to the ${nick(top.to)}${top.from ? ` from the ${nick(top.from)}` : ""} at ${money} a year for ${top.years}.`);
  }
  const best = r.teams[0];
  if (best && best.added) out.push(`Winners: the ${displayName(r.year, best.teamId)} (${best.grade}) added ${best.added}${best.bestAdd ? `, led by ${best.bestAdd}` : ""}.`);
  const worst = r.teams.at(-1);
  if (worst && worst.lost) out.push(`Losers: the ${displayName(r.year, worst.teamId)} (${worst.grade}) watched ${worst.lost} walk${worst.bestLoss ? `, ${worst.bestLoss} the biggest` : ""}.`);
  const left = r.unsigned[0];
  if (left) out.push(`Still on the street: ${left.name}, ${left.pos}, ${left.ovr}. Someone will call.`);
  if (!r.signings.length) out.push(r.year < 1993 ? "A quiet winter. Under the old rules, stars rarely moved." : "No one has signed yet. The phones are ringing.");
  return out;
}
