#!/usr/bin/env node
/**
 * Builds every club mark in public/logos as a crisp 512-unit vector badge.
 *
 * The marks are original designs in each club's period colors, not the NFL's trademarked
 * logos: a mascot silhouette from game-icons.net (CC BY 3.0, see data/logos/glyphs.json) or a
 * letter mark set in an OFL font (data/logos/fonts) and converted to outlines, so every badge
 * renders the same everywhere at any size.
 *
 * Re-run: node scripts/build-logos.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "logos");
const GLYPHS = JSON.parse(readFileSync(join(ROOT, "data", "logos", "glyphs.json"), "utf8")).icons;
const FONTS = {
  block: opentype.loadSync(join(ROOT, "data", "logos", "fonts", "BigShoulders-Bold.ttf")),
  heavy: opentype.loadSync(join(ROOT, "data", "logos", "fonts", "EricaOne-Regular.ttf")),
  serif: opentype.loadSync(join(ROOT, "data", "logos", "fonts", "YoungSerif-Regular.ttf")),
  bold: opentype.loadSync(join(ROOT, "data", "logos", "fonts", "Lora-Bold.ttf")),
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (h, f) => toHex(hex(h).map((v) => (f >= 0 ? v + (255 - v) * f : v * (1 + f))));

/** Text converted to outlines, centered on (cx, cy) and fit inside maxW x maxH. */
function textPath(text, font, cx, cy, maxW, maxH) {
  const f = FONTS[font];
  let p = f.getPath(text, 0, 0, 100);
  const b = p.getBoundingBox();
  const s = Math.min(maxW / (b.x2 - b.x1), maxH / (b.y2 - b.y1));
  p = f.getPath(text, 0, 0, 100 * s);
  const b2 = p.getBoundingBox();
  const dx = cx - (b2.x1 + b2.x2) / 2;
  const dy = cy - (b2.y1 + b2.y2) / 2;
  return `<path transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})" d="${p.toPathData(1)}"/>`;
}

