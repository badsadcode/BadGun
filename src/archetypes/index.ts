import type { ArchetypeDef } from './archetype.js';
import { rifle, smg, shotgun, sniper, lmg } from './longgun.js';
import { pistol } from './pistol.js';
import { revolver } from './revolver.js';
import { crossbow } from './crossbow.js';
import { bow } from './bow.js';

export type { ArchetypeDef } from './archetype.js';

/** Registry of weapon archetypes, in menu order. */
export const ARCHETYPES: Record<string, ArchetypeDef> = { rifle, smg, shotgun, sniper, lmg, pistol, revolver, crossbow, bow };

/** Name of each archetype's root component. */
export const ROOT_NAMES: Record<string, string> = { pistol: 'Frame', revolver: 'Frame', crossbow: 'Tiller', bow: 'Riser' };

export function getArchetype(id: string): ArchetypeDef {
  const a = ARCHETYPES[id];
  if (!a) throw new Error(`Unknown archetype "${id}". Available: ${Object.keys(ARCHETYPES).join(', ')}`);
  return a;
}

/** Part kinds of an archetype, including "sight". */
export function partKinds(id: string): string[] {
  return [...Object.keys(getArchetype(id).parts), 'sight'];
}
