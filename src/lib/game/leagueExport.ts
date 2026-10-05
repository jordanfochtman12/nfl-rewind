/**
 * A dynasty's history as one self-contained web page: champions, award winners, the record
 * book and the Hall of Fame. No scripts, no outside files, so it opens anywhere and can be
 * sent to anyone. No React.
 */
import type { DynastySave, TeamId } from "./types.ts";
import { displayName, roman } from "./teams.ts";
import { playerName } from "./players.ts";
import { careerRecordBook, seasonRecordBook } from "./records.ts";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1));

function personName(save: DynastySave, playerId?: string, coachId?: string): string {
  if (playerId) {
    const p = save.players[playerId];
    return p ? `${playerName(p)} (${p.pos})` : "";
  }
  if (coachId) return save.coaches[coachId]?.name ?? "";
  return "";
}

/** Champions by season, newest first: the Super Bowl once there is one, the league title before. */
export function championsList(save: DynastySave): { year: number; title: string; champ: TeamId; runnerUp?: TeamId; score?: string; mvp?: string }[] {
  const out: { year: number; title: string; champ: TeamId; runnerUp?: TeamId; score?: string; mvp?: string }[] = [];
  const bowls = new Map(save.history.superBowls.map((b) => [b.year, b]));
  const years = new Set([...save.history.superBowls.map((b) => b.year), ...save.history.championships.map((c) => c.year)]);
  for (const year of [...years].sort((a, b) => b - a)) {
    const b = bowls.get(year);
    if (b) {
      const homeWon = b.homeScore >= b.awayScore;
      const champ = homeWon ? b.homeId : b.awayId;
      const runnerUp = homeWon ? b.awayId : b.homeId;
      out.push({
        year,
        title: `Super Bowl ${roman(b.number)}`,
        champ,
        runnerUp,
        score: `${Math.max(b.homeScore, b.awayScore)}-${Math.min(b.homeScore, b.awayScore)}`,
        mvp: b.mvpName ?? (b.mvpId ? personName(save, b.mvpId) : undefined),
      });
      continue;
    }
    for (const c of save.history.championships.filter((x) => x.year === year)) out.push({ year, title: `${c.league} champion`, champ: c.teamId });
  }
  return out;
}

/** Franchises by titles won, most first. */
export function titleCounts(save: DynastySave): { teamId: TeamId; titles: number; last: number }[] {
  const by = new Map<TeamId, { titles: number; last: number }>();
  for (const c of championsList(save)) {
    const e = by.get(c.champ) ?? { titles: 0, last: 0 };
    e.titles += 1;
    e.last = Math.max(e.last, c.year);
    by.set(c.champ, e);
  }
  return [...by.entries()].map(([teamId, e]) => ({ teamId, ...e })).sort((a, b) => b.titles - a.titles || b.last - a.last);
}

export function leagueHistoryHtml(save: DynastySave): string {
  const first = save.startingYear;
  const last = Math.max(first, ...save.history.seasons.map((s) => s.year), ...save.history.awards.map((a) => a.year));
  const team = (id: TeamId | undefined, year: number) => (id ? esc(displayName(year, id)) : "");
  const title = save.sandbox ? "League history" : `${displayName(save.year, save.userTeamId)} dynasty`;

  const champs = championsList(save);
  const champRows = champs
    .map(
      (c) =>
        `<tr><td class="y">${c.year}</td><td>${esc(c.title)}</td><td class="w">${team(c.champ, c.year)}</td><td>${team(c.runnerUp, c.year)}</td><td class="n">${esc(c.score ?? "")}</td><td>${esc(c.mvp ?? "")}</td></tr>`,
    )
    .join("");

  const titles = titleCounts(save)
    .slice(0, 12)
    .map((t) => `<li><b>${team(t.teamId, t.last)}</b> <span>${t.titles} ${t.titles === 1 ? "title" : "titles"}, last in ${t.last}</span></li>`)
    .join("");

  const awardRows = save.history.awards
    .slice()
    .sort((a, b) => b.year - a.year)
    .map(
      (a) =>
        `<tr><td class="y">${a.year}</td><td>${esc(personName(save, a.mvp))}</td><td>${esc(personName(save, a.offPoy))}</td><td>${esc(personName(save, a.defPoy))}</td><td>${esc(personName(save, a.oroy))}</td><td>${esc(personName(save, a.droy))}</td><td>${esc(personName(save, undefined, a.coy))}</td></tr>`,
    )
    .join("");

  const seasonBook = seasonRecordBook(save, 3);
  const careerBook = careerRecordBook(save, 5);
  const book = (cats: ReturnType<typeof seasonRecordBook>, season: boolean) =>
    cats
      .map(
        (c) =>
          `<article><h4>${esc(c.label)}</h4><ol>${c.rows
            .map((r) => `<li><span>${esc(r.name)} <small>${esc(r.team)}${season ? `, ${r.year}` : ""}</small></span><b>${fmt(r.value)}</b></li>`)
            .join("")}</ol></article>`,
      )
      .join("");

  const hof = save.history.hof
    .slice()
    .sort((a, b) => b.year - a.year)
    .reduce<Record<number, string[]>>((acc, h) => {
      const name = personName(save, h.playerId, h.coachId) || h.blurb;
      (acc[h.year] ??= []).push(`${esc(name)} <small>${team(h.teamId, h.year)}</small>`);
      return acc;
    }, {});
  const hofHtml = Object.entries(hof)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([y, names]) => `<div class="hof"><span class="y">${y}</span><p>${names.join(" · ")}</p></div>`)
    .join("");

  const yours = save.sandbox
    ? ""
    : save.history.seasons
        .filter((s) => s.teamId === save.userTeamId)
        .sort((a, b) => b.year - a.year)
        .map((s) => `<tr><td class="y">${s.year}</td><td class="n">${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}</td><td>${esc(s.result)}</td><td>${esc(s.coach ?? "")}</td></tr>`)
        .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} ${first}-${last}</title>
