import type { Player, Pos, SeasonStats, TeamId } from "./types.ts";
import { careerTotals } from "./leaders.ts";
import { teamAbbr } from "./teams.ts";
import { hasCompleteScoringPoints, individualScoringPoints } from "./statRules.ts";

export type StatCol = { key: string; label: string; of?: (s: SeasonStats) => string | number };
export type StatFamily = "pass" | "rush" | "rec" | "ol" | "def" | "k" | "p" | "ret";

export function pct(n: number, d: number): string {
  if (!d) return "—";
  return ((100 * n) / d).toFixed(1);
}

export function avg(n: number, d: number, digits = 1): string {
  if (!d) return "—";
  return (n / d).toFixed(digits);
}

export function passerRating(s: SeasonStats): string {
  const att = s.passAtt;
  // History mode: some seasons' sources kept no completions (passCmp -1), so no rating either.
  if (!att || s.passCmp < 0) return "—";
  const a = Math.max(0, Math.min(2.375, ((s.passCmp / att) - 0.3) * 5));
  const b = Math.max(0, Math.min(2.375, ((s.passYds / att) - 3) * 0.25));
  const c = Math.max(0, Math.min(2.375, (s.passTd / att) * 20));
  const d = Math.max(0, Math.min(2.375, 2.375 - (s.passInt / att) * 25));
  return (((a + b + c + d) / 6) * 100).toFixed(1);
}

export function scoring(s: SeasonStats): number {
  return individualScoringPoints(s);
}

function num(n: number): string | number {
  return n;
}

/** A stat the record didn't keep that season (History mode) reads —, not 0. */
const kept = (s: SeasonStats, k: keyof SeasonStats, v: string | number): string | number => (s.unknown?.includes(k) ? "—" : v);
const scoringDisplay = (s: SeasonStats): string | number => hasCompleteScoringPoints(s) ? scoring(s) || "—" : "—";

const PASS_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "cmpatt", label: "Cmp/Att", of: (s) => (s.passAtt ? `${s.passCmp < 0 ? "—" : s.passCmp}/${s.passAtt}` : "—") },
  { key: "pct", label: "Pct", of: (s) => (s.passCmp < 0 ? "—" : pct(s.passCmp, s.passAtt)) },
  { key: "passYds", label: "Yds", of: (s) => s.passYds },
  { key: "ypa", label: "Y/A", of: (s) => avg(s.passYds, s.passAtt) },
  { key: "passTd", label: "TD", of: (s) => s.passTd },
  { key: "passInt", label: "INT", of: (s) => s.passInt },
  { key: "rate", label: "Rate", of: (s) => passerRating(s) },
  { key: "sacksThrown", label: "Sk", of: (s) => num(s.sacksThrown) },
  { key: "rushAtt", label: "Ru att", of: (s) => num(s.rushAtt) },
  { key: "rushYds", label: "Ru yds", of: (s) => num(s.rushYds) },
  { key: "rushTd", label: "Ru TD", of: (s) => num(s.rushTd) },
  { key: "pts", label: "Pts", of: scoringDisplay },
];

const RUSH_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "rushAtt", label: "Att", of: (s) => s.rushAtt },
  { key: "rushYds", label: "Yds", of: (s) => s.rushYds },
  { key: "ypc", label: "Avg", of: (s) => avg(s.rushYds, s.rushAtt) },
  { key: "rushTd", label: "TD", of: (s) => s.rushTd },
  { key: "rec", label: "Rec", of: (s) => num(s.rec) },
  { key: "recYds", label: "Rec yds", of: (s) => num(s.recYds) },
  { key: "recTd", label: "Rec TD", of: (s) => num(s.recTd) },
  { key: "kr", label: "KR yds", of: (s) => num(s.krYds) },
  { key: "pr", label: "PR yds", of: (s) => num(s.prYds) },
  { key: "pts", label: "Pts", of: scoringDisplay },
];

const REC_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "rec", label: "Rec", of: (s) => s.rec },
  { key: "tgt", label: "Tgt", of: (s) => num(s.targets ?? 0) },
  { key: "recYds", label: "Yds", of: (s) => s.recYds },
  { key: "ypr", label: "Avg", of: (s) => avg(s.recYds, s.rec) },
  { key: "recTd", label: "TD", of: (s) => s.recTd },
  { key: "rushAtt", label: "Ru att", of: (s) => num(s.rushAtt) },
  { key: "rushYds", label: "Ru yds", of: (s) => num(s.rushYds) },
  { key: "rushTd", label: "Ru TD", of: (s) => num(s.rushTd) },
  { key: "kr", label: "KR yds", of: (s) => num(s.krYds) },
  { key: "pr", label: "PR yds", of: (s) => num(s.prYds) },
  { key: "pts", label: "Pts", of: scoringDisplay },
];

