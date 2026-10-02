import { SAVE_VERSION, TEAM_IDS, type DynastySave } from './types.ts';
import { hydrateSave } from './save.ts';

/** Validate the envelope before hydration can supply defaults for unrelated JSON. */
export function importDynasty(raw: string): DynastySave {
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !TEAM_IDS.includes(data.userTeamId) || !Number.isInteger(data.year) ||
      data.year < 1966 || data.year > 2028 ||
      !data.players || typeof data.players !== 'object' || Array.isArray(data.players) ||
      !data.teams || typeof data.teams !== 'object' || !data.teams[data.userTeamId] ||
      !Array.isArray(data.schedule) || !data.history || typeof data.history !== 'object' ||
      !['draft','freeAgency','expansion','preseason','regular','deadline','playoffs','superBowl','awards','proBowl','retirement','hof','carousel','relocation','complete'].includes(data.phase)) {
    throw new Error('Choose an NFL Rewind dynasty export.');
  }
  if (data.version > SAVE_VERSION) throw new Error('This dynasty requires a newer version of NFL Rewind.');
  return hydrateSave(data);
}
