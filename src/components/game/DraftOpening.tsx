import { useMemo } from "react";
import { classConsensus, displayName, draftQueue, draftVenue, onTheClock, playerName, sessionOf, type TeamId, posLabel } from "@/lib/game";
import { commissionerFor } from "@/lib/game/broadcastCrew";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerPortrait } from "./Portrait";
import { NightOpening } from "./NightOpening";

/** Draft night's cold open: the welcome, who's up first, the top of the board, and the start. */
export function DraftOpening({ onStart, onPreview }: { onStart: () => void; onPreview: () => void }) {
  const save = useGameStore((s) => s.save)!;
  const league = sessionOf(save) === "afl" ? "AFL" : "NFL";
  const first = onTheClock(save);
  const top = useMemo(() => {
    const rank = classConsensus(save);
    return save.draftBoard
      .filter((pr) => !pr.taken && save.players[pr.playerId])
      .map((pr) => save.players[pr.playerId]!)
      .sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
      .slice(0, 3);
  }, [save]);
  const mine = useMemo(() => {
    if (save.sandbox) return undefined;
    const at = draftQueue(save).findIndex((q) => q.owner === save.userTeamId);
    return at >= 0 ? at + 1 : undefined;
  }, [save]);
  const total = draftQueue(save).length;
  return (
    <NightOpening
      label={`Welcome to the ${save.year} ${league} draft`}
      art={<div className="dn-open-photo dn-open-photo-draft" aria-hidden="true" />}
      kicker={`${draftVenue(save.year).toUpperCase()} · COMMISSIONER ${commissionerFor(save.year).name.toUpperCase()}`}
      welcome="WELCOME TO THE"
      title={
        <>
          {save.year} {league} <span>DRAFT</span>
        </>
      }
      sub={`${total} picks. ${top.length ? "A whole class waiting on a phone call." : ""}`}
      startLabel="START THE DRAFT"
      onStart={onStart}
    >
        <div className="dn-open-grid">
          {first && (
            <div className="dn-open-tile">
              <p className="dn-open-label">ON THE CLOCK · PICK 1</p>
              <div className="dn-open-club">
                <Logo id={first.teamId as TeamId} size={56} year={save.year} />
                <span>{displayName(save.year, first.teamId as TeamId)}</span>
              </div>
              {mine && (
                <p className="dn-open-mine">
                  {mine === 1 ? "That's you. The first pick is yours." : `Your first pick: number ${mine}.`}
                </p>
              )}
            </div>
          )}
          {top.length > 0 && (
            <div className="dn-open-tile dn-open-top">
              <p className="dn-open-label">THE TOP OF THE BOARD</p>
              <ol>
                {top.map((p, i) => (
                  <li key={p.id}>
                    <PlayerPortrait p={p} year={save.year} size="sm" />
                    <div className="min-w-0">
                      <b>
                        {i + 1}. {playerName(p)}
                      </b>
                      <small>
                        {posLabel(p)} · {p.college ?? "Campus"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <button type="button" className="dn-open-preview" onClick={onPreview} aria-label={`Watch the ${save.year} draft preview show`}>
          <span className="dn-open-preview-copy">
            <small className="dn-open-preview-kicker">LIVE SPECIAL · BEFORE PICK ONE</small>
            <strong>Watch the Draft Preview</strong>
            <span>Meet the class. Hear the debates. See the full mock draft and team needs.</span>
          </span>
          <span className="dn-open-preview-action"><span>ENTER THE SHOW</span><b aria-hidden="true">↗</b></span>
        </button>
    </NightOpening>
  );
}
