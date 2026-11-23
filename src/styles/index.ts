import { modern } from './modern.js';
import { steampunk } from './steampunk.js';
import { scifi } from './scifi.js';
import { scrap } from './scrap.js';
import { fantasy } from './fantasy.js';
import { ww1, ww2, vietnam } from './eras.js';
import { diesel } from './diesel.js';
import { cyber } from './cyber.js';
import type { StyleProfile } from './style.js';

export type { StyleProfile } from './style.js';

/** Registry of style profiles. Add a style here and every archetype can use it. */
export const STYLES: Record<string, StyleProfile> = { modern, steampunk, scifi, scrap, fantasy, ww1, ww2, vietnam, diesel, cyber };

export function getStyle(id: string): StyleProfile {
  const s = STYLES[id];
  if (!s) throw new Error(`Unknown style "${id}". Available: ${Object.keys(STYLES).join(', ')}`);
  return s;
}
