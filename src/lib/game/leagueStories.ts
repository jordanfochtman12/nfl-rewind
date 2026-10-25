/**
 * The league's running stories, for watch mode: the playoff picture with clinch and
 * elimination marks, the award ladders, record chases, and the through-lines a studio would
 * carry week to week (dynasties, droughts, streaks, coaches on the hot seat, and how this
 * timeline compares with the real one). Everything here is read-only and draws no randomness.
 */
import type { DynastySave, NewsItem, Player, TeamId, TeamState } from "./types.ts";
import { activeTeamIds, conferenceOf, displayName, divisionKey, gamesInSeason, type Conference } from "./teams.ts";
import { compareTeams } from "./standings.ts";
import { playoffTeamCount } from "./era.ts";
import { awardBallots, awardExists } from "./events.ts";
import { PRE_1966_MARKS, seasonRecordBook } from "./records.ts";
import { playerName } from "./players.ts";
import { realPostseason, realRecords } from "./timeline.ts";
import { contractYearBreakouts } from "./careerMoments.ts";
import { risingRivalries } from "./h2h.ts";
import { maxWeek } from "./schedule.ts";
import { posLabel } from "./posLabel.ts";

const rec = (t: { wins: number; losses: number; ties: number }) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`;
/** Standings points: two for a win, one for a tie, so ties never need fractions. */
const pts = (t: TeamState) => t.wins * 2 + t.ties;

function remainingGames(save: DynastySave): Map<TeamId, number> {
  const left = new Map<TeamId, number>();
  for (const g of save.schedule) {
    if (g.year !== save.year || g.phase !== "regular" || g.played) continue;
    left.set(g.homeId as TeamId, (left.get(g.homeId as TeamId) ?? 0) + 1);
    left.set(g.awayId as TeamId, (left.get(g.awayId as TeamId) ?? 0) + 1);
  }
  return left;
}

/* ---------------- playoff picture ---------------- */

export type RaceMark = "division" | "playoffs" | "out" | "in" | "hunt";

export interface RaceRow {
  teamId: TeamId;
  record: string;
  seed?: number;
  mark: RaceMark;
  divisionLeader: boolean;
  left: number;
}

export interface RaceGroup {
  conf: string;
  spots: number;
  rows: RaceRow[];
}

/** How many wild cards a conference gets in a given year (division winners take the rest). */
function wildCards(year: number, conf: Conference, divisions: number): number {
  if (year < 1969) return 0;
  if (year === 1969) return conf === "AFL" ? 2 : 0;
  return Math.max(0, playoffTeamCount(year).perConf - divisions);
}

/**
 * The postseason race, per conference. Clinch and elimination are proven from records alone
 * (ignoring tiebreakers, so a mark never has to be taken back): a club has clinched when not
 * enough rivals can still catch it, and is out when it can neither win its division nor reach
 * a wild card.
 */
export function playoffPicture(save: DynastySave): RaceGroup[] {
  const year = save.year;
  const left = remainingGames(save);
  const max = (t: TeamState) => pts(t) + 2 * (left.get(t.id) ?? 0);
  const confs = new Map<Conference, TeamState[]>();
  for (const id of activeTeamIds(year)) {
    const c = conferenceOf(year, id);
    const t = save.teams[id];
    if (t) confs.set(c, [...(confs.get(c) ?? []), t]);
  }
  const out: RaceGroup[] = [];
  for (const [conf, teams] of confs) {
    teams.sort(compareTeams);
    const divs = new Map<string, TeamState[]>();
    for (const t of teams) {
      const k = divisionKey(year, t.id);
      divs.set(k, [...(divs.get(k) ?? []), t]);
    }
    const wc = wildCards(year, conf, divs.size);
    const leaders = new Set([...divs.values()].map((d) => d[0]!.id));
    const others = teams.filter((t) => !leaders.has(t.id));
    const seeded = [...teams.filter((t) => leaders.has(t.id)), ...others.slice(0, wc)];
    const seedOf = new Map(seeded.map((t, i) => [t.id, i + 1]));
    const rows: RaceRow[] = teams.map((t) => {
      const div = divs.get(divisionKey(year, t.id))!;
      const rivals = div.filter((r) => r.id !== t.id);
      const confRivals = teams.filter((r) => r.id !== t.id);
      // Division: nobody in it can reach this club's points.
      const clinchDiv = rivals.every((r) => max(r) < pts(t));
      const outDiv = rivals.some((r) => pts(r) > max(t));
      // Wild card: fewer rivals than wild cards can still finish level or ahead.
      const catchers = confRivals.filter((r) => max(r) >= pts(t)).length;
      const clinchWc = wc > 0 && catchers < wc;
      // Out of the wild card once enough rivals are already beyond reach.
      const ahead = confRivals.filter((r) => pts(r) > max(t)).length;
      // (Up to one division winner per division can be among them and not take a wild card.)
      const outWc = wc === 0 || ahead >= wc + divs.size;
      const done = left.size === 0;
      const mark: RaceMark = done
        ? leaders.has(t.id) ? "division" : seedOf.has(t.id) ? "playoffs" : "out"
        : clinchDiv
        ? "division"
        : clinchWc
          ? "playoffs"
          : outDiv && outWc
            ? "out"
            : seedOf.has(t.id)
              ? "in"
              : "hunt";
      return { teamId: t.id, record: rec(t), seed: seedOf.get(t.id), mark, divisionLeader: leaders.has(t.id), left: left.get(t.id) ?? 0 };
    });
    rows.sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99) || teams.findIndex((t) => t.id === a.teamId) - teams.findIndex((t) => t.id === b.teamId));
    out.push({ conf, spots: seeded.length, rows });
  }
  return out;
}

/* ---------------- award ladders ---------------- */

export interface LadderRow {
  id: string;
  name: string;
  line: string;
  teamId?: TeamId;
}

export interface AwardLadder {
  key: string;
  label: string;
  rows: LadderRow[];
}

function statLine(p: Player, year: number): string {
  const s = p.stats[year];
  if (!s) return "";
  if (p.pos === "QB") return `${s.passYds.toLocaleString()} yds, ${s.passTd} TD, ${s.passInt} INT`;
  if (p.pos === "RB" || p.pos === "FB") return `${(s.rushYds + s.recYds).toLocaleString()} scrimmage yds, ${s.rushTd + s.recTd} TD`;
  if (p.pos === "WR" || p.pos === "TE") return `${s.rec} rec, ${s.recYds.toLocaleString()} yds, ${s.recTd} TD`;
  const bits = [s.sacks ? `${s.sacks} sacks` : "", s.ints ? `${s.ints} INT` : "", s.ff ? `${s.ff} FF` : "", `${s.tackles} tkl`];
  return bits.filter(Boolean).join(", ");
}

const clubOf = (p: Player, year: number): TeamId | undefined => {
  const id: string = p.stats[year]?.teamId ?? p.teamId;
  return id === "fa" || id === "retired" || id === "hof" ? undefined : (id as TeamId);
};

/** The weekly MVP / Player of the Year / Rookie ladders, top five each, as the ballot sees it today. */
export function awardRaces(save: DynastySave, top = 5): AwardLadder[] {
  const year = save.year;
  const b = awardBallots(save, { live: true, top });
  const row = (p: Player): LadderRow => {
    const team = clubOf(p, year);
    return { id: p.id, name: playerName(p), line: `${posLabel(p)}${team ? `, ${displayName(year, team)}` : ""} · ${statLine(p, year)}`, teamId: team };
  };
  const out: AwardLadder[] = [{ key: "mvp", label: "MVP", rows: b.mvp.map(row) }];
  if (awardExists(year, "offPoy")) out.push({ key: "offPoy", label: "Offensive Player of the Year", rows: b.offPoy.map(row) });
  if (awardExists(year, "defPoy")) out.push({ key: "defPoy", label: "Defensive Player of the Year", rows: b.defPoy.map(row) });
  out.push({ key: "oroy", label: awardExists(year, "oroy") ? "Offensive Rookie of the Year" : "Rookie of the Year", rows: b.oroy.map(row) });
  if (awardExists(year, "droy")) out.push({ key: "droy", label: "Defensive Rookie of the Year", rows: b.droy.map(row) });
  if (awardExists(year, "coy"))
    out.push({
      key: "coy",
      label: "Coach of the Year",
      rows: b.coy.map((c) => ({ id: c.coachId, name: save.coaches[c.coachId]?.name ?? "—", line: `${displayName(year, c.teamId)} · ${rec(save.teams[c.teamId]!)}`, teamId: c.teamId })),
    });
  return out.filter((l) => l.rows.length);
}

/* ---------------- record chases ---------------- */

const CHASE_UNIT: Record<string, string> = {
  passYds: "passing yards",
  passTd: "touchdown passes",
  rushYds: "rushing yards",
  rushTd: "rushing touchdowns",
  rec: "catches",
  recYds: "receiving yards",
  recTd: "receiving touchdowns",
  sacks: "sacks",
  ints: "interceptions",
};

export interface RecordChase {
  cat: string;
  playerId: string;
  name: string;
  teamId?: TeamId;
  value: number;
  record: number;
  holder: string;
  holderYear: number;
  pace: number;
  left: number;
  text: string;
  broken: boolean;
}

/** Leaders on pace for (or already past) a single-season record. */
export function recordChases(save: DynastySave): RecordChase[] {
  const year = save.year;
  const total = gamesInSeason(year);
  const left = remainingGames(save);
  const book = seasonRecordBook(save, 12);
  const out: RecordChase[] = [];
  for (const cat of book) {
    const prior = cat.rows.find((r) => r.year < year);
    const base = PRE_1966_MARKS[cat.id];
    const mark =
      prior && (!base || prior.value >= base.value)
        ? { value: prior.value, holder: prior.name, year: prior.year }
        : base ?? (prior ? { value: prior.value, holder: prior.name, year: prior.year } : undefined);
    if (!mark) continue;
    const lead = cat.rows.find((r) => r.year === year);
    const p = lead && save.players[lead.playerId];
    if (!lead || !p) continue;
    const s = p.stats[year];
    const gp = Math.max(1, s?.gp ?? 1);
    const team = clubOf(p, year);
    const remaining = team ? left.get(team) ?? 0 : 0;
    const pace = Math.round((lead.value / gp) * Math.min(total, gp + remaining));
    const broken = lead.value > mark.value;
    // A month in, everybody is on pace for something; wait until the chase means it.
    if (!broken && (gp < Math.max(4, Math.round(total * 0.4)) || pace < mark.value * 0.97 || remaining === 0)) continue;
    const unit = CHASE_UNIT[cat.id] ?? cat.label.toLowerCase();
    const need = mark.value - lead.value + 1;
    const text = broken
      ? `${lead.name} owns the record now: ${lead.value} ${unit}, past ${mark.holder}'s ${mark.value} (${mark.year}).`
      : `${lead.name} is ${need} ${unit} from the record with ${remaining} game${remaining === 1 ? "" : "s"} left, on pace for ${pace}. ${mark.holder} set it with ${mark.value} in ${mark.year}.`;
    out.push({ cat: cat.id, playerId: p.id, name: lead.name, teamId: team, value: lead.value, record: mark.value, holder: mark.holder, holderYear: mark.year, pace, left: remaining, text, broken });
  }
  return out.sort((a, b) => Number(b.broken) - Number(a.broken) || b.pace / b.record - a.pace / a.record).slice(0, 4);
}

