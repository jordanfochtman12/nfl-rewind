/**
 * History mode's record of what really happened, loaded on demand (the tables are a few
 * megabytes, so they stay out of the main bundle until someone opens History mode).
 * Built by scripts/ingest-history.py from nflverse, Pro-Football-Reference tables, the
 * FiveThirtyEight game file and Wikipedia; nothing in it is estimated. No React.
 */
import type { Pos, SeasonStats, TeamId } from "./types.ts";
import { parseRecordMoments, type Ledger, type RecordTables } from "./historyExtras.ts";

export interface HistoryPerson {
  first: string;
  last: string;
  pos: Pos;
  /** YYYYMMDD, when the source has it. */
  birth?: string;
  college?: string;
}

export interface HistoryPlayoffGame {
  mmdd: string;
  round: string;
  home: TeamId;
  away: TeamId;
  homeScore: number;
  awayScore: number;
  neutral: boolean;
}

export interface HistoryPick {
  round: number;
  pick: number;
  team: TeamId;
  person: number;
  league?: "afl" | "nfl";
}

/** A real trade: what each club sent. A side is a person, a name (no roster match), or a pick. */
export interface HistoryTrade {
  /** The week it lands before (0 = offseason; past the last week = after the season). */
  week: number;
  parts: { gave: TeamId; received: TeamId; person?: number; name?: string; pick?: string }[];
}

/** A real season line; -1 marks a stat the source didn't keep that year (shown as —). */
export type HistoryLine = Partial<Record<keyof SeasonStats, number>>;

export interface HistoryData {
  people: HistoryPerson[];
  rosters(year: number): Map<TeamId, { person: number; jersey?: number }[]>;
  stats(year: number): { person: number; team: TeamId | ""; line: HistoryLine }[];
  playoffs(year: number): HistoryPlayoffGame[];
  drafts(year: number): HistoryPick[];
  /** award key -> person ids, or names (coaches, unmatched) */
  awards(year: number): Record<string, (number | string)[]>;
  /** Head coaches per club, in order, with the regular-season games each coached (99 = all). */
  coaches(year: number): Map<TeamId, { name: string; games: number }[]>;
  trades(year: number): HistoryTrade[];
  /** Hall of Fame class of that year: person ids or names (coaches, contributors, pre-1966 players). */
  hof(year: number): (number | string)[];
  /** Every franchise's record and every series before 1966 (History mode's ledgers start here). */
  before1966: { franchise: Record<string, Ledger>; series: Record<string, [number, number, number, number, string, string, number]> };
  /** When the all-time records fell. */
  records: RecordTables;
  /** Seasons each person appears on a roster, for retirement. */
  lastSeason(person: number): number | undefined;
  firstSeason(person: number): number | undefined;
}

const id36 = (s: string) => parseInt(s, 36);
const ref = (s: string): number | string => (s.startsWith("~") ? s.slice(1) : id36(s));

function memo<T>(f: (y: number) => T): (y: number) => T {
  const cache = new Map<number, T>();
  return (y) => {
    if (!cache.has(y)) cache.set(y, f(y));
    return cache.get(y)!;
  };
}

/** Lines the source left a hole in that the record of the game fills: name|birth|season. */
const LINE_FIXES: Record<string, HistoryLine> = {
  "Todd Collins|19711105|1996": { passCmp: 55 },
  "Todd Collins|19711105|1997": { passCmp: 215 },
};

