#!/usr/bin/env node
/** Original geometric club emblems. Era-correct silhouettes, not traced NFL files. */
import { writeFileSync } from "node:fs";

function svg(label, fill, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${label}">
<rect width="64" height="64" rx="10" fill="${fill}"/>
${inner}
</svg>
`;
}

const logos = {};

// Green Bay Packers — yellow G in a green oval (1961+)
logos["gnb.svg"] = svg(
  "Green Bay Packers",
  "#203731",
  `<ellipse cx="32" cy="32" rx="24" ry="19.5" fill="none" stroke="#ffb612" stroke-width="3.4"/>
<path fill="#ffb612" d="M46.2 23.6c-3-5.8-9.2-9-16.4-9-10.6 0-18.2 7.6-18.2 17.4 0 9.8 7.8 17.6 18.6 17.6 6.8 0 13-3 16.2-8.4l-6.8-3.4c-2 3.2-5.6 5-9.4 5-6.6 0-11-4.6-11-10.8 0-6 4.4-10.6 10.8-10.6 3.6 0 6.8 1.6 8.6 4.2l7.6-2z"/>
<rect x="31.5" y="30.2" width="15.2" height="4.4" rx="0.6" fill="#ffb612"/>`,
);

// Dallas Cowboys — silver star
logos["dal.svg"] = svg(
  "Dallas Cowboys",
  "#041e42",
  `<path fill="#b0b7bc" d="M32 7 L39.1 25.6 H58.4 L42.8 37.2 L49.2 56.2 L32 44.4 L14.8 56.2 L21.2 37.2 L5.6 25.6 H24.9 Z"/>
<path fill="#ffffff" d="M32 12.2 L37.4 26.4 H52.2 L40.4 35.4 L45.2 50 L32 41 L18.8 50 L23.6 35.4 L11.8 26.4 H26.6 Z"/>`,
);

// Pittsburgh Steelers — Steelmark (three hypocycloids on gold)
logos["pit.svg"] = svg(
  "Pittsburgh Steelers",
  "#101820",
  `<circle cx="32" cy="32" r="22" fill="#ffb612"/>
<path fill="#c60c30" d="M32 11 L35.2 22.4 L47 24.6 L37.4 31.2 L40.6 43 L32 36.4 L23.4 43 L26.6 31.2 L17 24.6 L28.8 22.4 Z"/>
<path fill="#ffb612" stroke="#101820" stroke-width="1.1" d="M22 28 L25.2 39.4 L37 41.6 L27.4 48.2 L30.6 60 L22 53.4 L13.4 60 L16.6 48.2 L7 41.6 L18.8 39.4 Z"/>
<path fill="#003087" d="M42 28 L45.2 39.4 L57 41.6 L47.4 48.2 L50.6 60 L42 53.4 L33.4 60 L36.6 48.2 L27 41.6 L38.8 39.4 Z"/>`,
);

// Kansas City Chiefs — arrowhead + KC
logos["kan.svg"] = svg(
  "Kansas City Chiefs",
  "#e31837",
  `<path fill="#ffb81c" d="M32 6 L50 48 L32 42 L14 48 Z"/>
<path fill="#e31837" d="M32 14 L44 44 L32 40 L20 44 Z"/>
<text x="32" y="36" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="11" font-weight="800" fill="#ffffff">KC</text>`,
);

// Oakland / LA / LV Raiders — pirate helmet
logos["rai.svg"] = svg(
  "Raiders",
  "#000000",
  `<path fill="#a5acaf" d="M12 46 L20 22 L24 24 L16 48 Z"/>
<path fill="#a5acaf" d="M52 46 L44 22 L40 24 L48 48 Z"/>
<path fill="#a5acaf" d="M18 28 C18 14 26 10 32 10 C46 10 50 20 50 28 C50 36 46 42 40 44 L24 44 C18 42 18 34 18 28Z"/>
<rect x="24" y="28" width="20" height="3" fill="#000"/>
<rect x="24" y="34" width="18" height="2.4" fill="#000"/>
<circle cx="27" cy="24" r="2.4" fill="#000"/>
<circle cx="27" cy="24" r="1" fill="#a5acaf"/>
<path fill="#000" d="M32 22 H46 V27 H32 Z"/>
<path fill="#a5acaf" d="M22 44 L32 50 L42 44 Z"/>`,
);

// San Francisco 49ers — SF in oval
logos["sfo.svg"] = svg(
  "San Francisco 49ers",
  "#aa0000",
  `<ellipse cx="32" cy="32" rx="24" ry="20" fill="#aa0000" stroke="#b3995d" stroke-width="3"/>
<text x="32" y="40" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="22" font-weight="800" fill="#b3995d" letter-spacing="-1">SF</text>`,
);

// Chicago Bears — wishbone C
logos["chi.svg"] = svg(
  "Chicago Bears",
  "#0b162a",
  `<path fill="#c83803" d="M46 16 H24 C12 16 8 26 8 32 C8 40 12 50 24 50 H46 V42 H26 C20 42 18 38 18 32 C18 26 20 22 26 22 H46 Z"/>
<path fill="#0b162a" d="M46 22 H28 C22 22 20 26 20 32 C20 38 22 42 28 42 H46 V38 H30 C26 38 26 36 26 32 C26 28 26 26 30 26 H46 Z"/>`,
);

// Minnesota Vikings — Norseman profile
logos["min.svg"] = svg(
  "Minnesota Vikings",
  "#4f2683",
  `<path fill="#ffc62f" d="M18 44 C16 24 24 14 34 16 C42 18 46 26 44 36 C50 28 54 30 56 24 L52 40 C48 48 40 50 32 50 C22 50 18 46 18 44Z"/>
<path fill="#4f2683" d="M30 28 C34 26 38 28 38 32 C36 36 32 36 30 34 C28 32 28 30 30 28Z"/>
<path fill="#ffc62f" d="M12 22 L22 18 L18 30 Z"/>
<path fill="#ffc62f" d="M46 14 L56 12 L50 24 Z"/>
<path fill="#c60c30" d="M34 38 C36 40 34 44 30 44 C32 40 34 38 34 38Z"/>`,
);

// New Orleans Saints — fleur-de-lis
logos["nor.svg"] = svg(
  "New Orleans Saints",
  "#101820",
  `<path fill="#d3bc8d" d="M32 6 C28 14 22 18 22 26 C22 31 26 34 32 31 C38 34 42 31 42 26 C42 18 36 14 32 6Z"/>
<path fill="#d3bc8d" d="M10 28 C16 20 24 24 32 32 C40 24 48 20 54 28 C46 36 38 38 32 34 C26 38 18 36 10 28Z"/>
<path fill="#d3bc8d" d="M28 33 L24 56 L32 50 L40 56 L36 33 Q32 36 28 33Z"/>
<circle cx="32" cy="28" r="2.2" fill="#101820"/>`,
);

// Baltimore / Indianapolis Colts — horseshoe
logos["clt.svg"] = svg(
  "Colts",
  "#002c5f",
  `<path fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" d="M18 50 C16 22 48 22 46 50"/>
<path fill="none" stroke="#002c5f" stroke-width="4.2" stroke-linecap="round" d="M22 48 C21 26 43 26 42 48"/>
<circle cx="19" cy="46" r="1.7" fill="#002c5f"/>
<circle cx="23" cy="38" r="1.7" fill="#002c5f"/>
<circle cx="27" cy="32" r="1.7" fill="#002c5f"/>
<circle cx="37" cy="32" r="1.7" fill="#002c5f"/>
<circle cx="41" cy="38" r="1.7" fill="#002c5f"/>
<circle cx="45" cy="46" r="1.7" fill="#002c5f"/>`,
);

// Miami Dolphins — sunburst + leaping dolphin (1966)
logos["mia.svg"] = svg(
  "Miami Dolphins",
  "#008e97",
  `<g fill="#fc4c02">
<circle cx="38" cy="24" r="9"/>
${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  .map(
    (a) =>
      `<rect x="36.6" y="6" width="2.8" height="8" rx="1" transform="rotate(${a} 38 24)"/>`,
  )
  .join("")}
</g>
<path fill="#ffffff" d="M8 40 C18 28 32 26 46 32 C38 26 40 18 48 16 C42 20 44 28 50 34 C52 40 46 48 34 50 C22 52 12 48 8 40Z"/>
<path fill="#008e97" d="M28 36 C32 32 40 32 44 36 C40 38 34 38 28 36Z"/>
<path fill="#ffffff" d="M46 18 L56 12 L50 22 Z"/>`,
);

// Buffalo Bills 1966 — standing buffalo
logos["buf.svg"] = svg(
  "Buffalo Bills",
  "#00338d",
  `<path fill="#c60c30" d="M14 44 L18 28 L28 22 L40 24 L48 20 L52 28 L48 36 L54 42 L44 44 L40 50 L28 48 L22 52 L16 48 Z"/>
<circle cx="46" cy="26" r="2.4" fill="#00338d"/>
<path fill="#c60c30" d="M48 18 L58 14 L52 26 Z"/>
<rect x="22" y="44" width="4" height="10" fill="#c60c30"/>
<rect x="34" y="44" width="4" height="10" fill="#c60c30"/>`,
);

// Buffalo charging (1974+)
logos["buf-modern.svg"] = svg(
  "Buffalo Bills",
  "#00338d",
  `<path fill="#c60c30" d="M6 40 L22 28 L34 22 L48 18 L58 14 L54 26 L58 34 L48 36 L52 44 L38 42 L28 48 L16 46 L10 50 Z"/>
<path fill="#ffffff" d="M44 22 L54 16 L50 28 Z"/>
<circle cx="50" cy="24" r="2" fill="#00338d"/>
<path fill="#c60c30" d="M18 42 L14 56 L22 48 Z"/>`,
);

// New York Jets 1960s — green football + jet
logos["nyj.svg"] = svg(
  "New York Jets",
  "#125740",
  `<ellipse cx="32" cy="32" rx="26" ry="16" fill="#ffffff"/>
<ellipse cx="32" cy="32" rx="22" ry="12.5" fill="#125740"/>
<path fill="#ffffff" d="M14 32 L36 24 L34 30 L52 32 L34 34 L36 40 Z"/>
<text x="32" y="48" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="800" fill="#ffffff" letter-spacing="1.4">JETS</text>`,
);

// Jets later — NY wordmark football
logos["nyj-modern.svg"] = svg(
  "New York Jets",
  "#125740",
  `<ellipse cx="32" cy="32" rx="26" ry="18" fill="#ffffff"/>
<text x="32" y="38" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="20" font-weight="800" fill="#125740">NY</text>`,
);

// New York Giants — ny
logos["nyg.svg"] = svg(
  "New York Giants",
  "#0b2265",
  `<text x="32" y="36" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="28" font-weight="700" fill="#a71930" font-style="italic">ny</text>
<rect x="16" y="42" width="32" height="3" fill="#a71930"/>
<text x="32" y="54" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" fill="#ffffff" letter-spacing="1.5">GIANTS</text>`,
);