/* ---------------- storylines ---------------- */

export interface LeagueStory {
  kind: "dynasty" | "drought" | "unbeaten" | "winless" | "streak" | "hotSeat" | "history" | "record" | "contract" | "tradeRequest" | "rivalry";
  title: string;
  body: string;
  teamIds: TeamId[];
  weight: number;
}

/** Champions by year: the Super Bowl winner, or the league champion before there was one. */
function championsByYear(save: DynastySave): Map<number, TeamId> {
  const out = new Map<number, TeamId>();
  for (const c of save.history.championships ?? []) if (!out.has(c.year)) out.set(c.year, c.teamId);
  for (const b of save.history.superBowls ?? []) out.set(b.year, b.homeScore >= b.awayScore ? b.homeId : b.awayId);
  return out;
}

const made = (result: string) => !/^Missed/.test(result);

export function leagueStorylines(save: DynastySave, max = 8): LeagueStory[] {
  const year = save.year;
  const ids = activeTeamIds(year);
  const name = (id: TeamId) => displayName(year, id);
  const played = Math.max(0, ...ids.map((id) => { const t = save.teams[id]; return t ? t.wins + t.losses + t.ties : 0; }));
  const total = gamesInSeason(year);
  const out: LeagueStory[] = [];

  // Dynasties: back-to-back (or more) champions, and the most titles in the last decade.
  const champs = championsByYear(save);
  const last = champs.get(year - 1);
  if (last) {
    let run = 0;
    for (let y = year - 1; champs.get(y) === last; y--) run++;
    if (run >= 2) out.push({ kind: "dynasty", title: `${name(last)} chase ${run + 1} straight`, body: `Champions the last ${run} seasons. Nobody has stopped them yet.`, teamIds: [last], weight: 9 + run });
    else out.push({ kind: "dynasty", title: `${name(last)} defend the title`, body: `Last year's champions are ${rec(save.teams[last]!)} so far.`, teamIds: [last], weight: played ? 4 : 6 });
  }
  const decade = new Map<TeamId, number>();
  for (const [y, id] of champs) if (y >= year - 10 && y < year) decade.set(id, (decade.get(id) ?? 0) + 1);
  const [dyn, titles] = [...decade].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (dyn && titles && titles >= 3 && dyn !== last)
    out.push({ kind: "dynasty", title: `The ${name(dyn)} dynasty`, body: `${titles} titles in the last ten seasons.`, teamIds: [dyn], weight: 6 + titles });

  // Droughts: the longest wait for a postseason trip, if that club is in the hunt now.
  const seasons = save.history.seasons ?? [];
  const picture = played ? playoffPicture(save) : [];
  const inNow = new Set(picture.flatMap((g) => g.rows.filter((r) => r.seed || r.mark === "division" || r.mark === "playoffs").map((r) => r.teamId)));
  const droughts = ids
    .map((id) => {
      const mine = seasons.filter((c) => c.teamId === id && c.year < year).sort((a, b) => b.year - a.year);
      let n = 0;
      for (const c of mine) {
        if (made(c.result)) break;
        n++;
      }
      return { id, n, all: n === mine.length };
    })
    .filter((d) => d.n >= 5)
    .sort((a, b) => b.n - a.n);
  for (const d of droughts.slice(0, 2)) {
    const hot = inNow.has(d.id);
    out.push({
      kind: "drought",
      title: hot ? `${name(d.id)} could end the drought` : `${name(d.id)}: ${d.n} years and counting`,
      body: hot
        ? `${d.n} straight seasons without a playoff trip${d.all ? ", every one on our books" : ""}. They hold a spot today at ${rec(save.teams[d.id]!)}.`
        : `No postseason since ${year - d.n - 1 >= 1966 ? year - d.n - 1 : "before 1966"}.`,
      teamIds: [d.id],
      weight: hot ? 7 + d.n / 5 : 2 + d.n / 10,
    });
  }

  if (played >= 4) {
    // Unbeaten and winless clubs.
    const unbeaten = ids.filter((id) => save.teams[id]!.losses === 0 && save.teams[id]!.wins > 0);
    for (const id of unbeaten)
      out.push({
        kind: "unbeaten",
        title: unbeaten.length === 1 ? `${name(id)}: the last unbeaten` : `${name(id)} still unbeaten`,
        body: `${rec(save.teams[id]!)} with ${total - played} to play.${played >= total - 3 ? " The perfect season is in reach." : ""}`,
        teamIds: [id],
        weight: 6 + played / 2,
      });
    for (const id of ids.filter((id) => save.teams[id]!.wins === 0 && save.teams[id]!.ties === 0))
      out.push({ kind: "winless", title: `${name(id)} still looking for a win`, body: `0-${save.teams[id]!.losses}.`, teamIds: [id], weight: 3 + played / 4 });
    // Streaks.
    for (const id of ids) {
      const s = save.teams[id]!.streak ?? "";
      const n = Number(s.slice(1));
      if (n < 5) continue;
      if (s.startsWith("W") && unbeaten.includes(id)) continue;
      if (s.startsWith("L") && save.teams[id]!.wins === 0) continue;
      out.push({ kind: "streak", title: s.startsWith("W") ? `${name(id)} have won ${n} straight` : `${name(id)} have lost ${n} straight`, body: `${rec(save.teams[id]!)} overall.`, teamIds: [id], weight: s.startsWith("W") ? 3 + n / 2 : 2 + n / 3 });
    }
    // Hot seat: a losing coach who has had time, or one sinking after a winning year.
    for (const id of ids) {
      const t = save.teams[id]!;
      const c = t.coachId ? save.coaches[t.coachId] : undefined;
      if (!c) continue;
      const g = t.wins + t.losses + t.ties;
      const pct = g ? (t.wins + t.ties / 2) / g : 0.5;
      const prev = seasons.find((x) => x.year === year - 1 && x.teamId === id);
      const prevPct = prev ? (prev.wins + prev.ties / 2) / Math.max(1, prev.wins + prev.losses + prev.ties) : 0.5;
      if (pct <= 0.3 && (c.yearsOnJob >= 2 || prevPct < 0.45))
        out.push({ kind: "hotSeat", title: `${c.name} on the hot seat`, body: `${name(id)} are ${rec(t)}${prev ? ` after ${prev.wins}-${prev.losses}${prev.ties ? `-${prev.ties}` : ""} last year` : ""}. Year ${c.yearsOnJob + 1} on the job.`, teamIds: [id], weight: 3 + (0.3 - pct) * 10 + Math.min(3, c.yearsOnJob / 2) });
    }
  }

  // Real history: where this league has gone its own way.
  const real = realRecords(year);
  const post = realPostseason(year);
  if (real && played >= 3) {
    const diffs = ids
      .map((id) => {
        const r = real.get(id);
        const t = save.teams[id]!;
        if (!r) return undefined;
        const g = Math.max(1, r.w + r.l + r.t);
        const realPct = (r.w + r.t / 2) / g;
        const pct = (t.wins + t.ties / 2) / Math.max(1, t.wins + t.losses + t.ties);
        return { id, r, t, gap: pct - realPct };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    if (post?.champ) {
      const champ = post.champ as TeamId;
      const t = save.teams[champ];
      const r = real.get(champ);
      if (t && r && ids.includes(champ))
        out.push({
          kind: "history",
          title: `The real ${year} champions: ${name(champ)}`,
          body: `They went ${r.w}-${r.l}${r.t ? `-${r.t}` : ""} and won it all. Here they're ${rec(t)}.`,
          teamIds: [champ],
          weight: 5,
        });
    }
    for (const d of diffs.slice(0, 2)) {
      if (Math.abs(d.gap) < 0.3 || d.id === post?.champ) continue;
      out.push({
        kind: "history",
        title: d.gap > 0 ? `${name(d.id)} rewriting ${year}` : `${name(d.id)} falling short of history`,
        body: `The real club finished ${d.r.w}-${d.r.l}${d.r.t ? `-${d.r.t}` : ""}. This one is ${rec(d.t)}.`,
        teamIds: [d.id],
        weight: 3 + Math.abs(d.gap) * 5,
      });
    }
  }

  for (const r of risingRivalries(save, 2)) {
    out.push({ kind: "rivalry", title: `${name(r.a)} vs ${name(r.b)}: a new rivalry`, body: `Close games and playoff meetings have made this one personal. Series: ${r.record}.`, teamIds: [r.a, r.b], weight: 3 + r.heat / 4 });
  }
  if (played >= 4) {
    for (const { player, line } of contractYearBreakouts(save).slice(0, 2)) {
      const club = player.teamId as TeamId;
      out.push({ kind: "contract", title: `${playerName(player)} is playing for a contract`, body: `Last year of his deal. ${line}`, teamIds: [club], weight: 3.5 });
    }
    for (const p of Object.values(save.players)) {
      if (p.tradeRequest !== year || p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof") continue;
      const moved = save.transactions.some((t) => t.year === year && t.kind === "trade" && t.playerId === p.id);
      out.push({
        kind: "tradeRequest",
        title: moved ? `${playerName(p)} got his wish` : `${playerName(p)} wants out`,
        body: moved ? `Traded to the ${displayName(year, p.teamId as TeamId)} after asking for a move.` : `He has asked the ${displayName(year, p.teamId as TeamId)} for a trade.`,
        teamIds: [p.teamId as TeamId],
        weight: moved ? 4 : 5,
      });
    }
  }
  for (const c of recordChases(save).slice(0, 1))
    out.push({ kind: "record", title: c.broken ? `${c.name} has the record` : `${c.name} chases history`, body: c.text, teamIds: c.teamId ? [c.teamId] : [], weight: c.broken ? 8 : 5 + (c.pace / c.record - 1) * 20 });

  return out.sort((a, b) => b.weight - a.weight).slice(0, max);
}

/* ---------------- breaking news ---------------- */

/**
 * News worth breaking into the broadcast for: trades, a star lost for the year, a coach out,
 * an all-time record falling. Newest first, current season only.
 */
export function breakingNews(save: DynastySave): NewsItem[] {
  // On Black Monday one bulletin covers every firing.
  const monday = save.news.some((n) => n.year === save.year && n.headline.startsWith("Black Monday"));
  return save.news.filter((n) => {
    if (n.year !== save.year) return false;
    if (n.headline.startsWith("Black Monday")) return true;
    // Black Monday's summary stands in for its firings; a midseason firing breaks in on its own.
    if (/^.+ fire .+$/.test(n.headline) && n.phase === "regular") return !(monday && n.week >= maxWeek(save));

    if (/ deal with /.test(n.headline)) return true;
    if (/ asks the .* for a trade$/.test(n.headline)) return true;
    if (/sets the all-time/.test(n.headline)) return true;
    if (/ out in /.test(n.headline)) return true;
    if (/ place .* on IR$/.test(n.headline)) {
      const p = save.players[n.playerIds[0] ?? ""];
      return !!p && p.ovr >= 80;
    }
    const p = save.players[n.playerIds[0] ?? ""];
    const star = (min: number) => !!p && Math.max(p.ovr, p.peakOvr ?? 0) >= min;
    // Moves: a star changing clubs or signing, a coach hired to run a club.
    if (/ traded to the /.test(n.headline)) return true;
    if (/ sign .+$/.test(n.headline) || / re-signs with the /.test(n.headline)) return star(84);
    if (/ hits free agency$/.test(n.headline)) return star(86);
    if (/^Bidding war for /.test(n.headline)) return true;
    if (/ hired as head coach /.test(n.headline) || /: .+ takes over$/.test(n.headline)) return true;
    // The locker room: holdouts and the men who want out.
    if (/ holds out$/.test(n.headline) || /ends his holdout/.test(n.headline)) return star(80);
    if (/ wants out of /.test(n.headline)) return true;
    if (/ on the hot seat$/.test(n.headline)) return true;
    // Stars hurt, and the greats calling it a career.
    if (/ goes down$/.test(n.headline) || / week-to-week$/.test(n.headline)) return star(85);
    if (/ retires$/.test(n.headline) || /^Farewell tour: /.test(n.headline)) return star(88);
    if (/breaks the single-season record|becomes the all-time leader/.test(n.headline)) return true;
    return false;
  });
}

/** How the channel tags a story: news that just happened, a report from sources, or an update. */
export type NewsTag = "BREAKING" | "REPORT" | "UPDATE";
export function newsTag(n: NewsItem): NewsTag {
  const h = n.headline;
  if (/ on the hot seat$| wants out of |^Bidding war for | asks the .* for a trade$/.test(h)) return "REPORT";
  if (/ week-to-week$| activate | ends his holdout|^Farewell tour: /.test(h)) return "UPDATE";
  return "BREAKING";
}
