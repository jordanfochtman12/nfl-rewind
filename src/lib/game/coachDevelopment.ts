import type { Coach, DynastySave, Player, Pos, TeamId } from "./types.ts";
import { clamp } from "./rng.ts";
import { coachKitBoost } from "./coachKit.ts";

const OFFENSE = new Set<Pos>(["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT"]);
const DEFENSE = new Set<Pos>(["DE", "DT", "OLB", "MLB", "CB", "S"]);

/** The coordinator whose unit is responsible for a player's weekly development. */
export function developmentCoordinator(save: DynastySave, teamId: TeamId, p: Pick<Player, "pos">): Coach | undefined {
  const team = save.teams[teamId];
  const id = OFFENSE.has(p.pos) ? team?.ocId : DEFENSE.has(p.pos) ? team?.dcId : undefined;
  return id ? save.coaches[id] : undefined;
}

/**
 * The head coach sets the development program; the matching coordinator adds a smaller
 * position-group effect. Neutral 70-rated coaches keep the old baseline exactly.
 */
export function coachDevelopmentFactor(head: Coach | undefined, coordinator?: Coach): number {
  const headBump = coachKitBoost(head, "dev") + ((head?.development ?? 70) - 70) / 180;
  const headFactor = clamp(1 + headBump, 0.72, 1.28);
  if (!coordinator) return headFactor;
  const unitFactor = clamp(
    1 + ((coordinator.development ?? 70) - 70) / 300 + coachKitBoost(coordinator, "dev") * 0.2,
    0.9,
    1.1,
  );
  return clamp(headFactor * unitFactor, 0.72, 1.28);
}
