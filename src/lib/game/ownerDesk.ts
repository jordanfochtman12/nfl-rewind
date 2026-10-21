/**
 * The owner's call: in-season dilemmas that land on the owner's desk between Sundays. A star
 * wants his extension now, two players are feuding, a starter blew curfew, a hurt star begs
 * to play, the fans have had enough of losing. Each choice moves moods for weeks (and with
 * them the locker room's chemistry, which the sim plays), the fans' support, a contract, or
 * who suits up. A call left on the desk when the next week is played takes the quiet option.
 *
 * Dilemmas roll from their own hash, not the save's dice, so a season's games play the same
 * whether or not the owner answers.
 */
import { addNews } from "./news.ts";
import { ownerOf } from "./owner.ts";
import { playerName, rosterOf } from "./players.ts";
import { salaryFor } from "./salary.ts";
import { displayName } from "./teams.ts";
import { moraleOf } from "./morale.ts";

export { moodNotes } from "./morale.ts";
import type { DynastySave, OwnerDecision, OwnerDecisionKind, Player, TeamId } from "./types.ts";

const stamp = (year: number, week: number) => year * 100 + week;

/** A steady number in [0, 1) from a string: the desk's own dice. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A mood nudge that holds for a few weeks instead of washing out with the weekly drift. */
export function nudgeMood(save: DynastySave, p: Player, delta: number, text: string, weeks = 4): void {
  p.morale = Math.max(5, Math.min(98, moraleOf(p) + delta));
  p.moodNote = { text, delta: Math.round(delta * 0.6), until: stamp(save.year, save.week + weeks) };
}

/** A whole-room nudge (a statement, a fine that sets a tone). */
function nudgeRoom(save: DynastySave, teamId: TeamId, delta: number, text: string, weeks = 3): void {
  const t = save.teams[teamId];
  if (!t) return;
  t.roomNote = { text, delta, until: stamp(save.year, save.week + weeks) };
  for (const p of rosterOf(save, teamId)) p.morale = Math.max(5, Math.min(98, moraleOf(p) + Math.round(delta / 2)));
}

function support(save: DynastySave, delta: number): void {
  const o = ownerOf(save);
  o.support = Math.max(0, Math.min(100, o.support + delta));
}

export function openDecisions(save: DynastySave): OwnerDecision[] {
  return (save.decisions ?? []).filter((d) => d.status === "open" && d.year === save.year);
}

function stars(save: DynastySave, id: TeamId): Player[] {
  return rosterOf(save, id)
    .filter((p) => !p.holdout && !p.onIR)
    .sort((a, b) => b.ovr - a.ovr);
}

type Draft = Omit<OwnerDecision, "id" | "year" | "week" | "status">;

/* ------------------------------------------------------------------ the calls */

function extensionCall(save: DynastySave, id: TeamId): Draft | undefined {
  const p = stars(save, id).find((x) => x.ovr >= 80 && x.contractYears <= 1 && x.age <= 31 && x.injuredWeeks <= 0);
  if (!p) return;
  const ask = Math.round(salaryFor(save.year, p.ovr, p.age, p.pos) * 1.12);
  return {
    kind: "extension",
    title: `${playerName(p)} wants his extension now`,
    body: `His agent called before practice. ${playerName(p)} is in the last year of his deal and doesn't want to play the back half of the season on it. He's asking for four more years at market money and then some.`,
    teamIds: [id],
    playerIds: [p.id],
    ask,
    options: [
      { id: "pay", label: "Pay him now", hint: "Four years at his ask. He's thrilled, and the room notices." },
      { id: "refuse", label: "No extension", hint: "Saves the money. Expect him to sulk, and maybe more." },
      { id: "after", label: "Talk after the season", hint: "Keeps your options open. He won't love it." },
    ],
  };
}

