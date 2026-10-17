/**
 * Full player audit: every real draftee the game builds, 1966-2025, built exactly as the draft
 * room builds him, checked against what the record says he was. Report only; fixes are applied
 * separately (scripts/rating-audit.mjs and the data files it writes).
 *
 *   peak       his peak overall against players with careers like his (starts, Pro Bowls,
 *              All-Pros, the Hall) at his position
 *   speed      speed and acceleration against his real 40 (the combine, 2000 on)
 *   size       height and weight against the combine and the league's bios
 *   durability his injury rating against the games he really missed as a starter
 *   awareness  a long-time starter's awareness against his overall
 *   archetype  the label against how he played (a "scrambler" who never ran)
 *   position   the game's position against the record's
 *   age        his age at the draft against his birth date
 *   college    the game's school against the record's
 *
 * Writes data/audit/player-full-audit.md and data/audit/player-full-audit.json.
 * Run: node --experimental-strip-types scripts/player-full-audit.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const G = join(ROOT, "src/lib/game");
const { PEOPLE } = await import(join(G, "data/history/people.ts"));
const { DRAFTS } = await import(join(G, "data/history/drafts.ts"));
const { STATS, STAT_FIELDS } = await import(join(G, "data/history/stats.ts"));
const { HOF_CLASSES } = await import(join(G, "data/history/hof.ts"));
const { draftSeedsFor } = await import(join(G, "data/draftClasses.ts"));
const { normalizedName } = await import(join(G, "identity.ts"));
const { createNewGame } = await import(join(G, "index.ts"));
const { realDraftee } = await import(join(G, "draft.ts"));
const { gamesInSeason } = await import(join(G, "teams.ts"));

const id36 = (s) => parseInt(s, 36);
const people = PEOPLE.split("\n").map((l) => {
  const [first, last, pos, birth, college] = l.split("|");
  return { first, last, pos, birth: birth ? Number(birth.slice(0, 4)) : undefined, college };
});
const GROUP = { QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE", LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL", DE: "DL", DT: "DL", OLB: "LB", MLB: "LB", CB: "DB", S: "DB", K: "K", P: "P" };

/* ---------------- the record: seasons, the Hall, the draft ---------------- */

const F = Object.fromEntries(STAT_FIELDS.map((k, i) => [k, i + 2]));
const lines = new Map();
for (const [y, s] of Object.entries(STATS)) {
  for (const row of s.split("|")) {
    if (!row) continue;
    const c = row.split(",");
    const line = { year: Number(y) };
    for (const [k, j] of Object.entries(F)) if (c[j] && c[j] !== "?") line[k] = Number(c[j]);
    const p = id36(c[0]);
    if (!lines.has(p)) lines.set(p, []);
    lines.get(p).push(line);
  }
}
const hof = new Set();
for (const v of Object.values(HOF_CLASSES)) for (const x of v.split("/")) if (x && !x.startsWith("~")) hof.add(id36(x));
const drafted = new Map();
for (const [y, s] of Object.entries(DRAFTS))
  for (const e of s.split("|")) {
    const pid = id36(e.split(",")[3]);
    const w = people[pid];
    if (!w) continue;
    const k = `${y}|${normalizedName(w.first, w.last)}`;
    drafted.set(k, [...(drafted.get(k) ?? []), pid]);
  }

/* ---------------- measurements: the combine (2000 on) and the league's bios ---------------- */

function csv(path) {
  const text = readFileSync(path, "utf8").trim().split("\n");
  const head = text[0].split(",");
  return text.slice(1).map((l) => {
    const out = {};
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [];
    head.forEach((h, i) => (out[h] = (cells[i] ?? "").replace(/,$/, "").replace(/^"|"$/g, "")));
    return out;
  });
}
const inches = (s) => {
  const m = /^(\d+)-(\d+)$/.exec(s ?? "");
  return m ? Number(m[1]) * 12 + Number(m[2]) : Number(s) || 0;
};
const combine = new Map();
for (const r of csv(join(ROOT, "data/combine/combine.csv"))) {
  const [f, ...l] = r.player_name.split(" ");
  combine.set(`${r.draft_year || r.season}|${normalizedName(f, l.join(" "))}`, { forty: Number(r.forty) || 0, ht: inches(r.ht), wt: Number(r.wt) || 0 });
}
for (const r of csv(join(ROOT, "data/combine/combine-1987-1999.csv"))) {
  const [f, ...l] = r.player_name.split(" ");
  const k = `${r.season}|${normalizedName(f, l.join(" "))}`;
  if (!combine.has(k) && Number(r.forty)) combine.set(k, { forty: Number(r.forty), ht: 0, wt: 0 });
}
const bios = new Map();
for (const r of csv(join(ROOT, "data/players/players.csv"))) {
  const k = normalizedName(r.first_name, r.last_name);
  if (!bios.has(k)) bios.set(k, []);
  bios.get(k).push({ rookie: Number(r.rookie_season) || 0, ht: Number(r.height) || 0, wt: Number(r.weight) || 0, pos: r.position });
}