/** Parse the generated tables into the shape the engine reads. */
export function parseHistory(mods: {
  PEOPLE: string;
  ROSTERS: Record<number, string>;
  STATS: Record<number, string>;
  STAT_FIELDS: readonly string[];
  PLAYOFFS: Record<number, string>;
  DRAFTS: Record<number, string>;
  AWARDS: Record<number, string>;
  HOF_CLASSES: Record<number, string>;
  COACHES?: Record<number, string>;
  TRADES?: Record<number, string>;
  FRANCHISE_BEFORE?: Record<string, Ledger>;
  SERIES_BEFORE?: Record<string, [number, number, number, number, string, string, number]>;
  RECORD_MOMENTS?: string;
  RECORDS_1966?: Record<string, [string, number, number]>;
}): HistoryData {
  const people = mods.PEOPLE.split("\n").map((l) => {
    const [first, last, pos, birth, college] = l.split("|");
    return { first: first!, last: last!, pos: pos as Pos, birth: birth || undefined, college: college || undefined };
  });
  const rosters = memo((y) => {
    const out = new Map<TeamId, { person: number; jersey?: number }[]>();
    for (const chunk of (mods.ROSTERS[y] ?? "").split(";")) {
      if (!chunk) continue;
      const [team, list] = chunk.split(":");
      out.set(
        team as TeamId,
        (list ?? "").split(",").filter(Boolean).map((e) => {
          const [i, j] = e.split(".");
          return { person: id36(i!), jersey: j ? Number(j) : undefined };
        }),
      );
    }
    return out;
  });
  // First and last roster season per person, from every season's rosters.
  const first = new Map<number, number>();
  const last = new Map<number, number>();
  for (const y of Object.keys(mods.ROSTERS).map(Number).sort((a, b) => a - b))
    for (const list of rosters(y).values())
      for (const { person } of list) {
        if (!first.has(person)) first.set(person, y);
        last.set(person, y);
      }
  const stats = memo((y) =>
    (mods.STATS[y] ?? "")
      .split("|")
      .filter(Boolean)
      .map((row) => {
        const c = row.split(",");
        const line: HistoryLine = {};
        mods.STAT_FIELDS.forEach((k, j) => {
          const v = c[j + 2];
          if (v === undefined || v === "") return;
          line[k as keyof SeasonStats] = v === "?" ? -1 : Number(v);
        });
        const person = id36(c[0]!);
        const who = people[person];
        const fix = who && LINE_FIXES[`${who.first} ${who.last}|${who.birth ?? ""}|${y}`];
        return { person, team: (c[1] ?? "") as TeamId | "", line: fix ? { ...line, ...fix } : line };
      }),
  );
  const playoffs = memo((y) =>
    (mods.PLAYOFFS[y] ?? "")
      .split("|")
      .filter(Boolean)
      .map((g) => {
        const [mmdd, round, home, away, hs, as, n] = g.split(",");
        return { mmdd: mmdd!, round: round!, home: home as TeamId, away: away as TeamId, homeScore: Number(hs), awayScore: Number(as), neutral: n === "N" };
      }),
  );
  const drafts = memo((y) =>
    (mods.DRAFTS[y] ?? "")
      .split("|")
      .filter(Boolean)
      .map((d) => {
        const [round, pick, team, person, league] = d.split(",");
        return { round: Number(round), pick: Number(pick), team: team as TeamId, person: id36(person!), league: (league || undefined) as HistoryPick["league"] };
      }),
  );
  // Pass rushers the record files as middle linebackers (it has one linebacker code for most
  // careers): Kevin Greene, Pat Swilling and Leslie O'Neal were rated on tackles and lined up
  // inside. A real sack season, or sacks year after year, makes him an outside linebacker.
  // (Brian Urlacher, 8 at best and under 5 a year, stays in the middle.)
  const rush = new Map<number, { best: number; total: number; seasons: number }>();
  for (const y of Object.keys(mods.STATS).map(Number)) {
    for (const { person, line } of stats(y)) {
      if (people[person]?.pos !== "MLB" || line.sacks == null || line.sacks < 0) continue;
      const r = rush.get(person) ?? { best: 0, total: 0, seasons: 0 };
      r.best = Math.max(r.best, line.sacks);
      r.total += line.sacks;
      r.seasons += 1;
      rush.set(person, r);
    }
  }
  for (const [person, r] of rush) if (r.best >= 9 || (r.best >= 7.5 && r.total / r.seasons >= 5.5)) people[person]!.pos = "OLB";
  // Namesakes, for an award the record pinned on the wrong one.
  let byName: Map<string, number[]> | undefined;
  const namesakes = (person: number): number[] => {
    if (!byName) {
      byName = new Map();
      people.forEach((w, i) => {
        const k = `${w.first}|${w.last}`;
        byName!.set(k, [...(byName!.get(k) ?? []), i]);
      });
    }
    const w = people[person];
    return w ? byName.get(`${w.first}|${w.last}`) ?? [] : [];
  };
  const OFFENSE = new Set(["mvp", "opoy", "oroy", "cpoy"]);
  const DEFENSE = new Set(["dpoy", "droy"]);
  const awards = memo((y) => {
    const out: Record<string, (number | string)[]> = {};
    let lines: Map<number, HistoryLine> | undefined;
    const lineOf = (person: number) => {
      if (!lines) {
        lines = new Map();
        for (const r of stats(y)) {
          const o = lines.get(r.person) ?? {};
          for (const [k, v] of Object.entries(r.line)) if (v >= 0) o[k as keyof SeasonStats] = (o[k as keyof SeasonStats] ?? 0) + v;
          lines.set(r.person, o);
        }
      }
      return lines.get(person);
    };
    const fits = (k: string, l: HistoryLine | undefined) => {
      if (!l) return -1;
      const yards = (l.passYds ?? 0) + (l.rushYds ?? 0) + (l.recYds ?? 0) + (l.fgMade ?? 0) * 30;
      const stops = ((l.sacks ?? 0) + (l.ints ?? 0)) * 100 + (l.tackles ?? 0) * 5;
      return OFFENSE.has(k) ? yards : DEFENSE.has(k) ? stops : yards + stops;
    };
    for (const part of (mods.AWARDS[y] ?? "").split(";")) {
      const [k, v] = part.split(":");
      if (!k || !v) continue;
      // The 1972 MVP is Washington's Larry Brown, not the Steelers lineman of the same name.
      out[k] = v.split("/").map(ref).map((who) => {
        if (typeof who !== "number" || k === "coy") return who;
        const mine = fits(k, lineOf(who));
        let best = who;
        let bestFit = mine;
        for (const other of namesakes(who)) {
          const f = fits(k, lineOf(other));
          if (other !== who && f > bestFit) {
            best = other;
            bestFit = f;
          }
        }
        return bestFit > mine * 2 + 100 ? best : who;
      });
    }
    return out;
  });
  const coaches = memo((y) => {
    const out = new Map<TeamId, { name: string; games: number }[]>();
    for (const chunk of (mods.COACHES?.[y] ?? "").split(";")) {
      const at = chunk.indexOf(":");
      if (at < 0) continue;
      out.set(
        chunk.slice(0, at) as TeamId,
        chunk
          .slice(at + 1)
          .split("/")
          .filter(Boolean)
          .map((c) => {
            const star = c.lastIndexOf("*");
            return { name: c.slice(0, star), games: Number(c.slice(star + 1)) };
          }),
      );
    }
    return out;
  });
  const trades = memo((y) =>
    (mods.TRADES?.[y] ?? "")
      .split("#")
      .filter(Boolean)
      .map((t): HistoryTrade => {
        const at = t.indexOf(":");
        return {
          week: Number(t.slice(0, at)),
          parts: t
            .slice(at + 1)
            .split("/")
            .filter(Boolean)
            .map((p) => {
              const [gave, received, who, pick] = p.split(",");
              return {
                gave: gave as TeamId,
                received: received as TeamId,
                person: who && !who.startsWith("~") ? id36(who) : undefined,
                name: who?.startsWith("~") ? who.slice(1) : undefined,
                pick: pick || undefined,
              };
            }),
        };
      }),
  );
  const hof = memo((y) => (mods.HOF_CLASSES[y] ?? "").split("/").filter(Boolean).map(ref));
  return {
    people,
    rosters,
    stats,
    playoffs,
    drafts,
    awards,
    coaches,
    trades,
    hof,
    before1966: { franchise: mods.FRANCHISE_BEFORE ?? {}, series: mods.SERIES_BEFORE ?? {} },
    records: parseRecordMoments(mods.RECORD_MOMENTS ?? "", mods.RECORDS_1966 ?? {}),
    lastSeason: (p) => last.get(p),
    firstSeason: (p) => first.get(p),
  };
}

