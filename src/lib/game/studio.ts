/**
 * The studio show, as a conversation. Built only from this dynasty's recorded results; no
 * random state consumed. The era's named desk (host, analyst, reporter) talk to each other:
 * the host sets it up and hands off by name, the analyst explains what decided it, the
 * reporter brings the standings and the streaks, and now and then they disagree. Every line
 * is drawn from a pool keyed to the episode, and no phrasing is used twice in one show.
 */
import type { BoxPlayer, DynastySave, GameResult, PrimetimeShow, PrimetimeStory, TeamId } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName, divisionKey, nicknameOf, roman, superBowlNumber, teamAbbr } from "./teams.ts";
import { depthAt, playerName } from "./players.ts";
import { superBowlSite } from "./data/bowlSites.ts";
import { crewFor } from "./previewVoice.ts";
import { arcsThisWeek, divisionPickMisses } from "./arcs.ts";

type Episode = NonNullable<PrimetimeShow["episode"]>;
type Chapter = Episode["chapters"][number];
type Speaker = "HOST" | "ANALYST" | "REPORTER";
type Line = { speaker: Speaker; text: string };

const win = (g: GameResult) => (g.homeScore > g.awayScore ? g.homeId : g.awayId) as TeamId;
const lose = (g: GameResult) => (g.homeScore > g.awayScore ? g.awayId : g.homeId) as TeamId;
const score = (g: GameResult) => `${teamAbbr(g.awayId as TeamId)} ${g.awayScore}, ${teamAbbr(g.homeId as TeamId)} ${g.homeScore}`;
const hiLo = (g: GameResult) => `${Math.max(g.homeScore, g.awayScore)}-${Math.min(g.homeScore, g.awayScore)}`;
const involved = (g: GameResult, id: TeamId) => g.homeId === id || g.awayId === id;
const record = (s: DynastySave, id: TeamId) => {
  const t = s.teams[id];
  return `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
};
const first = (n: string) => n.replace(/ “.*”/, "").split(" ")[0]!;
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The analyst's reaction to a league story, by kind. */
const STORY_TAKES: Record<string, string[]> = {
  Upset: [
    "That's why you play the games.",
    "I'll be honest, I didn't see that one coming.",
    "Any given Sunday. That's the league.",
    "That's a statement win. The rest of the division just took notice.",
    "Somebody in that losing locker room is getting an earful this week.",
    "I don't think it was a fluke, either. They were the better team that day.",
  ],
  "Big day": [
    "That's a star doing star things.",
    "I've watched that tape twice. He was in a different gear.",
    "You can't scheme for that. Sometimes a great player just takes over.",
    "That's the kind of game that gets you noticed in awards season.",
    "When he's playing like that, there's not a defense in the league that can stop him.",
    "Unreal. I don't know what else to say.",
  ],
  Perfect: [
    "They're not just winning, they're dominating.",
    "Somebody's going to beat them eventually. I just don't know who.",
    "Perfect seasons are hard. Let's see how they handle the pressure in December.",
    "That's the best team in football right now, and it isn't close.",
  ],
  Winless: [
    "It's tough. You feel for the players in that locker room.",
    "At some point you have to look at the coaching staff.",
    "They're not as bad as the record. But they're not good, either.",
    "That's a long flight home every week.",
  ],
  Hot: [
    "They're playing with a lot of confidence right now.",
    "Nobody wants to see them on the schedule.",
    "That's a team peaking at the right time.",
    "Winning becomes a habit. They've got it.",
  ],
  Skid: [
    "They need to stop the bleeding, and fast.",
    "When you lose like that, the locker room starts to splinter.",
    "Something has to change. Personnel, play-calling, something.",
    "I've been in that spot. It's not fun.",
  ],
  Clinched: [
    "Now the real season starts.",
    "Congrats to them, but nobody hangs a banner for making the field.",
    "Now it's about getting healthy and getting a bye.",
  ],
  Eliminated: [
    "Now it's about evaluation. Who's part of the future?",
    "Disappointing year. They'll be busy this offseason.",
    "That's a tough way to end it.",
  ],
  default: [
    "That's one to watch. I'd keep an eye on it the next few weeks.",
    "Interesting. I don't think people are paying enough attention to that.",
    "I've been saying it for a while. This doesn't surprise me.",
    "If that holds up, it changes the whole race.",
    "That's going to be a storyline the rest of the way.",
  ],
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const num = (n: number) => (n >= 0 && n <= 10 ? WORDS[n]! : String(n));
const plural = (n: number, w: string, pl = `${w}s`) => `${num(n)} ${n === 1 ? w : pl}`;

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

function storyFocusId(story: PrimetimeStory): string {
  const teams = [...story.teamIds].sort().join(",");
  const players = [...story.playerIds].sort().join(",");
  return `topic:${story.tag}:${teams}:${players}`;
}

/** "1,530 rush yds · 12 TD · 52 rec" said out loud: "1,530 rushing yards, 12 touchdowns and 52 catches". */
function spokenStats(line: string): string {
  const map: [RegExp, string][] = [
    [/\brush yds\b/g, "rushing yards"],
    [/\brec yds\b/g, "receiving yards"],
    [/\bpass yds\b/g, "passing yards"],
    [/\byds\b/g, "yards"],
    [/\bTDs?\b/g, "touchdowns"],
    [/\bINTs?\b/g, "interceptions"],
    [/\brec\b/g, "catches"],
    [/\btkl\b/g, "tackles"],
    [/\bFF\b/g, "forced fumbles"],
    [/\bFGs?\b/g, "field goals"],
  ];
  const parts = line.split(/\s*·\s*/).map((x) => map.reduce((t, [re, w]) => t.replace(re, w), x.trim())).filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? line;
}

const theSite = (site: string) => (/bowl|coliseum|dome/i.test(site) && !/^the /i.test(site) ? `the ${site}` : site);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A spoken stat line from a box score: "24 carries for 106 yards and two touchdowns". */
export function spokenLine(b: BoxPlayer, pos: string): string | undefined {
  const n = (x?: number) => x ?? 0;
  const and = (bits: string[]) => (bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0]!);
  if (n(b.passAtt) >= 10) {
    const bits = [`${n(b.passCmp)} of ${n(b.passAtt)} for ${n(b.passYds)} yards`];
    if (n(b.passTd)) bits.push(plural(n(b.passTd), "touchdown"));
    if (n(b.passInt)) bits.push(plural(n(b.passInt), "interception"));
    return and(bits);
  }
  if (n(b.rushAtt) >= 8 && n(b.rushYds) >= 40) return `${n(b.rushAtt)} carries for ${n(b.rushYds)} yards${n(b.rushTd) ? ` and ${plural(n(b.rushTd), "touchdown")}` : ""}`;
  if (n(b.rec) >= 3 && n(b.recYds) >= 40) return `${plural(n(b.rec), "catch", "catches")} for ${n(b.recYds)} yards${n(b.recTd) ? ` and ${plural(n(b.recTd), "touchdown")}` : ""}`;
  const d: string[] = [];
  if (n(b.sacks) >= 1) d.push(n(b.sacks) === 1 ? "a sack" : `${n(b.sacks)} sacks`);
  if (n(b.ints)) d.push(n(b.ints) === 1 ? "an interception" : `${num(n(b.ints))} interceptions`);
  if (n(b.ff)) d.push(n(b.ff) === 1 ? "a forced fumble" : `${num(n(b.ff))} forced fumbles`);
  if (d.length) return and(d);
  if (pos === "K" && n(b.fgMade) >= 3) return `${num(n(b.fgMade))} field goals`;
  return undefined;
}

export function weight(b: BoxPlayer): number {
  const n = (x?: number) => x ?? 0;
  return (
    n(b.passYds) * 0.04 + n(b.passTd) * 4 - n(b.passInt) * 2.5 + n(b.rushYds) * 0.1 + n(b.rushTd) * 6 + n(b.recYds) * 0.1 + n(b.recTd) * 6 + (n(b.sacks) * 4 + n(b.ints) * 5 + n(b.ff) * 3) * 1.2
  );
}

export function produceEpisode(save: DynastySave, show: PrimetimeShow, games: GameResult[], upcoming: GameResult[], finale: boolean): Episode {
  const year = show.year;
  const name = (tid: TeamId) => displayName(year, tid);
  const nick = (tid: TeamId) => nicknameOf(year, tid);
  const crew = crewFor(year);
  const H = first(crew.HOST.name);
  const A = first(crew.ANALYST.name);
  const R = first(crew.REPORTER.name);
  const sbPreview = upcoming.find((g) => g.phase === "superBowl");
  const edition: Episode["edition"] =
    show.kind === "superBowl" ? "superBowl" : show.kind === "awards" ? "awards" : sbPreview ? "championship" : finale ? "seasonFinale" : show.kind === "playoffs" ? "playoffs" : "weekly";
  const id = `${year}-${edition}-${show.week}-${games
    .map((g) => g.id)
    .sort()
    .join("_")}`;

  // One phrasing per slot, never the same words twice in an episode, and a different
  // starting point every week so Sunday nights don't sound alike.
  // Seeded with the last few shows, so a hand-off heard last week isn't heard again this week.
  const used = new Set<string>(
    [...(save.primetimeArchive ?? []), ...(save.primetime ? [save.primetime] : [])]
      .filter((x) => x.episode && x.episode.id !== id)
      .slice(-3)
      .flatMap((x) => (x.episode!.chapters ?? []).flatMap((c) => (c.lines ?? []).map((l) => l.text.slice(0, 24)))),
  );
  // The big shows air once a year, so a slot steps to a different choice each season (the
  // stride is coprime to the pool size); weekly shows also step by the week.
  const isWeekly = edition === "weekly" || edition === "playoffs";
  const say = (slot: string, list: readonly string[]): string => {
    const n = list.length;
    const key = `${edition}|${slot}`;
    let stride = n > 1 ? (hash(key + "s") % (n - 1)) + 1 : 1;
    while (n > 1 && gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
    const start = (hash(isWeekly ? `${id}|${slot}` : key) + (isWeekly ? 0 : year * stride)) % n;
    for (let k = 0; k < list.length; k++) {
      const t = list[(start + k) % list.length]!;
      const stem = t.slice(0, 24);
      if (!used.has(stem)) {
        used.add(stem);
        return t;
      }
    }
    return list[start]!;
  };
  const chance = (slot: string, inN: number) => hash(`${id}|${slot}|?`) % inN === 0;

  const chapters: Chapter[] = [];
  const add = (cid: string, kicker: string, title: string, teamIds: TeamId[], lines: (Line | false | undefined)[]) => {
    const clean = lines.filter((l): l is Line => !!l && !!l.text.trim()).map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }));
    if (clean.length) chapters.push({ id: cid, kicker, title, teamIds, lines: clean });
  };
  const host = (text: string): Line => ({ speaker: "HOST", text });
  const analyst = (text: string): Line => ({ speaker: "ANALYST", text });
  const reporter = (text: string): Line => ({ speaker: "REPORTER", text });

  const previous = [...(save.primetimeArchive ?? []), ...(save.primetime ? [save.primetime] : [])].filter((s) => s.year === year && s.episode?.id !== id).at(-1);
  const season = save.schedule.filter((g) => g.year === year && g.played && g.phase === "regular");
  const featured = games.slice().sort((a, b) => {
    const w = (g: GameResult) => 45 - Math.abs(g.homeScore - g.awayScore) * 2 + (g.ot ? 35 : 0) + (g.rivalry ? 12 : 0) + (!save.sandbox && involved(g, save.userTeamId) ? 6 : 0);
    return w(b) - w(a);
  });
  const lead = featured[0];

  /* ---------- reading the season ---------- */
  const streak = (tid: TeamId, through: GameResult): { n: number; won: boolean } => {
    const rows = season.filter((x) => involved(x, tid) && x.week <= through.week).sort((a, b) => b.week - a.week);
    let n = 0;
    let won: boolean | undefined;
    for (const x of rows) {
      if (x.homeScore === x.awayScore) break;
      const w = win(x) === tid;
      if (won === undefined) won = w;
      if (w !== won) break;
      n += 1;
    }
    return { n, won: !!won };
  };
  const divLeader = (tid: TeamId): TeamId | undefined => {
    const key = divisionKey(year, tid);
    const pct = (x: TeamId) => {
      const t = save.teams[x];
      return (t.wins + t.ties / 2) / Math.max(1, t.wins + t.losses + t.ties);
    };
    return activeTeamIds(year)
      .filter((x) => divisionKey(year, x) === key)
      .sort((a, b) => pct(b) - pct(a))[0];
  };
  const stars = (g: GameResult, tid?: TeamId) =>
    [...(g.boxHome ?? []).map((b) => ({ t: g.homeId as TeamId, b })), ...(g.boxAway ?? []).map((b) => ({ t: g.awayId as TeamId, b }))]
      .filter((r) => (!tid || r.t === tid) && save.players[r.b.playerId])
      .map((r) => ({ ...r, p: save.players[r.b.playerId]!, w: weight(r.b), line: spokenLine(r.b, save.players[r.b.playerId]!.pos) }))
      .filter((r): r is typeof r & { line: string } => r.w > 6 && !!r.line)
      .sort((a, b) => b.w - a.w);

  /* ---------- the headline ---------- */
  const headline =
    edition === "superBowl" && lead
      ? `${name(win(lead))}. Champions.`
      : edition === "championship" && sbPreview
        ? `${name(sbPreview.awayId as TeamId)}. ${name(sbPreview.homeId as TeamId)}. One trophy.`
        : edition === "seasonFinale"
          ? `${year}: the field is set`
          : edition === "awards"
            ? `${year}: the season belongs to them`
            : lead
              ? lead.homeScore === lead.awayScore
                ? `${name(lead.homeId as TeamId)} and ${name(lead.awayId as TeamId)} cannot be separated`
                : `${name(win(lead))} ${lead.ot ? "survive overtime" : Math.abs(lead.homeScore - lead.awayScore) <= 3 ? "win on the edge" : "take the spotlight"}`
              : `${year} · the league notebook`;
  const subtitle =
    edition === "championship"
      ? `Championship review / Super Bowl ${roman(superBowlNumber(year))} preview`
      : edition === "seasonFinale"
        ? "Regular-season wrap / Studio awards / Playoff opening round"
        : edition === "superBowl"
          ? `Super Bowl ${roman(superBowlNumber(year))} / Championship celebration / Year in review`
          : edition === "awards"
            ? "Official honors / Legacy / Next season"
            : `${show.title} / ${games.length} games / The stories behind the scores`;

  /* ---------- the open ---------- */
  const close = games.filter((g) => Math.abs(g.homeScore - g.awayScore) <= 7).length;
  const total = games.reduce((n, g) => n + g.homeScore + g.awayScore, 0);
  const welcome = say("welcome", [
    `Good evening, everybody, and welcome in. I'm ${crew.HOST.name}, alongside ${crew.ANALYST.name} and ${crew.REPORTER.name}.`,
    `Welcome to the show. ${crew.HOST.name} here, with ${A} and ${R} on the desk.`,
    `Hello again from the studio. I'm ${crew.HOST.name}. ${A}'s here, ${R}'s here, and we've got a lot to get to.`,
    `Evening, everybody. ${crew.HOST.name} with you, ${crew.ANALYST.name} beside me, and ${crew.REPORTER.name} with the latest from around the league.`,
  ]);
  const weekly = edition === "weekly" || edition === "playoffs";
  const what = weekly
    ? games.length > 1
      ? `${show.title}: ${plural(games.length, "game")}, ${total} points, and ${close ? `${num(close)} of them came down to one possession` : "not a lot of drama, frankly"}.`
      : `${show.title}, and one game worth the whole night.`
    : edition === "seasonFinale"
      ? say("what-f", [
          "The regular season is in the books, the playoff field is set, and we hand out our own awards tonight.",
          "That's the regular season. Tonight: who's in, who's out, and our picks for the hardware.",
          "The standings are final. We'll set the playoff field and hand out a few awards of our own.",
          "Every team has played its last regular-season game. Now the real fun starts.",
        ])
      : edition === "championship"
        ? say("what-c", [
            `Two teams left. We'll look back at how they got here and ahead to Super Bowl ${roman(superBowlNumber(year))}.`,
            `It's down to two. Super Bowl ${roman(superBowlNumber(year))} is set, and we'll break it all down.`,
            `The conference champions are crowned, and the matchup for Super Bowl ${roman(superBowlNumber(year))} is locked in.`,
          ])
        : edition === "superBowl"
          ? say("what-s", [
              "A champion has been crowned. We'll celebrate them and look back on the whole season.",
              "The confetti is still coming down. Let's talk about the champions, and the season that got them there.",
              "It's over. We have a champion, and we have a lot to say about how they did it.",
            ])
          : say("what-a", [
              "Awards night. The league has handed out its honors, and we've got thoughts.",
              "The votes are in and the trophies are handed out. Let's go through all of it.",
              "It's honors night around the league. Some easy calls, and a couple of arguments.",
            ]);
  const tease =
    lead && weekly
      ? lead.ot
        ? say("tease", [`We start with an overtime game, ${A}. You were standing up in here.`, `And we have to start with the one that went to overtime.`, `First up, the one that needed an extra period.`])
        : Math.abs(lead.homeScore - lead.awayScore) <= 3
          ? say("tease", [`We start with a game that came down to the final snap.`, `First, a finish you're going to want to see again.`])
          : say("tease", [`We start with the ${nick(win(lead))}.`, `Let's get right to the ${nick(win(lead))}.`])
      : "";
  const seasonLen = year < 1978 ? "Fourteen" : year < 2021 ? "Sixteen" : "Seventeen";
  add("opening", "ON THE AIR", headline, lead ? [lead.awayId as TeamId, lead.homeId as TeamId] : [], [
    host(`${welcome} ${what} ${tease}`),
    lead && weekly
      ? analyst(
          lead.ot
            ? say("open-a", [`I've been looking forward to this one all night, ${H}.`, `${H}, that was the best game of the week and it wasn't close.`, `Bring it on. That one had everything.`])
            : say("open-a", [
                `Plenty to talk about, ${H}. Let's go.`,
                `Big week. Couple of results I did not see coming.`,
                `I've got some strong opinions tonight, ${H}. Fair warning.`,
                `I've been waiting all day to get to this, ${H}.`,
                `Good to be here. There's a lot on the tape this week.`,
                `Let's do it. Some teams helped themselves this week, and some really didn't.`,
                `Buckle up, ${H}. I'm fired up about a couple of these.`,
              ]),
        )
      : edition === "seasonFinale"
        ? analyst(say("open-f", [`${seasonLen} games, ${H}, and now it's single elimination. Everything resets.`, `Now it's lose and go home, ${H}. I love this time of year.`, `The regular season tells you who's good. The playoffs tell you who's great.`, `Everybody's record is zero and zero again, ${H}. One bad afternoon and you're done.`]))
        : edition === "championship"
          ? analyst(say("open-c", [`Both of these teams earned it, ${H}. No flukes in this matchup.`, `Best two teams in football, ${H}. I really believe that.`, `Two very different teams, and I can't wait to see how this one plays out.`, `It's the matchup a lot of us wanted, ${H}.`]))
          : edition === "superBowl"
            ? analyst(say("open-s", [`What a game, ${H}. What a season.`, `I'm still a little hoarse from that one.`, `Champions, ${H}. Nobody can take that away from them now.`]))
            : edition === "awards"
              ? analyst(say("open-w", [`I've got a few bones to pick, ${H}. Fair warning.`, `Some deserving winners tonight.`, `Let's hand out some hardware.`]))
              : undefined,
  ]);

  /* ---------- the games ---------- */
  for (const [k, g] of featured.slice(0, edition === "weekly" ? 3 : 6).entries()) {
    const home = g.homeId as TeamId;
    const away = g.awayId as TeamId;
    const tied = g.homeScore === g.awayScore;
    const winner = win(g);
    const loser = lose(g);
    const margin = Math.abs(g.homeScore - g.awayScore);
    const recap = show.recaps.find((r) => r.homeId === home && r.awayId === away);
    const highlight = g.highlights?.[0] ?? recap?.note;
    const top = stars(g, winner)[0] ?? stars(g)[0];
    const credit = stars(g, loser)[0];
    const to = g.homeTo !== undefined && g.awayTo !== undefined ? { w: winner === home ? g.homeTo : g.awayTo, l: winner === home ? g.awayTo : g.homeTo } : undefined;
    const wasUpset = !tied && save.teams[loser].wins > save.teams[winner].wins + 1;

    const setUp = tied
      ? `${name(away)} and ${name(home)}, ${g.homeScore} apiece. Nobody blinked.`
      : g.phase === "superBowl"
        ? `${name(winner)} win it all, ${hiLo(g)} over ${name(loser)}.`
        : g.round
          ? say(`gs${k}`, [`${g.round}: ${name(winner)} ${margin <= 3 ? "survive" : "move on past"} ${name(loser)}, ${hiLo(g)}.`, `In the ${g.round}, it's ${name(winner)} ${hiLo(g)} over ${name(loser)}.`])
          : say(`gs${k}`, [
              `${name(winner)} ${g.ot ? "outlast" : margin >= 21 ? "run away from" : margin <= 3 ? "edge" : "beat"} ${name(loser)}, ${hiLo(g)}${g.ot ? " in overtime" : ""}.`,
              `Final${g.ot ? " in overtime" : ""}: ${score(g)}. The ${nick(winner)} win it.`,
              `${margin <= 3 ? "What a finish." : margin >= 21 ? "This one got out of hand early." : "A good one."} ${name(winner)} ${hiLo(g)} over ${name(loser)}${g.ot ? " in overtime" : ""}.`,
              `The ${nick(winner)} ${hiLo(g)}, and the ${nick(loser)} go home with the loss${g.ot ? " after overtime" : ""}.`,
            ]);
    const moment = highlight ? say(`hl${k}`, [`The moment everybody's talking about: ${highlight}`, `Here's the play. ${highlight}`, `Watch this. ${highlight}`, `The turning point: ${highlight}`]) : "";
    const ask = say(`ask${k}`, [`${A}, what decided it?`, `${A}, how did they win this one?`, `What did you see, ${A}?`, `${A}, walk me through it.`, `Where was this won, ${A}?`, `${A}, your take.`]);

    // The analyst's read: the turnover story, the man who decided it, and the guy on the
    // other side who deserved better.
    const why: string[] = [];
    if (to && to.l - to.w >= 2)
      why.push(
        say(`to${k}`, [
          `Turnovers, ${H}. The ${nick(loser)} gave it away ${num(to.l)} times. You're not beating anybody like that.`,
          `It's simple. ${cap(num(to.l))} turnovers by the ${nick(loser)}. That's the ballgame.`,
          `The ${nick(winner)} won the turnover battle by ${num(to.l - to.w)}, and that's your story right there.`,
        ]),
      );
    else if (to && to.w - to.l >= 2)
      why.push(say(`to${k}`, [`Here's what's wild, ${H}: the ${nick(winner)} turned it over ${num(to.w)} times and still won. That tells you how much better they were everywhere else.`, `They gave it away ${num(to.w)} times and won anyway. I honestly don't know how.`]));
    if (top)
      why.push(
        say(`star${k}`, [
          `${playerName(top.p)} was the difference: ${top.line}.`,
          `Look at ${playerName(top.p)}. ${cap(top.line)}. That's a star taking over a game.`,
          `You have to start with ${playerName(top.p)}: ${top.line}. Best player on the field.`,
          `${playerName(top.p)}, ${top.line}. Every time they needed a play, he made it.`,
        ]),
      );
    else why.push(say(`grind${k}`, [`No one guy, ${H}. They just won more snaps than the other team.`, `This was a team win. Nobody's line jumps off the page, they just did their jobs.`]));
    if (credit && credit.p.id !== top?.p.id && !tied)
      why.push(say(`cr${k}`, [`And give ${playerName(credit.p)} credit in the loss: ${credit.line}.`, `${playerName(credit.p)} did everything he could for the ${nick(loser)}. ${cap(credit.line)}.`]));

    // The reporter: what it means.
    let means: string;
    if (g.phase !== "regular")
      means =
        g.phase === "superBowl"
          ? say(`sbm${k}`, [`The ${nick(winner)} are champions. The ${nick(loser)} come up one game short.`, `It's the ${nick(winner)}'s trophy. The ${nick(loser)} were one win away.`, `Champions: the ${nick(winner)}. And a tough way for the ${nick(loser)} to end it.`])
          : say(`po${k}`, [
              `The ${nick(winner)} keep going. The ${nick(loser)}' season is over.`,
              `The ${nick(winner)} advance, and for the ${nick(loser)}, that's the end of the road.`,
              /Wild|Divisional|First/i.test(g.round ?? "") ? `One and done for the ${nick(loser)}. The ${nick(winner)} live to play another week.` : `So close for the ${nick(loser)}. The ${nick(winner)} move on.`,
            ]);
    else if (!tied) {
      const s = streak(winner, g);
      const ls = streak(loser, g);
      const leads = divLeader(winner) === winner;
      const wr = record(save, winner);
      const lr = record(save, loser);
      const hot = s.won && s.n >= 3 ? num(s.n) : "";
      const bits = [
        say(`wr${k}`, [
          `The ${nick(winner)} are ${wr}${hot ? `, winners of ${hot} straight` : ""}${leads ? ", and they're on top of the division" : ""}.`,
          `That gets the ${nick(winner)} to ${wr}${leads ? " and keeps them in first" : ""}${hot ? `. ${cap(hot)} in a row now` : ""}.`,
          `${leads ? "First place" : `A ${wr} record`} for the ${nick(winner)}${leads ? `, at ${wr}` : ""}${hot ? `, and they've won ${hot} straight` : ""}.`,
          `The ${nick(winner)} move to ${wr}${hot ? ` on a ${hot}-game run` : ""}${leads ? ", best in the division" : ""}.`,
        ]),
      ];
      bits.push(
        !ls.won && ls.n >= 3
          ? say(`lr${k}`, [`The ${nick(loser)} have dropped ${num(ls.n)} in a row, and the mood around that team is not good.`, `That's ${num(ls.n)} straight losses for the ${nick(loser)}. People are starting to ask hard questions.`, `${cap(num(ls.n))} losses in a row for the ${nick(loser)}. They're at ${lr} and searching.`])
          : say(`lr${k}`, [`The ${nick(loser)} fall to ${lr}.`, `For the ${nick(loser)}, it's ${lr} and back to work.`, `The ${nick(loser)} drop to ${lr}.`, `${lr} now for the ${nick(loser)}.`]),
      );
      means = `${say(`rp${k}`, [`${H}, the big picture:`, `Here's what it means.`, `Quick look at the standings.`, `Zooming out for a second:`])} ${bits.join(" ")}`;
    } else means = `A tie leaves the ${nick(away)} at ${record(save, away)} and the ${nick(home)} at ${record(save, home)}.`;

    const push = wasUpset && chance(`pb${k}`, 2);
    add(`film-${g.id}`, g.round ?? "THE FILM ROOM", recap?.line ?? score(g), [away, home], [
      host(`${setUp} ${moment} ${ask}`),
      analyst(why.join(" ")),
      push && host(say(`pb${k}`, [`I'll be honest, ${A}, I didn't see this coming. The ${nick(loser)} had the better record.`, `${A}, is this real, or did the ${nick(loser)} just have a bad day?`])),
      push &&
        analyst(
          say(`pba${k}`, [
            `Oh, it's real. Go back and watch the film. The ${nick(winner)} have been knocking on the door for weeks.`,
            `Little of both. The ${nick(loser)} didn't play well, but don't take anything away from the ${nick(winner)}.`,
            `I'm not ready to crown them, ${H}. Let's see them do it again.`,
          ]),
        ),
      reporter(means),
    ]);
  }

  /* ---------- the weekly notebook ---------- */
  if (edition === "weekly") {
    const previousFocus = new Set(previous?.episode?.focusIds ?? []);
    const candidates = (show.stories ?? []).filter(
      (s) => !previousFocus.has(s.headline) && !previousFocus.has(storyFocusId(s)),
    );
    for (const [k, s] of candidates.slice(0, 2).entries())
      add(`story-${chapters.length}`, s.tag, s.headline, s.teamIds, [
        host(
          say(`sty${k}`, [
            `${R}, you've been working on something.`,
            `Let's go around the league. ${R}?`,
            `${R}, what else is going on out there?`,
            `Bring us up to speed, ${R}.`,
            `${R}, what are you hearing?`,
            `Over to ${R} for the rest of the league.`,
            `${R}, you were all over this one this week.`,
            `What else caught your eye, ${R}?`,
            `${R}, give us the headline nobody's talking about.`,
            `Plenty happening elsewhere. ${R}?`,
          ]),
        ),
        reporter(s.body),
        analyst(say(`stya${k}`, STORY_TAKES[s.tag] ?? STORY_TAKES.default!)),
        chance(`styh${k}`, 3) ? host(say(`styh${k}`, [`Fair enough.`, `We'll keep an eye on it.`, `Can't argue with that.`, `Noted. Let's keep moving.`])) : undefined,
      ]);

    const lastPick = previous?.previews?.find((p) => games.some((g) => g.homeId === p.homeId && g.awayId === p.awayId));
    const result = lastPick && games.find((g) => g.homeId === lastPick.homeId && g.awayId === lastPick.awayId);
    if (lastPick && result) {
      const tie = result.homeScore === result.awayScore;
      const right = !tie && win(result) === lastPick.pick;
      add("accountability", "LAST WEEK / THIS WEEK", "Checking the desk's pick", [lastPick.awayId, lastPick.homeId], [
        host(`Accountability time. Last week ${A} took the ${nick(lastPick.pick)}. Final: ${score(result)}.`),
        tie
          ? analyst(`A tie. I'm calling that a push and moving on, ${H}.`)
          : right
            ? analyst(say("acc-r", [`Nailed it. I'd like that on the record, please.`, `Told you. The ${nick(lastPick.pick)} were the better team and they played like it.`, `I'll take my victory lap now, thank you.`]))
            : analyst(say("acc-w", [`Yeah, I whiffed on that one. The ${nick(win(result))} earned it.`, `Swing and a miss. I'll own it. The ${nick(win(result))} were better than I gave them credit for.`, `Don't look at me, ${H}. Okay, look at me. I was wrong.`])),
        !right && !tie ? reporter(say("acc-rr", [`For the record, I had the ${nick(win(result))}.`, `I'll just say I had my doubts.`])) : undefined,
      ]);
    }

    /* ---------- the storylines we've been following ---------- */
    const moving = arcsThisWeek(save, save.week).slice(0, 2);
    for (const a of moving) {
      a.aired = save.week;
      const first = a.beats[0]!;
      const now = a.beats.at(-1)!;
      const subject =
        a.kind === "race"
          ? `the ${a.title.replace(/^The race for the /, "")} race`
          : a.kind === "mvp"
            ? "the MVP race"
            : a.playerId && save.players[a.playerId]
              ? playerName(save.players[a.playerId]!)
              : a.teamId
                ? `the ${nick(a.teamId)}`
                : a.title;
      const since = a.opened === now.week ? "" : ` since Week ${a.opened}`;
      const opener =
        a.closed
          ? host(say(`arc-c-${a.id}`, [`Time to close the book on a story we've followed${since}: "${a.title}"`, `One storyline wraps up tonight. ${R}?`]))
          : host(
              say(`arc-o-${a.id}`, [
                `A story we've been following${since}. ${R}, where are we with ${subject}?`,
                `We keep coming back to ${subject}, and for good reason. ${R}?`,
                `${a.beats.length > 3 ? `Chapter ${a.beats.length}` : "The next chapter"} of "${a.title}". ${R}?`,
              ]),
            );
      const callback = a.beats.length >= 3 && first.week !== now.week ? ` When we first brought it up in Week ${first.week}, ${first.short}.` : "";
      const take =
        a.kind === "collapse"
          ? say(`arc-a-${a.id}`, [
              `In August I had them down for ${a.projW?.toFixed(1)} wins. I was wrong about this team, ${H}, and it isn't close.`,
              `I bought them in the preseason. ${a.projW?.toFixed(1)} wins, I said. That's on me.`,
              `I keep waiting for them to turn it around. I'm starting to think it isn't coming.`,
            ])
          : a.kind === "surprise"
            ? say(`arc-a-${a.id}`, [
                `I had them at ${a.projW?.toFixed(1)} wins. I'll say it on the air: I missed on them.`,
                `We wrote them off in August. They've made us look silly, and good for them.`,
                `Nobody at this desk saw it. They're for real, ${H}.`,
              ])
            : a.kind === "rookie"
              ? say(`arc-a-${a.id}`, [`He stopped playing like a rookie weeks ago.`, `Rookie of the Year is his to lose right now.`, `Every week he does something you can't coach.`])
              : a.kind === "race"
                ? say(`arc-a-${a.id}`, [`This is going to come down to the last two weeks. Bank on it.`, `Every game in that division is a playoff game now.`, `Tiebreakers, ${H}. Start learning the tiebreakers.`])
                : say(`arc-a-${a.id}`, [`It's a two-man race now, and the next head-to-head stretch decides it.`, `Voters remember November. This is where it's won.`, `I've changed my ballot, and I'm not ashamed of it.`]);
      add(`arc-${a.id}`, a.closed ? "STORY COMPLETE" : `STORYLINE · ${a.beats.length > 1 ? `WEEK ${a.opened} ON` : "NEW"}`, a.title, a.teamIds ?? (a.teamId ? [a.teamId] : []), [
        opener,
        reporter(`${now.text}${callback}`),
        a.closed ? undefined : analyst(take),
      ]);
    }
    /* ---------- history made this week ---------- */
    const history = save.news
      .filter((n) => n.year === year && n.week === save.week && n.phase === "regular" && /single-season record|all-time leader|passes \d/.test(n.headline))
      .sort((a, b) => Number(/record|all-time/.test(b.headline)) - Number(/record|all-time/.test(a.headline)))
      .filter((n, k) => k === 0 || /record|all-time/.test(n.headline))
      .slice(0, 2);
    for (const [k, n] of history.entries())
      add(`history-${n.id}`, "HISTORY MADE", n.headline, n.teamIds, [
        host(say(`hm-${k}`, [`Before we go on, a moment for the record books. ${R}?`, `${R}, something happened this week that'll outlive all of us.`, `Let's stop and appreciate one. ${R}?`])),
        reporter(`${n.headline}. ${n.body}`),
        analyst(
          /record|all-time/.test(n.headline)
            ? say(`hma-${k}`, [`Records like that are supposed to last forever. That one didn't.`, `Think about everybody who's played this game. Now he's at the top of that list.`, `You'll be telling your grandkids you saw that, ${H}.`])
            : say(`hma-${k}`, [`That's longevity and greatness at the same time. You need both.`, `A round number, sure. But you have to be very good for a very long time to get there.`, `Put that on the Hall of Fame résumé.`]),
        ),
      ]);

    // The desk owns its August division calls, every few weeks.
    const miss = show.week % 3 === 0 ? divisionPickMisses(save)[0] : undefined;
    if (miss && !moving.some((a) => a.teamId === miss.teamId))
      add(`pickmiss-${miss.teamId}`, "THE DESK / OWNING IT", `Our ${miss.key} pick`, [miss.teamId, miss.leader], [
        host(`${A}, we have to talk about your preseason pick in the ${miss.key}.`),
        analyst(
          say(`pm-${miss.teamId}`, [
            `I picked the ${nick(miss.teamId)} to win it. They're ${miss.back} games back of the ${nick(miss.leader)}. I was wrong.`,
            `The ${nick(miss.teamId)}. ${miss.back} games out. I'd like that one back, ${H}.`,
            `Look, I had the ${nick(miss.teamId)}, and the ${nick(miss.leader)} have run away from them. Credit where it's due.`,
          ]),
        ),
      ]);

    const rotating = show.week % 4;
    if (rotating === 0 && show.chases?.length)
      for (const c of show.chases.slice(0, 2))
        add(`chase-${c.playerId}`, "RECORD WATCH", c.name, [c.teamId], [
          host(say(`ch${c.playerId}`, [`Somebody's chasing history. ${R}?`, `A record watch for you. ${R}?`, `Keep an eye on this one, everybody. ${R}?`])),
          reporter(c.text),
          analyst(say(`cha${c.playerId}`, [`If he stays healthy, he gets there. No question.`, `That's a number that's stood a long time, ${H}.`, `I love seeing that. That's what this game is about.`])),
        ]);
    else if (rotating === 1 && show.injuries?.length)
      for (const i of show.injuries.filter((x) => x.fresh).slice(0, 2))
        add(`medical-${i.playerId}`, "AVAILABILITY", `${i.name}: the lineup changes`, [i.teamId], [
          host(say(`inh${i.playerId}`, [`${R}, an injury update.`, `Some tough news on the injury front. ${R}?`])),
          reporter(`${i.name}, ${i.injury}. ${i.ir ? "He's going on injured reserve." : `He's expected to miss ${plural(i.weeks, "week")}.`}`),
          analyst(say(`inj${i.playerId}`, [`That's a big loss for the ${nick(i.teamId)}. Somebody has to step up.`, `You can't replace a guy like that. You just have to survive without him.`, `Watch how they adjust the game plan. That's where you find out about a coaching staff.`])),
        ]);
    else if (rotating === 2 && show.power?.length) {
      const p = show.power[0]!;
      add("contender", "CONTENDER CHECK", `${name(p.teamId)} lead the board`, [p.teamId], [
        host(`Our power rankings, and the ${nick(p.teamId)} sit on top at ${p.record}. ${A}?`),
        analyst(`${cap(p.blurb)}. ${p.prev ? (p.prev === p.rank ? "They hold the spot, and I don't see anyone taking it soon." : `Up from number ${p.prev} last week.`) : "They've earned it."}`),
        reporter(say("pr-r", [`Just so everybody knows, that's our ranking, not a playoff seed.`, `And around the league, nobody wants to see them in January.`])),
      ]);
    } else if (show.rumors?.length) {
      const r = show.rumors[0]!;
      add("market", "LEAGUE NOTEBOOK", "What the front offices are watching", r.teamIds, [
        host(`${R}, the phones have been busy.`),
        reporter(r.text),
        analyst(say("rum-a", [`I'll believe it when I see it. A lot of this stuff never happens.`, `If that deal gets done, it changes things, ${H}.`, `Somebody's trying to send a message with that one.`])),
      ]);
    }
  }

  /* ---------- awards ---------- */
  if (finale || edition === "awards")
    for (const [k, a] of (show.awards ?? []).entries())
      add(`award-${a.label}`, finale ? "STUDIO AWARDS BALLOT" : "OFFICIAL SEASON HONORS", a.label, [a.honoree.teamId], [
        host(finale ? say(`aw${k}`, [`Our pick for ${a.label}: ${a.honoree.name}, ${name(a.honoree.teamId)}.`, `${a.label}. The desk went with ${a.honoree.name}.`]) : say(`aw${k}`, [`The ${a.label} goes to ${a.honoree.name}.`, `${a.label}: ${a.honoree.name}, ${name(a.honoree.teamId)}.`])),
        analyst(`${cap(spokenStats(a.honoree.line))}. ${say(`awa${k}`, [`Easy call, ${H}.`, `Not even close, in my opinion.`, `I had a couple of guys in mind, but he earned it.`, `That's a season people are going to remember.`, `Well deserved.`, `Nobody was better at his job this year.`, `I'd have voted the same way.`, `He made it an easy ballot.`, `That's the one I was pulling for, ${H}.`, `Good for him. He's put in the work.`, `You could see this one coming in October.`])}`),
      ]);

  /* ---------- what's next ---------- */
  for (const [k, g] of upcoming.slice(0, edition === "weekly" ? 1 : 8).entries()) {
    const home = g.homeId as TeamId;
    const away = g.awayId as TeamId;
    const neutral = g.phase === "superBowl";
    const p = show.previews?.find((x) => x.homeId === home && x.awayId === away);
    const teamCase = (tid: TeamId) => {
      const t = save.teams[tid];
      const gp = t.wins + t.losses + t.ties;
      const qb = depthAt(save, tid, "QB").find((x) => x.injuredWeeks <= 0 && !x.onIR);
      const st = qb?.stats[save.year];
      return `The ${nick(tid)} are ${record(save, tid)}${gp ? `, scoring ${(t.pf / gp).toFixed(1)} a game and giving up ${(t.pa / gp).toFixed(1)}` : ""}. ${
        qb ? `It runs through ${playerName(qb)}${st && st.passAtt ? `, who has ${st.passYds.toLocaleString("en-US")} yards and ${plural(st.passTd, "touchdown")} this year` : ""}.` : "They don't have a healthy quarterback, and that's a problem."
      }`;
    };
    const site = neutral ? superBowlSite(save.year) : undefined;
    const pick = p?.pick;
    const other = pick ? (pick === home ? away : home) : undefined;
    const disagree = !!pick && chance(`dis${k}`, 3);
    add(`preview-${g.id}`, neutral ? "SUPER BOWL / THE MATCHUP" : "NEXT ON THE SCHEDULE", `${name(away)} vs. ${name(home)}`, [away, home], [
      host(
        `${neutral ? `Super Bowl ${roman(superBowlNumber(year))}, from ${theSite(site!.site)} in ${site!.city}. ${say("neutral", ["Neutral field, so neither side gets a home crowd.", "Neutral field, two fan bases, one trophy.", "Neutral field. No home-field edge for anybody."])}` : say(`pv${k}`, [`Looking ahead: ${name(away)} at ${name(home)}.`, `Next up, the ${nick(away)} visit the ${nick(home)}.`, `Circle this one: ${name(away)} at ${name(home)}.`, `Here's the one we're watching next: ${name(away)} at ${name(home)}.`])} ${[p?.series, p?.last].filter(Boolean).map((x) => `${x!.replace(/\.$/, "")}.`).join(" ")} ${say(`pvq${k}`, [`${A}, break it down.`, `${A}, how do you see it?`, `What's the matchup, ${A}?`, `${A}, set it up for us.`])}`,
      ),
      analyst(`${teamCase(away)} ${teamCase(home)}${pick ? ` ${say(`pk${k}`, [`I'm taking the ${nick(pick)}.`, `Give me the ${nick(pick)}.`, `I like the ${nick(pick)} in this one.`, `My pick? The ${nick(pick)}.`])} ${p?.note ?? ""}` : ""}`),
      pick
        ? disagree
          ? reporter(`I'll go the other way, ${A}. ${other === home ? `The ${nick(other)} at home, and` : `The ${nick(other!)}, and`} I think they find a way.`)
          : reporter(say(`pva${k}`, [`I'm with ${A} on this one.`, `Same here. The ${nick(pick)}.`, `Hard to argue with that.`]))
        : undefined,
    ]);

    if (neutral) {
      for (const tid of [away, home]) {
        const path = save.playoffGames.filter((x) => x.played && involved(x, tid));
        const hurt = Object.values(save.players)
          .filter((x) => x.teamId === tid && (x.injuredWeeks > 0 || x.onIR))
          .sort((a, b) => b.ovr - a.ovr)
          .slice(0, 3);
        add(`road-${tid}`, `${conferenceOf(save.year, tid)} CHAMPION`, `How ${name(tid)} got here`, [tid], [
          host(`How the ${nick(tid)} got here: ${path.map((x) => `${x.round}, ${score(x)}${x.ot ? " in overtime" : ""}`).join(". ")}.`),
          reporter(hurt.length ? `On the injury front, ${hurt.map((x) => `${playerName(x)} is dealing with ${x.injuryName === "shaken up" || !x.injuryName ? "a minor injury" : `${/^[aeiou]/i.test(x.injuryName) ? "an" : "a"} ${x.injuryName === "ribs" ? "rib" : x.injuryName} injury`}`).join(", and ")}.` : `And the good news for the ${nick(tid)}: everybody's healthy.`),
        ]);
      }
      const ah = save.teams[away];
      const hh = save.teams[home];
      const ag = ah.wins + ah.losses + ah.ties || 1;
      const hg = hh.wins + hh.losses + hh.ties || 1;
      add("sb-verdict", "THE DESK / TWO PATHS TO VICTORY", "Where the championship can turn", [away, home], [
        host(`${A}, where does this game turn?`),
        analyst(`The ${nick(away)} score ${(ah.pf / ag).toFixed(1)} a game, and the ${nick(home)} give up ${(hh.pa / hg).toFixed(1)}. Flip it around and it's ${(hh.pf / hg).toFixed(1)} against ${(ah.pa / ag).toFixed(1)}. Whoever controls the line of scrimmage controls this game, ${H}.`),
        p ? reporter(`And our line has the ${nick(p.pick)} favored: ${p.line}.`) : undefined,
        host(`We'll find out soon enough.`),
      ]);
    }
  }

  /* ---------- the champions ---------- */
  if (edition === "superBowl" && lead) {
    const champion = win(lead);
    const runner = lose(lead);
    const site = superBowlSite(save.year);
    const mvp = lead.mvpPlayerId ? save.players[lead.mvpPlayerId] : undefined;
    const mvpBox = mvp && [...(lead.boxHome ?? []), ...(lead.boxAway ?? [])].find((b) => b.playerId === mvp.id);
    const mvpLine = mvpBox && mvp ? spokenLine(mvpBox, mvp.pos) : undefined;
    add("champions", "THE TROPHY PRESENTATION", `${name(champion)} own ${year}`, [champion], [
      host(
        say("champ", [
          `From ${theSite(site.site)} in ${site.city}, the ${name(champion)} are your Super Bowl ${roman(superBowlNumber(year))} champions.`,
          `Super Bowl ${roman(superBowlNumber(year))} belongs to the ${name(champion)}. Here comes the trophy.`,
          `The ${name(champion)} are champions of professional football, and the celebration in ${site.city} is just getting started.`,
        ]),
      ),
      mvp
        ? analyst(`${say("mvpi", [`And the MVP is ${playerName(mvp)}`, `Your Super Bowl MVP: ${playerName(mvp)}`, `The MVP award goes to ${playerName(mvp)}`])}${mvpLine ? `: ${mvpLine}` : ""}. ${say("mvp", [`He was the best player on the biggest stage, ${H}.`, `When it mattered most, he was there.`, `That's a career-defining night.`, `He'll be telling his grandkids about this one.`, `You dream about a game like that as a kid.`])}`)
        : analyst(`What a performance, ${H}. They earned every bit of it.`),
    ]);
    const path = save.playoffGames.filter((x) => x.played && involved(x, champion));
    const old = save.history.superBowls.filter((b) => b.year < save.year && (b.homeScore > b.awayScore ? b.homeId : b.awayId) === champion);
    add("legacy", "THE YEAR IN REVIEW", "The championship road", [champion], [
      host(`The ${nick(champion)} went ${record(save, champion)} in the regular season. ${path.map((x) => `${x.round}, ${score(x)}`).join(". ")}. And tonight, ${score(lead)}.`),
      reporter(
        old.length
          ? say("titles", [`That's ${plural(old.length + 1, "Super Bowl title")} for this franchise in our books now.`, `Title number ${num(old.length + 1)} for this franchise.`, `They've done this before. That's ${plural(old.length + 1, "championship")} now.`])
          : say("titles", [`It's the first Super Bowl title for this franchise in our books.`, `A first championship for this franchise. They'll remember this one forever.`, `Never done it before. They've done it now.`]),
      ),
      analyst(say("runner", [`And credit to the ${nick(runner)}. A ${record(save, runner)} season and they made it to the last game. Nothing to hang their heads about.`, `Don't forget the ${nick(runner)}, ${H}. ${record(save, runner)}, and one game from a title.`, `The ${nick(runner)} will be back. That's a good football team.`])),
    ]);
    const best = season.slice().sort((a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore))[0];
    if (best)
      add("season-moment", "SEASON REWIND", "The highest-scoring Sunday", [best.awayId as TeamId, best.homeId as TeamId], [
        host(`One more look back. Week ${best.week}: ${score(best)}. ${best.homeScore + best.awayScore} points, the highest-scoring game of the year.`),
        best.highlights?.[0] ? analyst(`${say("rew", [`I still think about this one.`, `What a game that was.`, `I remember exactly where I was for this one, ${H}.`, `That one stuck with me.`])} ${best.highlights[0]}`) : undefined,
      ]);
    for (const b of show.leaders?.slice(0, 3) ?? []) {
      const r = b.rows[0];
      if (r) add(`leader-${b.label}`, "THE SEASON'S STANDARD", b.label, [r.teamId], [
          host(
            say(`ldh${b.label}`, [
              `${spokenStats(b.label)}: ${r.name}, ${r.value.toLocaleString("en-US")}.`,
              `The league leader in ${spokenStats(b.label).toLowerCase()}: ${r.name}, with ${r.value.toLocaleString("en-US")}.`,
              `Nobody had more ${spokenStats(b.label).toLowerCase()} than ${r.name}. ${r.value.toLocaleString("en-US")}.`,
            ]),
          ),
          analyst(say(`ld${b.label}`, [`Nobody did it better this year.`, `That's an outstanding season, ${H}.`, `Remember that number.`, `That's a career year.`, `He was the best in the league at it, and it wasn't close.`, `Put that one on the resume.`])),
        ]);
    }
  }

  /* ---------- the week's Top 5 ---------- */
  const reel = show.reel ?? [];
  if (reel.length >= 3 && edition !== "awards" && edition !== "superBowl") {
    const ord = ["", "Number one", "Number two", "Number three", "Number four", "Number five"];
    const lead5 = reel.slice().reverse();
    const gameLine = (m: (typeof reel)[number]) => {
      const w = m.homeScore >= m.awayScore ? m.homeId : m.awayId;
      const l = w === m.homeId ? m.awayId : m.homeId;
      return `${nick(w)} ${Math.max(m.homeScore, m.awayScore)}, ${nick(l)} ${Math.min(m.homeScore, m.awayScore)}`;
    };
    add("top5", `THE TOP ${reel.length}`, edition === "playoffs" || edition === "championship" ? "The plays of the postseason weekend" : "The plays of the week", reel.slice(0, 2).flatMap((m) => (m.teamId ? [m.teamId] : [])), [
      host(say("t5-open", [`Time for the countdown. The ${reel.length} plays everybody will be talking about tomorrow.`, `Let's count them down: the top ${reel.length} plays of the weekend.`, `The highlight reel is cut. Here are the top ${reel.length}.`])),
      ...lead5.map((m, i) => {
        const who = m.teamId ? `the ${nick(m.teamId)}` : `${nick(m.awayId)} and ${nick(m.homeId)}`;
        const kind = m.kind === "GAME-WINNER" ? "the game-winner" : m.kind === "TAKEAWAY" ? "a takeaway" : m.kind === "SPECIAL TEAMS" ? "special teams" : m.kind === "LONG FIELD GOAL" ? "a long field goal" : m.kind === "TOUCHDOWN" ? "a touchdown" : "a big play";
        const text = `${ord[m.rank]}: ${kind} for ${who}. ${m.text} ${gameLine(m)}.`;
        return i % 2 === 0 ? host(text) : analyst(text);
      }),
      analyst(say("t5-close", [`What a weekend. That number one is going to be on a lot of replays.`, `You could argue the order all night, but you can't argue with that list.`, `I'd have put that top one on the cover of the program.`])),
    ]);
  }

  /* ---------- good night ---------- */
  const sign = say("signoff", [
    `For ${A} and ${R}, I'm ${crew.HOST.name}. Good night, everybody.`,
    `That's our show. Thanks to ${A} and ${R}. We'll see you next time.`,
    `On behalf of everyone here, good night.`,
    `${A}, ${R}, thank you. And thank you all for watching. Good night.`,
    `We'll be right here next week. For all of us, good night.`,
    `That'll do it for us. ${A}, ${R}, great stuff tonight. Good night, everybody.`,
    `From all of us on the desk, thanks for spending your night with us.`,
  ]);
  add("signoff", "UNTIL NEXT TIME", edition === "superBowl" ? "One season ends. A new chase begins." : "The next chapter", [], [
    host(
      `${
        edition === "superBowl"
          ? say("so-s", [`The ${name(win(lead!))} are champions of ${year}. Next come the awards, the Pro Bowl, retirements, and the work of building next year's roster.`, `Enjoy it, ${nick(win(lead!))} fans. For everybody else, the offseason starts tonight.`, `That's the ${year} season, and the ${name(win(lead!))} own it. The chase for next year starts now.`])
          : edition === "championship"
            ? say("so-c", [`The matchup is set. One game for the trophy.`, `Two teams, one trophy. We'll see you on the other side of it.`, `That's the setup. Enjoy the big game.`])
            : finale
              ? say("so-f", [`The regular season is closed. We'll be back after the first round.`, `The bracket is set. We'll see you after the first round.`, `Enjoy the playoffs. We'll be back after the first weekend.`])
              : upcoming.length
                ? `${cap(plural(upcoming.length, "game"))} on the next slate, and we'll check our picks after.`
                : ""
      } ${sign}`,
    ),
  ]);

  return {
    id,
    edition,
    cast: {
      HOST: { name: crew.HOST.name, role: crew.HOST.role, gender: crew.HOST.gender },
      ANALYST: { name: crew.ANALYST.name, role: crew.ANALYST.role, gender: crew.ANALYST.gender },
      REPORTER: { name: crew.REPORTER.name, role: crew.REPORTER.role, gender: crew.REPORTER.gender },
    },
    headline,
    subtitle,
    chapters,
    // Keep headline entries for old-save compatibility and add stable subjects so
    // changing a record or streak headline does not replay the same story next week.
    focusIds: (show.stories ?? []).flatMap((s) => [s.headline, storyFocusId(s)]),
  };
}
