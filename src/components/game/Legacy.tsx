import { useState } from "react";
import {
  activeTeamIds,
  canInductRing,
  canRetireNumber,
  displayName,
  inductRing,
  inRing,
  legacyCandidates,
  legacyCase,
  retiredNumbers,
  retireNumber,
  ringOfHonor,
  type Player,
  type TeamId,
} from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Btn, Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

/** "Retire #12" and "Ring of Honor", for a player who earned them in the owner's colors. */
export function HonorButtons({ player }: { player: Player }) {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  const u = save.userTeamId;
  const retired = retiredNumbers(save, u).find((r) => r.playerId === player.id);
  const ringed = inRing(save, u, player.id);
  const canNum = canRetireNumber(save, player, u);
  const canRing = canInductRing(save, player, u);
  if (!retired && !ringed && !canNum && !canRing) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {retired ? (
        <span className="rounded-sm border border-brass/60 bg-brass/15 px-3 py-1 text-xs tracking-[0.2em] text-brass">#{retired.n} RETIRED</span>
      ) : canNum ? (
        <Btn kind="gold" className="min-h-9 px-4 text-sm" onClick={() => desk((s) => retireNumber(s, player.id))}>
          Retire #{player.jersey}
        </Btn>
      ) : null}
      {ringed ? (
        <span className="rounded-sm border border-brass/60 bg-brass/15 px-3 py-1 text-xs tracking-[0.2em] text-brass">RING OF HONOR</span>
      ) : canRing ? (
        <Btn kind="ghost" className="min-h-9 px-4 text-sm" onClick={() => desk((s) => inductRing(s, player.id))}>
          Ring of Honor
        </Btn>
      ) : null}
    </div>
  );
}

/**
 * Induction night card. With a club, what he did in its colors (the owner's club gets the honor
 * buttons); without one, the whole career under the club he's most tied to.
 */