let loaded: Promise<HistoryData> | undefined;

/** Load (once) and parse History mode's tables. */
export function loadHistoryData(): Promise<HistoryData> {
  loaded ??= Promise.all([
    import("./data/history/people.ts"),
    import("./data/history/rosters.ts"),
    import("./data/history/stats.ts"),
    import("./data/history/playoffs.ts"),
    import("./data/history/drafts.ts"),
    import("./data/history/awards.ts"),
    import("./data/history/hof.ts"),
    import("./data/history/coaches.ts"),
    import("./data/history/trades.ts"),
    import("./data/history/before1966.ts"),
    import("./data/history/recordMoments.ts"),
  ]).then(([p, r, s, po, d, a, h, c, t, b, rm]) =>
    parseHistory({
      PEOPLE: p.PEOPLE,
      ROSTERS: r.ROSTERS,
      STATS: s.STATS,
      STAT_FIELDS: s.STAT_FIELDS,
      PLAYOFFS: po.PLAYOFFS,
      DRAFTS: d.DRAFTS,
      AWARDS: a.AWARDS,
      HOF_CLASSES: h.HOF_CLASSES,
      COACHES: c.COACHES,
      TRADES: t.TRADES,
      FRANCHISE_BEFORE: b.FRANCHISE_BEFORE,
      SERIES_BEFORE: b.SERIES_BEFORE,
      RECORD_MOMENTS: rm.RECORD_MOMENTS,
      RECORDS_1966: rm.RECORDS_1966,
    }),
  );
  return loaded;
}