// Philadelphia Eagles — spread wings
logos["phi.svg"] = svg(
  "Philadelphia Eagles",
  "#004c54",
  `<path fill="#a5acaf" d="M6 36 Q20 10 32 22 Q44 10 58 36 Q44 26 32 32 Q20 26 6 36Z"/>
<path fill="#004c54" d="M18 32 Q32 18 46 32 Q32 28 18 32Z"/>
<path fill="#a5acaf" d="M28 30 L32 14 L36 30 L32 28 Z"/>
<circle cx="32" cy="24" r="2.4" fill="#a5acaf"/>
<path fill="#a5acaf" d="M30 32 L32 48 L34 32 Z"/>`,
);

// Los Angeles Rams 1960s–90s — curling ram horn
logos["ram.svg"] = svg(
  "Los Angeles Rams",
  "#003594",
  `<path fill="#ffd100" d="M18 44 C12 28 18 12 32 10 C48 8 56 22 50 34 C46 42 38 40 36 32 C38 38 44 36 44 28 C44 18 36 16 30 18 C20 22 18 34 24 42 C20 42 18 44 18 44Z"/>
<circle cx="34" cy="22" r="3" fill="#003594"/>
<path fill="#ffd100" d="M40 18 C48 14 54 20 50 28" fill="none" stroke="#ffd100" stroke-width="3"/>`,
);

