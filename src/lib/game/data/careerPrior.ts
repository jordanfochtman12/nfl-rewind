import type { Player, Pos, SeasonStats, TeamId } from "../types.ts";
import { nameKey, nameSalt } from "../profiles.ts";
import { CAREER_SEASONS, type CareerSeasonRow } from "./careerSeasons.ts";

function blank(year: number, teamId: TeamId | "two"): SeasonStats {
  return {
    year,
    teamId,
    gp: 0,
    passAtt: 0,
    passCmp: 0,
    passYds: 0,
    passTd: 0,
    passInt: 0,
    sacksThrown: 0,
    rushAtt: 0,
    rushYds: 0,
    rushTd: 0,
    rec: 0,
    recYds: 0,
    recTd: 0,
    tackles: 0,
    sacks: 0,
    ints: 0,
    ff: 0,
    fgAtt: 0,
    fgMade: 0,
    xpAtt: 0,
    xpMade: 0,
    punts: 0,
    puntYds: 0,
    krYds: 0,
    prYds: 0,
    targets: 0,
    tfl: 0,
    pd: 0,
    qbHits: 0,
    fr: 0,
    krTd: 0,
    prTd: 0,
  };
}

const ROW_KEYS: (keyof Omit<SeasonStats, "year" | "teamId">)[] = [
  "gp",
  "passAtt",
  "passCmp",
  "passYds",
  "passTd",
  "passInt",
  "sacksThrown",
  "rushAtt",
  "rushYds",
  "rushTd",
  "rec",
  "recYds",
  "recTd",
  "tackles",
  "sacks",
  "ints",
  "ff",
  "fgAtt",
  "fgMade",
  "xpAtt",
  "xpMade",
  "punts",
  "puntYds",
  "krYds",
  "prYds",
  "targets",
  "tfl",
  "pd",
  "qbHits",
  "fr",
  "krTd",
  "prTd",
];

function fromSeasonRow(row: CareerSeasonRow): SeasonStats {
  const teamId = (row.t === "two" ? "two" : row.t) as TeamId | "two";
  const s = blank(row.y, teamId);
  s.gp = row.gp ?? 0;
  s.passAtt = row.passAtt ?? 0;
  s.passCmp = row.passCmp ?? 0;
  s.passYds = row.passYds ?? 0;
  s.passTd = row.passTd ?? 0;
  s.passInt = row.passInt ?? 0;
  s.sacksThrown = row.sacksThrown ?? 0;
  s.rushAtt = row.rushAtt ?? 0;
  s.rushYds = row.rushYds ?? 0;
  s.rushTd = row.rushTd ?? 0;
  s.rec = row.rec ?? 0;
  s.recYds = row.recYds ?? 0;
  s.recTd = row.recTd ?? 0;
  s.tackles = row.tackles ?? 0;
  s.sacks = row.sacks ?? 0;
  s.ints = row.ints ?? 0;
  s.ff = row.ff ?? 0;
  s.fgAtt = row.fgAtt ?? 0;
  s.fgMade = row.fgMade ?? 0;
  s.xpAtt = row.xpAtt ?? 0;
  s.xpMade = row.xpMade ?? 0;
  s.punts = row.punts ?? 0;
  s.puntYds = row.puntYds ?? 0;
  s.krYds = row.krYds ?? 0;
  s.prYds = row.prYds ?? 0;
  s.targets = 0;
  s.tfl = 0;
  s.pd = 0;
  s.qbHits = 0;
  s.fr = 0;
  s.krTd = 0;
  s.prTd = 0;
  return s;
}

function realSeasons(first: string, last: string, throughYear: number): SeasonStats[] {
  const key = nameKey(first, last);
  const rows = CAREER_SEASONS[key];
  if (!rows?.length) return [];
  return rows
    .filter((r) => r.y <= throughYear && r.y >= 1946)
    .sort((a, b) => a.y - b.y || a.t.localeCompare(b.t))
    .map(fromSeasonRow)
    .filter((s) => ROW_KEYS.some((k) => (s[k] as number) > 0));
}


type Totals = Partial<Omit<SeasonStats, "year" | "teamId" | "unknown">> & { from: number };

