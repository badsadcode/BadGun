/**
 * Historical eras: World War I, World War II and the Vietnam era.
 * Generic period looks (materials, furniture, typical layouts), not replicas.
 */
import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

const base: Palette = {
  Body: { label: 'blued steel', color: '#2b2e33', metallic: 0.9, roughness: 0.42 },
  Barrel: { label: 'blued steel', color: '#25282c', metallic: 0.9, roughness: 0.4 },
  Grip: { label: 'walnut', color: '#5a3520', metallic: 0, roughness: 0.5 },
  Stock: { label: 'walnut', color: '#6a3f22', metallic: 0, roughness: 0.5 },
  Magazine: { label: 'blued steel', color: '#2b2e33', metallic: 0.9, roughness: 0.45 },
  Sight: { label: 'blued steel', color: '#2b2e33', metallic: 0.9, roughness: 0.4 },
  Trim: { label: 'brass', color: '#b08a3e', metallic: 1, roughness: 0.35 },
  Accent: { label: 'canvas webbing', color: '#7d7354', metallic: 0, roughness: 0.85 },
  Detail: { label: 'dark steel', color: '#1c1d1f', metallic: 0.9, roughness: 0.5 },
  Glass: { label: 'old lens', color: '#9fb0a8', metallic: 0, roughness: 0.08, opacity: 0.45 },
  Emissive: { label: 'none', color: '#000000', metallic: 0, roughness: 0.8, emissive: '#3a2a10', emissiveStrength: 1 },
};

const params = { length: [0.5, 1.0], bulk: [0.35, 0.7], ornament: [0.0, 0.2], detail: [0.35, 0.7], smoothness: [0.6, 0.85], wear: [0.2, 0.6] } as StyleProfile['params'];

export const ww1: StyleProfile = {
  id: 'ww1',
  name: 'WW1',
  description: 'The Great War (1914-1918): long bolt-action rifles, full wooden stocks, water-cooled machine guns, bayonets.',
  palettes: [
    { name: 'Walnut & Blued', materials: base },
    { name: 'Oak & Brass', materials: { ...base, Stock: { label: 'oak', color: '#8a5d32', metallic: 0, roughness: 0.55 }, Grip: { label: 'oak', color: '#7a5030', metallic: 0, roughness: 0.55 }, Body: { label: 'brass-fitted steel', color: '#3a3833', metallic: 0.9, roughness: 0.45 } } },
    { name: 'Trench Worn', materials: { ...base, Stock: { label: 'mud-stained beech', color: '#5c4630', metallic: 0, roughness: 0.75 }, Body: { label: 'worn steel', color: '#45443f', metallic: 0.75, roughness: 0.65 }, Accent: { label: 'khaki webbing', color: '#8a7d5a', metallic: 0, roughness: 0.9 } } },
  ],
  params: { ...params, length: [0.65, 1.0] },
  parts: {
    receiver: { boltaction: 3, cylindrical: 0.2, tubular: 0.2, drum: 0.3, hunter: 0.3 },
    barrel: { plain: 1, heavy: 0.3, banded: 0.2 },
    muzzle: { none: 2, crown: 0.6, flashcone: 0.25 },
    handguard: { forend: 1, jacket: 0.4, slim: 0.3 },
    stock: { military: 3, classic: 0.8, sporter: 0.3 },
    grip: { wood: 1 },
    magazine: { internal: 2.5, pan: 0.4, straight: 0.3, drum: 0.15 },
    sight: { auto: 1 },
  },
  optics: { leaf: 3, irons: 0.4, scope: 0.15, ladder: 1.5 },
  traits: { rivets: false, plumbing: false, glow: false, rails: false, roundness: 18, era: 1916, bayonet: 0.55 },
};