/* ---------------- every draftee, built as the game builds him ---------------- */

const save = createNewGame({ userTeamId: "pit", startingYear: 1966, seed: 1 });
const rows = [];
for (let year = 1966; year <= 2025; year++) {
  for (const seed of draftSeedsFor(year)) {
    const who = drafted.get(`${year}|${normalizedName(seed.f, seed.l)}`) ?? [];
    const person = who.length === 1 ? who[0] : undefined;
    save.year = year;
    const p = realDraftee(save, seed, year);
    delete save.players[p.id];
    const lift = p.potential - p.ovr;
    const peak = Object.fromEntries(Object.entries(p.ratings).map(([k, v]) => [k, Math.min(99, v + lift)]));
    rows.push({ year, seed, person, p, peak, arc: p.arc, ls: person !== undefined ? (lines.get(person) ?? []) : [] });
  }
}

const flags = [];
const flag = (r, check, detail, severity = 1, change) =>
  flags.push({ check, severity, key: `${r.year}|${r.seed.f}|${r.seed.l}`, who: `${r.year} ${r.seed.f} ${r.seed.l}`, pos: r.seed.p, peak: r.p.potential, detail, ...change });
const pct = (list, v) => {
  let n = 0;
  for (const x of list) if (x < v) n++;
  return list.length ? n / list.length : 0.5;
};

/* peak: against careers like his */
const careerKey = (r) => {
  const a = r.arc;
  if (!a || a.to <= 0) return undefined;
  const len = Math.max(1, a.to - a.dy + 1);
  const st = a.st >= 8 ? "st8" : a.st >= 4 ? "st4" : a.st >= 1 ? "st1" : "st0";
  const pb = a.pb >= 6 ? "pb6" : a.pb >= 3 ? "pb3" : a.pb >= 1 ? "pb1" : "pb0";
  return `${GROUP[r.seed.p]}|${st}|${pb}|${r.person !== undefined && hof.has(r.person) ? "hof" : ""}|${len >= 10 ? "long" : ""}`;
};
const peers = new Map();
for (const r of rows) {
  const k = careerKey(r);
  if (!k || r.year > 2018) continue;
  if (!peers.has(k)) peers.set(k, []);
  peers.get(k).push(r.p.potential);
}
for (const v of peers.values()) v.sort((a, b) => a - b);
for (const r of rows) {
  const k = careerKey(r);
  const list = k && peers.get(k);
  if (!list || list.length < 12 || r.year > 2018) continue;
  // Outside the usual range for careers like his (the tenth to the ninetieth percentile, with a
  // few points of slack), not merely off the middle: careers in one bucket still differ.
  const med = list[list.length >> 1];
  const lo = list[Math.floor(list.length * 0.1)] - 3;
  const hi = list[Math.floor(list.length * 0.9)] + 3;
  const d = r.p.potential < lo ? r.p.potential - lo : r.p.potential > hi ? r.p.potential - hi : 0;
  if (d) {
    const a = r.arc;
    flag(r, "peak", `peak ${r.p.potential}; careers like his (${a.st} seasons starting, ${a.pb} Pro Bowls, ${a.ap} All-Pro${hof.has(r.person) ? ", Hall of Fame" : ""}) peak at ${med} (usually ${lo + 3}-${hi - 3})`, Math.abs(d) >= 5 ? 2 : 1, { rating: "overall", current: r.p.potential, proposed: d < 0 ? lo + 3 : hi - 3 });
  }
}

