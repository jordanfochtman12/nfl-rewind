import { useId } from "react";

type Still = "title" | "primetime" | "superbowl" | "draft" | "office" | "helmet";

/*
 * Broadcast backdrops, drawn as SVG so they stay sharp at any resolution: a night stadium
 * under the lights for game-day screens, and the studio set for the desk, the draft and the show.
 */
const SCENE: Record<Still, { kind: "stadium" | "studio"; tint: string; glow: string }> = {
  title: { kind: "stadium", tint: "#e8102e", glow: "#ffffff" },
  superbowl: { kind: "stadium", tint: "#ffc629", glow: "#fff6d6" },
  helmet: { kind: "stadium", tint: "#e8102e", glow: "#ffffff" },
  primetime: { kind: "studio", tint: "#e8102e", glow: "#ffc629" },
  office: { kind: "studio", tint: "#3a6bff", glow: "#e8102e" },
  draft: { kind: "studio", tint: "#ffc629", glow: "#e8102e" },
};

function Stadium({ tint, glow, id }: { tint: string; glow: string; id: string }) {
  // Yard lines converge toward a vanishing point above the frame.
  const lines = Array.from({ length: 21 }, (_, i) => i);
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05070f" />
          <stop offset="0.55" stopColor="#0a0f1d" />
          <stop offset="1" stopColor="#020308" />
        </linearGradient>
        <linearGradient id={`${id}turf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d3a1e" />
          <stop offset="1" stopColor="#04140a" />
        </linearGradient>
        <radialGradient id={`${id}lamp`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={glow} stopOpacity="0.95" />
          <stop offset="0.25" stopColor={glow} stopOpacity="0.35" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={glow} stopOpacity="0.2" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}streak`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={tint} stopOpacity="0" />
          <stop offset="0.5" stopColor={tint} stopOpacity="0.55" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}crowd`} width="14" height="10" patternUnits="userSpaceOnUse">
          <rect width="14" height="10" fill="#070a12" />
          <circle cx="3" cy="4" r="1.6" fill="#1a2233" />
          <circle cx="10" cy="7" r="1.4" fill="#131a28" />
          <circle cx="7" cy="2" r="0.8" fill="#ffffff" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}sky)`} />
      <path d="M0 250 Q800 170 1600 250 L1600 470 Q800 400 0 470 Z" fill={`url(#${id}crowd)`} opacity="0.9" />
      <path d="M0 470 Q800 400 1600 470" stroke={tint} strokeOpacity="0.6" strokeWidth="3" fill="none" />
      <path d="M230 120 L-200 900 L520 900 Z" fill={`url(#${id}beam)`} />
      <path d="M1370 120 L1080 900 L1800 900 Z" fill={`url(#${id}beam)`} />
      <path d="M800 60 L520 900 L1080 900 Z" fill={`url(#${id}beam)`} opacity="0.6" />
      <path d="M430 520 L1170 520 L1700 900 L-100 900 Z" fill={`url(#${id}turf)`} />
      <g stroke="#ffffff" strokeWidth="2">
        {lines.map((i) => {
          const t = i / 20;
          return <line key={i} x1={430 + 740 * t} y1="520" x2={-100 + 1800 * t} y2="900" strokeOpacity={i % 2 ? 0.12 : 0.28} />;
        })}
      </g>
      <path d="M430 520 L1170 520" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
      <path d="M892 520 L1160 900" stroke="#ffc629" strokeOpacity="0.75" strokeWidth="5" />
      {[
        [230, 120, 240],
        [1370, 120, 240],
        [800, 60, 170],
      ].map(([x, y, r]) => (
        <g key={x} opacity={x === 800 ? 0.45 : 0.85}>
          <circle cx={x} cy={y} r={r} fill={`url(#${id}lamp)`} />
          <g transform={`translate(${x! - 60} ${y! - 22})`}>
            {Array.from({ length: 12 }, (_, k) => (
              <rect key={k} x={(k % 6) * 20} y={Math.floor(k / 6) * 20} width="16" height="14" rx="2" fill="#ffffff" opacity="0.7" />
            ))}
          </g>
        </g>
      ))}
      <rect className="bx-streak" x="-400" y="640" width="1200" height="6" fill={`url(#${id}streak)`} transform="skewX(-30)" />
      <rect className="bx-streak" x="600" y="700" width="1400" height="3" fill={`url(#${id}streak)`} transform="skewX(-30)" />
    </svg>
  );
}

