import type { DynastySave, PrimetimeRecap, TeamId } from "./types.ts";
import { activeTeamIds, displayName, gamesInSeason } from "./teams.ts";
import { gamesInWeek } from "./schedule.ts";
import { depthAt, playerName } from "./players.ts";
import { compareTeams } from "./standings.ts";

function drama(g: { homeScore: number; awayScore: number; rivalry?: boolean; night?: boolean }): number {
  const margin = Math.abs(g.homeScore - g.awayScore);
  const total = g.homeScore + g.awayScore;
  return total * 1.6 - margin * 4 + (margin === 0 ? 20 : 0) + (g.rivalry ? 12 : 0) + (g.night ? 8 : 0);
}

const OPENS = [
  "Hello everybody, and welcome to Primetime. The film is in, the scores are final, and somebody just rewrote a Sunday.",
  "You're looking live at Primetime. Coffee's cold, the clicker's hot, and the league just played a full slate.",
  "Back again. Helmets off, lights up. This is Primetime — every score, every wound, one play you'll argue about at work.",
  "Good evening, football. The booth's warm, the tape is cut, and the league just handed us a show.",
  "Live from the desk — Primetime is on the air. Every score from the slate, one story that outlasts the rest.",
  "They played twelve games today. We watched every one so you didn't have to. This is Primetime.",
  "Welcome back. Somewhere out there a coach is already watching Monday's film. We start with today's.",
  "Primetime is on. Grab a seat — this Sunday earned a full rundown.",
  "The stadium lights are still cooling off and we're already rolling tape. Let's get into it.",
];

const WIRE_KINDS = new Set(["injury", "transaction", "award", "retire", "hof"]);

export function buildPrimetime(save: DynastySave): void {
  const games = gamesInWeek(save, save.week).filter((g) => g.played);
  const sorted = games.slice().sort((a, b) => drama(b) - drama(a));
  const recaps: PrimetimeRecap[] = sorted.map((g) => {
    const home = displayName(save.year, g.homeId as TeamId);
    const away = displayName(save.year, g.awayId as TeamId);
    const hs = g.homeScore;
    const as = g.awayScore;
    const margin = Math.abs(hs - as);
    const winner = hs >= as ? home : away;
    const loser = hs >= as ? away : home;
    const wx = g.weather && g.weather !== "clear" ? ` ${g.weather[0]!.toUpperCase()}${g.weather.slice(1)} on the ground.` : "";
    let line: string;
    if (g.night) line = `Monday night: ${winner} ${Math.max(hs, as)}-${Math.min(hs, as)} ${loser}.${wx}`;
    else if (g.rivalry && margin <= 7) line = `Rivalry night — ${winner} edge ${loser}, ${Math.max(hs, as)}-${Math.min(hs, as)}.${wx}`;
    else if (margin === 0) line = `${away} and ${home} play to a ${as}-${hs} deadlock.${wx}`;
    else if (margin <= 3) line = `Hold the phone — ${winner} steal it ${Math.max(hs, as)}-${Math.min(hs, as)}. One score. One heartbeat.${wx}`;
    else if (margin >= 21) line = `${winner} put ${loser} in the rear-view, ${Math.max(hs, as)}-${Math.min(hs, as)}. Someone call a cab.${wx}`;
    else line = `${winner} handle ${loser}, ${Math.max(hs, as)}-${Math.min(hs, as)}.${wx}`;
    const note = g.highlights?.[0] ?? (g.mvpPlayerId && save.players[g.mvpPlayerId] ? `${playerName(save.players[g.mvpPlayerId]!)} runs the tape.` : "Blue-collar Sunday.");
    return {
      homeId: g.homeId as TeamId,
      awayId: g.awayId as TeamId,
      homeScore: hs,
      awayScore: as,
      line,
      note,
    };
  });

  const head = sorted[0];
  let playOfNight = "No highlight rose above the rest.";
  if (head?.highlights?.[0]) playOfNight = head.highlights[0];
  else if (head?.mvpPlayerId && save.players[head.mvpPlayerId]) {
    const mvp = save.players[head.mvpPlayerId]!;
    playOfNight =
      mvp.pos === "RB"
        ? `${playerName(mvp)} takes it the distance. He. Could. Go. All. The. Way.`
        : mvp.pos === "WR"
          ? `${playerName(mvp)} — back, back, back — fingertip, sideline, freeze-frame.`
          : `${playerName(mvp)} drops the house when the place is loud.`;
  }

  const powIds = [save.lastPow.nfc, save.lastPow.afc, save.lastPow.aflNfl].filter(Boolean) as string[];
  const powNames = powIds
    .map((id) => save.players[id])
    .filter(Boolean)
    .map((p) => `${playerName(p!)} (${String(p!.teamId).toUpperCase()})`);
  const pow = powNames.length ? `Players of the week: ${powNames.join(" · ")}.` : "The writers are still in the booth.";

  const poll = activeTeamIds(save.year)
    .map((id) => save.teams[id])
    .filter((t): t is NonNullable<typeof t> => !!t && t.active)
    .sort(compareTeams)
    .slice(0, 3)
    .map((t, i) => `${i + 1}. ${displayName(save.year, t.id)} (${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""})`);
  const powerPoll = poll.length ? poll.join(" · ") : "";

  const wire = save.weekNews
    .filter((n) => n.year === save.year && n.week === save.week && WIRE_KINDS.has(n.kind))
    .map((n) => n.headline)
    .slice(0, 6);

  const user = save.teams[save.userTeamId];
  const open = OPENS[save.week % OPENS.length]!;
  const userGame = games.find((g) => g.homeId === save.userTeamId || g.awayId === save.userTeamId);
  let mood: string;
  if (!userGame) mood = "A bye week in the building — coffee, film, and next week's plan.";
  else if (userGame.homeScore === userGame.awayScore) mood = "A split week in the building. Nobody sleeps easy on a tie.";
  else {
    const won = userGame.homeId === save.userTeamId ? userGame.homeScore > userGame.awayScore : userGame.awayScore > userGame.homeScore;
    mood = won ? "The building exhales. Good tape, better night." : "Long flight home. The film's already loaded.";
  }
  const close = `${displayName(save.year, save.userTeamId)} sit ${user.wins}-${user.losses}${user.ties ? `-${user.ties}` : ""}. ${mood} Week ${save.week} of ${gamesInSeason(save.year)} is in the can. That's Primetime. We'll see you next week.`;

  save.primetime = {
    year: save.year,
    week: save.week,
    open,
    recaps,
    playOfNight,
    pow,
    powerPoll,
    wire,
    close,
  };
}

export function depthChart(save: DynastySave, teamId: TeamId) {
  const groups: { label: string; pos: import("./types.ts").Pos[] }[] = [
    { label: "Offense", pos: ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT"] },
    { label: "Defense", pos: ["DE", "DT", "OLB", "MLB", "CB", "S"] },
    { label: "Specialists", pos: ["K", "P"] },
  ];
  return groups.map((g) => ({
    label: g.label,
    rows: g.pos.map((pos) => ({
      pos,
      players: depthAt(save, teamId, pos).slice(0, 4),
    })),
  }));
}
