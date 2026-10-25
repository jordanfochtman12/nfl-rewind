import { useId } from "react";
import { hexLum, type JerseyLook } from "@/lib/game";

/** Clubs whose jersey numbers aren't white on the home shirt. */
const NUMBER_FILL: Partial<Record<string, string>> = { pit: "#ffb612" };

/**
 * A home jersey hung by the shoulders, seen from the back: the club's colors from the
 * years he wore it, his name across the shoulders and his number. Older eras get the
 * sleeve stripes they had.
 */
export function Jersey({ look, width = 120, hanger = true }: { look: JerseyLook; width?: number; hanger?: boolean }) {
  const gid = useId().replace(/:/g, "");
  const { primary, secondary } = look;
  const lightBody = hexLum(primary) > 0.4;
  const fill = NUMBER_FILL[look.teamId] ?? (lightBody ? secondary : "#ffffff");
  const trim = hexLum(secondary) > 0.8 || secondary.toLowerCase() === fill.toLowerCase() ? (lightBody ? "#0b1320" : "#0b1320aa") : secondary;
  const stripes = look.year < 1995;
  const num = look.number >= 0 ? String(look.number) : "";
  const name = look.name.toUpperCase();
  const nameSize = name.length > 11 ? 9 : name.length > 8 ? 11 : 13;
  return (
    <svg viewBox="0 0 160 196" width={width} height={(width * 196) / 160} role="img" aria-label={`${look.name} #${num} jersey`} className="drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]">
      <defs>
        <linearGradient id={`sh${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`fold${gid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="0.18" stopColor="#000" stopOpacity="0" />
          <stop offset="0.82" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {hanger && (
        <g fill="none" stroke="#b9bec6" strokeWidth="2.4" strokeLinecap="round">
          <path d="M80 4 q8 0 8 7 q0 5 -8 9" />
          <path d="M80 20 L26 34 M80 20 L134 34" />
        </g>
      )}
      <path
        d="M58 24 Q80 34 102 24 L138 36 L157 76 L134 87 L125 70 L125 186 Q80 192 35 186 L35 70 L26 87 L3 76 L22 36 Z"
        fill={primary}
        stroke="#00000055"
        strokeWidth="1"
      />
      {stripes && (
        <g stroke={secondary} strokeWidth="4" strokeLinecap="butt">
          <path d="M147 57 L127 66 M151 65 L131 74" />
          <path d="M13 57 L33 66 M9 65 L29 74" />
        </g>
      )}
      <path d="M58 24 Q80 36 102 24" fill="none" stroke={secondary} strokeWidth="5" />
      <path d="M58 24 L35 70 M102 24 L125 70" stroke="#00000022" strokeWidth="1" />
      <text
        x="80"
        y="60"
        textAnchor="middle"
        fontSize={nameSize}
        fontWeight={800}
        letterSpacing="1.5"
        fill={fill}
        stroke={trim}
        strokeWidth="0.6"
        style={{ fontFamily: "var(--font-display, system-ui)", paintOrder: "stroke" }}
      >
        {name}
      </text>
      <text
        x="80"
        y={num.length > 1 ? 140 : 142}
        textAnchor="middle"
        fontSize={num.length > 1 ? 70 : 78}
        fontWeight={900}
        fill={fill}
        stroke={trim}
        strokeWidth="3.2"
        strokeLinejoin="round"
        style={{ fontFamily: "var(--font-display, system-ui)", paintOrder: "stroke" }}
      >
        {num}
      </text>
      <path d="M58 24 Q80 34 102 24 L138 36 L157 76 L134 87 L125 70 L125 186 Q80 192 35 186 L35 70 L26 87 L3 76 L22 36 Z" fill={`url(#sh${gid})`} />
      <path d="M35 70 L125 70 L125 186 Q80 192 35 186 Z" fill={`url(#fold${gid})`} />
    </svg>
  );
}
