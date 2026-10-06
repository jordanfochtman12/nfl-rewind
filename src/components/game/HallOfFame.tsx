import { useEffect, useMemo, useState } from "react";
import {
  treeLine,
  coachHome,
  coachWriteUp,
  displayName,
  hofWriteUp,
  jerseyFor,
  legacyCase,
  playbookOf,
  signatureClub,
  type Coach,
  type HofMember,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { Jersey } from "./Jersey";

export type PlaqueTarget = { kind: "player"; id: string } | { kind: "coach"; id: string; teamId?: TeamId };

/** A jersey on its hanger with the name under it; opens the plaque. */
export function HangingJersey({
  player,
  teamId,
  caption,
  onOpen,
  width = 104,
}: {
  player: Player;
  teamId?: TeamId;
  caption?: string;
  onOpen: () => void;
  width?: number;
}) {
  const save = useGameStore((s) => s.save)!;
  const look = jerseyFor(save, player, teamId);
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col items-center text-center" style={{ width: width + 16 }}>
      <span className="transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
        <Jersey look={look} width={width} />
      </span>
      <span className="mt-1 block w-full truncate font-display text-xs font-bold uppercase italic text-white group-hover:text-brass">
        {player.firstName} {player.lastName}
      </span>
      <span className="block text-[11px] text-muted">{caption ?? `${player.pos} · ${look.year}`}</span>
    </button>
  );
}

/** A coach hangs as the logo of the club he's most tied to, framed like a banner. */
export function CoachBanner({ coach, teamId, caption, onOpen, width = 104 }: { coach: Coach; teamId?: TeamId; caption?: string; onOpen: () => void; width?: number }) {
  const save = useGameStore((s) => s.save)!;
  const home = coachHome(save, coach, teamId);
  const year = coach.retiredYear ?? save.year;
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col items-center text-center" style={{ width: width + 16 }}>
      <span
        className="flex flex-col items-center justify-center border border-brass/50 bg-gradient-to-b from-black/30 to-black/80 shadow-[0_10px_14px_rgba(0,0,0,0.55)] transition-transform duration-200 [clip-path:polygon(0_0,100%_0,100%_86%,50%_100%,0_86%)] group-hover:-translate-y-1"
        style={{ width, height: (width * 196) / 160 }}
      >
        <Logo id={home} size={Math.round(width * 0.62)} year={year} />
        <span className="mt-2 font-display text-[10px] font-bold uppercase italic tracking-[0.2em] text-brass">Head coach</span>
      </span>
      <span className="mt-1 block w-full truncate font-display text-xs font-bold uppercase italic text-white group-hover:text-brass">{coach.name}</span>
      <span className="block text-[11px] text-muted">{caption ?? displayName(year, home)}</span>
    </button>
  );
}

