/**
 * Midfield marks: the club logos without their app-tile background and border, so the field
 * shows the mark as it was painted on the grass. Writes public/logos/field/<file>.svg.
 * Run: node scripts/field-logos.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../public/logos");
mkdirSync(join(dir, "field"), { recursive: true });
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".svg"))) {
  const svg = readFileSync(join(dir, f), "utf8");
  // The tile: the first full-size rect after </defs>, and the inset border rect after it.
  const out = svg.replace(/(<\/defs>\s*)<rect width="512" height="512"[^>]*\/>\s*(<rect x="\d+" y="\d+" width="\d+" height="\d+" rx="\d+" fill="none"[^>]*\/>)?/, "$1");
  // Some tiles carry a second, thin inner frame.
  const framed = out.replace(/<rect x="\d+" y="\d+" width="\d+" height="\d+" rx="\d+" fill="none"[^>]*\/>/g, "");
  if (out === svg) {
    console.warn(`no tile found in ${f}; copied as is`);
  } else n += 1;
  writeFileSync(join(dir, "field", f), framed);
}
console.log(`${n} field marks written`);
