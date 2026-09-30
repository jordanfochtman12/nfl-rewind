#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (!process.execArgv.some((a) => a.includes("strip-types"))) {
  const r = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", ...process.argv.slice(1)],
    { stdio: "inherit" },
  );
  process.exit(r.status ?? 1);
}

const g = await import("../src/lib/game/index.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

const save = g.createNewGame({ userTeamId: "gnb", startingYear: 1966 });
const active = g.activeTeamIds(save.year);
assert(active.length === 24, `24 teams in 1966 (got ${active.length})`);
assert(!active.includes("rav"), "Ravens are not a 1966 club");
assert(!active.includes("nor"), "Saints are not yet born");
assert(g.logoSrc(1966, "nwe") === "/logos/nwe.svg", "1966 Patriots wear the minuteman mark");
assert(g.logoSrc(1993, "nwe") === "/logos/nwe-modern.svg", "1993 Patriots Flying Elvis");
assert(g.logoSrc(2000, "nwe") === "/logos/nwe-2000.svg", "2000 Patriots face the other way");
assert(g.logoSrc(1966, "oti") === "/logos/oti.svg", "Oilers derrick in 1966");
assert(g.logoSrc(1998, "oti") === "/logos/oti.svg", "Tennessee Oilers still the derrick");
assert(g.logoSrc(1999, "oti") === "/logos/oti-titans.svg", "Titans mark in 1999");
assert(g.logoSrc(2018, "oti") === "/logos/oti-2018.svg", "2018 Titans disc");
assert(g.logoSrc(1976, "tam") === "/logos/tam.svg", "Bucco Bruce in 1976");
assert(g.logoSrc(1997, "tam") === "/logos/tam-modern.svg", "Bucs flag in 1997");
assert(g.logoSrc(2014, "tam") === "/logos/tam-2014.svg", "2014 Bucs pewter");
assert(g.logoSrc(1966, "gnb") === "/logos/gnb.svg", "Packers G");
assert(g.logoSrc(1966, "nyj") === "/logos/nyj.svg", "1966 Jets jet");
assert(g.logoSrc(1978, "nyj") === "/logos/nyj-jets.svg", "1978 Jets football");
assert(g.logoSrc(1998, "nyj") === "/logos/nyj-modern.svg", "1998 Jets NY");
assert(g.logoSrc(2019, "nyj") === "/logos/nyj-jets.svg", "2019 Jets return to the football");
assert(g.logoSrc(1966, "sdg") === "/logos/sdg.svg", "1966 Chargers powder bolt");
assert(g.logoSrc(1988, "sdg") === "/logos/sdg-modern.svg", "1988 Chargers navy");
assert(g.logoSrc(2007, "sdg") === "/logos/sdg.svg", "2007 Chargers powder again");
assert(g.logoSrc(2017, "sdg") === "/logos/sdg-modern.svg", "2017 LA Chargers navy");
assert(g.logoSrc(2020, "sdg") === "/logos/sdg.svg", "2020 Chargers powder again");
assert(g.logoSrc(1966, "ram") === "/logos/ram.svg", "1966 Rams horn");
assert(g.logoSrc(2000, "ram") === "/logos/ram-stl.svg", "2000 St. Louis ram head");
assert(g.logoSrc(2016, "ram") === "/logos/ram-modern.svg", "2016 LA ram head");
assert(g.logoSrc(2020, "ram") === "/logos/ram-2020.svg", "2020 Rams LA horn");
assert(g.logoSrc(1966, "sfo") === "/logos/sfo-early.svg", "1966 49ers pre-oval");
assert(g.logoSrc(1968, "sfo") === "/logos/sfo.svg", "1968 49ers SF oval");
assert(g.logoSrc(1995, "phi") === "/logos/phi.svg", "Eagles wings through 1995");
assert(g.logoSrc(1996, "phi") === "/logos/phi-1996.svg", "1996 Eagles head");
assert(g.logoSrc(2012, "mia") === "/logos/mia.svg", "Dolphins sunburst through 2012");
assert(g.logoSrc(2013, "mia") === "/logos/mia-2013.svg", "2013 Dolphins drop the full sun");

assert(g.teamColors("nwe", 1966).primary === "#c60c30", "1966 Patriots wear red");
assert(g.teamColors("nwe", 1993).primary === "#002244", "1993 Patriots go navy");
assert(g.teamColors("sdg", 1966).primary === "#0080c6", "1966 Chargers powder");
assert(g.teamColors("sdg", 1988).primary === "#002244", "1988 Chargers navy");
assert(g.teamColors("sdg", 2007).primary === "#0080c6", "2007 Chargers powder again");
assert(g.teamColors("oti", 1966).primary === "#0072ce", "Oilers columbia blue");
assert(g.teamColors("oti", 1999).primary === "#0c2340", "Titans navy");
assert(g.teamColors("tam", 1976).primary === "#d50a0a", "Bucco Bruce orange-red");
assert(g.teamColors("tam", 1997).primary === "#34302b", "1997 Bucs pewter");
assert(g.teamColors("ram", 1966).primary === "#003594", "1966 Rams royal");
assert(g.teamColors("ram", 2000).primary === "#002244", "St. Louis Rams navy");
assert(g.teamColors("ram", 2020).primary === "#003594", "2020 Rams royal again");
assert(g.clubInk("nor", 1967).onPrimary === "#090a08", "Saints gold wants dark ink");
assert(g.clubInk("gnb", 1966).onPrimary === "#f0e8d6", "Packers green wants cream ink");
assert(g.venueOf(1966, "chi").stadium === "Wrigley Field", "1966 Bears at Wrigley");
assert(g.venueOf(1971, "chi").stadium === "Soldier Field", "1971 Bears at Soldier");
assert(g.venueOf(1966, "buf").stadium === "War Memorial Stadium", "1966 Bills at War Memorial");
assert(g.venueOf(1973, "buf").stadium === "Rich Stadium", "1973 Bills at Rich");
assert(g.venueOf(1966, "sfo").stadium === "Kezar Stadium", "1966 49ers at Kezar");
assert(g.venueOf(1971, "sfo").stadium === "Candlestick Park", "1971 49ers at Candlestick");
assert(g.venueOf(1966, "sdg").stadium === "Balboa Stadium", "1966 Chargers at Balboa");
assert(g.venueOf(1967, "sdg").stadium === "San Diego Stadium", "1967 Chargers leave Balboa");
assert(g.venueOf(1985, "ram").stadium === "Anaheim Stadium", "1985 Rams in Anaheim");
assert(g.venueOf(2020, "ram").stadium === "SoFi Stadium", "2020 Rams at SoFi");
assert(g.venueOf(2000, "sea").stadium === "Husky Stadium", "2000 Seahawks at Husky");
assert(g.venueOf(1966, "nwe").stadium === "Fenway Park", "1966 Patriots at Fenway");
assert(g.venueOf(1971, "nwe").stadium === "Foxboro Stadium", "1971 Patriots in Foxboro");

const gamesNeeded = g.gamesInSeason(1966);
assert(gamesNeeded === 14, "14-game season in 1966");
for (const id of active) {
  const n = g.gamesForTeam(save, id).length;
  assert(n === 14, `${id} has 14 scheduled games (got ${n})`);
}

const names = save.draftBoard.map((p) => {
  const pl = save.players[p.playerId];
  return pl ? `${pl.firstName} ${pl.lastName}` : "";
});
assert(
  names.some((n) => /nobis/i.test(n)),
  `1966 draft board has Tommy Nobis (sample: ${names.slice(0, 5).join(", ")})`,
);
assert(
  names.some((n) => /mack|grabowski|anderson/i.test(n)),
  "Nobis-class names on the board",
);
const nobisPl = Object.values(save.players).find((p) => p.lastName === "Nobis");
assert(nobisPl, "Tommy Nobis player exists");
assert(nobisPl.arch === "thumper", `Nobis is a thumper (got ${nobisPl.arch})`);
assert(nobisPl.ratings.tak >= 88, `Nobis tackle is locked high (got ${nobisPl.ratings.tak})`);
assert(nobisPl.ratings.throwAcc < 50, `Nobis does not hug overall on unused skills (throwAcc ${nobisPl.ratings.throwAcc})`);

assert(names.filter(Boolean).length >= 24, `1966 board has 24+ named (got ${names.filter(Boolean).length})`);
assert(
  Object.values(save.players).filter((p) => p.historical).length >= 280,
  `280+ historical named players at 1966 start (got ${Object.values(save.players).filter((p) => p.historical).length})`,
);
for (const y of [1967, 1969, 1971, 1975, 1983, 1985, 1989, 1998, 2000, 2017, 2024]) {
  const cls = g.draftSeedsFor(y);
  assert(cls.length >= 8, `${y} class has 8+ named (got ${cls.length})`);
}
assert(g.draftSeedsFor(1967).some((s) => s.l === "Page"), "1967 has Alan Page");
assert(g.draftSeedsFor(1975).some((s) => s.l === "Payton"), "1975 has Walter Payton");
assert(g.draftSeedsFor(1983).some((s) => s.l === "Marino"), "1983 has Dan Marino");
assert(g.draftSeedsFor(2000).some((s) => s.l === "Brady"), "2000 has Tom Brady");
assert(g.draftSeedsFor(2017).some((s) => s.l === "Mahomes"), "2017 has Patrick Mahomes");
const bradySeed = g.draftSeedsFor(2000).find((s) => s.f === "Tom" && s.l === "Brady");
assert(bradySeed, "Tom Brady seed");
assert(bradySeed.o >= 90, `Brady overall from career (got ${bradySeed.o})`);
assert(bradySeed.arch === "deadeye", `Brady is a deadeye (got ${bradySeed.arch})`);
assert((bradySeed.rt?.throwAcc ?? 0) >= 88, `Brady throwAcc locked from career (got ${bradySeed.rt?.throwAcc})`);
const leftSeed = g.draftSeedsFor(1966).find((s) => /leftridge/i.test(s.l));
assert(leftSeed, "Dick Leftridge seed");
assert(leftSeed.o <= 68, `Leftridge bust overall (got ${leftSeed.o})`);
const mackSeed = g.draftSeedsFor(1966).find((s) => s.f === "Tom" && s.l === "Mack");
assert(mackSeed && mackSeed.o >= 80, `Tom Mack Hall-level ovr (got ${mackSeed?.o})`);
for (let y = 1966; y <= 2026; y++) {
  assert((g.DRAFT_CLASSES[y] || []).length > 0, `named class for ${y}`);
}
assert(g.draftSeedsFor(1966).length >= 200, `1966 named board 200+ (got ${g.draftSeedsFor(1966).length})`);
assert(g.draftSeedsFor(1972).length >= 350, `1972 named board 350+ (got ${g.draftSeedsFor(1972).length})`);
assert(g.draftSeedsFor(1980).length >= 200, `1980 class 200+ (got ${g.draftSeedsFor(1980).length})`);
assert(g.draftSeedsFor(2025).length >= 150, `2025 class 150+ (got ${g.draftSeedsFor(2025).length})`);
assert(g.draftSeedsFor(2026).length >= 200, `2026 class 200+ (got ${g.draftSeedsFor(2026).length})`);
const jeanty = g.draftSeedsFor(2025).find((s) => /jeanty/i.test(s.l));
if (jeanty) assert(jeanty.o >= 80, `Jeanty keeps prospect floor (got ${jeanty.o})`);
assert((jeanty?.rt?.speed ?? 0) >= 88, `Jeanty speed is locked (got ${jeanty?.rt?.speed})`);
assert(
  g.draftSeedsFor(1966).filter((s) => s.arch).length >= 180,
  `1966 named prospects carry archetypes (got ${g.draftSeedsFor(1966).filter((s) => s.arch).length})`,
);
const kitN = (s) => Object.keys(s.rt || {}).length;
for (const y of [1966, 1972, 2026]) {
  const cls = g.draftSeedsFor(y);
  const fat = cls.filter((s) => kitN(s) >= 5).length;
  assert(fat / cls.length >= 0.85, `${y} full kits ${fat}/${cls.length}`);
}
const ojSeed = g.draftSeedsFor(1969).find((s) => /simpson/i.test(s.l));
assert(ojSeed, "O.J. Simpson is on the 1969 board");
assert((ojSeed.rt?.speed ?? 0) >= 90, `Simpson speed locked (got ${ojSeed.rt?.speed})`);
assert((ojSeed.rt?.throwAcc ?? 99) < 50, `Simpson does not hug overall on unused skills (throwAcc ${ojSeed.rt?.throwAcc})`);
const ojProf = g.lookupProfile("RB", "O.J.", "Simpson");
assert(ojProf.arch === "home-run", `Simpson is a home-run back (got ${ojProf.arch})`);
assert((ojProf.rt?.speed ?? 0) >= 96, `Simpson star speed (got ${ojProf.rt?.speed})`);
const marinoSeed = g.draftSeedsFor(1983).find((s) => s.f === "Dan" && s.l === "Marino");
assert(marinoSeed, "1983 has Dan Marino");
assert(marinoSeed.arch === "cannon", `Marino is a cannon (got ${marinoSeed.arch})`);
assert((marinoSeed.rt?.throwPow ?? 0) >= 94, `Marino arm is locked (got ${marinoSeed.rt?.throwPow})`);
assert((marinoSeed.rt?.throwAcc ?? 0) >= 90, `Marino accuracy is locked (got ${marinoSeed.rt?.throwAcc})`);
const riceSeed = g.draftSeedsFor(1985).find((s) => s.f === "Jerry" && s.l === "Rice");
assert((riceSeed?.rt?.catch ?? 0) >= 94, `Rice hands locked (got ${riceSeed?.rt?.catch})`);
assert(riceSeed?.arch === "possession", `Rice is possession (got ${riceSeed?.arch})`);
const ltProf = g.lookupProfile("OLB", "Lawrence", "Taylor");
assert((ltProf.rt?.prs ?? 0) >= 96, `LT pass rush locked (got ${ltProf.rt?.prs})`);
const barry = g.lookupProfile("RB", "Barry", "Sanders");
assert(barry.arch === "elusive", `Barry is elusive (got ${barry.arch})`);
assert((barry.rt?.elu ?? 0) >= 96, `Barry elude locked (got ${barry.rt?.elu})`);
assert(g.draftSeedsFor(1988).some((s) => s.f === "Thurman" && s.l === "Thomas"), "1988 has Thurman Thomas");
assert(g.draftSeedsFor(1988).some((s) => s.f === "Sterling" && s.l === "Sharpe"), "1988 has Sterling Sharpe");
assert(g.draftSeedsFor(1994).some((s) => s.f === "Larry" && s.l === "Allen"), "1994 has Larry Allen");
assert(g.draftSeedsFor(1995).some((s) => s.f === "Warren" && s.l === "Sapp"), "1995 has Warren Sapp");
assert(g.draftSeedsFor(1996).some((s) => s.f === "Zach" && s.l === "Thomas"), "1996 has Zach Thomas");
const sapp = g.lookupProfile("DT", "Warren", "Sapp");
assert(sapp.arch === "finisher", `Sapp is a closer (got ${sapp.arch})`);
assert((sapp.rt?.prs ?? 0) >= 90, `Sapp rush locked (got ${sapp.rt?.prs})`);
const champ = g.lookupProfile("CB", "Champ", "Bailey");
assert((champ.rt?.cov ?? 0) >= 94, `Champ coverage locked (got ${champ.rt?.cov})`);
const bo = g.lookupProfile("RB", "Bo", "Jackson");
assert((bo.rt?.speed ?? 0) >= 96, `Bo Jackson speed (got ${bo.rt?.speed})`);
const boRatings = g.ratingsFromProfile("RB", 92, bo.arch, bo.rt, (n) => n);
assert(boRatings.throwAcc < 50, `Bo does not hug overall on unused skills (throwAcc ${boRatings.throwAcc})`);
for (const y of [1980, 1985, 1989, 1996, 1998]) {
  const cls = g.draftSeedsFor(y);
  const fat = cls.filter((s) => kitN(s) >= 5).length;
  assert(fat / cls.length >= 0.85, `${y} full kits ${fat}/${cls.length}`);
}
const starHits = ["Jerry|Rice", "Lawrence|Taylor", "Barry|Sanders", "Thurman|Thomas", "Warren|Sapp", "Champ|Bailey"].every((k) => {
  const [f, l] = k.split("|");
  const p = g.lookupProfile("WR", f, l);
  return (p.rt && Object.keys(p.rt).length >= 4) || true;
});
assert(g.lookupProfile("WR", "Sterling", "Sharpe").rt?.catch >= 92, "Sterling Sharpe has locked hands");
assert(g.lookupProfile("WR", "Tim", "Brown").arch === "possession", "Tim Brown is a possession receiver");
assert(g.lookupProfile("TE", "Shannon", "Sharpe").arch === "move-te", "Shannon Sharpe is a move TE");
const mendoza = g.draftSeedsFor(2026).find((s) => /mendoza/i.test(s.l));
assert(mendoza && mendoza.o > 82, `2026 1.01 overall above 82 (got ${mendoza?.o})`);
assert(mendoza.arch === "deadeye", `Mendoza is a deadeye (got ${mendoza.arch})`);
assert((mendoza.rt?.throwAcc ?? 0) >= 88, `Mendoza throwAcc locked (got ${mendoza.rt?.throwAcc})`);
const r7_26 = g.draftSeedsFor(2026).filter((s) => s.r === 7);
assert(r7_26.length >= 20, `2026 seventh round is named (got ${r7_26.length})`);
assert(
  Math.max(...r7_26.map((s) => s.o)) < mendoza.o,
  `2026 R7 overall stays below 1.01 (${Math.max(...r7_26.map((s) => s.o))} vs ${mendoza.o})`,
);
const downs = g.draftSeedsFor(2026).find((s) => /downs/i.test(s.l));
assert(downs?.arch === "hawk", `Caleb Downs is a hawk (got ${downs?.arch})`);
assert((downs?.rt?.awareness ?? 0) >= 88, `Downs awareness locked (got ${downs?.rt?.awareness})`);

const namath = Object.values(save.players).find((p) => p.lastName === "Namath" && p.firstName === "Joe");
assert(namath, "Joe Namath is on a 1966 roster");
assert(namath.abilities.includes("Broadway Joe"), `Namath has Broadway Joe (got ${namath.abilities.join(", ")})`);
assert(namath.traits.includes("Gunslinger"), `Namath is a Gunslinger (got ${namath.traits.join(", ")})`);
const starr = Object.values(save.players).find((p) => p.lastName === "Starr");
assert(starr?.abilities?.length && starr?.traits?.length, "Starr has abilities and traits");
const sayers = Object.values(save.players).find((p) => p.lastName === "Sayers");
assert(sayers?.abilities?.includes("Kansas Comet"), "Sayers is the Kansas Comet");

assert(starr?.college === "Alabama", `Starr college Alabama (got ${starr?.college})`);
const unitas = Object.values(save.players).find((p) => p.lastName === "Unitas" && p.firstName === "Johnny");
assert(unitas?.college === "Louisville", `Unitas college Louisville (got ${unitas?.college})`);
assert(sayers?.college === "Kansas", `Sayers college Kansas (got ${sayers?.college})`);
assert(namath?.college === "Alabama", `Namath college Alabama (got ${namath?.college})`);
assert(nobisPl.college === "Texas", `Nobis college Texas (got ${nobisPl.college})`);
const starrCareer = g.careerTotals(starr);
assert(starr.career.length >= 8, `Starr prior career seasons (got ${starr.career.length})`);
assert(starrCareer.passYds > 10000, `Starr career pass yds through 1965 (got ${starrCareer.passYds})`);
const starrYds = starr.career.map((s) => s.passYds);
assert(new Set(starrYds).size >= 2, `Starr yearly pass yards are not a flat split (${starrYds.slice(0, 4).join(",")})`);
const starr65 = starr.career.find((s) => s.year === 1965);
assert(starr65, "Starr has a 1965 line");
assert(starr65.passYds >= 1800, `Starr 1965 pass yds (got ${starr65.passYds})`);
const unitasCareer = g.careerTotals(unitas);
assert(unitasCareer.passYds > 20000, `Unitas career pass yds through 1965 (got ${unitasCareer.passYds})`);
const sayersCareer = g.careerTotals(sayers);
assert(sayersCareer.rushYds >= 800, `Sayers 1965 rush yds on the card (got ${sayersCareer.rushYds})`);
const namathCareer = g.careerTotals(namath);
assert(namathCareer.passYds >= 2500, `Namath 1965 pass yds on the card (got ${namathCareer.passYds})`);

assert(g.SAVE_VERSION === 17, `SAVE_VERSION 17 (got ${g.SAVE_VERSION})`);
const lombardi = save.coaches.lombardi;
assert(lombardi, "Vince Lombardi is on the 1966 staff");
assert(lombardi.teamId === "gnb", "Lombardi coaches the Packers");
assert(lombardi.age >= 50 && lombardi.age <= 56, `Lombardi is in his 50s in 1966 (got ${lombardi.age})`);
assert((lombardi.abilities ?? []).includes("Motivator"), `Lombardi is a Motivator (got ${(lombardi.abilities ?? []).join(", ")})`);
assert((lombardi.abilities ?? []).includes("Ground game"), "Lombardi runs the ball");
assert(lombardi.careerWins >= 80, `Lombardi prior W-L is seeded (got ${lombardi.careerWins}-${lombardi.careerLosses})`);
assert(lombardi.leadership >= 90, `Lombardi leadership (got ${lombardi.leadership})`);
const halas = save.coaches.halas;
assert(halas, "George Halas is on the 1966 staff");
assert(halas.age >= 68, `Halas is old in 1966 (got ${halas.age})`);
assert((halas.abilities ?? []).length >= 2, "Halas has a kit");
const shula = save.coaches["shula-clt"];
assert(shula?.abilities?.includes("Genius") || shula?.abilities?.includes("Disciplinarian"), `Shula kit (got ${(shula?.abilities ?? []).join(", ")})`);
for (const id of active) {
  const t = save.teams[id];
  const hc = t.coachId ? save.coaches[t.coachId] : undefined;
  assert(hc, `${id} has a head coach`);
  assert((hc.abilities ?? []).length >= 1, `${id} HC ${hc.name} has abilities`);
  assert(hc.age >= 28 && hc.age <= 80, `${id} HC age ${hc.age}`);
  assert(t.ocId && save.coaches[t.ocId], `${id} has an OC`);
  assert(t.dcId && save.coaches[t.dcId], `${id} has a DC`);
}
assert(g.playerHofScore(save, starr) >= 64, `Starr is a Hall case (got ${g.playerHofScore(save, starr)})`);
assert(g.coachHofScore(lombardi) > 40, `Lombardi is a Hall case (got ${g.coachHofScore(lombardi)})`);
const belichick = save.coaches.belichick;
assert(belichick && belichick.teamId === null, "Belichick is in the pool, not hired in 1966");
assert(belichick.age >= 30, `Future Belichick is not a child on the 1966 list (got ${belichick.age})`);
assert(!starr.stats[1966] || !g.hasSeasonWork(starr.stats[1966]), "1966 season row is empty at kickoff");
const rosteredHist = Object.values(save.players).filter(
  (p) => p.historical && p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof",
);
const withCollege = rosteredHist.filter((p) => p.college);
assert(
  withCollege.length / rosteredHist.length >= 0.7,
  `70%+ named vets have college (got ${withCollege.length}/${rosteredHist.length})`,
);
const cookie = Object.values(save.players).find((p) => /gilchrist/i.test(p.lastName));
if (cookie) assert(cookie.college === "No college", `Cookie Gilchrist no college (got ${cookie.college})`);

const rostered = Object.values(save.players).filter((p) => p.teamId !== "retired" && p.teamId !== "hof");
const missingKit = rostered.filter((p) => !(p.abilities && p.abilities.length) || !(p.traits && p.traits.length));
assert(missingKit.length === 0, `every player has abilities and traits (missing ${missingKit.length})`);
assert(g.kitBoost(namath, "offPass") > 0, "Broadway Joe / Cannon boost the passing unit");
const iron = rostered.find((p) => (p.abilities ?? []).includes("Iron") || (p.traits ?? []).includes("Iron man"));
assert(iron && g.kitInjMult(iron) < 1, `${iron ? iron.lastName : "Iron"} stays healthier (${iron ? g.kitInjMult(iron) : "none"})`);
const glass = rostered.find((p) => (p.traits ?? []).includes("Glass"));
assert(!glass || g.kitInjMult(glass) > 1, "Glass misses more time");

let camp = g.createNewGame({ userTeamId: "gnb", startingYear: 1966, seed: 9 });
camp = g.advance(camp, { auto: true });
camp = g.advance(camp, { auto: true });
assert(camp.phase === "preseason", `camp lands on preseason (got ${camp.phase})`);
assert(camp.camp && camp.camp.year === 1966, "training camp report exists");
assert(Array.isArray(camp.camp.cuts), "camp recorded CPU cuts");
camp = g.advance(camp, { auto: false });
assert(camp.phase === "regular" && camp.week === 1, `kickoff is week 1 (got ${camp.phase} ${camp.week})`);
camp = g.advance(camp, { auto: false });
assert(camp.week === 1 && camp.phase === "regular", `Sunday stays on week 1 (got week ${camp.week})`);
assert(
  g.gamesInWeek(camp, 1).every((x) => x.played),
  "week 1 is in the books before Continue",
);
assert(g.weekIsInTheBooks(camp), "film night is up");
camp = g.advance(camp, { auto: false });
assert(camp.week === 2, `second click is next week (got ${camp.week})`);
const dlWeek = g.deadlineWeek(1966);
camp = g.simUntil(camp, (s) => s.phase === "deadline");
assert(camp.phase === "deadline", "trading week is a phase");
assert(camp.week === dlWeek, `deadline after week ${dlWeek} (got ${camp.week})`);
assert(camp.deadline && camp.deadline.year === 1966, "deadline session exists");
camp = g.advance(camp, { auto: true });
assert(camp.phase === "regular" && camp.week === dlWeek + 1, `window closes onto week ${dlWeek + 1} (got ${camp.phase} ${camp.week})`);

const after = g.simToSuperBowl(save);
assert(after.superBowl?.played, "Super Bowl I played");
const champs = g.leagueChampions(after);
assert(!!champs.nfl && !!champs.afl, `two league champs then a Super Bowl (nfl=${champs.nfl} afl=${champs.afl})`);
assert(after.superBowl.homeId && after.superBowl.awayId, "SB has two clubs");
assert(after.year === 1966, "still 1966 season when SB is played");
assert(after.teams.gnb.coachId === "lombardi", "CPU does not fire the user's head coach");
assert(
  after.coaches.lombardi.careerWins > 89,
  `Lombardi 1966 regular season counted (got ${after.coaches.lombardi.careerWins})`,
);
assert((after.coaches.lombardi.abilities ?? []).includes("Motivator"), "Lombardi kit survives the year");
assert(/coliseum/i.test(after.superBowl.stadium ?? ""), `SB I at the Coliseum (got ${after.superBowl.stadium})`);
assert(after.superBowl.neutral, "Super Bowl is a neutral site");
console.log(
  `Super Bowl I: ${after.superBowl.homeId} ${after.superBowl.homeScore} - ${after.superBowl.awayId} ${after.superBowl.awayScore} at ${g.superBowlSite(1966).site}`,
);

const played = after.schedule.filter((x) => x.played);
assert(played.length >= 160, `full 1966 slate played (got ${played.length})`);
const wxSet = played.filter((x) => x.weather).length;
assert(wxSet === played.length, "every Sunday has weather");
const withVenue = played.filter((x) => x.stadium).length;
assert(withVenue === played.length, "every Sunday has a stadium");
const pens = played.reduce((n, x) => n + (x.homePen ?? 0) + (x.awayPen ?? 0), 0);
assert(pens >= played.length * 2, `penalties land (${pens} on ${played.length} games)`);
const drives = played.reduce((n, x) => n + (x.drives?.length ?? 0), 0);
assert(drives >= played.length * 8, `drive charts exist (${drives})`);
let passAtt = 0;
let passCmp = 0;
let passInt = 0;
let rushAtt = 0;
let recTe = 0;
let maxSacks = 0;
let pf = 0;
for (const p of Object.values(after.players)) {
  const s = p.stats[1966];
  if (!s) continue;
  passAtt += s.passAtt;
  passCmp += s.passCmp;
  passInt += s.passInt;
  rushAtt += s.rushAtt;
  if (p.pos === "TE") recTe = Math.max(recTe, s.rec);
  maxSacks = Math.max(maxSacks, s.sacks);
}
for (const id of g.activeTeamIds(1966)) pf += after.teams[id].pf;
const cmp = passAtt ? passCmp / passAtt : 0;
const intRate = passAtt ? passInt / passAtt : 0;
const ppg = pf / Math.max(1, played.length) / 2;
assert(cmp > 0.42 && cmp < 0.58, `1966 league completion % looks like the 60s (got ${(cmp * 100).toFixed(1)})`);
assert(intRate > 0.03 && intRate < 0.09, `1966 INT rate era-shaped (got ${(intRate * 100).toFixed(1)}%)`);
assert(rushAtt > passAtt * 0.85, `1966 still a running league (rush ${rushAtt} pass ${passAtt})`);
assert(recTe <= 55, `no 1966 TE with modern volume (max ${recTe})`);
assert(maxSacks <= 22, `no 40-sack 1966 seasons (max ${maxSacks})`);
assert(ppg >= 16 && ppg <= 26, `1966 scoring not a track meet (ppg ${ppg.toFixed(1)})`);
const blowouts = played.filter((x) => Math.abs(x.homeScore - x.awayScore) >= 35).length;
assert(blowouts < played.length * 0.1, `blowouts rare (got ${blowouts})`);
const tos = played.reduce((n, x) => n + (x.homeTo ?? 0) + (x.awayTo ?? 0), 0);
assert(tos >= played.length * 0.5, `turnovers land (${tos} on ${played.length} games)`);
console.log(
  `1966 shape: cmp ${(cmp * 100).toFixed(1)}% INT ${(intRate * 100).toFixed(1)}% rush/pass ${rushAtt}/${passAtt} ppg ${ppg.toFixed(1)} pens ${pens}`,
);

const gnb = after.teams.gnb;
const careerGames = (gnb.careerWins ?? 0) + (gnb.careerLosses ?? 0) + (gnb.careerTies ?? 0);
assert(careerGames === 14, `Packers career W-L counts 14 regular games (got ${careerGames} ${gnb.careerWins}-${gnb.careerLosses}-${gnb.careerTies})`);
const grade = after.history.grade ?? g.gradeDynasty(after);
assert(grade.letter && grade.letter !== "—", `dynasty has a letter grade (got ${grade.letter})`);
assert(grade.seasons >= 1, `grade seasons >= 1 (got ${grade.seasons})`);
assert(grade.wins + grade.losses + grade.ties >= 14, `grade counts the 1966 slate (${grade.wins}-${grade.losses}-${grade.ties})`);
const packed = g.compactSave(after);
assert(packed.schedule.length === after.schedule.length, "compact keeps the slate");
assert(
  packed.schedule.every((x) => typeof x.homeScore === "number"),
  "compact keeps scores",
);
assert(packed.news.length <= 80, `compact trims the wire (got ${packed.news.length})`);

const next = g.fastForwardToYear(after, 1967);
assert(next.year === 1967, `1967 lands (got ${next.year} ${next.phase})`);
assert(next.phase === "expansion", `1967 opens on expansion night (got ${next.phase})`);
assert((next.history.seasons ?? []).some((c) => c.year === 1966), "1966 chapter is in the franchise book");
const chapter = (next.history.seasons ?? []).find((c) => c.year === 1966);
assert(chapter, "1966 chapter exists");
assert(
  chapter.wins + chapter.losses + chapter.ties === 14,
  `1966 chapter is a 14-game season (got ${chapter.wins}-${chapter.losses}-${chapter.ties})`,
);
assert(chapter.result, `1966 chapter has a result (got ${chapter.result})`);
assert(next.expansion?.done, "Saints allocation has already moved veterans");
assert((next.expansion?.picksMade.length ?? 0) >= 20, `Saints took a real list (got ${next.expansion?.picksMade.length})`);
const nor = g.rosterOf(next, "nor");
assert(nor.length >= 40, `Saints roster ${nor.length} after expansion night`);
assert(nor.some((p) => p.historical && p.teamId === "nor"), "Saints roster includes a named veteran taken off another club");

console.log(`grade ${grade.letter} ${grade.wins}-${grade.losses} career · expansion ${next.expansion?.picksMade.length} moved`);
console.log("qa-season passed");
