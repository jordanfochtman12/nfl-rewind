import type { CSSProperties, ReactNode } from "react";

/** A photographic ceremony stage with restrained club/network light. */
export function StageArt({ wall, plate, glow = "#3fd2ff", accent = "#ffb000" }: { wall: string; plate: string; glow?: string; accent?: string }) {
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(ellipse at 78% 44%, ${accent}45, transparent 35%), radial-gradient(ellipse at 20% 15%, ${glow}30, transparent 42%), url("/art/awards-stage.webp")`,
  };
  return <div className="dn-open-art dn-open-photo dn-open-photo-gala" style={style} role="img" aria-label={`${wall} ceremony stage, ${plate}`} />;
}

/** A real night-game stadium still, with the matchup colors carried in the light. */
export function StadiumArt({ wall, home, away }: { wall: string; home: string; away: string }) {
  const style: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${away}50 0%, transparent 30%, transparent 70%, ${home}50 100%), url("/art/rewind-stadium-night.webp")`,
  };
  return <div className="dn-open-art dn-open-photo dn-open-photo-stadium" style={style} role="img" aria-label={`${wall} under the stadium lights`} />;
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
          {startLabel} <span aria-hidden="true">▸</span>
        </button>
      </div>
    </section>
  );
}
