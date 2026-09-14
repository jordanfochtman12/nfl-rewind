#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { logoSrc } from "../src/lib/game/data/logos.ts";

const rows = [
  ["nwe", [1966, 1992, 1993, 1999, 2000, 2026]],
  ["nyj", [1966, 1977, 1978, 1997, 1998, 2018, 2019]],
  ["sdg", [1966, 1987, 1988, 2006, 2007, 2016, 2017, 2019, 2020]],
  ["ram", [1966, 1999, 2000, 2015, 2016, 2019, 2020]],
  ["tam", [1976, 1996, 1997, 2013, 2014]],
  ["oti", [1966, 1998, 1999, 2017, 2018]],
  ["atl", [1966, 1989, 1990, 2002, 2003]],
  ["mia", [1966, 2012, 2013]],
  ["phi", [1966, 1995, 1996]],
  ["den", [1966, 1996, 1997]],
];

const htmlRows = rows
  .map(([id, years]) => {
    const cells = years
      .map(
        (y) =>
          `<div style="text-align:center"><img src="http://127.0.0.1:8080${logoSrc(y, id)}" width="56" height="56" style="border-radius:8px"/><div style="color:#ebe4d4;font:10px ui-sans-serif;margin-top:4px">${y}</div></div>`,
      )
      .join("");
    return `<div style="margin-bottom:18px"><div style="color:#c4a574;font:11px/1 ui-sans-serif;letter-spacing:.2em;margin-bottom:8px">${id.toUpperCase()}</div><div style="display:flex;gap:10px;flex-wrap:wrap">${cells}</div></div>`;
  })
  .join("");

const html = `<!doctype html><html><body style="margin:0;background:#0c0d0b;padding:24px">${htmlRows}</body></html>`;
writeFileSync("/tmp/logo-timeline.html", html);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: "/workspace/artifacts/logo-timeline.png", fullPage: true });
await browser.close();
console.log("wrote timeline");