// St. Louis Rams ram head (2000–2016)
logos["ram-stl.svg"] = svg(
  "St. Louis Rams",
  "#002244",
  `<path fill="#c4ced4" d="M14 40 C16 18 30 10 40 14 C50 18 54 30 48 40 L42 52 L28 50 L20 54 Z"/>
<path fill="#002244" d="M30 28 C36 24 42 28 42 34 C40 38 34 38 32 34Z"/>
<path fill="#ffd100" d="M44 16 C56 10 58 24 50 30 C54 20 48 16 44 16Z"/>
<path fill="#ffd100" d="M18 20 C8 16 8 30 16 34 C12 24 16 20 18 20Z"/>`,
);

// LA Rams 2017+ — ram head navy/gold
logos["ram-modern.svg"] = svg(
  "Los Angeles Rams",
  "#003594",
  `<path fill="#ffd100" d="M12 42 C14 18 28 8 42 14 C54 20 56 36 46 46 L38 56 L24 52 L16 56 Z"/>
<path fill="#003594" d="M32 30 C38 26 44 30 44 36 C42 42 34 42 32 36Z"/>
<path fill="#ffd100" d="M46 14 C58 8 60 22 52 30"/>
<circle cx="38" cy="32" r="2.2" fill="#003594"/>`,
);

// Detroit Lions — lion profile
logos["det.svg"] = svg(
  "Detroit Lions",
  "#0076b6",
  `<path fill="#b0b7bc" d="M10 42 C12 22 22 14 34 16 C44 18 50 24 48 34 C54 30 58 34 56 42 L44 46 L20 48 Z"/>
<path fill="#0076b6" d="M30 28 C34 26 38 28 38 32 C36 36 32 36 30 34Z"/>
<path fill="#b0b7bc" d="M44 20 L54 12 L50 24 Z"/>
<path fill="#b0b7bc" d="M16 44 L12 56 L20 50 Z"/>
<path fill="#b0b7bc" d="M28 46 L26 56 L32 50 Z"/>`,
);

// Cleveland Browns — orange helmet (the club has no other mark)
logos["cle.svg"] = svg(
  "Cleveland Browns",
  "#311d00",
  `<path fill="#ff3c00" d="M12 36 C12 16 22 10 32 10 C50 10 54 22 54 34 C54 44 46 48 38 48 L20 48 C14 48 12 42 12 36Z"/>
<rect x="30" y="10" width="4" height="38" fill="#ffffff"/>
<rect x="26" y="10" width="2.2" height="38" fill="#311d00"/>
<rect x="35.8" y="10" width="2.2" height="38" fill="#311d00"/>
<path fill="none" stroke="#b0b7bc" stroke-width="1.6" d="M22 40 H48"/>
<path fill="none" stroke="#b0b7bc" stroke-width="1.6" d="M20 44 H46"/>`,
);