function Studio({ tint, glow, id }: { tint: string; glow: string; id: string }) {
  const cols = Array.from({ length: 25 }, (_, i) => i);
  const rows = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#060812" />
          <stop offset="0.6" stopColor="#0b1020" />
          <stop offset="1" stopColor="#020309" />
        </linearGradient>
        <linearGradient id={`${id}panel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint} stopOpacity="0.55" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}bar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={glow} stopOpacity="0" />
          <stop offset="0.5" stopColor={glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}spot`} cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tint} stopOpacity="0.35" />
          <stop offset="1" stopColor={tint} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}bg)`} />
      <ellipse cx="800" cy="0" rx="900" ry="600" fill={`url(#${id}spot)`} />
      <g opacity="0.55">
        {Array.from({ length: 28 }, (_, k) => {
          const r = Math.floor(k / 7);
          const c = k % 7;
          return (
            <rect
              key={k}
              x={380 + c * 122}
              y={120 + r * 70}
              width="114"
              height="62"
              fill="#0f1628"
              stroke="#ffffff"
              strokeOpacity="0.08"
              opacity={k % 5 === 0 ? 1 : 0.7}
            />
          );
        })}
        <rect x="380" y="120" width="846" height="272" fill={`url(#${id}panel)`} opacity="0.35" />
      </g>
      <path d="M0 60 L420 60 L260 520 L0 520 Z" fill={`url(#${id}panel)`} opacity="0.55" />
      <path d="M1600 60 L1180 60 L1340 520 L1600 520 Z" fill={`url(#${id}panel)`} opacity="0.55" />
      <path d="M470 430 L1130 430 L1100 452 L500 452 Z" fill={glow} opacity="0.85" />
      <rect className="bx-streak" x="200" y="438" width="1200" height="4" fill={`url(#${id}bar)`} />
      <path d="M0 560 L1600 560 L1600 900 L0 900 Z" fill={`url(#${id}floor)`} opacity="0.4" />
      <g stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1.5">
        {cols.map((i) => (
          <line key={i} x1={800 + (i - 12) * 40} y1="560" x2={800 + (i - 12) * 190} y2="900" />
        ))}
        {rows.map((i) => {
          const y = 560 + Math.pow(i / 8, 1.8) * 340;
          return <line key={i} x1="0" y1={y} x2="1600" y2={y} />;
        })}
      </g>
      <path d="M520 640 L1080 640 L1180 760 L420 760 Z" fill="#0a0e18" stroke="#ffffff" strokeOpacity="0.14" />
      <path d="M520 640 L1080 640 L1090 652 L510 652 Z" fill={tint} opacity="0.9" />
      <path d="M420 760 L1180 760 L1180 772 L420 772 Z" fill={glow} opacity="0.5" />
    </svg>
  );
}

export function FilmStill({
  still,
  className = "",
  veil = "left",
}: {
  still: Still;
  /** Accepted for compatibility; the backdrops are vector now. */
  video?: string;
  className?: string;
  veil?: "left" | "bottom" | "full" | "none";
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scene = SCENE[still];
  const veilClass =
    veil === "left"
      ? "bg-gradient-to-r from-bg via-bg/80 to-bg/10"
      : veil === "bottom"
        ? "bg-gradient-to-t from-bg via-bg/65 to-bg/5"
        : veil === "full"
          ? "bg-bg/60"
          : "";
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {scene.kind === "stadium" ? <Stadium id={id} tint={scene.tint} glow={scene.glow} /> : <Studio id={id} tint={scene.tint} glow={scene.glow} />}
      <div className={`absolute inset-0 ${veilClass}`} />
      <div className="film-grain" />
    </div>
  );
}