/** Approximate NFL/AFL production through the season before the dynasty starts. */
const STAR_PRIOR: Record<string, Totals> = {
  "bart|starr": { from: 1956, gp: 108, passAtt: 2210, passCmp: 1248, passYds: 14820, passTd: 98, passInt: 73, rushYds: 268, rushTd: 9, sacksThrown: 142 },
  "johnny|unitas": { from: 1956, gp: 127, passAtt: 3654, passCmp: 1988, passYds: 26840, passTd: 212, passInt: 138, rushYds: 512, rushTd: 14, sacksThrown: 168 },
  "joe|namath": { from: 1965, gp: 14, passAtt: 340, passCmp: 164, passYds: 3047, passTd: 22, passInt: 28, sacksThrown: 28 },
  "fran|tarkenton": { from: 1961, gp: 70, passAtt: 1890, passCmp: 1012, passYds: 13740, passTd: 96, passInt: 73, rushAtt: 310, rushYds: 1680, rushTd: 12, sacksThrown: 110 },
  "len|dawson": { from: 1957, gp: 92, passAtt: 1988, passCmp: 1110, passYds: 15460, passTd: 128, passInt: 82, sacksThrown: 96 },
  "sonny|jurgensen": { from: 1957, gp: 98, passAtt: 2210, passCmp: 1240, passYds: 17680, passTd: 132, passInt: 99, sacksThrown: 118 },
  "don|meredith": { from: 1960, gp: 72, passAtt: 1650, passCmp: 860, passYds: 12440, passTd: 88, passInt: 78, sacksThrown: 102 },
  "roman|gabriel": { from: 1962, gp: 42, passAtt: 980, passCmp: 470, passYds: 6420, passTd: 38, passInt: 41, sacksThrown: 64 },
  "john|brodie": { from: 1957, gp: 102, passAtt: 2480, passCmp: 1320, passYds: 17420, passTd: 108, passInt: 112, sacksThrown: 130 },
  "george|blanda": { from: 1949, gp: 168, passAtt: 2420, passCmp: 1160, passYds: 17580, passTd: 148, passInt: 155, rushTd: 9, fgAtt: 310, fgMade: 164, xpAtt: 390, xpMade: 368 },
  "jack|kemp": { from: 1957, gp: 88, passAtt: 2460, passCmp: 1180, passYds: 17220, passTd: 114, passInt: 118, rushYds: 980, rushTd: 18, sacksThrown: 140 },
  "john|hadl": { from: 1962, gp: 52, passAtt: 1280, passCmp: 620, passYds: 8920, passTd: 64, passInt: 58, sacksThrown: 72 },
  "babe|parilli": { from: 1952, gp: 118, passAtt: 2680, passCmp: 1320, passYds: 18840, passTd: 142, passInt: 148, sacksThrown: 156 },
  "daryle|lamonica": { from: 1963, gp: 28, passAtt: 420, passCmp: 198, passYds: 3120, passTd: 24, passInt: 22, sacksThrown: 28 },
  "earl|morrall": { from: 1956, gp: 96, passAtt: 1680, passCmp: 860, passYds: 12110, passTd: 78, passInt: 86, sacksThrown: 98 },
  "gale|sayers": { from: 1965, gp: 14, rushAtt: 166, rushYds: 867, rushTd: 14, rec: 29, recYds: 507, recTd: 6, krYds: 918, prYds: 238 },
  "jim|taylor": { from: 1958, gp: 104, rushAtt: 1688, rushYds: 7674, rushTd: 77, rec: 198, recYds: 1620, recTd: 10 },
  "paul|hornung": { from: 1957, gp: 88, rushAtt: 780, rushYds: 3140, rushTd: 44, rec: 130, recYds: 1480, recTd: 12, fgAtt: 190, fgMade: 66, xpAtt: 260, xpMade: 248, passAtt: 70, passCmp: 32, passYds: 540, passTd: 5 },
  "leroy|kelly": { from: 1964, gp: 28, rushAtt: 210, rushYds: 980, rushTd: 8, rec: 24, recYds: 280, recTd: 2, krYds: 640, prYds: 220 },
  "jim|nance": { from: 1965, gp: 14, rushAtt: 111, rushYds: 421, rushTd: 5, rec: 8, recYds: 62 },
  "lenny|moore": { from: 1956, gp: 118, rushAtt: 980, rushYds: 4680, rushTd: 44, rec: 298, recYds: 4980, recTd: 40, krYds: 1120 },
  "don|maynard": { from: 1958, gp: 96, rec: 360, recYds: 6980, recTd: 51, rushYds: 180 },
  "lance|alworth": { from: 1962, gp: 54, rec: 248, recYds: 5420, recTd: 48 },
  "raymond|berry": { from: 1955, gp: 140, rec: 568, recYds: 8450, recTd: 66 },
  "bob|hayes": { from: 1965, gp: 13, rec: 46, recYds: 1003, recTd: 12, krYds: 581, prYds: 276 },
  "charley|taylor": { from: 1964, gp: 28, rec: 106, recYds: 1544, recTd: 10, rushAtt: 84, rushYds: 420, rushTd: 5 },
  "paul|warfield": { from: 1964, gp: 26, rec: 74, recYds: 1320, recTd: 11 },
  "fred|biletnikoff": { from: 1965, gp: 14, rec: 29, recYds: 481, recTd: 4 },
  "otis|taylor": { from: 1965, gp: 14, rec: 21, recYds: 297, recTd: 4 },
  "bobby|mitchell": { from: 1958, gp: 104, rec: 348, recYds: 5480, recTd: 43, rushAtt: 410, rushYds: 2220, rushTd: 18, krYds: 2340, prYds: 1180 },
  "mike|ditka": { from: 1961, gp: 68, rec: 214, recYds: 2780, recTd: 24 },
  "john|mackey": { from: 1963, gp: 42, rec: 96, recYds: 1688, recTd: 16 },
  "dick|butkus": { from: 1965, gp: 14, tackles: 138, sacks: 5, ints: 5, ff: 3 },
  "ray|nitschke": { from: 1958, gp: 102, tackles: 780, sacks: 18, ints: 16, ff: 12 },
  "sam|huff": { from: 1956, gp: 126, tackles: 920, sacks: 12, ints: 22, ff: 10 },
  "bobby|bell": { from: 1963, gp: 42, tackles: 280, sacks: 18, ints: 8, ff: 6 },
  "nick|buoniconti": { from: 1962, gp: 56, tackles: 360, sacks: 11, ints: 16 },
  "chuck|howley": { from: 1958, gp: 88, tackles: 540, sacks: 22, ints: 14 },
  "deacon|jones": { from: 1961, gp: 70, tackles: 310, sacks: 66, ints: 2, ff: 8 },
  "merlin|olsen": { from: 1962, gp: 56, tackles: 280, sacks: 28, ff: 4 },
  "bob|lilly": { from: 1961, gp: 70, tackles: 340, sacks: 42, ints: 1, ff: 6 },
  "willie|davis": { from: 1958, gp: 104, tackles: 420, sacks: 48, ff: 8 },
  "buck|buchanan": { from: 1963, gp: 42, tackles: 210, sacks: 22, ff: 4 },
  "jim|otto": { from: 1960, gp: 84 },
  "jim|parker": { from: 1957, gp: 118 },
  "forrest|gregg": { from: 1956, gp: 122 },
  "jerry|kramer": { from: 1958, gp: 96 },
  "ron|mix": { from: 1960, gp: 82 },
  "herb|adderley": { from: 1961, gp: 70, tackles: 180, ints: 22, recYds: 0, krYds: 1480 },
  "night train|lane": { from: 1952, gp: 140, ints: 58, tackles: 420 },
  "mel|renfro": { from: 1964, gp: 28, tackles: 110, ints: 7, krYds: 1017, prYds: 418 },
  "larry|wilson": { from: 1960, gp: 82, tackles: 360, ints: 28, sacks: 4 },
  "paul|krause": { from: 1964, gp: 28, tackles: 96, ints: 28 },
  "willie|wood": { from: 1960, gp: 82, tackles: 280, ints: 32, prYds: 1260 },
  "johnny|robinson": { from: 1960, gp: 82, tackles: 300, ints: 30 },
  "dick|lebeau": { from: 1959, gp: 96, tackles: 340, ints: 32 },
  "gino|cappelletti": { from: 1960, gp: 84, rec: 220, recYds: 3500, recTd: 28, fgAtt: 220, fgMade: 112, xpAtt: 250, xpMade: 232 },
  "lou|groza": { from: 1946, gp: 216, fgAtt: 412, fgMade: 216, xpAtt: 690, xpMade: 641 },
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const STAT_KEYS: (keyof Totals)[] = [
  "gp",
  "passAtt",
  "passCmp",
  "passYds",
  "passTd",
  "passInt",
  "sacksThrown",
  "rushAtt",
  "rushYds",
  "rushTd",
  "rec",
  "recYds",
  "recTd",
  "tackles",
  "sacks",
  "ints",
  "ff",
  "fgAtt",
  "fgMade",
  "xpAtt",
  "xpMade",
  "punts",
  "puntYds",
  "krYds",
  "prYds",
];

function yearWeights(n: number, salt: number): number[] {
  if (n <= 1) return [1];
  const w = Array.from({ length: n }, (_, i) => 0.72 + ((salt >>> (i % 12)) % 9) / 20 + i / (n * 4));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

function splitTotal(total: number, weights: number[], i: number): number {
  if (total <= 0) return 0;
  if (weights.length === 1) return Math.round(total);
  const parts = weights.map((w) => Math.floor(total * w));
  let used = parts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (used < total) {
    parts[idx % parts.length] += 1;
    used += 1;
    idx += 1;
  }
  return parts[i] ?? 0;
}

function applyShares(row: SeasonStats, totals: Totals, i: number, weights: number[]): void {
  for (const k of STAT_KEYS) {
    const tot = totals[k];
    if (typeof tot !== "number" || tot <= 0) continue;
    (row as unknown as Record<string, number>)[k] = splitTotal(tot, weights, i);
  }
  if (row.gp < 1) row.gp = 10;
  if (row.passCmp > row.passAtt) row.passCmp = Math.max(0, row.passAtt - 2);
  if (row.fgMade > row.fgAtt) row.fgMade = row.fgAtt;
  if (row.xpMade > row.xpAtt) row.xpMade = row.xpAtt;
}

function generatedYear(p: Player, year: number, i: number, n: number): SeasonStats {
  const teamId: TeamId | "two" = p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? "two" : p.teamId;
  const s = blank(year, teamId);
  const salt = nameSalt(p.firstName, p.lastName);
  const o = p.ovr;
  const peak = 0.78 + (i / Math.max(1, n - 1)) * 0.28;
  const gp = clamp(11 + ((salt + year) % 4), 8, 14);
  s.gp = gp;
  const scale = (o / 78) * peak;
  const pos: Pos = p.pos;
  if (pos === "QB") {
    s.passAtt = Math.round((210 + ((salt % 40) + o)) * scale);
    s.passCmp = Math.round(s.passAtt * (0.48 + o / 800));
    s.passYds = Math.round(s.passAtt * (6.4 + o / 90) * (0.85 + peak * 0.2));
    s.passTd = Math.round((8 + o / 12) * scale);
    s.passInt = Math.round((12 + (100 - o) / 8) * (1.15 - peak * 0.2));
    s.sacksThrown = Math.round(18 * (1.05 - o / 200));
    s.rushYds = Math.round((p.ratings?.speed ?? 50) > 70 ? 280 * scale : 60);
    s.rushAtt = Math.round(s.rushYds / 4.2);
    s.rushTd = s.rushYds > 200 ? 2 : 0;
  } else if (pos === "RB" || pos === "FB") {
    s.rushAtt = Math.round((pos === "FB" ? 70 : 140 + o) * scale * (0.7 + (salt % 5) / 10));
    s.rushYds = Math.round(s.rushAtt * (3.6 + o / 80));
    s.rushTd = Math.round((3 + o / 20) * scale);
    s.rec = Math.round((pos === "FB" ? 12 : 18 + o / 12) * scale);
    s.recYds = Math.round(s.rec * (8 + o / 30));
    s.recTd = s.rec > 20 ? 2 : 1;
    if ((p.ratings?.speed ?? 50) > 88) s.krYds = Math.round(280 * scale);
  } else if (pos === "WR" || pos === "TE") {
    s.rec = Math.round((pos === "TE" ? 22 : 36 + o / 8) * scale);
    s.recYds = Math.round(s.rec * (pos === "TE" ? 12 : 15 + o / 40));
    s.recTd = Math.round((pos === "TE" ? 3 : 5 + o / 25) * scale);
    s.rushAtt = pos === "WR" ? 4 : 0;
    s.rushYds = s.rushAtt * 8;
  } else if (pos === "K") {
    s.fgAtt = Math.round(22 * scale);
    s.fgMade = Math.round(s.fgAtt * (0.55 + o / 400));
    s.xpAtt = Math.round(32 * scale);
    s.xpMade = Math.round(s.xpAtt * 0.92);
  } else if (pos === "P") {
    s.punts = Math.round(58 * (0.9 + (salt % 5) / 20));
    s.puntYds = Math.round(s.punts * (40 + o / 20));
  } else if (pos === "DE" || pos === "DT" || pos === "OLB") {
    s.tackles = Math.round((pos === "DT" ? 48 : 62) * scale);
    s.sacks = Math.round((pos === "DT" ? 4 : 7) * scale);
    s.ff = Math.round(1.4 * scale);
    s.ints = pos === "OLB" ? Math.round(1.2 * scale) : 0;
  } else if (pos === "MLB") {
    s.tackles = Math.round(90 * scale);
    s.sacks = Math.round(2.5 * scale);
    s.ints = Math.round(1.6 * scale);
    s.ff = Math.round(1.5 * scale);
  } else if (pos === "CB" || pos === "S") {
    s.tackles = Math.round((pos === "S" ? 58 : 42) * scale);
    s.ints = Math.round((pos === "S" ? 4 : 5) * scale);
    s.ff = Math.round(1.1 * scale);
    s.sacks = pos === "S" ? 1 : 0;
    if ((p.ratings?.speed ?? 50) > 86) s.krYds = Math.round(180 * scale);
  }
  return s;
}

function statWork(s: Partial<SeasonStats> | Totals): number {
  return (
    (s.passYds ?? 0) +
    (s.rushYds ?? 0) +
    (s.recYds ?? 0) +
    (s.tackles ?? 0) +
    (s.sacks ?? 0) * 10 +
    (s.ints ?? 0) * 25 +
    (s.fgMade ?? 0) * 3 +
    (s.puntYds ?? 0) +
    (s.krYds ?? 0) +
    (s.prYds ?? 0)
  );
}

function familyOf(s: Partial<SeasonStats> | Totals): "pass" | "rush" | "def" | "kick" | "none" {
  const pass = s.passYds ?? 0;
  const rush = (s.rushYds ?? 0) + (s.recYds ?? 0);
  const def = (s.tackles ?? 0) + (s.sacks ?? 0) * 10 + (s.ints ?? 0) * 25;
  const kick = (s.fgMade ?? 0) * 3 + (s.puntYds ?? 0);
  const best = Math.max(pass, rush, def, kick);
  if (best <= 0) return "none";
  if (best === pass) return "pass";
  if (best === rush) return "rush";
  if (best === def) return "def";
  return "kick";
}

function subtractTotals(remain: Totals, used: SeasonStats): void {
  for (const k of STAT_KEYS) {
    if (k === "from") continue;
    const v = used[k as keyof SeasonStats];
    const cur = remain[k];
    if (typeof v === "number" && typeof cur === "number") {
      remain[k] = Math.max(0, cur - v) as Totals[typeof k];
    }
  }
}

export function seedPriorCareer(p: Player, throughYear: number): SeasonStats[] {
  if (throughYear < 1946) return [];
  const key = nameKey(p.firstName, p.lastName);
  const star = STAR_PRIOR[key];
  const salt = nameSalt(p.firstName, p.lastName);
  const teamId: TeamId | "two" = p.teamId === "fa" || p.teamId === "retired" || p.teamId === "hof" ? "two" : p.teamId;
  const real = realSeasons(p.firstName, p.lastName, throughYear);
  if (star) {
    const from = star.from;
    const n = Math.max(1, throughYear - from + 1);
    const expected = n;
    const covered = new Set(real.filter((s) => statWork(s) > 40).map((s) => s.year)).size;
    const realWork = real.reduce((a, s) => a + statWork(s), 0);
    if (covered >= expected && realWork >= statWork(star) * 0.75) {
      return real;
    }
    if (expected <= 2 && covered >= 1 && realWork >= statWork(star) * 0.6) {
      return real;
    }
    const byYear = new Map<number, SeasonStats>();
    for (const row of real) {
      const prev = byYear.get(row.year);
      if (!prev || statWork(row) >= statWork(prev)) byYear.set(row.year, row);
    }
    const weights = yearWeights(n, salt);
    const picked: (SeasonStats | null)[] = [];
    const remain: Totals = { ...star };
    let holes = 0;
    for (let i = 0; i < n; i++) {
      const year = from + i;
      if (year > throughYear) break;
      const guess = blank(year, teamId);
      applyShares(guess, star, i, weights);
      const hit = byYear.get(year);
      if (hit && familyOf(hit) === familyOf(guess) && familyOf(hit) !== "none") {
        picked.push(hit);
        subtractTotals(remain, hit);
      } else {
        picked.push(null);
        holes += 1;
      }
    }
    const holeW = yearWeights(Math.max(1, holes), salt);
    let hole = 0;
    const out: SeasonStats[] = [];
    for (let i = 0; i < picked.length; i++) {
      const year = from + i;
      const hit = picked[i];
      if (hit) {
        out.push(hit);
        continue;
      }
      const row = blank(year, teamId);
      applyShares(row, remain, hole, holeW);
      hole += 1;
      out.push(row);
    }
    return out;
  }
  if (real.length) return real;
  const seasons = Math.min(18, Math.max(0, p.yearsPro));
  if (seasons <= 0) return [];
  const out: SeasonStats[] = [];
  for (let i = 0; i < seasons; i++) {
    const year = throughYear - seasons + 1 + i;
    if (year < 1946) continue;
    out.push(generatedYear(p, year, i, seasons));
  }
  return out;
}
