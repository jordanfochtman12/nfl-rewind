import { logoSrc, teamColors, type TeamId } from "@/lib/game";

export function Logo({ id, size = 36, year = 1966 }: { id: TeamId; size?: number; year?: number }) {
  const c = teamColors(id);
  return (
    <img
      src={logoSrc(year, id)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
      style={{ width: size, height: size, background: c.primary }}
    />
  );
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
