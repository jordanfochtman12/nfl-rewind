import { useId, type CSSProperties, type ReactNode } from "react";

/*
 * The cold open for television's big nights (draft, Super Bowl, awards, Canton): a stage of
 * its own, the title, what's on the line, and a Start button. Original art, no league marks.
 */

/** A lit stage: video wall, spotlights, the podium, the crowd. */
export function StageArt({ wall, plate, glow = "#3fd2ff", accent = "#ffb000" }: { wall: string; plate: string; glow?: string; accent?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="dn-open-art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={`${id}g`} cx="50%" cy="78%" r="55%">
          <stop offset="0" stopColor={glow} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={glow} stopOpacity="0.18" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2fbff" stopOpacity="0.55" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1b3a" />
          <stop offset="1" stopColor="#02050c" />
        </linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f7ff" />
          <stop offset="0.5" stopColor="#9fb3d6" />
          <stop offset="1" stopColor="#3b4a66" />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill="#03060f" />
      <rect width="1200" height="520" fill={`url(#${id}g)`} />
      <g opacity="0.5">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={110 + i * 70} y={70} width={62} height={190} rx={3} fill="#0b2a5c" stroke={glow} strokeOpacity={0.25} />
        ))}
      </g>
      <text x="600" y="190" textAnchor="middle" className="dn-open-wall" style={{ fill: glow }}>
        {wall}
      </text>
      <g className="dn-open-beams">
        <polygon points="230,0 290,0 640,520 470,520" fill={`url(#${id}b)`} />
        <polygon points="910,0 970,0 730,520 560,520" fill={`url(#${id}b)`} />
        <polygon points="585,0 615,0 690,520 510,520" fill={`url(#${id}b)`} opacity="0.7" />
      </g>
      <path d="M0 360 L1200 360 L1200 520 L0 520 Z" fill={`url(#${id}f)`} />
      <ellipse cx="600" cy="392" rx="300" ry="26" fill={glow} opacity="0.18" />
      <path d="M548 300 L652 300 L640 392 L560 392 Z" fill={`url(#${id}p)`} />
      <rect x="540" y="292" width="120" height="12" rx="2" fill="#e8eefc" />
      <rect x="566" y="322" width="68" height="34" rx="3" fill="#0b1630" stroke={accent} strokeWidth="2" />
      <text x="600" y="345" textAnchor="middle" className="dn-open-plate" style={{ fill: accent }}>
        {plate}
      </text>
      <line x1="600" y1="292" x2="612" y2="268" stroke="#9fb3d6" strokeWidth="2" />
      <Crowd />
    </svg>
  );
}

/** A stadium at night under the lights: the two clubs' colors in the end zones. */
export function StadiumArt({ wall, home, away }: { wall: string; home: string; away: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className="dn-open-art" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02040b" />
          <stop offset="1" stopColor="#0b1a3a" />
        </linearGradient>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f6b3a" />
          <stop offset="1" stopColor="#0b3a1e" />
        </linearGradient>
        <radialGradient id={`${id}l`} cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#fff6d8" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="520" fill={`url(#${id}s)`} />
      {/* the light towers */}
      {[150, 1050].map((x) => (
        <g key={x}>
          <rect x={x - 3} y={40} width={6} height={150} fill="#1b2a44" />
          <rect x={x - 46} y={22} width={92} height={30} rx={3} fill="#fff8dc" opacity="0.9" />
          <circle cx={x} cy={37} r={70} fill="#fff6d8" opacity="0.12" />
        </g>
      ))}
      <rect width="1200" height="520" fill={`url(#${id}l)`} />
      {/* the upper deck */}
      <path d="M0 210 Q600 130 1200 210 L1200 260 Q600 190 0 260 Z" fill="#0d1830" />
      <path d="M0 210 Q600 130 1200 210" stroke="#3fd2ff" strokeOpacity="0.3" strokeWidth="2" fill="none" />
      <text x="600" y="178" textAnchor="middle" className="dn-open-wall" style={{ fill: "#ffd56b", opacity: 0.55 }}>
        {wall}
      </text>
      {/* the field, in perspective */}
      <path d="M140 300 L1060 300 L1200 520 L0 520 Z" fill={`url(#${id}t)`} />
      <path d="M140 300 L250 300 L120 520 L0 520 Z" fill={away} opacity="0.85" />
      <path d="M950 300 L1060 300 L1200 520 L1080 520 Z" fill={home} opacity="0.85" />
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 1) / 10;
        const xt = 250 + t * 700;
        const xb = 120 + t * 960;
        return <line key={i} x1={xt} y1={300} x2={xb} y2={520} stroke="#ffffff" strokeOpacity={i === 4 ? 0.7 : 0.35} strokeWidth={i === 4 ? 3 : 2} />;
      })}
      <ellipse cx="600" cy="400" rx="80" ry="26" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3" />
      <Crowd />
    </svg>
  );
}

function Crowd() {
  return (
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
  );
}

/** The open itself: art on top, the title over it, what's on the line, and Start. */
export function NightOpening({
  label,
  art,
  kicker,
  welcome,
  title,
  accent,
  sub,
  compact,
  startLabel,
  onStart,
  children,
}: {
  label: string;
  art: ReactNode;
  kicker: string;
  welcome: string;
  title: ReactNode;
  accent?: string;
  sub?: string;
  /** A longer title ("SUPER BOWL XXXVIII") set a size down so it holds one line. */
  compact?: boolean;
  startLabel: string;
  onStart: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="dn-open" aria-label={label} style={accent ? ({ "--dn-open-accent": accent } as CSSProperties) : undefined}>
      <div className="dn-open-stage">
        {art}
        <div className="dn-open-veil" />
        <div className="dn-open-head">
          <p className="dn-open-kicker">{kicker}</p>
          <p className="dn-open-welcome">{welcome}</p>
          <h2 className={`dn-open-title ${compact ? "is-compact" : ""}`}>{title}</h2>
          {sub && <p className="dn-open-sub">{sub}</p>}
        </div>
      </div>
      <div className="dn-open-body">
        {children}
        <button type="button" className="dn-open-start" onClick={onStart}>
          {startLabel} <span aria-hidden>▸</span>
        </button>
      </div>
    </section>
  );
}
