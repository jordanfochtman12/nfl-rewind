/**
 * Draft week on the network: the media's consensus big board, a first-round mock, position
 * rankings, combine standouts, sleepers and the owner's war room. Everything is built from what
 * the public can see - scout grades and measurables - never the sealed true ratings, so the
 * preview can be wrong exactly the way real mocks are.
 */
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { DEPTH_CHART, rosterOf } from "./players.ts";
import { visibleOvr } from "./scout.ts";
import { draftQueue, sessionOf, sessionTeams } from "./draft.ts";
import { displayName } from "./teams.ts";

export interface PreviewProspect {
  playerId: string;
  rank: number;
  grade: number;
  projRound: number;
  group: PosGroup;
}

export type PosGroup = "QB" | "RB" | "WR" | "TE" | "OT" | "IOL" | "EDGE" | "DT" | "LB" | "CB" | "S" | "K/P";

export const POS_GROUPS: PosGroup[] = ["QB", "RB", "WR", "TE", "OT", "IOL", "EDGE", "DT", "LB", "CB", "S", "K/P"];

export function groupOf(pos: Pos): PosGroup {
  switch (pos) {
    case "QB":
      return "QB";
    case "RB":
    case "FB":
      return "RB";
    case "WR":
      return "WR";
    case "TE":
      return "TE";
    case "LT":
    case "RT":
      return "OT";
    case "LG":
    case "C":
    case "RG":
      return "IOL";
    case "DE":
      return "EDGE";
    case "DT":
      return "DT";
    case "OLB":
    case "MLB":
      return "LB";
    case "CB":
      return "CB";
    case "S":
      return "S";
    default:
      return "K/P";
  }
}