const DEF_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "tackles", label: "Tkl", of: (s) => kept(s, "tackles", s.tackles) },
  { key: "tfl", label: "TFL", of: (s) => kept(s, "tfl", num(s.tfl ?? 0)) },
  { key: "sacks", label: "Sk", of: (s) => kept(s, "sacks", s.sacks) },
  { key: "ints", label: "INT", of: (s) => s.ints },
  { key: "pd", label: "PD", of: (s) => kept(s, "pd", num(s.pd ?? 0)) },
  { key: "ff", label: "FF", of: (s) => kept(s, "ff", s.ff) },
  { key: "fr", label: "FR", of: (s) => num(s.fr ?? 0) },
  { key: "defTd", label: "Def TD", of: (s) => kept(s, "defTd", num(s.defTd ?? 0)) },
  { key: "pts", label: "Pts", of: scoringDisplay },
  { key: "kr", label: "KR yds", of: (s) => num(s.krYds) },
  { key: "pr", label: "PR yds", of: (s) => num(s.prYds) },
];

const OL_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "tackles", label: "Tkl", of: (s) => kept(s, "tackles", num(s.tackles)) },
];

const K_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "fg", label: "FG", of: (s) => (s.fgAtt ? `${s.fgMade}/${s.fgAtt}` : "—") },
  { key: "fgpct", label: "FG%", of: (s) => pct(s.fgMade, s.fgAtt) },
  { key: "xp", label: "XP", of: (s) => (s.xpAtt ? `${s.xpMade}/${s.xpAtt}` : "—") },
  { key: "xppct", label: "XP%", of: (s) => pct(s.xpMade, s.xpAtt) },
  { key: "pts", label: "Pts", of: scoringDisplay },
];

const P_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "punts", label: "Pnt", of: (s) => s.punts },
  { key: "puntYds", label: "Yds", of: (s) => s.puntYds },
  { key: "avg", label: "Avg", of: (s) => avg(s.puntYds, s.punts) },
];

const RET_COLS: StatCol[] = [
  { key: "gp", label: "G", of: (s) => s.gp },
  { key: "kr", label: "KR yds", of: (s) => num(s.krYds) },
  { key: "pr", label: "PR yds", of: (s) => num(s.prYds) },
  { key: "ret", label: "Ret yds", of: (s) => (s.krYds || s.prYds ? s.krYds + s.prYds : "—") },
  { key: "pts", label: "Pts", of: scoringDisplay },
];

export const FAMILY_LABEL: Record<StatFamily, string> = {
  pass: "Passing",
  rush: "Rushing",
  rec: "Receiving",
  ol: "Offensive line",
  def: "Defense",
  k: "Kicking",
  p: "Punting",
  ret: "Returns",
};

export function familyOfPos(pos: Pos): StatFamily {
  if (pos === "QB") return "pass";
  if (pos === "RB" || pos === "FB") return "rush";
  if (pos === "WR" || pos === "TE") return "rec";
  if (pos === "K") return "k";
  if (pos === "P") return "p";
  if (pos === "LT" || pos === "LG" || pos === "C" || pos === "RG" || pos === "RT") return "ol";
  return "def";
}

export function colsForFamily(family: StatFamily): StatCol[] {
  if (family === "pass") return PASS_COLS;
  if (family === "rush") return RUSH_COLS;
  if (family === "rec") return REC_COLS;
  if (family === "k") return K_COLS;
  if (family === "p") return P_COLS;
  if (family === "ol") return OL_COLS;
  if (family === "ret") return RET_COLS;
  return DEF_COLS;
}

export function statCols(pos: Pos): StatCol[] {
  return colsForFamily(familyOfPos(pos));
}

export function statGroup(pos: Pos): "pass" | "rush" | "rec" | "ol" | "def" | "k" | "p" {
  const f = familyOfPos(pos);
  return f === "ret" ? "def" : f;
}

function familyHasWork(family: StatFamily, s: SeasonStats): boolean {
  if (family === "pass") return s.passAtt > 0;
  if (family === "rush") return s.rushAtt > 0 || s.rushYds > 0;
  if (family === "rec") return s.rec > 0 || s.recYds > 0;
  if (family === "def") return s.tackles + s.sacks + s.ints + s.ff > 0;
  if (family === "ol") return s.gp > 0;
  if (family === "k") return s.fgAtt + s.xpAtt + s.fgMade + s.xpMade > 0;
  if (family === "p") return s.punts > 0;
  return s.krYds + s.prYds > 0;
}

