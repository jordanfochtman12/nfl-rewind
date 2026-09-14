#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const files = [
  "gnb","dal","pit","kan","rai","sfo","chi","min","nor","clt","mia","buf",
  "nyj","nyg","phi","ram","det","cle","atl","was","crd","nwe","den","oti",
  "sdg","cin","tam","sea","car","jax","rav","htx",
  "nwe-modern","den-modern","oti-titans","was-wft","was-cmd",
  "tam-modern","sea-modern","ram-stl","ram-modern","nyj-modern","cin-modern","atl-modern","buf-modern","sdg-modern",
];

const cells = files
  .map(
    (id) =>
      `<div style="text-align:center"><img src="http://127.0.0.1:8080/logos/${id}.svg" width="72" height="72" style="border-radius:10px"/><div style="color:#ebe4d4;font:11px/1.2 ui-sans-serif;margin-top:6px">${id}</div></div>`,
  )
  .join("");

const html = `<!doctype html><html><body style="margin:0;background:#0c0d0b;padding:24px">
<div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:16px;max-width:1100px">${cells}</div>
</body></html>`;

writeFileSync("/tmp/logo-sheet.html", html);
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: "/workspace/artifacts/logo-sheet.png", fullPage: true });
await browser.close();
console.log("wrote /workspace/artifacts/logo-sheet.png");
