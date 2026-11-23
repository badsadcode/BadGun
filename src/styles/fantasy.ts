import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const elven: Palette = {
  Body: { label: 'pale birch', color: '#cbb994', metallic: 0, roughness: 0.5 },
  Barrel: { label: 'elven silver', color: '#c8ccd2', metallic: 1, roughness: 0.25 },
  Grip: { label: 'green leather', color: '#2f4a35', metallic: 0, roughness: 0.6 },
  Stock: { label: 'birch', color: '#c2a982', metallic: 0, roughness: 0.5 },
  Magazine: { label: 'silver', color: '#b9bfc7', metallic: 1, roughness: 0.3 },
  Sight: { label: 'silver', color: '#c8ccd2', metallic: 1, roughness: 0.28 },
  Trim: { label: 'pale gold', color: '#d9c27a', metallic: 1, roughness: 0.25 },
  Accent: { label: 'emerald cloth', color: '#2e6b4f', metallic: 0, roughness: 0.7 },
  Detail: { label: 'steel', color: '#5e6670', metallic: 0.9, roughness: 0.4 },
  Glass: { label: 'moonglass', color: '#bdf5d8', metallic: 0, roughness: 0.05, opacity: 0.4 },
  Emissive: { label: 'emerald glow', color: '#00261a', metallic: 0, roughness: 0.4, emissive: '#3dffb0', emissiveStrength: 2.2 },
};

const dwarven: Palette = {
  Body: { label: 'dark iron', color: '#3a3836', metallic: 0.9, roughness: 0.55 },
  Barrel: { label: 'blackened steel', color: '#2c2a28', metallic: 0.9, roughness: 0.5 },
  Grip: { label: 'worn leather', color: '#5b3a22', metallic: 0, roughness: 0.65 },
  Stock: { label: 'dark oak', color: '#4a2c1a', metallic: 0, roughness: 0.55 },
  Magazine: { label: 'bronze', color: '#8a5a2b', metallic: 1, roughness: 0.4 },
  Sight: { label: 'iron', color: '#3a3836', metallic: 0.9, roughness: 0.5 },
  Trim: { label: 'dwarven gold', color: '#d4a33a', metallic: 1, roughness: 0.3 },
  Accent: { label: 'red cloth', color: '#7a2a1d', metallic: 0, roughness: 0.75 },
  Detail: { label: 'iron rivets', color: '#1e1d1c', metallic: 0.9, roughness: 0.6 },
  Glass: { label: 'amber', color: '#ffb36b', metallic: 0, roughness: 0.08, opacity: 0.5 },
  Emissive: { label: 'ember runes', color: '#301000', metallic: 0, roughness: 0.5, emissive: '#ff7a1a', emissiveStrength: 2.4 },
};

const arcane: Palette = {
  Body: { label: 'nightwood', color: '#3b2540', metallic: 0, roughness: 0.45 },
  Barrel: { label: 'dark silver', color: '#2a2433', metallic: 0.9, roughness: 0.3 },
  Grip: { label: 'black velvet', color: '#1f1a26', metallic: 0, roughness: 0.85 },
  Stock: { label: 'nightwood', color: '#4a2f4f', metallic: 0, roughness: 0.45 },
  Magazine: { label: 'gold', color: '#c9b26b', metallic: 1, roughness: 0.28 },
  Sight: { label: 'dark silver', color: '#2a2433', metallic: 0.9, roughness: 0.3 },
  Trim: { label: 'gold', color: '#e0c05a', metallic: 1, roughness: 0.25 },
  Accent: { label: 'violet silk', color: '#6d3fa0', metallic: 0, roughness: 0.5 },
  Detail: { label: 'black iron', color: '#2a2530', metallic: 0.9, roughness: 0.45 },
  Glass: { label: 'amethyst glass', color: '#d9b8ff', metallic: 0, roughness: 0.05, opacity: 0.4 },
  Emissive: { label: 'arcane violet', color: '#1a0030', metallic: 0, roughness: 0.4, emissive: '#b46bff', emissiveStrength: 2.4 },
};

const frost: Palette = {
  Body: { label: 'bone white', color: '#e2e4e6', metallic: 0.1, roughness: 0.45 },
  Barrel: { label: 'cold steel', color: '#9aa7b4', metallic: 1, roughness: 0.3 },
  Grip: { label: 'navy leather', color: '#2d3a4a', metallic: 0, roughness: 0.6 },
  Stock: { label: 'frostwood', color: '#c9d3dc', metallic: 0, roughness: 0.45 },
  Magazine: { label: 'silver', color: '#b5c0cc', metallic: 1, roughness: 0.3 },
  Sight: { label: 'cold steel', color: '#9aa7b4', metallic: 1, roughness: 0.3 },
  Trim: { label: 'silver', color: '#dfe7ef', metallic: 1, roughness: 0.2 },
  Accent: { label: 'winter blue', color: '#3b6c9a', metallic: 0, roughness: 0.6 },
  Detail: { label: 'dark steel', color: '#4a5560', metallic: 0.9, roughness: 0.4 },
  Glass: { label: 'ice', color: '#bfe9ff', metallic: 0, roughness: 0.03, opacity: 0.4 },
  Emissive: { label: 'frost glow', color: '#001a30', metallic: 0, roughness: 0.4, emissive: '#5fd4ff', emissiveStrength: 2.2 },
};

/** Fantasy: ornate, rune-carved, gem-set and crystal-powered. */
export const fantasy: StyleProfile = {
  id: 'fantasy',
  name: 'Fantasy',
  description: 'Ornate, rune-carved and enchanted: gold filigree, set gems and glowing crystals.',
  palettes: [
    { name: 'Elven Silver', materials: elven },
    { name: 'Dwarven Forge', materials: dwarven },
    { name: 'Arcane Violet', materials: arcane },
    { name: 'Frostbound', materials: frost },
  ],
  params: {
    length: [0.4, 0.9],
    bulk: [0.35, 0.75],
    ornament: [0.6, 1.0],
    detail: [0.4, 0.8],
    smoothness: [0.65, 0.9],
    wear: [0.0, 0.3],
  },
  parts: {
    receiver: { arcane: 1, runic: 0.8, cylindrical: 0.15 },
    barrel: { rune: 1, spiral: 0.8, banded: 0.3, double: 0.15 },
    muzzle: { crystal: 1, maw: 0.7, bell: 0.3, crown: 0.3 },
    handguard: { filigree: 1, forend: 0.4, cage: 0.2 },
    stock: { ornate: 1, classic: 0.5, thumbhole: 0.15, sporter: 0.5 },
    grip: { carved: 1, wood: 0.4, wrapped: 0.4 },
    magazine: { crystal: 1, orb: 0.8, canister: 0.15, pan: 0.1 },
    sight: { auto: 1 },
  },
  optics: { none: 1, rune: 1.2, brass: 0.35 },
  traits: { rivets: false, plumbing: false, glow: false, rails: false, roundness: 18, magic: true },
};