function riftCall(save: DynastySave, id: TeamId): Draft | undefined {
  const roster = stars(save, id).filter((p) => p.injuredWeeks <= 0);
  const vet = roster.find((p) => p.age >= 30 && p.ovr >= 74);
  const kid = roster.find((p) => p.age <= 25 && p.ovr >= 74 && p.id !== vet?.id);
  if (!vet || !kid) return;
  return {
    kind: "rift",
    title: `${playerName(vet)} and ${playerName(kid)} aren't talking`,
    body: `It started in film study and spilled into the locker room. ${playerName(vet)}, the veteran, says the kid doesn't work. ${playerName(kid)} says the old man is jealous. Half the room has picked a side.`,
    teamIds: [id],
    playerIds: [vet.id, kid.id],
    options: [
      { id: "vet", label: `Back ${playerName(vet)}`, hint: "The veterans stand taller. The young guy feels it." },
      { id: "kid", label: `Back ${playerName(kid)}`, hint: "The future is his. The veteran won't forget it." },
      { id: "coach", label: "Let the coach handle it", hint: "Nobody wins. It might fester." },
    ],
  };
}

function curfewCall(save: DynastySave, id: TeamId, roll: number): Draft | undefined {
  const pool = stars(save, id).filter((p) => p.ovr >= 70 && p.injuredWeeks <= 0 && p.age <= 30);
  const p = pool[Math.floor(roll * Math.min(6, pool.length))];
  if (!p) return;
  return {
    kind: "curfew",
    title: `${playerName(p)} missed curfew`,
    body: `${playerName(p)} wasn't in the hotel at bed check and was late to the morning walkthrough. The room knows. The coach wants to know what the owner thinks before he says anything.`,
    teamIds: [id],
    playerIds: [p.id],
    options: [
      { id: "fine", label: "Fine him", hint: "A message without losing him. He'll grumble." },
      { id: "sit", label: "Sit him this Sunday", hint: "The room respects it. You play without him." },
      { id: "slide", label: "Let it slide", hint: "He's grateful. Others may test you." },
    ],
  };
}

function hurtCall(save: DynastySave, id: TeamId): Draft | undefined {
  const p = rosterOf(save, id)
    .filter((x) => x.ovr >= 78 && !x.onIR && !x.holdout && x.injuredWeeks >= 2 && x.injuredWeeks <= 4)
    .sort((a, b) => b.ovr - a.ovr)[0];
  if (!p) return;
  return {
    kind: "hurt",
    title: `${playerName(p)} wants to play hurt`,
    body: `${playerName(p)} (${p.injuryName ?? "banged up"}) is supposed to miss ${p.injuredWeeks - 1} more game${p.injuredWeeks === 2 ? "" : "s"}. He went to the owner's box himself: he wants the needle and the start on Sunday. The doctors are against it.`,
    teamIds: [id],
    playerIds: [p.id],
    options: [
      { id: "play", label: "Let him play", hint: "He's back this week. If it goes wrong, it goes wrong for longer." },
      { id: "rest", label: "Listen to the doctors", hint: "He heals right. He'll be frustrated." },
    ],
  };
}

function fansCall(save: DynastySave, id: TeamId): Draft | undefined {
  const t = save.teams[id];
  const o = ownerOf(save);
  const n = t?.streak?.startsWith("L") ? Number(t.streak.slice(1)) || 0 : 0;
  if (!t || n < 3 || o.support > 60) return;
  return {
    kind: "fans",
    title: `${n} straight losses and the fans are restless`,
    body: `There were banners in the upper deck last week and the papers want the owner on the record. Season-ticket renewals go out next month.`,
    teamIds: [id],
    playerIds: [],
    options: [
      { id: "cut", label: "Cut ticket prices", hint: "Less at the gate. The fans notice the gesture." },
      { id: "speech", label: "Talk to the team yourself", hint: "A locker-room speech. It could light a fire." },
      { id: "quiet", label: "Say nothing", hint: "Ride it out. The columnists won't." },
    ],
  };
}

