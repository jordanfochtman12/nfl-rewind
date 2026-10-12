import type { DraftSession, DynastySave, Pos, TeamId } from "./types.ts";
import { currentDraftTeam, sessionOf } from "./draft.ts";
import { displayName } from "./teams.ts";
import { playerName, rosterOf } from "./players.ts";
import { footballPosition } from "./footballSpeech.ts";
import { visibleOvr } from "./scout.ts";

export interface DraftSelection {
  id: string;
  name: string;
  pos: Pos;
  college?: string;
  team: TeamId;
  pick: number;
  round: number;
  session: DraftSession;
}
export interface DraftAudioSnapshot {
  year: number;
  session: DraftSession;
  drafting: boolean;
  onClock?: TeamId;
  nextPick: number;
  selections: DraftSelection[];
  prospects: { id: string; grade: number; pos: Pos }[];
  starters: Partial<Record<TeamId, Partial<Record<Pos, number>>>>;
}

/** Small immutable snapshot; do not retain an entire dynasty just to detect a pick. */
export function draftAudioSnapshot(save: DynastySave): DraftAudioSnapshot {
  const session = sessionOf(save);
  const board = new Set(save.draftBoard.map((p) => p.playerId));
  return {
    year: save.year,
    session,
    drafting: save.phase === "draft",
    onClock: save.phase === "draft" ? currentDraftTeam(save) : undefined,
    nextPick: save.draftPickIndex + 1,
    prospects: save.draftBoard
      .filter((p) => !p.taken && save.players[p.playerId])
      .map((p) => ({
        id: p.playerId,
        grade: visibleOvr(save.players[p.playerId]!),
        pos: save.players[p.playerId]!.pos,
      })),
    starters: Object.fromEntries(
      Object.values(save.teams)
        .filter((t) => t.active)
        .map((t) => {
          const grades: Partial<Record<Pos, number>> = {};
          for (const p of rosterOf(save, t.id))
            grades[p.pos] = Math.max(grades[p.pos] ?? 0, visibleOvr(p));
          return [t.id, grades];
        }),
    ),
    selections: Object.values(save.players)
      .filter((p) => p.draftYear === save.year && p.draftTeam && p.draftPick != null)
      .map((p) => ({
        id: p.id,
        name: playerName(p),
        pos: p.pos,
        college: p.college,
        team: p.draftTeam!,
        pick: p.draftPick!,
        round: p.draftRound ?? 1,
        session: save.year === 1966 && !board.has(p.id) ? "nfl" : session,
      })),
  };
}

export interface DraftReaction {
  kind: "applause" | "boos" | "murmur";
  label: string;
  reason: string;
}

/** Fan opinion uses only the board and roster before the pick, never career potential. */
export function draftCrowdReaction(
  previous: DraftAudioSnapshot,
  next: DraftAudioSnapshot,
): DraftReaction | null {
  if (!previous.drafting || previous.year !== next.year) return null;
  const heard = new Set(previous.selections.map((p) => p.id));
  const added = next.selections.filter((p) => !heard.has(p.id));
  if (!added.length) return null;
  if (added.length > 1)
    return {
      kind: "murmur",
      label: "The room catches up",
      reason: "Several selections came in while the broadcast jumped ahead.",
    };
  const pick = added[0]!;
  const prospect = previous.prospects.find((p) => p.id === pick.id);
  if (!prospect)
    return {
      kind: "murmur",
      label: "Mixed reaction",
      reason: "The room is taking in the selection.",
    };
  const best = Math.max(...previous.prospects.map((p) => p.grade));
  const gap = best - prospect.grade;
  const starter = previous.starters[pick.team]?.[pick.pos] ?? 0;
  const fillsNeed = prospect.grade >= starter + 4;
  if (gap >= 12 || (gap >= 8 && !fillsNeed))
    return {
      kind: "boos",
      label: "Boos from the crowd",
      reason: "Fans see a reach with stronger-rated prospects still on the board.",
    };
  if (gap <= 2 || fillsNeed)
    return {
      kind: "applause",
      label: "Applause from the crowd",
      reason: fillsNeed
        ? "A strong scouted fit for a position that needs help."
        : "One of the strongest scouted prospects still available.",
    };
  return {
    kind: "murmur",
    label: "Mixed reaction",
    reason: "A defensible choice, but the room is not unanimous.",
  };
}

