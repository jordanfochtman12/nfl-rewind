import { coachKitLine, kitImpactLine, type Coach, type Player } from "@/lib/game";

export function KitChips({
  player,
  showDesc = false,
  compact = false,
}: {
  player: Player;
  showDesc?: boolean;
  compact?: boolean;
}) {
  if (!player.revealed) {
    return <span className="text-xs tracking-wide text-subtle">Unconfirmed kit</span>;
  }
  const abilities = player.abilities ?? [];
  const traits = player.traits ?? [];
  if (!abilities.length && !traits.length) {
    return <span className="text-xs text-subtle">No kit graded</span>;
  }
  return (
    <div className={showDesc ? "space-y-1.5" : "flex flex-wrap gap-1"}>
      {abilities.map((name) =>
        showDesc ? (
          <p key={name} className="text-xs leading-snug">
            <span className="text-brass">{name}.</span>{" "}
            <span className="text-muted">{kitImpactLine(name)}</span>
          </p>
        ) : (
          <span
            key={name}
            title={kitImpactLine(name)}
            className={`rounded-sm bg-brass/15 text-brass ${compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"} tracking-wide`}
          >
            {name}
          </span>
        ),
      )}
      {traits.map((name) =>
        showDesc ? (
          <p key={name} className="text-xs leading-snug">
            <span className="text-paper">{name}.</span>{" "}
            <span className="text-muted">{kitImpactLine(name)}</span>
          </p>
        ) : (
          <span
            key={name}
            title={kitImpactLine(name)}
            className={`rounded-sm bg-paper/10 text-paper ${compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"} tracking-wide`}
          >
            {name}
          </span>
        ),
      )}
    </div>
  );
}

export function CoachChips({
  coach,
  compact = false,
}: {
  coach: Coach;
  compact?: boolean;
}) {
  const abilities = coach.abilities ?? [];
  const traits = coach.traits ?? [];
  if (!abilities.length && !traits.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {abilities.map((name) => (
        <span
          key={name}
          title={coachKitLine(name)}
          className={`rounded-sm bg-brass/15 text-brass ${compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"} tracking-wide`}
        >
          {name}
        </span>
      ))}
      {traits.map((name) => (
        <span
          key={name}
          title={coachKitLine(name)}
          className={`rounded-sm bg-paper/10 text-paper ${compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]"} tracking-wide`}
        >
          {name}
        </span>
      ))}
    </div>
  );
}
