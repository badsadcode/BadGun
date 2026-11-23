/**
 * BadGun: procedural, game-ready weapon assets.
 *
 *   import { generate, toGLB } from 'badgun';
 *   const weapon = generate({ archetype: 'rifle', style: 'steampunk', seed: 42 });
 *   const bytes = toGLB(weapon); // write to disk, or load into three.js / Godot / Unity
 */
export { generate, resolveParams, resolveParts, PARAM_KEYS } from './generate.js';
export { ARCHETYPES, getArchetype, partKinds } from './archetypes/index.js';
export type { ArchetypeDef } from './archetypes/index.js';
export { toGLB, toGltfJson, toGLBArsenal } from './export/glb.js';
export { generateFaction, factionToGLB, factionName, summary as factionSummary } from './faction.js';
export type { Faction, FactionRecipe, Livery } from './faction.js';
export { buildManifest, weaponName, UV_UNITS_PER_METER, VERSION } from './export/manifest.js';
export type { Manifest } from './export/manifest.js';
export { STYLES, getStyle } from './styles/index.js';
export type { StyleProfile } from './styles/index.js';
export { OPTIC_NAMES } from './parts/sight.js';
export { applyOverrides, applyWear, hexToRgb, rgbToHex } from './materials/palette.js';
export { MATERIAL_SLOTS } from './types.js';
export type * from './types.js';
export type { Weapon, Component, Socket, Motion } from './core/weapon.js';
