import { useEffect, useState, type CSSProperties } from "react";
import { clubInk, headshotsReady, headshotUrl, loadHeadshots, type Player, type SeasonStats, type TeamId } from "@/lib/game";

/** A real player's portrait over his club colors, his number in the corner; the number alone when there's no photo. */
export function Portrait({ p, year, primary, secondary, size = "md", className = "" }: { p: Player; year: number; primary: string; secondary: string; size?: "sm" | "md" | "lg"; className?: string }) {
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
        // No photo anywhere: the broadcast's stand-in, a lit head and shoulders in his club's jersey,
        // his number on the chest.
        <svg className="k5-portrait-sil" viewBox="0 0 100 100" aria-hidden>
          <defs>
            <radialGradient id={`sil-glow-${p.id}`} cx="50%" cy="30%" r="70%">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <linearGradient id={`sil-head-${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#56607a" />
              <stop offset="1" stopColor="#2a303d" />
            </linearGradient>
            <linearGradient id={`sil-jersey-${p.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="color-mix(in srgb, var(--club) 82%, #fff)" />
              <stop offset="1" stopColor="color-mix(in srgb, var(--club) 60%, #000)" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#sil-glow-${p.id})`} />
          {/* neck, then head */}
          <path d="M42 56h16v10H42Z" fill={`url(#sil-head-${p.id})`} />
          <ellipse cx="50" cy="38" rx="15.5" ry="19" fill={`url(#sil-head-${p.id})`} />
          {/* shoulders in the jersey, with a collar in the trim color */}
          <path d="M8 100c1-19 12-30 30-33l12 6 12-6c18 3 29 14 30 33Z" fill={`url(#sil-jersey-${p.id})`} />
          <path d="M8 100c1-19 12-30 30-33l12 6 12-6c18 3 29 14 30 33" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
          <path d="M38 67l12 6 12-6-3-2-9 4.5-9-4.5Z" fill="var(--club2)" />
          {p.jersey ? (
            <text x="50" y="96" textAnchor="middle" className="k5-portrait-sil-no">
              {p.jersey}
            </text>
          ) : null}
        </svg>
      )}
      {photo && p.jersey ? <span className="k5-portrait-no tabular">{p.jersey}</span> : null}
    </div>
  );
}

/** His portrait in the colors of the club he's with (or was with), for cards and lower thirds. */
export function PlayerPortrait({ p, year, size = "md", club, className }: { p: Player; year: number; size?: "sm" | "md" | "lg"; club?: TeamId; className?: string }) {
  const id = club ?? (p.teamId !== "fa" && p.teamId !== "retired" && p.teamId !== "hof" ? (p.teamId as TeamId) : (p.draftTeam as TeamId | undefined));
  const ink = id ? clubInk(id, year) : { primary: "#1d2433", secondary: "#c9d1de" };
  return <Portrait p={p} year={year} primary={ink.primary} secondary={ink.secondary} size={size} className={className} />;
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
