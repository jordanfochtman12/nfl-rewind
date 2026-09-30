import type { CSSProperties } from "react";
import { teamAbbr, type PlayLog, type TeamId } from "@/lib/game";

export function BroadcastField({
  play,
  home,
  away,
  homeColor,
  awayColor,
  playing,
  index,
  duration = 1100,
}: {
  play: PlayLog;
  home: TeamId;
  away: TeamId;
  homeColor: string;
  awayColor: string;
  playing: boolean;
  index: number;
  duration?: number;
}) {
  const right = play.poss === away;
  const x = (spot: number) => 60 + Math.max(0, Math.min(100, right ? spot : 100 - spot)) * 6;
  const start = x(play.spot),
    finish = x(play.spot + (play.snap?.yards ?? 0));
  const color = play.poss === home ? homeColor : awayColor;
  const moving = !!play.snap && ["run", "pass"].includes(play.snap.kind) && play.snap.yards !== 0;
  const calls: Record<string, string> = { pa: "Play action", med: "Medium pass", deep: "Deep pass", short: "Short pass", fg: "Field goal try", punt: "Punt", special: "Special teams / stoppage", sneak: "QB sneak", kneel: "Victory formation", spike: "Clock stop" };
  const callLabel = play.snap ? calls[play.snap.call] ?? play.snap.call : "";
  const tag =
    play.tag === "td"
      ? "TOUCHDOWN"
      : play.tag === "to"
        ? "TURNOVER"
        : play.tag === "fg"
          ? "FIELD GOAL"
          : play.tag === "safety"
            ? "SAFETY"
            : null;
  return (
    <div className="broadcast-field">
      <div className="flex flex-wrap justify-between gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-muted">
        <span>
          Play diagram · {teamAbbr(play.poss)} {right ? "→" : "←"}
        </span>
        <span>
          {play.snap
            ? `${callLabel}${["kick", "other"].includes(play.snap.kind) ? "" : ` · ${play.snap.kind === "sack" ? "Sacked" : `${play.snap.yards} yds`}`}`
            : "Archived film · pre-snap position"}
        </span>
      </div>
      <svg
        viewBox="0 0 720 280"
        role="img"
        aria-label={`Schematic of ${teamAbbr(play.poss)} at their ${play.spot}. ${play.text}`}
        className="block w-full"
      >
        <defs>
          <linearGradient id="turf" x2="0" y2="1">
            <stop stopColor="#164c3b" />
            <stop offset="1" stopColor="#071e19" />
          </linearGradient>
        </defs>
        <rect x="12" y="12" width="696" height="256" rx="8" fill="url(#turf)" stroke="#ffffff33" />
        <rect x="12" y="12" width="48" height="256" fill={awayColor} opacity=".8" />
        <rect x="660" y="12" width="48" height="256" fill={homeColor} opacity=".8" />
        <text
          x="38"
          y="140"
          fill="white"
          fontSize="16"
          textAnchor="middle"
          transform="rotate(-90 38 140)"
        >
          {teamAbbr(away)}
        </text>
        <text
          x="686"
          y="140"
          fill="white"
          fontSize="16"
          textAnchor="middle"
          transform="rotate(90 686 140)"
        >
          {teamAbbr(home)}
        </text>
        {Array.from({ length: 11 }, (_, n) => (
          <g key={n}>
            <line x1={60 + n * 60} x2={60 + n * 60} y1="12" y2="268" stroke="white" opacity=".25" />
            {n > 0 && n < 10 && (
              <>
                <text x={60 + n * 60} y="42" fill="#ffffff88" textAnchor="middle" fontSize="13">
                  {Math.min(n, 10 - n) * 10}
                </text>
                <text x={60 + n * 60} y="247" fill="#ffffff88" textAnchor="middle" fontSize="13">
                  {Math.min(n, 10 - n) * 10}
                </text>
              </>
            )}
          </g>
        ))}
        {Array.from({ length: 49 }, (_, n) => (
          <path key={n} d={`M${72 + n * 12} 96v5 M${72 + n * 12} 179v5`} stroke="#ffffff55" />
        ))}
        <line x1={start} x2={start} y1="12" y2="268" stroke="#46caff" strokeWidth="2" />
        <line
          x1={x(play.spot + play.togo)}
          x2={x(play.spot + play.togo)}
          y1="12"
          y2="268"
          stroke="#ffd36c"
          strokeWidth="3"
        />
        <g key={index} style={{ animationPlayState: playing ? "running" : "paused" }}>
          <path
            d={`M${start} 140 Q${(start + finish) / 2} ${play.snap?.kind === "pass" ? 55 : 140} ${finish} 140`}
            fill="none"
            stroke="#ffe6a2"
            strokeWidth="3"
            strokeDasharray="6 5"
            opacity={moving ? 0.9 : 0}
          />
          <circle cx={start} cy="140" r="11" fill={color} stroke="white" strokeWidth="2" />
          <text x={start} y="144" fill="white" textAnchor="middle" fontSize="10">
            ●
          </text>
          {moving && (
            <g
              className="broadcast-ball"
              style={
                {
                  "--travel": `${finish - start}px`,
                  animationPlayState: playing ? "running" : "paused",
                  animationDuration: `${duration}ms`,
                } as CSSProperties
              }
            >
              <ellipse cx={start} cy="140" rx="8" ry="5" fill="#c68951" stroke="white" />
              <path d={`M${start - 4} 140h8`} stroke="white" />
            </g>
          )}
          {moving && (
            <circle cx={finish} cy="140" r="13" fill="none" stroke="#ffe6a2" strokeWidth="2" />
          )}
        </g>
      </svg>
      {tag && (
        <div key={`${index}-${tag}`} className="broadcast-event" role="status">
          {tag}
          <span>
            {play.as} — {play.hs}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-2 px-4 pb-3 text-[10px] text-muted">
        <span>
          <span className="text-sky-300">━</span> Line of scrimmage{" "}
          <span className="ml-3 text-amber-200">━</span> First down
        </span>
        <span>Schematic · recorded gain</span>
      </div>
    </div>
  );
}
