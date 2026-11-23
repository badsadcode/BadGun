import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const rustTape: Palette = {
  Body: { label: 'rusted steel', color: '#7a4a2c', metallic: 0.55, roughness: 0.85 },
  Barrel: { label: 'worn pipe steel', color: '#3a3632', metallic: 0.8, roughness: 0.65 },
  Grip: { label: 'black tape', color: '#2b2b2a', metallic: 0, roughness: 0.9 },
  Stock: { label: 'raw plank', color: '#9c7b55', metallic: 0, roughness: 0.9 },
  Magazine: { label: 'chipped olive paint', color: '#5d6340', metallic: 0.3, roughness: 0.8 },
  Sight: { label: 'scavenged black', color: '#2e2e2c', metallic: 0.6, roughness: 0.6 },
  Trim: { label: 'aluminium can / clamps', color: '#b9b2a5', metallic: 0.9, roughness: 0.45 },
  Accent: { label: 'duct tape', color: '#8e9196', metallic: 0.3, roughness: 0.6 },
  Detail: { label: 'bolts and nails', color: '#262422', metallic: 0.9, roughness: 0.6 },
  Glass: { label: 'green bottle plastic', color: '#6d8f5e', metallic: 0, roughness: 0.12, opacity: 0.55 },
  Emissive: { label: 'embers', color: '#200800', metallic: 0, roughness: 0.7, emissive: '#ff6a1a', emissiveStrength: 1.2 },
};

const scavengerBlue: Palette = {
  ...rustTape,
  Body: { label: 'faded blue paint', color: '#4d6478', metallic: 0.4, roughness: 0.8 },
  Stock: { label: 'dark scrap wood', color: '#5a4330', metallic: 0, roughness: 0.85 },
  Accent: { label: 'red tape', color: '#a8322b', metallic: 0.1, roughness: 0.6 },
  Magazine: { label: 'rusty steel', color: '#7a4a2c', metallic: 0.5, roughness: 0.85 },
  Grip: { label: 'green tape', color: '#2f3a2c', metallic: 0, roughness: 0.9 },
  Glass: { label: 'clear bottle plastic', color: '#c9d6d9', metallic: 0, roughness: 0.1, opacity: 0.4 },
};

const boneLeather: Palette = {
  ...rustTape,
  Body: { label: 'sun-bleached metal', color: '#b9b3a4', metallic: 0.3, roughness: 0.85 },
  Stock: { label: 'weathered wood', color: '#6e5a43', metallic: 0, roughness: 0.85 },
  Grip: { label: 'leather strips', color: '#5a3a24', metallic: 0, roughness: 0.7 },
  Accent: { label: 'cloth wrap', color: '#c9b98f', metallic: 0, roughness: 0.95 },
  Magazine: { label: 'gunmetal', color: '#3a3632', metallic: 0.8, roughness: 0.6 },
  Glass: { label: 'brown bottle glass', color: '#7a4a1e', metallic: 0, roughness: 0.1, opacity: 0.6 },
};

const hazard: Palette = {
  ...rustTape,
  Body: { label: 'hazard yellow paint', color: '#b8952c', metallic: 0.35, roughness: 0.75 },
  Accent: { label: 'black tape', color: '#232323', metallic: 0.1, roughness: 0.7 },
  Stock: { label: 'pallet wood', color: '#a5865e', metallic: 0, roughness: 0.9 },
  Magazine: { label: 'red paint', color: '#7e2a22', metallic: 0.3, roughness: 0.75 },
};

/** Survivor: salvaged, patched and held together with tape and hope. */
export const scrap: StyleProfile = {
  id: 'scrap',
  name: 'Survivor',
  description: 'Makeshift and salvaged: pipes, planks, duct tape, hose clamps and bottle suppressors.',
  palettes: [
    { name: 'Rust & Tape', materials: rustTape },
    { name: 'Scavenger Blue', materials: scavengerBlue },
    { name: 'Bone & Leather', materials: boneLeather },
    { name: 'Hazard', materials: hazard },
  ],
  params: {
    length: [0.2, 0.8],
    bulk: [0.4, 0.9],
    ornament: [0.0, 0.2],
    detail: [0.5, 1.0],
    smoothness: [0.25, 0.6],
    wear: [0.55, 1.0],
  },
  parts: {
    receiver: { pipe: 1, welded: 1, stamped: 0.35 },
    barrel: { pipe: 1, plain: 0.5, heavy: 0.2, double: 0.35 },
    muzzle: { none: 1, can: 0.8, bottle: 0.8, brake: 0.15 },
    handguard: { plank: 1, taped: 1, slim: 0.2 },
    stock: { plank: 1, pipe: 0.8, none: 0.35, wire: 0.3, sporter: 0.2 },
    grip: { taped: 1, plank: 0.8, polymer: 0.15 },
    magazine: { straight: 0.6, twin: 0.5, can: 0.8, curved: 0.3, pan: 0.15 },
    sight: { auto: 1 },
  },
  optics: { none: 1, irons: 1, tube: 0.8, reddot: 0.15 },
  traits: { rivets: false, plumbing: false, glow: false, rails: false, roundness: 10, scrap: true },
};
