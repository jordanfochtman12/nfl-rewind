import { locationOf, TEAM_META } from "./teams.ts";

const positions: Record<string, string> = {
  QB: "quarterback",
  RB: "running back",
  FB: "fullback",
  WR: "wide receiver",
  TE: "tight end",
  OT: "offensive tackle",
  OG: "offensive guard",
  OL: "offensive lineman",
  C: "center",
  LT: "left tackle",
  RT: "right tackle",
  LG: "left guard",
  RG: "right guard",
  DE: "defensive end",
  DT: "defensive tackle",
  NT: "nose tackle",
  DL: "defensive lineman",
  LB: "linebacker",
  ILB: "inside linebacker",
  OLB: "outside linebacker",
  MLB: "middle linebacker",
  CB: "cornerback",
  DB: "defensive back",
  FS: "free safety",
  SS: "strong safety",
  S: "safety",
  K: "kicker",
  P: "punter",
  LS: "long snapper",
  KR: "kick returner",
  PR: "punt returner",
};
const counts: Record<string, [string, string]> = {
  yds: ["yard", "yards"],
  yd: ["yard", "yards"],
  TD: ["touchdown", "touchdowns"],
  INT: ["interception", "interceptions"],
  FF: ["forced fumble", "forced fumbles"],
  FR: ["fumble recovery", "fumble recoveries"],
  FUM: ["fumble", "fumbles"],
  TFL: ["tackle for loss", "tackles for loss"],
  PD: ["pass defended", "passes defended"],
  PBU: ["pass breakup", "pass breakups"],
  SK: ["sack", "sacks"],
  SCK: ["sack", "sacks"],
  TKL: ["tackle", "tackles"],
  TOT: ["total tackle", "total tackles"],
  rec: ["reception", "receptions"],
  att: ["attempt", "attempts"],
  cmp: ["completion", "completions"],
  pts: ["point", "points"],
  FG: ["field goal", "field goals"],
  XP: ["extra point", "extra points"],
};
const labels: Record<string, string> = {
  YPC: "yards per carry",
  YPA: "yards per attempt",
  YPR: "yards per reception",
  YPG: "yards per game",
  YAC: "yards after catch",
  AYPA: "adjusted yards per attempt",
  ANYA: "adjusted net yards per attempt",
  LNG: "longest",
  AVG: "average",
  PCT: "percentage",
  NET: "net yards",
  RET: "returns",
  TB: "touchbacks",
  IN20: "punts inside the twenty",
  RTG: "passer rating",
  QBR: "quarterback rating",
  GP: "games played",
  GS: "games started",
  FGM: "field goals made",
  FGA: "field goal attempts",
  XPM: "extra points made",
  XPA: "extra point attempts",
  OVR: "overall",
  MVP: "most valuable player",
  OPOY: "offensive player of the year",
  DPOY: "defensive player of the year",
  OROY: "offensive rookie of the year",
  DROY: "defensive rookie of the year",
};
const number = "(-?\\d+(?:,\\d{3})*(?:\\.\\d+)?)";
const counted = (n: string, forms: [string, string]) =>
  `${n} ${forms[Number(n.replaceAll(",", "")) === 1 ? 0 : 1]}`;

/** Speech-only expansion: keep compact scoreboards and the saved transcript untouched. */
export function footballSpeech(text: string, year: number): string {
  let spoken = text;
  // Resolve identity before positions, including single-letter positions only beside a team.
  for (const team of Object.values(TEAM_META)) {
    const city = locationOf(year, team.id);
    spoken = spoken.replace(
      new RegExp(`\\b${team.abbr}\\s+(${Object.keys(positions).join("|")})\\b`, "g"),
      (_, pos: string) => `${city} ${positions[pos]}`,
    );
    spoken = spoken.replace(new RegExp(`\\b${team.abbr}\\b`, "g"), city);
  }
  spoken = spoken.replace(
    /\b(?:CMP\/ATT|C-A)\s+(\d+)[/-](\d+)\b/g,
    "$1 completions on $2 attempts",
  );
  spoken = spoken.replace(
    /\b(FG|XP)\s+(\d+)\/(\d+)\b/g,
    (_, kind: string, made: string, attempts: string) =>
      `${made} of ${attempts} ${kind === "FG" ? "field goals" : "extra points"}`,
  );
  spoken = spoken.replace(
    /\b(\d+)\/(\d+)(?=,?\s+[\d,]+\s+yds\b)/g,
    "$1 completions on $2 attempts",
  );
  spoken = spoken
    .replace(/\b(\d+)-(-?\d+) rushing\b/g, "$1 carries for $2 rushing yards")
    .replace(/\b(\d+)-(-?\d+) receiving\b/g, "$1 receptions for $2 receiving yards");
  spoken = spoken.replace(
    /\b(pass|rush|rec) (?=yds|TD\b)/g,
    (_, kind: string) => ({ pass: "passing ", rush: "rushing ", rec: "receiving " })[kind]!,
  );
  const percentages: Record<string, string> = {
    FG: "field goal",
    XP: "extra point",
    CMP: "completion",
  };
  spoken = spoken.replace(
    /\b(FG|XP|CMP)%:?\s*(\d+(?:\.\d+)?)/g,
    (_, kind: string, value: string) => `${percentages[kind]} percentage, ${value} percent`,
  );
  spoken = spoken.replace(
    /\b(FG|XP|CMP)\s+(\d+(?:\.\d+)?)%/g,
    (_, kind: string, value: string) => `${percentages[kind]} percentage, ${value} percent`,
  );
  spoken = spoken.replace(/\b(TD|INT|FF|FR|FG|XP)s\b/gi, (_, stat: string) => stat.toUpperCase());
  for (const [short, forms] of Object.entries(counts)) {
    spoken = spoken.replace(new RegExp(`\\b${short}:? ${number}`, "gi"), (_, n: string) =>
      counted(n, forms),
    );
    // Preserve modifiers between the number and statistic (e.g. 1 rushing TD).
    const pattern = new RegExp(
      `${number} (passing |rushing |receiving |total |career )?${short}\\b`,
      "gi",
    );
    spoken = spoken.replace(pattern, (_, n: string, modifier = "") => {
      const words = counted(n, forms);
      return modifier ? words.replace(" ", ` ${modifier}`) : words;
    });
    spoken = spoken.replace(new RegExp(`\\b${short}\\b`, "gi"), forms[1]);
  }
  for (const [short, label] of Object.entries(labels))
    spoken = spoken.replace(new RegExp(`\\b${short}\\b`, "g"), label);
  for (const [short, label] of Object.entries(positions)) {
    if (short.length > 1 && !["OT", "PR"].includes(short))
      spoken = spoken.replace(new RegExp(`\\b${short}\\b`, "g"), label);
  }
  return spoken
    .replace(
      /\bQ([1-4])\b/g,
      (_, q: string) =>
        ["", "first quarter", "second quarter", "third quarter", "fourth quarter"][Number(q)]!,
    )
    .replace(/(\d+(?:\.\d+)?)%/g, "$1 percent")
    .replace(/[·—]/g, ", ")
    .replace(/[()]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}
