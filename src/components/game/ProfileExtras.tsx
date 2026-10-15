import { useState } from "react";
import {
  displayName,
  RATING_GROUPS,
  SCOUT_KEYS,
  scoutLetter,
  teamAbbr,
  visibleOvr,
  visibleRatings,
  type BoxPlayer,
  type GameResult,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";

type Save = NonNullable<ReturnType<typeof useGameStore.getState>["save"]>;

/** Every club he has played for, in order, from his season lines. */
function stints(p: Player): { teamId: TeamId; from: number; to: number; gp: number }[] {
  const byYear = new Map<number, { teamId: string; gp: number }>();
  for (const s of [...(p.career ?? []), ...Object.values(p.stats)]) if (s.gp > 0) byYear.set(s.year, { teamId: s.teamId, gp: s.gp });
  const out: { teamId: TeamId; from: number; to: number; gp: number }[] = [];
  for (const [year, s] of [...byYear].sort((a, b) => a[0] - b[0])) {
    if (s.teamId === "two") continue;
    const last = out[out.length - 1];
    if (last && last.teamId === s.teamId && year - last.to <= 1) {
      last.to = year;
      last.gp += s.gp;
    } else out.push({ teamId: s.teamId as TeamId, from: year, to: year, gp: s.gp });
  }
  return out;
}

/** His line in one game, in the stats that fit his position. */
function gameLine(p: Player, b: BoxPlayer): string {
  const n = (x?: number) => x ?? 0;
  const bits: string[] = [];
  if (n(b.passAtt)) bits.push(`${n(b.passCmp)}/${n(b.passAtt)}, ${n(b.passYds)} yds, ${n(b.passTd)} TD${n(b.passInt) ? `, ${n(b.passInt)} INT` : ""}`);
  if (n(b.rushAtt)) bits.push(`${n(b.rushAtt)} car, ${n(b.rushYds)} yds${n(b.rushTd) ? `, ${n(b.rushTd)} TD` : ""}`);
  if (n(b.rec) || n(b.targets)) bits.push(`${n(b.rec)} rec, ${n(b.recYds)} yds${n(b.recTd) ? `, ${n(b.recTd)} TD` : ""}`);
  if (n(b.tackles) || n(b.sacks) || n(b.ints)) {
    const d = [n(b.tackles) ? `${n(b.tackles)} tkl` : "", n(b.sacks) ? `${Math.round(n(b.sacks) * 10) / 10} sk` : "", n(b.ints) ? `${n(b.ints)} INT` : "", n(b.ff) ? `${n(b.ff)} FF` : "", n(b.pd) ? `${n(b.pd)} PD` : ""].filter(Boolean);
    bits.push(d.join(", "));
  }
  if (n(b.fgAtt) || n(b.xpAtt)) bits.push(`${n(b.fgMade)}/${n(b.fgAtt)} FG, ${n(b.xpMade)}/${n(b.xpAtt)} XP`);
  if (n(b.punts)) bits.push(`${n(b.punts)} punts, ${n(b.puntYds)} yds`);
  if (n(b.krYds) || n(b.prYds)) bits.push(`${n(b.krYds) + n(b.prYds)} return yds`);
  return bits.filter(Boolean).join(" · ") || (p.pos === "LT" || p.pos === "LG" || p.pos === "C" || p.pos === "RG" || p.pos === "RT" ? "Started on the line" : "Played");
}

function gameLog(save: Save, p: Player): { g: GameResult; teamId: TeamId; b: BoxPlayer }[] {
  const year = save.year;
  const games = [...save.schedule.filter((g) => g.year === year && g.played), ...save.playoffGames.filter((g) => g.played), ...(save.superBowl?.played ? [save.superBowl] : [])];
  const out: { g: GameResult; teamId: TeamId; b: BoxPlayer }[] = [];
  for (const g of games) {
    const h = g.boxHome?.find((x) => x.playerId === p.id);
    const a = h ? undefined : g.boxAway?.find((x) => x.playerId === p.id);
    if (h) out.push({ g, teamId: g.homeId as TeamId, b: h });
    else if (a) out.push({ g, teamId: g.awayId as TeamId, b: a });
  }
  return out;
}

const TX_LABEL: Record<string, string> = {
  draft: "Drafted",
  sign: "Signed",
  cut: "Released",
  trade: "Traded",
  expansion: "Expansion draft",
  retire: "Retired",
  waive: "Waived",
  claim: "Claimed",
  ir: "Injured reserve",
  activate: "Activated",
};

/** The parts of the card that tell his whole story: where he's been, every game, every rating. */
export function ProfileExtras({ p }: { p: Player }) {
  const save = useGameStore((s) => s.save)!;
  const openTeam = useGameStore((s) => s.openTeam);
  const [allGames, setAllGames] = useState(false);
  const year = save.year;
  const path = stints(p);
  const tx = save.transactions.filter((t) => t.playerId === p.id).slice().reverse().slice(0, 12);
  const log = gameLog(save, p);
  const shown = visibleRatings(p);
  const keySet = new Set((SCOUT_KEYS[p.pos] ?? []).map((k) => k.key));
  const arc = p.arc;
  // The groups his position is graded on lead; the rest follow in their usual order.
  const groups = RATING_GROUPS.slice().sort((a, b) => Number(b.keys.some((k) => keySet.has(k.key))) - Number(a.keys.some((k) => keySet.has(k.key))));

  return (
    <>
      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-muted">Career path</p>
        {path.length ? (
          <ol className="mt-2 space-y-1.5 text-sm">
            {path.map((s, i) => (
              <li key={`${s.teamId}-${s.from}`} className="flex items-center gap-2">
                <span className="w-5 text-xs text-subtle">{i + 1}</span>
                <button type="button" onClick={() => openTeam(s.teamId)} className="flex min-h-8 items-center gap-2 hover:text-brass" disabled={!save.teams[s.teamId]}>
                  <Logo id={s.teamId} size={22} year={s.to} />
                  <span className="font-medium">{displayName(s.to, s.teamId)}</span>
                </button>
                <span className="tabular ml-auto text-xs text-muted">
                  {s.from === s.to ? s.from : `${s.from}–${s.to}`} · {s.gp} games
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">Hasn't played a regular-season game yet.</p>
        )}
        {p.draftTeam && save.teams[p.draftTeam] && (
          <p className="mt-2 text-xs text-muted">
            Drafted by the {displayName(p.draftYear ?? year, p.draftTeam)}
            {p.draftYear ? ` in ${p.draftYear}` : ""}
            {p.draftRound ? `, round ${p.draftRound}` : ""}
            {p.draftPick ? `, pick ${p.draftPick}` : ""}.
          </p>
        )}
        {tx.length > 0 && (
          <>
            <p className="mt-3 text-xs tracking-[0.25em] text-muted">Transactions</p>
            <ul className="mt-1 space-y-1 text-xs">
              {tx.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span className="tabular w-16 shrink-0 text-subtle">
                    {t.year}
                    {t.week ? ` wk ${t.week}` : ""}
                  </span>
                  <span className="w-28 shrink-0 font-medium text-paper">{TX_LABEL[t.kind] ?? t.kind}</span>
                  <span className="text-muted">{t.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {arc && arc.to > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs tracking-[0.25em] text-muted">His real career</p>
          <p className="mt-1 text-sm text-paper">
            In the real NFL he was drafted in {arc.dy} at {arc.age} and played through {arc.to}: {arc.g} games, {arc.st} seasons as a starter
            {arc.pb ? `, ${arc.pb} Pro Bowl${arc.pb === 1 ? "" : "s"}` : ""}
            {arc.ap ? `, ${arc.ap} first-team All-Pro${arc.ap === 1 ? "" : "s"}` : ""}. His development here follows that arc.
          </p>
        </section>
      )}

{!save.realHistory && (
      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs tracking-[0.25em] text-muted">{year} game by game</p>
          {log.length > 8 && (
            <button type="button" onClick={() => setAllGames((v) => !v)} className="min-h-9 min-w-9 px-1 text-xs text-brass">
              {allGames ? "Show fewer" : `All ${log.length}`}
            </button>
          )}
        </div>
        {log.length ? (
          <ul className="mt-2 divide-y divide-line text-sm">
            {(allGames ? log : log.slice(-8)).map(({ g, teamId, b }) => {
              const home = g.homeId === teamId;
              const opp = (home ? g.awayId : g.homeId) as TeamId;
              const us = home ? g.homeScore : g.awayScore;
              const them = home ? g.awayScore : g.homeScore;
              const res = us > them ? "W" : us < them ? "L" : "T";
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                  <span className="w-16 shrink-0 text-xs text-muted">{g.phase === "regular" ? `Wk ${g.week}` : g.round?.replace(/^(AFC|NFC|AFL|NFL) /, "") ?? "Playoffs"}</span>
                  <span className="text-xs text-subtle">{home ? "vs" : "at"}</span>
                  <Logo id={opp} size={18} year={year} />
                  <span className="w-10 font-display text-xs font-bold uppercase italic">{teamAbbr(opp)}</span>
                  <span className={`tabular w-14 text-xs ${res === "W" ? "text-good" : res === "L" ? "text-red" : "text-paper"}`}>
                    {res} {us}-{them}
                  </span>
                  <span className="min-w-0 flex-1 text-xs text-paper">{gameLine(p, b)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {save.phase === "regular" || save.phase === "deadline" || save.phase === "playoffs" || save.phase === "superBowl" || save.phase === "proBowl"
              ? `Hasn't appeared in a game yet in ${year}.`
              : "The game-by-game log runs while a season is being played. Every finished season is in the season log above."}
          </p>
        )}
      </section>
      )}

      {!save.realHistory && <section className="rounded-lg border border-brass/30 bg-surface p-4">
        <p className="text-xs tracking-[0.25em] text-brass">{p.revealed ? `Every attribute · overall ${p.ovr}` : `Every attribute · scout grade ${visibleOvr(p)} ${scoutLetter(visibleOvr(p))}`}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {groups.map((grp) => (
            <div key={grp.label}>
              <p className="mb-1.5 font-display text-[11px] font-bold uppercase italic tracking-wider text-muted">{grp.label}</p>
              <ul className="space-y-1">
                {grp.keys.map((k) => {
                  const v = shown[k.key] ?? 0;
                  const key = keySet.has(k.key);
                  return (
                    <li key={k.key} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs">
                      <span className={key ? "font-medium text-brass" : "text-muted"}>{k.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span className={`block h-full rounded-full ${v >= 90 ? "bg-brass" : v >= 80 ? "bg-accent" : v >= 70 ? "bg-paper" : "bg-muted"}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                      </span>
                      <span className="tabular text-right text-fg">{v}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-subtle">Gold labels are the ratings his position is graded on.</p>
      </section>}
    </>
  );
}