/* speed: against the real 40 */
const meas = new Map();
for (const r of rows) {
  const c = combine.get(`${r.year}|${normalizedName(r.seed.f, r.seed.l)}`);
  if (c) meas.set(r, c);
}
// Same yardstick the fix uses (scripts/rating-audit.mjs): among his position's players at his
// level, his speed should rank where his real 40 does. Off by 8+ after the fix means it didn't take.
const fitLine = (pts) => {
  const mx = pts.reduce((n, [x]) => n + x, 0) / pts.length;
  const my = pts.reduce((n, [, y]) => n + y, 0) / pts.length;
  const b = pts.reduce((n, [x, y]) => n + (x - mx) * (y - my), 0) / Math.max(1e-9, pts.reduce((n, [x]) => n + (x - mx) ** 2, 0));
  const a = my - b * mx;
  return { a, b, resid: pts.map(([x, y]) => y - (a + b * x)).sort((u, v) => u - v) };
};
const byGroup = new Map();
for (const r of rows) {
  const c = meas.get(r);
  if (!c?.forty) continue;
  const g = GROUP[r.p.pos];
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(r);
}
const speedModel = new Map([...byGroup].map(([g, list]) => [g, { forties: list.map((r) => meas.get(r).forty).sort((a, b) => a - b), fit: fitLine(list.map((r) => [r.p.potential, r.peak.speed])) }]));
let speedChecked = 0;
let fortyWrong = 0;
for (const r of rows) {
  const c = meas.get(r);
  if (!c?.forty) continue;
  speedChecked++;
  if (Math.abs((r.p.forty ?? 0) - c.forty) >= 0.1) fortyWrong++;
  const m = speedModel.get(GROUP[r.p.pos]);
  if (!m || m.forties.length < 30) continue;
  const q = 1 - pct(m.forties, c.forty + 1e-9);
  const res = m.fit.resid;
  const want = Math.round(m.fit.a + m.fit.b * r.p.potential + res[Math.min(res.length - 1, Math.floor(q * res.length))]);
  const d = r.peak.speed - want;
  if (Math.abs(d) >= 8) flag(r, "speed", `speed ${r.peak.speed}; ran ${c.forty.toFixed(2)} at the combine, about a ${want} for his position and level`, Math.abs(d) >= 14 ? 2 : 1);
}

