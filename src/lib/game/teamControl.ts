import type { DynastySave, TeamId, TeamManagementJob } from "./types.ts";

/** Whether the computer currently owns this club's selected management responsibility. */
export function cpuHandles(save: DynastySave, teamId: TeamId, job: TeamManagementJob): boolean {
  if (save.leagueSandbox) {
    const assigned = save.leagueControl?.[teamId]?.[job];
    return assigned ?? teamId !== save.userTeamId;
  }
  return teamId !== save.userTeamId || save.cpuOnly;
}

export const TEAM_MANAGEMENT_JOBS: {
  id: TeamManagementJob;
  label: string;
  hint: string;
}[] = [
  { id: "roster", label: "Roster, free agency & injuries", hint: "Signings, cuts, roster fill, waiver claims and injury replacements." },
  { id: "contracts", label: "Contracts & salary cap", hint: "Contract renewals, payroll decisions and cap compliance." },
  { id: "trades", label: "Trades", hint: "Trade proposals and player or draft-pick movement." },
  { id: "staff", label: "Coaching staff", hint: "Hiring, firing and filling head coach and coordinator openings." },
  { id: "depthChart", label: "Depth chart", hint: "Set and maintain the lineup at every position." },
  { id: "gameplan", label: "Game plan", hint: "Choose the team’s weekly offensive and defensive approach." },
  { id: "draft", label: "Draft room", hint: "Set draft priorities and make the club’s picks." },
];