// Atlanta Falcons 1966 — falcon
logos["atl.svg"] = svg(
  "Atlanta Falcons",
  "#000000",
  `<path fill="#a71930" d="M8 40 Q24 8 40 24 Q52 12 58 28 Q44 28 36 40 Q28 52 16 50 Q10 48 8 40Z"/>
<path fill="#ffffff" d="M28 28 L40 22 L36 32 Z"/>
<path fill="#000000" d="M22 32 Q32 20 44 30 Q32 28 22 32Z"/>`,
);

// Falcons 1990+ — more aggressive falcon
logos["atl-modern.svg"] = svg(
  "Atlanta Falcons",
  "#000000",
  `<path fill="#a71930" d="M6 36 L28 8 L38 20 L58 12 L44 32 L54 48 L36 40 L28 56 L24 40 L8 48 Z"/>
<path fill="#a5acaf" d="M28 22 L38 18 L34 28 Z"/>`,
);

// Washington 1966–2019 — burgundy & gold spear (no caricature)
logos["was.svg"] = svg(
  "Washington",
  "#5a1414",
  `<circle cx="32" cy="32" r="22" fill="none" stroke="#ffb612" stroke-width="3"/>
<path fill="#ffb612" d="M14 34 L48 18 L50 24 L18 40 Z"/>
<path fill="#ffb612" d="M46 16 L56 14 L52 26 Z"/>
<path fill="#ffb612" d="M20 28 C16 18 22 14 28 18 C24 22 24 28 20 32 Z"/>
<path fill="#ffb612" d="M18 30 C12 22 16 14 24 16 C20 22 20 28 18 34 Z"/>`,
);

logos["was-wft.svg"] = svg(
  "Washington Football Team",
  "#5a1414",
  `<circle cx="32" cy="32" r="22" fill="none" stroke="#ffb612" stroke-width="3"/>
<text x="32" y="38" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="16" font-weight="800" fill="#ffb612">W</text>`,
);

logos["was-cmd.svg"] = svg(
  "Washington Commanders",
  "#5a1414",
  `<text x="32" y="44" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="36" font-weight="800" fill="#ffb612">W</text>
<path fill="#ffb612" d="M32 8 L34.2 14.2 H41 L35.6 18 L37.6 24.4 L32 20.4 L26.4 24.4 L28.4 18 L23 14.2 H29.8 Z"/>`,
);

// Arizona / St. Louis / Phoenix Cardinals — cardinal head
logos["crd.svg"] = svg(
  "Cardinals",
  "#97233f",
  `<path fill="#ffffff" d="M10 40 C16 18 36 12 50 22 C42 18 40 28 48 34 C40 32 34 40 40 50 C28 46 16 48 10 40Z"/>
<path fill="#ffb612" d="M48 22 L62 28 L50 34 Z"/>
<circle cx="36" cy="28" r="2.4" fill="#000"/>
<path fill="#97233f" d="M24 36 C30 32 36 34 38 40 C32 40 26 40 24 36Z"/>`,
);

// New England Patriots 1960s — Pat Patriot
logos["nwe.svg"] = svg(
  "Boston / New England Patriots",
  "#c60c30",
  `<path fill="#c60c30" d="M22 34 L28 22 L40 22 L46 34 L42 50 L26 50 Z"/>
<path fill="#ffffff" d="M26 24 H42 V30 H26 Z"/>
<path fill="#f1d3b2" d="M28 16 H40 L38 24 H30 Z"/>
<path fill="#002244" d="M24 12 H44 L40 18 H28 Z"/>
<path fill="#002244" d="M22 12 L18 16 L24 16 Z"/>
<path fill="#002244" d="M46 12 L50 16 L44 16 Z"/>
<circle cx="30" cy="20" r="1.2" fill="#002244"/>
<path fill="#c60c30" d="M18 36 L12 32 L20 40 L16 48 L24 44 Z"/>
<ellipse cx="14" cy="46" rx="8" ry="4" fill="#8b5a2b"/>`,
);

// Patriots 1993+ — Flying Elvis profile
logos["nwe-modern.svg"] = svg(
  "New England Patriots",
  "#002244",
  `<g transform="scale(-1,1) translate(-64,0)">
<path fill="#b0b7bc" d="M14 44 C16 20 28 10 40 14 C50 18 52 30 46 38 C54 32 56 40 48 46 L36 50 L22 48 Z"/>
<path fill="#c60c30" d="M34 28 L50 24 L48 34 L36 34 Z"/>
<path fill="#002244" d="M28 26 C32 24 36 26 36 30 C34 34 30 34 28 32Z"/>
<path fill="#b0b7bc" d="M40 16 C50 8 58 18 50 28 C54 18 46 14 40 16Z"/>
<path fill="none" stroke="#b0b7bc" stroke-width="1.4" d="M30 36 H44 M30 40 H42"/>
</g>`,
);