export function InductionCard({ player, teamId, note }: { player: Player; teamId?: TeamId; note?: string }) {
  const save = useGameStore((s) => s.save)!;
  const c = legacyCase(save, player, teamId);
  if (!c) return null;
  const mine = teamId === save.userTeamId;
  const club = c.teamId;
  const others = (c.clubs ?? []).filter((x) => x.teamId !== club);
  return (
    <li
      className={`overflow-hidden rounded-lg border ${
        mine ? "border-brass/60 bg-gradient-to-br from-brass/20 via-black/60 to-black/80" : "border-line bg-gradient-to-br from-white/5 via-black/60 to-black/80"
      }`}
    >
      <div className="flex items-stretch">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-2 border-r border-brass/30 bg-black/50 py-3 sm:w-28">
          <Logo id={club} size={34} />
          <span className="font-display text-3xl text-brass sm:text-4xl">{player.jersey >= 0 ? `#${player.jersey}` : "—"}</span>
        </div>
        <div className="min-w-0 flex-1 px-4 py-4">
          <p className="text-[11px] tracking-[0.3em] text-brass">
            {displayName(save.year, club).toUpperCase()} · {c.span} · {teamId ? c.seasons : c.clubs?.[0]?.seasons ?? c.seasons} SEASON
            {(teamId ? c.seasons : c.clubs?.[0]?.seasons ?? c.seasons) === 1 ? "" : "S"}
          </p>
          <p className="font-display text-3xl leading-tight">
            <PlayerLink player={player} className="inline min-h-0" /> <span className="text-sm text-muted">{player.pos}</span>
          </p>
          {others.length > 0 && (
            <p className="text-xs text-muted">
              Also: {others.map((o) => `${displayName(save.year, o.teamId)} (${o.seasons})`).join(" · ")}
            </p>
          )}
          <p className="mt-1 text-sm text-paper">
            {teamId ? "With the club" : `Career, ${c.seasons} season${c.seasons === 1 ? "" : "s"}`}: {c.line}
          </p>
          {c.honors.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {c.honors.map((h) => (
                <li key={h} className="rounded-sm border border-line bg-black/50 px-2 py-0.5 text-xs text-paper">
                  {h}
                </li>
              ))}
            </ul>
          )}
          {c.moments.length > 0 && (
            <ul className="mt-3 space-y-1 border-l-2 border-brass/50 pl-3 text-sm text-paper">
              {c.moments.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {note && <p className="mt-2 text-xs tracking-[0.15em] text-brass">{note}</p>}
          {mine && <HonorButtons player={player} />}
        </div>
      </div>
    </li>
  );
}

/** The History tab's franchise legacy: the rafters, the Ring, and who's still waiting. */
export function LegacySection() {
  const save = useGameStore((s) => s.save)!;
  const [club, setClub] = useState<TeamId>(save.userTeamId);
  const u = club;
  const mineView = club === save.userTeamId;
  const nums = retiredNumbers(save, u);
  const ring = ringOfHonor(save, u);
  const waiting = mineView ? legacyCandidates(save) : [];
  const pl = (id: string) => save.players[id];
  const honored = (id: TeamId) => retiredNumbers(save, id).length + ringOfHonor(save, id).length;
  const clubs = activeTeamIds(save.year)
    .slice()
    .sort((a, b) => Number(b === save.userTeamId) - Number(a === save.userTeamId) || displayName(save.year, a).localeCompare(displayName(save.year, b)));
  return (
    <section className="space-y-4 rounded-xl border border-brass/30 bg-black/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-[0.4em] text-brass">FRANCHISE LEGACY</p>
          <h3 className="flex items-center gap-2 font-display text-2xl">
            <Logo id={club} size={28} /> The rafters and the Ring
          </h3>
        </div>
        <label className="text-xs tracking-[0.2em] text-muted">
          CLUB{" "}
          <select
            className="ml-1 min-h-9 rounded-sm border border-line bg-black/70 px-2 text-sm text-paper"
            value={club}
            onChange={(e) => setClub(e.target.value as TeamId)}
          >
            {clubs.map((id) => (
              <option key={id} value={id}>
                {displayName(save.year, id)}
                {honored(id) ? ` (${honored(id)})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!nums.length && !ring.length && !waiting.length && (
        <p className="text-sm text-muted">No retired numbers and no Ring of Honor yet. The rafters are empty.</p>
      )}
      {nums.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.3em] text-muted">RETIRED NUMBERS</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nums.map((r) => {
              const p = pl(r.playerId);
              return (
                <li key={r.n} className="w-28 rounded-md border border-brass/50 bg-black/60 px-2 py-2 text-center">
                  <p className="font-display text-4xl text-brass">{r.n}</p>
                  <p className="truncate text-xs text-paper">{p ? <PlayerLink player={p} className="inline min-h-0" /> : "—"}</p>
                  <p className="text-[11px] text-muted">retired {r.year}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {ring.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.3em] text-muted">RING OF HONOR</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {ring.map((r) => {
              const p = pl(r.playerId);
              if (!p) return null;
              const c = legacyCase(save, p, u);
              return (
                <li key={r.playerId} className="rounded-md border border-line bg-black/50 px-3 py-2">
                  <p className="text-sm">
                    <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">{p.pos}</span>
                    {p.hofYear ? <span className="ml-2 text-[11px] tracking-[0.2em] text-brass">HOF {p.hofYear}</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {c?.span} · inducted {r.year}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {waiting.length > 0 && (
        <div>
          <p className="text-xs tracking-[0.3em] text-muted">STILL WAITING ON THE CLUB</p>
          <ul className="mt-2 space-y-2">
            {waiting.map((p) => {
              const c = legacyCase(save, p, u);
              return (
                <li key={p.id} className="rounded-md border border-line bg-black/50 px-3 py-2">
                  <p className="text-sm">
                    <PlayerLink player={p} className="inline min-h-0" /> <span className="text-muted">
                      {p.pos} · #{p.jersey} · {c?.span}
                    </span>
                  </p>
                  {c?.honors.length ? <p className="text-xs text-paper">{c.honors.join(" · ")}</p> : null}
                  <HonorButtons player={p} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