export const ww2: StyleProfile = {
  id: 'ww2',
  name: 'WW2',
  description: 'World War II (1939-1945): bolt actions and early semi-autos, stamped SMGs, drum and stick magazines, top-fed machine guns.',
  palettes: [
    { name: 'Walnut & Parkerized', materials: { ...base, Body: { label: 'parkerized steel', color: '#45463f', metallic: 0.6, roughness: 0.65 }, Barrel: { label: 'parkerized steel', color: '#3a3b36', metallic: 0.65, roughness: 0.6 }, Magazine: { label: 'parkerized steel', color: '#45463f', metallic: 0.6, roughness: 0.65 } } },
    { name: 'Birch & Blued', materials: { ...base, Stock: { label: 'birch', color: '#a8783f', metallic: 0, roughness: 0.55 }, Grip: { label: 'bakelite', color: '#4a2a1a', metallic: 0, roughness: 0.4 } } },
    { name: 'Field Grey', materials: { ...base, Body: { label: 'field-grey paint', color: '#4f5348', metallic: 0.4, roughness: 0.7 }, Stock: { label: 'laminated beech', color: '#7a4a2a', metallic: 0, roughness: 0.55 }, Accent: { label: 'leather sling', color: '#4a3020', metallic: 0, roughness: 0.6 } } },
    { name: 'Desert Sand', materials: { ...base, Body: { label: 'sand paint', color: '#a08a62', metallic: 0.3, roughness: 0.75 }, Magazine: { label: 'sand paint', color: '#9a855e', metallic: 0.3, roughness: 0.75 } } },
  ],
  params,
  parts: {
    receiver: { boltaction: 1.4, tubular: 1, stamped: 0.6, cylindrical: 0.2, boxy: 0.5, battle: 0.25, brick: 0.25 },
    barrel: { plain: 1, finned: 0.6, heavy: 0.4 },
    muzzle: { none: 1, crown: 0.5, compensator: 0.4, flash: 0.3, flashcone: 0.5 },
    handguard: { forend: 0.6, jacket: 0.6, slim: 0.6 },
    stock: { military: 1.5, classic: 0.6, wire: 0.8, none: 0.1 },
    grip: { wood: 1, polymer: 0.5 },
    magazine: { internal: 1, stick: 1.2, drum: 0.5, curved: 0.4, top: 0.4, casket: 0.15 },
    sight: { auto: 1 },
  },
  optics: { leaf: 2, irons: 0.5, scope: 0.35, ladder: 0.8 },
  traits: { rivets: false, plumbing: false, glow: false, rails: false, roundness: 18, era: 1942, bayonet: 0.3 },
};

export const vietnam: StyleProfile = {
  id: 'vietnam',
  name: 'Vietnam',
  description: 'Vietnam era (1955-1975): early black rifles, wood-and-steel assault rifles, carry handles, flash hiders, belt-fed MGs.',
  palettes: [
    { name: 'Black Rifle', materials: { ...base, Body: { label: 'anodized aluminium', color: '#2c2e30', metallic: 0.75, roughness: 0.5 }, Stock: { label: 'black fiberglass', color: '#1e1f20', metallic: 0, roughness: 0.6 }, Grip: { label: 'black plastic', color: '#1b1b1b', metallic: 0, roughness: 0.7 }, Magazine: { label: 'aluminium magazine', color: '#4a4b4c', metallic: 0.8, roughness: 0.5 } } },
    { name: 'Wood & Steel', materials: { ...base, Stock: { label: 'red laminate', color: '#7a3a1e', metallic: 0, roughness: 0.45 }, Grip: { label: 'red laminate', color: '#6e331b', metallic: 0, roughness: 0.45 }, Magazine: { label: 'steel magazine', color: '#3a3b3d', metallic: 0.85, roughness: 0.5 } } },
    { name: 'Olive Drab', materials: { ...base, Body: { label: 'parkerized steel', color: '#3d3f38', metallic: 0.6, roughness: 0.65 }, Stock: { label: 'olive fiberglass', color: '#4f5338', metallic: 0, roughness: 0.6 }, Grip: { label: 'olive plastic', color: '#4a4e36', metallic: 0, roughness: 0.7 }, Accent: { label: 'OD webbing', color: '#5a5e40', metallic: 0, roughness: 0.85 } } },
  ],
  params: { ...params, wear: [0.25, 0.7] },
  parts: {
    receiver: { angular: 1, stamped: 1, boltaction: 0.2, battle: 0.7, boxy: 0.25 },
    barrel: { plain: 1, heavy: 0.3 },
    muzzle: { flash: 1.2, brake: 0.4, none: 0.2, birdcage: 0.9, flashcone: 0.2 },
    handguard: { triangle: 1.2, forend: 0.6, slim: 0.6 },
    stock: { fixed: 1.2, military: 0.4, sporter: 0.6, wire: 0.3, collapsible: 0.1 },
    grip: { polymer: 1, wood: 0.6 },
    magazine: { straight: 1, curved: 1, banana: 0.3, coupled: 0.25, ribbed: 0.25 },
    sight: { auto: 1 },
  },
  optics: { irons: 3, scope: 0.3, leaf: 0.3, ladder: 0.4, nightvision: 0.15 },
  traits: { rivets: false, plumbing: false, glow: false, rails: false, roundness: 18, era: 1968, bayonet: 0.2 },
};