// Denver Broncos 1968–96 — horse through a D
logos["den.svg"] = svg(
  "Denver Broncos",
  "#002244",
  `<path fill="#fb4f14" d="M14 12 H36 C50 12 54 24 54 32 C54 44 46 52 34 52 H14 Z"/>
<path fill="#002244" d="M22 20 H34 C42 20 44 26 44 32 C44 40 40 44 32 44 H22 Z"/>
<path fill="#fb4f14" d="M8 40 L20 22 L30 18 L40 24 L50 16 L46 30 L54 44 L38 40 L32 54 L22 40 Z"/>`,
);

// Broncos 1997+ — horse head
logos["den-modern.svg"] = svg(
  "Denver Broncos",
  "#002244",
  `<path fill="#fb4f14" d="M8 48 C10 24 22 10 36 12 C48 14 56 24 52 36 C60 28 62 36 56 44 L44 52 L24 50 L14 56 Z"/>
<path fill="#002244" d="M30 28 C36 24 42 28 42 34 C40 40 32 40 30 36Z"/>
<path fill="#fb4f14" d="M44 16 L58 8 L52 24 Z"/>
<path fill="#fb4f14" d="M18 44 L12 58 L22 50 Z"/>`,
);

// Houston Oilers — derrick
logos["oti.svg"] = svg(
  "Houston Oilers",
  "#0072ce",
  `<path fill="#c8102e" d="M32 6 L44 46 H20 Z"/>
<rect x="16" y="46" width="32" height="8" fill="#c8102e"/>
<rect x="30" y="12" width="4" height="34" fill="#ffffff"/>
<path stroke="#ffffff" stroke-width="2.2" d="M22 26 H42 M20 34 H44 M24 18 H40"/>
<circle cx="32" cy="50" r="2" fill="#ffffff"/>`,
);

// Tennessee Titans — sword T / stars
logos["oti-titans.svg"] = svg(
  "Tennessee Titans",
  "#0c2340",
  `<circle cx="32" cy="32" r="24" fill="#0c2340" stroke="#4b92db" stroke-width="2"/>
<path fill="#c8102e" d="M18 16 H46 L42 24 H36 V50 H28 V24 H22 Z"/>
<path fill="#4b92db" d="M30 8 L32 13 L37 13 L33 16 L35 21 L30 18 L25 21 L27 16 L23 13 L28 13 Z"/>
<path fill="#ffffff" d="M14 46 L16 51 L21 51 L17 54 L19 59 L14 56 L9 59 L11 54 L7 51 L12 51 Z"/>
<path fill="#c8102e" d="M44 46 L46 51 L51 51 L47 54 L49 59 L44 56 L39 59 L41 54 L37 51 L42 51 Z"/>`,
);

// San Diego Chargers — bolt
logos["sdg.svg"] = svg(
  "San Diego Chargers",
  "#0080c6",
  `<path fill="#ffffff" d="M40 4 L14 34 H30 L22 60 L54 26 H38 Z"/>
<path fill="#ffc20e" d="M38 8 L18 34 H32 L26 54 L50 28 H36 Z"/>`,
);

// LA Chargers navy bolt
logos["sdg-modern.svg"] = svg(
  "Los Angeles Chargers",
  "#002244",
  `<path fill="#ffffff" d="M40 4 L14 34 H30 L22 60 L54 26 H38 Z"/>
<path fill="#ffc20e" d="M38 8 L18 34 H32 L26 54 L50 28 H36 Z"/>`,
);

// Cincinnati Bengals 1968 — B
logos["cin.svg"] = svg(
  "Cincinnati Bengals",
  "#000000",
  `<text x="32" y="46" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="42" font-weight="800" fill="#fb4f14">B</text>
<path stroke="#000" stroke-width="2" d="M20 18 L28 46 M26 16 L34 46 M32 18 L38 46"/>`,
);

// Bengals 1981+ — tiger stripes / leaping tiger
logos["cin-modern.svg"] = svg(
  "Cincinnati Bengals",
  "#000000",
  `<path fill="#fb4f14" d="M8 40 C12 20 24 12 36 16 C48 20 54 32 48 42 L40 54 L22 52 L12 56 Z"/>
<path fill="#000" d="M20 28 L24 48 M28 22 L32 50 M36 24 L38 48 M18 36 H42"/>
<circle cx="40" cy="28" r="2.4" fill="#000"/>
<path fill="#fb4f14" d="M44 18 L56 12 L50 26 Z"/>`,
);

// Tampa Bay Buccaneers 1976–96 — Bucco Bruce
logos["tam.svg"] = svg(
  "Tampa Bay Buccaneers",
  "#d50a0a",
  `<circle cx="32" cy="30" r="16" fill="#f1d3b2"/>
<path fill="#34302b" d="M16 20 H48 L44 28 H20 Z"/>
<path fill="#d50a0a" d="M18 16 H46 L42 22 H22 Z"/>
<path fill="#34302b" d="M24 28 H40 V32 H24 Z"/>
<path fill="#34302b" d="M22 38 Q32 44 42 38"/>
<path fill="#ffb612" d="M14 40 L24 34 L22 42 Z"/>
<ellipse cx="20" cy="48" rx="10" ry="5" fill="#ffb612"/>
<path fill="#ffffff" d="M28 34 H36 V36 H28 Z"/>`,
);

