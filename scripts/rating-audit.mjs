/**
 * Rating audit: every real draftee's key skill ratings checked against what his career really
 * showed, measured against his own seasons' league. A rating that disagrees with the record
 * by four or more is corrected toward it; the rest of his kit carries his overall, so only the
 * shape changes. Eli Manning, a 60% passer in a 62% league who led it in interceptions three
 * times, came out a 91 in accuracy as a "precision passer".
 *
 *   QB  throwAcc  completion rate over the league's that season
 *       throwAwr  touchdown rate less interception rate, over the league's
 *       arch      a "precision passer" who wasn't one becomes a gunslinger or a game manager
 *   DE / OLB / DT  prs  sacks a game over his position's (researched totals from 1970,
 *                       official from 1982)
 *   K   kickAcc   field-goal rate over the league's
 *   P   kickPow   gross average over the league's
 *   RB, WR, TE, CB, S, MLB, OLB: see RATES below. Their skills are ranked among their position's,
 *       not set level with their overall (a back's hands sit well under it)
 *
 * Writes src/lib/game/data/ratingAudit.ts and data/audit/rating-audit.md.
 * Run: node --experimental-strip-types scripts/rating-audit.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const G = join(ROOT, "src/lib/game");
const { PEOPLE } = await import(join(G, "data/history/people.ts"));
const { DRAFTS } = await import(join(G, "data/history/drafts.ts"));
const { STATS, STAT_FIELDS } = await import(join(G, "data/history/stats.ts"));
const { draftSeedsFor } = await import(join(G, "data/draftClasses.ts"));
const { normalizedName } = await import(join(G, "identity.ts"));
const { createNewGame } = await import(join(G, "index.ts"));
const { realDraftee } = await import(join(G, "draft.ts"));

const id36 = (s) => parseInt(s, 36);
const people = PEOPLE.split("\n").map((l) => {
  const [first, last, pos] = l.split("|");
  return { first, last, pos };
});

/* ---------------- seasons: each man's lines and each year's league ---------------- */

const F = Object.fromEntries(STAT_FIELDS.map((k, i) => [k, i + 2]));
const lines = new Map(); // person -> [{ year, ...line }]
const league = new Map(); // year -> totals
const posLeague = new Map(); // year -> position -> totals
for (const [y, s] of Object.entries(STATS)) {
  const year = Number(y);
  const lg = { passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, fgAtt: 0, fgMade: 0, punts: 0, puntYds: 0 };
  const byPos = {}; // position -> that season's totals, every man listed there
  for (const row of s.split("|")) {
    if (!row) continue;
    const c = row.split(",");
    const person = id36(c[0]);
    const line = { year };
    for (const [k, j] of Object.entries(F)) {
      const v = c[j];
      if (v === undefined || v === "" || v === "?") continue;
      line[k] = Number(v);
    }
    for (const k of Object.keys(lg)) lg[k] += line[k] ?? 0;
    const pos = people[person]?.pos;
    if (pos) {
      const t = (byPos[pos] ??= {});
      for (const [k, v] of Object.entries(line)) if (k !== "year") t[k] = (t[k] ?? 0) + v;
      // Targets are kept from 1999, and only lines that have them count toward a catch rate.
      if (line.targets) t.recT = (t.recT ?? 0) + (line.rec ?? 0);
    }
    if (!lines.has(person)) lines.set(person, []);
    lines.get(person).push(line);
  }
  league.set(year, lg);
  posLeague.set(year, byPos);
}

/* ---------------- who each catalog draftee is ---------------- */

const drafted = new Map(); // "year|name" -> [person]
for (const [y, s] of Object.entries(DRAFTS))
  for (const e of s.split("|")) {
    const [, , , pid] = e.split(",");
    const person = id36(pid);
    const w = people[person];
    if (!w) continue;
    const k = `${y}|${normalizedName(w.first, w.last)}`;
    drafted.set(k, [...(drafted.get(k) ?? []), person]);
  }

/* ---------------- career measures, each season against its league ---------------- */

/** The first season with sack totals (unofficial until 1982). */
const SACKS_FROM = 1970;

