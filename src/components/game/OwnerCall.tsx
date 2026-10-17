import type { CSSProperties } from "react";
import { clubInk, decide, displayName, formatMoney, openDecisions, type OwnerDecision, posLabel } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerLink } from "./PlayerProfile";

const KICKER: Record<OwnerDecision["kind"], string> = {
  extension: "CONTRACT",
  rift: "LOCKER ROOM",
  curfew: "DISCIPLINE",
  hurt: "MEDICAL",
  fans: "THE FANS",
  community: "COMMUNITY",
};

/** The owner's call: a dilemma on the desk this week, and the last one's outcome. */
export function OwnerCall() {
  const save = useGameStore((s) => s.save)!;
  const desk = useGameStore((s) => s.desk);
  if (save.cpuOnly || save.sandbox || save.realHistory) return null;
  const open = openDecisions(save);
  const last = (save.decisions ?? []).filter((d) => d.status === "done" && d.year === save.year && d.week >= save.week - 1).at(-1);
  if (!open.length && !last) return null;
  const ink = clubInk(save.userTeamId, save.year);
  return (
    <section className="k5-call" style={{ "--club": ink.primary } as CSSProperties} aria-label="The owner's call">
      <div className="k5-call-bg" aria-hidden />
      <header className="k5-call-head">
        <span className="k5-call-live" aria-hidden />
        <p>THE OWNER&apos;S CALL</p>
        {open.length > 0 && <small>Decide before kickoff, or the quiet choice is made for you</small>}
      </header>
      {open.map((d) => {
        const players = d.playerIds.map((id) => save.players[id]).filter((p) => !!p);
        return (
          <article key={d.id} className="k5-call-card">
            <div className="k5-call-top">
              <Logo id={d.teamIds[0]!} size={64} />
              <div className="min-w-0">
                <p className="k5-call-kicker">
                  <span>{KICKER[d.kind]}</span> WEEK {d.week} · {displayName(save.year, d.teamIds[0]!).toUpperCase()}
                </p>
                <h3 className="k5-call-title">{d.title}</h3>
              </div>
            </div>
            <p className="k5-call-body">{d.body}</p>
            {players.length > 0 && (
              <p className="k5-call-who">
                {players.map((p) => (
                  <span key={p.id}>
                    <PlayerLink player={p} className="inline min-h-0" /> <small>{posLabel(p)} · {p.ovr} OVR · age {p.age}</small>
                  </span>
                ))}
                {d.ask ? <span className="k5-call-ask">Asking {formatMoney(d.ask, save.year)} a year</span> : null}
              </p>
            )}
            <div className="k5-call-options">
              {d.options.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  className={`k5-call-opt ${i === 0 ? "is-lead" : ""}`}
                  onClick={() => desk((s) => decide(s, d.id, o.id))}
                >
                  <b>{o.label}</b>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          </article>
        );
      })}
      {!open.length && last?.outcome && (
        <p className="k5-call-outcome">
          <span>LAST CALL</span> {last.outcome}
        </p>
      )}
    </section>
  );
}
