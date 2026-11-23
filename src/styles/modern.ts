import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const shared = {
  Glass: { label: 'coated lens', color: '#3a5a6a', metallic: 0, roughness: 0.05, opacity: 0.45 },
  Emissive: { label: 'red dot', color: '#200000', metallic: 0, roughness: 0.5, emissive: '#ff2a1a', emissiveStrength: 4 },
} as const;

const black: Palette = {
  Body: { label: 'black anodized aluminium', color: '#26282b', metallic: 0.85, roughness: 0.42 },
  Barrel: { label: 'phosphate steel', color: '#1c1d1f', metallic: 0.9, roughness: 0.38 },
  Grip: { label: 'textured polymer', color: '#1a1a1a', metallic: 0, roughness: 0.78 },
  Stock: { label: 'matte polymer', color: '#202122', metallic: 0, roughness: 0.7 },
  Magazine: { label: 'polymer magazine', color: '#2c2a27', metallic: 0, roughness: 0.65 },
  Sight: { label: 'optic housing', color: '#1e1f21', metallic: 0.7, roughness: 0.4 },
  Trim: { label: 'machined accent', color: '#3a3d41', metallic: 0.9, roughness: 0.3 },
  Accent: { label: 'polymer accent', color: '#55524b', metallic: 0, roughness: 0.6 },
  Detail: { label: 'steel hardware', color: '#121314', metallic: 0.95, roughness: 0.35 },
  ...shared,
};

const fde: Palette = {
  ...black,
  Body: { label: 'cerakote FDE', color: '#8b7656', metallic: 0.35, roughness: 0.55 },
  Grip: { label: 'polymer, black', color: '#1b1b1b', metallic: 0, roughness: 0.78 },
  Stock: { label: 'polymer, FDE', color: '#7d6a4d', metallic: 0, roughness: 0.68 },
  Magazine: { label: 'polymer, FDE', color: '#80704f', metallic: 0, roughness: 0.66 },
  Accent: { label: 'black polymer', color: '#222222', metallic: 0, roughness: 0.6 },
};

const odGreen: Palette = {
  ...black,
  Body: { label: 'cerakote OD green', color: '#4b5139', metallic: 0.35, roughness: 0.55 },
  Stock: { label: 'polymer, OD green', color: '#454b34', metallic: 0, roughness: 0.68 },
  Grip: { label: 'polymer, OD green', color: '#3e4330', metallic: 0, roughness: 0.78 },
  Accent: { label: 'black polymer', color: '#232323', metallic: 0, roughness: 0.6 },
};

const wolfGrey: Palette = {
  ...black,
  Body: { label: 'cerakote wolf grey', color: '#5a5d61', metallic: 0.4, roughness: 0.5 },
  Stock: { label: 'black polymer', color: '#1f2021', metallic: 0, roughness: 0.7 },
  Accent: { label: 'orange accent', color: '#c8501e', metallic: 0, roughness: 0.5 },
};

export const modern: StyleProfile = {
  id: 'modern',
  name: 'Modern',
  description: 'Contemporary military/civilian styling: anodized aluminium, polymer, rails.',
  palettes: [
    { name: 'Blackout', materials: black },
    { name: 'Desert', materials: fde },
    { name: 'Ranger', materials: odGreen },
    { name: 'Wolf', materials: wolfGrey },
  ],
  params: {
    length: [0.3, 0.75],
    bulk: [0.3, 0.6],
    ornament: [0.0, 0.15],
    detail: [0.4, 0.8],
    smoothness: [0.6, 0.8],
    wear: [0.0, 0.35],
  },
  parts: {
    receiver: { angular: 1 },
    barrel: { plain: 1, heavy: 0.6 },
    muzzle: { brake: 1, flash: 1 },
    handguard: { railed: 1 },
    stock: { collapsible: 1, fixed: 0.5 },
    grip: { polymer: 1 },
    magazine: { curved: 1, straight: 0.4 },
    sight: { auto: 1 },
  },
  optics: { reddot: 1, scope: 0.6, holo: 0.4, irons: 0.3 },
  traits: { rivets: false, plumbing: false, glow: false, rails: true, roundness: 20 },
};