// out[key] = { v, n, g, shrink }: the measure, how much career it rests on, the group it's ranked
// in, and how much career it takes to count for half (a short one is pulled toward usual).
function measures(person, pos) {
  const ls = lines.get(person) ?? [];
  const sum = (k) => ls.reduce((n, l) => n + (l[k] ?? 0), 0);
  const out = {};
  const put = (key, v, n, g, shrink) => (out[key] = { v, n, g, shrink });
  if (pos === "QB") {
    const att = sum("passAtt");
    const cmp = sum("passCmp");
    if (att >= 400 && cmp > 0) {
      let acc = 0, awr = 0;
      for (const l of ls) {
        const a = l.passAtt ?? 0;
        const lg = league.get(l.year);
        if (!a || !lg?.passAtt) continue;
        acc += a * ((l.passCmp ?? 0) / a - lg.passCmp / lg.passAtt);
        awr += a * (((l.passTd ?? 0) - (l.passInt ?? 0)) / a - (lg.passTd - lg.passInt) / lg.passAtt);
      }
      put("throwAcc", acc / att, att, "QB", 900);
      put("throwAwr", awr / att, att, "QB", 900);
    }
  }
  if (pos === "DE" || pos === "OLB" || pos === "DT") {
    // Sacks a game against his position's that season. The league made them official in 1982;
    // the researched totals go back to 1970 (Deacon Jones's last seasons, Youngblood's prime).
    let gp = 0, v = 0;
    for (const l of ls) {
      const base = posLeague.get(l.year)?.[pos];
      if (l.year < SACKS_FROM || !l.gp || !base?.gp) continue;
      gp += l.gp;
      v += (l.sacks ?? 0) - l.gp * ((base.sacks ?? 0) / base.gp);
    }
    if (gp >= 32) put("prs", v / gp, gp, pos, 50);
  }
  if (pos === "K") {
    const att = sum("fgAtt");
    if (att >= 40) {
      let v = 0;
      for (const l of ls) {
        const a = l.fgAtt ?? 0;
        const lg = league.get(l.year);
        if (a && lg?.fgAtt) v += a * ((l.fgMade ?? 0) / a - lg.fgMade / lg.fgAtt);
      }
      put("kickAcc", v / att, att, "K", 70);
    }
  }
  if (pos === "P") {
    const n = sum("punts");
    if (n >= 100) {
      let v = 0;
      for (const l of ls) {
        const p = l.punts ?? 0;
        const lg = league.get(l.year);
        if (p && lg?.punts) v += p * ((l.puntYds ?? 0) / p - lg.puntYds / lg.punts);
      }
      put("kickPow", v / n, n, "P", 160);
    }
  }
  for (const m of RATES[pos] ?? []) {
    // Each season's rate against what every man at his position did that season, weighted by
    // how much of it was his.
    let n = 0, v = 0;
    for (const l of ls) {
      if (m.from && l.year < m.from) continue;
      const d = m.den(l);
      const base = posLeague.get(l.year)?.[m.like ?? pos];
      const bd = base ? m.den(base) : 0;
      if (!d || !bd) continue;
      n += d;
      v += m.num(l) - d * (m.num(base) / bd);
    }
    if (n >= m.min) put(m.key, v / n, n, pos, m.shrink);
  }
  return out;
}

/*
 * The skill positions' measures, each a rate (num over den) set against his position's that season:
 *   RB  run    yards a carry, on the running skill he's built on (a power back's breaking
 *              tackles, a scatback's elusiveness)      catch  catches a game
 *   WR  speed  yards a catch (deep threat) catch  catch rate (targets kept from 1999)  rrt  catches a game
 *   TE  catch  catch rate                  rrt    catches a game (a blocker's are few)
 *   CB / S  cov  interceptions a game, with passes defensed (kept from 1999) at a third of one
 *   MLB  tak  tackles a game (kept from 1999). Not a safety's or an edge rusher's: theirs
 *        say more about the defense in front of them, or their role, than their tackling
 */
