/**
 * A career against the whole league: where a player's totals rank all-time (league and his
 * club), and two careers side by side. Regular season and playoffs stay separate. No React.
 */
import { careerTotals, playoffTotals } from "./leaders.ts";
import { STAT_WORDS, WATCH_STATS, type WatchStat } from "./boothMemory.ts";
import { playerName } from "./players.ts";
import type { DynastySave, Player, SeasonStats, TeamId } from "./types.ts";

const val = (s: SeasonStats | undefined, k: WatchStat) => ((s as unknown as Record<string, number> | undefined)?.[k] ?? 0) || 0;

interface Board {
  /** Every career total above zero, high to low. */
  league: Record<WatchStat, number[]>;
}

const boardCache = new Map<string, Board>();
const settled = new WeakMap<Player, SeasonStats>();

function totalsOf(p: Player): SeasonStats {
  const done = p.teamId === "retired" || p.teamId === "hof";
  const hit = done ? settled.get(p) : undefined;
  if (hit) return hit;
  const t = careerTotals(p);
  if (done) settled.set(p, t);
  return t;
}

function board(save: DynastySave): Board {
  const key = `${save.seed}-${save.year}-${save.week}-${save.phase}`;
  const hit = boardCache.get(key);
  if (hit) return hit;
  const league = Object.fromEntries(WATCH_STATS.map((k) => [k, [] as number[]])) as Record<WatchStat, number[]>;
  for (const p of Object.values(save.players)) {
    if (p.twinOf) continue;
    const t = totalsOf(p);
    for (const k of WATCH_STATS) {
      const v = val(t, k);
      if (v > 0) league[k].push(v);
    }
  }
  for (const k of WATCH_STATS) league[k].sort((a, b) => b - a);
  const out = { league };
  if (boardCache.size > 3) boardCache.clear();
  boardCache.set(key, out);
  return out;
}

export interface CareerRank {
  stat: WatchStat;
  label: string;
  value: number;
  rank: number;
  /** Rank among everyone who ever played for his signature club. */
  clubRank?: number;
}

/** Where a player's career totals rank all-time, best first (top 50 only). */
export function careerRanks(save: DynastySave, p: Player, club?: TeamId): CareerRank[] {
  const b = board(save);
  const mine = totalsOf(p);
  const out: CareerRank[] = [];
  for (const k of WATCH_STATS) {
    const v = val(mine, k);
    if (v <= 0) continue;
    const rank = b.league[k].findIndex((x) => x <= v) + 1;
    if (rank <= 0 || rank > 50) continue;
    let clubRank: number | undefined;
    if (club) {
      // Club totals: what each man did in this club's colors.
      const mineClub = Object.values(p.stats).filter((s) => s.teamId === club).reduce((n, s) => n + val(s, k), 0);
      if (mineClub > 0) {
        let better = 0;
        for (const q of Object.values(save.players)) {
          if (q.id === p.id || q.twinOf) continue;
          let n = 0;
          for (const s of Object.values(q.stats)) if (s.teamId === club) n += val(s, k);
          if (n > mineClub) better += 1;
          if (better >= 25) break;
        }
        clubRank = better < 25 ? better + 1 : undefined;
      }
    }
    out.push({ stat: k, label: STAT_WORDS[k].many, value: v, rank, clubRank });
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, 4);
}

export interface CompareRow {
  label: string;
  a: number;
  b: number;
  /** Shown as written (rings, honors) or with thousands separators. */
  kind?: "count";
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

/** Two careers side by side: totals, best seasons, honors, playoffs. */
export function comparePlayers(save: DynastySave, a: Player, b: Player): { sections: { title: string; rows: CompareRow[] }[] } {
  const ta = totalsOf(a);
  const tb = totalsOf(b);
  const pa = playoffTotals(a);
  const pb = playoffTotals(b);
  const seasons = (p: Player) => [...Object.values(p.stats), ...(p.career ?? [])];
  const best = (p: Player, k: WatchStat) => Math.max(0, ...seasons(p).map((s) => val(s, k)));
  const relevant = WATCH_STATS.filter((k) => val(ta, k) + val(tb, k) > 0);
  const honors = (p: Player) => p.honors ?? { proBowl: [], allPro: [], awards: [], rings: [] };
  const sections: { title: string; rows: CompareRow[] }[] = [
    {
      title: "Career",
      rows: [
        { label: "Seasons", a: new Set(seasons(a).map((s) => s.year)).size, b: new Set(seasons(b).map((s) => s.year)).size, kind: "count" },
        { label: "Games", a: ta.gp, b: tb.gp, kind: "count" },
        ...relevant.map((k) => ({ label: STAT_WORDS[k].many[0]!.toUpperCase() + STAT_WORDS[k].many.slice(1), a: val(ta, k), b: val(tb, k) })),
      ],
    },
    {
      title: "Best single season",
      rows: relevant.map((k) => ({ label: STAT_WORDS[k].many[0]!.toUpperCase() + STAT_WORDS[k].many.slice(1), a: best(a, k), b: best(b, k) })),
    },
    {
      title: "Honors",
      rows: [
        { label: "Pro Bowls", a: honors(a).proBowl.length, b: honors(b).proBowl.length, kind: "count" },
        { label: "All-Pro", a: honors(a).allPro.length, b: honors(b).allPro.length, kind: "count" },
        { label: "MVPs", a: honors(a).awards.filter((x) => x.award === "MVP").length, b: honors(b).awards.filter((x) => x.award === "MVP").length, kind: "count" },
        { label: "Championships", a: (honors(a).rings ?? []).length, b: (honors(b).rings ?? []).length, kind: "count" },
      ],
    },
    {
      title: "Playoffs",
      rows: [
        { label: "Playoff games", a: pa.gp, b: pb.gp, kind: "count" },
        ...relevant.map((k) => ({ label: STAT_WORDS[k].many[0]!.toUpperCase() + STAT_WORDS[k].many.slice(1), a: val(pa, k), b: val(pb, k) })).filter((r) => r.a + r.b > 0),
      ],
    },
  ];
  return { sections: sections.filter((s) => s.rows.length) };
}

/** Players worth comparing someone to: same position, best careers first. */
export function compareCandidates(save: DynastySave, p: Player, query = ""): Player[] {
  const q = query.trim().toLowerCase();
  const pool = Object.values(save.players).filter((x) => x.id !== p.id && !x.twinOf && (q ? playerName(x).toLowerCase().includes(q) : x.pos === p.pos));
  const score = (x: Player) => {
    const t = totalsOf(x);
    return sum(WATCH_STATS.map((k) => val(t, k) * (k.endsWith("Yds") ? 0.05 : 4))) + (x.honors?.proBowl.length ?? 0) * 30;
  };
  return pool.sort((x, y) => score(y) - score(x)).slice(0, 12);
}