// Bucs 1997+ — skull and flag
logos["tam-modern.svg"] = svg(
  "Tampa Bay Buccaneers",
  "#34302b",
  `<path fill="#d50a0a" d="M8 12 H40 L36 28 H12 Z"/>
<path fill="#d50a0a" d="M36 12 L56 20 L36 28 Z"/>
<circle cx="28" cy="40" r="14" fill="#c4ced4"/>
<ellipse cx="22" cy="38" rx="3.2" ry="4" fill="#34302b"/>
<ellipse cx="34" cy="38" rx="3.2" ry="4" fill="#34302b"/>
<path fill="#34302b" d="M24 48 Q28 52 32 48 Q28 50 24 48Z"/>
<path fill="#c4ced4" d="M16 52 L28 44 L26 54 Z"/>
<path fill="#c4ced4" d="M40 52 L28 44 L30 54 Z"/>`,
);

// Seattle Seahawks 1976–2001 — osprey
logos["sea.svg"] = svg(
  "Seattle Seahawks",
  "#002244",
  `<path fill="#69be28" d="M8 40 C16 12 40 10 52 28 C44 22 40 32 50 38 C40 36 32 46 38 54 C24 50 12 50 8 40Z"/>
<path fill="#a5acaf" d="M28 28 C34 24 40 28 40 34 C38 38 32 38 30 34Z"/>
<path fill="#69be28" d="M48 24 L60 20 L54 32 Z"/>
<circle cx="36" cy="30" r="2.2" fill="#002244"/>`,
);

// Seahawks 2002+
logos["sea-modern.svg"] = svg(
  "Seattle Seahawks",
  "#002244",
  `<path fill="#69be28" d="M6 38 C14 10 38 6 54 22 C46 16 44 28 56 34 C44 32 36 44 44 54 C26 52 10 50 6 38Z"/>
<path fill="#a5acaf" d="M26 26 C34 20 44 24 44 32 C42 38 34 38 30 34Z"/>
<circle cx="38" cy="28" r="2.6" fill="#69be28"/>
<path fill="#69be28" d="M50 18 L62 12 L56 28 Z"/>`,
);

// Carolina Panthers
logos["car.svg"] = svg(
  "Carolina Panthers",
  "#101820",
  `<path fill="#0085ca" d="M10 42 C12 16 30 8 44 14 C54 20 56 34 48 44 L38 56 L22 52 L12 56 Z"/>
<path fill="#101820" d="M28 28 C36 22 44 28 44 36 C42 42 32 42 30 36Z"/>
<path fill="#c4ced4" d="M44 16 L58 8 L52 24 Z"/>
<path fill="none" stroke="#c4ced4" stroke-width="1.6" d="M16 22 C10 18 8 28 16 34"/>
<circle cx="36" cy="30" r="2.2" fill="#c4ced4"/>
<path fill="#c4ced4" d="M40 34 L48 38 L40 40 Z"/>`,
);

// Jacksonville Jaguars
logos["jax.svg"] = svg(
  "Jacksonville Jaguars",
  "#006778",
  `<path fill="#d7a22a" d="M8 42 C12 18 30 8 44 14 C54 18 58 32 50 42 L40 56 L22 52 L12 56 Z"/>
<path fill="#006778" d="M28 28 C36 22 44 28 44 36 C42 42 32 42 30 36Z"/>
<path fill="#d7a22a" d="M46 16 L60 10 L54 26 Z"/>
<circle cx="38" cy="30" r="2.4" fill="#000"/>
<path fill="#000" d="M20 36 C26 32 34 34 36 40 C28 42 20 40 20 36Z"/>`,
);

// Baltimore Ravens
logos["rav.svg"] = svg(
  "Baltimore Ravens",
  "#241773",
  `<path fill="#c4ced4" d="M8 40 C14 12 38 8 52 22 C44 16 42 28 56 36 C44 34 36 46 44 56 C26 50 10 50 8 40Z"/>
<path fill="#9b870c" d="M50 20 L62 28 L50 34 Z"/>
<circle cx="34" cy="28" r="2.6" fill="#9b870c"/>
<path fill="#241773" d="M22 36 C30 30 40 34 42 42 C32 42 22 40 22 36Z"/>`,
);

// Houston Texans — bull
logos["htx.svg"] = svg(
  "Houston Texans",
  "#03202f",
  `<path fill="#a71930" d="M12 40 C16 18 30 12 40 16 C50 20 54 32 48 42 L40 54 L24 52 L16 56 Z"/>
<path fill="#03202f" d="M30 30 C36 26 42 30 42 36 C40 40 34 40 32 36Z"/>
<path fill="#a71930" d="M14 18 L4 10 L16 28 Z"/>
<path fill="#a71930" d="M50 18 L60 10 L48 28 Z"/>
<circle cx="36" cy="32" r="2" fill="#c4ced4"/>`,
);