/** Primary family plus any other buckets this card actually produced. */
export function familiesOf(pos: Pos, s?: SeasonStats): StatFamily[] {
  const primary = familyOfPos(pos);
  const out: StatFamily[] = [primary];
  if (!s) return out;
  const add = (f: StatFamily) => {
    if (!out.includes(f) && familyHasWork(f, s)) out.push(f);
  };
  add("pass");
  if (primary !== "pass") add("rush");
  if (primary !== "rush" && primary !== "rec") add("rec");
  if (primary !== "def") add("def");
  add("k");
  add("p");
  if (primary !== "rush" && primary !== "rec" && primary !== "def") add("ret");
  return out;
}

export function familiesAcross(pos: Pos, rows: SeasonStats[]): StatFamily[] {
  const primary = familyOfPos(pos);
  const set = new Set<StatFamily>([primary]);
  for (const s of rows) for (const f of familiesOf(pos, s)) set.add(f);
  return [primary, ...[...set].filter((f) => f !== primary)];
}

export function hasSeasonWork(s: SeasonStats | undefined): boolean {
  if (!s) return false;
  return (
    s.gp > 0 ||
    s.passAtt + s.rushAtt + s.rec + s.tackles + s.sacks + s.ints + s.fgAtt + s.punts + s.krYds + s.prYds > 0
  );
}

export function seasonLog(p: Player): SeasonStats[] {
  const by = new Map<number, SeasonStats>();
  for (const s of p.career ?? []) by.set(s.year, s);
  for (const s of Object.values(p.stats ?? {})) by.set(s.year, s);
  return [...by.values()].sort((a, b) => a.year - b.year);
}

export function careerOf(p: Player): SeasonStats {
  return careerTotals(p);
}

export function seasonLabel(s: SeasonStats): string {
  if (s.teamId && s.teamId !== "two") {
    return `${s.year} ${teamAbbr(s.teamId as TeamId)}`;
  }
  return String(s.year);
}

export function draftLine(p: Player): string {
  if (p.draftYear && (p.draftRound === 0 || p.draftRound === undefined) && p.historical && p.yearsPro === 0) {
    return `${p.draftYear} UDFA`;
  }
  if (p.draftYear && p.draftRound && p.draftRound > 0 && p.draftPick != null) {
    return `${p.draftYear} · Round ${p.draftRound} · pick ${p.draftPick}`;
  }
  if (p.draftYear) return `${p.draftYear} class`;
  if (p.historical) return "Veteran";
  return "Camp body";
}

export function teamFilterId(id: Player["teamId"]): TeamId | null {
  if (id === "fa" || id === "retired" || id === "hof") return null;
  return id;
}

function comma(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("en-US");
}

export function careerHeadlines(p: Player): { label: string; value: string }[] {
  const s = careerOf(p);
  const seasons = seasonLog(p).filter(hasSeasonWork).length;
  const games = { label: "Games", value: s.gp ? String(s.gp) : "—" };
  const yrs = { label: "Seasons", value: seasons ? String(seasons) : "—" };
  const f = familyOfPos(p.pos);
  if (f === "pass") {
    return [games, { label: "Pass yds", value: comma(s.passYds) }, { label: "TD / INT", value: `${s.passTd} / ${s.passInt}` }, { label: "Rate", value: passerRating(s) }, { label: "Pts", value: String(scoringDisplay(s)) }];
  }
  if (f === "rush") {
    return [games, { label: "Rush yds", value: comma(s.rushYds) }, { label: "Avg", value: avg(s.rushYds, s.rushAtt) }, { label: "TD", value: String(s.rushTd + s.recTd) }, { label: "Pts", value: String(scoringDisplay(s)) }];
  }
  if (f === "rec") {
    return [games, { label: "Rec", value: comma(s.rec) }, { label: "Yds", value: comma(s.recYds) }, { label: "TD", value: String(s.recTd) }, { label: "Pts", value: String(scoringDisplay(s)) }];
  }
  if (f === "k") {
    return [games, { label: "FG", value: s.fgAtt ? `${s.fgMade}/${s.fgAtt}` : "—" }, { label: "XP", value: s.xpAtt ? `${s.xpMade}/${s.xpAtt}` : "—" }, { label: "Pts", value: String(scoringDisplay(s)) }];
  }
  if (f === "p") {
    return [games, { label: "Punts", value: comma(s.punts) }, { label: "Yds", value: comma(s.puntYds) }, { label: "Avg", value: avg(s.puntYds, s.punts) }];
  }
  if (f === "ol") {
    return [games, yrs, { label: "Age", value: String(p.age) }, { label: "Exp", value: `${p.yearsPro} yr` }];
  }
  return [games, { label: "Tackles", value: String(kept(s, "tackles", comma(s.tackles))) }, { label: "Sacks", value: String(kept(s, "sacks", comma(s.sacks))) }, { label: "INT", value: comma(s.ints) }, { label: "Def TD", value: String(kept(s, "defTd", comma(s.defTd ?? 0))) }, { label: "Pts", value: String(scoringDisplay(s)) }];
}