function charityCall(save: DynastySave, id: TeamId, roll: number): Draft | undefined {
  const pool = stars(save, id).filter((p) => p.ovr >= 76 && p.injuredWeeks <= 0);
  const p = pool[Math.floor(roll * Math.min(4, pool.length))];
  if (!p) return;
  return {
    kind: "community",
    title: `${playerName(p)} wants the club behind his charity drive`,
    body: `${playerName(p)} is running a toy and coat drive downtown and wants the club's name, the stadium lot, and the owner there with a check.`,
    teamIds: [id],
    playerIds: [p.id],
    options: [
      { id: "all", label: "Go all in", hint: "Good for the city and for him. The room likes it." },
      { id: "name", label: "Lend the club's name", hint: "A nice gesture without the owner's time." },
      { id: "pass", label: "Pass this year", hint: "Focus on football. He'll take it personally." },
    ],
  };
}

/* ------------------------------------------------------------------ outcomes */

function resolve(save: DynastySave, d: OwnerDecision, optionId: string, quiet = false): string {
  const id = d.teamIds[0]!;
  const ps = d.playerIds.map((x) => save.players[x]).filter((p): p is Player => !!p && p.teamId === id);
  const p = ps[0];
  const club = displayName(save.year, id);
  let headline = "";
  let body = "";
  switch (d.kind) {
    case "extension": {
      if (!p) break;
      if (optionId === "pay") {
        p.salary = d.ask ?? p.salary;
        p.contractYears = Math.max(p.contractYears, 4);
        nudgeMood(save, p, 22, "Got his extension", 8);
        nudgeRoom(save, id, 3, "The owner pays his stars");
        headline = `${club} lock up ${playerName(p)}`;
        body = `Four more years. "This is home," he said after practice.`;
      } else if (optionId === "after") {
        nudgeMood(save, p, -10, "Extension put off", 5);
        headline = `${playerName(p)}'s extension can wait, the ${club} say`;
        body = `Talks will pick up after the season. He didn't hide his disappointment.`;
      } else {
        nudgeMood(save, p, -24, "The owner said no to his extension", 8);
        nudgeRoom(save, id, -2, "Stars don't get paid here");
        headline = `No extension for ${playerName(p)}`;
        body = `The ${club} turned down his ask. He walked out of the building without talking to reporters.`;
      }
      break;
    }
    case "rift": {
      const [vet, kid] = ps;
      if (!vet || !kid) break;
      if (optionId === "vet") {
        nudgeMood(save, vet, 14, "The owner backed him", 5);
        nudgeMood(save, kid, -16, "The owner took the veteran's side", 5);
        headline = `${club} side with ${playerName(vet)}`;
        body = `The veteran's voice carries the room. ${playerName(kid)} was quiet at his locker.`;
      } else if (optionId === "kid") {
        nudgeMood(save, kid, 14, "The owner backed him", 5);
        nudgeMood(save, vet, -16, "The owner took the kid's side", 5);
        headline = `${club} back ${playerName(kid)}`;
        body = `It's the young man's team now. ${playerName(vet)} declined to comment.`;
      } else {
        nudgeMood(save, vet, -6, "A feud nobody settled", 4);
        nudgeMood(save, kid, -6, "A feud nobody settled", 4);
        nudgeRoom(save, id, -3, "A feud in the locker room");
        headline = `The ${club} feud simmers`;
        body = `The coach says it's handled. Players say it isn't.`;
      }
      break;
    }
    case "curfew": {
      if (!p) break;
      if (optionId === "fine") {
        nudgeMood(save, p, -8, "Fined by the club", 3);
        nudgeRoom(save, id, 2, "Rules apply to everybody");
        headline = `${club} fine ${playerName(p)}`;
        body = `An undisclosed amount for missing curfew. "My fault," he said.`;
      } else if (optionId === "sit") {
        p.injuredWeeks = Math.max(p.injuredWeeks, 2);
        p.injuryName = "suspended";
        nudgeMood(save, p, -14, "Benched for missing curfew", 4);
        nudgeRoom(save, id, 5, "Nobody is bigger than the team");
        headline = `${playerName(p)} benched for Sunday`;
        body = `The ${club} sat him for a curfew violation. The locker room called it the right call.`;
      } else {
        nudgeMood(save, p, 6, "The owner had his back", 3);
        nudgeRoom(save, id, -4, "The stars play by different rules");
        headline = `No discipline for ${playerName(p)}`;
        body = `The ${club} called it a misunderstanding. Not everybody in the room agrees.`;
      }
      break;
    }
    case "hurt": {
      if (!p) break;
      if (optionId === "play") {
        const left = p.injuredWeeks;
        const worse = hash01(`${d.id}:worse`) < 0.3;
        p.injuredWeeks = 0;
        p.injuryName = undefined;
        nudgeMood(save, p, 12, "The owner let him play", 4);
        nudgeRoom(save, id, 2, "A star playing through it");
        headline = `${playerName(p)} will play through it`;
        body = `The ${club} cleared him to go Sunday.`;
        if (worse) {
          d.later = { playerId: p.id, weeks: left + 3 };
          body += " The doctors are watching every snap.";
        }
      } else {
        nudgeMood(save, p, -8, "Held out by the doctors", 3);
        headline = `${playerName(p)} stays on the sideline`;
        body = `The ${club} are taking the long view.`;
      }
      break;
    }
    case "fans": {
      if (optionId === "cut") {
        const o = ownerOf(save);
        o.ticket = o.ticket === "gouge" ? "premium" : o.ticket === "premium" ? "standard" : "value";
        support(save, 9);
        headline = `${club} cut ticket prices`;
        body = `"Our fans have earned it," the owner said.`;
      } else if (optionId === "speech") {
        const lit = hash01(`${d.id}:speech`) < 0.6;
        nudgeRoom(save, id, lit ? 7 : -4, lit ? "The owner's speech fired them up" : "The owner's speech fell flat", 3);
        support(save, lit ? 3 : -2);
        headline = lit ? `The owner's speech fires up the ${club}` : `The owner's speech falls flat`;
        body = lit ? `Players came out of the meeting talking about a fresh start.` : `"It was a lot of words," one player said.`;
      } else {
        support(save, -6);
        headline = `Silence from the ${club} owner`;
        body = `No statement. The fans noticed.`;
      }
      break;
    }
    case "community": {
      if (!p) break;
      if (optionId === "all") {
        nudgeMood(save, p, 14, "The owner backed his charity", 6);
        nudgeRoom(save, id, 3, "A club that shows up for its city");
        support(save, 5);
        headline = `${club} and ${playerName(p)} fill the stadium lot`;
        body = `Thousands of coats and toys, and the owner was handing them out.`;
      } else if (optionId === "name") {
        nudgeMood(save, p, 6, "The club backed his charity", 4);
        support(save, 2);
        headline = `${playerName(p)}'s drive gets the club's name`;
        body = `A good turnout downtown.`;
      } else {
        nudgeMood(save, p, -10, "The owner passed on his charity", 5);
        support(save, -2);
        headline = `${club} pass on ${playerName(p)}'s charity drive`;
        body = `He went ahead on his own.`;
      }
      break;
    }
  }
  d.status = "done";
  d.chosen = optionId;
  d.outcome = headline ? `${headline}. ${body}` : "It blew over.";
  if (quiet && headline) d.outcome = `Left on the desk: ${d.outcome}`;
  if (headline) addNews(save, { kind: d.kind === "community" || d.kind === "fans" ? "headline" : "transaction", headline, body, teamIds: d.teamIds, playerIds: d.playerIds });
  return d.outcome;
}