<style>
:root{--bg:#f6f3ec;--fg:#16140f;--muted:#6b6457;--line:#ddd5c4;--card:#fffdf8;--brass:#8a6a2f;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#07080d;--fg:#ede6d6;--muted:#9a917f;--line:#262a35;--card:#0f121a;--brass:#c4a574}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 64px}header p{color:var(--muted);margin:4px 0 0}
h1{font:700 clamp(28px,6vw,48px)/1.05 Georgia,serif;margin:0}h2{font:700 22px Georgia,serif;margin:40px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}
h4{margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--brass)}
.eyebrow{font-size:12px;letter-spacing:.35em;color:var(--brass);text-transform:uppercase}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}
table{border-collapse:collapse;width:100%;min-width:560px}th,td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}tr:last-child td{border-bottom:0}
.y{font-variant-numeric:tabular-nums;color:var(--brass);font-weight:700;white-space:nowrap}.n{font-variant-numeric:tabular-nums;white-space:nowrap}.w{font-weight:700}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
article{border:1px solid var(--line);border-radius:10px;background:var(--card);padding:12px}ol{margin:0;padding-left:20px}ol li{display:flex;justify-content:space-between;gap:8px}
ol li b{font-variant-numeric:tabular-nums}small{color:var(--muted)}ul.titles{list-style:none;padding:0;columns:2 220px;margin:0}ul.titles li{padding:3px 0}ul.titles span{color:var(--muted)}
.hof{display:flex;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)}.hof p{margin:0}
footer{margin-top:48px;color:var(--muted);font-size:13px}
</style></head><body><main>
<header><div class="eyebrow">NFL Rewind</div><h1>${esc(title)}</h1><p>${first} to ${last} · ${champs.length} champions crowned · ${save.history.hof.length} Hall of Famers</p></header>
${titles ? `<h2>Most titles</h2><ul class="titles">${titles}</ul>` : ""}
${champRows ? `<h2>Champions</h2><div class="scroll"><table><thead><tr><th>Season</th><th>Game</th><th>Champion</th><th>Runner-up</th><th>Score</th><th>MVP</th></tr></thead><tbody>${champRows}</tbody></table></div>` : ""}
${yours ? `<h2>${team(save.userTeamId, save.year)} season by season</h2><div class="scroll"><table><thead><tr><th>Season</th><th>Record</th><th>Finish</th><th>Coach</th></tr></thead><tbody>${yours}</tbody></table></div>` : ""}
${awardRows ? `<h2>Award winners</h2><div class="scroll"><table><thead><tr><th>Season</th><th>MVP</th><th>Offensive POY</th><th>Defensive POY</th><th>Off. rookie</th><th>Def. rookie</th><th>Coach of the Year</th></tr></thead><tbody>${awardRows}</tbody></table></div>` : ""}
<h2>Single-season records</h2><div class="grid">${book(seasonBook, true)}</div>
<h2>Career leaders</h2><div class="grid">${book(careerBook, false)}</div>
${hofHtml ? `<h2>Hall of Fame</h2>${hofHtml}` : ""}
<footer>Made with NFL Rewind. Real rosters and draft classes; this timeline's results are its own.</footer>
</main></body></html>`;
}
