/**
 * Rating audit: every real draftee's key skill ratings checked against what his career really
 * showed, measured against his own seasons' league. A rating that disagrees with the record
 * by five or more is corrected toward it; the rest of his kit carries his overall, so only the
 * shape changes. Eli Manning, a 60% passer in a 62% league who led it in interceptions three
 * times, came out a 91 in accuracy as a "precision passer".
 *
 *   QB  throwAcc  completion rate over the league's that season
 *       throwAwr  touchdown rate less interception rate, over the league's
 *       arch      a "precision passer" who wasn't one becomes a gunslinger or a game manager
 *   DE / OLB / DT  prs  sacks a game (sacks are kept from 1982)
 *   K   kickAcc   field-goal rate over the league's
 *   P   kickPow   gross average over the league's
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
for (const [y, s] of Object.entries(STATS)) {
  const year = Number(y);
  const lg = { passAtt: 0, passCmp: 0, passYds: 0, passTd: 0, passInt: 0, fgAtt: 0, fgMade: 0, punts: 0, puntYds: 0 };
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
    if (!lines.has(person)) lines.set(person, []);
    lines.get(person).push(line);
  }
  league.set(year, lg);
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

function measures(person, pos) {
  const ls = lines.get(person) ?? [];
  const sum = (k) => ls.reduce((n, l) => n + (l[k] ?? 0), 0);
  const out = {};
  if (pos === "QB") {
    const att = sum("passAtt");
    const cmp = sum("passCmp");
    if (att >= 400 && cmp > 0) {
      let acc = 0, awr = 0, pow = 0;
      for (const l of ls) {
        const a = l.passAtt ?? 0;
        const lg = league.get(l.year);
        if (!a || !lg?.passAtt) continue;
        acc += a * ((l.passCmp ?? 0) / a - lg.passCmp / lg.passAtt);
        awr += a * (((l.passTd ?? 0) - (l.passInt ?? 0)) / a - (lg.passTd - lg.passInt) / lg.passAtt);
        if ((l.passCmp ?? 0) > 0) pow += (l.passCmp ?? 0) * ((l.passYds ?? 0) / l.passCmp - lg.passYds / lg.passCmp);
      }
      out.throwAcc = acc / att;
      out.throwAwr = awr / att;
      out.throwPow = pow / cmp;
      out.n = att;
    }
  }
  if (pos === "DE" || pos === "OLB" || pos === "DT") {
    const since = ls.filter((l) => l.year >= 1982);
    const gp = since.reduce((n, l) => n + (l.gp ?? 0), 0);
    if (gp >= 32) {
      out.prs = since.reduce((n, l) => n + (l.sacks ?? 0), 0) / gp;
      out.n = gp;
    }
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
      out.kickAcc = v / att;
      out.n = att;
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
      out.kickPow = v / n;
      out.n = n;
    }
  }
  return out;
}

/* ---------------- every draftee, measured and built as the game builds him ---------------- */

const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 1 });
const rows = [];
for (let year = 1966; year <= 2025; year++) {
  for (const seed of draftSeedsFor(year)) {
    if (!["QB", "DE", "OLB", "DT", "K", "P"].includes(seed.p)) continue;
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
    rows.push({ year, seed, m, built, arch: p.arch, level: p.potential });
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
const group = (pos) => (pos === "OLB" ? "DE" : pos);
const KEYS = ["throwAcc", "throwAwr", "prs", "kickAcc", "kickPow"];
const SHRINK = { QB: 900, DE: 50, DT: 50, K: 70, P: 160 };
const SPREAD = 8;
const fit = new Map(); // "group|key" -> { a, b, resid: sorted residuals }
for (const k of KEYS) {
  for (const g of ["QB", "DE", "DT", "K", "P"]) {
    const pts = rows.filter((r) => group(r.seed.p) === g && r.m[k] !== undefined).map((r) => [r.level, r.m[k]]);
    if (pts.length < 20) continue;
    const mx = pts.reduce((n, [x]) => n + x, 0) / pts.length;
    const my = pts.reduce((n, [, y]) => n + y, 0) / pts.length;
    const b = pts.reduce((n, [x, y]) => n + (x - mx) * (y - my), 0) / Math.max(1e-9, pts.reduce((n, [x]) => n + (x - mx) ** 2, 0));
    const a = my - b * mx;
    fit.set(`${g}|${k}`, { a, b, resid: pts.map(([x, y]) => y - (a + b * x)).sort((u, v) => u - v) });
  }
}
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
  const g = group(r.seed.p);
  const w = r.m.n / (r.m.n + SHRINK[g]);
  for (const k of KEYS) {
    if (r.m[k] === undefined) continue;
    const f = fit.get(`${g}|${k}`);
    if (!f) continue;
    const q = 0.5 + (quantileOf(f.resid, r.m[k] - (f.a + f.b * r.level)) - 0.5) * w;
    ranks[k] = q;
    const target = Math.max(40, Math.min(99, Math.round(r.level + (q - 0.5) * 2 * SPREAD)));
    const now = r.built[k];
    if (Math.abs(now - target) >= 4) {
      fix.rt[k] = target;
      report.push({ who: `${r.year} ${r.seed.f} ${r.seed.l} (${r.seed.p})`, k, from: now, to: target, q });
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
