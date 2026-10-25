import { useEffect, useState, type CSSProperties } from "react";
import { clubInk, headshotsReady, headshotUrl, helmetOf, loadHeadshots, maskOf, type Player, type SeasonStats, type TeamId } from "@/lib/game";

/** A real player's portrait over his club colors, his number in the corner; the broadcast's helmet card when there's no photo. */
export function Portrait({ p, year, primary, secondary, club, size = "md", className = "" }: { p: Player; year: number; primary: string; secondary: string; club?: TeamId; size?: "sm" | "md" | "lg"; className?: string }) {
  const [, setReady] = useState(headshotsReady());
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!headshotsReady()) void loadHeadshots().then(() => setReady(true));
  }, []);
  const url = headshotUrl(p, year);
  const photo = url && failed !== url ? url : undefined;
  return (
    <div className={`k5-portrait is-${size} has-photo ${photo ? "" : "is-stand-in"} ${className}`} style={{ "--club": primary, "--club2": secondary } as CSSProperties}>
      {photo ? (
        <img src={photo} alt={`${p.firstName} ${p.lastName}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(photo)} />
      ) : (
        <StandIn p={p} year={year} club={club} />
      )}
      {photo && p.jersey ? <span className="k5-portrait-no tabular">{p.jersey}</span> : null}
    </div>
  );
}

/**
 * No photo anywhere: the broadcast's stand-in, a player in his club's helmet as that season wore
 * it (shell, stripe, side mark, the facemask of his era and position) and the jersey with his
 * number on the chest. The face stays in the helmet's shadow.
 */
function StandIn({ p, year, club }: { p: Player; year: number; club?: TeamId }) {
  const hm = club ? helmetOf(club, year) : { shell: "#3a4150", mask: "#8f969e", stripe: [] as string[], mark: "none" as const, markColor: "#fff", letter: undefined };
  const mask = maskOf(p.pos, year);
  const id = `sil-${p.id}`;
  // Stripe bands, outside in, along the crown from the brow back over the top.
  const crown = "M58 15.5C47 13 33 18 27 33";
  const widths = hm.stripe.length === 3 ? [7, 4.2, 2] : hm.stripe.length === 2 ? [6, 3] : [4];
  return (
    <svg className="k5-portrait-sil" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`${id}-glow`} cx="45%" cy="28%" r="72%">
          <stop offset="0" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id={`${id}-jersey`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--club) 85%, #fff)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--club) 58%, #000)" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="38%" cy="26%" r="62%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.35" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
        </radialGradient>
        <clipPath id={`${id}-shell`}>
          <path d="M26 46C22 27 34 13 51 13C66 13 75 24 74 38L73 47H54L52 60H37C30 58 27 53 26 46Z" />
        </clipPath>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-glow)`} />
      {/* shoulders and pads in the jersey, collar in the trim, his number on the chest */}
      <path d="M4 100C5 80 15 69 33 65L50 71L67 65C85 69 95 80 96 100Z" fill={`url(#${id}-jersey)`} />
      <path d="M4 100C5 80 15 69 33 65L50 71L67 65C85 69 95 80 96 100" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <path d="M13 84C17 76 22 72 30 69M87 84C83 76 78 72 70 69" fill="none" stroke="var(--club2)" strokeWidth="2.4" opacity="0.85" />
      <path d="M37 65.5L50 72L63 65.5L60.5 63.5L50 68.5L39.5 63.5Z" fill="var(--club2)" />
      <path d="M42 54h16v12l-8 4-8-4Z" fill="#1a1e26" />
      {/* the shell */}
      <g clipPath={`url(#${id}-shell)`}>
        <rect x="20" y="10" width="60" height="55" fill={hm.shell} />
        {hm.stripe.map((c, i) => (
          <path key={i} d={crown} fill="none" stroke={c} strokeWidth={widths[i]} strokeLinecap="butt" />
        ))}
        <Mark hm={hm} />
        <circle cx="38" cy="48" r="2" fill="rgba(0,0,0,0.45)" />
        <rect x="20" y="10" width="60" height="55" fill={`url(#${id}-shine)`} />
      </g>
      <path d="M26 46C22 27 34 13 51 13C66 13 75 24 74 38L73 47H54L52 60H37C30 58 27 53 26 46Z" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="0.8" />
      {/* the face in the helmet's shadow, then the facemask over it */}
      <path d="M54 34H72C73 42 72 52 68 58C63 61 57 61 53 58Z" fill="#12151b" />
      <path d="M57 38h11" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
      <Facemask style={mask} color={hm.mask} />
      {p.jersey ? (
        <text x="50" y="96" textAnchor="middle" className="k5-portrait-sil-no">
          {p.jersey}
        </text>
      ) : null}
    </svg>
  );
}

function Mark({ hm }: { hm: ReturnType<typeof helmetOf> }) {
  const c = hm.markColor;
  switch (hm.mark) {
    case "star":
      return <path d="M38 28l2.6 7.4h7.8l-6.3 4.6 2.4 7.5-6.5-4.6-6.5 4.6 2.4-7.5-6.3-4.6h7.8Z" fill={c} stroke="#fff" strokeWidth="0.8" />;
    case "bolt":
      return <path d="M30 30L46 32L39 37L49 40L31 47L37 40L28 38Z" fill={c} stroke="#fff" strokeWidth="0.7" />;
    case "horn":
      return <path d="M53 18C42 19 32 25 29 40C33 33 37 29 42 27C38 32 36 37 36 44C40 34 45 26 53 22Z" fill={c} />;
    case "ring":
      return <ellipse cx="38" cy="36" rx="8.5" ry="8" fill={c} stroke="#fff" strokeWidth="1" />;
    case "letter":
      return (
        <text x="38" y="42" textAnchor="middle" fontSize={hm.letter && hm.letter.length > 1 ? 11 : 15} fontWeight="900" fontFamily="Georgia, serif" fill={c} stroke="#fff" strokeWidth="0.6" paintOrder="stroke">
          {hm.letter}
        </text>
      );
    case "stripes":
      return <path d="M30 22l9 6-9 3 10 4-10 3 9 5M44 16l3 7M52 15l-1 6" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />;
    default:
      return null;
  }
}

function Facemask({ style, color }: { style: ReturnType<typeof maskOf>; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const };
  if (style === "bar") return <path d="M50 46C56 49 64 50 73 47" {...s} />;
  if (style === "twobar")
    return (
      <g {...s}>
        <path d="M50 44C56 47 64 48 73 45M50 51C56 54 64 55 71 52" />
        <path d="M70 45.5V52.5" strokeWidth={1.6} />
      </g>
    );
  if (style === "cage")
    return (
      <g {...s}>
        <path d="M50 43C56 46 64 47 73 44M50 50C56 53 64 54 71.5 51M51 57C56 59.5 62 60 68 57.5" />
        <path d="M62 46.5V59.5M70 44.5V56" strokeWidth={1.7} />
      </g>
    );
  return (
    <g {...s}>
      <path d="M49 42C56 46 66 46.5 75 42M50 49.5C57 53 65 53.5 73 50.5" />
      <path d="M52 56C58 61 66 61 71 56.5C73.5 52 74.5 47 75 42" strokeWidth={2} />
      <path d="M64 45.5V59" strokeWidth={1.6} />
    </g>
  );
}

/** His portrait in the colors of the club he's with (or was with), for cards and lower thirds. */
export function PlayerPortrait({ p, year, size = "md", club, className }: { p: Player; year: number; size?: "sm" | "md" | "lg"; club?: TeamId; className?: string }) {
  const id = club ?? (p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? (p.teamId as TeamId) : (p.draftTeam as TeamId | undefined));
  const ink = id ? clubInk(id, year) : { primary: "#1d2433", secondary: "#c9d1de" };
  return <Portrait p={p} year={year} primary={ink.primary} secondary={ink.secondary} club={id} size={size} className={className} />;
}

/** The one number that says the most about a season at his position. */
function headline(pos: string): { label: string; of: (s: SeasonStats) => number } {
  switch (pos) {
    case "QB":
      return { label: "Passing yards", of: (s) => s.passYds };
    case "RB":
      return { label: "Rushing yards", of: (s) => s.rushYds };
    case "FB":
      return { label: "Yards from scrimmage", of: (s) => s.rushYds + s.recYds };
    case "WR":
    case "TE":
      return { label: "Receiving yards", of: (s) => s.recYds };
    case "DE":
    case "DT":
    case "OLB":
      return { label: "Sacks", of: (s) => s.sacks };
    case "MLB":
      return { label: "Tackles", of: (s) => s.tackles };
    case "CB":
    case "S":
      return { label: "Interceptions", of: (s) => s.ints };
    case "K":
      return { label: "Field goals", of: (s) => s.fgMade };
    case "P":
      return { label: "Yards per punt", of: (s) => (s.punts ? Math.round((s.puntYds / s.punts) * 10) / 10 : 0) };
    default:
      return { label: "Games", of: (s) => s.gp };
  }
}

/** The career arc: his headline number season by season, his grade that year on hover. */
export function CareerArc({ p, seasons, color }: { p: Player; seasons: SeasonStats[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (seasons.length < 2) return null;
  const { label, of } = headline(p.pos);
  const vals = seasons.map((s) => Math.max(0, of(s) || 0));
  // Nothing on the books to chart (tackles before 1999, sacks before 1970): no arc.
  if (!vals.some((v) => v > 0)) return null;
  const max = Math.max(...vals);
  const best = vals.indexOf(max);
  const W = 640;
  const H = 150;
  const pad = { l: 8, r: 8, t: 18, b: 22 };
  const slot = (W - pad.l - pad.r) / seasons.length;
  const bw = Math.max(4, Math.min(28, slot - 4));
  const h = (v: number) => ((H - pad.t - pad.b) * v) / max;
  const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));
  const shown = hover ?? best;
  const s = seasons[shown]!;
  return (
    <section className="rounded-lg border border-line bg-surface p-4" aria-label={`Career arc: ${label}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs tracking-[0.25em] text-muted">CAREER ARC · {label.toUpperCase()}</p>
        <p className="text-sm text-paper">
          <span className="font-display text-lg text-white">{s.year}</span> · {fmt(vals[shown]!)} {label.toLowerCase()}
          {s.ovr ? <span className="text-muted"> · {s.ovr} OVR</span> : null}
          {hover === null ? <span className="text-subtle"> · best season</span> : null}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${label} by season, best ${fmt(max)} in ${seasons[best]!.year}`} onMouseLeave={() => setHover(null)}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" className="text-line" strokeWidth={1} />
        {seasons.map((row, i) => {
          const x = pad.l + slot * i + (slot - bw) / 2;
          const bh = h(vals[i]!);
          const y = H - pad.b - bh;
          const r = Math.min(4, bw / 2, bh);
          const on = i === shown;
          return (
            <g key={row.year} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} tabIndex={0}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${H - pad.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H - pad.b} Z`}
                  fill={color}
                  opacity={on ? 1 : 0.55}
                />
              )}
              {(i === 0 || i === seasons.length - 1 || i % Math.ceil(seasons.length / 6) === 0) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-[var(--color-muted,#8a93a6)] text-[11px]">
                  {String(row.year).slice(2)}
                </text>
              )}
              {on && bh > 0 && (
                <text x={x + bw / 2} y={y - 5} textAnchor="middle" className="fill-white text-[11px] font-bold">
                  {fmt(vals[i]!)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