function star(cx, cy, R, r, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Four-cusped hypocycloid (the steel industry's "Steelmark" diamond shape). */
function astroid(cx, cy, r) {
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    pts.push(`${(cx + r * Math.cos(t) ** 3).toFixed(1)} ${(cy + r * Math.sin(t) ** 3).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function glyph(name, { fill, stroke, strokeW = 14, scale = 0.7, mirror = false, dx = 0, dy = 0 }) {
  const ic = GLYPHS[name];
  if (!ic) throw new Error(`missing glyph ${name}`);
  const s = scale;
  const off = (512 - 512 * s) / 2;
  const flip = mirror ? `translate(512 0) scale(-1 1) ` : "";
  const body = ic.body.replace(/fill="currentColor"/g, "").replace(/fill="#000"/g, "");
  const outline = stroke
    ? `<g fill="${stroke}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round">${body}</g>`
    : "";
  return `<g transform="translate(${off + dx} ${off + dy}) scale(${s}) ${flip}">${outline}<g fill="${fill}">${body}</g></g>`;
}

/** The badge: club-color field with a soft light falloff, a ring in the second color, the mark. */
function badge(label, { bg, ring, ring2 }, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${label}">
<defs>
<radialGradient id="f" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${shade(bg, 0.16)}"/><stop offset="1" stop-color="${shade(bg, -0.35)}"/></radialGradient>
<filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.45"/></filter>
</defs>
<rect width="512" height="512" rx="84" fill="url(#f)"/>
<rect x="18" y="18" width="476" height="476" rx="68" fill="none" stroke="${ring}" stroke-width="12"/>
${ring2 ? `<rect x="36" y="36" width="440" height="440" rx="54" fill="none" stroke="${ring2}" stroke-width="4" opacity="0.8"/>` : ""}
<g filter="url(#s)">${inner}</g>
<path d="M84 18 H428 A68 68 0 0 1 494 84 V150 C360 118 152 118 18 150 V84 A68 68 0 0 1 84 18Z" fill="#fff" opacity="0.06"/>
</svg>
`;
}

const letters = (text, font, color, opts = {}) => {
  const { cx = 256, cy = 262, w = 330, h = 280, stroke, strokeW = 16 } = opts;
  const p = textPath(text, font, cx, cy, w, h);
  return stroke
    ? `<g fill="${stroke}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round">${p}</g><g fill="${color}">${p}</g>`
    : `<g fill="${color}">${p}</g>`;
};

const oval = (fill, stroke, sw = 14, rx = 196, ry = 132) =>
  `<ellipse cx="256" cy="262" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

/** file -> [club label, colors, inner mark] */
const L = {
  // Falcons
  "atl.svg": ["Atlanta Falcons", { bg: "#a71930", ring: "#000000", ring2: "#ffffff" }, glyph("hawk-emblem", { fill: "#101010", stroke: "#ffffff", strokeW: 10 })],
  "atl-modern.svg": ["Atlanta Falcons", { bg: "#101010", ring: "#a71930", ring2: "#a5acaf" }, glyph("hawk-emblem", { fill: "#a71930", stroke: "#ffffff", strokeW: 10 })],
  "atl-2003.svg": ["Atlanta Falcons", { bg: "#101010", ring: "#a71930", ring2: "#ffffff" }, glyph("hawk-emblem", { fill: "#a71930", stroke: "#ffffff", strokeW: 12 })],
  // Rams
  "ram.svg": ["Los Angeles Rams", { bg: "#003594", ring: "#ffd100" }, glyph("ram-profile", { fill: "#ffd100", stroke: "#ffffff", strokeW: 8 })],
  "ram-stl.svg": ["St. Louis Rams", { bg: "#002244", ring: "#c9a55c", ring2: "#ffffff" }, glyph("ram-profile", { fill: "#c9a55c", stroke: "#ffffff", strokeW: 8 })],
  "ram-modern.svg": ["Los Angeles Rams", { bg: "#002244", ring: "#b3995d", ring2: "#ffffff" }, glyph("ram-profile", { fill: "#ffffff", stroke: "#b3995d", strokeW: 12 })],
  "ram-2020.svg": ["Los Angeles Rams", { bg: "#003594", ring: "#ffa300" }, letters("LA", "block", "#ffffff", { w: 330, h: 240, stroke: "#ffa300", strokeW: 14 })],
  // Steelers
  "pit.svg": [
    "Pittsburgh Steelers",
    { bg: "#101820", ring: "#ffb612" },
    `<circle cx="256" cy="256" r="178" fill="#ffffff" stroke="#8a8d8f" stroke-width="10"/>
<path d="${astroid(256, 176, 70)}" fill="#ffb612"/><path d="${astroid(186, 296, 70)}" fill="#c60c30"/><path d="${astroid(326, 296, 70)}" fill="#00539b"/>`,
  ],
  // Eagles
  "phi.svg": ["Philadelphia Eagles", { bg: "#006341", ring: "#c0c0c0", ring2: "#ffffff" }, glyph("eagle-head", { fill: "#e6e8ea", stroke: "#0b2e1f", strokeW: 10, mirror: true })],
  "phi-1996.svg": ["Philadelphia Eagles", { bg: "#004c54", ring: "#a5acaf", ring2: "#000000" }, glyph("eagle-head", { fill: "#ffffff", stroke: "#000000", strokeW: 12, mirror: true })],
  // Cowboys
  "dal.svg": [
    "Dallas Cowboys",
    { bg: "#041e42", ring: "#869397", ring2: "#ffffff" },
    `<path d="${star(256, 266, 200, 80)}" fill="#ffffff" stroke="#003594" stroke-width="16" stroke-linejoin="round"/><path d="${star(256, 266, 164, 66)}" fill="#003594"/>`,
  ],
  // Washington
  "was.svg": ["Washington", { bg: "#5a1414", ring: "#ffb612" }, letters("W", "serif", "#ffb612", { w: 300, h: 250, stroke: "#ffffff", strokeW: 10 })],
  "was-wft.svg": ["Washington Football Team", { bg: "#5a1414", ring: "#ffb612" }, letters("W", "block", "#ffb612", { w: 300, h: 260 })],
  "was-cmd.svg": ["Washington Commanders", { bg: "#5a1414", ring: "#ffb612", ring2: "#101010" }, letters("W", "heavy", "#ffb612", { w: 320, h: 250, stroke: "#101010", strokeW: 14 })],
  // Vikings
  "min.svg": ["Minnesota Vikings", { bg: "#4f2683", ring: "#ffc62f" }, glyph("viking-helmet", { fill: "#ffc62f", stroke: "#ffffff", strokeW: 10 })],
  "min-2013.svg": ["Minnesota Vikings", { bg: "#4f2683", ring: "#ffc62f", ring2: "#ffffff" }, glyph("viking-helmet", { fill: "#ffffff", stroke: "#ffc62f", strokeW: 12 })],
  // Cardinals
  "crd.svg": ["Cardinals", { bg: "#f2f2f2", ring: "#97233f", ring2: "#000000" }, glyph("finch", { fill: "#b8163c", stroke: "#000000", strokeW: 10 })],
  "crd-2005.svg": ["Arizona Cardinals", { bg: "#101010", ring: "#97233f", ring2: "#ffb612" }, glyph("finch", { fill: "#97233f", stroke: "#ffffff", strokeW: 12 })],
  // Packers
  "gnb.svg": ["Green Bay Packers", { bg: "#203731", ring: "#ffb612" }, oval("#ffffff", "#ffb612", 16) + letters("G", "block", "#203731", { w: 220, h: 210 })],
  // Giants
  "nyg.svg": ["New York Giants", { bg: "#0b2265", ring: "#a71930" }, letters("ny", "serif", "#ffffff", { w: 330, h: 230, stroke: "#a71930", strokeW: 10 })],
  "nyg-1976.svg": ["New York Giants", { bg: "#0b2265", ring: "#a71930", ring2: "#ffffff" }, letters("GIANTS", "block", "#ffffff", { w: 380, h: 170, stroke: "#a71930", strokeW: 10 })],
  // 49ers
  "sfo-early.svg": ["San Francisco 49ers", { bg: "#aa0000", ring: "#b3995d" }, oval("#aa0000", "#ffffff", 12) + letters("SF", "serif", "#ffffff", { w: 250, h: 180 })],
  "sfo.svg": ["San Francisco 49ers", { bg: "#aa0000", ring: "#b3995d", ring2: "#ffffff" }, oval("#b3995d", "#ffffff", 12) + letters("SF", "serif", "#aa0000", { w: 250, h: 180, stroke: "#ffffff", strokeW: 12 })],
  // Bears
  "chi.svg": ["Chicago Bears", { bg: "#0b162a", ring: "#c83803" }, letters("C", "serif", "#c83803", { w: 280, h: 300, stroke: "#ffffff", strokeW: 12 })],
  // Browns
  "cle.svg": ["Cleveland Browns", { bg: "#311d00", ring: "#ff3c00", ring2: "#ffffff" }, glyph("american-football-helmet", { fill: "#ff3c00", stroke: "#ffffff", strokeW: 10, scale: 0.74 })],
  // Colts
  "clt.svg": ["Colts", { bg: "#002c5f", ring: "#ffffff" }, glyph("horseshoe", { fill: "#ffffff", scale: 0.72 })],
  // Lions
  "det.svg": ["Detroit Lions", { bg: "#0076b6", ring: "#b0b7bc" }, glyph("lion", { fill: "#d7dcdf", stroke: "#0b3a5b", strokeW: 8, mirror: true })],
  "det-1970.svg": ["Detroit Lions", { bg: "#0076b6", ring: "#ffffff" }, glyph("lion", { fill: "#e6e9eb", stroke: "#0b3a5b", strokeW: 8, mirror: true })],
  "det-2009.svg": ["Detroit Lions", { bg: "#0076b6", ring: "#b0b7bc", ring2: "#101010" }, glyph("lion", { fill: "#e6e9eb", stroke: "#101010", strokeW: 14, mirror: true })],
  // Dolphins
  "mia.svg": ["Miami Dolphins", { bg: "#008e97", ring: "#fc4c02" }, `<circle cx="300" cy="220" r="118" fill="#fc4c02"/>` + glyph("dolphin", { fill: "#ffffff", stroke: "#005778", strokeW: 10 })],
  "mia-2013.svg": ["Miami Dolphins", { bg: "#008e97", ring: "#fc4c02", ring2: "#ffffff" }, `<circle cx="296" cy="226" r="126" fill="none" stroke="#fc4c02" stroke-width="22"/>` + glyph("dolphin", { fill: "#ffffff", stroke: "#005778", strokeW: 12 })],
  // Broncos
  "den.svg": ["Denver Broncos", { bg: "#0a2343", ring: "#fb4f14" }, glyph("horse-head", { fill: "#fb4f14", stroke: "#ffffff", strokeW: 10 })],
  "den-modern.svg": ["Denver Broncos", { bg: "#002244", ring: "#fb4f14", ring2: "#ffffff" }, glyph("horse-head", { fill: "#ffffff", stroke: "#fb4f14", strokeW: 14, mirror: true })],
  // Oilers / Titans
  "oti.svg": ["Houston Oilers", { bg: "#4b92db", ring: "#c8102e", ring2: "#ffffff" }, glyph("oil-rig", { fill: "#c8102e", stroke: "#ffffff", strokeW: 10 })],
  "oti-titans.svg": ["Tennessee Titans", { bg: "#0c2340", ring: "#4b92db", ring2: "#c8102e" }, glyph("spartan-helmet", { fill: "#4b92db", stroke: "#ffffff", strokeW: 10 })],
  "oti-2018.svg": ["Tennessee Titans", { bg: "#0c2340", ring: "#4b92db", ring2: "#8a8d8f" }, glyph("spartan-helmet", { fill: "#ffffff", stroke: "#c8102e", strokeW: 12 })],
  // Patriots
  "nwe.svg": ["Patriots", { bg: "#c8102e", ring: "#ffffff", ring2: "#002244" }, glyph("musket", { fill: "#ffffff", stroke: "#002244", strokeW: 10 })],
  "nwe-modern.svg": [
    "New England Patriots",
    { bg: "#002244", ring: "#c60c30", ring2: "#b0b7bc" },
    `<path d="M70 250 H300 M90 300 H300 M110 350 H300" stroke="#c60c30" stroke-width="22" stroke-linecap="round"/><path d="${star(320, 280, 150, 60, 5, -90)}" fill="#ffffff" stroke="#b0b7bc" stroke-width="10" stroke-linejoin="round"/>`,
  ],
  "nwe-2000.svg": [
    "New England Patriots",
    { bg: "#002244", ring: "#c60c30", ring2: "#ffffff" },
    `<path d="M70 250 H300 M90 300 H300 M110 350 H300" stroke="#c60c30" stroke-width="22" stroke-linecap="round"/><path d="${star(320, 280, 150, 60, 5, -90)}" fill="#b0b7bc" stroke="#ffffff" stroke-width="12" stroke-linejoin="round"/>`,
  ],
  // Bills
  "buf.svg": ["Buffalo Bills", { bg: "#c60c30", ring: "#ffffff", ring2: "#00338d" }, glyph("bison", { fill: "#ffffff", stroke: "#00338d", strokeW: 10 })],
  "buf-modern.svg": [
    "Buffalo Bills",
    { bg: "#00338d", ring: "#c60c30", ring2: "#ffffff" },
    `<path d="M60 330 C160 300 300 310 460 250" stroke="#c60c30" stroke-width="26" fill="none" stroke-linecap="round"/>` + glyph("bison", { fill: "#ffffff", stroke: "#c60c30", strokeW: 10 }),
  ],
  // Jets
  "nyj.svg": ["New York Jets", { bg: "#125740", ring: "#ffffff" }, glyph("jet-fighter", { fill: "#ffffff", stroke: "#0b3a2a", strokeW: 8 })],
  "nyj-jets.svg": ["New York Jets", { bg: "#125740", ring: "#ffffff" }, oval("#ffffff", "#125740", 10, 206, 120) + letters("JETS", "block", "#125740", { w: 330, h: 150 })],
  "nyj-modern.svg": ["New York Jets", { bg: "#125740", ring: "#ffffff", ring2: "#000000" }, oval("#ffffff", "#000000", 10, 206, 130) + letters("NY", "block", "#125740", { cy: 250, w: 250, h: 170 })],
  // Raiders
  "rai.svg": ["Raiders", { bg: "#000000", ring: "#a5acaf", ring2: "#ffffff" }, glyph("pirate-skull", { fill: "#c4c8cb", stroke: "#000000", strokeW: 8 })],
  // Chargers
  "sdg.svg": ["Chargers", { bg: "#0080c6", ring: "#ffc20e", ring2: "#ffffff" }, glyph("power-lightning", { fill: "#ffc20e", stroke: "#002a5e", strokeW: 12 })],
  "sdg-modern.svg": ["Chargers", { bg: "#002a5e", ring: "#ffc20e", ring2: "#0080c6" }, glyph("power-lightning", { fill: "#ffc20e", stroke: "#ffffff", strokeW: 12 })],
  // Chiefs
  "kan.svg": [
    "Kansas City Chiefs",
    { bg: "#e31837", ring: "#ffb81c" },
    `<path d="M256 58 L420 400 C340 360 172 360 92 400 Z" fill="#ffffff" stroke="#ffb81c" stroke-width="12" stroke-linejoin="round"/>` + letters("KC", "block", "#e31837", { cy: 280, w: 170, h: 130 }),
  ],
  // Saints
  "nor.svg": ["New Orleans Saints", { bg: "#101820", ring: "#d3bc8d" }, glyph("fleur-de-lys", { fill: "#d3bc8d", stroke: "#ffffff", strokeW: 6 })],
  // Bengals
  "cin.svg": ["Cincinnati Bengals", { bg: "#fb4f14", ring: "#000000" }, glyph("tiger-head", { fill: "#000000", stroke: "#ffffff", strokeW: 8 })],
  "cin-modern.svg": ["Cincinnati Bengals", { bg: "#fb4f14", ring: "#000000", ring2: "#ffffff" }, glyph("tiger-head", { fill: "#000000", stroke: "#ffffff", strokeW: 10 })],
  "cin-2004.svg": ["Cincinnati Bengals", { bg: "#000000", ring: "#fb4f14" }, letters("B", "block", "#fb4f14", { w: 230, h: 290, stroke: "#ffffff", strokeW: 12 })],
  // Buccaneers
  "tam.svg": ["Tampa Bay Buccaneers", { bg: "#f47b20", ring: "#c8102e", ring2: "#ffffff" }, glyph("pirate-captain", { fill: "#ffffff", stroke: "#c8102e", strokeW: 10 })],
  "tam-modern.svg": ["Tampa Bay Buccaneers", { bg: "#3d3935", ring: "#d50a0a", ring2: "#b1babf" }, glyph("pirate-flag", { fill: "#d50a0a", stroke: "#ffffff", strokeW: 10 })],
  "tam-2014.svg": ["Tampa Bay Buccaneers", { bg: "#101010", ring: "#d50a0a", ring2: "#ff7900" }, glyph("pirate-flag", { fill: "#d50a0a", stroke: "#ffffff", strokeW: 12 })],
  // Seahawks
  "sea.svg": ["Seattle Seahawks", { bg: "#1f4e9c", ring: "#a5acaf", ring2: "#69be28" }, glyph("eagle-head", { fill: "#c4c8cb", stroke: "#0b2a5c", strokeW: 10 })],
  "sea-modern.svg": ["Seattle Seahawks", { bg: "#002244", ring: "#69be28", ring2: "#a5acaf" }, glyph("eagle-head", { fill: "#a5acaf", stroke: "#69be28", strokeW: 12 })],
  // Panthers
  "car.svg": ["Carolina Panthers", { bg: "#101820", ring: "#0085ca", ring2: "#bfc0bf" }, glyph("saber-toothed-cat-head", { fill: "#0085ca", stroke: "#ffffff", strokeW: 10 })],
  "car-2012.svg": ["Carolina Panthers", { bg: "#101820", ring: "#0085ca", ring2: "#ffffff" }, glyph("saber-toothed-cat-head", { fill: "#0085ca", stroke: "#bfc0bf", strokeW: 12 })],
  // Jaguars
  "jax.svg": ["Jacksonville Jaguars", { bg: "#006778", ring: "#d7a22a", ring2: "#000000" }, glyph("lynx-head", { fill: "#d7a22a", stroke: "#000000", strokeW: 10 })],
  "jax-2013.svg": ["Jacksonville Jaguars", { bg: "#101820", ring: "#006778", ring2: "#d7a22a" }, glyph("lynx-head", { fill: "#d7a22a", stroke: "#006778", strokeW: 12 })],
  // Ravens
  "rav.svg": ["Baltimore Ravens", { bg: "#101010", ring: "#9e7c0c", ring2: "#241773" }, glyph("raven", { fill: "#5b3fb6", stroke: "#ffffff", strokeW: 10 })],
  // Texans
  "htx.svg": ["Houston Texans", { bg: "#03202f", ring: "#a71930", ring2: "#ffffff" }, `<path d="M166 196 C160 160 352 160 346 196 L322 346 C304 404 208 404 190 346 Z" fill="#a71930" stroke="#ffffff" stroke-width="12" stroke-linejoin="round"/><path d="M256 190 L256 392" stroke="#03202f" stroke-width="10" opacity="0.35"/>` + glyph("bull", { fill: "#ffffff", scale: 0.8, dy: 6 })],
};

for (const [file, [label, colors, inner]] of Object.entries(L)) {
  writeFileSync(join(OUT, file), badge(label, colors, inner));
}
console.log(`wrote ${Object.keys(L).length} marks to public/logos`);