// Patriots 2000+ — Flying Elvis faces the other way, more silver
logos["nwe-2000.svg"] = svg(
  "New England Patriots",
  "#002244",
  `<path fill="#dce2e8" d="M14 44 C16 20 28 10 40 14 C50 18 52 30 46 38 C54 32 56 40 48 46 L36 50 L22 48 Z"/>
<path fill="#c60c30" d="M34 28 L50 24 L48 34 L36 34 Z"/>
<path fill="#002244" d="M28 26 C32 24 36 26 36 30 C34 34 30 34 28 32Z"/>
<path fill="#dce2e8" d="M40 16 C50 8 58 18 50 28 C54 18 46 14 40 16Z"/>
<path fill="none" stroke="#002244" stroke-width="1.6" d="M30 36 H44 M30 40 H42"/>`,
);

// Falcons 2003+ — F-shaped falcon
logos["atl-2003.svg"] = svg(
  "Atlanta Falcons",
  "#000000",
  `<path fill="#a71930" d="M10 14 L38 8 L34 22 L56 16 L28 56 L32 36 L14 44 Z"/>
<path fill="#a5acaf" d="M36 12 L52 10 L40 22 Z"/>`,
);

// Rams 2020+ — LA with the A as a horn
logos["ram-2020.svg"] = svg(
  "Los Angeles Rams",
  "#003594",
  `<path fill="#ffd100" d="M8 16 L18 16 L32 48 L22 48 Z"/>
<path fill="#ffd100" d="M28 16 C48 16 58 22 54 36 C50 48 36 50 28 42 L32 34 C36 40 46 38 46 30 C46 22 38 22 32 22 L28 48 H20 L28 16Z"/>`,
);

// Eagles 1996+ — eagle head
logos["phi-1996.svg"] = svg(
  "Philadelphia Eagles",
  "#004c54",
  `<path fill="#a5acaf" d="M8 42 C12 18 28 10 44 16 C54 20 56 34 46 42 L38 56 L22 50 L12 54 Z"/>
<path fill="#004c54" d="M28 28 C36 22 44 28 44 36 C42 42 32 40 30 34Z"/>
<path fill="#a5acaf" d="M46 18 L60 12 L52 28 Z"/>
<circle cx="36" cy="30" r="2.2" fill="#004c54"/>
<path fill="#a5acaf" d="M40 34 L50 40 L40 42 Z"/>`,
);

// Vikings 2013+ — norse with horns and braid
logos["min-2013.svg"] = svg(
  "Minnesota Vikings",
  "#4f2683",
  `<path fill="#ffc62f" d="M16 46 C14 24 24 12 36 14 C46 16 50 28 46 38 C54 30 58 32 58 22 L54 42 C48 52 38 54 28 54 C18 54 16 48 16 46Z"/>
<path fill="#4f2683" d="M32 28 C36 26 40 28 40 33 C38 38 33 38 31 34Z"/>
<path fill="#ffc62f" d="M10 18 L24 14 L18 30 Z"/>
<path fill="#ffc62f" d="M48 12 L60 8 L54 24 Z"/>
<path fill="#ffc62f" d="M28 44 C30 50 26 54 22 52 C26 48 28 44 28 44Z"/>
<path fill="#c60c30" d="M36 40 C38 44 36 48 32 48"/>`,
);

// Cardinals 2005+ — meaner bird
logos["crd-2005.svg"] = svg(
  "Arizona Cardinals",
  "#97233f",
  `<path fill="#ffffff" d="M6 38 C14 12 40 8 54 22 C46 16 44 30 58 38 C46 36 36 48 44 58 C26 52 10 50 6 38Z"/>
<path fill="#ffb612" d="M52 20 L64 30 L50 36 Z"/>
<circle cx="38" cy="26" r="2.6" fill="#000"/>
<path fill="#97233f" d="M22 34 C32 28 42 32 44 42 C32 42 20 40 22 34Z"/>`,
);

// Giants 1976+ — lowercase ny
logos["nyg-1976.svg"] = svg(
  "New York Giants",
  "#0b2265",
  `<text x="32" y="42" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="32" font-weight="700" fill="#a71930" font-style="italic">ny</text>`,
);

// 49ers 1946–67 — SF on a football
logos["sfo-early.svg"] = svg(
  "San Francisco 49ers",
  "#aa0000",
  `<ellipse cx="32" cy="32" rx="26" ry="16" fill="#b3995d"/>
<ellipse cx="32" cy="32" rx="22" ry="12" fill="#aa0000"/>
<text x="32" y="37" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="16" font-weight="800" fill="#b3995d">SF</text>`,
);

// Lions 1970–2008 — leaping
logos["det-1970.svg"] = svg(
  "Detroit Lions",
  "#0076b6",
  `<path fill="#b0b7bc" d="M6 44 L22 28 L34 22 L48 16 L58 12 L54 24 L60 32 L48 36 L52 46 L36 42 L24 50 L14 48 L8 54 Z"/>
<path fill="#0076b6" d="M32 28 C38 24 44 28 44 34 C42 38 34 38 32 34Z"/>
<path fill="#b0b7bc" d="M48 16 L60 8 L54 22 Z"/>`,
);