// A position's totals keep the catches made on lines with targets apart (recT).
const caught = (l) => l.recT ?? (l.targets ? l.rec ?? 0 : 0);
const ballsGp = { num: (l) => (l.ints ?? 0) + (l.pd ?? 0) / 3, den: (l) => l.gp ?? 0, min: 32, shrink: 50 };
const tacklesGp = { num: (l) => l.tackles ?? 0, den: (l) => l.gp ?? 0, from: 1999, min: 32, shrink: 40 };
const RATES = {
  RB: [
    { key: "run", num: (l) => l.rushYds ?? 0, den: (l) => l.rushAtt ?? 0, min: 300, shrink: 600 },
    { key: "catch", num: (l) => l.rec ?? 0, den: (l) => l.gp ?? 0, min: 32, shrink: 48 },
  ],
  WR: [
    { key: "speed", num: (l) => l.recYds ?? 0, den: (l) => l.rec ?? 0, min: 80, shrink: 160 },
    { key: "catch", num: caught, den: (l) => l.targets ?? 0, from: 1999, min: 150, shrink: 300 },
    { key: "rrt", num: (l) => l.rec ?? 0, den: (l) => l.gp ?? 0, min: 32, shrink: 48 },
  ],
  TE: [
    { key: "catch", num: caught, den: (l) => l.targets ?? 0, from: 1999, min: 100, shrink: 250 },
    { key: "rrt", num: (l) => l.rec ?? 0, den: (l) => l.gp ?? 0, min: 32, shrink: 48 },
  ],
  CB: [{ key: "cov", ...ballsGp }],
  S: [{ key: "cov", ...ballsGp }],
  MLB: [{ key: "tak", ...tacklesGp }],
};

/* ---------------- every draftee, measured and built as the game builds him ---------------- */

const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 1 });
const rows = [];
for (let year = 1966; year <= 2025; year++) {
  for (const seed of draftSeedsFor(year)) {
    if (!["QB", "DE", "OLB", "DT", "K", "P", ...Object.keys(RATES)].includes(seed.p)) continue;
    const who = drafted.get(`${year}|${normalizedName(seed.f, seed.l)}`) ?? [];
    if (who.length !== 1) continue;
    const m = measures(who[0], seed.p);
    if (!Object.keys(m).length) continue;
    const p = realDraftee(save, seed, year, false);
    delete save.players[p.id];
    // His ratings at his peak, the frame a seed's ratings are written in: the arc took his key
    // skills down evenly from there to his rookie year.
    const lift = p.potential - p.ovr;
    const built = Object.fromEntries(Object.entries(p.ratings).map(([k, v]) => [k, Math.min(99, v + lift)]));
    const runKey = built.elu >= built.btk ? "elu" : "btk";
    built.run = built[runKey];
    rows.push({ year, seed, m, built, runKey, arch: p.arch, level: p.potential });
  }
}

/*
 * A skill rating should say how much better or worse he was at it than his overall implies: a
 * star's stats are better than a backup's across the board, so ranking raw stats would count his
 * stardom twice (every great passer a 99) and ranking against all ratings would bury starters
 * under backups. Each measure is set against what's usual at his level, and the rating goes that
 * far above or below his overall, up to about eight at the ends. A short career is pulled toward
 * usual by how little it shows. Arm strength isn't measured: yards per completion is a scheme's
 * number, not an arm's (Favre and Flacco came out below average).
 */
const SPREAD = 8;
const fit = new Map(); // "group|key" -> { a, b, resid: sorted residuals }
const byFit = new Map();
for (const r of rows)
  for (const [k, m] of Object.entries(r.m)) {
    const id = `${m.g}|${k}`;
    if (!byFit.has(id)) byFit.set(id, []);
    byFit.get(id).push([r.level, m.v, r.built[k]]);
  }
const line = (pts) => {
  const mx = pts.reduce((n, [x]) => n + x, 0) / pts.length;
  const my = pts.reduce((n, [, y]) => n + y, 0) / pts.length;
  const b = pts.reduce((n, [x, y]) => n + (x - mx) * (y - my), 0) / Math.max(1e-9, pts.reduce((n, [x]) => n + (x - mx) ** 2, 0));
  const a = my - b * mx;
  return { a, b, resid: pts.map(([x, y]) => y - (a + b * x)).sort((u, v) => u - v) };
};
for (const [id, pts] of byFit) {
  if (pts.length < 20) continue;
  // The record's measure at his level, and the rating the game gives at his level: a back's hands
  // sit well under his overall, so his rank among backs sets where in that spread he lands.
  fit.set(id, { ...line(pts), rating: line(pts.map(([x, , z]) => [x, z])) });
}
const valueAt = (list, q) => list[Math.max(0, Math.min(list.length - 1, Math.floor(q * list.length)))];
/** The skills a seed writes level with his overall; any other is shaped by his position. */
const MAX_SHAPE = 10;
const CENTERED = new Set(["throwAcc", "throwAwr", "prs", "kickAcc", "kickPow"]);
const quantileOf = (list, v) => {
  let lo = 0;
  while (lo < list.length && list[lo] < v) lo++;
  return (lo + 0.5) / list.length;
};

