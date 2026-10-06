/**
 * The moments that make a career a story: crossing a round-number career milestone, a historic
 * season, a star on a losing club asking out, a veteran in the last year of his deal playing for
 * the next one. Nothing here draws randomness; everything reads the stats already on the books.
 */
import type { BoxPlayer, DynastySave, GameResult, Player, SeasonStats, TeamId } from "./types.ts";
import { addNews } from "./news.ts";
import { careerTotals } from "./leaders.ts";
import { livingPlayers, playerName } from "./players.ts";
import { displayName, gamesInSeason } from "./teams.ts";
import { winPct } from "./standings.ts";
import { executeTrade, tradeWindowOpen } from "./gm.ts";
import { rosterOf } from "./players.ts";
import { rand } from "./rng.ts";

type Key = "passYds" | "passTd" | "rushYds" | "rushTd" | "rec" | "recYds" | "recTd" | "sacks" | "ints";

const CAREER: { key: Key; label: string; marks: number[] }[] = [
  { key: "passYds", label: "career passing yards", marks: [30000, 40000, 50000, 60000, 70000, 80000] },
  { key: "passTd", label: "career touchdown passes", marks: [200, 300, 400, 500, 600] },
  { key: "rushYds", label: "career rushing yards", marks: [10000, 12000, 15000, 18000] },
  { key: "rushTd", label: "career rushing touchdowns", marks: [100, 125, 150] },
  { key: "rec", label: "career catches", marks: [1000, 1250, 1500] },
  { key: "recYds", label: "career receiving yards", marks: [10000, 12000, 15000, 20000] },
  { key: "recTd", label: "career touchdown catches", marks: [100, 125, 150] },
  { key: "sacks", label: "career sacks", marks: [100, 125, 150, 175, 200] },
  { key: "ints", label: "career interceptions", marks: [50, 60, 70, 80] },
];

/** Season marks that make a year historic in its era. */
function seasonMarks(year: number): { key: Key; label: string; mark: number }[] {
  const long = gamesInSeason(year) >= 16;
  return [
    { key: "passYds", label: "passing yards", mark: year >= 2005 ? 5000 : year >= 1978 ? 4500 : 4000 },
    { key: "passTd", label: "touchdown passes", mark: long ? 40 : 35 },
    { key: "rushYds", label: "rushing yards", mark: long ? 2000 : 1700 },
    { key: "recYds", label: "receiving yards", mark: long ? 1700 : 1400 },
    { key: "rec", label: "catches", mark: long ? 120 : 90 },
    { key: "sacks", label: "sacks", mark: long ? 20 : 18 },
  ];
}

const fmt = (n: number) => n.toLocaleString("en-US");

function clubOf(p: Player): TeamId | undefined {
  return p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? undefined : p.teamId;
}

/**
 * After a slate: who crossed a milestone in this week's game. The game's own box line says
 * how much he added, so "before" is the total less this week.
 */
export function weeklyMoments(save: DynastySave, games: GameResult[]): void {
  const year = save.year;
  const lines = new Map<string, BoxPlayer>();
  for (const g of games) for (const b of [...(g.boxHome ?? []), ...(g.boxAway ?? [])]) lines.set(b.playerId, b);
  for (const [id, b] of lines) {
    const p = save.players[id];
    if (!p) continue;
    const box = b as unknown as Record<string, number | undefined>;
    const club = clubOf(p);
    const career = careerTotals(p) as unknown as Record<string, number>;
    for (const c of CAREER) {
      const add = box[c.key] ?? 0;
      if (add <= 0) continue;
      const now = career[c.key] ?? 0;
      const before = now - add;
      const mark = c.marks.find((m) => before < m && now >= m);
      if (!mark) continue;
      addNews(save, {
        kind: "headline",
        headline: `${playerName(p)} passes ${fmt(mark)} ${c.label}`,
        body: `${fmt(now)} and counting${club ? ` for the ${displayName(year, club)}` : ""}.`,
        teamIds: club ? [club] : [],
        playerIds: [p.id],
      });
    }
    const season = p.stats[year] as unknown as Record<string, number> | undefined;
    if (!season) continue;
    for (const m of seasonMarks(year)) {
      const add = box[m.key] ?? 0;
      if (add <= 0) continue;
      const now = season[m.key] ?? 0;
      if (now - add < m.mark && now >= m.mark) {
        addNews(save, {
          kind: "headline",
          headline: `${playerName(p)} reaches ${fmt(m.mark)} ${m.label}`,
          body: (() => {
            const left = Math.max(0, gamesInSeason(year) - (season.gp ?? 0));
            return left ? `${fmt(now)} with ${left} game${left === 1 ? "" : "s"} left in the season.` : `${fmt(now)}, reached in the season finale.`;
          })(),
          teamIds: club ? [club] : [],
          playerIds: [p.id],
        });
      }
    }
  }
}