const league = (session: DraftSession) => (session === "afl" ? "AFL" : "NFL");
const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Consecutive picks walk the pool with a stride coprime to its size, so no line repeats back to back. */
function rotate<T>(list: readonly T[], slot: string, year: number, n: number): T {
  const size = list.length;
  let stride = 1 + (hash(`${slot}|${year}`) % Math.max(1, size - 1));
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  while (size > 1 && gcd(stride, size) !== 1) stride = (stride % (size - 1)) + 1;
  return list[(hash(`${slot}|${year}|0`) + n * stride) % size]!;
}

export function draftOnClock(s: DraftAudioSnapshot): string {
  if (!s.drafting || !s.onClock)
    return `That concludes the ${s.year} ${league(s.session)} draft.`;
  const team = displayName(s.year, s.onClock);
  if (s.nextPick === 1) return `The ${team} are on the clock with pick number 1.`;
  return rotate(
    [
      `The ${team} are on the clock with pick number ${s.nextPick}.`,
      `The ${team} are now on the clock.`,
      `Pick number ${s.nextPick} belongs to the ${team}. They're on the clock.`,
      `The ${team} are up next, at number ${s.nextPick}.`,
      `On the clock: the ${team}.`,
    ],
    "clock",
    s.year,
    s.nextPick,
  );
}

const collegeOf = (p: DraftSelection) => (p.college && p.college !== "Campus" ? p.college : "");

/**
 * Round one is read the way the commissioner always reads it. After that a league official
 * reads the picks quickly, round and number first, in a handful of different shapes.
 */
export function announceDraftPick(p: DraftSelection, year: number): string {
  const position = footballPosition(p.pos);
  const college = collegeOf(p);
  const team = displayName(year, p.team);
  // The AFL and NFL drafted separately through 1966, so those years always name the league.
  if (p.round <= 1 || year <= 1966 || p.session === "afl")
    return `With the ${ordinal(p.pick)} pick in the ${year} ${league(p.session)} draft, the ${team} select ${p.name}, ${position}${college ? `, from ${college}` : ""}.`;
  return rotate(
    [
      `Round ${p.round}, pick ${p.pick}. The ${team} select ${p.name}, ${position}${college ? `, ${college}` : ""}.`,
      `With the ${ordinal(p.pick)} pick, the ${team} select ${p.name}${college ? ` of ${college}` : ""}, ${position}.`,
      `The ${team} take ${p.name}, ${position}${college ? `, from ${college}` : ""}, with the ${ordinal(p.pick)} pick.`,
      `Pick ${p.pick}, round ${p.round}: ${p.name}, ${position}${college ? `, ${college}` : ""}, to the ${team}.`,
    ],
    "podium",
    year,
    p.pick,
  );
}

