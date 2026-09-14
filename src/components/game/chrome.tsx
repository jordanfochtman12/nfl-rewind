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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "brick";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "chrome-bevel inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-display text-sm font-semibold uppercase italic tracking-wide transition-all active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0";
  const map = {
    primary:
      "bg-gradient-to-b from-club to-[color-mix(in_srgb,var(--color-club)_70%,black)] text-club-fg hover:brightness-110",
    ghost:
      "bg-gradient-to-b from-surface-2 to-surface text-fg hover:from-[color-mix(in_srgb,var(--color-surface-2)_130%,white)] hover:to-surface-2",
    brick:
      "bg-gradient-to-b from-brick to-[color-mix(in_srgb,var(--color-brick)_70%,black)] text-fg hover:brightness-110",
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${map[kind]} ${className}`}>
      {children}
    </button>
  );
}