/** The owner makes the call. */
export function decide(save: DynastySave, decisionId: string, optionId: string): string {
  const d = (save.decisions ?? []).find((x) => x.id === decisionId);
  if (!d || d.status !== "open") return "That one's already been handled.";
  if (!d.options.some((o) => o.id === optionId)) return "That isn't one of the choices.";
  return resolve(save, d, optionId);
}

/** Before the week is played: a call still on the desk takes its quiet option. */
export function ownerDeskBeforeWeek(save: DynastySave): void {
  if (save.cpuOnly || save.sandbox || save.realHistory || save.leagueSandbox) return;
  for (const d of save.decisions ?? []) {
    if (d.status === "open" && (d.year !== save.year || d.week < save.week)) resolve(save, d, d.options.at(-1)!.id, true);
  }
}

/**
 * After the week is played: a star who played hurt pays for it if he was going to, and maybe
 * a new call lands on the desk. Owner seasons only.
 */
export function ownerDeskWeek(save: DynastySave): void {
  if (save.cpuOnly || save.sandbox || save.realHistory || save.leagueSandbox || save.phase !== "regular") return;
  const id = save.userTeamId;
  const list = (save.decisions ??= []);
  for (const d of list) {
    if (d.later && d.status === "done" && (d.year < save.year || d.week < save.week)) {
      const p = save.players[d.later.playerId];
      if (p && p.teamId === id && p.injuredWeeks <= 0 && !p.onIR) {
        p.injuredWeeks = d.later.weeks;
        p.injuryName = "aggravated injury";
        p.injuredOn = { year: save.year, week: save.week, phase: save.phase };
        nudgeMood(save, p, -10, "Came back too soon", 4);
        addNews(save, { kind: "injury", headline: `${playerName(p)} aggravates the injury`, body: `He tried to play through it. Now he's out ${d.later.weeks - 1} more weeks.`, teamIds: [id], playerIds: [p.id] });
      }
      d.later = undefined;
    }
  }
  // Keep a season's worth of the desk, no more.
  save.decisions = list.filter((d) => d.year >= save.year - 1).slice(-24);
  if (save.week < 1 || openDecisions(save).length) return;
  const seed = `${save.year}:${save.week}:${id}:${save.nextNewsSeq % 7}`;
  const season = save.decisions.filter((d) => d.year === save.year);
  // A few a season, a couple of weeks apart: the desk is a moment, not a chore.
  if (season.length >= 6 || season.some((d) => d.week >= save.week - 1)) return;
  if (hash01(`${seed}:land`) > 0.4) return;
  const recent = new Set(season.filter((d) => d.week >= save.week - 4).map((d) => d.kind));
  const named = new Set(season.flatMap((d) => d.playerIds));
  const used = (k: OwnerDecisionKind) => save.decisions!.filter((d) => d.year === save.year && d.kind === k).length;
  const roll = hash01(`${seed}:who`);
  const makers: [OwnerDecisionKind, () => Draft | undefined][] = [
    ["hurt", () => hurtCall(save, id)],
    ["fans", () => fansCall(save, id)],
    ["extension", () => extensionCall(save, id)],
    ["rift", () => riftCall(save, id)],
    ["curfew", () => curfewCall(save, id, roll)],
    ["community", () => charityCall(save, id, roll)],
  ];
  // Start somewhere different each week so no one kind owns the desk.
  const start = Math.floor(hash01(`${seed}:start`) * makers.length);
  for (let i = 0; i < makers.length; i++) {
    const [kind, make] = makers[(start + i) % makers.length]!;
    if (recent.has(kind) || used(kind) >= (kind === "extension" ? 1 : 2)) continue;
    const draft = make();
    // A player is on the desk once a season.
    if (!draft || draft.playerIds.some((x) => named.has(x))) continue;
    save.decisions.push({ ...draft, id: `desk-${save.year}-${save.week}-${kind}`, year: save.year, week: save.week, status: "open" });
    return;
  }
}