/** The plaque: the jersey or logo, the write-up, the line, the hardware. */
export function HofPlaque({ target, onClose }: { target: PlaqueTarget | null; onClose: () => void }) {
  const save = useGameStore((s) => s.save);
  const openProfile = useGameStore((s) => s.openProfile);
  const openTeam = useGameStore((s) => s.openTeam);
  useEffect(() => {
    if (!target) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [target, onClose]);
  if (!save || !target) return null;
  const member = save.history.hof.find((m) => (target.kind === "player" ? m.playerId === target.id : m.coachId === target.id));
  let body: React.ReactNode = null;
  if (target.kind === "player") {
    const p = save.players[target.id];
    if (!p) return null;
    const look = jerseyFor(save, p);
    const c = legacyCase(save, p);
    const clubs = c?.clubs ?? [];
    body = (
      <>
        <div className="flex shrink-0 flex-col items-center justify-center bg-gradient-to-b from-black/20 to-black/70 px-6 py-6 sm:w-64">
          <Jersey look={look} width={190} />
          <button type="button" onClick={() => openTeam(look.teamId)} className="mt-3 flex items-center gap-2 text-sm text-paper hover:text-brass">
            <Logo id={look.teamId} size={24} year={look.year} />
            {displayName(look.year, look.teamId)}
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-5">
          <div>
            <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">
              {p.hofYear ?? member?.year ? `Hall of Fame · Class of ${p.hofYear ?? member?.year}` : "Franchise legend"}
            </p>
            <h3 className="font-display text-3xl font-bold uppercase italic leading-tight text-white">
              {p.firstName} {p.lastName}
            </h3>
            <p className="text-sm text-muted">
              {p.pos} · {p.college ?? "—"} · {c?.span ?? ""}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-paper">{hofWriteUp(save, p)}</p>
          {c && (
            <div className="rounded-md border border-line bg-black/40 px-3 py-2">
              <p className="text-[11px] tracking-[0.25em] text-muted">CAREER</p>
              <p className="text-sm text-white">{c.line}</p>
            </div>
          )}
          {c?.honors.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {c.honors.map((h) => (
                <li key={h} className="rounded-sm border border-brass/40 bg-brass/10 px-2 py-0.5 text-xs text-brass">
                  {h}
                </li>
              ))}
            </ul>
          ) : null}
          {c?.moments.length ? (
            <ul className="space-y-1 border-l-2 border-brass/50 pl-3 text-sm text-paper">
              {c.moments.slice(0, 5).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
          {clubs.length > 1 && (
            <p className="text-xs text-muted">Clubs: {clubs.map((k) => `${displayName(save.year, k.teamId)} (${k.seasons})`).join(" · ")}</p>
          )}
          <Btn kind="gold" className="min-h-10 px-4 text-sm" onClick={() => openProfile(p.id)}>
            Full player card: every stat, award and rating
          </Btn>
        </div>
      </>
    );
  } else {
    const coach = save.coaches[target.id];
    if (!coach) return null;
    const home = coachHome(save, coach, target.teamId ?? member?.teamId);
    const year = coach.retiredYear ?? save.year;
    const book = playbookOf(coach, year);
    const tenure = Object.entries(coach.tenure ?? {}).sort((a, b) => b[1] - a[1]);
    body = (
      <>
        <div className="flex shrink-0 flex-col items-center justify-center bg-gradient-to-b from-black/20 to-black/70 px-6 py-8 sm:w-64">
          <Logo id={home} size={150} year={year} />
          <p className="mt-3 text-sm text-paper">{displayName(year, home)}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-5">
          <div>
            <p className="font-display text-xs font-bold uppercase italic tracking-[0.3em] text-brass">
              Hall of Fame · Class of {coach.hofYear ?? member?.year} · Coach
            </p>
            <h3 className="font-display text-3xl font-bold uppercase italic leading-tight text-white">{coach.name}</h3>
            <p className="text-sm text-muted">
              {coach.careerWins}-{coach.careerLosses}
              {coach.careerTies ? `-${coach.careerTies}` : ""} · {coach.careerTitles} title{coach.careerTitles === 1 ? "" : "s"} · {coach.yearsCoaching} seasons{coach.recordFrom ? ` since ${coach.recordFrom}` : ""}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-paper">{coachWriteUp(save, coach, home)}</p>
          {treeLine(save, coach) && <p className="text-sm text-muted">{treeLine(save, coach)}</p>}
          {book && (
            <div className="rounded-md border border-line bg-black/40 px-3 py-2 text-sm">
              <p className="text-[11px] tracking-[0.25em] text-muted">HIS SYSTEM</p>
              <p className="text-white">{book.offense}</p>
              <p className="text-white">{book.defense}</p>
            </div>
          )}
          {tenure.length > 1 && <p className="text-xs text-muted">Staffs: {tenure.map(([id]) => displayName(year, id as TeamId)).join(" · ")}</p>}
          {coach.abilities?.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {coach.abilities.map((a) => (
                <li key={a} className="rounded-sm border border-brass/40 bg-brass/10 px-2 py-0.5 text-xs text-brass">
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 sm:items-center sm:p-6" onClick={onClose}>
      <article
        role="dialog"
        aria-modal="true"
        aria-label="Hall of Fame plaque"
        className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-brass/50 bg-surface shadow-2xl sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-2 z-10 min-h-10 min-w-10 rounded-sm border border-line bg-black/70 text-paper hover:text-brass">
          ×
        </button>
        {body}
      </article>
    </div>
  );
}

type Who = "all" | "players" | "coaches";

/** Canton: every class, every jersey hung by its club's colors, every coach under his logo. */
export function HallOfFame() {
  const save = useGameStore((s) => s.save)!;
  const [plaque, setPlaque] = useState<PlaqueTarget | null>(null);
  const [who, setWho] = useState<Who>("all");
  const [club, setClub] = useState<TeamId | "">("");
  const [pos, setPos] = useState("");
  const [q, setQ] = useState("");
  const members = save.history.hof ?? [];

  const homeOf = (m: HofMember): TeamId | undefined => {
    if (m.playerId) {
      const p = save.players[m.playerId];
      return p ? (signatureClub(p)?.teamId ?? m.teamId) : m.teamId;
    }
    const c = m.coachId ? save.coaches[m.coachId] : undefined;
    return c ? coachHome(save, c, m.teamId) : m.teamId;
  };

  const classes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = members.filter((m) => {
      // History mode enshrines coaches, contributors and pre-1966 players by name alone.
      if (m.name && !m.playerId && !m.coachId) return who === "all" && !club && !pos && (!needle || m.name.toLowerCase().includes(needle));
      if (who === "players" && !m.playerId) return false;
      if (who === "coaches" && !m.coachId) return false;
      if (club && homeOf(m) !== club) return false;
      const p = m.playerId ? save.players[m.playerId] : undefined;
      const c = m.coachId ? save.coaches[m.coachId] : undefined;
      if (!p && !c) return false;
      if (pos && (!p || p.pos !== pos)) return false;
      if (needle && !(p ? `${p.firstName} ${p.lastName}` : c!.name).toLowerCase().includes(needle)) return false;
      return true;
    });
    const by = new Map<number, HofMember[]>();
    for (const m of shown) by.set(m.year, [...(by.get(m.year) ?? []), m]);
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, who, club, pos, q]);

  const clubs = [...new Set(members.filter((m) => m.playerId || m.coachId).map(homeOf).filter((x): x is TeamId => !!x))].sort((a, b) => displayName(save.year, a).localeCompare(displayName(save.year, b)));
  const positions = [...new Set(members.map((m) => (m.playerId ? save.players[m.playerId]?.pos : undefined)).filter((x): x is NonNullable<typeof x> => !!x))].sort();
  const total = members.length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-brass/40 bg-gradient-to-b from-brass/15 via-black/60 to-black/80 px-5 py-6">
        <p className="font-display text-xs font-bold uppercase italic tracking-[0.4em] text-brass">Canton, Ohio</p>
        <h2 className="font-display text-4xl font-bold uppercase italic text-white">Pro Football Hall of Fame</h2>
        <p className="mt-1 max-w-2xl text-sm text-paper">
          {total
            ? `${total} enshrined in this dynasty. Every player's jersey hangs in the colors he wore for the club he's most remembered with; coaches hang under that club's banner. Tap any of them for the plaque.`
            : "Nobody has been enshrined yet. Players become eligible five years after they retire; coaches after three."}
        </p>
      </section>

      {total > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Hall"
            aria-label="Search the Hall of Fame"
            className="min-h-11 rounded-sm border border-line bg-black/60 px-3 text-sm text-paper placeholder:text-subtle"
          />
          <select aria-label="Who" value={who} onChange={(e) => setWho(e.target.value as Who)} className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper">
            <option value="all">Players and coaches</option>
            <option value="players">Players</option>
            <option value="coaches">Coaches</option>
          </select>
          <select aria-label="Club" value={club} onChange={(e) => setClub(e.target.value as TeamId | "")} className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper">
            <option value="">Every club</option>
            {clubs.map((id) => (
              <option key={id} value={id}>
                {displayName(save.year, id)}
              </option>
            ))}
          </select>
          <select aria-label="Position" value={pos} onChange={(e) => setPos(e.target.value)} className="min-h-11 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper">
            <option value="">All positions</option>
            {positions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      )}

      {classes.map(([year, list]) => (
        <section key={year} className="rounded-xl border border-line bg-surface/60">
          <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-2">
            <h3 className="font-display text-lg font-bold uppercase italic text-white">Class of {year}</h3>
            <span className="text-xs text-muted">{list.length} enshrined</span>
          </div>
          <div className="relative px-2 pb-4 pt-6">
            <div className="absolute inset-x-4 top-4 h-1 rounded-full bg-gradient-to-r from-[#5c626b] via-[#c4c9d0] to-[#5c626b]" aria-hidden />
            <div className="relative flex flex-wrap justify-center gap-x-2 gap-y-5 sm:justify-start">
              {list.map((m) => {
                if (m.name && !m.playerId && !m.coachId)
                  return (
                    <span key={`n-${m.name}`} className="self-end rounded-sm border border-brass/40 bg-black/60 px-3 py-2 font-display text-sm uppercase italic text-paper">
                      {m.name}
                    </span>
                  );
                if (m.playerId) {
                  const p = save.players[m.playerId];
                  return p ? <HangingJersey key={m.playerId} player={p} onOpen={() => setPlaque({ kind: "player", id: p.id })} /> : null;
                }
                const c = m.coachId ? save.coaches[m.coachId] : undefined;
                return c ? <CoachBanner key={m.coachId} coach={c} teamId={m.teamId} onOpen={() => setPlaque({ kind: "coach", id: c.id, teamId: m.teamId })} /> : null;
              })}
            </div>
          </div>
        </section>
      ))}
      {total > 0 && !classes.length && <p className="text-sm text-muted">Nobody in the Hall matches.</p>}
      <HofPlaque target={plaque} onClose={() => setPlaque(null)} />
    </div>
  );
}