// Lions 2009+ — roaring profile
logos["det-2009.svg"] = svg(
  "Detroit Lions",
  "#0076b6",
  `<path fill="#b0b7bc" d="M8 44 C10 18 26 8 42 14 C54 20 56 36 46 46 L36 56 L20 52 L12 56 Z"/>
<path fill="#0076b6" d="M30 28 C38 22 46 28 46 36 C44 42 34 42 32 36Z"/>
<path fill="#b0b7bc" d="M44 16 L58 8 L52 26 Z"/>
<path fill="#b0b7bc" d="M22 44 C26 50 20 56 14 54"/>
<circle cx="38" cy="30" r="2.2" fill="#0076b6"/>`,
);

// Dolphins 2013+ — no full sunburst
logos["mia-2013.svg"] = svg(
  "Miami Dolphins",
  "#008e97",
  `<circle cx="44" cy="18" r="8" fill="#fc4c02"/>
<path fill="#ffffff" d="M6 40 C18 24 34 22 50 32 C42 24 44 14 54 12 C46 18 48 28 56 36 C56 44 46 52 32 52 C16 52 8 48 6 40Z"/>
<path fill="#008e97" d="M26 36 C32 32 42 32 48 38 C40 40 32 40 26 36Z"/>`,
);

// Titans 2018+ — T in a light-blue disc
logos["oti-2018.svg"] = svg(
  "Tennessee Titans",
  "#0c2340",
  `<circle cx="32" cy="32" r="24" fill="#4b92db"/>
<circle cx="32" cy="32" r="20" fill="#0c2340"/>
<path fill="#c8102e" d="M16 14 H48 L44 24 H36 V52 H28 V24 H20 Z"/>
<path fill="#ffffff" d="M30 6 L32 11 L37 11 L33 14 L35 19 L30 16 L25 19 L27 14 L23 11 L28 11 Z"/>`,
);

// Jets 1978–97 and 2019+ — JETS in a football
logos["nyj-jets.svg"] = svg(
  "New York Jets",
  "#125740",
  `<ellipse cx="32" cy="32" rx="28" ry="18" fill="#ffffff"/>
<ellipse cx="32" cy="32" rx="24" ry="14" fill="#125740"/>
<text x="32" y="37" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="13" font-weight="800" fill="#ffffff" letter-spacing="1">JETS</text>`,
);

// Bengals 2004+ — orange B, three stripes
logos["cin-2004.svg"] = svg(
  "Cincinnati Bengals",
  "#000000",
  `<text x="32" y="48" text-anchor="middle" font-family="Impact,'Arial Black',sans-serif" font-size="44" font-weight="800" fill="#fb4f14">B</text>
<path stroke="#000" stroke-width="3.2" stroke-linecap="square" d="M18 16 L30 50 M26 14 L38 50 M34 16 L44 50"/>`,
);

// Bucs 2014+ — redder flag, pewter field
logos["tam-2014.svg"] = svg(
  "Tampa Bay Buccaneers",
  "#34302b",
  `<path fill="#d50a0a" d="M6 10 H42 L38 30 H10 Z"/>
<path fill="#d50a0a" d="M38 10 L58 20 L38 30 Z"/>
<circle cx="30" cy="42" r="15" fill="#f4f4f4"/>
<ellipse cx="24" cy="40" rx="3.4" ry="4.2" fill="#34302b"/>
<ellipse cx="36" cy="40" rx="3.4" ry="4.2" fill="#34302b"/>
<path fill="#34302b" d="M26 50 Q30 54 34 50"/>
<path fill="#c4ced4" d="M16 54 L30 44 L28 56 Z"/>
<path fill="#c4ced4" d="M44 54 L30 44 L32 56 Z"/>`,
);

// Panthers 2012+ — more silver, aggressive
logos["car-2012.svg"] = svg(
  "Carolina Panthers",
  "#0085ca",
  `<path fill="#101820" d="M6 40 C10 14 30 6 46 14 C56 20 58 36 48 46 L38 58 L20 54 L10 58 Z"/>
<path fill="#0085ca" d="M28 26 C38 18 48 26 48 36 C46 44 34 44 30 36Z"/>
<path fill="#c4ced4" d="M46 14 L62 6 L54 24 Z"/>
<circle cx="38" cy="28" r="2.4" fill="#c4ced4"/>
<path fill="#c4ced4" d="M42 34 L54 40 L42 42 Z"/>`,
);

// Jaguars 2013+ — gold on black, roar
logos["jax-2013.svg"] = svg(
  "Jacksonville Jaguars",
  "#006778",
  `<path fill="#d7a22a" d="M6 40 C12 12 34 6 50 16 C58 22 60 36 50 46 L40 58 L20 54 L10 58 Z"/>
<path fill="#000" d="M26 26 C38 18 48 26 48 36 C46 44 32 44 28 36Z"/>
<path fill="#d7a22a" d="M48 14 L62 6 L56 24 Z"/>
<circle cx="40" cy="28" r="2.6" fill="#000"/>
<path fill="#000" d="M18 34 C28 28 40 32 42 42 C30 44 16 40 18 34Z"/>`,
);

const out = "/workspace/public/logos";
for (const [name, body] of Object.entries(logos)) {
  writeFileSync(`${out}/${name}`, body);
  console.log("wrote", name, body.length);
}
console.log("logos", Object.keys(logos).length);
