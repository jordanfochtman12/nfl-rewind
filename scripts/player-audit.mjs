/**
 * Player audit: every named player the regular game can use (the draft classes, the 1966
 * veterans, the undrafted list) checked against the real record, the same sources History
 * mode plays from (nflverse / Pro-Football-Reference people, drafts and rosters, and the Pro
 * Football Archives' team-season rosters with games, starts, numbers, ages, heights, weights
 * and colleges). It writes:
 *
 *   src/lib/game/data/auditPlayers.ts  corrections and the real players the catalogs missed
 *   data/audit/player-audit.md         what it found and changed
 *
 * Run: node --experimental-strip-types scripts/player-audit.mjs
 *
 * Only confident identities are corrected: the same name in the same draft class (and the same
 * round when the catalog knows one), or a 1966 veteran on that club's real roster. Everything
 * else is reported, never guessed.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const G = join(ROOT, "src/lib/game");
const gameModule = (path) => import(pathToFileURL(path).href);
const { PEOPLE } = await gameModule(join(G, "data/history/people.ts"));
const { DRAFTS } = await gameModule(join(G, "data/history/drafts.ts"));
const { ROSTERS } = await gameModule(join(G, "data/history/rosters.ts"));
const { STATS, STAT_FIELDS } = await gameModule(join(G, "data/history/stats.ts"));
const { draftSeedsBase } = await gameModule(join(G, "data/draftClasses.ts"));
const { VETERANS_1966 } = await gameModule(join(G, "data/veterans1966.ts"));
const { UNDRAFTED_ARCS } = await gameModule(join(G, "data/undrafted.ts"));
const { CAREER_ARCS, VET_ARCS } = await gameModule(join(G, "data/careerArcs.ts"));
const { normalizedName } = await gameModule(join(G, "identity.ts"));

const FIRST = 1966;
const LAST = 2025;
const id36 = (s) => parseInt(s, 36);
/** careerArc.ts keys: "first|last", lowercased, periods and apostrophes dropped. */
const arcKey = (f, l) => `${f}|${l}`.toLowerCase().replace(/[.'’`]/g, "");
const decode = (s) => (s ?? "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();

/* ---------------- the real record ---------------- */

const people = PEOPLE.split("\n").map((l, i) => {
  const [first, last, pos, birth, college] = l.split("|");
  return { id: i, first, last, pos, birth, college: decode(college) };
});

const draftsOf = new Map(); // person -> every draft row linked to him (namesakes get mislinked)
for (const [y, s] of Object.entries(DRAFTS))
  for (const e of s.split("|")) {
    const [round, pick, team, pid] = e.split(",");
    const p = id36(pid);
    if (!draftsOf.has(p)) draftsOf.set(p, []);
    draftsOf.get(p).push({ year: Number(y), round: Number(round), pick: Number(pick), team });
  }
/** His real draft: the linked row his career fits (he can't play before he's drafted). */
function draftOf(person, firstSeason) {
  const rows = draftsOf.get(person) ?? [];
  if (firstSeason === undefined) return rows[0];
  return rows.filter((d) => firstSeason >= d.year && firstSeason <= d.year + 3).sort((a, b) => a.year - b.year)[0];
}

const rosterSeasons = new Map(); // person -> [{year, team, jersey}]
for (const [y, s] of Object.entries(ROSTERS))
  for (const chunk of s.split(";")) {
    const [team, list] = chunk.split(":");
    for (const e of (list ?? "").split(",")) {
      if (!e) continue;
      const [pid, j] = e.split(".");
      const p = id36(pid);
      if (!rosterSeasons.has(p)) rosterSeasons.set(p, []);
      rosterSeasons.get(p).push({ year: Number(y), team, jersey: j ? Number(j) : undefined });
    }
  }

// Kicking and punting in the real stat lines: a two-way lineman listed at tackle who kicked.
const kicked = new Set();
const punted = new Set();
const fgi = STAT_FIELDS.indexOf("fgAtt");
const pti = STAT_FIELDS.indexOf("punts");
for (const s of Object.values(STATS))
  for (const row of s.split("|")) {
    if (!row) continue;
    const c = row.split(",");
    if (Number(c[fgi + 2]) > 0) kicked.add(id36(c[0]));
    if (Number(c[pti + 2]) > 0) punted.add(id36(c[0]));
  }

// The archive's team-season rosters, for every season a player touched (1940 on).
const archToPerson = new Map();
for (const line of readFileSync(join(ROOT, "data/history/pfa_ids.csv"), "utf8").split("\n")) {
  const [a, p] = line.split(",");
  if (a && p) archToPerson.set(a, Number(p));
}
function csvRow(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
const archive = new Map(); // person -> [{year, code, no, pos, ht, wt, age, college, gp, gs}]
for (let y = 1940; y <= LAST; y++) {
  const f = join(ROOT, `data/history/pfa/${y}.csv`);
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.includes(",ROSTER,")) continue;
    const c = csvRow(line);
    if (c[1] !== "ROSTER" || !c[2]) continue;
    const p = archToPerson.get(c[2]);
    if (p === undefined) continue;
    const [ft, inch] = (c[6] ?? "").split("-").map(Number);
    if (!archive.has(p)) archive.set(p, []);
    archive.get(p).push({
      year: y,
      code: c[0],
      no: Number(c[4]) || undefined,
      pos: c[5] ?? "",
      ht: ft ? ft * 12 + (inch || 0) : undefined,
      wt: Number(c[7]) || undefined,
      age: Number(c[8]) || undefined,
      college: decode(c[9]),
      gp: Number(c[10]) || 0,
      gs: Number(c[11]) || 0,
    });
  }
}

/**
 * The archive's position code to the game's. Codes carry a side (LOT, RDE, LCB), two-way
 * players list both ("LOT-LDT"), and the first listed is the one he mostly played. In these
 * rosters LS/RS are the left and right safeties; long snappers are "LONG".
 */
const CODE = {
  QB: "QB", HB: "RB", RB: "RB", TB: "RB", WB: "RB", OH: "RB", FB: "FB", BB: "FB",
  WR: "WR", FL: "WR", SE: "WR", SL: "WR", OE: "WR", E: "WR", TE: "TE", HBK: "TE", H: "TE",
  LOT: "LT", ROT: "RT", OT: "LT", T: "LT", LT: "LT", RT: "RT", LOG: "LG", ROG: "RG", OG: "LG", G: "LG", LG: "LG", RG: "RG", OL: "LG", C: "C", LONG: "C",
  DE: "DE", DL: "DE", EDGE: "DE", DT: "DT", NT: "DT", MG: "DT", NG: "DT", DG: "DT",
  LB: "MLB", MLB: "MLB", ILB: "MLB", JLB: "MLB", OLB: "OLB", WLB: "OLB", SLB: "OLB", RUSH: "OLB", LLB: "OLB", RLB: "OLB",
  CB: "CB", DB: "CB", NB: "CB", DH: "CB", S: "S", SS: "S", FS: "S", LS: "S", RS: "S", DS: "S", K: "K", PK: "K", P: "P",
};
function gamePos(code) {
  const first = (code ?? "").toUpperCase().split("-")[0].trim();
  if (!first) return undefined;
  if (CODE[first]) return CODE[first];
  // A side prefix: L/R, then O(ffense) or D(efense).
  const side = first.match(/^(L|R)(O|D)?(.+)$/);
  if (side) {
    const [, lr, od, rest] = side;
    if (od === "O") {
      if (rest === "T") return lr === "L" ? "LT" : "RT";
      if (rest === "G") return lr === "L" ? "LG" : "RG";
      if (rest === "E") return "WR";
      if (rest === "H") return "RB";
      if (rest === "LB") return "OLB";
    }
    if (od === "D") {
      if (rest === "E") return "DE";
      if (rest === "T" || rest === "G") return "DT";
      if (rest === "H") return "CB";
    }
    if (!od && CODE[rest]) return CODE[rest] === "MLB" ? (rest === "ILB" ? "MLB" : "OLB") : CODE[rest];
  }
  return undefined;
}

/** Everything we know about a person's real career. */
function career(person) {
  const rows = (archive.get(person) ?? []).slice().sort((a, b) => a.year - b.year);
  const games = rows.reduce((n, r) => n + r.gp, 0);
  const starters = rows.filter((r) => r.gp >= 6 && r.gs >= Math.max(6, r.gp * 0.5)).length;
  const byPos = new Map();
  for (const r of rows) {
    const p = gamePos(r.pos, person);
    if (p) byPos.set(p, (byPos.get(p) ?? 0) + Math.max(1, r.gp));
  }
  let pos = [...byPos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? people[person]?.pos;
  if (kicked.has(person) && !["K", "P"].includes(pos) && rows.length && rows.every((r) => !r.gs)) pos = "K";
  if (punted.has(person) && pos !== "P" && rows.every((r) => !r.gs) && !kicked.has(person)) pos = "P";
  const firstRow = rows[0];
  return {
    rows,
    games,
    starters,
    pos,
    first: firstRow?.year,
    last: rows.at(-1)?.year,
    ageIn: firstRow?.age,
    // Typos in the archive (a 25-pound end) never make it in.
    ht: rows.find((r) => r.ht >= 64 && r.ht <= 86)?.ht,
    wt: rows.find((r) => r.wt >= 140 && r.wt <= 400)?.wt,
    college: [rows.find((r) => r.college)?.college, people[person]?.college].find((x) => x && !/^(none|n\/a|-)$/i.test(x)),
  };
}

/** The school a player came to the league from: the last one the archive lists, skipping junior colleges. */
function finalSchool(c) {
  if (!c) return undefined;
  const parts = c.split(";").map((x) => x.trim()).filter(Boolean);
  const four = parts.filter((x) => !/\b(JC|CC|J\. ?C\.|Junior College|Community College)\b/i.test(x));
  return (four.length ? four : parts).at(-1);
}

/* ---------------- matching ---------------- */

const NICK = [
  ["jim", "james", "jimmy", "jimmie"], ["bob", "robert", "bobby", "rob", "robbie", "bert"], ["bill", "william", "billy", "will", "willie", "willy"],
  ["mike", "michael", "mickey", "mick"], ["dave", "david", "davey"], ["tom", "thomas", "tommy"], ["dick", "richard", "rick", "ricky", "rich", "richie"],
  ["chuck", "charles", "charlie", "chas"], ["ed", "edward", "eddie", "ted", "teddy", "edwin"], ["joe", "joseph", "joey"], ["tony", "anthony"],
  ["ron", "ronald", "ronnie"], ["don", "donald", "donnie", "donny"], ["larry", "lawrence", "lars"], ["jerry", "gerald", "gerry", "jerome"],
  ["gene", "eugene"], ["ken", "kenneth", "kenny"], ["steve", "steven", "stephen"], ["dan", "daniel", "danny"], ["pat", "patrick"],
  ["fred", "frederick", "freddie", "freddy"], ["al", "albert", "alan", "allen", "alvin", "allan"], ["sam", "samuel", "sammy"],
  ["ben", "benjamin", "benny"], ["matt", "matthew"], ["chris", "christopher"], ["greg", "gregory"], ["andy", "andrew", "drew"],
  ["tim", "timothy", "timmy"], ["nick", "nicholas"], ["johnny", "john", "jack", "jon"], ["jeff", "jeffrey", "geoff"], ["doug", "douglas"],
  ["herb", "herbert"], ["walt", "walter", "wally"], ["ray", "raymond"], ["frank", "francis", "frankie"], ["hank", "henry"], ["harry", "harold", "hal"],
  ["leo", "leonard", "len", "lenny"], ["vince", "vincent"], ["phil", "phillip", "philip"], ["les", "lester", "leslie"], ["cliff", "clifford"],
  ["ernie", "ernest"], ["mel", "melvin"], ["marv", "marvin"], ["lou", "louis"], ["art", "arthur"], ["jake", "jacob"], ["zach", "zachary"],
  ["josh", "joshua"], ["nate", "nathan", "nathaniel"], ["jay", "james"], ["eddie", "ed"], ["norm", "norman"], ["russ", "russell"], ["stan", "stanley"],
];
const nickOf = new Map();
for (const g of NICK) for (const n of g) nickOf.set(n, [...(nickOf.get(n) ?? []), ...g]);
const nameKey = (f, l) => normalizedName(f, l).replace(/[^a-z]/g, "");
/** The key the game looks fixes up by (draftClasses.ts, veterans1966.ts). */
const runKey = (f, l) => normalizedName(f, l);
const lastKey = (l) => normalizedName("", l).replace(/(jr|sr|ii|iii|iv)$/, "");
const firstKey = (f) => normalizedName(f, "");
const sameFirst = (a, b) => {
  const x = firstKey(a);
  const y = firstKey(b);
  return x === y || (nickOf.get(x) ?? []).includes(y) || x.startsWith(y) || y.startsWith(x);
};

const COLLEGE_SAME = [
  ["lsu", "louisianastate"], ["usc", "southerncalifornia"], ["smu", "southernmethodist"], ["tcu", "texaschristian"], ["ucla", "californialosangeles"],
  ["byu", "brighamyoung"], ["unlv", "nevadalasvegas"], ["utep", "texaselpaso", "texaswestern"], ["olemiss", "mississippi"], ["pitt", "pittsburgh"],
  ["miamifl", "miamiflorida", "miami"], ["ucf", "centralflorida"], ["uab", "alabamabirmingham"], ["umass", "massachusetts"], ["uconn", "connecticut"],
  ["texasai", "texasamkingsville", "texasaandi"], ["westtexasstate", "westtexasam"], ["losangelesstate", "calstatelosangeles", "calstatela"],
  ["southwesternlouisiana", "louisianalafayette", "louisiana"], ["northeastlouisiana", "louisianamonroe"], ["southwesttexasstate", "texasstate"],
  ["northtexasstate", "northtexas"], ["memphisstate", "memphis"], ["longbeachstate", "calstatelongbeach"], ["sanfernandovalleystate", "calstatenorthridge"],
  ["mdeasternshore", "marylandeasternshore"], ["arkansasampn", "arkansaspinebluff", "amnormal"], ["pananerican", "texaspanamerican"],
  ["kent", "kentstate"], ["ncstate", "northcarolinastate"], ["vatech", "virginiatech"], ["gatech", "georgiatech"], ["pennstate", "pennsylvaniastate"],
  ["washingtonstate", "washstate"], ["iup", "indianapennsylvania"], ["centralmissouristate", "centralmissouri"], ["westernstate", "westerncolorado", "westernstatecolorado"],
  ["missourisouthern", "missourisouthernstate"], ["vmi", "virginiamilitary"], ["swmissouristate", "missouristate", "southwestmissouristate"], ["illinoisnormal", "illinoisstate"],
  ["semissouristate", "southeastmissouristate"], ["nwmissouristate", "northwestmissouristate"], ["centralstateok", "centraloklahoma"], ["penn", "pennsylvania"], ["livingston", "westalabama", "livingstonstate"], ["northeastmissouri", "trumanstate", "northeastmissouristate"],
  ["coloradocol", "coloradocollege"], ["rhodes", "southwesterntennessee", "southwesternmemphis"], ["glassboro", "glassborostate", "rowan"], ["sanfranciscostate", "sfstate"], ["alcornam", "alcornstate"], ["marylandstate", "marylandeasternshore"], ["westtexasstate", "westtexasam"],
  ["northwesternlouisiana", "northwesternstatelouisiana", "northwesternstate", "nwlouisiana"], ["cwpost", "longislandpost", "liupost"],
  ["arkansasamn", "arkansaspinebluff", "arkpinebluff", "amandnarkansas"], ["calstatesanfrancisco", "sanfranciscostate"],
  ["northwesternoklahomastate", "nwoklahomastate"], ["arlingtonstate", "texasarlington"], ["easttexasstate", "easttexasam", "texasamcommerce"],
  ["centralstateoklahoma", "centraloklahoma", "centralstateok"], ["southeasternlouisiana", "selouisiana"], ["sanfernandovalleystate", "calstatenorthridge", "valleystate"],
  ["sanjosestate", "sanjose"], ["northeastmissouristate", "trumanstate"], ["southwestmissouristate", "missouristate"], ["westernstatecolorado", "westerncolorado"],
  ["lamar", "lamartech"], ["prairieviewam", "prairieview"], ["texassouthern", "texassou"], ["alabamaam", "alabamaandm"], ["northcarolinaat", "northcarolinaandt"],
  ["southcarolinastate", "scstate"], ["stephenfaustin", "stephenfaustinstate"], ["southernillinois", "siu"], ["mississippivalleystate", "mississippivalley"],
  ["delawarevalley", "delawarevalleycollege"], ["upperiowa", "upperiowauniversity"], ["coloradoam", "coloradostate"], ["oklahomaam", "oklahomastate"],
  ["texasaandm", "texasam"], ["michiganstatenormal", "easternmichigan"], ["westchesterstate", "westchester"], ["kansasstatepittsburg", "pittsburgstate"], ["ole miss", "mississippi"], ["tennesseestate", "tennesseeaandi", "tennesseeai"], ["morganstate", "morgan"],
  ["southernuniversity", "southern"], ["floridaam", "floridaaandm"], ["prairieview", "prairieviewam"], ["jacksonstate", "jackson"],
];
const collegeOf = new Map();
const cnorm = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/\bst\.?(?=\s|$)/g, "state")
    .replace(/\bw\.\s*/g, "west ").replace(/\be\.\s*/g, "east ").replace(/\bn\.\s*w\.\s*/g, "northwestern ").replace(/\bnw\b/g, "northwestern").replace(/\bse\b/g, "southeastern")
    .replace(/&/g, "").replace(/\b(university|college|of|the|at|and)\b/g, "").replace(/[^a-z]/g, "");
for (const g of COLLEGE_SAME) for (const n of g) collegeOf.set(cnorm(n), cnorm(g[0]));
// Words that name a region or state, not a school: "Kansas State" and "Tennessee State" differ,
// but "Alcorn A&M" and "Alcorn State", or "S.F. Austin" and "Stephen F. Austin State", are one.
const GENERIC = new Set(("north south east west northwest northeast southwest southeast central northern southern eastern western northwestern northeastern southwestern southeastern " +
  "new state texas california carolina louisiana mississippi tennessee florida illinois michigan kansas missouri oklahoma virginia georgia " +
  "alabama arkansas kentucky ohio indiana iowa washington oregon colorado arizona utah nevada idaho montana wyoming dakota nebraska minnesota " +
  "wisconsin pennsylvania maryland york jersey connecticut massachusetts maine vermont hampshire delaware hawaii alaska mexico cal poly " +
  "tech city valley christian lutheran baptist methodist").split(" "));
const STOP = new Set("university college of the at and univ u institute jc cc community junior".split(" "));
const ABBR = { st: "state", miss: "mississippi", la: "louisiana", ut: "tennessee", n: "north", s: "south", w: "west", e: "east", nw: "northwest", ne: "northeast", se: "southeast", sw: "southwest", mex: "mexico", ark: "arkansas", tenn: "tennessee", okla: "oklahoma", md: "maryland", ga: "georgia", fla: "florida", ky: "kentucky", calif: "california", wash: "washington" };
const words = (x) =>
  x.toLowerCase().replace(/a\s*&\s*([a-z])\b/g, "aand$1").split(/[^a-z]+/).filter(Boolean).map((w) => ABBR[w] ?? w).filter((w) => !STOP.has(w));
function sameSchool(x, y) {
  const cx = collegeOf.get(cnorm(x)) ?? cnorm(x);
  const cy = collegeOf.get(cnorm(y)) ?? cnorm(y);
  if (cx === cy) return true;
  const wx = words(x);
  const wy = words(y);
  const dx = wx.filter((w) => !GENERIC.has(w) && !/^aand[a-z]$/.test(w));
  const dy = wy.filter((w) => !GENERIC.has(w) && !/^aand[a-z]$/.test(w));
  // One side only regional ("Cal Poly", "Washington"): the same school if the other contains it.
  if (!dx.length && dy.length) return wx.every((w) => wy.includes(w));
  if (dx.length && !dy.length) return wy.every((w) => wx.includes(w));
  if (dx.length || dy.length) return dx.some((w) => dy.includes(w) || dy.some((v) => v.length >= 4 && w.length >= 4 && (v.startsWith(w) || w.startsWith(v))));
  // Only regional words: the same school only if they're the same words (A&M/A&T/A&I aside).
  const gx = wx.filter((w) => !/^aand[a-z]$/.test(w)).sort().join(" ");
  const gy = wy.filter((w) => !/^aand[a-z]$/.test(w)).sort().join(" ");
  return gx === gy || (wx.some((w) => /^aand/.test(w)) && wy.some((w) => /^aand/.test(w)) && gx.replace(/ state/, "") === gy.replace(/ state/, ""));
}
const collegesMatch = (a, b) => {
  if (!a || !b) return true;
  // A player who went to two schools is listed "A; B" by the archive.
  const as = a.split(/;|\//).map((x) => x.trim()).filter(Boolean);
  const bs = b.split(/;|\//).map((x) => x.trim()).filter(Boolean);
  return as.some((x) => bs.some((y) => sameSchool(x, y)));
};
const GROUP = { QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE", LT: "OL", LG: "OL", C: "OL", RG: "OL", RT: "OL", DE: "DL", DT: "DL", OLB: "LB", MLB: "LB", CB: "DB", S: "DB", K: "K", P: "P" };
// Tyler Palko signed with New Orleans as an undrafted rookie in 2007; his first NFL game was 2010.
const UNDRAFTED_ENTRY_YEARS = new Map([[nameKey("Tyler", "Palko"), 2007]]);
// Verified Pitt UDFAs and draft-eligible players not represented in the NFL stats archive.
const MANUAL_UNDRAFTED = [
  { year: 2001, f: "John", l: "Turman", p: "QB", c: "Pittsburgh", o: 57 },
  { year: 2004, f: "Rod", l: "Rutherford", p: "QB", c: "Pittsburgh", o: 62 },
  { year: 2010, f: "Bill", l: "Stull", p: "QB", c: "Pittsburgh", o: 58 },
  { year: 2013, f: "Marco", l: "Pecora", p: "S", c: "Pittsburgh", o: 55 },
  { year: 2013, f: "Tino", l: "Sunseri", p: "QB", c: "Pittsburgh", o: 61 },
  // Maryland WR and NFL practice-squad player before his CFL Hall of Fame career.
  { year: 1997, f: "Geroy", l: "Simon", p: "WR", c: "Maryland", o: 58 },
];

/* ---------------- overalls on the game's own scale ---------------- */

// Fit the catalog's own overalls to real careers, so an added player lands where the
// catalog would have put him: o ~ starters, games, Pro Bowls, All-Pros.
function fit(rows, cols) {
  const n = cols;
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  const B = Array(n).fill(0);
  for (const { x, y } of rows) for (let a = 0; a < n; a++) {
    B[a] += x[a] * y;
    for (let c = 0; c < n; c++) A[a][c] += x[a] * x[c];
  }
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [B[i], B[p]] = [B[p], B[i]];
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      B[r] -= f * B[i];
    }
  }
  return B.map((v, i) => v / A[i][i]);
}
const draftX = (st, g, pb = 0, ap = 0) => [1, Math.min(st, 12), Math.min(pb, 8), Math.min(g, 250) / 100, Math.min(ap, 6)];
const draftRows = [];
for (let y = FIRST; y <= 2020; y++)
  for (const s of draftSeedsBase(y)) {
    const a = CAREER_ARCS[y]?.[arcKey(s.f, s.l)];
    if (a && a[2]) draftRows.push({ x: draftX(a[1], a[2], a[3], a[4]), y: s.o });
  }
const draftCoef = fit(draftRows, 5);
console.error("draft fit", draftRows.length, draftCoef.map((x) => x.toFixed(2)).join(" "));
const draftOvr = (st, g) => Math.round(Math.max(50, Math.min(88, draftX(st, g).reduce((n, x, i) => n + x * draftCoef[i], 0))));

/* ---------------- the catalogs ---------------- */

const seedsByYear = new Map();
for (let y = FIRST; y <= 2026; y++) seedsByYear.set(y, draftSeedsBase(y));
const inCatalog = new Set();
for (const list of seedsByYear.values()) for (const s of list) inCatalog.add(nameKey(s.f, s.l));
for (const k of Object.keys(UNDRAFTED_ARCS)) inCatalog.add(normalizedName(k.replace("|", " ")).replace(/[^a-z]/g, ""));
const vetKeys = new Set(VETERANS_1966.map((v) => nameKey(v.f, v.l)));
/** Is he already in a class under another name (Too Tall Jones as Ed Jones, Cadillac Williams as Carnell)? */
function knownAs(year, last, college, round) {
  for (const y of [year - 1, year, year + 1]) {
    for (const s of seedsByYear.get(y) ?? []) {
      const a = lastKey(s.l);
      const b = lastKey(last);
      if (a !== b && !(Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)))) continue;
      if (y === year && round && s.r === round) return true;
      if (s.c && college && collegesMatch(s.c, college)) return true;
    }
  }
  return false;
}

/* ---------------- audit ---------------- */

/**
 * Schools whose every real player the game carries, whatever his career: every draftee, and
 * every undrafted man who reached an NFL roster, not just the ones who stuck.
 */
const EVERY_PLAYER_FROM = [/^pitt(sburgh)?$/i];
/** The catalog already has him under its own spelling: exact last name, same school, a year either side. */
const sameSchoolmate = (year, p) =>
  [year - 1, year, year + 1].some((y) => (seedsByYear.get(y) ?? []).some((s) => lastKey(s.l) === lastKey(p.last) && sameFirst(s.f, p.first) && collegesMatch(s.c, p.college)));
const everyFrom = (college) => {
  const school = finalSchool(college);
  return !!school && EVERY_PLAYER_FROM.some((re) => re.test(school.trim()));
};

const on66 = new Set();
for (const [p, list] of rosterSeasons) if (list.some((r) => r.year === FIRST)) on66.add(p);

// Two real draftees with one name in one class (Alex Smith, QB and TE, 2005): never guess.
const namesakes = new Map();
for (const p of people) {
  const c = career(p.id);
  for (const d of draftsOf.get(p.id) ?? []) {
    if (c.first !== undefined && !(c.first >= d.year && c.first <= d.year + 3)) continue;
    const k = `${d.year}|${nameKey(p.first, p.last)}`;
    namesakes.set(k, (namesakes.get(k) ?? 0) + 1);
  }
}

const fix = {}; // "year|key" -> {p,c,r,ht,wt}
/** The number he wore as an NFL rookie, the one he asked for coming out of school. */
const numbers = {}; // year -> {nameKey: no}
function numberOf(year, f, l, c) {
  const no = c.rows.find((r) => r.year <= (c.first ?? year) + 1 && r.no !== undefined)?.no;
  if (no === undefined || no < 0 || no > 99) return;
  (numbers[year] ??= {})[nameKey(f, l)] = no;
}
const addDrafted = {}; // year -> seeds
const addUndrafted = {}; // year -> seeds
const arcs = {}; // "first|last" -> {dy,row}
const report = { checked: 0, fixed: { r: 0, p: 0, c: 0, ht: 0, wt: 0 }, collisions: [], addedDrafted: 0, addedUndrafted: 0, vets: { checked: 0, fixed: 0, removed: [], added: 0 } };
const samples = { r: [], p: [], c: [], drafted: [], undrafted: [], vets: [], vetsAdded: [] };
const sample = (k, v) => samples[k].length < 40 && samples[k].push(v);

for (const p of people) {
  const c = career(p.id);
  if (!c.first || c.last < FIRST) continue;
  let d = draftOf(p.id, c.first);
  const name = `${p.first} ${p.last}`;
  if (d && d.year >= FIRST) {
    report.checked += 1;
    const seeds = seedsByYear.get(d.year) ?? [];
    let hit = seeds.filter((s) => nameKey(s.f, s.l) === nameKey(p.first, p.last));
    if (!hit.length) hit = seeds.filter((s) => lastKey(s.l) === lastKey(p.last) && sameFirst(s.f, p.first) && collegesMatch(s.c, c.college));
    const twins = (namesakes.get(`${d.year}|${nameKey(p.first, p.last)}`) ?? 1) > 1;
    if (hit.length > 1 || twins) hit = hit.filter((s) => s.r === d.round);
    const s = hit.length === 1 ? hit[0] : undefined;
    if (!s) {
      if (hit.length > 1 || twins) report.collisions.push(`${d.year} ${name}`);
      else if ((c.games >= 1 || everyFrom(c.college)) && !inCatalog.has(nameKey(p.first, p.last)) && !knownAs(d.year, p.last, c.college, d.round)) {
        (addDrafted[d.year] ??= []).push({ f: p.first, l: p.last, p: c.pos, c: finalSchool(c.college), o: draftOvr(c.starters, c.games), r: d.round, ht: c.ht, wt: c.wt });
        numberOf(d.year, p.first, p.last, c);
        arcs[arcKey(p.first, p.last)] = { dy: d.year, row: [c.last ?? 0, c.starters, c.games, 0, 0, c.ageIn ?? 22] };
        report.addedDrafted += 1;
        sample("drafted", `${d.year} R${d.round} ${name} (${c.pos}, ${c.college}) — ${c.games} games`);
      }
      continue;
    }
    // A same-name catalog entry from another round is someone else: report, don't touch.
    if (s.r && s.r !== d.round && seeds.filter((x) => nameKey(x.f, x.l) === nameKey(s.f, s.l)).length > 1) continue;
    const k = `${d.year}|${runKey(s.f, s.l)}`;
    const f = {};
    // One person linked to two picks in one draft (a namesake's row): take the one the catalog has.
    const sameYear = (draftsOf.get(p.id) ?? []).filter((x) => x.year === d.year);
    if (sameYear.length > 1) d = sameYear.find((x) => x.round === s.r) ?? { ...d, round: s.r ?? d.round };
    // 1966 had an NFL and an AFL draft; a catalog round can be either league's.
    if (d.year > FIRST && s.r !== undefined && s.r !== 0 && s.r !== d.round) {
      f.r = d.round;
      report.fixed.r += 1;
      sample("r", `${d.year} ${name}: round ${s.r} → ${d.round}`);
    }
    // Identity: he broke in with the club that drafted him (a namesake's draft row linked to the
    // wrong man, the John Smith who kicked for New England, fails this). Otherwise only the round.
    const debut = (rosterSeasons.get(p.id) ?? []).filter((r) => r.year === c.first || r.year === (rosterSeasons.get(p.id) ?? [])[0]?.year);
    const sure = debut.some((r) => r.team === d.team) || (rosterSeasons.get(p.id) ?? []).some((r) => r.year <= d.year + 1 && r.team === d.team);
    if (!sure) {
      // Traded on draft day (Eli Manning and Philip Rivers, John Elway): not with the club that
      // took him, but the same name from the same school in the same class is still him, and
      // the number he broke in wearing is his.
      if (c.college && s.c && collegesMatch(s.c, c.college) && c.first !== undefined && c.first <= d.year + 1) numberOf(d.year, s.f, s.l, c);
      if (Object.keys(f).length) fix[k] = f;
      report.unsure = (report.unsure ?? 0) + 1;
      continue;
    }
    numberOf(d.year, s.f, s.l, c);
    // Same name, different round: likely a namesake the record doesn't separate. Leave him be.
    if (s.r && s.r !== d.round && d.year > FIRST) {
      if (Object.keys(f).length) fix[k] = f;
      continue;
    }
    const realPos = c.pos;
    const kickerOk = (s.p === "K" && kicked.has(p.id)) || (s.p === "P" && punted.has(p.id));
    if (realPos && GROUP[realPos] !== GROUP[s.p] && !kickerOk && c.games >= 1) {
      f.p = realPos;
      report.fixed.p += 1;
      sample("p", `${d.year} ${name}: ${s.p} → ${realPos} (${c.games} games)`);
    }
    if (c.college && s.c && !collegesMatch(s.c, c.college)) {
      f.c = finalSchool(c.college);
      report.fixed.c += 1;
      sample("c", `${d.year} ${name}: ${s.c} → ${c.college}`);
    }
    if (c.ht && (!s.ht || Math.abs(s.ht - c.ht) > 1)) {
      f.ht = c.ht;
      report.fixed.ht += 1;
    }
    if (c.wt && (!s.wt || Math.abs(s.wt - c.wt) > 10)) {
      f.wt = c.wt;
      report.fixed.wt += 1;
    }
    if (Object.keys(f).length) fix[k] = f;
    continue;
  }
  // Never drafted (or drafted before 1966 and arriving later): the game needs him if he played.
  const key = nameKey(p.first, p.last);
  if (inCatalog.has(key) || vetKeys.has(key)) continue;
  if (c.first < FIRST) continue; // a pre-1966 career: a 1966 veteran, handled below
  if (c.games < 16 && c.starters < 1 && !everyFrom(c.college)) continue;
  if (on66.has(p.id)) continue; // on a real 1966 roster: seeded as a veteran below
  if (everyFrom(c.college) ? sameSchoolmate(c.first, p) : knownAs(c.first, p.last, c.college)) continue;
  const year = UNDRAFTED_ENTRY_YEARS.get(nameKey(p.first, p.last)) ?? c.first;
  (addUndrafted[year] ??= []).push({ f: p.first, l: p.last, p: c.pos, c: finalSchool(c.college), o: draftOvr(c.starters, c.games), r: 0, ht: c.ht, wt: c.wt });
  numberOf(year, p.first, p.last, c);
  arcs[arcKey(p.first, p.last)] = { dy: year, row: [c.last ?? 0, c.starters, c.games, 0, 0, c.ageIn ?? 23] };
  report.addedUndrafted += 1;
  sample("undrafted", `${year} ${name} (${c.pos}, ${c.college}) — ${c.games} games, ${c.starters} as a starter`);
}

for (const { year, ...seed } of MANUAL_UNDRAFTED) {
  const rows = (addUndrafted[year] ??= []);
  if (rows.some((s) => nameKey(s.f, s.l) === nameKey(seed.f, seed.l))) continue;
  rows.push({ ...seed, r: 0 });
}

// Their draftees who never played a down: the loop above only walks real careers.
const roundOvr = (r) => Math.max(50, 64 - Math.max(0, r - 1) * 1.6);
for (const [y, list] of Object.entries(DRAFTS)) {
  const year = Number(y);
  if (year < FIRST) continue;
  const seeds = seedsByYear.get(year) ?? [];
  for (const e of list.split("|")) {
    const [round, , , pid] = e.split(",");
    const p = people[id36(pid)];
    if (!p || !everyFrom(p.college) || career(p.id).first) continue;
    const r = Number(round);
    if (seeds.some((s) => nameKey(s.f, s.l) === nameKey(p.first, p.last))) continue;
    if (inCatalog.has(nameKey(p.first, p.last)) || knownAs(year, p.last, p.college, r)) continue;
    if ((addDrafted[year] ?? []).some((s) => nameKey(s.f, s.l) === nameKey(p.first, p.last))) continue;
    (addDrafted[year] ??= []).push({ f: p.first, l: p.last, p: p.pos && GROUP[p.pos] ? p.pos : gamePos(p.pos) ?? "WR", c: finalSchool(p.college), o: Math.round(roundOvr(r)), r });
    report.addedDrafted += 1;
    sample("drafted", `${year} R${r} ${p.first} ${p.last} (${p.pos}, ${p.college}) — never played`);
  }
}

// And their undrafted men on a real roster the archive has no rows for (recent practice squads).
for (const p of people) {
  if (!everyFrom(p.college) || draftsOf.has(p.id) || career(p.id).first) continue;
  const year = (rosterSeasons.get(p.id) ?? []).map((r) => r.year).sort((a, b) => a - b)[0];
  if (!year || year <= FIRST) continue;
  const key = nameKey(p.first, p.last);
  if (inCatalog.has(key) || vetKeys.has(key)) continue;
  // Same last name, same school, a year either side: the catalog's spelling of him. Exact last
  // names only here, so Jaryd Jones-Smith isn't taken for a Jones.
  if (sameSchoolmate(year, p)) continue;
  if ((addUndrafted[year] ?? []).some((s) => nameKey(s.f, s.l) === key)) continue;
  (addUndrafted[year] ??= []).push({ f: p.first, l: p.last, p: GROUP[p.pos] ? p.pos : gamePos(p.pos) ?? "WR", c: finalSchool(p.college), o: 55, r: 0 });
  report.addedUndrafted += 1;
  sample("undrafted", `${year} ${p.first} ${p.last} (${p.pos}, ${p.college}) — on a roster, no game rows`);
}

/* ---------------- the 1966 veterans ---------------- */

const real66 = []; // {person, team, jersey}
for (const [p, list] of rosterSeasons) for (const r of list) if (r.year === FIRST) real66.push({ person: p, team: r.team, jersey: r.jersey });
const rookies66 = new Set((seedsByYear.get(FIRST) ?? []).map((s) => nameKey(s.f, s.l)));
const vetFix = {};
const vetArcsExisting = {};
const vetMatched = new Set();
// Fit the veterans' 1966 overall: a starter that year, the career around it, age.
const vetX = (gs66, st, g, age) => [1, Math.min(gs66, 14) / 14, Math.min(st, 14), Math.min(g, 250) / 100, Math.max(0, age - 30), Math.max(0, 25 - age)];
const vetRows = [];
for (const v of VETERANS_1966) {
  // His own club first (two Bob Browns played in 1966), then anywhere if the name is unique.
  const exact = (r) => nameKey(people[r.person].first, people[r.person].last) === nameKey(v.f, v.l);
  const anywhere = real66.filter(exact);
  const m = real66.find((r) => r.team === v.t && exact(r)) ??
    real66.find((r) => r.team === v.t && lastKey(people[r.person].last) === lastKey(v.l) && sameFirst(people[r.person].first, v.f)) ??
    (anywhere.length === 1 ? anywhere[0] : undefined);
  report.vets.checked += 1;
  const vk = runKey(v.f, v.l);
  if (!m) {
    // Not on any real 1966 roster. Drop him only when the record says his career was over
    // (or hadn't started); anyone else is reported.
    const named = people.filter((x) => nameKey(x.first, x.last) === nameKey(v.f, v.l)).map((x) => career(x.id)).filter((c) => c.first !== undefined);
    const outside = named.length > 0 && named.every((c) => c.last < FIRST || c.first > FIRST);
    if (outside && anywhere.length === 0) {
      vetFix[vk] = null;
      report.vets.removed.push(`${v.f} ${v.l} (${v.t}): real career ${named.map((c) => `${c.first}–${c.last}`).join(", ")}`);
    } else sample("vets", `${v.f} ${v.l} (${v.t}): not found on a 1966 roster — kept`);
    continue;
  }
  vetMatched.add(m.person);
  const c = career(m.person);
  const r66 = c.rows.filter((r) => r.year === FIRST);
  const gs66 = r66.reduce((n, r) => n + r.gs, 0);
  const age66 = r66.find((r) => r.age)?.age;
  const st = c.rows.filter((r) => r.gp >= 6 && r.gs >= Math.max(6, r.gp * 0.5)).length;
  vetRows.push({ x: vetX(gs66, st, c.games, age66 ?? v.a), y: v.o });
  const f = {};
  if (m.team !== v.t) f.t = m.team;
  const p66 = gamePos(r66.sort((a, b) => b.gp - a.gp)[0]?.pos, m.person) ?? c.pos;
  const kickerOk = (v.p === "K" && kicked.has(m.person)) || (v.p === "P" && punted.has(m.person));
  // Two-way men listed twice on purpose (Blanda at QB and K) keep both entries as written.
  const twoWay = VETERANS_1966.filter((x) => runKey(x.f, x.l) === runKey(v.f, v.l)).length > 1;
  if (p66 && GROUP[p66] !== GROUP[v.p] && !kickerOk && !twoWay) f.p = p66;
  if (m.jersey !== undefined && m.jersey !== v.n) f.n = m.jersey;
  if (age66 && Math.abs(age66 - v.a) >= 2) f.a = age66;
  if (c.college && v.c && !collegesMatch(v.c, c.college)) f.c = finalSchool(c.college);
  if (!v.c && c.college) f.c = finalSchool(c.college);
  // His real career, where the old draft tables had none: he retires the year he really did.
  const ak = arcKey(v.f, v.l);
  if (!VET_ARCS[ak] && c.last !== undefined) {
    const dy = c.first ?? FIRST;
    const a = age66 ?? v.a;
    vetArcsExisting[ak] = [[dy, c.last, st, c.games, 0, 0, Math.max(20, a - (FIRST - dy)), f.p ?? v.p]];
  }
  if (Object.keys(f).length) {
    vetFix[vk] = f;
    report.vets.fixed += 1;
    sample("vets", `${v.f} ${v.l}: ${Object.entries(f).map(([k, x]) => `${k} ${v[k] ?? "—"} → ${x}`).join(", ")}`);
  }
}
const vetCoef = fit(vetRows, 6);
const addVets = [];
const vetArcs = { ...vetArcsExisting };
for (const r of real66) {
  if (vetMatched.has(r.person)) continue;
  vetMatched.add(r.person); // traded in-season: he opens the year with his first club
  const p = people[r.person];
  const k = nameKey(p.first, p.last);
  if (vetKeys.has(k) || rookies66.has(k)) continue;
  const d = draftOf(r.person, career(r.person).first);
  if (d && d.year >= FIRST) continue; // a 1966 draftee: he's on the board
  const c = career(r.person);
  const r66 = c.rows.filter((x) => x.year === FIRST);
  const gp66 = r66.reduce((n, x) => n + x.gp, 0);
  if (!gp66) continue;
  const gs66 = r66.reduce((n, x) => n + x.gs, 0);
  const age66 = r66.find((x) => x.age)?.age ?? 26;
  const st = c.rows.filter((x) => x.gp >= 6 && x.gs >= Math.max(6, x.gp * 0.5)).length;
  const o = Math.round(Math.max(48, Math.min(90, vetX(gs66, st, c.games, age66).reduce((n, x, i) => n + x * vetCoef[i], 0))));
  const pos = gamePos(r66.sort((a, b) => b.gp - a.gp)[0]?.pos, r.person) ?? c.pos;
  addVets.push({ f: p.first, l: p.last, p: pos, t: r.team, a: age66, o, n: r.jersey, c: finalSchool(c.college) });
  const key = arcKey(p.first, p.last);
  if (!VET_ARCS[key]) {
    const dy = c.first ?? FIRST;
    vetArcs[key] = [[dy, c.last ?? FIRST, st, c.games, 0, 0, Math.max(20, (age66 ?? 26) - (FIRST - dy)), pos]];
  }
  report.vets.added += 1;
  sample("vetsAdded", `${p.first} ${p.last} (${r.team} ${pos}, #${r.jersey ?? "—"}, age ${age66}) — ovr ${o}, ${gs66} starts in 1966`);
}

/* ---------------- write ---------------- */

// Same-unit historical listings can still need the player's actual position for gameplay.
for (const [key, pos] of [["2007|hbblades", "MLB"], ["2011|gregromeus", "DE"]])
  fix[key] = { ...(fix[key] ?? {}), p: pos };

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const json = (v) => JSON.stringify(v).replace(/"(\w+)":/g, "$1:");
const lines = [];
lines.push(`/** Auto-generated by scripts/player-audit.mjs from the real record. Do not hand-edit. */`);
lines.push(`import type { Pos, TeamId } from "../types.ts";`);
lines.push(`import type { CareerArcRow, VetArcRow } from "./careerArcs.ts";`);
lines.push(``);
lines.push(`type Seed = { f: string; l: string; p: Pos; c?: string; o: number; r?: number; ht?: number; wt?: number };`);
lines.push(`type Fix = { p?: Pos; c?: string; r?: number; ht?: number; wt?: number };`);
lines.push(`type VetFix = { t?: TeamId; p?: Pos; n?: number; a?: number; c?: string };`);
lines.push(`type Vet = { f: string; l: string; p: Pos; t: TeamId; a: number; o: number; n?: number; c?: string };`);
lines.push(``);
lines.push(`/** Corrections to catalog entries, keyed "draft year|normalized name": real position, college, round, height, weight. */`);
lines.push(`export const AUDIT_FIX: Record<string, Fix> = ${JSON.stringify(sortObj(fix))};`);
lines.push(`/** Real draft picks with NFL games the catalogs never had. */`);
lines.push(`export const AUDIT_DRAFTED: Record<number, Seed[]> = ${json(addDrafted)};`);
lines.push(`/** Real undrafted players (a season's worth of games, or a starting job) the catalogs never had, by first season. */`);
lines.push(`export const AUDIT_UNDRAFTED: Record<number, Seed[]> = ${json(addUndrafted)};`);
lines.push(`/** The number each real rookie wore, by draft (or first) year: "namekey:number" joined by ",". */`);
lines.push(`export const AUDIT_NUMBERS: Record<number, string> = ${JSON.stringify(Object.fromEntries(Object.entries(numbers).map(([y, m]) => [y, Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, n]) => `${k}:${n}`).join(",")])))};`);
lines.push(`/** Real careers for the added players: [lastSeason, seasonsAsStarter, games, proBowls, allPros, ageOnArrival]. */`);
lines.push(`export const AUDIT_ARCS: Record<string, { dy: number; row: CareerArcRow }> = ${JSON.stringify(sortObj(arcs))};`);
lines.push(`/** Corrections to the 1966 veterans by normalized name (null: not in the league in 1966). */`);
lines.push(`export const AUDIT_VET_FIX: Record<string, VetFix | null> = ${JSON.stringify(sortObj(vetFix))};`);
lines.push(`/** Real 1966 players the veteran list missed: club, position, number, age, college. */`);
lines.push(`export const AUDIT_VETS: Vet[] = ${json(addVets)};`);
lines.push(`/** Careers for added veterans with no draft-table arc. */`);
lines.push(`export const AUDIT_VET_ARCS: Record<string, VetArcRow[]> = ${JSON.stringify(sortObj(vetArcs))};`);
writeFileSync(join(G, "data/auditPlayers.ts"), lines.join("\n") + "\n");

const md = [];
md.push(`# Player audit`);
md.push(``);
md.push(`Generated by \`scripts/player-audit.mjs\`. Every named player the regular game uses, checked against the real record (nflverse / Pro-Football-Reference drafts, people and rosters; the Pro Football Archives' team rosters with games, starts, numbers, ages, heights, weights and colleges).`);
md.push(``);
md.push(`| | |`);
md.push(`|---|---|`);
md.push(`| Real draft picks checked (1966–${LAST}) | ${report.checked.toLocaleString()} |`);
md.push(`| Draft round corrected | ${report.fixed.r} |`);
md.push(`| Position corrected | ${report.fixed.p} |`);
md.push(`| College corrected | ${report.fixed.c} |`);
md.push(`| Height set or corrected | ${report.fixed.ht.toLocaleString()} |`);
md.push(`| Weight set or corrected | ${report.fixed.wt.toLocaleString()} |`);
md.push(`| Real draft picks added (were missing) | ${report.addedDrafted} |`);
md.push(`| Real undrafted players added | ${report.addedUndrafted.toLocaleString()} |`);
md.push(`| 1966 veterans checked | ${report.vets.checked} |`);
md.push(`| 1966 veterans corrected (club, position, number, age, college) | ${report.vets.fixed} |`);
md.push(`| 1966 veterans removed (not in the league that year) | ${report.vets.removed.length} |`);
md.push(`| Real 1966 players added | ${report.vets.added} |`);
md.push(`| Same-name collisions left alone | ${report.collisions.length} |`);
md.push(``);
const sec = (t, list) => {
  if (!list.length) return;
  md.push(`## ${t}`);
  md.push(``);
  for (const x of list) md.push(`- ${x}`);
  md.push(``);
};
sec("Rounds (sample)", samples.r);
sec("Positions (sample)", samples.p);
sec("Colleges (sample)", samples.c);
sec("Added draft picks (sample)", samples.drafted);
sec("Added undrafted players (sample)", samples.undrafted);
sec("1966 veterans removed", report.vets.removed);
sec("1966 veterans corrected (sample)", samples.vets);
sec("1966 players added (sample)", samples.vetsAdded);
sec("Same-name collisions (sample)", report.collisions.slice(0, 40));
mkdirSync(join(ROOT, "data/audit"), { recursive: true });
writeFileSync(join(ROOT, "data/audit/player-audit.md"), md.join("\n"));
console.log(JSON.stringify({ ...report, collisions: report.collisions.length, removed: report.vets.removed.length }));
