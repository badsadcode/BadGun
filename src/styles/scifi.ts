import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const whiteCyan: Palette = {
  Body: { label: 'white composite shell', color: '#d9dde2', metallic: 0.1, roughness: 0.35 },
  Barrel: { label: 'dark alloy', color: '#2a2e35', metallic: 0.85, roughness: 0.3 },
  Grip: { label: 'charcoal elastomer', color: '#2b2f36', metallic: 0, roughness: 0.7 },
  Stock: { label: 'white composite', color: '#cfd4da', metallic: 0.1, roughness: 0.38 },
  Magazine: { label: 'cell casing', color: '#3a3f48', metallic: 0.7, roughness: 0.35 },
  Sight: { label: 'sensor housing', color: '#30343b', metallic: 0.7, roughness: 0.3 },
  Trim: { label: 'graphite panel', color: '#3b4049', metallic: 0.6, roughness: 0.35 },
  Accent: { label: 'signal orange', color: '#e8692a', metallic: 0.1, roughness: 0.4 },
  Detail: { label: 'dark alloy', color: '#1d2026', metallic: 0.85, roughness: 0.35 },
  Glass: { label: 'holo glass', color: '#7fdcff', metallic: 0, roughness: 0.02, opacity: 0.35 },
  Emissive: { label: 'plasma cyan', color: '#002630', metallic: 0, roughness: 0.4, emissive: '#2ee6ff', emissiveStrength: 2.2 },
};

const blackMagenta: Palette = {
  ...whiteCyan,
  Body: { label: 'black ceramic shell', color: '#1f2228', metallic: 0.2, roughness: 0.3 },
  Stock: { label: 'black ceramic', color: '#23262c', metallic: 0.2, roughness: 0.32 },
  Trim: { label: 'chrome panel', color: '#8c939e', metallic: 1, roughness: 0.18 },
  Accent: { label: 'magenta', color: '#c0247a', metallic: 0.1, roughness: 0.35 },
  Emissive: { label: 'plasma magenta', color: '#300018', metallic: 0, roughness: 0.4, emissive: '#ff3ab0', emissiveStrength: 2.2 },
  Glass: { label: 'smoked glass', color: '#ff9ad8', metallic: 0, roughness: 0.02, opacity: 0.35 },
};

const navyGold: Palette = {
  ...whiteCyan,
  Body: { label: 'navy composite', color: '#25324a', metallic: 0.3, roughness: 0.35 },
  Stock: { label: 'navy composite', color: '#2a3852', metallic: 0.3, roughness: 0.36 },
  Trim: { label: 'gold alloy', color: '#c9a24a', metallic: 1, roughness: 0.25 },
  Accent: { label: 'white composite', color: '#dfe3e8', metallic: 0.1, roughness: 0.35 },
  Emissive: { label: 'amber energy', color: '#301800', metallic: 0, roughness: 0.4, emissive: '#ffb02e', emissiveStrength: 2.2 },
  Glass: { label: 'amber glass', color: '#ffd27f', metallic: 0, roughness: 0.02, opacity: 0.35 },
};

const greenLab: Palette = {
  ...whiteCyan,
  Body: { label: 'olive composite', color: '#59614a', metallic: 0.2, roughness: 0.4 },
  Stock: { label: 'grey composite', color: '#4a4f55', metallic: 0.2, roughness: 0.4 },
  Accent: { label: 'hazard yellow', color: '#e3c23a', metallic: 0.1, roughness: 0.4 },
  Emissive: { label: 'toxic green', color: '#0a2000', metallic: 0, roughness: 0.4, emissive: '#7dff3a', emissiveStrength: 2.2 },
  Glass: { label: 'green glass', color: '#b8ff9a', metallic: 0, roughness: 0.02, opacity: 0.35 },
};

export const scifi: StyleProfile = {
  id: 'scifi',
  name: 'Sci-fi',
  description: 'Energy weapons: smooth composite shells, panel lines and glowing cores.',
  palettes: [
    { name: 'Polar Cyan', materials: whiteCyan },
    { name: 'Night Orchid', materials: blackMagenta },
    { name: 'Admiral', materials: navyGold },
    { name: 'Biohazard', materials: greenLab },
  ],
  params: {
    length: [0.35, 0.85],
    bulk: [0.45, 0.85],
    ornament: [0.2, 0.5],
    detail: [0.35, 0.75],
    smoothness: [0.55, 0.9],
    wear: [0.0, 0.2],
  },
  parts: {
    receiver: { sleek: 1, faceted: 0.8, plated: 1 },
    barrel: { shrouded: 1, rails: 0.6, bull: 0.3 },
    muzzle: { emitter: 1, prongs: 0.8, suppressor: 0.3 },
    handguard: { shell: 1, slim: 0.4, jacket: 0.3 },
    stock: { skeletal: 1, solid: 0.8, thumbhole: 0.5, frame: 0.4 },
    grip: { sleek: 1, skeleton: 0.8, loop: 0.9 },
    magazine: { cell: 1 },
    sight: { auto: 1 },
  },
  optics: { holo: 1, scope: 0.4, none: 0.2 },
  traits: { rivets: false, plumbing: false, glow: true, rails: false, roundness: 18 },
};
