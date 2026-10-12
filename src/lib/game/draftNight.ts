/**
 * Draft night on television: every pick measured against the board the media had going in,
 * position runs, picks that changed hands, round-by-round recaps, and the desk's breakdown.
 * Built from what the public could see (scout grades, measurables), never the sealed ratings.
 * No React.
 */
import type { DynastySave, Player, Pos, TeamId } from "./types.ts";
import { draftQueue, sessionOf, sessionTeams } from "./draft.ts";
import { classConsensus, collegeLine, groupOf, teamNeeds, type PosGroup } from "./draftPreview.ts";
import { footballPosition } from "./footballSpeech.ts";
import { playerName, rosterOf } from "./players.ts";
import { visibleOvr } from "./scout.ts";
import { nicknameOf } from "./teams.ts";

export type PickValue = "STEAL" | "VALUE" | "ON THE BOARD" | "REACH" | "BIG REACH";

export interface PickBreakdown {
  playerId: string;
  name: string;
  pos: Pos;
  college?: string;
  teamId: TeamId;
  overall: number;
  round: number;
  pickInRound: number;
  /** Where the media's board had him in the class. */
  consensus: number;
  /** Grade points behind the fifth-best prospect still on the board when he went. */
  gap: number;
  /** Spots of value: positive when he went later than the board had him. */
  delta: number;
  value: PickValue;
  grade: string;
  need: boolean;
  /** The pick came from another club. */
  from?: TeamId;
  run?: { group: PosGroup; count: number; window: number };
  last: boolean;
  /** The facts the desk can lean on, in order of interest. */
  facts: string[];
  /** The analyst's take, two or three sentences. */
  desk: string;
}

const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth"];
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => NUM[n] ?? String(n);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(key: string, list: readonly T[]): T => list[hash(key) % list.length]!;

const GROUP_PLURAL: Record<PosGroup, string> = {
  QB: "quarterbacks",
  RB: "running backs",
  WR: "receivers",
  TE: "tight ends",
  OT: "tackles",
  IOL: "interior linemen",
  EDGE: "pass rushers",
  DT: "defensive tackles",
  LB: "linebackers",
  CB: "corners",
  S: "safeties",
  "K/P": "specialists",
};
const GROUP_ONE: Record<PosGroup, string> = {
  QB: "quarterback",
  RB: "running back",
  WR: "receiver",
  TE: "tight end",
  OT: "tackle",
  IOL: "interior lineman",
  EDGE: "pass rusher",
  DT: "defensive tackle",
  LB: "linebacker",
  CB: "corner",
  S: "safety",
  "K/P": "specialist",
};

/** This year's selections in pick order. */
export function picksMade(save: DynastySave): Player[] {
  // Walk the board, not the whole player file (tens of thousands of names late in a dynasty).
  return save.draftBoard
    .filter((pr) => pr.taken)
    .map((pr) => save.players[pr.playerId])
    .filter((p): p is Player => !!p && p.draftYear === save.year && !!p.draftTeam && p.draftPick != null)
    .sort((a, b) => a.draftPick! - b.draftPick!);
}

function teamsInSession(save: DynastySave): number {
  return Math.max(1, sessionTeams(save.year, sessionOf(save)).length);
}

function letter(r: number): string {
  return r >= 1.5 ? "A+" : r >= 0.9 ? "A" : r >= 0.5 ? "A-" : r >= 0.2 ? "B+" : r >= -0.15 ? "B" : r >= -0.55 ? "B-" : r >= -0.9 ? "C+" : r >= -1.3 ? "C" : r >= -2 ? "C-" : "D";
}

