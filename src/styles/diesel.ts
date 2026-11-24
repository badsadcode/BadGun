import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

/**
 * Dieselpunk: 1930s-40s industrial retro-futurism. Streamlined art-deco
 * housings, chrome speed lines, riveted armor, radiators and exhaust stacks.
 */
const gunmetalChrome: Palette = {
  Body: { label: 'gunmetal enamel', color: '#3c4248', metallic: 0.75, roughness: 0.38 },
  Barrel: { label: 'blackened steel', color: '#24272b', metallic: 0.9, roughness: 0.35 },
  Grip: { label: 'bakelite', color: '#3a2216', metallic: 0, roughness: 0.35 },
  Stock: { label: 'walnut', color: '#5b3720', metallic: 0, roughness: 0.5 },
  Magazine: { label: 'parkerized steel', color: '#2f3236', metallic: 0.8, roughness: 0.5 },
  Sight: { label: 'gunmetal', color: '#33383d', metallic: 0.8, roughness: 0.35 },
  Trim: { label: 'chrome', color: '#d4d8dc', metallic: 1, roughness: 0.12 },
  Accent: { label: 'signal red', color: '#a8262c', metallic: 0.1, roughness: 0.45 },
  Detail: { label: 'dark steel', color: '#1c1e21', metallic: 0.9, roughness: 0.4 },
  Glass: { label: 'lamp glass', color: '#fff1c4', metallic: 0, roughness: 0.05, opacity: 0.4 },
  Emissive: { label: 'tungsten glow', color: '#302000', metallic: 0, roughness: 0.4, emissive: '#ffc35a', emissiveStrength: 2 },
};

const oxideOlive: Palette = {
  ...gunmetalChrome,
  Body: { label: 'olive drab enamel', color: '#4f5638', metallic: 0.35, roughness: 0.6 },
  Magazine: { label: 'olive steel', color: '#474d33', metallic: 0.4, roughness: 0.6 },
  Trim: { label: 'brass', color: '#b48a3c', metallic: 1, roughness: 0.3 },
  Accent: { label: 'stencil white', color: '#d8d2bd', metallic: 0, roughness: 0.6 },
  Stock: { label: 'oiled ash', color: '#7a5532', metallic: 0, roughness: 0.55 },
};

const rustBucket: Palette = {
  ...gunmetalChrome,
  Body: { label: 'oxidized iron', color: '#6b3f26', metallic: 0.5, roughness: 0.75 },
  Magazine: { label: 'rusty steel', color: '#5a3a28', metallic: 0.5, roughness: 0.8 },
  Barrel: { label: 'sooty steel', color: '#2a2522', metallic: 0.8, roughness: 0.6 },
  Trim: { label: 'worn copper', color: '#b0683e', metallic: 1, roughness: 0.4 },
  Accent: { label: 'hazard yellow', color: '#d4a62a', metallic: 0.1, roughness: 0.55 },
};

const navyBrass: Palette = {
  ...gunmetalChrome,
  Body: { label: 'navy grey enamel', color: '#3a4a5c', metallic: 0.5, roughness: 0.42 },
  Magazine: { label: 'navy steel', color: '#33404f', metallic: 0.6, roughness: 0.45 },
  Trim: { label: 'polished brass', color: '#d0a44a', metallic: 1, roughness: 0.2 },
  Accent: { label: 'cream enamel', color: '#e6dcc2', metallic: 0, roughness: 0.4 },
  Grip: { label: 'black bakelite', color: '#1d1b1a', metallic: 0, roughness: 0.3 },
};

export const diesel: StyleProfile = {
  id: 'diesel',
  name: 'Dieselpunk',
  description: 'Retro-futuristic war machines: streamlined chrome, riveted armor, radiators and exhaust stacks.',
  palettes: [
    { name: 'Gunmetal & Chrome', materials: gunmetalChrome },
    { name: 'Oxide Olive', materials: oxideOlive },
    { name: 'Rust Bucket', materials: rustBucket },
    { name: 'Navy & Brass', materials: navyBrass },
  ],
  params: {
    length: [0.4, 0.9],
    bulk: [0.6, 1],
    ornament: [0.2, 0.6],
    detail: [0.5, 0.9],
    smoothness: [0.6, 0.85],
    wear: [0.2, 0.6],
  },
  parts: {
    receiver: { deco: 1.2, riveted: 1, stamped: 0.4, tubular: 0.3, industrial: 0.8, brick: 0.4, battle: 0.3 },
    barrel: { heavy: 1, finned: 0.7, plain: 0.5, banded: 0.3 },
    muzzle: { exhaust: 1.2, brake: 0.6, compensator: 0.4, crown: 0.3 },
    handguard: { radiator: 1.2, jacket: 0.8, slim: 0.3 },
    stock: { deco: 1.2, fixed: 0.5, wire: 0.4, thumbhole: 0.3 },
    grip: { wood: 0.8, polymer: 0.6, ergo: 0.4 },
    magazine: { drum: 1, jerrycan: 0.8, curved: 0.5, straight: 0.4, pan: 0.2 },
    sight: { auto: 1 },
  },
  byArchetype: {
    pistol: {
      frame: { deco: 2.2, gyro: 1.5, magnum: 0.8, revolver: 0.5, slide: 0.5, cannon: 0.5, service: 0.4, flare: 0.3, nailgun: 0.2 },
      grip: { block: 1, birdshead: 1, broom: 0.3 },
      muzzle: { none: 2, compensator: 0.5, exhaust: 0.6 },
    },
    crossbow: {
      tiller: { rail: 1, wood: 1, heavy: 0.5, repeater: 0.4 },
      prod: { leafspring: 1.5, recurve: 1, compound: 0.6 },
      stock: { deco: 1.5, fixed: 0.5, wire: 0.3 },
    },
    bow: {
      bow: { recurve: 1.5, compound: 1, longbow: 0.5 },
      arrow: { broadhead: 1, field: 1, wooden: 0.5 },
    },
  },
  optics: { irons: 1, lamp: 0.6, scope: 0.6, leaf: 0.3 },
  traits: { rivets: true, plumbing: false, glow: false, rails: false, roundness: 16, diesel: true },
};
