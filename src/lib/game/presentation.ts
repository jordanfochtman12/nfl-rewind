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

/** A Super Bowl podium should reflect the title game that just happened, not a generic win line. */
function superBowlCoachQuote(
  save: DynastySave,
  game: GameResult,
  teamId: TeamId,
  won: boolean,
  margin: number,
  teamBox: BoxPlayer[],
  opponentBox: BoxPlayer[],
  teamTurnovers: number,
  opponentTurnovers: number,
): string {
  const teamQ = teamId === game.homeId ? game.homeQ : game.awayQ;
  const oppQ = teamId === game.homeId ? game.awayQ : game.homeQ;
  const halfMargin = (teamQ?.[0] ?? 0) + (teamQ?.[1] ?? 0) - (oppQ?.[0] ?? 0) - (oppQ?.[1] ?? 0);
  const teamRush = sumBox(teamBox, "rushYds");
  const opponentRush = sumBox(opponentBox, "rushYds");
  const teamSacks = sumBox(teamBox, "sacks");
  const qbName = savePlayerNameForCoachLine(save, teamBox, game);
  const key = `${game.id}-${teamId}-${won ? "champion" : "runner-up"}`;
  if (game.ot) {
    return won
      ? pick(`${key}-ot`, [
          "Both teams earned this. We had to answer every punch, and our guys kept believing until the last snap.",
          "There was nothing easy about that one. The whole locker room stayed composed when the season was on the line.",
          "That's a championship drive in the biggest moment. Everybody did their job when we had to have it.",
        ])
      : pick(`${key}-ot`, [
          "It takes a full team to get this far, and a play or two to lose it. That ending is going to stay with us.",
          "We had our chances and didn't finish the last drive. Credit to them, but this one will hurt for a while.",
          "Nobody in that room quit. We came up one snap short, and I'll remember how hard they fought.",
        ]);
  }
  if (won && halfMargin < 0) {
    return pick(`${key}-comeback`, [
      "We were behind at the half and nobody panicked. The players made the adjustments and trusted each other all the way back.",
      "That locker room believed before the comeback showed up on the scoreboard. They earned every bit of this.",
      "We talked about playing the next snap, not the deficit. The way they responded is what this team is.",
    ]);
  }
  if (!won && halfMargin > 0) {
    return pick(`${key}-lead-lost`, [
      "We had control at the half and let it slip. I have to own the adjustments, and our players will own the response.",
      "They made the plays after halftime and we didn't. A lead at the break doesn't mean anything if you don't finish.",
      "We put ourselves in position, then failed to close. That's on all of us, starting with me.",
    ]);
  }
  if (won && margin >= 21) {
    return pick(`${key}-dominant`, [
      `Our defense set the tone and ${qbName} kept the offense on schedule. That's a complete team showing on the biggest stage.`,
      "We didn't chase the moment. We played our game, stayed disciplined, and let the work show up.",
      `The front controlled the line of scrimmage, and our offense finished drives. That's how you win a championship.`,
    ]);
  }
  if (!won && margin >= 21) {
    return pick(`${key}-routed`, [
      "They were the better team today. I have to own that, and I won't let the work these players did all year get reduced to one result.",
      "We didn't meet the moment and there's no excuse for it. Our players deserved a better plan from me.",
      "They controlled the game from the start. We'll learn from the film, but that doesn't make tonight easier.",
    ]);
  }
  if (won && opponentTurnovers - teamTurnovers >= 2) {
    return pick(`${key}-takeaways`, [
      `We were ready when the ball came loose. Those ${opponentTurnovers - teamTurnovers} extra possessions changed the game.`,
      "Our defense kept attacking the ball, and the offense made those chances count. That's a team win.",
      "Championships turn on details. We protected the football and took theirs away when it mattered.",
    ]);
  }
  if (won && teamRush >= 150 && teamRush - opponentRush >= 50) {
    return pick(`${key}-ground-game`, [
      `We ran for ${teamRush} yards and controlled the clock. That was the identity we wanted to bring to this game.`,
      "The line and backs set the terms tonight. When we can stay on schedule like that, our whole playbook is open.",
      "We wanted a physical game and our guys delivered it for four quarters. They wore us in, and that's championship football.",
    ]);
  }
  if (!won && teamTurnovers >= 3) {
    return pick(`${key}-giveaways`, [
      `You can't give away the ball ${teamTurnovers} times and expect to win this game. That's the first thing I'll answer for.`,
      "We handed them too many chances. The players are hurting, and I have to get us better prepared to protect the football.",
      "The turnovers put us behind the game. We can't ask the defense to keep answering that many short fields.",
    ]);
  }
  if (won && margin <= 3) {
    return pick(`${key}-close`, [
      "That came down to the last few possessions. Our players stayed steady when the whole season was on one play.",
      "You could feel how thin the margin was. Somebody had to make a championship play, and our guys did.",
      "That's why you finish every rep in practice. In a game like this, one detail can decide everything.",
    ]);
  }
  if (!won && margin <= 3) {
    return pick(`${key}-close-loss`, [
      "We had a chance to win it late and didn't make the play. That's the truth, and we'll carry it with us.",
      "One or two snaps separated us. Their players made theirs and we didn't make ours.",
      "There's no comfort in a close loss tonight. We have to be honest about the missed chances and keep moving.",
    ]);
  }
  if (won && teamSacks >= 4) {
    return pick(`${key}-defense`, [
      `Our rush got home ${teamSacks} times and changed their whole afternoon. The defense gave us the championship standard.`,
      "The defense kept winning its downs and made the quarterback hold the ball. That gave us the game we needed.",
      "We played complementary football. The rush set the edge, the coverage finished, and the offense took care of the rest.",
    ]);
  }
  return won
    ? pick(`${key}-title`, [
        "This group never needed a speech about the moment. They trusted the work, trusted each other, and finished the season together.",
        "Every player in that room had a hand in this. The starters get the pictures, but the whole club earned the ring.",
        "We talked all year about being at our best when it mattered most. Tonight the players made that real.",
      ])
    : pick(`${key}-loss`, [
        "I'm proud of the season, but proud isn't the same as satisfied. We came here to win and didn't get it done.",
        "This team earned the right to play tonight. We didn't finish the job, and that responsibility starts with me.",
        "The season is over and this one hurts. I'll remember how much this group put into getting here.",
      ]);
}

/** Read the passer from the box score without inventing a name when a club attempted no passes. */
function savePlayerNameForCoachLine(save: DynastySave, box: BoxPlayer[], game: GameResult): string {
  const qb = box
    .filter((b) => (b.passAtt ?? 0) > 0)
    .sort((a, b) => (b.passYds ?? 0) - (a.passYds ?? 0))[0];
  const player = qb ? save.players[qb.playerId] : undefined;
  return player ? playerName(player) : (game.phase === "superBowl" ? "our quarterback" : "the quarterback");
}

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
    quote:
      game.phase === "superBowl"
        ? superBowlCoachQuote(save, game, winner, true, margin, boxOf(winner), boxOf(loser), giveaways, takeaways)
        : tie
          ? `Nobody plays for a tie. ${why[0]}`
          : why.slice(0, 2).join(" "),
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
    out.push({
      who: coachOf(loser),
      role: `Losing coach, ${nicknameOf(game.year, loser)}`,
      teamId: loser,
      quote:
        game.phase === "superBowl"
          ? superBowlCoachQuote(save, game, loser, false, margin, boxOf(loser), boxOf(winner), takeaways, giveaways)
          : lose.slice(0, 2).join(" "),
    });
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
