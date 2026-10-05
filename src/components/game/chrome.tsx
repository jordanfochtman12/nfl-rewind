import { clubInk, logoSrc, teamColors, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";

export function Logo({ id, size = 36, year }: { id: TeamId; size?: number; year?: number }) {
  const saveYear = useGameStore((s) => s.save?.year ?? 1966);
  const y = year ?? saveYear;
  return (
    <img
      src={logoSrc(y, id)}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size, borderRadius: "16%" }}
    />
  );
}

/** Paints the year’s club ink onto CSS tokens so the desk, tabs, and ribbon follow the mark. */
export function ClubDesk({
  id,
  year,
  children,
  className = "",
}: {
  id: TeamId;
  year: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ink = clubInk(id, year);
  return (
    <div
      className={className}
      style={
        {
          "--color-club": ink.primary,
          "--color-club-2": ink.secondary,
          "--color-club-fg": ink.onPrimary,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function ClubRibbon() {
  return <div className="chrome-bar w-full" aria-hidden />;
}

export function ClubHash({
  id,
  year,
  className = "w-1 self-stretch rounded-full",
}: {
  id: TeamId;
  year?: number;
  className?: string;
}) {
  const saveYear = useGameStore((s) => s.save?.year ?? 1966);
  const c = teamColors(id, year ?? saveYear);
  return <span className={`inline-block shrink-0 ${className}`} style={{ background: c.primary }} aria-hidden />;
}

export function Btn({
  children,
  onClick,
  kind = "ghost",
  disabled,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "brick" | "gold";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  // Skewed glossy chip; the inner span counter-skews so the label stays upright.
  const base = "bx-btn inline-flex min-h-11 items-center justify-center rounded-sm px-5 text-[15px]";
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`${base} bx-${kind} ${className}`}>
      <span className="bx-in">{children}</span>
    </button>
  );
}