/** How much the league pays up for a position on draft day, era by era. */
function positionPremium(pos: Pos, year: number): number {
  const modern = year >= 1990;
  switch (groupOf(pos)) {
    case "QB":
      return modern ? 4 : 2;
    case "EDGE":
      return modern ? 2.5 : 1.5;
    case "OT":
      return modern ? 2 : 1;
    case "CB":
      return modern ? 1.5 : 0.5;
    case "WR":
      return year >= 2005 ? 1.5 : 0.5;
    case "RB":
      return year >= 2005 ? -1.5 : year >= 1975 ? 0.5 : 1;
    case "K/P":
      return -9;
    default:
      return 0;
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stable 0..1 draw per prospect and purpose, so the preview never changes on re-render. */
function draw(id: string, salt: string): number {
  return (hash(`${id}:${salt}`) % 10000) / 10000;
}

export function consensusBoard(save: DynastySave): PreviewProspect[] {
  const teams = Math.max(1, sessionTeams(save.year, sessionOf(save)).length);
  const rows = save.draftBoard
    .filter((pr) => !pr.taken && save.players[pr.playerId])
    .map((pr) => {
      const p = save.players[pr.playerId]!;
      const grade = visibleOvr(p);
      // Media boards disagree a little; a stable wobble keeps it from being a sorted grade list.
      const score = grade + positionPremium(p.pos, save.year) + (draw(p.id, "media") - 0.5) * 3;
      return { p, grade, score };
    })
    .sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({
    playerId: r.p.id,
    rank: i + 1,
    grade: r.grade,
    projRound: Math.floor(i / teams) + 1,
    group: groupOf(r.p.pos),
  }));
}

/** Positions where a club is thinnest, strongest need first. */
export function teamNeeds(save: DynastySave, teamId: TeamId, n = 3): Pos[] {
  const roster = rosterOf(save, teamId);
  const scored = DEPTH_CHART.filter(([pos]) => pos !== "K" && pos !== "P" && pos !== "FB").map(([pos, need]) => {
    const have = roster.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
    const starter = have[0] ? visibleOvr(have[0]) : 40;
    const aging = have[0] && have[0].age >= 32 ? 4 : 0;
    const depth = Math.max(0, Math.min(2, need) - have.length) * 6;
    return { pos, score: 80 - starter + aging + depth + positionPremium(pos, save.year) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.pos);
}

export interface MockPick {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: TeamId;
  /** Set once the real pick is in. */
  actualId?: string;
  mockId?: string;
  needs: Pos[];
  note: string;
}

/**
 * The first round as the network sees it. Picks already made show the real selection; the rest
 * are projected in order: the best consensus player unless a need at a premium spot is close.
 */
export function mockFirstRound(save: DynastySave): MockPick[] {
  const queue = draftQueue(save);
  const teams = Math.max(1, sessionTeams(save.year, sessionOf(save)).length);
  const board = consensusBoard(save);
  const gone = new Set<string>();
  const out: MockPick[] = [];
  const firstRound = queue.filter((q) => q.round === 1);
  firstRound.forEach((slot, i) => {
    const overall = i + 1;
    const teamId = slot.owner as TeamId;
    const needs = teamNeeds(save, teamId);
    const actual = save.draftBoard.find((pr) => pr.taken && save.players[pr.playerId]?.draftPick === overall && save.players[pr.playerId]?.draftYear === save.year);
    if (overall <= save.draftPickIndex && actual) {
      out.push({ overall, round: 1, pickInRound: overall, teamId, actualId: actual.playerId, needs, note: "The pick is in." });
      return;
    }
    const pool = board.filter((b) => !gone.has(b.playerId)).slice(0, 8);
    let best = pool[0];
    let bestScore = -Infinity;
    for (const b of pool) {
      const p = save.players[b.playerId]!;
      const needBoost = needs.indexOf(p.pos) === 0 ? 5 : needs.includes(p.pos) ? 3 : 0;
      const s = b.grade - b.rank * 0.6 + needBoost + (draw(`${p.id}${teamId}`, "fit") - 0.5) * 2;
      if (s > bestScore) {
        bestScore = s;
        best = b;
      }
    }
    if (!best) return;
    gone.add(best.playerId);
    const p = save.players[best.playerId]!;
    const fills = needs.includes(p.pos);
    const reach = best.rank > overall + 6;
    const value = best.rank + 6 < overall;
    const note = value
      ? `A steal this late: the No. ${best.rank} player on the board.`
      : reach
        ? `A reach by the board (No. ${best.rank}), but ${fills ? `${p.pos} is a real need` : "they love the tape"}.`
        : fills
          ? pickLine(p.id, [`Fills the biggest hole: ${p.pos}.`, `${p.pos} was the priority, and he's the best one left.`, `Need meets value at ${p.pos}.`])
          : pickLine(p.id, [
              `Best player available. ${needs[0] ?? "The need"} can wait until day two.`,
              `Too good to pass up, even with ${needs[0] ?? "other needs"} on the list.`,
              `They stay true to the board.`,
              `Talent over need here. ${needs[0] ?? "Depth"} comes later.`,
            ]);
    out.push({ overall, round: 1, pickInRound: ((overall - 1) % teams) + 1, teamId, mockId: best.playerId, needs, note });
  });
  return out;
}

export interface CollegeLine {
  label: string;
  line: string;
  honor?: string;
}

/**
 * A final college season in the shape of the era, sized to the scouting grade. The game has no
 * college box scores, so these are estimates - consistent from render to render - not records.
 */
// Grade percentile within the class being drafted, cached per board.
const pctCache = new WeakMap<object, number[]>();
function classPercentile(save: DynastySave, grade: number): number {
  let sorted = pctCache.get(save.draftBoard);
  if (!sorted) {
    sorted = save.draftBoard
      .map((pr) => save.players[pr.playerId])
      .filter((x): x is Player => !!x)
      .map((x) => visibleOvr(x))
      .sort((a, b) => a - b);
    pctCache.set(save.draftBoard, sorted);
  }
  if (!sorted.length) return 0.5;
  let lo = 0;
  while (lo < sorted.length && sorted[lo]! < grade) lo++;
  return lo / sorted.length;
}

export function collegeLine(save: DynastySave, p: Player): CollegeLine {
  const g = visibleOvr(p);
  const pct = classPercentile(save, g);
  const y = save.year - 1;
  const games = y < 1970 ? 10 : y < 2002 ? 11 : 12 + (draw(p.id, "bowl") > 0.5 ? 1 : 0);
  const passEra = y < 1970 ? 0.62 : y < 1985 ? 0.72 : y < 2000 ? 0.86 : y < 2012 ? 1 : 1.12;
  // Production is sized by where he sits in his own class, so modern classes (graded lower on
  // arrival) still put up modern numbers at the top.
  const q = Math.max(0, Math.min(1, pct)) ** 1.6;
  const r = (salt: string) => 0.8 + draw(p.id, salt) * 0.4;
  const honor = pct >= 0.985 ? "All-American" : pct >= 0.93 ? "All-Conference" : undefined;
  const n = (v: number) => Math.max(0, Math.round(v)).toLocaleString("en-US");
  switch (groupOf(p.pos)) {
    case "QB": {
      const [base, span] = y < 1970 ? [130, 150] : y < 1985 ? [160, 170] : y < 2000 ? [200, 190] : y < 2012 ? [240, 200] : [260, 190];
      const att = (base + span * q) * r("att");
      const pct = (y < 1970 ? 0.49 : y < 1990 ? 0.54 : y < 2005 ? 0.6 : 0.64) + q * 0.07 + (draw(p.id, "pct") - 0.5) * 0.05;
      const yds = att * (y < 1980 ? 5.4 + q * 2.4 : 6.2 + q * 3.2) * r("ypa");
      const td = yds / (y < 1980 ? 150 : 120) * r("td");
      const int = att * (0.045 - q * 0.02) * r("int");
      return { label: `${y} · ${games} games`, line: `${n(att * pct)}/${n(att)} · ${n(yds)} yds · ${n(td)} TD · ${n(int)} INT`, honor };
    }
    case "RB": {
      const att = ((p.pos === "FB" ? 80 : y < 1970 ? 120 : 150) + (y < 1970 ? 110 : 140) * q) * r("att");
      const ypc = 3.9 + q * (y < 1970 ? 1.6 : 2.2) * r("ypc");
      const td = att * ypc / (p.pos === "FB" ? 120 : 95) * r("td");
      return { label: `${y} · ${games} games`, line: `${n(att)} car · ${n(att * ypc)} yds · ${(ypc).toFixed(1)} ypc · ${n(td)} TD · ${n(10 + 25 * q * passEra * r("rec"))} rec`, honor };
    }
    case "WR":
    case "TE": {
      const rec = (p.pos === "TE" ? 18 : 28) + (p.pos === "TE" ? 34 : 58) * q * passEra * r("rec");
      const avg = (p.pos === "TE" ? 11 : 14) + q * 4 * r("avg");
      return { label: `${y} · ${games} games`, line: `${n(rec)} rec · ${n(rec * avg)} yds · ${avg.toFixed(1)} avg · ${n(rec * avg / 105 * r("td"))} TD`, honor };
    }
    case "OT":
    case "IOL":
      return {
        label: `${y} · ${games} starts`,
        line: `${n(3.5 - 3 * q + draw(p.id, "sk") * 1.5)} sacks allowed · ${n(1 + 3 * q * r("pan"))} pancake games`,
        honor,
      };
    case "EDGE":
    case "DT": {
      const sacks = (p.pos === "DT" ? 2.5 : 4) + (p.pos === "DT" ? 5 : 9) * q * r("sk");
      return { label: `${y} · ${games} games`, line: `${n(30 + 35 * q * r("tk"))} tkl · ${n(sacks * 1.8)} TFL · ${sacks.toFixed(1)} sacks`, honor };
    }
    case "LB":
      return {
        label: `${y} · ${games} games`,
        line: `${n(60 + 70 * q * r("tk"))} tkl · ${n(5 + 9 * q * r("tfl"))} TFL · ${(1 + 5 * q * r("sk")).toFixed(1)} sacks · ${n(q * 3 * r("int"))} INT`,
        honor,
      };
    case "CB":
    case "S":
      return {
        label: `${y} · ${games} games`,
        line: `${n(28 + 40 * q * r("tk"))} tkl · ${n(1 + 6 * q * r("int"))} INT · ${n(4 + 12 * q * r("pd"))} PD`,
        honor,
      };
    default:
      return p.pos === "K"
        ? { label: `${y} · ${games} games`, line: `${n(9 + 10 * q * r("fg"))}/${n(14 + 8 * q)} FG · long ${n(44 + 12 * q * r("lg"))}`, honor }
        : { label: `${y} · ${games} games`, line: `${(38 + 7 * q * r("avg")).toFixed(1)} avg · ${n(10 + 12 * q)} inside the 20`, honor };
  }
}

export interface DraftPreviewData {
  year: number;
  session: string;
  board: PreviewProspect[];
  mock: MockPick[];
  byGroup: Record<PosGroup, PreviewProspect[]>;
  combine: { playerId: string; note: string }[];
  sleepers: PreviewProspect[];
  warRoom: { overall: number; round: number; likely: PreviewProspect[] }[];
  userNeeds: Pos[];
  storylines: string[];
}

export function draftPreview(save: DynastySave): DraftPreviewData {
  const board = consensusBoard(save);
  const byGroup = Object.fromEntries(POS_GROUPS.map((g) => [g, board.filter((b) => b.group === g).slice(0, 20)])) as Record<
    PosGroup,
    PreviewProspect[]
  >;
  const mock = mockFirstRound(save);
  const top = board.slice(0, 120).map((b) => ({ b, p: save.players[b.playerId]! }));
  const combine: DraftPreviewData["combine"] = [];
  const fastest = top.filter((x) => x.p.forty != null).sort((a, b) => a.p.forty! - b.p.forty!);
  for (const x of fastest.slice(0, 3)) combine.push({ playerId: x.p.id, note: `${x.p.forty!.toFixed(2)} forty at ${x.p.weight ?? "?"} lbs` });
  const bigFast = top
    .filter((x) => x.p.forty != null && (x.p.weight ?? 0) >= 240)
    .sort((a, b) => a.p.forty! - b.p.forty!)[0];
  if (bigFast && !combine.some((c) => c.playerId === bigFast.p.id)) {
    combine.push({ playerId: bigFast.p.id, note: `${bigFast.p.forty!.toFixed(2)} at ${bigFast.p.weight} lbs - rare for a ${bigFast.p.pos}` });
  }
  const tallest = top.filter((x) => x.p.heightIn && groupOf(x.p.pos) === "WR").sort((a, b) => b.p.heightIn! - a.p.heightIn!)[0];
  if (tallest) combine.push({ playerId: tallest.p.id, note: `the biggest target in the class at ${Math.floor(tallest.p.heightIn! / 12)}-${tallest.p.heightIn! % 12}` });

  // Sleepers: graded like early picks but projected to slide - the board's biggest disagreements.
  const teamsN = Math.max(1, sessionTeams(save.year, sessionOf(save)).length);
  const earlyBar = [...board].sort((a, b) => b.grade - a.grade)[Math.min(board.length - 1, Math.round(teamsN * 1.5))]?.grade ?? 99;
  const sleepers = board
    .filter((b) => b.projRound >= 3 && b.grade >= earlyBar && b.group !== "K/P")
    .sort((a, b) => b.grade - a.grade)
    .slice(0, 6);

  const queue = draftQueue(save);
  const userSlots = queue
    .map((q, i) => ({ q, overall: i + 1 }))
    .filter((x) => x.q.owner === save.userTeamId && x.overall > save.draftPickIndex && x.q.round <= 3)
    .slice(0, 3);
  const warRoom = userSlots.map((x) => ({
    overall: x.overall,
    round: x.q.round,
    likely: board.slice(Math.max(0, x.overall - 3 - save.draftPickIndex), x.overall + 4 - save.draftPickIndex).slice(0, 5),
  }));

  const storylines: string[] = [];
  const qbs = byGroup.QB;
  if (qbs[0] && qbs[1] && Math.abs(qbs[0].grade - qbs[1].grade) <= 2) {
    storylines.push(
      `The quarterback debate: ${name(save, qbs[0].playerId)} or ${name(save, qbs[1].playerId)}? The board has them a grade apart.`,
    );
  } else if (qbs[0] && qbs[0].rank <= 5) {
    storylines.push(`${name(save, qbs[0].playerId)} is the clear top passer, and quarterback-needy clubs are circling.`);
  }
  const deepest = POS_GROUPS.filter((g) => g !== "K/P")
    .map((g) => ({ g, n: board.slice(0, 64).filter((b) => b.group === g).length }))
    .sort((a, b) => b.n - a.n)[0];
  if (deepest) storylines.push(`Deepest position: ${deepest.g}, with ${deepest.n} of the top 64 on the board.`);
  const first = mock.find((m) => !m.actualId);
  if (first?.mockId) {
    storylines.push(`On the clock first: the ${displayName(save.year, first.teamId)}. The network has them taking ${name(save, first.mockId)}.`);
  }
  const schoolCount = new Map<string, number>();
  for (const b of board.slice(0, 64)) {
    const c = save.players[b.playerId]?.college;
    if (c) schoolCount.set(c, (schoolCount.get(c) ?? 0) + 1);
  }
  const factory = [...schoolCount].sort((a, b) => b[1] - a[1])[0];
  if (factory && factory[1] >= 3) storylines.push(`${factory[0]} could send ${factory[1]} players off the board in the first two rounds.`);

  return {
    year: save.year,
    session: sessionOf(save),
    board,
    mock,
    byGroup,
    combine,
    sleepers,
    warRoom,
    userNeeds: teamNeeds(save, save.userTeamId),
    storylines,
  };
}

function pickLine(id: string, lines: string[]): string {
  return lines[hash(id) % lines.length]!;
}

function name(save: DynastySave, id: string): string {
  const p = save.players[id];
  return p ? `${p.firstName} ${p.lastName}` : "—";
}
