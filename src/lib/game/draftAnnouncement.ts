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

export function draftOnClock(s: DraftAudioSnapshot): string {
  return s.drafting && s.onClock
    ? `The ${displayName(s.year, s.onClock)} are on the clock with pick number ${s.nextPick}.`
    : `That concludes the ${s.year} ${league(s.session)} draft.`;
}

export function announceDraftPick(p: DraftSelection, year: number): string {
  const position = footballPosition(p.pos);
  return `With the ${ordinal(p.pick)} pick in the ${year} ${league(p.session)} draft, the ${displayName(year, p.team)} select ${p.name}, ${position}${p.college && p.college !== "Campus" ? `, from ${p.college}` : ""}. Round ${p.round}, pick number ${p.pick}.`;
}

/** Batched skips get one catch-up; a normal selection gets the podium announcement. */
export function draftAnnouncementParts(
  previous: DraftAudioSnapshot,
  next: DraftAudioSnapshot,
): { podium: string; onClock: string } | null {
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
  return { podium: parts.join(" "), onClock: nextLines.join(" ") };
}

export function draftAnnouncement(
  previous: DraftAudioSnapshot,
  next: DraftAudioSnapshot,
): string | null {
  const parts = draftAnnouncementParts(previous, next);
  return parts ? [parts.podium, parts.onClock].filter(Boolean).join(" ") : null;
}
