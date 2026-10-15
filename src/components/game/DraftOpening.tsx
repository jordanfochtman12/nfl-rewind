import { useMemo } from "react";
import { classConsensus, displayName, draftQueue, draftVenue, onTheClock, playerName, sessionOf, type TeamId } from "@/lib/game";
import { commissionerFor } from "@/lib/game/broadcastCrew";
import { useGameStore } from "@/lib/game-store";
import { Logo } from "./chrome";
import { PlayerPortrait } from "./Portrait";

/** The stage before the first pick: lights, the podium, the crowd. Original art, no league marks. */
function Stage({ year, league }: { year: number; league: string }) {
  return (
    <svg className="dn-open-art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="dnoGlow" cx="50%" cy="78%" r="55%">
          <stop offset="0" stopColor="#3fd2ff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#1b4dff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="dnoBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff6ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3fd2ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dnoFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3a" />
          <stop offset="1" stopColor="#02050c" />
        </linearGradient>
        <linearGradient id="dnoPodium" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f7ff" />
          <stop offset="0.5" stopColor="#9fb3d6" />
          <stop offset="1" stopColor="#3b4a66" />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill="#03060f" />
      <rect width="1200" height="520" fill="url(#dnoGlow)" />
      {/* the video wall behind the stage */}
      <g opacity="0.5">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={110 + i * 70} y={70} width={62} height={190} rx={3} fill="#0b2a5c" stroke="#3fd2ff" strokeOpacity={0.25} />
        ))}
      </g>
      <text x="600" y="190" textAnchor="middle" className="dn-open-wall">{league} DRAFT {year}</text>
      {/* spotlights */}
      <g className="dn-open-beams">
        <polygon points="230,0 290,0 640,520 470,520" fill="url(#dnoBeam)" />
        <polygon points="910,0 970,0 730,520 560,520" fill="url(#dnoBeam)" />
        <polygon points="585,0 615,0 690,520 510,520" fill="url(#dnoBeam)" opacity="0.7" />
      </g>
      {/* stage floor */}
      <path d="M0 360 L1200 360 L1200 520 L0 520 Z" fill="url(#dnoFloor)" />
      <ellipse cx="600" cy="392" rx="300" ry="26" fill="#3fd2ff" opacity="0.18" />
      {/* the podium */}
      <path d="M548 300 L652 300 L640 392 L560 392 Z" fill="url(#dnoPodium)" />
      <rect x="540" y="292" width="120" height="12" rx="2" fill="#e8eefc" />
      <rect x="566" y="322" width="68" height="34" rx="3" fill="#0b1630" stroke="#ffb000" strokeWidth="2" />
      <text x="600" y="345" textAnchor="middle" className="dn-open-plate">{year}</text>
      <line x1="600" y1="292" x2="612" y2="268" stroke="#9fb3d6" strokeWidth="2" />
      {/* the crowd */}
      <g fill="#000" opacity="0.92">
        {Array.from({ length: 34 }, (_, i) => {
          const x = i * 36 + (i % 2 ? 8 : 0);
          const y = 470 + ((i * 7) % 11);
          return (
            <g key={i}>
              <circle cx={x + 18} cy={y - 18} r={13} />
              <rect x={x + 2} y={y - 6} width={32} height={60} rx={14} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Draft night's cold open: the welcome, who's up first, the top of the board, and the start. */
export function DraftOpening({ onStart }: { onStart: () => void }) {
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
    <section className="dn-open" aria-label={`Welcome to the ${save.year} ${league} draft`}>
      <div className="dn-open-stage">
        <Stage year={save.year} league={league} />
        <div className="dn-open-veil" />
        <div className="dn-open-head">
          <p className="dn-open-kicker">
            {draftVenue(save.year).toUpperCase()} <span aria-hidden>·</span> COMMISSIONER {commissionerFor(save.year).name.toUpperCase()}
          </p>
          <p className="dn-open-welcome">WELCOME TO THE</p>
          <h2 className="dn-open-title">
            {save.year} {league} <span>DRAFT</span>
          </h2>
          <p className="dn-open-sub">
            {total} picks. {top.length ? "A whole class waiting on a phone call." : ""}
          </p>
        </div>
      </div>
      <div className="dn-open-body">
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
                        {p.pos} · {p.college ?? "Campus"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <button type="button" className="dn-open-start" onClick={onStart}>
          START THE DRAFT <span aria-hidden>▸</span>
        </button>
      </div>
    </section>
  );
}
