import type { StyleProfile } from './style.js';
import type { Palette } from '../types.js';

/**
 * Cyberpunk: neon-lit street and corporate hardware. Angular chassis with
 * screens, exposed cables, stickers, smart sights and LED ammo counters.
 */
const neonDistrict: Palette = {
  Body: { label: 'black polymer', color: '#1c1d24', metallic: 0.2, roughness: 0.4 },
  Barrel: { label: 'gunmetal', color: '#2b2e36', metallic: 0.9, roughness: 0.3 },
  Grip: { label: 'rubberized grip', color: '#25262d', metallic: 0, roughness: 0.75 },
  Stock: { label: 'carbon fiber', color: '#202229', metallic: 0.3, roughness: 0.35 },
  Magazine: { label: 'smoked polymer', color: '#2a2b33', metallic: 0.2, roughness: 0.4 },
  Sight: { label: 'sensor housing', color: '#26282f', metallic: 0.6, roughness: 0.3 },
  Trim: { label: 'gunmetal panel', color: '#3c3f4a', metallic: 0.8, roughness: 0.3 },
  Accent: { label: 'hot pink', color: '#ff2a6d', metallic: 0.1, roughness: 0.35 },
  Detail: { label: 'dark alloy', color: '#15161b', metallic: 0.85, roughness: 0.35 },
  Glass: { label: 'cyan glass', color: '#7ff0ff', metallic: 0, roughness: 0.02, opacity: 0.35 },
  Emissive: { label: 'neon cyan', color: '#002a30', metallic: 0, roughness: 0.4, emissive: '#05d9e8', emissiveStrength: 2.6 },
};

const corpoWhite: Palette = {
  ...neonDistrict,
  Body: { label: 'white ceramic', color: '#e4e6ea', metallic: 0.1, roughness: 0.25 },
  Stock: { label: 'white ceramic', color: '#dadde2', metallic: 0.1, roughness: 0.28 },
  Magazine: { label: 'grey polymer', color: '#8a8f98', metallic: 0.2, roughness: 0.35 },
  Trim: { label: 'satin silver', color: '#a9afb8', metallic: 1, roughness: 0.22 },
  Accent: { label: 'corporate red', color: '#e0313c', metallic: 0.1, roughness: 0.35 },
  Emissive: { label: 'ice white', color: '#102028', metallic: 0, roughness: 0.4, emissive: '#d1f7ff', emissiveStrength: 2.4 },
};

const toxicStreet: Palette = {
  ...neonDistrict,
  Body: { label: 'scuffed charcoal', color: '#2c2f2a', metallic: 0.3, roughness: 0.6 },
  Stock: { label: 'yellow polymer', color: '#c9b52a', metallic: 0.1, roughness: 0.5 },
  Accent: { label: 'acid yellow', color: '#f9f002', metallic: 0.1, roughness: 0.45 },
  Emissive: { label: 'toxic green', color: '#002a15', metallic: 0, roughness: 0.4, emissive: '#00ff9f', emissiveStrength: 2.6 },
  Glass: { label: 'green glass', color: '#9affd0', metallic: 0, roughness: 0.02, opacity: 0.35 },
};

const chromeRonin: Palette = {
  ...neonDistrict,
  Body: { label: 'black chrome', color: '#2a2c33', metallic: 1, roughness: 0.12 },
  Trim: { label: 'chrome', color: '#cfd3da', metallic: 1, roughness: 0.08 },
  Stock: { label: 'black lacquer', color: '#141418', metallic: 0.2, roughness: 0.2 },
  Accent: { label: 'ultraviolet', color: '#7b2fff', metallic: 0.1, roughness: 0.35 },
  Emissive: { label: 'violet neon', color: '#180030', metallic: 0, roughness: 0.4, emissive: '#b26bff', emissiveStrength: 2.6 },
  Glass: { label: 'violet glass', color: '#d0b0ff', metallic: 0, roughness: 0.02, opacity: 0.35 },
};

export const cyber: StyleProfile = {
  id: 'cyber',
  name: 'Cyberpunk',
  description: 'Neon street hardware: angular chassis, screens, exposed cables, stickers and smart sights.',
  palettes: [
    { name: 'Neon District', materials: neonDistrict },
    { name: 'Corpo White', materials: corpoWhite },
    { name: 'Toxic Street', materials: toxicStreet },
    { name: 'Chrome Ronin', materials: chromeRonin },
  ],
  params: {
    length: [0.3, 0.8],
    bulk: [0.45, 0.85],
    ornament: [0.3, 0.7],
    detail: [0.5, 0.9],
    smoothness: [0.5, 0.85],
    wear: [0.05, 0.4],
  },
  parts: {
    receiver: { chassis: 1.2, street: 1, plated: 0.5, angular: 0.3, industrial: 0.5, skeletal: 0.5, capsule: 0.3 },
    barrel: { shrouded: 0.8, fluted: 0.8, rails: 0.5, bull: 0.4 },
    muzzle: { smart: 1.2, suppressor: 0.6, compensator: 0.6, brake: 0.3, vented: 1, shroud: 0.4, baffle: 0.3 },
    handguard: { cabled: 1.2, quad: 0.6, slim: 0.5, shell: 0.3 },
    stock: { blade: 1.2, collapsible: 0.6, frame: 0.6, skeletal: 0.4, thumbhole: 0.3 },
    grip: { neon: 1.2, ergo: 0.6, loop: 0.4, skeleton: 0.4 },
    magazine: { smartmag: 1.2, straight: 0.5, curved: 0.4, cell: 0.3, twin: 0.2 },
    sight: { auto: 1 },
  },
  byArchetype: {
    pistol: {
      frame: { smartgun: 2, holdout: 1.2, polymer: 1, bullpup: 0.8, slide: 0.8, cannon: 0.6, loop: 0.5, taser: 0.5, compact: 0.5, coil: 0.4 },
      grip: { block: 1, swept: 1 },
      muzzle: { none: 2, smart: 1, compensator: 0.6, suppressor: 0.5 },
    },
    crossbow: {
      tiller: { rail: 1.5, sleek: 1, pistol: 0.6, repeater: 0.25 },
      prod: { compound: 1.5, energy: 1 },
      stock: { blade: 1.5, collapsible: 0.6, skeletal: 0.5 },
      grip: { neon: 1.5, ergo: 0.6 },
    },
    bow: {
      bow: { compound: 2, energy: 1 },
      arrow: { broadhead: 1, energy: 1, field: 0.5 },
    },
  },
  optics: { smart: 1.5, reddot: 0.8, holo: 0.8, scope: 0.4 },
  traits: { rivets: false, plumbing: false, glow: true, rails: true, roundness: 16, cyber: true },
};