/**
 * A star on a club going nowhere asks to be moved, once a season, around the midpoint: he's in
 * his prime, his club is losing again after a losing year, and he isn't on his rookie deal.
 */
export function tradeDemands(save: DynastySave): void {
  const year = save.year;
  // A public request is rare: a handful a season at most, one per club.
  const asked = livingPlayers(save).filter((p) => p.tradeRequest === year);
  if (asked.length >= 3) return;
  const clubsAsked = new Set(asked.map((p) => clubOf(p)));
  const candidates = livingPlayers(save)
    .filter((p) => {
      const club = clubOf(p);
      if (!club || p.tradeRequest === year || clubsAsked.has(club)) return false;
      if (p.ovr < 88 || p.age < 27 || p.age > 32 || (p.draftYear ?? 0) > year - 4) return false;
      const t = save.teams[club];
      if (!t || t.wins + t.losses + t.ties < 6 || winPct(t) > 0.3) return false;
      const last = save.history.seasons.find((c) => c.teamId === club && c.year === year - 1);
      return !!last && last.wins < last.losses;
    })
    .sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
  const p = candidates[0];
  if (p) {
    const club = clubOf(p)!;
    const t = save.teams[club]!;
    const last = save.history.seasons.find((c) => c.teamId === club && c.year === year - 1)!;
    p.tradeRequest = year;
    addNews(save, {
      kind: "transaction",
      headline: `${playerName(p)} asks the ${displayName(year, club)} for a trade`,
      body: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""} and sinking after ${last.wins}-${last.losses} last year. One of the best ${p.pos}s in the league wants a contender.`,
      teamIds: [club],
      playerIds: [p.id],
    });
  }
}

/** Veterans in the last year of their deal having the year of their lives. */
export function contractYearBreakouts(save: DynastySave): { player: Player; line: string }[] {
  const year = save.year;
  const out: { player: Player; line: string; jump: number }[] = [];
  const score = (s: SeasonStats | undefined, gp: number) =>
    s && gp ? (s.passYds / 25 + s.passTd * 4 + (s.rushYds + s.recYds) / 10 + (s.rushTd + s.recTd) * 6 + s.sacks * 4 + s.ints * 4) / gp : 0;
  for (const p of livingPlayers(save)) {
    if (!clubOf(p) || p.contractYears > 1 || p.yearsPro < 3) continue;
    const now = p.stats[year];
    const prev = p.stats[year - 1];
    if (!now || now.gp < 4 || !prev || prev.gp < 6) continue;
    const a = score(now, now.gp);
    const b = score(prev, prev.gp);
    if (a < 8 || a < b * 1.35) continue;
    out.push({ player: p, line: `${p.pos}, ${displayName(year, clubOf(p)!)}: up from last year with a new deal on the line.`, jump: a / Math.max(1, b) });
  }
  return out.sort((x, y) => y.jump - x.jump).slice(0, 3);
}

/**
 * Clubs act on a request now and then: a contender with a starter at the same spot sends him
 * back for the star. The owner's own stars stay put unless he deals them himself.
 */
export function honorTradeRequests(save: DynastySave): void {
  const year = save.year;
  if (!tradeWindowOpen(save)) return;
  for (const p of livingPlayers(save)) {
    const from = clubOf(p);
    if (!from || p.tradeRequest !== year) continue;
    if (!save.cpuOnly && from === save.userTeamId) continue;
    if (rand(save) > 0.3) continue;
    const buyers = Object.values(save.teams)
      .filter((t) => t.active && t.id !== from && (save.cpuOnly || t.id !== save.userTeamId) && t.wins + t.losses + t.ties > 0)
      .sort((a, b) => winPct(b) - winPct(a))
      .slice(0, 6);
    for (const b of buyers) {
      const back = rosterOf(save, b.id)
        .filter((x) => x.pos === p.pos && x.ovr < p.ovr && x.ovr >= p.ovr - 15 && !x.tradeRequest)
        .sort((x, y) => y.ovr - x.ovr)[0];
      if (!back) continue;
      // The asking club sends the star and takes the buyer's starter back.
      const r = executeTrade(save, from, b.id, [{ playerId: p.id }], [{ playerId: back.id }], { force: true });
      if (r.ok) break;
    }
  }
}