/** The pick measured: value against the board, need, a run at the position, the desk's take. */
export function pickBreakdown(save: DynastySave, playerId: string, made: Player[] = picksMade(save)): PickBreakdown | undefined {
  const p = save.players[playerId];
  if (!p || p.draftPick == null || !p.draftTeam) return undefined;
  const teamId = p.draftTeam as TeamId;
  const overall = p.draftPick;
  const teamsN = teamsInSession(save);
  const consensus = classConsensus(save).get(p.id) ?? overall;
  const delta = overall - consensus;
  // A spot of value means less as the night goes on: fifteen spots in round six is noise.
  const rel = delta / Math.max(3, overall * 0.32);
  const grade0 = visibleOvr(p);
  const others = rosterOf(save, teamId).filter((x) => x.id !== p.id && x.pos === p.pos);
  const starter = others.length ? Math.max(...others.map(visibleOvr)) : 0;
  const need = !others.length || grade0 >= starter + 3;
  // How far he was from the best man still there: everyone taken after him was available.
  // A pick the board ranks low but grades close to the best available is not a reach.
  // Measured against the fifth-best man left, so one faller doesn't make every pick a reach.
  const left: number[] = [];
  for (const pr of save.draftBoard) {
    const x = save.players[pr.playerId];
    if (!x || x.id === p.id) continue;
    if (!pr.taken || (x.draftYear === save.year && (x.draftPick ?? 0) > overall)) left.push(visibleOvr(x));
  }
  left.sort((a, b) => b - a);
  const gap = (left[Math.min(4, left.length - 1)] ?? grade0) - grade0;
  const relC = Math.max(rel, gap <= 4 ? -0.5 : gap <= 9 ? -1.2 : -Infinity);
  const value: PickValue = relC >= 0.9 ? "STEAL" : relC >= 0.35 ? "VALUE" : relC >= -0.5 ? "ON THE BOARD" : relC >= -1.2 ? "REACH" : "BIG REACH";
  const grade = letter(relC + (need ? 0.3 : 0));
  const slot = draftQueue(save)[overall - 1];
  const from = slot && slot.orig !== slot.owner ? (slot.orig as TeamId) : undefined;
  // A run: three or more at the same spot in the last six picks, this one included.
  const window = 6;
  const recent = made.filter((x) => x.draftPick! <= overall && x.draftPick! > overall - window);
  const group = groupOf(p.pos);
  const count = recent.filter((x) => groupOf(x.pos) === group).length;
  const run = count >= 3 && group !== "K/P" ? { group, count, window: Math.min(window, overall) } : undefined;
  const total = Math.min(draftQueue(save).length, save.draftBoard.length);
  const last = overall === total;
  const nick = nicknameOf(save.year, teamId);
  const position = footballPosition(p.pos);

  const facts: string[] = [];
  if (value === "STEAL" || value === "VALUE") facts.push(`He was number ${consensus} on the consensus board, and the ${nick} got him at ${overall}.`);
  else if (value === "BIG REACH" || value === "REACH") facts.push(`The consensus board had him at ${consensus}. He went ${overall}.`);
  if (run) facts.push(`That's the ${ORD[run.count] ?? ordinal(run.count)} ${GROUP_ONE[run.group]} in the last ${word(run.window)} picks. There's a run on ${GROUP_PLURAL[run.group]}.`);
  if (need && others.length) facts.push(`${position.replace(/^./, (c) => c.toUpperCase())} was a need: their best one grades out at ${starter}, and he comes in at ${grade0}.`);
  else if (need) facts.push(`They didn't have ${/^[aeiou]/.test(position) ? "an" : "a"} ${position} on the roster. Now they do.`);
  const forty = p.combine?.forty ?? p.forty;
  if (forty && forty <= 4.45 && !["LT", "LG", "C", "RG", "RT", "DT", "K", "P"].includes(p.pos)) facts.push(`He ran a ${forty.toFixed(2)} forty.`);
  if (p.heightIn && p.heightIn >= 77 && ["QB", "WR", "TE", "LT", "RT", "DE"].includes(p.pos)) facts.push(pick(`${p.id}-ht`, [`Six-${p.heightIn - 72}, and he moves like a smaller man.`, `He's six-${p.heightIn - 72}. You can't teach that.`, `Six-${p.heightIn - 72} and still growing into his frame.`]));
  const col = collegeLine(save, p);
  if (col.honor && p.college && p.college !== "Campus") facts.push(`${col.honor} at ${p.college}.`);
  if (from) facts.push(`The ${nick} got this pick from the ${nicknameOf(save.year, from)}.`);

  const lead = {
    STEAL: [`That's a steal.`, `What a value for the ${nick}.`, `I can't believe he was still there.`, `The ${nick} got the best player in this range, and it's not close.`],
    VALUE: [`Good value here.`, `I like it. The board came to them.`, `Smart pick. He goes a little later than I expected.`, `Solid value for the ${nick}.`],
    "ON THE BOARD": [`That's right about where I had him.`, `No surprise there.`, `A fair pick, right on the board.`, `That's the pick I expected.`],
    REACH: [`That's a little rich for me.`, `I had him going later.`, `They took him earlier than the board did.`, `A bit of a reach, but they clearly love him.`],
    "BIG REACH": [`That's a reach. There were better players on the board.`, `That one surprised everybody in this building.`, `Not where anybody had him. Not close.`, `Bold pick. They'd better be right.`],
  }[value];
  const closer = need && value !== "BIG REACH" ? pick(`${p.id}-need`, [` He walks right into the lineup.`, ` That fills a real hole.`, ` He'll play from day one.`, ``]) : "";
  const body = facts.slice(0, 2).join(" ");
  const desk = last
    ? `And that's Mr. Irrelevant, the last pick of the ${save.year} draft. ${p.firstName} gets the parade and the trophy, and a shot to make the team.`
    : `${pick(`${p.id}-lead`, lead)} ${body}${closer}`.replace(/\s+/g, " ").trim();
  return {
    playerId: p.id,
    name: playerName(p),
    pos: p.pos,
    college: p.college,
    teamId,
    overall,
    round: p.draftRound ?? Math.floor((overall - 1) / teamsN) + 1,
    pickInRound: ((overall - 1) % teamsN) + 1,
    consensus,
    gap,
    delta,
    value,
    grade,
    need,
    from,
    run,
    last,
    facts,
    desk,
  };
}