const fixes = {};
const report = [];
for (const r of rows) {
  const fix = { rt: {} };
  const ranks = {};
  for (const [k, m] of Object.entries(r.m)) {
    const f = fit.get(`${m.g}|${k}`);
    if (!f) continue;
    const w = m.n / (m.n + m.shrink);
    const q = 0.5 + (quantileOf(f.resid, m.v - (f.a + f.b * r.level)) - 0.5) * w;
    ranks[k] = q;
    const now = r.built[k];
    let target;
    // An outside linebacker's rush sits under his overall (Jack Ham covered): it's shaped, not centered.
    if (CENTERED.has(k) && r.seed.p !== "OLB") target = r.level + (q - 0.5) * 2 * SPREAD;
    else {
      const rf = f.rating;
      // Where his rating already ranks among his position's at his level: only a rank the
      // record plainly disputes moves.
      if (Math.abs(quantileOf(rf.resid, now - (rf.a + rf.b * r.level)) - q) < 0.2) continue;
      const off = valueAt(rf.resid, q);
      const wide = (q - 0.5) * 2 * SPREAD;
      target = rf.a + rf.b * r.level + (Math.abs(off) >= Math.abs(wide) ? off : wide);
      // A record under the middle never raises a rating, one over it never lowers one.
      if ((q < 0.5 && target > now) || (q > 0.5 && target < now)) continue;
      // His build (a power back's hands, a burner's speed) stays his: the record moves it ten at most.
      target = Math.max(now - MAX_SHAPE, Math.min(now + MAX_SHAPE, target));
    }
    target = Math.max(25, Math.min(99, Math.round(target)));
    if (Math.abs(now - target) >= 4) {
      const key = k === "run" ? r.runKey : k;
      fix.rt[key] = target;
      report.push({ who: `${r.year} ${r.seed.f} ${r.seed.l} (${r.seed.p})`, k: key, from: now, to: target, q });
    }
  }
  // Only a label the record plainly contradicts changes: a "precision passer" who wasn't one.
  // A gunslinger stays a gunslinger however often he completed it (Favre).
  if (r.seed.p === "QB" && ranks.throwAcc !== undefined) {
    // An inaccurate "precision passer" who also threw it to the other side was a gunslinger.
    if (r.arch === "deadeye" && ranks.throwAcc < 0.35) fix.arch = (ranks.throwAwr ?? 0.5) < 0.5 ? "cannon" : "manager";
    else if (r.arch === "manager" && ranks.throwAcc >= 0.85) fix.arch = "deadeye";
    if (fix.arch) report.push({ who: `${r.year} ${r.seed.f} ${r.seed.l} (QB)`, k: "arch", from: r.arch, to: fix.arch, q: ranks.throwAcc });
  }
  if (!Object.keys(fix.rt).length) delete fix.rt;
  if (Object.keys(fix).length) fixes[`${r.year}|${r.seed.f}|${r.seed.l}`] = fix;
}

writeFileSync(
  join(G, "data/ratingAudit.ts"),
  "/** Auto-generated by scripts/rating-audit.mjs. Do not hand-edit. */\n" +
    '/** "draft year|first|last" : ratings the record\'s career stats correct, and a corrected archetype. */\n' +
    `export const RATING_FIX: Record<string, { rt?: Record<string, number>; arch?: string }> = ${JSON.stringify(fixes)};\n`,
);
mkdirSync(join(ROOT, "data/audit"), { recursive: true });
const big = report.filter((x) => x.k !== "arch").sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
writeFileSync(
  join(ROOT, "data/audit/rating-audit.md"),
  [
    "# Rating audit",
    "",
    `Draftees measured: ${rows.length}. Players corrected: ${Object.keys(fixes).length}. Ratings changed: ${big.length}. Archetypes changed: ${report.length - big.length}.`,
    "",
    "| Player | Rating | Was | Now | Career percentile |",
    "| --- | --- | --- | --- | --- |",
    ...report.slice().sort((a, b) => a.who.localeCompare(b.who)).map((x) => `| ${x.who} | ${x.k} | ${x.from} | ${x.to} | ${Math.round(x.q * 100)} |`),
    "",
  ].join("\n"),
);
console.log(`measured ${rows.length}; corrected ${Object.keys(fixes).length} players, ${big.length} ratings, ${report.length - big.length} archetypes`);
for (const x of big.slice(0, 12)) console.log(" ", x.who, x.k, x.from, "->", x.to, `(p${Math.round(x.q * 100)})`);