/* size: against the combine, else the league's bios */
let sizeChecked = 0;
for (const r of rows) {
  let real = meas.get(r);
  if (!real?.wt) {
    const BIO = { QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE", T: "OL", G: "OL", C: "OL", OL: "OL", OT: "OL", OG: "OL", DE: "DL", DT: "DL", NT: "DL", DL: "DL", LB: "LB", ILB: "LB", OLB: "LB", MLB: "LB", CB: "DB", S: "DB", SS: "DB", FS: "DB", DB: "DB", K: "K", P: "P" };
    const b = (bios.get(normalizedName(r.seed.f, r.seed.l)) ?? []).filter((x) => Math.abs(x.rookie - r.year) <= 1 && x.wt && BIO[x.pos] === GROUP[r.seed.p]);
    real = b.length === 1 ? b[0] : undefined;
  }
  if (!real?.wt) continue;
  sizeChecked++;
  const dh = (r.p.heightIn ?? 0) - real.ht;
  const dw = (r.p.weight ?? 0) - real.wt;
  if ((real.ht && Math.abs(dh) >= 2) || Math.abs(dw) >= 15)
    flag(r, "size", `listed ${r.p.heightIn}" ${r.p.weight} lb; really ${real.ht || "?"}" ${real.wt} lb`, Math.abs(dw) >= 30 || Math.abs(dh) >= 3 ? 2 : 1);
}

/* durability: injury rating against games missed while a starter */
for (const r of rows) {
  const a = r.arc;
  if (!a || a.to <= 0 || a.to > 2025) continue;
  const len = a.to - a.dy + 1;
  if (len < 5 || a.st / len < 0.6) continue;
  let possible = 0;
  for (let y = a.dy; y <= a.to; y++) possible += gamesInSeason(y);
  const miss = 1 - a.g / Math.max(1, possible);
  const inj = r.p.ratings.inj;
  if (inj >= 85 && miss >= 0.3) flag(r, "durability", `injury rating ${inj}; missed ${Math.round(miss * 100)}% of games over ${len} seasons as a regular`, miss >= 0.4 ? 2 : 1, { rating: "injury", current: inj, proposed: 66 });
  if (inj <= 62 && miss <= 0.04 && len >= 8) flag(r, "durability", `injury rating ${inj}; missed ${Math.max(0, Math.round(miss * 100))}% of games over ${len} seasons (an iron man)`, 1, { rating: "injury", current: inj, proposed: 82 });
}

/* awareness: a long-time starter's football sense */
for (const r of rows) {
  const a = r.arc;
  if (!a || a.st < 8) continue;
  const d = r.peak.awareness - r.p.potential;
  if (d <= -14) flag(r, "awareness", `awareness ${r.peak.awareness} at a ${r.p.potential} peak after ${a.st} seasons starting`, d <= -20 ? 2 : 1);
}

/* archetype: the label against how he played */
const per = (ls, num, den) => {
  const n = ls.reduce((s, l) => s + (num(l) ?? 0), 0);
  const d = ls.reduce((s, l) => s + (den(l) ?? 0), 0);
  return d ? n / d : undefined;
};
const measures = {
  qbRush: (r) => (r.ls.reduce((n, l) => n + (l.passAtt ?? 0), 0) >= 400 ? per(r.ls, (l) => l.rushYds, (l) => l.gp) : undefined),
  ypr: (r) => (r.ls.reduce((n, l) => n + (l.rec ?? 0), 0) >= 80 ? per(r.ls, (l) => l.recYds, (l) => l.rec) : undefined),
  rbRec: (r) => (r.ls.reduce((n, l) => n + (l.gp ?? 0), 0) >= 32 && r.ls.reduce((n, l) => n + (l.rushAtt ?? 0), 0) >= 200 ? per(r.ls, (l) => l.rec, (l) => l.gp) : undefined),
};
const dist = {};
for (const [k, f] of Object.entries(measures)) dist[k] = rows.map(f).filter((v) => v !== undefined).sort((a, b) => a - b);
for (const r of rows) {
  const arch = r.p.arch;
  if (!arch) continue;
  const q = (k) => {
    const v = measures[k](r);
    return v === undefined ? undefined : pct(dist[k], v);
  };
  if (r.seed.p === "QB" && (arch === "scrambler" || arch === "dual")) {
    const x = q("qbRush");
    if (x !== undefined && x < 0.3) flag(r, "archetype", `"${arch}" but ran for fewer yards a game than ${Math.round((1 - x) * 100)}% of passers`, 1, { rating: "archetype", current: arch, proposed: "manager" });
  }
  if (r.seed.p === "WR" && arch === "burner") {
    const x = q("ypr");
    if (x !== undefined && x < 0.2) flag(r, "archetype", `"burner" but his yards a catch rank in the bottom ${Math.round(x * 100) || 1}% of receivers`, 1, { rating: "archetype", current: arch, proposed: "possession" });
  }
  if (r.seed.p === "WR" && arch === "possession") {
    const x = q("ypr");
    if (x !== undefined && x > 0.9) flag(r, "archetype", `"possession" receiver whose yards a catch rank in the top ${Math.round((1 - x) * 100) || 1}%`, 1, { rating: "archetype", current: arch, proposed: "burner" });
  }
  if (r.seed.p === "RB" && arch === "receiving-back") {
    const x = q("rbRec");
    if (x !== undefined && x < 0.25) flag(r, "archetype", `"receiving back" with fewer catches a game than ${Math.round((1 - x) * 100)}% of backs`, 1, { rating: "archetype", current: arch, proposed: "elusive" });
  }
}

/* position, age, college: against the record */
for (const r of rows) {
  if (r.person === undefined) continue;
  const w = people[r.person];
  const ls = r.ls;
  const att = ls.reduce((n, l) => n + (l.passAtt ?? 0), 0);
  const rush = ls.reduce((n, l) => n + (l.rushAtt ?? 0), 0);
  const rec = ls.reduce((n, l) => n + (l.rec ?? 0), 0);
  const tk = ls.reduce((n, l) => n + (l.tackles ?? 0) + (l.ints ?? 0) * 5 + (l.sacks ?? 0) * 3, 0);
  const g = GROUP[r.p.pos];
  // Only a man the record lists elsewhere, and whose stats say the same (a "tight end" with 300
  // carries, a "receiver" with 50 sacks). A back who caught passes is still a back.
  const recG = GROUP[w.pos];
  const stats = att >= 300 ? "QB" : rush >= 400 && rush > rec * 1.5 ? "RB" : rec >= 150 ? "REC" : tk >= 300 ? "DEF" : undefined;
  const fits = (grp, st) => (st === "QB" ? grp === "QB" : st === "RB" ? grp === "RB" : st === "REC" ? ["WR", "TE", "RB"].includes(grp) : st === "DEF" ? ["DL", "LB", "DB"].includes(grp) : true);
  if (recG && recG !== g && !(recG === "RB" && g === "RB")) {
    if (stats && fits(recG, stats) && !fits(g, stats)) flag(r, "position", `the game has him at ${r.p.pos}; the record lists ${w.pos}, and he played like it (${att} passes, ${rush} carries, ${rec} catches)`, 2, { rating: "position", current: r.p.pos, proposed: w.pos });
    else if (!stats && !(["OL"].includes(recG) && ["OL"].includes(g))) flag(r, "position", `the game has him at ${r.p.pos}; the record lists ${w.pos}`, 1);
  }
  if (w.birth) {
    const age = r.year - w.birth;
    if (Math.abs(age - r.p.age) >= 2) flag(r, "age", `drafted at ${r.p.age} in the game; born ${w.birth}, so about ${age}`, 1, { rating: "age at draft", current: r.p.age, proposed: age });
  }
  const ALIAS = { nc: "northcarolina", texasai: "texasamkingsville", arkansasamn: "arkansaspinebluff", southwesternlouisiana: "louisianalafayette", middletennst: "middletennessee", sfaustin: "stephenfaustin", usc: "southerncalifornia", lsu: "louisiana", ucla: "californialosangeles", smu: "southernmethodist", tcu: "texaschristian", byu: "brighamyoung", unlv: "nevadalasvegas", olemiss: "mississippi", pitt: "pittsburgh", utep: "texaselpaso", ucf: "centralflorida", uab: "alabamabirmingham", vmi: "virginiamilitary", miamifl: "miami", miamifla: "miami" };
  const school = (s) => {
    const k = (s ?? "")
      .toLowerCase()
      .replace(/&amp;/g, "&")
      .split(/[^a-z]+/)
      .filter((w) => w && !["university", "college", "state", "of", "the", "at"].includes(w))
      .join("");
    return ALIAS[k] ?? k;
  };
  // A school by another name (NC State, North Carolina State) or its name back then (Texas A&I)
  // shares a word: only two schools with nothing in common are flagged.
  const words = (x) => new Set((x ?? "").toLowerCase().replace(/&amp;/g, "&").split(/[^a-z&]+/).filter((t) => t.length >= 4 && !["university", "college", "state", "north", "south", "east", "west", "central", "southern", "northern", "eastern", "western", "texas"].includes(t)));
  const shared = [...words(w.college)].some((t) => words(r.p.college).has(t));
  if (w.college && r.p.college && school(w.college) && school(r.p.college) && !shared && !school(w.college).includes(school(r.p.college)) && !school(r.p.college).includes(school(w.college)))
    flag(r, "college", `the game says ${r.p.college}; the record says ${w.college}`);
}

/* ---------------- the report ---------------- */

const CHECKS = ["peak", "speed", "size", "durability", "awareness", "archetype", "position", "age", "college"];
const matched = rows.filter((r) => r.person !== undefined).length;
const by = Object.fromEntries(CHECKS.map((c) => [c, flags.filter((f) => f.check === c)]));
const stars = (f) => (f.severity >= 2 ? "**" : "");
mkdirSync(join(ROOT, "data/audit"), { recursive: true });
writeFileSync(join(ROOT, "data/audit/player-full-audit.json"), JSON.stringify(flags));
const md = [
  "# Full player audit",
  "",
  `Draftees built: ${rows.length.toLocaleString("en-US")} (1966-2025), ${matched.toLocaleString("en-US")} matched to one man in the record. Flags: ${flags.length.toLocaleString("en-US")} on ${new Set(flags.map((f) => f.who)).size.toLocaleString("en-US")} players (**bold** = far off).`,
  "",
  `Real 40 times available for ${speedChecked.toLocaleString("en-US")} draftees (the combine, 2000 on); the game's listed 40 is off by a tenth or more for ${fortyWrong.toLocaleString("en-US")} of them. Size checked for ${sizeChecked.toLocaleString("en-US")}.`,
  "",
  "| Check | Flags | Far off |",
  "| --- | --- | --- |",
  ...CHECKS.map((c) => `| ${c} | ${by[c].length} | ${by[c].filter((f) => f.severity >= 2).length} |`),
  "",
];
for (const c of CHECKS) {
  const list = by[c].slice().sort((a, b) => b.severity - a.severity || b.peak - a.peak);
  md.push(`## ${c} (${list.length})`, "");
  for (const f of list.slice(0, 60)) md.push(`- ${stars(f)}${f.who} (${f.pos}, peak ${f.peak})${stars(f)}: ${f.detail}`);
  if (list.length > 60) md.push(`- …and ${list.length - 60} more in player-full-audit.json`);
  md.push("");
}
writeFileSync(join(ROOT, "data/audit/player-full-audit.md"), md.join("\n"));
console.log(`built ${rows.length}, matched ${matched}, flags ${flags.length}`);
for (const c of CHECKS) console.log(" ", c, by[c].length, "far off", by[c].filter((f) => f.severity >= 2).length);
