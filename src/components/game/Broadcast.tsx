import { useEffect, type ReactNode } from "react";
import { clubInk, locationOf, nicknameOf, teamAbbr } from "@/lib/game/teams.ts";
import type { DynastySave, GameResult, TeamId } from "@/lib/game/types.ts";
import { Logo } from "./chrome";
import { useGameStore } from "@/lib/game-store";

/** The network bug: our own wordmark, top-left of every screen. */
export function NetworkBug({ className = "" }: { className?: string }) {
  return (
    <span className={`next-network-bug ${className}`} aria-label="NFL Rewind">
      <img src="/brand/rewind-emblem.svg" width="42" height="42" alt="" />
      <span><b>NFL <em>REWIND</em></b><small>FRANCHISE FOOTBALL</small></span>
    </span>
  );
}

/** Score-bug style club plate: a slab in club colors with the mark, then the name on black glass. */
export function ClubPlate({ save, right }: { save: DynastySave; right?: ReactNode }) {
  const id = save.userTeamId;
  const ink = clubInk(id, save.year);
  const t = save.teams[id];
  const live = useGameStore((s) => s.liveGameId);
  // While the owner's game is on the live broadcast, the record would give the result away.
  const rec = live ? "LIVE" : t ? `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}` : "";
  return (
    <div className="flex min-w-0 items-stretch">
      <div
        className="relative flex shrink-0 items-center px-3 py-1.5"
        style={{
          transform: "skewX(-12deg)",
          background: `linear-gradient(180deg, color-mix(in srgb, ${ink.primary} 70%, white) 0%, ${ink.primary} 45%, color-mix(in srgb, ${ink.primary} 70%, black) 100%)`,
          boxShadow: "inset 0 1px 0 #ffffff55, inset 0 -2px 0 #0006",
        }}
      >
        <span style={{ transform: "skewX(12deg)" }}>
          <Logo id={id} size={34} />
        </span>
      </div>
      <div
        className="flex min-w-0 items-center gap-3 border-y border-r border-white/10 bg-gradient-to-b from-[#1e2432] to-[#0a0d14] py-1 pl-4 pr-4"
        style={{ transform: "skewX(-12deg)", marginLeft: -1, boxShadow: "inset 0 1px 0 #ffffff22" }}
      >
        <div className="min-w-0" style={{ transform: "skewX(12deg)" }}>
          <p className="truncate font-display text-[15px] font-bold uppercase italic leading-none tracking-wide text-white">
            <span className="hidden sm:inline">{locationOf(save.year, id)} </span>
            {nicknameOf(save.year, id)}
          </p>
          <p className="mt-1 flex items-center gap-2 font-display text-xs font-semibold uppercase italic leading-none">
            <span className="bg-brass px-1.5 py-0.5 text-[#140f00]">{save.year}</span>
            <span className="truncate text-chrome">{save.weekLabel}</span>
          </p>
        </div>
        {rec && (
          <span className="bug-num hidden text-2xl text-white sm:block" style={{ transform: "skewX(12deg)" }}>
            {rec}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}

/** The sandbox's plate: no club of its own, just the league, the year and the week. */
export function WatchPlate({ save }: { save: DynastySave }) {
  return (
    <div className="flex min-w-0 items-stretch">
      <div
        className="flex min-w-0 items-center gap-3 border border-white/10 bg-gradient-to-b from-[#1e2432] to-[#0a0d14] py-1 pl-4 pr-4"
        style={{ transform: "skewX(-12deg)", boxShadow: "inset 0 1px 0 #ffffff22" }}
      >
        <div className="min-w-0" style={{ transform: "skewX(12deg)" }}>
          <p className="truncate font-display text-[15px] font-bold uppercase italic leading-none tracking-wide text-white">{save.realHistory ? "History mode" : "Watch history"}</p>
          <p className="mt-1 flex items-center gap-2 font-display text-xs font-semibold uppercase italic leading-none">
            <span className="bg-brass px-1.5 py-0.5 text-[#140f00]">{save.year}</span>
            <span className="truncate text-chrome">{save.weekLabel}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Broadcast menu strip. Skewed segments; the live tab is lit in network red with a gold sill. */
export function TabStrip<T extends string>({
  tabs,
  active,
  onPick,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onPick: (id: T) => void;
}) {
  const save = useGameStore((s) => s.save);
  const sections = [
    { label: "Game day", ids: ["office", "primetime"] },
    { label: "Front office", ids: ["roster", "depth", "staff", "market", "moves"] },
    { label: "League", ids: ["standings", "league", "schedule", "stats"] },
    { label: "History", ids: ["draft", "history", "superbowl", "team", "hof"] },
  ].map((section) => ({ ...section, tabs: tabs.filter((tab) => section.ids.includes(tab.id)) })).filter((section) => section.tabs.length);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !/^[1-9]$/.test(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const next = tabs[Number(event.key) - 1];
      if (!next) return;
      event.preventDefault();
      onPick(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPick, tabs]);
  return (
      <nav className="pc-nav" aria-label="Game sections">
        <label className="pc-nav-select"><span>Open section</span><select aria-label="Section" value={active} onChange={(e) => onPick(e.target.value as T)}>{tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}</select></label>
        <div className="pc-nav-groups">
          {sections.map((section) => (
            <section className="pc-nav-group" key={section.label} aria-label={section.label}>
              <p>{section.label}</p>
              {section.tabs.map((tab) => {
                const index = tabs.findIndex((item) => item.id === tab.id) + 1;
                return <button key={tab.id} type="button" aria-current={tab.id === active ? "page" : undefined} aria-keyshortcuts={`Alt+${index}`} onClick={() => onPick(tab.id)} className={`pc-nav-item ${tab.id === active ? "is-active" : ""}`}>
                  <span className="pc-nav-indicator" aria-hidden />
                  <span>{tab.label}</span>
                  <kbd aria-hidden>{index}</kbd>
                </button>;
              })}
            </section>
          ))}
          {save && <div className="pc-nav-season"><span>ON THE AIR</span><strong>{save.year} Season</strong><small>{save.weekLabel}</small></div>}
          <p className="pc-nav-shortcut">Jump to a section with <kbd>Alt</kbd> + <kbd>1–9</kbd></p>
        </div>
    </nav>
  );
}

function scoreLine(g: GameResult): string {
  const a = teamAbbr(g.awayId as TeamId);
  const h = teamAbbr(g.homeId as TeamId);
  const aw = g.awayScore > g.homeScore;
  return `${aw ? "▸ " : ""}${a} ${g.awayScore}   ${!aw && g.homeScore > g.awayScore ? "▸ " : ""}${h} ${g.homeScore}   FINAL${g.ot ? "/OT" : ""}`;
}

/** The crawl along the bottom of the screen: the latest scores around the league, then the wire. */
export function BottomLine({ save }: { save: DynastySave }) {
  const live = useGameStore((s) => s.liveGameId);
  const played = [...save.schedule, ...save.playoffGames, ...(save.superBowl ? [save.superBowl] : [])].filter(
    (g) => g.played && g.year === save.year && g.id !== live,
  );
  const last = played.at(-1);
  const recent = last
    ? played.filter((g) => g.phase === last.phase && (g.phase === "regular" ? g.week === last.week : true)).slice(-16)
    : [];
  const label = !last ? "" : last.phase === "regular" ? `WEEK ${last.week}` : last.phase === "superBowl" ? "SUPER BOWL" : "PLAYOFFS";
  const wire = save.news
    .filter((n) => !live || !(n.year === save.year && n.week === save.week && n.teamIds.includes(save.userTeamId)))
    .slice(0, 8);
  if (!recent.length && !wire.length) return null;
  const items: { k: string; node: ReactNode }[] = [
    ...recent.map((g) => ({
      k: g.id,
      node: (
        <span className="flex items-center gap-2">
          <Logo id={g.awayId as TeamId} size={16} />
          <span className="tabular whitespace-pre">{scoreLine(g)}</span>
          <Logo id={g.homeId as TeamId} size={16} />
        </span>
      ),
    })),
    ...wire.map((n) => ({
      k: n.id,
      node: (
        <span className="flex items-center gap-2">
          <span className="bg-white/90 px-1 font-display text-[10px] font-extrabold italic text-black">NEWS</span>
          <span className="whitespace-nowrap">{n.headline}</span>
        </span>
      ),
    })),
  ];
  const row = (dup: boolean) =>
    items.map((it) => (
      <span key={`${dup ? "d" : ""}${it.k}`} className="flex items-center gap-6 pr-6" aria-hidden={dup}>
        {it.node}
        <span className="h-3 w-[3px] skew-x-[-18deg] bg-red" aria-hidden />
      </span>
    ));
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex h-9 items-stretch border-t border-white/15 bg-gradient-to-b from-[#1a1f2b] to-[#05070b] shadow-[0_-8px_24px_#000a]">
      <div className="bx-primary relative z-10 flex shrink-0 items-center px-3 font-display text-[13px] font-extrabold italic tracking-wider">
        {label || "WIRE"}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden font-display text-[14px] font-semibold italic uppercase tracking-wide text-white">
        <div className="ticker flex h-full w-max items-center pl-4">
          {row(false)}
          {row(true)}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0e121a] to-transparent" />
      </div>
    </div>
  );
}

/** Broadcast header: a lower-third title plate for a screen, with an optional kicker and actions. */
export function PlateTitle({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {kicker && (
          <p className="inline-flex bg-red px-2 py-0.5 font-display text-xs font-extrabold uppercase italic tracking-[0.12em] text-white [transform:skewX(-12deg)]">
            <span className="[transform:skewX(12deg)]">{kicker}</span>
          </p>
        )}
        <h2 className="mt-1 text-3xl text-white sm:text-4xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