/** The crawl: the most recent picks, newest first. */
export function draftTicker(save: DynastySave, n = 16): string[] {
  return picksMade(save)
    .slice(-n)
    .reverse()
    .map((p) => `${p.draftPick} · ${(p.draftTeam ?? "").toUpperCase()} · ${playerName(p)}, ${p.pos}${p.college && p.college !== "Campus" ? `, ${p.college}` : ""}`);
}

export interface RoundRecap {
  round: number;
  picks: number;
  best?: PickBreakdown;
  reach?: PickBreakdown;
  groups: { group: PosGroup; n: number }[];
  mine: PickBreakdown[];
  line: string;
}

/** A round in review: the best value, the biggest reach, what positions went, the owner's picks. */
export function roundRecap(save: DynastySave, round: number): RoundRecap | undefined {
  const made = picksMade(save);
  const rows = made.filter((p) => p.draftRound === round).map((p) => pickBreakdown(save, p.id, made)!).filter(Boolean);
  if (!rows.length) return undefined;
  const best = [...rows].sort((a, b) => b.delta - a.delta)[0];
  const reach = [...rows].sort((a, b) => a.delta - b.delta)[0];
  const count = new Map<PosGroup, number>();
  for (const r of rows) count.set(groupOf(r.pos), (count.get(groupOf(r.pos)) ?? 0) + 1);
  const groups = [...count.entries()].map(([group, n]) => ({ group, n })).sort((a, b) => b.n - a.n);
  const mine = save.sandbox ? [] : rows.filter((r) => r.teamId === save.userTeamId);
  const top = groups[0]!;
  const line = `Round ${round} is in the books: ${rows.length} picks, led by ${word(top.n)} ${top.n === 1 ? GROUP_ONE[top.group] : GROUP_PLURAL[top.group]}.${
    best && best.delta >= 4 ? ` The value of the round: ${best.name} to the ${nicknameOf(save.year, best.teamId)} at ${best.overall}, the board's number ${best.consensus}.` : ""
  }${reach && reach.delta <= -8 && reach !== best ? ` The reach: ${reach.name} at ${reach.overall}, ranked ${reach.consensus}.` : ""}`;
  return { round, picks: rows.length, best, reach, groups, mine, line };
}

/** Best fits on the board for the club on the clock: consensus value, nudged toward its needs. */
export function bestFits(save: DynastySave, teamId: TeamId, n = 3): { playerId: string; rank: number; need: boolean }[] {
  const ranks = classConsensus(save);
  const needs = teamNeeds(save, teamId, 3);
  return save.draftBoard
    .filter((pr) => !pr.taken && save.players[pr.playerId])
    .map((pr) => {
      const p = save.players[pr.playerId]!;
      const rank = ranks.get(p.id) ?? 999;
      const need = needs.includes(p.pos);
      return { playerId: p.id, rank, need, score: rank - (need ? 4 : 0) };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map(({ playerId, rank, need }) => ({ playerId, rank, need }));
}

/** Where the draft is held, by year. */
export function draftVenue(year: number): string {
  if (year >= 2027) return "Live from the host city";
  const by: [number, string][] = [
    [2026, "Live from Pittsburgh"],
    [2025, "Live from Green Bay"],
    [2024, "Live from Detroit"],
    [2023, "Live from Kansas City"],
    [2022, "Live from Las Vegas"],
    [2021, "Live from Cleveland"],
    [2020, "A virtual draft, from home"],
    [2019, "Live from Nashville"],
    [2018, "Live from AT&T Stadium"],
    [2017, "Live from Philadelphia"],
    [2015, "Live from Chicago"],
    [2006, "Live from Radio City Music Hall"],
    [2005, "Live from the Javits Center"],
    [1995, "Live from the Theater at Madison Square Garden"],
    [1986, "Live from the Marriott Marquis"],
    [1980, "Live from the Sheraton, New York"],
  ];
  return by.find(([y]) => year >= y)?.[1] ?? "From New York";
}

/** "the Chicago Bears are on the clock" with the slot, for the on-the-clock plate. */
export function onTheClock(save: DynastySave): { teamId: TeamId; overall: number; round: number; pickInRound: number; from?: TeamId } | undefined {
  const q = draftQueue(save);
  const slot = q[save.draftPickIndex];
  if (save.phase !== "draft" || !slot) return undefined;
  const teamsN = teamsInSession(save);
  const overall = save.draftPickIndex + 1;
  return { teamId: slot.owner as TeamId, overall, round: slot.round, pickInRound: ((overall - 1) % teamsN) + 1, from: slot.orig !== slot.owner ? (slot.orig as TeamId) : undefined };
}


/** The draftee on the phone with his new club, for the owner's own picks. */
export function drafteeCall(save: DynastySave, b: PickBreakdown): string {
  const nick = nicknameOf(save.year, b.teamId);
  const pool =
    b.value === "STEAL" || b.round >= 3
      ? [
          `I watched a lot of names go ahead of me today. I'm going to remember every one of them. Thank you for believing in me.`,
          `I've had a chip on my shoulder all weekend. The ${nick} won't regret this.`,
          `I'm just ready to work. Whatever they need, special teams, anything. I'll earn it.`,
        ]
      : b.round === 1
        ? [
            `This is a dream. I've been waiting my whole life for this call. I'm ready to be a ${nick.replace(/s$/, "")}.`,
            `I can't even put it into words. My family's here, everybody's crying. Let's go to work.`,
            `I knew it when I saw the number come up. I'm coming in ready to compete from day one.`,
          ]
        : [
            `I'm fired up. I talked to the coaches at the combine and I had a feeling. Let's go.`,
            `This is where I wanted to be. I'm going to come in and compete.`,
            `I'm thankful. Now it's time to prove it on the field.`,
          ];
  return pick(`${b.playerId}-call`, pool);
}