/** The draft desk's take on a pick, keyed to how the room heard it and where it came. */
export function draftDeskTake(p: DraftSelection, reaction: DraftReaction | null, year: number, recent: readonly string[] = []): string {
  const nickname = displayName(year, p.team).split(" ").slice(-1)[0]!;
  const position = footballPosition(p.pos);
  const need = !!reaction && /needs help/.test(reaction.reason);
  const pools: Record<string, string[]> = {
    boos: [
      `That's a reach. There were better players on the board.`,
      `I had him going a lot later than this. The ${nickname} must see something the rest of us don't.`,
      `You can hear the room. I'm with them on this one.`,
      `That one surprised me. I'd have taken the best player available there.`,
      `Bold pick. They'd better be right about him.`,
      `Not where I had him. Not close, honestly.`,
    ],
    need: [
      `That's a need filled. The ${nickname} had to have a ${position}.`,
      `Perfect fit. He walks right into the starting lineup.`,
      `They didn't overthink it. Biggest hole on the roster, and they filled it.`,
      `Smart pick. That position was a problem for them last year.`,
      `He'll be on the field from day one for the ${nickname}.`,
      `They needed help at ${position}, and they got a good one.`,
      `Talent and need lined up. That's how you want it.`,
    ],
    applause: [
      `Great value. He was the best player left on my board.`,
      `I love this pick. Easy call for the ${nickname}.`,
      `They let the board come to them, and it paid off.`,
      `That's a steal right there.`,
      `You don't overthink that one. Take the talent.`,
      `The room likes it, and so do I.`,
      `He's going to be a good pro. I'd bet on it.`,
      `I had him in my top ten. Good for them.`,
      `That's the kind of player you win with.`,
    ],
    murmur: [
      `I can live with that. Not my first choice, but I see it.`,
      `A solid football player. Maybe a little early.`,
      `It's a fair pick. We'll know in three years.`,
      `Some people will like it, some won't. That's the draft.`,
      `I'd call that a safe pick. Nothing flashy.`,
      `Defensible. Not the guy I'd have taken, but defensible.`,
      `Interesting. I want to see how he fits in that scheme.`,
      `There's some upside there. He's raw, though.`,
      `That's a coaching-staff pick. They clearly love him.`,
    ],
  };
  const kind = reaction?.kind === "applause" && need ? "need" : reaction?.kind ?? "murmur";
  const late = p.round >= 3 && kind !== "boos" ? rotate([``, ``, ` Good find this late.`, ` Day-two picks like that build a roster.`], "late", year, p.pick) : "";
  // Walk the pool from this pick's spot and skip anything the desk said in the last few picks.
  const pool = pools[kind]!;
  const at = pool.indexOf(rotate(pool, `desk-${kind}`, year, p.pick));
  const take = pool.map((_, i) => pool[(at + i) % pool.length]!).find((t) => !recent.includes(t)) ?? pool[at]!;
  return take + late;
}

/** Batched skips get one catch-up; a normal selection gets the podium announcement. */
export function draftAnnouncementParts(
  previous: DraftAudioSnapshot,
  next: DraftAudioSnapshot,
  recentDesk: readonly string[] = [],
): { podium: string; onClock: string; desk?: string; round: number; pickId?: string } | null {
  if (!previous.drafting || previous.year !== next.year) return null;
  const heard = new Set(previous.selections.map((p) => p.id));
  const added = next.selections
    .filter((p) => !heard.has(p.id))
    .sort((a, b) => Number(a.session === "afl") - Number(b.session === "afl") || a.pick - b.pick);
  const last = added.at(-1);
  if (!last && previous.session === next.session && previous.drafting === next.drafting)
    return null;
  const parts: string[] = [];
  if (added.length > 1)
    parts.push(`Catching up after ${added.length} selections. The latest pick:`);
  if (last) parts.push(announceDraftPick(last, next.year));
  const nextLines: string[] = [];
  if (previous.session !== next.session && next.drafting)
    nextLines.push(
      `The ${league(previous.session)} draft is complete. We now move to the ${league(next.session)} draft.`,
    );
  nextLines.push(draftOnClock(next));
  const desk = last && added.length === 1 ? draftDeskTake(last, draftCrowdReaction(previous, next), next.year, recentDesk) : undefined;
  return { podium: parts.join(" "), onClock: nextLines.join(" "), desk, round: last?.round ?? 1, pickId: last && added.length === 1 ? last.id : undefined };
}

export function draftAnnouncement(
  previous: DraftAudioSnapshot,
  next: DraftAudioSnapshot,
): string | null {
  const parts = draftAnnouncementParts(previous, next);
  return parts ? [parts.podium, parts.onClock].filter(Boolean).join(" ") : null;
}
