import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const brassWalnut: Palette = {
  Body: { label: 'polished brass', color: '#b8893a', metallic: 1, roughness: 0.32 },
  Barrel: { label: 'blued steel', color: '#2c3036', metallic: 0.9, roughness: 0.35 },
  Grip: { label: 'oiled walnut', color: '#4a2a16', metallic: 0, roughness: 0.45 },
  Stock: { label: 'dark walnut', color: '#55301a', metallic: 0, roughness: 0.42 },
  Magazine: { label: 'copper canister', color: '#a8603a', metallic: 1, roughness: 0.36 },
  Sight: { label: 'brass telescope', color: '#a98035', metallic: 1, roughness: 0.3 },
  Trim: { label: 'bright brass', color: '#d4a64a', metallic: 1, roughness: 0.25 },
  Accent: { label: 'copper piping', color: '#b4653d', metallic: 1, roughness: 0.33 },
  Detail: { label: 'aged steel', color: '#3e3b37', metallic: 0.9, roughness: 0.5 },
  Glass: { label: 'gauge glass', color: '#e8dcc0', metallic: 0, roughness: 0.05, opacity: 0.35 },
  Emissive: { label: 'furnace glow', color: '#301000', metallic: 0, roughness: 0.6, emissive: '#ff8a2a', emissiveStrength: 1.8 },
};

const copperEbony: Palette = {
  ...brassWalnut,
  Body: { label: 'burnished copper', color: '#a5583a', metallic: 1, roughness: 0.34 },
  Stock: { label: 'ebonized wood', color: '#2a1d16', metallic: 0, roughness: 0.4 },
  Grip: { label: 'oxblood leather', color: '#5a1f1a', metallic: 0, roughness: 0.6 },
  Magazine: { label: 'brass canister', color: '#b8893a', metallic: 1, roughness: 0.32 },
  Trim: { label: 'brass', color: '#c99a43', metallic: 1, roughness: 0.28 },
  Accent: { label: 'brass piping', color: '#c99a43', metallic: 1, roughness: 0.3 },
};

const gunmetalMahogany: Palette = {
  ...brassWalnut,
  Body: { label: 'gunmetal', color: '#4a4c50', metallic: 0.95, roughness: 0.38 },
  Stock: { label: 'red mahogany', color: '#6e2c1a', metallic: 0, roughness: 0.4 },
  Grip: { label: 'tan leather', color: '#8a5a32', metallic: 0, roughness: 0.62 },
  Trim: { label: 'brass', color: '#c99a43', metallic: 1, roughness: 0.28 },
  Magazine: { label: 'brass drum', color: '#b8893a', metallic: 1, roughness: 0.32 },
};

export const steampunk: StyleProfile = {
  id: 'steampunk',
  name: 'Steampunk',
  description: 'Brass, copper and dark wood, with gauges, pipes and visible mechanisms.',
  palettes: [
    { name: 'Brass & Walnut', materials: brassWalnut },
    { name: 'Copper & Ebony', materials: copperEbony },
    { name: 'Gunmetal & Mahogany', materials: gunmetalMahogany },
  ],
  params: {
    length: [0.45, 0.95],
    bulk: [0.45, 0.8],
    ornament: [0.55, 0.95],
    detail: [0.5, 0.9],
    smoothness: [0.65, 0.85],
    wear: [0.1, 0.5],
  },
  parts: {
    receiver: { cylindrical: 1, drum: 0.4, carved: 0.35, hunter: 0.2, industrial: 0.1 },
    barrel: { banded: 1, coiled: 0.7, bull: 0.2, finned: 0.5, double: 0.25 },
    muzzle: { bell: 1, crown: 0.7 },
    handguard: { forend: 1, cage: 0.8, slim: 0.3, jacket: 0.4 },
    stock: { classic: 1, wire: 0.25, thumbhole: 0.3, sporter: 0.6 },
    grip: { wood: 1, wrapped: 0.8 },
    magazine: { drum: 1, canister: 0.8, pan: 0.35 },
    sight: { auto: 1 },
  },
  optics: { brass: 1, irons: 0.4 },
  traits: { rivets: true, plumbing: true, glow: false, rails: false, roundness: 24 },
};
