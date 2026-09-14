import { clubInk, logoSrc, teamColors, type TeamId } from "@/lib/game";
import { useGameStore } from "@/lib/game-store";

export function Logo({ id, size = 36, year }: { id: TeamId; size?: number; year?: number }) {
  const saveYear = useGameStore((s) => s.save?.year ?? 1966);
  const y = year ?? saveYear;
  const c = teamColors(id, y);
  return (
    <img
      src={logoSrc(y, id)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      style={{ width: size, height: size, background: c.primary }}
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
  return (
    <div className="flex h-1 w-full" aria-hidden>
      <div className="w-[72%] bg-club" />
      <div className="flex-1 bg-club-2" />
    </div>
  );
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "brick";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium tracking-wide transition-colors disabled:opacity-40";
  const map = {
    primary: "bg-accent text-accent-fg hover:bg-accent/90",
    ghost: "border border-line bg-surface text-fg hover:bg-surface-2",
    brick: "bg-brick text-fg hover:bg-brick/90",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${map[kind]} ${className}`}>
      {children}
    </button>
  );
}
