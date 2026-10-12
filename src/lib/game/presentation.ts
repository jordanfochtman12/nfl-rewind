/**
 * Game-day presentation built only from what happened: the halftime report (the half's
 * scoring, who's carrying each side, the second-half kickoff) and the postgame interviews
 * (both head coaches and the player of the game, quoting their own numbers). No React.
 */
import { playerName } from "./players.ts";
import { nicknameOf } from "./teams.ts";
import { spokenLine, weight } from "./studio.ts";
import type { BoxPlayer, DynastySave, GameResult, PlayLog, TeamId } from "./types.ts";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(key: string, list: readonly T[]): T => list[hash(key) % list.length]!;

export interface HalftimeReport {
  score: string;
  scoring: string[];
  leaders: string[];
  turning?: string;
  secondHalf: string;
}

/** The first half from the play log: scoring plays, who's carrying the load, what comes next. */
export function halftimeReport(game: GameResult, log: PlayLog[]): HalftimeReport | undefined {
  const half = log.filter((l) => l.q <= 2);
  const last = half.at(-1);
  if (!last) return undefined;
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  const nick = (id: TeamId) => nicknameOf(game.year, id);
  const scoring = half
    .filter((l, k) => k > 0 && (l.hs !== half[k - 1]!.hs || l.as !== half[k - 1]!.as))
    .map((l) => `Q${l.q} · ${nick(l.poss)} ball · ${l.text.split(". ")[0]!.replace(/\.$/, "")}. (${nick(away)} ${l.as}, ${nick(home)} ${l.hs})`);
  // Who's carrying it: yards by name, read from the play-by-play itself.
  const rush = new Map<string, number>();
  const rec = new Map<string, number>();
  const pass = new Map<string, number>();
  for (const l of half) {
    const r = l.text.match(/^(.+?) runs for (-?\d+) yards?/);
    if (r) rush.set(r[1]!, (rush.get(r[1]!) ?? 0) + Number(r[2]));
    const c = l.text.match(/^(.+?) to (.+?) for (-?\d+) yards?/);
    if (c) {
      pass.set(c[1]!, (pass.get(c[1]!) ?? 0) + Number(c[3]));
      rec.set(c[2]!, (rec.get(c[2]!) ?? 0) + Number(c[3]));
    }
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  const leaders: string[] = [];
  const p = top(pass);
  const r = top(rush);
  const w = top(rec);
  if (p && p[1] >= 40) leaders.push(`${p[0]}: ${p[1]} passing yards`);
  if (r && r[1] >= 25) leaders.push(`${r[0]}: ${r[1]} rushing yards`);
  if (w && w[1] >= 30) leaders.push(`${w[0]}: ${w[1]} receiving yards`);
  const to = half.filter((l) => l.tag === "to");
  const turning = to.length
    ? `${to.length === 1 ? "One turnover" : `${to.length} turnovers`} so far: ${to.map((l) => `${nick(l.poss)} gave it away in Q${l.q}`).join("; ")}.`
    : undefined;
  // Whoever received the opening kick kicks off to start the second half.
  const firstPoss = log[0]?.poss;
  const receiving = firstPoss === home ? away : home;
  const lead = last.hs - last.as;
  const secondHalf = `The ${nick(receiving)} get the ball to start the third quarter${
    lead === 0 ? ", tied." : `, ${(receiving === home ? lead : -lead) > 0 ? "up" : "down"} ${Math.abs(lead)}.`
  }`;
  return { score: `${nick(away)} ${last.as}, ${nick(home)} ${last.hs}`, scoring, leaders, turning, secondHalf };
}

export interface Interview {
  who: string;
  role: string;
  teamId: TeamId;
  quote: string;
}

const sumBox = (box: BoxPlayer[] | undefined, k: keyof BoxPlayer) => (box ?? []).reduce((n, b) => n + ((b[k] as number | undefined) ?? 0), 0);

/** The postgame podium: the winning coach, the player of the game, the losing coach. */
export function postgameInterviews(save: DynastySave, game: GameResult): Interview[] {
  if (!game.played || !game.boxHome || !game.boxAway) return [];
  const home = game.homeId as TeamId;
  const away = game.awayId as TeamId;
  if (!save.teams[home] || !save.teams[away]) return [];
  const tie = game.homeScore === game.awayScore;
  const winner = game.homeScore >= game.awayScore ? home : away;
  const loser = winner === home ? away : home;
  const boxOf = (id: TeamId) => (id === home ? game.boxHome : game.boxAway)!;
  const to = (id: TeamId) => (id === home ? game.homeTo : game.awayTo) ?? 0;
  const margin = Math.abs(game.homeScore - game.awayScore);
  const coachOf = (id: TeamId) => {
    const c = save.teams[id]?.coachId ? save.coaches[save.teams[id]!.coachId!] : undefined;
    return c?.name ?? `The ${nicknameOf(game.year, id)} head coach`;
  };
  const key = game.id;
  const out: Interview[] = [];
  const wRush = sumBox(boxOf(winner), "rushYds");
  const wRushAtt = sumBox(boxOf(winner), "rushAtt");
  const lRush = sumBox(boxOf(loser), "rushYds");
  const wSacks = sumBox(boxOf(winner), "sacks");
  const takeaways = to(loser);
  const giveaways = to(winner);

  // The winning coach talks about whatever actually won it.
  const why: string[] = [];
  if (takeaways >= 2) why.push(`We took the ball away ${takeaways} times. Win the turnover battle, you usually win the game.`);
  if (wRushAtt >= 30 && wRush >= 140) why.push(`${wRushAtt} carries, ${wRush} yards. When we run it like that, that's who we are.`);
  if (wSacks >= 4) why.push(`${wSacks} sacks. Our front made life miserable for their quarterback.`);
  if (lRush <= 60) why.push(`We held them to ${lRush} yards on the ground. That's a statement by our defense.`);
  if (game.ot) why.push(`Overtime. I'm proud of how we answered when it got tight.`);
  if (margin <= 3 && !game.ot) why.push(`A ${margin === 0 ? "tie" : `${margin}-point`} game. Those are the ones that show you what a team is made of.`);
  if (margin >= 21) why.push(`Complete game, all three phases. We'll enjoy it tonight and get back to work.`);
  if (giveaways >= 3) why.push(`We won, but ${giveaways} turnovers won't beat good teams. We'll clean it up.`);
  if (!why.length) why.push(`Good team win. Guys did their jobs and we made the plays when we needed them.`);
  out.push({
    who: coachOf(winner),
    role: tie ? `${nicknameOf(game.year, winner)} head coach` : `Winning coach, ${nicknameOf(game.year, winner)}`,
    teamId: winner,
    quote: tie ? `Nobody plays for a tie. ${why[0]}` : why.slice(0, 2).join(" "),
  });

  // The player of the game quotes his own day.
  const star = [...boxOf(winner)]
    .map((b) => ({ b, p: save.players[b.playerId] }))
    .filter((x) => x.p)
    .sort((a, b) => weight(b.b) - weight(a.b))[0];
  const mvp = game.mvpPlayerId ? save.players[game.mvpPlayerId] : star?.p;
  const mvpBox = mvp ? [...game.boxHome, ...game.boxAway].find((b) => b.playerId === mvp.id) : undefined;
  if (mvp && mvpBox) {
    const line = spokenLine(mvpBox, mvp.pos);
    out.push({
      who: playerName(mvp),
      role: `Player of the game, ${mvp.pos}`,
      teamId: mvp.teamId as TeamId,
      quote: line
        ? pick(`${key}-star`, [
            `${line[0]!.toUpperCase()}${line.slice(1)}? That's on the guys up front. I just did my part.`,
            `It's about the win. ${line[0]!.toUpperCase()}${line.slice(1)} only matters because we got the W.`,
            `I felt it early. Coaches put me in good spots and I made the plays: ${line}.`,
          ])
        : `Team win. Everybody contributed tonight.`,
    });
  }

  // The losing coach owns it.
  if (!tie) {
    const lose: string[] = [];
    if (takeaways >= 3) lose.push(`${takeaways} turnovers. You can't give a good team extra possessions like that.`);
    if (lRush <= 60) lose.push(`We couldn't run the ball. ${lRush} yards isn't good enough.`);
    if (margin <= 3) lose.push(`It came down to a play or two, and they made one more than we did.`);
    if (margin >= 21) lose.push(`That's on me. We weren't ready, and it showed from the start.`);
    if (!lose.length) lose.push(`They outplayed us. We'll look at the film and get better.`);
    out.push({ who: coachOf(loser), role: `Losing coach, ${nicknameOf(game.year, loser)}`, teamId: loser, quote: lose.slice(0, 2).join(" ") });
  }
  return out;
}

export interface DeskRead {
  speaker: "HOST" | "ANALYST" | "REPORTER" | "GUEST";
  /** For a guest at the podium: who is talking. */
  guest?: string;
  text: string;
}

const QUARTER_WORDS = ["", "first", "second", "third", "fourth"];

/** The halftime report as the desk reads it: host on the score and the scoring, analyst on who's carrying it. */
export function halftimeScript(game: GameResult, log: PlayLog[]): DeskRead[] {
  const r = halftimeReport(game, log);
  if (!r) return [];
  const key = `${game.id}-half`;
  const half = log.filter((l) => l.q <= 2);
  const last = half.at(-1)!;
  const tied = last.hs === last.as;
  const out: DeskRead[] = [
    {
      speaker: "HOST",
      text: `${pick(key, ["Welcome back to the halftime desk.", "We're at the half.", "Halftime, and here's where we stand."])} ${tied ? `It's all square, ${last.hs} apiece.` : `${r.score}.`}`,
    },
  ];
  const plays = half.filter((l, k) => k > 0 && (l.hs !== half[k - 1]!.hs || l.as !== half[k - 1]!.as));
  if (plays.length) {
    const told = plays.slice(-4).map((l) => {
      const what = l.text.split(". ")[0]!.replace(/\.$/, "");
      const finish = l.tag === "td" && !/touchdown/i.test(what) ? ", touchdown" : "";
      return `In the ${QUARTER_WORDS[l.q]} quarter, the ${nicknameOf(game.year, l.poss)}: ${what}${finish}.`;
    });
    out.push({ speaker: "HOST", text: `${plays.length > 4 ? "The latest of the scoring." : "How we got here."} ${told.join(" ")}` });
  } else {
    out.push({ speaker: "HOST", text: "No points on the board. The defenses have owned this half." });
  }
  const leaders = r.leaders.map((x) => x.replace(": ", " with "));
  const read: string[] = [];
  if (leaders.length) read.push(`${pick(`${key}-a`, ["The story of the half:", "Here's who's carrying it.", "Look at the numbers."])} ${leaders.join(", ")}.`);
  const giveaways = half.filter((l) => l.tag === "to");
  if (giveaways.length) {
    const by = [game.awayId, game.homeId].map((id) => ({ id: id as TeamId, n: giveaways.filter((l) => l.poss === id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const count = (n: number) => (n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : String(n));
    read.push(
      by.length === 1
        ? `And the ${nicknameOf(game.year, by[0]!.id)} have turned it over ${giveaways.length === 1 ? "once" : `${count(giveaways.length)} times`}.`
        : `${count(giveaways.length).replace(/^./, (c) => c.toUpperCase())} turnovers in the half: ${by.map((x) => `${count(x.n)} by the ${nicknameOf(game.year, x.id)}`).join(", ")}.`,
    );
  }
  if (!read.length) read.push("Nobody's broken this one open yet. It's going to come down to adjustments in the locker room.");
  out.push({ speaker: "ANALYST", text: read.join(" ") });
  out.push({ speaker: "HOST", text: `${r.secondHalf} ${pick(`${key}-b`, ["The second half is next.", "Stay with us.", "Back to the field for the third quarter."])}` });
  return out;
}

/** The podium as the field reporter runs it: an introduction, then each guest in his own voice. */
export function podiumScript(save: DynastySave, game: GameResult): DeskRead[] {
  const list = postgameInterviews(save, game);
  const out: DeskRead[] = [];
  for (const [k, x] of list.entries()) {
    const intro = /coach/i.test(x.role)
      ? pick(`${game.id}-c${k}`, [`Let's hear from ${x.who}.`, `${x.who} at the podium.`, `Here's ${x.who}.`])
      : pick(`${game.id}-p${k}`, [`I'm down here with ${x.who}.`, `The player of the game, ${x.who}.`, `${x.who} joins us.`]);
    out.push({ speaker: "REPORTER", text: intro });
    out.push({ speaker: "GUEST", guest: x.who, text: x.quote });
  }
  return out;
}
