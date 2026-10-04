/**
 * The race trackers and running storylines, shared by the watch desk and the TV pregame show:
 * the playoff picture with clinch and elimination marks, the award ladders, record chases and
 * the league's through-lines.
 */
import { useMemo, useState } from "react";
import {
  awardRaces,
  displayName,
  leagueStorylines,
  playoffPicture,
  recordChases,
  rulebookThrough,
  teamAbbr,
  type DynastySave,
  type RaceMark,
  type TeamId,
} from "@/lib/game";
import { Logo } from "./chrome";

const MARK: Record<RaceMark, { label: string; cls: string; title: string }> = {
  division: { label: "z", cls: "bg-brass text-[#140f00]", title: "Clinched the division" },
  playoffs: { label: "x", cls: "bg-good text-black", title: "Clinched a playoff spot" },
  in: { label: "", cls: "", title: "In a playoff spot today" },
  hunt: { label: "", cls: "", title: "In the hunt" },
  out: { label: "e", cls: "bg-red text-white", title: "Eliminated" },
};

export function PlayoffPicture({ save, compact = false }: { save: DynastySave; compact?: boolean }) {
  const groups = useMemo(() => playoffPicture(save), [save]);
  const [all, setAll] = useState(false);
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Playoff picture">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">{save.year < 1970 ? "TITLE RACES" : "PLAYOFF PICTURE"}</p>
        <p className="text-[10px] text-subtle">z division · x playoffs · e eliminated</p>
      </div>
      <div className={`mt-3 grid gap-4 ${groups.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {groups.map((g) => {
          const shown = all || compact ? g.rows.slice(0, compact ? g.spots + 1 : g.rows.length) : g.rows.slice(0, g.spots + 3);
          return (
            <div key={g.conf}>
              <p className="font-display text-sm uppercase italic text-paper">{g.conf}</p>
              <ol className="mt-1 space-y-0.5">
                {shown.map((r, k) => {
                  const m = MARK[r.mark];
                  const line = k === g.spots - 1 && shown.length > g.spots;
                  return (
                    <li key={r.teamId} className={`flex min-h-8 items-center gap-2 text-sm ${line ? "border-b border-dashed border-brass/50 pb-1" : ""} ${r.mark === "out" ? "opacity-55" : ""}`}>
                      <span className="tabular w-5 text-right text-xs text-muted">{r.seed ?? ""}</span>
                      <Logo id={r.teamId} size={20} year={save.year} />
                      <span className="flex-1 truncate">
                        <span className="sm:hidden">{teamAbbr(r.teamId)}</span>
                        <span className="max-sm:hidden">{displayName(save.year, r.teamId)}</span>
                      </span>
                      {m.label && (
                        <span title={m.title} aria-label={m.title} className={`px-1.5 font-display text-[11px] font-bold ${m.cls}`}>
                          {m.label}
                        </span>
                      )}
                      <span className="tabular w-14 text-right text-paper">{r.record}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      {!compact && (
        <button type="button" className="mt-2 min-h-9 text-xs text-brass underline" onClick={() => setAll(!all)}>
          {all ? "Show the race only" : "Show every club"}
        </button>
      )}
    </section>
  );
}

export function AwardLadders({ save, only, top = 5 }: { save: DynastySave; only?: string[]; top?: number }) {
  const ladders = useMemo(() => awardRaces(save).filter((l) => !only || only.includes(l.key)), [save, only]);
  if (!ladders.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Award races">
      <p className="text-xs tracking-[0.25em] text-muted">AWARD LADDERS · IF THE VOTE WERE TODAY</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {ladders.map((l) => (
          <div key={l.key}>
            <p className="font-display text-sm uppercase italic text-brass">{l.label}</p>
            <ol className="mt-1 space-y-1">
              {l.rows.slice(0, top).map((r, i) => (
                <li key={r.id} className="flex gap-2 text-sm">
                  <span className="tabular w-4 text-muted">{i + 1}</span>
                  {r.teamId && <Logo id={r.teamId} size={18} year={save.year} />}
                  <span className="min-w-0">
                    <span className="text-paper">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.line}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecordChases({ save }: { save: DynastySave }) {
  const chases = useMemo(() => recordChases(save), [save]);
  if (!chases.length) return null;
  return (
    <section className="rounded-xl border border-brass/40 bg-surface p-4" aria-label="Record chases">
      <p className="text-xs tracking-[0.25em] text-brass">RECORD WATCH</p>
      <ul className="mt-2 space-y-2">
        {chases.map((c) => (
          <li key={c.cat} className="flex gap-2 text-sm">
            {c.teamId && <Logo id={c.teamId} size={20} year={save.year} />}
            <span className="text-paper">{c.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `focus` puts the stories about those clubs first (a playoff game's pregame). */
export function StoryBoard({ save, max = 6, focus }: { save: DynastySave; max?: number; focus?: TeamId[] }) {
  const stories = useMemo(() => {
    const all = leagueStorylines(save, focus ? 30 : max);
    if (!focus) return all;
    const mine = all.filter((x) => x.teamIds.some((id) => focus.includes(id)));
    return [...mine, ...all.filter((x) => !mine.includes(x))].slice(0, max);
  }, [save, max, focus]);
  if (!stories.length) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Storylines">
      <p className="text-xs tracking-[0.25em] text-muted">STORYLINES</p>
      <ul className="mt-3 space-y-3">
        {stories.map((s, i) => (
          <li key={`${s.kind}-${i}`} className="flex gap-3">
            {s.teamIds[0] && <Logo id={s.teamIds[0]} size={28} year={save.year} />}
            <div>
              <p className="text-sm text-paper">{s.title}</p>
              <p className="text-xs text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The rule changes on the books by this season, newest first, with what each does to the game. */
export function Rulebook({ save }: { save: DynastySave }) {
  const rules = rulebookThrough(save.year);
  const [all, setAll] = useState(false);
  if (!rules.length) return null;
  const shown = all ? rules : rules.slice(0, 5);
  return (
    <section className="rounded-xl border border-line bg-surface p-4" aria-label="Rulebook">
      <p className="text-xs tracking-[0.25em] text-muted">THE RULEBOOK · CHANGES SINCE 1966</p>
      <ol className="mt-3 space-y-3">
        {shown.map((r) => (
          <li key={`${r.year}-${r.title}`} className="flex gap-3">
            <span className="tabular w-12 shrink-0 font-display text-lg text-brass">{r.year}</span>
            <div>
              <p className="text-sm text-paper">{r.title}</p>
              <p className="text-xs text-muted">{r.body}</p>
              <p className="mt-0.5 text-xs text-brass/90">{r.effect}</p>
            </div>
          </li>
        ))}
      </ol>
      {rules.length > 5 && (
        <button type="button" className="mt-2 min-h-9 text-xs text-brass underline" onClick={() => setAll(!all)}>
          {all ? "Show the latest" : `Show all ${rules.length}`}
        </button>
      )}
    </section>
  );
}
